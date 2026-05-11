# AI Document Generation -- Automating README, API Specs, and Technical Documents

> Learn how to efficiently generate and maintain project documentation using AI, and build automated generation pipelines for README, API specifications, architecture documents, and changelogs to improve Developer Experience (DX)

## What You'll Learn in This Chapter

1. **Foundational Technologies for AI Document Generation** -- Code analysis by LLMs, spec generation from JSDoc/docstrings, and how context understanding works
2. **Implementation Pipelines** -- Automated README generation, OpenAPI spec generation, CHANGELOG creation, and architecture diagram generation
3. **Quality Management and Operations** -- Review processes for generated documents, CI/CD integration, and automation strategies for maintaining freshness


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [AI Code Review -- Automated Review and Quality Checks](./01-ai-code-review.md)

---

## 1. Overview of AI Document Generation

### 1.1 Document Generation Pipeline

```
AI Document Generation Pipeline

  Source Code              AI Processing            Output
  +----------+         +------------------+   +----------+
  | Source    |         | 1. Code Analysis |   | README.md|
  | Code     | ------> | 2. Structure     | ->| API Spec |
  | (*.ts,   |         |    Understanding |   | CHANGELOG|
  |  *.py)   |         | 3. Text          |   +----------+
  +----------+         |    Generation    |   +----------+
  +----------+         | 4. Formatting    | ->| Arch     |
  | Comments | ------> |                  |   | Diagrams |
  | JSDoc    |         +------------------+   +----------+
  | docstring|
  +----------+
  +----------+
  | Git      | ------> [Diff Analysis     --> | Change   |
  | History  |          + Summarization]       | Log      |
  | PR/Issue |                                +----------+
  +----------+
```

### 1.2 Technology Stack

```
AI Document Generation Technology Map

  LLM / AI Models
  ├── Claude            --- Code understanding & document generation (long context)
  ├── GPT-4             --- General-purpose document generation
  ├── GitHub Copilot    --- Inline documentation generation
  └── Gemini            --- Large-scale codebase analysis

  Documentation Generation Tools
  ├── TypeDoc           --- TypeScript API documentation
  ├── Sphinx            --- Python documentation
  ├── Swagger/OpenAPI   --- REST API specifications
  ├── Storybook         --- UI component catalog
  └── Mermaid           --- Diagram generation

  CI/CD Integration
  ├── GitHub Actions    --- Automated generation & deployment
  ├── Pre-commit hooks  --- Documentation checks on commit
  └── Dependabot        --- Dependency documentation updates

  Hosting
  ├── GitHub Pages      --- Static site publishing
  ├── Notion API        --- Team Wiki integration
  └── Confluence API    --- Enterprise Wiki
```

### 1.3 Document Types and Generation Strategies

```
  Document Type            Generation Method          Update Frequency
  ──────────────────────────────────────────────────────────────────────
  README.md               AI + Manual Review         Per release
  API Spec (OpenAPI)       Auto-generated from code   Per commit
  CHANGELOG               Auto-generated from Git    Per release
  Architecture Diagrams    AI + Manual Adjustment     On major changes
  Code Comments           Copilot + Manual           During coding
  Onboarding Docs         AI Draft + Manual Polish   Quarterly
  ADR (Decision Records)   AI Template + Manual       On design decisions
```

---

## 2. Automated README Generation

### 2.1 Generating README from Codebase Analysis

