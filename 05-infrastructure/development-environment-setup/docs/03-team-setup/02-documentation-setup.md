# Documentation Setup

> Learn how to systematically manage team knowledge by building documentation sites with VitePress / Docusaurus and recording decisions with ADR (Architecture Decision Records).

## What You Will Learn

1. **Setting up and configuring VitePress / Docusaurus** -- Build a Markdown-based documentation site and establish an automated deployment pipeline
2. **Operating ADR (Architecture Decision Records)** -- Record architecture decisions to make "why we chose this design" traceable
3. **Best practices for documentation maintenance** -- Keep documentation fresh and build a culture of maintaining it alongside code
4. **Auto-generating API documentation** -- Use OpenAPI / TypeDoc / Storybook to automatically generate always-up-to-date references
5. **Document design with the Diataxis framework** -- Organize documentation into four quadrants: Tutorial / How-to / Reference / Explanation


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [Onboarding Automation](./01-onboarding-automation.md)

---

## 1. Choosing a Documentation Tool

### 1.1 Tool Comparison

| Item | VitePress | Docusaurus | Nextra | GitBook | Starlight |
|------|-----------|------------|--------|---------|-----------|
| Framework | Vue 3 / Vite | React / Webpack | Next.js | SaaS | Astro |
| Build speed | Very fast | Medium | Fast | N/A | Fast |
| Customization | Vue components | React components | React | Limited | Astro components |
| Multilingual (i18n) | Supported | Strong support | Supported | Supported | Supported |
| Versioning | Manual | Built-in | Manual | Supported | Manual |
| Search | Built-in (miniSearch) | Algolia integration | Flexsearch | Built-in | Pagefind |
| Deployment | Static hosting | Static hosting | Vercel recommended | SaaS | Static hosting |
| Learning cost | Low | Medium | Low | Lowest | Low |
| Use case | OSS / technical docs | Large-scale projects | Next.js users | Includes non-engineers | High-performance sites |

### 1.2 Selection Guide

```
+------------------------------------------------------------------+
|              Documentation Tool Selection Flow                    |
+------------------------------------------------------------------+
|                                                                  |
|  Is the team using React?                                        |
|    |                                                             |
|   YES                          NO                                |
|    |                            |                                |
|    v                            v                                |
|  Need versioning?          Using Vue?                            |
|    |        |                  |        |                        |
|   YES      NO                 YES      NO                        |
|    |        |                  |        |                        |
|    v        v                  v        v                        |
| Docusaurus  Nextra          VitePress  VitePress                 |
|                                        (lowest learning cost)    |
|                                                                  |
|  Performance is the top priority?                                |
|    YES → Starlight (Astro-based)                                 |
|                                                                  |
|  Non-engineers need to edit?                                     |
|    YES → GitBook / Notion                                        |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.3 The Diataxis Framework

A framework for effectively structuring documentation. It classifies documentation into four quadrants.

```
+------------------------------------------------------------------+
|              Diataxis Framework                                   |
+------------------------------------------------------------------+
|                                                                  |
|       Learning                 |     Doing                       |
|  ─────────────────────────────|──────────────────────────────    |
|                               |                                  |
|   TUTORIALS                   |   HOW-TO GUIDES                  |
|   · Provide learning          |   · Steps for specific tasks     |
|     experiences               |   · Problem-solving oriented     |
|   · For beginners             |   · Results-oriented             |
|   · Step-by-step              |                                  |
|   e.g.: First deployment      |   e.g.: Adding email feature     |
|                               |                                  |
|  ─────────────────────────────|──────────────────────────────    |
|                               |                                  |
|   EXPLANATION                 |   REFERENCE                      |
|   · Provide background        |   · Accurate technical info      |
|     and context               |   · Can be auto-generated        |
|   · Conceptual understanding  |   · API specs, type definitions  |
|   · Explains "why"            |                                  |
|   e.g.: Architecture overview |   e.g.: API endpoint list        |
|                               |                                  |
|       Understanding           |     Information                   |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 2. Setting Up VitePress

### 2.1 Initial Setup

