# Incident Response

> A guide for responding swiftly and accurately to security incidents — covering incident response flow design, CSIRT organizational structure, forensic investigation techniques, and automated containment. Incident response is built on three pillars: technology, process, and people.

## What You Will Learn

1. **Incident Response Flow** -- A 6-phase process from preparation to recovery and lessons learned, with specific actions for each phase
2. **CSIRT Organization and Roles** -- Incident response team structure, responsibility assignment, and escalation paths
3. **Forensic Investigation** -- Evidence preservation, timeline analysis, root cause identification techniques, and legal requirements
4. **Automation and Exercises** -- SOAR-based response automation, playbook design, and tabletop exercise implementation

## Prerequisites

- Basic security concepts -- Understanding of the CIA triad
- Network security -- Fundamentals of firewalls and IDS
- Cryptography basics -- Understanding of hash functions and signatures
- [Monitoring/Logging](./01-monitoring-logging.md) -- Fundamentals of log collection and SIEM

---

## 1. Overview of Incident Response

### Why Incident Response Matters

Incident Response (IR) is critical because a security breach is not a matter of "if" but "when." According to IBM's Cost of a Data Breach Report 2024, the average cost of a data breach is $4.88 million, and organizations with incident response teams and IR plans save an average of $2.26 million compared to those without.

```
Return on Investment for Incident Response:

  Without IR plan:
    Average 277 days to detection
    Average 70 days to containment
    Average cost: $4.88M
    Brand damage, customer churn, legal penalties

  With IR plan + trained team:
    Detection in under 200 days on average
    Containment in under 55 days on average
    Average cost: $2.62M (46% reduction)
    Rapid recovery, maintained trust
```

### Response Flow Based on NIST SP 800-61

```
+------+     +--------+     +---------+     +----------+
| Prep | --> | Detect/| --> | Contain | --> | Eradicate|
|      |     | Analyze|     |         |     | /Recover |
+------+     +--------+     +---------+     +----------+
   ^                                              |
   |              +----------+                    |
   +--------------| Lessons  |<-------------------+
                  | Learned  |
                  +----------+

* This cycle is not strictly one-directional; returning to a previous phase is common
* Example: A new breach detected during containment → return to Detection/Analysis phase
```

### Phase Details

```
+----------------------------------------------------------+
|  Phase 1: Preparation                                     |
|  +-- Develop incident response plan and obtain executive  |
|      approval                                             |
|  +-- Appoint and train CSIRT members                      |
|  +-- Maintain contact lists (escalation paths)            |
|  +-- Prepare tools and environment (forensic kit)         |
|  +-- Conduct regular Tabletop Exercises                   |
|  +-- Secure communication channels (out-of-band)          |
|----------------------------------------------------------|
|  Phase 2: Detection and Analysis                          |
|  +-- Alert triage (true/false positive determination)     |
|  +-- Identify scope of impact (lateral movement check)    |
|  +-- Determine Severity Level                             |
|  +-- Begin timeline construction                          |
|  +-- Collect IOCs (Indicators of Compromise)              |
|----------------------------------------------------------|
|  Phase 3: Containment                                     |
|  +-- Short-term: Immediate stop of damage spread          |
|  +-- Long-term: Interim measures until permanent fix      |
|  +-- Evidence preservation (forensic imaging)             |
|  +-- Avoid alerting the attacker (do not reveal detection)|
|----------------------------------------------------------|
|  Phase 4: Eradication                                     |
|  +-- Remove malware                                       |
|  +-- Patch vulnerabilities                                |
|  +-- Disable and recreate compromised accounts            |
|  +-- Detect and remove backdoors                          |
|----------------------------------------------------------|
|  Phase 5: Recovery                                        |
|  +-- Staged system restoration                            |
|  +-- Set enhanced monitoring period (minimum 30 days)     |
|  +-- Verify normal operation (baseline comparison)        |
|  +-- Status updates to stakeholders                       |
|----------------------------------------------------------|
|  Phase 6: Lessons Learned                                 |
|  +-- Conduct post-incident review (post-mortem)           |
|  +-- Improve response procedures                          |
|  +-- Implement and track recurrence prevention measures   |
|  +-- Record metrics (MTTD/MTTR)                           |
+----------------------------------------------------------+
```

### Response Flow Comparison -- By Maturity Level

| Maturity | Detection | Containment | Recovery | Lessons Learned |
|----------|-----------|-------------|----------|-----------------|
| Level 1 (Initial) | Manual, ad hoc | Reactive, improvised | Full rebuild | Not performed |
| Level 2 (Managed) | SIEM alerts | Runbooks available | Follow procedures | Performed but superficial |
| Level 3 (Defined) | Correlation analysis, threat intel | Automated + manual | Staged, validated | Conducted blameless |
| Level 4 (Optimized) | ML anomaly detection, SOAR | Automated containment | Automated recovery, IaC | Continuous improvement cycle |

---

## 2. Severity Level Definitions

### Incident Severity

| Level | Definition | Response Time | Examples | Escalation Target |
|-------|------------|---------------|---------|-------------------|
| SEV-1 (Critical) | Service outage or large-scale data breach | Begin response within 15 minutes | Ransomware, full DB leak | Executive, legal, PR |
| SEV-2 (High) | Service degradation or limited data breach | Begin response within 1 hour | Unauthorized access, DDoS | Department head, security team |
| SEV-3 (Medium) | Potential risk or minor impact | Begin response within 24 hours | Successful phishing, malware detected | Security team |
| SEV-4 (Low) | Minor issue or reconnaissance | Respond within 1 week | Port scan, misconfiguration | On-call personnel |

### Severity Assessment Logic