```python
# Automated README generation script using AI
import os
import json
from pathlib import Path

class ReadmeGenerator:
    """Automatically generates README by analyzing project structure"""

    def __init__(self, project_root: str):
        self.root = Path(project_root)
        self.analysis = {}

    def analyze_project(self) -> dict:
        """Analyze project structure"""
        self.analysis = {
            "name": self._detect_project_name(),
            "language": self._detect_language(),
            "framework": self._detect_framework(),
            "dependencies": self._parse_dependencies(),
            "scripts": self._parse_scripts(),
            "directory_structure": self._get_directory_tree(),
            "entry_points": self._find_entry_points(),
            "env_vars": self._detect_env_vars(),
            "license": self._detect_license(),
        }
        return self.analysis

    def _detect_project_name(self) -> str:
        """Get project name from package.json, pyproject.toml, etc."""
        pkg_json = self.root / "package.json"
        if pkg_json.exists():
            data = json.loads(pkg_json.read_text())
            return data.get("name", self.root.name)

        pyproject = self.root / "pyproject.toml"
        if pyproject.exists():
            # Parse TOML to get project name
            import tomllib
            data = tomllib.loads(pyproject.read_text())
            return data.get("project", {}).get("name", self.root.name)

        return self.root.name

    def _detect_language(self) -> list[str]:
        """Infer programming languages from file extensions"""
        extensions = {}
        for f in self.root.rglob("*"):
            if f.is_file() and not any(
                p in str(f) for p in ["node_modules", ".git", "__pycache__", "venv"]
            ):
                ext = f.suffix
                extensions[ext] = extensions.get(ext, 0) + 1

        lang_map = {
            ".ts": "TypeScript", ".tsx": "TypeScript",
            ".js": "JavaScript", ".jsx": "JavaScript",
            ".py": "Python", ".go": "Go", ".rs": "Rust",
            ".java": "Java", ".rb": "Ruby", ".swift": "Swift",
        }

        detected = []
        for ext, count in sorted(extensions.items(), key=lambda x: -x[1]):
            if ext in lang_map and lang_map[ext] not in detected:
                detected.append(lang_map[ext])
        return detected[:3]

    def _parse_dependencies(self) -> dict:
        """Analyze dependencies"""
        deps = {"runtime": [], "dev": []}
        pkg_json = self.root / "package.json"
        if pkg_json.exists():
            data = json.loads(pkg_json.read_text())
            deps["runtime"] = list(data.get("dependencies", {}).keys())
            deps["dev"] = list(data.get("devDependencies", {}).keys())
        return deps

    def _parse_scripts(self) -> dict:
        """Analyze available scripts"""
        pkg_json = self.root / "package.json"
        if pkg_json.exists():
            data = json.loads(pkg_json.read_text())
            return data.get("scripts", {})
        return {}

    def generate_readme(self) -> str:
        """Generate README from analysis results"""
        if not self.analysis:
            self.analyze_project()

        a = self.analysis
        sections = [
            f"# {a['name']}\n",
            self._generate_badges(a),
            self._generate_description(a),
            self._generate_quick_start(a),
            self._generate_installation(a),
            self._generate_usage(a),
            self._generate_project_structure(a),
            self._generate_scripts_section(a),
            self._generate_env_section(a),
            self._generate_contributing(),
            self._generate_license(a),
        ]
        return "\n".join(filter(None, sections))

    def _generate_quick_start(self, a: dict) -> str:
        """Generate Quick Start section"""
        scripts = a.get("scripts", {})
        lines = ["## Quick Start\n", "```bash"]

        if "dev" in scripts:
            lines.extend([
                f"git clone <repository-url>",
                f"cd {a['name']}",
                "npm install",
                "npm run dev",
            ])
        elif a.get("language") and "Python" in a["language"]:
            lines.extend([
                f"git clone <repository-url>",
                f"cd {a['name']}",
                "pip install -e .",
            ])

        lines.append("```")
        return "\n".join(lines)
```

### 2.2 Improving README with AI Prompts

```python
# Improving README quality using LLM
README_IMPROVEMENT_PROMPT = """
You are an excellent technical writer.
Please improve the following auto-generated README.

Improvement criteria:
1. The project's value should be clear in the first 3 lines
2. Setup instructions should be complete and copy-pasteable
3. Key features should be listed as bullet points
4. Contribution methods should be clearly stated
5. License should be specified

Auto-generated README:
{auto_generated_readme}

Project analysis results:
{project_analysis}

Please output the improved README in markdown format.
"""

def improve_readme_with_ai(auto_readme: str, analysis: dict, client) -> str:
    """Improve README with AI"""
    prompt = README_IMPROVEMENT_PROMPT.format(
        auto_generated_readme=auto_readme,
        project_analysis=json.dumps(analysis, ensure_ascii=False, indent=2),
    )
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text
```

---

## 3. Automated API Specification Generation

### 3.1 Generating OpenAPI Specs from Code

```python
# For FastAPI: OpenAPI specs are generated automatically
from fastapi import FastAPI, Query, Path, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="User Management API",
    description="REST API providing CRUD operations for users",
    version="1.0.0",
    docs_url="/docs",           # Swagger UI
    redoc_url="/redoc",         # ReDoc
    openapi_url="/openapi.json", # OpenAPI JSON
)

class UserCreate(BaseModel):
    """User creation request"""
    name: str = Field(..., min_length=1, max_length=100, description="User name")
    email: str = Field(..., description="Email address")
    role: str = Field(default="member", description="Role (admin, member, viewer)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"name": "Taro Tanaka", "email": "tanaka@example.com", "role": "member"}
            ]
        }
    }

class UserResponse(BaseModel):
    """User response"""
    id: int = Field(..., description="User ID")
    name: str = Field(..., description="User name")
    email: str = Field(..., description="Email address")
    role: str = Field(..., description="Role")

