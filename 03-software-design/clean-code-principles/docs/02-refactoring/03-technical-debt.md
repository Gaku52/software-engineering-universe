# Technical Debt

> Technical debt refers to the phenomenon where future development costs increase due to sacrificing quality for short-term gain. This metaphor, introduced by Ward Cunningham at OOPSLA in 1992, likens the quality-speed tradeoff in software development to financial "debt," providing a powerful concept that both decision-makers and developers can use as a common language. This guide systematically explains debt classification, visualization, quantification, and planned repayment strategies, providing a framework for treating debt as a "manageable investment."

## Prerequisites

| Topic | Required Level | Reference Guide |
|---------|----------|-----------|
| Clean Code Principles | Basic | Principles and Naming |
| Code Smells | Basic | [Code Smells](./00-code-smells.md) |
| Refactoring Techniques | Basic | [Refactoring Techniques](./01-refactoring-techniques.md) |
| Legacy Code | Recommended | [Legacy Code](./02-legacy-code.md) |
| Testing Principles | Recommended | [Testing Principles](../01-practices/04-testing-principles.md) |

## What You Will Learn in This Chapter

1. **The Nature and Classification of Technical Debt** -- Integrated understanding of Ward Cunningham's original meaning, Martin Fowler's four-quadrant model, and Steve McConnell's classification
2. **Visualizing and Quantifying Debt** -- Techniques for quantifying "invisible debt" through metrics collection, hotspot analysis, and cost calculation
3. **Explaining to Management** -- Using financial metaphors to propose debt repayment as return on investment (ROI)
4. **Incremental Repayment Strategies** -- Appropriate use of the Boy Scout Rule, 20% Rule, Debt Sprint, and Strangler Fig pattern
5. **Organizational Culture for Debt Management** -- Building a team culture that manages debt transparently and uses it strategically, rather than hiding it as something "bad"

---

## 1. The Nature of Technical Debt

### 1.1 Ward Cunningham's Original Meaning

It is important to accurately understand the original statement Ward Cunningham made in 1992:

```
"Shipping first-time code is like going into debt. A little debt speeds
development so long as it is paid back promptly with a rewrite. The danger
occurs when the debt is not repaid. Every minute spent on not-quite-right
code counts as interest on that debt."
-- Ward Cunningham, OOPSLA 1992
```

The key point is that Cunningham did not call "intentionally lowering quality" debt, but rather called it debt when "code written with the current understanding becomes inappropriate due to later learning."

```
  Cunningham's Original Meaning       Common Misconception
  ┌─────────────────────┐      ┌─────────────────────┐
  │ Accumulation of      │      │ Sloppy or careless  │
  │ insights through     │      │ code                │
  │ learning             │      │ → Skipping tests,   │
  │ → Previous design    │      │   copy-paste, hacks │
  │   becomes suboptimal │      │ → "It's debt so     │
  │ → Repay through      │      │   can't be helped"  │
  │   refactoring        │      │                     │
  └─────────────────────┘      └─────────────────────┘
```

### 1.2 Martin Fowler's Four-Quadrant Model

Martin Fowler classified technical debt into four quadrants along two axes:

```
                    Deliberate
                         |
    ┌────────────────────┼────────────────────┐
    │ Prudent × Deliberate│ Reckless × Deliberate│
    │                    │                    │
    │ "Release with this  │ "No time to write  │
    │  design now, and   │  tests, skip them" │
    │  improve next      │                    │
    │  sprint"           │ "As long as it     │
    │                    │  works"            │
    │ [Strategic Debt]   │ [Lazy Debt]        │
    │ Has repayment plan │ No repayment plan  │
    ├────────────────────┼────────────────────┤
    │ Prudent × Inadvertent│ Reckless × Inadvertent│
    │                    │                    │
    │ "I could design    │ "What's layering?" │
    │  this better now"  │ "SOLID? Never      │
    │ (discovered after  │  heard of it"      │
    │  learning)         │                    │
    │                    │                    │
    │ [Discovery Debt]   │ [Ignorant Debt]    │
    │ Evidence of learning│ Lack of skill     │
    └────────────────────┼────────────────────┘
                         |
                    Inadvertent

    Prudent ──────────────┼────── Reckless
```

### 1.3 Steve McConnell's Classification

Steve McConnell proposed a more practical classification:

```
Technical Debt Classification (McConnell)

1. Intentional Debt
   ├── Short-term: "Get MVP out before demo. Refactor next week"
   ├── Long-term: "This architecture will last 3 years. Redesign after"
   └── Strategic: "Prioritize time-to-market, improve quality incrementally"

2. Unintentional Debt
   ├── Design Debt: Design decisions later found to be inappropriate
   ├── Code Debt: Low-quality code due to lack of knowledge
   └── Bit Rot: Dependency staleness over time

3. Environmental Debt
   ├── Platform: OS/runtime EOL
   ├── Framework: Lagging behind major versions
   └── Toolchain: Build/deploy tool staleness
```

### 1.4 The "Interest" Mechanism of Debt

```
Technical Debt Lifecycle

  ┌──────────────┐
  │ Debt Incurred │  Code quality compromises, design shortcuts
  └──────┬───────┘
         v
  ┌──────────────┐
  │ Principal    │  = The low-quality code itself
  └──────┬───────┘
         v  Time passes + codebase grows
  ┌──────────────┐
  │ Interest     │  = Additional costs incurred because the debt exists
  └──────┬───────┘
         │
    ┌────┼────┬────────┬────────┐
    v    v    v        v        v
  Bug   Feature  Under-  On-      Security
  fixes  dev     standing boarding  risk
  take   takes   takes   +2 weeks
  2x     3x      2x
  time   time    time

  Without repayment, interest grows with compound interest
  ┌─────────────────────────────────────────────┐
  │                        ****                  │
  │                     ***                      │
  │ Cost              ***                         │
  │                 **                            │
  │               **         ← Interest compounds │
  │             **                                │
  │           **                                  │
  │         **                                    │
  │       *                                       │
  │     *     ← Principal (initial quality tradeoff)│
  │   *                                           │
  │ *                                             │
  └─────────────────────────────────────────────┘
    T0    T1    T2    T3    T4    T5  → Time
```

---

## 2. Concrete Debt Examples Mapping

### 2.1 Technical Debt by Layer

```
Technical Debt Map

  ┌─────────────────────────────────────────────┐
  │  Source Code Layer                           │
  │  ├── Duplicated code (DRY violations)        │
  │  ├── Long methods/classes (God Object)       │
  │  ├── Unclear naming                          │
  │  ├── Hardcoded values (magic numbers)        │
  │  ├── Inappropriate abstraction (over/under)  │
  │  └── Lack of type safety                     │
  ├─────────────────────────────────────────────┤
  │  Architecture Layer                          │
  │  ├── Circular dependencies                   │
  │  ├── Layer violations (UI → DB direct access)│
  │  ├── Monolith bloat                          │
  │  ├── Inappropriate data model                │
  │  ├── Lack of API consistency                 │
  │  └── Vague component boundaries              │
  ├─────────────────────────────────────────────┤
  │  Test Layer                                  │
  │  ├── Insufficient test coverage              │
  │  ├── Flaky tests (unstable tests)            │
  │  ├── Slow test execution                     │
  │  ├── Integration test overload (Ice Cream Cone)│
  │  └── Poor test readability/maintainability   │
  ├─────────────────────────────────────────────┤
  │  Infrastructure/Operations Layer             │
  │  ├── Manual deployments                      │
  │  ├── Insufficient monitoring/alerting        │
  │  ├── Outdated libraries/frameworks           │
  │  ├── Stale documentation                     │
  │  ├── Environment discrepancies (dev ≠ staging ≠ prod)│
  │  └── Poor secrets management                 │
  ├─────────────────────────────────────────────┤
  │  Process Layer                               │
  │  ├── Formalistic code reviews                │
  │  ├── Key-person dependency in release process│
  │  ├── Tacit knowledge silos                   │
  │  └── Unprepared incident response            │
  └─────────────────────────────────────────────┘
```

