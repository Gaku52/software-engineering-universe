# Developer Onboarding in the AI Era

> A systematic onboarding program that helps new members quickly adapt to AI-era team development, covering AI tool training, prompt sharing, and knowledge base construction.

---

## What You Will Learn in This Chapter

1. Design an **onboarding program adapted to the AI era** to reduce new member ramp-up time
2. Build an **AI tool training curriculum and prompt sharing platform** to standardize AI proficiency across the team
3. Master **knowledge base construction and operation methods** to convert tacit knowledge into explicit knowledge as organizational assets


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [AI-Era Team Development Practices](./00-ai-team-practices.md)

---

## 1. Overview of Onboarding in the AI Era

### 1.1 Traditional vs. AI-Era Onboarding

```
┌──────────────────────────────────────────────────────┐
│         Evolution of the Onboarding Process          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Traditional (4-8 weeks)      AI Era (2-4 weeks)     │
│  ─────────────                ──────────────         │
│                                                      │
│  Week 1: Env Setup            Day 1-2: AI-Assisted   │
│  - Manual setup                 Environment Setup    │
│  - Reading documentation      - AI guides the steps  │
│                               - Explore code with AI │
│                                                      │
│  Week 2: Code Understanding   Day 3-5: AI-Assisted   │
│  - Read source one by one       Code Understanding   │
│  - Ask seniors each time      - Ask AI about arch    │
│                               - Analyze deps with AI │
│                                                      │
│  Week 3-4: Small Tasks        Week 2: AI-Powered     │
│  - Learn via pair prog          Implementation       │
│  - Receive review feedback    - AI pair prog tasks   │
│                               - AI pre-review for QA │
│                                                      │
│  Week 5-8: Independence       Week 3-4: Autonomous   │
│  - Gradually increase           Development          │
│    difficulty                 - Master AI tools      │
│  - Takes time to learn        - Leverage knowledge   │
│    tacit knowledge              base                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 1.2 Four Phases of Onboarding

```
Phase 1          Phase 2          Phase 3          Phase 4
Env Setup        Code             AI Practice      Autonomy
                 Understanding
(Day 1-2)        (Day 3-5)        (Week 2)         (Week 3-4)
─────────        ─────────        ─────────        ─────────
- Dev env        - Architecture   - AI pair prog   - Independent
- AI tool setup  - AI exploration - Use prompts      tasks
- Rule review    - Domain         - Join reviews   - No mentor
                   understanding                     needed
                                                   - Knowledge
                                                     contribution

    Goal: Working  Goal: Big       Goal: AI        Goal:
    environment    picture         proficiency     Independence
```

---

## 2. Phase 1: AI Development Environment Setup

### 2.1 Automated Setup Script

```bash
#!/bin/bash
# scripts/onboarding-setup.sh
# Script to automatically set up the development environment for new members

set -euo pipefail

echo "=== AI-Era Development Environment Setup ==="
echo ""

# 1. Basic development tools
echo "[1/5] Installing basic development tools..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    command -v brew >/dev/null || /bin/bash -c \
        "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    brew install git node python@3.12 docker
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo apt update && sudo apt install -y git nodejs python3 docker.io
fi

# 2. AI coding tools
echo "[2/5] Configuring AI coding tools..."

# GitHub Copilot (VS Code extension)
code --install-extension GitHub.copilot
code --install-extension GitHub.copilot-chat

# Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Cursor IDE (optional)
if [[ "$INSTALL_CURSOR" == "true" ]]; then
    echo "Installing Cursor IDE..."
    # Platform-specific installation
fi

# 3. Project-specific settings
echo "[3/5] Applying project settings..."
git clone "$PROJECT_REPO" ~/workspace/project
cd ~/workspace/project

# Copy AI tool configuration files
cp .ai/configs/recommended-settings.json ~/.config/ai-tools/

# 4. AI prompt library setup
echo "[4/5] Setting up prompt library..."
mkdir -p ~/.ai/prompts
ln -sf ~/workspace/project/.ai/prompts ~/.ai/prompts/project

# 5. Verification
echo "[5/5] Verifying environment..."
python3 -c "print('Python OK')"
node -e "console.log('Node OK')"
git --version
echo ""
echo "=== Setup Complete ==="
echo "Next step: Check docs/onboarding/phase1-checklist.md"
```

### 2.2 Team Standard for AI Tool Settings

```json
// .ai/configs/recommended-settings.json
{
  "copilot": {
    "enable": true,
    "inlineSuggest.enable": true,
    "advanced": {
      "length": 500,
      "temperature": 0.1,
      "top_p": 0.95
    }
  },
  "claude_code": {
    "model": "claude-sonnet-4-20250514",
    "allowed_tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
    "project_context": ".claude/CLAUDE.md"
  },
  "team_rules": {
    "ai_review_required": true,
    "max_ai_generated_without_test": 50,
    "sensitive_dirs_no_ai": ["src/auth/", "src/crypto/", "config/secrets/"],
    "prompt_template_required": true
  }
}
```

---

## 3. Phase 2: Understanding the Codebase with AI

### 3.1 AI-Powered Codebase Exploration Session

```python
# onboarding/codebase_explorer.py
# AI codebase exploration tool for new members

