# Claude Code -- CLI, Agent, and MCP

> Understand the full capabilities of "Claude Code," Anthropic's official CLI-based AI coding tool, and build advanced development workflows leveraging agent mode and the MCP protocol.

---

## What You Will Learn in This Chapter

1. **Claude Code Basics** -- From installation to CLI operations and project configuration with CLAUDE.md
2. **Leveraging Agent Mode** -- Designing and operating agents that autonomously complete tasks
3. **Tool Extension via MCP** -- Connecting custom tools through the Model Context Protocol to extend your development environment
4. **Production Patterns** -- Practical knowledge for CI/CD pipeline integration, team operations, and large-scale project management


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [GitHub Copilot -- Setup, Effective Usage, and Limitations](./00-github-copilot.md)

---

## 1. Core Architecture of Claude Code

### 1.1 System Configuration

```
┌──────────────────────────────────────────────────────┐
│                Claude Code Architecture               │
│                                                      │
│  ┌──────────┐     ┌───────────────────────────────┐  │
│  │ Terminal  │     │      Claude Code CLI          │  │
│  │ (User)    │────►│                               │  │
│  └──────────┘     │  ┌─────────┐  ┌────────────┐ │  │
│                   │  │ Prompt  │  │  Context   │ │  │
│                   │  │ Parsing │  │  Manager   │ │  │
│                   │  └────┬────┘  └─────┬──────┘ │  │
│                   │       │             │        │  │
│                   │  ┌────▼─────────────▼──────┐ │  │
│                   │  │    Tool Use Engine       │ │  │
│                   │  │  ┌─────┐┌─────┐┌──────┐│ │  │
│                   │  │  │Read ││Write││Bash  ││ │  │
│                   │  │  │File ││File ││Exec  ││ │  │
│                   │  │  └─────┘└─────┘└──────┘│ │  │
│                   │  │  ┌─────┐┌─────┐┌──────┐│ │  │
│                   │  │  │Grep ││Glob ││MCP   ││ │  │
│                   │  │  │     ││     ││Tools ││ │  │
│                   │  │  └─────┘└─────┘└──────┘│ │  │
│                   │  └────────────┬────────────┘ │  │
│                   └──────────────┼───────────────┘  │
│                                  │ API Call          │
│                                  ▼                  │
│                   ┌───────────────────────────────┐  │
│                   │   Anthropic API (Claude)       │  │
│                   │   Claude Sonnet / Opus         │  │
│                   └───────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 1.2 Feature Map

```
Claude Code Feature Map
├── Interactive Mode
│   ├── Regular Chat (Questions & Consultation)
│   ├── Code Generation (Spec → Implementation)
│   └── Debugging Assistance (Error → Fix)
├── Agent Mode
│   ├── Autonomous Task Execution
│   ├── Multi-File Editing
│   └── Test Execution → Fix Loop
├── Tool Integration
│   ├── File System (Read/Write/Glob/Grep)
│   ├── Bash (Command Execution)
│   └── MCP (External Tools)
├── Project Configuration
│   ├── CLAUDE.md (Instruction File)
│   ├── .claude/settings.json
│   └── Permission Management
└── Workflow Integration
    ├── Git Integration
    ├── GitHub PR/Issue
    └── CI/CD Pipeline
```

### 1.3 Internal Processing Flow of Claude Code

```
User Input
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. Prompt Parsing                       │
│    - Load and apply CLAUDE.md           │
│    - Build context from conversation    │
│      history                            │
│    - Merge system prompts               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 2. API Request Construction             │
│    - Calculate token count              │
│    - Attach tool definitions            │
│    - Select model (Sonnet/Opus)         │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 3. Response Processing                  │
│    ├── Text response → Display          │
│    ├── Tool Use → Execute tool          │
│    │   ├── Permission check             │
│    │   ├── Execute & retrieve results   │
│    │   └── Resend results to API        │
│    └── Termination check                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 4. Loop Control                         │
│    - Call API again after tool execution │
│    - Check maximum iteration count      │
│    - Confirm operations requiring user  │
│      approval                           │
└─────────────────────────────────────────┘
```

---

## 2. Basic Operations

### Code Example 1: Installation and Initial Setup

```bash
# Install (via npm)
npm install -g @anthropic-ai/claude-code

# First launch (authentication required)
claude

# Check version
claude --version

# Show help
claude --help

# Run in non-interactive mode
claude -p "List the dependencies in package.json"

# Pipe a file
cat error.log | claude -p "Analyze this error log and identify the cause"

# Run in a specific directory
claude --cwd /path/to/project "Run the tests and fix the failing ones"

# Output in JSON format (for script integration)
claude -p "List the dependencies in package.json" --output-format json

