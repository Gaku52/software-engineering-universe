# AI Code Review -- Automated Review and Quality Checks

> Understand how to automate code reviews using AI and implement quality check processes, building a system that significantly improves review speed and accuracy.

---

## What You Will Learn in This Chapter

1. **Leveraging AI Code Review Tools** -- Learn how to implement automated reviews using CodeRabbit, Claude Code, and similar tools
2. **Systematizing Review Perspectives** -- Understand how to distinguish between issues AI should detect and issues requiring human judgment
3. **Optimizing the Review Process** -- Establish methods to achieve both efficiency and quality through AI+human hybrid reviews


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [AI Testing -- Test Generation and Coverage Improvement](./00-ai-testing.md)

---

## 1. Overview of AI Code Review

### 1.1 Evolution of the Review Process

```
Traditional Code Review              AI Hybrid Review
┌─────────────────┐              ┌─────────────────────┐
│                 │              │                     │
│  Developer      │              │  Developer          │
│  creates PR     │              │  creates PR         │
│      │          │              │      │              │
│      ▼          │              │      ▼              │
│  Reviewer reads │              │  AI auto-review     │
│  all code       │              │  (completes in sec) │
│  (30min-2hrs)   │              │      │              │
│      │          │              │      ▼              │
│      ▼          │              │  Developer fixes    │
│  Write comments │              │  AI-flagged issues  │
│      │          │              │      │              │
│      ▼          │              │      ▼              │
│  Fix → Re-review│              │  Human reviewer     │
│  (repeat)       │              │  checks remaining   │
│      │          │              │  20% (10-20min)     │
│      ▼          │              │      │              │
│  Merge          │              │      ▼              │
│  (avg 2-3 days) │              │  Merge              │
│                 │              │  (avg few hours)    │
└─────────────────┘              └─────────────────────┘
```

### 1.2 Scope of Issues AI Review Can Detect

```
┌──────────────────────────────────────────────────────┐
│          AI Review Detection Capability Map           │
│                                                      │
│  Detection Accuracy: High                            │
│  ┌──────────────────────────────────────────────┐    │
│  │ - Coding convention violations                │    │
│  │ - Unused variables/imports                    │    │
│  │ - Type mismatches                             │    │
│  │ - Known security patterns (SQLi, XSS, etc.)  │    │
│  │ - Common performance issues (N+1, etc.)       │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Detection Accuracy: Moderate                        │
│  ┌──────────────────────────────────────────────┐    │
│  │ - Inappropriate use of design patterns        │    │
│  │ - Inadequate error handling                   │    │
│  │ - Insufficient tests                          │    │
│  │ - Naming improvement suggestions              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Detection Accuracy: Low (human required)            │
│  ┌──────────────────────────────────────────────┐    │
│  │ - Correctness of business logic               │    │
│  │ - Validity of architecture                    │    │
│  │ - Impact on user experience                   │    │
│  │ - Organization-specific operational rules     │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## 2. Implementing AI Review Tools

### Code Example 1: CodeRabbit Configuration

```yaml
# .coderabbit.yaml - CodeRabbit configuration file
language: "ja"  # Review in Japanese

reviews:
  profile: "assertive"  # Review assertively
  request_changes_workflow: true
  high_level_summary: true
  poem: false

  review_comment:
    nitpick: true
    security: true
    performance: true

  path_instructions:
    - path: "src/domain/**"
      instructions: |
        Domain layer review:
        - Verify no external dependencies
        - Check business rule invariants
        - Ensure domain events are properly emitted
    - path: "src/api/**"
      instructions: |
        API layer review:
        - Missing input validation
        - Error response format consistency
        - Authentication/authorization checks
    - path: "tests/**"
      instructions: |
        Test review:
        - Whether assertions are meaningful
        - Whether edge cases are covered
        - Whether test independence is maintained

chat:
  auto_reply: true
```

### Code Example 2: Running Reviews with Claude Code

```bash
# PR review using Claude Code

# Method 1: Review git diff
claude "Review the changes in git diff main...HEAD.
       Check the following aspects:
       1. Security: input validation, authentication, encryption
       2. Performance: N+1, memory leaks, complexity
       3. Maintainability: SOLID principles, naming, complexity
       4. Tests: coverage, edge cases
       Assign severity (Critical/Major/Minor) to each issue"

