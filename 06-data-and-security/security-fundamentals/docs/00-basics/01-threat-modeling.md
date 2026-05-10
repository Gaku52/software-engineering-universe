# Threat Modeling

> A practical guide to systematically identifying threats lurking in systems using STRIDE, DREAD, PASTA, attack trees, data flow diagrams, and kill chain analysis. Learn the full picture of threat modeling — embedding security at the design stage to reduce remediation costs by orders of magnitude.

## What You Will Learn

1. Understand how to systematically classify and identify threats using the **STRIDE** model
2. Master quantitative risk assessment with **DREAD** scoring and **CVSS**
3. Learn practical threat analysis procedures using **attack trees and Data Flow Diagrams (DFD)**
4. Plan **organizational adoption of threat modeling** and continuous improvement processes

## Prerequisites

- [00-security-overview.md](./00-security-overview.md) -- CIA triad fundamentals and risk assessment basics
- Software architecture basics (client-server architecture, API design overview)
- [../../../authentication-and-authorization/docs/00-fundamentals/](../../../authentication-and-authorization/docs/00-fundamentals/) -- Core concepts in authentication and authorization

---

## 1. What Is Threat Modeling?

Threat modeling is the process of systematically identifying and evaluating potential attacks against a system at the design stage, then planning appropriate countermeasures.

### WHY: Why Is Threat Modeling Necessary?

```
The Cost of Change (NIST/IBM research):

  Fix at design stage       :  $100       (1x)
  Fix at implementation stage:  $1,000     (10x)
  Fix at testing stage      :  $10,000    (100x)
  Fix in production         :  $100,000+  (1000x)

  => Threat modeling at the design stage is the most cost-effective security activity
```

### 1.1 The Basic Threat Modeling Process

```
The four phases of threat modeling:

+----------+    +----------+    +----------+    +----------+
| 1. Decom-| -> | 2. Threat| -> | 3. Risk  | -> | 4. Decide|
| position |    | Identifi-|    | Assess-  |    | on Coun- |
| (DFD)    |    | cation   |    | ment     |    | termeas. |
|          |    | (STRIDE) |    | (DREAD)  |    | (Mitig.) |
+----------+    +----------+    +----------+    +----------+
      |                                               |
      +-----------------------------------------------+
                     Iteratively improve

Phase 1: What are we building?
  → Create DFD, identify assets, define trust boundaries

Phase 2: What can go wrong?
  → STRIDE, PASTA, attack tree analysis

Phase 3: How bad is it?
  → DREAD, CVSS, risk matrix

Phase 4: What are we going to do about it?
  → Mitigate, Transfer, Accept, Avoid
```

### 1.2 The Four Questions of Threat Modeling (Adam Shostack's Method)

| Question | Purpose | Key Tools/Methods |
|----------|---------|-------------------|
| What are we building? | Understand the system and identify assets | DFD, architecture diagrams |
| What can go wrong? | Identify threats | STRIDE, PASTA, kill chain |
| What are we going to do about it? | Decide on countermeasures | Mitigate, Transfer, Accept, Avoid |
| Did we do a good enough job? | Verify | Testing, review, penetration testing |

---

## 2. The STRIDE Model

A threat classification framework developed by Microsoft as part of the SDL (Security Development Lifecycle). Each category maps one-to-one to an information security property.

### 2.1 STRIDE's Six Categories

```
Mapping STRIDE to security properties:

  Threat Category        Compromised Property    Key Countermeasures
  ─────────────────────────────────────────────────────────────────
  S: Spoofing        →  Authentication       →  MFA, PKI
  T: Tampering       →  Integrity            →  Hashing, signatures
  R: Repudiation     →  Non-repudiation      →  Audit logs, signatures
  I: Info Disclosure →  Confidentiality      →  Encryption, ACL
  D: DoS             →  Availability         →  CDN, rate limiting
  E: Elevation       →  Authorization        →  Least privilege, RBAC
```

| Category | Full Name | Compromised Property | Attack Examples | DFD Element Mapping |
|----------|-----------|---------------------|-----------------|---------------------|
| S: Spoofing | Spoofing | Authenticity | Fake login pages, session hijacking, ARP spoofing | External entities, processes |
| T: Tampering | Tampering | Integrity | SQL injection, parameter tampering, MITM | Data flows, data stores |
| R: Repudiation | Repudiation | Non-repudiation | Log deletion, operations without audit trail, timestamp forgery | Processes |
| I: Information Disclosure | Information Disclosure | Confidentiality | Directory listing, error messages, side channels | Data flows, data stores |
| D: Denial of Service | Denial of Service | Availability | DDoS, resource exhaustion, application-layer DoS | Processes, data stores |
| E: Elevation of Privilege | Elevation of Privilege | Authorization | Horizontal/vertical privilege escalation, buffer overflow, IDOR | Processes |

### 2.2 STRIDE-per-Element Analysis

A method of examining applicable STRIDE category threats for each element in the DFD.

| DFD Element | S | T | R | I | D | E |
|-------------|---|---|---|---|---|---|
| External Entity | o | | | | | |
| Process | o | o | o | o | o | o |
| Data Flow | | o | | o | o | |
| Data Store | | o | o | o | o | |

