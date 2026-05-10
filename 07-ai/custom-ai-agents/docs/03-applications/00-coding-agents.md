# Coding Agents

> Claude Code, Devin, Cursor — the mechanics, design patterns, and practical usage of coding agents that autonomously understand, generate, modify, and test code.

## What You Will Learn

1. Coding agent architecture and comparison of major products
2. Designing automated pipelines for code generation, modification, testing, and review
3. Effective usage of coding agents and understanding their limitations
4. Implementation patterns for custom coding agents
5. Integration into development workflows and operational best practices


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What Are Coding Agents?

```
Coding Agent Capability Spectrum

  Code Completion          Coding Agent
  (line-level)             (project-level)
  +------+------+------+------+------+------+
  | Line | Func | File | Multi| Feat | Proj |
  | comp | gen  | gen  | file | impl | wide |
  +------+------+------+------+------+------+
  Copilot               Claude Code / Devin
  (passive)              (active)

Coding Agent = LLM + File Operations + Command Execution + Search
```

### 1.1 Coding Agent Operation Flow

```
Typical Bug Fix Flow

1. [Understand Issue] : Analyze the bug report
       |
2. [Code Search]      : Identify relevant files
       |
3. [Root Cause]       : Read code and infer the cause
       |
4. [Write Test]       : Write a reproduction test (RED)
       |
5. [Fix Implementation]: Modify the code (GREEN)
       |
6. [Run Tests]        : Confirm all tests pass
       |
7. [Review]           : Quality check the changes
       |
8. [Commit]           : Save the changes
```

### 1.2 Classification of Coding Agents

```
Classification by Autonomy Level

Level 1: Code Completion
  - Line/function-level suggestions
  - Human triggers the action
  - Example: GitHub Copilot (Inline)

Level 2: Interactive Generation
  - Chat instruction → code generation
  - Human approves and applies
  - Example: Cursor Chat, Copilot Chat

Level 3: Autonomous Task Execution
  - Task description → multi-file changes
  - Uses tools autonomously
  - Human intervenes at review
  - Example: Claude Code, Aider, Cline

Level 4: End-to-End Autonomy
  - Autonomous from Issue → completed PR
  - Runs tests and CI checks
  - Human only decides on merge
  - Example: Devin, SWE-Agent
```

---

## 2. Major Coding Agents

### 2.1 Product Comparison

| Product | Developer | Form | Features | Autonomy |
|---------|-----------|------|----------|----------|
| Claude Code | Anthropic | CLI | Terminal integration, MCP support | L3 |
| Devin | Cognition | Web | Full-stack autonomous development | L3-L4 |
| Cursor | Cursor Inc. | IDE | VS Code fork, AI integration | L2-L3 |
| GitHub Copilot | GitHub | IDE extension | Line/function-level completion | L1 |
| Cline | Community | VSCode extension | Agent-style, MCP support | L2-L3 |
| Aider | Community | CLI | Git integration, pair programming style | L2-L3 |
| Windsurf | Codeium | IDE | AI-integrated IDE, Cascade | L2-L3 |
| Amazon Q Developer | AWS | IDE/CLI | AWS integration, security scanning | L2 |

### 2.2 Architecture Comparison

```
Claude Code Architecture:
+-------------------------------------------+
| Terminal (CLI)                             |
|  +---------------------------------------+|
|  | Agent Loop                            ||
|  |  [LLM] <-> [Tools]                    ||
|  |    |         +-- Read (file reading)  ||
|  |    |         +-- Write (file writing) ||
|  |    |         +-- Bash (cmd execution) ||
|  |    |         +-- Grep (search)        ||
|  |    |         +-- Glob (file search)   ||
|  |    |         +-- MCP (external tools) ||
|  |    |                                  ||
|  |    +-- Conversation history + context ||
|  +---------------------------------------+|
+-------------------------------------------+

Cursor Architecture:
+-------------------------------------------+
| VS Code (IDE)                              |
|  +---------------------------------------+|
|  | Composer / Chat                       ||
|  |  [LLM] <-> [IDE integration tools]   ||
|  |    |         +-- File editing         ||
|  |    |         +-- Terminal             ||
|  |    |         +-- Codebase search      ||
|  |    |         +-- Lint/Tests           ||
|  |    |                                  ||
|  |    +-- codebase indexing              ||
|  +---------------------------------------+|
+-------------------------------------------+
```