# Method 2: Review a GitHub PR
claude "Review the changes in gh pr view 123.
       Also check compliance with CLAUDE.md conventions"

# Method 3: Review a specific file
claude "Review recent changes to src/services/payment.py.
       Focus especially on payment logic security"
```

### Code Example 3: Custom Review Script

```python
#!/usr/bin/env python3
"""AI automated review script"""

import subprocess
import json

def get_diff() -> str:
    """Get PR diff"""
    result = subprocess.run(
        ["git", "diff", "main...HEAD", "--unified=5"],
        capture_output=True, text=True
    )
    return result.stdout

def get_changed_files() -> list[str]:
    """Get list of changed files"""
    result = subprocess.run(
        ["git", "diff", "--name-only", "main...HEAD"],
        capture_output=True, text=True
    )
    return result.stdout.strip().split("\n")

def categorize_changes(files: list[str]) -> dict[str, list[str]]:
    """Categorize changed files"""
    categories = {
        "domain": [], "api": [], "infra": [],
        "test": [], "config": [], "other": []
    }
    for f in files:
        if "domain" in f: categories["domain"].append(f)
        elif "api" in f or "presentation" in f: categories["api"].append(f)
        elif "infra" in f: categories["infra"].append(f)
        elif "test" in f: categories["test"].append(f)
        elif f.endswith((".yaml", ".toml", ".json")): categories["config"].append(f)
        else: categories["other"].append(f)
    return categories

def generate_review_prompt(diff: str, categories: dict) -> str:
    """Generate a review prompt based on categories"""
    prompt = f"""Please review the following code changes.

## Change Summary
{json.dumps(categories, indent=2, ensure_ascii=False)}

## Review Perspectives
- Critical: Security vulnerabilities, data loss risk
- Major: Bugs, performance issues, design violations
- Minor: Naming improvements, adding comments, refactoring suggestions

## Diff
```diff
{diff}
```

Output in JSON format:
{{"findings": [{{"severity": "...", "file": "...", "line": N, "message": "..."}}]}}
"""
    return prompt

if __name__ == "__main__":
    diff = get_diff()
    files = get_changed_files()
    categories = categorize_changes(files)
    prompt = generate_review_prompt(diff, categories)

    # Pass to Claude Code for execution
    result = subprocess.run(
        ["claude", "-p", prompt],
        capture_output=True, text=True
    )
    print(result.stdout)
```

### Code Example 4: Automated Review with GitHub Actions

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get PR diff
        id: diff
        run: |
          git diff origin/main...HEAD > /tmp/pr-diff.txt
          echo "lines=$(wc -l < /tmp/pr-diff.txt)" >> $GITHUB_OUTPUT

      - name: AI Review (small PR)
        if: steps.diff.outputs.lines < 500
        uses: coderabbitai/ai-pr-reviewer@latest
        with:
          debug: false
          review_simple_changes: true
          review_comment_lgtm: false

      - name: AI Review (large PR)
        if: steps.diff.outputs.lines >= 500
        run: |
          echo "::warning::PR is too large (${lines} lines). Consider splitting it."
          # Only generate a summary for large PRs
```

### Code Example 5: Review Comment Template

```markdown
<!-- AI Review Comment Template -->

## AI Automated Review Results

### Critical (Immediate fix required)
- [ ] `src/auth/login.py:42` - Possible SQL injection.
      Please use parameterized queries.

### Major (Fix recommended before merge)
- [ ] `src/services/order.py:128` - N+1 query detected.
      Please use `selectinload` for eager loading.
- [ ] `src/api/users.py:55` - Insufficient input validation.
      Please add format checking for the email field.

### Minor (Improvement suggestions)
- [ ] `src/utils/helpers.py:12` - Function name `proc` is ambiguous.
      Please use a specific name like `process_payment_result`.
- [ ] `tests/test_order.py:89` - Assertion is only `is not None`.
      Please add verification of specific values.

### Positive Findings
- Test coverage meets the standard at 85%
- Domain model design is consistent
- Error handling is properly implemented

---
*This review was auto-generated by AI. Confirmation by a human reviewer is also required.*
```

---

## 3. Review Efficiency Comparison