```python
# Code Example 1: STRIDE-per-Element Analysis Tool
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Set

class StrideCategory(Enum):
    SPOOFING = "S: なりすまし"
    TAMPERING = "T: 改ざん"
    REPUDIATION = "R: 否認"
    INFO_DISCLOSURE = "I: 情報漏洩"
    DENIAL_OF_SERVICE = "D: サービス妨害"
    ELEVATION_OF_PRIVILEGE = "E: 権限昇格"

class DFDElementType(Enum):
    EXTERNAL_ENTITY = "外部エンティティ"
    PROCESS = "プロセス"
    DATA_FLOW = "データフロー"
    DATA_STORE = "データストア"

# DFD要素ごとに該当するSTRIDEカテゴリを定義
STRIDE_PER_ELEMENT: Dict[DFDElementType, Set[StrideCategory]] = {
    DFDElementType.EXTERNAL_ENTITY: {
        StrideCategory.SPOOFING,
    },
    DFDElementType.PROCESS: {
        StrideCategory.SPOOFING,
        StrideCategory.TAMPERING,
        StrideCategory.REPUDIATION,
        StrideCategory.INFO_DISCLOSURE,
        StrideCategory.DENIAL_OF_SERVICE,
        StrideCategory.ELEVATION_OF_PRIVILEGE,
    },
    DFDElementType.DATA_FLOW: {
        StrideCategory.TAMPERING,
        StrideCategory.INFO_DISCLOSURE,
        StrideCategory.DENIAL_OF_SERVICE,
    },
    DFDElementType.DATA_STORE: {
        StrideCategory.TAMPERING,
        StrideCategory.REPUDIATION,
        StrideCategory.INFO_DISCLOSURE,
        StrideCategory.DENIAL_OF_SERVICE,
    },
}

@dataclass
class StrideThreat:
    """特定された脅威"""
    id: str
    category: StrideCategory
    element_name: str
    element_type: DFDElementType
    description: str
    attack_vector: str
    mitigations: List[str] = field(default_factory=list)
    priority: str = "未評価"  # Critical/High/Medium/Low/未評価

@dataclass
class StrideAnalyzer:
    """STRIDE-per-Element分析エンジン"""

    system_name: str
    threats: List[StrideThreat] = field(default_factory=list)
    _threat_counter: int = 0

    def analyze_element(self, name: str, element_type: DFDElementType,
                        description: str = "") -> List[str]:
        """DFD要素に対してSTRIDE分析を実行し、検討すべき質問を返す"""
        applicable = STRIDE_PER_ELEMENT.get(element_type, set())
        questions = []

        for category in applicable:
            question = self._generate_question(category, name, element_type)
            questions.append(question)

        return questions

    def _generate_question(self, category: StrideCategory,
                           element_name: str,
                           element_type: DFDElementType) -> str:
        """脅威カテゴリに基づいた分析質問を生成"""
        templates = {
            StrideCategory.SPOOFING:
                f"[{element_name}] に対して、なりすましは可能か？"
                f"正当な{element_type.value}であることをどう検証するか？",
            StrideCategory.TAMPERING:
                f"[{element_name}] のデータを攻撃者が改ざんできるか？"
                f"改ざんをどう検出するか？",
            StrideCategory.REPUDIATION:
                f"[{element_name}] の操作を後から否認できるか？"
                f"証跡は十分に記録されているか？",
            StrideCategory.INFO_DISCLOSURE:
                f"[{element_name}] から機密情報が漏洩する経路はあるか？"
                f"データは適切に暗号化されているか？",
            StrideCategory.DENIAL_OF_SERVICE:
                f"[{element_name}] のサービスを妨害する方法はあるか？"
                f"リソース制限は設定されているか？",
            StrideCategory.ELEVATION_OF_PRIVILEGE:
                f"[{element_name}] で権限昇格は可能か？"
                f"最小権限の原則は適用されているか？",
        }
        return templates.get(category, "")

    def add_threat(self, category: StrideCategory, element_name: str,
                   element_type: DFDElementType, description: str,
                   attack_vector: str,
                   mitigations: Optional[List[str]] = None) -> str:
        """脅威を登録"""
        self._threat_counter += 1
        threat_id = f"T-{self._threat_counter:03d}"
        threat = StrideThreat(
            id=threat_id,
            category=category,
            element_name=element_name,
            element_type=element_type,
            description=description,
            attack_vector=attack_vector,
            mitigations=mitigations or [],
        )
        self.threats.append(threat)
        return threat_id

    def generate_report(self) -> str:
        """分析レポートを生成"""
        lines = [
            f"# STRIDE分析レポート: {self.system_name}",
            f"## 脅威総数: {len(self.threats)}件\n",
        ]
        for cat in StrideCategory:
            cat_threats = [t for t in self.threats if t.category == cat]
            lines.append(f"### {cat.value} ({len(cat_threats)}件)")
            if not cat_threats:
                lines.append("  脅威なし\n")
                continue
            for t in cat_threats:
                lines.append(f"- **[{t.id}]** [{t.element_name}] {t.description}")
                lines.append(f"  - 攻撃ベクトル: {t.attack_vector}")
                lines.append(f"  - 優先度: {t.priority}")
                for m in t.mitigations:
                    lines.append(f"  - 緩和策: {m}")
            lines.append("")
        return "\n".join(lines)

# Usage example
analyzer = StrideAnalyzer("ECサイト決済システム")

# DFD要素に対するSTRIDE分析質問の生成
questions = analyzer.analyze_element(
    "決済API", DFDElementType.PROCESS, "クレジットカード決済処理"
)
for q in questions:
    print(f"  検討: {q}")

# 脅威の登録
analyzer.add_threat(
    StrideCategory.SPOOFING, "ログインAPI", DFDElementType.PROCESS,
    "ブルートフォースによるアカウント乗っ取り",
    "POST /api/login に大量の認証試行",
    ["レートリミット(5回/分)", "アカウントロックアウト(10分)", "MFA導入"],
)
analyzer.add_threat(
    StrideCategory.TAMPERING, "注文データフロー", DFDElementType.DATA_FLOW,
    "価格パラメータの改ざんによる不正な低額購入",
    "MITM/プロキシによるリクエストボディの改ざん",
    ["サーバーサイドでの価格再計算", "リクエスト署名検証", "TLS必須化"],
)
analyzer.add_threat(
    StrideCategory.INFO_DISCLOSURE, "ユーザーDB", DFDElementType.DATA_STORE,
    "SQLインジェクションによる全顧客データ漏洩",
    "検索フォームに ' OR 1=1 -- を入力",
    ["パラメータ化クエリ", "WAF導入", "DB最小権限"],
)

print(analyzer.generate_report())
```

---

## 3. DREAD Scoring

DREAD is a quantitative risk assessment model developed by Microsoft. It is used to prioritize identified threats.

### 3.1 DREAD's Five Assessment Axes

```
DREAD scoring structure:

  D ─ Damage (magnitude of harm)
  │   1: Minor impact  →  10: Complete system destruction
  │
  R ─ Reproducibility
  │   1: Only under special conditions  →  10: Anyone can reproduce 100% of the time
  │
  E ─ Exploitability (ease of attack)
  │   1: Requires advanced expertise  →  10: Immediately attackable with automated tools
  │
  A ─ Affected Users (scope of impact)
  │   1: Single user  →  10: All users
  │
  D ─ Discoverability (ease of discovery)
      1: Extremely difficult to find  →  10: Easily discoverable from public information

  Total score = (D + R + E + A + D) / 5
  → 8-10: Critical  → 6-7.9: High  → 4-5.9: Medium  → 1-3.9: Low
```

