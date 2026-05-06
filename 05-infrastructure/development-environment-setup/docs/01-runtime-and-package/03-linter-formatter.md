# Linter / Formatter

> A practical guide to code quality management using ESLint, Prettier, Biome, and Ruff. Unify code style across your entire team through shared configuration and CI integration.

## What You Will Learn

1. Correct configuration and integration of ESLint (v9 Flat Config) and Prettier
2. How to set up Biome (a high-speed Rust-based tool) and Ruff (for Python)
3. Configuration sharing patterns and CI / pre-commit hook integration
4. CSS/SCSS linting with Stylelint
5. Optimizing editor integration and auto-fix
6. Configuration sharing patterns in monorepos and operations in large-scale projects


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Monorepo Setup](./02-monorepo-setup.md)

---

## 1. Tool Overview

### 1.1 Differences Between Linters and Formatters

```
Roles of Linter and Formatter:

  Source code
      │
      ▼
  ┌──────────────┐     ┌──────────────┐
  │   Formatter   │     │    Linter     │
  │               │     │               │
  │ Unifies the   │     │ Inspects the  │
  │ "appearance"  │     │ "quality" of  │
  │ of code       │     │ code          │
  │               │     │               │
  │ Examples:     │     │ Examples:     │
  │ - Indentation │     │ - Unused vars │
  │ - Line breaks │     │ - any type    │
  │ - Quote style │     │ - Unsafe type │
  │ - Semicolons  │     │   conversions │
  │ - Bracket pos │     │ - Unreachable │
  │ - Whitespace  │     │   code        │
  │               │     │ - Security    │
  │               │     │   vulns       │
  └──────────────┘     └──────────────┘
        │                      │
        ▼                      ▼
  Auto-fixable            Partially auto-fixable
  (100%)                (depends on rule)

  Key principle:
  ┌─────────────────────────────────────────┐
  │ Formatter → unify appearance (non-negotiable) │
  │ Linter   → ensure quality (rule selection matters) │
  │                                           │
  │ By separating responsibilities:           │
  │ - Prevent configuration conflicts         │
  │ - Optimize execution speed                │
  │ - Simplify maintenance                    │
  └─────────────────────────────────────────┘
```

### 1.2 Comparison of Major Tools

| Tool | Target Language | Type | Speed | Config Format | Ecosystem |
|--------|---------|------|------|---------|------------|
| ESLint | JS/TS | Linter | Normal | Flat Config (JS) | Largest (1000+ plugins) |
| Prettier | Multi-language | Formatter | Normal | JSON/JS | Wide (plugin support) |
| Biome | JS/TS/JSON/CSS | Both | Ultra-fast | JSON | Growing |
| Ruff | Python | Both | Ultra-fast | TOML | Python-specific |
| Stylelint | CSS/SCSS | Linter | Normal | JSON/JS | CSS-specific |
| oxlint | JS/TS | Linter | Ultra-fast | JSON | ESLint-compatible (partial) |
| dprint | Multi-language | Formatter | Fast | JSON | Rust-based, plugin support |

### 1.3 Tool Selection Flowchart

```
Selecting the best tool for your project:

  Q1: What language?
  │
  ├── JavaScript / TypeScript
  │   │
  │   └── Q2: Is plugin richness important?
  │       │
  │       ├── Yes → ESLint + Prettier (standard setup)
  │       │   - Needs react-hooks, jsx-a11y, etc.
  │       │   - Type-check integration (recommendedTypeChecked)
  │       │   - Creating custom rules
  │       │
  │       └── No → Biome (fast & simple)
  │           - Single config file
  │           - Integrated Linter + Formatter
  │           - Migration tool from ESLint available
  │
  ├── Python
  │   └── Ruff (de facto standard)
  │       - Integrates Flake8 + isort + Black + pyupgrade
  │       - 10-100x faster
  │
  ├── CSS / SCSS
  │   └── Stylelint + Prettier
  │
  └── Go / Rust / Others
      └── Official tools for each language
          - Go: gofmt + golangci-lint
          - Rust: rustfmt + clippy
```

---

## 2. ESLint (v9 Flat Config)

### 2.1 Setup

```bash
# Install
pnpm add -D eslint @eslint/js typescript-eslint globals

# If type-check integration is needed
pnpm add -D @typescript-eslint/parser

# For React projects
pnpm add -D eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y

# For Next.js projects
pnpm add -D @next/eslint-plugin-next

# Import organization
pnpm add -D eslint-plugin-import eslint-plugin-unused-imports

# Avoid conflicts with Prettier
pnpm add -D eslint-config-prettier
```

### 2.2 Configuration File (Basic)