# Run with a specific model
claude --model claude-sonnet-4-20250514 -p "Review the code"

# Resume a conversation
claude --resume  # Resume the last conversation
claude --resume <session-id>  # Resume a specific session
```

### Code Example 2: Project Configuration with CLAUDE.md

```markdown
# CLAUDE.md - Project-Specific AI Instructions

## Project Overview
Backend API for an e-commerce platform. Python 3.12 + FastAPI.

## Coding Standards
- Type hints are mandatory. Any type is prohibited
- Docstrings follow Google style
- Tests are written with pytest. Coverage must be 80% or higher
- Import order: stdlib → third-party → local (managed by isort)
- Error handling uses Result types (returns library)

## Architecture
- Clean Architecture: domain/ → usecase/ → infra/ → presentation/
- Domain layer has no external dependencies
- DI (Dependency Injection) uses dependency-injector

## Database
- PostgreSQL 16 + SQLAlchemy 2.0
- Migrations use Alembic
- Test DB uses SQLite in-memory

## Running Tests
```bash
pytest tests/ -v --cov=src --cov-report=term-missing
```

## Prohibited Actions
- Do not read or modify .env files
- Do not commit directly to the main branch
- Do not delete existing tests
```

### Code Example 3: Hierarchical CLAUDE.md Structure

```
Project Root/
├── CLAUDE.md                    # Project-wide conventions
├── src/
│   ├── CLAUDE.md                # Source code specific rules
│   ├── domain/
│   │   └── CLAUDE.md            # Domain layer constraints
│   └── presentation/
│       └── CLAUDE.md            # API layer conventions
├── tests/
│   └── CLAUDE.md                # Test-specific rules
└── .claude/
    └── settings.json            # Tool permission settings
```

```markdown
# src/domain/CLAUDE.md

## Strict Rules for the Domain Layer
- Importing external libraries is strictly prohibited
- Do not write framework-dependent code
- Do not introduce database or HTTP concepts
- All value objects must be immutable (frozen=True)
- Express side effects through domain events
- Only use exceptions defined in domain/exceptions.py
```

### Code Example 4: Everyday Interactive Operations

```bash
# Bug fix
claude "test_cancel_shipped_order in tests/test_order.py is
       failing. Investigate the cause and fix it"

# Refactoring
claude "src/services/payment.py exceeds 300 lines.
       Split it following the Single Responsibility Principle"

# New feature implementation
claude "Implement a coupon feature with the following spec:
       - Coupon code: 8 alphanumeric characters
       - Discount type: fixed amount or percentage
       - Has an expiration date
       - Each user can use it only once
       Please include tests as well"

# Code review
claude "Review the changes in git diff main...HEAD.
       Focus on security, performance, and maintainability"

# Documentation generation
claude "Analyze the endpoints under src/api/
       and generate an OpenAPI specification. Update the existing docs/api.yaml"

# Dependency analysis
claude "Analyze the dependency graph of this project,
       check for circular dependencies, and suggest solutions if any exist"
```

### Code Example 5: Leveraging Agent Mode

```bash
# Execute complex tasks autonomously
claude "Perform the API version upgrade with the following steps:
1. Read the OpenAPI spec (docs/api.yaml) to understand the current state
2. Add a v2 prefix to all endpoints
3. Keep v1 for backward compatibility (redirect to v2)
4. Update all tests and verify they pass
5. Update CHANGELOG.md"

# Claude Code autonomously executes the following:
# - Reads files to analyze the current state
# - Plans the necessary changes
# - Modifies the code
# - Runs tests
# - Repeats fixes if tests fail
# - Performs a final check and reports
```

### Code Example 6: Leveraging Sub-Agents (Task)

```bash
# Parallel investigation using the Task tool
claude "Investigate the following 3 items in parallel:
1. List all methods of every service class in src/services/
2. Top 5 modules with the lowest coverage in tests/
3. Vulnerable dependencies in package.json
Summarize and report the results for each"