```python
"""
Automatic incident severity assessment logic
"""
from enum import IntEnum
from dataclasses import dataclass
from typing import Optional


class Severity(IntEnum):
    SEV1 = 1  # Critical
    SEV2 = 2  # High
    SEV3 = 3  # Medium
    SEV4 = 4  # Low


@dataclass
class IncidentFactors:
    """インシデントの影響要因"""
    data_exposed: bool = False           # データ漏洩の有無
    data_count: int = 0                  # 影響を受けたレコード数
    service_impact: str = "none"         # none, degraded, down
    pii_involved: bool = False           # 個人情報の関与
    financial_data: bool = False         # 金融データの関与
    active_threat: bool = False          # 脅威が継続中か
    external_facing: bool = False        # 外部公開サービスか
    regulatory_impact: bool = False      # 法規制への影響


def assess_severity(factors: IncidentFactors) -> Severity:
    """
    影響要因に基づいてインシデントの重大度を判定する。

    判定ロジック:
    - SEV-1: サービス停止 or 大規模データ漏洩 or 規制影響
    - SEV-2: サービス劣化 or 限定的データ漏洩 or アクティブ脅威
    - SEV-3: 潜在的リスク or 小規模影響
    - SEV-4: 情報収集レベル
    """
    # SEV-1 条件
    if factors.service_impact == "down":
        return Severity.SEV1
    if factors.data_exposed and factors.data_count > 10000:
        return Severity.SEV1
    if factors.data_exposed and (factors.pii_involved or factors.financial_data):
        return Severity.SEV1
    if factors.regulatory_impact:
        return Severity.SEV1

    # SEV-2 条件
    if factors.service_impact == "degraded":
        return Severity.SEV2
    if factors.data_exposed and factors.data_count > 100:
        return Severity.SEV2
    if factors.active_threat and factors.external_facing:
        return Severity.SEV2

    # SEV-3 条件
    if factors.active_threat:
        return Severity.SEV3
    if factors.data_exposed:
        return Severity.SEV3

    # デフォルト
    return Severity.SEV4


# 使用例
factors = IncidentFactors(
    data_exposed=True,
    data_count=50000,
    pii_involved=True,
    service_impact="degraded",
)
severity = assess_severity(factors)
print(f"判定結果: SEV-{severity}")  # 判定結果: SEV-1
```

---

## 3. CSIRT Organizational Structure

### CSIRT Composition

```
+----------------------------------------------------------+
|                  CSIRT Organization                       |
|----------------------------------------------------------|
|                                                          |
|  Incident Commander (IC)                                 |
|  +-- Overall command and decision-making for incidents   |
|  +-- Determines escalation to executive leadership       |
|  +-- Resource allocation decisions                       |
|                                                          |
|  Technical Lead                                          |
|  +-- Oversees technical investigation and analysis       |
|  +-- Technical decisions for containment and eradication |
|  +-- Supervises forensic work                            |
|                                                          |
|  Communications Lead                                     |
|  +-- Internal and external information dissemination     |
|  +-- Customer and regulatory authority notifications     |
|  +-- Status page updates                                 |
|                                                          |
|  Scribe                                                  |
|  +-- Records all actions and timeline events             |
|  +-- Documents rationale behind decisions                |
|  +-- Collects data for post-mortem                       |
|                                                          |
|  Responders                                              |
|  +-- Log analysis and forensics                          |
|  +-- Infrastructure and network                          |
|  +-- Application                                         |
|                                                          |
|  Support                                                 |
|  +-- Legal (legal advice, evidence preservation req.)    |
|  +-- PR (external communications)                        |
|  +-- HR (in cases involving insider threats)             |
+----------------------------------------------------------+
```

### On-Call Rotation Design

```python
"""
CSIRT オンコールローテーション管理
"""
from datetime import datetime, timedelta
from typing import Optional


class OnCallSchedule:
    """オンコールスケジュール管理"""

    def __init__(self):
        self.primary_rotation = []      # プライマリ担当者リスト
        self.secondary_rotation = []    # セカンダリ担当者リスト
        self.escalation_chain = []      # エスカレーション順序

    def get_current_oncall(self) -> dict:
        """現在のオンコール担当者を取得"""
        now = datetime.utcnow()
        week_number = now.isocalendar()[1]

        primary_idx = week_number % len(self.primary_rotation)
        secondary_idx = week_number % len(self.secondary_rotation)

        return {
            "primary": self.primary_rotation[primary_idx],
            "secondary": self.secondary_rotation[secondary_idx],
            "week": week_number,
        }

    def escalate(self, incident_id: str, current_level: int) -> dict:
        """
        エスカレーション処理

        Level 0: オンコール担当者 (5分以内に応答)
        Level 1: セキュリティチームリード (15分以内)
        Level 2: CISO / VP of Engineering (30分以内)
        Level 3: CEO / 経営会議 (1時間以内)
        """
        if current_level >= len(self.escalation_chain):
            raise ValueError("最上位までエスカレーション済み")

        target = self.escalation_chain[current_level]
        response_deadline = {
            0: timedelta(minutes=5),
            1: timedelta(minutes=15),
            2: timedelta(minutes=30),
            3: timedelta(hours=1),
        }

        return {
            "incident_id": incident_id,
            "escalation_level": current_level,
            "target": target,
            "response_deadline": str(response_deadline[current_level]),
            "notification_channels": ["pagerduty", "phone", "slack"],
        }


# 使用例
schedule = OnCallSchedule()
schedule.primary_rotation = ["tanaka", "suzuki", "sato", "yamada"]
schedule.secondary_rotation = ["kimura", "takahashi", "watanabe", "ito"]
schedule.escalation_chain = [
    {"role": "oncall", "name": "Auto-assigned"},
    {"role": "team_lead", "name": "田中太郎"},
    {"role": "ciso", "name": "鈴木花子"},
    {"role": "ceo", "name": "山田一郎"},
]

current = schedule.get_current_oncall()
print(f"今週の担当: Primary={current['primary']}, Secondary={current['secondary']}")
```

---

## 4. Incident Response Playbooks

### Playbook Design Principles

```
Playbook Components:

  ┌─────────────────────────────────────────────────────┐
  │  1. Trigger Conditions                               │
  │     → Which alerts/events activate this playbook    │
  │                                                     │
  │  2. Initial Response (first 15 minutes)              │
  │     → Checklist format for clear, decisive action   │
  │                                                     │
  │  3. Investigation Procedures                         │
  │     → What to check and in what order               │
  │                                                     │
  │  4. Containment Procedures                           │
  │     → Specific commands and operational steps       │
  │                                                     │
  │  5. Escalation Criteria                              │
  │     → At what point to contact whom                 │
  │                                                     │
  │  6. Communication Templates                          │
  │     → Notification templates for internal/external  │
  └─────────────────────────────────────────────────────┘
```

### Ransomware Response Playbook

