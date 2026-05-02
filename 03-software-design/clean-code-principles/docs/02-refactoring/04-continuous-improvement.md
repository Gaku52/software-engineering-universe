# Continuous Improvement

> A methodology for achieving continuous improvement of software quality through CI/CD pipelines, automated quality gates, and feedback loops. Improvement is not a one-time event but a process embedded in daily work. This guide integrates Toyota's "Kaizen" production system, Lean Software Development's "Build-Measure-Learn," and Google's SRE practices to provide a systematic framework for engineering organizations to sustainably improve quality.

## Prerequisites

| Topic | Required Level | Reference Guide |
|---------|----------|-----------|
| Testing Principles | Basic | [Testing Principles](../01-practices/04-testing-principles.md) |
| Technical Debt | Basic | [Technical Debt](./03-technical-debt.md) |
| Refactoring Techniques | Recommended | [Refactoring Techniques](./01-refactoring-techniques.md) |
| Code Smells | Recommended | [Code Smells](./00-code-smells.md) |
| Legacy Code | Recommended | [Legacy Code](./02-legacy-code.md) |

## What You Will Learn

1. **Quality Gate Design for CI/CD Pipelines** -- Automation of lint, tests, coverage, and security scanning with staged gate configuration
2. **Team Performance Measurement with DORA Metrics** -- The four indicators (deployment frequency, lead time, change failure rate, time to restore) and benchmarks
3. **Visualization and Trend Analysis of Quality Metrics** -- Dashboard construction, degradation detection, and quantitative evaluation of improvement impact
4. **Improvement Processes via PDCA/OODA Cycles** -- Iterative cycles of planning, execution, verification, and embedding, plus retrospectives
5. **Improvement as Team Culture** -- Psychological safety, experimental improvement, the Boy Scout Rule, and learning organizations

---

## 1. Quality Gates in CI/CD Pipelines

### 1.1 Overall Pipeline Architecture

```
Quality Gate Architecture for CI/CD Pipelines

  Developer
     |
     v
  [git push / PR]
     |
     v
  ┌─────────────────────────────────────────────────────┐
  │  Stage 1: Fast Feedback (< 2 min)                    │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
  │  │ Lint     │  │ Format   │  │ Type     │          │
  │  │ (Ruff)   │  │ (Black)  │  │ Check    │          │
  │  │          │  │          │  │ (MyPy)   │          │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
  │       └──────────┬───┘            │                 │
  │                  v                v                 │
  │            [All pass?] ──No──> Block PR             │
  │                  │Yes                               │
  │                  v                                  │
  ├─────────────────────────────────────────────────────┤
  │  Stage 2: Core Verification (< 5 min)                │
  │  ┌──────────┐  ┌──────────┐                         │
  │  │ Unit     │  │ Coverage │                         │
  │  │ Tests    │  │ Check    │                         │
  │  │          │  │ (≥80%)   │                         │
  │  └────┬─────┘  └────┬─────┘                         │
  │       └──────┬───────┘                              │
  │              v                                      │
  │        [All pass?] ──No──> Block PR                 │
  │              │Yes                                   │
  │              v                                      │
  ├─────────────────────────────────────────────────────┤
  │  Stage 3: Extended Verification (< 10 min)           │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
  │  │ Integ.   │  │ Security │  │ Dep.     │          │
  │  │ Tests    │  │ Scan     │  │ Audit    │          │
  │  │          │  │ (Bandit) │  │ (Safety) │          │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
  │       └──────────┬───┘            │                 │
  │                  v                v                 │
  │            [All pass?] ──No──> Block PR             │
  │                  │Yes                               │
  │                  v                                  │
  ├─────────────────────────────────────────────────────┤
  │  Stage 4: Build & Deploy                             │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
  │  │ Build    │  │ Deploy   │  │ E2E      │          │
  │  │          │  │ Staging  │  │ Tests    │          │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
  │       └──────────┬───┘            │                 │
  │                  v                v                 │
  │            [All pass?] ──No──> Halt Deploy          │
  │                  │Yes                               │
  │                  v                                  │
  ├─────────────────────────────────────────────────────┤
  │  Stage 5: Production                                 │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
  │  │ Deploy   │  │ Smoke    │  │ Monitor  │          │
  │  │ Prod     │  │ Tests    │  │ & Alert  │          │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
  │       │              │              │               │
  │       │        [Fail?]──Yes──> Auto Rollback        │
  │       │              │No                            │
  │       v              v                              │
  │       ✓ Deploy Complete                             │
  └─────────────────────────────────────────────────────┘

  Design Principles:
  - Fast Feedback First: Run lightweight checks first (90% of failures caught in the first 2 minutes)
  - Fail Fast: Skip subsequent stages immediately upon failure
  - Parallel Execution: Run independent checks in parallel
  - Progressive Confidence: Each stage increases confidence level
```

### 1.2 GitHub Actions Implementation

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

# Cancel in-progress workflows on the same PR
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ===== Stage 1: Fast Feedback =====
  lint-and-format:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install dependencies
        run: pip install -r requirements-dev.txt

      - name: Ruff (Lint + Format)
        run: |
          ruff check src/ tests/
          ruff format --check src/ tests/

      - name: MyPy (Type Check)
        run: mypy src/ --strict

  # ===== Stage 2: Core Verification =====
  unit-tests:
    needs: lint-and-format
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      matrix:
        python-version: ['3.11', '3.12']
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'

      - name: Install dependencies
        run: pip install -r requirements.txt -r requirements-dev.txt

      - name: Unit Tests with Coverage
        run: |
          pytest tests/unit/ \
            --cov=src \
            --cov-report=xml \
            --cov-report=term-missing \
            --cov-fail-under=80 \
            --junitxml=test-results.xml \
            -x -q \
            --timeout=30

      - name: Upload Coverage to Codecov
        if: matrix.python-version == '3.12'
        uses: codecov/codecov-action@v4
        with:
          file: coverage.xml
          fail_ci_if_error: true
          token: ${{ secrets.CODECOV_TOKEN }}

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.python-version }}
          path: test-results.xml

  # ===== Stage 3: Extended Verification =====
  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install dependencies
        run: pip install -r requirements.txt -r requirements-dev.txt

      - name: Integration Tests
        env:
          DATABASE_URL: postgresql://postgres:test_password@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: pytest tests/integration/ -v --timeout=60

  security-scan:
    needs: unit-tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install -r requirements.txt bandit safety

      - name: Bandit (SAST)
        run: bandit -r src/ -f json -o bandit-report.json -ll
        continue-on-error: true

      - name: Safety (Dependency Vulnerabilities)
        run: safety check --json --output safety-report.json

      - name: Upload Security Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: security-reports
          path: |
            bandit-report.json
            safety-report.json

  # ===== Stage 4: Build =====
  build:
    needs: [integration-tests, security-scan]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker Image
        run: |
          docker build \
            --tag ${{ github.repository }}:${{ github.sha }} \
            --label "org.opencontainers.image.revision=${{ github.sha }}" \
            .

      - name: Trivy Vulnerability Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ github.repository }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