from pathlib import Path
import json

class CodebaseExplorer:
    """Guide for new members to explore the codebase using AI"""

    EXPLORATION_TASKS = [
        {
            "title": "Grasping the Architecture Overview",
            "prompt": """
Analyze the directory structure of this project and
explain the following:
1. Overall architecture pattern (MVC, Clean Architecture, etc.)
2. Major modules and their roles
3. Data flow (from request to response)
4. External dependencies
""",
            "target": "Project root",
            "estimated_time": "30 min",
        },
        {
            "title": "Understanding Domain Models",
            "prompt": """
List the major domain models (entities) in this project
and explain their relationships:
1. Attributes and responsibilities of each model
2. Relationships between models (1:N, N:M, etc.)
3. Where business rules are implemented
""",
            "target": "src/models/ or src/domain/",
            "estimated_time": "45 min",
        },
        {
            "title": "Grasping the API Specification",
            "prompt": """
Analyze the API list for this project and
organize the following:
1. Endpoint list (method, path, summary)
2. Authentication and authorization mechanisms
3. Error handling patterns
4. Response format conventions
""",
            "target": "src/routes/ or src/controllers/",
            "estimated_time": "30 min",
        },
        {
            "title": "Understanding the Test Strategy",
            "prompt": """
Analyze the test strategy of this project:
1. Types of tests (unit/integration/E2E) and their locations
2. Test frameworks and their configuration
3. How mocks/stubs are used
4. Test coverage status
""",
            "target": "tests/ or __tests__/",
            "estimated_time": "30 min",
        },
    ]

    @classmethod
    def generate_exploration_plan(cls, project_path: str) -> str:
        """Generate an exploration plan"""
        plan = "# AI Codebase Exploration Plan\n\n"
        plan += f"Project: {project_path}\n\n"

        for i, task in enumerate(cls.EXPLORATION_TASKS, 1):
            plan += f"## Task {i}: {task['title']}\n\n"
            plan += f"**Target**: `{task['target']}`\n"
            plan += f"**Estimated Time**: {task['estimated_time']}\n\n"
            plan += f"**Prompt for AI**:\n```\n{task['prompt'].strip()}\n```\n\n"
            plan += "**Understanding Check**:\n"
            plan += "- [ ] Can explain in your own words\n"
            plan += "- [ ] Can point to the relevant code locations\n"
            plan += "- [ ] Can suggest at least one improvement\n\n"

        return plan
```

### 3.2 Understanding Check Template

```markdown
<!-- .ai/onboarding/understanding-check.md -->
# Codebase Understanding Check Sheet

## Respondent: ___
## Date: ___

### Architecture
1. What is the architecture pattern of this project?
   - Answer:
   - Result of checking with AI:

2. Describe the path a request takes to reach the DB.
   - Answer:
   - Files/classes it passes through:

### Domain Knowledge
3. Name three major entities and explain their relationships.
   - Answer:

4. Where is the most complex business rule implemented?
   - Answer:
   - File path:

### Development Flow
5. Describe the steps to add a new feature.
   - Answer:

6. How do you use AI tools?
   - Answer:

### Mentor Comments
- Understanding level: ☆☆☆☆☆ (5 levels)
- Areas requiring additional learning:
- Next steps:
```

---

## 4. Phase 3: AI Tool Training Curriculum

### 4.1 Training Curriculum Overview

| Day | Theme | Content | Exercise |
|---|-------|------|------|
| Day 1 | AI Basics | How LLMs work, what they can/cannot do | Simple prompt exercises |
| Day 2 | Prompt Design | How to write effective prompts | Using team templates |
| Day 3 | Code Generation | AI code generation and verification | Using AI on real tasks |
| Day 4 | Review & Testing | AI review and test generation | Creating PRs and experiencing AI review |
| Day 5 | Application & Integration | Workflow integration, knowledge base | Present your own usage methods |

### 4.2 Prompt Engineering Training

```python
# onboarding/prompt_training.py
# Prompt design training module

