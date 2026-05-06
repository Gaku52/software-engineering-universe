# AI Development Tools

> A guide for integrating AI into your development workflow using GitHub Copilot, Claude Code CLI, and Cursor to dramatically improve coding efficiency.

## What You Will Learn

1. GitHub Copilot configuration and effective prompting techniques
2. Claude Code CLI setup and practical usage
3. Cursor editor introduction and AI editor comparison
4. Security and privacy management for AI tools
5. Governance and best practices for team adoption


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of relevant foundational concepts
- Familiarity with the content in [Git Configuration](./02-git-config.md)

---

## 1. Overview of AI Development Tools

### 1.1 Key Tool Comparison

| Feature | GitHub Copilot | Claude Code CLI | Cursor | Cody (Sourcegraph) | Windsurf | Aider |
|---------|---------------|-----------------|--------|---------------------|----------|-------|
| Type | VS Code extension | CLI tool | Editor | VS Code extension | Editor | CLI tool |
| AI Model | GPT-4o / Claude | Claude | GPT-4o / Claude | Multiple | Claude / GPT | Multiple |
| Inline Completion | Yes | No | Yes | Yes | Yes | No |
| Chat | Yes | Yes | Yes | Yes | Yes | Yes |
| Agent | Yes | Yes | Yes | Partial | Yes | Yes |
| File Editing | Yes | Yes | Yes | Limited | Yes | Yes |
| Multi-file | Yes | Yes | Yes | Limited | Yes | Yes |
| MCP Support | Yes | Yes | Yes | No | Yes | No |
| Price (monthly) | $10-39 | Pay-as-you-go | $20 | Free tier available | $15 | Free (API costs) |
| Offline | No | No | No | No | No | No |

### 1.2 Role Division Among AI Tools

```
AI Development Tool Usage Layers:

┌─────────────────────────────────────────────┐
│            Development Workflow               │
├──────────────┬──────────────┬───────────────┤
│ Code Writing │ Code Review  │ Architecture  │
│              │              │               │
│  Copilot     │  Claude Code │  Claude Code  │
│  Cursor      │  Copilot Chat│  Cursor       │
│  (completion)│  (analysis)  │  (design)     │
├──────────────┼──────────────┼───────────────┤
│  Debugging   │ Test Gen     │ Documentation │
│              │              │               │
│  Copilot Chat│  Claude Code │  Claude Code  │
│  Cursor      │  Copilot     │  Copilot Chat │
│  (dialogue)  │  (generation)│  (generation) │
├──────────────┼──────────────┼───────────────┤
│  CI/CD Setup │  Migration   │  Learning     │
│              │              │               │
│  Claude Code │  Claude Code │  Copilot Chat │
│  Cursor      │  Cursor      │  Claude Code  │
│  (generation)│(analysis+gen)│  (dialogue)   │
└──────────────┴──────────────┴───────────────┘
```

### 1.3 Evolution of AI Development Tools (2024–2026)

```
Paradigm Shift in AI Development Tools:

  2023: Completion (Autocomplete)
  ├── Single-line to multi-line code completion
  ├── Accept with Tab key
  └── Context: current file

  2024: Chat + Agent
  ├── Multi-file editing
  ├── Terminal command execution
  ├── Test generation and execution
  └── Context: entire project

  2025-2026: Autonomous Agents
  ├── Autonomous execution of full tasks
  ├── Plan → Code → Test → Fix cycle
  ├── Tool integration via MCP
  ├── CI/CD pipeline integration
  └── Context: repository + external knowledge
```

---

## 2. GitHub Copilot

### 2.1 Setup

```bash
# Install extensions in VS Code
code --install-extension GitHub.copilot
code --install-extension GitHub.copilot-chat

# Sign in with your GitHub account
# Click the account icon in the bottom-left of VS Code → Sign in with GitHub

# Check your plan
# GitHub → Settings → Copilot → Check license type
# Individual: $10/month
# Business: $19/month (org management, IP protection)
# Enterprise: $39/month (customization, audit logs)
```

### 2.2 VS Code Settings

