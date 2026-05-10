# Compliance

> A systematic guide to complying with security-related laws, regulations, and industry standards, focusing on GDPR, SOC 2, and PCI DSS, including implementation details

## Prerequisites

The following knowledge is required to understand this chapter.

- **Cryptography basics** — How symmetric and asymmetric encryption works (see Encryption)
- **Access control** — Concepts of RBAC/ABAC (see Authentication and Authorization)
- **Logging and monitoring** — Basic mechanisms of audit logs (see [Monitoring/Logging](./01-monitoring-logging.md))
- **Network security** — Basics of firewalls and TLS

---

## What You Will Learn in This Chapter

1. **GDPR (General Data Protection Regulation)** — EU personal data protection regulations and technical responses
2. **SOC 2** — Audit reports on internal controls for service organizations and key compliance points
3. **PCI DSS** — Security requirements for systems that handle credit card information
4. **HIPAA** — US healthcare information protection regulations
5. **Japan's Act on the Protection of Personal Information** — Legal requirements within Japan
6. **Compliance automation** — Implementation methods for continuous compliance
7. **Audit response in practice** — Concrete processes from audit preparation to completion

---

## 1. Overview of Compliance

### Why Compliance Matters

Compliance is not merely about adhering to laws and regulations — it is a framework for systematically building and maintaining an organization's security posture. There are four key reasons why compliance is important.

1. **Avoiding legal risk** — GDPR violations can result in fines of up to EUR 20 million or 4% of global annual turnover. In 2023, Meta received a fine of EUR 1.2 billion.
2. **Building customer trust** — SOC 2 Type II reports have become a de facto requirement in B2B SaaS enterprise deals.
3. **Strengthening the security posture** — The process of meeting compliance requirements systematically builds an organization's security foundation.
4. **Ensuring business continuity** — Merchants that are non-compliant with PCI DSS may have card processing suspended, directly impacting business operations.

### Classification of Major Regulations and Standards

```
+------------------------------------------------------------------+
|              Classification of Security Compliance               |
|------------------------------------------------------------------|
|                                                                  |
|  [Regulations (Legal Obligations)]                               |
|  +-- GDPR (EU General Data Protection Regulation)                |
|  |   +-- Scope: Processing personal data within the EU           |
|  |   +-- Enforcement: May 25, 2018                               |
|  +-- Act on the Protection of Personal Information (Japan)       |
|  |   +-- 2022 amendment: Mandatory breach reporting, penalties   |
|  +-- CCPA/CPRA (California)                                      |
|  |   +-- Focuses on consumer opt-out rights                      |
|  +-- HIPAA (US healthcare information)                           |
|  |   +-- Protection of PHI (Protected Health Information)        |
|  +-- LGPD (Brazil General Data Protection Law)                   |
|  |   +-- Similar structure to GDPR                               |
|  +-- PIPA (South Korea Personal Information Protection Act)      |
|                                                                  |
|  [Industry Standards (Industry Obligations)]                     |
|  +-- PCI DSS (Card payments)                                     |
|  |   +-- v4.0: Fully applicable from March 31, 2024              |
|  +-- FISC (Center for Financial Industry Information Systems)    |
|  |   +-- Guidelines for Japanese financial institutions          |
|  +-- SWIFT CSP (International transfers)                         |
|                                                                  |
|  [Audit Frameworks (Trust Verification)]                         |
|  +-- SOC 2 Type I/II                                             |
|  |   +-- Based on AICPA Trust Service Criteria                   |
|  +-- ISO 27001                                                   |
|  |   +-- ISMS (Information Security Management System)           |
|  +-- ISO 27701                                                   |
|  |   +-- PIMS (Privacy Information Management System)            |
|  +-- ISO 27017 / ISO 27018                                       |
|      +-- Cloud security / Cloud privacy                          |
|                                                                  |
|  [Best Practices (Voluntary)]                                    |
|  +-- NIST Cybersecurity Framework (CSF) v2.0                     |
|  +-- CIS Controls v8                                             |
|  +-- OWASP Top 10                                                |
|  +-- NIST SP 800-53 Rev.5                                        |
|  +-- COBIT 2019                                                  |
+------------------------------------------------------------------+
```

### Comparison of Regulations and Standards

| Item | GDPR | SOC 2 | PCI DSS | ISO 27001 | HIPAA | Personal Information Protection Act |
|------|------|-------|---------|-----------|-------|------------|
| Target | EU personal data | SaaS services in general | Card payments | Information security in general | Medical information (PHI) | Personal information in Japan |
| Enforcement | Law | Customer requirement | Industry standard (de facto mandatory) | Voluntary (may be required by contract) | Law | Law |
| Penalties | Up to EUR 20M or 4% of revenue | None (loss of trust) | Fines + card processing suspension | None | Up to $1.5M/year | Up to JPY 100M (corporate) |
| Audit | Regulatory authority | Independent auditor (CPA) | QSA / ISA | Certification body | HHS OCR | Personal Information Protection Commission |
| Update frequency | As needed | Annual | Revised every 3-4 years | Annual surveillance | As needed | Reviewed every 3 years |
| Certification period | N/A | 3-12 months | 6-18 months | 6-12 months | N/A | N/A |

### Mapping Between Compliance Frameworks

Many organizations need to simultaneously satisfy multiple compliance requirements. Since 60-80% of controls overlap across frameworks, an integrated approach is efficient.

```
+------------------------------------------------------------------+
|          Conceptual diagram of control mapping                   |
|------------------------------------------------------------------|
|                                                                  |
|     GDPR        SOC 2       PCI DSS      ISO 27001              |
|      |            |            |             |                   |
|      v            v            v             v                   |
|  +------------------------------------------------------+       |
|  |       Integrated Control Framework (GRC)             |       |
|  |------------------------------------------------------|       |
|  |  Access control → GDPR Art.32 / CC6.1 / Req.7 / A.9 |       |
|  |  Encryption    → GDPR Art.32 / CC6.7 / Req.3,4 / A.10|      |
|  |  Log monitoring→ GDPR Art.30 / CC7.2 / Req.10 / A.12 |      |
|  |  Change mgmt   →    --      / CC8.1 / Req.6 / A.12   |      |
|  |  Incident      → GDPR Art.33 / CC7.3 / Req.12 / A.16 |      |
|  |  Vuln mgmt     →    --      / CC7.1 / Req.5,6,11/ A.12|     |
|  |  Training      → GDPR Art.39 / CC1.4 / Req.12 / A.7  |      |
|  +------------------------------------------------------+       |
+------------------------------------------------------------------+
```

---

## 2. GDPR

### GDPR Scope and Basic Concepts

GDPR (General Data Protection Regulation) is the EU personal data protection regulation that came into force on May 25, 2018. Correctly understanding the scope of GDPR is the first step in addressing it.

**Applicability conditions (geographical scope — Article 3)**:
- An organization with a base in the EU that processes data
- An organization outside the EU that provides goods or services to individuals in the EU
- An organization outside the EU that monitors the behavior of individuals in the EU

**Key terms**:
- **Data Subject** — A natural person who is the subject of personal data
- **Data Controller** — An entity that determines the purposes and means of processing data
- **Data Processor** — An entity that processes data on behalf of the controller
- **DPO (Data Protection Officer)** — The data protection officer. Appointment is mandatory for organizations that carry out large-scale data processing.

### The 7 Principles of GDPR

```
+------------------------------------------------------------------+
|                  GDPR 7 Data Protection Principles               |
|------------------------------------------------------------------|
|                                                                  |
|  1. Lawfulness, Fairness, and Transparency                       |
|     → Processing must be based on one of the 6 legal bases       |
|     → Publish a privacy policy in plain language                 |
|     → Notify data subjects of the purpose and legal basis        |
|                                                                  |
|  2. Purpose Limitation                                           |
|     → Use data only for the purposes stated at collection        |
|     → Conduct a compatibility test when adding purposes later    |
|     → Archive, scientific research, statistical purposes are     |
|       considered compatible                                      |
|                                                                  |
|  3. Data Minimisation                                            |
|     → Collect only the minimum data necessary for the purpose    |
|     → Do not collect data that is merely "nice to have"          |
|     → Periodically review the necessity of data                  |
|                                                                  |
|  4. Accuracy                                                     |
|     → Take reasonable measures to keep data up to date and       |
|       accurate                                                   |
|     → Erase or rectify inaccurate data without delay             |
|                                                                  |
|  5. Storage Limitation                                           |
|     → Retain data only for as long as necessary, then delete     |
|     → Establish and follow data retention policies               |
|     → Periodically review retention periods                      |
|                                                                  |
|  6. Integrity and Confidentiality                                |
|     → Protect data with appropriate technical and organizational |
|       measures                                                   |
|     → Implement encryption, pseudonymization, access control     |
|     → Protect against unauthorized access and data loss          |
|                                                                  |
|  7. Accountability                                               |
|     → Maintain records that demonstrate compliance with the above |
|       6 principles                                               |
|     → Conduct DPIA (Data Protection Impact Assessment)           |
|     → Maintain Records of Processing Activities (ROPA)          |
+------------------------------------------------------------------+
```