```bash
# Add documentation inside the project
# Managed under the docs/ directory

# pnpm (recommended)
pnpm add -D vitepress

# Directory structure
# docs/
#   .vitepress/
#     config.ts     -- Site configuration
#     theme/        -- Custom theme
#       index.ts
#       style.css
#   index.md        -- Top page
#   guide/
#     getting-started.md
#     architecture.md
#     dev-setup.md
#     coding-standards.md
#     testing.md
#     deployment.md
#   api/
#     overview.md
#     authentication.md
#     endpoints.md
#   adr/
#     index.md
#     0001-use-typescript.md
#     0002-choose-postgresql.md
#     template.md
#   tutorials/
#     first-feature.md
#     first-deploy.md
```

### 2.2 VitePress Configuration File

```typescript
// docs/.vitepress/config.ts
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'MyApp Documentation',
  description: 'MyApp の開発者向けドキュメント',
  lang: 'ja-JP',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'ja_JP' }],
  ],

  // クリーン URL (/guide/getting-started.html → /guide/getting-started)
  cleanUrls: true,

  // 最終更新日時の表示 (git log ベース)
  lastUpdated: true,

  // sitemap 自動生成
  sitemap: {
    hostname: 'https://docs.example.com',
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'ガイド', link: '/guide/getting-started' },
      { text: 'API', link: '/api/overview' },
      { text: 'ADR', link: '/adr/' },
      {
        text: 'リソース',
        items: [
          { text: 'チュートリアル', link: '/tutorials/first-feature' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'はじめに',
          items: [
            { text: 'クイックスタート', link: '/guide/getting-started' },
            { text: 'アーキテクチャ', link: '/guide/architecture' },
            { text: '開発環境セットアップ', link: '/guide/dev-setup' },
          ],
        },
        {
          text: '開発ガイド',
          items: [
            { text: 'コーディング規約', link: '/guide/coding-standards' },
            { text: 'テスト戦略', link: '/guide/testing' },
            { text: 'デプロイ', link: '/guide/deployment' },
          ],
        },
        {
          text: '運用',
          items: [
            { text: 'モニタリング', link: '/guide/monitoring' },
            { text: 'トラブルシューティング', link: '/guide/troubleshooting' },
            { text: 'セキュリティ', link: '/guide/security' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API リファレンス',
          items: [
            { text: '概要', link: '/api/overview' },
            { text: '認証', link: '/api/authentication' },
            { text: 'エンドポイント', link: '/api/endpoints' },
            { text: 'エラーコード', link: '/api/error-codes' },
            { text: 'レートリミット', link: '/api/rate-limiting' },
          ],
        },
      ],
      '/tutorials/': [
        {
          text: 'チュートリアル',
          items: [
            { text: '初めての機能追加', link: '/tutorials/first-feature' },
            { text: '初めてのデプロイ', link: '/tutorials/first-deploy' },
            { text: 'テストの書き方', link: '/tutorials/writing-tests' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-org/myapp' },
      { icon: 'slack', link: 'https://your-org.slack.com/' },
    ],

    search: {
      provider: 'local', // miniSearch 内蔵検索
      options: {
        translations: {
          button: { buttonText: '検索', buttonAriaLabel: 'サイト内検索' },
          modal: {
            noResultsText: '結果が見つかりません',
            resetButtonTitle: 'リセット',
            footer: { selectText: '選択', navigateText: '移動', closeText: '閉じる' },
          },
        },
      },
    },

    editLink: {
      pattern: 'https://github.com/your-org/myapp/edit/main/docs/:path',
      text: 'このページを編集する',
    },

    lastUpdated: {
      text: '最終更新',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },

    footer: {
      message: 'MIT License',
      copyright: 'Copyright (c) 2025 Your Org',
    },

    // 目次の深さ設定
    outline: {
      level: [2, 3],
      label: '目次',
    },

    // 前後ページナビゲーション
    docFooter: {
      prev: '前のページ',
      next: '次のページ',
    },
  },

  markdown: {
    lineNumbers: true, // コードブロックに行番号
    math: true, // 数式サポート (KaTeX)
    image: {
      lazyLoading: true,
    },
    // カスタムコンテナ
    container: {
      tipLabel: 'ヒント',
      warningLabel: '注意',
      dangerLabel: '危険',
      infoLabel: '情報',
      detailsLabel: '詳細',
    },
  },
});
```

### 2.3 package.json Scripts

```jsonc
// package.json (docs related)
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  }
}
```

### 2.4 VitePress Custom Theme