```jsonc
// .vscode/settings.json
{
  // Basic Copilot settings
  "github.copilot.enable": {
    "*": true,
    "plaintext": false,
    "markdown": true,
    "yaml": true
  },

  // Show inline suggestions
  "editor.inlineSuggest.enabled": true,

  // Disable for specific file types (sensitive files)
  "github.copilot.enable": {
    "dotenv": false,
    "properties": false,
    "ini": false
  },

  // Copilot Chat settings
  "github.copilot.chat.localeOverride": "ja",

  // Inline suggestion display settings
  "github.copilot.editor.enableAutoCompletions": true,

  // Enable Next Edit Suggestions (NES)
  "github.copilot.nextEditSuggestions.enabled": true
}
```

### 2.3 Effective Prompting Techniques

```typescript
// ─── Technique 1: Guide with function signature + comments ───

// Validates a user's age. Under 18 is not allowed.
// Returns a specific message on error.
function validateAge(age: unknown): { valid: boolean; message: string } {
  // ← Copilot suggests an appropriate implementation
}

// ─── Technique 2: Write tests first (TDD) ───

describe('calculateDiscount', () => {
  it('regular members get 5% discount', () => {
    expect(calculateDiscount(1000, 'normal')).toBe(950);
  });
  it('premium members get 15% discount', () => {
    expect(calculateDiscount(1000, 'premium')).toBe(850);
  });
  it('discounted price should not go below 0', () => {
    expect(calculateDiscount(10, 'premium')).toBe(0);
  });
});
// → Auto-generate implementation from tests

// ─── Technique 3: Generate implementation from type definitions ───

type SortDirection = 'asc' | 'desc';

interface SortOptions<T> {
  data: T[];
  key: keyof T;
  direction: SortDirection;
}

function sortBy<T>(options: SortOptions<T>): T[] {
  // ← Accurate implementation is suggested from type information
}

// ─── Technique 4: Few-shot example pattern ───

// Writing a similar function next to an existing one teaches the pattern
function getUserById(id: string): Promise<User> {
  return db.users.findUnique({ where: { id } });
}

function getPostById(id: string): Promise<Post> {
  // ← Accurately inferred from the pattern above
}

// ─── Technique 5: Clarify intent with JSDoc ───

/**
 * Reads a CSV file and groups the data by a specified column
 * @param filePath Path to the CSV file
 * @param groupBy Column name to group by
 * @returns Grouped data
 * @throws FileNotFoundError if the file does not exist
 * @example
 * const result = await groupCsvByColumn('./data.csv', 'department');
 * // { 'engineering': [...], 'marketing': [...] }
 */
async function groupCsvByColumn(
  filePath: string,
  groupBy: string
): Promise<Record<string, any[]>> {
  // ← Accurate implementation is suggested from JSDoc information
}
```

### 2.4 Using Copilot Chat

```
Copilot Chat Key Commands:

┌──────────────────────────────────────────┐
│ /explain   → Explain code                 │
│ /fix       → Suggest bug fixes            │
│ /tests     → Generate test code           │
│ /doc       → Generate documentation       │
│ /optimize  → Suggest performance optimizations │
│ /new       → Generate new file/project    │
│ @workspace → Include entire workspace as context │
│ @terminal  → Include terminal output as context │
│ @vscode    → Ask about VS Code settings   │
│ @github    → GitHub-related operations    │
│ #file      → Add specific file to context │
│ #selection → Add selected code to context │
│ #codebase  → Search entire codebase       │
│ #terminalSelection → Add terminal selection to context │
└──────────────────────────────────────────┘

Examples of effective usage:
  "@workspace Explain the authentication flow of this project"
  "#file:src/auth/middleware.ts /fix Fix the security issues"
  "@terminal Explain the cause of this error and how to fix it"
  "#selection /tests Generate unit tests for this code"
  "/explain What does this regex do"
```

### 2.5 Copilot Agent Mode (Copilot Edits)

```
Copilot Agent Mode (VS Code):

  ┌─────────────────────────────────────────┐
  │ Cmd+Shift+I (macOS) / Ctrl+Shift+I      │
  │                                           │
  │ Features:                                 │
  │ - Apply changes across multiple files at once │
  │ - Create and delete files                 │
  │ - Preview changes before applying         │
  │ - Supports Undo/Redo                      │
  │                                           │
  │ Example:                                  │
  │ "Add an email field to the User model,    │
  │  and also update the validation,          │
  │  tests, and migrations"                   │
  │                                           │
  │ → Accurately modifies 4-5 files at once  │
  └─────────────────────────────────────────┘
```

---

## 3. Claude Code CLI

### 3.1 Installation

```bash
# Install via npm
npm install -g @anthropic-ai/claude-code

# Authenticate
claude auth login

# Check version
claude --version

# Update
npm update -g @anthropic-ai/claude-code
```