| Axis | Name | Description | Low (1-3) | Medium (4-6) | High (7-10) |
|------|------|-------------|-----------|--------------|-------------|
| D | Damage | Magnitude of harm | Minor log corruption | Partial data leak | Full data leak / system destruction |
| R | Reproducibility | Repeatability | Specific conditions only | Sometimes reproducible | Always 100% reproducible |
| E | Exploitability | Ease of attack | Requires advanced skill | Possible with tools | Automated tools usable by beginners |
| A | Affected Users | Scope of impact | Individual only | Some users | All users including admins |
| D | Discoverability | Discoverability | Requires insider knowledge | Can be guessed | Public info / automated scanning |

```python
# Code Example 2: DREAD + CVSS hybrid scoring
from dataclasses import dataclass
from typing import Optional

@dataclass
class DreadScore:
    """DREADリスクスコアの計算"""
    damage: int           # 1-10: 被害の大きさ
    reproducibility: int  # 1-10: 再現性
    exploitability: int   # 1-10: 攻撃の容易さ
    affected_users: int   # 1-10: 影響範囲
    discoverability: int  # 1-10: 発見可能性

    def __post_init__(self):
        fields = {
            "damage": self.damage,
            "reproducibility": self.reproducibility,
            "exploitability": self.exploitability,
            "affected_users": self.affected_users,
            "discoverability": self.discoverability,
        }
        for name, value in fields.items():
            if not 1 <= value <= 10:
                raise ValueError(f"{name}は1-10の範囲: {value}")

    @property
    def total(self) -> float:
        """DREADスコア（平均値）"""
        return (self.damage + self.reproducibility +
                self.exploitability + self.affected_users +
                self.discoverability) / 5.0

    @property
    def risk_level(self) -> str:
        score = self.total
        if score >= 8:
            return "Critical"
        elif score >= 6:
            return "High"
        elif score >= 4:
            return "Medium"
        return "Low"

    @property
    def risk_color(self) -> str:
        """リスクレベルに対応する色コード"""
        colors = {
            "Critical": "RED",
            "High": "ORANGE",
            "Medium": "YELLOW",
            "Low": "GREEN",
        }
        return colors[self.risk_level]

    def breakdown(self) -> str:
        """スコアの内訳を表示"""
        items = [
            ("Damage", self.damage),
            ("Reproducibility", self.reproducibility),
            ("Exploitability", self.exploitability),
            ("Affected Users", self.affected_users),
            ("Discoverability", self.discoverability),
        ]
        lines = []
        for name, value in items:
            bar = "█" * value + "░" * (10 - value)
            lines.append(f"  {name:<20s} [{bar}] {value}/10")
        lines.append(f"  {'Total':<20s}  => {self.total:.1f}/10 ({self.risk_level})")
        return "\n".join(lines)

# Comparing DREAD scores for representative threats
threats = {
    "SQLインジェクション": DreadScore(9, 10, 7, 10, 8),
    "XSS (Stored)": DreadScore(7, 9, 6, 8, 7),
    "CSRF": DreadScore(6, 8, 5, 7, 6),
    "ブルートフォース": DreadScore(5, 10, 8, 3, 9),
    "DDoS": DreadScore(4, 10, 9, 10, 10),
}

print("=== 脅威 DREAD スコア比較 ===\n")
for name, score in sorted(
    threats.items(), key=lambda x: x[1].total, reverse=True
):
    print(f"--- {name} ---")
    print(score.breakdown())
    print()
```

### 3.2 DREAD vs CVSS Comparison

| Property | DREAD | CVSS v3.1 |
|----------|-------|-----------|
| Developer | Microsoft | FIRST |
| Score Range | 1-10 | 0.0-10.0 |
| Assessment Axes | 5 axes (D, R, E, A, D) | Base / Temporal / Environmental |
| Subjectivity | Somewhat high | Low (standardized) |
| Learning Cost | Low | Medium to High |
| Industry Standard | Informal | Official (used with CVE numbering) |
| Use Case | Internal threat modeling | Vulnerability management, patch prioritization |

---

## 4. Attack Trees

A method of decomposing attack goals into a tree structure with the attacker's objective as the root and methods of achieving it as branches. Proposed by Bruce Schneier in 1999.

### 4.1 Basic Structure of an Attack Tree

```
Attack tree example: Stealing customer data from an e-commerce site

              [Steal customer data from e-commerce site] (Root)
                    /              \
                   /                \
     [Via Web App]             [Via Insider]
     (OR: success via any)     (OR: success via any)
        /       \                  /       \
       /         \                /         \
  [SQLi]     [XSS→           [Direct DB    [Backup
   ($3K)      Session         Access]       File
              Theft]          ($10K)        Theft]
              ($5K)                        ($2K)
    /  \        |               |            |
[Search] [Login  [Stored        [Hardcoded  [Unencrypted
form]    form]   XSS to         credentials] backup
                 steal Cookie]              on USB]

AND condition: All child nodes are required
OR condition: Any child node suffices
Cost: Attack cost at each leaf node (lower = easier to attack)
```