### The 6 Legal Bases of GDPR

One of the following six legal bases is required for data processing (Article 6).

| Legal Basis | Description | Use case | Notes |
|---------|------|--------|--------|
| Consent | Explicit consent of the data subject | Marketing emails | Consent can be freely withdrawn |
| Performance of a contract | Processing necessary to perform a contract | Order processing, delivery | Only what is directly necessary for the contract |
| Legal obligation | Processing required by law | Retention of tax records | Must identify the applicable law |
| Vital interests | Processing to protect life or safety of a person | Medical emergencies | Only when other bases cannot be used |
| Public interest | Performance of tasks by public authorities | Administrative services | Limited to public authorities |
| Legitimate interests | Legitimate business purposes of the controller | Fraud prevention, network security | LIA (Legitimate Interest Assessment) required |

### Data Subject Rights and Technical Implementation

```python
# Technical response to data subject rights

import json
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

class GDPRCompliance:
    """GDPR データ主体の権利を実装するサービス

    GDPR 第 12-23 条に定められたデータ主体の 8 つの権利を
    技術的に実装する。各メソッドは監査ログを自動記録し、
    応答期限（原則 1 ヶ月）の管理機能を含む。
    """

    RESPONSE_DEADLINE_DAYS = 30  # 第12条: 原則1ヶ月以内に応答

    def __init__(self, db, audit_logger, notification_service):
        self.db = db
        self.audit = audit_logger
        self.notify = notification_service

    def right_to_access(self, user_id: str, request_id: str) -> dict:
        """アクセス権 (第15条): 保有データの開示

        データ主体は自身に関するデータの処理の有無、処理目的、
        データのカテゴリ、受領者、保存期間等を知る権利を有する。
        """
        self.audit.log("access_request", user_id=user_id, request_id=request_id)

        data = {
            'request_id': request_id,
            'generated_at': datetime.utcnow().isoformat(),
            'deadline': (datetime.utcnow() + timedelta(
                days=self.RESPONSE_DEADLINE_DAYS
            )).isoformat(),
            'personal_data': self.db.get_user_data(user_id),
            'processing_purposes': [
                {'purpose': 'service_provision', 'legal_basis': 'contract'},
                {'purpose': 'analytics', 'legal_basis': 'legitimate_interest'},
                {'purpose': 'marketing', 'legal_basis': 'consent'},
            ],
            'categories': ['identity', 'contact', 'usage', 'payment'],
            'recipients': [
                {'name': 'Stripe', 'purpose': 'payment_processing', 'country': 'US',
                 'safeguard': 'Standard Contractual Clauses'},
                {'name': 'SendGrid', 'purpose': 'email_delivery', 'country': 'US',
                 'safeguard': 'Standard Contractual Clauses'},
            ],
            'retention_period': '3 years after account deletion',
            'data_source': 'user_registration',
            'automated_decision_making': False,
            'right_to_lodge_complaint': 'You may lodge a complaint with your '
                                        'local supervisory authority.',
        }
        return self.export_as_portable_format(data)  # JSON/CSV

    def right_to_rectification(self, user_id: str, corrections: dict) -> dict:
        """訂正権 (第16条): 不正確なデータの訂正

        データ主体は不正確な個人データの訂正を要求でき、
        不完全なデータの補完を要求できる。
        """
        old_data = self.db.get_user_data(user_id)
        changes = []

        for field, new_value in corrections.items():
            if field in old_data and old_data[field] != new_value:
                changes.append({
                    'field': field,
                    'old_value': old_data[field],
                    'new_value': new_value,
                })

        self.db.update_user_data(user_id, corrections)
        self.audit.log("rectification", user_id=user_id, changes=changes)

        # 第三者への通知義務 (第19条)
        self.notify_recipients_of_change(user_id, changes)

        return {'status': 'rectified', 'changes': changes}

    def right_to_erasure(self, user_id: str, request_id: str) -> dict:
        """削除権 / 忘れられる権利 (第17条)

        以下の場合にデータ主体は削除を要求できる:
        - データが目的に不要になった場合
        - 同意を撤回した場合
        - 処理に異議を申し立てた場合
        - 違法な処理の場合

        ただし、法的義務の履行、公共の利益、法的請求の
        行使・防御に必要な場合は例外として保持できる。
        """
        legal_holds = self.check_legal_retention(user_id)

        deleted = []
        retained = []

        for table in self.get_user_tables():
            if table in legal_holds:
                # 匿名化 (削除の代わりに不可逆的な匿名化)
                self.anonymize_data(user_id, table)
                retained.append({
                    'table': table,
                    'reason': legal_holds[table],
                    'action': 'anonymized',
                })
            else:
                self.delete_data(user_id, table)
                deleted.append(table)

        # バックアップからの削除も予約 (次回ローテーション時に削除)
        self.schedule_backup_deletion(user_id)

        # 第三者への通知 (第19条)
        self.notify_recipients_of_erasure(user_id)

        self.audit.log("erasure", user_id=user_id, request_id=request_id,
                      deleted=deleted, retained=retained)

        return {
            'request_id': request_id,
            'deleted': deleted,
            'retained_anonymized': retained,
            'backup_deletion_scheduled': True,
            'third_parties_notified': True,
        }

    def right_to_portability(self, user_id: str, format: str = 'json') -> bytes:
        """データポータビリティ権 (第20条)

        データ主体が提供したデータを、構造化された一般的に使用される
        機械可読形式で受け取り、別のサービスに移転する権利。
        """
        data = self.db.get_user_provided_data(user_id)

        if format == 'json':
            return json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8')
        elif format == 'csv':
            return self.convert_to_csv(data)
        else:
            raise ValueError(f"Unsupported format: {format}")

    def right_to_restriction(self, user_id: str, reason: str) -> dict:
        """処理の制限権 (第18条)

        データの正確性に異議がある場合、処理が違法な場合、
        管理者がデータを不要とするが法的請求に必要な場合等に
        処理の制限を要求できる。
        """
        self.db.set_processing_restriction(user_id, restricted=True)
        self.audit.log("restriction", user_id=user_id, reason=reason)
        return {'status': 'processing_restricted', 'reason': reason}

    def right_to_object(self, user_id: str, processing_purpose: str) -> dict:
        """異議申立権 (第21条)

        データ主体は正当な利益または公共の利益に基づく処理に
        異議を申し立てることができる。ダイレクトマーケティング
        目的の処理に対する異議は無条件で認められる。
        """
        if processing_purpose == 'direct_marketing':
            # ダイレクトマーケティングへの異議は無条件で受理
            self.db.opt_out_marketing(user_id)
            return {'status': 'objection_accepted', 'purpose': processing_purpose}

        # その他の目的は LIA (正当利益評価) を再実施
        return {
            'status': 'objection_received',
            'purpose': processing_purpose,
            'message': 'Your objection will be reviewed within 30 days.',
        }

    def data_breach_notification(self, breach_details: dict):
        """データ侵害通知 (第33条/第34条)

        72 時間以内の監督機関への通知が義務。
        高リスクの場合はデータ主体への通知も必要。
        """
        breach_record = {
            'detected_at': datetime.utcnow().isoformat(),
            'deadline': (datetime.utcnow() + timedelta(hours=72)).isoformat(),
            'details': breach_details,
        }

        # 監督機関に 72 時間以内に通知 (第33条)
        self.notify_supervisory_authority(
            breach_details,
            deadline_hours=72,
        )

        # 高リスクの場合はデータ主体にも通知 (第34条)
        if breach_details['risk_level'] == 'high':
            self.notify_affected_individuals(breach_details)

        self.audit.log("breach_notification", breach=breach_record)
        return breach_record

    def conduct_dpia(self, processing_activity: dict) -> dict:
        """データ保護影響評価 (DPIA) の実施 (第35条)

        以下の場合に DPIA が義務:
        - プロファイリング等の自動処理に基づく体系的評価
        - 特別カテゴリデータの大規模処理
        - 公的にアクセス可能な区域の体系的監視
        """
        dpia = {
            'processing_description': processing_activity,
            'necessity_assessment': self._assess_necessity(processing_activity),
            'risk_assessment': self._assess_risks(processing_activity),
            'mitigation_measures': self._propose_mitigations(processing_activity),
            'dpo_opinion': None,  # DPO による確認が必要
            'conducted_at': datetime.utcnow().isoformat(),
        }
        return dpia
```

