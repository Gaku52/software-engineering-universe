# Cursor / Windsurf ── AI IDEs, Context Management

> Compare the features, capabilities, and usage of next-generation AI IDEs "Cursor" and "Windsurf" that place AI at the core of the editor, and develop the criteria for selecting the optimal AI IDE for your project.

---

## What You Will Learn in This Chapter

1. **Design Philosophy of AI IDEs** ── Understand the fundamental differences between traditional IDEs and AI IDEs
2. **Detailed Features of Cursor and Windsurf** ── Grasp the operation methods, context management, and differentiating points of each tool
3. **Optimal AI IDE Selection** ── Learn the selection criteria based on project characteristics and team size
4. **Practical Usage Patterns** ── Master techniques to maximize the effectiveness of AI IDEs, from daily development to team operations


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Claude Code ── CLI, Agents, MCP](./01-claude-code.md)

---

## 1. Design Philosophy of AI IDEs

### 1.1 Differences Between Traditional IDEs and AI IDEs

```
Traditional IDE (VSCode, etc.)          AI IDE (Cursor/Windsurf)
┌─────────────────────┐              ┌─────────────────────┐
│  Editor             │              │  Editor             │
│  ┌───────────────┐  │              │  ┌───────────────┐  │
│  │ Syntax        │  │              │  │ AI Completion  │  │
│  │ Highlighting  │  │              │  │ Engine         │  │
│  ├───────────────┤  │              │  │ (Native)       │  │
│  │ LSP          │  │              │  ├───────────────┤  │
│  │ (Language     │  │              │  │ Context       │  │
│  │  Server)      │  │              │  │ Indexer       │  │
│  ├───────────────┤  │              │  ├───────────────┤  │
│  │ Extensions   │  │              │  │ AI Chat       │  │
│  │ (Plugins)    │  │  AI is       │  │ (Built-in)    │  │
│  │  ┌─────────┐ │  │  an add-on   │  ├───────────────┤  │
│  │  │Copilot  │ │  │  ─────►     │  │ Agent Mode    │  │
│  │  │(add-on) │ │  │              │  │ (Autonomous   │  │
│  │  └─────────┘ │  │              │  │  Execution)   │  │
│  └───────────────┘  │              │  ├───────────────┤  │
│                     │              │  │ Multi-file    │  │
│                     │              │  │ Simultaneous  │  │
│                     │              │  │ Editing       │  │
│                     │              │  └───────────────┘  │
└─────────────────────┘              └─────────────────────┘
```

### 1.2 Context Management in AI IDEs

```
┌──────────────────────────────────────────────────┐
│          AI IDE Context Hierarchy                 │
│                                                  │
│  Level 1: Cursor Position                        │
│  ┌──────────────────────────────────┐            │
│  │ Dozens of lines before/after     │            │
│  │ the current line                 │            │
│  │ → Used for inline completion     │            │
│  └──────────────────────────────────┘            │
│                                                  │
│  Level 2: File                                   │
│  ┌──────────────────────────────────┐            │
│  │ Entire open file                 │            │
│  │ → Function completion,           │            │
│  │   refactoring                    │            │
│  └──────────────────────────────────┘            │
│                                                  │
│  Level 3: Project                                │
│  ┌──────────────────────────────────┐            │
│  │ Index of entire codebase         │            │
│  │ → Codebase search,              │            │
│  │   reference via @ notation       │            │
│  └──────────────────────────────────┘            │
│                                                  │
│  Level 4: External Knowledge                     │
│  ┌──────────────────────────────────┐            │
│  │ Docs, Web search, MCP connection │            │
│  │ → Latest API documentation, etc. │            │
│  └──────────────────────────────────┘            │
└──────────────────────────────────────────────────┘
```

### 1.3 Architecture Comparison of AI IDEs

```
┌──────────────────────────────────────────────────────┐
│                 AI IDE Architecture                    │
│                                                      │
│  Cursor                          Windsurf             │
│  ┌────────────────────┐         ┌─────────────────┐  │
│  │ VSCode Fork        │         │ VSCode Fork     │  │
│  │ ┌────────────────┐ │         │ ┌─────────────┐ │  │
│  │ │ Copilot++      │ │         │ │Supercomplete│ │  │
│  │ │ (Tab            │ │         │ │(Block       │ │  │
│  │ │  Completion)    │ │         │ │ Completion) │ │  │
│  │ ├────────────────┤ │         │ ├─────────────┤ │  │
│  │ │ Chat (Cmd+L)   │ │         │ │ Cascade     │ │  │
│  │ │ Interactive     │ │         │ │ (AI         │ │  │
│  │ │ Chat           │ │         │ │  Assistant) │ │  │
│  │ ├────────────────┤ │         │ ├─────────────┤ │  │
│  │ │ Composer       │ │         │ │ Flows       │ │  │
│  │ │ (Cmd+I)        │ │         │ │ (Reusable   │ │  │
│  │ │ Multi-file     │ │         │ │  Workflows) │ │  │
│  │ ├────────────────┤ │         │ ├─────────────┤ │  │
│  │ │ @ Notation    │ │         │ │ Automatic   │ │  │
│  │ │ Context       │ │         │ │ Indexing    │ │  │
│  │ │ Specification │ │         │ ├─────────────┤ │  │
│  │ ├────────────────┤ │         │ │ Agent Mode  │ │  │
│  │ │ Agent Mode     │ │         │ │ Autonomous  │ │  │
│  │ │ Autonomous     │ │         │ │ Task        │ │  │
│  │ │ Task Execution │ │         │ │ Execution   │ │  │
│  │ └────────────────┘ │         │ └─────────────┘ │  │
│  └────────────────────┘         └─────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 2. Cursor Details

### Code Example 1: Basic Cursor Operations

```
# Cursor Keyboard Shortcuts