### 3.1 Comparison by Review Method

| Method | Time Required | Detection Rate | Cost | Use Case |
|--------|--------------|----------------|------|----------|
| Human only | 30-120 min | 60-70% | High | Changes requiring design judgment |
| AI+Human | 10-30 min | 85-90% | Medium | Standard PRs |
| AI only | 1-2 min | 50-60% | Low | Bot account commits |
| Linter+AI | 5-10 min | 75-80% | Low | Routine changes |

### 3.2 AI Review Tool Comparison

| Tool | Supported Platforms | Language Support | Pricing | Features |
|------|-------------------|-----------------|---------|----------|
| CodeRabbit | GitHub/GitLab | Multi-language | $15/mo+ | PR summaries, line-by-line review |
| Graphite | GitHub | Multi-language | Free+ | Stacked PR integration |
| Claude Code | CLI | Multi-language | Pay-per-use | Deep context understanding |
| Amazon CodeGuru | AWS | Java/Python | Pay-per-use | AWS service integration |
| Bito | GitHub/GitLab | Multi-language | Free+ | Security-focused |

---

## 4. Operating Hybrid Reviews

```
┌──────────────────────────────────────────────────────┐
│         Hybrid Review Operational Flow                │
│                                                      │
│  PR Created                                          │
│    │                                                 │
│    ├──► AI Review (automatic, within 2 min)          │
│    │     ├── Critical → Block (merge not allowed)    │
│    │     ├── Major → Request changes                 │
│    │     └── Minor → Comment                         │
│    │                                                 │
│    ├──► Static Analysis (automatic, within 5 min)    │
│    │     ├── Lint / Format / Type Check              │
│    │     └── Security Scan (SAST)                    │
│    │                                                 │
│    └──► Human Review (after AI review)               │
│          ├── Correctness of business logic           │
│          ├── Validity of architecture                │
│          ├── Impact on user experience               │
│          └── Contextual issues AI missed             │
│                                                      │
│  All pass → Merge                                    │
└──────────────────────────────────────────────────────┘
```

---

## 5. Automating Security Reviews

### 5.1 Security-Focused Review Configuration

```python
# Automate AI review from a security perspective

class SecurityReviewEngine:
    """Security-focused AI code review engine"""

    SECURITY_PATTERNS = {
        "sql_injection": {
            "patterns": [
                r"f\".*SELECT.*{.*}\"",
                r"\.format\(.*\).*(?:SELECT|INSERT|UPDATE|DELETE)",
                r"\+.*(?:SELECT|INSERT|UPDATE|DELETE)",
            ],
            "severity": "critical",
            "message": "Possible SQL injection. Please use parameterized queries.",
            "fix_example": """
# BAD
query = f"SELECT * FROM users WHERE id = {user_id}"

# GOOD
query = "SELECT * FROM users WHERE id = :id"
result = session.execute(text(query), {"id": user_id})
""",
        },
        "xss": {
            "patterns": [
                r"dangerouslySetInnerHTML",
                r"innerHTML\s*=",
                r"document\.write\(",
            ],
            "severity": "critical",
            "message": "Possible XSS (Cross-Site Scripting) vulnerability.",
        },
        "hardcoded_secret": {
            "patterns": [
                r"(?:password|secret|api_key|token)\s*=\s*['\"][^'\"]+['\"]",
                r"(?:AWS_SECRET|PRIVATE_KEY)\s*=\s*['\"]",
            ],
            "severity": "critical",
            "message": "Contains hardcoded sensitive information. Please use environment variables.",
        },
        "insecure_random": {
            "patterns": [
                r"random\.random\(\)",
                r"Math\.random\(\)",
            ],
            "severity": "major",
            "message": "Please use a cryptographically secure random number generator for security purposes.",
            "fix_example": """
# BAD
import random
token = random.randint(0, 999999)

# GOOD
import secrets
token = secrets.token_urlsafe(32)
""",
        },
        "path_traversal": {
            "patterns": [
                r"open\(.*\+.*\)",
                r"os\.path\.join\(.*request",
            ],
            "severity": "critical",
            "message": "Possible path traversal vulnerability. Please validate input paths.",
        },
    }

    def review_file(self, file_content: str, filename: str) -> list[dict]:
        """Review a file from a security perspective"""
        import re
        findings = []

        for vuln_type, config in self.SECURITY_PATTERNS.items():
            for pattern in config["patterns"]:
                for i, line in enumerate(file_content.split("\n"), 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        findings.append({
                            "type": vuln_type,
                            "severity": config["severity"],
                            "file": filename,
                            "line": i,
                            "code": line.strip(),
                            "message": config["message"],
                            "fix_example": config.get("fix_example", ""),
                        })

        return findings

    def generate_security_report(self, findings: list[dict]) -> str:
        """Generate a security review results report"""
        if not findings:
            return "No security issues were detected."

        critical = [f for f in findings if f["severity"] == "critical"]
        major = [f for f in findings if f["severity"] == "major"]

        report = "## Security Review Results\n\n"
        report += f"Issues detected: {len(findings)} "
        report += f"(Critical: {len(critical)}, Major: {len(major)})\n\n"

        if critical:
            report += "### Critical (Immediate fix required)\n\n"
            for f in critical:
                report += f"- **{f['type']}** - `{f['file']}:{f['line']}`\n"
                report += f"  {f['message']}\n"
                report += f"  ```\n  {f['code']}\n  ```\n"
                if f.get("fix_example"):
                    report += f"  Fix example:\n  ```python\n{f['fix_example']}\n  ```\n"

        if major:
            report += "### Major (Fix recommended before merge)\n\n"
            for f in major:
                report += f"- **{f['type']}** - `{f['file']}:{f['line']}`\n"
                report += f"  {f['message']}\n"

        return report
```