### 3.2 Basic Usage

```bash
# Launch in interactive mode
claude

# One-shot command
claude "Explain the structure of this project"

# Pipe input
cat error.log | claude "Analyze the cause of this error"

# Specify a file
claude "Write tests for this function" --file src/utils/validate.ts

# Specify output format
claude --output-format json "Analyze the dependencies in package.json"

# ─── Session management ───
claude --resume         # Resume previous session
claude --session-id abc  # Resume a specific session

# ─── Model selection ───
# Defaults to the latest Claude model
# The model used depends on your API key
```

### 3.3 Project Configuration

```markdown
# CLAUDE.md (place in project root)

## Project Overview
Web application built with TypeScript + React
Backend uses Express + Prisma

## Tech Stack
- Frontend: React 19, TypeScript, Tailwind CSS, Zustand
- Backend: Express, Prisma, PostgreSQL
- Testing: Vitest, React Testing Library, Playwright
- CI/CD: GitHub Actions
- Deploy: Vercel (Frontend), Railway (Backend)

## Coding Conventions
- Use functional components only (no class components)
- State management with Zustand
- Styling with Tailwind CSS
- Testing with Vitest + Testing Library
- Error handling with Result type pattern
- No use of `any` type
- No use of console.log (use logger instead)

## Directory Structure
```
src/
├── components/    # UI components
│   ├── ui/        # Generic components (Button, Input, etc.)
│   ├── features/  # Feature-specific components
│   └── layouts/   # Layout components
├── hooks/         # Custom hooks
├── stores/        # Zustand stores
├── utils/         # Utility functions
├── types/         # Type definitions
├── lib/           # External library wrappers
├── api/           # API clients
└── __tests__/     # Tests
```

## Commands
- `npm run dev` - Start development server (port 3000)
- `npm test` - Run tests
- `npm run test:watch` - Watch mode for tests
- `npm run build` - Build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run typecheck` - TypeScript type check
- `npm run db:migrate` - Run Prisma migration
- `npm run db:seed` - Seed data

## What NOT to Do
- Do not add features without tests
- Do not use raw Prisma queries (use ORM methods)
- Do not hardcode environment variables
- Do not modify files inside node_modules
```

### 3.4 CLAUDE.md Hierarchy

```bash
# CLAUDE.md can be placed in multiple locations
# Priority: local > project > global

~/.claude/CLAUDE.md              # Global settings (shared across all projects)
~/projects/my-app/CLAUDE.md      # Project root
~/projects/my-app/src/CLAUDE.md  # Subdirectory (additional rules)

# Example global CLAUDE.md
# ~/.claude/CLAUDE.md
# ---
# ## Common Rules
# - Write comments in Japanese
# - Enable strict mode when using TypeScript
# - Always include both unit tests and integration tests
# - Follow Conventional Commits for commit messages
```

### 3.5 Practical Workflow

```
Typical Claude Code Usage Patterns:

┌─────────────────────────────────────────┐
│ 1. Code Review                           │
│    claude "Review changes in src/api/"   │
│    → Flags security and performance issues │
│    → Proposes specific improvement code  │
│                                           │
│ 2. Refactoring                           │
│    claude "Split this function into smaller pieces" │
│    → Splits files and updates tests together │
│    → Auto-updates import paths            │
│                                           │
│ 3. Bug Fixing                            │
│    cat error.log | claude "Fix this"      │
│    → Analyzes error → Identifies cause → Applies fix │
│    → Verifies fix with tests              │
│                                           │
│ 4. Test Generation                       │
│    claude "Add tests for src/utils/"      │
│    → Identifies low-coverage areas and generates tests │
│    → Covers edge cases                    │
│                                           │
│ 5. Documentation Update                  │
│    claude "Update README to match API changes" │
│    → Detects code changes and auto-applies them │
│                                           │
│ 6. Migration                             │
│    claude "Migrate from React Router v6 to v7" │
│    → Detects and fixes breaking changes   │
│    → Updates tests                        │
│                                           │
│ 7. New Feature Implementation            │
│    claude "Implement a user invitation feature" │
│    → DB design → API → UI → Tests        │
│    → Creates and edits files step by step │
│                                           │
│ 8. CI/CD Setup                           │
│    claude "Set up CI with GitHub Actions" │
│    → lint → test → build → deploy        │
│    → Cache optimization included automatically │
└─────────────────────────────────────────┘
```

### 3.6 Claude Code Slash Commands

```bash
# Used in interactive mode
/help           # Display help
/clear          # Clear conversation history
/compact        # Compress context (save memory)
/config         # View/change settings
/cost           # Show cost for current session
/doctor         # Run environment diagnostics
/init           # Initialize CLAUDE.md
/review         # Enter code review mode
/terminal       # Execute terminal commands