## Code Generation
Cmd+K          : Inline code generation (transform selected range)
Cmd+L          : Open chat panel
Cmd+Shift+L    : Add selected code to chat
Cmd+I          : Composer (multi-file editing)

## Adding Context (@ Notation)
@file          : Add a specific file to context
@folder        : Add all files in a folder
@code          : Add codebase search results
@web           : Add web search results
@docs          : Add documentation search results
@git           : Add Git diffs/history

## Agent Mode
Cmd+.          : Toggle Agent Mode
                 → Autonomously executes file creation, commands, and tests
```

### Code Example 2: Setting Project Conventions with .cursorrules

```markdown
# .cursorrules

## Tech Stack
- Next.js 14 (App Router)
- TypeScript 5.4 (strict mode)
- Tailwind CSS 3.4
- Prisma (ORM)
- tRPC (API)

## Coding Conventions
- Write components with function declarations (no arrow functions)
- Use only Tailwind for CSS (no CSS Modules)
- Use Zustand for state management
- Use React Hook Form + Zod for forms
- Use TanStack Query for data fetching

## File Naming
- Components: PascalCase (UserProfile.tsx)
- Utilities: camelCase (formatDate.ts)
- Constants: SCREAMING_SNAKE_CASE
- Tests: *.test.ts / *.test.tsx

## Prohibited
- Usage of the any type
- Leaving console.log in production code
- Data fetching inside useEffect
- Components exceeding 200 lines
```

### Code Example 3: Using Cursor Composer

```typescript
// Open Composer with Cmd+I and instruct multi-file editing

// Prompt example:
// "Create a user profile page.
//  Generate the following files:
//  1. app/profile/page.tsx - Profile display page
//  2. components/ProfileCard.tsx - Profile card
//  3. hooks/useProfile.ts - Profile fetching hook
//  4. lib/api/profile.ts - API calls
//  5. __tests__/ProfileCard.test.tsx - Tests"

// → Composer generates/edits 5 files simultaneously
// → Preview diffs for each file
// → Choose Accept / Reject
```

### Code Example 4: Advanced Usage of Cursor @ Notation

```
# Power User Examples of @ Notation

## Discover Related Code via Codebase Search
@codebase "Search for all authentication-related functions
          and check for session management vulnerabilities"

## Reference Specific Files Precisely
@file src/types/user.ts
@file src/schemas/user.schema.ts
"Check the consistency between UserType and UserSchema.
 Fix any inconsistencies"

## Include Git Diffs in Context
@git diff main
"Review changes from the main branch.
 Point out any changes that impact performance"

## Implement Using Official Documentation
@docs Next.js App Router
"Implement form submission using Server Actions.
 Comply with the latest Next.js App Router specifications"

## Get Latest Information via Web Search
@web "React 19 use hook"
"Refactor to use React 19's use hook
 for data fetching"

## Reference an Entire Folder
@folder src/components/ui/
"Add a Tooltip component to this UI component library.
 Match the style of existing components"
```

### Code Example 5: Cursor Agent Mode in Practice

```typescript
// Development Flow with Agent Mode
// Enable Agent Mode with Cmd+.

// === Prompt Example 1: Feature Implementation ===
// "Implement a notification system:
//  1. Create a NotificationService class
//  2. Real-time notifications via WebSocket connection
//  3. Notification persistence (save to DB)
//  4. Unread count API
//  5. Include tests
//  6. Run tests and confirm they all pass"

// What Agent Mode executes:
// Step 1: Investigate related files
//   → Understand project structure
//   → Check existing service patterns
//
// Step 2: Generate/edit files
//   → src/services/notification.ts
//   → src/api/notifications/route.ts
//   → src/hooks/useNotifications.ts
//   → prisma/schema.prisma (add schema)
//
// Step 3: Run tests
//   → npm test -- --watch=false
//   → Auto-fix failing tests
//
// Step 4: Results report
//   → List of changed files
//   → Test results summary

