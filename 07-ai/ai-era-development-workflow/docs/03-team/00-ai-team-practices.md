# Team Development Practices in the AI Era

> A systematic guide to team development methodologies and best practices adapted for the AI era, including AI pair programming, code sharing, review culture, and productivity improvement.

---

## What You Will Learn in This Chapter

1. **Understand effective AI pair programming practices** and maximize the productivity of the entire team
2. **Design code review and quality management processes leveraging AI** to achieve both quality and speed
3. **Bridge AI literacy gaps within the team** and build a culture where everyone can effectively leverage AI


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. Overview of Team Development in the AI Era

### 1.1 Changes from Traditional Development to AI-Era Development

```
┌──────────────────────────────────────────────────────┐
│           Evolution of Development Workflow           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Traditional              AI Era                     │
│  ───────────             ──────                      │
│                                                      │
│  Requirements  ──────>   AI-Assisted Req. Analysis   │
│  (Days)                  (Hours + LLM Review)        │
│                                                      │
│  Design       ──────>   AI-Generated Design          │
│  (Days)                  + Human Review (Hours)      │
│                                                      │
│  Implementation ─────>  AI Completion/Generation     │
│  (Weeks)                 + Human Oversight (Days)    │
│                                                      │
│  Review       ──────>   AI Pre-Review                │
│  (Days)                  + Human Approval (Hours)    │
│                                                      │
│  Testing      ──────>   AI Test Generation           │
│  (Days)                  + Human Verification (Hours)│
│                                                      │
│  Debugging    ──────>   AI Error Analysis            │
│  (Variable)              + Human Judgment (Much Less)│
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 1.2 Classification of AI Roles Within a Team

```
┌───────────────────────────────────────────────┐
│       AI Role Matrix Within the Team          │
├───────────────────────────────────────────────┤
│                                               │
│  [Pair Programmer]       [Reviewer]           │
│  - Code completion       - Static analysis    │
│  - Refactoring           - Security checks    │
│  - Bug fix suggestions   - Code quality eval  │
│                                               │
│  [Documenter]            [Tester]             │
│  - Auto API doc gen      - Test case gen      │
│  - README maintenance    - Edge case discovery│
│  - Comment organization  - Regression test    │
│                                               │
│  [Architect Assistant]   [Knowledge Base]     │
│  - Design pattern        - Code search        │
│    suggestions           - Past case search   │
│  - Dependency analysis   - Formalizing tacit   │
│  - Tech selection assist   knowledge          │
│                                               │
└───────────────────────────────────────────────┘
```

---

## 2. Practicing AI Pair Programming

### 2.1 Principles for Effective AI Pair Programming

| Principle | Description | Example |
|-----------|-------------|---------|
| Humans steer | AI proposes, humans make final decisions | Always review AI-generated code |
| Maximize context | Provide AI with sufficient context | Supply related files, specs, and tests |
| Delegate incrementally | Break large tasks into smaller requests | Function-level -> Class-level -> Module-level |
| Verifiable granularity | Limit output to a human-verifiable amount | Generate no more than 100 lines at a time |
| Preserve learning opportunities | Don't fully delegate to AI; understand the output | Ask AI to explain the intent of generated code |

### 2.2 Sharing Prompt Templates Across the Team

```yaml
# .ai/prompts/code-review.yaml
# Shared team prompt template
name: Code Review Request
description: Standard template for requesting AI code review on a PR
template: |
  Please review the following Pull Request.

  ## Context
  - Project: {{project_name}}
  - Feature overview: {{feature_description}}
  - Target files: {{changed_files}}

  ## Review criteria
  1. Correctness of logic
  2. Edge case consideration
  3. Performance impact
  4. Security risks
  5. Coding standards compliance
  6. Test sufficiency

  ## Coding standards
  - {{coding_standards_url}}

  ## Change diff
  ```diff
  {{diff_content}}
  ```

  ## Expected output
  - List of issues with severity (Critical/Major/Minor)
  - Suggested fix for each issue
  - Overall assessment comment

variables:
  - project_name
  - feature_description
  - changed_files
  - coding_standards_url
  - diff_content
```

### 2.3 AI Pair Programming Session Management

```python
# AI pair programming session management tool
import json
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict

@dataclass
class AISession:
    """Record of an AI pair programming session"""
    session_id: str
    developer: str
    ai_tool: str                # Claude, GPT, Copilot, etc.
    task_type: str              # feature, bugfix, refactor, test
    start_time: str = field(default_factory=lambda: datetime.now().isoformat())
    end_time: str = ""
    prompts_count: int = 0
    accepted_suggestions: int = 0
    rejected_suggestions: int = 0
    files_modified: list[str] = field(default_factory=list)
    notes: str = ""
    effectiveness_rating: int = 0  # 1-5

    @property
    def acceptance_rate(self) -> float:
        total = self.accepted_suggestions + self.rejected_suggestions
        return self.accepted_suggestions / total if total > 0 else 0.0

class AISessionTracker:
    """Track AI sessions across the entire team"""

    def __init__(self, log_dir: str = ".ai/sessions"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def start_session(self, developer: str, ai_tool: str, task_type: str) -> AISession:
        """Start a new session"""
        session_id = f"{developer}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        session = AISession(
            session_id=session_id,
            developer=developer,
            ai_tool=ai_tool,
            task_type=task_type,
        )
        return session

    def end_session(self, session: AISession, rating: int = 3):
        """End a session and save it"""
        session.end_time = datetime.now().isoformat()
        session.effectiveness_rating = rating

        path = self.log_dir / f"{session.session_id}.json"
        with open(path, "w") as f:
            json.dump(asdict(session), f, indent=2, ensure_ascii=False)

    def team_stats(self) -> dict:
        """Aggregate statistics for the entire team"""
        sessions = []
        for path in self.log_dir.glob("*.json"):
            with open(path) as f:
                sessions.append(json.load(f))

        if not sessions:
            return {}

        return {
            "total_sessions": len(sessions),
            "avg_acceptance_rate": sum(
                s["accepted_suggestions"] /
                max(s["accepted_suggestions"] + s["rejected_suggestions"], 1)
                for s in sessions
            ) / len(sessions),
            "avg_effectiveness": sum(
                s["effectiveness_rating"] for s in sessions
            ) / len(sessions),
            "by_tool": self._group_by(sessions, "ai_tool"),
            "by_task_type": self._group_by(sessions, "task_type"),
            "by_developer": self._group_by(sessions, "developer"),
        }

    def _group_by(self, sessions: list, key: str) -> dict:
        groups = {}
        for s in sessions:
            g = s[key]
            if g not in groups:
                groups[g] = {"count": 0, "total_rating": 0}
            groups[g]["count"] += 1
            groups[g]["total_rating"] += s["effectiveness_rating"]
        for g in groups:
            groups[g]["avg_rating"] = groups[g]["total_rating"] / groups[g]["count"]
        return groups
```

---

## 3. Code Review with AI

### 3.1 Two-Stage Review Flow: AI + Human

```
PR Created
  |
  v
┌──────────────────────┐
│  Stage 1: AI Review   │  (Automated, minutes)
├──────────────────────┤
│ - Static analysis     │
│ - Security scan       │
│ - Coding standards    │
│ - Test coverage       │
│ - Performance concerns│
└──────────────────────┘
  |
  | Among AI findings:
  | Critical -> Immediate block
  | Major/Minor -> Comment
  |
  v
┌──────────────────────┐
│ Stage 2: Human Review │  (Assigned reviewer)
├──────────────────────┤
│ - Business logic      │
│ - Design decisions    │
│ - User experience     │
│ - Alignment with      │
│   team policies       │
│ - Validate AI findings│
└──────────────────────┘
  |
  v
Merge Decision
```

### 3.2 Automated AI Review with GitHub Actions

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

      - name: Get diff
        id: diff
        run: |
          git diff origin/${{ github.base_ref }}...HEAD > /tmp/diff.txt

      - name: AI Review
        uses: actions/github-script@v7
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        with:
          script: |
            const fs = require('fs');
            const diff = fs.readFileSync('/tmp/diff.txt', 'utf8');

            // Execute AI review (Anthropic API call)
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                messages: [{
                  role: 'user',
                  content: `Please review the following diff.
                    Provide findings with severity (Critical/Major/Minor)
                    and suggest fixes.\n\n${diff}`
                }],
              }),
            });

            const result = await response.json();
            const review = result.content[0].text;

            // Post comment on the PR
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `## 🤖 AI Code Review\n\n${review}`,
            });