```

### 1.3 pre-commit Configuration

```yaml
# .pre-commit-config.yaml
# Quality checks for local development (pre-CI stage)
repos:
  # Ruff: Lint + Format (Python)
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
      - id: ruff-format

  # MyPy: Type Check
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
        additional_dependencies: [types-requests, types-pyyaml]
        args: [--strict]

  # General checks
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-toml
      - id: check-json
      - id: check-added-large-files
        args: ['--maxkb=500']
      - id: detect-private-key
      - id: check-merge-conflict
      - id: no-commit-to-branch
        args: [--branch, main, --branch, master]

  # Commit message conventions
  - repo: https://github.com/compilerla/conventional-pre-commit
    rev: v3.1.0
    hooks:
      - id: conventional-pre-commit
        stages: [commit-msg]
        args: [feat, fix, refactor, docs, test, chore, ci, perf]

  # Security
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

### 1.4 Phased Introduction of Quality Gates

```
Phased Quality Gate Introduction Roadmap

Phase 1 (Week 1-2): Basic Gates
  ┌────────────────────────────────────────┐
  │  [Warning Only]                         │
  │  - Lint (Ruff)                         │
  │  - Format (Black/Ruff)                 │
  │  - Basic test execution                │
  │                                        │
  │  Goal: Team familiarity, understand     │
  │        existing codebase               │
  └────────────────────────────────────────┘

Phase 2 (Week 3-4): Blocking Gates
  ┌────────────────────────────────────────┐
  │  [Blocking]                             │
  │  - Lint errors → Block PR              │
  │  - Test failures → Block PR            │
  │                                        │
  │  [Warning]                              │
  │  - Coverage reporting                  │
  │  - Type check                          │
  │                                        │
  │  Goal: Minimum quality assurance       │
  └────────────────────────────────────────┘

Phase 3 (Month 2): Quality Hardening
  ┌────────────────────────────────────────┐
  │  [Blocking]                             │
  │  - Lint + Format                       │
  │  - All tests pass                      │
  │  - Coverage ≥ 70%                      │
  │  - Type check                          │
  │                                        │
  │  [Warning]                              │
  │  - Security scan                       │
  │  - Dependency audit                    │
  │                                        │
  │  Goal: Moderate quality assurance      │
  └────────────────────────────────────────┘

Phase 4 (Month 3+): Full Gates
  ┌────────────────────────────────────────┐
  │  [Blocking]                             │
  │  - Lint + Format + Type Check          │
  │  - All unit tests pass                 │
  │  - All integration tests pass          │
  │  - Coverage ≥ 80%                      │
  │  - Security scan (Critical/High)       │
  │  - Known dependency vulnerabilities = 0│
  │                                        │
  │  Goal: High quality assurance          │
  └────────────────────────────────────────┘
```

---

## 2. DORA Metrics

### 2.1 The Four Key Indicators

DORA (DevOps Research and Assessment) metrics are four key indicators of software delivery performance based on large-scale research conducted since 2014:

```
DORA Metrics: Four Indicators and Benchmarks

┌─────────────────────────┬─────────────────────────┐
│  1. Deployment Frequency │  2. Lead Time            │
│                          │  (Lead Time for Changes) │
│                          │                         │
│  "How often do you       │  "How long from commit   │
│   deploy to production?" │   to production deploy?" │
│                          │                         │
│  Elite: Multiple/day     │  Elite: < 1 hour         │
│  High:  Daily ~ Weekly   │  High:  < 1 day          │
│  Med:   Weekly ~ Monthly │  Med:   < 1 week         │
│  Low:   Monthly or less  │  Low:   > 1 month        │
│                          │                         │
│  [Throughput metric]     │  [Throughput metric]     │
├─────────────────────────┼─────────────────────────┤
│  3. Change Failure Rate  │  4. Time to Restore      │
│                          │                         │
│  "What % of deploys      │  "How long to recover    │
│   cause incidents?"      │   from an incident?"    │
│                          │                         │
│  Elite: < 5%             │  Elite: < 1 hour         │
│  High:  < 15%            │  High:  < 1 day          │
│  Med:   < 30%            │  Med:   < 1 week         │
│  Low:   > 30%            │  Low:   > 1 month        │
│                          │                         │
│  [Stability metric]      │  [Stability metric]      │
└─────────────────────────┴─────────────────────────┘

Key Findings (Accelerate research):
  Elite performers compared to Low performers:
    - 973x higher deployment frequency
    - 6570x shorter lead time
    - 6570x shorter time to restore
    - 3x lower change failure rate
  Throughput and stability are not a trade-off; they go together
```

### 2.2 Metrics Collection and Automation

