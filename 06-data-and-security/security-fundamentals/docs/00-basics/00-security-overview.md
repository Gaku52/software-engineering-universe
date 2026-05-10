# Security Overview

> A systematic overview of information security, from the foundational CIA Triad, to additional attributes, threat classification, risk assessment, major frameworks, defense in depth, and security culture. This chapter establishes the big picture of security and builds the foundation for deeper exploration in subsequent chapters.

## What You Will Learn

1. Understand the meaning, interrelationships, and trade-offs of the **CIA Triad** (Confidentiality, Integrity, Availability)
2. Grasp the basic process and quantitative/qualitative methods of **threat classification and risk assessment**
3. Learn the characteristics and appropriate use of **major security frameworks** (NIST CSF, ISO 27001, CIS Controls, etc.)
4. Acquire the design philosophy behind **defense in depth and the Security Development Lifecycle**

## Prerequisites

- Programming basics (ability to read basic Python syntax)
- Networking basics (overview of HTTP and TCP/IP)
- [../01-web-security/00-owasp-top10.md](../01-web-security/00-owasp-top10.md) -- OWASP Top 10 (recommended after reading this chapter)
- [../../../authentication-and-authorization/docs/00-fundamentals/](../../../authentication-and-authorization/docs/00-fundamentals/) -- Authentication and Authorization Fundamentals (related knowledge)

---

## 1. What Is Information Security?

Information security refers to the full set of activities aimed at protecting information assets from **threats** and ensuring business continuity. It is a comprehensive effort that encompasses not only technical controls but also organizational, human, and process dimensions.

### 1.1 The Three Pillars of Information Security

```
+------------------------------------------------------------------+
|                  The Three Pillars of Information Security        |
|                                                                  |
|  +------------------+  +------------------+  +------------------+|
|  |  Technical       |  |  Organizational  |  |  Human           ||
|  |  Controls        |  |  Controls        |  |  Controls        ||
|  |                  |  |                  |  |                  ||
|  | - Encryption     |  | - Policy         |  | - Security       ||
|  | - Access Control |  |   Development    |  |   Awareness      ||
|  | - IDS/IPS        |  | - Risk           |  |   Training       ||
|  | - FW/WAF         |  |   Management     |  | - Drills &       ||
|  | - Vulnerability  |  | - Incident       |  |   Exercises      ||
|  |   Management     |  |   Response       |  | - Internal       ||
|  | - Log Monitoring |  | - BCP            |  |   Policy         ||
|  |                  |  | - Compliance     |  |   Compliance     ||
|  |                  |  |                  |  | - Social Eng.    ||
|  |                  |  |                  |  |   Countermeasures||
|  +------------------+  +------------------+  +------------------+|
|                                                                  |
|  Effective security is only achieved when all pillars work together|
+------------------------------------------------------------------+
```

### WHY: Why Is Information Security Important?

Information security is not merely a technical challenge — it is the business itself. It has become an indispensable element for organizations for the following reasons:

1. **Legal obligations**: Violations of regulations such as GDPR, personal information protection laws, and PCI DSS can result in enormous fines
2. **Business risk**: The average cost per data breach is approximately $4.45 million (IBM 2023 report)
3. **Loss of trust**: Security incidents directly lead to a collapse of customer trust and can take years to recover from
4. **Supply chain risk**: The impact extends not only to your own organization but also to business partners and vendors

```python
# Code Example 1: Cost estimation model for security incidents
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class IncidentSeverity(Enum):
    """インシデントの深刻度レベル"""
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"
    CRITICAL = "重大"

@dataclass
class SecurityIncident:
    """セキュリティインシデントのモデル"""
    name: str
    severity: IncidentSeverity
    affected_records: int
    detection_days: int  # 検出までの日数
    containment_days: int  # 封じ込めまでの日数

    @property
    def estimated_cost(self) -> float:
        """
        インシデントコストの概算（IBM Cost of Data Breach 2023 ベース）
        レコード単価 * 影響レコード数 + 検出遅延ペナルティ
        """
        cost_per_record = {
            IncidentSeverity.LOW: 50,
            IncidentSeverity.MEDIUM: 120,
            IncidentSeverity.HIGH: 180,
            IncidentSeverity.CRITICAL: 250,
        }
        base_cost = cost_per_record[self.severity] * self.affected_records
        # 検出に200日以上かかると追加コスト30%
        delay_penalty = 1.3 if self.detection_days > 200 else 1.0
        return base_cost * delay_penalty

    @property
    def total_lifecycle_days(self) -> int:
        return self.detection_days + self.containment_days

    def summary(self) -> str:
        return (
            f"インシデント: {self.name}\n"
            f"  深刻度: {self.severity.value}\n"
            f"  影響レコード: {self.affected_records:,}\n"
            f"  ライフサイクル: {self.total_lifecycle_days}日 "
            f"(検出{self.detection_days}日 + 封じ込め{self.containment_days}日)\n"
            f"  推定コスト: ${self.estimated_cost:,.0f}"
        )

# 使用例
breach = SecurityIncident(
    name="顧客情報データベース漏洩",
    severity=IncidentSeverity.HIGH,
    affected_records=50000,
    detection_days=250,
    containment_days=60,
)
print(breach.summary())
# => インシデント: 顧客情報データベース漏洩
# =>   深刻度: 高
# =>   影響レコード: 50,000
# =>   ライフサイクル: 310日 (検出250日 + 封じ込め60日)
# =>   推定コスト: $11,700,000
```

---

## 2. The CIA Triad

The most fundamental principle of information security is composed of three elements known as the **CIA triad**. All security activities aim to achieve these three principles.

```
                    Confidentiality
                    (機密性)
                       /\
                      /  \
                     / 情報 \
                    / セキュ \
                   /  リティ  \
                  /   の核心   \
                 /______________\
          Integrity            Availability
          (完全性)              (可用性)

CIA三原則: すべてのセキュリティ活動の基盤
- 3要素のバランスが重要
- ビジネス要件に応じて優先度を調整
- 1つでも欠けると全体が崩壊する
```

### 2.1 Confidentiality

Ensuring that only authorized parties can access information. The core is protecting data from unauthorized access.

**Why it matters**: When confidentiality is breached, personal data leaks, corporate secrets are exposed, and competitive advantage is lost. In the case of GDPR violations, fines of up to 4% of global annual turnover or €20 million may be imposed.