# MCP (Model Context Protocol) tools
/mcp            # Manage MCP servers
```

### 3.7 Claude Code MCP Integration

```json
// ~/.claude/claude_desktop_config.json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://localhost:5432/mydb"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/docs"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "..."
      }
    }
  }
}
```

```
Using MCP (Model Context Protocol):

  ┌─────────────────────────────────────────┐
  │  Claude Code                             │
  │       ↕ MCP                              │
  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
  │  │ GitHub  │ │ Database │ │  Search  │ │
  │  │ Server  │ │ Server   │ │  Server  │ │
  │  └─────────┘ └──────────┘ └──────────┘ │
  │                                           │
  │  Use cases:                              │
  │  - Fetch specs from GitHub Issues and implement them │
  │  - Create queries while checking the DB schema │
  │  - Search documentation to check the latest API │
  │  - Analyze PR comments and fix code      │
  └─────────────────────────────────────────┘
```

---

## 4. Cursor

### 4.1 Setup

```bash
# macOS
brew install --cask cursor

# Import VS Code settings
# Select "Import VS Code Settings" on first launch
# → Extensions, settings, and keybindings are migrated automatically
```

### 4.2 Cursor-Specific Features

```
Cursor AI Features:

  ┌─────────────────────────────────────────┐
  │ Cmd+K (Inline Edit)                      │
  │   Ask AI to edit directly within code    │
  │   Example: "Add error handling to this function" │
  │   If a selection exists, edits that part │
  │   Without selection, generates new code  │
  ├─────────────────────────────────────────┤
  │ Cmd+L (Chat)                             │
  │   Interact with AI in a side panel       │
  │   Reference a file with @filename        │
  │   Search the entire project with @codebase │
  │   Reference official docs with @docs     │
  │   Reference web search results with @web │
  ├─────────────────────────────────────────┤
  │ Cmd+I (Composer)                         │
  │   Apply changes across multiple files at once │
  │   Understands the full project context   │
  │   Agent mode: changes code autonomously  │
  │   Can create and delete files            │
  ├─────────────────────────────────────────┤
  │ Tab (Autocomplete)                       │
  │   Predicts and suggests the next edit position │
  │   Applies multi-line changes at once     │
  │   Infers context from cursor position    │
  │   Predicts edits based on diff           │
  ├─────────────────────────────────────────┤
  │ Cmd+Shift+K (Terminal Cmd+K)             │
  │   Have AI generate commands in the terminal │
  │   Converts natural language to shell commands │
  └─────────────────────────────────────────┘
```

### 4.3 .cursorrules Configuration

```markdown
# .cursorrules (place in project root)

You are an expert TypeScript developer working on a React + Express application.

## Code Style
- Use functional programming patterns
- Prefer immutable data structures
- Always use explicit return types for functions
- Use descriptive variable names (no abbreviations)
- Maximum function length: 30 lines
- Maximum file length: 300 lines

## Framework Conventions
- React: Use functional components with hooks
- State: Zustand for global, useState for local
- Styling: Tailwind CSS utility classes
- Testing: Vitest + React Testing Library
- API: tRPC for type-safe API calls

## Error Handling
- Always use Result pattern for error handling
- Never use try-catch in business logic (only in infrastructure layer)
- Log errors with structured logging (pino)
- Return user-friendly error messages

## File Naming
- Components: PascalCase (UserProfile.tsx)
- Hooks: camelCase with use prefix (useAuth.ts)
- Utils: camelCase (formatDate.ts)
- Types: PascalCase (User.ts)
- Tests: *.test.ts or *.spec.ts

## Do Not
- Never use `any` type
- Never use `console.log` in production code
- Never mutate function arguments
- Never use `var` (use `const` or `let`)
- Never commit TODO comments without issue reference
- Never use inline styles (use Tailwind)

## When Writing Tests
- Use describe/it blocks with clear descriptions in Japanese
- Mock external dependencies
- Test edge cases and error scenarios
- Aim for >80% code coverage
- Use factory functions for test data