### 2.2 Debt Severity Levels

```python
"""Technical debt severity classification"""
from enum import IntEnum
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timedelta


class DebtSeverity(IntEnum):
    """Debt severity levels"""
    TRIVIAL = 1    # Cosmetic issues: naming, formatting
    MINOR = 2      # Small design issues: duplicate code, long methods
    MAJOR = 3      # Significant design issues: circular deps, layer violations
    CRITICAL = 4   # Serious structural issues: security vulnerabilities, data inconsistency
    BLOCKER = 5    # Fatal: production failure risk, scalability limits


class DebtCategory(str):
    CODE = "code"
    ARCHITECTURE = "architecture"
    TEST = "test"
    INFRASTRUCTURE = "infrastructure"
    PROCESS = "process"


@dataclass
class TechnicalDebtItem:
    """Individual technical debt item"""
    id: str
    title: str
    description: str
    category: str
    severity: DebtSeverity

    # Impact metrics
    impact_score: int          # Business impact (1-5)
    fix_effort_days: float     # Estimated days to fix
    affected_frequency: int    # How often it is encountered (1-5, 5=daily)
    risk_score: int            # Risk (1-5)

    # Tracking information
    discovered_date: datetime = field(default_factory=datetime.now)
    reporter: str = ""
    assigned_to: Optional[str] = None
    target_sprint: Optional[str] = None
    status: str = "open"  # open, in_progress, resolved, wont_fix

    # Related files
    affected_files: list[str] = field(default_factory=list)
    related_tickets: list[str] = field(default_factory=list)

    @property
    def priority_score(self) -> float:
        """Priority score: higher means should be repaid sooner

        Formula: (impact * frequency * risk) / effort
        - Prioritize debt with high impact, high frequency, high risk
        - Prioritize debt with low fix effort (Quick Win)
        """
        return (
            self.impact_score * self.affected_frequency * self.risk_score
        ) / max(self.fix_effort_days, 0.5)

    @property
    def annual_interest_cost(self) -> float:
        """Annual interest cost (rough estimate, in person-days)

        Interest = impact * frequency * 0.1 days (overhead per occurrence) * 250 working days/year
        """
        overhead_per_occurrence = 0.1 * self.impact_score
        occurrences_per_year = self.affected_frequency * 50  # 5 days/week * 50 weeks
        return overhead_per_occurrence * occurrences_per_year

    @property
    def roi(self) -> float:
        """Return on investment: annual interest savings / fix effort

        ROI > 1: Recovers investment within 1 year
        ROI > 3: Recovers within a quarter (high priority)
        """
        return self.annual_interest_cost / max(self.fix_effort_days, 0.5)

    @property
    def debt_age_days(self) -> int:
        """Number of days since debt was discovered"""
        return (datetime.now() - self.discovered_date).days

    def __str__(self) -> str:
        status_icon = {
            "open": "[OPEN]", "in_progress": "[WIP]",
            "resolved": "[DONE]", "wont_fix": "[SKIP]"
        }
        return (
            f"{status_icon.get(self.status, '[?]')} "
            f"[{self.severity.name}] {self.title} "
            f"(Priority: {self.priority_score:.1f}, ROI: {self.roi:.1f})"
        )
```

---

## 3. Visualizing and Quantifying Debt

### 3.1 Metrics Collection

```python
"""Technical debt metrics collection framework"""
import subprocess
import json
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime


@dataclass
class DebtMetrics:
    """Collected debt metrics"""
    # Code quality
    avg_complexity: float = 0.0
    max_complexity: float = 0.0
    high_complexity_count: int = 0       # Number of functions with CC > 10
    very_high_complexity_count: int = 0  # Number of functions with CC > 20

    # Duplication
    duplication_percentage: float = 0.0
    duplicate_blocks: int = 0

    # Dependencies
    outdated_dependencies: int = 0
    critical_updates: int = 0            # Major version behind
    known_vulnerabilities: int = 0

    # Tests
    test_coverage: float = 0.0
    flaky_test_count: int = 0
    test_execution_time_sec: float = 0.0

    # Maintainability
    todo_count: int = 0                  # TODO/FIXME/HACK
    large_files_count: int = 0           # Files with more than 500 lines
    large_functions_count: int = 0       # Functions with more than 50 lines

    # Overall score
    timestamp: str = ""

    @property
    def debt_score(self) -> int:
        """Technical debt score (0-100, lower is healthier)

        Weighted aggregation of each category's score:
        - Code quality: 30%
        - Tests: 25%
        - Dependencies: 20%
        - Maintainability: 25%
        """
        # Code quality score (0-30)
        complexity_score = min(self.avg_complexity / 15 * 30, 30)

        # Test score (0-25)
        coverage_penalty = max(0, (80 - self.test_coverage)) / 80 * 25

        # Dependency score (0-20)
        dep_score = min((self.outdated_dependencies + self.known_vulnerabilities * 3) / 20 * 20, 20)

        # Maintainability score (0-25)
        maintainability = min(
            (self.todo_count / 50 + self.large_files_count / 10 +
             self.duplication_percentage / 10) / 3 * 25, 25
        )

        return int(complexity_score + coverage_penalty + dep_score + maintainability)

    @property
    def health_status(self) -> str:
        score = self.debt_score
        if score < 25:
            return "HEALTHY"
        elif score < 50:
            return "CAUTION"
        elif score < 75:
            return "WARNING"
        else:
            return "CRITICAL"


def collect_debt_metrics(repo_path: str) -> DebtMetrics:
    """Collect technical debt indicators for a repository"""
    metrics = DebtMetrics(timestamp=datetime.now().isoformat())
    repo = Path(repo_path)

    # 1. Code complexity (Cyclomatic Complexity) -- radon
    try:
        result = subprocess.run(
            ["radon", "cc", str(repo / "src"), "-a", "-j"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            cc_data = json.loads(result.stdout)
            # Parse according to radon's output format
            complexities = []
            for filepath, functions in cc_data.items():
                if isinstance(functions, list):
                    for func in functions:
                        complexities.append(func.get("complexity", 0))

            if complexities:
                metrics.avg_complexity = sum(complexities) / len(complexities)
                metrics.max_complexity = max(complexities)
                metrics.high_complexity_count = sum(1 for c in complexities if c > 10)
                metrics.very_high_complexity_count = sum(1 for c in complexities if c > 20)
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
        pass

    # 2. Code duplication rate -- jscpd
    try:
        result = subprocess.run(
            ["jscpd", str(repo / "src"), "--reporters", "json",
             "--min-lines", "5", "--output", "/tmp/jscpd-report"],
            capture_output=True, text=True, timeout=120
        )
        report_path = Path("/tmp/jscpd-report/jscpd-report.json")
        if report_path.exists():
            report = json.loads(report_path.read_text())
            stats = report.get("statistics", {}).get("total", {})
            metrics.duplication_percentage = stats.get("percentage", 0)
            metrics.duplicate_blocks = stats.get("duplicates", 0)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 3. Dependency staleness -- pip
    try:
        result = subprocess.run(
            ["pip", "list", "--outdated", "--format=json"],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            outdated = json.loads(result.stdout)
            metrics.outdated_dependencies = len(outdated)
            metrics.critical_updates = sum(
                1 for d in outdated
                if _is_major_version_behind(d.get("version", ""), d.get("latest_version", ""))
            )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 4. Security vulnerabilities -- safety
    try:
        result = subprocess.run(
            ["safety", "check", "--json"],
            capture_output=True, text=True, timeout=60
        )
        if result.stdout:
            vulns = json.loads(result.stdout)
            metrics.known_vulnerabilities = len(vulns) if isinstance(vulns, list) else 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 5. Count of TODO/FIXME/HACK
    try:
        result = subprocess.run(
            ["grep", "-r", "-c", "-E", "TODO|FIXME|HACK|XXX", str(repo / "src")],
            capture_output=True, text=True, timeout=30
        )
        metrics.todo_count = sum(
            int(line.split(":")[-1])
            for line in result.stdout.strip().split("\n")
            if line and ":" in line
        )
    except (subprocess.TimeoutExpired, ValueError):
        pass

    # 6. Detection of large files/functions
    try:
        for py_file in (repo / "src").rglob("*.py"):
            lines = py_file.read_text().split("\n")
            if len(lines) > 500:
                metrics.large_files_count += 1
    except (FileNotFoundError, PermissionError):
        pass

    return metrics


def _is_major_version_behind(current: str, latest: str) -> bool:
    """Check if the major version differs"""
    try:
        current_major = int(current.split(".")[0])
        latest_major = int(latest.split(".")[0])
        return latest_major > current_major
    except (ValueError, IndexError):
        return False
```