### 5.2 Dependency Security Auditing

```python
# Integrate dependency vulnerability checking into AI review

class DependencyAuditor:
    """Dependency security auditing"""

    def audit_npm_dependencies(self, package_json_path: str) -> dict:
        """Check npm package vulnerabilities"""
        import subprocess
        result = subprocess.run(
            ["npm", "audit", "--json"],
            capture_output=True, text=True,
            cwd=str(Path(package_json_path).parent),
        )

        try:
            audit_data = json.loads(result.stdout)
        except json.JSONDecodeError:
            return {"error": "Failed to execute npm audit"}

        vulnerabilities = audit_data.get("vulnerabilities", {})
        summary = {
            "total": len(vulnerabilities),
            "critical": 0,
            "high": 0,
            "moderate": 0,
            "low": 0,
            "details": [],
        }

        for pkg_name, vuln_info in vulnerabilities.items():
            severity = vuln_info.get("severity", "unknown")
            if severity in summary:
                summary[severity] += 1
            summary["details"].append({
                "package": pkg_name,
                "severity": severity,
                "title": vuln_info.get("title", ""),
                "url": vuln_info.get("url", ""),
                "fix_available": vuln_info.get("fixAvailable", False),
            })

        return summary

    def generate_ai_review_comment(self, audit_result: dict) -> str:
        """Convert audit results to PR comment format"""
        if audit_result.get("total", 0) == 0:
            return "No known vulnerabilities found in dependencies."

        comment = "## Dependency Security Audit\n\n"
        comment += f"| Severity | Count |\n|----------|-------|\n"
        comment += f"| Critical | {audit_result['critical']} |\n"
        comment += f"| High | {audit_result['high']} |\n"
        comment += f"| Moderate | {audit_result['moderate']} |\n"
        comment += f"| Low | {audit_result['low']} |\n\n"

        fixable = [d for d in audit_result["details"] if d["fix_available"]]
        if fixable:
            comment += "### Auto-fixable Vulnerabilities\n\n"
            comment += "The following vulnerabilities can be fixed with `npm audit fix`:\n\n"
            for d in fixable:
                comment += f"- **{d['package']}** ({d['severity']}): {d['title']}\n"

        return comment
```

---

## 6. Visualizing Review Quality Metrics

### 6.1 Measuring Review Efficiency