// === Prompt Example 2: Bug Fix ===
// "A 500 error occurs when users upload a profile image.
//  Investigate the cause and fix it.
//  1. Check error logs
//  2. Investigate related code
//  3. Identify the cause
//  4. Implement the fix
//  5. Add tests and confirm"
```

### Code Example 6: Optimizing Cursor Settings

```jsonc
// .vscode/settings.json (also works in Cursor)
{
  // AI completion settings
  "cursor.cpp.enablePartialAccepts": true,  // Accept partial completions
  "cursor.chat.defaultModel": "claude-sonnet-4-20250514",

  // Context settings
  "cursor.chat.alwaysSearchWeb": false,      // Search web only when needed
  "cursor.general.enableShadowWorkspace": true, // Background indexing

  // Completion behavior
  "editor.inlineSuggest.enabled": true,
  "editor.suggest.preview": true,

  // Exclude AI-related files (performance optimization)
  "cursor.general.ignoredPaths": [
    "node_modules",
    ".next",
    "dist",
    "coverage",
    "*.min.js",
    "*.bundle.js"
  ]
}
```

---

## 3. Windsurf Details

### Code Example 7: Windsurf (Cascade) Features

```
# Windsurf's Distinctive Features

## Cascade (AI Assistant)
- Automatically indexes the entire codebase
- File operations and code generation via natural language
- Automatically executes multi-step changes
- Change preview and approval workflow

## Flows
- Save AI interactions as "Flows"
- Re-run past Flows
- Share Flows across the team

## Supercomplete
- More advanced completion than Copilot
- Block-level completion instead of line-level
- Learns and adapts from recent edit patterns
```

### Code Example 8: Windsurf Cascade in Practice

```typescript
// Refactoring Example with Windsurf Cascade

// Prompt: "Split this file into Clean Architecture"

// Before: Everything mixed in a single file
// src/features/todo.ts (200 lines)

// After: Cascade automatically splits
// src/features/todo/
// ├── domain/
// │   ├── Todo.ts          (Entity)
// │   └── TodoRepository.ts (Repository Interface)
// ├── application/
// │   ├── CreateTodoUseCase.ts
// │   ├── CompleteTodoUseCase.ts
// │   └── ListTodosUseCase.ts
// ├── infrastructure/
// │   └── PrismaTodoRepository.ts
// └── presentation/
//     ├── TodoController.ts
//     └── todoRouter.ts

// Cascade also automatically updates all existing import paths
```

### Code Example 9: Using Windsurf Flows

```
# Practical Usage of Windsurf Flows

## Flow 1: Component Generation Template
Save Name: "React Component Generator"
Save as a reusable Flow:

Prompt:
"Generate a React component with the following pattern:
1. Component body (function declaration)
2. Props type definition
3. Storybook file
4. Test file
5. CSS module

Component name: {name}
Props: {props}
Directory: src/components/{name}/"

## Flow 2: API Endpoint Addition
Save Name: "API Endpoint Scaffold"
Prompt:
"Add a new API endpoint:
1. Route handler (app/api/{resource}/route.ts)
2. Validation schema (schemas/{resource}.ts)
3. Service class (services/{resource}Service.ts)
4. Prisma model addition (prisma/schema.prisma)
5. API test (__tests__/api/{resource}.test.ts)

Resource name: {resource}
CRUD: {operations}"

## Flow 3: Bug Fix Workflow
Save Name: "Bug Investigation"
Prompt:
"Investigate and fix the bug following these steps:
1. Identify related code from the error message
2. Analyze the cause
3. Implement the fix
4. Add regression tests
5. Output a summary of changes

Error: {error_description}"
```

### Code Example 10: Windsurf Supercomplete in Action

```typescript
// Supercomplete Behavior Example

// When the user starts typing, Supercomplete suggests block-level completions

// Input: "async function fetchUser"
// Supercomplete suggestion (block-level):
async function fetchUserById(userId: string): Promise<User | null> {
  try {
    const response = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
      },
    });

    if (!response) {
      return null;
    }

    return mapToUser(response);
  } catch (error) {
    logger.error('Failed to fetch user', { userId, error });
    throw new DatabaseError('User fetch failed', { cause: error });
  }
}