```typescript
// docs/.vitepress/theme/index.ts
import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './style.css';

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // カスタムスロット
      // 'doc-before': () => h(Banner),
      // 'doc-after': () => h(Feedback),
    });
  },
  enhanceApp({ app, router, siteData }) {
    // カスタムコンポーネントの登録
    // app.component('CustomComponent', CustomComponent);
  },
} satisfies Theme;
```

```css
/* docs/.vitepress/theme/style.css */

/* カスタムカラーテーマ */
:root {
  --vp-c-brand-1: #3eaf7c;
  --vp-c-brand-2: #359968;
  --vp-c-brand-3: #2c8155;
  --vp-c-brand-soft: rgba(62, 175, 124, 0.14);
}

/* ダークモード */
.dark {
  --vp-c-brand-1: #5dd3a0;
  --vp-c-brand-2: #49c78d;
  --vp-c-brand-3: #3eaf7c;
}

/* カスタムコンテナのスタイル */
.custom-block.tip {
  border-color: var(--vp-c-brand-1);
}

/* コードブロックのフォント */
:root {
  --vp-code-font-size: 0.875em;
}
```

### 2.5 VitePress Top Page

```markdown
---
# docs/index.md
layout: home

hero:
  name: "MyApp"
  text: "開発者ドキュメント"
  tagline: "MyApp の開発に必要な全ての情報"
  image:
    src: /logo.svg
    alt: MyApp
  actions:
    - theme: brand
      text: クイックスタート
      link: /guide/getting-started
    - theme: alt
      text: API リファレンス
      link: /api/overview

features:
  - icon: 🚀
    title: クイックスタート
    details: 5分で開発環境をセットアップし、最初のコードを書く
    link: /guide/getting-started
  - icon: 📖
    title: 開発ガイド
    details: コーディング規約、テスト戦略、デプロイ手順
    link: /guide/coding-standards
  - icon: 🔌
    title: API リファレンス
    details: REST API の完全なリファレンスドキュメント
    link: /api/overview
  - icon: 🏗️
    title: アーキテクチャ
    details: システム設計と意思決定の記録 (ADR)
    link: /guide/architecture
---
```

---

## 3. Setting Up Docusaurus

### 3.1 Initial Setup

```bash
npx create-docusaurus@latest docs classic --typescript
```

### 3.2 Docusaurus Configuration

```typescript
// docs/docusaurus.config.ts
import { themes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'MyApp Documentation',
  tagline: 'MyApp の開発者向けドキュメント',
  url: 'https://docs.example.com',
  baseUrl: '/',
  organizationName: 'your-org',
  projectName: 'myapp',
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/your-org/myapp/edit/main/docs/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
          // バージョニング
          versions: {
            current: { label: 'Next', path: 'next' },
          },
        },
        blog: {
          showReadingTime: true,
          blogTitle: '開発ブログ',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'MyApp',
      items: [
        { type: 'doc', docId: 'intro', position: 'left', label: 'ドキュメント' },
        { to: '/blog', label: 'ブログ', position: 'left' },
        { type: 'docsVersionDropdown', position: 'right' },
        { type: 'localeDropdown', position: 'right' },
        { href: 'https://github.com/your-org/myapp', label: 'GitHub', position: 'right' },
      ],
    },
    algolia: {
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_SEARCH_API_KEY',
      indexName: 'myapp',
    },
    prism: {
      theme: themes.github,
      darkTheme: themes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'sql', 'docker', 'nginx'],
    },
    // アナウンスメントバー
    announcementBar: {
      id: 'v2_announcement',
      content: 'v2.0 がリリースされました! <a href="/blog/v2-release">詳細はこちら</a>',
      backgroundColor: '#fafbfc',
      textColor: '#091E42',
      isCloseable: true,
    },
  },

  plugins: [
    // OpenAPI ドキュメント自動生成
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          api: {
            specPath: 'api/openapi.yaml',
            outputDir: 'docs/api-reference',
          },
        },
      },
    ],
  ],
};

export default config;
```

### 3.3 Docusaurus Versioning

```bash
# Snapshot the current documentation as v1.0.0
npx docusaurus docs:version 1.0.0

# Directory structure:
# docs/
#   intro.md                   ← Latest (next)
# versioned_docs/
#   version-1.0.0/
#     intro.md                 ← Snapshot at v1.0.0
# versioned_sidebars/
#   version-1.0.0-sidebars.json
# versions.json                ← ["1.0.0"]
```