```python
# System for quantitatively measuring the effectiveness of AI review

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

@dataclass
class ReviewMetric:
    """Data point for review metrics"""
    pr_number: int
    pr_size: int              # Lines changed
    ai_review_time_sec: float  # AI review duration
    human_review_time_min: float  # Human review duration
    ai_findings: int           # Issues detected by AI
    human_findings: int        # Issues detected by humans
    ai_false_positives: int    # AI false positive count
    ai_true_positives: int     # AI true positive count
    time_to_merge_hours: float  # Time from PR creation to merge
    post_merge_bugs: int = 0   # Bugs found after merge

@dataclass
class ReviewDashboard:
    """Review quality dashboard"""
    metrics: list[ReviewMetric] = field(default_factory=list)

    @property
    def ai_precision(self) -> float:
        """AI review precision (True Positive rate)"""
        total_findings = sum(m.ai_findings for m in self.metrics)
        true_positives = sum(m.ai_true_positives for m in self.metrics)
        return true_positives / total_findings if total_findings > 0 else 0

    @property
    def avg_time_to_merge(self) -> float:
        """Average time to merge (hours)"""
        if not self.metrics:
            return 0
        return sum(m.time_to_merge_hours for m in self.metrics) / len(self.metrics)

    @property
    def avg_human_review_time(self) -> float:
        """Average human review time (minutes)"""
        if not self.metrics:
            return 0
        return sum(m.human_review_time_min for m in self.metrics) / len(self.metrics)

    @property
    def bug_escape_rate(self) -> float:
        """Bug escape rate"""
        total_prs = len(self.metrics)
        if total_prs == 0:
            return 0
        prs_with_bugs = sum(1 for m in self.metrics if m.post_merge_bugs > 0)
        return prs_with_bugs / total_prs

    def generate_weekly_report(self) -> str:
        """Generate weekly review quality report"""
        return f"""
## Code Review Quality Report

### Summary
- Target PRs: {len(self.metrics)}
- AI Precision: {self.ai_precision:.1%}
- Average Merge Time: {self.avg_time_to_merge:.1f} hours
- Average Human Review Time: {self.avg_human_review_time:.0f} min
- Bug Escape Rate: {self.bug_escape_rate:.1%}

### AI Detection Breakdown
- Total Detections: {sum(m.ai_findings for m in self.metrics)}
- True Positives: {sum(m.ai_true_positives for m in self.metrics)}
- False Positives: {sum(m.ai_false_positives for m in self.metrics)}
- Human-only Detections: {sum(m.human_findings for m in self.metrics)}

### Trends
- Merge Time vs Last Week: {self._calc_trend('time_to_merge_hours')}
- AI Precision vs Last Week: {self._calc_trend('ai_precision')}
"""

    def _calc_trend(self, metric_name: str) -> str:
        """Calculate trend (simplified implementation)"""
        return "Improving" if len(self.metrics) > 0 else "Insufficient data"
```

### 6.2 Classification and Analysis of Review Comments

```python
# Track and improve AI review comment quality

class ReviewCommentAnalyzer:
    """Analyze review comments and use insights to improve AI configuration"""

    def categorize_comments(self, comments: list[dict]) -> dict:
        """Classify comments by category"""
        categories = {
            "security": [],
            "performance": [],
            "maintainability": [],
            "correctness": [],
            "style": [],
            "documentation": [],
            "test": [],
            "other": [],
        }

        category_keywords = {
            "security": ["security", "vulnerability", "authentication", "authorization",
                         "injection", "XSS", "CSRF"],
            "performance": ["performance", "N+1", "memory", "cache",
                           "index", "complexity"],
            "maintainability": ["maintainability", "refactor", "SOLID", "complexity",
                                "responsibility", "dependency"],
            "correctness": ["bug", "error", "exception", "null",
                           "boundary", "race condition"],
            "style": ["naming", "format", "convention", "indentation"],
            "documentation": ["document", "comment", "docstring",
                              "README"],
            "test": ["test", "coverage", "assertion", "mock"],
        }

        for comment in comments:
            text = comment.get("body", "").lower()
            categorized = False
            for cat, keywords in category_keywords.items():
                if any(kw.lower() in text for kw in keywords):
                    categories[cat].append(comment)
                    categorized = True
                    break
            if not categorized:
                categories["other"].append(comment)

        return categories

    def analyze_acceptance_rate(self, comments: list[dict]) -> dict:
        """Analyze comment acceptance rate"""
        total = len(comments)
        accepted = sum(1 for c in comments if c.get("resolved", False))
        dismissed = sum(1 for c in comments if c.get("dismissed", False))
        pending = total - accepted - dismissed

        return {
            "total": total,
            "accepted": accepted,
            "dismissed": dismissed,
            "pending": pending,
            "acceptance_rate": accepted / total if total > 0 else 0,
            "dismiss_rate": dismissed / total if total > 0 else 0,
        }

    def suggest_config_improvements(self, analysis: dict) -> list[str]:
        """Generate AI configuration improvement suggestions from analysis results"""
        suggestions = []

        if analysis.get("dismiss_rate", 0) > 0.4:
            suggestions.append(
                "False positive rate is high (over 40%). Review path_instructions "
                "and add project-specific rules."
            )

        style_ratio = len(analysis.get("categories", {}).get("style", [])) / max(analysis.get("total", 1), 1)
        if style_ratio > 0.5:
            suggestions.append(
                "Style-related comments exceed 50%. Auto-fix with Linter/Formatter "
                "and exclude from AI review scope."
            )

        return suggestions
```