# Claude Code internally spawns Task sub-agents
# to run investigations in parallel
```

### Code Example 7: MCP (Model Context Protocol) Configuration

```jsonc
// .claude/settings.json - MCP Server Configuration
{
  "mcpServers": {
    // Direct access to PostgreSQL
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/mydb"
      }
    },

    // GitHub repository operations
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },

    // Slack notifications
    "slack": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}"
      }
    },

    // Playwright (browser testing)
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-playwright"]
    },

    // Sentry (error monitoring)
    "sentry": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-sentry"],
      "env": {
        "SENTRY_AUTH_TOKEN": "${SENTRY_AUTH_TOKEN}",
        "SENTRY_ORG": "my-org"
      }
    }
  }
}
```

---

## 3. Advanced Usage Patterns

### 3.1 MCP Tool Integration Flow

```
┌──────────────────────────────────────────────────────────┐
│              MCP Integration Workflow Example              │
│                                                          │
│  User: "Fix Issue #42 and create a PR"                    │
│                                                          │
│  ┌─────────┐  MCP:GitHub   ┌─────────┐                  │
│  │Claude   │──────────────►│GitHub   │ Retrieve issue    │
│  │Code     │◄──────────────│API      │ details           │
│  │         │               └─────────┘                  │
│  │         │  Tool:Read                                  │
│  │         │──────────────► Read source code              │
│  │         │                                             │
│  │         │  Tool:Write                                  │
│  │         │──────────────► Write fix code                │
│  │         │                                             │
│  │         │  Tool:Bash                                   │
│  │         │──────────────► Run tests                     │
│  │         │                                             │
│  │         │  MCP:GitHub   ┌─────────┐                  │
│  │         │──────────────►│GitHub   │ Create PR         │
│  │         │◄──────────────│API      │                  │
│  └─────────┘               └─────────┘                  │
│                                                          │
│  Result: "Created PR #123: https://..."                   │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Building a Custom MCP Server

```typescript
// custom-mcp-server.ts
// Example of a custom MCP server that integrates with internal systems

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "internal-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Integration with internal ticket system
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "get_ticket",
      description: "Retrieve ticket information from the internal ticket system",
      inputSchema: {
        type: "object",
        properties: {
          ticket_id: { type: "string", description: "Ticket ID" }
        },
        required: ["ticket_id"]
      }
    },
    {
      name: "update_ticket_status",
      description: "Update ticket status",
      inputSchema: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          status: {
            type: "string",
            enum: ["open", "in_progress", "review", "done"]
          },
          comment: { type: "string" }
        },
        required: ["ticket_id", "status"]
      }
    },
    {
      name: "search_wiki",
      description: "Search the internal wiki",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          category: { type: "string", description: "Category" }
        },
        required: ["query"]
      }
    }
  ]
}));

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_ticket":
      const ticket = await fetchFromInternalAPI(
        `/tickets/${args.ticket_id}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(ticket) }]
      };

    case "update_ticket_status":
      await updateInternalAPI(
        `/tickets/${args.ticket_id}`,
        { status: args.status, comment: args.comment }
      );
      return {
        content: [{ type: "text", text: "Status updated successfully" }]
      };

    case "search_wiki":
      const results = await searchInternalWiki(args.query, args.category);
      return {
        content: [{ type: "text", text: JSON.stringify(results) }]
      };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3.3 Copilot vs Claude Code Comparison

| Feature | GitHub Copilot | Claude Code |
|---------|---------------|-------------|
| Operation Style | In-editor completion | CLI / Agent |
| Context | Open files | Entire project |
| Scope | Within a single file | Multi-file |
| Tool Integration | Editor features only | MCP / Bash / Git |
| Test Execution | Not possible | Autonomous execution & fixes |
| Git Operations | Not possible | Commits & PR creation |
| Best Use Case | Real-time completion | Complex task automation |
| Pricing | $10-39/month | API usage-based |

### 3.4 Copilot + Claude Code Combined Strategy

| Scenario | Recommended Tool | Reason |
|----------|-----------------|--------|
| Writing logic within a function | Copilot | Real-time completion is comfortable |
| Designing and implementing new features | Claude Code | Requires multi-file support |
| Bug investigation | Claude Code | Requires log analysis, grep, and test execution |
| Adding tests | Both | Complete with Copilot, verify with Claude Code |
| Documentation generation | Claude Code | Requires understanding the entire project |
| Refactoring | Claude Code | Requires impact analysis and test verification |

---

## 4. CI/CD Integration Patterns

### 4.1 Automating Code Reviews with GitHub Actions

```yaml
# .github/workflows/claude-review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  claude-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Run AI Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # Get the diff and request a review from Claude Code
          DIFF=$(git diff origin/main...HEAD)
          claude -p "Please review the following code diff.
          Point out issues from the perspectives of security, performance,
          and maintainability, and suggest improvements.
          Output in markdown format.

          $DIFF" > review.md

      - name: Post Review Comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const review = fs.readFileSync('review.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## AI Code Review\n\n${review}`
            });
```

### 4.2 Automating Test Generation

```yaml
# .github/workflows/claude-test-gen.yml
name: AI Test Generation

on:
  pull_request:
    paths:
      - 'src/**/*.ts'
      - 'src/**/*.py'