```

---

## 4. Team Productivity Metrics

### 4.1 Measuring the Impact of AI Adoption

| Metric | Measurement Method | Pre-AI Baseline | Post-AI Baseline |
|--------|-------------------|----------------|-----------------|
| PR creation to merge time | GitHub metrics | 2-5 days | 0.5-2 days |
| Code review time | Review start to approval | 4-8 hours | 1-3 hours |
| Bug detection rate (review) | Review findings / total bugs | 30-50% | 50-70% |
| Test coverage | CI measurement | 60-70% | 75-85% |
| Developer satisfaction | Monthly survey | Baseline | +15-30% |
| PRs per person per week | GitHub stats | 3-5 | 5-10 |
| Documentation update rate | Commit-linked | 20-30% | 60-80% |

### 4.2 Impact on DORA Metrics

```
              Impact of AI Adoption
              ─────────────────────

  Deployment Frequency  ▲▲▲  Significant improvement
  (Weekly -> Multiple/day)

  Lead Time for Changes ▲▲▲  Significant improvement
  (Days -> Hours)

  Change Failure Rate   ▲▲   Improvement
  (15% -> 8%)

  Time to Restore       ▲    Slight improvement
  (Hours -> 1 hour)

  ▲▲▲ = Significant  ▲▲ = Improvement  ▲ = Slight improvement
```

---

## 5. Bridging AI Literacy Gaps

### 5.1 Team AI Skill Matrix

```python
# Team AI skill assessment and visualization tool
from dataclasses import dataclass

@dataclass
class AISkillAssessment:
    """AI skill assessment for a developer"""
    developer: str
    prompt_engineering: int    # 1-5: Prompt design ability
    tool_proficiency: int      # 1-5: AI tool proficiency
    output_evaluation: int     # 1-5: AI output evaluation ability
    workflow_integration: int  # 1-5: Workflow integration ability
    teaching_ability: int      # 1-5: Ability to mentor others

    @property
    def total_score(self) -> int:
        return (
            self.prompt_engineering
            + self.tool_proficiency
            + self.output_evaluation
            + self.workflow_integration
            + self.teaching_ability
        )

    @property
    def level(self) -> str:
        s = self.total_score
        if s >= 22:
            return "AI Champion"
        elif s >= 17:
            return "AI Practitioner"
        elif s >= 12:
            return "AI Learner"
        else:
            return "AI Beginner"

def generate_skill_matrix(team: list[AISkillAssessment]) -> str:
    """Display the team skill matrix as text"""
    header = (
        f"{'Name':12s} {'Prompt':8s} {'Tool':8s} "
        f"{'Eval':8s} {'Flow':8s} {'Teach':8s} {'Level':16s}"
    )
    lines = [header, "-" * len(header)]

    for member in sorted(team, key=lambda m: m.total_score, reverse=True):
        lines.append(
            f"{member.developer:12s} "
            f"{'*' * member.prompt_engineering:8s} "
            f"{'*' * member.tool_proficiency:8s} "
            f"{'*' * member.output_evaluation:8s} "
            f"{'*' * member.workflow_integration:8s} "
            f"{'*' * member.teaching_ability:8s} "
            f"{member.level:16s}"
        )

    return "\n".join(lines)
```

### 5.2 Pair Rotation System

```
Weekly AI Pair Rotation
──────────────────────

Week 1: Champion + Beginner
  -> Teach basic operations and prompt writing

Week 2: Practitioner + Learner
  -> AI usage in real tasks, workflow integration

Week 3: Champion + Practitioner
  -> Share advanced techniques, evaluate tools

Week 4: Full Team Workshop
  -> Knowledge sharing session, new tool evaluation, prompt library update
```

---

## 6. Knowledge Management and Knowledge Base with AI

### 6.1 Structuring and Formalizing Team Knowledge

```python
# Team knowledge management system powered by AI

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
import json

class KnowledgeType(Enum):
    DECISION = "decision"           # Design decisions
    PATTERN = "pattern"             # Code patterns and conventions
    TROUBLESHOOT = "troubleshoot"   # Troubleshooting
    DOMAIN = "domain"              # Domain knowledge
    PROCESS = "process"            # Processes and procedures
    TOOLING = "tooling"            # Tool usage

@dataclass
class KnowledgeEntry:
    """Knowledge base entry"""
    id: str
    title: str
    knowledge_type: KnowledgeType
    content: str
    context: str                    # When to use this knowledge
    created_by: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    tags: list[str] = field(default_factory=list)
    related_files: list[str] = field(default_factory=list)
    ai_generated: bool = False      # Whether AI generated this knowledge
    verified_by: str = ""           # Human verifier
    usage_count: int = 0            # Reference count