---

## 7. Advanced Review Techniques

### 7.1 Architecture-Level Review

```python
# Review at the architecture level, not individual files

ARCHITECTURE_REVIEW_PROMPT = """
Please review the following PR changes from an architectural perspective.

## Changed Files
{changed_files}

## Review Perspectives
1. Are layer dependencies correct?
   - Does the domain layer depend on external layers?
   - Does the presentation layer depend directly on the infrastructure layer?

2. Boundary consistency
   - Are API contracts between microservices maintained?
   - Are there new dependencies on shared databases?

3. Design pattern consistency
   - Do changes follow existing patterns (Repository, Service, Factory, etc.)?
   - If introducing a new pattern, is the rationale valid?

4. Extensibility and testability
   - Are interfaces properly defined?
   - Is dependency injection used?
   - Is the design easy to mock?

## Diff
{diff}

## Output Format
List architectural issues in order of severity.
Provide specific improvement suggestions for each issue.
"""

class ArchitectureReviewer:
    """Architecture-level code review"""

    def __init__(self, architecture_rules: dict):
        self.rules = architecture_rules

    def check_layer_violations(self, changed_files: list[str],
                                imports: dict[str, list[str]]) -> list[dict]:
        """Detect layer dependency violations"""
        violations = []
        layer_order = self.rules.get("layer_order", [
            "domain", "usecase", "interface", "infrastructure"
        ])

        for file_path, file_imports in imports.items():
            file_layer = self._detect_layer(file_path)
            if not file_layer:
                continue

            file_layer_idx = layer_order.index(file_layer) if file_layer in layer_order else -1

            for imp in file_imports:
                imp_layer = self._detect_layer(imp)
                if not imp_layer:
                    continue

                imp_layer_idx = layer_order.index(imp_layer) if imp_layer in layer_order else -1

                # Inner layer depends on outer layer
                if file_layer_idx < imp_layer_idx:
                    violations.append({
                        "type": "layer_violation",
                        "severity": "major",
                        "file": file_path,
                        "import": imp,
                        "message": (
                            f"The {file_layer} layer depends on the {imp_layer} layer. "
                            f"Please apply the Dependency Inversion Principle (DIP)."
                        ),
                    })

        return violations

    def _detect_layer(self, path: str) -> str:
        """Infer layer from file path"""
        path_lower = path.lower()
        if "domain" in path_lower or "entity" in path_lower:
            return "domain"
        elif "usecase" in path_lower or "service" in path_lower:
            return "usecase"
        elif "controller" in path_lower or "handler" in path_lower:
            return "interface"
        elif "repository" in path_lower or "adapter" in path_lower:
            return "infrastructure"
        return ""
```

### 7.2 Automating Performance Reviews