```python
"""
ランサムウェアインシデント対応プレイブック

トリガー:
- EDR がランサムウェア活動を検知
- ユーザーからの「ファイルが開けない」報告
- ランサムノートの発見
"""

RANSOMWARE_PLAYBOOK = {
    "name": "Ransomware Response",
    "severity": "SEV-1",
    "owner": "Security Team",
    "last_updated": "2025-03-15",
    "steps": [
        {
            "phase": "Immediate (0-15 min)",
            "actions": [
                "IC を任命し、インシデントチャンネル (Slack/Teams) を開設",
                "ランサムノートの内容をスクリーンショットで記録",
                "影響を受けたシステムのリストを作成開始",
                "暗号化されたファイルの拡張子を記録",
                "マルウェアのハッシュ値を取得 (VirusTotal で確認)",
                "全社への注意喚起: 不審なファイルを開かない",
            ],
        },
        {
            "phase": "Containment (15-60 min)",
            "actions": [
                "感染ホストをネットワークから隔離 (SG 変更 or ケーブル抜去)",
                "Active Directory の特権アカウントを無効化",
                "バックアップシステムへのネットワーク接続を遮断",
                "C2 通信先のドメイン/IP をファイアウォールでブロック",
                "影響を受けていないシステムのスナップショットを取得",
                "EDR で全エンドポイントのスキャンを実行",
            ],
        },
        {
            "phase": "Investigation (1-4 hours)",
            "actions": [
                "マルウェアの初期侵入経路を特定 (メール/RDP/脆弱性)",
                "フォレンジックイメージを取得 (ディスク + メモリ)",
                "横展開 (ラテラルムーブメント) の範囲を特定",
                "侵害の時系列タイムラインを構築",
                "No More Ransom でデクリプタの有無を確認",
            ],
        },
        {
            "phase": "Eradication (4-24 hours)",
            "actions": [
                "全感染ホストを再構築 (クリーンインストール)",
                "侵害された認証情報を全てリセット",
                "パッチ適用・脆弱性修正",
                "バックドアの検出と除去",
                "Kerberos チケット (krbtgt) のリセット (AD 環境の場合)",
            ],
        },
        {
            "phase": "Recovery (24-72 hours)",
            "actions": [
                "クリーンなバックアップからデータ復元",
                "バックアップの整合性を検証",
                "段階的にサービスを復旧 (重要度順)",
                "EDR/IDS の監視を強化 (最低 30 日間)",
                "ユーザーへの全パスワード変更指示",
            ],
        },
    ],
    "communication_templates": {
        "internal": "To all staff: A security incident has been detected and is being addressed. Do not open suspicious emails and follow IT department instructions.",
        "customer": "To our customers: We are currently investigating a security incident. We will notify you promptly regarding any impact to your data once the investigation is complete.",
        "regulatory": "To the regulatory authority: A security incident has occurred at [Organization Name] and we are currently responding. Details will be reported subsequently.",
    },
    "do_not": [
        "Do not pay the ransom (consult with legal before deciding)",
        "Do not contact the attacker directly",
        "Do not power off the infected system (memory evidence will be lost)",
        "Do not disclose information based on individual judgment",
    ],
}
```

### Automated Containment on AWS

```python
"""
AWS 環境でのインシデント自動封じ込めスクリプト
GuardDuty 検知をトリガーに EC2 インスタンスを自動隔離する
"""
import boto3
import json
from datetime import datetime
from typing import Optional


class AWSIncidentContainment:
    """AWS インシデント封じ込め自動化クラス"""

    def __init__(self, isolation_sg: str, forensic_bucket: str):
        self.ec2 = boto3.client('ec2')
        self.ssm = boto3.client('ssm')
        self.s3 = boto3.client('s3')
        self.sns = boto3.client('sns')
        self.isolation_sg = isolation_sg
        self.forensic_bucket = forensic_bucket

    def contain_ec2_instance(
        self,
        instance_id: str,
        finding_id: str,
        preserve_memory: bool = True,
    ) -> dict:
        """
        EC2 インスタンスを自動隔離する

        手順:
        1. 現在のセキュリティグループを記録 (復旧用)
        2. 隔離用 SG に変更 (全通信拒否)
        3. EBS スナップショットを取得 (証拠保全)
        4. オプションでメモリダンプを取得
        """
        timestamp = datetime.utcnow().isoformat()
        results = {"instance_id": instance_id, "finding_id": finding_id}

        # 1. 現在の SG を記録
        instance = self.ec2.describe_instances(
            InstanceIds=[instance_id]
        )
        current_sgs = [
            sg['GroupId']
            for sg in instance['Reservations'][0]['Instances'][0]['SecurityGroups']
        ]

        # タグに元の SG を保存
        self.ec2.create_tags(
            Resources=[instance_id],
            Tags=[
                {'Key': 'IncidentId', 'Value': finding_id},
                {'Key': 'OriginalSecurityGroups', 'Value': ','.join(current_sgs)},
                {'Key': 'IsolatedAt', 'Value': timestamp},
                {'Key': 'IsolatedBy', 'Value': 'auto-containment'},
            ],
        )

        # 2. 隔離 SG に変更 (ネットワーク隔離)
        self.ec2.modify_instance_attribute(
            InstanceId=instance_id,
            Groups=[self.isolation_sg],
        )
        results['network_isolated'] = True

        # 3. EBS スナップショット取得 (証拠保全)
        volumes = self.ec2.describe_volumes(
            Filters=[{
                'Name': 'attachment.instance-id',
                'Values': [instance_id],
            }]
        )
        snapshot_ids = []
        for vol in volumes['Volumes']:
            snapshot = self.ec2.create_snapshot(
                VolumeId=vol['VolumeId'],
                Description=f"Forensic snapshot - Incident {finding_id}",
                TagSpecifications=[{
                    'ResourceType': 'snapshot',
                    'Tags': [
                        {'Key': 'Purpose', 'Value': 'forensic'},
                        {'Key': 'IncidentId', 'Value': finding_id},
                        {'Key': 'SourceVolume', 'Value': vol['VolumeId']},
                    ],
                }],
            )
            snapshot_ids.append(snapshot['SnapshotId'])
        results['forensic_snapshots'] = snapshot_ids

        # 4. メモリダンプ (オプション)
        if preserve_memory:
            try:
                self.ssm.send_command(
                    InstanceIds=[instance_id],
                    DocumentName='AWS-RunShellScript',
                    Parameters={
                        'commands': [
                            'apt-get install -y lime-forensics 2>/dev/null || true',
                            'insmod /lib/modules/$(uname -r)/lime.ko '
                            f'"path=/tmp/memdump-{finding_id}.lime format=lime"',
                        ],
                    },
                )
                results['memory_dump_initiated'] = True
            except Exception as e:
                results['memory_dump_error'] = str(e)

        # 5. 通知
        self.sns.publish(
            TopicArn='arn:aws:sns:ap-northeast-1:123456:security-incidents',
            Subject=f'[SEV-1] EC2 Instance Isolated: {instance_id}',
            Message=json.dumps(results, indent=2),
        )

        results['status'] = 'isolated'
        results['original_sgs'] = current_sgs
        return results

    def contain_iam_user(self, username: str, finding_id: str) -> dict:
        """
        侵害された IAM ユーザーを無効化する

        手順:
        1. アクセスキーを無効化
        2. インラインでDenyAllポリシーをアタッチ
        3. アクティブセッションを無効化
        """
        iam = boto3.client('iam')
        results = {"username": username, "finding_id": finding_id}

        # 1. 全アクセスキーを無効化
        keys = iam.list_access_keys(UserName=username)
        for key in keys['AccessKeyMetadata']:
            iam.update_access_key(
                UserName=username,
                AccessKeyId=key['AccessKeyId'],
                Status='Inactive',
            )
        results['keys_disabled'] = len(keys['AccessKeyMetadata'])

        # 2. DenyAll ポリシーをアタッチ
        deny_policy = json.dumps({
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Deny",
                "Action": "*",
                "Resource": "*",
                "Condition": {
                    "DateLessThan": {
                        "aws:TokenIssueTime": datetime.utcnow().isoformat() + "Z"
                    }
                },
            }],
        })
        iam.put_user_policy(
            UserName=username,
            PolicyName=f'IncidentContainment-{finding_id}',
            PolicyDocument=deny_policy,
        )
        results['deny_policy_attached'] = True

        # 3. コンソールパスワードを無効化
        try:
            iam.delete_login_profile(UserName=username)
            results['console_access_disabled'] = True
        except iam.exceptions.NoSuchEntityException:
            results['console_access_disabled'] = 'N/A (no console access)'

        return results


# 使用例
containment = AWSIncidentContainment(
    isolation_sg='sg-isolation-xxxxxxxx',
    forensic_bucket='forensic-evidence-bucket',
)

# EC2 隔離
result = containment.contain_ec2_instance(
    instance_id='i-0abc123def456789',
    finding_id='FINDING-2025-001',
)
print(json.dumps(result, indent=2))
```