```javascript
// eslint.config.js (Flat Config format -- recommended for v9)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/",
      "build/",
      "node_modules/",
      "coverage/",
      ".next/",
      "*.config.js",
      "*.config.mjs",
      "*.config.cjs",
    ],
  },

  // JavaScript recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommendedTypeChecked,

  // Project-wide settings
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ─── Type safety ───
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      }],
      "@typescript-eslint/consistent-type-exports": "error",

      // ─── Code quality ───
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      curly: ["error", "all"],
      "no-throw-literal": "error",

      // ─── Promise / Async ───
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "warn",
      "no-return-await": "off",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],

      // ─── Naming conventions ───
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "interface",
          format: ["PascalCase"],
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"],
        },
        {
          selector: "enum",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
      ],
    },
  },

  // Relaxed rules for test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "no-console": "off",
    },
  },

  // For config files
  {
    files: ["*.config.ts", "*.config.js"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);
```

### 2.3 Configuration for React / Next.js

```javascript
// eslint.config.js (React + Next.js)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/", ".next/", "coverage/"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React settings
  {
    files: ["**/*.tsx", "**/*.jsx"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/self-closing-comp": "error",
      "react/jsx-no-target-blank": "error",
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-curly-brace-presence": ["error", {
        props: "never",
        children: "never",
      }],
      "react/no-array-index-key": "warn",
      "react/no-unstable-nested-components": "error",

      // React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Accessibility
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/label-has-associated-control": "error",
    },
  },

  // Next.js-specific rules
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  // Disable rules that conflict with Prettier (must be last)
  prettierConfig,
);
```

### 2.4 Migrating from ESLint v8 to v9

```
Key changes from ESLint v8 (Legacy) → v9 (Flat Config):

  Config file:
  ┌────────────────────────────────────────────┐
  │ v8: .eslintrc.json / .eslintrc.js          │
  │ v9: eslint.config.js / eslint.config.mjs   │
  └────────────────────────────────────────────┘

  How to specify plugins:
  ┌────────────────────────────────────────────┐
  │ v8:                                        │
  │   "plugins": ["@typescript-eslint"]        │
  │   "extends": ["plugin:@typescript-eslint/  │
  │                recommended"]               │
  │                                            │
  │ v9:                                        │
  │   import tseslint from "typescript-eslint" │
  │   export default tseslint.config(          │
  │     ...tseslint.configs.recommended,       │
  │   )                                        │
  └────────────────────────────────────────────┘

  ignorePatterns → ignores:
  ┌────────────────────────────────────────────┐
  │ v8: "ignorePatterns": ["dist/"]            │
  │ v9: { ignores: ["dist/"] }                │
  │     (.eslintignore is no longer needed)    │
  └────────────────────────────────────────────┘

  env → globals:
  ┌────────────────────────────────────────────┐
  │ v8: "env": { "browser": true, "node": true } │
  │ v9: languageOptions: {                     │
  │       globals: {                           │
  │         ...globals.browser,                │
  │         ...globals.node,                   │
  │       }                                    │
  │     }                                      │
  └────────────────────────────────────────────┘

  Migration command:
  npx @eslint/migrate-config .eslintrc.json
  → eslint.config.mjs is auto-generated
```

### 2.5 Run Commands

```bash
# Run lint
pnpm eslint .

# Auto-fix
pnpm eslint --fix .

# Specific file
pnpm eslint src/utils/validate.ts

# Speed up with cache
pnpm eslint --cache .
pnpm eslint --cache --cache-location .eslintcache .

# Debug (check which rules are being applied)
pnpm eslint --print-config src/index.ts
pnpm eslint --debug src/index.ts

# Add scripts to package.json
# {
#   "scripts": {
#     "lint": "eslint .",
#     "lint:fix": "eslint --fix .",
#     "lint:cache": "eslint --cache ."
#   }
# }
```

### 2.6 Creating Custom Rules

```javascript
// eslint-rules/no-hardcoded-credentials.js
/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "ハードコードされた認証情報を禁止する",
    },
    messages: {
      hardcodedCredential: "認証情報をハードコードしないでください。環境変数を使用してください。",
    },
    schema: [],
  },
  create(context) {
    const suspiciousPatterns = [
      /password\s*[:=]\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
      /secret\s*[:=]\s*['"][^'"]+['"]/i,
      /token\s*[:=]\s*['"][^'"]+['"]/i,
    ];

    return {
      Literal(node) {
        if (typeof node.value === "string") {
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(`${context.getSourceCode().getText(node.parent)}`)) {
              context.report({
                node,
                messageId: "hardcodedCredential",
              });
            }
          }
        }
      },
    };
  },
};
```