### 2.3 Detailed Tool Design Comparison

```
Tool Granularity Comparison

Claude Code:
  - Read: Entire file or line range specification
  - Write: Full file overwrite
  - Edit: Partial string replacement (old_string → new_string)
  - Bash: Any shell command
  - Grep: High-speed search based on ripgrep
  - Glob: File pattern matching

Cursor:
  - Edit: Apply in diff format
  - Terminal: Command execution
  - Codebase: Semantic search (indexed)
  - Lint: Built-in linter integration

Aider:
  - file edit: unified diff format
  - shell: command execution
  - git: Git operations (add, commit)

Design Points:
  - File editing: full replacement vs diff application vs search-replace
  - Search: text search vs semantic search vs AST search
  - Execution: sandbox presence, timeout settings
```

---

## 3. Implementing Coding Agents

### 3.1 Basic Coding Agent

```python
# Simple coding agent implementation
import anthropic
import subprocess
import os

class CodingAgent:
    def __init__(self, workspace: str):
        self.client = anthropic.Anthropic()
        self.workspace = workspace
        self.tools = [
            {
                "name": "read_file",
                "description": "Read the contents of a file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"}
                    },
                    "required": ["path"]
                }
            },
            {
                "name": "write_file",
                "description": "Write content to a file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"}
                    },
                    "required": ["path", "content"]
                }
            },
            {
                "name": "run_command",
                "description": "Execute a shell command (tests, lint, etc.)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string"}
                    },
                    "required": ["command"]
                }
            },
            {
                "name": "search_code",
                "description": "Grep search the codebase",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string"},
                        "file_pattern": {
                            "type": "string",
                            "description": "*.py, *.ts, etc."
                        }
                    },
                    "required": ["pattern"]
                }
            }
        ]

    def execute_tool(self, name: str, args: dict) -> str:
        full_path = os.path.join(self.workspace, args.get("path", ""))

        if name == "read_file":
            with open(full_path) as f:
                return f.read()

        elif name == "write_file":
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w") as f:
                f.write(args["content"])
            return f"Written to {args['path']}"

        elif name == "run_command":
            result = subprocess.run(
                args["command"], shell=True,
                capture_output=True, text=True,
                cwd=self.workspace, timeout=60
            )
            output = result.stdout + result.stderr
            return output[:5000]

        elif name == "search_code":
            cmd = (
                f"grep -rn '{args['pattern']}' "
                f"--include='{args.get('file_pattern', '*')}' ."
            )
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True,
                cwd=self.workspace
            )
            return result.stdout[:5000]

        return f"Unknown tool: {name}"

    def run(self, task: str) -> str:
        system = """You are a senior software engineer.
Always read and understand existing code before making any changes.
Write tests first, then implement, and confirm all tests pass."""

        messages = [{"role": "user", "content": task}]

        for _ in range(30):
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=system,
                tools=self.tools,
                messages=messages
            )

            if response.stop_reason == "end_turn":
                return response.content[0].text

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self.execute_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })

            messages.append({
                "role": "assistant",
                "content": response.content
            })
            messages.append({"role": "user", "content": tool_results})

        return "Maximum number of steps reached"
```

### 3.2 TDD (Test-Driven Development) Agent

```python
# Coding agent with TDD pattern
class TDDAgent(CodingAgent):
    def implement_feature(self, feature_description: str) -> str:
        """Implement a feature using test-driven development"""
        return self.run(f"""
Please implement the following feature using TDD (Test-Driven Development).

Feature: {feature_description}

Steps:
1. First explore the existing codebase to understand the directory structure and coding style
2. Create test files (tests should fail = RED)
3. Run the tests and confirm they fail
4. Write the minimum implementation to make the tests pass (GREEN)
5. Run the tests and confirm they all pass
6. Refactor as needed (REFACTOR)
7. Confirm all tests still pass at the end

Important: Actually run the tests at each step.
""")
```

### 3.3 Code Review Agent