```python
# Code Example 2: Ensuring confidentiality with Role-Based Access Control (RBAC)
import hashlib
import hmac
import logging
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum, auto
from functools import wraps

# ログ設定（監査証跡として重要）
logger = logging.getLogger("access_control")
logging.basicConfig(level=logging.INFO)

class Permission(Enum):
    """システムの権限定義"""
    READ = auto()
    WRITE = auto()
    DELETE = auto()
    MANAGE_USERS = auto()
    VIEW_AUDIT_LOG = auto()
    EXPORT_DATA = auto()

class DataClassification(Enum):
    """データ分類（機密レベル）"""
    PUBLIC = "公開"
    INTERNAL = "社内限定"
    CONFIDENTIAL = "機密"
    RESTRICTED = "極秘"

@dataclass
class User:
    """ユーザーモデル"""
    user_id: str
    name: str
    role: str
    department: str
    clearance_level: DataClassification = DataClassification.INTERNAL

@dataclass
class AccessControlSystem:
    """ロールベースアクセス制御（RBAC）の実装"""

    role_permissions: Dict[str, Set[Permission]] = field(default_factory=dict)
    data_classifications: Dict[str, DataClassification] = field(default_factory=dict)

    def __post_init__(self):
        # デフォルトのロール定義
        self.role_permissions = {
            "admin": {
                Permission.READ, Permission.WRITE, Permission.DELETE,
                Permission.MANAGE_USERS, Permission.VIEW_AUDIT_LOG,
                Permission.EXPORT_DATA,
            },
            "editor": {
                Permission.READ, Permission.WRITE,
            },
            "viewer": {
                Permission.READ,
            },
            "auditor": {
                Permission.READ, Permission.VIEW_AUDIT_LOG,
            },
        }

    def check_permission(self, user: User, action: Permission,
                         resource: str) -> bool:
        """ユーザーのロールとデータ分類に基づいてアクセスを判定"""
        # ロールに基づく権限チェック
        allowed_permissions = self.role_permissions.get(user.role, set())
        if action not in allowed_permissions:
            self._log_access_denied(user, action, resource, "権限不足")
            return False

        # データ分類に基づくアクセスチェック
        resource_classification = self.data_classifications.get(
            resource, DataClassification.INTERNAL
        )
        if not self._check_clearance(user.clearance_level, resource_classification):
            self._log_access_denied(user, action, resource, "クリアランス不足")
            return False

        self._log_access_granted(user, action, resource)
        return True

    def _check_clearance(self, user_level: DataClassification,
                         resource_level: DataClassification) -> bool:
        """ユーザーのクリアランスレベルがリソースの分類以上かチェック"""
        hierarchy = [
            DataClassification.PUBLIC,
            DataClassification.INTERNAL,
            DataClassification.CONFIDENTIAL,
            DataClassification.RESTRICTED,
        ]
        return hierarchy.index(user_level) >= hierarchy.index(resource_level)

    def _log_access_denied(self, user: User, action: Permission,
                           resource: str, reason: str) -> None:
        logger.warning(
            f"ACCESS DENIED: user={user.user_id}, action={action.name}, "
            f"resource={resource}, reason={reason}"
        )

    def _log_access_granted(self, user: User, action: Permission,
                            resource: str) -> None:
        logger.info(
            f"ACCESS GRANTED: user={user.user_id}, action={action.name}, "
            f"resource={resource}"
        )

# 使用例
acl = AccessControlSystem()
acl.data_classifications["customer_data"] = DataClassification.CONFIDENTIAL
acl.data_classifications["public_catalog"] = DataClassification.PUBLIC

admin_user = User("u001", "Admin Taro", "admin", "IT",
                   DataClassification.RESTRICTED)
viewer_user = User("u002", "Viewer Hanako", "viewer", "Marketing",
                    DataClassification.INTERNAL)

# admin は customer_data にアクセスできる
print(acl.check_permission(admin_user, Permission.READ, "customer_data"))
# => True

# viewer は customer_data にアクセスできない（クリアランス不足）
print(acl.check_permission(viewer_user, Permission.READ, "customer_data"))
# => False
```

### 2.2 Integrity

Ensuring that information has not been tampered with by unauthorized parties. The core is maintaining data in an accurate and trustworthy state.

**Why it matters**: When integrity is breached, financial transactions can be altered, medical records changed, and software tampered with (supply chain attacks). In the SolarWinds incident (2020), a backdoor was inserted into a build system, affecting more than 18,000 organizations.

```python
# Code Example 3: Verifying data integrity with a hash chain
import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class IntegrityRecord:
    """改ざん検知可能なデータレコード"""
    data: dict
    timestamp: float = field(default_factory=time.time)
    previous_hash: str = ""
    record_hash: str = ""

    def __post_init__(self):
        if not self.record_hash:
            self.record_hash = self._compute_hash()

    def _compute_hash(self) -> str:
        """レコードのハッシュを計算（チェーン構造）"""
        content = json.dumps({
            "data": self.data,
            "timestamp": self.timestamp,
            "previous_hash": self.previous_hash,
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def verify(self) -> bool:
        """レコードの完全性を検証"""
        expected = self._compute_hash()
        return hmac.compare_digest(self.record_hash, expected)

class IntegrityChain:
    """ハッシュチェーンによる完全性保証（簡易ブロックチェーン構造）"""

    def __init__(self):
        self.records: List[IntegrityRecord] = []

    def add_record(self, data: dict) -> IntegrityRecord:
        """新しいレコードをチェーンに追加"""
        previous_hash = (
            self.records[-1].record_hash if self.records else "GENESIS"
        )
        record = IntegrityRecord(
            data=data,
            previous_hash=previous_hash,
        )
        self.records.append(record)
        return record

    def verify_chain(self) -> dict:
        """チェーン全体の完全性を検証"""
        results = {"valid": True, "total": len(self.records), "errors": []}

        for i, record in enumerate(self.records):
            # 個別レコードのハッシュ検証
            if not record.verify():
                results["valid"] = False
                results["errors"].append(f"Record {i}: ハッシュ不一致（改ざん検出）")

            # チェーンの連続性検証
            if i > 0:
                expected_prev = self.records[i - 1].record_hash
                if record.previous_hash != expected_prev:
                    results["valid"] = False
                    results["errors"].append(
                        f"Record {i}: チェーン断裂（前レコード改ざん検出）"
                    )

        return results

# 使用例
chain = IntegrityChain()
chain.add_record({"transaction": "入金", "amount": 10000, "user": "alice"})
chain.add_record({"transaction": "出金", "amount": 3000, "user": "alice"})
chain.add_record({"transaction": "送金", "amount": 2000, "user": "bob"})

# 完全性検証
result = chain.verify_chain()
print(f"チェーン検証: {'OK' if result['valid'] else 'NG'}")
print(f"レコード数: {result['total']}")
# => チェーン検証: OK
# => レコード数: 3

# 改ざんテスト
chain.records[1].data["amount"] = 99999  # 改ざん!
result = chain.verify_chain()
print(f"改ざん後の検証: {'OK' if result['valid'] else 'NG'}")
print(f"エラー: {result['errors']}")
# => 改ざん後の検証: NG
# => エラー: ['Record 1: ハッシュ不一致（改ざん検出）']
```

### 2.3 Availability

Ensuring that information and services are accessible when needed. The core is maintaining service continuity and reliability.

**Why it matters**: When availability is breached, service outages cause revenue losses, SLA violations incur penalties, and brand image is damaged. The major AWS outage (December 2021) affected many services including Netflix, Disney+, and Ring, resulting in hours of downtime.