---

## 5. Forensic Investigation

### Forensic Investigation Overview

```
+----------------------------------------------------------+
|              Digital Forensics Procedures                 |
|----------------------------------------------------------|
|                                                          |
|  1. Preservation                                         |
|     +-- Acquire disk images (dd, FTK Imager)             |
|     +-- Acquire memory dumps (LiME, WinPmem, Volatility) |
|     +-- Network capture (tcpdump, Wireshark)             |
|     +-- Record hash values (SHA-256)                     |
|     +-- Document Chain of Custody                        |
|                                                          |
|  2. Timeline Analysis                                    |
|     +-- Organize logs chronologically                    |
|     +-- Analyze filesystem timestamps                    |
|     +-- Reconstruct attacker activity in chronological   |
|         order                                            |
|     +-- Cross-reference IOCs                             |
|                                                          |
|  3. Malware Analysis                                     |
|     +-- Static analysis: hash check, string extraction   |
|     +-- Dynamic analysis: sandbox execution              |
|     +-- Extract IOCs (Indicators of Compromise)          |
|     +-- Pattern matching with YARA rules                 |
|                                                          |
|  4. Reporting                                            |
|     +-- Summarize findings                               |
|     +-- Identify root cause                              |
|     +-- Recommend recurrence prevention measures        |
|     +-- Document in format suitable for legal proceedings|
+----------------------------------------------------------+
```

### Evidence Preservation -- Chain of Custody

```
Importance of Chain of Custody:

  Records required to make evidence legally valid:
  ┌────────────────────────────────────────────────────┐
  │  1. Who collected the evidence (name of collector)  │
  │  2. When it was collected (date/time/timezone)      │
  │  3. Where it was collected from (device/location)   │
  │  4. How it was collected (tools/procedures)         │
  │  5. Record of storage location and access after     │
  │     collection                                      │
  │  6. Proof of evidence integrity (hash value)        │
  └────────────────────────────────────────────────────┘
```

### Practical Log Analysis

```bash
# CloudTrail ログから不審な活動を検索

# 権限昇格の試行を検索
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=CreateRole \
  --start-time "2025-01-01T00:00:00Z" \
  --end-time "2025-01-02T00:00:00Z"

# 特定 IP からの全アクティビティ
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::IAM::User \
  --start-time "2025-01-01" \
  --max-results 50

# Athena で CloudTrail を高速検索
# 大量のログを分析する場合に有効
cat << 'SQL'
SELECT
  eventtime,
  eventname,
  sourceipaddress,
  useridentity.arn,
  errorcode
FROM cloudtrail_logs
WHERE eventtime BETWEEN '2025-01-01' AND '2025-01-02'
  AND sourceipaddress = '203.0.113.50'
ORDER BY eventtime
SQL
```