```python
# Code review agent
class CodeReviewAgent:
    def __init__(self):
        self.client = anthropic.Anthropic()

    def review_diff(self, diff: str) -> str:
        """Review a diff and point out areas for improvement"""
        return self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": f"""
Please review the following code diff.

```diff
{diff}
```

Evaluate from the following perspectives:
1. **Bugs**: Logic errors, edge cases, null/undefined
2. **Security**: Injection, authentication, authorization
3. **Performance**: N+1 problems, unnecessary processing
4. **Readability**: Naming, structure, comments
5. **Tests**: Test coverage, edge case testing

Assign a severity level (Critical/Warning/Info) to each issue.
"""}]
        ).content[0].text

    def review_pr(self, repo: str, pr_number: int) -> dict:
        """Comprehensively review a GitHub PR"""
        # Fetch PR information
        pr_info = self._get_pr_info(repo, pr_number)
        diff = self._get_pr_diff(repo, pr_number)
        changed_files = self._get_changed_files(repo, pr_number)

        # Review per file
        file_reviews = []
        for file in changed_files:
            file_diff = self._extract_file_diff(diff, file)
            review = self.review_diff(file_diff)
            file_reviews.append({
                "file": file,
                "review": review
            })

        # Generate overall summary
        summary = self._generate_summary(
            pr_info, file_reviews
        )

        return {
            "summary": summary,
            "file_reviews": file_reviews,
            "approval": self._determine_approval(file_reviews)
        }

    def _determine_approval(self, reviews: list) -> str:
        """Determine approval based on review results"""
        has_critical = any(
            "Critical" in r["review"] for r in reviews
        )
        if has_critical:
            return "CHANGES_REQUESTED"
        return "APPROVED"
```

### 3.4 Refactoring Agent

```python
class RefactoringAgent(CodingAgent):
    """Agent specialized in code refactoring"""

    def refactor_function(
        self,
        file_path: str,
        function_name: str,
        goal: str
    ) -> str:
        """Refactor a function"""
        return self.run(f"""
Please refactor the following function.

File: {file_path}
Function name: {function_name}
Goal: {goal}

Steps:
1. Search for and understand the target function and all its callers
2. Check existing tests (add tests first if none exist)
3. Run the tests to confirm the current passing state
4. Perform the refactoring
5. Run the tests and confirm they all pass
6. Confirm there is no impact on callers

Important:
- Do not change the external interface (function signature)
- Test results must be identical before and after refactoring
- Proceed in small steps rather than making large changes at once
""")

    def extract_method(
        self,
        file_path: str,
        start_line: int,
        end_line: int,
        new_function_name: str
    ) -> str:
        """Extract method refactoring"""
        return self.run(f"""
Please extract the following code range as a new function.

File: {file_path}
Line range: {start_line}-{end_line}
New function name: {new_function_name}

Steps:
1. Read the target code and identify required arguments and return values
2. Create the new function
3. Replace the original code with a call to the new function
4. Run the tests to verify behavior
""")

    def remove_code_duplication(self, directory: str) -> str:
        """Detect and eliminate code duplication"""
        return self.run(f"""
Please detect and eliminate code duplication in the following directory.

Directory: {directory}

Steps:
1. Read all files in the directory and detect similar code
2. Prioritize patterns with 3 or more duplications
3. Extract common functions/classes to eliminate duplication
4. Confirm all tests pass
5. Output a summary report of the changes

Important:
- Fix one duplication pattern at a time, incrementally
- Run tests after each fix to verify
""")
```

### 3.5 Migration Agent

```python
class MigrationAgent(CodingAgent):
    """Agent for language/framework migrations"""

    def migrate_dependency(
        self,
        old_package: str,
        new_package: str,
        migration_guide: str = ""
    ) -> str:
        """Migrate a dependency package"""
        return self.run(f"""
Please perform the following package migration.

Before: {old_package}
After: {new_package}
{f'Migration guide: {migration_guide}' if migration_guide else ''}

Steps:
1. Search for all usages of {old_package} in the current codebase
2. Plan how to change each usage
3. Update package dependencies (package.json, requirements.txt, etc.)
4. Change the code one file at a time
5. Run tests after each file change
6. Confirm all tests pass
7. Output a summary report of the changes

Important:
- Pay attention to API compatibility differences
- Use replacement methods for deprecated features
- Also handle type definition changes
""")

    def upgrade_framework(
        self,
        framework: str,
        from_version: str,
        to_version: str
    ) -> str:
        """Upgrade a framework version"""
        return self.run(f"""
Please upgrade {framework} from v{from_version} to v{to_version}.

Steps:
1. Review the list of breaking changes
2. Identify affected files
3. Update dependency versions
4. Fix code compatibility
5. Resolve deprecated warnings
6. Run tests to verify
7. Summarize the changelog
""")
```