@app.post(
    "/users",
    response_model=UserResponse,
    status_code=201,
    summary="Create a user",
    description="Creates a new user. The email address must be unique.",
    tags=["users"],
)
async def create_user(user: UserCreate):
    """
    Creates a new user.

    - **name**: User name between 1-100 characters
    - **email**: Valid email address (unique constraint)
    - **role**: One of admin, member, or viewer
    """
    # Implementation...
    return UserResponse(id=1, **user.model_dump())


@app.get(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Get a user",
    tags=["users"],
)
async def get_user(
    user_id: int = Path(..., ge=1, description="User ID"),
):
    """Retrieves user information for the specified ID."""
    # Implementation...
    pass
```

### 3.2 Generating Documentation from TypeScript Type Definitions

```typescript
// Documentation comments for TypeDoc
// Writing in TSDoc format enables automatic documentation generation by TypeDoc

/**
 * User Service
 *
 * Service class responsible for creating, retrieving, updating, and deleting users.
 * Abstracts data access using the repository pattern
 * and centralizes business logic management.
 *
 * @example
 * ```typescript
 * const service = new UserService(userRepository);
 * const user = await service.createUser({
 *   name: "Taro Tanaka",
 *   email: "tanaka@example.com",
 * });
 * ```
 *
 * @see {@link UserRepository} Data access layer
 * @see {@link UserController} Controller layer
 */
export class UserService {
  /**
   * Create a user
   *
   * @param input - User creation parameters
   * @returns The created user object
   * @throws {DuplicateEmailError} When the email address is already registered
   * @throws {ValidationError} When input values are invalid
   */
  async createUser(input: CreateUserInput): Promise<User> {
    // Implementation...
    return {} as User;
  }

  /**
   * Search for users
   *
   * @param query - Search criteria
   * @param options - Pagination options
   * @returns Paginated user list
   *
   * @example
   * ```typescript
   * const result = await service.searchUsers(
   *   { role: "admin" },
   *   { page: 1, limit: 20 }
   * );
   * console.log(result.total); // Total count
   * console.log(result.items); // User array
   * ```
   */
  async searchUsers(
    query: SearchQuery,
    options: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    // Implementation...
    return {} as PaginatedResult<User>;
  }
}
```

### 3.3 Auto-generation from Docstrings

```python
# Enriching documentation from Python docstrings using AI
import ast
import inspect

class DocstringEnhancer:
    """Tool to enrich existing docstrings using AI"""

    def extract_functions(self, source_code: str) -> list[dict]:
        """Extract function information from source code"""
        tree = ast.parse(source_code)
        functions = []

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func_info = {
                    "name": node.name,
                    "args": [arg.arg for arg in node.args.args],
                    "returns": ast.unparse(node.returns) if node.returns else None,
                    "docstring": ast.get_docstring(node),
                    "decorators": [ast.unparse(d) for d in node.decorator_list],
                    "lineno": node.lineno,
                }
                functions.append(func_info)

        return functions

    def generate_enhanced_docstring(self, func_info: dict, client) -> str:
        """Generate an AI-enhanced docstring"""
        prompt = f"""
Please generate a Google-style docstring for the following Python function.

Function name: {func_info['name']}
Arguments: {func_info['args']}
Return value: {func_info['returns']}
Existing docstring: {func_info['docstring'] or 'None'}

Please include the following:
1. Function description (1-2 sentences)
2. Args section (type and description for each argument)
3. Returns section (description of return value)
4. Raises section (possible exceptions)
5. Example section (usage example)
"""
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text
```

---

## 4. Automated CHANGELOG Generation

### 4.1 Generating CHANGELOG from Git History

```python
# Auto-generating CHANGELOG from Conventional Commits
import subprocess
import re
from datetime import datetime