```python
"""DORA metrics collection framework"""
import subprocess
import json
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DORAMetrics:
    """Data model for DORA metrics"""
    # Measurement period
    period_start: datetime
    period_end: datetime

    # 1. Deployment frequency
    deploy_count: int = 0
    deploy_frequency_per_day: float = 0.0

    # 2. Lead time
    lead_times_hours: list[float] = field(default_factory=list)

    # 3. Change failure rate
    total_changes: int = 0
    failed_changes: int = 0

    # 4. Time to restore
    restore_times_hours: list[float] = field(default_factory=list)

    @property
    def period_days(self) -> int:
        return (self.period_end - self.period_start).days

    @property
    def avg_lead_time_hours(self) -> float:
        if not self.lead_times_hours:
            return 0.0
        return sum(self.lead_times_hours) / len(self.lead_times_hours)

    @property
    def median_lead_time_hours(self) -> float:
        if not self.lead_times_hours:
            return 0.0
        sorted_times = sorted(self.lead_times_hours)
        n = len(sorted_times)
        if n % 2 == 0:
            return (sorted_times[n // 2 - 1] + sorted_times[n // 2]) / 2
        return sorted_times[n // 2]

    @property
    def change_failure_rate(self) -> float:
        if self.total_changes == 0:
            return 0.0
        return (self.failed_changes / self.total_changes) * 100

    @property
    def avg_restore_time_hours(self) -> float:
        if not self.restore_times_hours:
            return 0.0
        return sum(self.restore_times_hours) / len(self.restore_times_hours)

    def classify(self, metric: str) -> str:
        """Determine the performance level for a metric"""
        classifications = {
            "deploy_frequency": [
                (1.0, "Elite"),    # Daily or more
                (0.14, "High"),    # Weekly or more
                (0.03, "Medium"),  # Monthly or more
                (0.0, "Low"),
            ],
            "lead_time": [
                (1.0, "Elite"),    # Within 1 hour
                (24.0, "High"),    # Within 1 day
                (168.0, "Medium"), # Within 1 week
                (float("inf"), "Low"),
            ],
            "change_failure_rate": [
                (5.0, "Elite"),
                (15.0, "High"),
                (30.0, "Medium"),
                (float("inf"), "Low"),
            ],
            "restore_time": [
                (1.0, "Elite"),
                (24.0, "High"),
                (168.0, "Medium"),
                (float("inf"), "Low"),
            ],
        }

        if metric == "deploy_frequency":
            value = self.deploy_frequency_per_day
            for threshold, level in classifications[metric]:
                if value >= threshold:
                    return level
        elif metric == "lead_time":
            value = self.median_lead_time_hours
            for threshold, level in classifications[metric]:
                if value <= threshold:
                    return level
        elif metric == "change_failure_rate":
            value = self.change_failure_rate
            for threshold, level in classifications[metric]:
                if value <= threshold:
                    return level
        elif metric == "restore_time":
            value = self.avg_restore_time_hours
            for threshold, level in classifications[metric]:
                if value <= threshold:
                    return level

        return "Low"

    @property
    def overall_level(self) -> str:
        """Overall performance level"""
        levels = {
            "Elite": 4, "High": 3, "Medium": 2, "Low": 1
        }
        metrics = [
            self.classify("deploy_frequency"),
            self.classify("lead_time"),
            self.classify("change_failure_rate"),
            self.classify("restore_time"),
        ]
        avg_score = sum(levels[m] for m in metrics) / len(metrics)

        if avg_score >= 3.5: return "Elite"
        elif avg_score >= 2.5: return "High"
        elif avg_score >= 1.5: return "Medium"
        else: return "Low"


def collect_dora_metrics(
    repo_path: str,
    days: int = 30,
    deploy_tag_pattern: str = "v*"
) -> DORAMetrics:
    """Collect DORA metrics from Git + GitHub CLI"""
    end = datetime.now()
    start = end - timedelta(days=days)
    since = start.isoformat()

    metrics = DORAMetrics(period_start=start, period_end=end)

    # 1. Deployment frequency (tag-based)
    result = subprocess.run(
        ["git", "tag", "-l", deploy_tag_pattern, "--sort=-creatordate",
         "--format=%(creatordate:iso)"],
        capture_output=True, text=True, cwd=repo_path
    )
    deploy_dates = []
    for line in result.stdout.strip().split("\n"):
        if line:
            try:
                dt = datetime.fromisoformat(line.strip().split("+")[0].strip())
                if dt >= start:
                    deploy_dates.append(dt)
            except ValueError:
                continue

    metrics.deploy_count = len(deploy_dates)
    metrics.deploy_frequency_per_day = metrics.deploy_count / max(days, 1)

    # 2. Lead time (PR creation to merge)
    try:
        result = subprocess.run(
            ["gh", "pr", "list", "--state", "merged", "--limit", "100",
             "--json", "createdAt,mergedAt"],
            capture_output=True, text=True, cwd=repo_path, timeout=30
        )
        if result.returncode == 0:
            prs = json.loads(result.stdout)
            for pr in prs:
                created = datetime.fromisoformat(pr["createdAt"].replace("Z", "+00:00"))
                merged = datetime.fromisoformat(pr["mergedAt"].replace("Z", "+00:00"))
                if created >= start.replace(tzinfo=created.tzinfo):
                    lead_time = (merged - created).total_seconds() / 3600
                    metrics.lead_times_hours.append(lead_time)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 3. Change failure rate (ratio of revert/hotfix commits)
    result = subprocess.run(
        ["git", "log", "--oneline", "--since", since],
        capture_output=True, text=True, cwd=repo_path
    )
    all_commits = [
        line for line in result.stdout.strip().split("\n") if line
    ]
    metrics.total_changes = len(all_commits)

    result = subprocess.run(
        ["git", "log", "--oneline", "--since", since,
         "--grep=revert\\|hotfix\\|rollback", "-i"],
        capture_output=True, text=True, cwd=repo_path
    )
    failed_commits = [
        line for line in result.stdout.strip().split("\n") if line
    ]
    metrics.failed_changes = len(failed_commits)

    return metrics


def print_dora_dashboard(metrics: DORAMetrics) -> None:
    """DORA metrics dashboard"""
    width = 64
    print("=" * width)
    print("  DORA Metrics Dashboard".center(width))
    print(f"  Period: {metrics.period_start.strftime('%Y-%m-%d')} "
          f"~ {metrics.period_end.strftime('%Y-%m-%d')} "
          f"({metrics.period_days} days)".center(width))
    print("=" * width)

    # Deployment frequency
    level = metrics.classify("deploy_frequency")
    print(f"\n  [1] Deployment Frequency")
    print(f"      Count: {metrics.deploy_count}")
    print(f"      Frequency: {metrics.deploy_frequency_per_day:.2f} /day")
    print(f"      Level: {level}")

    # Lead time
    level = metrics.classify("lead_time")
    print(f"\n  [2] Lead Time (PR creation → merge)")
    print(f"      Average: {metrics.avg_lead_time_hours:.1f} hours")
    print(f"      Median: {metrics.median_lead_time_hours:.1f} hours")
    print(f"      Level: {level}")

    # Change failure rate
    level = metrics.classify("change_failure_rate")
    print(f"\n  [3] Change Failure Rate")
    print(f"      Total changes: {metrics.total_changes}")
    print(f"      Failures: {metrics.failed_changes}")
    print(f"      Failure rate: {metrics.change_failure_rate:.1f}%")
    print(f"      Level: {level}")

    # Time to restore
    level = metrics.classify("restore_time")
    print(f"\n  [4] Time to Restore")
    print(f"      Average: {metrics.avg_restore_time_hours:.1f} hours")
    print(f"      Level: {level}")

    # Overall
    print(f"\n" + "-" * width)
    overall = metrics.overall_level
    print(f"  Overall Performance: {overall}")
    print("=" * width)
```

### 2.3 Trend Visualization

```
Deployment Frequency Trend (Past 6 Months)

  /day
  3.0 |                                          *
  2.5 |                                    *
  2.0 |                              *
  1.5 |                        *
  1.0 |              *   *
  0.5 |  *     *
  0.0 +----+----+----+----+----+----+
      Sep  Oct  Nov  Dec  Jan  Feb

  Corresponding improvement events:
  - Oct: CI/CD pipeline introduced → automated deployment started
  - Dec: Feature Flags introduced → deployment and release decoupled
  - Feb: Transition to Trunk-Based Development → small PR culture


Lead Time Trend (Past 6 Months)

  hours
  72  |  *
  48  |     *     *
  24  |              *
  12  |                    *
   8  |                        *   *
   4  |                                 *
   2  |                                      *
   0  +----+----+----+----+----+----+
      Sep  Oct  Nov  Dec  Jan  Feb

  Corresponding improvement events:
  - Oct: PR size limit introduced (< 400 lines)
  - Dec: Review response SLA introduced (< 4 hours)
  - Feb: Automated review tool introduced (CodeRabbit)


Change Failure Rate Trend (Past 6 Months)

  %
  25  |  *
  20  |     *
  15  |           *
  10  |              *
   8  |                    *
   5  |                         *   *   *
   0  +----+----+----+----+----+----+
      Sep  Oct  Nov  Dec  Jan  Feb

  Corresponding improvement events:
  - Oct: Coverage gate at 60% introduced
  - Nov: Coverage gate raised to 70%
  - Jan: Coverage gate at 80% + E2E tests added
```

