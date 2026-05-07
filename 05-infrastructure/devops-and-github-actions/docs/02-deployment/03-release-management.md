# Release Management

> Establish a predictable and safe release cycle through semantic versioning, automated CHANGELOG generation, and release process automation

## What You Will Learn

1. **Principles and practice of semantic versioning** — Criteria for MAJOR.MINOR.PATCH decisions and automated versioning
2. **Automated CHANGELOG and release note generation** — How to automatically generate documentation from Conventional Commits
3. **Release process automation** — CI/CD pipelines for GitHub Releases, npm publish, and tag management
4. **Release control with Feature Flags** — Separating feature deployment from release to achieve safe rollouts
5. **Release management in monorepos** — Version management that accounts for inter-package dependencies using Changesets


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Container Deployment](./02-container-deployment.md)

---

## 1. Overview of Release Management

```
┌────────────────────────────────────────────────────────┐
│              Release Management Pipeline                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Conventional    Semantic        CHANGELOG    GitHub   │
│  Commits         Versioning      Auto-gen     Release  │
│  ┌──────┐       ┌──────────┐     ┌────────┐  ┌──────┐│
│  │feat: │──────►│ v1.2.0   │────►│ Change │─►│ Tag  ││
│  │fix:  │       │ → v1.3.0 │     │ History│  │ +    ││
│  │BREAK│       │ or v2.0.0│     │ Gen    │  │ Note ││
│  └──────┘       └──────────┘     └────────┘  └──────┘│
│                                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │ Toolchain                                      │     │
│  │ commitlint → semantic-release → GitHub CLI   │     │
│  │ or                                            │     │
│  │ commitlint → changesets → npm publish         │     │
│  └──────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────┘
```

### Core Principles of Release Management

The most important aspects of release management are **predictability** and **reproducibility**. Design around the following principles.

1. **Version uniqueness**: Never reuse a version number. Do not change the contents of a released version
2. **Full automation**: Automate version determination, CHANGELOG generation, tag creation, and publishing entirely
3. **Traceability**: Always be able to track which commits are included in which version
4. **Rollback capability**: Maintain the ability to immediately revert to a previous version when problems occur

```
Release Process Maturity Model:

  Level 0: Fully Manual
  ┌──────────────────────────────────────────────┐
  │ - Manually update package.json               │
  │ - Manually write CHANGELOG                   │
  │ - Manually create Git tags                   │
  │ - Manually execute deployments               │
  │ Risk: High (frequent human errors)           │
  └──────────────────────────────────────────────┘

  Level 1: Semi-Automated
  ┌──────────────────────────────────────────────┐
  │ - Use Conventional Commits to clarify type   │
  │ - CHANGELOG is auto-generated                │
  │ - Git tags are created manually              │
  │ - Automated via deployment scripts           │
  │ Risk: Medium (forgotten tags, version mismatch)│
  └──────────────────────────────────────────────┘

  Level 2: Fully Automated (target state)
  ┌──────────────────────────────────────────────┐
  │ - Use Conventional Commits to clarify type   │
  │ - semantic-release auto-determines version   │
  │ - CHANGELOG, tags, GitHub Release auto-gen  │
  │ - CI/CD automates all the way to deployment  │
  │ Risk: Low (process standardized & automated) │
  └──────────────────────────────────────────────┘
```

---

## 2. Semantic Versioning (SemVer)

```
Semantic Versioning Structure:

  v 2 . 1 . 3 - beta.1 + build.456
    │   │   │     │          │
    │   │   │     │          └── Build metadata (not used in comparison)
    │   │   │     └───────────── Pre-release identifier
    │   │   └──────────────────── PATCH: backward-compatible bug fixes
    │   └─────────────────────── MINOR: backward-compatible feature additions
    └──────────────────────────── MAJOR: breaking changes

Version Decision Flowchart:

  What type of change is it?
     │
     ├─ API deletion/change (breaking) ──► MAJOR++  (1.2.3 → 2.0.0)
     │
     ├─ New feature (backward-compat) ───► MINOR++  (1.2.3 → 1.3.0)
     │
     └─ Bug fix (backward-compat) ──────► PATCH++  (1.2.3 → 1.2.4)
```

### 2.1 Detailed SemVer Rules