---

## 4. Effective Prompt Design

### 4.1 Designing CLAUDE.md

```python
# Example CLAUDE.md for coding agents
CLAUDE_MD = """
# Project-Specific Rules

## Technology Stack
- Backend: Python 3.12, FastAPI, SQLAlchemy
- Frontend: TypeScript, React 19, Tailwind CSS
- DB: PostgreSQL 16
- Testing: pytest, vitest

## Coding Conventions
- Python: Black + isort + mypy strict
- TypeScript: ESLint + Prettier
- Commit messages: Conventional Commits

## Directory Structure
- backend/src/ : Backend source code
- backend/tests/ : Backend tests
- frontend/src/ : Frontend source code
- frontend/tests/ : Frontend tests

## Important Notes
- Always create an Alembic migration when changing the DB
- Update the OpenAPI schema when adding API endpoints
- Append new environment variables to .env.example
"""
```

### 4.2 Task-Specific Prompt Templates

```python
# Bug fix prompt
BUG_FIX_PROMPT = """
## Bug Fix Request

### Symptoms
{description of symptoms}

### Steps to Reproduce
{reproduction steps}

### Expected Behavior
{expected behavior}

### Error Log (if any)
```
{error log}
```

### Approach
1. First write a reproduction test and confirm it fails
2. Identify the root cause
3. Fix with minimal changes
4. Confirm tests pass
5. Confirm all related existing tests also pass
"""

# New feature implementation prompt
FEATURE_PROMPT = """
## New Feature Implementation Request

### Feature Overview
{feature description}

### Acceptance Criteria
{list of acceptance criteria}

### Technical Constraints
{constraints}

### Approach
1. Explore the existing codebase
2. Report the design plan
3. Write tests first (TDD)
4. Implement
5. Confirm tests pass
6. Update documentation (as needed)
"""

# Refactoring prompt
REFACTORING_PROMPT = """
## Refactoring Request

### Target
{target file/module}

### Purpose
{purpose of refactoring}

### Constraints
- Do not change external interfaces
- Pass all existing tests
- Do not degrade performance

### Approach
1. Check current test coverage (add if insufficient)
2. Make incremental changes in small steps
3. Run tests after each step
"""
```

### 4.3 Best Practices for Coding Agent Integration

```python
# Example of coding agent usage in GitHub Actions
"""
name: Agent-Assisted Code Review

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
          git diff origin/${{ github.base_ref }}...HEAD > pr.diff
          echo "diff_file=pr.diff" >> $GITHUB_OUTPUT

      - name: AI Code Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          python scripts/ai_review.py \
            --diff-file pr.diff \
            --output review.md

      - name: Post Review Comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const review = fs.readFileSync('review.md', 'utf8');
            await github.rest.pulls.createReview({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.payload.pull_request.number,
              body: review,
              event: 'COMMENT'
            });
"""
```

---

## 5. Performance and Limitations

### 5.1 Strengths vs. Weaknesses

| Strengths | Weaknesses |
|-----------|------------|
| Bug fixing (clear errors) | Architecture design (global optimization) |
| Test writing | UX/UI design decisions |
| Refactoring | Requirements definition for business logic |
| Documentation generation | Large-scale refactoring of legacy code |
| API implementation | Performance tuning (requires measurement) |
| Type definition / schema creation | Security auditing (comprehensive) |
| Boilerplate generation | Changes spanning multiple repositories |
| Dependency package updates | Changes exceeding the context window |
| Code migration | Implementation decisions relying on tacit knowledge |

### 5.2 SWE-bench Score Comparison (approximate as of 2025)

| Agent | SWE-bench Lite | SWE-bench Full |
|-------|----------------|----------------|
| Claude Code (Opus) | ~55% | ~35% |
| Devin | ~45% | ~25% |
| GPT-4o + SWE-Agent | ~35% | ~20% |
| Human engineer | ~80% | ~60% |

