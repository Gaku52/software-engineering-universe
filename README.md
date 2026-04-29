[日本語版はこちら](README.ja.md)

# Software Engineering Universe

<!-- PROGRESS_BADGES_START -->
![Skills](https://img.shields.io/badge/Skills-36-blue)
![Guides](https://img.shields.io/badge/Guides-901-success)
![Characters](https://img.shields.io/badge/Characters-47294K-informational)
<!-- PROGRESS_BADGES_END -->

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A systematic knowledge base covering all areas of software development.
From CS fundamentals to AI — 36 Skills / 952 guide files / 43M+ characters.

> **Status:** Phase 2 Quality Review Complete — Errors **0** / Broken Links **0** / Avg Score **90.3/100**
>
> Phase 1 Complete — All guides expanded to 40KB+ **952/952 (100%)**

> [!NOTE]
> Guide content is currently written in Japanese. English translation is planned.
> Claude Code and other AI tools can interpret and utilize the guides regardless of language.

## Overview

| Metric | Value |
|--------|-------|
| Skills | 36 |
| Guide Files | 952 |
| Total Characters | 43M+ |
| Categories | 8 |
| Phase 1 Progress | 952/952 (100%) |
| Phase 2 Progress | Complete (all 5 criteria met) |
| Avg Quality Score | 90.3/100 |

## Categories

### 01-cs-fundamentals — Computer Science Fundamentals (4 Skills / 131 files)

| Skill | Files | Topics |
|-------|-------|--------|
| computer-science-fundamentals | 55 | Hardware, data representation, theory of computation, programming paradigms |
| algorithm-and-data-structures | 24 | Algorithm design, data structures, complexity analysis |
| operating-system-guide | 20 | Process management, memory, file systems, kernel |
| programming-language-fundamentals | 32 | Type systems, compilers, language design, memory models |

### 02-programming — Programming Languages & Techniques (6 Skills / 118 files)

| Skill | Files | Topics |
|-------|-------|--------|
| object-oriented-programming | 20 | SOLID principles, design patterns, inheritance vs composition |
| async-and-error-handling | 18 | Asynchronous processing, Promises, error handling strategies |
| typescript-complete-guide | 25 | Type system, generics, utility types |
| go-practical-guide | 18 | Goroutines, channels, practical Go patterns |
| rust-systems-programming | 25 | Ownership, lifetimes, unsafe, concurrency |
| regex-and-text-processing | 12 | Regular expressions, text processing, parsers |

### 03-software-design — Software Design & Quality (3 Skills / 58 files)

| Skill | Files | Topics |
|-------|-------|--------|
| clean-code-principles | 20 | Naming conventions, function design, refactoring |
| design-patterns-guide | 20 | GoF patterns, architectural patterns |
| system-design-guide | 18 | Scalability, distributed systems, system design interviews |

### 04-web-and-network — Web & Networking (4 Skills / 75 files)

| Skill | Files | Topics |
|-------|-------|--------|
| network-fundamentals | 20 | TCP/IP, DNS, HTTP, TLS |
| browser-and-web-platform | 18 | Rendering, DOM, Web APIs |
| web-application-development | 20 | Full-stack development, SPA/SSR, state management |
| api-and-library-guide | 17 | REST/GraphQL design, library selection |

### 05-infrastructure — Infrastructure & DevOps (7 Skills / 130 files)

| Skill | Files | Topics |
|-------|-------|--------|
| linux-cli-mastery | 22 | Shell, commands, system administration |
| docker-container-guide | 22 | Containers, Docker Compose, multi-stage builds |
| aws-cloud-guide | 29 | EC2, Lambda, S3, IAM, VPC |
| devops-and-github-actions | 17 | CI/CD, GitHub Actions, automation |
| development-environment-setup | 14 | Editors, toolchains, dotfiles |
| windows-application-development | 14 | WPF, WinUI, Win32 API |
| version-control-and-jujutsu | 12 | Advanced Git, Jujutsu |

### 06-data-and-security — Data & Security (3 Skills / 63 files)

| Skill | Files | Topics |
|-------|-------|--------|
| sql-and-query-mastery | 19 | SQL optimization, indexing, transactions |
| security-fundamentals | 25 | Encryption, OWASP, vulnerability mitigation |
| authentication-and-authorization | 19 | OAuth2, JWT, RBAC |

### 07-ai — AI & LLM (8 Skills / 125 files)

| Skill | Files | Topics |
|-------|-------|--------|
| llm-and-ai-comparison | 20 | LLM model comparison, benchmarks |
| ai-analysis-guide | 16 | AI-powered data analysis, prompt design |
| ai-audio-generation | 14 | AI audio generation, music production |
| ai-visual-generation | 14 | AI image & video generation |
| ai-automation-and-monetization | 15 | AI automation, monetization strategies |
| ai-era-development-workflow | 15 | Development workflows in the AI era |
| ai-era-gadgets | 12 | AI gadgets, hardware |
| custom-ai-agents | 19 | AI agent design & implementation |

### 08-hobby — Hobby (1 Skill / 207 files)

| Skill | Files | Topics |
|-------|-------|--------|
| dj-skills-guide | 207 | DJ techniques, Rekordbox, Ableton Live, music production |

## Directory Structure

```
skills/
├── 01-cs-fundamentals/          # CS Fundamentals (4)
├── 02-programming/              # Programming (6)
├── 03-software-design/          # Design & Quality (3)
├── 04-web-and-network/          # Web & Networking (4)
├── 05-infrastructure/           # Infrastructure & DevOps (7)
├── 06-data-and-security/        # Data & Security (3)
├── 07-ai/                       # AI & LLM (8)
├── 08-hobby/                    # Hobby (1)
├── _original-skills/            # Pre-Phase 1 26 Skills (archived)
├── _legacy/                     # Legacy directory
├── _meta/                       # Project management (SESSION_ARCHIVE, etc.)
└── README.md
```

### Internal Skill Structure

```
skill-name/
├── SKILL.md       # Overview & table of contents
├── docs/          # Guide files (main content)
└── README.md      # Usage instructions
```

## Usage

### With Claude Code

```bash
git clone https://github.com/Gaku52/software-engineering-universe.git ~/.claude/skills
```

Claude Code automatically references `~/.claude/skills/`. Skill knowledge is applied during development.

### Manual Reference

```bash
# View a skill overview
cat ~/.claude/skills/02-programming/typescript-complete-guide/SKILL.md

# Read a specific guide
cat ~/.claude/skills/05-infrastructure/docker-container-guide/docs/multi-stage-build.md
```

## Phase 2: Quality Review & Improvement (Complete)

All 952 files reviewed and fixed based on quality standards (QUALITY_STANDARDS.md).

### Achievement Criteria

| Criterion | Target | Result |
|-----------|--------|--------|
| Errors | 0 | **0** (improved from 1,315) |
| P0/P1 Issues | All resolved | **All resolved** |
| Broken Links | 0 | **0** (improved from 1,859) |
| REVIEW_RESULTS | Complete | **JSON + Markdown output done** |
| Avg Score | 90/100+ | **90.3/100** |

### Results by Category

| Category | Files | Errors | Warnings | Status |
|----------|-------|--------|----------|--------|
| 01-cs-fundamentals | 135 | 0 | 180 | Pass |
| 02-programming | 124 | 0 | 283 | Pass |
| 03-software-design | 61 | 0 | 41 | Pass |
| 04-web-and-network | 79 | 0 | 160 | Pass |
| 05-infrastructure | 137 | 0 | 270 | Pass |
| 06-data-and-security | 66 | 0 | 93 | Pass |
| 07-ai | 133 | 0 | 242 | Pass |
| 08-hobby | 207 | 0 | 455 | Pass |

**What was done:** Added required sections, expanded content (11 template types), fixed broken links, improved detection patterns, implemented scoring system

## Premium Guides

This knowledge base is free and open source. For deeper, production-focused content, premium guides are available:

| Guide | Description | Link |
|-------|-------------|------|
| Building AI Agents with Claude SDK and MCP | 5,300+ words, 39 code examples, ProductionAgent class, MCP integration — based on shipping 7 agents to production | [Get the guide ($19)](https://gakuengineer.gumroad.com/l/kupfee) |

## License

MIT License - See [LICENSE](LICENSE)

---

**Last updated**: 2026-03-29
**Version**: 2.2.0 (Phase 2 Complete — Quality Review & Improvement)