### Privacy by Design

Article 25 of GDPR requires that data protection be embedded into system design from the outset. The following shows the 7 foundational principles and implementation patterns.

```
+------------------------------------------------------------------+
|          7 Principles of Privacy by Design                       |
|          (Ann Cavoukian, 2009)                                   |
|------------------------------------------------------------------|
|                                                                  |
|  1. Proactive not Reactive; Preventative not Remedial            |
|     → Eliminate privacy risks at the design stage               |
|                                                                  |
|  2. Privacy as the Default Setting                               |
|     → Maximum privacy protection without any action by the user |
|                                                                  |
|  3. Privacy Embedded into Design                                 |
|     → Privacy is a core function, not an add-on                 |
|                                                                  |
|  4. Full Functionality — Positive-Sum, not Zero-Sum              |
|     → Privacy and security can coexist                          |
|                                                                  |
|  5. End-to-End Security — Full Lifecycle Protection              |
|     → Consistent protection from collection to deletion         |
|                                                                  |
|  6. Visibility and Transparency                                  |
|     → Ensure transparency of processing, enable independent     |
|       verification                                               |
|                                                                  |
|  7. Respect for User Privacy                                     |
|     → User-centric design                                       |
+------------------------------------------------------------------+
```

```python
# プライバシーバイデザインの実装例

class UserRegistration:
    """データ最小化と同意管理を組み込んだユーザ登録

    GDPR 第 5 条 (データ最小化) と第 7 条 (同意の条件) に準拠。
    """

    REQUIRED_FIELDS = ['email']  # サービス提供に最低限必要
    OPTIONAL_FIELDS = {
        'name': {'purpose': 'personalization', 'legal_basis': 'consent'},
        'phone': {'purpose': 'two_factor_auth', 'legal_basis': 'consent'},
        'birthday': {'purpose': 'age_verification', 'legal_basis': 'consent'},
    }

    def register(self, data: dict, consents: dict) -> dict:
        """プライバシーバイデザインに基づくユーザ登録"""
        user_data = {}

        # 必須フィールドのみ (法的根拠: 契約の履行)
        for field in self.REQUIRED_FIELDS:
            user_data[field] = data[field]

        # オプションフィールド (法的根拠: 同意)
        for field, meta in self.OPTIONAL_FIELDS.items():
            if consents.get(f'collect_{field}') and field in data:
                user_data[field] = data[field]

        # 保持期限の設定 (第 5 条 1(e): 保存期間の制限)
        user_data['retention_until'] = self.calculate_retention_date()

        # 同意の記録 (第 7 条 1: 同意の立証責任)
        consent_record = self.record_consent(
            email=user_data['email'],
            consents=consents,
            ip_address=self.get_hashed_ip(),  # 匿名化した IP
            timestamp=datetime.utcnow(),
            consent_version='v2.1',  # 同意文面のバージョン管理
        )

        return self.db.create_user(user_data)

    def calculate_retention_date(self) -> str:
        """保持期限の算出 (サービス提供目的: アカウント存続中 + 3 年)"""
        return (datetime.utcnow() + timedelta(days=365 * 3)).isoformat()


class DataRetentionManager:
    """データ保持ポリシーの自動実行

    保持期限を過ぎたデータを自動的に削除または匿名化する。
    """

    RETENTION_POLICIES = {
        'user_profiles': {'days': 1095, 'action': 'delete'},
        'access_logs': {'days': 365, 'action': 'anonymize'},
        'payment_records': {'days': 2555, 'action': 'archive'},  # 7年 (税法)
        'consent_records': {'days': 1825, 'action': 'archive'},  # 5年
        'session_data': {'days': 30, 'action': 'delete'},
    }

    def execute_retention_policy(self):
        """日次バッチで保持期限超過データを処理"""
        for table, policy in self.RETENTION_POLICIES.items():
            cutoff = datetime.utcnow() - timedelta(days=policy['days'])
            expired_records = self.db.find_expired(table, cutoff)

            if policy['action'] == 'delete':
                count = self.db.delete_records(table, expired_records)
                logger.info(f"Deleted {count} expired records from {table}")
            elif policy['action'] == 'anonymize':
                count = self.db.anonymize_records(table, expired_records)
                logger.info(f"Anonymized {count} expired records from {table}")
            elif policy['action'] == 'archive':
                count = self.db.archive_records(table, expired_records)
                logger.info(f"Archived {count} expired records from {table}")
```

### GDPR International Data Transfers

Transfers of data outside the EU are governed by Chapter 5 of GDPR. The Schrems II ruling in 2020 invalidated the EU-US Privacy Shield, requiring alternative mechanisms.

```
+------------------------------------------------------------------+
|          Mechanisms for GDPR International Data Transfers        |
|------------------------------------------------------------------|
|                                                                  |
|  [Adequacy Decision]                                             |
|  +-- Japan (January 2019, mutual recognition)                   |
|  +-- United Kingdom (June 2021)                                  |
|  +-- South Korea (December 2022)                                 |
|  +-- EU-US Data Privacy Framework (July 2023)                    |
|  → Adequacy decision countries: transfers possible without       |
|    additional measures                                           |
|                                                                  |
|  [Standard Contractual Clauses (SCC)]                            |
|  +-- New SCC from June 2021 (old SCC expired December 2022)      |
|  +-- Module 1: Controller → Controller                           |
|  +-- Module 2: Controller → Processor (most common)              |
|  +-- Module 3: Processor → Processor                             |
|  +-- Module 4: Processor → Controller                            |
|  → Transfer Impact Assessment (TIA) required                     |
|                                                                  |
|  [Binding Corporate Rules (BCR)]                                 |
|  +-- Data transfers between group companies                      |
|  +-- Requires supervisory authority approval (1-2 years)         |
|  +-- For large enterprises                                       |
|                                                                  |
|  [Derogations (Exceptional transfers)]                           |
|  +-- Explicit consent of the data subject                        |
|  +-- Necessary for performance of a contract                     |
|  +-- Important public interest                                   |
|  → Not suitable for repetitive or large-scale data transfers     |
+------------------------------------------------------------------+
```

---

## 3. SOC 2

### SOC 2 Position and Mechanism

SOC 2 (System and Organization Controls 2) is an audit framework established by the AICPA (American Institute of Certified Public Accountants). It is a mechanism by which a third party verifies that cloud service providers appropriately manage customer data, and has become the de facto standard for B2B SaaS.

Typical scenarios where a SOC 2 report is required:
- An enterprise customer requests a SOC 2 report during a business deal
- Listed as a mandatory requirement in an RFP (Request for Proposal)
- Required as a condition for cyber insurance coverage

### SOC 2 Trust Service Criteria (TSC)

```
+------------------------------------------------------------------+
|            SOC 2 Trust Service Criteria (TSC)                    |
|------------------------------------------------------------------|
|                                                                  |
|  CC: Common Criteria (mandatory for all reports — Security)      |
|  +-- CC1: Control Environment                                    |
|  |   → Organizational governance, ethics, people management      |
|  |   → Board and management commitment to security               |
|  +-- CC2: Communication and Information                          |
|  |   → Documentation and communication of security policies      |
|  +-- CC3: Risk Assessment                                        |
|  |   → Conducting periodic risk assessments                      |
|  +-- CC4: Monitoring Activities                                  |
|  |   → Continuously monitoring the effectiveness of controls     |
|  +-- CC5: Control Activities                                     |
|  |   → Policies and procedures to mitigate risks                 |
|  +-- CC6: Logical and Physical Access Controls                   |
|  |   → Authentication, authorization, physical security          |
|  +-- CC7: System Operations                                      |
|  |   → Anomaly detection, incident response                      |
|  +-- CC8: Change Management                                      |
|  |   → Processes for approving, testing, and deploying changes   |
|  +-- CC9: Risk Mitigation                                        |
|      → Vendor management, measures to mitigate business risks    |
|                                                                  |
|  Additional categories (selected as needed):                     |
|  +-- A: Availability                                             |
|  |   → SLA, backups, DR plans                                    |
|  +-- PI: Processing Integrity                                    |
|  |   → Assurance of accuracy and completeness of data processing |
|  +-- C: Confidentiality                                          |
|  |   → Protection of confidential information, encryption,       |
|  |     access control                                            |
|  +-- P: Privacy                                                  |
|      → AICPA Privacy Criteria, alignment with GDPR              |
+------------------------------------------------------------------+
```