```python
# Code Example 3: Building an attack tree and analyzing the minimum-cost path
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

@dataclass
class AttackNode:
    """アタックツリーのノード"""
    name: str
    description: str = ""
    cost: int = 0             # 攻撃コスト（低いほど容易）
    difficulty: str = "Medium"  # Low/Medium/High
    probability: float = 0.5  # 成功確率（0.0-1.0）
    children: List['AttackNode'] = field(default_factory=list)
    is_and: bool = False      # True=AND条件, False=OR条件
    mitigations: List[str] = field(default_factory=list)

    def add_child(self, child: 'AttackNode') -> 'AttackNode':
        self.children.append(child)
        return self  # メソッドチェーン

    def min_cost(self) -> int:
        """最小攻撃コストを再帰的に計算"""
        if not self.children:
            return self.cost
        child_costs = [c.min_cost() for c in self.children]
        if self.is_and:
            return sum(child_costs)  # AND: 全子ノードのコスト合計
        return min(child_costs)      # OR: 最安経路

    def max_probability(self) -> float:
        """最大成功確率を再帰的に計算"""
        if not self.children:
            return self.probability
        child_probs = [c.max_probability() for c in self.children]
        if self.is_and:
            # AND: 全子ノードの確率の積
            result = 1.0
            for p in child_probs:
                result *= p
            return result
        return max(child_probs)  # OR: 最高確率の経路

    def find_cheapest_path(self) -> List[str]:
        """最もコストの低い攻撃経路を特定"""
        if not self.children:
            return [self.name]

        if self.is_and:
            # AND: すべての子を含む
            path = [self.name]
            for child in self.children:
                path.extend(child.find_cheapest_path())
            return path

        # OR: 最安の子を選択
        cheapest = min(self.children, key=lambda c: c.min_cost())
        return [self.name] + cheapest.find_cheapest_path()

    def display(self, indent: int = 0) -> None:
        """ツリーを視覚的に表示"""
        prefix = "  " * indent
        cost_str = f"${self.cost}K" if self.cost else ""
        prob_str = f"P={self.probability:.0%}" if not self.children else ""
        connector = "AND" if self.is_and else "OR"

        print(f"{prefix}[{self.name}] {cost_str} {prob_str}")
        if self.mitigations:
            for m in self.mitigations:
                print(f"{prefix}  >> 対策: {m}")
        if self.children:
            print(f"{prefix}  ({connector})")
            for child in self.children:
                child.display(indent + 2)

# Attack tree construction example
root = AttackNode("顧客情報の窃取", "ECサイトの顧客データを不正取得")

# Webアプリ経由
web_attack = AttackNode("Webアプリ経由", "アプリ脆弱性を利用")
sqli = AttackNode("SQLインジェクション", "入力フォーム経由",
                  cost=3, difficulty="Low", probability=0.7,
                  mitigations=["パラメータ化クエリ", "WAF", "入力バリデーション"])
xss = AttackNode("XSS→セッション窃取", "Stored XSSでCookie窃取",
                 cost=5, difficulty="Medium", probability=0.4,
                 mitigations=["CSP", "HttpOnly Cookie", "出力エスケープ"])
web_attack.add_child(sqli)
web_attack.add_child(xss)

# 内部者経由
insider = AttackNode("内部者経由", "組織内部からの攻撃")
db_direct = AttackNode("DB直接アクセス", "認証情報の不正利用",
                       cost=10, difficulty="High", probability=0.2,
                       mitigations=["最小権限", "特権アクセス管理", "監査ログ"])
backup_theft = AttackNode("バックアップ窃取", "暗号化なしバックアップ",
                          cost=2, difficulty="Low", probability=0.3,
                          mitigations=["バックアップ暗号化", "アクセス制限", "DLP"])
insider.add_child(db_direct)
insider.add_child(backup_theft)

root.add_child(web_attack)
root.add_child(insider)

# Analysis results
root.display()
print(f"\n最小攻撃コスト: ${root.min_cost()}K")
print(f"最大成功確率: {root.max_probability():.0%}")
print(f"最安経路: {' → '.join(root.find_cheapest_path())}")
```

---

## 5. Data Flow Diagrams (DFD) and Trust Boundaries

A DFD visualizes the flow of data through a system and explicitly marks trust boundaries. It is the most important tool in threat modeling.

### 5.1 DFD Components

```
The four components of a DFD:

  +---------+       External Entity
  |  User   |       Actor outside the system
  +---------+

  (  Process  )      Process
  (  Server   )      Component that processes data

  ===========        Data Flow
  ==========>        Arrow indicating direction of data movement

  [[  DB   ]]        Data Store
  [[ Storage ]]      Where data is kept

  ────────────       Trust Boundary
  ┃ Boundary ┃       The boundary where security level changes
  ────────────
```

### 5.2 DFD Levels

```
DFD Level 0 (Context Diagram):

+----------+                              +----------+
|          |  --- HTTP Request --->        |          |
|   User   |                              |  Web App |
| (External)|  <--- HTTP Response ---     |          |
+----------+                              +----------+
                                               |
                 Trust Boundary                |
  ===================================          |
                                               v
                                          +----------+
                                          | DB       |
                                          +----------+


DFD Level 1 (Detailed Diagram):

+--------+                   Trust Boundary
| Browser|    ==========================================
|(External)|  |                                        |
+--------+    |  +-------+    +--------+    +------+   |
     |         |  | Web   | -> | API    | -> |  DB  |   |
     +-------->|  | Server|    | Server |    |      |   |
               |  +-------+    +--------+    +------+   |
               |      |             |            |      |
               |      v             v            |      |
               |  +-------+    +--------+        |      |
               |  | CDN/  |    | Cache  |        |      |
               |  | Static|    | (Redis)|        |      |
               |  +-------+    +--------+        |      |
               ==========================================
                                    |
                      Trust Boundary|
                    ================|============
                                    v
                              +---------+
                              | External|
                              |  API    |
                              |(Payment)|
                              +---------+
```

