# DevOps Overview

> A culture and practice system that integrates software Development (Dev) and Operations (Ops) to maximize the speed and reliability of value delivery

## What You Will Learn

1. Understand the cultural background of DevOps and its five principles (CALMS)
2. Learn how to measure performance using DORA metrics
3. Understand the DevOps adoption roadmap and anti-patterns
4. Learn how to apply the Three Ways principles in practice
5. Understand the relationship with Platform Engineering


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What is DevOps?

### 1.1 Historical Background

In traditional software development, development teams and operations teams worked in a siloed organizational structure. Development teams aimed to "ship new features quickly" while operations teams aimed to "keep systems stable," creating a structural conflict between the two.

```
Traditional waterfall release cycle:

Planning → Requirements → Design → Implementation → Testing → Release → Operations
 |                                                                |
 +--- Development team's scope ---+--- Operations team's scope ---+
                                  ^
                               "Over the wall"
                            (Wall of Confusion)
```

At the 2008 Agile Conference and 2009 DevOpsDays Ghent, Patrick Debois popularized the term "DevOps," sparking a movement to tear down the wall between development and operations.

### 1.2 DevOps Timeline

Organizing the evolution of DevOps into a timeline reveals that it has matured gradually in both technology and culture.

```
Year          Event                                              Significance
────────────────────────────────────────────────────────────────────
2001         Agile Manifesto published                          Foundation for iterative development
2006         Amazon "You build it, you run it"                  Expansion of developer responsibility
2008         Agile Conference (Agile Infrastructure)            Start of infrastructure automation discussion
2009         DevOpsDays Ghent (Patrick Debois)                  Birth of DevOps
2010         "Continuous Delivery" published (Humble & Farley)  Systematization of CI/CD
2011         "The Phoenix Project" writing begins               DevOps spread through fiction
2012         First State of DevOps Report                       Start of quantitative research
2013         Docker 1.0 released                                Container revolution
2014         Kubernetes announced (Google)                       Container orchestration
2015         SRE book published (Google)                        Systematization of SRE
2016         "DevOps Handbook" published                        Definitive practical guide
2018         "Accelerate" published                             Academic foundation for DORA metrics
2019         GitOps concept popularized (Weaveworks)            New paradigm of declarative operations
2020         Rise of Platform Engineering                        Internal developer platforms
2021         DevOps Handbook 2nd Edition                        Integration of latest practices
2022-        AI-Assisted DevOps / AIOps                         Operations optimization via machine learning
2024-        Platform as a Product                              Productization of platforms
```

### 1.3 Definition of DevOps

DevOps is not a single tool or job title, but a **culture, movement, and set of practices** that integrates the following elements.

```
+-----------------------------------------------------------+
|                   DevOps Overview                          |
+-----------------------------------------------------------+
|                                                           |
|   Culture                                                 |
|   +---------------------------------------------------+  |
|   | Automation                                         |  |
|   |   +---------------------------------------------+ |  |
|   |   | Measurement                                  | |  |
|   |   |   +---------------------------------------+ | |  |
|   |   |   | Sharing                                | | |  |
|   |   |   |   +-------------------------------+   | | |  |
|   |   |   |   | Lean                          |   | | |  |
|   |   |   |   +-------------------------------+   | | |  |
|   |   |   +---------------------------------------+ | |  |
|   |   +---------------------------------------------+ |  |
|   +---------------------------------------------------+  |
+-----------------------------------------------------------+
```

### 1.4 Relationship Between DevOps and Related Concepts

DevOps does not exist in isolation — it is closely related to multiple philosophies and methodologies.

```
                    ┌──────────────────┐
                    │   Lean Thinking  │
                    │  (Waste Elimination) │
                    └────────┬─────────┘
                             │ Influence
                    ┌────────▼─────────┐
                    │   Agile          │
                    │  (Iterative Dev) │
                    └────────┬─────────┘
                             │ Extension
              ┌──────────────▼──────────────┐
              │         DevOps              │
              │  (Dev+Ops Integrated Culture)│
              └──┬──────────┬───────────┬───┘
                 │          │           │
         ┌───────▼──┐ ┌────▼─────┐ ┌───▼──────────┐
         │  SRE     │ │ GitOps   │ │ Platform     │
         │(Reliability│ │(Declarative│ │ Engineering  │
         │Engineering)│ │Operations) │ │(Developer    │
         └──────────┘ └──────────┘ │ Platform)    │
                                   └──────────────┘
```

**Lean Thinking**: Originates from the Toyota Production System. Provides concepts of waste elimination, flow optimization, and continuous improvement (Kaizen).

**Agile**: Iterative development, customer feedback, and adaptation to change. DevOps extends Agile principles into the operations domain.

**SRE (Site Reliability Engineering)**: Pioneered by Google. Implements DevOps principles as concrete practices (error budgets, SLI/SLO/SLA, toil reduction).

**GitOps**: A methodology that uses a Git repository as the Single Source of Truth to declaratively manage infrastructure and applications.

**Platform Engineering**: An organizational approach that builds an Internal Developer Platform (IDP) to enable developer self-service.

---

## 2. The CALMS Framework

CALMS is the five pillars used to assess DevOps maturity.

### 2.1 Culture

Trust between teams, shared responsibility, and a willingness to learn from failure.

```yaml
# Culture example: Blameless Postmortem template
postmortem:
  title: "2024-01-15 API サーバーダウン"
  severity: SEV-1
  duration: "45 minutes"
  impact: "全ユーザーの API リクエストが失敗"
  timeline:
    - time: "14:00"
      event: "デプロイ実行"
    - time: "14:05"
      event: "エラーレート急上昇を検知"
    - time: "14:10"
      event: "ロールバック開始"
    - time: "14:45"
      event: "復旧確認"
  root_cause: "未テストの DB マイグレーションスクリプト"
  action_items:
    - "マイグレーションのステージング環境テスト必須化"
    - "カナリーデプロイの導入"
    - "DB マイグレーション専用の CI ジョブを追加"
  blame: "個人を責めない。プロセスを改善する。"
```

#### Practical Blameless Postmortem Template