### SOC 2 Type I vs Type II

| Item | Type I | Type II |
|------|--------|---------|
| Evaluation target | Control design at a point in time | Control operation over a period of time |
| Evaluation period | Snapshot (1 day) | Typically 6-12 months |
| Reliability | Low (design only) | High (actual operation verified) |
| Use case | Initial acquisition, preparation stage | Full trust verification |
| Acquisition period | 1-3 months | 6-12 months |
| Cost | $20K-$60K | $30K-$100K+ |
| Customer assessment | "A first step" | "A credible proof" |

### Technical Controls for SOC 2 Compliance

```yaml
# SOC 2 統制の実装マッピング (実践的なサンプル)

CC1.4_Security_Training:
  description: "セキュリティ意識向上プログラム"
  controls:
    - name: "新入社員セキュリティ研修"
      implementation: "入社1週間以内に必須研修を受講"
      evidence: "LMS 修了記録、テスト結果"
    - name: "年次セキュリティ研修"
      implementation: "全社員が年1回受講"
      evidence: "LMS 修了記録、受講率レポート"

CC6.1_Logical_Access:
  description: "論理的アクセス制御"
  controls:
    - name: "SSO + MFA の必須化"
      implementation: "Okta SAML + FIDO2 (YubiKey / Passkey)"
      evidence: "Okta ログ、MFA 登録率レポート"
      test_procedure: |
        1. MFA なしでログインを試行し、拒否されることを確認
        2. Okta ダッシュボードで MFA 登録率 100% を確認
        3. 退職者のアカウントが無効化されていることを確認

    - name: "最小権限の IAM ポリシー"
      implementation: "AWS IAM + SCP + Permission Boundary"
      evidence: "IAM Access Analyzer レポート、権限一覧"
      test_procedure: |
        1. IAM Access Analyzer で外部アクセス可能なリソースを確認
        2. 管理者権限を持つユーザの一覧と正当性を確認
        3. 未使用の権限が付与されていないことを確認

    - name: "定期的なアクセスレビュー"
      implementation: "四半期ごとの棚卸し"
      evidence: "アクセスレビュー記録、承認ログ"

CC6.6_External_Threats:
  description: "外部脅威からの保護"
  controls:
    - name: "WAF によるアプリケーション保護"
      implementation: "AWS WAF + CloudFront"
      evidence: "WAF ルール設定、ブロックログ"
    - name: "ペネトレーションテスト"
      implementation: "年次で外部業者が実施"
      evidence: "ペネトレーションテスト報告書、改善対応記録"

CC7.2_Monitoring:
  description: "異常・セキュリティイベントの監視"
  controls:
    - name: "SIEM によるログ監視"
      implementation: "Datadog SIEM + PagerDuty"
      evidence: "アラートログ、インシデント対応記録"
    - name: "脆弱性スキャン"
      implementation: "Trivy (週次)、OWASP ZAP (月次)"
      evidence: "スキャンレポート"

CC7.3_Incident_Response:
  description: "セキュリティインシデントへの対応"
  controls:
    - name: "インシデント対応手順書"
      implementation: "Confluence に文書化、年次で訓練実施"
      evidence: "手順書、訓練記録、ポストモーテムレポート"
    - name: "インシデント通知"
      implementation: "PagerDuty → Slack → 関係者への通知"
      evidence: "通知ログ、通知タイムラインの記録"

CC8.1_Change_Management:
  description: "変更管理プロセス"
  controls:
    - name: "コードレビュー必須"
      implementation: "GitHub PR + 2名承認 + CODEOWNERS"
      evidence: "PR マージログ、レビュー履歴"
    - name: "CI/CD パイプラインテスト"
      implementation: "GitHub Actions (自動テスト + SAST + SCA)"
      evidence: "CI/CD ログ、テストカバレッジレポート"
    - name: "本番デプロイの承認フロー"
      implementation: "GitHub Environments + Required Reviewers"
      evidence: "デプロイログ、承認記録"
```

### SOC 2 Audit Preparation Timeline

```
+------------------------------------------------------------------+
|          Roadmap to SOC 2 Type II Certification                  |
|------------------------------------------------------------------|
|                                                                  |
|  Month 1-2: Gap Assessment                                       |
|  +-- Map current control status to TSC                           |
|  +-- Identify gaps and prioritize                                |
|  +-- Select and engage an audit firm                             |
|                                                                  |
|  Month 2-4: Remediation                                          |
|  +-- Develop policies and procedures                             |
|  +-- Implement technical controls (MFA, encryption, monitoring)  |
|  +-- Deploy tools (Drata / Vanta / Secureframe)                  |
|                                                                  |
|  Month 4-5: Type I Audit (optional)                              |
|  +-- Verify control design at a specific point in time           |
|  +-- Identify and fix issues early                               |
|                                                                  |
|  Month 5-11: Observation Period                                   |
|  +-- Operate controls for a minimum of 6 months                  |
|  +-- Continuously collect and retain evidence                    |
|  +-- Verify no issues through internal audits                    |
|                                                                  |
|  Month 11-12: Type II Audit                                      |
|  +-- Auditors conduct sample testing                             |
|  +-- Verify operating effectiveness of controls                  |
|  +-- Issue report                                                |
|                                                                  |
|  Thereafter: Annual renewal                                      |
|  +-- Update Type II report annually                              |
|  +-- Continuous control operation and evidence collection        |
+------------------------------------------------------------------+
```

---

## 4. PCI DSS

### Overview of PCI DSS v4.0

PCI DSS (Payment Card Industry Data Security Standard) is a security standard that applies to all organizations that handle credit card information. It is established by the PCI SSC (Payment Card Industry Security Standards Council), with participation from the five major card brands: Visa, Mastercard, American Express, JCB, and Discover.

PCI DSS v4.0 was released in March 2022 and fully replaced v3.2.1 on March 31, 2024. Key changes in v4.0:
- **Customized approach** introduced — flexibility to accept alternative methods that meet the objective of a requirement
- **Multi-factor authentication (MFA)** requirements strengthened — MFA required for all access to the Cardholder Data Environment (CDE)
- **Risk-based approach** — mandatory targeted risk analysis
- **Authentication requirements strengthened** — minimum 12-character passwords, anti-phishing measures

### Overview of PCI DSS v4.0 Requirements

```
+------------------------------------------------------------------+
|                PCI DSS v4.0 12 Requirements                      |
|------------------------------------------------------------------|
|                                                                  |
|  [Build and Maintain a Secure Network]                           |
|  Req 1: Install and maintain network security controls           |
|      → Separate CDE (Cardholder Data Environment) with FW/ACL   |
|      → Implement network segmentation                            |
|  Req 2: Apply secure configurations to all system components     |
|      → Change default passwords                                  |
|      → Disable unnecessary services and features                 |
|                                                                  |
|  [Protect Account Data]                                          |
|  Req 3: Protect stored account data                              |
|      → Encrypt, mask, or truncate PAN                            |
|      → Prohibit storage of CVV/PIN                               |
|  Req 4: Protect cardholder data with strong cryptography during  |
|         transmission over open, public networks                  |
|      → Use TLS 1.2 or higher                                     |
|      → Eliminate insecure protocols (SSL, early TLS)             |
|                                                                  |
|  [Maintain a Vulnerability Management Program]                   |
|  Req 5: Protect all systems and networks from malicious software |
|      → Deploy anti-malware solutions                             |
|  Req 6: Develop and maintain secure systems and software         |
|      → Secure Software Development Lifecycle (SDLC)             |
|      → WAF protection for public apps (6.4.2), script mgmt(6.4.3)|
|                                                                  |
|  [Implement Strong Access Control Measures]                      |
|  Req 7: Restrict access to system components and cardholder data |
|         by business need to know                                 |
|      → Principle of least privilege (Need to Know)               |
|  Req 8: Identify users and authenticate access to system         |
|         components                                               |
|      → Expanded MFA requirements (strengthened in v4.0)          |
|      → Minimum 12-character passwords (new in v4.0)              |
|  Req 9: Restrict physical access to cardholder data              |
|      → Physical security controls (physical access management)   |
|                                                                  |
|  [Regularly Monitor and Test Networks]                           |
|  Req 10: Log and monitor all access to system components and     |
|          cardholder data                                         |
|      → Generate, protect, and review audit logs                  |
|      → Time synchronization via NTP                              |
|  Req 11: Test security of systems and networks regularly         |
|      → ASV scans (quarterly), penetration testing (annual)       |
|      → Internal vulnerability scans (quarterly)                  |
|                                                                  |
|  [Maintain an Information Security Policy]                       |
|  Req 12: Support information security with organizational        |
|          policies and programs                                   |
|      → Establish, maintain, and communicate security policies    |
|      → Security awareness program                                |
|      → Incident response plan                                    |
+------------------------------------------------------------------+
```