```python
# Code Example 4: DFD analysis and automatic threat detection for flows crossing trust boundaries
from dataclasses import dataclass, field
from typing import List, Set, Dict

@dataclass
class DFDComponent:
    """DFDのコンポーネント"""
    name: str
    component_type: str  # external_entity, process, data_store
    trust_zone: str       # untrusted, dmz, trusted, highly_trusted
    description: str = ""

@dataclass
class DataFlow:
    """データフロー"""
    source: str
    destination: str
    data_type: str
    protocol: str
    encrypted: bool
    authenticated: bool
    data_classification: str = "internal"  # public, internal, confidential, restricted

@dataclass
class TrustBoundary:
    """信頼境界"""
    name: str
    trust_level: str  # untrusted, dmz, trusted, highly_trusted
    components: Set[str] = field(default_factory=set)

class DFDThreatAnalyzer:
    """DFDに基づく自動脅威検出エンジン"""

    TRUST_HIERARCHY = ["untrusted", "dmz", "trusted", "highly_trusted"]

    def __init__(self, system_name: str):
        self.system_name = system_name
        self.components: Dict[str, DFDComponent] = {}
        self.flows: List[DataFlow] = []
        self.boundaries: List[TrustBoundary] = []

    def add_component(self, component: DFDComponent) -> None:
        self.components[component.name] = component

    def add_flow(self, flow: DataFlow) -> None:
        self.flows.append(flow)

    def add_boundary(self, boundary: TrustBoundary) -> None:
        self.boundaries.append(boundary)

    def _get_trust_level(self, component_name: str) -> str:
        """コンポーネントの信頼レベルを取得"""
        comp = self.components.get(component_name)
        return comp.trust_zone if comp else "untrusted"

    def _crosses_boundary(self, flow: DataFlow) -> bool:
        """フローが信頼境界を越えるか判定"""
        src_trust = self._get_trust_level(flow.source)
        dst_trust = self._get_trust_level(flow.destination)
        return src_trust != dst_trust

    def _trust_direction(self, flow: DataFlow) -> str:
        """信頼方向を判定（inbound/outbound/lateral）"""
        src_idx = self.TRUST_HIERARCHY.index(
            self._get_trust_level(flow.source)
        )
        dst_idx = self.TRUST_HIERARCHY.index(
            self._get_trust_level(flow.destination)
        )
        if src_idx < dst_idx:
            return "inbound"   # 低信頼→高信頼（要注意）
        elif src_idx > dst_idx:
            return "outbound"  # 高信頼→低信頼（情報漏洩リスク）
        return "lateral"

    def detect_threats(self) -> List[Dict]:
        """脅威を自動検出"""
        threats = []

        for flow in self.flows:
            flow_threats = []

            # Threat 1: Unencrypted flow crossing a trust boundary
            if self._crosses_boundary(flow) and not flow.encrypted:
                flow_threats.append({
                    "type": "TAMPERING/INFO_DISCLOSURE",
                    "severity": "High",
                    "description": (
                        f"信頼境界を越えるフロー "
                        f"({flow.source} → {flow.destination}) "
                        f"が暗号化されていない"
                    ),
                    "mitigation": "TLS/mTLS の導入",
                })

            # Threat 2: Unauthenticated flow crossing a boundary
            if self._crosses_boundary(flow) and not flow.authenticated:
                direction = self._trust_direction(flow)
                if direction == "inbound":
                    flow_threats.append({
                        "type": "SPOOFING",
                        "severity": "Critical",
                        "description": (
                            f"低信頼ゾーンから高信頼ゾーンへの"
                            f"認証なしフロー "
                            f"({flow.source} → {flow.destination})"
                        ),
                        "mitigation": "認証メカニズムの実装",
                    })

            # Threat 3: Confidential data transferred without encryption
            if flow.data_classification in ("confidential", "restricted"):
                if not flow.encrypted:
                    flow_threats.append({
                        "type": "INFO_DISCLOSURE",
                        "severity": "Critical",
                        "description": (
                            f"機密データ({flow.data_type}) が "
                            f"暗号化なしで転送されている"
                        ),
                        "mitigation": "転送時暗号化(TLS)と保存時暗号化の実装",
                    })

            for t in flow_threats:
                t["flow"] = f"{flow.source} → {flow.destination}"
                t["data_type"] = flow.data_type
                threats.append(t)

        return threats

    def generate_report(self) -> str:
        """脅威分析レポートを生成"""
        threats = self.detect_threats()
        lines = [
            f"# DFD脅威分析レポート: {self.system_name}",
            f"## コンポーネント数: {len(self.components)}",
            f"## データフロー数: {len(self.flows)}",
            f"## 検出された脅威: {len(threats)}件\n",
        ]

        by_severity = {}
        for t in threats:
            by_severity.setdefault(t["severity"], []).append(t)

        for severity in ["Critical", "High", "Medium", "Low"]:
            sev_threats = by_severity.get(severity, [])
            if sev_threats:
                lines.append(f"### {severity} ({len(sev_threats)}件)")
                for t in sev_threats:
                    lines.append(f"- [{t['type']}] {t['description']}")
                    lines.append(f"  フロー: {t['flow']}")
                    lines.append(f"  対策: {t['mitigation']}")
                lines.append("")

        return "\n".join(lines)

# Usage example
analyzer = DFDThreatAnalyzer("ECサイト")

# Component definitions
analyzer.add_component(DFDComponent(
    "ブラウザ", "external_entity", "untrusted", "ユーザーのWebブラウザ"
))
analyzer.add_component(DFDComponent(
    "APIサーバー", "process", "trusted", "バックエンドAPI"
))
analyzer.add_component(DFDComponent(
    "データベース", "data_store", "highly_trusted", "PostgreSQL"
))

# Data flow definitions
analyzer.add_flow(DataFlow(
    "ブラウザ", "APIサーバー", "認証情報",
    "HTTPS", encrypted=True, authenticated=True,
    data_classification="confidential",
))
analyzer.add_flow(DataFlow(
    "APIサーバー", "データベース", "SQLクエリ",
    "TCP", encrypted=False, authenticated=True,
    data_classification="internal",
))

threats = analyzer.detect_threats()
print(analyzer.generate_report())
```

---

## 6. PASTA (Process for Attack Simulation and Threat Analysis)

PASTA is a seven-stage, risk-centric threat modeling methodology that combines business objectives with technical threat analysis.

### 6.1 PASTA's Seven Stages

```
PASTA 7-stage process:

  Stage 1: Define Business Objectives
  +-------------------+
  | Organize business |
  | requirements      |
  | Determine risk    |
  | tolerance         |
  +--------+----------+
           |
  Stage 2: Define Technical Scope
  +--------v----------+
  | Create infra      |
  | diagrams          |
  | Organize tech     |
  | specifications    |
  +--------+----------+
           |
  Stage 3: Application Decomposition
  +--------v----------+
  | Create DFD        |
  | Define trust      |
  | boundaries        |
  +--------+----------+
           |
  Stage 4: Threat Analysis
  +--------v----------+
  | Gather threat     |
  | intelligence      |
  | Reference threat  |
  | library           |
  +--------+----------+
           |
  Stage 5: Vulnerability Analysis
  +--------v----------+
  | CVE/CWE analysis  |
  | Integrate scan    |
  | results           |
  +--------+----------+
           |
  Stage 6: Attack Simulation
  +--------v----------+
  | Create attack     |
  | trees             |
  | Execute attack    |
  | scenarios         |
  +--------+----------+
           |
  Stage 7: Risk Management
  +--------v----------+
  | Evaluate residual |
  | risk              |
  | Prioritize        |
  | countermeasures   |
  +-------------------+
```