| Rule | Description | Example |
|--------|------|-----|
| Initial development | 0.x.y indicates an unstable API. Breaking changes allowed at any time | 0.1.0, 0.2.0 |
| MAJOR 0 | Under 0.y.z, MINOR is for breaking changes and PATCH is for bug fixes | 0.1.0 → 0.2.0 |
| PATCH | Bug fixes only. Internal implementation changes with no change to API contract | 1.2.3 → 1.2.4 |
| MINOR | Backward-compatible new features. Deprecating existing features also goes here | 1.2.3 → 1.3.0 |
| MAJOR | Changes that break backward compatibility. MINOR and PATCH reset to 0 | 1.2.3 → 2.0.0 |
| Pre-release | Append identifier with a hyphen. Lower precedence than the release version | 2.0.0-alpha.1 |
| Build metadata | Appended with a plus sign. Ignored in version comparisons | 2.0.0+build.123 |

### 2.2 Criteria for Identifying Breaking Changes

```typescript
// Concrete examples of breaking changes

// Case 1: Function signature change → MAJOR
// Before:
function getUser(id: string): User { ... }
// After:
function getUser(id: string, options: GetUserOptions): User { ... }
// Existing calling code breaks → MAJOR

// Case 2: Adding an optional parameter → MINOR
// Before:
function getUser(id: string): User { ... }
// After:
function getUser(id: string, options?: GetUserOptions): User { ... }
// No impact on existing calling code → MINOR

// Case 3: Response format change → MAJOR
// Before:
// { "name": "Alice", "email": "alice@example.com" }
// After:
// { "data": { "name": "Alice", "email": "alice@example.com" } }
// Existing parsers break → MAJOR

// Case 4: Adding a field to a response → MINOR
// Before:
// { "name": "Alice", "email": "alice@example.com" }
// After:
// { "name": "Alice", "email": "alice@example.com", "avatar": "url" }
// No impact on existing parsers (assuming unknown fields are ignored) → MINOR

// Case 5: Default value change → case-by-case
// Behavior changes but signature stays the same → usually MAJOR (violates user expectations)
```

---

## 3. Conventional Commits

### 3.1 Basic Format

```bash
# Conventional Commits format
# <type>[optional scope]: <description>
#
# [optional body]
#
# [optional footer(s)]

# Example: new feature
git commit -m "feat(auth): add social login

Implemented OAuth2 authentication via Google and GitHub.
No impact on existing email/password authentication.

Closes #123"

# Example: bug fix
git commit -m "fix(api): fix pagination offset calculation

Fixed an issue where 0-based indexes were being calculated as 1-based.

Fixes #456"

# Example: breaking change
git commit -m "feat(api)!: change response format to JSON:API spec

BREAKING CHANGE: API response structure has changed.
Responses are now wrapped in a data property.
Migration guide: docs/migration-v3.md"
```

### 3.2 Commit Type Reference and Usage

| Type | Version Impact | Description | Usage Examples |
|--------|--------------|------|--------|
| `feat` | MINOR | Adding a new feature | New API endpoint, UI component |
| `fix` | PATCH | Bug fix | Fix calculation logic, fix crash |
| `docs` | None | Documentation-only changes | README update, add JSDoc |
| `style` | None | Style changes with no effect on code meaning | Formatting, add semicolons |
| `refactor` | None | Code changes that are not a bug fix or new feature | Improve internal structure, rename variables |
| `perf` | PATCH | Performance improvements | Query optimization, introduce caching |
| `test` | None | Adding or modifying tests | Unit tests, E2E tests |
| `build` | None | Changes to build system or external dependencies | webpack config, npm package update |
| `ci` | None | CI configuration changes | GitHub Actions, CircleCI |
| `chore` | None | Other changes | .gitignore, config files |
| `revert` | Depends on original change | Reverting a commit | `revert: feat(auth): ...` |

### 3.3 commitlint Configuration

```json
// commitlint.config.js equivalent configuration
// inside package.json
{
  "commitlint": {
    "extends": ["@commitlint/config-conventional"],
    "rules": {
      "type-enum": [2, "always", [
        "feat", "fix", "docs", "style", "refactor",
        "perf", "test", "build", "ci", "chore", "revert"
      ]],
      "subject-max-length": [2, "always", 72],
      "body-max-line-length": [2, "always", 100]
    }
  }
}
```

```yaml
# .github/workflows/commitlint.yml — validate commit messages on PRs
name: Commitlint

on:
  pull_request:
    branches: [main]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install commitlint
        run: npm install --save-dev @commitlint/cli @commitlint/config-conventional

      - name: Validate PR commits
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
```