```python
"""
複数ソースからインシデントタイムラインを構築するスクリプト
"""
import json
from datetime import datetime
from typing import Any


class IncidentTimeline:
    """インシデントタイムラインビルダー"""

    def __init__(self):
        self.events = []

    def add_cloudtrail_events(self, events: list[dict]) -> None:
        """CloudTrail イベントを追加"""
        for event in events:
            self.events.append({
                'timestamp': event['EventTime'],
                'source': 'CloudTrail',
                'action': event['EventName'],
                'actor': event.get('Username', 'unknown'),
                'ip': event.get('SourceIPAddress'),
                'details': event.get('Resources', []),
                'severity': self._classify_event(event['EventName']),
            })

    def add_vpc_flow_logs(self, logs: list[dict]) -> None:
        """VPC Flow Log イベントを追加"""
        for log in logs:
            self.events.append({
                'timestamp': log['timestamp'],
                'source': 'VPC Flow',
                'action': (
                    f"{log['srcaddr']}:{log['srcport']} -> "
                    f"{log['dstaddr']}:{log['dstport']}"
                ),
                'actor': log['srcaddr'],
                'details': {
                    'action': log['action'],
                    'bytes': log['bytes'],
                    'protocol': log.get('protocol'),
                },
                'severity': 'info',
            })

    def add_application_logs(self, logs: list[dict]) -> None:
        """アプリケーションログを追加"""
        for log in logs:
            self.events.append({
                'timestamp': log.get('timestamp'),
                'source': 'Application',
                'action': log.get('event', 'unknown'),
                'actor': log.get('userId', log.get('sourceIp', 'unknown')),
                'details': log.get('details', {}),
                'severity': log.get('level', 'info').lower(),
            })

    def build(self) -> list[dict]:
        """時系列順にソートしたタイムラインを返す"""
        self.events.sort(key=lambda x: x['timestamp'])
        return self.events

    def get_suspicious_events(self) -> list[dict]:
        """不審なイベントのみをフィルタ"""
        return [
            e for e in self.build()
            if e['severity'] in ('high', 'critical')
        ]

    def export_csv(self, filepath: str) -> None:
        """タイムラインを CSV でエクスポート"""
        import csv
        timeline = self.build()
        with open(filepath, 'w', newline='') as f:
            writer = csv.DictWriter(
                f,
                fieldnames=['timestamp', 'source', 'action', 'actor', 'ip', 'severity'],
            )
            writer.writeheader()
            for event in timeline:
                writer.writerow({
                    'timestamp': event['timestamp'],
                    'source': event['source'],
                    'action': event['action'],
                    'actor': event['actor'],
                    'ip': event.get('ip', ''),
                    'severity': event['severity'],
                })

    @staticmethod
    def _classify_event(event_name: str) -> str:
        """イベント名から重大度を分類"""
        critical_events = {
            'DeleteTrail', 'StopLogging', 'CreateUser',
            'CreateAccessKey', 'PutBucketPolicy',
            'AuthorizeSecurityGroupIngress',
        }
        high_events = {
            'CreateRole', 'AttachRolePolicy', 'PutUserPolicy',
            'ModifyInstanceAttribute', 'RunInstances',
        }
        if event_name in critical_events:
            return 'critical'
        if event_name in high_events:
            return 'high'
        return 'info'


# 使用例
timeline = IncidentTimeline()
timeline.add_cloudtrail_events([
    {
        'EventTime': '2025-03-15T14:30:00Z',
        'EventName': 'CreateAccessKey',
        'Username': 'compromised-user',
        'SourceIPAddress': '203.0.113.50',
    },
    {
        'EventTime': '2025-03-15T14:35:00Z',
        'EventName': 'PutBucketPolicy',
        'Username': 'compromised-user',
        'SourceIPAddress': '203.0.113.50',
        'Resources': [{'ARN': 'arn:aws:s3:::sensitive-data'}],
    },
])

suspicious = timeline.get_suspicious_events()
for event in suspicious:
    print(f"[{event['severity'].upper()}] {event['timestamp']} "
          f"{event['action']} by {event['actor']}")
```

---

## 6. SOAR (Security Orchestration, Automation and Response)

### SOAR Overview

```
Role of SOAR:

  ┌─────────────────────────────────────────────────────┐
  │  1. Orchestration                                    │
  │     → Integrate multiple security tools             │
  │     → Unify SIEM + EDR + FW + Ticketing             │
  │                                                     │
  │  2. Automation                                       │
  │     → Automatically execute routine response steps  │
  │     → Automatically add IOCs to blocklists          │
  │     → Automatically execute containment actions     │
  │                                                     │
  │  3. Response                                         │
  │     → Standardized response based on playbooks      │
  │     → Case management and collaboration             │
  │     → Automatic metrics collection                  │
  └─────────────────────────────────────────────────────┘

Major SOAR Tools:

  Tool             | Type        | Features
  ─────────────────┼─────────────┼─────────────────────
  Palo Alto XSOAR  | Commercial  | Rich integrations, ML-powered
  Splunk SOAR      | Commercial  | Integrated with Splunk SIEM
  Shuffle          | OSS         | Free, Docker-based
  TheHive          | OSS         | Strong case management
  AWS Step Func.   | Cloud       | Native AWS integration
```

### Automated Response Flow with Step Functions

```python
"""
AWS Step Functions + Lambda による自動インシデント対応
GuardDuty → EventBridge → Step Functions → Lambda
"""
import json

# Step Functions のステートマシン定義
STATE_MACHINE = {
    "Comment": "GuardDuty Finding Auto-Response",
    "StartAt": "ClassifyFinding",
    "States": {
        "ClassifyFinding": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:ap-northeast-1:123456:function:classify-finding",
            "Next": "SeverityCheck",
        },
        "SeverityCheck": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.severity",
                    "NumericGreaterThanEquals": 7,
                    "Next": "AutoContain",
                },
                {
                    "Variable": "$.severity",
                    "NumericGreaterThanEquals": 4,
                    "Next": "CreateTicket",
                },
            ],
            "Default": "LogOnly",
        },
        "AutoContain": {
            "Type": "Parallel",
            "Branches": [
                {
                    "StartAt": "IsolateResource",
                    "States": {
                        "IsolateResource": {
                            "Type": "Task",
                            "Resource": "arn:aws:lambda:ap-northeast-1:123456:function:isolate",
                            "End": True,
                        },
                    },
                },
                {
                    "StartAt": "NotifyTeam",
                    "States": {
                        "NotifyTeam": {
                            "Type": "Task",
                            "Resource": "arn:aws:lambda:ap-northeast-1:123456:function:notify",
                            "End": True,
                        },
                    },
                },
                {
                    "StartAt": "PreserveEvidence",
                    "States": {
                        "PreserveEvidence": {
                            "Type": "Task",
                            "Resource": "arn:aws:lambda:ap-northeast-1:123456:function:preserve",
                            "End": True,
                        },
                    },
                },
            ],
            "Next": "CreateTicket",
        },
        "CreateTicket": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:ap-northeast-1:123456:function:create-ticket",
            "End": True,
        },
        "LogOnly": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:ap-northeast-1:123456:function:log-finding",
            "End": True,
        },
    },
}
```

---

## 7. Post-Mortem

### Principles of Blameless Post-Mortems

```
Why Blameless Post-Mortems Matter:

  BAD: "Yamada made a configuration error"
  GOOD: "The configuration change process lacked a validation check"

  ┌─────────────────────────────────────────────────────┐
  │  Blameless Post-Mortem Principles:                   │
  │                                                     │
  │  1. Focus on process, not people                    │
  │  2. Understand why the action seemed reasonable     │
  │     at the time                                     │
  │  3. Direct prevention measures toward system/       │
  │     process improvements                            │
  │  4. Foster a culture of learning                    │
  │  5. Ensure a safe environment for all participants  │
  │     to speak openly                                 │
  └─────────────────────────────────────────────────────┘
```

### Post-Mortem Template