---

## 3. Prettier

### 3.1 Setup

```bash
# Install
pnpm add -D prettier

# Avoid conflicts with ESLint
pnpm add -D eslint-config-prettier

# Plugins
pnpm add -D prettier-plugin-tailwindcss    # Tailwind class sorting
pnpm add -D prettier-plugin-organize-imports  # Import sorting
pnpm add -D @ianvs/prettier-plugin-sort-imports  # Import sorting (advanced)
pnpm add -D prettier-plugin-prisma          # Prisma schema
pnpm add -D prettier-plugin-packagejson     # package.json sorting
```

### 3.2 Configuration File

```jsonc
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSameLine": false,
  "singleAttributePerLine": false,
  "htmlWhitespaceSensitivity": "css",
  "proseWrap": "preserve",
  "plugins": [
    "prettier-plugin-tailwindcss",
    "prettier-plugin-packagejson"
  ],
  "overrides": [
    {
      "files": "*.md",
      "options": {
        "printWidth": 100,
        "proseWrap": "always"
      }
    },
    {
      "files": "*.json",
      "options": {
        "trailingComma": "none"
      }
    },
    {
      "files": ["*.yml", "*.yaml"],
      "options": {
        "tabWidth": 2,
        "singleQuote": false
      }
    }
  ]
}
```

```bash
# .prettierignore
dist/
build/
node_modules/
coverage/
.next/
.turbo/
pnpm-lock.yaml
package-lock.json
yarn.lock
*.min.js
*.min.css
```

### 3.3 ESLint + Prettier Integration

```javascript
// Add to eslint.config.js
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  // ...existing config...

  // Disable rules that conflict with Prettier (must be placed last)
  prettierConfig,
);
```

```
Role separation for ESLint + Prettier:

  ┌─────────────────────────────────────┐
  │         Prettier (Formatter)         │
  │  Indentation, line breaks, quotes,  │
  │  semicolons → handles all appearance │
  └──────────────┬──────────────────────┘
                 │
                 │  eslint-config-prettier
                 │  (turns OFF ESLint rules
                 │   that conflict with Prettier)
                 │
  ┌──────────────┴──────────────────────┐
  │          ESLint (Linter)             │
  │  Type safety, unused vars, pattern  │
  │  detection → handles code quality   │
  └─────────────────────────────────────┘

  Recommended execution order:
  1. ESLint --fix (apply auto-fixable rules)
  2. Prettier --write (unify formatting)

  Example lint-staged configuration:
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
```

### 3.4 Key Prettier Options Explained

```
Commonly debated options and their recommended values:

┌─────────────────────┬──────────────┬─────────────────────────┐
│ Option              │ Recommended  │ Reason                  │
├─────────────────────┼──────────────┼─────────────────────────┤
│ semi                │ true         │ Avoid ASI pitfalls      │
│ singleQuote         │ true         │ Fewer keystrokes        │
│ trailingComma       │ "all"        │ Cleaner diffs           │
│ printWidth          │ 80           │ Readable in split view  │
│ tabWidth            │ 2            │ JS/TS convention        │
│ arrowParens         │ "always"     │ Easier to add type ann. │
│ endOfLine           │ "lf"         │ Eliminate OS differences│
│ bracketSameLine     │ false        │ Readability first       │
└─────────────────────┴──────────────┴─────────────────────────┘

* These are matters of convention. Use values agreed upon by the team and end the debate.
* Prettier's philosophy: "fewer options, less debate"
```

---

## 4. Biome (Fast All-in-One)

### 4.1 Setup

```bash
# Install
pnpm add -D @biomejs/biome

# Initial setup
pnpm biome init

# Migrate from ESLint / Prettier
pnpm biome migrate eslint --write
pnpm biome migrate prettier --write
```

### 4.2 Configuration File

```jsonc
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noBannedTypes": "error",
        "noExcessiveCognitiveComplexity": {
          "level": "warn",
          "options": { "maxAllowedComplexity": 15 }
        },
        "noForEach": "warn",
        "useSimplifiedLogicExpression": "warn"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn",
        "noConstAssign": "error",
        "noUndeclaredVariables": "error"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error",
        "useTemplate": "error",
        "useBlockStatements": "error",
        "noParameterAssign": "error",
        "useDefaultParameterLast": "error"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noDoubleEquals": "error",
        "noConfusingVoidType": "error",
        "noArrayIndexKey": "warn",
        "noConsoleLog": "warn"
      },
      "security": {
        "noDangerouslySetInnerHtml": "error"
      },
      "a11y": {
        "noBlankTarget": "error",
        "useAltText": "error",
        "useValidAnchor": "error",
        "useKeyWithClickEvents": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    },
    "parser": {
      "unsafeParameterDecoratorsEnabled": true
    }
  },
  "json": {
    "formatter": {
      "trailingCommas": "none"
    }
  },
  "css": {
    "formatter": {
      "indentStyle": "space",
      "indentWidth": 2
    },
    "linter": {
      "enabled": true
    }
  },
  "files": {
    "ignore": [
      "dist/",
      "build/",
      "node_modules/",
      ".next/",
      "coverage/",
      "*.min.js",
      "*.min.css"
    ],
    "maxSize": 1048576
  },
  "overrides": [
    {
      "include": ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off",
            "noConsoleLog": "off"
          }
        }
      }
    }
  ]
}
```