class PromptTraining:
    """Step-by-step prompt engineering training"""

    LEVELS = {
        "level_1_basic": {
            "title": "Basic: Clear Instructions",
            "principle": "Be specific, clear, and request one thing at a time",
            "bad_example": "Fix this code",
            "good_example": (
                "Please fix the infinite loop bug in the following Python function.\n"
                "Include the corrected code and an explanation of what was changed.\n\n"
                "```python\ndef process_items(items):\n"
                "    i = 0\n    while i < len(items):\n"
                "        if items[i].is_valid():\n"
                "            handle(items[i])\n"
                "        # Missing i += 1\n```"
            ),
            "exercise": "Write a prompt to ask AI to fix a bug from a team bug report",
        },
        "level_2_context": {
            "title": "Intermediate: Providing Context",
            "principle": "Specify background, constraints, and expected format explicitly",
            "bad_example": "Write tests",
            "good_example": (
                "Please write unit tests based on the following specification.\n\n"
                "## Test Target\n"
                "UserService.create_user(name, email) method\n\n"
                "## Specification\n"
                "- name is a string of 1-50 characters\n"
                "- email must be a valid email format\n"
                "- Duplicate emails result in an error\n\n"
                "## Test Framework\n"
                "pytest + pytest-mock\n\n"
                "## Test Patterns\n"
                "Include at least 2 happy path and 3 error cases"
            ),
            "exercise": "Create a test prompt for a new feature, referencing existing test files",
        },
        "level_3_advanced": {
            "title": "Advanced: Guiding Reasoning",
            "principle": "Incorporate step-by-step reasoning, explicit constraints, and self-verification",
            "bad_example": "Improve the performance",
            "good_example": (
                "Please analyze the slow response time issue for the following API endpoint.\n\n"
                "## Steps\n"
                "1. First, identify 3 potential bottleneck areas in this code\n"
                "2. Rate the impact of each bottleneck as high/medium/low\n"
                "3. Starting from the highest impact area, provide specific improvement proposals\n"
                "4. Also explain the trade-offs of each proposal (memory usage, code complexity, etc.)\n\n"
                "## Constraints\n"
                "- No adding external libraries\n"
                "- Must maintain API compatibility\n"
                "- Tests must pass"
            ),
            "exercise": "Design a prompt asking AI to debug a production incident scenario",
        },
    }

    @classmethod
    def get_curriculum(cls) -> str:
        """Output the curriculum"""
        output = "# Prompt Engineering Training\n\n"
        for level_id, level in cls.LEVELS.items():
            output += f"## {level['title']}\n\n"
            output += f"**Principle**: {level['principle']}\n\n"
            output += f"**Bad Example**:\n```\n{level['bad_example']}\n```\n\n"
            output += f"**Good Example**:\n```\n{level['good_example']}\n```\n\n"
            output += f"**Exercise**: {level['exercise']}\n\n---\n\n"
        return output
```

---

## 5. Building the Knowledge Base

### 5.1 Knowledge Base Architecture

```
┌──────────────────────────────────────────────────┐
│            Team Knowledge Base                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐   ┌──────────────────┐        │
│  │  Tacit        │   │  Explicit         │        │
│  │  Knowledge    │   │  Knowledge        │        │
│  │  (in people's │──>│  (documented)     │        │
│  │   heads)      │   │                   │        │
│  └──────────────┘   └──────────────────┘        │
│         │                     │                  │
│         v                     v                  │
│  ┌──────────────┐   ┌──────────────────┐        │
│  │  AI Extracts  │   │  Searchable DB   │        │
│  │  - Q&A        │   │  - Vector search  │        │
│  │  - Patterns   │   │  - Keyword search │        │
│  └──────────────┘   └──────────────────┘        │
│         │                     │                  │
│         v                     v                  │
│  ┌────────────────────────────────────┐         │
│  │  Unified Knowledge Interface       │         │
│  │  - Slack Bot + AI                  │         │
│  │  - IDE integration (Q&A on code)   │         │
│  │  - Automatic documentation updates │         │
│  └────────────────────────────────────┘         │
└──────────────────────────────────────────────────┘
```

### 5.2 Knowledge Registration and Search System

```python
# knowledge/knowledge_base.py
# Team knowledge base management system

import json
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

@dataclass
class KnowledgeEntry:
    """Knowledge entry"""
    id: str
    title: str
    category: str          # architecture, debugging, workflow, domain, tool
    content: str
    tags: list[str]
    author: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = ""
    related_files: list[str] = field(default_factory=list)
    ai_generated: bool = False
    verified: bool = False