---

## 4. ADR (Architecture Decision Records)

### 4.1 ADR Template

```markdown
<!-- docs/adr/NNNN-title.md -->
# ADR-NNNN: Title

## Status

Proposed | Accepted | Deprecated | Superseded

## Date

2025-01-15

## Context

<!-- What situation or challenge necessitated this decision -->

## Decision

<!-- What was decided. Describe specifically -->

## Considered Options

### Option A: xxx
- Pros: ...
- Cons: ...

### Option B: xxx
- Pros: ...
- Cons: ...

## Consequences

<!-- What impacts are expected from this decision -->

## References

- Link
```

### 4.2 ADR Example

```markdown
# ADR-0001: Adopting TypeScript

## Status

Accepted

## Date

2025-01-10

## Context

As the project has grown in scale, runtime errors due to the lack of type
safety in JavaScript alone have been increasing. New members also take
longer to understand the code during onboarding.

## Decision

Adopt TypeScript for both frontend and backend.
Enable strict mode and prohibit use of any in principle.

## Considered Options

### Option A: TypeScript (strict mode)
- Pros: Type safety, IDE completion, easy refactoring
- Cons: Learning cost, increased build time

### Option B: JavaScript + JSDoc
- Pros: No build step required, lower learning cost
- Cons: Incomplete type checking, limited at large scale

### Option C: Stay with JavaScript
- Pros: No changes required
- Cons: Current issues remain unresolved

## Consequences

- Early detection of type errors is expected to reduce production incidents
- Initial migration cost (approximately 2 weeks) occurs, but development speed improves long-term
- Unify tsconfig.json with strict: true
```

### 4.3 ADR Directory Structure

```
+------------------------------------------------------------------+
|              ADR Directory Structure                              |
+------------------------------------------------------------------+
|                                                                  |
|  docs/adr/                                                       |
|    +-- index.md               ← ADR list (can be auto-generated) |
|    +-- 0001-use-typescript.md                                    |
|    +-- 0002-choose-postgresql.md                                 |
|    +-- 0003-adopt-monorepo.md                                    |
|    +-- 0004-api-versioning-strategy.md                           |
|    +-- 0005-authentication-with-jwt.md                           |
|    +-- 0006-adopt-graphql.md                                     |
|    +-- 0007-use-redis-for-caching.md                             |
|    +-- 0008-container-orchestration.md                           |
|    +-- template.md            ← Template                         |
|                                                                  |
|  Naming convention: NNNN-kebab-case-title.md                     |
|  Numbers are sequential. Do not delete deprecated ADRs           |
|  (keep them as history)                                          |
|                                                                  |
+------------------------------------------------------------------+
```

### 4.4 ADR Auto-Generation Script

```bash
#!/bin/bash
# scripts/new-adr.sh
# Script to create a new ADR

set -euo pipefail

ADR_DIR="docs/adr"
TEMPLATE="$ADR_DIR/template.md"

# Get the next number
LAST_NUM=$(ls "$ADR_DIR"/*.md 2>/dev/null | grep -oP '\d{4}' | sort -rn | head -1 || echo "0000")
NEXT_NUM=$(printf "%04d" $((10#$LAST_NUM + 1)))

# Input the title
if [ -z "${1:-}" ]; then
  echo -n "Enter ADR title: "
  read -r TITLE
else
  TITLE="$*"
fi

# Convert to kebab-case
KEBAB=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9-]//g')
FILENAME="$ADR_DIR/${NEXT_NUM}-${KEBAB}.md"

# Copy from template
if [ -f "$TEMPLATE" ]; then
  sed "s/NNNN/$NEXT_NUM/g; s/タイトル/$TITLE/g" "$TEMPLATE" > "$FILENAME"
else
  cat > "$FILENAME" << EOF
# ADR-${NEXT_NUM}: ${TITLE}

## ステータス

提案中

## 日付

$(date +%Y-%m-%d)

## コンテキスト

<!-- どのような状況・課題が意思決定を必要としたか -->

## 決定

<!-- 何を決定したか。具体的に記述 -->

## 検討した選択肢

### 選択肢 A:
- メリット:
- デメリット:

### 選択肢 B:
- メリット:
- デメリット:

## 結果

<!-- この決定によってどのような影響が予想されるか -->

## 参考資料

-
EOF
fi

echo "Created: $FILENAME"
echo "Opening in editor..."
${EDITOR:-code} "$FILENAME"
```