```python
# Code Example 4: Availability monitoring and failover control
import time
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum

class ServiceStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class HealthCheckResult:
    """ヘルスチェック結果"""
    endpoint: str
    status: ServiceStatus
    latency_ms: float
    timestamp: float
    error: Optional[str] = None

@dataclass
class AvailabilityMonitor:
    """サービスの可用性を監視しフェイルオーバーを制御するシステム"""

    endpoints: List[str]
    timeout_seconds: int = 5
    max_failures: int = 3  # フェイルオーバー閾値
    check_interval: int = 30  # ヘルスチェック間隔（秒）
    failure_counts: Dict[str, int] = field(default_factory=dict)
    history: List[HealthCheckResult] = field(default_factory=list)

    def __post_init__(self):
        for ep in self.endpoints:
            self.failure_counts[ep] = 0

    def check_health(self, endpoint: str) -> HealthCheckResult:
        """
        エンドポイントの稼働状態を確認する。
        実際にはHTTPリクエストを送信するが、ここではシミュレーション。
        """
        start = time.time()
        try:
            # 実運用では requests.get(f"{endpoint}/health", timeout=self.timeout_seconds)
            # ここではシミュレーション
            latency = (time.time() - start) * 1000
            result = HealthCheckResult(
                endpoint=endpoint,
                status=ServiceStatus.HEALTHY,
                latency_ms=round(latency, 2),
                timestamp=time.time(),
            )
        except Exception as e:
            result = HealthCheckResult(
                endpoint=endpoint,
                status=ServiceStatus.UNHEALTHY,
                latency_ms=0,
                timestamp=time.time(),
                error=str(e),
            )

        # 失敗カウントの更新
        if result.status == ServiceStatus.UNHEALTHY:
            self.failure_counts[endpoint] = (
                self.failure_counts.get(endpoint, 0) + 1
            )
        else:
            self.failure_counts[endpoint] = 0

        self.history.append(result)
        return result

    def should_failover(self, endpoint: str) -> bool:
        """フェイルオーバーが必要かどうかを判定"""
        return self.failure_counts.get(endpoint, 0) >= self.max_failures

    def select_healthy_endpoint(self) -> Optional[str]:
        """最も健全なエンドポイントを選択"""
        for ep in self.endpoints:
            if not self.should_failover(ep):
                return ep
        return None  # 全エンドポイント障害

    def calculate_uptime(self, endpoint: str) -> float:
        """稼働率を計算"""
        ep_history = [h for h in self.history if h.endpoint == endpoint]
        if not ep_history:
            return 0.0
        healthy = sum(1 for h in ep_history
                      if h.status == ServiceStatus.HEALTHY)
        return (healthy / len(ep_history)) * 100

# 使用例
monitor = AvailabilityMonitor(
    endpoints=[
        "https://primary.example.com",
        "https://secondary.example.com",
        "https://tertiary.example.com",
    ],
    max_failures=3,
)

# ヘルスチェック実行（シミュレーション）
result = monitor.check_health("https://primary.example.com")
print(f"Status: {result.status.value}, Latency: {result.latency_ms}ms")

# フェイルオーバー判定
selected = monitor.select_healthy_endpoint()
print(f"Selected endpoint: {selected}")
```

### 2.4 Interrelationships and Trade-offs of the CIA Triad

The three elements of the CIA Triad influence each other and can produce trade-offs in certain situations.

```
CIA Triad Trade-offs:

  Confidentiality ←─────→ Availability
   Strong encryption        Fast access
   Strict authentication    Convenience
   Access restrictions      Service continuity

      \               /
       \             /
        \           /
         Integrity
         Data accuracy
         Tamper detection
         Audit trail

Trade-off examples:
- Strengthen encryption (Confidentiality↑) → Performance degradation (Availability↓)
- Relax access restrictions (Availability↑) → Increased unauthorized access risk (Confidentiality↓)
- Store large volumes of audit logs (Integrity↑) → Storage pressure (Availability↓)
```

| Principle | Threat Examples | Countermeasure Examples | Impact When Breached | Industry Priority |
|-----------|-----------------|------------------------|----------------------|-------------------|
| Confidentiality | Unauthorized access, eavesdropping, insider threats | Encryption, access control, DLP | Data leaks, privacy violations, regulatory breaches | Finance, healthcare, government |
| Integrity | Data tampering, MITM, malware | Hashing, digital signatures, version control | Fraudulent transactions, loss of trust, legal issues | Finance, manufacturing, healthcare |
| Availability | DDoS, failures, disasters, ransomware | Redundancy, CDN, BCP/DR, backups | Service outages, revenue losses, SLA violations | E-commerce, SaaS, infrastructure |

### Industry CIA Priorities

| Industry | Top Priority | Reason |
|----------|-------------|--------|
| Finance (banking) | Integrity | Accuracy of transaction data is critical |
| Healthcare | Availability | System unavailability in emergencies can cost lives |
| Military/government | Confidentiality | Protection of state secrets is the top priority |
| E-commerce/retail | Availability | Service outages directly cause revenue losses |
| Personal data handlers | Confidentiality | Compliance with GDPR and personal information protection laws |
| Manufacturing/IoT | Integrity | Tampering with control data can cause physical harm |

---

## 3. Additional Security Attributes

Beyond the CIA Triad, the following attributes defined in ISO 27001 and other standards are also important. These are sometimes called the "extended CIA."

```
+-------------------------------------------------------------------+
|                  Extended Security Attributes                      |
|                                                                   |
|  +--------------+  +--------------+  +-----------+  +-----------+ |
|  | 真正性       |  | 責任追跡性    |  | 否認防止   |  | 信頼性    | |
|  | Authenticity |  | Account-     |  | Non-      |  | Relia-    | |
|  |              |  | ability      |  | repudia-  |  | bility    | |
|  |              |  |              |  | tion      |  |           | |
|  | デジタル署名  |  | 監査ログ     |  | タイム     |  | テスト    | |
|  | PKI          |  | アクセスログ  |  | スタンプ   |  | 冗長設計  | |
|  | 証明書       |  | SIEM         |  | 電子署名   |  | 品質管理  | |
|  +--------------+  +--------------+  +-----------+  +-----------+ |
|                                                                   |
|  +--------------+  +--------------+                               |
|  | プライバシー  |  | 安全性       |                               |
|  | Privacy      |  | Safety       |                               |
|  |              |  |              |                               |
|  | データ最小化  |  | フェイル     |                               |
|  | 匿名化       |  | セーフ       |                               |
|  | 同意管理     |  | 物理安全     |                               |
|  +--------------+  +--------------+                               |
+-------------------------------------------------------------------+
```