---

## 3. Visualizing Quality Metrics

### 3.1 Quality Dashboard

```python
"""Integrated dashboard for quality metrics"""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class QualitySnapshot:
    """A snapshot of quality metrics at a point in time"""
    timestamp: datetime

    # Code quality
    avg_complexity: float
    duplication_percent: float
    type_coverage_percent: float

    # Testing
    test_coverage_percent: float
    test_count: int
    test_pass_rate: float       # Test pass rate (%)
    test_execution_sec: float

    # Security
    known_vulnerabilities: int
    security_hotspots: int

    # Maintainability
    todo_fixme_count: int
    outdated_deps: int
    avg_file_size_lines: float


@dataclass
class QualityTrend:
    """Trend analysis for quality metrics"""
    snapshots: list[QualitySnapshot] = field(default_factory=list)

    def add_snapshot(self, snapshot: QualitySnapshot) -> None:
        self.snapshots.append(snapshot)
        self.snapshots.sort(key=lambda s: s.timestamp)

    def get_trend(self, metric: str, periods: int = 6) -> list[tuple[datetime, float]]:
        """Get trend data for a specified metric"""
        recent = self.snapshots[-periods:]
        return [(s.timestamp, getattr(s, metric, 0.0)) for s in recent]

    def detect_degradation(
        self,
        metric: str,
        threshold_percent: float = 10.0,
        higher_is_better: bool = True
    ) -> bool:
        """Detect quality degradation

        Compares the two most recent snapshots and returns True
        if degradation exceeds threshold_percent
        """
        if len(self.snapshots) < 2:
            return False

        current = getattr(self.snapshots[-1], metric, 0.0)
        previous = getattr(self.snapshots[-2], metric, 0.0)

        if previous == 0:
            return False

        change_percent = ((current - previous) / abs(previous)) * 100

        if higher_is_better:
            return change_percent < -threshold_percent
        else:
            return change_percent > threshold_percent

    def generate_report(self) -> str:
        """Generate a quality trend report"""
        if not self.snapshots:
            return "No data"

        current = self.snapshots[-1]
        lines = [
            "=" * 60,
            "  Quality Trend Report",
            f"  As of: {current.timestamp.strftime('%Y-%m-%d %H:%M')}",
            "=" * 60,
        ]

        # Degradation detection
        degradations = []
        checks = [
            ("test_coverage_percent", "Test Coverage", True),
            ("avg_complexity", "Average Complexity", False),
            ("duplication_percent", "Code Duplication Rate", False),
            ("known_vulnerabilities", "Known Vulnerabilities", False),
            ("outdated_deps", "Outdated Dependencies", False),
        ]

        for metric, name, higher_is_better in checks:
            if self.detect_degradation(metric, 10.0, higher_is_better):
                degradations.append(name)

        if degradations:
            lines.append(f"\n  [ALERT] Quality Degradation Detected:")
            for d in degradations:
                lines.append(f"    - {d}")
        else:
            lines.append(f"\n  [OK] No Quality Degradation")

        lines.append("=" * 60)
        return "\n".join(lines)
```

### 3.2 Quality Trend Collection with GitHub Actions

```yaml
# .github/workflows/quality-trend.yml
name: Quality Trend Tracking

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9:00
  workflow_dispatch:

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install tools
        run: |
          pip install -r requirements.txt -r requirements-dev.txt
          pip install radon

      - name: Collect quality metrics
        run: |
          python -c "
          import json
          from datetime import datetime

          metrics = {
            'timestamp': datetime.now().isoformat(),
            'test_coverage': $(pytest --cov=src --cov-report=json -q 2>/dev/null; python -c "import json; print(json.load(open('coverage.json'))['totals']['percent_covered'])" 2>/dev/null || echo 0),
            'avg_complexity': $(radon cc src/ -a -j | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('average',0) if isinstance(d,dict) else 0)" 2>/dev/null || echo 0),
            'todo_count': $(grep -r -c -E 'TODO|FIXME|HACK' src/ 2>/dev/null | awk -F: '{s+=\$2}END{print s+0}'),
          }

          # Append to trend file
          try:
            with open('quality-trend.json') as f:
              trend = json.load(f)
          except FileNotFoundError:
            trend = []

          trend.append(metrics)

          # Keep the last 52 weeks
          trend = trend[-52:]

          with open('quality-trend.json', 'w') as f:
            json.dump(trend, f, indent=2)

          print(json.dumps(metrics, indent=2))
          "

      - name: Commit trend data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add quality-trend.json
          git diff --staged --quiet || git commit -m "chore: update quality trend data"
          git push
```

---

## 4. Improvement Cycles

### 4.1 PDCA Cycle

```python
"""Structured framework for improvement cycles"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class CyclePhase(Enum):
    PLAN = "plan"
    DO = "do"
    CHECK = "check"
    ACT = "act"


@dataclass
class ImprovementGoal:
    """Improvement goal"""
    metric: str
    current_value: float
    target_value: float
    deadline: datetime
    owner: str
    actions: list[str] = field(default_factory=list)

    @property
    def progress_percent(self) -> float:
        if self.target_value == self.current_value:
            return 100.0
        return min(100.0, max(0.0,
            abs(self.current_value - self.target_value) /
            abs(self.target_value - self.current_value) * 100
        ))


@dataclass
class ImprovementCycle:
    """PDCA cycle management for quality improvement"""
    cycle_id: str
    phase: CyclePhase = CyclePhase.PLAN
    goals: list[ImprovementGoal] = field(default_factory=list)
    learnings: list[str] = field(default_factory=list)

    def plan(self, current_metrics: dict, improvement_areas: list[str]) -> dict:
        """Plan: Analyze current state and set improvement goals

        Steps:
        1. Analyze current metrics
        2. Identify bottlenecks
        3. Set improvement goals (SMART principle)
        4. Formulate action plan
        """
        targets = {}
        for area in improvement_areas:
            current = current_metrics.get(area, 0)

            # Improvement goal: 10-30% better than current
            if area in ("test_coverage", "deploy_frequency"):
                target = min(current * 1.2, 95.0)  # 20% increase, cap at 95%
            elif area in ("avg_complexity", "lead_time_hours"):
                target = current * 0.8  # 20% reduction
            elif area == "change_failure_rate":
                target = max(current * 0.7, 5.0)  # 30% reduction, floor at 5%
            else:
                target = current * 1.1

            targets[area] = {
                "current": current,
                "target": round(target, 1),
                "improvement": f"{abs((target - current) / max(current, 0.1) * 100):.0f}%",
            }

        self.phase = CyclePhase.PLAN
        return {"current_metrics": current_metrics, "targets": targets}

    def do(self, actions: list[dict]) -> list[str]:
        """Do: Execute improvement actions

        Each action has the format:
        {"name": str, "owner": str, "deadline": str, "execute": callable}
        """
        results = []
        self.phase = CyclePhase.DO

        for action in actions:
            try:
                action["execute"]()
                results.append(f"[OK] {action['name']} (Owner: {action['owner']})")
            except Exception as e:
                results.append(f"[NG] {action['name']}: {e}")

        return results

    def check(self, targets: dict, actual_metrics: dict) -> dict:
        """Check: Measure effectiveness

        Evaluate the degree of achievement against each goal
        """
        self.phase = CyclePhase.CHECK
        results = {}

        for metric, target_info in targets.items():
            target_value = target_info["target"]
            actual_value = actual_metrics.get(metric, 0)
            current_value = target_info["current"]

            # Achievement determination based on improvement direction
            if metric in ("test_coverage", "deploy_frequency"):
                achieved = actual_value >= target_value
                improvement = actual_value - current_value
            else:
                achieved = actual_value <= target_value
                improvement = current_value - actual_value

            results[metric] = {
                "target": target_value,
                "actual": actual_value,
                "achieved": achieved,
                "improvement": round(improvement, 1),
            }

        return results

    def act(self, check_results: dict) -> dict:
        """Act: Standardize or adjust direction

        Achieved: Embed improvement into processes (standardize)
        Not achieved: Root cause analysis → Reflect in next cycle's Plan
        """
        self.phase = CyclePhase.ACT
        actions = {}

        for metric, result in check_results.items():
            if result["achieved"]:
                actions[metric] = {
                    "action": "standardize",
                    "detail": f"{metric}: Embed improvement into CI/CD pipeline, "
                              f"update threshold to {result['actual']}",
                }
            else:
                actions[metric] = {
                    "action": "adjust",
                    "detail": f"{metric}: Conduct root cause analysis. "
                              f"Target={result['target']}, Actual={result['actual']}. "
                              f"Strengthen countermeasures in next cycle",
                }
                self.learnings.append(
                    f"{metric}: Goal not achieved. Gap={result['target'] - result['actual']:.1f}"
                )

        return actions
```