### 3.4 Local Validation with Husky + commitlint

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "husky": "^9.0.0"
  }
}
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit ${1}
```

```bash
# Interactive commit message creation (commitizen)
# Installation
npm install --save-dev commitizen cz-conventional-changelog

# Add to package.json
# "config": {
#   "commitizen": {
#     "path": "cz-conventional-changelog"
#   }
# }

# Usage
npx cz
# ? Select the type of change: feat
# ? What is the scope: auth
# ? Short description: add social login
# ? Longer description: Implemented OAuth2 authentication via Google and GitHub
# ? Breaking changes? No
# ? Issues closed: #123
```

---

## 4. Automated Releases with semantic-release

### 4.1 Basic Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Run tests
        run: npm test

      - name: Semantic Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release
```

### 4.2 semantic-release Configuration

```json
// .releaserc.json — semantic-release configuration
{
  "branches": [
    "main",
    { "name": "next", "prerelease": true },
    { "name": "beta", "prerelease": true }
  ],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      { "changelogFile": "CHANGELOG.md" }
    ],
    [
      "@semantic-release/npm",
      { "npmPublish": true }
    ],
    [
      "@semantic-release/github",
      {
        "assets": [
          { "path": "dist/**", "label": "Distribution" }
        ]
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ]
  ]
}
```

### 4.3 Configuring Custom Release Rules

```json
// .releaserc.json — custom commit-analyzer configuration
{
  "plugins": [
    [
      "@semantic-release/commit-analyzer",
      {
        "preset": "conventionalcommits",
        "releaseRules": [
          { "type": "feat", "release": "minor" },
          { "type": "fix", "release": "patch" },
          { "type": "perf", "release": "patch" },
          { "type": "refactor", "release": "patch" },
          { "type": "docs", "scope": "api", "release": "patch" },
          { "type": "build", "scope": "deps", "release": "patch" },
          { "breaking": true, "release": "major" }
        ],
        "parserOpts": {
          "noteKeywords": ["BREAKING CHANGE", "BREAKING CHANGES", "BREAKING"]
        }
      }
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        "preset": "conventionalcommits",
        "presetConfig": {
          "types": [
            { "type": "feat", "section": "Features" },
            { "type": "fix", "section": "Bug Fixes" },
            { "type": "perf", "section": "Performance" },
            { "type": "refactor", "section": "Refactoring", "hidden": false },
            { "type": "docs", "section": "Documentation", "hidden": false },
            { "type": "chore", "hidden": true },
            { "type": "style", "hidden": true },
            { "type": "test", "hidden": true }
          ]
        }
      }
    ]
  ]
}
```

### 4.4 Docker Image Release Integration

```yaml
# .github/workflows/release-with-docker.yml
name: Release with Docker

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write

    outputs:
      new-release-published: ${{ steps.semantic.outputs.new_release_published }}
      new-release-version: ${{ steps.semantic.outputs.new_release_version }}

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci && npm test

      - name: Semantic Release
        id: semantic
        uses: cycjimmy/semantic-release-action@v4
        with:
          semantic_version: 23
          extra_plugins: |
            @semantic-release/changelog
            @semantic-release/git
            conventional-changelog-conventionalcommits
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  docker:
    needs: release
    if: needs.release.outputs.new-release-published == 'true'
    runs-on: ubuntu-latest
    permissions:
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:v${{ needs.release.outputs.new-release-version }}
            ghcr.io/${{ github.repository }}:latest
```

---

## 5. Monorepo Release Management with Changesets

### 5.1 Basic Configuration

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

### 5.2 Example Changeset File

```markdown
<!-- .changeset/happy-dogs-dance.md (auto-generated template) -->
---
"@myorg/core": minor
"@myorg/utils": patch
---

Added avatar image upload feature to the user profile API.
Added image resize helper to the utils package.
```

### 5.3 Changesets Workflow

```
Changesets Workflow:

  Developer              CI                     npm
    │                    │                       │
    │── npx changeset    │                       │
    │   (describe change)│                       │
    │                    │                       │
    │── git push ──────► │                       │
    │                    │── Changeset Bot       │
    │                    │   creates PR          │
    │                    │   (Version Packages)  │
    │                    │                       │
    │── Merge PR ──────► │                       │
    │                    │── changeset version   │
    │                    │   (update versions)   │
    │                    │── changeset publish ──►│
    │                    │   (npm publish)        │
    │                    │── Create GitHub Release│
```