### 3.2 Dashboard Display

```python
"""Technical debt dashboard"""

def print_debt_dashboard(metrics: DebtMetrics) -> None:
    """Display a text-based debt dashboard"""

    def status_icon(value: float, good: float, warn: float, higher_is_better: bool = False) -> str:
        if higher_is_better:
            if value >= good: return "[OK]"
            elif value >= warn: return "[WARN]"
            else: return "[CRIT]"
        else:
            if value <= good: return "[OK]"
            elif value <= warn: return "[WARN]"
            else: return "[CRIT]"

    width = 64
    print("=" * width)
    print("  Technical Debt Dashboard".center(width))
    print(f"  {metrics.timestamp}".center(width))
    print("=" * width)

    print("\n  [Code Quality]")
    print(f"    Avg Complexity (CC):     {metrics.avg_complexity:6.1f}  "
          f"{status_icon(metrics.avg_complexity, 5, 10)}")
    print(f"    Max Complexity (CC):     {metrics.max_complexity:6.1f}  "
          f"{status_icon(metrics.max_complexity, 15, 25)}")
    print(f"    High Complexity (>10):   {metrics.high_complexity_count:6d}  items")
    print(f"    Very High CC (>20):      {metrics.very_high_complexity_count:6d}  items")

    print("\n  [Code Duplication]")
    print(f"    Duplication Rate:        {metrics.duplication_percentage:6.1f}% "
          f"{status_icon(metrics.duplication_percentage, 3, 10)}")
    print(f"    Duplicate Blocks:        {metrics.duplicate_blocks:6d}  items")

    print("\n  [Tests]")
    print(f"    Coverage:                {metrics.test_coverage:6.1f}% "
          f"{status_icon(metrics.test_coverage, 80, 60, higher_is_better=True)}")
    print(f"    Flaky Tests:             {metrics.flaky_test_count:6d}  items")
    print(f"    Execution Time:          {metrics.test_execution_time_sec:6.1f}  sec")

    print("\n  [Dependencies]")
    print(f"    Outdated:                {metrics.outdated_dependencies:6d}  items")
    print(f"    Major Version Behind:    {metrics.critical_updates:6d}  items")
    print(f"    Known Vulnerabilities:   {metrics.known_vulnerabilities:6d}  items "
          f"{status_icon(metrics.known_vulnerabilities, 0, 3)}")

    print("\n  [Maintainability]")
    print(f"    TODO/FIXME/HACK:         {metrics.todo_count:6d}  items")
    print(f"    Large Files (>500L):     {metrics.large_files_count:6d}  items")

    print("\n" + "-" * width)
    score = metrics.debt_score
    health = metrics.health_status
    bar_length = 40
    filled = int(score / 100 * bar_length)
    bar = "#" * filled + "-" * (bar_length - filled)

    print(f"  Debt Score: [{bar}] {score}/100")
    print(f"  Health:     {health}")

    if health == "HEALTHY":
        print("  --> Healthy. Continue current quality maintenance practices")
    elif health == "CAUTION":
        print("  --> Caution. Start planned repayment and prevent further deterioration")
    elif health == "WARNING":
        print("  --> Warning. Development speed starting to be impacted. Prompt action recommended")
    else:
        print("  --> Critical. Severe impact on development speed. Debt sprint recommended")

    print("=" * width)
```

### 3.3 Hotspot Analysis

A hotspot is code that has "high change frequency and high complexity." Based on Adam Tornhill's Code as a Crime Scene approach:

```python
"""Hotspot analysis: identify refactoring priorities by change frequency x complexity"""
import subprocess
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Hotspot:
    """Hotspot by change frequency and complexity"""
    filepath: str
    change_count: int       # Number of changes in git log
    complexity: float       # Average cyclomatic complexity
    lines_of_code: int      # Line count
    bug_fix_count: int      # Number of changes in bug fixes

    @property
    def hotspot_score(self) -> float:
        """Hotspot score

        High change frequency × High complexity = High risk
        Files with many bug fixes are weighted further
        """
        bug_weight = 1.0 + (self.bug_fix_count / max(self.change_count, 1))
        return self.change_count * self.complexity * bug_weight

    @property
    def risk_level(self) -> str:
        score = self.hotspot_score
        if score > 500: return "CRITICAL"
        elif score > 200: return "HIGH"
        elif score > 100: return "MEDIUM"
        else: return "LOW"


def analyze_hotspots(
    repo_path: str,
    since: str = "6 months ago",
    top_n: int = 20
) -> list[Hotspot]:
    """Analyze hotspots from Git history and complexity"""

    # 1. Collect change frequency (git log)
    result = subprocess.run(
        ["git", "log", "--since", since, "--name-only",
         "--pretty=format:", "--diff-filter=M"],
        capture_output=True, text=True, cwd=repo_path
    )
    file_changes = Counter(
        line.strip() for line in result.stdout.split("\n")
        if line.strip() and line.strip().endswith(".py")
    )

    # 2. Number of changes in bug fixes
    result = subprocess.run(
        ["git", "log", "--since", since, "--name-only",
         "--pretty=format:", "--grep=fix", "--grep=bug", "-i"],
        capture_output=True, text=True, cwd=repo_path
    )
    bug_changes = Counter(
        line.strip() for line in result.stdout.split("\n")
        if line.strip() and line.strip().endswith(".py")
    )

    # 3. Collect complexity (radon)
    hotspots = []
    for filepath, change_count in file_changes.most_common(top_n * 2):
        full_path = Path(repo_path) / filepath
        if not full_path.exists():
            continue

        try:
            result = subprocess.run(
                ["radon", "cc", str(full_path), "-a", "-j"],
                capture_output=True, text=True, timeout=10
            )
            cc_data = json.loads(result.stdout)
            complexities = []
            for fpath, funcs in cc_data.items():
                if isinstance(funcs, list):
                    complexities.extend(f.get("complexity", 0) for f in funcs)

            avg_cc = sum(complexities) / len(complexities) if complexities else 1.0
            loc = len(full_path.read_text().split("\n"))

            hotspots.append(Hotspot(
                filepath=filepath,
                change_count=change_count,
                complexity=avg_cc,
                lines_of_code=loc,
                bug_fix_count=bug_changes.get(filepath, 0),
            ))
        except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
            continue

    # Sort by score
    hotspots.sort(key=lambda h: h.hotspot_score, reverse=True)
    return hotspots[:top_n]


def print_hotspot_report(hotspots: list[Hotspot]) -> None:
    """Display hotspot report"""
    print("=" * 80)
    print("  Hotspot Analysis Report")
    print("=" * 80)
    print(f"  {'Rank':<5} {'File':<35} {'Changes':<8} {'CC':<6} {'Bugs':<5} {'Risk':<10}")
    print("-" * 80)

    for i, h in enumerate(hotspots, 1):
        short_path = h.filepath if len(h.filepath) < 33 else "..." + h.filepath[-30:]
        print(
            f"  {i:<5} {short_path:<35} {h.change_count:<8} "
            f"{h.complexity:<6.1f} {h.bug_fix_count:<5} {h.risk_level:<10}"
        )

    print("-" * 80)
    critical = sum(1 for h in hotspots if h.risk_level == "CRITICAL")
    high = sum(1 for h in hotspots if h.risk_level == "HIGH")
    print(f"  CRITICAL: {critical} files  /  HIGH: {high} files")
    print("=" * 80)
```

```
Hotspot Visualization (Change Frequency vs Complexity)

  Complexity (CC)
  High |                                 [payment.py]  ← Top priority
       |                        [order.py]
       |              [user_service.py]
       |
  Mid  |     [auth.py]
       |                   [email.py]
       |
       |  [config.py]                    [report.py]
  Low  |     [utils.py]      [models.py]
       |
       +------------------------------------------------
       Low            Mid              High
                    Change Frequency

  Top-right = Hotspot (frequent changes + complex = high risk)
  Bottom-left = Safe zone (few changes + simple = low risk)
  Bottom-right = Monitor (frequent changes but low complexity)
  Top-left = Latent risk (complex but few changes)
```

### 3.4 Cost Calculation Template

```python
"""Business cost calculation for technical debt"""
from dataclasses import dataclass


@dataclass
class DebtCostEstimation:
    """Technical debt cost estimate"""

    # Team information
    team_size: int = 8
    developer_hourly_rate: int = 5000  # currency/hour
    working_hours_per_week: int = 40
    working_weeks_per_year: int = 50

    # Overhead due to debt (hours/week/person)
    bug_fix_overhead: float = 1.0        # Additional time for bug fixes
    feature_dev_overhead: float = 1.5    # Complexity cost for feature development
    onboarding_overhead: float = 0.5     # Onboarding cost (team average)
    manual_process_overhead: float = 0.75 # Manual testing/deployment
    incident_overhead: float = 0.25      # Additional time for incident response
    context_switching: float = 0.5       # Context switching due to technical issues

    @property
    def weekly_overhead_per_person(self) -> float:
        """Weekly overhead per person (hours)"""
        return (
            self.bug_fix_overhead +
            self.feature_dev_overhead +
            self.onboarding_overhead +
            self.manual_process_overhead +
            self.incident_overhead +
            self.context_switching
        )

    @property
    def weekly_overhead_total(self) -> float:
        """Total weekly overhead for the entire team (hours)"""
        return self.weekly_overhead_per_person * self.team_size

    @property
    def productivity_loss_percentage(self) -> float:
        """Productivity loss rate (%)"""
        return (self.weekly_overhead_per_person / self.working_hours_per_week) * 100

    @property
    def annual_cost(self) -> int:
        """Annual cost"""
        return int(
            self.weekly_overhead_total *
            self.developer_hourly_rate *
            self.working_weeks_per_year
        )

    def print_report(self) -> None:
        """Output cost report"""
        print("=" * 60)
        print("  Technical Debt Cost Report")
        print("=" * 60)
        print(f"\n  Team Size:   {self.team_size} people")
        print(f"  Hourly Rate: {self.developer_hourly_rate:,}/hour")

        print(f"\n  --- Weekly Overhead (per person) ---")
        items = [
            ("Additional bug fix time", self.bug_fix_overhead),
            ("Feature complexity cost", self.feature_dev_overhead),
            ("Onboarding cost", self.onboarding_overhead),
            ("Manual processes", self.manual_process_overhead),
            ("Incident response", self.incident_overhead),
            ("Context switching", self.context_switching),
        ]
        for name, hours in items:
            print(f"    {name:<28s} {hours:5.2f} hours/week")

        print(f"    {'─' * 36}")
        print(f"    {'Total':<28s} {self.weekly_overhead_per_person:5.2f} hours/week/person")

        print(f"\n  --- Impact Summary ---")
        print(f"    Team Weekly Overhead:     {self.weekly_overhead_total:,.0f} hours/week")
        print(f"    Productivity Loss:        {self.productivity_loss_percentage:.1f}%")
        print(f"    Weekly Cost:              {int(self.weekly_overhead_total * self.developer_hourly_rate):>12,}")
        print(f"    Monthly Cost:             {int(self.weekly_overhead_total * self.developer_hourly_rate * 4):>12,}")
        print(f"    Annual Cost:              {self.annual_cost:>12,}")

        print(f"\n  --- Return on Investment (example) ---")
        investment = self.annual_cost * 0.3  # Invest 30% of annual cost
        savings = self.annual_cost * 0.5     # Expect 50% improvement
        print(f"    Investment (30% effort):  {int(investment):>12,}")
        print(f"    Expected savings (50%):   {int(savings):>12,}")
        print(f"    Net gain:                 {int(savings - investment):>12,}")
        print(f"    ROI:                      {(savings - investment) / investment * 100:>11.0f}%")
        print("=" * 60)


# Usage example
cost = DebtCostEstimation(
    team_size=8,
    developer_hourly_rate=5000,
    bug_fix_overhead=1.0,
    feature_dev_overhead=1.5,
    onboarding_overhead=0.5,
    manual_process_overhead=0.75,
    incident_overhead=0.25,
    context_switching=0.5,
)
cost.print_report()

# Sample output:
# Team Weekly Overhead: 36.0 hours/week
# Productivity Loss:    11.3%
# Annual Cost:          9,000,000
# ROI:                         67%
```

---

## 4. Explaining to Management

### 4.1 Using the Financial Metaphor

When explaining technical debt to management and stakeholders, consistently use the financial debt metaphor:

```
Explanation Template for Management

┌─────────────────────────────────────────────────────┐
│  "Technical Debt" = Software Mortgage                │
│                                                     │
│  ● Principal: Low-quality code (building defects)   │
│  ● Interest: Slower development (extra monthly      │
│              maintenance costs)                     │
│  ● Bankruptcy: Unable to add new features           │
│                (needs complete rebuild)             │
│                                                     │
│  Current status:                                    │
│    Annual interest = approx. 9,000,000              │
│    (8 devs × 4.5 hrs/week × 50 weeks × 5,000/hr)   │
│                                                     │
│  Proposal:                                          │
│    Investment = 2,700,000 (20% of dev time × 3 mo) │
│    Expected: reduce interest by 50%                 │
│    → Annual cost reduction of 4,500,000             │
│    Payback period = approx. 7 months                │
│                                                     │
│  If ignored:                                        │
│    Interest grows 20-30% annually (compound)        │
│    Annual interest after 2 years = approx. 14M      │
│    New feature development speed drops to 60%       │
└─────────────────────────────────────────────────────┘
```

### 4.2 Visualization Graphs

```
  Development Velocity Trend (% of time available for new features)

  100% |***
       | * **
   80% |    * *
       |      * *
   60% |        * *
       |          * *      ← If debt is left unaddressed
   40% |            * *
       |              * *
   20% |                **   ← "Barely keeping up with interest payments"
       |                  **
    0% +----+----+----+----+----+----+
       Y0   Y1   Y2   Y3   Y4   Y5

  vs.

  100% |***
       | * **
   80% |    * *
       |      * **          ← With planned debt repayment
   70% |         * *  * * * * * *
       |           **
   60% |                    ← Temporary slowdown (repayment investment)
       |
       +----+----+----+----+----+----+
       Y0   Y1   Y2   Y3   Y4   Y5
```

### 4.3 Elevator Pitch

```
30-second explanation of technical debt:

"We are paying invisible 'interest' every month.
 11% of the development team's time is spent on
 work that wouldn't be necessary if not for past
 quality compromises.

 That amounts to roughly 9,000,000 per year.

 By investing 20% of development time for 3 months,
 we can cut this interest in half.

 We recover the investment in 7 months,
 and then save 4,500,000 per year on an ongoing basis."
```

---

## 5. Repayment Strategies

### 5.1 Overview of Strategies

```
Repayment Strategy Pyramid

                 ┌───────────┐
                 │ Strangler │  4-6 months
                 │   Fig     │  Fundamental replacement
                 ├───────────┤
                 │  Technical │  Quarterly
                 │  Debt      │  Intensive repayment
                 │  Sprint    │
                 ├───────────┤
                 │  20% Rule  │  Every sprint
                 │  (20% of  │  Planned repayment
                 │   sprint)  │
                 ├───────────┤
                 │   Boy Scout         │  Daily
                 │   Rule              │  Small improvements
                 └─────────────────────┘

  From bottom to top:
  - Cost increases
  - Effect increases
  - Risk increases
  - Frequency decreases
```

### 5.2 Boy Scout Rule

```python
"""Boy Scout Rule: leave the code a little cleaner than you found it"""

# === Example 1: Improving variable names ===

# Before (state when found)
def calc(d, r):
    return d * r * 0.01

# After (leave it a little cleaner)
def calculate_discount(price: float, rate_percent: float) -> float:
    """Calculate discount amount"""
    return price * rate_percent * 0.01


# === Example 2: Removing magic numbers ===

# Before
if user.login_attempts > 5:
    lock_account(user)

# After
MAX_LOGIN_ATTEMPTS = 5

if user.login_attempts > MAX_LOGIN_ATTEMPTS:
    lock_account(user)


# === Example 3: Remove unnecessary comments and add type hints ===

# Before
# Get user
def get_user(id):
    # Get from DB
    user = db.query(User).filter(User.id == id).first()
    return user  # Return user

# After
def get_user(user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()
```

Boy Scout Rule guidelines:

```
Boy Scout Rule Scope

  OK (should apply)             NG (out of scope)
  ┌──────────────────┐        ┌──────────────────┐
  │ ● Improve variable│        │ ● Architecture   │
  │   names           │        │   changes        │
  │ ● Add type hints  │        │ ● Large-scale    │
  │ ● Remove redundant│        │   refactoring    │
  │   comments        │        │ ● API changes    │
  │ ● Extract magic   │        │ ● Data model     │
  │   numbers to      │        │   changes        │
  │   constants       │        │                  │
  │ ● Organize imports│        │                  │
  │ ● Extract small   │        │                  │
  │   functions       │        │                  │
  └──────────────────┘        └──────────────────┘

  Decision criteria: Does it complete within 5 minutes
  and is it a refactoring that doesn't change behavior?
  → Yes: Apply Boy Scout Rule
  → No:  File in debt backlog
```

### 5.3 20% Rule

```python
"""20% Rule: allocate 20% of each sprint to technical debt repayment"""

@dataclass
class SprintCapacity:
    """Sprint capacity management"""
    total_story_points: int
    team_size: int
    sprint_days: int = 10  # 2-week sprint

    @property
    def feature_capacity(self) -> int:
        """Points available for new features (80%)"""
        return int(self.total_story_points * 0.80)

    @property
    def debt_capacity(self) -> int:
        """Points available for debt repayment (20%)"""
        return int(self.total_story_points * 0.20)

    def plan_sprint(
        self,
        feature_backlog: list[dict],
        debt_backlog: list[TechnicalDebtItem]
    ) -> dict:
        """Sprint planning"""
        # Select new features within the 80% budget
        selected_features = []
        remaining_feature_points = self.feature_capacity
        for feature in feature_backlog:
            if feature["points"] <= remaining_feature_points:
                selected_features.append(feature)
                remaining_feature_points -= feature["points"]

        # Select debt within the 20% budget (by priority)
        selected_debt = []
        remaining_debt_points = self.debt_capacity
        sorted_debt = sorted(debt_backlog, key=lambda d: d.priority_score, reverse=True)
        for debt in sorted_debt:
            estimated_points = int(debt.fix_effort_days * 2)  # 1 day ≈ 2 SP
            if estimated_points <= remaining_debt_points:
                selected_debt.append(debt)
                remaining_debt_points -= estimated_points

        return {
            "features": selected_features,
            "debt_items": selected_debt,
            "feature_points_used": self.feature_capacity - remaining_feature_points,
            "debt_points_used": self.debt_capacity - remaining_debt_points,
        }
```

```
Sprint allocation with the 20% Rule

  Sprint 1        Sprint 2        Sprint 3
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │ Feature A  │  │ Feature C  │  │ Feature E  │
  │ Feature B  │  │ Feature D  │  │ Feature F  │
  │            │  │            │  │            │
  │   (80%)    │  │   (80%)    │  │   (80%)    │
  ├────────────┤  ├────────────┤  ├────────────┤
  │ Debt: Test │  │ Debt: Dep  │  │ Debt: API  │
  │ coverage   │  │ updates    │  │ integration│
  │   (20%)    │  │   (20%)    │  │   (20%)    │
  └────────────┘  └────────────┘  └────────────┘

  Exception: urgent releases
  Sprint N (urgent)   Sprint N+1 (catch up)
  ┌────────────┐    ┌────────────┐
  │ Urgent     │    │ Feature G  │
  │ feature    │    │            │
  │  (100%)    │    │   (60%)    │
  │            │    ├────────────┤
  │            │    │ Debt repay │
  │ 0% debt    │    │   (40%)    │
  └────────────┘    └────────────┘
```

### 5.4 Technical Debt Sprint