| Attribute | Description | Implementation | Example |
|-----------|-------------|----------------|---------|
| Authenticity | The source of information is genuine | Digital signatures, PKI, certificate validation | DKIM email signatures |
| Accountability | Actors can be identified and traced | Audit logs, access logs, SIEM | AWS CloudTrail |
| Non-repudiation | Actions cannot be denied after the fact | Timestamps, electronic signatures | Electronic contract services |
| Reliability | The system operates consistently as expected | Testing, redundant design, quality management | SLA 99.99% |
| Privacy | Appropriate handling of personal information | Data minimization, anonymization, consent management | GDPR compliance |
| Safety | Ensuring physical safety | Fail-safe design, safety mechanisms | Industrial control systems |

```python
# Code Example 5: Implementing accountability with audit logs
import json
import time
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass, field, asdict

@dataclass
class AuditLogEntry:
    """改ざん検知機能付き監査ログエントリ"""
    event_id: str
    timestamp: str
    actor: str            # 操作者
    action: str           # 操作内容
    resource: str         # 対象リソース
    result: str           # 成功/失敗
    source_ip: str        # 接続元IP
    details: Dict[str, Any] = field(default_factory=dict)
    integrity_hash: str = ""

    def __post_init__(self):
        if not self.integrity_hash:
            self.integrity_hash = self._compute_hash()

    def _compute_hash(self) -> str:
        """ログエントリの改ざん検知用ハッシュを計算"""
        content = json.dumps({
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "actor": self.actor,
            "action": self.action,
            "resource": self.resource,
            "result": self.result,
            "source_ip": self.source_ip,
            "details": self.details,
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def verify_integrity(self) -> bool:
        """ログエントリの改ざんを検証"""
        import hmac as _hmac
        return _hmac.compare_digest(
            self.integrity_hash, self._compute_hash()
        )

class AuditLogger:
    """監査ログ管理システム"""

    def __init__(self):
        self.logs: list = []
        self._counter = 0

    def log(self, actor: str, action: str, resource: str,
            result: str, source_ip: str,
            details: Optional[Dict[str, Any]] = None) -> AuditLogEntry:
        """監査ログを記録"""
        self._counter += 1
        entry = AuditLogEntry(
            event_id=f"EVT-{self._counter:06d}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            actor=actor,
            action=action,
            resource=resource,
            result=result,
            source_ip=source_ip,
            details=details or {},
        )
        self.logs.append(entry)
        return entry

    def query(self, actor: Optional[str] = None,
              action: Optional[str] = None) -> list:
        """監査ログの検索"""
        results = self.logs
        if actor:
            results = [e for e in results if e.actor == actor]
        if action:
            results = [e for e in results if e.action == action]
        return results

    def verify_all(self) -> Dict[str, Any]:
        """全ログの完全性を検証"""
        total = len(self.logs)
        valid = sum(1 for e in self.logs if e.verify_integrity())
        return {
            "total": total,
            "valid": valid,
            "tampered": total - valid,
            "integrity": "OK" if valid == total else "COMPROMISED",
        }

# 使用例
audit = AuditLogger()
audit.log("admin", "LOGIN", "/auth", "SUCCESS", "192.168.1.100")
audit.log("admin", "DELETE", "/users/42", "SUCCESS", "192.168.1.100",
          {"target_user": "user42", "reason": "規約違反"})
audit.log("user01", "READ", "/reports/financial", "DENIED", "10.0.0.50",
          {"reason": "権限不足"})

# ログの検索
admin_actions = audit.query(actor="admin")
print(f"admin の操作数: {len(admin_actions)}")

# 完全性検証
integrity = audit.verify_all()
print(f"ログ完全性: {integrity['integrity']}")
# => ログ完全性: OK
```

---

## 4. Threat Classification

Systematically classifying and understanding security threats is a prerequisite for implementing effective countermeasures.

### 4.1 Classification by Threat Origin

```
+-------------------------------------------------------------------+
|                    Threat Classification System                    |
|                                                                   |
|  +--- External ---+   +--- Internal ---+   +--- Environmental ---+|
|  |                |   |                |   |                     ||
|  | - APT          |   | - Insider      |   | - Natural disasters ||
|  | - Ransomware   |   |   threats      |   | - Power outages     ||
|  | - Phishing     |   | - Negligence   |   | - Fire              ||
|  | - DDoS         |   | - Social       |   | - Pandemics         ||
|  | - Zero-day     |   |   engineering  |   | - Flooding          ||
|  | - Supply       |   |   victims      |   |                     ||
|  |   chain        |   | - BYOD         |   |                     ||
|  |   attacks      |   | - Shadow IT    |   |                     ||
|  +----------------+   +----------------+   +---------------------+|
|                                                                   |
|  Mitigation directions:                                           |
|  External → FW, IDS/IPS, threat intelligence                     |
|  Internal → Access control, DLP, security training               |
|  Environmental → BCP/DR, redundancy, backups                     |
+-------------------------------------------------------------------+
```

### 4.2 STRIDE Threat Model

STRIDE is a threat classification framework developed by Microsoft that organizes threats into six categories.

| Category | Name | Threatened CIA Attribute | Attack Examples | Countermeasures |
|----------|------|--------------------------|-----------------|-----------------|
| S: Spoofing | Spoofing | Authenticity | Phishing, session hijacking | MFA, certificate authentication |
| T: Tampering | Tampering | Integrity | SQL injection, MITM | Hashing, signatures |
| R: Repudiation | Repudiation | Non-repudiation | Log deletion | Audit logs, signatures |
| I: Information Disclosure | Information Disclosure | Confidentiality | Directory listing | Encryption, ACL |
| D: Denial of Service | Denial of Service | Availability | DDoS, resource exhaustion | CDN, rate limiting |
| E: Elevation of Privilege | Elevation of Privilege | Authorization | Buffer overflow | Least privilege, sandboxing |

For details, see [01-threat-modeling.md](./01-threat-modeling.md).

---

## 5. Risk Assessment

Risk assessment is the process of determining — both quantitatively and qualitatively — "what needs to be protected" and "which threats are most dangerous."

### 5.1 The Risk Formula

```
Risk = Threat × Vulnerability × Impact

  Threat: Likelihood of an attack occurring
  Vulnerability: Existence of a weakness
  Impact: Damage if the attack succeeds

  Risk = High × High × High → Address as top priority
  Risk = High × Low × High → Vulnerability mitigation is effective
  Risk = Low × High × Low → Monitoring is sufficient
```