@dataclass
class TeamKnowledgeBase:
    """Team knowledge base management"""
    team_name: str
    entries: list[KnowledgeEntry] = field(default_factory=list)
    kb_dir: Path = field(default_factory=lambda: Path(".ai/knowledge"))

    def add_from_code_review(
        self,
        pr_number: int,
        reviewer: str,
        learning: str,
        related_code: str,
    ) -> KnowledgeEntry:
        """Extract and register knowledge from a code review"""
        entry = KnowledgeEntry(
            id=f"review-{pr_number}-{len(self.entries)}",
            title=f"Learnings from PR #{pr_number}",
            knowledge_type=KnowledgeType.PATTERN,
            content=learning,
            context=f"Discovered during review of PR #{pr_number}",
            created_by=reviewer,
            related_files=[related_code],
            tags=["code-review", f"pr-{pr_number}"],
        )
        self.entries.append(entry)
        return entry

    def add_from_incident(
        self,
        incident_id: str,
        responder: str,
        root_cause: str,
        fix_description: str,
        prevention: str,
    ) -> KnowledgeEntry:
        """Extract knowledge from incident response"""
        content = f"""
## Root Cause
{root_cause}

## Fix Applied
{fix_description}

## Prevention Measures
{prevention}
"""
        entry = KnowledgeEntry(
            id=f"incident-{incident_id}",
            title=f"Lessons from Incident {incident_id}",
            knowledge_type=KnowledgeType.TROUBLESHOOT,
            content=content,
            context=f"Post-mortem analysis of Incident {incident_id}",
            created_by=responder,
            tags=["incident", "postmortem"],
        )
        self.entries.append(entry)
        return entry

    def ai_generate_summary(self) -> str:
        """Generate a prompt for AI to summarize the knowledge base"""
        entries_text = "\n".join(
            f"- [{e.knowledge_type.value}] {e.title}: {e.content[:100]}..."
            for e in self.entries[-20:]  # Last 20 entries
        )

        return f"""
Analyze the following recent entries from the team knowledge base
and generate insights on technical trends and improvement suggestions.

Team: {self.team_name}
Total entries: {len(self.entries)}

Recent entries:
{entries_text}

Please analyze from the following perspectives:
1. Recurring problem patterns
2. Team's technical strengths and weaknesses
3. Areas where knowledge is lacking
4. Recommended actions (training, tool adoption, etc.)
"""

    def search(self, query: str, top_k: int = 5) -> list[KnowledgeEntry]:
        """Search the knowledge base by keyword"""
        scored = []
        query_lower = query.lower()
        for entry in self.entries:
            score = 0
            if query_lower in entry.title.lower():
                score += 10
            if query_lower in entry.content.lower():
                score += 5
            for tag in entry.tags:
                if query_lower in tag.lower():
                    score += 3
            if score > 0:
                scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [entry for _, entry in scored[:top_k]]

    def save(self) -> None:
        """Save the knowledge base to files"""
        self.kb_dir.mkdir(parents=True, exist_ok=True)
        for entry in self.entries:
            path = self.kb_dir / f"{entry.id}.json"
            with open(path, "w", encoding="utf-8") as f:
                json.dump({
                    "id": entry.id,
                    "title": entry.title,
                    "type": entry.knowledge_type.value,
                    "content": entry.content,
                    "context": entry.context,
                    "created_by": entry.created_by,
                    "created_at": entry.created_at,
                    "tags": entry.tags,
                    "related_files": entry.related_files,
                    "ai_generated": entry.ai_generated,
                    "verified_by": entry.verified_by,
                    "usage_count": entry.usage_count,
                }, f, indent=2, ensure_ascii=False)
```

### 6.2 AI-Assisted ADR (Architecture Decision Record)

```python
# AI-assisted ADR (Architecture Decision Record) management

from dataclasses import dataclass, field
from datetime import date

@dataclass
class ADREntry:
    """Architecture Decision Record"""
    number: int
    title: str
    status: str  # "proposed", "accepted", "deprecated", "superseded"
    date: str
    context: str
    decision: str
    consequences: str
    alternatives_considered: list[str] = field(default_factory=list)
    ai_analysis: str = ""  # Trade-off analysis by AI