### STRIDE vs PASTA Comparison

| Property | STRIDE | PASTA |
|----------|--------|-------|
| Approach | Technology-centric | Risk-centric |
| Number of Stages | No explicit stages | 7 stages |
| Business Perspective | Weak | Strong (Stage 1) |
| Attack Simulation | None | Yes (Stage 6) |
| Learning Cost | Low | Medium to High |
| Scale of Application | Small to Medium | Medium to Large |
| Output | Threat list | Risk management plan |

---

## 7. Cyber Kill Chain Analysis

A phased model of attacks proposed by Lockheed Martin. Used in threat modeling to understand attacker behavior patterns.

```
The seven stages of the Cyber Kill Chain:

  1. Reconnaissance    2. Weaponization    3. Delivery
  +----------+        +----------+        +----------+
  | Info     |        | Create   |        | Deliver  |
  | gathering| ->     | attack   | ->     | malware  |
  | OSINT    |        | tools    |        | Phishing |
  | Scanning |        | payload  |        |          |
  +----------+        +----------+        +----------+
                                               |
  7. Actions on     6. C2           5. Install    4. Exploitation
  Objectives        +----------+    +----------+    +----------+
  +----------+      | Remote   |    | Persist  |    | Exploit  |
  | Data     |      | control  |    | Backdoor | <- | vulner-  |
  | exfil    | <-   | Lateral  | <- | Install  |    | ability  |
  | Destroy  |      | movement |    |          |    | Execute  |
  | Encrypt  |      | Priv esc |    +----------+    +----------+
  +----------+      +----------+

There is an opportunity to detect and stop the attack at each stage (points of applying defense in depth)
```

---

## 8. Practical Threat Modeling Workflow

```python
# Code Example 5: Complete implementation of a threat modeling worksheet
import json
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, field

@dataclass
class ThreatModelWorksheet:
    """脅威モデリングワークシートの生成・管理"""

    project: str
    version: str
    author: str = ""
    created: str = field(default_factory=lambda: datetime.now().isoformat())
    components: List[Dict] = field(default_factory=list)
    threats: List[Dict] = field(default_factory=list)
    mitigations: List[Dict] = field(default_factory=list)
    assumptions: List[str] = field(default_factory=list)
    scope: str = ""

    def add_component(self, name: str, component_type: str,
                      trust_level: str, description: str = "") -> None:
        """DFDコンポーネントを追加"""
        self.components.append({
            "name": name,
            "type": component_type,
            "trust_level": trust_level,
            "description": description,
        })

    def add_threat(self, stride_cat: str, component: str,
                   description: str, attack_scenario: str,
                   dread: Optional[Dict] = None) -> str:
        """脅威を追加"""
        threat_id = f"T-{len(self.threats) + 1:03d}"
        dread_score = 0
        if dread:
            dread_score = sum(dread.values()) / len(dread)
        self.threats.append({
            "id": threat_id,
            "stride_category": stride_cat,
            "component": component,
            "description": description,
            "attack_scenario": attack_scenario,
            "dread_score": round(dread_score, 1) if dread else None,
            "dread_detail": dread,
            "status": "identified",
        })
        return threat_id

    def add_mitigation(self, threat_id: str, strategy: str,
                       description: str, effort: str = "medium",
                       assigned_to: str = "") -> None:
        """対策を追加"""
        self.mitigations.append({
            "threat_id": threat_id,
            "strategy": strategy,
            "description": description,
            "effort": effort,
            "assigned_to": assigned_to,
            "implemented": False,
        })

    def get_summary(self) -> Dict:
        """サマリーを生成"""
        severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        for t in self.threats:
            score = t.get("dread_score", 0) or 0
            if score >= 8:
                severity_counts["Critical"] += 1
            elif score >= 6:
                severity_counts["High"] += 1
            elif score >= 4:
                severity_counts["Medium"] += 1
            else:
                severity_counts["Low"] += 1

        return {
            "project": self.project,
            "version": self.version,
            "total_threats": len(self.threats),
            "severity_breakdown": severity_counts,
            "total_mitigations": len(self.mitigations),
            "mitigated": sum(1 for m in self.mitigations if m["implemented"]),
            "pending": sum(1 for m in self.mitigations if not m["implemented"]),
            "coverage": (
                f"{sum(1 for m in self.mitigations if m['implemented'])}"
                f"/{len(self.mitigations)}"
            ),
        }

    def export_json(self) -> str:
        """JSON形式でエクスポート"""
        return json.dumps({
            "project": self.project,
            "version": self.version,
            "author": self.author,
            "created": self.created,
            "scope": self.scope,
            "assumptions": self.assumptions,
            "components": self.components,
            "threats": self.threats,
            "mitigations": self.mitigations,
            "summary": self.get_summary(),
        }, indent=2, ensure_ascii=False)

# Usage example
ws = ThreatModelWorksheet(
    project="ECサイト決済システム",
    version="v2.0",
    author="セキュリティチーム",
    scope="決済フロー（カート → 注文確定 → 決済処理 → 完了通知）",
)
ws.assumptions = [
    "外部決済ゲートウェイ（Stripe）は信頼できるものとする",
    "TLS 1.3が全通信で使用されている",
    "管理者は信頼できるが、最小権限の原則は適用する",
]

ws.add_component("ブラウザ", "external_entity", "untrusted", "顧客のブラウザ")
ws.add_component("APIサーバー", "process", "trusted", "Node.js Express")
ws.add_component("PostgreSQL", "data_store", "highly_trusted", "注文・顧客DB")
ws.add_component("Stripe API", "external_entity", "semi-trusted", "決済処理")

t1 = ws.add_threat(
    "Tampering", "APIサーバー",
    "注文金額の改ざんによる不正な低額決済",
    "MITM/プロキシで /api/checkout のPOSTボディを改ざん",
    {"D": 9, "R": 10, "E": 6, "A": 8, "D2": 7},
)
ws.add_mitigation(t1, "mitigate",
    "サーバーサイドでの金額再計算（カートIDから商品価格を再取得）",
    effort="low", assigned_to="バックエンドチーム")

t2 = ws.add_threat(
    "Spoofing", "ブラウザ",
    "他ユーザーの注文情報閲覧（IDOR）",
    "GET /api/orders/{id} のidを変更して他者の注文を閲覧",
    {"D": 7, "R": 10, "E": 9, "A": 5, "D2": 8},
)
ws.add_mitigation(t2, "mitigate",
    "オーナーシップチェック: order.user_id == current_user.id",
    effort="low", assigned_to="バックエンドチーム")

summary = ws.get_summary()
print(f"プロジェクト: {summary['project']}")
print(f"脅威数: {summary['total_threats']}")
print(f"深刻度: {summary['severity_breakdown']}")
```