### 4.2 OODA Loop (for Rapid Improvement)

```
OODA Loop (For Incident Response and Emergency Improvement)

  ┌──────────┐      ┌──────────┐
  │ Observe  │ ──→  │ Orient   │
  │          │      │          │
  └──────────┘      └────┬─────┘
       ↑                  │
       │                  v
  ┌──────────┐      ┌──────────┐
  │ Act      │ ←──  │ Decide   │
  │          │      │          │
  └──────────┘      └──────────┘

  Differences from PDCA:
  ┌────────────┬────────────────┬────────────────┐
  │            │ PDCA           │ OODA           │
  ├────────────┼────────────────┼────────────────┤
  │ Cycle speed│ Weeks ~ months │ Minutes ~ hours│
  │ Use case   │ Planned improve│ Emergency/exp. │
  │ Focus      │ Plan accuracy  │ Decision speed │
  │ Feedback   │ Metrics        │ Real-time mon. │
  └────────────┴────────────────┴────────────────┘

  Example: Production incident response
  Observe: Alert detected → Check error logs → Identify impact scope
  Orient:  Form hypothesis of root cause → Reference past similar incidents
  Decide:  Rollback or hotfix → Decide on response policy
  Act:     Implement response → Confirm result → Re-loop as needed
```

### 4.3 Retrospectives

```
Sprint Retrospective Template

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sprint N Retrospective (YYYY-MM-DD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Keep (What to continue)]
  + PR review within 24 hours rule → effective for reducing lead time
  + Weekly pair programming → effective for knowledge sharing
  + 15-minute daily standup → early detection of blockers

[Problem (Issues)]
  - E2E tests are unstable (flaky rate: 15%)
  - Manual confirmation after deploy takes 30 minutes
  - Average code review wait time is 8 hours

[Try (What to attempt next)]
  - [ ] Quarantine flaky tests and address root cause (Owner: Alice, Due: Sprint N+1)
  - [ ] Automate smoke tests (Owner: Bob, Due: Sprint N+2)
  - [ ] Raise coverage target from 75% to 80% (whole team)
  - [ ] Review response time SLA: within 4 hours (trial)

[Metrics (Previous → Current)]
  Deploy frequency:  1.2/day → 1.5/day  [+25%]    (Target: 2.0/day)
  Lead time:         18h → 12h           [-33%]    (Target: 8h)
  Change fail rate:  12% → 8%            [-33%]    (Target: 5%)
  Coverage:          72% → 75%           [+4%]     (Target: 80%)
  Build time:        8min → 6min         [-25%]    (Target: 5min)

[Results from Previous Try]
  [Achieved]     Test parallelization → build time 8min → 6min
  [Not achieved] API documentation auto-generation → insufficient resources, not started → carried to next Sprint
  [Achieved]     pre-commit hooks introduced → PRs with lint violations dropped to 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```python
"""Structured retrospectives"""
from dataclasses import dataclass, field
from datetime import date


@dataclass
class RetroItem:
    """A retrospective item"""
    category: str   # "keep", "problem", "try"
    description: str
    owner: str = ""
    deadline: str = ""
    status: str = "open"  # open, achieved, not_achieved, carried_over

    def __str__(self) -> str:
        prefix = {"keep": "+", "problem": "-", "try": "[ ]"}
        return f"  {prefix.get(self.category, '?')} {self.description}"


@dataclass
class SprintRetro:
    """Sprint retrospective"""
    sprint_name: str
    date: date
    items: list[RetroItem] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)
    previous_try_results: list[dict] = field(default_factory=list)

    @property
    def keeps(self) -> list[RetroItem]:
        return [i for i in self.items if i.category == "keep"]

    @property
    def problems(self) -> list[RetroItem]:
        return [i for i in self.items if i.category == "problem"]

    @property
    def tries(self) -> list[RetroItem]:
        return [i for i in self.items if i.category == "try"]

    def carry_over_unfinished(self) -> list[RetroItem]:
        """Carry over unfinished Try items to the next retrospective"""
        return [
            RetroItem(
                category="try",
                description=f"[Carried over] {item.description}",
                owner=item.owner,
                deadline=item.deadline,
                status="carried_over",
            )
            for item in self.tries
            if item.status == "not_achieved"
        ]

    def effectiveness_score(self) -> float:
        """Effectiveness score for the retrospective

        The proportion of previous Try items that were achieved
        """
        if not self.previous_try_results:
            return 0.0

        achieved = sum(
            1 for r in self.previous_try_results
            if r.get("status") == "achieved"
        )
        return (achieved / len(self.previous_try_results)) * 100
```

---

## 5. Improvement as Team Culture

### 5.1 Psychological Safety and a Culture of Improvement

```
Pyramid for Building an Improvement Culture

                    ┌─────────────────┐
                    │ Experimental     │
                    │ Improvement      │
                    │ (Innovation)     │
                    ├─────────────────┤
                    │ Continuous       │
                    │ Improvement      │
                    │ (Kaizen)         │
                    ├─────────────────┤
                    │ Standardization  │
                    │ (Standards)      │
                    ├─────────────────┤
                    │ Psychological    │
                    │ Safety           │
                    └─────────────────┘