// Features:
// - Suggests entire functions, not just individual lines
// - Learns from existing project patterns (prisma, logger, error types)
// - Includes try-catch patterns and error handling
// - Follows patterns from recent edits (e.g., another fetch function)
```

---

## 4. Feature Comparison

### 4.1 Cursor vs Windsurf vs Traditional IDE+Copilot

| Feature | Cursor | Windsurf | VSCode+Copilot |
|---------|--------|----------|----------------|
| Inline completion | Tab (high quality) | Supercomplete | Copilot |
| Chat | Cmd+L | Cascade | Copilot Chat |
| Multi-file editing | Composer | Cascade | Not supported |
| Agent Mode | Yes | Yes | Limited |
| @ notation context | Rich | Basic | Limited |
| Codebase search | @codebase | Automatic | Not supported |
| Model selection | Claude/GPT/etc. | Claude/GPT | GPT only |
| Pricing | $20/month (Pro) | $15/month (Pro) | $10/month |
| Base editor | VSCode fork | VSCode fork | VSCode itself |
| Extension compatibility | Nearly full | Nearly full | Full |
| Offline | No | No | Copilot unavailable |
| Workflow saving | No | Flows | No |
| Custom Docs | @docs | Limited | No |
| Project conventions | .cursorrules | Cascade settings | Extension-dependent |

### 4.2 Recommendations by Use Case

| Use Case | Recommended Tool | Reason |
|----------|-----------------|--------|
| Frontend development | Cursor | Powerful multi-file generation with Composer |
| Backend API | Claude Code | Efficient test-run-fix loop via CLI |
| Startup | Windsurf | High functionality at low cost |
| Enterprise | VSCode+Copilot | Security and compliance support |
| Data science | Cursor | Notebook support + library reference via @docs |
| Infrastructure/DevOps | Claude Code | Excels at Bash execution + config file operations |
| Mobile development | Cursor | Good React Native/Flutter support |
| OSS development | Windsurf | Share contribution guides via Flows |

### 4.3 Detailed Feature Comparison Matrix

```
┌──────────────────────────────────────────────────────┐
│            Detailed Feature Comparison Matrix          │
│                                                      │
│  ★★★ = Excellent  ★★☆ = Good  ★☆☆ = Basic           │
│                                                      │
│  Feature             Cursor    Windsurf    VSCode    │
│  ──────────────────  ────────  ──────────  ──────── │
│  Inline completion    ★★★      ★★★        ★★☆       │
│  Chat accuracy        ★★★      ★★☆        ★★☆       │
│  Multi-file           ★★★      ★★★        ★☆☆       │
│  Codebase awareness   ★★★      ★★★        ★☆☆       │
│  @ notation flex.     ★★★      ★★☆        ★☆☆       │
│  Agent Mode           ★★★      ★★★        ★★☆       │
│  Startup speed        ★★☆      ★★★        ★★★       │
│  Memory usage         ★★☆      ★★★        ★★★       │
│  Extension compat.    ★★★      ★★☆        ★★★       │
│  Documentation        ★★★      ★★☆        ★★★       │
│  Cost performance     ★★☆      ★★★        ★★★       │
│  Learning curve       ★★☆      ★★★        ★★★       │
│  Enterprise           ★★☆      ★☆☆        ★★★       │
│  Community            ★★★      ★★☆        ★★★       │
└──────────────────────────────────────────────────────┘
```

---

## 5. Best Practices for Context Management

```
┌────────────────────────────────────────────────────┐
│        Best Practices for Context Management       │
│                                                    │
│  1. Include only necessary files in context         │
│     ┌───────────────────────┐                     │
│     │ @file schema.prisma  │ ← DB schema          │
│     │ @file types.ts       │ ← Type definitions   │
│     │ @folder api/         │ ← Related APIs       │
│     └───────────────────────┘                     │
│     ❌ @codebase (entire codebase is too heavy)    │
│                                                    │
│  2. Make implicit knowledge explicit via rule files │
│     Define conventions in .cursorrules / CLAUDE.md  │
│                                                    │
│  3. Add context incrementally                      │
│     Start with the minimum → add as needed         │
│     → Balance AI response speed and accuracy       │
│                                                    │
│  4. Leverage Docs indexing                         │
│     @docs Next.js → Reference official docs        │
│     → Generate accurate usage of latest APIs       │
└────────────────────────────────────────────────────┘
```

### 5.1 Detailed Context Management Strategies

```
┌────────────────────────────────────────────────────┐
│        Context Management ── Practical Strategies   │
│                                                    │
│  Strategy 1: Incremental Context Expansion          │
│  ┌──────────────────────────────────────┐         │
│  │ Level 1: Current file only (auto)    │         │
│  │    ↓ AI response is insufficient     │         │
│  │ Level 2: Add related files via @file │         │
│  │    ↓ Still insufficient              │         │
│  │ Level 3: Add related modules         │         │
│  │           via @folder                │         │
│  │    ↓ Still insufficient              │         │
│  │ Level 4: Search entire codebase      │         │
│  │           via @codebase              │         │
│  └──────────────────────────────────────┘         │
│                                                    │
│  Strategy 2: Task-Specific Context Design           │
│  ┌──────────────────────────────────────┐         │
│  │ Bug fix:                             │         │
│  │   @file file with the error          │         │
│  │   @file test file                    │         │
│  │   @git log (recent changes)          │         │
│  │                                      │         │
│  │ New feature:                         │         │
│  │   @file type definition files        │         │
│  │   @folder directory of similar       │         │
│  │          features                    │         │
│  │   @docs framework official docs      │         │
│  │                                      │         │
│  │ Refactoring:                         │         │
│  │   @file target file                  │         │
│  │   @codebase dependent code           │         │
│  │   @file tests in general             │         │
│  └──────────────────────────────────────┘         │
│                                                    │
│  Strategy 3: Index Optimization                     │
│  ┌──────────────────────────────────────┐         │
│  │ Exclude from index via .cursorignore:│         │
│  │   node_modules/                      │         │
│  │   dist/                              │         │
│  │   .next/                             │         │
│  │   coverage/                          │         │
│  │   *.min.js                           │         │
│  │   vendor/                            │         │
│  └──────────────────────────────────────┘         │
└────────────────────────────────────────────────────┘
```

---

## 6. Team Operations for AI IDE Adoption

### 6.1 Team Adoption Roadmap

```
┌──────────────────────────────────────────────────────┐
│          AI IDE Team Adoption Roadmap                  │
│                                                      │
│  Phase 1: Pilot (1-2 weeks)                          │
│  ┌──────────────────────────────────────┐            │
│  │ - Trial adoption by 2-3 tech leads   │            │
│  │ - Create the first version of        │            │
│  │   .cursorrules                       │            │
│  │ - Define criteria for measuring      │            │
│  │   effectiveness                      │            │
│  │ - Establish security settings        │            │
│  └──────────────────────────────────────┘            │
│                                                      │
│  Phase 2: Team Rollout (2-4 weeks)                   │
│  ┌──────────────────────────────────────┐            │
│  │ - Distribute licenses to all team    │            │
│  │   members                            │            │
│  │ - Operations training (2-hour        │            │
│  │   workshop)                          │            │
│  │ - Hands-on pair programming          │            │
│  │   (senior + junior)                  │            │
│  │ - Team review of .cursorrules        │            │
│  └──────────────────────────────────────┘            │
│                                                      │
│  Phase 3: Optimization (Ongoing)                     │
│  ┌──────────────────────────────────────┐            │
│  │ - Wiki for sharing effective prompts │            │
│  │ - Monthly retrospective (adoption    │            │
│  │   rate / cost analysis)              │            │
│  │ - Continuous improvement of          │            │
│  │   .cursorrules                       │            │
│  │ - Catch up on new features           │            │
│  └──────────────────────────────────────┘            │
└──────────────────────────────────────────────────────┘
```

### 6.2 Shared Team .cursorrules Template

```markdown
# .cursorrules - Shared Team Template