### 4.3 Biome Commands

```bash
# ─── Lint ───
pnpm biome lint .
pnpm biome lint --write .          # Auto-fix

# ─── Format ───
pnpm biome format .
pnpm biome format --write .        # Apply formatting

# ─── Check only (for CI) ───
pnpm biome check .                 # Check lint + format simultaneously
pnpm biome ci .                    # CI mode (exit non-zero on error)

# ─── Full auto-fix ───
pnpm biome check --write .        # Apply lint fix + format simultaneously

# ─── Sort imports ───
pnpm biome check --write --organize-imports-enabled=true .

# ─── Specific files ───
pnpm biome lint src/utils/validate.ts
pnpm biome format src/components/Button.tsx
```

### 4.4 ESLint + Prettier vs Biome Comparison

| Aspect | ESLint + Prettier | Biome |
|------|-------------------|-------|
| Speed | 1x (baseline) | 20-100x |
| Number of config files | 2-3 | 1 |
| Plugins | Rich (1000+) | Limited |
| TypeScript support | Type-check integration available | Syntax-based only |
| CSS support | Requires separate Stylelint | Built-in |
| JSON support | Limited | Built-in (format + lint) |
| Import sorting | eslint-plugin-import | Built-in |
| Ecosystem maturity | Very high | Growing |
| Migration cost | - | Automated with `biome migrate` |
| Recommendation | Large-scale / custom | Fast & simple |
| Memory usage | High (Node.js) | Low (Rust native) |
| VS Code extension | Separate per tool | Single extension |

### 4.5 Gradual Migration from ESLint to Biome

```bash
# Step 1: Migration analysis
pnpm biome migrate eslint --include-inspired
# → Shows which rules can be migrated to Biome

# Step 2: Generate biome.json
pnpm biome migrate eslint --write
pnpm biome migrate prettier --write

# Step 3: Parallel operation period
# - Lint + format with Biome
# - Keep ESLint only for type-check integration rules
# - Run both in CI and compare results

# Step 4: Remove ESLint
pnpm remove eslint eslint-config-prettier @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser eslint-plugin-import prettier
```

---

## 5. Ruff (Python)

### 5.1 Setup

```bash
# Install
pip install ruff
# or
brew install ruff
# or with uv
uv add --dev ruff
# or with pipx
pipx install ruff
```

### 5.2 Configuration

```toml
# pyproject.toml
[tool.ruff]
target-version = "py312"
line-length = 88
indent-width = 4
fix = true

# Specify source directories
src = ["src", "tests"]

# Exclusion patterns
exclude = [
    ".git",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    "*.egg-info",
    "migrations",
]

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # Pyflakes
    "I",    # isort (import sorting)
    "N",    # pep8-naming
    "UP",   # pyupgrade (detect outdated syntax)
    "B",    # flake8-bugbear (detect bug candidates)
    "SIM",  # flake8-simplify (simplifiable code)
    "C4",   # flake8-comprehensions (optimize comprehensions)
    "DTZ",  # flake8-datetimez (timezone-related)
    "T20",  # flake8-print (detect print statements)
    "RUF",  # Ruff-specific rules
    "ANN",  # flake8-annotations (type hints)
    "S",    # flake8-bandit (security)
    "PT",   # flake8-pytest-style (pytest style)
    "RET",  # flake8-return (return statements)
    "ARG",  # flake8-unused-arguments (unused arguments)
    "ERA",  # eradicate (commented-out code)
    "PL",   # Pylint (partial rules)
    "PERF", # Perflint (performance)
    "FURB", # refurb (modern Python)
]
ignore = [
    "E501",   # line too long (delegate to formatter)
    "ANN101", # self type hint (unnecessary)
    "ANN102", # cls type hint (unnecessary)
    "ANN401", # Any type (case-by-case)
]

# Auto-fixable rules
fixable = ["ALL"]
unfixable = []

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = ["T20", "S101", "ANN"]  # Allow print, assert, omit type hints in tests
"conftest.py" = ["ANN"]
"__init__.py" = ["F401"]  # Unused imports for re-exports

[tool.ruff.lint.isort]
known-first-party = ["myproject"]
force-single-line = false
lines-after-imports = 2

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
skip-magic-trailing-comma = false
line-ending = "auto"
docstring-code-format = true
docstring-code-line-length = 72
```