### 5.3 Context Window Constraints and Countermeasures

```
Efficient Use of the Context Window

Problem: Cannot fit a large codebase into the context

Solution 1: Smart search strategy
  [Task] → [Keyword extraction] → [Grep/Glob search]
  → [Identify relevant files] → [Load only necessary portions]

Solution 2: Incremental loading
  1st pass: Understand directory structure
  2nd pass: Read overviews of related files
  3rd pass: Detailed reading of target files for modification

Solution 3: Context compression
  - Compress old conversations into summaries
  - Discard unnecessary file contents
  - Retain only relevant portions

Solution 4: Task decomposition
  Break large tasks into smaller subtasks
  Process each subtask in an independent context
```

### 5.4 Error Analysis and Debugging Strategies

```python
class DebugAgent(CodingAgent):
    """Agent specialized in debugging"""

    def diagnose_error(self, error_log: str) -> str:
        """Diagnose the root cause from an error log"""
        return self.run(f"""
Please diagnose and fix the following error.

Error log:
```
{error_log}
```

Diagnostic steps:
1. Identify the type of error from the error message
2. Identify the location of occurrence from the stack trace
3. Read the relevant code and analyze the cause
4. Also check related code and configuration
5. Propose and implement a fix
6. Verify the fix with tests

Report the analysis results in the following format:
- Error type:
- Location of occurrence:
- Root cause:
- Fix method:
- Prevention measures:
""")

    def investigate_flaky_test(self, test_path: str) -> str:
        """Investigate an unstable (intermittently failing) test"""
        return self.run(f"""
The following test is flaky (fails occasionally). Please investigate the cause.

Test path: {test_path}

Investigation steps:
1. Read and understand the test code
2. Check the code under test
3. Investigate the cause from the following perspectives:
   - Time dependency (timezone, timeout)
   - Order dependency (dependencies between tests)
   - External dependency (API, DB, files)
   - Concurrency (race conditions)
   - Environment dependency (OS, version)
4. Run the test multiple times to observe behavior
5. Implement a fix
6. Run the test multiple times after the fix to confirm stability
""")
```

---

## 6. Integration into Development Workflows

### 6.1 Using Coding Agents in Team Development

```
Team Development Workflow

1. Issue Creation (human)
   → Describe requirements, acceptance criteria, and technical constraints

2. Implementation (agent + human)
   → Agent creates the initial implementation
   → Human reviews and provides feedback
   → Agent makes revisions

3. Review (agent + human)
   → Agent performs automated review (bugs, security, performance)
   → Human reviews from an architecture and business logic perspective

4. Testing (agent)
   → Automated testing in CI/CD
   → Agent supplements test coverage

5. Merge (human)
   → Final decision is made by a human
```

### 6.2 Evaluation Metrics for Coding Agents

```python
class CodingAgentEvaluator:
    """Performance evaluation for coding agents"""

    def evaluate_task(
        self,
        task_description: str,
        agent_output: dict,
        ground_truth: dict
    ) -> dict:
        """Evaluate a task execution result"""
        metrics = {}

        # 1. Accuracy: test pass rate
        metrics["test_pass_rate"] = self._run_tests(
            agent_output["modified_files"]
        )

        # 2. Code quality: static analysis score
        metrics["lint_score"] = self._run_linter(
            agent_output["modified_files"]
        )

        # 3. Efficiency: number of steps and token consumption
        metrics["total_steps"] = agent_output["steps"]
        metrics["total_tokens"] = agent_output["tokens"]
        metrics["total_cost"] = agent_output["cost"]

        # 4. Appropriateness of the diff: check for unnecessary changes
        metrics["unnecessary_changes"] = self._check_unnecessary_changes(
            agent_output["diff"],
            ground_truth.get("expected_diff")
        )

        # 5. Time: execution time
        metrics["execution_time"] = agent_output["duration_seconds"]

        return metrics

    def benchmark_suite(
        self,
        agent,
        test_cases: list[dict]
    ) -> dict:
        """Run a benchmark suite"""
        results = []

        for case in test_cases:
            try:
                output = agent.run(case["task"])
                metrics = self.evaluate_task(
                    case["task"], output, case["expected"]
                )
                results.append({
                    "case_id": case["id"],
                    "status": "completed",
                    "metrics": metrics
                })
            except Exception as e:
                results.append({
                    "case_id": case["id"],
                    "status": "error",
                    "error": str(e)
                })

        # Aggregate
        completed = [r for r in results if r["status"] == "completed"]
        return {
            "total_cases": len(test_cases),
            "completed": len(completed),
            "success_rate": (
                sum(1 for r in completed
                    if r["metrics"]["test_pass_rate"] == 1.0)
                / len(completed) if completed else 0
            ),
            "avg_steps": (
                sum(r["metrics"]["total_steps"] for r in completed)
                / len(completed) if completed else 0
            ),
            "avg_cost": (
                sum(r["metrics"]["total_cost"] for r in completed)
                / len(completed) if completed else 0
            ),
            "details": results
        }
```