Characteristics of each level:

  1. Psychological Safety (Foundation)
     - Anyone can casually say "This code could be better"
     - Anyone can say "I don't understand"
     - Failures are shared as learnings, not blamed
     - Bug reports are received with gratitude, not criticism

  2. Standardization
     - Agreed coding conventions with automated checks
     - Minimum test standards (Definition of Done)
     - CI/CD pipeline quality gates
     - Documentation templates

  3. Continuous Improvement (Kaizen)
     - Practicing the Boy Scout Rule
     - Dedicating 20% of every sprint to improvement
     - Regular retrospectives
     - Visualizing improvements with metrics

  4. Experimental Improvement
     - Trial introduction of new tools and practices
     - A/B test-style process improvements
     - Hackathons / 20% time
     - Small experiments that assume failure
```

### 5.2 Organizational Practices for Improvement

```python
"""Implementation patterns for improvement practices"""


class ImprovementPractices:
    """Collection of team improvement practices"""

    @staticmethod
    def blameless_postmortem_template() -> str:
        """Template for a blameless postmortem"""
        return """
        ========================================
        Postmortem: [Incident Name]
        Date: [YYYY-MM-DD]
        ========================================

        ## Timeline
        - HH:MM Detection: [What happened]
        - HH:MM Response started: [Who did what]
        - HH:MM Resolved: [How it was resolved]

        ## Impact
        - Affected users: [N]
        - Downtime: [N minutes]
        - Revenue impact: [Estimated amount]

        ## Root Cause
        [5 Whys Analysis]
        Why 1: Why did the service go down? → OOM Kill
        Why 2: Why was there insufficient memory? → Memory leak
        Why 3: Why wasn't the leak detected? → No monitoring
        Why 4: Why was there no monitoring? → It was forgotten
        Why 5: Why was it forgotten? → No checklist existed

        ## Action Items
        - [ ] Add memory monitoring alerts (Owner: Alice, Due: MM/DD)
        - [ ] Add monitoring check to pre-deploy checklist (Owner: Bob)
        - [ ] Add tests for memory leak detection (Owner: Carol)

        ## Learnings
        - [Document lessons from this incident]

        ## Note: A postmortem focuses on "how to improve the system
                and process," not "whose fault it was"
        """

    @staticmethod
    def tech_radar_categories() -> dict:
        """Technology Radar (visualizing technology choices)"""
        return {
            "Adopt (Recommended)": [
                "Python 3.12", "pytest", "Ruff", "GitHub Actions",
                "PostgreSQL 16", "Redis 7", "Docker",
            ],
            "Trial (In evaluation)": [
                "FastAPI", "Pydantic v2", "uv (package manager)",
                "Playwright (E2E)", "OpenTelemetry",
            ],
            "Assess (Under assessment)": [
                "Rust (for performance-critical parts)",
                "Deno", "Bun", "Effect-TS",
            ],
            "Hold (Not recommended)": [
                "Django (for new projects)", "unittest (prefer pytest)",
                "Travis CI (prefer GitHub Actions)", "Python 3.9 and earlier",
            ],
        }

    @staticmethod
    def definition_of_done() -> list[str]:
        """Definition of Done"""
        return [
            "[ ] Code has been refactored (Boy Scout Rule applied)",
            "[ ] Unit tests are written (coverage ≥ 80%)",
            "[ ] Type hints added (MyPy strict passes)",
            "[ ] Lint/Format checks pass",
            "[ ] Code review completed (approved by at least 1 person)",
            "[ ] Integration tests updated (if applicable)",
            "[ ] Documentation updated (if API changes)",
            "[ ] Security checks pass",
            "[ ] Performance impact has been assessed",
            "[ ] Any new technical debt is recorded in the backlog (if incurred)",
        ]
```

### 5.3 Obstacles to Improvement and Countermeasures

```
Map of Improvement Obstacles and Countermeasures

  Obstacle                          Countermeasure
  ┌───────────────────────┐     ┌───────────────────────┐
  │ "No time to improve"  │────→│ Institutionalize 20%   │
  │                       │     │ rule; embed in sprint  │
  └───────────────────────┘     └───────────────────────┘
  ┌───────────────────────┐     ┌───────────────────────┐
  │ "Can't see the effect"│────→│ Visualize metrics      │
  │                       │     │ Quantitative before/   │
  │                       │     │ after comparison       │
  └───────────────────────┘     └───────────────────────┘
  ┌───────────────────────┐     ┌───────────────────────┐
  │ "Afraid of failure"   │────→│ Build psychological    │
  │                       │     │ safety; blameless      │
  │                       │     │ culture                │
  └───────────────────────┘     └───────────────────────┘
  ┌───────────────────────┐     ┌───────────────────────┐
  │ "Don't know what to   │────→│ DORA metrics           │
  │  improve"             │     │ Hotspot analysis       │
  └───────────────────────┘     └───────────────────────┘
  ┌───────────────────────┐     ┌───────────────────────┐
  │ "Improvement doesn't  │────→│ Retrospectives         │
  │  stick"               │     │ Institutionalize PDCA  │
  └───────────────────────┘     └───────────────────────┘
  ┌───────────────────────┐     ┌───────────────────────┐
  │ "No management buy-in"│────→│ Explain via cost       │
  │                       │     │ estimates; ROI-based   │
  │                       │     │ proposals              │
  └───────────────────────┘     └───────────────────────┘