jobs:
  generate-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Identify Changed Files
        id: changed
        run: |
          FILES=$(git diff --name-only origin/main...HEAD | grep -E '\.(ts|py)$' | grep -v test)
          echo "files=$FILES" >> $GITHUB_OUTPUT

      - name: Generate Tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude -p "Identify areas lacking test coverage for the following
          changed files and generate test code.
          Match the style of existing tests.

          Changed files: ${{ steps.changed.outputs.files }}"
```

### 4.3 Automated Commit Message Generation

```bash
#!/bin/bash
# scripts/ai-commit.sh
# Automated commit message generation with AI

# Get the diff of staged changes
STAGED_DIFF=$(git diff --cached)

if [ -z "$STAGED_DIFF" ]; then
    echo "No staged changes"
    exit 1
fi

# Have Claude Code generate a commit message
MESSAGE=$(claude -p "Based on the following git diff,
generate a commit message in Conventional Commits format.
Line 1: type(scope): concise description (50 chars or less)
Line 3 onwards: details of the changes (optional)

diff:
$STAGED_DIFF" --output-format text)

echo "Generated commit message:"
echo "$MESSAGE"
echo ""
read -p "Commit with this message? (y/n): " CONFIRM

if [ "$CONFIRM" = "y" ]; then
    git commit -m "$MESSAGE"
    echo "Committed successfully"
else
    echo "Cancelled"
fi
```

---

## 5. Permission Management and Security

### 5.1 Permission Configuration Details

```jsonc
// .claude/settings.json - Permission Management
{
  "permissions": {
    // Allowed tools and scopes
    "allow": [
      "Read",                              // Read all files
      "Write(src/**,tests/**,docs/**)",    // Write only to specific directories
      "Bash(npm test,npm run *,pytest *)", // Execute only specific commands
      "Grep",                              // Unlimited search
      "Glob"                               // Unlimited file listing
    ],
    // Explicitly denied tools and scopes
    "deny": [
      "Bash(rm -rf *)",          // Prohibit delete all
      "Bash(git push --force*)", // Prohibit force push
      "Write(.env*)",            // Prohibit modifying environment variable files
      "Write(*.pem)",            // Prohibit modifying certificate files
      "Write(*.key)",            // Prohibit modifying private key files
      "Read(.env*)",             // Prohibit reading environment variable files
      "Bash(curl *)",            // Prohibit external communication
      "Bash(wget *)"             // Prohibit external downloads
    ]
  }
}
```

### 5.2 Security Best Practices

```
┌──────────────────────────────────────────────────────┐
│           Claude Code Security Measures               │
│                                                      │
│  1. Principle of Least Privilege                      │
│     ├── Allow writing only to required directories   │
│     ├── Whitelist executable commands                 │
│     └── Prohibit reading/writing .env and secrets    │
│                                                      │
│  2. Mandatory Review Flow                             │
│     ├── Always verify AI changes with git diff        │
│     ├── Require user approval for destructive ops    │
│     └── Prohibit direct operations on production     │
│                                                      │
│  3. Audit Logs                                        │
│     ├── Save Claude Code operation logs              │
│     ├── Session history in ~/.claude/logs/            │
│     └── Establish team-shared operation policies     │
│                                                      │
│  4. Network Security                                  │
│     ├── API communication via HTTPS (TLS 1.3)        │
│     ├── Compatible with proxy environments           │
│     └── VPN usage recommended                        │
└──────────────────────────────────────────────────────┘
```

### 5.3 Team Security Policy Template

```markdown
# Claude Code Team Security Policy

## 1. API Key Management
- Manage personal API keys via environment variables (no hardcoding in .env)
- Manage shared team keys with AWS Secrets Manager or similar
- Rotate keys monthly

## 2. Operation Restrictions
- Direct connection to production DB is prohibited
- Access to production file systems is prohibited
- Package installation (npm install, pip install) requires prior approval

## 3. Code Review
- AI-generated code follows the same review process as regular code
- Security-related code (authentication, encryption, etc.) requires review by 2+ people
- AI-generated code must be noted in the PR

## 4. Data Protection
- Do not include personal information in prompts
- Use anonymized data for testing
- Understand and manage the scope of code sent to the API
```

---

## 6. Operating at Scale

### 6.1 Context Management Strategy

```
┌──────────────────────────────────────────────────────┐
│       Context Management for Large Projects           │
│                                                      │
│  Challenge: Handling codebases with 1M+ lines        │
│                                                      │
│  Strategy 1: Hierarchical CLAUDE.md                   │
│  ┌─────────────────────────────────────┐             │
│  │ root/CLAUDE.md     (Overall policy) │             │
│  │ └── src/CLAUDE.md  (Dev standards)  │             │
│  │     └── api/CLAUDE.md (API-specific)│             │
│  └─────────────────────────────────────┘             │
│                                                      │
│  Strategy 2: Task Splitting and Delegation            │
│  ┌─────────────────────────────────────┐             │
│  │ Main Agent: Overall plan creation   │             │
│  │ ├── SubAgent 1: Frontend changes    │             │
│  │ ├── SubAgent 2: Backend changes     │             │
│  │ └── SubAgent 3: Test updates        │             │
│  └─────────────────────────────────────┘             │
│                                                      │
│  Strategy 3: Conversation compression via /compact    │
│  ┌─────────────────────────────────────┐             │
│  │ Long conversation → /compact →      │             │
│  │ Continue with summarized context    │             │
│  └─────────────────────────────────────┘             │
└──────────────────────────────────────────────────────┘
```

### 6.2 Usage in Monorepos

```bash
# Claude Code usage example in a monorepo
# packages/
# ├── frontend/     (React)
# ├── backend/      (FastAPI)
# ├── shared/       (Shared type definitions)
# └── infra/        (Terraform)

# Run a task against a specific package
claude --cwd packages/backend "Add a new API endpoint"

# Cross-package consistency check
claude "Verify that the type definitions in packages/shared/types.ts
       and the Pydantic models in packages/backend/schemas.py
       are consistent. Fix any inconsistencies"

# Consistent changes across infrastructure and application
claude "To deploy a new microservice:
1. Add an ECS task definition in packages/infra/
2. Generate a new service skeleton in packages/backend/
3. Add inter-service communication types in packages/shared/
4. Add the service to docker-compose.yml"
```

### 6.3 Best Practices for Agent Operations

```
Agent Operations Optimization Guidelines

1. Task Granularity Design
   ┌──────────────────────────────────────┐
   │ Too large → Context overflow          │
   │   "Refactor the entire app"           │
   │                                      │
   │ Too small → Increased round-trip cost │
   │   "Rename this variable"             │
   │                                      │
   │ Optimal → Per feature/module          │
   │   "Implement the order cancellation  │
   │    feature, including tests"          │
   └──────────────────────────────────────┘

2. Context Window Management
   - 10-15 files per session is optimal
   - 50+ files risk mid-session termination
   - Use /compact regularly to compress context

3. Parallel Agent Execution
   - Run independent tasks with parallel agents simultaneously
   - 8-10 concurrent agents is optimal (15+ is excessive)
   - Execute dependent tasks sequentially

4. Error Recovery
   - If an agent stops, resume with --resume
   - When rate-limited, switch to non-generative tasks (analysis/review)
   - When retrying, add extra context rather than using the same prompt
```

---

## 7. Practical Use Case Collection

### 7.1 Legacy Code Modernization

```bash
# Step 1: Current state analysis
claude "Analyze the code in the src/legacy/ directory:
1. List the technologies and patterns in use
2. Check test coverage
3. Create a dependency graph
4. Identify high-risk modules (circular dependencies, large files, etc.)"

# Step 2: Create a migration plan
claude "Based on the analysis results, create a migration plan with these conditions:
- Migrate incrementally (no big bang)
- Tests must pass at each phase
- Existing functionality must remain operational during migration
- Apply the Strangler Fig pattern"

# Step 3: Incremental execution
claude "Execute Phase 1 of the migration plan:
- Split the UserService class into Clean Architecture
- Adapt existing tests to the new structure
- Create adapters that allow old and new code to coexist"
```

### 7.2 Database Migration Assistance

```bash
# Auto-generate schema changes
claude "Create an Alembic migration with the following requirements:
1. Add an email_verified column to the users table (boolean, default=false)
2. Create a new user_preferences table
3. Include a data migration script for existing data
4. Define the rollback procedure as well"

# Data consistency check
claude "Detect differences between the current SQLAlchemy model definitions
       and the DB schema. Compare the models in the models/ directory
       with the latest migration in alembic/versions/"
```

### 7.3 Performance Tuning

```bash
# Bottleneck investigation
claude "The following endpoint is slow:
GET /api/v1/products?category=electronics&sort=price

1. Analyze the queries in src/api/products.py
2. Identify problematic SQL from the SQLAlchemy query log
3. Check for N+1 queries
4. Suggest indexes
5. Implement query optimization"

# Load test result analysis
claude "Analyze the locust test results (results/load_test.csv):
1. Calculate p50, p95, p99 response times
2. Identify throughput bottlenecks
3. Check for signs of memory leaks
4. List improvement suggestions in priority order"
```

### 7.4 Security Audit

```bash
# Security scan of the codebase
claude "Audit the codebase from a security perspective:
1. Detect hardcoded secrets
2. Locations with potential SQL injection
3. Locations with potential XSS vulnerabilities
4. Locations where authentication/authorization could be bypassed
5. Known vulnerabilities in dependencies
Show the severity (Critical/High/Medium/Low) and fix method for each issue"
```

### 7.5 Automated API Documentation Maintenance

```bash
# Sync implementation with documentation
claude "Compare the endpoint implementations in src/api/ with the OpenAPI spec in docs/api.yaml:
1. Endpoints not documented
2. Parameter definitions that differ from the implementation
3. Mismatched response codes
Fix all inconsistencies and update docs/api.yaml"
```

---

## 8. Troubleshooting

### 8.1 Common Errors and Solutions

```
┌───────────────────────────────────────────────────────┐
│          Claude Code Troubleshooting                   │
│                                                       │
│  Error 1: "Rate limit exceeded"                        │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause: Reached API rate limit                │      │
│  │ Solutions:                                   │      │
│  │   - Wait a few minutes and retry             │      │
│  │   - Upgrade to Claude Max for higher limits  │      │
│  │   - Switch to non-generative tasks           │      │
│  │     (analysis/review)                        │      │
│  │   - Use --model to switch to a lower-cost    │      │
│  │     model                                    │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Error 2: "Context window exceeded"                    │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause: Conversation context exceeded token   │      │
│  │        limit                                 │      │
│  │ Solutions:                                   │      │
│  │   - Compress conversation with /compact      │      │
│  │   - Start a new session                      │      │
│  │   - Split tasks into smaller units           │      │
│  │   - Use offset/limit for partial file reads  │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Error 3: "Permission denied"                          │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause: Permission settings in settings.json  │      │
│  │ Solutions:                                   │      │
│  │   - Check .claude/settings.json              │      │
│  │   - Add required permissions to allow        │      │
│  │   - Verify no conflicts with deny rules      │      │
│  │   - Check priority between global and        │      │
│  │     project settings                         │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Error 4: "MCP server connection failed"               │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause: MCP server startup/connection error   │      │
│  │ Solutions:                                   │      │
│  │   - Verify the npx command is correct        │      │
│  │   - Verify environment variables are set     │      │
│  │   - Test starting the MCP server standalone  │      │
│  │   - Check for port conflicts                 │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Error 5: "Tool execution timeout"                     │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause: Timeout on Bash commands, etc.        │      │
│  │ Solutions:                                   │      │
│  │   - Extend the timeout setting               │      │
│  │   - Limit scope for heavy test suites        │      │
│  │   - Consider background execution for builds │      │
│  └─────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────┘
```

### 8.2 Performance Optimization

```
Claude Code Response Speed Optimization

1. Prompt Optimization
   ├── More specific instructions → faster processing
   ├── Avoid including unnecessary context
   └── Use step-by-step instructions to reduce per-request workload

2. Model Selection Optimization
   ├── Simple tasks → Sonnet (fast, low cost)
   ├── Complex tasks → Opus (high quality, high cost)
   └── Code completion → Haiku (fastest, lowest cost)

3. Tool Execution Optimization
   ├── Pre-filter with Glob/Grep → then Read
   ├── Use offset/limit for partial reads of large files
   └── Avoid unnecessary Bash executions

4. Session Management
   ├── Compress regularly with /compact
   ├── Prefer short session chains over long sessions
   └── Run unrelated tasks in separate sessions
```

### 8.3 Debugging Techniques

```bash
# Enable Claude Code debug logging
CLAUDE_CODE_DEBUG=1 claude "Execute the task"

# View API request details
ANTHROPIC_LOG=debug claude -p "test"

# Check session logs
ls -la ~/.claude/logs/
# Each session's logs are stored here

# Test MCP server connection
npx -y @modelcontextprotocol/server-postgres 2>&1
# Check error messages
```

---

## Anti-Patterns

### Anti-Pattern 1: Neglecting Permission Configuration

```jsonc
// BAD: Allow all tools without restrictions
{
  "permissions": {
    "allow": ["*"]  // Dangerous! Can execute anything
  }
}

// GOOD: Set minimum required permissions
{
  "permissions": {
    "allow": [
      "Read",
      "Write(src/**,tests/**)",   // Write only to src/ and tests/
      "Bash(npm test,npm run *)", // Only specific commands
      "Grep",
      "Glob"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Write(.env*)",
      "Write(*.pem)"
    ]
  }
}
```

### Anti-Pattern 2: Not Setting Up CLAUDE.md

```
Problems with not having CLAUDE.md:
   - AI does not know the project conventions
   - You need to repeat the same explanations every time
   - AI behavior is inconsistent across team members
   - Risk of accessing sensitive files

Benefits of properly configuring CLAUDE.md:
   - Consistent coding style
   - Project-specific constraints applied automatically
   - "Prohibited actions" are explicitly defined
   - The entire team shares the same AI experience
```

### Anti-Pattern 3: Submitting Massive Tasks All at Once

```
BAD: Request everything at once
   "Convert the entire project to TypeScript, rewrite all tests,
    and update all documentation"
   → Context overflow, quality degradation, mid-task termination

GOOD: Execute in stages
   Phase 1: "Convert src/utils/ to TypeScript"
   Phase 2: "Update the tests for src/utils/"
   Phase 3: "Convert src/services/ to TypeScript"
   → Verify quality at each phase, address issues immediately
```

### Anti-Pattern 4: Context Pollution

```
BAD: Accumulating unrelated information in the session
   - Running multiple unrelated tasks in the same session
   - Pasting large amounts of logs or error messages
   - Leaving trial-and-error failure results in the conversation

GOOD: Clean context management
   - Use a new session for each task
   - Compress unnecessary history with /compact
   - Provide summarized error information
   - Include only necessary information in the context
```


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
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Test
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

Extend the basic implementation and add the following features.

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

# Test
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
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on minimum required features
- Automated tests only for the critical path
- Introduce monitoring from the start

**Lessons Learned:**
- Do not aim for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Incrementally modernize a system that has been in operation for 10+ years

**Approach:**
- Use the Strangler Fig pattern for incremental migration
- Create Characterization Tests first if existing tests are missing
- Use an API gateway to allow old and new systems to coexist
- Perform data migration incrementally

| Phase | Work Content | Estimated Duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration Start | Sequential migration from peripheral features | 3-6 months | Medium |
| 4. Core Migration | Migration of core features | 6-12 months | High |
| 5. Completion | Decommission legacy system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Define clear boundaries with Domain-Driven Design
- Set ownership per team
- Manage shared libraries using Inner Source approach
- Design API-first to minimize inter-team dependencies

```python
# API contract definitions between teams
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
        """Export in OpenAPI format"""
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
1. Cache strategy (L1: In-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Impact | Implementation Cost | Applicable Scenario |
|--------------------|--------|-------------------|-------------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Asynchronous processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------------|-----------|---------------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor auth, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Configuration issues | Medium | Security headers, principle of least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logs, audit trails | Log analysis |

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
- [ ] Dependency vulnerability scanning is implemented
- [ ] Error messages do not contain internal information

---

## Migration Guide

### Version Upgrade Considerations

| Version | Key Changes | Migration Work | Impact Scope |
|---------|-----------|---------------|-------------|
| v1.x to v2.x | API design overhaul | Endpoint changes | All clients |
| v2.x to v3.x | Authentication method change | Token format update | Auth-related |
| v3.x to v4.x | Data model change | Run migration scripts | DB-related |

### Incremental Migration Steps

```python
# Migration script template
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Callable

logger = logging.getLogger(__name__)

class MigrationRunner:
    """Incremental migration execution engine"""

    def __init__(self, migration_dir: str):
        self.migration_dir = Path(migration_dir)
        self.migrations: List[Dict] = []
        self.completed: List[str] = []

    def register(self, version: str, description: str,
                 up: Callable, down: Callable):
        """Register a migration"""
        self.migrations.append({
            'version': version,
            'description': description,
            'up': up,
            'down': down,
            'registered_at': datetime.now().isoformat()
        })

    def run_up(self, target_version: str = None):
        """Run migrations (upgrade)"""
        for migration in self.migrations:
            if migration['version'] in self.completed:
                continue
            logger.info(f"Running: {migration['version']} - "
                       f"{migration['description']}")
            try:
                migration['up']()
                self.completed.append(migration['version'])
                logger.info(f"Completed: {migration['version']}")
            except Exception as e:
                logger.error(f"Failed: {migration['version']}: {e}")
                raise
            if target_version and migration['version'] == target_version:
                break

    def run_down(self, target_version: str):
        """Rollback migrations"""
        for migration in reversed(self.migrations):
            if migration['version'] not in self.completed:
                continue
            if migration['version'] == target_version:
                break
            logger.info(f"Rolling back: {migration['version']}")
            migration['down']()
            self.completed.remove(migration['version'])

    def status(self) -> Dict:
        """Check migration status"""
        return {
            'total': len(self.migrations),
            'completed': len(self.completed),
            'pending': len(self.migrations) - len(self.completed),
            'versions': {
                m['version']: 'completed'
                if m['version'] in self.completed else 'pending'
                for m in self.migrations
            }
        }
```

### Rollback Plan

Always prepare a rollback plan for migration work:

1. **Data Backup**: Take a full backup before migration
2. **Test Environment Verification**: Pre-verify in an environment equivalent to production
3. **Gradual Rollout**: Deploy incrementally with canary releases
4. **Enhanced Monitoring**: Shorten metrics monitoring intervals during migration
5. **Clear Decision Criteria**: Pre-define criteria for deciding when to rollback
---

## FAQ

### Q1: What is the pricing model for Claude Code?

Claude Code uses pay-per-use billing based on Anthropic API usage. Claude Sonnet costs $3/1M input tokens and $15/1M output tokens. Average daily development costs around $5-20 (depending on usage). With a Claude Max subscription ($100/$200 per month), a certain amount of Claude Code usage is included.

### Q2: Can Claude Code be used in an offline environment?

Claude Code itself requires a connection to the Anthropic API, so completely offline usage is not possible. However, if you run MCP servers locally, file operations and command execution can be completed locally. Only API communication requires an internet connection. Usage via VPN is fully supported.

### Q3: Should I use Claude Code or Cursor as my primary tool?

The two are complementary. Cursor excels at "interactive development with a GUI" and is good at visual code review and real-time completion. Claude Code excels at "CLI-based automation and agent execution" and is suited for complex multi-step tasks and CI/CD integration. Ideally, use Cursor for everyday coding and Claude Code for automating complex tasks.

### Q4: Should CLAUDE.md be shared with the team?

CLAUDE.md should be committed to the repository and shared across the entire team. This ensures all members have the same AI experience, and coding standards and architectural constraints are automatically applied. However, personal preference settings (editor config, etc.) should be written in `~/.claude/CLAUDE.md` and applied globally.

### Q5: Are there security risks with MCP servers?

MCP servers operate as local processes, so the risk of network exposure is low. However, when passing access tokens for DBs and APIs via environment variables, careful management of `.env` files is necessary. Do not use production credentials -- only grant development access permissions. Also, only use MCP server code from trusted sources.

### Q6: What are tips for optimizing Claude Code costs?

The following strategies can help reduce costs: (1) Specify the Sonnet model for simple tasks (about 1/5 the cost of Opus), (2) Make prompts specific to reduce round trips, (3) Compress conversation context with /compact to reduce input tokens, (4) Pre-provide project information in CLAUDE.md to reduce AI queries, (5) Batch large volumes of tasks and run them in non-interactive mode (`claude -p`).

### Q7: What about copyright for code generated by Claude Code?

Based on Anthropic's Terms of Service, copyright for code generated by Claude Code belongs to the user. However, since AI may reproduce existing open-source code from training data, verifying license compatibility is the developer's responsibility. Security-critical code and code related to patents should always be reviewed by humans after generation.

### Q8: What should be considered when deploying Claude Code in a large team (50+ people)?

For large teams, pay attention to the following: (1) Budget management for API usage (set limits per team/individual), (2) CLAUDE.md governance (changes require team lead approval), (3) Unified security policies (template .claude/settings.json), (4) Knowledge sharing (team wiki of effective prompt patterns), (5) Onboarding process (Claude Code training for new members).

---

## Summary

| Item | Key Points |
|------|-----------|
| Basic Format | CLI-based AI agent capable of operating on the entire project |
| CLAUDE.md | Configuration file that communicates project conventions and constraints to AI (supports hierarchy) |
| Agent | Autonomously executes complex tasks step by step (parallelization possible with Task) |
| MCP | Protocol for integrating with external tools (DB, GitHub, Slack, etc.) |
| Permission Management | Setting minimum required permissions is critical (explicit allow/deny) |
| CI/CD Integration | Automated PR reviews and test generation via GitHub Actions |
| Combined Strategy | Copilot for real-time completion, Claude Code for complex tasks |
| Scaling | Context management, task splitting, and leveraging /compact are key |

---

## Recommended Next Reads

- [02-cursor-and-windsurf.md](./02-cursor-and-windsurf.md) -- AI IDE comparison with Cursor/Windsurf
- [03-ai-coding-best-practices.md](./03-ai-coding-best-practices.md) -- Quality assurance for AI coding
- [../02-workflow/03-ai-debugging.md](../02-workflow/03-ai-debugging.md) -- Debugging with Claude Code

---

## References

1. Anthropic, "Claude Code Documentation," 2025. https://docs.anthropic.com/en/docs/claude-code
2. Anthropic, "Model Context Protocol (MCP) Specification," 2024. https://modelcontextprotocol.io/
3. Anthropic, "Building effective agents," 2024. https://www.anthropic.com/research/building-effective-agents
4. Simon Willison, "Claude Code review," simonwillison.net, 2025. https://simonwillison.net/
5. Anthropic, "Claude Code best practices," 2025. https://docs.anthropic.com/en/docs/claude-code/best-practices
6. MCP Community, "MCP Server Registry," 2025. https://github.com/modelcontextprotocol/servers