```markdown
# Incident Post-Mortem

## Basic Information
- Incident ID: INC-2025-042
- Occurrence time: 2025-03-15 14:30 JST
- Detection time: 2025-03-15 14:35 JST (MTTD: 5 minutes)
- Resolution time: 2025-03-15 18:20 JST (MTTR: 3 hours 50 minutes)
- Severity: SEV-2
- Incident Commander: Taro Yamada

## Summary
An S3 bucket misconfiguration left customer data publicly accessible
for 4 hours.

## Impact
- Affected users: 0 (no external access occurred)
- Data breach: None (confirmed via CloudTrail)
- SLA violation: None
- Financial impact: None

## Timeline
- 14:30 - Terraform apply changed the bucket policy
- 14:35 - AWS Config rule violation detected, alert triggered
- 14:40 - IC declared incident, response initiated
- 14:50 - Public access block manually enabled (containment)
- 15:30 - CloudTrail access logs analyzed
- 16:00 - Confirmed no external access occurred
- 18:00 - Terraform code fixed and deployed
- 18:20 - Incident closed

## Root Cause
During a Terraform module update, the S3 public access block resource was
accidentally removed. This was missed during the PR review.

## Contributing Factors
1. Terraform plan output was long, making it easy to miss the deleted resource
2. IaC security scanning (tfsec) had not been integrated into CI
3. No organization-level S3 SCP control existed

## What Went Well
- AWS Config automatic detection worked within 5 minutes
- The IC's swift decision led to containment within 20 minutes

## Areas for Improvement
- No IaC security scanning was in place
- No security-focused checklist existed for PR reviews

## Recurrence Prevention (Action Items)
| ID | Measure | Owner | Due | Status |
|----|---------|-------|-----|--------|
| 1 | Integrate tfsec/Checkov into CI/CD | Suzuki | 2025-03-22 | TODO |
| 2 | Add AWS Config auto-remediation rules | Sato | 2025-03-29 | TODO |
| 3 | Block org-wide public S3 access via SCP | Tanaka | 2025-04-05 | TODO |
| 4 | Add security items to PR review checklist | Yamada | 2025-03-19 | TODO |
```

### Tracking Incident Metrics

```python
"""
インシデント対応メトリクスの収集と可視化
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class IncidentMetrics:
    """インシデントメトリクス"""
    incident_id: str
    severity: int
    detected_at: datetime
    responded_at: datetime
    contained_at: datetime
    resolved_at: datetime
    root_cause: str
    category: str

    @property
    def mttd(self) -> timedelta:
        """Mean Time to Detect (平均検知時間)"""
        return self.detected_at - self.detected_at  # 実際は発生時刻から

    @property
    def mttr(self) -> timedelta:
        """Mean Time to Respond (平均対応時間)"""
        return self.responded_at - self.detected_at

    @property
    def mttc(self) -> timedelta:
        """Mean Time to Contain (平均封じ込め時間)"""
        return self.contained_at - self.detected_at

    @property
    def mttre(self) -> timedelta:
        """Mean Time to Resolve (平均解決時間)"""
        return self.resolved_at - self.detected_at


def calculate_team_metrics(incidents: list[IncidentMetrics]) -> dict:
    """チーム全体のメトリクスを集計"""
    if not incidents:
        return {}

    total = len(incidents)
    avg_mttr = sum(
        (i.mttr.total_seconds() for i in incidents), 0
    ) / total
    avg_mttc = sum(
        (i.mttc.total_seconds() for i in incidents), 0
    ) / total

    severity_counts = {}
    for i in incidents:
        severity_counts[f'SEV-{i.severity}'] = (
            severity_counts.get(f'SEV-{i.severity}', 0) + 1
        )

    category_counts = {}
    for i in incidents:
        category_counts[i.category] = (
            category_counts.get(i.category, 0) + 1
        )

    return {
        'total_incidents': total,
        'avg_mttr_minutes': round(avg_mttr / 60, 1),
        'avg_mttc_minutes': round(avg_mttc / 60, 1),
        'by_severity': severity_counts,
        'by_category': category_counts,
    }
```

---

## 8. Tabletop Exercise

### Exercise Design and Execution

```
How to Run a Tabletop Exercise:

  ┌─────────────────────────────────────────────────────┐
  │  Preparation (2 weeks before the exercise)           │
  │  +-- Create scenarios (based on realistic threats)   │
  │  +-- Select participants (CSIRT + related depts.)    │
  │  +-- Appoint a facilitator                           │
  │  +-- Prepare inject events                           │
  │                                                     │
  │  Execution (2-4 hours)                               │
  │  +-- Present the scenario                            │
  │  +-- Discuss decisions and responses at each phase   │
  │  +-- Use injects to change the situation             │
  │  +-- Encourage all participants to contribute        │
  │                                                     │
  │  Follow-up (within 1 week)                           │
  │  +-- Summarize findings                              │
  │  +-- Identify gaps                                   │
  │  +-- Define improvement action items                 │
  │  +-- Plan the next exercise                          │
  └─────────────────────────────────────────────────────┘
```

```python
"""
机上演習シナリオジェネレータ
"""
import random


class TabletopScenario:
    """机上演習シナリオの生成"""

    SCENARIOS = [
        {
            "title": "Ransomware Attack",
            "description": "On Monday morning, multiple employees report they cannot open files. "
                          "A ransom note is displayed on their desktops.",
            "injects": [
                "The infection is spreading via Active Directory and has reached the domain controller.",
                "The attacker sends an email: 'Pay the ransom in Bitcoin within 48 hours.'",
                "A reporter contacts you: 'We have information that your company has been hit by a cyberattack.'",
                "It is discovered that the backup server has also been encrypted.",
            ],
            "discussion_points": [
                "What should be done in the first 15 minutes?",
                "Should the entire network be shut down, or should isolation be partial?",
                "Should the ransom be paid? What are the legal and ethical considerations?",
                "What is the timing and content of notifications to customers and business partners?",
                "What is the recovery strategy if backups are unavailable?",
            ],
        },
        {
            "title": "Insider Threat Data Exfiltration",
            "description": "A DLP tool triggers an alert indicating that an employee scheduled for departure "
                          "is copying a large volume of files to a personal device.",
            "injects": [
                "The employee has already downloaded 500 customer lists and technical documents.",
                "The employee claims it was 'work-related activity.'",
                "It is revealed the employee is transferring to a competitor.",
                "A review of the past 3 months of access logs reveals an unusual pattern.",
            ],
            "discussion_points": [
                "At what point should HR be involved?",
                "When should the legal team be brought in?",
                "When should the employee's access rights be revoked?",
                "What should be done to preserve evidence?",
                "What are the procedures if legal action is pursued?",
            ],
        },
    ]

    @classmethod
    def generate(cls, scenario_type: str = "random") -> dict:
        """シナリオを生成"""
        if scenario_type == "random":
            return random.choice(cls.SCENARIOS)
        for s in cls.SCENARIOS:
            if scenario_type.lower() in s["title"].lower():
                return s
        return cls.SCENARIOS[0]


# 使用例
scenario = TabletopScenario.generate("Ransomware")
print(f"Scenario: {scenario['title']}")
print(f"Situation: {scenario['description']}")
print("\nDiscussion Points:")
for i, point in enumerate(scenario['discussion_points'], 1):
    print(f"  {i}. {point}")
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Destroying Evidence

```
BAD:
  → Immediately reboot or rebuild the infected server
  → Clear logs to restore a clean state
  → Delete malware files
  → Overwrite evidence in the rush to "restore service immediately"

  Result: Root cause cannot be identified, legal evidence is unusable,
          the incident recurs