---

## 7. Security and Guardrails

### 7.1 Security Measures for Coding Agents

```python
class SecureCodingAgent(CodingAgent):
    """Coding agent with built-in security measures"""

    # Blocked commands
    BLOCKED_COMMANDS = [
        r"rm\s+-rf\s+/",
        r"curl.*\|\s*bash",
        r"wget.*\|\s*sh",
        r"chmod\s+777",
        r"sudo\s+",
        r"eval\s*\(",
    ]

    # Protected paths (write-protected)
    PROTECTED_PATHS = [
        ".env",
        ".git/",
        "credentials",
        "secrets",
        "node_modules/",
        "__pycache__/",
    ]

    def execute_tool(self, name: str, args: dict) -> str:
        # Check command safety
        if name == "run_command":
            for pattern in self.BLOCKED_COMMANDS:
                if re.search(pattern, args["command"]):
                    return f"Rejected by security policy: {args['command']}"

        # Check write path
        if name == "write_file":
            for protected in self.PROTECTED_PATHS:
                if protected in args.get("path", ""):
                    return f"Write to protected path rejected: {args['path']}"

        return super().execute_tool(name, args)
```

### 7.2 Security Check Integration

```python
class SecurityReviewAgent:
    """Code review from a security perspective"""

    SECURITY_CHECKS = {
        "sql_injection": {
            "patterns": [
                r"f\".*SELECT.*{",
                r"f'.*SELECT.*{",
                r"\.format\(.*SELECT",
                r"\+.*SELECT.*\+",
            ],
            "severity": "critical",
            "recommendation": "Use parameterized queries"
        },
        "xss": {
            "patterns": [
                r"innerHTML\s*=",
                r"dangerouslySetInnerHTML",
                r"document\.write\(",
            ],
            "severity": "high",
            "recommendation": "Sanitize user input"
        },
        "hardcoded_secrets": {
            "patterns": [
                r"(api_key|apikey|secret|password|token)\s*=\s*['\"]",
                r"(AWS_ACCESS_KEY|ANTHROPIC_API_KEY)\s*=\s*['\"]",
            ],
            "severity": "critical",
            "recommendation": "Use environment variables or a secrets manager"
        },
        "insecure_deserialization": {
            "patterns": [
                r"pickle\.loads?\(",
                r"yaml\.load\(",
                r"eval\(",
                r"exec\(",
            ],
            "severity": "high",
            "recommendation": "Use safe deserialization methods"
        }
    }

    def scan_code(self, code: str, file_path: str) -> list[dict]:
        """Scan code and detect security issues"""
        findings = []

        for check_name, check in self.SECURITY_CHECKS.items():
            for pattern in check["patterns"]:
                matches = re.finditer(pattern, code)
                for match in matches:
                    line_num = code[:match.start()].count("\n") + 1
                    findings.append({
                        "check": check_name,
                        "file": file_path,
                        "line": line_num,
                        "severity": check["severity"],
                        "match": match.group(),
                        "recommendation": check["recommendation"]
                    })

        return findings
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Instructions with Insufficient Context

```
# BAD: Vague instruction
"Fix the bug"

# GOOD: Provide sufficient context
"In users.py, the get_user function returns a 500 error
when a non-existent user ID is passed.
Fix it to return a 404 instead.
Reproduction: curl localhost:8000/users/99999"
```

### Anti-Pattern 2: Auto-Merge Without Review

```
# BAD: Merge agent output directly
agent.generate_code() -> git push -> auto-merge