### 4.5 Auto-Generating the ADR Index

```bash
#!/bin/bash
# scripts/update-adr-index.sh
# Auto-generate the ADR index page

set -euo pipefail

ADR_DIR="docs/adr"
INDEX_FILE="$ADR_DIR/index.md"

cat > "$INDEX_FILE" << 'HEADER'
# Architecture Decision Records

List of recorded architecture decisions.

| Number | Title | Status | Date |
|--------|-------|--------|------|
HEADER

for file in "$ADR_DIR"/[0-9][0-9][0-9][0-9]-*.md; do
  [ -f "$file" ] || continue
  BASENAME=$(basename "$file" .md)
  NUM=$(echo "$BASENAME" | grep -oP '^\d{4}')
  TITLE=$(head -1 "$file" | sed 's/^# ADR-[0-9]*: //')
  STATUS=$(grep -A1 "^## ステータス" "$file" | tail -1 | tr -d '[:space:]')
  DATE=$(grep -A1 "^## 日付" "$file" | tail -1 | tr -d '[:space:]')

  echo "| $NUM | $TITLE | $STATUS | $DATE |" >> "$INDEX_FILE"
done

echo ""
echo "ADR index updated: $INDEX_FILE"
```

---

## 5. Automated Documentation Deployment

### 5.1 Deploying to GitHub Pages (VitePress)

```yaml
# .github/workflows/docs.yml
name: Deploy Docs

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - '.github/workflows/docs.yml'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # lastUpdated のために全履歴が必要

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm docs:build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

### 5.2 Deploying to Vercel / Netlify

```toml
# netlify.toml (VitePress)
[build]
  command = "pnpm docs:build"
  publish = "docs/.vitepress/dist"

[build.environment]
  NODE_VERSION = "20"

# Redirect configuration
  from = "/docs/*"
  to = "/:splat"
  status = 301
```

```jsonc
// vercel.json (VitePress)
{
  "buildCommand": "pnpm docs:build",
  "outputDirectory": "docs/.vitepress/dist",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1" }
  ]
}
```

### 5.3 Deploying to Cloudflare Pages

```yaml
# .github/workflows/docs-cloudflare.yml
name: Deploy Docs to Cloudflare Pages

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm docs:build

      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: myapp-docs
          directory: docs/.vitepress/dist
```

---

## 6. Auto-Generating API Documentation

### 6.1 Generating from OpenAPI (Swagger)

```yaml
# api/openapi.yaml
openapi: 3.1.0
info:
  title: MyApp API
  version: 1.0.0
  description: MyApp の REST API ドキュメント

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: http://localhost:3000/api/v1
    description: Development

paths:
  /users:
    get:
      summary: ユーザー一覧取得
      operationId: listUsers
      tags:
        - Users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

    post:
      summary: ユーザー作成
      operationId: createUser
      tags:
        - Users
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: 作成成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '422':
          description: バリデーションエラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        email:
          type: string
          format: email
        role:
          type: string
          enum: [admin, member, viewer]
        createdAt:
          type: string
          format: date-time

    CreateUserRequest:
      type: object
      required:
        - name
        - email
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
        role:
          type: string
          enum: [admin, member, viewer]
          default: member

    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer

    ValidationError:
      type: object
      properties:
        message:
          type: string
        errors:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```

### 6.2 Generating TypeScript Documentation with TypeDoc

```jsonc
// typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "entryPointStrategy": "expand",
  "out": "docs/api-reference",
  "plugin": ["typedoc-plugin-markdown"],
  "theme": "markdown",
  "readme": "none",
  "excludePrivate": true,
  "excludeProtected": true,
  "excludeInternal": true,
  "includeVersion": true,
  "categorizeByGroup": true
}
```

```bash
# Running TypeDoc
npx typedoc

# When integrating with VitePress,
# Markdown is generated in docs/api-reference/
```

### 6.3 Component Documentation with Storybook

```typescript
// src/components/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'], // 自動ドキュメント生成
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
      description: 'ボタンのスタイルバリアント',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'ボタンのサイズ',
    },
    disabled: {
      control: 'boolean',
      description: '無効状態',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'ボタン',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'ボタン',
  },
};