```python
"""Technical Debt Sprint: intensive repayment once per quarter"""

@dataclass
class DebtSprint:
    """Planning and execution of a technical debt sprint"""
    quarter: str              # "2024-Q2"
    duration_days: int = 10   # 2 weeks
    team_size: int = 8

    def plan(self, debt_backlog: list[TechnicalDebtItem]) -> dict:
        """Plan the debt sprint

        Selection criteria:
        1. Prioritize debt with the highest ROI
        2. Group interdependent debt items
        3. Match team skill sets to debt types
        """
        # Sort by ROI
        sorted_debt = sorted(debt_backlog, key=lambda d: d.roi, reverse=True)

        # Capacity calculation (team × days)
        total_capacity_days = self.team_size * self.duration_days

        selected = []
        remaining_capacity = total_capacity_days

        for debt in sorted_debt:
            if debt.fix_effort_days <= remaining_capacity:
                selected.append(debt)
                remaining_capacity -= debt.fix_effort_days

        # Calculate expected impact
        total_annual_savings = sum(d.annual_interest_cost for d in selected)
        total_investment = sum(d.fix_effort_days for d in selected)

        return {
            "quarter": self.quarter,
            "selected_items": selected,
            "total_investment_days": total_investment,
            "total_annual_savings_days": total_annual_savings,
            "overall_roi": total_annual_savings / max(total_investment, 1),
            "remaining_capacity_days": remaining_capacity,
        }

    def execute_checklist(self) -> list[str]:
        """Debt sprint execution checklist"""
        return [
            "[ ] Define Sprint Goal clearly (with measurable metrics)",
            "[ ] Collect Before metrics (complexity, coverage, duplication)",
            "[ ] Assign owners to each debt item",
            "[ ] Write tests for each change first",
            "[ ] Split into small PRs (1 PR = 1 improvement)",
            "[ ] Share progress in daily standups",
            "[ ] Collect After metrics",
            "[ ] Create Before/After comparison report",
            "[ ] Hold retrospective",
            "[ ] Roll over remaining debt to next sprint",
        ]
```

### 5.5 Debt Backlog Management

```python
"""Technical debt backlog management"""
from datetime import datetime
from typing import Optional


class TechnicalDebtBacklog:
    """Technical debt backlog management class"""

    def __init__(self):
        self._items: list[TechnicalDebtItem] = []

    def add(self, item: TechnicalDebtItem) -> None:
        """Add a debt item"""
        self._items.append(item)

    def get_by_priority(self, top_n: int = 10) -> list[TechnicalDebtItem]:
        """Get items sorted by priority"""
        open_items = [i for i in self._items if i.status == "open"]
        return sorted(open_items, key=lambda i: i.priority_score, reverse=True)[:top_n]

    def get_by_roi(self, top_n: int = 10) -> list[TechnicalDebtItem]:
        """Get items sorted by ROI (for finding Quick Wins)"""
        open_items = [i for i in self._items if i.status == "open"]
        return sorted(open_items, key=lambda i: i.roi, reverse=True)[:top_n]

    def get_quick_wins(self, max_effort_days: float = 1.0) -> list[TechnicalDebtItem]:
        """Quick Win: debt that yields high impact with low effort"""
        return [
            i for i in self._items
            if i.status == "open" and i.fix_effort_days <= max_effort_days
        ]

    def get_stale_items(self, days: int = 90) -> list[TechnicalDebtItem]:
        """Debt that has been left unaddressed for a long time"""
        return [
            i for i in self._items
            if i.status == "open" and i.debt_age_days > days
        ]

    def summary(self) -> dict:
        """Backlog summary"""
        open_items = [i for i in self._items if i.status == "open"]
        resolved = [i for i in self._items if i.status == "resolved"]

        total_effort = sum(i.fix_effort_days for i in open_items)
        total_interest = sum(i.annual_interest_cost for i in open_items)

        by_category = {}
        for item in open_items:
            cat = item.category
            if cat not in by_category:
                by_category[cat] = {"count": 0, "effort": 0.0}
            by_category[cat]["count"] += 1
            by_category[cat]["effort"] += item.fix_effort_days

        by_severity = {}
        for item in open_items:
            sev = item.severity.name
            by_severity[sev] = by_severity.get(sev, 0) + 1

        return {
            "total_open": len(open_items),
            "total_resolved": len(resolved),
            "total_effort_days": total_effort,
            "total_annual_interest_days": total_interest,
            "by_category": by_category,
            "by_severity": by_severity,
            "avg_age_days": (
                sum(i.debt_age_days for i in open_items) / len(open_items)
                if open_items else 0
            ),
        }

    def print_summary(self) -> None:
        """Display backlog summary"""
        s = self.summary()
        print("=" * 50)
        print("  Technical Debt Backlog Summary")
        print("=" * 50)
        print(f"  Open: {s['total_open']}  /  Resolved: {s['total_resolved']}")
        print(f"  Total fix effort: {s['total_effort_days']:.0f} person-days")
        print(f"  Annual interest: {s['total_annual_interest_days']:.0f} person-days")
        print(f"  Average age: {s['avg_age_days']:.0f} days")

        print(f"\n  [By Category]")
        for cat, data in s["by_category"].items():
            print(f"    {cat:<20s} {data['count']:3d} items  ({data['effort']:.0f} person-days)")

        print(f"\n  [By Severity]")
        for sev, count in sorted(s["by_severity"].items()):
            print(f"    {sev:<12s} {count:3d} items")
        print("=" * 50)
```

---

## 6. CI/CD Integration

### 6.1 Tracking Debt Trends with GitHub Actions

```yaml
# .github/workflows/debt-tracking.yml
name: Technical Debt Tracking

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am
  workflow_dispatch:

jobs:
  track-debt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch full history

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install tools
        run: |
          pip install radon coverage safety
          npm install -g jscpd

      - name: Collect metrics
        run: |
          python scripts/collect_debt_metrics.py \
            --output debt-metrics.json

      - name: Check thresholds
        run: |
          python scripts/check_debt_thresholds.py \
            --input debt-metrics.json \
            --max-complexity 8 \
            --min-coverage 80 \
            --max-duplication 5

      - name: Update trend data
        run: |
          python scripts/update_debt_trend.py \
            --input debt-metrics.json \
            --trend-file debt-trend.json

      - name: Post to Slack (if degraded)
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Technical Debt Alert: Quality metrics exceeded threshold",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "Details: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 6.2 Debt Check on PR

```yaml
# .github/workflows/debt-check-pr.yml
name: Debt Check on PR

on:
  pull_request:
    branches: [main]

jobs:
  debt-impact:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check complexity of changed files
        run: |
          # Check complexity of changed Python files
          git diff --name-only origin/main...HEAD -- '*.py' | while read file; do
            if [ -f "$file" ]; then
              radon cc "$file" -n C -s  # Show rank C and above
            fi
          done

      - name: Check for new TODOs
        run: |
          # Check for newly added TODO/FIXME
          new_todos=$(git diff origin/main...HEAD | grep '^+' | grep -cE 'TODO|FIXME|HACK|XXX' || true)
          if [ "$new_todos" -gt 0 ]; then
            echo "::warning::${new_todos} new TODO/FIXME items have been added"
          fi

      - name: Coverage check
        run: |
          pytest --cov=src --cov-report=term --cov-fail-under=80