### PCI DSS Implementation Example

```python
# 要件 3: カードデータの保護

import hashlib
import hmac
import secrets
import logging
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

audit_logger = logging.getLogger('pci_audit')

class CardDataProtection:
    """PCI DSS 要件 3 に準拠したカードデータ保護

    以下の PCI DSS v4.0 要件に対応:
    - 3.3.2: SAD (Sensitive Authentication Data) の保存禁止
    - 3.4.1: PAN の保存時のマスキングまたは暗号化
    - 3.5.1: PAN の暗号化に使用する鍵の管理
    - 3.5.1.2: ディスク暗号化の使用条件
    """

    def __init__(self, encryption_key: bytes, hmac_key: bytes):
        # 要件 3.5.1: 鍵管理 (HSM または KMS 推奨)
        self.aesgcm = AESGCM(encryption_key)
        self.hmac_key = hmac_key

    def store_card(self, pan: str, expiry: str, cvv: str = None) -> dict:
        """カード情報の安全な保存

        PAN は暗号化して保存し、CVV は決して保存しない。
        """
        # 要件 3.3.2: CVV は認可完了後に保存禁止
        if cvv is not None:
            audit_logger.warning("CVV provided but will NOT be stored (PCI DSS 3.3.2)")
            # CVV は認可処理でのみ使用し、直後に破棄

        # 要件 3.4.1: PAN の暗号化 (AES-256-GCM)
        nonce = secrets.token_bytes(12)
        encrypted_pan = self.aesgcm.encrypt(
            nonce, pan.encode(), associated_data=b"pan"
        )

        # 要件 3.4: PAN の末尾 4 桁のみ表示用に保持
        masked_pan = f"****-****-****-{pan[-4:]}"

        # 検索用のトークン化 (要件 3.5 — 可逆暗号化とは別管理)
        token = hmac.new(
            self.hmac_key,
            pan.encode(),
            hashlib.sha256,
        ).hexdigest()

        audit_logger.info(f"Card stored: masked={masked_pan}, token={token[:8]}...")

        return {
            'token': token,               # 検索・参照用
            'masked_pan': masked_pan,      # 表示用
            'encrypted_pan': nonce + encrypted_pan,  # 暗号化 PAN
            'expiry_encrypted': self.aesgcm.encrypt(
                secrets.token_bytes(12), expiry.encode(), associated_data=b"expiry"
            ),
            # CVV は保存しない (要件 3.3.2)
            # PIN は保存しない (要件 3.3.3)
            # 磁気ストライプの全データは保存しない (要件 3.3.1)
        }

    def retrieve_pan(self, encrypted_data: bytes, reason: str,
                     user: str) -> str:
        """PAN の復号 (要件 3.5 + 要件 10 - アクセスログ記録必須)

        復号にはビジネス上の正当な理由と監査ログの記録が必須。
        """
        # 要件 10.2.1: カードデータへのアクセスをログ記録
        audit_logger.info(
            f"PAN decryption: user={user}, reason={reason}"
        )
        nonce = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        return self.aesgcm.decrypt(nonce, ciphertext, associated_data=b"pan").decode()

    def validate_pan_format(self, pan: str) -> bool:
        """PAN のフォーマット検証 (Luhn アルゴリズム)"""
        digits = [int(d) for d in pan if d.isdigit()]
        if len(digits) < 13 or len(digits) > 19:
            return False
        # Luhn チェック
        checksum = 0
        for i, digit in enumerate(reversed(digits)):
            if i % 2 == 1:
                digit *= 2
                if digit > 9:
                    digit -= 9
            checksum += digit
        return checksum % 10 == 0
```

### Card Data Classification and Protection Requirements

```
+------------------------------------------------------------------+
|            Card Data Classification and Protection (v4.0)        |
|------------------------------------------------------------------|
|                                                                  |
|  Data Type         | Store | Encrypt | Mask  | Example          |
|  ----------------------------------------------------------------|
|  PAN (card number) | Yes   | Required| Required| 4111...1111    |
|  Cardholder name   | Yes   | Recommended| --  | TARO YAMADA    |
|  Expiration date   | Yes   | Recommended| --  | 12/26          |
|  Service code      | Yes   | Recommended| --  | 201            |
|  CVV/CVC           | No    | --      | --    | 123            |
|  PIN / PIN Block   | No    | --      | --    | ****           |
|  Magnetic stripe   | No    | --      | --    | --             |
|  EMV chip data     | No    | --      | --    | --             |
|                                                                  |
|  * "No" = must not be stored at all after authorization          |
|  * PAN masking: display only first 6 and last 4 digits           |
|    (displaying BIN + last 4 digits requires a business need)     |
+------------------------------------------------------------------+
```

### PCI DSS Scope Reduction Strategies

```
+------------------------------------------------------------------+
|          4 Strategies for Reducing PCI DSS Scope                 |
|------------------------------------------------------------------|
|                                                                  |
|  Strategy 1: Tokenization                                        |
|  +-- Use a PSP such as Stripe / Braintree                        |
|  +-- Configuration where card data never touches your systems    |
|  +-- May qualify for SAQ-A (simplest form)                       |
|  +-- Recommended: ★★★★★ (most effective)                         |
|                                                                  |
|  Strategy 2: Network Segmentation                                |
|  +-- Isolate CDE in a separate VLAN                              |
|  +-- Systems outside the CDE are out of scope                    |
|  +-- Segmentation testing (twice yearly) required                |
|  +-- Recommended: ★★★★☆                                          |
|                                                                  |
|  Strategy 3: P2PE (Point-to-Point Encryption)                    |
|  +-- Use a PCI SSC-certified P2PE solution                       |
|  +-- End-to-end encryption from terminal to PSP                  |
|  +-- For in-person payments                                      |
|  +-- Recommended: ★★★☆☆ (for in-person payments)                |
|                                                                  |
|  Strategy 4: Cloud Provider Shared Responsibility                |
|  +-- Leverage PCI DSS-compliant environments on AWS/GCP/Azure    |
|  +-- Physical security etc. is the cloud provider's responsibility|
|  +-- Clarify your own responsibility scope (Shared Responsibility |
|      Matrix)                                                     |
|  +-- Recommended: ★★★★☆                                          |
+------------------------------------------------------------------+
```

### SAQ (Self-Assessment Questionnaire) Types

| SAQ Type | Target | Requirements | Main Conditions |
|---------|------|--------|---------|
| SAQ-A | E-commerce that does not handle card data at all | ~22 | Payment page fully hosted by PSP |
| SAQ-A-EP | Redirect-based but partial self-control | ~191 | Controls JavaScript on payment form |
| SAQ-B | Imprinter or dial-up terminal | ~41 | Does not store card data electronically |
| SAQ-B-IP | IP-connected PTS terminals | ~82 | Standalone IP terminals only |
| SAQ-C | POS system (internet-connected) | ~160 | Uses PA-DSS certified application |
| SAQ-C-VT | Virtual terminal (manual input) | ~79 | Web-based virtual terminal only |
| SAQ-D | All others not covered above | ~329 | Full compliance required |

---

## 5. HIPAA (Healthcare Information Protection)

### Basic Structure of HIPAA

HIPAA (Health Insurance Portability and Accountability Act) is the US healthcare information protection law, mandating the protection of PHI (Protected Health Information).