export const Disabled: Story = {
  args: {
    variant: 'primary',
    children: 'ボタン',
    disabled: true,
  },
};
```

---

## 7. Documentation Maintenance Practices

### 7.1 Mechanisms for Keeping Documentation Fresh

```
+------------------------------------------------------------------+
|           Mechanisms for Maintaining Documentation Freshness      |
+------------------------------------------------------------------+
|                                                                  |
|  [Automation]                                                    |
|  1. Document update checklist in PR template                     |
|  2. CI warning when changed code has related docs/               |
|  3. Visualize stale pages via lastUpdated display                |
|  4. API docs auto-generated from OpenAPI spec                    |
|  5. Type docs auto-generated from code via TypeDoc               |
|  6. UI components auto-documented via Storybook                  |
|                                                                  |
|  [Culture]                                                       |
|  1. Make "write docs when you write code" a rule                 |
|  2. Include doc review in PR review                              |
|  3. Monthly audit of stale documentation                         |
|  4. Always create an ADR at the time of a decision               |
|  5. Keep README always up to date                                |
|                                                                  |
+------------------------------------------------------------------+
```

### 7.2 Embedding in PR Template

```markdown
<!-- .github/pull_request_template.md (excerpt) -->
## Checklist

- [ ] Added / updated tests
- [ ] Updated documentation (if applicable)
  - [ ] API changes: update docs/api/
  - [ ] Configuration changes: update docs/guide/
  - [ ] Architecture changes: create an ADR
  - [ ] Component changes: update Storybook
- [ ] Updated CHANGELOG.md (for user-facing changes)
```

### 7.3 Automating Documentation Quality Checks

```yaml
# .github/workflows/docs-check.yml
name: Docs Check

on:
  pull_request:
    paths:
      - 'docs/**'
      - 'src/**'

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Documentation build check
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm docs:build

      # Broken link check
      - name: Check broken links
        run: npx linkinator docs/.vitepress/dist --recurse --skip "^https?"

      # Warn if src/ changed but docs/ was not updated
      - name: Check docs update
        run: |
          SRC_CHANGED=$(git diff --name-only origin/main...HEAD -- 'src/' | wc -l)
          DOCS_CHANGED=$(git diff --name-only origin/main...HEAD -- 'docs/' | wc -l)

          if [ "$SRC_CHANGED" -gt 0 ] && [ "$DOCS_CHANGED" -eq 0 ]; then
            echo "::warning::src/ has changes but docs/ was not updated. Please check whether documentation needs to be updated."
          fi
```

### 7.4 Detecting Stale Documentation

```bash
#!/bin/bash
# scripts/stale-docs.sh
# List documents that have not been updated in 90+ days

set -euo pipefail

DAYS=${1:-90}
STALE_DATE=$(date -d "-${DAYS} days" +%s 2>/dev/null || date -v-${DAYS}d +%s)
COUNT=0

echo "=== Documents not updated in ${DAYS}+ days ==="
echo ""

while IFS= read -r file; do
  LAST_COMMIT=$(git log -1 --format="%ct" -- "$file" 2>/dev/null || echo "0")

  if [ "$LAST_COMMIT" -lt "$STALE_DATE" ]; then
    LAST_DATE=$(git log -1 --format="%ci" -- "$file" 2>/dev/null | cut -d' ' -f1)
    LAST_AUTHOR=$(git log -1 --format="%an" -- "$file" 2>/dev/null)
    echo "  $file"
    echo "    Last updated: $LAST_DATE ($LAST_AUTHOR)"
    ((COUNT++))
  fi
done < <(find docs -name "*.md" -type f)

echo ""
echo "Total: ${COUNT} files"
```

---

## 8. Documentation Directory Structure Templates

### 8.1 Small-Scale Project

```
docs/
  README.md               ← Project overview
  CONTRIBUTING.md          ← Contribution guide
  CHANGELOG.md             ← Change history
  guide/
    getting-started.md     ← Quick start
    dev-setup.md           ← Development environment setup
  api/
    overview.md            ← API overview
  adr/
    0001-xxx.md            ← ADR