```markdown
# インシデント振り返り: [タイトル]

## 基本情報
- **日時**: YYYY-MM-DD HH:MM - HH:MM (JST)
- **影響時間**: XX分
- **重大度**: SEV-1 / SEV-2 / SEV-3
- **対応リーダー**: @担当者名
- **参加者**: @チームメンバー

## 影響範囲
- 影響を受けたサービス:
- 影響を受けたユーザー数:
- SLO への影響:
- 推定損失額:

## タイムライン
| 時刻 | イベント | 担当者 |
|------|---------|--------|
| HH:MM | 最初の異常検知 | Monitoring |
| HH:MM | アラート発報 | PagerDuty |
| HH:MM | 対応開始 | @oncall |
| HH:MM | 根本原因特定 | @engineer |
| HH:MM | 修正適用 | @engineer |
| HH:MM | 復旧確認 | @oncall |

## 根本原因分析（5 Whys）
1. **なぜ** サービスがダウンした？ → DB 接続プールが枯渇した
2. **なぜ** 接続プールが枯渇した？ → 新デプロイでスロークエリが発生
3. **なぜ** スロークエリが発生した？ → N+1 問題のあるコードがデプロイされた
4. **なぜ** N+1 が検出されなかった？ → パフォーマンステストが CI に含まれていない
5. **なぜ** パフォーマンステストがない？ → テスト戦略にパフォーマンス観点が不足

## アクションアイテム
| 優先度 | アクション | 担当 | 期限 |
|--------|----------|------|------|
| P0 | スロークエリの修正 | @eng | 完了 |
| P1 | CI にパフォーマンステスト追加 | @team | 2週間 |
| P2 | DB 接続プール監視アラート追加 | @sre | 1週間 |
| P3 | テスト戦略ドキュメント更新 | @lead | 1ヶ月 |

## 教訓（What went well / What didn't）
### うまくいったこと
- アラートが5分以内に発報された
- ロールバック手順が整備されていた

### 改善が必要なこと
- パフォーマンス回帰の自動検出がない
- ステージング環境のデータ量が本番と乖離
```

#### Building Psychological Safety

The most important element in DevOps culture is Psychological Safety. Google's Project Aristotle research identified it as the top predictor of team performance.

```yaml
# 心理的安全性チェックリスト
psychological_safety:
  indicators:
    positive:
      - "チームメンバーが失敗を率直に報告できる"
      - "反対意見を安全に表明できる"
      - "わからないことを質問できる"
      - "実験や新しいアプローチを提案できる"
      - "インシデント報告が増加している（隠蔽されていない）"
    negative:
      - "問題を報告した人が責められる"
      - "失敗の隠蔽が発生する"
      - "チーム間の責任の押し付け合い"
      - "「前からそう言っていた」的な後出し批判"
      - "提案が却下されると二度と提案しなくなる"

  practices:
    daily:
      - "スタンドアップで障害・課題を共有"
      - "Slack で #incidents チャンネルに積極投稿"
    weekly:
      - "レトロスペクティブで改善提案"
      - "ペアプログラミング / モブプログラミング"
    monthly:
      - "Blameless Postmortem の実施"
      - "チーム健全性チェック"
    quarterly:
      - "心理的安全性サーベイ"
      - "DevOps 成熟度アセスメント"
```

### 2.2 Automation

Eliminate manual work to ensure reproducibility and speed.

```bash
#!/bin/bash
# 手動デプロイ vs 自動化デプロイの対比

# --- 手動デプロイ（アンチパターン）---
ssh production-server
cd /var/www/app
git pull origin main
npm install
npm run build
pm2 restart app
# 問題: 手順書依存、ヒューマンエラー、再現性なし

# --- 自動化デプロイ ---
# GitHub Actions が PR マージ時に自動実行
# 1. テスト → 2. ビルド → 3. コンテナ作成 → 4. デプロイ → 5. ヘルスチェック
# 全てコードで定義され、バージョン管理される
```

#### Automation Priority Matrix

A framework for deciding what to automate first.

```
Automation Priority = (Frequency × Manual Time × Error Risk) / Automation Cost

          High Frequency
            │
    ┌───────┼───────┐
    │Medium │ Highest│  ← Start here
    │Priority│Priority│
    ├───────┼───────┤
    │ Low   │Medium │
    │Priority│Priority│
    └───────┼───────┘
            │
          Low Frequency
     Short Time    Long Time
        Manual Time Required
```

#### Automation Checklist by Domain

```yaml
automation_checklist:
  must_automate:  # 最優先で自動化
    - name: "テスト実行"
      reason: "プッシュ/PR ごとに実行、手動だと1時間/回"
      tools: ["GitHub Actions", "Jest", "pytest"]

    - name: "コードリント・フォーマット"
      reason: "全コミットで実行、一貫性確保"
      tools: ["ESLint", "Prettier", "Black", "pre-commit"]

    - name: "ビルド・アーティファクト生成"
      reason: "リリースごとに実行、再現性必須"
      tools: ["Docker", "GitHub Actions", "Makefile"]

    - name: "デプロイ"
      reason: "日次〜週次で実行、ヒューマンエラー排除"
      tools: ["ArgoCD", "GitHub Actions", "Terraform"]

  should_automate:  # 次に自動化
    - name: "セキュリティスキャン"
      reason: "脆弱性の早期検出"
      tools: ["Trivy", "Snyk", "CodeQL"]

    - name: "依存関係更新"
      reason: "定期的なセキュリティパッチ適用"
      tools: ["Dependabot", "Renovate"]

    - name: "環境プロビジョニング"
      reason: "新環境構築の迅速化"
      tools: ["Terraform", "Pulumi", "CloudFormation"]

    - name: "ドキュメント生成"
      reason: "API ドキュメントの自動更新"
      tools: ["Swagger", "TypeDoc", "Sphinx"]

  consider_automating:  # 余裕があれば自動化
    - name: "リリースノート生成"
      tools: ["release-please", "semantic-release"]

    - name: "パフォーマンスベンチマーク"
      tools: ["k6", "Lighthouse CI"]

    - name: "コスト最適化レポート"
      tools: ["Infracost", "AWS Cost Explorer API"]
```

#### Full Automation Pipeline Overview

```yaml
# .github/workflows/full-pipeline.yml
name: Full CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ステージ1: 静的解析
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  # ステージ2: テスト（並列実行）
  test-unit:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-unit
          path: coverage/

  test-integration:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  # ステージ3: セキュリティスキャン
  security:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

  # ステージ4: ビルド
  build:
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration, security]
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ステージ5: デプロイ（main ブランチのみ）
  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          echo "Deploying ${{ github.sha }} to staging..."
          # kubectl set image deployment/app app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production (canary)
        run: |
          echo "Canary deploying ${{ github.sha }} to production..."
          # 10% のトラフィックを新バージョンに振り分け
```

### 2.3 Lean

Eliminate waste, reduce batch size, and optimize flow.

```
Relationship between batch size and risk:

Risk
  ^
  |        *
  |       *
  |      *
  |    *
  |  *
  | *
  +*-----------> Batch Size
  Small          Large

Small batch = Small risk = Fast feedback
```

#### The Seven Wastes of Lean (Software Development Edition)