```python
# Code Example 6: Generating and visualizing a risk matrix
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class RiskItem:
    """リスク評価対象"""
    name: str
    threat_level: int      # 1-5: 脅威レベル
    vulnerability: int     # 1-5: 脆弱性レベル
    impact: int            # 1-5: 影響度

    @property
    def risk_score(self) -> float:
        """リスクスコア（正規化: 0-100）"""
        raw = self.threat_level * self.vulnerability * self.impact
        return round((raw / 125) * 100, 1)  # 125 = 5*5*5

    @property
    def risk_level(self) -> str:
        score = self.risk_score
        if score >= 60:
            return "Critical"
        elif score >= 40:
            return "High"
        elif score >= 20:
            return "Medium"
        return "Low"

    @property
    def recommended_action(self) -> str:
        level = self.risk_level
        actions = {
            "Critical": "即時対応: 緩和策の即座の適用",
            "High": "優先対応: 30日以内に対策を実施",
            "Medium": "計画対応: 次のスプリントで対策を計画",
            "Low": "受容/監視: リスクを受容し定期的に再評価",
        }
        return actions[level]

def generate_risk_matrix() -> str:
    """5x5のリスクマトリクスを文字列として生成する"""
    impact_labels = ["軽微", "  小", "  中", "  大", "甚大"]
    likelihood_labels = ["  稀", "  低", "  中", "  高", "極高"]

    lines = []
    lines.append("影響度→  |  軽微  |   小   |   中   |   大   |  甚大  |")
    lines.append("発生可能性↓" + "-" * 50)

    for l_idx in range(5, 0, -1):
        row_label = likelihood_labels[l_idx - 1]
        cells = []
        for i_idx in range(1, 6):
            score = l_idx * i_idx
            if score >= 20:
                level = "C"  # Critical
            elif score >= 12:
                level = "H"  # High
            elif score >= 6:
                level = "M"  # Medium
            else:
                level = "L"  # Low
            cells.append(f"{score:2d}({level})")
        lines.append(f"  {row_label}   | {'  |  '.join(cells)}  |")

    return "\n".join(lines)

# リスクマトリクスの表示
print(generate_risk_matrix())

# 具体的なリスク評価
risks = [
    RiskItem("SQLインジェクション", 4, 5, 5),
    RiskItem("DDoS攻撃", 3, 3, 4),
    RiskItem("内部者による情報漏洩", 2, 4, 5),
    RiskItem("フィッシング", 5, 3, 3),
]

print("\n--- リスク評価結果 ---")
for risk in sorted(risks, key=lambda r: r.risk_score, reverse=True):
    print(f"{risk.name}: スコア={risk.risk_score}, "
          f"レベル={risk.risk_level}, "
          f"推奨={risk.recommended_action}")
```

### 5.2 Quantitative vs. Qualitative Risk Assessment

| Characteristic | Quantitative Assessment | Qualitative Assessment |
|----------------|------------------------|------------------------|
| Expression | Monetary value (ALE = SLE × ARO) | Level (High/Medium/Low) |
| Precision | High (data-driven) | Subjective (experience-based) |
| Cost | High (data collection required) | Low (expert judgment sufficient) |
| Use cases | Executive decisions, insurance, ROI analysis | Initial assessment, small projects |
| Representative methods | ALE analysis, Monte Carlo | Risk matrix, DREAD |

---

## 6. Security Frameworks

### 6.1 Major Framework Comparison

| Framework | Publisher | Characteristics | Target | Certification | Cost |
|-----------|-----------|-----------------|--------|---------------|------|
| NIST CSF | US NIST | Five functions, highly flexible | All industries | None | Free |
| ISO 27001 | ISO/IEC | ISMS requirements, international standard | All industries (especially international trade) | Yes | Certification fees required |
| CIS Controls | CIS | 18 prioritized, concrete controls | IT operations teams | None | Free |
| SOC 2 | AICPA | Trust Services Criteria | Cloud service providers | Yes | Audit fees required |
| PCI DSS | PCI SSC | 12 requirements for card data protection | Payment-related businesses | Yes | Compliance assessment fees required |
| NIST SP 800-53 | US NIST | Comprehensive security controls | US government agencies | None | Free |

### 6.2 NIST Cybersecurity Framework 2.0

```
NIST CSF 2.0 - Six Functions (Govern added):

                    +----------+
                    | Govern   |
                    +----+-----+
                         |
+----------+    +--------v-+    +----------+
| Identify | -> | Protect  | -> | Detect   |
+----------+    +----------+    +----------+
                                      |
+----------+    +----------+          |
| Recover  | <- | Respond  | <--------+
+----------+    +----------+

The functions are not independent; Govern oversees the entire cycle
```

| Function | Purpose | Key Activities | Deliverable Examples |
|----------|---------|----------------|----------------------|
| Govern | Organizational policy and strategy | Risk management strategy, role definitions | Security policy |
| Identify | Understanding assets and risks | Asset management, risk assessment, environment analysis | Asset inventory, risk register |
| Protect | Protection from threats | Access control, encryption, training | Access control standards |
| Detect | Anomaly detection | Monitoring, log analysis, intrusion detection | SIEM configuration, alert rules |
| Respond | Incident response | Analysis, containment, notification, reporting | Incident response procedures |
| Recover | Business recovery | Recovery plan execution, improvement activities | DR plan, recovery procedures |

---

## 7. Practical Security Approaches

### 7.1 Defense in Depth

A strategy of layering multiple independent defenses rather than relying on a single protection mechanism, reducing the probability of a successful attack. Analogous to the layered defenses of a castle: moat, walls, gatekeepers, soldiers, and keep.

```
Defense in Depth Model (outer to inner):

+------------------------------------------------------------------+
|  L1: Physical Security (access control, locks, surveillance)      |
|  +------------------------------------------------------------+  |
|  |  L2: Network (FW, IDS/IPS, segmentation, VPN)             |  |
|  |  +------------------------------------------------------+  |  |
|  |  |  L3: Host (OS hardening, AV/EDR, patch mgmt, HIDS)   |  |  |
|  |  |  +--------------------------------------------------+|  |  |
|  |  |  |  L4: Application (input validation, authn, authz, ||  |  |
|  |  |  |                   encryption, WAF)                ||  |  |
|  |  |  |  +----------------------------------------------+||  |  |
|  |  |  |  |  L5: Data (encryption, classification, DLP,   |||  |  |
|  |  |  |  |           backups)                            |||  |  |
|  |  |  |  +----------------------------------------------+||  |  |
|  |  |  +--------------------------------------------------+|  |  |
|  |  +------------------------------------------------------+  |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+

An attacker must breach all layers to reach the data
Each layer operates independently; if one is breached, the rest continue to defend
```

### 7.2 Security Development Lifecycle (SDL)

```
SDL Phases:

  Requirements    Design        Implementation  Testing       Operations
  +----------+  +----------+  +----------+  +----------+  +----------+
  | Security |  | Threat   |  | Secure   |  | Vuln.    |  | Monitor- |
  | require- |->| modeling |->| coding   |->| scanning |->| ing      |
  | ments    |  | & review |  |          |  | Pentest  |  | Patch    |
  +----------+  +----------+  +----------+  +----------+  +----------+
       |             |             |             |             |
  Risk assess.  Architecture  SAST/SCA      DAST/IAST    Incident
  Compliance    security      Code review   Red team     response
  check         patterns      Dep. mgmt.    Bug bounty   BCP/DR
```

### 7.3 Zero Trust Architecture

An approach that abandons the assumption that "internal networks are safe" and verifies every access request.