### 5.4 Changesets GitHub Actions Workflow

```yaml
# .github/workflows/changesets.yml
name: Changesets

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      packages: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: npm run release
          version: npm run version
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Releases
        if: steps.changesets.outputs.published == 'true'
        run: |
          PACKAGES='${{ steps.changesets.outputs.publishedPackages }}'
          echo "$PACKAGES" | jq -r '.[] | "\(.name)@\(.version)"' | while read pkg; do
            NAME=$(echo "$pkg" | cut -d@ -f1-2)
            VERSION=$(echo "$pkg" | rev | cut -d@ -f1 | rev)
            gh release create "$NAME@v$VERSION" \
              --title "$NAME v$VERSION" \
              --generate-notes
          done
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 5.5 Inter-Package Configuration in Monorepos

```json
// .changeset/config.json — advanced configuration
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "myorg/myapp" }
  ],
  "commit": false,
  "fixed": [
    ["@myorg/react-components", "@myorg/react-icons"]
  ],
  "linked": [
    ["@myorg/core", "@myorg/utils", "@myorg/types"]
  ],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@myorg/docs", "@myorg/examples"],
  "snapshot": {
    "useCalculatedVersion": true,
    "prereleaseTemplate": "{tag}-{datetime}-{commit}"
  }
}
```

```
Difference between linked and fixed:

  linked (synchronized):
  - If package A is minor → package B is also bumped to minor
  - Can create individual changesets
  - Version numbers are always the same

  fixed (locked):
  - Package group always has the same version number
  - A single changeset updates all packages
  - Suitable for package groups like React

  Example of linked:
  @myorg/core: 1.2.0  ←── same minor version
  @myorg/utils: 1.2.0 ←── same minor version

  Example of fixed:
  @myorg/react-components: 3.5.0 ←── exactly the same version
  @myorg/react-icons: 3.5.0      ←── exactly the same version
```

---

## 6. Google-Style Release Management with release-please

### 6.1 Basic release-please Configuration

```yaml
# .github/workflows/release-please.yml
name: Release Please

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}

    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          release-type: node
          token: ${{ secrets.GITHUB_TOKEN }}
```

```json
// release-please-config.json — monorepo configuration
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    "packages/core": {
      "release-type": "node",
      "component": "core",
      "changelog-path": "CHANGELOG.md"
    },
    "packages/cli": {
      "release-type": "node",
      "component": "cli",
      "changelog-path": "CHANGELOG.md"
    },
    "packages/server": {
      "release-type": "node",
      "component": "server",
      "changelog-path": "CHANGELOG.md"
    }
  },
  "plugins": [
    {
      "type": "node-workspace",
      "updateAllPackages": true
    },
    {
      "type": "linked-versions",
      "groupName": "myapp",
      "components": ["core", "cli", "server"]
    }
  ]
}
```

---

## 7. Automated CHANGELOG Generation

### 7.1 Auto-Generated Example

```markdown
<!-- CHANGELOG.md (auto-generated example) -->
# Changelog

## [2.1.0](https://github.com/myorg/myapp/compare/v2.0.0...v2.1.0) (2025-03-15)

### Features