Applying the seven wastes from the Toyota Production System to software development.

```
Manufacturing Waste          Software Development Waste         Solution
─────────────────────────────────────────────────────────────
1. Overproduction      →  Unnecessary feature development  → MVP, feature flags
2. Waiting             →  Approval wait, review wait       → Auto-approval, async review
3. Transportation      →  Team handoffs                    → Cross-functional teams
4. Over-processing     →  Excessive process/documentation  → Just-enough documentation
5. Inventory           →  Unreleased code                  → Continuous deploy, small batches
6. Motion              →  Tool switching, env setup        → Integrated dev environment, IDP
7. Defects             →  Bugs, rework                     → TDD, CI, automated testing
```

#### Value Stream Mapping

A technique for visualizing bottlenecks in the development process.

```
Value Stream Map Example: From Feature Request to Release

                Process Time    Wait Time
                ──────────    ──────
Requirements    2 days          3 days wait (approval wait)
    ↓
Design          1 day           2 days wait (review wait)
    ↓
Implementation  3 days          0.5 days wait (PR review wait)
    ↓
Code Review     0.5 days        1 day wait (fix wait)
    ↓
Testing         0.5 days        2 days wait (test env wait)
    ↓
Deploy          0.1 days        5 days wait (release window wait)
    ↓
Release confirm 0.2 days
────────────────────────────────
Total: Process time 7.3 days / Wait time 13.5 days
Lead time: 20.8 days
Process efficiency: 7.3 / 20.8 = 35%

Target after improvement:
Process time 5 days / Wait time 2 days
Lead time: 7 days
Process efficiency: 5 / 7 = 71%
```

### 2.4 Measurement

Improvement requires data. You cannot improve what you don't measure.

```python
# DORA メトリクス計測の実装例
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass
from enum import Enum

class PerformanceLevel(Enum):
    ELITE = "Elite"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

@dataclass
class Deployment:
    """デプロイメント情報"""
    id: str
    commit_sha: str
    commit_time: datetime
    deploy_time: datetime
    environment: str
    success: bool
    rollback: bool = False

@dataclass
class Incident:
    """インシデント情報"""
    id: str
    severity: str  # SEV-1, SEV-2, SEV-3
    started_at: datetime
    resolved_at: Optional[datetime]
    caused_by_deployment: Optional[str] = None

class DORAMetrics:
    """DORA メトリクスの計測と評価"""

    def __init__(self, deployments: List[Deployment], incidents: List[Incident]):
        self.deployments = deployments
        self.incidents = incidents

    def deployment_frequency(self, period_days: int = 30) -> Dict:
        """デプロイ頻度: どのくらいの頻度でデプロイするか"""
        prod_deploys = [
            d for d in self.deployments
            if d.environment == "production" and d.success
        ]
        freq = len(prod_deploys) / period_days

        if freq >= 1:
            level = PerformanceLevel.ELITE
            description = "1日複数回"
        elif freq >= 1/7:
            level = PerformanceLevel.HIGH
            description = "週1回〜日1回"
        elif freq >= 1/30:
            level = PerformanceLevel.MEDIUM
            description = "月1回〜週1回"
        else:
            level = PerformanceLevel.LOW
            description = "月1回未満"

        return {
            "metric": "Deployment Frequency",
            "value": f"{len(prod_deploys)} deploys / {period_days} days",
            "frequency_per_day": round(freq, 2),
            "level": level.value,
            "description": description,
        }

    def lead_time_for_changes(self) -> Dict:
        """変更リードタイム: コミットから本番デプロイまでの時間"""
        prod_deploys = [
            d for d in self.deployments
            if d.environment == "production" and d.success
        ]
        if not prod_deploys:
            return {"metric": "Lead Time for Changes", "error": "No deployments"}

        lead_times = [
            (d.deploy_time - d.commit_time).total_seconds()
            for d in prod_deploys
        ]
        median_seconds = sorted(lead_times)[len(lead_times) // 2]
        median_hours = median_seconds / 3600

        if median_hours < 1:
            level = PerformanceLevel.ELITE
            description = "1時間未満"
        elif median_hours < 24:
            level = PerformanceLevel.HIGH
            description = "1日未満"
        elif median_hours < 168:  # 7日
            level = PerformanceLevel.MEDIUM
            description = "1週間未満"
        else:
            level = PerformanceLevel.LOW
            description = "1週間超"

        return {
            "metric": "Lead Time for Changes",
            "median_hours": round(median_hours, 1),
            "level": level.value,
            "description": description,
        }

    def change_failure_rate(self) -> Dict:
        """変更障害率: デプロイの何%が障害を引き起こすか"""
        prod_deploys = [
            d for d in self.deployments
            if d.environment == "production"
        ]
        if not prod_deploys:
            return {"metric": "Change Failure Rate", "error": "No deployments"}

        failed = [d for d in prod_deploys if not d.success or d.rollback]
        rate = len(failed) / len(prod_deploys) * 100

        if rate <= 5:
            level = PerformanceLevel.ELITE
        elif rate <= 15:
            level = PerformanceLevel.HIGH
        elif rate <= 30:
            level = PerformanceLevel.MEDIUM
        else:
            level = PerformanceLevel.LOW

        return {
            "metric": "Change Failure Rate",
            "rate_percent": round(rate, 1),
            "failed_deploys": len(failed),
            "total_deploys": len(prod_deploys),
            "level": level.value,
        }

    def time_to_restore_service(self) -> Dict:
        """サービス復旧時間: 障害発生から復旧までの時間"""
        resolved = [i for i in self.incidents if i.resolved_at]
        if not resolved:
            return {"metric": "Time to Restore Service", "error": "No resolved incidents"}

        restore_times = [
            (i.resolved_at - i.started_at).total_seconds()
            for i in resolved
        ]
        median_seconds = sorted(restore_times)[len(restore_times) // 2]
        median_hours = median_seconds / 3600

        if median_hours < 1:
            level = PerformanceLevel.ELITE
        elif median_hours < 24:
            level = PerformanceLevel.HIGH
        elif median_hours < 168:
            level = PerformanceLevel.MEDIUM
        else:
            level = PerformanceLevel.LOW

        return {
            "metric": "Time to Restore Service",
            "median_hours": round(median_hours, 1),
            "level": level.value,
        }

    def generate_report(self) -> Dict:
        """全メトリクスのレポート生成"""
        return {
            "report_date": datetime.now().isoformat(),
            "metrics": {
                "deployment_frequency": self.deployment_frequency(),
                "lead_time": self.lead_time_for_changes(),
                "change_failure_rate": self.change_failure_rate(),
                "mttr": self.time_to_restore_service(),
            },
            "overall_level": self._calculate_overall_level(),
        }

    def _calculate_overall_level(self) -> str:
        """全体の成熟度レベルを算出"""
        levels = []
        for metric_func in [
            self.deployment_frequency,
            self.lead_time_for_changes,
            self.change_failure_rate,
            self.time_to_restore_service,
        ]:
            result = metric_func()
            if "level" in result:
                levels.append(result["level"])

        level_scores = {"Elite": 4, "High": 3, "Medium": 2, "Low": 1}
        if not levels:
            return "Unknown"
        avg = sum(level_scores.get(l, 0) for l in levels) / len(levels)
        if avg >= 3.5:
            return "Elite"
        elif avg >= 2.5:
            return "High"
        elif avg >= 1.5:
            return "Medium"
        else:
            return "Low"
```