## Project Information
- Project name: {project_name}
- Repository: {repo_url}
- Primary tech stack: {tech_stack}

## Architecture
- Pattern: {architecture_pattern}
- Directory structure description:
  - src/domain/  : Business logic (no external dependencies)
  - src/app/     : Application layer
  - src/infra/   : Infrastructure (DB, external APIs)
  - src/ui/      : Presentation layer

## Coding Conventions
- Language version: {language_version}
- Linter: {linter_config}
- Formatter: {formatter_config}
- Test framework: {test_framework}
- Coverage target: {coverage_target}

## Quality Standards for AI-Generated Code
- Type safety: strict mode required, no any
- Error handling: Result type or explicit exceptions
- Tests: Always include tests for generated code
- Documentation: JSDoc/docstring required for public functions
- Naming: Follow the domain glossary (glossary.md)

## Prohibited
- Hard-coding sensitive information
- Leaving console.log/print in production code
- Business logic without tests
- Files exceeding 200 lines
- Introducing circular dependencies

## Review Notes
- AI-generated code must always be reviewed by a human
- Security-related code requires review by 2+ people
- Changes with performance impact require benchmarks
```

### 6.3 Effectiveness Measurement Metrics

```
┌────────────────────────────────────────────────────┐
│          AI IDE Effectiveness Metrics                │
│                                                    │
│  Quantitative Metrics:                              │
│  ┌──────────────────────────────────────┐          │
│  │ Metric                  Target       │          │
│  │ ─────────────────────── ──────────── │          │
│  │ PR Lead Time            30% reduction│          │
│  │ Code Review Time        20% reduction│          │
│  │ Bug Fix Time            40% reduction│          │
│  │ Test Coverage           10% increase │          │
│  │ New Feature Dev Time    25% reduction│          │
│  │ Documentation Updates   50% increase │          │
│  └──────────────────────────────────────┘          │
│                                                    │
│  Qualitative Metrics:                               │
│  ┌──────────────────────────────────────┐          │
│  │ - Developer satisfaction (monthly    │          │
│  │   survey)                            │          │
│  │ - Code readability/maintainability   │          │
│  │   assessment                         │          │
│  │ - Learning curve slope (new members) │          │
│  │ - AI proficiency level (5-point      │          │
│  │   scale)                             │          │
│  └──────────────────────────────────────┘          │
│                                                    │
│  Cost Metrics:                                      │
│  ┌──────────────────────────────────────┐          │
│  │ - License cost per developer         │          │
│  │ - Personnel cost savings from        │          │
│  │   productivity gains                 │          │
│  │ - ROI (Return on Investment)         │          │
│  │ - API usage (when combined with      │          │
│  │   Claude Code)                       │          │
│  └──────────────────────────────────────┘          │
└────────────────────────────────────────────────────┘
```

---

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

```
┌───────────────────────────────────────────────────────┐
│          AI IDE Troubleshooting                        │
│                                                       │
│  Issue 1: Low-quality completions                     │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause:                                       │      │
│  │   - .cursorrules not configured              │      │
│  │   - Index is outdated                        │      │
│  │   - Insufficient context                     │      │
│  │ Solution:                                    │      │
│  │   - Add project conventions to .cursorrules  │      │
│  │   - Run Cmd+Shift+P → "Reindex"             │      │
│  │   - Explicitly add related files via @file   │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Issue 2: AI uses outdated information                │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause:                                       │      │
│  │   - AI training data is outdated             │      │
│  │   - @docs index has not been updated         │      │
│  │ Solution:                                    │      │
│  │   - Search for latest information via @web   │      │
│  │   - Update @docs URL to latest version       │      │
│  │   - Specify "use the latest 2025 specs"      │      │
│  │     in the prompt                            │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Issue 3: Editor is slow                              │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause:                                       │      │
│  │   - Project is too large                     │      │
│  │   - Too many files in the index              │      │
│  │   - Extension conflicts                      │      │
│  │ Solution:                                    │      │
│  │   - Exclude unnecessary files via            │      │
│  │     .cursorignore                            │      │
│  │   - Consider CLI (Claude Code) for large     │      │
│  │     projects                                 │      │
│  │   - Resolve duplicate AI extensions          │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Issue 4: Composer changes differ from intent         │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause:                                       │      │
│  │   - Prompt is ambiguous                      │      │
│  │   - Diverges from existing code patterns     │      │
│  │ Solution:                                    │      │
│  │   - Include examples of existing code in     │      │
│  │     the prompt                               │      │
│  │   - Specify reference files via @file        │      │
│  │   - Make changes incrementally (don't change │      │
│  │     too much at once)                        │      │
│  │   - Reject and add specific feedback         │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Issue 5: AI response quality varies across team      │
│  ┌─────────────────────────────────────────────┐      │
│  │ Cause:                                       │      │
│  │   - .cursorrules quality is insufficient     │      │
│  │   - Prompt skill levels vary among members   │      │
│  │ Solution:                                    │      │
│  │   - Refine .cursorrules as a team            │      │
│  │   - Share prompt templates                   │      │
│  │   - Conduct pair programming for knowledge   │      │
│  │     sharing                                  │      │
│  └─────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────┘
```

### 7.2 AI IDE Security Settings Checklist

```markdown
# AI IDE Security Checklist