class ChangelogGenerator:
    """Automatically generates CHANGELOG from Git commit history"""

    COMMIT_TYPES = {
        "feat": "Features",
        "fix": "Bug Fixes",
        "docs": "Documentation",
        "style": "Styles",
        "refactor": "Code Refactoring",
        "perf": "Performance Improvements",
        "test": "Tests",
        "build": "Build System",
        "ci": "CI",
        "chore": "Chores",
    }

    # Conventional Commit pattern
    PATTERN = re.compile(
        r"^(?P<type>feat|fix|docs|style|refactor|perf|test|build|ci|chore)"
        r"(?:\((?P<scope>[^)]+)\))?"
        r"(?P<breaking>!)?"
        r": (?P<description>.+)$"
    )

    def get_commits_since_tag(self, tag: str = None) -> list[dict]:
        """Get commits since the specified tag"""
        cmd = ["git", "log", "--pretty=format:%H|%s|%an|%aI"]
        if tag:
            cmd.append(f"{tag}..HEAD")

        result = subprocess.run(cmd, capture_output=True, text=True)
        commits = []

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|", 3)
            if len(parts) == 4:
                hash_, subject, author, date = parts
                match = self.PATTERN.match(subject)
                if match:
                    commits.append({
                        "hash": hash_[:8],
                        "type": match.group("type"),
                        "scope": match.group("scope"),
                        "breaking": bool(match.group("breaking")),
                        "description": match.group("description"),
                        "author": author,
                        "date": date,
                    })

        return commits

    def generate_changelog(self, version: str, tag: str = None) -> str:
        """Generate CHANGELOG markdown"""
        commits = self.get_commits_since_tag(tag)
        today = datetime.now().strftime("%Y-%m-%d")

        lines = [f"## [{version}] - {today}\n"]

        # Breaking Changes
        breaking = [c for c in commits if c["breaking"]]
        if breaking:
            lines.append("### BREAKING CHANGES\n")
            for c in breaking:
                scope = f"**{c['scope']}**: " if c["scope"] else ""
                lines.append(f"- {scope}{c['description']} ({c['hash']})")
            lines.append("")

        # Group by type
        grouped = {}
        for c in commits:
            type_label = self.COMMIT_TYPES.get(c["type"], c["type"])
            grouped.setdefault(type_label, []).append(c)

        for type_label, type_commits in grouped.items():
            lines.append(f"### {type_label}\n")
            for c in type_commits:
                scope = f"**{c['scope']}**: " if c["scope"] else ""
                lines.append(f"- {scope}{c['description']} ({c['hash']})")
            lines.append("")

        return "\n".join(lines)


# Usage example
generator = ChangelogGenerator()
changelog = generator.generate_changelog("1.2.0", tag="v1.1.0")
print(changelog)
```

### 4.2 Generating Release Notes with AI

```python
# Summarizing Git diffs with AI to generate release notes

RELEASE_NOTE_PROMPT = """
Please generate end-user-facing release notes from the following list of Git commits.

Commit list:
{commits}

Requirements:
1. Convey the value to users rather than technical details
2. Categorize into "New Features", "Improvements", and "Fixes"
3. Keep each item concise at 1-2 sentences
4. Write in English
"""

def generate_release_notes(commits: list[dict], client) -> str:
    """Generate release notes with AI"""
    commits_text = "\n".join(
        f"- [{c['type']}] {c['description']}" for c in commits
    )
    prompt = RELEASE_NOTE_PROMPT.format(commits=commits_text)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text
```

---

## 5. CI/CD Integration

### 5.1 Automated Documentation Generation with GitHub Actions

```yaml
# .github/workflows/docs.yml
name: Generate Documentation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch full history (for CHANGELOG generation)

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      # Generate API documentation
      - name: Generate API docs
        run: npx typedoc --out docs/api src/

      # Validate OpenAPI specification consistency
      - name: Validate OpenAPI spec
        run: npx @redocly/cli lint openapi.yaml

      # Check README freshness
      - name: Check README freshness
        run: |
          python scripts/check_readme_freshness.py \
            --readme README.md \
            --package package.json \
            --threshold 30  # Warn if not updated for 30+ days

      # Deploy documentation
      - name: Deploy docs
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs

  check-docs-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Documentation coverage for exported functions
      - name: Check documentation coverage
        run: |
          python scripts/doc_coverage.py \
            --src src/ \
            --min-coverage 80 \
            --report docs-coverage.json

      - name: Comment coverage on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const coverage = JSON.parse(fs.readFileSync('docs-coverage.json'));
            const body = `## Documentation Coverage\n\n` +
              `Coverage: **${coverage.percentage}%** (${coverage.documented}/${coverage.total})\n\n` +
              `${coverage.percentage >= 80 ? '✅' : '⚠️'} ` +
              `Minimum: 80%`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body,
            });
```

### 5.2 Documentation Checks with Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: check-docstrings
        name: Check docstrings
        entry: python scripts/check_docstrings.py
        language: python
        types: [python]
        args: ['--style', 'google', '--min-length', '10']

      - id: check-readme-links
        name: Check README links
        entry: python scripts/check_links.py
        language: python
        files: '\.md$'

      - id: generate-openapi
        name: Regenerate OpenAPI spec
        entry: python scripts/generate_openapi.py
        language: python
        files: '(routes|controllers|schemas)/.*\.py$'
        pass_filenames: false
```

---

## 6. Comparison Tables

| Document Type | Automation Level | AI Effectiveness | Recommended Tools | Update Frequency |
|--------------|:---------------:|:---------------:|:----------------:|:---------------:|
| README | Medium | High (Draft generation) | Claude + Manual | Per release |
| API Spec (OpenAPI) | High | Medium (Supplemental) | FastAPI / TypeDoc | Per commit |
| CHANGELOG | High | High (Summarization) | Conventional Commits | Per release |
| Code Comments | Medium | High (Draft) | Copilot | During coding |
| Architecture Diagrams | Low | Medium (Mermaid generation) | Claude + Mermaid | On design changes |
| ADR | Low | Medium (Templates) | Claude + Manual | On decisions |