class ADRManager:
    """ADR management tool"""

    def __init__(self, adr_dir: str = "docs/adr"):
        self.adr_dir = Path(adr_dir)
        self.adr_dir.mkdir(parents=True, exist_ok=True)

    def create_adr_prompt(
        self,
        title: str,
        context: str,
        options: list[str],
    ) -> str:
        """Generate an AI prompt for ADR creation"""
        options_text = "\n".join(f"  {i+1}. {opt}" for i, opt in enumerate(options))

        return f"""
Please create an ADR for the following architecture decision.

## Title
{title}

## Context
{context}

## Options Under Consideration
{options_text}

Please output in the following format:

### Trade-off Analysis for Each Option
(Specific pros, cons, and risks)

### Recommended Decision
(With rationale)

### Predicted Impact
(Short-term and long-term impact)

### Triggers for Future Review
(Conditions under which this decision should be revisited)
"""

    def generate_adr_markdown(self, entry: ADREntry) -> str:
        """Generate ADR in Markdown format"""
        alternatives = "\n".join(
            f"- {alt}" for alt in entry.alternatives_considered
        )

        return f"""# ADR-{entry.number:04d}: {entry.title}

## Status
{entry.status}

## Date
{entry.date}

## Context
{entry.context}

## Alternatives Considered
{alternatives}

## Decision
{entry.decision}

## AI Trade-off Analysis
{entry.ai_analysis}

## Consequences
{entry.consequences}
"""

    def save_adr(self, entry: ADREntry) -> Path:
        """Save ADR as a file"""
        filename = f"{entry.number:04d}-{entry.title.replace(' ', '-').lower()}.md"
        path = self.adr_dir / filename
        content = self.generate_adr_markdown(entry)
        path.write_text(content, encoding="utf-8")
        return path
```

---

## 7. Communication Practices in the AI Era

### 7.1 AI-Assisted Asynchronous Communication

```yaml
# .ai/communication/templates.yaml
# AI templates for team communication

templates:
  # Auto-generate PR descriptions
  pr_description:
    name: "Auto-Generate PR Description"
    trigger: "Automatically triggered on PR creation"
    prompt: |
      Please generate a PR description from the following git diff.

      ## Format
      ### Change Summary
      (Explain the purpose of the change in 1-2 sentences)

      ### Changes
      (List specific changes as bullet points)

      ### How to Test
      (Steps for verifying the changes)

      ### Impact Scope
      (Components/features affected by this change)

      ### Review Focus
      (Points you especially want the reviewer to examine)

      ## diff
      {{diff}}

  # Generate daily standup summary
  standup_summary:
    name: "Standup Summary"
    trigger: "Automatically triggered every morning at 9:00"
    prompt: |
      Please generate a daily standup summary from
      the following GitHub activity data for team members.

      ## Data Sources
      - Yesterday's commits: {{commits}}
      - Open PRs: {{open_prs}}
      - Merged PRs: {{merged_prs}}
      - New issues: {{new_issues}}

      ## Output Format
      For each member:
      - What they did yesterday
      - What they plan to do today (estimated)
      - Blockers (if any)

  # Auto-respond to technical questions on Slack
  tech_support:
    name: "Technical Question Auto-Response"
    trigger: "Post in #dev-support channel"
    prompt: |
      Please answer the following technical question
      by referencing the team's knowledge base and project documentation.

      Question: {{question}}

      Reference documents: {{relevant_docs}}
      Similar past questions: {{similar_questions}}

      After responding, please ask "Is this answer accurate?"
```

### 7.2 Making Meetings More Efficient

```python
# AI-assisted meeting efficiency tool

from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class MeetingAgenda:
    """AI-generated meeting agenda"""
    title: str
    date: str
    duration_minutes: int
    participants: list[str]
    topics: list[dict] = field(default_factory=list)