## 1. File Exclusion Settings
- [ ] Add sensitive files to .cursorignore
  - .env, .env.*, .env.local
  - *.pem, *.key, *.cert
  - credentials.json, secrets.yaml
  - .aws/, .ssh/

## 2. Privacy Settings
- [ ] Enable Privacy Mode (opt out of training data usage)
- [ ] Verify telemetry settings
- [ ] Comply with team security policies

## 3. Code Transmission Scope
- [ ] Understand which files are sent to the AI
- [ ] Define handling of sensitive code (auth, encryption)
- [ ] Handle files containing customer data appropriately

## 4. Extension Management
- [ ] Use only extensions from trusted sources
- [ ] Verify no duplicate AI extensions
- [ ] Disable unnecessary extensions

## 5. Network
- [ ] Confirm usage via VPN
- [ ] Verify proxy settings are correct
- [ ] Verify firewall rules
```

---

## 8. AI IDE Integration Patterns with Other Tools

### 8.1 Cursor + Claude Code: The Ultimate Combination

```
┌────────────────────────────────────────────────────┐
│        Cursor + Claude Code Combined Workflow       │
│                                                    │
│  Day-to-Day Coding (Cursor)                        │
│  ┌──────────────────────────────────────┐          │
│  │ - Write code rapidly with inline     │          │
│  │   completion                         │          │
│  │ - Local code transformation via Cmd+K│          │
│  │ - Resolve questions interactively    │          │
│  │   via Cmd+L                          │          │
│  └────────────────┬─────────────────────┘          │
│                   │                                │
│                   │ A complex task arises           │
│                   ▼                                │
│  Agent Tasks (Claude Code)                         │
│  ┌──────────────────────────────────────┐          │
│  │ - Multi-file refactoring             │          │
│  │ - Test generation → run → fix loop   │          │
│  │ - GitHub PR creation and review      │          │
│  │ - CI/CD pipeline integration         │          │
│  └────────────────┬─────────────────────┘          │
│                   │                                │
│                   │ Review results in Cursor        │
│                   ▼                                │
│  Review and Polish (Cursor)                        │
│  ┌──────────────────────────────────────┐          │
│  │ - Visually review Git diffs          │          │
│  │ - Make fine adjustments inline       │          │
│  │ - Additional test verification       │          │
│  └──────────────────────────────────────┘          │
└────────────────────────────────────────────────────┘
```

### 8.2 AI IDE + Traditional Tools Usage Matrix

| Task | AI IDE (Cursor/Windsurf) | Claude Code (CLI) | Traditional Tools |
|------|--------------------------|-------------------|-------------------|
| Writing code | Primary | - | Secondary |
| Debugging (in IDE) | Primary | - | Breakpoints |
| Debugging (log analysis) | Secondary | Primary | grep/awk |
| Writing tests | Primary | Secondary | Manual |
| Running tests | In IDE | In CLI | CI/CD |
| Refactoring | Small-scale | Large-scale | - |
| Creating PRs | - | Primary | GitHub UI |
| Code review | Diff view | Auto review | GitHub UI |
| Documentation | Draft generation | Auto maintenance | Manual editing |
| DB operations | - | Via MCP | DB client |
| Deployment | - | CI integration | CI/CD |

---

## Anti-Patterns

### Anti-Pattern 1: Context Overloading

```
❌ BAD: Include all files in context
   @codebase "Read all files then refactor"
   → Token limit exceeded, response delay, quality degradation