| Approach | Quality | Speed | Cost | Maintainability |
|----------|:-------:|:-----:|:----:|:--------------:|
| Fully Manual | Highest | Low | High (Labor) | Low (Becomes outdated) |
| AI Draft + Human Review | High | High | Medium | High |
| Fully Auto-generated from Code | Medium | Highest | Low | Highest |
| AI Only (No Review) | Low-Medium | Highest | Lowest | Medium |

---

## 7. Anti-patterns

### Anti-pattern 1: Publishing AI-generated Documentation Without Verification

```
BAD:
  Publishing AI-generated API documentation as-is
  -> Descriptions inconsistent with implementation, non-existent endpoints documented
  -> Misinformation due to hallucinations
  -> Users implement based on incorrect information, causing incidents

GOOD:
  1. Generate initial draft with AI (speed improvement)
  2. Automatically check consistency with actual code
  3. Technical writer or developer reviews
  4. Verify sample code actually works
  5. Detect inconsistencies between OpenAPI spec and implementation in CI
```

### Anti-pattern 2: Neglecting Document Freshness Management

```
BAD:
  Creating an impressive README at project start
  -> Six months later, setup instructions are outdated and don't work
  -> API specs diverge from implementation
  -> New team members get stuck on incorrect information

GOOD:
  - Check document last-updated dates in CI
  - Auto-update README dependency section when package.json changes
  - Add "Documentation update needed?" checkbox in PR template
  - Generate monthly documentation freshness reports
  - Auto-create Issues with "docs" label
```

### Anti-pattern 3: Cramming Everything into a Single README

```
BAD:
  README.md exceeds 2,000 lines
  -> Setup instructions, API reference, architecture explanation,
     and troubleshooting all in one file
  -> Cannot find needed information

GOOD:
  Keep README.md as an entry point (under 100 lines):
  - Project overview (3 lines)
  - Quick start (10 lines)
  - Key features list
  - Links to detailed documentation
    - docs/setup.md  --- Setup instructions
    - docs/api.md    --- API reference
    - docs/architecture.md --- Design documents
```


---

## Hands-on Exercises

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
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 8. FAQ

### Q1. How can you ensure quality when generating documentation with AI?

**A.** (1) **Provide context**: Accuracy improves when you provide source code, tests, and existing documentation together to the AI. (2) **Use templates**: Define project-specific documentation templates and have the AI follow them. (3) **Automated verification**: Run generated sample code in CI to verify it works. (4) **Gradual adoption**: Start with internal documentation (ADRs, design notes), verify accuracy, then expand to external-facing documentation. The quality of AI-generated documentation heavily depends on the quality of the input.

### Q2. What are best practices for integrating automated documentation generation into CI?

**A.** (1) **PR-time checks**: Include docstring coverage, OpenAPI consistency, and broken link detection as PR check items. (2) **Merge-time generation**: Automatically regenerate and deploy API documentation when merging to the main branch. (3) **Release-time CHANGELOG**: Automatically generate CHANGELOG from Conventional Commits when creating tags. (4) **Regular reports**: Send weekly documentation freshness reports to Slack. Gradually expanding the scope of automation is the practical approach.

### Q3. How can small teams streamline documentation management?

**A.** (1) **README-driven development**: Write the README before coding and use it as the specification for development. Generating the initial draft with AI speeds this up. (2) **Docs as Code**: Manage documentation in the same repository as code and review via PRs. (3) **Use ADRs**: Record design decisions as Architecture Decision Records, preserving "why this design was chosen." (4) **Automation priorities**: Introduce CHANGELOG auto-generation first, then API documentation, and finally README freshness management. Small teams benefit the most from automation.

---

## 9. Architecture Documentation Auto-generation

### 9.1 Generating Mermaid Diagrams from Codebase