* **auth:** add social login ([#123](https://github.com/myorg/myapp/issues/123)) ([a1b2c3d](https://github.com/myorg/myapp/commit/a1b2c3d))
* **dashboard:** implement real-time notifications ([#130](https://github.com/myorg/myapp/issues/130)) ([e4f5g6h](https://github.com/myorg/myapp/commit/e4f5g6h))

### Bug Fixes

* **api:** fix pagination offset calculation ([#456](https://github.com/myorg/myapp/issues/456)) ([i7j8k9l](https://github.com/myorg/myapp/commit/i7j8k9l))

### Performance Improvements

* **query:** resolve N+1 queries and improve response time by 40% ([#140](https://github.com/myorg/myapp/issues/140)) ([m0n1o2p](https://github.com/myorg/myapp/commit/m0n1o2p))

## [2.0.0](https://github.com/myorg/myapp/compare/v1.5.0...v2.0.0) (2025-02-01)

### BREAKING CHANGES

* **api:** change response format to JSON:API spec ([#100](https://github.com/myorg/myapp/issues/100))
```

### 7.2 Custom CHANGELOG Template

```javascript
// changelog-template.js — custom CHANGELOG template
const changelogConfig = {
  writerOpts: {
    transform: (commit, context) => {
      // commit type mapping
      const typeMap = {
        feat: 'Features',
        fix: 'Bug Fixes',
        perf: 'Performance Improvements',
        refactor: 'Refactoring',
        docs: 'Documentation',
        build: 'Build',
        ci: 'CI/CD',
      };

      if (typeMap[commit.type]) {
        commit.type = typeMap[commit.type];
      } else {
        return null; // do not display
      }

      // scope translation (optional)
      if (commit.scope) {
        commit.scope = commit.scope.replace(/auth/g, 'auth')
                                    .replace(/api/g, 'API')
                                    .replace(/ui/g, 'UI');
      }

      return commit;
    },
    groupBy: 'type',
    commitGroupsSort: (a, b) => {
      const order = ['Features', 'Bug Fixes', 'Performance Improvements', 'Refactoring'];
      return order.indexOf(a.title) - order.indexOf(b.title);
    },
  },
};

module.exports = changelogConfig;
```

---

## 8. Release Control with Feature Flags

### 8.1 Basic Feature Flag Implementation

```typescript
// feature-flags.ts — Feature Flag implementation
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number;
  allowedUsers?: string[];
  enabledEnvironments?: string[];
  description: string;
  createdAt: string;
  expiresAt?: string;
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor(private readonly config: FeatureFlag[]) {
    for (const flag of config) {
      this.flags.set(flag.name, flag);
    }
  }

  isEnabled(flagName: string, context?: {
    userId?: string;
    environment?: string;
  }): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    // globally disabled
    if (!flag.enabled) return false;

    // expiry check
    if (flag.expiresAt && new Date(flag.expiresAt) < new Date()) {
      return false;
    }

    // environment check
    if (flag.enabledEnvironments && context?.environment) {
      if (!flag.enabledEnvironments.includes(context.environment)) {
        return false;
      }
    }

    // user-specific access
    if (flag.allowedUsers && context?.userId) {
      if (flag.allowedUsers.includes(context.userId)) {
        return true;
      }
    }

    // rollout percentage control
    if (flag.rolloutPercentage !== undefined && context?.userId) {
      const hash = this.hashUserId(context.userId);
      return hash < flag.rolloutPercentage;
    }

    return flag.enabled;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }
}

// Usage example
const featureFlags = new FeatureFlagService([
  {
    name: 'new-checkout-flow',
    enabled: true,
    rolloutPercentage: 10,  // roll out to 10% of users
    enabledEnvironments: ['production', 'staging'],
    description: 'New checkout flow',
    createdAt: '2025-03-01',
    expiresAt: '2025-06-01',
  },
  {
    name: 'dark-mode',
    enabled: true,
    allowedUsers: ['user-001', 'user-002'],  // specific users only
    description: 'Dark mode support',
    createdAt: '2025-02-15',
  },
]);

// Usage in an API endpoint
app.get('/checkout', (req, res) => {
  if (featureFlags.isEnabled('new-checkout-flow', {
    userId: req.user.id,
    environment: process.env.NODE_ENV,
  })) {
    return renderNewCheckout(req, res);
  }
  return renderLegacyCheckout(req, res);
});
```

### 8.2 Feature Flag Tool Comparison

| Tool | Type | Pricing | Features |
|--------|------|------|------|
| LaunchDarkly | SaaS | Paid | Enterprise-grade, rich SDK support |
| Unleash | OSS/SaaS | Free tier available | Self-hostable, API-based |
| Flagsmith | OSS/SaaS | Free tier available | Self-hostable, segmentation features |
| ConfigCat | SaaS | Free tier available | Simple, config file-based |
| Environment Variables | Self-built | Free | Simplest option but no dynamic changes |
| Remote Config | Firebase | Free tier available | Suited for mobile apps |

### 8.3 Release Strategy Using Feature Flags

```
Separating Deployment and Release with Feature Flags:

  Traditional approach:
  ┌──────────────────────────────────────┐
  │ Deploy = Release                     │
  │ Deploy code → expose to all users    │
  │ Problem occurs → rollback (downtime) │
  └──────────────────────────────────────┘

  Feature Flag approach:
  ┌──────────────────────────────────────┐
  │ Deploy ≠ Release                     │
  │                                      │
  │ 1. Deploy code (Flag OFF)            │
  │    → No impact on users              │
  │                                      │
  │ 2. Flag ON for internal testers      │
  │    → Internal validation             │
  │                                      │
  │ 3. 10% rollout                       │
  │    → Monitor metrics                 │
  │                                      │
  │ 4. 50% → 100% rollout                │
  │    → Gradually expose to all users   │
  │                                      │
  │ Problem occurs → Flag OFF (instant)  │
  │    → No downtime                     │
  └──────────────────────────────────────┘
```

---

## 9. Hotfixes and Rollbacks

### 9.1 Hotfix Process

```bash
# Hotfix procedure

# 1. Create a hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/fix-payment-timeout

# 2. Commit the fix
git commit -m "fix(payment): extend timeout value to 30 seconds

Fixed an issue where the payment API timed out at 10 seconds,
causing frequent timeout errors under network delays.

Fixes #789"

# 3. Run tests
npm test

# 4. Merge into main (via PR)
gh pr create --base main --title "fix(payment): fix timeout value" --body "..."

# 5. semantic-release automatically bumps PATCH version
# e.g.: v1.2.3 → v1.2.4

# 6. Also merge into develop branch (for Git Flow)
git checkout develop
git merge main
git push origin develop
```

### 9.2 Rollback Strategy

```yaml
# .github/workflows/rollback.yml — emergency rollback
name: Emergency Rollback

on:
  workflow_dispatch:
    inputs:
      target-version:
        description: 'Version to rollback to (e.g., v1.2.3)'
        required: true
      reason:
        description: 'Reason for rollback'
        required: true
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - production
          - staging

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.target-version }}

      - name: Verify target version exists
        run: |
          if ! git tag | grep -q "^${{ inputs.target-version }}$"; then
            echo "Error: Tag ${{ inputs.target-version }} not found"
            exit 1
          fi

      - name: Deploy rollback version
        run: |
          echo "Rolling back to ${{ inputs.target-version }}"
          echo "Reason: ${{ inputs.reason }}"
          # Deploy command (adjust for your environment)
          # aws ecs update-service ...
          # argocd app set myapp --revision ...

      - name: Notify rollback
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "ROLLBACK executed: ${{ inputs.environment }} → ${{ inputs.target-version }}\nReason: ${{ inputs.reason }}\nBy: ${{ github.actor }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Create incident issue
        run: |
          gh issue create \
            --title "Rollback: ${{ inputs.environment }} → ${{ inputs.target-version }}" \
            --body "## Rollback Details
          - **Environment**: ${{ inputs.environment }}
          - **From**: latest
          - **To**: ${{ inputs.target-version }}
          - **Reason**: ${{ inputs.reason }}
          - **Executed by**: ${{ github.actor }}
          - **Time**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

          ## Action Items
          - [ ] Root cause analysis
          - [ ] Fix PR created
          - [ ] Post-mortem scheduled" \
            --label "incident,rollback"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 10. Release Quality Gates

### 10.1 Automated Pre-Release Checks

```yaml
# .github/workflows/release-gate.yml — release quality gate
name: Release Quality Gate

on:
  pull_request:
    branches: [main]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      # 1. Unit tests
      - name: Unit Tests
        run: npm test -- --coverage
        env:
          CI: true

      # 2. Coverage check
      - name: Coverage Check
        run: |
          COVERAGE=$(npx c8 check-coverage --lines 80 --functions 80 --branches 70 2>&1) || {
            echo "Coverage below threshold"
            exit 1
          }

      # 3. Linting
      - name: Lint
        run: npm run lint

      # 4. Type check
      - name: Type Check
        run: npx tsc --noEmit

      # 5. Security audit
      - name: Security Audit
        run: npm audit --audit-level=high

      # 6. License check
      - name: License Check
        run: npx license-checker --failOn "GPL-3.0;AGPL-3.0"

      # 7. Bundle size check
      - name: Bundle Size Check
        run: |
          npm run build
          SIZE=$(du -sb dist/ | cut -f1)
          MAX_SIZE=5242880  # 5MB
          if [ "$SIZE" -gt "$MAX_SIZE" ]; then
            echo "Bundle size ($SIZE bytes) exceeds limit ($MAX_SIZE bytes)"
            exit 1
          fi

      # 8. Changeset check (when changes exist)
      - name: Check for changeset
        run: |
          if git diff --name-only ${{ github.event.pull_request.base.sha }} | grep -qE '\.(ts|tsx|js|jsx)$'; then
            if ! ls .changeset/*.md 2>/dev/null | grep -v README; then
              echo "Warning: Source files changed but no changeset found"
              echo "Run 'npx changeset' to add a changeset"
            fi
          fi
```

---

## 11. Comparison Tables

| Property | semantic-release | Changesets | release-please |
|------|-----------------|------------|----------------|
| Version determination | Automatic from commit messages | Explicitly written by developer | Automatic from commit messages |
| Monorepo support | Limited | Excellent | Supported |
| CHANGELOG generation | Automatic | Automatic | Automatic |
| npm publish | Supported | Supported | Supported |
| GitHub Release | Supported | Requires additional config | Supported |
| Learning curve | Medium | Low | Low |
| Customizability | High via plugins | Medium | Medium |
| Release PR | No (direct release) | Yes | Yes |
| Pre-release | Branch-based | Command-based | Branch-based |
| Maintainer | semantic-release org | Changesets org | Google |

| Branch Strategy | Git Flow | GitHub Flow | Trunk-Based |
|-------------|----------|-------------|-------------|
| Number of branches | Many | Few | Minimal |
| Release frequency | Low | Medium | High |
| Complexity | High | Low | Medium |
| Scale | Large | Medium | All scales |
| Need for Feature Flags | Low | Medium | High |
| Release branch | Yes | No | No |
| Hotfix | Dedicated branch | Directly from main | Directly from main |

| Feature Flag Tool | LaunchDarkly | Unleash | Flagsmith | Env Variables |
|---------------------|-------------|---------|-----------|----------|
| Dynamic changes | Supported | Supported | Supported | Requires redeploy |
| Targeting | Advanced | Medium | Medium | None |
| A/B testing | Supported | Supported | Supported | Not possible |
| Audit log | Yes | Yes | Yes | No |
| Self-host | No | Yes | Yes | - |
| SDK languages | Many | Many | Many | - |
| Free tier | No | Yes | Yes | Free |

---

## 12. Anti-Patterns

### Anti-Pattern 1: Manual Version Management

```
[Bad example]
- Manually editing the version in package.json
- Manually writing CHANGELOG (frequent omissions and mistakes)
- Manually creating release tags (easy to forget)
- Wasting time debating "what should the next version number be?"

[Good example]
- Fully automated with Conventional Commits + semantic-release
- Version is determined automatically by commit type (feat/fix/BREAKING)
- CHANGELOG, tags, and GitHub Releases are auto-generated by CI
- Developers only need to focus on writing good commit messages
```

### Anti-Pattern 2: Mixing Releases and Hotfixes

```
[Bad example]
- Production incident occurs → push fix directly to main branch
- Unfinished features under development get released together
- No defined hotfix process, causing confusion each time

[Good example]
- Document the hotfix process explicitly:
  1. Create hotfix/xxx branch from main
  2. Commit the fix (fix: ...)
  3. Verify tests pass
  4. Merge into main → automatic release (PATCH version bump)
  5. Also merge into develop branch (for Git Flow)
- Using Feature Flags to hide unfinished features makes direct main fixes safe
```

### Anti-Pattern 3: Abandoning Feature Flags

```
[Bad example]
- Feature Flag is created but left in place even after 100% rollout
- Dozens of stale flags accumulate, code full of conditionals
- Unable to track which flags are enabled and which are disabled
- Unexpected behavior from combinations of flags

[Good example]
- Always set an expiry on flags (maximum 90 days)
- Remove flags in the next sprint after full rollout
- Conduct monthly flag audits (delete unused flags)
- Track flag lifecycle in Jira/GitHub Issues
- Prepare a PR template for flag removal:
  1. Remove the flag's code paths
  2. Update tests
  3. Remove the flag definition from config files
```

### Anti-Pattern 4: Neglecting the CHANGELOG

```
[Bad example]
- CHANGELOG does not exist or is not being updated
- Users cannot understand "what changed"
- User encounters a breaking change unknowingly, causing an incident
- Increase in support inquiries

[Good example]
- Auto-generate CHANGELOG and publish it with each release
- Make the BREAKING CHANGES section prominent
- Include links to migration guides
- Include CHANGELOG in GitHub Release body
- Deliver release notifications via RSS/Atom feed
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("入力値がNoneです")
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
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

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
    assert ex.add("d", 4) == False  # size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose the appropriate data structure
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check execution user permissions, review settings |
| Data inconsistency | Concurrent process conflicts | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Read the error message**: Read the stack trace to identify where it occurred
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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps to diagnose when performance issues occur:

1. **Identify the bottleneck**: Measure with a profiling tool
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Problem Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |
---

## 13. FAQ

### Q1: Which should I choose: semantic-release or Changesets?

For a **single package**, semantic-release is simpler — the version is determined automatically from commit messages. For a **monorepo** (multiple packages), Changesets is more suitable. It lets you describe changes per package, making coordinated version management easier. If team members are not familiar with Conventional Commits, Changesets also has a lower learning curve. release-please is developed and maintained by Google, has good monorepo support, and features a Release PR workflow. All three are mature tools, so choose based on your team's preferences and project structure.

### Q2: How do I manage pre-release versions (alpha/beta/rc)?

With semantic-release, define `next` or `beta` branches in the `branches` configuration. Merging into these branches automatically generates pre-release versions like `v2.0.0-beta.1`. With Changesets, enter pre-release mode with `npx changeset pre enter beta` and exit with `npx changeset pre exit`. With release-please, you control it by including the pre-release type in the branch name.

### Q3: How far back should I maintain the CHANGELOG?

Ideally maintain the entire history, but in practice it is recommended to split it by major version. Archive the v1.x CHANGELOG as `CHANGELOG-v1.md`, and include only the current major version history in `CHANGELOG.md`. Since Git tags and GitHub Releases exist, older change history can be referenced from there.

### Q4: How do I get the team to adopt Conventional Commits?

The following stepwise approach is recommended:

1. **First, introduce commitlint + Husky**: Validate at commit time locally
2. **Introduce commitizen (cz)**: Enable interactive commit message creation
3. **Include rules in PR templates**: Remind developers how to write commit messages
4. **Also validate in CI**: Check PR commit messages in CI
5. **Team study session**: Hold a ~30-minute session with practical examples

### Q5: What is an appropriate release frequency?

It depends on the project maturity and risk tolerance. General guidelines:

- **SaaS (B2C)**: Daily to weekly. Trunk-Based + Feature Flags are suitable
- **SaaS (B2B)**: Weekly to bi-weekly. Ensure sufficient lead time for customer notification
- **Library (npm)**: As needed when changes occur. Automate with semantic-release
- **Mobile app**: Bi-weekly to monthly. Account for app store review time
- **On-premises**: Monthly to quarterly. Account for customer update effort

The more frequently you release, the lower the risk per release (since changes are smaller), and it also becomes easier to identify the cause when problems occur.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------|
| SemVer | MAJOR(breaking changes).MINOR(new features).PATCH(bug fixes) |
| Conventional Commits | Use feat:/fix:/BREAKING CHANGE to explicitly state the type of change |
| semantic-release | Automatic versioning and release from commit messages |
| Changesets | Monorepo support. Developers explicitly describe change contents |
| release-please | By Google. Release PR-based workflow |
| CHANGELOG | Auto-generated. Manual management leads to omissions and wasted effort |
| Feature Flag | Separate deployment from release. Achieve phased rollouts |
| Hotfix | Handle with a dedicated branch and documented procedure |
| Pre-release | Manage alpha/beta/rc with branch strategy |
| Quality Gate | Auto-check tests, coverage, and security audits before release |

---

## Recommended Next Guides

- [00-deployment-strategies.md](./00-deployment-strategies.md) — Basics of deployment strategies
- [01-cloud-deployment.md](./01-cloud-deployment.md) — Practical cloud deployment
- [02-container-deployment.md](./02-container-deployment.md) — Container deployment and registry management
- [../03-monitoring/00-observability.md](../03-monitoring/00-observability.md) — Foundations of observability

---

## References

1. **Semantic Versioning 2.0.0** — https://semver.org/ — Official SemVer specification
2. **Conventional Commits** — https://www.conventionalcommits.org/ — Official site for commit message conventions
3. **semantic-release Documentation** — https://semantic-release.gitbook.io/ — Official documentation for the automated release tool
4. **Changesets Documentation** — https://github.com/changesets/changesets — Monorepo-compatible release management tool
5. **release-please Documentation** — https://github.com/googleapis/release-please — Google's release management tool
6. **Martin Fowler - Feature Toggles** — https://martinfowler.com/articles/feature-toggles.html — Design patterns for Feature Flags
7. **Trunk Based Development** — https://trunkbaseddevelopment.com/ — Guide to Trunk-Based development