```

---

## 7. Comparison Tables

### 7.1 Repayment Strategy Comparison

| Strategy | Cost | Scope | Risk | Time to Effect | When to Apply | Frequency |
|------|:------:|:--------:|:------:|:--------:|---------|:--------:|
| Boy Scout Rule | Minimal | Local | Minimal | Immediate | Daily small improvements | Daily |
| 20% Rule | Low | Moderate | Low | 2-4 weeks | Planned quality improvement | Every sprint |
| Technical Debt Sprint | Medium | Broad | Medium | 2-4 weeks | Intensive repayment of accumulated debt | Quarterly |
| Strangler Fig | High | Fundamental | Medium-High | 3-6 months | Incremental replacement of legacy systems | 1-2x per year |
| Full Rewrite | Maximum | Fundamental | Maximum | 6-18 months | Last resort (not recommended) | Very rarely |

### 7.2 Health Indicators

| Metric | Healthy (Green) | Caution (Yellow) | Danger (Red) | Measurement Tool |
|------|:-----------:|:--------------:|:----------:|-----------|
| Test coverage | > 80% | 50-80% | < 50% | coverage.py, Istanbul |
| Code duplication | < 3% | 3-10% | > 10% | jscpd, SonarQube |
| Average complexity (CC) | < 5 | 5-10 | > 10 | radon, ESLint |
| Outdated dependencies | < 5% | 5-20% | > 20% | pip list --outdated |
| Deploy frequency | Daily or more | Weekly | Monthly or less | DORA metrics |
| Lead time | < 1 day | 1-7 days | > 7 days | DORA metrics |
| Known vulnerabilities | 0 | 1-5 | > 5 | Safety, Snyk, Trivy |
| TODO/FIXME density | < 1/1000 lines | 1-5/1000 lines | > 5/1000 lines | grep, SonarQube |

### 7.3 Countermeasures by Debt Quadrant

| Quadrant | Example | Countermeasure | Prevention |
|------|-----|------|--------|
| Prudent × Deliberate | Design compromise to prioritize MVP | File repayment plan when debt is incurred | Include "Repayment Sprint" in acceptance criteria |
| Reckless × Deliberate | Skip tests "no time" | Incrementally add tests with 20% Rule | Require tests in Definition of Done |
| Prudent × Inadvertent | Design flaw discovered after learning | Regular architecture reviews | Culture of continuous learning, study groups |
| Reckless × Inadvertent | Low quality due to skill shortage | Pair programming, code reviews | Solid onboarding, mentoring |

---

## 8. Practice Exercises

### Exercise 1: Classify and Prioritize Debt (Basic)

Classify the following technical debt items into the four quadrants and calculate priority scores.

```
Debt List:
A. "Skipped input validation to meet the release deadline"
B. "Written with React class components, but would use Hooks today"
C. "Team had no test experience, no unit tests were written"
D. "AWS Lambda runtime still on Python 3.8 (EOL)"
E. "DB access directly from Controller (layer violation)"
F. "Admin password hardcoded for demo still remains in code"