### 5.3 Run Commands

```bash
# ─── Lint ───
ruff check .
ruff check --fix .              # Auto-fix
ruff check --fix --unsafe-fixes . # Include unsafe fixes

# ─── Format ───
ruff format .
ruff format --check .           # Check only (for CI)
ruff format --diff .            # Show diff

# ─── Check specific rules ───
ruff rule E501                  # Detailed explanation of a rule
ruff linter                     # List available rules

# ─── Check configuration ───
ruff check --show-settings      # Show current settings
ruff check --statistics         # Violation statistics

# Ruff replaces Flake8 + isort + Black + pyupgrade in a single tool
# 10-100x faster than Flake8
```

### 5.4 Using with mypy

```toml
# pyproject.toml (mypy configuration)
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_any_generics = true
check_untyped_defs = true

# Library stubs
module = ["redis.*", "celery.*"]
ignore_missing_imports = true
```

```
Role separation between Ruff and mypy:

  Ruff (fast):
  ├── Style checking (PEP 8)
  ├── Bug candidate detection (Bugbear)
  ├── Security checking (Bandit)
  ├── Import sorting (isort)
  ├── Code formatting (Black-compatible)
  └── Convert to modern syntax (pyupgrade)

  mypy (type checking):
  ├── Validate type consistency
  ├── Validate type guards
  ├── Validate generics
  └── Validate None checks

  Execution order:
  1. ruff check --fix .  (fast: milliseconds)
  2. ruff format .       (fast: milliseconds)
  3. mypy .              (slow: seconds to minutes)
```

---

## 6. Stylelint (CSS / SCSS)

### 6.1 Setup

```bash
# Install
pnpm add -D stylelint stylelint-config-standard

# For SCSS
pnpm add -D stylelint-config-standard-scss

# For CSS-in-JS
pnpm add -D postcss-styled-syntax

# Integration with Prettier
pnpm add -D stylelint-config-prettier-scss

# Property ordering
pnpm add -D stylelint-order stylelint-config-recess-order
```

### 6.2 Configuration File

```jsonc
// .stylelintrc.json
{
  "extends": [
    "stylelint-config-standard-scss",
    "stylelint-config-recess-order",
    "stylelint-config-prettier-scss"
  ],
  "plugins": [
    "stylelint-order"
  ],
  "rules": {
    "color-named": "never",
    "color-hex-length": "short",
    "declaration-no-important": true,
    "selector-max-id": 0,
    "selector-max-specificity": "0,3,3",
    "max-nesting-depth": 3,
    "no-descending-specificity": true,
    "font-family-name-quotes": "always-where-recommended",
    "scss/dollar-variable-pattern": "^[a-z][a-z0-9-]*$",
    "scss/at-mixin-pattern": "^[a-z][a-z0-9-]*$",
    "selector-class-pattern": [
      "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
      { "message": "BEM パターンを使用してください" }
    ]
  },
  "ignoreFiles": [
    "dist/**",
    "node_modules/**",
    "coverage/**"
  ]
}
```

### 6.3 Notes for Tailwind CSS Projects

```jsonc
// .stylelintrc.json (Tailwind support)
{
  "extends": ["stylelint-config-standard"],
  "rules": {
    "at-rule-no-unknown": [true, {
      "ignoreAtRules": [
        "tailwind",
        "apply",
        "layer",
        "config",
        "screen",
        "variants",
        "responsive"
      ]
    }],
    "function-no-unknown": [true, {
      "ignoreFunctions": ["theme", "screen"]
    }],
    "no-descending-specificity": null
  }
}
```

---

## 7. Pre-commit Hooks

### 7.1 lint-staged + husky

```bash
# Install
pnpm add -D husky lint-staged

# Initialize husky
pnpm husky init
```