GOOD:
  → First acquire a disk image and memory dump
  → Preserve logs as read-only (copy to a separate, secure location)
  → Investigate while keeping the system isolated
  → Maintain Chain of Custody records
  → Follow the instructions of the forensic investigator
```

### Anti-Pattern 2: No Incident Response Plan

```
BAD:
  → "We'll figure it out if an incident happens"
  → No contact list exists
  → Roles and responsibilities are undefined
  → A plan exists but has never been practiced

  Result: Panic, delayed response, confused decision-making

GOOD:
  → Document the response plan and update it regularly
  → Conduct tabletop exercises quarterly
  → Conduct red team exercises annually
  → Validate plan effectiveness with metrics
```

### Anti-Pattern 3: Handling Everything Manually

```
BAD:
  → Execute all containment actions manually
  → Repetitive tasks that have not been scripted
  → During nights and weekends, hours pass before response begins
  → Response quality depends on the individual responder's skill

  Result: Delayed response, human error, inconsistent response quality

GOOD:
  → Introduce SOAR for automated containment
  → Script playbooks
  → Build automated response flows for low-to-medium risk incidents
  → Use automated detection + human judgment for high-risk incidents
```

---

## 10. Practice Exercises

### Exercise 1: Incident Severity Assessment (Basic)

Determine the severity level (SEV-1 to SEV-4) for each of the following incidents and describe your reasoning and initial response.

1. A developer accidentally drops a production DB table
2. An external security researcher reports an XSS vulnerability
3. GuardDuty detects cryptocurrency mining traffic from an EC2 instance
4. 50 employees click on a link in a phishing email

<details>
<summary>Model Answers</summary>

1. **DROP TABLE -- SEV-1 (Critical)**
   - Reason: Loss of production data directly causes service outage. Restoring data requires recovering from backup.
   - Initial response: Verify backup, begin restore, identify scope of impact, notify users

2. **XSS Report -- SEV-3 (Medium)**
   - Reason: Responsible disclosure by an external researcher. If there is no evidence of an active attack, it is a potential risk.
   - Initial response: Reproduce the vulnerability, add a WAF rule (interim), determine priority for developing a fix patch

3. **Cryptocurrency Mining -- SEV-2 (High)**
   - Reason: EC2 has been compromised. Potential for lateral movement and additional breaches.
   - Initial response: Isolate the EC2 instance (change SG), preserve memory/disk evidence, investigate entry point

4. **Phishing -- 50 Employees Clicked -- SEV-2 (High)**
   - Reason: 50 employees are potentially compromised. Risk of credential theft and malware infection.
   - Initial response: Force password reset for all affected users, invalidate sessions, scan affected endpoints
</details>

### Exercise 2: Writing a Post-Mortem (Applied)

Based on the following scenario, write a Blameless post-mortem.

**Scenario:** At 2:00 AM, a web application goes completely offline. The cause was a code change deployed at 6:00 PM the previous day that introduced a memory leak, causing all instances to crash with OOM (Out of Memory) errors after 6 hours. An alert was configured but only sent Slack notifications, and the on-call engineer was asleep and did not notice.

<details>
<summary>Model Answer</summary>

```markdown
# Incident Post-Mortem

## Basic Information
- Incident ID: INC-2025-047
- Occurrence time: 2025-04-10 02:00 JST
- Detection time: 2025-04-10 02:45 JST (detected via user report)
- Resolution time: 2025-04-10 04:30 JST
- Severity: SEV-1
- MTTD: 45 minutes, MTTR: 2 hours 30 minutes

## Summary
A code change included in the 18:00 deployment introduced a memory leak
that caused all instances to crash with OOM errors 6 hours later,
resulting in a complete service outage.

## Root Cause
An HTTP connection pool in the new feature code was not properly closed,
causing memory to accumulate with each request.

## Contributing Factors
1. Memory usage threshold alerts existed but only sent Slack notifications
2. Long-duration load testing was not performed before deployment
3. All instances were deployed simultaneously rather than using canary deployment
4. Rollback procedures were not documented

## What Went Well
- Response after the user report was prompt
- The rollback itself was completed within 30 minutes

## Recurrence Prevention
| Measure | Owner | Due |
|---------|-------|-----|
| Add PagerDuty notification channel | Infrastructure team | 1 week |
| Introduce canary deployment | SRE | 1 month |
| Add long-duration load test to CI | QA | 2 weeks |
| Add automated memory leak detection test | Dev team | 2 weeks |
```
</details>

### Exercise 3: Designing an Automated Containment Script (Advanced)

Design an automated incident containment system that meets the following requirements.

**Requirements:**
- When GuardDuty detects "anonymous access to an S3 bucket," automatically block public access to the S3 bucket
- Save the original configuration to tags (for recovery)
- Output an action record to CloudWatch Logs as an audit trail
- Notify the security team via SNS
- Also design a rollback procedure for false positives

<details>
<summary>Model Answer</summary>

```python
"""
S3 パブリックアクセス自動封じ込め
EventBridge -> Lambda でトリガーされる
"""
import boto3
import json
import logging
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context) -> dict:
    """
    GuardDuty S3 パブリックアクセス検知時の自動対応
    """
    s3 = boto3.client('s3')
    sns = boto3.client('sns')

    # GuardDuty Finding からバケット名を取得
    finding = event['detail']
    bucket_name = finding['resource']['s3BucketDetails'][0]['name']
    finding_id = finding['id']
    finding_type = finding['type']

    logger.info(f"Processing finding {finding_id} for bucket {bucket_name}")

    # 1. 現在の設定を保存
    try:
        current_config = s3.get_public_access_block(Bucket=bucket_name)
        original_config = json.dumps(
            current_config['PublicAccessBlockConfiguration']
        )
    except s3.exceptions.NoSuchPublicAccessBlockConfiguration:
        original_config = json.dumps({
            "BlockPublicAcls": False,
            "IgnorePublicAcls": False,
            "BlockPublicPolicy": False,
            "RestrictPublicBuckets": False,
        })

    # 2. タグに元の設定を保存 (復旧用)
    s3.put_bucket_tagging(
        Bucket=bucket_name,
        Tagging={
            'TagSet': [
                {'Key': 'IncidentId', 'Value': finding_id},
                {'Key': 'OriginalPublicAccessConfig', 'Value': original_config},
                {'Key': 'ContainedAt', 'Value': datetime.utcnow().isoformat()},
                {'Key': 'ContainedBy', 'Value': 'auto-containment-lambda'},
            ],
        },
    )

    # 3. パブリックアクセスを全てブロック
    s3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            'BlockPublicAcls': True,
            'IgnorePublicAcls': True,
            'BlockPublicPolicy': True,
            'RestrictPublicBuckets': True,
        },
    )

    # 4. ログ記録
    log_entry = {
        'action': 's3_public_access_blocked',
        'bucket': bucket_name,
        'finding_id': finding_id,
        'finding_type': finding_type,
        'original_config': original_config,
        'timestamp': datetime.utcnow().isoformat(),
    }
    logger.info(json.dumps(log_entry))

    # 5. セキュリティチームに通知
    sns.publish(
        TopicArn='arn:aws:sns:ap-northeast-1:123456:security-incidents',
        Subject=f'[AUTO] S3 Public Access Blocked: {bucket_name}',
        Message=json.dumps(log_entry, indent=2),
    )

    return {'statusCode': 200, 'body': log_entry}