@dataclass
class MeetingFacilitator:
    """AI meeting facilitator"""

    def generate_sprint_review_agenda(
        self,
        sprint_number: int,
        completed_stories: list[str],
        incomplete_stories: list[str],
        metrics: dict,
    ) -> str:
        """Auto-generate sprint review agenda"""
        completed_list = "\n".join(f"  - {s}" for s in completed_stories)
        incomplete_list = "\n".join(f"  - {s}" for s in incomplete_stories)

        return f"""
# Sprint {sprint_number} Review Agenda

## 1. Sprint Overview (5 min)
- Period: {metrics.get('start_date', 'N/A')} - {metrics.get('end_date', 'N/A')}
- Planned points: {metrics.get('planned_points', 0)}
- Completed points: {metrics.get('completed_points', 0)}
- Completion rate: {metrics.get('completion_rate', 0):.0%}

## 2. Demo of Completed Stories (20 min)
{completed_list}

## 3. Status Report on Incomplete Stories (10 min)
{incomplete_list}

## 4. AI Utilization Metrics (5 min)
- Number of AI pair programming sessions: {metrics.get('ai_sessions', 0)}
- AI-generated code ratio: {metrics.get('ai_code_ratio', 0):.0%}
- AI review finding acceptance rate: {metrics.get('ai_review_acceptance', 0):.0%}

## 5. Retrospective and Improvement Proposals (10 min)
- Feedback from the team
- Areas to improve AI utilization

## 6. Next Sprint Priorities (10 min)
"""

    def generate_retro_prompts(self, sprint_metrics: dict) -> str:
        """Generate AI-assisted retrospective prompts"""
        return f"""
Based on the team's sprint metrics, please generate
a discussion starting point for the retrospective.

Metrics:
- Velocity: {sprint_metrics.get('velocity', 'N/A')}
- Test coverage: {sprint_metrics.get('coverage', 'N/A')}%
- Bug rate: {sprint_metrics.get('bug_rate', 'N/A')} per sprint
- Average PR merge time: {sprint_metrics.get('pr_merge_time', 'N/A')} hours
- AI utilization rate: {sprint_metrics.get('ai_usage', 'N/A')}%

Please output in the following format:

### What Went Well (Keep)
- 3 positive trends inferred from the metrics

### What Needs Improvement (Problem)
- 3 issues inferred from the metrics

### What to Try (Try)
- 3 concrete improvement actions (including AI utilization perspective)
"""
```

---

## 8. AI Governance Framework for Teams

### 8.1 Establishing an AI Governance Policy

```yaml
# .ai/governance/ai-usage-policy.yaml
# Team AI usage policy

policy:
  version: "2.0"
  last_updated: "2026-02-01"
  approved_by: "Engineering Manager"

  # Data security
  data_security:
    allowed_data_types:
      - "Open source code"
      - "Internal technical documentation (non-confidential)"
      - "Test data (anonymized)"
    prohibited_data_types:
      - "Customer personally identifiable information (PII)"
      - "Credentials (API keys, passwords, tokens)"
      - "Financial data (unpublished)"
      - "Medical data"
      - "Contracts and legal documents"
    encryption_requirement: "Data in transit must use TLS 1.3 or higher"

  # AI tool usage rules
  tool_usage:
    approved_tools:
      - name: "Claude Code"
        allowed_for: ["Code generation", "Review", "Testing", "Documentation"]
        restrictions: "Prohibited for use with confidential code"
      - name: "GitHub Copilot"
        allowed_for: ["Code completion", "Test generation"]
        restrictions: "Telemetry must be disabled"
    approval_required_for:
      - "Introducing new AI tools"
      - "Integrating AI tools into production environments"
      - "Deploying custom AI models"

  # Code quality rules
  code_quality:
    ai_generated_code_rules:
      - "All AI-generated code must go through human review"
      - "Security-critical code must be reviewed by senior engineers or above"
      - "Tests are mandatory for AI-generated code"
      - "Describe the scope of AI assistance in the PR description"
    minimum_test_coverage: 80
    mandatory_security_scan: true

  # Audit and record keeping
  audit:
    log_ai_usage: true
    retention_period_days: 365
    quarterly_review: true
    metrics_tracking:
      - "AI-generated code ratio"
      - "Defect density of AI-generated code"
      - "Accuracy of AI review findings"
```

### 8.2 Compliance Checker

```python
# Automated AI governance policy compliance checking tool

import re
from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class ComplianceIssue:
    """Compliance violation"""
    severity: str  # "critical", "warning", "info"
    category: str
    message: str
    file: str = ""
    line: int = 0