## Commit Messages
- Follow Conventional Commits format
- Subject in English, body in Japanese is OK
```

### 4.4 Cursor @docs Feature

```bash
# Cursor's @docs allows referencing external documentation
# Cursor Settings → Features → Docs → Add

# Recommended docs to add:
# - React: https://react.dev
# - Next.js: https://nextjs.org/docs
# - Tailwind CSS: https://tailwindcss.com/docs
# - Prisma: https://www.prisma.io/docs
# - tRPC: https://trpc.io/docs
# - Vitest: https://vitest.dev/guide/

# Usage:
# In Chat: "@docs Explain the correct usage of useEffect in React"
# → Answer based on the official React documentation
```

---

## 5. Efficient Use of AI Tools

### 5.1 Best Tool for Each Task

| Task | Recommended Tool | Reason |
|------|-----------------|--------|
| Single-line code completion | Copilot / Cursor Tab | Fastest real-time completion |
| Function implementation | Copilot + comment guidance | Infers from signature |
| Bug fixing | Claude Code / Cursor | Deep context understanding |
| Refactoring | Claude Code | Batch multi-file changes |
| Test generation | Claude Code / Copilot | Infers from existing code |
| Code review | Claude Code | Strong at security analysis |
| Architecture design | Claude Code / Cursor | Requires big-picture judgment |
| Learning and exploration | Copilot Chat / Claude | Deep-dive through dialogue |
| DB migration | Claude Code | Schema understanding + SQL generation |
| CI/CD setup | Claude Code / Cursor | Accurate YAML generation |
| Documentation generation | Claude Code | Structured output |
| Dependency updates | Claude Code | Detects breaking changes |

### 5.2 Prompt Engineering Principles

```
Structure of an Effective Prompt:

┌─────────────────────────────────────────┐
│ 1. Context (what project is it?)         │
│    "In a TypeScript + Express REST API"  │
│                                           │
│ 2. Task (what do you want it to do?)     │
│    "Create a user authentication middleware" │
│                                           │
│ 3. Constraints (rules to follow)         │
│    "Use JWT, unify errors with AppError"  │
│                                           │
│ 4. Output format (how to return it?)     │
│    "Include type definitions and tests"   │
│                                           │
│ 5. Examples (concrete input/output)      │
│    "Input: { email, password }            │
│     Output: { token, user }"             │
└─────────────────────────────────────────┘

Bad: "Create authentication"

Good: "Create a JWT-based authentication middleware for Express + TypeScript.
    Return 401 on token verification failure, use the AppError class
    for error handling, and include a refresh token mechanism.
    Also include Vitest tests."

Even better:
"Implement a JWT authentication middleware for Express + TypeScript.

    Requirements:
    1. Two-token approach: access token (15 min) + refresh token (7 days)
    2. Store refresh token in HTTP-only Cookie
    3. Throw AppError(401, 'UNAUTHORIZED') on token verification failure
    4. Set { id, email, role } in req.user

    Existing code:
    - AppError class: src/errors/AppError.ts
    - User type: src/types/User.ts
    - Environment variables: JWT_SECRET, JWT_REFRESH_SECRET

    Please include Vitest tests covering both success and failure cases."
```

### 5.3 Iterative Improvement Process

```
Effective Iterative Process with AI:

  Step 1: Initial Instruction
  ├── Clearly communicate requirements
  ├── Specify the tech stack
  └── Specify the output format

  Step 2: Review and Correction
  ├── Review the generated code
  ├── Provide specific feedback on issues
  └── "Change the X part to Y"

  Step 3: Validate with Tests
  ├── Run tests
  ├── Report failing tests
  └── "This test fails. Fix it."

  Step 4: Address Edge Cases
  ├── "What happens with an empty array?"
  ├── "Are there race conditions in concurrent processing?"
  └── "What's the performance with 1 million records?"

  Patterns to Avoid:
  Bad: Expecting perfection in one shot
  Bad: Vague instructions like "make it look good"
  Bad: Issuing the next instruction without reading the output
  Good: Divide into small pieces and improve incrementally
```

---

## 6. Security and Privacy

### 6.1 Important Settings

```jsonc
// .vscode/settings.json
{
  // Disable Copilot for sensitive files
  "github.copilot.enable": {
    "dotenv": false,
    "properties": false,
    "ini": false
  },

  // Telemetry restrictions
  "github.copilot.advanced": {
    // Block suggestions similar to public code
    "duplicationDetection": "block"
  }
}
```

```bash
# Add AI-related config files to .gitignore
echo '.cursorrules' >> .gitignore  # if needed
# CLAUDE.md should be committed (for team sharing)