#### Example DORA Metrics Dashboard Setup

```python
# Grafana ダッシュボード用の Prometheus メトリクス
from prometheus_client import Counter, Histogram, Gauge

# デプロイ頻度
deployment_counter = Counter(
    'deployments_total',
    'Total number of deployments',
    ['environment', 'status', 'team']
)

# 変更リードタイム
lead_time_histogram = Histogram(
    'deployment_lead_time_seconds',
    'Time from commit to production deployment',
    ['team'],
    buckets=[60, 300, 900, 3600, 14400, 43200, 86400, 604800]
    # 1分, 5分, 15分, 1時間, 4時間, 12時間, 1日, 1週間
)

# 変更障害率
change_failure_counter = Counter(
    'deployment_failures_total',
    'Deployments that caused failures',
    ['environment', 'team', 'failure_type']
)

# サービス復旧時間
restore_time_histogram = Histogram(
    'incident_restore_time_seconds',
    'Time to restore service after incident',
    ['severity', 'team'],
    buckets=[300, 900, 1800, 3600, 14400, 43200, 86400, 604800]
)

# 現在のパフォーマンスレベル（Gauge）
dora_level_gauge = Gauge(
    'dora_performance_level',
    'Current DORA performance level (1=Low, 4=Elite)',
    ['metric', 'team']
)
```

### 2.5 Sharing

Sharing knowledge, responsibility, and tools.

```yaml
# 共有のプラクティス例
sharing_practices:
  knowledge:
    - "ADR (Architecture Decision Records)"
    - "Runbook / Playbook"
    - "Tech Radar"
    - "内部テックブログ"
    - "Lunch & Learn セッション"
  responsibility:
    - "You build it, you run it"
    - "SRE のエラーバジェット"
    - "共同オンコール"
    - "ローテーション制度"
  tools:
    - "共通 CI/CD パイプライン"
    - "統一監視ダッシュボード"
    - "ChatOps (Slack + Bot)"
    - "内部開発者ポータル (Backstage)"
```

#### ADR (Architecture Decision Record) Template

```markdown
# ADR-0012: API ゲートウェイに Kong を採用

## ステータス
Accepted (2024-03-15)

## コンテキスト
マイクロサービスアーキテクチャへの移行に伴い、以下の要件を満たす
API ゲートウェイが必要:
- レート制限
- 認証・認可
- ルーティング
- ロードバランシング
- リクエスト/レスポンス変換

## 検討した選択肢
1. **Kong** - Lua ベース、豊富なプラグインエコシステム
2. **AWS API Gateway** - マネージド、AWS ロックイン
3. **Envoy + Istio** - サービスメッシュ統合、学習コスト高
4. **Nginx** - 軽量だがAPI管理機能が限定的

## 決定
Kong を採用する。

## 理由
- オープンソースで、ベンダーロックインを回避
- DB-less モードで GitOps との親和性が高い
- プラグインエコシステムが充実
- チーム内に Lua 経験者がいる
- Kubernetes Ingress Controller として統合可能

## 結果
- Kong を Kubernetes 上にデプロイ
- 設定は Git リポジトリで管理 (DB-less モード)
- カスタムプラグインの開発ガイドラインを策定
```

#### Runbook Template

```markdown
# Runbook: API レスポンスタイム劣化

## アラート条件
- P95 レスポンスタイムが 500ms を超過（5分間継続）
- Grafana アラート: `api_response_time_p95_high`

## 影響
- ユーザー体験の劣化
- タイムアウトによるエラー増加
- SLO 違反のリスク

## 診断手順

### Step 1: 現状確認
```bash
# Grafana ダッシュボードで確認
# URL: https://grafana.example.com/d/api-performance

# メトリクスを直接確認
kubectl top pods -n production
kubectl logs -f deployment/api-server -n production --tail=100
```

### Step 2: 原因の切り分け
```bash
# DB クエリの遅延確認
kubectl exec -it deployment/api-server -- \
  curl -s localhost:9090/metrics | grep db_query_duration

# 外部 API の遅延確認
kubectl exec -it deployment/api-server -- \
  curl -s localhost:9090/metrics | grep external_api_duration

# メモリ・CPU 使用率
kubectl top pods -n production --sort-by=memory
```

### Step 3: 対応
| 原因 | 対応 |
|------|------|
| DB スロークエリ | DB チームにエスカレーション |
| メモリリーク | Pod 再起動 + 調査 Issue 起票 |
| 外部 API 遅延 | サーキットブレーカー有効化 |
| トラフィック急増 | HPA スケールアウト確認 |
| 最近のデプロイ | ロールバック検討 |

### Step 4: エスカレーション
- 30分以内に解決しない場合: チームリーダーに連絡
- SEV-1 に該当する場合: インシデントコマンダーを招集
```

---

## 3. DORA Metrics in Depth

DORA (DevOps Research and Assessment) is a research program supported by Google Cloud that quantifies software delivery performance using four metrics.

### 3.1 Four Key Metrics Comparison

| Metric | Elite | High | Medium | Low |
|---|---|---|---|---|
| Deployment Frequency | On-demand (multiple times/day) | Weekly to monthly | Monthly to every 6 months | Less than every 6 months |
| Lead Time for Changes | Less than 1 hour | 1 day to 1 week | 1 week to 1 month | 1 month to 6 months |
| Change Failure Rate | 0–5% | 5–15% | 15–30% | Over 30% |
| Time to Restore Service | Less than 1 hour | Less than 1 day | 1 day to 1 week | Over 1 week |

### 3.2 The Fifth DORA Metric: Reliability

From the 2022 State of DevOps Report, "Reliability" was added as the fifth metric.