class AIGovernanceChecker:
    """Compliance check for AI governance policy"""

    # Patterns to check
    SENSITIVE_PATTERNS = {
        "pii_email": {
            "pattern": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            "message": "Email address detected",
            "severity": "critical",
            "exclude_files": ["*.test.*", "*.spec.*"],
        },
        "api_key": {
            "pattern": r'(?:api[_-]?key|apikey)\s*[=:]\s*["\'][a-zA-Z0-9]{20,}',
            "message": "Hardcoded API key detected",
            "severity": "critical",
        },
        "password": {
            "pattern": r'(?:password|passwd|pwd)\s*[=:]\s*["\'][^"\']{4,}',
            "message": "Hardcoded password detected",
            "severity": "critical",
        },
        "private_key": {
            "pattern": r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----',
            "message": "Private key detected",
            "severity": "critical",
        },
        "ip_address": {
            "pattern": r'\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b',
            "message": "Internal IP address detected",
            "severity": "warning",
        },
    }

    def __init__(self):
        self.issues: list[ComplianceIssue] = []

    def check_file(self, file_path: Path) -> list[ComplianceIssue]:
        """Run compliance check on a file"""
        issues = []
        try:
            content = file_path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            return issues

        for name, check in self.SENSITIVE_PATTERNS.items():
            # Check file exclusions
            excludes = check.get("exclude_files", [])
            if any(file_path.match(exc) for exc in excludes):
                continue

            for match in re.finditer(check["pattern"], content, re.IGNORECASE):
                line_num = content[:match.start()].count("\n") + 1
                issue = ComplianceIssue(
                    severity=check["severity"],
                    category="data_security",
                    message=check["message"],
                    file=str(file_path),
                    line=line_num,
                )
                issues.append(issue)

        self.issues.extend(issues)
        return issues

    def check_pr_description(self, description: str) -> list[ComplianceIssue]:
        """Check if the PR description mentions AI assistance"""
        issues = []

        # Check for AI assistance mention
        ai_keywords = ["AI", "Copilot", "Claude", "GPT", "AI-assisted", "AI-generated"]
        has_ai_mention = any(kw.lower() in description.lower() for kw in ai_keywords)

        if not has_ai_mention:
            issues.append(ComplianceIssue(
                severity="warning",
                category="transparency",
                message="The PR description does not mention the scope of AI assistance. "
                        "Please include it if AI was used.",
            ))

        self.issues.extend(issues)
        return issues

    def generate_report(self) -> str:
        """Generate a compliance report"""
        critical = [i for i in self.issues if i.severity == "critical"]
        warnings = [i for i in self.issues if i.severity == "warning"]
        infos = [i for i in self.issues if i.severity == "info"]

        lines = [
            "# AI Governance Compliance Report\n",
            f"Check date: {datetime.now().isoformat()}",
            f"Findings: Critical {len(critical)}, Warning {len(warnings)}, Info {len(infos)}\n",
        ]

        if critical:
            lines.append("## Critical Issues (Immediate action required)\n")
            for issue in critical:
                lines.append(f"- [{issue.category}] {issue.message}")
                if issue.file:
                    lines.append(f"  File: {issue.file}:{issue.line}")

        if warnings:
            lines.append("\n## Warnings (Review recommended)\n")
            for issue in warnings:
                lines.append(f"- [{issue.category}] {issue.message}")
                if issue.file:
                    lines.append(f"  File: {issue.file}:{issue.line}")

        return "\n".join(lines)
```

---

## 9. Anti-Patterns

### 9.1 Anti-Pattern: Adopting AI Output Without Verification

```
NG: Copy-pasting AI-generated code and committing it as-is
  - Risk of introducing security vulnerabilities
  - Inconsistency with project-specific patterns
  - Deployment without tests

OK: AI Output Verification Flow
  1. AI generates code
  2. Developer understands and verifies the logic
  3. Run existing tests for regression check
  4. Add new tests
  5. Pass through code review by others
  6. Automated checks via CI/CD pipeline
```

**Problem**: AI can confidently generate incorrect code. Human verification is essential, especially for security-related and business logic code.

### 9.2 Anti-Pattern: Prompts Becoming Siloed to Individuals

```
NG: Each person uses their own ad-hoc prompts with AI
  - Inconsistent quality
  - Knowledge not shared
  - New members can't use AI effectively

OK: Shared prompt library management
  .ai/
  ├── prompts/
  │   ├── code-review.yaml
  │   ├── test-generation.yaml
  │   ├── refactoring.yaml
  │   ├── documentation.yaml
  │   └── debugging.yaml
  ├── guidelines/
  │   ├── ai-usage-policy.md
  │   └── prompt-writing-guide.md
  └── templates/
      ├── feature-request.md
      └── bug-report.md