# ─── .aiignore (for Claude Code) ───
# Specify files you don't want Claude Code to read
cat << 'EOF' > .aiignore
# Sensitive files
.env
.env.*
secrets/
credentials/
*.pem
*.key

# Large binaries
*.zip
*.tar.gz
node_modules/
dist/
build/

# Generated files
coverage/
.next/
EOF
```

### 6.2 Scope of Data Transmitted

```
Data transmitted by each tool:

┌──────────────┬─────────────────────────────┐
│ Tool          │ Data Transmitted             │
├──────────────┼─────────────────────────────┤
│ Copilot      │ Portion of open files        │
│ Individual   │ Context from adjacent files  │
│              │ (code snippets used for training) │
├──────────────┼─────────────────────────────┤
│ Copilot      │ Same but no data retention   │
│ Business     │ (data not used for training) │
│              │ Audit logs available         │
├──────────────┼─────────────────────────────┤
│ Claude Code  │ Contents of specified files  │
│              │ Command output               │
│              │ (deleted after 30 days)      │
│              │ Excludable via .aiignore     │
├──────────────┼─────────────────────────────┤
│ Cursor       │ Active file                  │
│              │ @referenced files            │
│              │ (Privacy Mode limits transmission) │
│              │ SOC 2 Type II certified      │
├──────────────┼─────────────────────────────┤
│ Aider        │ Contents of specified files  │
│              │ Sent directly via API key    │
│              │ (no data retention on tool side) │
└──────────────┴─────────────────────────────┘
```

### 6.3 Enterprise Adoption Security Checklist

```
AI Tool Enterprise Adoption Checklist:

  □ Confirm data retention policy
    - Is submitted code used for training?
    - What is the data retention period?
    - Where is data stored (region)?

  □ Access control
    - Is SSO/SAML integration possible?
    - Is team/role-based access control available?
    - Are audit logs obtainable?

  □ Compliance
    - SOC 2 Type II certified?
    - GDPR compliant?
    - IP (intellectual property) protection clause?

  □ Technical restrictions
    - Can specific repositories/files be excluded?
    - Can it be used via VPN/proxy?
    - Are on-premises deployment options available?

  □ Licensing
    - Who owns the copyright for AI-generated code?
    - Risk of open-source license violations?
    - Public code similarity detection feature?
```

---

## 7. Ensuring AI Code Quality

### 7.1 AI-Generated Code Review Checklist

```
Key Review Points for AI-Generated Code:

  □ Security
    - SQL injection / XSS vulnerabilities
    - Missing authentication and authorization
    - Hardcoded sensitive information
    - Insufficient input validation
    - Loose CORS configuration

  □ Logic
    - Edge case handling
    - Safe handling of null/undefined
    - Off-by-one errors
    - Race conditions
    - Resource leaks (unclosed handles, etc.)

  □ Performance
    - N+1 query problem
    - Unnecessary re-renders (React)
    - Memory leaks
    - Inefficient algorithms
    - Synchronous processing of large datasets

  □ Maintainability
    - Excessive complexity
    - Magic numbers / magic strings
    - DRY principle violations
    - Testability
    - Accuracy of documentation

  □ Dependencies
    - Use of deprecated APIs
    - Outdated library versions
    - License issues
    - Unnecessary dependency additions