```
+------------------------------------------------------------------+
|            Key HIPAA Rules                                       |
|------------------------------------------------------------------|
|                                                                  |
|  [Privacy Rule]                                                  |
|  +-- Restrictions on use and disclosure of PHI                   |
|  +-- Patient rights (right of access, right to amend)            |
|  +-- Obligation to provide NPP (Notice of Privacy Practices)     |
|  +-- Minimum Necessary Standard                                  |
|                                                                  |
|  [Security Rule]                                                 |
|  +-- Technical requirements for protecting ePHI                  |
|  +-- Administrative Safeguards                                   |
|  +-- Physical Safeguards                                         |
|  +-- Technical Safeguards                                        |
|                                                                  |
|  [Breach Notification Rule]                                      |
|  +-- Affecting 500+: Notify HHS and individuals within 60 days   |
|  +-- Fewer than 500: Report to HHS annually                      |
|  +-- Media notification (for 500+ cases)                         |
+------------------------------------------------------------------+
```

### HIPAA Security Rule Technical Safeguards

```python
# HIPAA Security Rule 準拠の ePHI 保護実装例

class HIPAACompliance:
    """HIPAA Security Rule の技術的保護措置を実装

    §164.312 Technical Safeguards に準拠
    """

    def access_control(self, user_id: str, resource: str) -> bool:
        """§164.312(a)(1) アクセス制御

        ePHI を含むシステムへのアクセスを許可された者のみに制限
        """
        # Unique User Identification (§164.312(a)(2)(i))
        if not self.verify_user_identity(user_id):
            return False

        # Emergency Access Procedure (§164.312(a)(2)(ii))
        if self.is_emergency_mode():
            return self.emergency_access_check(user_id, resource)

        # Automatic Logoff (§164.312(a)(2)(iii))
        if self.session_inactive(user_id, timeout_minutes=15):
            self.terminate_session(user_id)
            return False

        # Role-based access check
        return self.rbac_check(user_id, resource)

    def audit_controls(self, event: dict):
        """§164.312(b) 監査統制

        ePHI へのアクセス・変更を記録する仕組み
        """
        audit_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': event['user_id'],
            'action': event['action'],  # create, read, update, delete
            'resource': event['resource'],
            'phi_accessed': event.get('phi_fields', []),
            'ip_address': event['ip_address'],
            'outcome': event['outcome'],  # success, failure
        }
        # WORM ストレージに書き込み (改竄防止)
        self.audit_store.write_immutable(audit_entry)

    def transmission_security(self, data: bytes, destination: str) -> bytes:
        """§164.312(e)(1) 送信セキュリティ

        ePHI のネットワーク経由の送信時の暗号化
        """
        # Encryption (§164.312(e)(2)(ii))
        # TLS 1.2+ は必須 (NIST SP 800-52 Rev.2 準拠)
        return self.encrypt_for_transmission(data, destination)
```

---

## 6. Japan's Act on the Protection of Personal Information

### Key Points of the 2022 Amendment

```
+------------------------------------------------------------------+
|          Key Points of the 2022 Amendment to the                 |
|          Act on the Protection of Personal Information           |
|------------------------------------------------------------------|
|                                                                  |
|  [Mandatory Breach Reporting]                                    |
|  +-- Reporting to the Personal Information Protection Commission |
|      is now mandatory (initial report: generally within 3-5 days)|
|  +-- Notification to individuals is also now mandatory           |
|  +-- Scope: Sensitive personal information, risk of financial    |
|      harm, risk of malicious use, leaks of over 1,000 records   |
|                                                                  |
|  [Expanded Individual Rights]                                    |
|  +-- Expanded right to request suspension of use and deletion    |
|  +-- Digitization of disclosure requests (disclosure in          |
|      electronic records)                                         |
|  +-- Right to request disclosure of third-party provision records|
|                                                                  |
|  [Strengthened Penalties]                                        |
|  +-- Corporate fines: up to JPY 100 million                      |
|      (previously JPY 500,000)                                    |
|  +-- Increased statutory penalties for unauthorized provision    |
|      of personal information databases                           |
|                                                                  |
|  [New Categories]                                                |
|  +-- New category: Pseudonymously processed information          |
|      (relaxed measures for internal analysis)                    |
|  +-- Regulation of third-party provision of personal-related     |
|      information                                                 |
|  +-- Consent required when combining cookies etc. with other     |
|      information                                                 |
+------------------------------------------------------------------+
```

---

## 7. Compliance Automation

### Mechanism for Continuous Compliance

```
+------------------------------------------------------------------+
|          Continuous Compliance                                    |
|------------------------------------------------------------------|
|                                                                  |
|  [Automated Checks (Infrastructure as Code)]                     |
|  +-- AWS Config Rules → Continuous monitoring of resource config |
|  |   → S3 bucket encryption, prohibition of public access        |
|  +-- Prowler → CIS/PCI DSS benchmark scanning                    |
|  +-- ScoutSuite → Multi-cloud security audit                     |
|  +-- tfsec / checkov → Security scanning of Terraform configs    |
|  +-- OPA (Open Policy Agent) → Codifying policies                |
|                                                                  |
|  [Automated Evidence Collection]                                 |
|  +-- CloudTrail → API operation logs (enabled in all regions)    |
|  +-- VPC Flow Logs → Network traffic logs                        |
|  +-- GitHub Audit Log → Evidence of code changes and reviews     |
|  +-- Okta System Log → Evidence of authentication and access     |
|  +-- PagerDuty → Records of incident response                    |
|                                                                  |
|  [Automated Report Generation]                                   |
|  +-- Security Hub → Aggregation of compliance scores             |
|  +-- Drata/Vanta/Secureframe → Automated SOC 2 evidence          |
|      collection                                                  |
|  +-- AWS Audit Manager → Automated evaluation of audit           |
|      frameworks                                                  |
+------------------------------------------------------------------+
```

### GRC Platform Comparison

| Item | Drata | Vanta | Secureframe | Manual operation |
|------|-------|-------|-------------|---------|
| Supported frameworks | SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS | SOC 2, ISO 27001, HIPAA, GDPR | SOC 2, ISO 27001, HIPAA, PCI DSS | All |
| Automated evidence collection | 75+ integrations | 50+ integrations | 40+ integrations | None |
| Cost (annual) | $10K-$50K | $10K-$40K | $8K-$30K | Labor only |
| Setup period | 1-2 weeks | 1-2 weeks | 1-2 weeks | N/A |
| Auditor integration | Yes | Yes | Yes | Case-by-case |
| Policy templates | Yes | Yes | Yes | Self-created |

### Automation Scripts

```bash
# Prowler で PCI DSS チェックを実行
prowler aws --compliance pci_dss_4.0 --output-formats html,json

# CIS Benchmark チェック (AWS)
prowler aws --compliance cis_2.0_aws --severity critical high

# GDPR 関連チェック
prowler aws --compliance gdpr_aws

# SOC 2 関連チェック
prowler aws --compliance soc2

# HIPAA 関連チェック
prowler aws --compliance hipaa

# レポートを S3 にアップロード
aws s3 cp /tmp/prowler-output/ s3://compliance-reports/$(date +%Y-%m-%d)/ --recursive
```