```

**Problem**: Prompt quality directly impacts team productivity. A mechanism is needed to convert individual tacit knowledge into shared explicit knowledge, with continuous improvement.


---

## Hands-On Exercises

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
        """Main data processing logic"""
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
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

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
    print(f"Speedup:             {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Configuration file issues | Check the path and format of config files |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Procedure

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Verify step by step**: Use log output or a debugger to validate hypotheses
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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
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

Steps to diagnose when performance issues occur:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Examine disk and network I/O status
4. **Check concurrent connections**: Examine connection pool status

| Problem Type | Diagnostic Tool | Countermeasure |
|-------------|----------------|----------------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the decision criteria when making technology choices.

| Criteria | When to Prioritize | When to Compromise |
|----------|-------------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flowchart        │
├─────────────────────────────────────────────────┤
│                                                 │
│  (1) Team size?                                 │
│    ├─ Small (1-5) -> Monolith                   │
│    └─ Large (10+) -> Go to (2)                  │
│                                                 │
│  (2) Deployment frequency?                      │
│    ├─ Weekly or less -> Monolith + Module split  │
│    └─ Daily/Multiple -> Go to (3)               │
│                                                 │
│  (3) Team independence?                         │
│    ├─ High -> Microservices                     │
│    └─ Moderate -> Modular Monolith              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A short-term fast approach may become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies enables the right tool for the right job, but increases operational costs

**3. Level of Abstraction**
- High abstraction offers better reusability but can make debugging harder
- Low abstraction is more intuitive but tends to lead to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and challenges"""
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
- Focus on the minimum viable features
- Automated testing only for critical paths
- Introduce monitoring early

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually modernize a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if no existing tests
- Use an API gateway to let old and new systems coexist
- Perform data migration incrementally

| Phase | Tasks | Estimated Duration | Risk |
|-------|-------|-------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration Start | Sequential migration from peripheral features | 3-6 months | Medium |
| 4. Core Migration | Migration of core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development in a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Set ownership per team
- Manage common libraries via Inner Source approach
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

**Situation:** A system that requires millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: In-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Impact | Implementation Cost | When to Apply |
|--------------------|--------|-------------------|---------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## 7. FAQ

### Q1: What are the criteria for selecting AI tools?

**A**: Evaluate team AI tool selection from the following perspectives.

| Perspective | Importance | Example |
|-------------|------------|---------|
| Security | Highest | Policy on sending code externally |
| Accuracy | High | Performance with your language/framework |
| Integration | High | Integration with IDE/CI/CD |
| Cost | Medium | ROI of cost per person |
| Learning cost | Medium | Time for the entire team to become proficient |

### Q2: How should AI usage governance rules be designed?

**A**: At a minimum, establish the following rules: (1) Restrictions on AI usage for sensitive code (authentication, encryption, PII processing), (2) Mandatory review criteria for AI-generated code, (3) Security policy regarding sending code to external APIs, (4) Handling of copyright/licensing for AI output. Document these in the team's Contributing Guide.

### Q3: How to handle team members who resist AI adoption?

**A**: (1) Show success stories instead of forcing adoption (share real examples where AI saved time), (2) Emphasize that AI is an augmentation, not a replacement, (3) Suggest starting with small tasks (test generation, documentation), (4) Pair them with a Champion for pair programming. Forced adoption is counterproductive; focus on natural motivation.

### Q4: Tips for leveraging AI in remote teams?

**A**: (1) Use AI reviews for asynchronous communication (AI bridges timezone gaps), (2) Maintain a shared prompt repository, (3) Share AI session recordings (screen recordings demonstrating AI usage), (4) Democratize AI support via Slack bots.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What common mistakes do beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before proceeding to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes especially important during code reviews and architecture design.

---

## 8. Summary

| Category | Key Point |
|----------|-----------|
| Pair Programming | Humans steer, AI proposes. Maximizing context is the key |
| Code Review | Two-stage flow: AI pre-review + human final judgment |
| Productivity Measurement | Visualize effectiveness with DORA metrics + AI-specific metrics |
| Skill Gap | Level up the team with skill matrices + pair rotation |
| Governance | Clearly document rules for security, quality, and licensing |
| Culture Building | Promote natural adoption through sharing success stories rather than forcing |
| Prompt Sharing | Prevent silos by managing prompts in a repository |

---

## Recommended Next Reads

- [01-ai-onboarding.md](./01-ai-onboarding.md) -- Developer Onboarding in the AI Era
- AI Coding Assistant Comprehensive Comparison -- Detailed tool selection guide
- Prompt Engineering for Developers -- Effective prompt design

---

## References

1. DORA "Accelerate State of DevOps Report" -- https://dora.dev/research/
2. GitHub "The Impact of AI on Developer Productivity" -- https://github.blog/news-insights/research/
3. Anthropic Claude Documentation -- https://docs.anthropic.com/
4. ThoughtWorks Technology Radar -- https://www.thoughtworks.com/radar
5. Martin Fowler, "Continuous Integration" -- https://martinfowler.com/articles/continuousIntegration.html