```yaml
reliability_metric:
  definition: "ユーザーの期待に対してサービスがどの程度応えているか"
  measurement:
    - "SLO の達成率"
    - "可用性（uptime）"
    - "エラーレート"
    - "レイテンシの一貫性"

  levels:
    elite:
      - "SLO 達成率 99.9% 以上"
      - "エラーバジェットを戦略的に活用"
      - "カオスエンジニアリングを実施"
    high:
      - "SLO 達成率 99.5% 以上"
      - "SLI/SLO が定義・監視されている"
    medium:
      - "SLO 達成率 99% 以上"
      - "基本的な監視は導入済み"
    low:
      - "SLO が未定義"
      - "可用性が不安定"
```

### 3.3 DevOps Maturity Model Comparison

| Level | Practices | Example Tools | Organizational Characteristics |
|---|---|---|---|
| Level 0: Manual | Manual deploy, manual testing | FTP, manual SSH | Siloed organization |
| Level 1: Partial Automation | CI adopted, some automated tests | Jenkins, basic scripts | Automation within dev team |
| Level 2: CI/CD | Full CI/CD, IaC adopted | GitHub Actions, Terraform | Cross-functional teams |
| Level 3: Continuous Improvement | Canary deploy, SLO | ArgoCD, Datadog | Platform teams |
| Level 4: Optimized | Chaos engineering, ML-Ops | Chaos Monkey, Feature Flags | Learning organization |

### 3.4 Automating Metric Collection

An example implementation of automatically collecting DORA metrics with GitHub Actions.

```yaml
# .github/workflows/dora-metrics.yml
name: DORA Metrics Collection

on:
  workflow_run:
    workflows: ["Deploy to Production"]
    types: [completed]
  schedule:
    - cron: '0 9 * * 1'  # 毎週月曜 9:00 にレポート生成

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 全履歴が必要

      - name: Calculate Deployment Frequency
        id: deploy-freq
        run: |
          # 過去30日のデプロイ数をカウント
          DEPLOYS=$(git log --oneline --since="30 days ago" \
            --grep="deploy\|release" --all | wc -l)
          FREQ=$(echo "scale=2; $DEPLOYS / 30" | bc)
          echo "deploys=$DEPLOYS" >> $GITHUB_OUTPUT
          echo "frequency=$FREQ" >> $GITHUB_OUTPUT
          echo "Deployment Frequency: $DEPLOYS deploys in 30 days ($FREQ/day)"

      - name: Calculate Lead Time
        id: lead-time
        run: |
          # 直近のデプロイのリードタイム（コミットからデプロイまで）を計算
          DEPLOY_TIME=$(date +%s)
          LAST_COMMIT=$(git log -1 --format=%ct HEAD)
          LEAD_TIME=$((DEPLOY_TIME - LAST_COMMIT))
          LEAD_TIME_HOURS=$((LEAD_TIME / 3600))
          echo "lead_time_hours=$LEAD_TIME_HOURS" >> $GITHUB_OUTPUT
          echo "Lead Time: ${LEAD_TIME_HOURS} hours"

      - name: Calculate Change Failure Rate
        id: cfr
        run: |
          # 過去30日のデプロイ中、ロールバックが発生した割合
          TOTAL=$(git log --oneline --since="30 days ago" \
            --grep="deploy" --all | wc -l)
          FAILURES=$(git log --oneline --since="30 days ago" \
            --grep="rollback\|hotfix\|revert" --all | wc -l)
          if [ "$TOTAL" -gt 0 ]; then
            CFR=$(echo "scale=1; $FAILURES * 100 / $TOTAL" | bc)
          else
            CFR=0
          fi
          echo "cfr=$CFR" >> $GITHUB_OUTPUT
          echo "Change Failure Rate: ${CFR}%"

      - name: Send to Monitoring
        run: |
          # Prometheus Pushgateway にメトリクスを送信
          cat <<METRICS | curl --data-binary @- \
            http://pushgateway.example.com/metrics/job/dora/team/backend
          # HELP dora_deployment_frequency Deployments per day
          # TYPE dora_deployment_frequency gauge
          dora_deployment_frequency ${{ steps.deploy-freq.outputs.frequency }}
          # HELP dora_lead_time_hours Lead time in hours
          # TYPE dora_lead_time_hours gauge
          dora_lead_time_hours ${{ steps.lead-time.outputs.lead_time_hours }}
          # HELP dora_change_failure_rate Change failure rate percentage
          # TYPE dora_change_failure_rate gauge
          dora_change_failure_rate ${{ steps.cfr.outputs.cfr }}
          METRICS
```

---

## 4. The DevOps Infinite Loop

```
          Plan → Code → Build → Test
         ↗                           ↘
    Monitor                           Release
         ↖                           ↙
          Operate ← Deploy ← Stage

+--------------------------------------------------+
|              DevOps ∞ Loop                         |
|                                                    |
|   ┌─────────── Dev ──────────┐                    |
|   │  Plan → Code → Build → Test                  |
|   │  ↑                       │                    |
|   │  │    ┌── Feedback ──┐   ↓                    |
|   │  │    │              │  Release                |
|   │  │    │              │   │                    |
|   │  │    ↓              │   ↓                    |
|   │  Monitor ← Operate ← Deploy                  |
|   │  └─────────── Ops ──────────┘                 |
|   └──────────────────────────────┘                |
+--------------------------------------------------+
```

### 4.1 Each Phase in Detail with Recommended Tools