```python
# AWS Config Rules による継続的コンプライアンス監視

import boto3
import json

def setup_compliance_rules():
    """PCI DSS / SOC 2 に必要な AWS Config Rules のセットアップ"""
    config = boto3.client('config')

    # 主要なマネージドルール
    rules = [
        {
            'name': 'encrypted-volumes',
            'source': 'AWS_CONFIG_RULES',
            'identifier': 'ENCRYPTED_VOLUMES',
            'description': 'EBS ボリュームの暗号化チェック (PCI DSS 3.4)',
        },
        {
            'name': 's3-bucket-server-side-encryption',
            'source': 'AWS_CONFIG_RULES',
            'identifier': 'S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED',
            'description': 'S3 バケットのサーバサイド暗号化 (PCI DSS 3.4)',
        },
        {
            'name': 'iam-user-mfa-enabled',
            'source': 'AWS_CONFIG_RULES',
            'identifier': 'IAM_USER_MFA_ENABLED',
            'description': 'IAM ユーザの MFA 有効化 (PCI DSS 8.3)',
        },
        {
            'name': 'cloudtrail-enabled',
            'source': 'AWS_CONFIG_RULES',
            'identifier': 'CLOUD_TRAIL_ENABLED',
            'description': 'CloudTrail の有効化 (PCI DSS 10.1)',
        },
        {
            'name': 'rds-storage-encrypted',
            'source': 'AWS_CONFIG_RULES',
            'identifier': 'RDS_STORAGE_ENCRYPTED',
            'description': 'RDS ストレージの暗号化 (PCI DSS 3.4)',
        },
        {
            'name': 'vpc-flow-logs-enabled',
            'source': 'AWS_CONFIG_RULES',
            'identifier': 'VPC_FLOW_LOGS_ENABLED',
            'description': 'VPC Flow Logs の有効化 (PCI DSS 10.1)',
        },
    ]

    for rule in rules:
        config.put_config_rule(
            ConfigRule={
                'ConfigRuleName': rule['name'],
                'Description': rule['description'],
                'Source': {
                    'Owner': rule['source'],
                    'SourceIdentifier': rule['identifier'],
                },
                'Scope': {
                    'ComplianceResourceTypes': [],
                },
            }
        )
        print(f"Config Rule '{rule['name']}' created.")


def generate_compliance_report():
    """コンプライアンスレポートの自動生成"""
    config = boto3.client('config')

    response = config.describe_compliance_by_config_rule()
    report = {
        'generated_at': datetime.utcnow().isoformat(),
        'summary': {'compliant': 0, 'non_compliant': 0, 'not_applicable': 0},
        'details': [],
    }

    for rule in response['ComplianceByConfigRules']:
        status = rule['Compliance']['ComplianceType']
        report['details'].append({
            'rule': rule['ConfigRuleName'],
            'status': status,
        })
        if status == 'COMPLIANT':
            report['summary']['compliant'] += 1
        elif status == 'NON_COMPLIANT':
            report['summary']['non_compliant'] += 1
        else:
            report['summary']['not_applicable'] += 1

    return report
```

### Terraform via Policy as Code

```hcl
# OPA (Open Policy Agent) を使った PCI DSS ポリシーの例
# policy/pci_dss.rego

package pci_dss

# 要件 3.4: PAN の暗号化
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_rds_cluster"
    not resource.change.after.storage_encrypted
    msg := sprintf(
        "PCI DSS 3.4: RDS cluster '%s' must have encryption enabled",
        [resource.name]
    )
}

# 要件 4.1: TLS 1.2 以上の使用
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_lb_listener"
    resource.change.after.protocol == "HTTPS"
    resource.change.after.ssl_policy == "ELBSecurityPolicy-2016-08"
    msg := sprintf(
        "PCI DSS 4.1: Load balancer '%s' must use TLS 1.2+ policy",
        [resource.name]
    )
}

# 要件 10.1: ログの有効化
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    not has_logging(resource)
    msg := sprintf(
        "PCI DSS 10.1: S3 bucket '%s' must have access logging enabled",
        [resource.name]
    )
}
```

---

## 8. Audit Response in Practice

### Audit Preparation Checklist

```
+------------------------------------------------------------------+
|          Audit Preparation Checklist (SOC 2 / PCI DSS Common)    |
|------------------------------------------------------------------|
|                                                                  |
|  [Documents]                                                     |
|  [ ] Information Security Policy (annually updated)             |
|  [ ] Access Management Procedures                                |
|  [ ] Change Management Procedures                                |
|  [ ] Incident Response Procedures                                |
|  [ ] Business Continuity Plan (BCP) / Disaster Recovery Plan     |
|  [ ] Risk Assessment Report (annual)                             |
|  [ ] Vendor Management Policy and Evaluation Records             |
|                                                                  |
|  [Technical Evidence]                                            |
|  [ ] Access Review Records (quarterly)                           |
|  [ ] Vulnerability Scan Results and Remediation Records          |
|  [ ] Penetration Test Reports (annual)                           |
|  [ ] Patch Application Records                                   |
|  [ ] Backup / Restore Test Records                               |
|  [ ] Change Management Tickets (PR logs)                         |
|  [ ] Incident Response Records (post-mortems)                    |
|                                                                  |
|  [Personnel Evidence]                                            |
|  [ ] Security Training Completion Records                        |
|  [ ] Non-Disclosure Agreement (NDA) Signing Records              |
|  [ ] Background Check Records                                    |
|  [ ] Records of Access Revocation for Departing Employees        |
+------------------------------------------------------------------+
```

### Mindset for Responding to Auditors

```python
# 監査対応のベストプラクティス (疑似コードで表現)

class AuditResponseStrategy:
    """監査人への効果的な対応戦略"""

    def prepare_evidence(self, control_id: str) -> dict:
        """証跡の事前準備

        原則: 「聞かれる前に用意する」
        """
        return {
            'control_description': self.get_control_description(control_id),
            'implementation_details': self.get_implementation(control_id),
            'evidence_artifacts': self.collect_evidence(control_id),
            'test_results': self.get_test_results(control_id),
            'exceptions': self.get_known_exceptions(control_id),
        }

    def respond_to_finding(self, finding: dict) -> dict:
        """指摘事項への対応

        原則: 「否定せず、具体的な改善計画を提示する」
        """
        return {
            'finding_id': finding['id'],
            'acknowledgment': True,
            'root_cause': self.analyze_root_cause(finding),
            'remediation_plan': {
                'short_term': self.get_immediate_fix(finding),
                'long_term': self.get_permanent_fix(finding),
                'timeline': self.estimate_timeline(finding),
                'owner': self.assign_owner(finding),
            },
        }

    # DO NOT:
    # - 証跡を後から作成する (監査人は日付の整合性をチェックする)
    # - 質問されていないことまで回答する (スコープ拡大のリスク)
    # - 技術的に不正確な説明をする (信頼の喪失)
```

---

## 9. Edge Cases

### Edge Case 1: Conflict Between GDPR and Other Regulations

There are cases where the GDPR right to erasure conflicts with the obligation to retain accounting records under tax law. For example, Germany's AO (tax law) requires retention of commercial documents for 10 years. In this case, retention is permitted based on Article 17(3)(b) of GDPR as "compliance with a legal obligation," but it is necessary to apply restriction of processing (Article 18) to limit processing to purposes other than retention.

### Edge Case 2: Deletion of Data from Backups

When a deletion request is received under the GDPR right to erasure, immediate deletion of data contained in backups may be technically difficult. In this case, the following approaches are acceptable:
- Schedule deletion at the next backup rotation
- Introduce a mechanism to re-delete target data upon restoration (Crypto Erasure)
- Achieve de facto data deletion by destroying the encryption key (Crypto Shredding)

### Edge Case 3: Exercising Data Subject Rights in a Microservices Environment

In a microservices architecture, data is distributed across multiple services. The following design is necessary to reliably retrieve and delete data from all services when exercising the right of erasure or access:

```
+------------------------------------------------------------------+
|          GDPR-compliant Architecture for Microservices           |
|------------------------------------------------------------------|
|                                                                  |
|  [GDPR Orchestrator Service]                                     |
|  +-- Centrally manages data subject rights requests              |
|  +-- Distributes requests to each service via fan-out            |
|  +-- Confirms completion from all services using Saga pattern    |
|                                                                  |
|  User API  ---+                                                  |
|  Order API ---+--> GDPR Orchestrator --> Aggregate & respond     |
|  Analytics ---+     |                                            |
|  Payment API--+     +-- Track responses from all services        |
|                     +-- Retry on timeout/failure                 |
|                     +-- Record audit log                         |
+------------------------------------------------------------------+
```

### Edge Case 4: Customized Approach in PCI DSS

The customized approach introduced in PCI DSS v4.0 allows organizations to propose alternative methods that meet the "objective" of a requirement instead of the defined approach (the traditional method). However, a targeted risk analysis must be conducted and verification by a QSA is required, which may be burdensome for small organizations.

---

## 10. Anti-Patterns

### Anti-Pattern 1: Compliance Only at Annual Audits

```
BAD:
  → Implementing measures only right before an audit ("audit season")
  → Controls are not functioning for most of the year
  → Creating documentation only for the audit (becoming a formality)
  → "Evidence creation" just before the audit is caught by auditors

  Root causes:
  → Treating compliance as a "cost"
  → Lack of commitment from management
  → Inability to integrate with daily operations

GOOD:
  → Automate continuous compliance monitoring
  → Daily checks with AWS Config / Security Hub
  → Automatically collect evidence to reduce audit burden
  → Embed compliance into the development process (Compliance as Code)
  → Constant visibility through GRC platforms (Drata/Vanta)
```