```
Traditional perimeter defense:          Zero Trust:

  +--- External (dangerous) ---+          +--+    +--+    +--+
  |                            |          |Ve|    |Ve|    |Ve|
  |  FW  +--- Internal --------|          |ri| -> |ri| -> |ri|
  |  ==  |  (safe)             |          |fy|    |fy|    |fy|
  |      +---------------------|          +--+    +--+    +--+
  +----------------------------+         Every   Every   Every
                                         request request request
  Once FW is breached, the              Authentication & authorization
  interior is defenseless               on every access
```

For details, see [02-security-principles.md](./02-security-principles.md).

---

## 8. Security Metrics

Indicators for measuring the effectiveness of security. Based on the principle: "You can't manage what you can't measure."

```python
# Code Example 7: Security metrics dashboard
from dataclasses import dataclass, field
from typing import List, Dict
from datetime import datetime, timedelta

@dataclass
class SecurityMetrics:
    """セキュリティKPIの収集と分析"""

    # 脆弱性管理メトリクス
    open_vulnerabilities: Dict[str, int] = field(default_factory=dict)
    # パッチ管理メトリクス
    patch_compliance_rate: float = 0.0
    # インシデントメトリクス
    incidents: List[dict] = field(default_factory=list)
    # 教育メトリクス
    training_completion_rate: float = 0.0

    def __post_init__(self):
        self.open_vulnerabilities = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
        }

    def add_incident(self, severity: str, detected_at: datetime,
                     resolved_at: datetime, category: str) -> None:
        """インシデントを記録"""
        self.incidents.append({
            "severity": severity,
            "detected_at": detected_at,
            "resolved_at": resolved_at,
            "category": category,
            "mttr_hours": (resolved_at - detected_at).total_seconds() / 3600,
        })

    @property
    def mean_time_to_respond(self) -> float:
        """平均対応時間（MTTR）を計算"""
        if not self.incidents:
            return 0.0
        total_hours = sum(i["mttr_hours"] for i in self.incidents)
        return round(total_hours / len(self.incidents), 2)

    @property
    def vulnerability_density(self) -> int:
        """脆弱性の総数"""
        return sum(self.open_vulnerabilities.values())

    def generate_report(self) -> str:
        """セキュリティメトリクスレポートを生成"""
        lines = [
            "=== セキュリティメトリクスレポート ===",
            f"日時: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "",
            "--- 脆弱性管理 ---",
            f"  未解決脆弱性: {self.vulnerability_density}件",
        ]
        for severity, count in self.open_vulnerabilities.items():
            lines.append(f"    {severity}: {count}件")
        lines.extend([
            "",
            "--- パッチ管理 ---",
            f"  パッチ適用率: {self.patch_compliance_rate:.1f}%",
            "",
            "--- インシデント対応 ---",
            f"  インシデント数: {len(self.incidents)}件",
            f"  平均対応時間(MTTR): {self.mean_time_to_respond}時間",
            "",
            "--- セキュリティ教育 ---",
            f"  研修完了率: {self.training_completion_rate:.1f}%",
        ])
        return "\n".join(lines)

# 使用例
metrics = SecurityMetrics()
metrics.open_vulnerabilities = {
    "critical": 2, "high": 8, "medium": 24, "low": 45
}
metrics.patch_compliance_rate = 94.5
metrics.training_completion_rate = 87.3

now = datetime.now()
metrics.add_incident(
    "high", now - timedelta(hours=12), now - timedelta(hours=4), "マルウェア"
)
metrics.add_incident(
    "medium", now - timedelta(hours=6), now - timedelta(hours=2), "不正アクセス"
)

print(metrics.generate_report())
```

---

## Anti-patterns

### Anti-pattern 1: Bolt-on Security

Attempting to add security after development is complete. The correct approach is "Security by Design" — building security in from the design stage.

```python
# NG: 後からセキュリティを追加
class UserServiceBad:
    def create_user(self, username: str, password: str) -> None:
        # パスワードを平文で保存してしまう
        self.db.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, password)
        )

# OK: 最初からセキュリティを組み込む
import bcrypt

class UserServiceGood:
    def create_user(self, username: str, password: str) -> None:
        # Step 1: パスワードポリシーの検証
        self._validate_password_policy(password)
        # Step 2: bcryptでハッシュ化（ソルト自動生成）
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
        # Step 3: パラメータ化クエリで安全に保存
        self.db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hashed.decode())
        )
        # Step 4: 監査ログの記録
        self.audit_log.record("CREATE_USER", username)

    def _validate_password_policy(self, password: str) -> None:
        """パスワードポリシーの検証"""
        if len(password) < 12:
            raise ValueError("パスワードは12文字以上必要です")
        if not any(c.isupper() for c in password):
            raise ValueError("大文字を含める必要があります")
        if not any(c.isdigit() for c in password):
            raise ValueError("数字を含める必要があります")
        if not any(c in "!@#$%^&*()-_+=[]{}|;:,.<>?" for c in password):
            raise ValueError("特殊文字を含める必要があります")
```

### Anti-pattern 2: Single Point of Security

Relying only on a firewall, only on encryption, or only on a WAF. If a single defense is breached, everything is lost.

```python
# NG: ファイアウォールだけに依存
class InsecureApp:
    """FWが守ってくれるから大丈夫、という危険な思考"""
    def handle_request(self, user_input: str) -> str:
        # 入力バリデーションなし
        # SQLパラメータ化なし
        # 認証チェックなし
        query = f"SELECT * FROM data WHERE name = '{user_input}'"
        return self.db.execute(query)

# OK: 多層防御の実装
class SecureApp:
    """複数の防御層を実装"""
    def handle_request(self, user_input: str, auth_token: str) -> str:
        # Layer 1: 認証チェック
        user = self.auth.verify_token(auth_token)
        if not user:
            raise AuthenticationError("認証が必要です")

        # Layer 2: 認可チェック
        if not self.acl.check_permission(user, "read", "data"):
            raise AuthorizationError("権限がありません")

        # Layer 3: 入力バリデーション
        if not self.validator.is_safe(user_input):
            raise ValidationError("不正な入力です")

        # Layer 4: パラメータ化クエリ
        result = self.db.execute(
            "SELECT * FROM data WHERE name = ?", (user_input,)
        )

        # Layer 5: 出力フィルタリング
        return self.sanitize_output(result)
```

### Anti-pattern 3: Security Through Obscurity

Relying solely on secrecy — custom encryption algorithms, hard-to-guess URLs, or keeping source code closed — as the primary security mechanism.

```python
# NG: 秘密のURLだけで保護
@app.route("/admin-secret-panel-xyz123")
def admin_panel_insecure():
    # URLが秘密だから大丈夫...は間違い
    return render_template("admin.html")

# OK: 適切な認証・認可 + 秘密のURL（補助的対策）
@app.route("/admin")
@require_authentication
@require_role("admin")
@require_mfa
def admin_panel_secure():
    return render_template("admin.html")
```

---

## Practice Exercises

### Exercise 1 (Basic): CIA Triad Analysis

For each of the following security incidents, classify which element(s) of the CIA Triad are threatened and propose appropriate countermeasures.