```

### 7.2 Automated Verification Pipeline

```yaml
# .github/workflows/ai-code-quality.yml
name: AI Code Quality Check
on: [pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Type Check
        run: npx tsc --noEmit

      - name: Lint
        run: npx eslint . --max-warnings 0

      - name: Security Audit
        run: npm audit --audit-level=moderate

      - name: Test
        run: npm test -- --coverage

      - name: Coverage Check
        run: |
          COVERAGE=$(npx coverage-summary | grep 'All files' | awk '{print $NF}')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage is below 80%: $COVERAGE"
            exit 1
          fi

      - name: License Check
        run: npx license-checker --failOn 'GPL'

      - name: Bundle Size
        run: npx size-limit
```

---

## 8. Anti-Patterns

### 8.1 Accepting AI Output Without Verification

```
Anti-pattern: Committing AI-generated code as-is

Problems:
  - Security vulnerabilities (SQL injection, etc.)
  - Use of deprecated APIs
  - Unhandled edge cases
  - Inclusion of code with license issues
  - Incorrect logic

Correct approach:
  - Treat AI-generated code as a "draft"
  - Always review it yourself before adopting
  - Write tests to verify behavior
  - Run security scans (npm audit, Snyk)
  - Enforce automated quality checks in CI
```

### 8.2 Writing Prompts Without Context

```
Anti-pattern:
  "Write a function that sorts"

Problems:
  - Language is unclear
  - What to sort is unclear
  - Performance requirements are unclear
  - Error handling policy is unclear

Correct approach:
  "Write a TypeScript function that sorts an array of user objects
   in descending order by last login time.
   Return an empty array if the array is empty.
   Type: takes User[] and returns User[].
   User type is { id: string, name: string, lastLoginAt: Date }."
```

### 8.3 Over-relying on AI Without Learning

```
Anti-pattern: Continuously copy-pasting AI output without understanding it

Problems:
  - Lack of foundational understanding
  - Unable to work in environments without AI
  - Debugging skills do not develop
  - Unable to spot problems in code reviews

Correct approach:
  - Read and understand AI output before adopting it
  - Ask AI to explain "why it was written this way"
  - Learn fundamental algorithms and data structures yourself
  - Practice improving and optimizing AI-generated code
  - Occasionally try writing code without AI
```

### 8.4 Trying to Solve Everything in One Prompt

```
Anti-pattern:
  "Build all the product management features for an e-commerce site"

Problems:
  - Context is too large, AI gets confused
  - Quality of generated code degrades
  - Review becomes difficult

Correct approach:
  1. "Create the type definitions for products"
  2. "Create the CRUD API endpoints for products"
  3. "Create the product list component"
  4. "Add product search and filter functionality"
  5. "Write tests for each feature"
  → Divide into small tasks and proceed incrementally
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement error handling appropriately
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
        assert False, "Exception should be raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced pattern
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

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

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
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Incremental verification**: Validate hypotheses using log output or a debugger
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
    """Decorator that logs function input and output"""
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
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connection count**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Solution |
|-------------|----------------|---------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Here is a summary of the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|-----------|-------------------|--------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flow              │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to 2               │
│                                                 │
│  2. What is the deployment frequency?            │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily / multiple times → Go to 3           │
│                                                 │
│  3. How independent are the teams?               │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs. Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies allows using the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- Higher abstraction improves reusability but can make debugging more difficult
- Lower abstraction is intuitive but tends to lead to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

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
        """Describe the decision made"""
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
- Focus on the minimum viable features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons Learned:**
- Don't over-engineer (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally replacing a system that has been in operation for 10+ years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if no existing tests exist
- Coexist old and new systems with an API gateway
- Migrate data in phases

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development in a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Use Domain-Driven Design to clarify boundaries
- Assign ownership per team
- Manage shared libraries with Inner Source approach
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

**Situation:** A system requiring millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | Use Case |
|--------------------|---------|--------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processes |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Team Development

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Are there any performance impacts?
- [ ] Are there any security issues?
- [ ] Has documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Audience | Effect |
|--------|-----------|----------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (Design record) | Per decision | Future members | Transparency of decisions |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Key design work | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │and  │imme-│
    │addr │diat-│
    │ess  │ely  │
    ├─────┼─────┤
    │Log  │Next │
    │only │Spri-│
    │     │nt   │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```

---

## Migration Guide

### Notes on Version Upgrades

| Version | Main Changes | Migration Work | Affected Scope |
|---------|-------------|----------------|---------------|
| v1.x → v2.x | API redesign | Endpoint changes | All clients |
| v2.x → v3.x | Authentication method change | Token format update | Auth-related |
| v3.x → v4.x | Data model change | Run migration script | DB-related |

### Steps for Incremental Migration

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
        """Roll back migrations"""
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

1. **Data backup**: Take a full backup before migration
2. **Validation in test environment**: Pre-validate in an environment equivalent to production
3. **Incremental rollout**: Deploy incrementally with canary releases
4. **Enhanced monitoring**: Shorten metric monitoring intervals during migration
5. **Clarify decision criteria**: Define rollback criteria in advance
---

## 9. FAQ

### Q1: Should I subscribe to both Copilot and Cursor?

**A:** Generally, one is sufficient. If you don't want to change your VS Code-based workflow, choose Copilot. If you want an AI-first experience, choose Cursor. Since Cursor is a fork of VS Code, you can use the Copilot extension alongside it, but completions may conflict. If budget allows, the Claude Code CLI + Copilot combination offers the widest coverage. Cursor's Composer feature is strong for multi-file editing, while Claude Code's agent feature excels at autonomous task execution.

### Q2: Who owns the copyright for AI-generated code?

**A:** As of 2026, there are many legal grey areas, but the terms of major tools state that the rights to generated code belong to the user. However, be cautious of output that closely resembles existing OSS code. The `duplicationDetection: "block"` setting in Copilot Business/Enterprise can filter suggestions similar to public code. Legal review is recommended for enterprise use.

### Q3: What should I write in CLAUDE.md for Claude Code?

**A:** Include the following elements:
1. Project overview (tech stack, architecture)
2. Coding conventions (naming rules, patterns)
3. Explanation of directory structure
4. Commonly used commands (build, test, deploy)
5. What NOT to do (prohibited patterns)
6. Description of environment variables (not the values)
7. Overview of DB schema

Since this is information shared with the team, it should be committed to the repository. Never include sensitive information (API keys, etc.).

### Q4: How can I reduce AI tool costs?

**A:** The following strategies are effective:
1. Write thorough CLAUDE.md / .cursorrules to reduce the number of retries
2. Divide into small tasks to reliably get results from each prompt
3. Use Copilot (flat rate) for inline completion and Claude Code (pay-as-you-go) for complex tasks
4. Use the `/compact` command to compress context and reduce token consumption
5. Exclude unnecessary files with .aiignore to prevent context pollution

### Q5: What is MCP? Should I adopt it?

**A:** MCP (Model Context Protocol) is an open protocol for AI models to integrate with external tools and data sources. Developed by Anthropic and adopted by GitHub, Cursor, Windsurf, and others. It allows AI to directly reference databases, GitHub Issues, documentation search, and more. It significantly advances development workflow automation, so team adoption is highly recommended. However, write permissions to databases carry security risks, so it is safer to start with read-only access.

---


## FAQ

### Q1: What is the most important point when learning this topic?

The most important thing is to gain practical experience. Understanding deepens not just through theory but by actually writing code and confirming how it works.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Tool | Main Use | Adoption Cost | Effect |
|------|---------|--------------|--------|
| GitHub Copilot | Inline completion & chat | $10-39/month | 2-3x code writing speed |
| Claude Code | Agent & complex tasks | Pay-as-you-go | Refactoring & review automation |
| Cursor | AI-integrated editor | $20/month | Cross-file editing |
| CLAUDE.md | Sharing project context | Free | Improves AI output quality |
| .cursorrules | Cursor context configuration | Free | Improves Cursor output quality |
| MCP | Tool integration protocol | Free | Expands AI action scope |
| Aider | CLI agent | Free (API costs) | Excellent Git integration |

---

## Next Guides to Read

- [00-vscode-setup.md](./00-vscode-setup.md) -- Detailed VS Code configuration
- [../01-runtime-and-package/03-linter-formatter.md](../01-runtime-and-package/03-linter-formatter.md) -- Quality checks for AI-generated code
- [../03-team-setup/00-project-standards.md](../03-team-setup/00-project-standards.md) -- Setting team standards

---

## References

1. **GitHub Copilot Documentation** -- https://docs.github.com/en/copilot -- Official Copilot documentation covering setup to usage.
2. **Claude Code CLI** -- https://docs.anthropic.com/en/docs/claude-code -- Official Claude Code documentation.
3. **Cursor Documentation** -- https://docs.cursor.com -- Official documentation and configuration guide for the Cursor editor.
4. **Pragmatic AI-Assisted Development** -- https://martinfowler.com/articles/exploring-gen-ai.html -- Martin Fowler's practical insights on AI development tools.
5. **Model Context Protocol (MCP)** -- https://modelcontextprotocol.io/ -- Official MCP specification documentation.
6. **Aider** -- https://aider.chat/ -- Official Aider website. Git-integrated AI pair programming.
7. **AI Code Review Best Practices** -- https://github.blog/developer-skills/github/how-to-review-code-generated-by-ai/ -- GitHub's guide to reviewing AI-generated code.
8. **OWASP AI Security** -- https://owasp.org/www-project-ai-security-and-privacy-guide/ -- Security guidelines for AI usage.