```yaml
devops_loop_phases:
  plan:
    description: "Requirements definition, backlog management, sprint planning"
    tools:
      - name: "Jira"
        use_case: "大規模プロジェクトのバックログ管理"
      - name: "GitHub Issues + Projects"
        use_case: "軽量なタスク管理、開発ワークフロー統合"
      - name: "Linear"
        use_case: "モダンなプロジェクト管理、高速UI"
    practices:
      - "ユーザーストーリーマッピング"
      - "OKR によるゴール設定"
      - "技術的負債のバックログ化"

  code:
    description: "Development, code review, branch management"
    tools:
      - name: "GitHub"
        use_case: "ソースコード管理、PR レビュー"
      - name: "VS Code / Cursor"
        use_case: "統合開発環境、AI アシスタント"
      - name: "pre-commit"
        use_case: "コミット前の品質チェック"
    practices:
      - "Trunk-Based Development"
      - "ペアプログラミング / モブプログラミング"
      - "Feature Flags による開発"

  build:
    description: "Compilation, packaging, container image creation"
    tools:
      - name: "Docker"
        use_case: "コンテナイメージのビルド"
      - name: "GitHub Actions"
        use_case: "CI パイプラインの実行"
      - name: "Buildpack"
        use_case: "Dockerfile 不要のビルド"
    practices:
      - "マルチステージビルド"
      - "ビルドキャッシュの活用"
      - "再現可能なビルド"

  test:
    description: "Automated testing, quality gates, security scanning"
    tools:
      - name: "Jest / Vitest"
        use_case: "ユニットテスト"
      - name: "Playwright / Cypress"
        use_case: "E2E テスト"
      - name: "Trivy / Snyk"
        use_case: "セキュリティスキャン"
    practices:
      - "テストピラミッド（Unit > Integration > E2E）"
      - "品質ゲートの定義"
      - "Shift-Left テスティング"

  release:
    description: "Versioning, release notes, artifact management"
    tools:
      - name: "semantic-release"
        use_case: "自動バージョニング"
      - name: "release-please"
        use_case: "リリース PR の自動作成"
      - name: "GitHub Releases"
        use_case: "リリースノートの管理"
    practices:
      - "Semantic Versioning (SemVer)"
      - "Conventional Commits"
      - "リリースブランチ戦略"

  deploy:
    description: "Production deploy, canary, blue-green"
    tools:
      - name: "ArgoCD"
        use_case: "Kubernetes GitOps デプロイ"
      - name: "Helm"
        use_case: "Kubernetes パッケージ管理"
      - name: "Terraform"
        use_case: "インフラストラクチャプロビジョニング"
    practices:
      - "カナリーデプロイ"
      - "ブルーグリーンデプロイ"
      - "ローリングアップデート"

  operate:
    description: "Incident management, scaling, configuration management"
    tools:
      - name: "PagerDuty"
        use_case: "オンコール管理、インシデント対応"
      - name: "Kubernetes"
        use_case: "コンテナオーケストレーション"
      - name: "Vault"
        use_case: "シークレット管理"
    practices:
      - "インシデント対応プロセス"
      - "自動スケーリング"
      - "カオスエンジニアリング"

  monitor:
    description: "Metrics collection, log analysis, tracing"
    tools:
      - name: "Datadog / Grafana"
        use_case: "メトリクスダッシュボード"
      - name: "OpenTelemetry"
        use_case: "分散トレーシング"
      - name: "Loki / Elasticsearch"
        use_case: "ログ集約・検索"
    practices:
      - "SLI / SLO / SLA の定義"
      - "アラートの階層化"
      - "ダッシュボードの標準化"
```

---

## 5. The Three Ways

The foundational DevOps principles proposed by Gene Kim in "The Phoenix Project."

```
First Way: Flow (Systems Thinking)
  Dev → Ops → Customer
  Maximize flow from left to right

Second Way: Feedback
  Dev ← Ops ← Customer
  Maximize feedback from right to left

Third Way: Continuous Learning
  +---→ Experiment → Fail → Learn ---+
  |                                   |
  +---------- Repeat ←---------------+
  Take risks, iterate, and build mastery
```

### 5.1 First Way: The Principle of Flow

Optimize the performance of the entire system; avoid local optimizations.

```yaml
first_way_practices:
  principles:
    - "Limit WIP (Work in Progress)"
    - "Reduce batch size"
    - "Reduce handoffs"
    - "Identify and eliminate constraints"
    - "Eliminate waste"

  implementation:
    wip_limits:
      description: "Limit the number of simultaneous in-progress tasks"
      example:
        development: 3  # 開発中の機能は最大3つ
        code_review: 5  # レビュー待ちは最大5つ
        testing: 3      # テスト中は最大3つ
        deployment: 1   # デプロイは一度に1つ

    batch_size_reduction:
      before: "3ヶ月分の機能を一度にリリース"
      after: "毎日小さな変更をリリース"
      benefit: "Risk reduction, faster feedback"

    constraint_identification:
      tool: "Value Stream Mapping"
      steps:
        - "Visualize the current process"
        - "Identify wait times and bottlenecks"
        - "Execute measures to resolve constraints"
        - "Measure the effect of improvements"
```

### 5.2 Second Way: The Principle of Feedback

Build rapid feedback loops from right to left.

```yaml
second_way_practices:
  feedback_loops:
    immediate:  # Seconds to minutes
      - "Real-time error display in IDE"
      - "pre-commit hooks"
      - "Unit tests"
    short:  # Minutes to hours
      - "CI pipeline results"
      - "Code review comments"
      - "Security scan results"
    medium:  # Hours to days
      - "Test results in staging environment"
      - "Performance test results"
      - "User feedback (beta)"
    long:  # Days to weeks
      - "Production environment metrics"
      - "User behavior analytics"
      - "A/B test results"

  implementation:
    telemetry:
      - "Embed metrics, logs, and traces at all layers"
      - "Automatic alerting via anomaly detection"
    peer_review:
      - "Code review for all changes"
      - "Adopt pair programming"
    swarm:
      - "Whole team responds when problems arise"
      - "Prevent knowledge siloing"
```

### 5.3 Third Way: The Principle of Continuous Learning and Experimentation

Build a culture of learning and continuous improvement across the entire organization.

```yaml
third_way_practices:
  experimentation:
    - "Allocate 20% time (Google style)"
    - "Hold regular hackathons"
    - "Encourage PoC of new technologies"
    - "Foster a culture that tolerates failure"

  learning_from_failure:
    - "Rigorously practice Blameless Postmortems"
    - "Conduct Game Days (failure drills)"
    - "Chaos engineering"

  knowledge_sharing:
    - "Internal tech talks"
    - "Documentation culture"
    - "Mentoring programs"
    - "Encourage conference attendance"

  mastery:
    - "Build mastery through repetition"
    - "Daily improvement (Kaizen)"
    - "Write technical blog posts"
```

---

## 6. Platform Engineering

Platform Engineering is gaining attention as an evolution of DevOps.

### 6.1 Background

The DevOps principle of "You build it, you run it" has increased cognitive load on developers. As the domains developers need to manage — infrastructure, CI/CD, monitoring, security, and more — expanded too broadly, developers could no longer focus on their core development work.

```
DevOps Challenge (Increased Cognitive Load):

Things developers must manage:
┌──────────────────────────────────────────────┐
│ Application code                              │
│ Tests                                         │
│ CI/CD pipelines                               │
│ Containers (Dockerfile, Kubernetes manifests) │
│ Infrastructure (Terraform, CloudFormation)    │
│ Monitoring (Datadog, Grafana)                 │
│ Security (vulnerability scanning, secret mgmt)│
│ Cost management                               │
│ Compliance                                    │
└──────────────────────────────────────────────┘
         ↓ Cognitive load becomes excessive
         ↓
Solved by Platform Engineering
```

### 6.2 Internal Developer Platform (IDP)