```

### 8.2 Medium-Scale Project

```
docs/
  .vitepress/
    config.ts
    theme/
  index.md                 ← Top page
  guide/
    getting-started.md
    architecture.md
    dev-setup.md
    coding-standards.md
    testing.md
    deployment.md
  api/
    overview.md
    authentication.md
    endpoints.md
    error-codes.md
  tutorials/
    first-feature.md
    first-deploy.md
  adr/
    index.md
    0001-xxx.md
    template.md
  reference/
    environment-variables.md
    configuration.md
```

### 8.3 Large-Scale Project

```
docs/
  .vitepress/
    config.ts
    theme/
  index.md
  guide/
    getting-started.md
    architecture.md
    dev-setup.md
    coding-standards.md
    testing/
      unit-testing.md
      integration-testing.md
      e2e-testing.md
    deployment/
      staging.md
      production.md
      rollback.md
  api/
    overview.md
    authentication.md
    v1/
      users.md
      orders.md
      products.md
    v2/
      users.md
    error-codes.md
    rate-limiting.md
  tutorials/
    beginner/
      first-feature.md
      first-deploy.md
    advanced/
      custom-plugin.md
      performance-tuning.md
  how-to/
    add-new-endpoint.md
    run-migrations.md
    debug-production.md
    setup-monitoring.md
  explanation/
    data-model.md
    auth-flow.md
    caching-strategy.md
  adr/
    index.md
    0001-xxx.md
    template.md
  reference/
    environment-variables.md
    configuration.md
    cli-commands.md
  operations/
    runbooks/
      incident-response.md
      database-failover.md
    monitoring.md
    alerting.md
  contributing/
    development-workflow.md
    code-review.md
    release-process.md
```

---

## Anti-Patterns

### Anti-Pattern 1: Managing Documentation in a Separate Repository from Code

```
# NG: Separating documentation into a separate repository
myapp/           ← Application code
myapp-docs/      ← Documentation (separate repo)
→ Easy to forget updating docs when code changes

# OK: docs/ directory within the same repository
myapp/
  src/           ← Application code
  docs/          ← Documentation (same repo)
  → Update code and docs together in the same PR
```

**Problem**: Separating into a different repository means code changes and documentation updates lose sync, causing documentation to become stale rapidly. Keeping them in the same repository allows PR reviews to also verify documentation updates, and makes CI/CD deployment automation easier.

### Anti-Pattern 2: Not Writing ADRs, or Writing Them After the Fact

```
# NG: "I'll write it later" → Never gets written
#     3 months later: "Why did we choose this technology again...?"

# OK: Write the ADR immediately at the time of decision
#     Include the ADR document in the PR under review
#     Record the background of the decision "now" (while memory is fresh)
```

**Problem**: ADRs record the "why" of a decision, and writing them after implementation makes the motivation and considered alternatives vague. The ideal approach is to draft the ADR during the decision discussion and finalize it simultaneously with the decision.

### Anti-Pattern 3: Making Documentation Updates Optional

```
# NG: Documentation updates are optional
# → Nobody ends up updating them

# OK: Validate documentation freshness in CI
# → Warn when src/ changes without docs/ changes
# → Checklist in PR template
# → Verify documentation updates in review
```

**Problem**: Making documentation updates optional allows "I'm in a hurry, I'll do it later" to accumulate, widening the gap between docs and code. Mechanisms that semi-enforce updates via CI warnings and PR template checklists are necessary.

### Anti-Pattern 4: Writing Everything Manually

```
# NG: Writing API docs manually
# → Manual updates every time code changes → Divergence