```python
# Automatically generate architecture diagrams by analyzing source code

import ast
from pathlib import Path
from typing import NamedTuple

class DependencyInfo(NamedTuple):
    source: str
    target: str
    relationship: str  # "imports", "inherits", "uses"

class ArchitectureDiagramGenerator:
    """Automatically generates Mermaid diagrams from codebase"""

    def __init__(self, project_root: str):
        self.root = Path(project_root)
        self.dependencies: list[DependencyInfo] = []
        self.modules: dict[str, dict] = {}

    def analyze_python_project(self) -> dict:
        """Analyze Python project dependencies"""
        for py_file in self.root.rglob("*.py"):
            if any(skip in str(py_file) for skip in [
                "__pycache__", "node_modules", ".venv", "venv", "test"
            ]):
                continue

            relative_path = py_file.relative_to(self.root)
            module_name = str(relative_path).replace("/", ".").replace(".py", "")

            try:
                tree = ast.parse(py_file.read_text())
                imports = self._extract_imports(tree)
                classes = self._extract_classes(tree)
                functions = self._extract_functions(tree)

                self.modules[module_name] = {
                    "path": str(relative_path),
                    "imports": imports,
                    "classes": classes,
                    "functions": functions,
                    "loc": len(py_file.read_text().splitlines()),
                }

                for imp in imports:
                    self.dependencies.append(DependencyInfo(
                        source=module_name,
                        target=imp,
                        relationship="imports",
                    ))
            except SyntaxError:
                pass

        return {
            "modules": self.modules,
            "dependencies": self.dependencies,
        }

    def generate_component_diagram(self) -> str:
        """Generate a component diagram in Mermaid format"""
        lines = ["graph TD"]

        # Group modules by layer
        layers = self._detect_layers()

        for layer_name, modules in layers.items():
            lines.append(f"    subgraph {layer_name}")
            for mod in modules:
                class_count = len(self.modules.get(mod, {}).get("classes", []))
                func_count = len(self.modules.get(mod, {}).get("functions", []))
                label = f"{mod.split('.')[-1]}\\n({class_count}classes, {func_count}funcs)"
                lines.append(f'        {mod.replace(".", "_")}["{label}"]')
            lines.append("    end")

        # Dependency arrows
        for dep in self.dependencies:
            if dep.target in self.modules:
                source_id = dep.source.replace(".", "_")
                target_id = dep.target.replace(".", "_")
                lines.append(f"    {source_id} --> {target_id}")

        return "\n".join(lines)

    def generate_class_diagram(self) -> str:
        """Generate a class diagram in Mermaid format"""
        lines = ["classDiagram"]

        for mod_name, mod_info in self.modules.items():
            for cls in mod_info.get("classes", []):
                cls_name = cls["name"]
                lines.append(f"    class {cls_name} {{")
                for method in cls.get("methods", []):
                    visibility = "+" if not method.startswith("_") else "-"
                    lines.append(f"        {visibility}{method}()")
                lines.append("    }")

                # Inheritance relationships
                for base in cls.get("bases", []):
                    lines.append(f"    {base} <|-- {cls_name}")

        return "\n".join(lines)

    def generate_ai_prompt(self) -> str:
        """Generate a prompt to ask AI for architecture documentation"""
        return f"""
Please analyze the following project structure and create an architecture document.

## Module List ({len(self.modules)} modules)
{self._format_module_summary()}

## Dependencies ({len(self.dependencies)} entries)
{self._format_dependency_summary()}

## Output Format
1. Architecture overview (3-5 sentences)
2. Layer composition explanation
3. Responsibilities of key components
4. Data flow explanation
5. Improvement suggestions (if any)
"""

    def _detect_layers(self) -> dict[str, list[str]]:
        """Auto-detect layers from module names"""
        layer_keywords = {
            "Presentation": ["controller", "handler", "view", "route", "api"],
            "Application": ["service", "usecase", "command", "query"],
            "Domain": ["model", "entity", "domain", "aggregate"],
            "Infrastructure": ["repository", "adapter", "client", "db"],
        }
        layers: dict[str, list[str]] = {}
        for mod_name in self.modules:
            mod_lower = mod_name.lower()
            placed = False
            for layer, keywords in layer_keywords.items():
                if any(kw in mod_lower for kw in keywords):
                    layers.setdefault(layer, []).append(mod_name)
                    placed = True
                    break
            if not placed:
                layers.setdefault("Other", []).append(mod_name)
        return layers

    def _extract_imports(self, tree: ast.AST) -> list[str]:
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
        return imports

    def _extract_classes(self, tree: ast.AST) -> list[dict]:
        classes = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                methods = [
                    n.name for n in node.body
                    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                ]
                bases = [ast.unparse(b) for b in node.bases]
                classes.append({
                    "name": node.name,
                    "methods": methods,
                    "bases": bases,
                })
        return classes

    def _extract_functions(self, tree: ast.AST) -> list[str]:
        return [
            node.name for node in ast.iter_child_nodes(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]

    def _format_module_summary(self) -> str:
        return "\n".join(
            f"- {name}: {info['loc']} lines, "
            f"{len(info['classes'])} classes, {len(info['functions'])} functions"
            for name, info in sorted(self.modules.items())
        )

    def _format_dependency_summary(self) -> str:
        return "\n".join(
            f"- {d.source} -> {d.target} ({d.relationship})"
            for d in self.dependencies[:20]
        )
```