```python
# Automated review from a performance perspective

class PerformanceReviewer:
    """Review engine for automatically detecting performance issues"""

    PERFORMANCE_PATTERNS = {
        "n_plus_1": {
            "description": "Possible N+1 query",
            "patterns": [
                # SQLAlchemy
                r"for\s+\w+\s+in\s+\w+\.query\.",
                r"for\s+\w+\s+in\s+\w+:\s*\n\s+\w+\.\w+\.",
            ],
            "severity": "major",
            "fix": "Switch to eager loading with joinedload() / selectinload()",
        },
        "unnecessary_serialization": {
            "description": "Unnecessary serialization",
            "patterns": [
                r"json\.dumps\(.*json\.loads\(",
                r"\.to_json\(\).*\.from_json\(",
            ],
            "severity": "minor",
            "fix": "Pass objects directly and eliminate unnecessary conversions",
        },
        "unbounded_query": {
            "description": "Query without LIMIT",
            "patterns": [
                r"\.all\(\)\s*$",
                r"SELECT\s+\*\s+FROM\s+\w+\s*(?!.*LIMIT)",
            ],
            "severity": "major",
            "fix": "Add pagination (LIMIT/OFFSET)",
        },
        "sync_io_in_async": {
            "description": "Synchronous I/O in async context",
            "patterns": [
                r"async\s+def\s+\w+.*:\s*\n(?:.*\n)*?.*\bopen\(",
                r"async\s+def\s+\w+.*:\s*\n(?:.*\n)*?.*requests\.\w+\(",
            ],
            "severity": "major",
            "fix": "Switch to async I/O using aiofiles / httpx",
        },
    }

    def review(self, file_content: str, filename: str) -> list[dict]:
        """Detect performance issues"""
        import re
        findings = []

        for pattern_name, config in self.PERFORMANCE_PATTERNS.items():
            for pattern in config["patterns"]:
                matches = list(re.finditer(pattern, file_content, re.MULTILINE))
                for match in matches:
                    line_num = file_content[:match.start()].count("\n") + 1
                    findings.append({
                        "type": pattern_name,
                        "severity": config["severity"],
                        "file": filename,
                        "line": line_num,
                        "description": config["description"],
                        "fix": config["fix"],
                        "code": match.group(0)[:100],
                    })

        return findings
```

---

## Anti-Patterns

### Anti-Pattern 1: AI Review Becoming a Formality

```
BAD: Ignoring all AI review comments
   - Assuming "AI comments are irrelevant"
   - Dismissing even Critical-level comments
   - AI review is integrated into CI but nobody reads it

GOOD: Continuously improving AI review quality
   - Collect patterns of irrelevant comments
   - Improve .coderabbit.yaml / prompts
   - Monthly team retrospective on AI review accuracy
   - Measure the ratio of useful comments (target: 70%+)
```

### Anti-Pattern 2: Skipping Human Review