```jsonc
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --cache",
      "prettier --write"
    ],
    "*.{js,jsx,mjs,cjs}": [
      "eslint --fix --cache",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ],
    "*.{css,scss}": [
      "stylelint --fix",
      "prettier --write"
    ],
    "*.py": [
      "ruff check --fix",
      "ruff format"
    ],
    "*.prisma": [
      "prettier --write"
    ],
    "package.json": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

### 7.2 Fast lint-staged with Biome

```jsonc
// package.json (Biome version)
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json,css}": [
      "biome check --write --no-errors-on-unmatched"
    ],
    "*.{md,yml,yaml}": [
      "prettier --write"
    ],
    "*.py": [
      "ruff check --fix",
      "ruff format"
    ]
  }
}
```

### 7.3 How the Pre-commit Flow Works

```
Flow when running git commit:

  git commit -m "Add feature"
       │
       ▼
  ┌──────────────────────┐
  │  husky (pre-commit)   │
  │       │               │
  │       ▼               │
  │  lint-staged          │
  │  (targets only        │
  │   staged files)       │
  │       │               │
  │       ├── *.ts,*.tsx  │
  │       │   → eslint    │
  │       │   → prettier  │
  │       │               │
  │       ├── *.json,*.md │
  │       │   → prettier  │
  │       │               │
  │       ├── *.css,*.scss│
  │       │   → stylelint │
  │       │   → prettier  │
  │       │               │
  │       └── *.py        │
  │           → ruff      │
  │                       │
  │  All pass?            │
  │  ├── Yes → Commit     │
  │  └── No  → Abort      │
  │           commit + err│
  └──────────────────────┘

  Key points:
  - Only staged files are targeted (not all files)
  - --fix / --write auto-fixes and re-stages the result
  - In CI, use --check mode to verify only (no fixes)
  - lint-staged v15+ re-stages fixed files by default
```

### 7.4 lefthook (Alternative to husky)

```yaml
# lefthook.yml (alternative to husky + lint-staged)
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx}"
      run: pnpm eslint --fix {staged_files} && pnpm prettier --write {staged_files}
      stage_fixed: true
    format-json:
      glob: "*.{json,md}"
      run: pnpm prettier --write {staged_files}
      stage_fixed: true
    python:
      glob: "*.py"
      run: ruff check --fix {staged_files} && ruff format {staged_files}
      stage_fixed: true
```

```bash
# lefthook setup
pnpm add -D lefthook
pnpm lefthook install
```

---

## 8. Editor Integration

### 8.1 VS Code Settings

```jsonc
// .vscode/settings.json
{
  // ─── Default formatter ───
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.formatOnPaste": false,

  // ─── ESLint integration ───
  "eslint.enable": true,
  "eslint.useFlatConfig": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"
  },

  // ─── Language-specific formatters ───
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[css]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[scss]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.codeActionsOnSave": {
      "source.fixAll.ruff": "explicit",
      "source.organizeImports.ruff": "explicit"
    }
  },
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },

  // ─── Stylelint integration ───
  "stylelint.validate": ["css", "scss"],
  "css.validate": false,
  "scss.validate": false,

  // ─── File settings ───
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,

  // ─── Optimize formatOnSave ───
  "editor.formatOnSaveMode": "modificationsIfAvailable"
}
```

### 8.2 Recommended VS Code Extensions

```jsonc
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "stylelint.vscode-stylelint",
    "charliermarsh.ruff",
    "bradlc.vscode-tailwindcss",
    "EditorConfig.EditorConfig",
    "Prisma.prisma"
  ],
  "unwantedRecommendations": [
    // When using Biome, mark ESLint + Prettier as unwanted
    // "biomejs.biome"
  ]
}
```

### 8.3 VS Code Settings for Biome

```jsonc
// .vscode/settings.json (Biome version)
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### 8.4 EditorConfig

```ini
# .editorconfig (basic cross-editor settings)
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.py]
indent_size = 4

[Makefile]
indent_style = tab

[*.{yml,yaml}]
indent_size = 2

[*.go]
indent_style = tab
indent_size = 4
```

---

## 9. CI Integration

### 9.1 GitHub Actions (ESLint + Prettier)

```yaml
# .github/workflows/lint.yml
name: Lint & Format
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # ESLint (with cache)
      - name: Lint
        run: pnpm eslint --cache .

      # Format check (no fixes -- detect diff)
      - name: Format check
        run: pnpm prettier --check .

      # Type check
      - name: Typecheck
        run: pnpm tsc --noEmit

  lint-python:
    runs-on: ubuntu-latest
    if: ${{ hashFiles('**/*.py') != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - run: pip install ruff mypy

      - name: Ruff lint
        run: ruff check .

      - name: Ruff format check
        run: ruff format --check .

      - name: Mypy
        run: mypy .
```

### 9.2 GitHub Actions (Biome)

```yaml
# .github/workflows/lint-biome.yml
name: Lint (Biome)
on: [push, pull_request]

jobs:
  biome:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Biome CI
        run: pnpm biome ci .
```