1. Ransomware encrypted the file server, making business data inaccessible
2. An employee copied a customer list to a personal USB drive and took it outside
3. An attacker tampered with a website's price list, making products purchasable for 100 yen
4. A DDoS attack took down an e-commerce site for 3 hours
5. A developer committed an API key to a public GitHub repository

<details>
<summary>Model Answer</summary>

1. **Ransomware file encryption**
   - CIA threatened: **Availability** (data is inaccessible) + **Confidentiality** (data may be exfiltrated)
   - Countermeasures:
     - Regular offline backups (3-2-1 rule)
     - Deploy EDR/EPP
     - Network segmentation
     - User education (phishing countermeasures)
     - Establish incident response procedures

2. **Customer list exfiltration**
   - CIA threatened: **Confidentiality** (unauthorized parties accessed data)
   - Countermeasures:
     - Deploy DLP (Data Loss Prevention)
     - Disable/restrict USB ports
     - File access audit logs
     - Establish data classification policy
     - Immediately revoke access rights upon employee departure

3. **Price list tampering**
   - CIA threatened: **Integrity** (data was modified without authorization)
   - Countermeasures:
     - Input validation for web applications
     - Deploy WAF
     - Database change audit logs
     - Double-check for critical data changes (four-eyes principle)
     - Version control and rollback capability

4. **DDoS attack causing downtime**
   - CIA threatened: **Availability** (service is unavailable)
   - Countermeasures:
     - Use CDN (CloudFlare, AWS Shield, etc.)
     - Configure rate limiting
     - Configure auto-scaling
     - Adopt DDoS mitigation services
     - Redundant configuration (multi-region)

5. **API key exposure**
   - CIA threatened: **Confidentiality** (secret information was made public)
   - Countermeasures:
     - Detect secrets with pre-commit hooks (git-secrets, truffleHog)
     - Use environment variables or secret management services (AWS Secrets Manager, etc.)
     - Immediately rotate the API key
     - Enable GitHub secret scanning
     - Proper .gitignore configuration
</details>

### Exercise 2 (Applied): Implementing a Risk Assessment Tool

Implement a risk assessment tool that meets the following requirements:

1. Register risk items (name, threat level, vulnerability level, impact — each 1–5)
2. Automatically calculate risk scores
3. Determine risk level (Critical/High/Medium/Low)
4. Sort by priority and output a report
5. Manage mitigation status (Not started / In progress / Completed)

<details>
<summary>Model Answer</summary>

```python
from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum
from datetime import datetime

class MitigationStatus(Enum):
    NOT_STARTED = "未対策"
    IN_PROGRESS = "対策中"
    COMPLETED = "対策済み"

@dataclass
class RiskEntry:
    """リスク評価エントリ"""
    name: str
    description: str
    threat_level: int         # 1-5
    vulnerability_level: int  # 1-5
    impact_level: int         # 1-5
    owner: str = ""
    mitigation_status: MitigationStatus = MitigationStatus.NOT_STARTED
    mitigation_plan: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        for name_field, value in [
            ("threat_level", self.threat_level),
            ("vulnerability_level", self.vulnerability_level),
            ("impact_level", self.impact_level),
        ]:
            if not 1 <= value <= 5:
                raise ValueError(f"{name_field}は1-5の範囲で指定: {value}")

    @property
    def risk_score(self) -> float:
        """リスクスコア（0-100に正規化）"""
        raw = self.threat_level * self.vulnerability_level * self.impact_level
        return round((raw / 125) * 100, 1)

    @property
    def risk_level(self) -> str:
        score = self.risk_score
        if score >= 60:
            return "Critical"
        elif score >= 40:
            return "High"
        elif score >= 20:
            return "Medium"
        return "Low"

class RiskAssessmentTool:
    """リスク評価ツール"""

    def __init__(self, project_name: str):
        self.project_name = project_name
        self.risks: List[RiskEntry] = []

    def add_risk(self, risk: RiskEntry) -> None:
        """リスクを登録"""
        self.risks.append(risk)

    def update_status(self, name: str, status: MitigationStatus,
                      plan: str = "") -> bool:
        """対策ステータスを更新"""
        for risk in self.risks:
            if risk.name == name:
                risk.mitigation_status = status
                if plan:
                    risk.mitigation_plan = plan
                return True
        return False

    def get_sorted_risks(self) -> List[RiskEntry]:
        """リスクスコア順にソート"""
        return sorted(self.risks, key=lambda r: r.risk_score, reverse=True)

    def generate_report(self) -> str:
        """リスク評価レポートを生成"""
        lines = [
            f"=== リスク評価レポート: {self.project_name} ===",
            f"生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"登録リスク数: {len(self.risks)}",
            "",
            "--- リスク一覧（優先度順）---",
        ]

        for i, risk in enumerate(self.get_sorted_risks(), 1):
            lines.extend([
                f"\n{i}. {risk.name} [{risk.risk_level}]",
                f"   スコア: {risk.risk_score}/100",
                f"   脅威: {risk.threat_level}/5, "
                f"脆弱性: {risk.vulnerability_level}/5, "
                f"影響: {risk.impact_level}/5",
                f"   ステータス: {risk.mitigation_status.value}",
                f"   対策計画: {risk.mitigation_plan or '未設定'}",
            ])

        # サマリー
        by_level = {}
        for risk in self.risks:
            by_level[risk.risk_level] = by_level.get(risk.risk_level, 0) + 1

        lines.extend([
            "\n--- サマリー ---",
            f"  Critical: {by_level.get('Critical', 0)}件",
            f"  High: {by_level.get('High', 0)}件",
            f"  Medium: {by_level.get('Medium', 0)}件",
            f"  Low: {by_level.get('Low', 0)}件",
        ])

        return "\n".join(lines)

# 使用例
tool = RiskAssessmentTool("ECサイトv2.0")

tool.add_risk(RiskEntry(
    name="SQLインジェクション",
    description="検索機能の入力バリデーション不備",
    threat_level=4, vulnerability_level=5, impact_level=5,
    owner="開発チーム",
))
tool.add_risk(RiskEntry(
    name="DDoS攻撃",
    description="CDN未導入によるサービス停止リスク",
    threat_level=3, vulnerability_level=3, impact_level=4,
    owner="インフラチーム",
))
tool.add_risk(RiskEntry(
    name="弱いパスワードポリシー",
    description="6文字以上のみの要件",
    threat_level=4, vulnerability_level=4, impact_level=3,
    owner="セキュリティチーム",
))

tool.update_status("SQLインジェクション", MitigationStatus.IN_PROGRESS,
                   "ORMへの移行とパラメータ化クエリの強制")

print(tool.generate_report())
```
</details>

### Exercise 3 (Advanced): Security Framework Application Plan

Suppose your organization is a cloud-based SaaS startup with 50 employees. A customer has asked you to submit a "SOC 2 Type II audit report." Draft the following:

1. Analyze the gap between your current state and SOC 2's five Trust Services Criteria (TSC)
2. Propose at least three specific countermeasures for each TSC
3. Create an implementation priority order and timeline (6-month plan)

<details>
<summary>Model Answer</summary>

**1. Trust Services Criteria and Current State Gap Analysis**

| TSC | Standard | Assumed Current State | Gap |
|-----|----------|-----------------------|-----|
| Security | Protection from unauthorized access | Basic FW, password authentication in place | MFA not deployed, no IDS, no vulnerability management |
| Availability | Stable service operation | Single region, manual recovery | No DR plan, SLA undefined, insufficient redundancy |
| Processing Integrity | Accuracy of data processing | Basic validation in place | Insufficient audit trail, no change management process |
| Confidentiality | Protection of confidential data | HTTPS communication | No data classification, no encryption at rest, no DLP |
| Privacy | Appropriate handling of personal information | Privacy policy in place | Insufficient data mapping, inadequate consent management |

**2. Countermeasures for Each TSC (3+ each)**

Security:
- Deploy MFA company-wide (Google Workspace + Okta)
- Introduce vulnerability scanners (Snyk + Trivy)
- Implement security awareness training program (quarterly)
- Deploy WAF (AWS WAF)

Availability:
- Migrate to multi-AZ configuration
- Establish and test DR plan
- Define SLA (99.9% target) and create status page
- Configure auto-scaling

Processing Integrity:
- Automated testing in CI/CD pipeline
- Database change audit logs
- Introduce change management process (RFC)

Confidentiality:
- Establish and enforce data classification policy
- Encryption at rest (AWS KMS)
- Deploy DLP (Google Workspace DLP)

Privacy:
- Create data mapping and RoPA
- Conduct Privacy Impact Assessment (PIA)
- Deploy consent management platform

**3. 6-Month Timeline**

```
Month 1-2: Foundation
  - Establish security policy
  - Establish data classification policy
  - Deploy MFA (top priority)
  - Introduce vulnerability scanner

Month 3-4: Technical controls
  - Implement encryption at rest
  - Deploy WAF
  - Migrate to multi-AZ
  - Set up audit logs

Month 5-6: Process & audit preparation
  - Introduce change management process
  - Conduct security training program
  - Establish and test DR plan
  - Pre-assessment for SOC 2 Type I (Readiness Assessment)
```

After completing this 6-month plan, undergo SOC 2 Type I audit, then accumulate an additional 6–12 months of operational history before proceeding to Type II audit — this is the standard approach.
</details>

---

## FAQ

### Q1: Which element of the CIA Triad is most important?

Priority varies by industry and system. Finance systems tend to prioritize integrity (accuracy of transaction data), healthcare systems prioritize availability (system access in emergencies), and systems handling personal data prioritize confidentiality. What matters is striking a balance appropriate to your organization's context — not overweighting any single element.

### Q2: Which security framework should I choose?

It depends on the organization's size, industry, and regulatory requirements. Here is a general decision flow:
- **Start with NIST CSF** for a comprehensive overview (free, flexible)
- **For international transactions**: Consider pursuing ISO 27001 certification
- **For credit card processing**: PCI DSS compliance is mandatory
- **For SaaS providers**: SOC 2 certification is frequently required by customers
- **For IT operations teams**: Refer to CIS Controls for a concrete list of actions

### Q3: How often should risk assessments be conducted?

At a minimum, a periodic review should be conducted at least once a year, with additional assessments at the following times:
- Major system changes
- Before launching new services or features
- Upon discovery of new threats or vulnerabilities
- After a security incident
- During mergers or acquisitions
- When regulations change

### Q4: How do you calculate the ROI of security controls?

Quantitatively, compare the reduction in ALE (Annual Loss Expectancy) with the cost of controls.

```
ROI = (ALE before controls - ALE after controls - Annual control cost) / Annual control cost × 100%

ALE = SLE (Single Loss Expectancy) × ARO (Annual Rate of Occurrence)

Example: SQL injection mitigation
  SLE: $500,000 (damage from a data breach)
  ARO: 0.3 (30% probability of occurrence per year)
  ALE before controls: $150,000
  ALE after controls: $15,000 (ARO reduced to 0.03)
  Annual control cost: $30,000
  ROI = (150,000 - 15,000 - 30,000) / 30,000 × 100% = 350%
```

### Q5: Do small organizations need security frameworks?

Regardless of size, a systematic approach is necessary. However, small organizations can simplify as follows:
- Start with CIS Controls Implementation Group 1 (IG1: 56 basic safeguards)
- Use the NIST CSF Core as a reference for minimum asset management and risk assessment
- There is no need to do everything perfectly — prioritize based on risk and implement incrementally

---

## Summary

| Topic | Key Points |
|-------|-----------|
| CIA Triad | Balance of confidentiality, integrity, and availability forms the foundation of information security; priorities differ by industry |
| Extended attributes | Comprehensive security requires authenticity, accountability, non-repudiation, and reliability in addition to CIA |
| Threat classification | Use frameworks like STRIDE to systematically identify and classify threats |
| Risk assessment | Quantify risk as Threat × Vulnerability × Impact and determine countermeasure priorities |
| Frameworks | Select from NIST CSF, ISO 27001, CIS Controls, etc., based on organizational requirements |
| Defense in depth | Layer multiple independent defenses to eliminate single points of failure |
| SDL | Integrate security activities across every phase of the development lifecycle |
| Metrics | Continuously measure security effectiveness using indicators like MTTR and vulnerability density |

---

## Recommended Next Reading

- [01-threat-modeling.md](./01-threat-modeling.md) -- Detailed threat modeling using STRIDE, DREAD, and attack trees
- [02-security-principles.md](./02-security-principles.md) -- Design principles such as least privilege, zero trust, and secure by default
- [../01-web-security/00-owasp-top10.md](../01-web-security/00-owasp-top10.md) -- Specific web security vulnerabilities and countermeasures
- [../../../authentication-and-authorization/docs/00-fundamentals/](../../../authentication-and-authorization/docs/00-fundamentals/) -- Authentication and authorization fundamentals (directly related to the confidentiality aspect of CIA)
- [../02-cryptography/](../02-cryptography/) -- Cryptographic technology details (implementation means for confidentiality and integrity in CIA)

---

## References

1. NIST Cybersecurity Framework 2.0 -- https://www.nist.gov/cyberframework
2. ISO/IEC 27001:2022 Information security management systems -- https://www.iso.org/standard/27001
3. CIS Critical Security Controls v8 -- https://www.cisecurity.org/controls
4. OWASP Foundation -- https://owasp.org/
5. IBM Cost of a Data Breach Report 2023 -- https://www.ibm.com/reports/data-breach
6. NIST SP 800-30 Guide for Conducting Risk Assessments -- https://csrc.nist.gov/publications/detail/sp/800-30/rev-1/final
7. Saltzer, J.H. & Schroeder, M.D., "The Protection of Information in Computer Systems" -- Proceedings of the IEEE, 1975