---

## Anti-Patterns

### Anti-Pattern 1: Skipping Threat Modeling

The pattern of skipping threat modeling with the excuse that "we don't have time before the release."

```python
# NG: 脅威モデリングを省略してリリース
class ReleaseProcess:
    def ship(self, feature):
        # 脅威モデリングなし → 本番で脆弱性が見つかる
        # 修正コスト: $100,000+
        deploy(feature)

# OK: 最小限の脅威モデリングを必ず実施
class SecureReleaseProcess:
    def ship(self, feature):
        # 最低限のSTRIDE分析（30分〜1時間）
        threats = self.quick_stride_analysis(feature)
        if any(t.risk_level == "Critical" for t in threats):
            raise SecurityGateError("Critical脅威が未対策です")
        # 対策完了後にリリース
        # 修正コスト: $100（設計段階）
        deploy(feature)
```

### Anti-Pattern 2: One-Time Threat Modeling

The pattern of performing threat modeling only at the initial release and never updating it afterwards.

```python
# NG: 初回のみ実施
threat_model = create_threat_model()  # v1.0でのみ実施
# v2.0で新機能追加 → 脅威モデル未更新 → 新しい脆弱性が放置

# OK: 変更のたびに差分分析
class ContinuousThreatModeling:
    def on_feature_change(self, feature_spec):
        """機能変更時に脅威モデルを差分更新"""
        # 1. 変更されたDFD要素を特定
        changed_elements = self.diff_dfd(feature_spec)
        # 2. 変更要素に対するSTRIDE分析
        new_threats = self.analyze_stride(changed_elements)
        # 3. 既存の脅威モデルに統合
        self.merge_threats(new_threats)
        # 4. レビューとサインオフ
        self.request_review(new_threats)
```

### Anti-Pattern 3: Pursuing Exhaustive Coverage

The pattern of trying to identify 100% of all threats, resulting in an analysis that never ends. Apply risk-based prioritization and address high-risk threats first. Keep in mind the Pareto principle (20% of threats account for 80% of risk).

---

## Practice Exercises

### Exercise 1 (Basic): STRIDE Analysis

Perform a STRIDE analysis on the "Login API" of the system described below. For each category, describe at least one threat and countermeasure.

**System Overview**: A web application where users log in with an email address and password. A JWT token is returned upon successful login.

<details>
<summary>Model Answer</summary>

| Category | Threat | Attack Method | Countermeasure |
|----------|--------|---------------|----------------|
| S: Spoofing | Brute-force attack | Mass password attempts | Rate limiting (5/min), account lockout (30 min), MFA |
| S: Spoofing | Credential stuffing | Trying leaked ID/password pairs | Password breach check (HaveIBeenPwned API), MFA |
| T: Tampering | JWT token tampering | Change header alg to none | Enforce alg validation, use RS256, strict signature verification |
| T: Tampering | Request parameter tampering | Proxy modifies email/password fields | Server-side validation, enforce TLS |
| R: Repudiation | Denying login action | Claim "I never logged in" | Audit logs with IP/UA/timestamp, device fingerprinting |
| I: Info Disclosure | Inferring info from error messages | Response "Email address does not exist" | Unified error message "Authentication failed" |
| I: Info Disclosure | Timing attack | Response time difference between existing and non-existing accounts | Constant-time comparison, intentional delay |
| D: Denial of Service | Login API exhaustion attack | Mass login requests | Rate limiting, CAPTCHA, CDN |
| E: Elevation of Privilege | Tampering with role claim in JWT | Exploiting JWT signature vulnerability | Strict signature verification, retrieve role info server-side |

</details>

### Exercise 2 (Intermediate): DFD Creation and Trust Boundary Analysis

Create a DFD for the system below, identify data flows crossing trust boundaries, and analyze the threats for each flow.

**System Overview**: Mobile app → API Gateway → Microservices (authentication, products, orders) → PostgreSQL → External payment API (Stripe)

<details>
<summary>Model Answer</summary>

**DFD:**
```
Trust Boundary 1 (External)    Trust Boundary 2 (DMZ)     Trust Boundary 3 (Internal)
+------------------+          +------------------+        +------------------+
|  +-----------+   |          |  +-----------+   |        |  +-----------+   |
|  | Mobile    |------------->|  API        |------------>|  Auth      |   |
|  | App       |   |          |  | Gateway   |   |        |  | Service   |   |
|  +-----------+   |          |  +-----------+   |        |  +-----------+   |
|                  |          |       |          |        |       |          |
+------------------+          |       v          |        |  +-----------+   |
                              |  +-----------+   |        |  | Product   |   |
                              |  | Rate      |   |        |  | Service   |   |
                              |  | Limiter   |   |        |  +-----------+   |
                              |  +-----------+   |        |       |          |
                              +------------------+        |  +-----------+   |
                                                          |  | Order     |   |
Trust Boundary 4 (External)                               |  | Service   |   |
+------------------+                                      |  +-----------+   |
|  +-----------+   |                                      |       |          |
|  | Stripe    |<-----------------------------------------|  +----v------+   |
|  | API       |   |                                      |  | PostgreSQL |   |
|  +-----------+   |                                      |  +-----------+   |
+------------------+                                      +------------------+
```

**Threat analysis for flows crossing trust boundaries:**

| Flow | Boundary | Threats | Countermeasures |
|------|----------|---------|-----------------|
| Mobile App → API Gateway | External → DMZ | Spoofing, tampering, eavesdropping | TLS 1.3, JWT Bearer auth, certificate pinning |
| API Gateway → Auth Service | DMZ → Internal | Spoofing, tampering | mTLS, service mesh |
| Order Service → PostgreSQL | Internal | SQL injection, info disclosure | Parameterized queries, least-privilege DB connection, encrypted connection |
| Order Service → Stripe API | Internal → External | Info disclosure (card data) | PCI DSS compliance, tokenization, TLS |