### 9.3 Auto-posting PR Review Comments

```yaml
# .github/workflows/lint-review.yml
name: Lint Review
on: pull_request

jobs:
  lint-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # Post ESLint results as PR comments
      - name: ESLint
        uses: reviewdog/action-eslint@v1
        with:
          reporter: github-pr-review
          eslint_flags: '.'
```

---

## 10. Configuration Sharing in Monorepos

### 10.1 Structure of a Shared Config Package

```
packages/config/
├── package.json
├── eslint/
│   ├── base.js          # JavaScript/TypeScript base rules
│   ├── react.js         # React rules (extends base)
│   ├── next.js          # Next.js rules (extends react)
│   └── node.js          # Node.js backend rules
├── prettier/
│   └── index.json       # Shared Prettier config
├── tsconfig/
│   ├── base.json        # TypeScript base config
│   ├── react.json       # React (enable JSX)
│   ├── nextjs.json      # Next.js
│   └── node.json        # Node.js backend
├── stylelint/
│   └── index.json       # Shared Stylelint config
└── biome/
    └── biome.json       # Shared Biome config (alternative setup)
```

```jsonc
// packages/config/package.json
{
  "name": "@repo/config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./eslint/base": "./eslint/base.js",
    "./eslint/react": "./eslint/react.js",
    "./eslint/next": "./eslint/next.js",
    "./eslint/node": "./eslint/node.js",
    "./prettier": "./prettier/index.json",
    "./tsconfig/base": "./tsconfig/base.json",
    "./tsconfig/react": "./tsconfig/react.json",
    "./tsconfig/nextjs": "./tsconfig/nextjs.json",
    "./tsconfig/node": "./tsconfig/node.json",
    "./stylelint": "./stylelint/index.json"
  },
  "dependencies": {
    "@eslint/js": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "eslint-plugin-react": "^7.35.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-jsx-a11y": "^6.9.0",
    "@next/eslint-plugin-next": "^14.2.0",
    "eslint-config-prettier": "^9.1.0",
    "globals": "^15.0.0"
  }
}
```

---

## 11. Anti-patterns

### 11.1 Making ESLint Do the Formatter's Job

```
Anti-pattern: using ESLint to enforce indentation and quotes

  eslint.config.js:
    rules: {
      "indent": ["error", 2],           // ← Formatter's job
      "quotes": ["error", "single"],     // ← Formatter's job
      "semi": ["error", "always"],       // ← Formatter's job
      "max-len": ["error", 80],          // ← Formatter's job
      "comma-dangle": ["error", "always-multiline"], // ← Formatter's job
    }

Problems:
  - Conflict with Prettier causes infinite fix loops
  - ESLint runs slower
  - Duplicated responsibilities increase maintenance cost

Correct approach:
  - Delegate appearance rules to Prettier
  - Disable conflicting rules with eslint-config-prettier
  - Have ESLint focus solely on code quality checks
  - Disable all ESLint stylistic rules
```

### 11.2 Not Sharing Configuration Across the Team

```
Anti-pattern: each developer uses their own Linter configuration

Problems:
  - PR diffs are buried in style changes
  - Code reviews derail over "personal preferences"
  - A different config runs in CI and causes errors
  - Difficult onboarding for new team members

Correct approach:
  - Commit config files to the repository
  - Enforce formatOnSave via .vscode/settings.json
  - Suggest recommended extensions via .vscode/extensions.json
  - Enforce formatting with pre-commit hooks
  - Gate with --check mode in CI
  - Set baseline cross-editor config with EditorConfig
```

### 11.3 Enabling All Rules

```
Anti-pattern: enabling recommended + all plugins

Problems:
  - Rules can conflict with each other
  - Overly strict settings slow down development
  - Time wasted dealing with meaningless lint errors
  - Overuse of // eslint-disable

Correct approach:
  - Start from recommended and add only project-needed rules
  - Use warn and error appropriately:
    - error: security, type safety (never acceptable)
    - warn: code quality (should improve but not urgent)
  - Tighten gradually (start with recommended only)
```

### 11.4 Running Lint Only in CI

```
Anti-pattern: not linting locally, discovering errors in CI for the first time

Problems:
  - Slow cycle of CI error → fix → re-push
  - Poor developer experience
  - Wastes CI compute resources

Correct approach:
  - Editor integration: formatOnSave + codeActionsOnSave
  - Pre-commit hook: check only diffs with lint-staged
  - CI: final gate with --check mode (no fixes)
  - Three-layer defense to ensure quality
```


---

## Practice Exercises

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
    assert ex.add("d", 4) == False  # Size limit
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
- Measure effectiveness with benchmarks
---