```yaml
internal_developer_platform:
  definition: >
    An integrated platform that enables developers to use
    infrastructure and tools via self-service.
    The goal is to improve the developer experience (DX).

  components:
    developer_portal:
      tool: "Backstage (Spotify OSS)"
      features:
        - "Service catalog"
        - "Create new services from templates"
        - "Aggregated API documentation"
        - "Team information and ownership management"

    infrastructure_abstraction:
      tools: ["Crossplane", "Terraform Cloud", "Pulumi"]
      features:
        - "Self-service infrastructure provisioning"
        - "Guardrail-equipped environment creation"
        - "Cost visibility"

    ci_cd_platform:
      tools: ["GitHub Actions", "Dagger", "Tekton"]
      features:
        - "Standardized pipeline templates"
        - "Automatic security scanning"
        - "Deploy approval flow"

    observability_platform:
      tools: ["Grafana Stack", "Datadog", "OpenTelemetry"]
      features:
        - "Automatic instrumentation"
        - "Standard dashboards"
        - "Alert routing"

  golden_paths:
    description: >
      Templates that let developers work efficiently along recommended paths.
      It is important that these are recommendations, not mandates.
    examples:
      - "Template for a new API service"
      - "Template for a frontend application"
      - "Template for a data pipeline"
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Tool-First DevOps

```
Bad example:
  "We adopted Kubernetes, so we're doing DevOps"
  "We installed a CI/CD tool, so DevOps is done"

Problems:
  - Introducing tools without cultural transformation
  - Team silos remain intact
  - Tools become complex and reduce productivity instead

Improvement:
  1. Start with improving culture and processes first
  2. Begin with small automations
  3. Select tools as a means to solve specific problems
```

### Anti-Pattern 2: The DevOps Team Syndrome

```
Bad example:
  Creating a new "DevOps team" in the org chart,
  adding a third silo between the dev and ops teams

  Dev Team  →  DevOps Team  →  Ops Team
                (new wall)      (wall still exists)

Improvement:
  - DevOps is a culture, not a team name
  - Provide tools and foundations that improve
    developer experience (DX) as a Platform Engineering team
  - Follow the "You build it, you run it" principle
```

### Anti-Pattern 3: Improvement Without Measurement

```
Bad example:
  "It feels like it got faster somehow"
  "I think our deploy frequency went up"

Problems:
  - No basis for improvement
  - Cannot explain ROI
  - Cannot detect regression

Improvement:
  1. Measure a baseline with DORA metrics
  2. Quantitatively evaluate the effect of each improvement
  3. Visualize and share via dashboards
```

### Anti-Pattern 4: The Automation Trap

```
Bad example:
  - Trying to automate everything at once
  - Automating deployments without tests
  - Neglecting maintenance of automation scripts

Problems:
  - Breakage in automated processes goes undetected
  - Misconception that "automated = safe"
  - Maintenance cost exceeds the cost of doing it manually

Improvement:
  1. Automate incrementally (tests → build → deploy)
  2. Automation code itself is subject to testing and review
  3. Regularly check the health of the automation pipeline
```

### Anti-Pattern 5: Monolithic CI/CD Pipeline

```
Bad example:
  All services share one giant CI/CD pipeline
  A change to one service triggers tests and deploy for all services

Problems:
  - Pipeline execution time becomes massive
  - Another team's changes block your own team's deployments
  - Failures impact all services

Improvement:
  - Independent pipeline per service
  - Share common parts via Reusable Workflows
  - Selective execution based on change detection
```

---

## 8. DevOps Adoption Roadmap

### 8.1 Phase-Based Adoption Plan

```
Phase 0: Assess Current State (2 weeks)
├── Value Stream Mapping
├── Baseline measurement of DORA metrics
├── Team survey (understand culture and challenges)
└── Tool inventory

Phase 1: Quick Wins (1–3 months)
├── Unify version control (Git)
├── Introduce basic CI (lint + unit test)
├── Build automated builds
├── Unify chat tools (Slack/Teams)
└── Goal: Developers feel "this is more convenient"

Phase 2: Establish CI/CD (3–6 months)
├── Expand test automation (integration, E2E)
├── Build CD pipeline
├── Adopt Infrastructure as Code
├── Build monitoring and alerting foundation
└── Goal: Reduce manual work by 50%

Phase 3: Continuous Improvement (6–12 months)
├── Introduce canary deployments
├── Define SLI/SLO
├── Institutionalize Blameless Postmortems
├── Launch a platform team
└── Goal: Reach DORA metrics High level

Phase 4: Optimization (12+ months)
├── Introduce chaos engineering
├── Leverage feature flags
├── Build Internal Developer Platform
├── Explore AIOps
└── Goal: DORA metrics Elite level
```

### 8.2 Practical Advice for Organizational Transformation

```yaml
organizational_transformation:
  executive_support:
    why: "Cultural transformation is impossible without top-down support"
    how:
      - "Regular DORA report presentations to leadership"
      - "Quantify business contributions from DevOps"
      - "Share case studies from leading companies (Netflix, Amazon)"

  start_small:
    why: "Large-scale transformations tend to fail"
    how:
      - "Select a pilot team (a highly motivated team)"
      - "Accumulate small successes"
      - "Roll out success stories across the organization"

  measure_and_share:
    why: "No measurement, no improvement"
    how:
      - "Regularly measure DORA metrics"
      - "Visualize Before/After for each improvement initiative"
      - "Make dashboards publicly available to everyone"

  invest_in_people:
    why: "Investing in people matters more than investing in tools"
    how:
      - "Secure time for training and learning"
      - "Support conference attendance"
      - "Hold internal study sessions"
      - "Engage with external communities"
```

---

## 9. FAQ

### Q1: Is the job title "DevOps Engineer" correct?

DevOps is fundamentally a culture and set of practices, not a job title. However, the title "DevOps Engineer" has become established in the market. In practice, it often refers to engineers who handle infrastructure automation, CI/CD setup, and cloud operations. More accurate titles such as "Platform Engineer" and "SRE (Site Reliability Engineer)" are increasingly gaining traction.

### Q2: What is the difference between DevOps and SRE?

DevOps is a framework of culture and principles, while SRE is one concrete implementation of DevOps created by Google. SRE has more systematized practices including error budgets, SLI/SLO/SLA, and toil reduction. You can think of DevOps as describing "What" to do, and SRE as describing "How" to achieve it.

```
DevOps vs SRE Comparison:

Aspect         DevOps                     SRE
──────────────────────────────────────────────────
Origin         Community                  Google (from 2003)
Nature         Culture & principles       Concrete practices
Focus          Integration of Dev & Ops   Engineering approach to reliability
Failure        Blameless Culture          Error budgets
Work type      Drive automation           Toil reduction (50% rule)
Service quality Improve generally         Quantitatively managed via SLI/SLO/SLA
On-call        Shared responsibility      Engineers on rotation
Scaling        Varies by team             Sustainable via the 50% rule
```

### Q3: Is DevOps necessary for small teams?

Yes. In fact, small teams benefit most from automation. If a 5-person team spends 2 hours per week on manual deployments, that is a loss of 520 person-hours per year. If you can build CI/CD in a single day, that investment pays for itself within a week. The recommended approach is to start small and gradually increase maturity.

```yaml
# Small team DevOps starter kit
small_team_devops:
  day_1:
    - "GitHub リポジトリ作成"
    - "ブランチ保護ルール設定"
    - "基本的な CI ワークフロー（lint + test）"

  week_1:
    - "Docker 化"
    - "自動デプロイパイプライン"
    - "基本的な監視（uptime + エラーレート）"

  month_1:
    - "テストカバレッジの向上"
    - "ステージング環境の構築"
    - "インシデント対応プロセスの策定"

  tools_recommendation:
    vcs: "GitHub (Free tier)"
    ci_cd: "GitHub Actions (2,000分/月 無料)"
    monitoring: "Grafana Cloud (Free tier)"
    alerting: "PagerDuty (Free for up to 5 users)"
    infrastructure: "Terraform Cloud (Free tier)"
```

### Q4: How long does DevOps adoption take?

It depends on the size of the organization and its current maturity. A basic CI/CD pipeline can be built in a few days, but cultural transformation takes 6 months to 2 years. Reaching the DORA "Elite" level requires continuous, accumulated improvement. The key is to produce "Quick Wins" within 3 months to earn organizational trust.

### Q5: How do you explain DevOps ROI?

```python
# DevOps ROI 計算の例
def calculate_devops_roi():
    """DevOps 投資対効果の試算"""

    # 現状コスト（年間）
    current_costs = {
        "manual_deploy_hours": 5 * 52,         # 週5時間 × 52週 = 260時間
        "incident_response_hours": 10 * 52,     # 週10時間 × 52週 = 520時間
        "environment_setup_hours": 8 * 12,      # 月8時間 × 12ヶ月 = 96時間
        "manual_testing_hours": 20 * 52,        # 週20時間 × 52週 = 1040時間
        "hourly_engineer_cost": 5000,           # エンジニア時給(円)
        "downtime_cost_per_hour": 100000,       # ダウンタイムコスト(円/時間)
        "avg_downtime_hours_year": 48,          # 年間ダウンタイム
    }

    total_manual_hours = (
        current_costs["manual_deploy_hours"]
        + current_costs["incident_response_hours"]
        + current_costs["environment_setup_hours"]
        + current_costs["manual_testing_hours"]
    )

    current_labor_cost = total_manual_hours * current_costs["hourly_engineer_cost"]
    current_downtime_cost = (
        current_costs["avg_downtime_hours_year"]
        * current_costs["downtime_cost_per_hour"]
    )
    total_current_cost = current_labor_cost + current_downtime_cost

    # DevOps 導入後の予測
    devops_improvements = {
        "manual_work_reduction": 0.70,     # 手動作業70%削減
        "downtime_reduction": 0.60,        # ダウンタイム60%削減
        "deployment_frequency": 10,        # デプロイ頻度10倍
        "lead_time_reduction": 0.80,       # リードタイム80%短縮
    }

    investment = {
        "tooling_cost": 2000000,           # ツール費用(年間)
        "training_cost": 1000000,          # トレーニング費用
        "initial_setup_hours": 500,        # 初期構築工数
    }

    # ROI 計算
    savings_labor = current_labor_cost * devops_improvements["manual_work_reduction"]
    savings_downtime = current_downtime_cost * devops_improvements["downtime_reduction"]
    total_savings = savings_labor + savings_downtime

    total_investment = (
        investment["tooling_cost"]
        + investment["training_cost"]
        + investment["initial_setup_hours"] * current_costs["hourly_engineer_cost"]
    )

    roi = (total_savings - total_investment) / total_investment * 100

    return {
        "current_annual_cost": f"{total_current_cost:,}円",
        "annual_savings": f"{total_savings:,}円",
        "total_investment": f"{total_investment:,}円",
        "roi_percent": f"{roi:.1f}%",
        "payback_months": round(total_investment / (total_savings / 12), 1),
    }
```

### Q6: What is the relationship between DevOps and Agile?

Agile focuses on improving the development process, while DevOps extends those principles through delivery and operations. DevOps cannot work without Agile, but Agile alone is not sufficient. The two are complementary.

```
Agile:  Requirements → Design → Implementation → Test  [Iterate]
                 ↓ Extends into
DevOps: Requirements → Design → Implementation → Test → Deploy → Operate → Monitor  [Iterate]
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|---|---|
| Essence of DevOps | An integrated system of culture, practices, and tools |
| CALMS | Culture, Automation, Lean, Measurement, Sharing |
| DORA Metrics | Deployment frequency, lead time for changes, change failure rate, time to restore service (+ reliability) |
| Three Ways | Flow, Feedback, Continuous Learning |
| Platform Engineering | An evolved form that reduces cognitive load and improves developer experience |
| Most Important Principle | Culture over tools, measure and improve, start small |
| Anti-Patterns | Tool-first, DevOps team syndrome, improvement without measurement, automation trap |

---

## Guides to Read Next

- [CI/CD Concepts](./01-ci-cd-concepts.md) -- Deep dive into CI/CD, the core DevOps practice
- [Infrastructure as Code](./02-infrastructure-as-code.md) -- Concrete methods for infrastructure automation
- [GitOps](./03-gitops.md) -- Declarative management of infrastructure and applications
- [Observability](../03-monitoring/00-observability.md) -- Measurement and monitoring in practice

---

## References

1. Gene Kim, Jez Humble, Patrick Debois, John Willis. *The DevOps Handbook*, 2nd Edition. IT Revolution Press, 2021.
2. Nicole Forsgren, Jez Humble, Gene Kim. *Accelerate: The Science of Lean Software and DevOps*. IT Revolution Press, 2018.
3. Google Cloud. "DORA | DevOps Research and Assessment." https://dora.dev/
4. Gene Kim. *The Phoenix Project: A Novel about IT, DevOps, and Helping Your Business Win*. IT Revolution Press, 2013.
5. Atlassian. "DevOps: Breaking the Development-Operations barrier." https://www.atlassian.com/devops
6. Team Topologies. Matthew Skelton, Manuel Pais. IT Revolution Press, 2019.
7. Backstage. "An open platform for building developer portals." https://backstage.io/
8. Google. "Site Reliability Engineering." https://sre.google/
9. CNCF. "Cloud Native Landscape." https://landscape.cncf.io/
10. State of DevOps Report 2023. DORA / Google Cloud.