# GOOD: Always include a human review step
agent.generate_code() -> Create PR -> Human review -> CI passes -> Merge
```

### Anti-Pattern 3: Code Changes Without Tests

```
# BAD: Apply code changes without running tests
Request code fix from agent -> Apply as-is

# GOOD: Make test execution mandatory
Request code fix from agent
-> Run tests (confirm RED)
-> Apply fix
-> Run tests (confirm GREEN)
-> Confirm all existing tests also pass
```

### Anti-Pattern 4: Assigning Tasks That Are Too Large

```
# BAD: Request a full project refactoring all at once
"Migrate this entire project to TypeScript"

# GOOD: Break into smaller tasks
1. "Convert src/utils/helpers.js to TypeScript"
2. "Convert src/api/users.js to TypeScript"
3. "Create tsconfig.json and configure it for incremental migration"
```

### Anti-Pattern 5: Blindly Trusting Agent Output

```
# BAD: Adopt agent-generated code without verification
"The agent wrote it, so it must be correct"

# GOOD: Always verify
1. Static analysis of generated code (lint, type check)
2. Run tests and check results
3. Human review of code logic
4. Security scan
5. Check for performance impact
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also create test code

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
        """Retrieve processing results"""
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
        """Delete by key"""
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
    print(f"Speedup factor: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured configuration file | Check configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check execution user permissions, review configuration |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use log output or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

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
    """Decorator to log function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Called: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debugging target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Solution |
|-------------|----------------|---------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|-----------|-------------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. What is the deployment frequency?           │
│    ├─ Weekly or less → Monolith + modular split │
│    └─ Daily/multiple times → Go to 3            │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- Methods that are faster in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction enables high reusability but can make debugging difficult
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and issues"""
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
            icon = "✅" if c['type'] == 'positive' else "⚠️"
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
- Focus on minimum viable features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons Learned:**
- Don't demand perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Modernization of a Legacy System

**Situation:** Incrementally renewing a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if no existing tests exist
- Coexist old and new systems via an API gateway
- Perform data migration incrementally

| Phase | Work Content | Estimated Duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, understanding dependencies | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Use Domain-Driven Design to clarify boundaries
- Assign ownership per team
- Manage shared libraries via Inner Source
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

### Scenario 4: Performance-Critical Systems

**Situation:** Systems that require millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leverage asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | Use Case |
|--------------------|--------|---------------------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-bound processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## 9. FAQ

### Q1: Will coding agents take over human jobs?

At this point, it is more a matter of "changing" rather than "taking over." Agents excel at routine tasks such as boilerplate, testing, and bug fixing. Humans will increasingly focus on higher-level judgments such as requirements definition, architecture design, review, and user experience. The role of engineers is shifting from "people who write code" to "people who guide agents that write code."

### Q2: How large a codebase can they handle?

Current coding agents are constrained by their context window and can typically handle **only a few dozen files at a time**. For large codebases, it is important to use RAG (code search) or narrow the scope of tasks. Rather than understanding the entire project, the design needs to efficiently search for relevant parts.

### Q3: How can quality be guaranteed for agent-written code?

Three-stage checks are recommended:
1. **Automated tests**: Passing automated tests in CI/CD
2. **Static analysis**: Lint, type checking, security scanning
3. **Human review**: Architectural consistency, correctness of business logic

### Q4: How do I choose a coding agent?

Select based on the following criteria:
- **Autonomy requirements for tasks**: Completion (L1) → Interactive (L2) → Autonomous (L3-4)
- **Development environment**: CLI users → Claude Code/Aider, IDE users → Cursor/Cline
- **Team size**: Individual → anything works, Team → unified tool recommended
- **Security requirements**: On-premises required → OSS (Aider/Cline), cloud OK → commercial tools
- **Budget**: Free → Copilot free tier/OSS, Paid → Claude Code/Cursor Pro

### Q5: What code should not be delegated to agents?

- **Security-critical code**: Authentication, encryption, authorization (mandatory expert human review)
- **Compliance code**: Finance, healthcare (compliance verification required)
- **Core architecture**: Central parts of system design (human design judgment required)
- **Performance-critical code**: Areas requiring benchmark measurement

---

## 10. Practical Usage Scenarios

### 10.1 New Project Scaffolding

```python
class ScaffoldAgent(CodingAgent):
    """Automatically generate initial project configuration"""

    def scaffold_project(
        self,
        project_type: str,
        name: str,
        features: list[str]
    ) -> str:
        """Generate a project template"""
        return self.run(f"""
Please create the initial configuration for a project with the following specifications.

Project type: {project_type}
Project name: {name}
Required features: {', '.join(features)}

What to create:
1. Directory structure
2. Configuration files (package.json / pyproject.toml, etc.)
3. Docker-related files (Dockerfile, docker-compose.yml)
4. CI/CD configuration (.github/workflows/)
5. Test configuration
6. Lint/formatter configuration
7. README.md
8. .gitignore
9. Sample code (Hello World level)
10. Sample tests

Include comments in each file describing the design intent.
""")
```

### 10.2 Automatic API Documentation Generation

```python
class DocGenerationAgent(CodingAgent):
    """Automatically generate documentation from code"""

    def generate_api_docs(self, source_dir: str) -> str:
        """Generate API documentation"""
        return self.run(f"""
Please read the API code in the following directory and
generate documentation in OpenAPI specification format.

Source directory: {source_dir}

Output:
1. Description of each endpoint
2. Request/response schemas
3. Authentication method
4. List of error responses
5. Usage examples (curl commands)

Format: OpenAPI 3.0 YAML
""")

    def generate_changelog(self, from_tag: str, to_tag: str) -> str:
        """Generate a CHANGELOG from Git history"""
        return self.run(f"""
Please generate a CHANGELOG from Git history
from {from_tag} up to {to_tag}.

Steps:
1. Get a list of commits with git log {from_tag}..{to_tag}
2. Categorize commit messages (feat, fix, chore, etc.)
3. Determine the importance of changes from affected files
4. Output in CHANGELOG.md format

Output format: Keep a Changelog format
""")
```

### 10.3 Test Coverage Improvement Agent

```python
class TestCoverageAgent(CodingAgent):
    """Analyze test coverage and fill in gaps"""

    def improve_coverage(
        self,
        target_dir: str,
        min_coverage: float = 80.0
    ) -> str:
        """Improve test coverage to the target value"""
        return self.run(f"""
Please improve the test coverage for the following directory.

Target directory: {target_dir}
Target coverage: {min_coverage}%

Steps:
1. Generate and review the current coverage report
2. Identify files/functions with low coverage
3. Add tests in the following priority order:
   a. Functions with 0% coverage
   b. Functions where conditional branches are not fully covered
   c. Insufficient edge case testing
   d. Insufficient error handling tests
4. Re-measure coverage after each test addition
5. Repeat until the target coverage is reached

Notes:
- Write meaningful tests, not just tests that inflate numbers
- Add a comment to each test describing its intent
- Match the style of existing tests
""")
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|---------|
| Definition | An agent that autonomously understands, generates, modifies, and tests code |
| Major products | Claude Code, Devin, Cursor, Copilot, Aider, Cline |
| Architecture | LLM + File operations + Command execution + Code search |
| Implementation patterns | TDD, code review, refactoring, migration |
| Strengths | Bug fixing, test writing, refactoring |
| Limitations | Architecture design, large-scale refactoring, context constraints |
| Quality assurance | Three stages: automated tests + static analysis + human review |
| Security | Command restrictions, path protection, security scanning |

## What to Read Next

- [01-research-agents.md](./01-research-agents.md) -- Research Agents
- [../02-implementation/04-evaluation.md](../02-implementation/04-evaluation.md) -- Agent Evaluation
- [../04-production/01-safety.md](../04-production/01-safety.md) -- Coding Agent Safety

## References

1. Jimenez, C. E. et al., "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?" (2023) -- https://arxiv.org/abs/2310.06770
2. Anthropic, "Claude Code" -- https://docs.anthropic.com/en/docs/claude-code
3. Yang, J. et al., "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering" (2024) -- https://arxiv.org/abs/2405.15793
4. Cursor Documentation -- https://docs.cursor.com/
5. Aider Documentation -- https://aider.chat/docs/