</details>

### Exercise 3 (Advanced): Attack Tree and DREAD Scoring

Create an attack tree for the scenario below, assign DREAD scores to each leaf node, and identify the highest-risk attack path.

**Scenario**: An attacker executes an unauthorized transfer from another person's account in an online banking system.

<details>
<summary>Model Answer</summary>

```
[Unauthorized transfer from another's account] (Root, OR)
├── [Account Takeover] (OR)
│   ├── [Phishing Attack]
│   │   DREAD: D=9, R=8, E=7, A=3, D=6 → 6.6 (High)
│   ├── [Brute Force]
│   │   DREAD: D=9, R=10, E=4, A=1, D=8 → 6.4 (High)
│   └── [SIM Swapping (MFA bypass)]
│       DREAD: D=9, R=6, E=3, A=1, D=4 → 4.6 (Medium)
│
├── [Application Vulnerability] (OR)
│   ├── [CSRF Attack]
│   │   DREAD: D=9, R=8, E=6, A=5, D=7 → 7.0 (High)
│   ├── [IDOR (tampering with transfer destination ID)]
│   │   DREAD: D=9, R=10, E=8, A=3, D=6 → 7.2 (High) ★ Highest Risk
│   └── [Session Hijacking]
│       DREAD: D=9, R=7, E=5, A=3, D=5 → 5.8 (Medium)
│
└── [Insider Threat] (OR)
    ├── [Direct DB manipulation by admin]
    │   DREAD: D=10, R=10, E=8, A=1, D=2 → 6.2 (High)
    └── [Support staff misconduct]
        DREAD: D=8, R=9, E=7, A=1, D=3 → 5.6 (Medium)
```

**Highest-risk path**: IDOR (DREAD score 7.2)

**Reason**: IDOR has high reproducibility (R=10), is relatively easy to exploit (E=8), and causes severe damage (D=9). An attacker may be able to execute the attack simply by changing the `from_account_id` parameter in the transfer API request to another user's account ID.

**Priority countermeasures**:
1. Mandatory ownership check (from_account_id == current_user.account_id)
2. Re-authentication before transfer (password or biometrics)
3. Anomaly detection for transfer amount and frequency (fraud detection system)
4. Immediate transfer notification (email + push notification)
</details>

---

## FAQ

### Q1: Who should perform threat modeling?

The entire development team should be involved. Not just security specialists — the following roles are recommended to participate:
- **Architects**: Understanding the overall system structure, defining trust boundaries
- **Developers**: Knowledge of implementation-level vulnerability patterns
- **Operations**: Infrastructure-level threats, monitoring requirements
- **Product Owner**: Evaluating business risk, prioritization decisions
- **Security Specialists**: Facilitation, providing the threat library

### Q2: Should I use STRIDE or DREAD?

Use both together. STRIDE is for "classifying and identifying" threats; DREAD is for "prioritizing" the identified threats. Assigning DREAD scores to threats found with STRIDE makes prioritization of countermeasures clear. Large organizations often use CVSS instead of DREAD.

### Q3: Is threat modeling necessary even for small projects?

Just simplify it to match the scale. Even a minimum 30-minute workshop can be effective:
1. Draw a DFD on a whiteboard (10 min)
2. Identify trust boundaries (5 min)
3. Consider at least one threat per STRIDE category (10 min)
4. Decide on countermeasures for the top 3 threats (5 min)

### Q4: How should the results of threat modeling be managed?

The threat model should be version-controlled and updated at the following times:
- When new features are added (incremental analysis)
- When the architecture changes (full review)
- When new attack methods are discovered (update threat library)
- After an incident occurs (incorporate lessons learned)
- Regular reviews (at minimum once a year)

Common tools include Microsoft Threat Modeling Tool, OWASP Threat Dragon, or Git-managed Markdown/JSON.

---

## Summary

| Item | Key Points |
|------|-----------|
| STRIDE | Systematically classify and identify threats across 6 categories. Applicable per DFD element |
| DREAD | Quantitatively evaluate threat risk with 5 scoring axes. Used to determine prioritization |
| Attack Trees | Decompose attack goals into a tree structure; identify the minimum-cost and maximum-probability paths |
| DFD | Visualize data flows and trust boundaries to pinpoint where threats arise |
| PASTA | A 7-stage risk-centric method. Emphasizes alignment with business objectives |
| Kill Chain | Understand the 7 stages of an attack and identify detection/defense points at each stage |
| Practical Procedure | Iteratively execute the 4 stages: decompose → identify → evaluate → respond |

---

## Recommended Next Reading

- [00-security-overview.md](./00-security-overview.md) -- CIA triad and risk assessment basics (review)
- [02-security-principles.md](./02-security-principles.md) -- Design principles as countermeasures against threats
- [../01-web-security/00-owasp-top10.md](../01-web-security/00-owasp-top10.md) -- STRIDE classification of specific web vulnerabilities
- [../01-web-security/03-injection.md](../01-web-security/03-injection.md) -- Detailed coverage of injection attacks (STRIDE-T)
- ../../sql-and-query-mastery/docs/03-practical/ -- Implementing SQL injection countermeasures

---

## References

1. Adam Shostack, "Threat Modeling: Designing for Security" -- Wiley, 2014
2. Microsoft SDL Threat Modeling Tool -- https://www.microsoft.com/en-us/securityengineering/sdl/threatmodeling
3. OWASP Threat Modeling -- https://owasp.org/www-community/Threat_Modeling
4. Bruce Schneier, "Attack Trees" -- Dr. Dobb's Journal, 1999
5. NIST SP 800-154 Guide to Data-Centric System Threat Modeling -- https://csrc.nist.gov/publications/detail/sp/800-154/draft
6. Lockheed Martin Cyber Kill Chain -- https://www.lockheedmartin.com/en-us/capabilities/cyber/cyber-kill-chain.html
7. PASTA Threat Modeling -- Tony UcedaVelez & Marco M. Morana, "Risk Centric Threat Modeling", Wiley, 2015