# OK: Combination of auto-generation + manual writing
# Auto-generate: API reference (OpenAPI → documentation)
# Auto-generate: Type definitions (TypeDoc)
# Auto-generate: UI components (Storybook)
# Manual write: Architecture explanations, tutorials, ADRs
```

**Problem**: Manually writing auto-generatable information (API endpoints, type definitions, component Props) makes divergence from code inevitable. Adhering to the principle of "what/how is auto-generated, why is written manually" minimizes maintenance costs.


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code satisfying the following requirements.

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

# Test
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

# Test
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # サイズ制限
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
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured configuration file | Check configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use log output or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debug utility
import logging
import traceback
from functools import wraps

# ロガーの設定
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function inputs and outputs"""
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

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Verify whether memory leaks are present
3. **Check for I/O wait**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Problem type | Diagnostic tool | Solution |
|-------------|----------------|---------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |
---

## FAQ

### Q1: Which should I choose, VitePress or Docusaurus?

**A**: Decide based on project scale and requirements. For small to medium scale where fast builds are needed, choose VitePress. For large scale requiring multilingual support, versioning, and a plugin ecosystem, choose Docusaurus. If the team is Vue-based, VitePress is natural; if React-based, Docusaurus/Nextra is natural. When in doubt, start with VitePress and migrate if you find it lacking -- this is the lowest-risk approach.

### Q2: What level of granularity should ADRs be written at?

**A**: Use "technical decisions that affect multiple team members" as the criterion. Concretely, this includes framework selection, database choice, API design policies, authentication methods, test strategies, and deployment methods. Fine-grained decisions like variable names or coding style are sufficient to record as EditorConfig or ESLint rules. When in doubt, it's better to write one -- an ADR that becomes unnecessary can simply be given a "deprecated" status.

### Q3: How effective is auto-generating documentation?

**A**: Auto-generation is highly effective for API references (OpenAPI/Swagger → documentation generation) and interface lists from type definitions. On the other hand, architecture explanations, tutorials, and ADRs that explain "why" must be written manually. The ideal is a combination of "what/how is auto-generated, why is written manually." Use tools such as TypeDoc (TypeScript), Storybook (components), and Swagger UI (API).

### Q4: How do I implement documentation search?

**A**: Options vary by documentation tool.

- **VitePress**: Built-in miniSearch (no setup required). Sufficient precision for small to medium scale.
- **Docusaurus**: Algolia DocSearch (free tier available, free for OSS). Optimal for large-scale sites.
- **Starlight**: Pagefind (generates search index at build time). No server required.
- **Custom implementation**: Use FlexSearch or Lunr.js on the client side.

### Q5: How do I approach multilingual documentation?

**A**: Docusaurus has the most comprehensive i18n support, and can auto-generate translation file templates with the `docusaurus write-translations` command. With VitePress, directories are split manually. For the translation work itself, integrating with translation management services like Crowdin or Weblate is efficient. Writing in English first and adding Japanese as demand arises (or vice versa) is the realistic approach.

---

## Summary

| Item | Key Points |
|------|-----------|
| VitePress | Vue/Vite based. Fast builds. Best for small to medium scale |
| Docusaurus | React based. Powerful versioning and i18n. For large scale |
| Starlight | Astro based. Fast. Best for content-heavy sites |
| ADR | Record architecture decisions. Write immediately at decision time |
| Diataxis | Classify docs into 4 quadrants (Tutorial/How-to/Reference/Explanation) |
| Same-repo management | Manage code and docs/ in the same repository |
| Auto-deployment | Auto-publish via GitHub Pages / Vercel / Netlify / Cloudflare Pages |
| API documentation | Auto-generate with OpenAPI / TypeDoc. Manual writing only for the "why" |
| Storybook | Visual documentation for UI components |
| Freshness maintenance | Prevent staleness with PR template + CI warnings + monthly audits |
| Quality checks | Automate broken link detection, build checks, and update-miss warnings in CI |

## What to Read Next

- [Project Standards](./00-project-standards.md) -- Shared settings for EditorConfig / .npmrc
- [Onboarding Automation](./01-onboarding-automation.md) -- Setup scripts and Makefile
- [Dev Container](../02-docker-dev/01-devcontainer.md) -- Containerizing the development environment

## References

1. **VitePress Official Documentation** -- https://vitepress.dev/ -- Comprehensive reference for VitePress configuration and features
2. **Docusaurus Official Documentation** -- https://docusaurus.io/ -- Docusaurus configuration, plugins, and theme customization
3. **ADR GitHub Organization** -- https://adr.github.io/ -- Standard templates and tools for Architecture Decision Records
4. **Diataxis Framework** -- https://diataxis.fr/ -- Four-quadrant documentation classification (Tutorial / How-to / Reference / Explanation)
5. **Starlight Official Documentation** -- https://starlight.astro.build/ -- Astro-based documentation framework
6. **Storybook Official** -- https://storybook.js.org/ -- Development, testing, and documentation for UI components
7. **TypeDoc** -- https://typedoc.org/ -- Auto-generating documentation from TypeScript code
8. **Algolia DocSearch** -- https://docsearch.algolia.com/ -- Search service for documentation sites