```
BAD: "AI approved it, so human review is unnecessary"
   - AI struggles with contextual judgment
   - Only humans can judge business logic correctness
   - Accountability becomes unclear

GOOD: Divide roles between AI and humans
   - AI: Mechanical checks (detects 80% of issues)
   - Human: Judgment-based checks (remaining 20% of critical issues)
   - Reduce human review time, but never skip it entirely
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

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
        """Get processing results"""
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
        assert False, "Should have raised an exception"
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
        """Remove by key"""
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
    """Efficient search using hash map"""
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

    print(f"Inefficient version: {slow_time:.4f} sec")
    print(f"Efficient version:   {fast_time:.6f} sec")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be conscious of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Configuration file issues | Verify configuration file path and format |
| Timeout | Network latency/insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, transaction management |

### Debugging Procedure

1. **Check error messages**: Read the stack trace and identify the location of occurrence
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Verify step by step**: Use log output or debugger to verify hypotheses
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

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Examine disk and network I/O conditions
4. **Check concurrent connections**: Examine connection pool status

| Issue Type | Diagnostic Tool | Countermeasure |
|-----------|----------------|----------------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes decision criteria for technology choices.

| Criterion | When to prioritize | When compromise is acceptable |
|-----------|-------------------|------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  (1) Team size?                                 │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to (2)                   │
│                                                 │
│  (2) Deployment frequency?                      │
│    ├─ Weekly or less → Monolith + module split   │
│    └─ Daily/multiple → Go to (3)                │
│                                                 │
│  (3) Team independence?                         │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A method that is faster in the short term may become technical debt in the long term
- Conversely, over-engineering incurs high short-term costs and can delay the project

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit selection but increases operational costs

**3. Level of Abstraction**
- High abstraction offers high reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

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
            icon = "+" if c['type'] == 'positive' else "!"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum viable set of features
- Automated tests only for the critical path
- Introduce monitoring from the start

**Lessons Learned:**
- Don't strive for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually modernize a system that has been in operation for over 10 years

**Approach:**
- Migrate gradually using the Strangler Fig pattern
- If existing tests are missing, create Characterization Tests first
- Use an API gateway to coexist old and new systems
- Perform data migration in stages

| Phase | Work Content | Estimated Duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Sequential migration from peripheral features | 3-6 months | Medium |
| 4. Core migration | Core feature migration | 6-12 months | High |
| 5. Completion | Decommission legacy system | 2-4 weeks | Medium |

### Scenario 3: Large Team Development

**Situation:** Over 50 engineers developing the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Set ownership per team
- Manage shared libraries using Inner Source
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
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | Use Case |
|--------------------|--------|-------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## FAQ

### Q1: How to handle frequent false positives in AI review?

There are three approaches. (1) Define project-specific rules in configuration files (.coderabbit.yaml, etc.) and exclude false positive patterns. (2) Set review guidelines per directory with path_instructions. (3) Log false positives and run a feedback loop to regularly improve prompts.

### Q2: How to review large PRs (1000+ lines) with AI?

The best practice is to first suggest "it should be split." If that's not feasible, (1) review each file individually, (2) group changes by type (refactoring, new feature, bug fix), and (3) generate a summary first to determine review priorities.

### Q3: How to overcome team resistance when introducing AI reviews?

Gradual introduction is key. (1) First run a pilot on a single repository and demonstrate results with numbers (reduced review time, number of bugs detected, etc.). (2) Propose it as an "ally" that reduces reviewer burden. (3) Make it clear that AI review is a "draft review," not the "final judgment," showing it doesn't threaten human authority.

### Q4: How to optimize AI review settings for a project?

A three-stage approach is effective. (1) **Initial setup (Week 1)**: Start with default settings and record "useful" or "unnecessary" feedback for all comments. (2) **Tuning (Weeks 2-4)**: Adjust path_instructions based on feedback and exclude patterns with high false positive rates. Add project-specific conventions (naming rules, architecture rules, etc.) as custom rules. (3) **Optimization (Week 5+)**: Measure AI accuracy monthly, add new rules and remove unnecessary ones. Adjust severity levels based on team consensus.

### Q5: How to balance review automation with human review?

The basic principle is "AI handles 80% of mechanical checks while humans focus on the 20% of judgment-based checks." Specifically: (1) AI responsibility: coding conventions, security patterns, performance anti-patterns, test coverage, unused code, type safety. (2) Human responsibility: correctness of business logic, validity of architecture, impact on user experience, alignment with team tacit knowledge, decisions about introducing new design patterns. Starting human review after AI review is complete allows humans to focus on high-level judgment.

### Q6: What are the considerations for AI review in a microservices environment?

In microservices: (1) Set rules to detect API contract changes between services (diff check of OpenAPI specs). (2) Have AI verify that shared library changes don't affect other services. (3) Check that database schema changes include migrations. (4) Issues related to distributed transactions and event-driven consistency have low AI detection accuracy, so humans should focus their review on these areas.

---

## Summary

| Item | Key Points |
|------|-----------|
| AI Review Scope | High accuracy for conventions, security, performance; human needed for business logic |
| Key Tools | CodeRabbit, Claude Code, Graphite, Amazon CodeGuru |
| Operating Model | AI auto → fix → human review (remaining 20%) hybrid |
| Effectiveness | 60-70% reduction in review time, 85-90% detection rate |
| Introduction Method | Pilot → measure effectiveness → phased rollout |
| Considerations | Prevent AI review from becoming a formality, maintain human review |

---

## Recommended Next Reads

- [02-ai-documentation.md](./02-ai-documentation.md) -- AI Documentation Generation
- [00-ai-testing.md](./00-ai-testing.md) -- Integration with AI Testing
- [../03-team/00-ai-team-practices.md](../03-team/00-ai-team-practices.md) -- Building a Team Review Culture

---

## References

1. CodeRabbit, "AI Code Review Documentation," 2025. https://docs.coderabbit.ai/
2. Google, "Code Review Developer Guide," 2024. https://google.github.io/eng-practices/review/
3. Microsoft, "How AI is transforming code review at Microsoft," 2024. https://devblogs.microsoft.com/