class TeamKnowledgeBase:
    """Team knowledge base management"""

    CATEGORIES = [
        "architecture",   # Architecture decisions
        "debugging",      # Debugging know-how
        "workflow",       # Development workflow
        "domain",         # Domain knowledge
        "tool",           # Tool usage
        "ai-prompt",      # Effective prompts
        "postmortem",     # Incident retrospectives
    ]

    def __init__(self, base_dir: str = ".knowledge"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def add_entry(self, entry: KnowledgeEntry) -> str:
        """Add a knowledge entry"""
        category_dir = self.base_dir / entry.category
        category_dir.mkdir(exist_ok=True)

        path = category_dir / f"{entry.id}.json"
        with open(path, "w") as f:
            json.dump(asdict(entry), f, indent=2, ensure_ascii=False)

        return str(path)

    def search(
        self,
        query: str,
        category: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> list[KnowledgeEntry]:
        """Search knowledge entries"""
        results = []
        search_dirs = (
            [self.base_dir / category] if category
            else [self.base_dir / c for c in self.CATEGORIES]
        )

        query_lower = query.lower()
        for search_dir in search_dirs:
            if not search_dir.exists():
                continue
            for path in search_dir.glob("*.json"):
                with open(path) as f:
                    data = json.load(f)

                # Text match
                text = f"{data['title']} {data['content']} {' '.join(data['tags'])}".lower()
                if query_lower not in text:
                    continue

                # Tag filter
                if tags and not set(tags).intersection(set(data["tags"])):
                    continue

                results.append(KnowledgeEntry(**data))

        return sorted(results, key=lambda e: e.created_at, reverse=True)

    def generate_onboarding_digest(self) -> str:
        """Generate a knowledge digest for new members"""
        digest = "# Knowledge Digest for New Members\n\n"
        digest += f"Generated: {datetime.now().strftime('%Y-%m-%d')}\n\n"

        for category in self.CATEGORIES:
            entries = self.search("", category=category)
            if not entries:
                continue

            category_names = {
                "architecture": "Architecture",
                "debugging": "Debugging",
                "workflow": "Workflow",
                "domain": "Domain Knowledge",
                "tool": "Tools",
                "ai-prompt": "AI Prompts",
                "postmortem": "Incident Retrospectives",
            }
            digest += f"## {category_names.get(category, category)}\n\n"

            for entry in entries[:5]:  # Latest 5 per category
                digest += f"### {entry.title}\n"
                digest += f"- Author: {entry.author}\n"
                digest += f"- Tags: {', '.join(entry.tags)}\n"
                digest += f"- Summary: {entry.content[:200]}...\n\n"

        return digest
```

---

## 6. Integration with the Mentorship Program

### 6.1 The Mentor's Role in the AI Era

| Mentor's Role | Traditional | AI Era |
|--------------|------|--------|
| Answering technical questions | Mentor answers directly | Teach how to ask AI |
| Code review | Mentor does everything | AI pre-review + mentor final check |
| Design consultation | Depends on mentor's experience | Have AI generate design proposals, then discuss with mentor |
| Domain knowledge transfer | Verbal explanation | Knowledge base + AI Q&A + mentor supplementation |
| Sharing tacit knowledge | Fragmentary during pair programming | AI recording + knowledge base registration |

### 6.2 Weekly 1-on-1 Checkpoints

```yaml
# .ai/onboarding/weekly-checklist.yaml
week_1:
  title: "Environment Setup and Code Understanding"
  checkpoints:
    - "Development environment is fully operational"
    - "AI tools (Copilot/Claude) are configured"
    - "Can explain the project architecture"
    - "Used AI to explore the codebase"
  mentor_discussion:
    - "First impressions of AI tools? Any difficulties?"
    - "What was the hardest part of the codebase to understand?"

week_2:
  title: "AI Practical Application"
  checkpoints:
    - "Created the first PR using AI pair programming"
    - "Used team prompt templates"
    - "Received AI review feedback and responded to it"
    - "Registered at least one entry in the knowledge base"
  mentor_discussion:
    - "What criteria did you use to accept/reject AI suggestions?"
    - "What did you do to improve your prompt writing?"

week_3:
  title: "Transition to Independent Development"
  checkpoints:
    - "Completed one task without mentor assistance"
    - "Established your own AI tool usage patterns"
    - "Reviewed other members' PRs with AI assistance"
  mentor_discussion:
    - "What range of tasks do you feel confident tackling?"
    - "What areas still feel uncertain?"

week_4:
  title: "Autonomy and Contribution"
  checkpoints:
    - "Completed regular sprint tasks independently"
    - "Contributed 3 or more entries to the knowledge base"
    - "Submitted at least one onboarding improvement proposal"
  mentor_discussion:
    - "Overall retrospective of the onboarding process"
    - "Advice for other new members"
```

---

## 7. Measuring and Improving Onboarding Effectiveness

### 7.1 Onboarding Metrics

```python
# System for quantitatively measuring onboarding effectiveness

from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum

class CompetencyLevel(Enum):
    BEGINNER = 1      # Setting up environment
    LEARNING = 2      # Understanding code
    PRACTICING = 3    # Practicing with AI
    INDEPENDENT = 4   # Capable of independent development
    CONTRIBUTING = 5  # Contributing to the team

@dataclass
class OnboardingMetrics:
    """Metrics for onboarding participants"""
    developer_name: str
    start_date: str
    current_level: CompetencyLevel
    milestones: dict[str, str] = field(default_factory=dict)

    # Development activity metrics
    first_commit_date: str = ""
    first_pr_date: str = ""
    first_pr_merged_date: str = ""
    first_solo_task_date: str = ""
    total_prs_merged: int = 0
    total_commits: int = 0
    code_review_given: int = 0

    # AI usage metrics
    ai_sessions_count: int = 0
    ai_prompt_quality_avg: float = 0.0  # 1-5
    ai_suggestion_acceptance_rate: float = 0.0
    knowledge_base_contributions: int = 0

    # Mentoring metrics
    mentor_sessions_count: int = 0
    questions_to_mentor: int = 0
    questions_to_ai: int = 0

    def days_to_first_pr(self) -> int | None:
        """Days to first PR"""
        if not self.first_pr_date:
            return None
        start = datetime.fromisoformat(self.start_date).date()
        first_pr = datetime.fromisoformat(self.first_pr_date).date()
        return (first_pr - start).days

    def days_to_independence(self) -> int | None:
        """Days to independent development"""
        if not self.first_solo_task_date:
            return None
        start = datetime.fromisoformat(self.start_date).date()
        solo = datetime.fromisoformat(self.first_solo_task_date).date()
        return (solo - start).days

    def ai_self_sufficiency_ratio(self) -> float:
        """AI self-resolution ratio (questions to mentor vs. questions to AI)"""
        total = self.questions_to_mentor + self.questions_to_ai
        if total == 0:
            return 0.0
        return self.questions_to_ai / total

    def generate_progress_report(self) -> str:
        """Generate a progress report"""
        days_elapsed = (
            datetime.now().date()
            - datetime.fromisoformat(self.start_date).date()
        ).days

        lines = [
            f"# Onboarding Progress Report: {self.developer_name}",
            f"",
            f"## Basic Information",
            f"- Start date: {self.start_date}",
            f"- Days elapsed: {days_elapsed} days",
            f"- Current level: {self.current_level.name} ({self.current_level.value}/5)",
            f"",
            f"## Milestone Achievement Status",
        ]

        milestone_order = [
            ("Environment setup complete", "env_setup"),
            ("First commit", "first_commit"),
            ("First PR created", "first_pr"),
            ("First PR merged", "first_pr_merged"),
            ("First solo task complete", "first_solo"),
            ("AI prompt proficiency", "ai_proficient"),
            ("Knowledge contribution started", "knowledge_contrib"),
        ]
        for label, key in milestone_order:
            status = self.milestones.get(key, "Not achieved")
            icon = "[x]" if status != "Not achieved" else "[ ]"
            lines.append(f"  - {icon} {label}: {status}")

        lines.extend([
            f"",
            f"## Activity Metrics",
            f"- Commits: {self.total_commits}",
            f"- Merged PRs: {self.total_prs_merged}",
            f"- Code reviews: {self.code_review_given}",
            f"",
            f"## AI Usage Metrics",
            f"- AI sessions: {self.ai_sessions_count}",
            f"- Prompt quality: {self.ai_prompt_quality_avg:.1f}/5.0",
            f"- AI suggestion acceptance rate: {self.ai_suggestion_acceptance_rate:.0%}",
            f"- AI self-resolution rate: {self.ai_self_sufficiency_ratio():.0%}",
            f"- Knowledge contributions: {self.knowledge_base_contributions}",
        ])

        first_pr_days = self.days_to_first_pr()
        if first_pr_days is not None:
            lines.append(f"")
            lines.append(f"## Speed Indicators")
            lines.append(f"- Days to first PR: {first_pr_days} days")

        independence_days = self.days_to_independence()
        if independence_days is not None:
            lines.append(f"- Days to independence: {independence_days} days")

        return "\n".join(lines)


@dataclass
class OnboardingBenchmark:
    """Onboarding benchmark comparison"""

    historical_data: list[OnboardingMetrics] = field(default_factory=list)

    def average_time_to_first_pr(self) -> float:
        """Historical average days to first PR"""
        days = [m.days_to_first_pr() for m in self.historical_data
                if m.days_to_first_pr() is not None]
        return sum(days) / len(days) if days else 0

    def average_time_to_independence(self) -> float:
        """Historical average days to independent development"""
        days = [m.days_to_independence() for m in self.historical_data
                if m.days_to_independence() is not None]
        return sum(days) / len(days) if days else 0

    def ai_adoption_correlation(self) -> str:
        """Correlation analysis between AI adoption and ramp-up speed"""
        fast_starters = [
            m for m in self.historical_data
            if m.days_to_independence() is not None
            and m.days_to_independence() < self.average_time_to_independence()
        ]
        slow_starters = [
            m for m in self.historical_data
            if m.days_to_independence() is not None
            and m.days_to_independence() >= self.average_time_to_independence()
        ]

        if not fast_starters or not slow_starters:
            return "Insufficient data"

        fast_ai_rate = sum(m.ai_suggestion_acceptance_rate for m in fast_starters) / len(fast_starters)
        slow_ai_rate = sum(m.ai_suggestion_acceptance_rate for m in slow_starters) / len(slow_starters)

        return (
            f"AI adoption rate for fast starters: {fast_ai_rate:.0%}\n"
            f"AI adoption rate for slow starters: {slow_ai_rate:.0%}\n"
            f"Difference: {abs(fast_ai_rate - slow_ai_rate):.0%}"
        )

    def generate_benchmark_report(self) -> str:
        """Generate a benchmark report"""
        return f"""
# Onboarding Benchmark Report

## Participants: {len(self.historical_data)}

## Speed Benchmarks
- Average days to first PR: {self.average_time_to_first_pr():.1f} days
- Average days to independence: {self.average_time_to_independence():.1f} days

## Relationship Between AI Adoption and Ramp-Up Speed
{self.ai_adoption_correlation()}

## Recommended Actions
- If first PR takes more than 5 days -> Increase 1-on-1 sessions with mentor
- If AI adoption rate is below 30% -> Re-conduct AI training
- If knowledge contributions are 0 -> Support building the habit of registering knowledge
"""
```

### 7.2 Onboarding Improvement Cycle

```
Continuous cycle for onboarding improvement:

┌──────────────────────────────────────────────────────┐
│                                                      │
│  (1) Measure: Collect new member metrics             │
│     |   - Days to first PR                           │
│     |   - Days to independent development            │
│     |   - AI adoption level                          │
│     |   - Satisfaction survey                        │
│     v                                               │
│  (2) Analyze: Compare with benchmarks                │
│     |   - Compare with historical averages           │
│     |   - Identify bottlenecks                       │
│     |   - Correlate AI adoption with ramp-up speed   │
│     v                                               │
│  (3) Improve: Update the process                     │
│     |   - Adjust the curriculum                      │
│     |   - Optimize AI tool settings                  │
│     |   - Expand the knowledge base                  │
│     |   - Provide feedback to mentors                │
│     v                                               │
│  (4) Apply: Reflect in next new member onboarding    │
│     |                                               │
│     └──────────► Return to (1)                      │
│                                                      │
│  Cycle: Quarterly retrospective                      │
│  KPIs: Days to independence, AI adoption, satisfaction│
└──────────────────────────────────────────────────────┘
```

---

## 8. AI-Era Onboarding Checklist

### 8.1 Comprehensive Onboarding Checklist

```yaml
# .ai/onboarding/comprehensive-checklist.yaml
# Comprehensive checklist for AI-era onboarding

phase_1_environment:
  title: "Phase 1: Environment Setup (Day 1-2)"
  items:
    development_setup:
      - "Confirm development machine OS and initial settings"
      - "Git configuration (username, email, SSH keys)"
      - "Install programming language runtimes"
      - "Install and configure editor/IDE"
      - "Clone project and verify build"
      - "Verify local test execution"

    ai_tools_setup:
      - "Install and activate GitHub Copilot"
      - "Install and authenticate Claude Code CLI"
      - "Apply team-standard AI configuration files"
      - "Verify AI tool security settings (telemetry, etc.)"
      - "Confirm access to the prompt library"

    access_and_accounts:
      - "Repository access on GitHub/GitLab"
      - "Access to CI/CD pipelines"
      - "Join relevant Slack channels"
      - "Account for project management tools (Jira/Linear, etc.)"
      - "Confirm access to the knowledge base"

phase_2_understanding:
  title: "Phase 2: Codebase Understanding (Day 3-5)"
  items:
    architecture:
      - "Asked AI about the architecture overview"
      - "Can explain the responsibilities of major components"
      - "Can trace the request flow"
      - "Understood the data model relationships"

    domain_knowledge:
      - "Understood the product overview and target users"
      - "Can explain 3 or more major business rules"
      - "Reviewed the domain glossary"
      - "Conducted a Q&A session on domain knowledge with mentor"

    development_flow:
      - "Understood the branching strategy"
      - "Understood the process from PR creation to merge"
      - "Grasped the CI/CD pipeline contents"
      - "Understood the deployment process"

phase_3_practice:
  title: "Phase 3: AI Practical Application (Week 2)"
  items:
    ai_coding:
      - "Generated first code using AI pair programming"
      - "Reviewed and modified AI-generated code"
      - "Used 3 or more team prompt templates"
      - "Developed at least one custom prompt pattern"

    quality_assurance:
      - "Generated tests using AI"
      - "Responded to AI review feedback"
      - "Documented the scope of AI assistance in PR descriptions"
      - "Reported cases where AI feedback was inappropriate"

    first_contributions:
      - "Created the first PR"
      - "PR was merged"
      - "Left review comments on other members' PRs"
      - "Registered the first entry in the knowledge base"

phase_4_independence:
  title: "Phase 4: Autonomy (Week 3-4)"
  items:
    independent_work:
      - "Completed a task without constant mentor support"
      - "Established your own AI-powered workflow"
      - "Able to self-correct when AI answers are inaccurate"
      - "Made technical decisions autonomously"

    team_contribution:
      - "Contributed 3 or more entries to the knowledge base"
      - "Proposed improvements to team prompt templates"
      - "Submitted at least one onboarding process improvement proposal"
      - "Shared new insights with the team"

    assessment:
      - "Received final evaluation from mentor"
      - "Created self-assessment report"
      - "Set future growth goals"
```

### 8.2 Graduation Criteria

```python
# Onboarding graduation assessment system

from dataclasses import dataclass

@dataclass
class GraduationCriteria:
    """Onboarding graduation criteria"""

    # Mandatory criteria (all must be met)
    MANDATORY = {
        "first_pr_merged": "At least one PR has been merged",
        "ai_tool_setup": "AI tools are correctly configured",
        "code_understanding": "Mentor approved understanding level",
        "security_rules": "Understands security rules",
    }

    # Recommended criteria (desirable to meet 80% or more)
    RECOMMENDED = {
        "solo_task_completed": "Completed at least one solo task",
        "knowledge_contribution": "Contributed at least one entry to the knowledge base",
        "code_review_given": "Reviewed other members' PRs",
        "ai_prompt_quality": "Prompt quality score of 3.0 or above",
        "ai_acceptance_rate": "AI suggestion acceptance rate of 40% or above",
    }

    def evaluate(self, metrics: OnboardingMetrics) -> dict:
        """Execute graduation assessment"""
        mandatory_results = {}
        mandatory_results["first_pr_merged"] = metrics.total_prs_merged >= 1
        mandatory_results["ai_tool_setup"] = metrics.ai_sessions_count > 0
        mandatory_results["code_understanding"] = metrics.current_level.value >= 3
        mandatory_results["security_rules"] = "security" in metrics.milestones

        recommended_results = {}
        recommended_results["solo_task_completed"] = metrics.first_solo_task_date != ""
        recommended_results["knowledge_contribution"] = metrics.knowledge_base_contributions >= 1
        recommended_results["code_review_given"] = metrics.code_review_given >= 1
        recommended_results["ai_prompt_quality"] = metrics.ai_prompt_quality_avg >= 3.0
        recommended_results["ai_acceptance_rate"] = metrics.ai_suggestion_acceptance_rate >= 0.4

        mandatory_pass = all(mandatory_results.values())
        recommended_pass_rate = sum(recommended_results.values()) / len(recommended_results)

        return {
            "graduated": mandatory_pass and recommended_pass_rate >= 0.8,
            "mandatory": mandatory_results,
            "mandatory_all_pass": mandatory_pass,
            "recommended": recommended_results,
            "recommended_pass_rate": recommended_pass_rate,
            "message": self._generate_message(mandatory_pass, recommended_pass_rate),
        }

    def _generate_message(self, mandatory_pass: bool, recommended_rate: float) -> str:
        if mandatory_pass and recommended_rate >= 0.8:
            return "Graduation assessment: PASSED. Ready to join regular sprints."
        elif mandatory_pass and recommended_rate >= 0.6:
            return "Graduation assessment: CONDITIONAL PASS. Continue working on some recommended criteria."
        elif mandatory_pass:
            return "Graduation assessment: ON HOLD. Recommended criteria pass rate is low; an additional week of support is recommended."
        else:
            return "Graduation assessment: NOT PASSED. Mandatory criteria not met; please create an additional plan with your mentor."
```

---

## 9. Anti-Patterns

### 7.1 Anti-Pattern: Over-Relying on AI During Onboarding

```
NG: Teaching that everything can be answered by AI
  - Leaving people with just "Ask AI if you don't know"
  - Zero dialogue with mentors
  - Domain-specific tacit knowledge never gets transferred
  - Risk of blindly accepting incorrect AI answers

OK: AI assists, humans lead
  1. First, ask AI (efficiency)
  2. Verify the AI's answer yourself (critical thinking)
  3. Confirm unclear points with your mentor (reliable source)
  4. Record what you learned in the knowledge base (organizational contribution)
```

### 7.2 Anti-Pattern: One-Size-Fits-All AI Training

```
NG: Conducting AI training at the same pace for everyone
  - Same curriculum for a 5-year senior and a fresh graduate
  - Ignoring differences in programming language experience
  - Not considering different learning styles

OK: Adaptive curriculum by skill level
  - New grad/Junior: AI basics -> Basic prompts -> Practice (3 days)
  - Mid-level: Advanced prompts -> Workflow integration (1 day)
  - Senior: Team strategy -> Governance design (half day)
  - AI native: Tool evaluation -> Team evangelism (half day)
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Include test code

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
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm time complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Configuration file issues | Check the config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, transaction management |

### Debugging Procedure

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Verify step by step**: Use log output or a debugger to verify hypotheses
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
            logger.error(f"Exception in {func.__name__}: {e}")
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

Steps for diagnosing performance problems:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Examine disk and network I/O status
4. **Check concurrent connections**: Examine connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper reference release |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on minimum viable features
- Automated tests only for critical paths
- Introduce monitoring early on

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Incrementally modernizing a system that has been running for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create characterization tests first if existing tests are absent
- Use an API gateway to coexist old and new systems
- Migrate data incrementally

| Phase | Work Content | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration Start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core Migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission legacy system | 2-4 weeks | Medium |

### Scenario 3: Large-Scale Team Development

**Situation:** More than 50 engineers developing the same product

**Approach:**
- Clarify boundaries using Domain-Driven Design
- Set ownership per team
- Manage shared libraries using Inner Source approach
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
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
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
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

### Scenario 4: Performance-Critical Systems

**Situation:** A system that requires millisecond-level response times

**Optimization Points:**
1. Cache strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | Use Case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |

---

## Team Development Practices

### Code Review Checklist

Key points to check in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security concerns?
- [ ] Has documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Entire team | Horizontal knowledge spread |
| ADR (Architecture Decision Records) | As needed | Future members | Decision transparency |
| Retrospectives | Biweekly | Entire team | Continuous improvement |
| Mob programming | Monthly | Important designs | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        Impact High
          |
    ┌─────┼─────┐
    │ Plan │ Fix  │
    │ and  │ Imme-│
    │ sche-│ dia- │
    │ dule │ tely │
    ├─────┼─────┤
    │ Log  │ Next │
    │ only │Sprint│
    │      │      │
    └─────┼─────┘
          |
        Impact Low
    Frequency Low  Frequency High
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------|------------|------|---------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor auth, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, principle of least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logging, audit trails | Log analysis |

### Secure Coding Best Practices

```python
# Secure coding example
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """Security utilities"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate a cryptographically secure token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """Hash a password"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """Verify a password"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input value"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage example
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not output in logs
- [ ] HTTPS is enforced
- [ ] CORS policy is properly configured
- [ ] Dependency vulnerability scanning has been performed
- [ ] Error messages do not contain internal information
---

## 8. FAQ

### Q1: How much can the onboarding period be shortened?

**A**: An average reduction of 40-60% compared to pre-AI adoption has been reported. The codebase understanding phase shows the most significant improvement -- by asking AI to explain the architecture, the overall comprehension that previously took 1-2 weeks can be shortened to 2-3 days. However, understanding domain knowledge and team culture requires time that AI cannot replace.

### Q2: How much time should be dedicated to AI tool training?

**A**: An intensive 1-2 days in the first week, followed by OJT through real tasks is most effective. Classroom learning alone doesn't stick, so emphasis should be placed on practicing AI use in actual tasks. Ideally, encourage AI usage awareness in all tasks during the first month, with a retrospective session at the end of the month.

### Q3: How do you maintain continuous knowledge base updates?

**A**: (1) Include a knowledge registration check when creating PRs, (2) make knowledge registration a mandatory task in sprint retrospectives, (3) introduce a system where AI automatically extracts knowledge candidates from PRs, (4) include knowledge contributions in evaluation criteria. The most effective approach is building a system where knowledge registration becomes a natural part of the workflow.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What common mistakes do beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently used in daily development work. It becomes especially important during code reviews and architecture design.

---

## 9. Summary

| Category | Key Point |
|---------|---------|
| Overall Design | Progress through 4 phases (Env Setup -> Understanding -> Practice -> Autonomy) |
| Environment Setup | Automated scripts + team-standardized AI tool settings |
| Code Understanding | Explore with AI -> Understanding check sheet -> Mentor confirmation |
| AI Training | Skill-level-based curriculum + real-task OJT |
| Knowledge | Continuous conversion of tacit to explicit knowledge + searchable DB |
| Mentoring | AI assists, humans lead. Weekly 1-on-1s for progress check |
| Time Reduction | Target 40-60% reduction vs. traditional. Domain knowledge is the exception |

---

## Recommended Next Reads

- [00-ai-team-practices.md](./00-ai-team-practices.md) -- AI-Era Team Development Practices
- Prompt Engineering -- Details on effective prompt design
- AI Development Governance -- Security and compliance

---

## References

1. Google re:Work, "Guide: Set up a new hire onboarding program" -- https://rework.withgoogle.com/guides/hiring/steps/set-up-onboarding/
2. Stripe, "Developer Coefficient Report" -- https://stripe.com/reports/developer-coefficient
3. Anthropic, "Prompt Engineering Guide" -- https://docs.anthropic.com/claude/docs/prompt-engineering
4. GitHub, "Onboarding developers with GitHub Copilot" -- https://github.blog/
5. ThoughtWorks, "Technology Radar: AI-assisted development" -- https://www.thoughtworks.com/radar