✅ GOOD: Select only related files
   @file src/services/auth.ts
   @file src/types/user.ts
   "Add OAuth support to this authentication service"
   → Fast and high-quality response
```

### Anti-Pattern 2: AI IDE Lock-in

```
❌ BAD: Over-relying on features specific to a particular AI IDE
   - Embedding business logic in .cursorrules
   - Development workflow dependent on Cursor-specific APIs
   → Significant cost when switching tools

✅ GOOD: Maintain standard configuration while leveraging AI IDEs
   - Manage settings via .editorconfig / ESLint / Prettier
   - Isolate AI-specific settings in a thin layer
   - Maintain the ability to develop in any editor
```

### Anti-Pattern 3: Blind Trust in AI IDEs

```
❌ BAD: Unconditionally accepting AI completions
   - Mashing the Tab key to accept all suggestions
   - Accepting Composer output without review
   → Bug introduction, security vulnerabilities, technical debt accumulation

✅ GOOD: Use critically while reviewing
   - Read completion content before accepting
   - Review diffs before accepting Composer changes
   - Pay special attention to changes affecting security/performance
   - Run tests and verify behavior before committing
```

### Anti-Pattern 4: Top-Down Forced AI IDE Adoption

```
❌ BAD: Management unilaterally mandating AI IDE usage
   - Simply issuing an order: "Everyone must use Cursor"
   - No training, no support
   - No effectiveness measurement
   → Resistance, inefficient usage, becoming a formality

✅ GOOD: Gradual adoption with support
   - Start with validation by a pilot team
   - Provide hands-on training and pair programming
   - Collect regular feedback
   - Effectiveness measurement and improvement cycle
   - Recommend rather than mandate (respect individual discretion)
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

```python
# Exercise 1: Basic Implementation Template
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

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced Patterns
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
# Exercise 3: Performance Optimization
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
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum viable feature set
- Automated tests only for the critical path
- Introduce monitoring early on

**Lessons Learned:**
- Don't strive for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually renovate a system that has been in production for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if existing tests are absent
- Use an API gateway to coexist old and new systems
- Perform data migration in stages

| Phase | Tasks | Estimated Duration | Risk |
|-------|-------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | Build CI/CD, test environment | 4-6 weeks | Low |
| 3. Migration Start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core Migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission legacy system | 2-4 weeks | Medium |

### Scenario 3: Development with Large Teams

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries via Inner Source
- Design API-first to minimize inter-team dependencies

```python
# API Contract Definition Between Teams
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

### Scenario 4: Performance-Critical Systems

**Situation:** A system that requires millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: In-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Impact | Implementation Cost | When to Apply |
|--------------------|--------|---------------------|---------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Med | High | When CPU-bound |

---

## Team Development Practices

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Naming conventions are consistent
- [ ] Error handling is appropriate
- [ ] Test coverage is sufficient
- [ ] No performance impact
- [ ] No security issues
- [ ] Documentation is updated

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Entire team | Horizontal knowledge spread |
| ADR (Architecture Decision Records) | As needed | Future members | Decision transparency |
| Retrospectives | Biweekly | Entire team | Continuous improvement |
| Mob programming | Monthly | Important designs | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        Impact High
          │
    ┌─────┼─────┐
    │ Plan│ Fix │
    │ and │ Im- │
    │ Sche│ me- │
    │ dule│ dia- │
    │     │ tely │
    ├─────┼─────┤
    │ Log │ Next │
    │ Only│Sprint│
    │     │      │
    └─────┼─────┘
          │
        Impact Low
    Frequency Low  Frequency High
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------------|------------|----------------|------------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor auth, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, principle of least privilege | Configuration scan |
| Insufficient logging | Medium | Structured logging, audit trails | Log analysis |

### Secure Coding Best Practices