### 9.2 Auto-generating ADR (Architecture Decision Records)

```python
# Automatically generate ADR drafts with AI

ADR_TEMPLATE_PROMPT = """
Please create an ADR (Architecture Decision Record) for the following design decision.

## Decision Overview
{decision_summary}

## Context
{context}

## Options Considered
{options}

## ADR Template (output in the following format)

# ADR-{adr_number}: {title}

## Status
Proposed / Accepted / Deprecated

## Context
(Describe the background and challenges that necessitated this decision)

## Decision
(Describe the adopted solution in detail)

## Options Considered
### Option A: ...
- Pros: ...
- Cons: ...

### Option B: ...
- Pros: ...
- Cons: ...

### Option C: ...
- Pros: ...
- Cons: ...

## Rationale
(Describe why this option was chosen)

## Consequences
- Positive impacts: ...
- Risks: ...
- Migration plan: ...

## References
- Related ADRs: ...
- Bibliography: ...
"""

class ADRGenerator:
    """Auto-generation and management of ADRs"""

    def __init__(self, adr_dir: str = "docs/adr"):
        self.adr_dir = Path(adr_dir)
        self.adr_dir.mkdir(parents=True, exist_ok=True)

    def get_next_number(self) -> int:
        """Get the next ADR number"""
        existing = list(self.adr_dir.glob("*.md"))
        if not existing:
            return 1
        numbers = []
        for f in existing:
            try:
                num = int(f.stem.split("-")[0])
                numbers.append(num)
            except (ValueError, IndexError):
                pass
        return max(numbers, default=0) + 1

    def generate_adr(self, decision: dict, client) -> str:
        """Generate an ADR draft with AI"""
        adr_number = self.get_next_number()
        prompt = ADR_TEMPLATE_PROMPT.format(
            adr_number=adr_number,
            title=decision.get("title", ""),
            decision_summary=decision.get("summary", ""),
            context=decision.get("context", ""),
            options=decision.get("options", ""),
        )

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        adr_content = response.content[0].text
        filename = f"{adr_number:04d}-{decision['title'].lower().replace(' ', '-')}.md"
        filepath = self.adr_dir / filename
        filepath.write_text(adr_content)

        return str(filepath)
```

---

## 10. Document Freshness Monitoring

### 10.1 Automated Freshness Check System

```python
# Automatically monitor document freshness and prevent staleness

import subprocess
from datetime import datetime, timedelta
from dataclasses import dataclass, field

@dataclass
class DocFreshnessReport:
    """Document freshness report"""
    file_path: str
    last_modified: datetime
    related_code_modified: datetime
    days_stale: int
    staleness_level: str  # "fresh", "aging", "stale", "critical"
    related_changes: list[str] = field(default_factory=list)

class DocFreshnessMonitor:
    """System for monitoring document freshness"""

    STALENESS_THRESHOLDS = {
        "README.md": 30,           # 30 days
        "CONTRIBUTING.md": 90,     # 90 days
        "docs/api/": 14,           # 14 days
        "docs/architecture/": 60,  # 60 days
        "CHANGELOG.md": 7,         # 7 days (depends on release cycle)
    }

    def check_freshness(self, doc_path: str) -> DocFreshnessReport:
        """Check document freshness"""
        # Last modification date of the document
        doc_modified = self._get_last_modified(doc_path)

        # Last modification date of related code
        related_code = self._find_related_code(doc_path)
        code_modified = max(
            (self._get_last_modified(f) for f in related_code),
            default=doc_modified,
        )

        # Calculate freshness
        days_stale = (datetime.now() - doc_modified).days
        code_days_ahead = (code_modified - doc_modified).days

        # Determine freshness level
        threshold = self._get_threshold(doc_path)
        if code_days_ahead > threshold:
            staleness_level = "critical"
        elif code_days_ahead > threshold // 2:
            staleness_level = "stale"
        elif days_stale > threshold:
            staleness_level = "aging"
        else:
            staleness_level = "fresh"

        # Get related changes
        related_changes = self._get_changes_since(doc_modified, related_code)

        return DocFreshnessReport(
            file_path=doc_path,
            last_modified=doc_modified,
            related_code_modified=code_modified,
            days_stale=days_stale,
            staleness_level=staleness_level,
            related_changes=related_changes,
        )

    def generate_freshness_report(self, doc_paths: list[str]) -> str:
        """Generate an overall document freshness report"""
        reports = [self.check_freshness(path) for path in doc_paths]

        critical = [r for r in reports if r.staleness_level == "critical"]
        stale = [r for r in reports if r.staleness_level == "stale"]
        aging = [r for r in reports if r.staleness_level == "aging"]
        fresh = [r for r in reports if r.staleness_level == "fresh"]

        output = "# Document Freshness Report\n\n"
        output += f"Generated: {datetime.now().isoformat()}\n\n"
        output += f"## Summary\n"
        output += f"- Fresh: {len(fresh)} items\n"
        output += f"- Aging: {len(aging)} items\n"
        output += f"- Needs Update: {len(stale)} items\n"
        output += f"- Critical: {len(critical)} items\n\n"

        if critical:
            output += "## Documents Requiring Urgent Attention\n\n"
            for r in critical:
                output += f"- **{r.file_path}**: "
                output += f"Last updated {r.days_stale} days ago, "
                output += f"related code is {(r.related_code_modified - r.last_modified).days} days ahead\n"
                for change in r.related_changes[:3]:
                    output += f"  - {change}\n"

        return output

    def _get_last_modified(self, file_path: str) -> datetime:
        """Get the last modification date of a file from Git"""
        try:
            result = subprocess.run(
                ["git", "log", "-1", "--format=%aI", "--", file_path],
                capture_output=True, text=True, timeout=5,
            )
            if result.stdout.strip():
                return datetime.fromisoformat(result.stdout.strip())
        except Exception:
            pass
        return datetime.now()

    def _get_threshold(self, doc_path: str) -> int:
        """Return threshold based on document path"""
        for pattern, threshold in self.STALENESS_THRESHOLDS.items():
            if pattern in doc_path:
                return threshold
        return 30  # Default 30 days

    def _find_related_code(self, doc_path: str) -> list[str]:
        """Estimate source code files related to the document"""
        related = []
        # Analyze file references within the document
        # e.g.: README.md -> files under src/
        # e.g.: docs/api/users.md -> src/controllers/users.ts
        return related

    def _get_changes_since(self, since: datetime,
                           files: list[str]) -> list[str]:
        """Get changes since the specified datetime"""
        changes = []
        for f in files:
            try:
                result = subprocess.run(
                    ["git", "log", "--oneline",
                     f"--since={since.isoformat()}", "--", f],
                    capture_output=True, text=True, timeout=5,
                )
                if result.stdout.strip():
                    changes.extend(result.stdout.strip().split("\n"))
            except Exception:
                pass
        return changes
```