For each item:
1. Classification in the four quadrants
2. Assign DebtSeverity
3. Estimate impact, fix_effort_days, frequency, risk
4. Calculate priority_score and ROI
5. Recommended repayment strategy
```

**Expected answer example (Item A):**

```
A. Skipped input validation
  Quadrant: Reckless × Deliberate (quality sacrificed "due to time pressure")
  Severity: CRITICAL (includes security risk)
  impact=5, fix_effort=2.0 days, frequency=5, risk=5
  priority_score = (5 × 5 × 5) / 2.0 = 62.5
  ROI = 25 person-days annual interest / 2 person-days = 12.5
  Strategy: Immediate action (don't wait for 20% Rule due to security risk)
```

### Exercise 2: Cost Estimation and Management Presentation (Applied)

Based on the following team situation, calculate the cost of technical debt and create a one-page presentation for management.

```
Team situation:
- Team size: 6 people
- Developer hourly rate: 6,000/hour
- Test coverage: 45%
- Average complexity: 12.3
- Code duplication rate: 8%
- Outdated dependencies: 15
- Manual deployment (time required: 2 hours/deployment, frequency: 2x/week)
- Average bug fix time: 8 hours (2x industry average)
- New member onboarding: 6 weeks (2x industry average)

Tasks:
1. Use DebtCostEstimation to calculate costs
2. Create a 30-second elevator pitch
3. Propose a 3-phase repayment plan (3 months / 6 months / 12 months)
4. Calculate investment and expected ROI for each phase
```

**Expected output skeleton:**

```
Annual cost ≈ 15,600,000
Productivity loss ≈ 16.7%
3-month plan: CI/CD + test infrastructure → Investment 3,000,000, Annual savings 5,000,000
6-month plan: + Refactoring → Additional investment 2,000,000, Additional savings 3,000,000
12-month plan: + Architecture improvement → Additional investment 4,000,000, Additional savings 4,000,000
```

### Exercise 3: Hotspot Analysis and Repayment Planning (Advanced)

Perform hotspot analysis on an actual Git repository and develop a quarterly debt repayment plan.

```
Steps:
1. Run hotspot analysis on your own project (or an OSS repository)
2. Identify hotspots in the top 10 files
3. Classify each file's debt type (code/architecture/test/infrastructure)
4. Register as TechnicalDebtItem entries
5. Create a quarterly debt sprint plan:
   - Sprint 1 (Week 1-2): Repay Quick Wins
   - Sprint 2 (Week 3-4): Repay High Priority items
   - Sprint 3-6: Continued repayment with 20% Rule
6. Set Before/After metric targets
7. Create a management report

Evaluation criteria:
- Accuracy of hotspot analysis
- Rationality of prioritization
- Feasibility of the plan
- Specificity of metrics
- Persuasiveness of management explanation
```

---

## 9. Anti-patterns

### Anti-pattern 1: Infinite Deferral of "Fix It Later"

```
Bad Pattern:
  Sprint 1: "No time, fix later" → Add TODO comment
  Sprint 2: "No time again" → TODOs multiply
  Sprint 3: "New features are higher priority" → Mountain of TODOs
  Sprint 6: "No one understands the full picture anymore" → Too late
  Sprint 10: "Full rewrite is the only option" → Enormous cost

  Cause: Debt is "invisible," so priority is always below new features

Good Pattern:
  Sprint 1: TODO comment → Immediately file in debt backlog
  Sprint 2: Repay highest-ROI debt in the 20% slot
  Sprint 3: Check score on debt dashboard
  Sprint 4: Debt score improves → Team morale goes up

  Cause: "Visualize" debt and "plan" repayment into the schedule
```

### Anti-pattern 2: Repaying All Debt Simultaneously

```
Bad Pattern:
  "This month is Technical Debt Elimination Month!"
  → All team members tackle different debt items
  → Each improvement ends up half-done
  → New feature development completely stops for a month
  → Lose trust from the business side
  → "Let's never do a technical debt month again"

Good Pattern:
  "This quarter, we complete the top 3 debt items"
  Sprint N:   Test coverage 60% → 80% (whole team focuses)
  Sprint N+1: Build CI/CD pipeline (2 leads)
  Sprint N+2: Automate manual deployments (infrastructure team)
  → Deliver concrete results each sprint
  → Report improvement impact to business side
```

### Anti-pattern 3: Gamifying the Debt Score

```
Bad Pattern:
  "Goal is to get SonarQube score to A"
  → Time spent on meaningless trivial fixes
  → Fundamental structural issues ignored (hard to reflect in score)
  → Score improved, but development speed unchanged

  = Goodhart's Law: When a metric becomes a target, it ceases to be a good metric

Good Pattern:
  "Goal is to improve Developer Experience"
  → Metrics are a "means," not an "end"
  → "Build time reduced from 5 minutes to 1 minute" = tangible improvement
  → "New member onboarding from 6 weeks to 3 weeks" = business value improvement
  → Use metrics for "verification" of improvement
```

### Anti-pattern 4: Completely Prohibiting Debt

```
Bad Pattern:
  "Rule: absolutely no technical debt!"
  → All code must be "perfect" before merging
  → Development speed drops dramatically
  → Miss business opportunities
  → Developer morale drops

Good Pattern:
  "Allow intentional debt strategically"
  1. Temporarily compromise design for MVP release → OK (planned)
  2. Mandate filing in backlog when debt is incurred
  3. Record repayment plan (when, who, how)
  4. Auto-escalation if not repaid within 3 sprints

  Key point: The goal is not "zero debt"
             but "keeping debt within manageable limits"
```

---

## 10. FAQ

### Q1. How do I explain technical debt to management?

**A.** Consistently use the financial metaphor. "Technical debt is like a mortgage. We keep paying monthly interest (additional development costs). Currently, we are paying an estimated 9,000,000 in interest per year. By investing 2,700,000 to repay the principal, we get a 4,500,000 cost reduction starting next year." The key points are: (1) show specific numbers (rate of development slowdown, time spent on bug fixes), (2) show the cost increase if ignored (compound interest), and (3) present it as a return on investment (ROI). Use the "Elevator Pitch" template in Section 4.

### Q2. Should technical debt be reduced to zero?

**A.** It doesn't need to be zero, and it shouldn't be. Like a mortgage, "the right amount of debt" can be strategically useful. What matters are three conditions: (1) debt is visible (dashboard, backlog), (2) interest is within a controllable range (productivity loss < 15%), and (3) a repayment plan exists (20% Rule, quarterly sprint). In the early stages of a new business, it's rational to intentionally incur debt to prioritize speed, and then repay it systematically once product-market fit (PMF) is confirmed.

### Q3. How do I balance technical debt with business demands?

**A.** The most widely used practice is the "20% Rule." Always reserve 20% of sprint capacity for technical debt. This maintains 80% for new feature development while preventing debt from compounding. For urgent business demands, temporarily put 100% into new features, but then dedicate 40% of the next sprint to debt repayment to balance out. The key is forming a team consensus that "debt repayment is not optional, but part of the Definition of Done."

### Q4. Tools like SonarQube show technical debt in "days." How should I interpret that?

**A.** SonarQube's "Technical Debt" is mainly the total time to fix code smells, and does not include architectural debt or test debt. Therefore, SonarQube's numbers are "part of the debt," not "the full picture." The recommended approach is to use SonarQube as one indicator of code quality, combined with multidimensional metrics collection like the DebtMetrics in this guide. Also note that SonarQube's "days" is an estimate of fix effort and does not include interest (the cost of leaving it unaddressed).

### Q5. The debt in a legacy system is so enormous I don't know where to start

**A.** Tackle it with these 3 steps: (1) Use hotspot analysis (Section 3.3) to identify files with "high change frequency and high complexity." Focus on the top 5-10 files. (2) Implement Quick Wins first. Address debt that can be completed within one day and has a high ROI (adding tests, extracting constants, improving naming). Success stories raise team morale. (3) Use the Strangler Fig pattern (see [Legacy Code](./02-legacy-code.md)) to incrementally replace modules. The most important thing is to not try to improve everything at once.

### Q6. How do I accurately estimate the "interest rate" of technical debt?

**A.** Accurate estimation is difficult, but the following proxy metrics are useful: (1) Change lead time -- how many times longer does a change of similar size take compared to before. (2) Bug density trends -- rate of increase in bugs per 1000 lines of new code. (3) Changes in onboarding period -- how long it takes for a new member to work independently. (4) Deployment failure rate trends. If these indicators are trending worse, it means interest is increasing. Track trends in 3-6 month intervals and strengthen repayment if deterioration is observed.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Rather than theory alone, understanding deepens through actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend firmly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in actual practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| Definition of technical debt | Future additional costs incurred by sacrificing quality (Ward Cunningham, 1992) |
| Four-quadrant model | Classified by deliberate/inadvertent × prudent/reckless (Martin Fowler) |
| Interest concept | Without repayment, compounds and continuously slows development speed |
| Visualization | Metrics collection (complexity, coverage, duplication, dependencies), dashboard, hotspot analysis |
| Cost calculation | Quantify annual interest as a monetary amount and propose repayment as ROI |
| Boy Scout Rule | Implement small improvements completable within 5 minutes daily |
| 20% Rule | Always reserve 20% of sprint capacity for debt repayment |
| Debt Sprint | Once per quarter, intensively repay the highest-ROI debt items |
| Prioritization | Calculated by impact × frequency × risk / effort; also consider ROI |
| Anti-patterns | Infinite deferral, repaying all debt at once, gamifying scores, prohibiting all debt |

---

## Next Guides to Read

- [Legacy Code](./02-legacy-code.md) -- Safe techniques for modifying legacy code, including the Strangler Fig pattern
- [Continuous Improvement](./04-continuous-improvement.md) -- Automating CI/CD pipelines and quality metrics
- [Code Smells](./00-code-smells.md) -- A smell catalog for early detection of debt symptoms
- [Refactoring Techniques](./01-refactoring-techniques.md) -- Concrete methods for repaying debt
- [Testing Principles](../01-practices/04-testing-principles.md) -- Resolving test debt and building a quality foundation
- [Code Review Checklist](../03-practices-advanced/04-code-review-checklist.md) -- Preventing debt from accumulating through reviews
- [Error Handling](../01-practices/02-error-handling.md) -- Reducing failure risk through robust error handling

---

## References

1. **Managing Technical Debt** -- Philippe Kruchten, Robert Nord, Ipek Ozkaya (Addison-Wesley, 2019) -- SEI/CMU academic and practical framework for technical debt. Provides a systematic approach to debt classification, measurement, and management
2. **Refactoring: Improving the Design of Existing Code, 2nd Edition** -- Martin Fowler (Addison-Wesley, 2018) -- Refactoring catalog for improving code quality. Essential reading as a concrete method for debt repayment
3. **Technical Debt Quadrant** -- Martin Fowler (Blog, 2009) -- https://martinfowler.com/bliki/TechnicalDebtQuadrant.html -- Original source of the four-quadrant model
4. **Software Design X-Rays** -- Adam Tornhill (Pragmatic Programmers, 2018) -- Practical guide to hotspot analysis using Git history (Code as a Crime Scene). Technique for prioritizing refactoring by change frequency × complexity
5. **Accelerate: The Science of Lean Software and DevOps** -- Nicole Forsgren, Jez Humble, Gene Kim (IT Revolution, 2018) -- DORA metrics and organizational performance research. Evidence of the impact of ignoring technical debt on development speed
6. **A Mess is not a Technical Debt** -- Robert C. Martin (Blog, 2009) -- An important discussion by Uncle Bob on distinguishing "messy code" from "technical debt"
7. **The Financial Implications of Technical Debt** -- Steve McConnell (2007) -- Classification of intentional/unintentional debt and a business framework for debt management