## 12. FAQ

### Q1: Can Biome completely replace ESLint + Prettier?

**A:** This is possible for most projects, but ESLint is still required in the following cases:
- You want to use rules that depend on TypeScript type information (the `no-unsafe-*` family, `no-floating-promises`)
- You depend on specific plugins like eslint-plugin-react-hooks
- You have self-made custom rules
- You need the advanced import rules of eslint-plugin-import

For new projects with no special requirements, Biome is simpler and faster. For projects with complex existing ESLint configurations, consider a gradual migration using `biome migrate`. A hybrid setup (Biome for formatting + ESLint only for type-check integration rules) is also effective.

### Q2: What should I do if formatOnSave is slow?

**A:**
1. Set `editor.formatOnSaveMode` to `"modificationsIfAvailable"` (format only changed lines)
2. Switch to Biome (20-100x faster than Prettier)
3. Exclude unnecessary files in `.prettierignore`
4. Check that ESLint `codeActionsOnSave` and Prettier `formatOnSave` are not running twice
5. Enable ESLint cache (`eslint --cache`)
6. Set `eslint.codeActionsOnSave.mode` to `"problems"`
7. Adjust `editor.formatOnSaveTimeout` for large files

### Q3: Is Ruff alone sufficient as a Python Linter + Formatter?

**A:** Yes. Ruff provides the functionality of Flake8, isort, Black, pyupgrade, flake8-bugbear, flake8-bandit, and more in a single tool. It is 10-100x faster than Flake8. As of 2025, Ruff has become the de facto standard for new Python projects. However, mypy (type checking) is still required separately. Ruff performs only syntax-based analysis and does not perform checks based on type information.

### Q4: Can ESLint Flat Config and Legacy Config coexist?

**A:** No. ESLint v9 only supports Flat Config. However, you can temporarily revert to legacy mode with the `ESLINT_USE_FLAT_CONFIG=false` environment variable (only during v9.x). If a plugin has not yet been updated for Flat Config, use `fixupPluginRules` from the `@eslint/compat` package as a compatibility shim.

### Q5: What if I want different ESLint configurations for each package in a monorepo?

**A:** Prepare multiple configuration presets in a shared config package (`@repo/config`) and import the appropriate one in each package's `eslint.config.js`. For example, `@repo/config/eslint/react` for the frontend and `@repo/config/eslint/node` for the backend. Each package's `eslint.config.js` extends a preset and then adds package-specific rules on top.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and rushing to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Ecosystem | Linter | Formatter | Recommendation |
|------------|--------|-----------|--------|
| JS/TS (standard) | ESLint v9 | Prettier | Most versatile |
| JS/TS (fast) | Biome | Biome | Simple, ideal for new projects |
| JS/TS (hybrid) | ESLint (type rules) + Biome (rest) | Biome | Balanced approach |
| Python | Ruff + mypy | Ruff | De facto standard |
| CSS/SCSS | Stylelint | Prettier | CSS-specific |
| Pre-commit | husky + lint-staged / lefthook | - | Essentially required |
| CI | `--check` mode | `--check` mode | Gate required |
| Editor | VS Code + each extension | formatOnSave | Automation required |
| Monorepo | Share via packages/config/ | Same | Centralized config management |

---

## Further Reading

- [02-monorepo-setup.md](./02-monorepo-setup.md) -- Sharing configuration in monorepos
- [../00-editor-and-tools/00-vscode-setup.md](../00-editor-and-tools/00-vscode-setup.md) -- VS Code integration settings
- [../03-team-setup/00-project-standards.md](../03-team-setup/00-project-standards.md) -- Defining team standard rules

---

## References

1. **ESLint v9 Flat Config** -- https://eslint.org/docs/latest/use/configure/configuration-files -- Official guide to the new ESLint v9 configuration format.
2. **Biome Documentation** -- https://biomejs.dev/guides/getting-started/ -- Official Biome documentation. Includes a migration guide from ESLint.
3. **Ruff Documentation** -- https://docs.astral.sh/ruff/ -- Official Ruff docs. Supported rule list and benchmarks.
4. **Prettier Options** -- https://prettier.io/docs/en/options -- Explanation of all Prettier options.
5. **typescript-eslint** -- https://typescript-eslint.io/ -- Official TypeScript ESLint site. Details on type-check integration.
6. **Stylelint** -- https://stylelint.io/ -- Official documentation for the CSS/SCSS Linter.
7. **lint-staged** -- https://github.com/lint-staged/lint-staged -- Tool for running lint only on staged files.
8. **lefthook** -- https://github.com/evilmartians/lefthook -- A fast alternative to husky + lint-staged.