### 10.2 Integration with Slack Notifications

```python
# Automatically notify document freshness reports to Slack

class DocFreshnessNotifier:
    """Notify document freshness to Slack"""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    def notify_stale_docs(self, reports: list[DocFreshnessReport]) -> None:
        """Notify stale documents to Slack"""
        import requests

        stale_docs = [r for r in reports if r.staleness_level in ("stale", "critical")]
        if not stale_docs:
            return

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"Document Freshness Alert ({len(stale_docs)} items)",
                }
            },
        ]

        for doc in stale_docs[:5]:
            emoji = "🔴" if doc.staleness_level == "critical" else "🟡"
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"{emoji} *{doc.file_path}*\n"
                        f"Last updated: {doc.days_stale} days ago | "
                        f"Gap with related code: "
                        f"{(doc.related_code_modified - doc.last_modified).days} days"
                    ),
                }
            })

        payload = {"blocks": blocks}
        requests.post(self.webhook_url, json=payload)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world practice?

Knowledge of this topic is frequently applied in daily development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| README Generation | Auto-analyze project structure -> Generate initial draft with AI -> Human review |
| API Specs | Auto-generated with FastAPI/TypeDoc. Pydantic type info becomes the spec directly |
| CHANGELOG | Conventional Commits + auto-generation. AI summarizes release notes |
| CI/CD Integration | Incorporate documentation coverage, freshness checks, and auto-deployment into the pipeline |
| Quality Management | AI generation is the initial draft. Always have humans review and verify sample code works |
| Freshness Maintenance | Prevent staleness with automated checks + PR templates + monthly reports |
| Architecture Diagrams | Auto-generate Mermaid diagrams from codebase analysis |
| ADR | Generate drafts with AI and streamline recording of design decisions |

---

## Recommended Next Reads

- [AI Debugging](./03-ai-debugging.md) -- Streamlining debugging with AI
- AI Coding -- Practical code generation with AI
- [The Future of Development](../03-team/02-future-of-development.md) -- Outlook on development processes in the AI era

---

## References

1. **Docs for Developers** -- Jared Bhatt & Zachary Sarah Corleissen (Apress, 2021) -- Guide to writing documentation for developers
2. **Conventional Commits** -- https://www.conventionalcommits.org/ -- Commit message conventions
3. **TypeDoc** -- https://typedoc.org/ -- TypeScript documentation generation tool
4. **OpenAPI Specification** -- https://spec.openapis.org/oas/latest.html -- Standard for REST API specifications