def rollback_containment(bucket_name: str, incident_id: str) -> dict:
    """
    誤検知の場合のロールバック手順
    承認プロセスを経た上で実行する
    """
    s3 = boto3.client('s3')

    # タグから元の設定を取得
    tags = s3.get_bucket_tagging(Bucket=bucket_name)
    original_config = None
    for tag in tags['TagSet']:
        if tag['Key'] == 'OriginalPublicAccessConfig':
            original_config = json.loads(tag['Value'])
            break

    if not original_config:
        raise ValueError("Original configuration not found")

    # 元の設定に復元
    s3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration=original_config,
    )

    # インシデントタグを更新
    s3.put_bucket_tagging(
        Bucket=bucket_name,
        Tagging={
            'TagSet': [
                {'Key': 'IncidentId', 'Value': incident_id},
                {'Key': 'RolledBackAt', 'Value': datetime.utcnow().isoformat()},
                {'Key': 'Reason', 'Value': 'false_positive'},
            ],
        },
    )

    return {'status': 'rolled_back', 'bucket': bucket_name}
```
</details>

---

## 11. FAQ

### Q1. What is the minimum team composition for an incident response team?

For small organizations, a minimum of 3-4 people is sufficient: 1 IC (who also serves as Technical Lead), 1-2 Responders, and 1 Communications Lead. The key is to clearly define roles and secure emergency communication channels. Contracting an external CSIRT service (MDR: Managed Detection and Response) to supplement missing expertise is also effective. Even with a small team, maintaining well-prepared playbooks and conducting regular exercises will ensure response quality.

### Q2. When should forensic investigation be outsourced?

Consider outsourcing if any of the following apply:
- Legal proceedings are anticipated (lawsuits, law enforcement reporting) -- to ensure the legal validity of evidence
- The organization lacks internal forensic expertise
- Insider threat is suspected -- to eliminate the risk of evidence tampering by internal members
- The scale of the incident exceeds internal response capacity
- External investigation is required as a condition of cyber insurance coverage

### Q3. How much information should be disclosed after an incident?

If personal data has been breached, notification obligations apply under GDPR (within 72 hours) or applicable data protection laws. Beyond legal requirements, affected customers and partners should be informed honestly. Disclosures should include "what happened," "the scope of impact," "actions taken," and "future prevention measures." Technical details that could benefit the attacker (exploits used, internal network structure, etc.) should not be included. While transparency is important for maintaining trust, the scope of disclosure should be carefully determined in coordination with legal and PR teams.

### Q4. Should ransom be paid?

It is generally not recommended. Reasons: (1) There is no guarantee that data will be restored after payment, (2) It funds criminal organizations, (3) It increases the risk of repeat attacks, (4) In some countries, paying organizations on sanctions lists may be legally problematic. However, when human life is at risk or when backups have been completely lost, the decision should be made in consultation with legal counsel and executive leadership. Consulting the FBI or the relevant law enforcement cybercrime unit is also worth considering.

### Q5. How do you assess incident response maturity?

Evaluate based on the "Respond" category of the NIST Cybersecurity Framework (CSF) or the SANS Incident Response Maturity Model. Key evaluation indicators include: (1) trends in MTTD/MTTR, (2) playbook coverage rate, (3) frequency and results of exercises, (4) automation adoption rate, (5) post-mortem completion rate and action item completion rate.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Response Flow | 6-phase cycle: Preparation → Detection → Containment → Eradication → Recovery → Lessons Learned |
| Severity | Response SLAs ranging from SEV-1 (15 minutes) to SEV-4 (1 week) |
| CSIRT | Clear role definition: IC, Technical Lead, Communications Lead, Scribe |
| Containment | Network isolation → evidence preservation → scope confirmation |
| Forensics | Disk/memory imaging, Chain of Custody, timeline analysis |
| SOAR | Automated containment and playbook execution for faster response |
| Post-Mortem | Blameless approach, focused on root cause and recurrence prevention |
| Metrics | Continuous measurement and improvement of MTTD, MTTR, and MTTC |
| Exercises | Quarterly tabletop exercises, annual red team exercises |

---

## Further Reading

- [Monitoring/Logging](./01-monitoring-logging.md) -- Monitoring infrastructure underpinning incident detection
- [Compliance](./02-compliance.md) -- Legal obligations for incident reporting (GDPR 72-hour rule, etc.)
- [Security Culture](./03-security-culture.md) -- Organization-wide security awareness and DevSecOps
- Authentication and Authorization Basics -- Credential management after a breach
- [Cloud Security](../05-cloud-security/01-aws-security.md) -- Security response in AWS environments

---

## References

1. **NIST SP 800-61 Rev.2 -- Computer Security Incident Handling Guide** -- https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final
2. **SANS Incident Handler's Handbook** -- https://www.sans.org/white-papers/incident-handlers-handbook/
3. **PagerDuty Incident Response Documentation** -- https://response.pagerduty.com/
4. **Google SRE Book -- Managing Incidents** -- https://sre.google/sre-book/managing-incidents/
5. **MITRE ATT&CK Framework** -- https://attack.mitre.org/ -- Classification system for attacker tactics, techniques, and procedures (TTPs)
6. **IBM Cost of a Data Breach Report 2024** -- https://www.ibm.com/reports/data-breach