```python
# Secure Coding Example
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
- [ ] Dependency vulnerability scanning is performed
- [ ] Error messages do not contain internal information

---

## Migration Guide

### Notes for Version Upgrades

| Version | Major Changes | Migration Tasks | Impact Scope |
|---------|--------------|-----------------|--------------|
| v1.x → v2.x | API design overhaul | Endpoint changes | All clients |
| v2.x → v3.x | Authentication method change | Token format update | Auth-related |
| v3.x → v4.x | Data model change | Run migration scripts | DB-related |

### Step-by-Step Migration Procedure

```python
# Migration Script Template
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Callable

logger = logging.getLogger(__name__)

class MigrationRunner:
    """Step-by-step migration execution engine"""

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
        """Execute migrations (upgrade)"""
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

Always prepare a rollback plan for migration tasks:

1. **Data Backup**: Take a full backup before migration
2. **Testing Environment Verification**: Validate in an environment equivalent to production
3. **Gradual Rollout**: Deploy incrementally via canary releases
4. **Enhanced Monitoring**: Shorten metric monitoring intervals during migration
5. **Clear Decision Criteria**: Pre-define criteria for deciding when to roll back
---

## FAQ

### Q1: Is Cursor compatible with VSCode extensions?

Since Cursor is a fork of VSCode, nearly all extensions work as-is. However, some AI extensions (such as Copilot) may conflict with Cursor's native features. Development tool extensions like ESLint, Prettier, and GitLens work without issues.

### Q2: Which is better for beginners, Windsurf or Cursor?

Windsurf's Cascade feature is intuitive to operate and provides natural AI interaction, making it suitable for beginners. Cursor is feature-rich with Composer and @ notation, but has a higher learning curve. Windsurf is also less expensive. A practical path is to start with Windsurf and migrate to Cursor when more advanced features are needed.

### Q3: How should AI IDE security risks be managed?

The main risk is that "code is sent to external servers." Countermeasures include: (1) exclude sensitive files via .cursorignore and settings, (2) enable Private Mode (opt out of training data usage), (3) choose tools with SOC2 certification, and (4) collaborate with the enterprise security team to establish policies.

### Q4: How should .cursorrules and CLAUDE.md be used differently?

.cursorrules is a project convention file that is automatically applied during Cursor interactions. CLAUDE.md is a configuration file referenced by Claude Code (CLI). Maintaining both is best. For shared content (coding conventions, architecture, etc.), designate one as the Source of Truth and reference it from the other.

### Q5: Is the Cursor Pro plan cost-effective for individual developers?

For individual developers working at a professional level, Cursor Pro ($20/month) is sufficiently cost-effective. In particular, multi-file generation via Composer and official documentation reference via @docs equate to a 1-2 hour daily productivity boost. At $20/month, you break even with less than 30 minutes of time savings at hourly rates.

### Q6: Can AI IDE development be combined with pair programming?

They are actually quite compatible. A pattern where the "navigator" uses the AI IDE to provide code suggestions and search documentation while the "driver" focuses on implementation is effective. The concept of "trio programming," treating AI as a "third pair," is also gaining traction.

### Q7: What are recommended learning resources for Cursor/Windsurf?

Official documentation for each tool is the most reliable. Cursor has comprehensive tutorials on its official YouTube channel. Windsurf's official blog and Changelog are useful. Both have active Q&A in their Discord communities. For practical learning, actively using Agent Mode on small side projects is effective.

---

## Summary

| Item | Key Points |
|------|------------|
| Essence of AI IDEs | Development environments with AI at the core, not as an add-on |
| Cursor's strengths | Composer, @ notation, flexible model selection |
| Windsurf's strengths | Cascade, Flows, low cost, intuitive operation |
| Context management | Selectively provide only the minimum necessary files |
| Selection criteria | Decide based on team size, budget, and development domain |
| Team adoption | Three phases: Pilot → Rollout → Optimization |
| Combined strategy | Cursor (daily coding) + Claude Code (complex tasks) |
| Cautions | Avoid lock-in, configure security, don't blindly trust AI |

---

## Recommended Next Reads

- [03-ai-coding-best-practices.md](./03-ai-coding-best-practices.md) ── Best Practices for AI Coding
- [../02-workflow/00-ai-testing.md](../02-workflow/00-ai-testing.md) ── Test Automation with AI IDEs
- [../03-team/00-ai-team-practices.md](../03-team/00-ai-team-practices.md) ── AI IDE Adoption for Teams

---

## References

1. Cursor, "Cursor Documentation," 2025. https://docs.cursor.com/
2. Codeium, "Windsurf Documentation," 2025. https://docs.codeium.com/windsurf
3. Pragmatic Engineer, "AI coding tools compared: Copilot vs Cursor vs Windsurf," 2025. https://blog.pragmaticengineer.com/
4. Cursor, "Cursor Changelog and Blog," 2025. https://changelog.cursor.com/
5. Codeium, "Windsurf Blog," 2025. https://codeium.com/blog