```

---

## 6. Comparison Tables

### 6.1 Comparison of Improvement Methods

| Improvement Method | Time to Effect | Cost | Sustainability | Risk | Use Case |
|---------|:-------:|:-----:|:-----:|:-----:|---------|
| pre-commit hooks | Immediate | Low | High | Minimal | Unify code style, basic checks |
| CI/CD pipeline | 1-2 weeks | Medium | High | Low | Automate testing, build, deployment |
| DORA metrics | 1-3 months | Low | High | Minimal | Visualize team performance |
| Retrospectives | Per sprint | Low | Medium | Low | Process improvement, team learning |
| 20% rule | 2-4 weeks | Low | High | Low | Planned quality improvement |
| Technical debt sprint | 2-4 weeks | High | Medium | Medium | Concentrated repayment of accumulated debt |
| Feature Flags | 1-2 weeks | Medium | High | Low | Separate deployment from release |
| Trunk-Based Dev | 1-3 months | Medium | High | Medium | Optimize development flow |

### 6.2 Quality Gate Reference

| Quality Gate | Detects | Recommended Tool (Python) | Recommended Tool (TypeScript) | Recommended Threshold |
|-----------|---------|-------------------|----------------------|---------|
| Lint | Code style / potential bugs | Ruff | ESLint | 0 errors |
| Format | Code formatting | Ruff Format | Prettier | 0 diff |
| Type Check | Type safety | MyPy (strict) | TypeScript (strict) | 0 errors |
| Unit Test | Logic correctness | pytest | Jest / Vitest | All pass |
| Coverage | Test coverage | coverage.py | Istanbul / c8 | >= 80% |
| Integration Test | Component interaction | pytest | Jest / Playwright | All pass |
| Security Scan (SAST) | Code vulnerabilities | Bandit | ESLint Security | Critical/High: 0 |
| Security Scan (SCA) | Dependency vulnerabilities | Safety / pip-audit | npm audit / Snyk | Critical: 0 |
| Container Scan | Container vulnerabilities | Trivy | Trivy | Critical/High: 0 |
| Complexity | Code complexity | radon | ESLint complexity | CC < 10 |

### 6.3 CI Pipeline Speed Optimizations

| Optimization | Effect | Implementation Cost | Applicable Conditions |
|-----------|------|----------|---------|
| Test parallelization (xdist) | 50-70% build time reduction | Low | Tests are independent |
| Docker layer cache | 30-50% build time reduction | Low | Docker builds present |
| Dependency cache (actions/cache) | 80% install time reduction | Low | Always applicable |
| Affected test detection | 60-80% test time reduction | High | Monorepo, large test suites |
| Job parallelization (matrix) | 40-60% build time reduction | Low | Multi-environment testing |
| Spot/Preemptible runners | 60-80% cost reduction | Medium | Non-urgent jobs |

---

## 7. Exercises

### Exercise 1: CI/CD Pipeline Design (Basic)

Design a GitHub Actions CI pipeline based on the following requirements.

```
Project Information:
- Language: Python 3.12
- Framework: FastAPI
- DB: PostgreSQL 16
- Testing: pytest (unit + integration)
- Current state: No CI, manual deployment

Requirements:
1. Automated quality checks triggered on PRs
2. Lint + Format + Type Check (Stage 1)
3. Unit Tests + Coverage >= 75% (Stage 2)
4. Integration Tests with PostgreSQL (Stage 3)
5. Security scan (Stage 4)
6. Staging deployment on merge to main branch

Deliverables:
- Complete YAML for .github/workflows/ci.yml
- .pre-commit-config.yaml
- Quality gate threshold configuration
```

**Key Points for Expected Answer:**
- Correct configuration of inter-stage dependencies (`needs`)
- PostgreSQL service container configuration
- Cache utilization (pip, Docker)
- Timeout configuration
- Preventing duplicate PR runs via `concurrency`

### Exercise 2: DORA Metrics Improvement Plan (Applied)

Analyze the following team's DORA metrics and formulate an improvement plan.

```
Current Metrics:
- Deployment frequency: 0.3/day (~2 times/week)
- Lead time: 72 hours (PR creation → merge)
- Change failure rate: 18%
- Time to restore: 4 hours

Bottlenecks (from value stream mapping):
- Coding: 4 hours
- PR creation: 30 minutes
- Review wait: 24 hours  ← Bottleneck 1
- Review: 2 hours
- CI pipeline: 20 minutes
- Manual testing after merge: 4 hours  ← Bottleneck 2
- Manual deployment: 2 hours  ← Bottleneck 3

Tasks:
1. Determine the performance level of each metric
2. Propose improvements for the three bottlenecks
3. Set target metrics for 3 months from now
4. Design a PDCA improvement cycle
5. Create a retrospective template
```

**Key Points for Expected Answer:**
- Review wait → Review response SLA of 4 hours, PR size limit of 400 lines
- Manual testing → E2E test automation, smoke tests
- Manual deployment → CI/CD pipeline, automated deployment
- 3-month targets: Deploy 1.0/day, lead time 24h, change failure rate 10%

### Exercise 3: Building an Improvement Culture (Advanced)

Formulate a plan for embedding continuous improvement in an organization with a legacy team culture.

```
Current State:
- Team: 12 people (6 backend, 4 frontend, 2 QA)
- Testing culture: QA team does manual testing. Developers don't write tests
- CI: Jenkins is running but failures are ignored
- Retrospectives: Not held
- Code review: Perfunctory (LGTM only)
- Technical debt: Enormous but not quantified

Tasks:
1. Five specific actions to increase psychological safety
2. Phased quality gate introduction plan (4 phases)
3. Transition plan to a culture where developers write tests
4. Metrics-driven improvement cycle design
5. KPIs at 6 months and how to measure them
6. Management persuasion materials (ROI estimate)