### Anti-Pattern 2: Checklist-Based Compliance

```
BAD:
  → Meeting requirements only formally (letter of the law)
  → Example: "Encryption required" → MD5 hash as "encryption implemented"
  → Example: "Log collection" → Logs collected but never analyzed
  → Example: "Password policy" → Force changes every 90 days
       (NIST SP 800-63B does not recommend periodic changes)

  Root causes:
  → Not understanding the "intent" of requirements
  → Lack of security expertise
  → Organizational culture that prioritizes formal achievement

GOOD:
  → Understand the intent of requirements and implement effective measures
    (spirit of the law)
  → Encryption → AES-256-GCM + AWS KMS managed keys
  → Logging → SIEM integration + anomaly detection rules + periodic review
  → Authentication → Migration to passwordless authentication (FIDO2)
  → Verify effectiveness through regular penetration testing
```

### Anti-Pattern 3: Uniform Compliance Applied Across the Entire Organization

```
BAD:
  → Applying PCI DSS requirements to all systems (excessive controls)
  → Increased costs, slower development speed
  → Spreading the perception that "security is a hassle"

GOOD:
  → Define scope appropriately based on risk
  → PCI DSS only for CDE, other systems based on CIS Controls
  → Minimize scope through segmentation
  → Apply appropriate levels of controls for each environment
```

---

## 11. Exercises

### Exercise 1: Processing a GDPR Data Subject Access Request (DSAR)

**Task**: A user has submitted an access request under Article 15 of GDPR. Design a system that meets the following requirements.

1. Comprehensively collect user data distributed across multiple databases (PostgreSQL, Redis, S3)
2. Generate a list of data shared with third parties
3. Manage the response deadline (30 days)
4. Provide data in a portable format (JSON)

**Hints**:
- It is important to maintain a data inventory (ROPA — Records of Processing Activities) in advance
- Implement a "GDPR endpoint" in each service and integrate using the Orchestrator pattern

### Exercise 2: Automated SOC 2 Type II Evidence Collection

**Task**: Create a script to automatically collect evidence for the following SOC 2 controls.

1. CC6.1: Verify that MFA enrollment rate is 100% (Okta API)
2. CC7.2: Summary of vulnerability scan results for the past 30 days
3. CC8.1: Verify that all production deployments have gone through PR review (GitHub API)

**Expected output**: JSON/CSV report in a format that can be submitted to auditors

### Exercise 3: Designing PCI DSS Scope Reduction

**Task**: Design an architecture that minimizes the PCI DSS scope of your own e-commerce site.

1. Current configuration: Receive card information on your own server and send to a payment gateway
2. Goal: Reduce scope to SAQ-A or SAQ-A-EP level
3. Propose a design leveraging Stripe Elements / PaymentIntents

**Hints**:
- Use Stripe.js so that card information does not pass through your own servers
- An ideal configuration uses an iFrame-based payment form where JavaScript from your own domain cannot access card data

### Exercise 4: Building a Compliance Dashboard

**Task**: Design a dashboard using AWS Security Hub and CloudWatch to display the following compliance metrics in real time.

1. PCI DSS benchmark score (% compliant)
2. CIS Benchmark score
3. Number of unresolved Critical/High vulnerabilities
4. Config Rules compliance status

---

## 12. FAQ

### Q1. Should I obtain SOC 2 or ISO 27001?

For SaaS targeting the North American market, SOC 2 is the standard requirement. ISO 27001 has higher recognition in global markets. Many organizations obtain both. Check your customers' requirements first and obtain whichever is most in demand. Since there is about 60-70% overlap in controls, obtaining one makes it relatively easier to obtain the other.

Practical decision criteria:
- **Prioritize SOC 2**: North American B2B SaaS, startups making their first certification
- **Prioritize ISO 27001**: Global expansion, transactions with government/public institutions, European market
- **Both simultaneously**: Efficient acquisition is possible (integrated audit approach)

### Q2. Does GDPR apply even if I have no customers in the EU?

If you are providing services to individuals in the EU, or monitoring the behavior of individuals in the EU, GDPR applies regardless of where the company is located (extraterritorial application under Article 3). Japanese companies that provide services to EU residents are also subject to GDPR.

Specific criteria for determining applicability:
- Website has non-English EU languages or EUR currency options
- Intentionally targeting EU residents
- Collecting behavioral data from EU residents (cookies, tracking)

### Q3. How can I reduce the PCI DSS scope?

Use a tokenization service (Stripe, AWS Payment Cryptography) to avoid handling card information in your own systems. This significantly reduces PCI DSS scope, and may allow you to use SAQ-A (the simplest self-assessment questionnaire). If there is no need to retain or process card information in-house, scope reduction should be the first consideration.

### Q4. How much does compliance cost?

| Item | Startup (50 employees) | Mid-size (200 employees) | Large enterprise (1000+ employees) |
|------|-------------------|----------------|-----------------|
| SOC 2 Type II (initial) | $50K-$100K | $100K-$200K | $200K-$500K |
| ISO 27001 (initial) | $30K-$80K | $80K-$150K | $150K-$300K |
| PCI DSS (SAQ-D) | $50K-$200K | $200K-$500K | $500K-$1M+ |
| GRC platform | $10K-$30K/year | $30K-$60K/year | $60K-$150K/year |

* The above are rough estimates of audit fees + tool fees + consulting fees. Labor costs are not included.

### Q5. How can I efficiently manage multiple compliance requirements?

A Unified Compliance Framework approach is effective:
1. Identify common controls and satisfy multiple requirements with a single implementation
2. Manage control mapping with a GRC platform
3. Automate evidence collection and reuse the same evidence across multiple audits
4. Conduct integrated internal audits to prevent audit fatigue

---


## FAQ

### Q1: What is the most important point when learning about this topic?

Gaining practical experience is most important. Rather than theory alone, understanding deepens by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and moving to applications. It is recommended to thoroughly understand the basic concepts explained in this guide before moving to the next step.

### Q3: How is this applied in actual practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------|
| GDPR | Data minimization, consent management, breach notification within 72 hours, international data transfers |
| SOC 2 | Design and operation of controls based on Trust Service Criteria, Type II for trust verification |
| PCI DSS | Card data encryption, masking, and access control; MFA requirements strengthened in v4.0 |
| HIPAA | Protection of ePHI, administrative, physical, and technical safeguards under the Security Rule |
| Act on the Protection of Personal Information | 2022 amendment mandates breach reporting, corporate fines up to JPY 100 million |
| Continuous compliance | Automated monitoring with AWS Config + Prowler + GRC platforms |
| Automated evidence collection | Streamline audit preparation with CloudTrail + GitHub logs + Okta logs |
| Scope reduction | Minimize scope with tokenization + segmentation |
| Policy as Code | Manage compliance as code with OPA / tfsec / checkov |

---

## Further Reading

- [Security Culture](./03-security-culture.md) — Culture for promoting compliance across the organization
- [Incident Response](./00-incident-response.md) — Flow for responding to GDPR data breach notifications
- [Monitoring/Logging](./01-monitoring-logging.md) — Log collection and retention required for compliance
- Encryption — Encryption technologies required by PCI DSS / GDPR
- Access Control — Access controls required by SOC 2 CC6

---

## References

1. **GDPR Full Text (Japanese translation)** — https://www.ppc.go.jp/enforcement/infoprovision/EU/
2. **GDPR Full Text (English original)** — https://eur-lex.europa.eu/eli/reg/2016/679/oj
3. **AICPA SOC 2 Trust Service Criteria** — https://www.aicpa.org/resources/landing/system-and-organization-controls-soc-suite-of-services
4. **PCI DSS v4.0** — https://www.pcisecuritystandards.org/document_library/
5. **PCI DSS v4.0 Summary of Changes** — https://www.pcisecuritystandards.org/document_library/
6. **NIST Cybersecurity Framework v2.0** — https://www.nist.gov/cyberframework
7. **NIST SP 800-53 Rev.5** — https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
8. **HIPAA Security Rule** — https://www.hhs.gov/hipaa/for-professionals/security/index.html
9. **Act on the Protection of Personal Information (2022 Amendment)** — https://www.ppc.go.jp/personalinfo/legal/
10. **Prowler (AWS Security Audit Tool)** — https://github.com/prowler-cloud/prowler
11. **OWASP Top 10** — https://owasp.org/www-project-top-ten/
12. **CIS Controls v8** — https://www.cisecurity.org/controls