Evaluation Criteria:
- Validity of the phased approach
- Consideration for team culture
- Quantitative goal setting
- Sustainability
- Persuasiveness to management
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Treating Metrics as Goals (Goodhart's Law)

```
Bad Pattern:
  "Set a goal of 100% coverage"
  → A large number of meaningless tests get written
  → Tests for getters/setters, tests with "assert True"
  → Coverage reaches 100% but bugs don't decrease
  → Development speed drops, team motivation also drops

  "The goal is to deploy every day"
  → Empty deploys with no substance increase
  → DORA metrics improve but quality stays the same

  "When a measure becomes a target,
   it ceases to be a good measure."
  -- Goodhart's Law

Good Pattern:
  Metrics are "indicators," not "goals"
  → Set 80% coverage as a "minimum baseline"
  → Focus on covering critical paths
  → Also measure "test quality" with mutation testing
  → Make "bug detection rate" and "regression bug rate" the true goals
```

### Anti-Pattern 2: Improving for the Sake of Improving (Shiny Object Syndrome)

```
Bad Pattern:
  "Let's introduce the latest tool!"
  → Breaks existing workflows
  → High learning cost for the team
  → Actual quality doesn't improve
  → Migrate to another new tool a few months later

Good Pattern: Problem-driven improvement
  1. "Three production incidents per month" ← Identify the problem
  2. "Test coverage is 40%" ← Analyze the cause
  3. "Add coverage gate to CI" ← Implement countermeasure
  4. Measure effectiveness: Track incident count over time
  5. Confirm improvement: 3/month → 1/month → Continue countermeasure

  The motivation for improvement should always be a "specific problem."
  "Looks interesting" or "it's trending" are not appropriate motivators.
```

### Anti-Pattern 3: Big Bang Improvement

```
Bad Pattern:
  "Starting next month, all projects must have:
   - Coverage 80%
   - Type check strict
   - E2E tests required
   - Security scan required"

  → All existing project CIs turn Red
  → Developers start ignoring CI
  → The perception that "quality gates are a nuisance" spreads

Good Pattern: Phased introduction
  Phase 1 (2 weeks): Warning only, no blocking
  Phase 2 (2 weeks): Only lint + test failures block
  Phase 3 (1 month): Add coverage 60%
  Phase 4 (1 month): Coverage 80% + type check

  At each phase:
  - Collect team feedback
  - Adjust thresholds if the pain is too great
  - Carefully explain "why this gate is needed"
```

### Anti-Pattern 4: Retrospectives Becoming Perfunctory

```
Bad Pattern:
  The same flow every time:
  Keep: "Nothing in particular"
  Problem: "It was a busy sprint"
  Try: "Try harder"
  → No concrete action items
  → Same content at the next retro
  → Perception that "retros are a waste of time"

Good Pattern:
  1. Share metrics in advance (DORA, quality dashboard)
  2. Data-driven discussions ("it was busy" → "lead time was 72h")
  3. Concrete action items (owner, deadline, completion criteria)
  4. Always review results of previous Try items (achieved/not achieved/carried over)
  5. Measure effectiveness (track the retrospective effectiveness score)
  6. Rotate the facilitator (prevent staleness)
```

---

## 9. FAQ

### Q1. What should be done when the CI pipeline is slow?

**A.** Five countermeasures in order of priority: (1) Run tests in parallel (`pytest-xdist`, GitHub Actions `matrix` strategy). This has the biggest impact and lowest adoption cost. (2) Use Docker layer caching and pip caching (`actions/cache`). (3) Run only tests related to changed files (affected test detection). Especially effective for large repositories. (4) Parallelize by separating unit test and integration test jobs. (5) Stage design based on the Fast Feedback First principle (lint within 2 minutes, unit tests within 5 minutes). The goal is PR feedback within 10 minutes.

### Q2. What to do when DORA metric improvement has stalled?

**A.** Conduct Value Stream Mapping (VSM). Visualize the wait time at each step from "code change to deployment." In most cases, the bottleneck is not a technical problem but a process one: code review wait time, manual testing, approval processes. Specific countermeasures: (1) Set a review response time SLA (within 4 hours), (2) Limit PR size (under 400 lines), (3) Automate manual testing, (4) Simplify approval processes. Also consider reviewing the team structure itself, referencing the Team Topologies concept.

### Q3. Are quality gates too strict and slowing down development?

**A.** When quality gates are first introduced, development speed temporarily drops by 10-20%. However, according to Accelerate research, after 2-3 months, the total development speed surpasses the pre-gate state due to reduced regression bugs and more efficient reviews. If the gates feel too strict: (1) Separate Warning and Blocking levels and introduce them in stages, (2) Apply gates only to new code (exempt existing code), (3) Regularly collect team feedback. The important thing is sharing the mindset that "quality and speed are not a trade-off."

### Q4. We introduced metrics but the team is too focused on the numbers.

**A.** There is a possibility of falling into Goodhart's Law (Anti-Pattern 1). Countermeasures: (1) Repeatedly convey that metrics are "health check numbers," not "grades." (2) Never use metrics for individual evaluations. Track only team-level trends. (3) Always make clear the purpose of "why we look at this metric." (4) Combine quantitative metrics with qualitative feedback (developer satisfaction, DX Surveys).

### Q5. Are DORA metrics useful for small teams (3-5 people)?

**A.** Yes, but simplify the collection method. For small teams, rather than spending time building automated collection scripts: (1) For deployment frequency, manually record "how many times did we deploy last week," (2) For lead time, transcribe PR merge times from GitHub to a spreadsheet, (3) For change failure rate, record "how many times did we revert last week." Start with these and review the numbers in a monthly retrospective to discuss improvement points. Introduce automation gradually once the improvement culture is established.

### Q6. How do Feature Flags contribute to continuous improvement?

**A.** Feature Flags allow "deployment" and "release" to be separated. Why this contributes to continuous improvement: (1) Higher deployment frequency -- Incomplete features can be deployed with flags disabled, enabling small changes to be deployed frequently. (2) Lower change failure rate -- If a problem occurs, just disable the flag for an immediate rollback. (3) Shorter lead time -- Prevents long-lived branches and reduces conflicts. (4) Experimental improvement -- The effect of new features can be quantitatively verified with A/B tests and canary releases. Note: Neglecting to delete finished flags creates technical debt, so flag lifecycle management is important.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| CI/CD Pipeline | Fast Feedback First: Lint → Test → Coverage → Security → Build → Deploy |
| Quality Gates | PR merge conditions: Coverage >= 80%, all lint checks pass, all tests pass |
| Phased introduction | Warning → Basic Blocking → Quality Hardening → Full Gates (over 3 months) |
| DORA Metrics | Four indicators: deployment frequency, lead time, change failure rate, time to restore |
| Performance Levels | Elite > High > Medium > Low (throughput and stability go together) |
| PDCA Cycle | Iterative Plan → Do → Check → Act. Verify effectiveness with metrics |
| Retrospectives | Keep / Problem / Try + metrics + review of previous Try results |
| Team Culture | Psychological safety → Standardization → Continuous improvement → Experimental improvement |
| Anti-Patterns | Treating metrics as goals, improving for improvement's sake, Big Bang adoption, perfunctory retros |

---

## Guides to Read Next

- [Technical Debt](./03-technical-debt.md) -- Quantifying debt, prioritization, and planned repayment strategies
- [Code Smells](./00-code-smells.md) -- A catalog for early detection of signs of quality degradation
- [Refactoring Techniques](./01-refactoring-techniques.md) -- Concrete code transformation methods for improving quality
- [Legacy Code](./02-legacy-code.md) -- Techniques for safely making changes to existing systems
- [Testing Principles](../01-practices/04-testing-principles.md) -- Test design that forms the foundation of quality gates
- [Code Review Checklist](../03-practices-advanced/04-code-review-checklist.md) -- Maintaining quality through reviews
- [Error Handling](../01-practices/02-error-handling.md) -- Robust error handling and incident response

---

## References

1. **Accelerate: The Science of Lean Software and DevOps** -- Nicole Forsgren, Jez Humble, Gene Kim (IT Revolution, 2018) -- Research results on DORA metrics. Scientific evidence for software delivery performance based on six years of surveys across tens of thousands of teams
2. **Continuous Delivery: Reliable Software Releases through Build, Test, and Deployment Automation** -- Jez Humble & David Farley (Addison-Wesley, 2010) -- The definitive text on CI/CD. Design principles and implementation patterns for deployment pipelines
3. **The Phoenix Project** -- Gene Kim, Kevin Behr, George Spafford (IT Revolution, 2013) -- A narrative explanation of DevOps. Presents a framework (Three Ways) for IT operations improvement
4. **Team Topologies: Organizing Business and Technology Teams for Fast Flow** -- Matthew Skelton & Manuel Pais (IT Revolution, 2019) -- Team structure and development flow. Team design that considers Cognitive Load
5. **The DevOps Handbook, 2nd Edition** -- Gene Kim, Jez Humble, Patrick Debois, John Willis (IT Revolution, 2021) -- A comprehensive practical guide to DevOps. Detailed implementation of the Three Ways (Flow, Feedback, Continual Learning)
6. **Lean Software Development** -- Mary Poppendieck & Tom Poppendieck (Addison-Wesley, 2003) -- Applying the Toyota Production System to software development. Eliminating waste and maximizing value
7. **Site Reliability Engineering** -- Betsy Beyer et al. (O'Reilly, 2016) -- Google's SRE practices. Implementation of SLI/SLO/SLA, error budgets, and postmortems
