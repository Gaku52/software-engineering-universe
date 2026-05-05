# Environment Configuration

> Environment configuration is the foundation of safe application operation. Learn best practices for securely managing configuration in production, covering environment variable management, Feature Flags, configuration layering, and secret management.

## Prerequisites

To get the most out of this guide, we recommend having the following knowledge beforehand.

- **Concept of environment variables**: OS-level environment variables and how to inject them into processes
- **12-Factor App principles**: In particular, understanding the third factor — "Config"

## What You Will Learn

- [ ] Understand environment variable design and secure management
- [ ] Learn patterns for separating configuration per environment
- [ ] Understand how to implement and operate Feature Flags
- [ ] Learn best practices for secret management
- [ ] Understand configuration management based on the 12-Factor App
- [ ] Learn how to pass environment variables in CI/CD pipelines
- [ ] Implement configuration validation and fail-fast strategies
- [ ] Learn troubleshooting techniques for multi-environment operations

---

## 1. Fundamentals of Environment Configuration

### 1.1 Why Environment Configuration Matters

In application development, configuration management is often overlooked, yet it is an extremely important area that directly affects security, operational stability, and development efficiency.

```
Examples of incidents caused by environment configuration:

  Case 1: Production DB credentials leaked to GitHub
    Cause: .env file accidentally committed to Git
    Impact: Entire database exposed externally, user data leaked
    Countermeasure: Enforce .gitignore, check with pre-commit hook

  Case 2: Staging environment calls production API
    Cause: Configuration error — API_URL was pointing to production
    Impact: Test data mixed into production, impact on customers
    Countermeasure: Strict separation of per-environment config, startup validation

  Case 3: Incomplete feature exposed in production due to missing Feature Flag
    Cause: Feature Flag environment variable not set at deploy time
    Impact: Incomplete UI shown to users, flood of bug reports
    Countermeasure: Set appropriate default values, deployment checklist

  Case 4: Debug mode left enabled in production
    Cause: NODE_ENV was still 'development' when deployed
    Impact: Stack traces exposed externally, security risk
    Countermeasure: Environment check at startup, automated verification in CI/CD
```

### 1.2 12-Factor App and Configuration Management

In the 12-Factor App principles proposed by Heroku engineers, Config is defined as the third factor. These principles form the foundation of modern cloud-native applications.

```
Config principles in the 12-Factor App:

  ① Strictly separate config from code
     - Inject externally as environment variables
     - Do not include config files in the code repository
     - The same codebase runs in all environments

  ② Express differences between environments through config only
     - Differences between development / staging / production are config only
     - Do not branch on environment in code logic
     - Build artifacts are identical across all environments

  ③ Config may change per deploy
     - Config can be changed without code changes
     - Config changes can be applied without redeployment
     - Config change history can be tracked

The 12 factors of the 12-Factor App:
  I.    Codebase (One codebase, many deploys)
  II.   Dependencies (Explicitly declare and isolate dependencies)
  III.  Config (Store config in the environment) ← ★ This chapter's topic
  IV.   Backing services (Treat backing services as attached resources)
  V.    Build, release, run (Strictly separate build and run stages)
  VI.   Processes (Execute the app as one or more stateless processes)
  VII.  Port binding (Export services via port binding)
  VIII. Concurrency (Scale out via the process model)
  IX.   Disposability (Maximize robustness with fast startup and graceful shutdown)
  X.    Dev/prod parity (Keep development, staging, and production as similar as possible)
  XI.   Logs (Treat logs as event streams)
  XII.  Admin processes (Run admin/management tasks as one-off processes)
```

### 1.3 Environment Hierarchy and Types

```
Typical environment hierarchy:

  ┌──────────────────────────────────────────────────┐
  │  local (developer's machine)                      │
  │  ├── Override settings with personal .env.local   │
  │  ├── Hot reload enabled                           │
  │  └── Debug tools enabled                          │
  ├──────────────────────────────────────────────────┤
  │  development (shared development environment)     │
  │  ├── Server shared by the entire dev team         │
  │  ├── Connects to external services for testing    │
  │  └── Close to production config but minimal resources │
  ├──────────────────────────────────────────────────┤
  │  staging (staging environment)                    │
  │  ├── Nearly identical configuration to production │
  │  ├── Runs on a subset of production data          │
  │  ├── Runs QA tests and acceptance tests           │
  │  └── Final check before production deployment     │
  ├──────────────────────────────────────────────────┤
  │  production (production environment)              │
  │  ├── The environment actual users access          │
  │  ├── Highest level of security settings           │
  │  ├── Full monitoring and alerting                 │
  │  └── Performance optimized                        │
  └──────────────────────────────────────────────────┘

  Additional environments (for large-scale projects):
  ├── preview / PR environment: Temporary environment auto-created per PR
  ├── canary: Environment receiving only a portion of production traffic
  ├── sandbox: Testing environment for external partners
  └── disaster-recovery: Standby environment to switch to in case of disaster

.env file priority (Next.js):
  .env                  ← Default (common to all environments)
  .env.local            ← Local override (.gitignore)
  .env.development      ← Development environment specific
  .env.development.local← Local override for development
  .env.staging          ← Staging specific
  .env.production       ← Production environment specific
  .env.production.local ← Local override for production (.gitignore)

  Load priority (last wins):
  .env < .env.local < .env.[NODE_ENV] < .env.[NODE_ENV].local
```

---

## 2. Environment Variable Design

### 2.1 Naming Conventions and Prefixes

It is important to keep environment variable naming consistent. Defining clear naming conventions makes the purpose of each variable immediately clear and helps prevent configuration mistakes.

```
Basic principles of naming conventions:

  ✅ Recommended pattern:
    Use SCREAMING_SNAKE_CASE
    ├── DATABASE_URL          → Database connection target
    ├── REDIS_HOST            → Redis host name
    ├── AWS_ACCESS_KEY_ID     → AWS access key
    ├── SMTP_PORT             → Mail server port
    └── LOG_LEVEL             → Log level

  ✅ Classification by prefix:
    By service:
    ├── DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    ├── REDIS_URL, REDIS_PASSWORD, REDIS_DB
    ├── AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    ├── STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
    ├── SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
    └── SENTRY_DSN, SENTRY_ENVIRONMENT

    By feature:
    ├── ENABLE_ANALYTICS      → Enable/disable analytics
    ├── ENABLE_RATE_LIMIT     → Enable/disable rate limiting
    ├── IS_MAINTENANCE_MODE   → Maintenance mode flag
    ├── HAS_PREMIUM_FEATURES  → Whether premium features are available
    └── MAX_UPLOAD_SIZE       → Upload size limit

    By exposure scope (Next.js):
    ├── NEXT_PUBLIC_API_URL   → Exposed to client
    ├── NEXT_PUBLIC_GA_ID     → Google Analytics ID
    ├── DATABASE_URL          → Server only (sensitive)
    └── JWT_SECRET            → Server only (sensitive)

  ❌ Anti-patterns:
    ├── KEY           → Unclear what key it is
    ├── SECRET        → Unclear what secret it is
    ├── URL           → Unclear what URL it is
    ├── password      → Not SCREAMING_SNAKE_CASE
    ├── ApiKey        → Do not use camelCase
    └── my-config     → Hyphens are not allowed (causes issues in shell)

Public prefixes by framework:
  ┌─────────────────┬──────────────────────┬───────────────────┐
  │ Framework       │ Public prefix        │ Private (server)  │
  ├─────────────────┼──────────────────────┼───────────────────┤
  │ Next.js         │ NEXT_PUBLIC_         │ No prefix         │
  │ Vite            │ VITE_                │ No prefix         │
  │ Create React App│ REACT_APP_           │ No prefix         │
  │ Nuxt.js         │ NUXT_PUBLIC_         │ NUXT_ or none     │
  │ SvelteKit       │ PUBLIC_              │ No prefix         │
  │ Remix           │ None (all server)    │ All               │
  │ Astro           │ PUBLIC_              │ No prefix         │
  └─────────────────┴──────────────────────┴───────────────────┘
```

### 2.2 Type-Safe Environment Variable Management (Zod)

In TypeScript projects, applying schema validation with Zod to environment variables ensures type safety and allows early detection of configuration errors at startup.

```typescript
// ============================================
// config/env.ts - Type-safe environment variable management
// ============================================
import { z } from 'zod';

// ---- Server-side environment variable schema ----
const serverEnvSchema = z.object({
  // Application basic settings
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url()
    .refine(url => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string',
    }),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DATABASE_SSL: z.coerce.boolean().default(true),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(32).optional(),

  // External services
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  SENDGRID_API_KEY: z.string().startsWith('SG.'),
  SENTRY_DSN: z.string().url().optional(),

  // AWS
  AWS_REGION: z.string().default('ap-northeast-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),

  // Feature flags
  ENABLE_RATE_LIMIT: z.coerce.boolean().default(true),
  ENABLE_CORS: z.coerce.boolean().default(true),
  ENABLE_SWAGGER: z.coerce.boolean().default(false),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

// ---- Client-side environment variable schema ----
const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_GA_ID: z.string().startsWith('G-').optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_PUBLIC_KEY: z.string().startsWith('pk_'),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  NEXT_PUBLIC_APP_VERSION: z.string().default('0.0.0'),
});

// ---- Validation and export ----
function validateEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined>,
  label: string
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${(msgs as string[]).join(', ')}`)
      .join('\n');

    console.error(`\nEnvironment variable validation error for ${label}:\n${errorMessages}\n`);

    // Show details in development; stop with minimal info in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Startup aborted due to configuration error in production environment.');
    } else {
      console.error('Please set the required environment variables in .env.local.');
      console.error('Reference: check .env.example.');
    }

    process.exit(1);
  }

  return result.data;
}

// Run only server-side (do not include in client bundle)
export const serverEnv = typeof window === 'undefined'
  ? validateEnv(serverEnvSchema, process.env, 'server')
  : ({} as z.infer<typeof serverEnvSchema>);

// Also available on the client side
export const clientEnv = validateEnv(clientEnvSchema, process.env, 'client');

// Integrated export
export const env = { ...serverEnv, ...clientEnv };

// Type exports
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
```

### 2.3 Testing Environment Variable Validation

```typescript
// ============================================
// config/__tests__/env.test.ts
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Test schema (using the same definition as production)
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

describe('Environment variable validation', () => {
  const validEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb',
    JWT_SECRET: 'a-very-long-secret-key-that-is-at-least-32-characters',
    PORT: '8080',
  };

  it('valid environment variables are parsed correctly', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(8080); // Converted from string to number
      expect(result.data.NODE_ENV).toBe('production');
    }
  });

  it('invalid NODE_ENV is rejected', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NODE_ENV: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('DATABASE_URL in non-URL format is rejected', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      DATABASE_URL: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('JWT_SECRET that is too short is rejected', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      JWT_SECRET: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('default value for PORT is applied', () => {
    const { PORT, ...envWithoutPort } = validEnv;
    const result = envSchema.safeParse(envWithoutPort);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
    }
  });

  it('PORT out of range is rejected', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      PORT: '70000',
    });
    expect(result.success).toBe(false);
  });
});
```

### 2.4 Managing .env.example

Always include a `.env.example` in your project, listing all required environment variables along with their descriptions.

```bash
# ============================================
# .env.example
# Copy this file to .env.local and set the values
# cp .env.example .env.local
# ============================================

# ---- Application basic settings ----
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# ---- Database ----
# PostgreSQL connection string
# Local: postgresql://postgres:password@localhost:5432/myapp_dev
# Docker: postgresql://postgres:password@db:5432/myapp_dev
DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=false

# ---- Redis ----
# Local: redis://localhost:6379
# Docker: redis://redis:6379
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# ---- Authentication ----
# Set a random string of 32 characters or more
# Generate with: openssl rand -base64 48
JWT_SECRET=your-jwt-secret-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# ---- Stripe ----
# Get test keys from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxx

# ---- Email (SendGrid) ----
# Get from https://app.sendgrid.com/settings/api_keys
SENDGRID_API_KEY=SG.xxxxxxxxxxxx

# ---- Error monitoring (Sentry) ----
# Get DSN from https://sentry.io
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# ---- AWS ----
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET_NAME=myapp-dev-uploads

# ---- Frontend public settings ----
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_APP_VERSION=0.0.0

# ---- Feature flags ----
ENABLE_RATE_LIMIT=false
ENABLE_CORS=true
ENABLE_SWAGGER=true

# ---- Logging ----
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### 2.5 Automated Environment Variable Check Script

```typescript
// ============================================
// scripts/check-env.ts
// Check environment variable consistency before project startup
// ============================================
import fs from 'fs';
import path from 'path';

interface EnvCheckResult {
  missing: string[];
  empty: string[];
  warnings: string[];
}

function parseEnvFile(filePath: string): Map<string, string> {
  const envMap = new Map<string, string>();

  if (!fs.existsSync(filePath)) {
    return envMap;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comment lines and blank lines
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const key = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();
    envMap.set(key, value);
  }

  return envMap;
}

function checkEnv(): EnvCheckResult {
  const projectRoot = process.cwd();
  const exampleEnv = parseEnvFile(path.join(projectRoot, '.env.example'));
  const localEnv = parseEnvFile(path.join(projectRoot, '.env.local'));
  const envFile = parseEnvFile(path.join(projectRoot, '.env'));

  // Effective environment variables: .env → .env.local → process.env
  const effectiveEnv = new Map([...envFile, ...localEnv]);

  const result: EnvCheckResult = {
    missing: [],
    empty: [],
    warnings: [],
  };

  for (const [key, exampleValue] of exampleEnv) {
    const actualValue = effectiveEnv.get(key) || process.env[key];

    if (actualValue === undefined) {
      result.missing.push(key);
    } else if (actualValue === '' || actualValue === exampleValue) {
      // Value is empty or still the sample value
      if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD')) {
        result.warnings.push(`${key}: still using sample value or empty (sensitive information)`);
      } else if (actualValue === '') {
        result.empty.push(key);
      }
    }
  }

  // Check for variables without NEXT_PUBLIC_ being used on the client
  for (const [key] of effectiveEnv) {
    if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('PRIVATE')) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        result.warnings.push(
          `${key}: sensitive information is exposed with the NEXT_PUBLIC_ prefix!`
        );
      }
    }
  }

  return result;
}

// Execute
const result = checkEnv();

if (result.missing.length > 0) {
  console.error('\nUnset environment variables:');
  result.missing.forEach(key => console.error(`  - ${key}`));
}

if (result.empty.length > 0) {
  console.warn('\nEmpty environment variables:');
  result.empty.forEach(key => console.warn(`  - ${key}`));
}

if (result.warnings.length > 0) {
  console.warn('\nWarnings:');
  result.warnings.forEach(msg => console.warn(`  - ${msg}`));
}

if (result.missing.length === 0 && result.warnings.length === 0) {
  console.log('\nAll environment variables are correctly configured.');
}

// Exit with code 1 if required environment variables are missing
if (result.missing.length > 0) {
  process.exit(1);
}
```

### 2.6 Using Environment Variables in Each Framework

```typescript
// ============================================
// Using environment variables in Next.js
// ============================================

// 1. Server Component (App Router)
// Can directly access server-side environment variables
async function ServerComponent() {
  // Server-side only: OK
  const dbUrl = process.env.DATABASE_URL;
  const apiKey = process.env.STRIPE_SECRET_KEY;

  // NEXT_PUBLIC_ is also available on the server
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  const data = await fetch(publicApiUrl + '/api/data', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return <div>{/* ... */}</div>;
}

// 2. Client Component
'use client';
function ClientComponent() {
  // On the client side, only NEXT_PUBLIC_ variables are accessible
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;     // OK
  // const secret = process.env.DATABASE_URL;          // undefined (safe)

  return <div>API: {apiUrl}</div>;
}

// 3. API Route (App Router)
// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // All environment variables are accessible since this is server-side
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Webhook signature verification
  const signature = request.headers.get('stripe-signature');
  // ...
  return NextResponse.json({ received: true });
}

// 4. Environment variables in next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Embedded at build time (deprecated: use NEXT_PUBLIC_ instead)
    CUSTOM_VAR: process.env.CUSTOM_VAR,
  },
  // Runtime config (server-side only)
  serverRuntimeConfig: {
    apiSecret: process.env.API_SECRET,
  },
  // Public runtime config (also accessible from the client)
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
```

```typescript
// ============================================
// Using environment variables in Vite
// ============================================

// vite.config.ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load .env files according to mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      // Define custom variables globally
      __APP_VERSION__: JSON.stringify(env.npm_package_version),
    },
    server: {
      port: parseInt(env.VITE_DEV_PORT || '5173'),
    },
  };
});

// Usage in components
function App() {
  // Only variables with VITE_ prefix are accessible
  const apiUrl = import.meta.env.VITE_API_URL;
  const mode = import.meta.env.MODE; // 'development' | 'production'
  const isDev = import.meta.env.DEV; // boolean
  const isProd = import.meta.env.PROD; // boolean

  return <div>API: {apiUrl}</div>;
}

// Type definitions (env.d.ts)
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_GA_ID?: string;
  readonly VITE_ENABLE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## 3. Configuration Separation Patterns

### 3.1 Per-Environment Configuration File Pattern

```typescript
// ============================================
// config/index.ts - Integrated management of per-environment configuration
// ============================================

// Type definition for application config
interface AppConfig {
  app: {
    name: string;
    version: string;
    url: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
    retryCount: number;
    retryDelay: number;
  };
  database: {
    poolMin: number;
    poolMax: number;
    ssl: boolean;
    logging: boolean;
  };
  cache: {
    ttl: number;
    maxItems: number;
    strategy: 'memory' | 'redis';
  };
  features: {
    analytics: boolean;
    debugMode: boolean;
    maintenanceMode: boolean;
    rateLimit: boolean;
  };
  security: {
    corsOrigins: string[];
    rateLimitWindow: number;
    rateLimitMax: number;
    csrfEnabled: boolean;
  };
  logging: {
    level: string;
    format: 'json' | 'pretty';
    destination: 'stdout' | 'file' | 'both';
  };
}

// Default configuration common to all environments
const defaultConfig: AppConfig = {
  app: {
    name: 'MyApp',
    version: process.env.npm_package_version || '0.0.0',
    url: 'http://localhost:3000',
  },
  api: {
    baseUrl: 'http://localhost:3001',
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
  },
  database: {
    poolMin: 2,
    poolMax: 10,
    ssl: false,
    logging: false,
  },
  cache: {
    ttl: 300,
    maxItems: 1000,
    strategy: 'memory',
  },
  features: {
    analytics: false,
    debugMode: false,
    maintenanceMode: false,
    rateLimit: true,
  },
  security: {
    corsOrigins: ['http://localhost:3000'],
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100,
    csrfEnabled: true,
  },
  logging: {
    level: 'info',
    format: 'json',
    destination: 'stdout',
  },
};

// Per-environment override configuration
const envOverrides: Record<string, Partial<AppConfig>> = {
  development: {
    api: {
      ...defaultConfig.api,
      timeout: 60000, // Longer timeout for development
    },
    database: {
      ...defaultConfig.database,
      logging: true, // Output SQL logs
    },
    cache: {
      ...defaultConfig.cache,
      ttl: 0, // Disable cache in development
    },
    features: {
      ...defaultConfig.features,
      debugMode: true,
      rateLimit: false, // No rate limiting in development
    },
    logging: {
      level: 'debug',
      format: 'pretty',
      destination: 'stdout',
    },
  },
  staging: {
    app: {
      ...defaultConfig.app,
      url: 'https://staging.example.com',
    },
    api: {
      ...defaultConfig.api,
      baseUrl: 'https://staging-api.example.com',
      timeout: 15000,
    },
    database: {
      ...defaultConfig.database,
      ssl: true,
    },
    cache: {
      ...defaultConfig.cache,
      ttl: 60,
      strategy: 'redis',
    },
    features: {
      ...defaultConfig.features,
      analytics: true,
      debugMode: true,
    },
    security: {
      ...defaultConfig.security,
      corsOrigins: ['https://staging.example.com'],
    },
  },
  production: {
    app: {
      ...defaultConfig.app,
      url: 'https://www.example.com',
    },
    api: {
      ...defaultConfig.api,
      baseUrl: 'https://api.example.com',
      timeout: 10000,
      retryCount: 5,
    },
    database: {
      ...defaultConfig.database,
      poolMin: 5,
      poolMax: 20,
      ssl: true,
    },
    cache: {
      ...defaultConfig.cache,
      ttl: 600,
      maxItems: 10000,
      strategy: 'redis',
    },
    features: {
      ...defaultConfig.features,
      analytics: true,
    },
    security: {
      ...defaultConfig.security,
      corsOrigins: ['https://www.example.com', 'https://admin.example.com'],
      rateLimitMax: 50,
    },
    logging: {
      level: 'warn',
      format: 'json',
      destination: 'stdout',
    },
  },
};

// Merge configuration and export
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, any>,
        source[key] as Record<string, any>
      ) as T[Extract<keyof T, string>];
    } else if (source[key] !== undefined) {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }
  return result;
}

const currentEnv = process.env.NODE_ENV || 'development';
const override = envOverrides[currentEnv] || {};

export const config: AppConfig = deepMerge(defaultConfig, override);

// Freeze the configuration (prevent runtime modification)
Object.freeze(config);
Object.keys(config).forEach(key => {
  if (typeof (config as any)[key] === 'object') {
    Object.freeze((config as any)[key]);
  }
});
```

### 3.2 Configuration DI (Dependency Injection) Pattern

```typescript
// ============================================
// Pattern for managing configuration in a DI container
// ============================================

// config/types.ts
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
}

export interface CacheConfig {
  driver: 'memory' | 'redis' | 'memcached';
  ttl: number;
  prefix: string;
  redis?: {
    url: string;
    password?: string;
  };
}

export interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp';
  from: string;
  replyTo?: string;
  apiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
  };
}

// config/container.ts
import { DatabaseConfig, CacheConfig, EmailConfig } from './types';

class ConfigContainer {
  private configs = new Map<string, unknown>();

  register<T>(key: string, config: T): void {
    this.configs.set(key, Object.freeze(config));
  }

  get<T>(key: string): T {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`Config "${key}" is not registered`);
    }
    return config as T;
  }

  has(key: string): boolean {
    return this.configs.has(key);
  }
}

// Singleton instance
export const configContainer = new ConfigContainer();

// Initialization
export function initializeConfig(): void {
  configContainer.register<DatabaseConfig>('database', {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'myapp',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
  });

  configContainer.register<CacheConfig>('cache', {
    driver: (process.env.CACHE_DRIVER as CacheConfig['driver']) || 'memory',
    ttl: parseInt(process.env.CACHE_TTL || '300'),
    prefix: process.env.CACHE_PREFIX || 'myapp:',
    redis: process.env.REDIS_URL
      ? { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
      : undefined,
  });

  configContainer.register<EmailConfig>('email', {
    provider: (process.env.EMAIL_PROVIDER as EmailConfig['provider']) || 'sendgrid',
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    replyTo: process.env.EMAIL_REPLY_TO,
    apiKey: process.env.SENDGRID_API_KEY,
  });
}

// Usage example
// import { configContainer, initializeConfig } from './config/container';
// initializeConfig();
// const dbConfig = configContainer.get<DatabaseConfig>('database');
```

---

## 4. Feature Flags

### 4.1 Overview and Types of Feature Flags

Feature Flags are a mechanism for enabling or disabling features without code changes. They separate deployment from release and enable gradual rollouts and A/B testing.

```
Types of Feature Flags:

  ┌───────────────────┬──────────────────────────────────────────────┐
  │ Type              │ Description                                  │
  ├───────────────────┼──────────────────────────────────────────────┤
  │ Release Flag      │ Flag to hide unfinished features             │
  │                   │ Delete after development is complete (short-lived) │
  │                   │ Example: new dashboard UI                    │
  ├───────────────────┼──────────────────────────────────────────────┤
  │ Experiment Flag   │ For A/B testing or percentage rollouts       │
  │                   │ Delete after experiment is complete (medium-term) │
  │                   │ Example: new checkout flow                   │
  ├───────────────────┼──────────────────────────────────────────────┤
  │ Ops Flag          │ Operational toggle (e.g. maintenance mode)   │
  │                   │ Maintain long-term                           │
  │                   │ Example: temporarily pause write operations  │
  ├───────────────────┼──────────────────────────────────────────────┤
  │ Permission Flag   │ Feature control based on user role or plan   │
  │                   │ Maintain permanently                         │
  │                   │ Example: premium plan exclusive features     │
  └───────────────────┴──────────────────────────────────────────────┘

Feature Flag lifecycle:
  Create → Test → Gradual enablement → Full enablement → Delete flag

  Note: Always delete flags when they are no longer needed (they become technical debt)
```

### 4.2 Environment Variable-Based Feature Flags Implementation

```typescript
// ============================================
// lib/feature-flags.ts
// Simple environment variable-based Feature Flags
// ============================================

// Feature Flag definitions
const FEATURE_FLAGS = {
  // Release Flags
  newDashboard: {
    envVar: 'NEXT_PUBLIC_FF_NEW_DASHBOARD',
    description: 'New dashboard UI',
    defaultValue: false,
  },
  newCheckout: {
    envVar: 'NEXT_PUBLIC_FF_NEW_CHECKOUT',
    description: 'New checkout flow',
    defaultValue: false,
  },

  // Ops Flags
  maintenanceMode: {
    envVar: 'NEXT_PUBLIC_FF_MAINTENANCE',
    description: 'Maintenance mode',
    defaultValue: false,
  },
  readOnlyMode: {
    envVar: 'NEXT_PUBLIC_FF_READ_ONLY',
    description: 'Read-only mode',
    defaultValue: false,
  },

  // Experiment Flags
  darkMode: {
    envVar: 'NEXT_PUBLIC_FF_DARK_MODE',
    description: 'Dark mode',
    defaultValue: false,
  },

  // Permission Flags
  betaFeatures: {
    envVar: 'NEXT_PUBLIC_FF_BETA',
    description: 'Show beta features',
    defaultValue: false,
  },
  premiumFeatures: {
    envVar: 'NEXT_PUBLIC_FF_PREMIUM',
    description: 'Premium features',
    defaultValue: false,
  },
} as const;

type FeatureFlagName = keyof typeof FEATURE_FLAGS;

// Get the state of a Feature Flag
export function isFeatureEnabled(name: FeatureFlagName): boolean {
  const flag = FEATURE_FLAGS[name];
  const envValue = process.env[flag.envVar];

  if (envValue === undefined || envValue === '') {
    return flag.defaultValue;
  }

  return envValue === 'true' || envValue === '1';
}

// Get the state of all Feature Flags
export function getAllFeatureFlags(): Record<FeatureFlagName, boolean> {
  const flags = {} as Record<FeatureFlagName, boolean>;

  for (const name of Object.keys(FEATURE_FLAGS) as FeatureFlagName[]) {
    flags[name] = isFeatureEnabled(name);
  }

  return flags;
}

// Get Feature Flag descriptions (for admin panel)
export function getFeatureFlagDescriptions(): Array<{
  name: string;
  description: string;
  enabled: boolean;
  envVar: string;
}> {
  return (Object.entries(FEATURE_FLAGS) as [FeatureFlagName, typeof FEATURE_FLAGS[FeatureFlagName]][])
    .map(([name, flag]) => ({
      name,
      description: flag.description,
      enabled: isFeatureEnabled(name as FeatureFlagName),
      envVar: flag.envVar,
    }));
}
```

### 4.3 Feature Flag as a React Component

```tsx
// ============================================
// components/FeatureFlag.tsx
// Using Feature Flag as a React component
// ============================================
import React, { createContext, useContext, ReactNode } from 'react';
import { getAllFeatureFlags, isFeatureEnabled } from '@/lib/feature-flags';

type FeatureFlagName = Parameters<typeof isFeatureEnabled>[0];

// ---- Providing Feature Flags via Context API ----
interface FeatureFlagContextType {
  flags: Record<string, boolean>;
  isEnabled: (name: FeatureFlagName) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flags: {},
  isEnabled: () => false,
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const flags = getAllFeatureFlags();

  const contextValue: FeatureFlagContextType = {
    flags,
    isEnabled: (name: FeatureFlagName) => flags[name] ?? false,
  };

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// ---- Hook ----
export function useFeatureFlag(name: FeatureFlagName): boolean {
  const context = useContext(FeatureFlagContext);
  return context.isEnabled(name);
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

// ---- Declarative component ----
interface FeatureFlagProps {
  name: FeatureFlagName;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureFlag({ name, children, fallback = null }: FeatureFlagProps) {
  const isEnabled = useFeatureFlag(name);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

// ---- Usage example ----
// function App() {
//   return (
//     <FeatureFlagProvider>
//       <Layout>
//         <FeatureFlag
//           name="newDashboard"
//           fallback={<OldDashboard />}
//         >
//           <NewDashboard />
//         </FeatureFlag>
//
//         <FeatureFlag name="darkMode">
//           <DarkModeToggle />
//         </FeatureFlag>
//       </Layout>
//     </FeatureFlagProvider>
//   );
// }

// ---- Hook usage example ----
// function NavigationMenu() {
//   const showBeta = useFeatureFlag('betaFeatures');
//   const showPremium = useFeatureFlag('premiumFeatures');
//
//   return (
//     <nav>
//       <Link href="/">Home</Link>
//       <Link href="/dashboard">Dashboard</Link>
//       {showBeta && <Link href="/beta">Beta Features</Link>}
//       {showPremium && <Link href="/premium">Premium</Link>}
//     </nav>
//   );
// }
```

### 4.4 Service-Based Feature Flags (Gradual Rollout)

```typescript
// ============================================
// lib/feature-flags-service.ts
// Advanced Feature Flags using an external service
// ============================================

// Abstract interface for Feature Flag service
interface FeatureFlagService {
  isEnabled(flagName: string, context?: EvaluationContext): Promise<boolean>;
  getVariant(flagName: string, context?: EvaluationContext): Promise<string | null>;
  getAllFlags(context?: EvaluationContext): Promise<Record<string, boolean>>;
}

interface EvaluationContext {
  userId?: string;
  email?: string;
  country?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  percentile?: number; // Hash value 0-100
  attributes?: Record<string, string | number | boolean>;
}

// Percentage-based rollout implementation
class PercentageRollout {
  // Calculate hash value (0-100) from user ID
  static calculatePercentile(userId: string, flagName: string): number {
    const input = `${userId}:${flagName}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  // Determine enablement by percentage
  static isEnabledForUser(
    userId: string,
    flagName: string,
    percentage: number
  ): boolean {
    const userPercentile = this.calculatePercentile(userId, flagName);
    return userPercentile < percentage;
  }
}

// Local implementation (without external service)
class LocalFeatureFlagService implements FeatureFlagService {
  private flags: Map<string, FlagConfig> = new Map();

  constructor(config: Record<string, FlagConfig>) {
    for (const [name, flagConfig] of Object.entries(config)) {
      this.flags.set(name, flagConfig);
    }
  }

  async isEnabled(
    flagName: string,
    context?: EvaluationContext
  ): Promise<boolean> {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    // If globally disabled
    if (!flag.enabled) return false;

    // Return global setting if no context
    if (!context) return flag.enabled;

    // Check user segment
    if (flag.allowedUsers?.includes(context.userId || '')) return true;
    if (flag.allowedEmails?.includes(context.email || '')) return true;
    if (flag.blockedUsers?.includes(context.userId || '')) return false;

    // Check plan restriction
    if (flag.requiredPlans && context.plan) {
      if (!flag.requiredPlans.includes(context.plan)) return false;
    }

    // Percentage rollout
    if (flag.rolloutPercentage !== undefined && context.userId) {
      return PercentageRollout.isEnabledForUser(
        context.userId,
        flagName,
        flag.rolloutPercentage
      );
    }

    return flag.enabled;
  }

  async getVariant(
    flagName: string,
    context?: EvaluationContext
  ): Promise<string | null> {
    const flag = this.flags.get(flagName);
    if (!flag?.variants || !context?.userId) return null;

    const percentile = PercentageRollout.calculatePercentile(
      context.userId,
      flagName
    );

    let cumulative = 0;
    for (const variant of flag.variants) {
      cumulative += variant.weight;
      if (percentile < cumulative) return variant.name;
    }

    return null;
  }

  async getAllFlags(
    context?: EvaluationContext
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    for (const [name] of this.flags) {
      result[name] = await this.isEnabled(name, context);
    }
    return result;
  }
}

interface FlagConfig {
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number; // 0-100
  allowedUsers?: string[];
  allowedEmails?: string[];
  blockedUsers?: string[];
  requiredPlans?: Array<'free' | 'pro' | 'enterprise'>;
  variants?: Array<{ name: string; weight: number }>;
}

// Create service instance
export const featureFlagService = new LocalFeatureFlagService({
  'new-checkout': {
    enabled: true,
    description: 'New checkout flow',
    rolloutPercentage: 25, // Enabled for 25% of users
  },
  'premium-analytics': {
    enabled: true,
    description: 'Premium analytics dashboard',
    requiredPlans: ['pro', 'enterprise'],
  },
  'ab-test-pricing': {
    enabled: true,
    description: 'A/B test for pricing page',
    variants: [
      { name: 'control', weight: 50 },
      { name: 'variant-a', weight: 25 },
      { name: 'variant-b', weight: 25 },
    ],
  },
  'beta-ai-features': {
    enabled: true,
    description: 'Beta test for AI features',
    allowedEmails: ['beta-tester@example.com'],
    rolloutPercentage: 5,
  },
});

// Usage example
// const isNewCheckout = await featureFlagService.isEnabled('new-checkout', {
//   userId: currentUser.id,
//   plan: currentUser.plan,
// });
```

### 4.5 Feature Flag Service Comparison

```
Comparison of major Feature Flags services:

  ┌───────────────┬─────────┬──────────────┬──────────────┬───────────┐
  │ Service       │ Pricing │ Segmentation │ A/B Testing  │ OSS       │
  ├───────────────┼─────────┼──────────────┼──────────────┼───────────┤
  │ LaunchDarkly  │ Paid    │ Advanced     │ Supported    │ No        │
  │ Unleash       │ Free+   │ Moderate     │ Supported    │ Yes       │
  │ Flagsmith     │ Free+   │ Moderate     │ Supported    │ Yes       │
  │ PostHog       │ Free+   │ Advanced     │ Supported    │ Yes       │
  │ ConfigCat     │ Free+   │ Moderate     │ Limited      │ No        │
  │ Split.io      │ Paid    │ Advanced     │ Supported    │ No        │
  │ Env var-based │ Free    │ None         │ None         │ -         │
  │ Vercel Edge   │ Free+   │ Geo/Device   │ Supported    │ No        │
  │ Config        │         │              │              │           │
  └───────────────┴─────────┴──────────────┴──────────────┴───────────┘

Selection guidance:
  - Small projects  → Environment variable-based or Unleash (self-hosted)
  - Medium projects → Flagsmith or PostHog
  - Large projects  → LaunchDarkly or Split.io
  - A/B test focus  → PostHog or LaunchDarkly
  - OSS preference  → Unleash or Flagsmith
```

---

## 5. Secret Management

### 5.1 Secret Classification and Management Policy

```
Secret classification:

  ┌─────────────────────┬───────────────────────┬──────────────────┐
  │ Category            │ Example               │ Management       │
  ├─────────────────────┼───────────────────────┼──────────────────┤
  │ API keys            │ Stripe Secret Key     │ Env var or Vault │
  │ Database credentials│ DB password, conn URI │ Secrets Manager  │
  │ Encryption keys     │ JWT Secret, AES Key   │ KMS or Vault     │
  │ OAuth credentials   │ Client Secret         │ Secrets Manager  │
  │ SSH keys            │ Deploy key            │ CI/CD secrets    │
  │ TLS certificates    │ SSL cert, private key │ Certificate Mgr  │
  │ Webhook secrets     │ Stripe Webhook Secret │ Env var          │
  └─────────────────────┴───────────────────────┴──────────────────┘

Secret management principles:
  ① Least privilege: Grant only the minimum necessary access rights
  ② Rotation: Update secrets regularly
  ③ Encryption: Encrypt both at rest and in transit
  ④ Auditing: Record and monitor access to secrets
  ⑤ Isolation: Use different secrets for each environment
```

### 5.2 Secret Management on Each Platform

```
Secret management methods:

  ① Environment variables (basic):
     → Vercel: Project Settings > Environment Variables
        - Can be separated by Preview / Production / Development
        - Sensitive flag prevents output to logs
     → AWS: Systems Manager Parameter Store
        - Encrypted storage with SecureString type
        - Access control with IAM policies
     → .env.local (local development only)
        - Never commit to Git

  ② Secret managers:
     → AWS Secrets Manager
        - Supports automatic rotation
        - Version management
        - Cross-region replication
     → Google Cloud Secret Manager
        - Fine-grained access control via IAM
        - Automatic replication
     → HashiCorp Vault
        - Dynamic secret generation
        - Lease (expiry) management
        - Detailed audit logs
     → Azure Key Vault
        - HSM (Hardware Security Module) support
        - Certificate management integrated

  ③ Encrypting .env files:
     → dotenv-vault
        - Encrypt .env files for safe committing
        - Securely share among team members
     → sops (Mozilla)
        - Integrates with AWS KMS / GCP KMS / Azure Key Vault
        - Partial encryption (keys in plaintext, only values encrypted)
     → git-crypt
        - Transparently encrypts files in Git repositories
        - GPG key-based access control
```

### 5.3 AWS Secrets Manager Implementation Example

```typescript
// ============================================
// lib/secrets.ts
// Retrieving secrets using AWS Secrets Manager
// ============================================
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// In-memory secret cache
const secretCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSecret(secretName: string): Promise<string> {
  // Check cache
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await client.send(command);
    const secretValue = response.SecretString;

    if (!secretValue) {
      throw new Error(`Secret "${secretName}" has no value`);
    }

    // Save to cache
    secretCache.set(secretName, {
      value: secretValue,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return secretValue;
  } catch (error) {
    console.error(`Failed to retrieve secret "${secretName}":`, error);
    throw error;
  }
}

// Parse JSON-format secrets
export async function getSecretJson<T>(secretName: string): Promise<T> {
  const secretString = await getSecret(secretName);
  return JSON.parse(secretString) as T;
}

// Usage example: Get database credentials from secrets
interface DbCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export async function getDatabaseCredentials(): Promise<DbCredentials> {
  // In development, get from env vars; in production, get from Secrets Manager
  if (process.env.NODE_ENV === 'development') {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'myapp_dev',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    };
  }

  return getSecretJson<DbCredentials>('myapp/production/database');
}
```

### 5.4 Preventing Secret Leakage

```
What NOT to do:
  ✗ Hardcode secrets in code
  ✗ Commit .env.local to Git
  ✗ Put secrets in NEXT_PUBLIC_
  ✗ Output secrets to logs
  ✗ Include secrets in error messages
  ✗ Include secrets in URL query parameters
  ✗ Embed secrets in frontend JavaScript
  ✗ Write actual secrets in comments or documentation

.gitignore configuration:
  .env.local
  .env.*.local
  .env.development.local
  .env.production.local
  *.pem
  *.key
  *.p12
  credentials.json
  service-account.json
```

```typescript
// ============================================
// Detect secret leakage with pre-commit hook
// .husky/pre-commit
// ============================================

// Scripts to add to package.json
// {
//   "scripts": {
//     "check-secrets": "ts-node scripts/check-secrets.ts"
//   },
//   "lint-staged": {
//     "**/*": "ts-node scripts/check-secrets.ts"
//   }
// }

// scripts/check-secrets.ts
import { execSync } from 'child_process';

// Define dangerous patterns
const SECRET_PATTERNS = [
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g, description: 'AWS Access Key ID' },
  { pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*=\s*[\w/+=]{40}/g,
    description: 'AWS Secret Access Key' },

  // Stripe
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, description: 'Stripe Live Secret Key' },
  { pattern: /rk_live_[a-zA-Z0-9]{24,}/g, description: 'Stripe Live Restricted Key' },

  // GitHub
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, description: 'GitHub Personal Access Token' },
  { pattern: /ghs_[a-zA-Z0-9]{36}/g, description: 'GitHub App Installation Token' },

  // Google
  { pattern: /AIza[0-9A-Za-z\-_]{35}/g, description: 'Google API Key' },

  // Generic
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, description: 'Private Key' },
  { pattern: /password\s*=\s*['"][^'"]{8,}['"]/gi, description: 'Hardcoded Password' },
];

function checkForSecrets(filePaths: string[]): void {
  const violations: Array<{ file: string; line: number; description: string }> = [];

  for (const filePath of filePaths) {
    // Skip binary files
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(filePath)) {
      continue;
    }

    try {
      const content = require('fs').readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        for (const { pattern, description } of SECRET_PATTERNS) {
          // Reset pattern (due to global flag)
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            violations.push({
              file: filePath,
              line: lineNum + 1,
              description,
            });
          }
        }
      }
    } catch (error) {
      // Ignore file read errors
    }
  }

  if (violations.length > 0) {
    console.error('\nPotential secret leakage detected:');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} - ${v.description}`);
    }
    console.error('\nRemove the secrets and commit again.');
    process.exit(1);
  }

  console.log('Secret check: No issues detected.');
}

// Get staged files
const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM')
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

checkForSecrets(stagedFiles);
```

---

## 6. Environment Variable Management in CI/CD Pipelines

### 6.1 Environment Variable Configuration in GitHub Actions

```yaml
# ============================================
# .github/workflows/deploy.yml
# Environment variable management in GitHub Actions
# ============================================
name: Deploy

on:
  push:
    branches: [main, staging]

# How to configure environment variables:
# 1. Repository secrets: Settings > Secrets and variables > Actions
# 2. Environment secrets: Settings > Environments > [env] > Secrets
# 3. Organization secrets: Organization Settings > Secrets

jobs:
  deploy:
    runs-on: ubuntu-latest

    # Specify environment (GitHub Environments)
    environment:
      name: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
      url: ${{ steps.deploy.outputs.url }}

    # Job-level environment variables
    env:
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: 1

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run environment check
        run: npm run check-env
        env:
          # Injected from Repository secrets
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
          SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
          # Injected from Environment secrets (different values per environment)
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_APP_URL: ${{ vars.NEXT_PUBLIC_APP_URL }}

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_APP_URL: ${{ vars.NEXT_PUBLIC_APP_URL }}
          NEXT_PUBLIC_GA_ID: ${{ vars.NEXT_PUBLIC_GA_ID }}
          NEXT_PUBLIC_SENTRY_DSN: ${{ vars.NEXT_PUBLIC_SENTRY_DSN }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}

      - name: Deploy to Vercel
        id: deploy
        run: |
          npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Run smoke tests
        run: npm run test:smoke
        env:
          TEST_URL: ${{ steps.deploy.outputs.url }}

  # Job to verify environment variable configuration
  verify-config:
    runs-on: ubuntu-latest
    needs: deploy
    steps:
      - name: Verify deployment config
        run: |
          RESPONSE=$(curl -s ${{ needs.deploy.outputs.url }}/api/health)
          echo "Health check response: $RESPONSE"
          if echo "$RESPONSE" | jq -e '.status == "ok"' > /dev/null 2>&1; then
            echo "Deployment verification passed"
          else
            echo "Deployment verification failed"
            exit 1
          fi
```

### 6.2 Environment Variable Configuration in Vercel

```typescript
// ============================================
// vercel.json - Vercel project configuration
// ============================================
// {
//   "env": {
//     "CUSTOM_VAR": "value"
//   },
//   "build": {
//     "env": {
//       "BUILD_VAR": "build-value"
//     }
//   }
// }

// Setting environment variables with Vercel CLI
// vercel env add DATABASE_URL production
// vercel env add DATABASE_URL preview
// vercel env add DATABASE_URL development

// List environment variables
// vercel env ls

// Delete an environment variable
// vercel env rm DATABASE_URL production

// ============================================
// Vercel environment variable scopes
// ============================================
// Production:   Used only in production deploys
// Preview:      Used in preview deploys (PR branches)
// Development:  Used when running vercel dev
//
// Sensitive:    Not shown in logs or build output
// Plain:        Regular environment variable

// ============================================
// Branch-specific settings for Preview in vercel.json
// ============================================
// {
//   "git": {
//     "deploymentEnabled": {
//       "feature/*": true,
//       "fix/*": true,
//       "main": true
//     }
//   }
// }
```

### 6.3 Environment Variable Management in Docker

```dockerfile
# ============================================
# Dockerfile - Environment variables in multi-stage builds
# ============================================

# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time environment variables (ARG)
# docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GA_ID

# Convert ARG to ENV (for use in the build process)
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Run stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Do not set runtime environment variables here
# Inject with: docker run -e DATABASE_URL=...
ENV NODE_ENV=production

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

```yaml
# ============================================
# docker-compose.yml - Development environment setup
# ============================================
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
      args:
        - NEXT_PUBLIC_API_URL=http://localhost:3001
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp_dev
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env                    # Common settings
      - .env.development        # Development environment settings
      - .env.local              # Local override (.gitignore)
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 7. Configuration Management in Kubernetes

### 7.1 ConfigMap and Secret

In Kubernetes, configuration data is managed with two resources: ConfigMap and Secret. ConfigMap stores non-sensitive data, while Secret stores sensitive data.

```yaml
# ============================================
# k8s/configmap.yaml - Non-sensitive configuration
# ============================================
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
  namespace: production
  labels:
    app: myapp
    environment: production
data:
  # Individual key-value pairs
  NODE_ENV: "production"
  LOG_LEVEL: "warn"
  LOG_FORMAT: "json"
  CACHE_TTL: "600"
  ENABLE_ANALYTICS: "true"
  ENABLE_RATE_LIMIT: "true"

  # Can also be mounted as a config file
  app-config.json: |
    {
      "api": {
        "baseUrl": "https://api.example.com",
        "timeout": 10000,
        "retryCount": 5
      },
      "cache": {
        "ttl": 600,
        "maxItems": 10000,
        "strategy": "redis"
      },
      "security": {
        "corsOrigins": [
          "https://www.example.com",
          "https://admin.example.com"
        ],
        "rateLimitMax": 50
      }
    }
```

```yaml
# ============================================
# k8s/secret.yaml - Sensitive configuration
# ============================================
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
  namespace: production
  labels:
    app: myapp
    environment: production
type: Opaque
# Values must be Base64 encoded
# echo -n 'value' | base64
data:
  DATABASE_URL: cG9zdGdyZXNxbDovL3VzZXI6cGFzc0Bob3N0OjU0MzIvbXlkYg==
  JWT_SECRET: c3VwZXItc2VjcmV0LWtleS10aGF0LWlzLWF0LWxlYXN0LTMyLWNoYXJz
  STRIPE_SECRET_KEY: c2tfdGVzdF94eHh4eHh4eHh4eHg=
  REDIS_PASSWORD: cmVkaXMtcGFzc3dvcmQ=

# Using stringData avoids the need for Base64 encoding (recommended)
# stringData:
#   DATABASE_URL: "postgresql://user:pass@host:5432/mydb"
#   JWT_SECRET: "super-secret-key-that-is-at-least-32-chars"
```

```yaml
# ============================================
# k8s/deployment.yaml - Injecting environment variables into Pods
# ============================================
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          ports:
            - containerPort: 3000

          # Method 1: Inject individual environment variables from ConfigMap
          env:
            - name: NODE_ENV
              valueFrom:
                configMapKeyRef:
                  name: myapp-config
                  key: NODE_ENV
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: DATABASE_URL
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: JWT_SECRET

          # Method 2: Inject all keys from ConfigMap / Secret at once
          envFrom:
            - configMapRef:
                name: myapp-config
            - secretRef:
                name: myapp-secrets

          # Method 3: Mount as a config file
          volumeMounts:
            - name: config-volume
              mountPath: /app/config
              readOnly: true

      volumes:
        - name: config-volume
          configMap:
            name: myapp-config
            items:
              - key: app-config.json
                path: app-config.json
```

### 7.2 External Secrets Operator

```yaml
# ============================================
# Integrating External Secrets Operator with AWS Secrets Manager
# ============================================

# SecretStore: Connection configuration to AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secret-store
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-1
      auth:
        jwt:
          serviceAccountRef:
            name: myapp-sa

---
# ExternalSecret: Auto-generate Kubernetes Secret from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-external-secrets
  namespace: production
spec:
  refreshInterval: 1h        # Sync every 1 hour
  secretStoreRef:
    name: aws-secret-store
    kind: SecretStore
  target:
    name: myapp-secrets       # Name of the generated Secret
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: myapp/production/database
        property: url
    - secretKey: JWT_SECRET
      remoteRef:
        key: myapp/production/auth
        property: jwt_secret
    - secretKey: STRIPE_SECRET_KEY
      remoteRef:
        key: myapp/production/stripe
        property: secret_key
```

### 7.3 Sealed Secrets (Git-managed Encrypted Secrets)

```
How Sealed Secrets works:

  Developer's machine                  Kubernetes cluster
  ┌─────────────────┐              ┌─────────────────────┐
  │ kubeseal CLI    │              │ Sealed Secrets      │
  │                 │              │ Controller          │
  │ Secret          │   Encrypt    │                     │
  │ (plaintext) ────┼──────────>   │ SealedSecret        │
  │                 │              │ (encrypted)    ─────┤
  │                 │              │                     │ Decrypt
  │                 │              │ Secret              │
  │                 │              │ (plaintext - injected into Pod) │
  └─────────────────┘              └─────────────────────┘

  Benefits:
  - Encrypted SealedSecrets can be committed to Git
  - Works well with GitOps workflows
  - Decryptable only with the cluster's public key
```

```bash
# How to use Sealed Secrets

# 1. Create a regular Secret (as a file)
kubectl create secret generic myapp-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/mydb' \
  --from-literal=JWT_SECRET='super-secret-key-that-is-at-least-32-chars' \
  --dry-run=client -o yaml > secret.yaml

# 2. Encrypt with kubeseal
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# 3. Commit the encrypted SealedSecret to Git (safe)
git add sealed-secret.yaml
git commit -m "Add sealed secrets for production"

# 4. Deploy to cluster (Controller automatically decrypts and creates Secret)
kubectl apply -f sealed-secret.yaml
```

---

## 8. Configuration Management Anti-Patterns and Countermeasures

### 8.1 Common Anti-Patterns

```
List of anti-patterns and countermeasures:

  ┌──────────────────────────────────┬──────────────────────────────────┐
  │ Anti-pattern                     │ Countermeasure                   │
  ├──────────────────────────────────┼──────────────────────────────────┤
  │ Hardcoding secrets               │ Use env vars or Secrets Manager  │
  │ if (env === 'prod') branching    │ Separate via per-env config files│
  │ Forgetting to convert env var types │ Schema validation with Zod   │
  │ Using production values as defaults │ Set safe default values      │
  │ Committing .env                  │ .gitignore + pre-commit hook     │
  │ Putting sensitive info in NEXT_PUBLIC_ │ Understand prefix meaning │
  │ Global variable config management│ DI pattern or modularization     │
  │ Overusing environment variables  │ Appropriate use with config files│
  │ Using production secrets in test │ Use mock/dummy values for tests  │
  │ Not recording config change logs │ Implement config change audit log│
  │ Leaving unused Feature Flags     │ Perform regular cleanup          │
  │ Using same secret across all envs│ Rotate secrets per environment   │
  └──────────────────────────────────┴──────────────────────────────────┘
```

### 8.2 Details on Conditional-Branching Anti-Patterns

```typescript
// ============================================
// Anti-pattern: Environment branching in code
// ============================================

// BAD: Branching on environment inside the code
function getApiUrlBad(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://api.example.com';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'https://staging-api.example.com';
  } else {
    return 'http://localhost:3001';
  }
}

// BAD: Directly switching services per environment
function createEmailServiceBad() {
  if (process.env.NODE_ENV === 'production') {
    return new SendGridEmailService(process.env.SENDGRID_API_KEY!);
  } else {
    return new ConsoleEmailService(); // Just outputs to console
  }
}

// GOOD: Read configuration from environment variables
function getApiUrlGood(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_URL is not defined');
  }
  return url;
}

// GOOD: Environment-independent design using DI pattern
interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

function createEmailServiceGood(config: EmailConfig): EmailService {
  switch (config.provider) {
    case 'sendgrid':
      return new SendGridEmailService(config.apiKey!);
    case 'ses':
      return new SESEmailService(config);
    case 'smtp':
      return new SMTPEmailService(config.smtp!);
    default:
      throw new Error(`Unknown email provider: ${config.provider}`);
  }
}
```

### 8.3 Designing Safe Default Values

```typescript
// ============================================
// Design principles for default values
// ============================================

// BAD: Dangerous default values
const configBad = {
  debugMode: true,              // Risk of being enabled in production
  corsOrigin: '*',              // Risk of allowing all origins
  rateLimit: false,             // Risk of no rate limiting
  logLevel: 'debug',            // Verbose logs in production
  sessionSecret: 'default',     // Known secret
  ssl: false,                   // Risk of no SSL
};

// GOOD: Safe default values (Secure by Default)
const configGood = {
  debugMode: false,             // Disabled by default
  corsOrigin: undefined,        // Explicit configuration required
  rateLimit: true,              // Enabled by default
  logLevel: 'warn',             // Production-appropriate level
  sessionSecret: undefined,     // Required (startup error if missing)
  ssl: true,                    // Enabled by default
};

// GOOD: Default values appropriate for each environment
function getDefaultConfig(env: string) {
  const isProduction = env === 'production';

  return {
    debugMode: !isProduction,
    logLevel: isProduction ? 'warn' : 'debug',
    ssl: isProduction, // Always use SSL in production
    cache: {
      ttl: isProduction ? 600 : 0,
      strategy: isProduction ? 'redis' : 'memory',
    },
  };
}
```

---

## 9. Troubleshooting

### 9.1 Common Problems and Solutions

```
Problem 1: Environment variable is undefined

  Symptom: process.env.MY_VAR is undefined
  Cause and countermeasures:

  Checklist:
  □ Is the variable defined in the .env file?
  □ Is the .env file format correct (no spaces around =)?
  □ Is the .env file encoded in UTF-8?
  □ Are there any typos in the variable name (case-sensitive)?
  □ Does it have the NEXT_PUBLIC_ prefix for client-side access?
  □ Is the dotenv package loaded correctly?
  □ For Docker environments, is env_file specified correctly?

  Debug commands:
  $ node -e "console.log(process.env.MY_VAR)"
  $ printenv | grep MY_VAR
  $ docker exec container_name printenv | grep MY_VAR


Problem 2: Environment variables differ between build time and runtime

  Symptom: Built application calls an unintended API
  Cause: NEXT_PUBLIC_ variables are inlined at build time,
        so changing them at runtime has no effect

  Countermeasures:
  (1) Set the correct environment variables at build time
     NEXT_PUBLIC_API_URL=https://api.example.com npm run build
  (2) Use Runtime Configuration (Next.js)
     → serverRuntimeConfig / publicRuntimeConfig
  (3) Runtime environment variable injection using __NEXT_DATA__
     → Pass environment variables as props via getServerSideProps


Problem 3: .env is not read inside Docker container

  Symptom: Works locally but environment variables are empty in Docker container
  Cause: .env file is included in .dockerignore

  Countermeasures:
  (1) Use env_file in docker-compose
  (2) Pass individually with docker run -e
  (3) Pass all at once with docker run --env-file .env
  (4) Keep .env in .dockerignore and inject from outside (recommended)


Problem 4: Environment variables not set in CI/CD

  Symptom: CI pipeline build fails
  Cause: Repository secrets / Environment secrets not configured

  Countermeasures:
  (1) GitHub Actions: Add variables in Settings > Secrets
  (2) Check that secrets context is referenced correctly
     ${{ secrets.MY_SECRET }} (easy to forget the $)
  (3) Check if Environment protection rules are configured
  (4) For Organization secrets, allow access to the repository


Problem 5: Environment variable value contains special characters

  Symptom: Password with ! or $ is not read correctly
  Cause: Shell string expansion interferes

  Countermeasures:
  (1) Surround with single quotes in .env file
     DATABASE_PASSWORD='p@ss!w0rd$123'
  (2) Pass with single quotes in Docker
     docker run -e "DATABASE_PASSWORD='p@ss!w0rd\$123'"
  (3) Store as Base64-encoded value and decode on the app side


Problem 6: Feature Flag changes are not reflected

  Symptom: Changed environment variable but Feature Flag state did not change
  Cause:
  (1) For NEXT_PUBLIC_ variables, a rebuild is required
  (2) For server-side variables, a server restart is required
  (3) CDN or browser cache is still present

  Countermeasures:
  (1) Use service-based Feature Flags (no redeployment needed)
  (2) Evaluate server-side-only Feature Flags at runtime
  (3) Purge the cache
```

### 9.2 Environment Variable Debug Tools

```typescript
// ============================================
// lib/debug-env.ts
// Environment variable debug helper (for development use only)
// ============================================

export function debugEnv(): void {
  if (process.env.NODE_ENV === 'production') {
    console.warn('debugEnv() should not be used in production');
    return;
  }

  console.log('\n========== Environment Variable Debug Info ==========');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`Runtime: ${typeof window === 'undefined' ? 'server' : 'client'}`);

  // List of set NEXT_PUBLIC_ variables
  const publicVars = Object.entries(process.env)
    .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
    .map(([key, value]) => `  ${key}: ${value}`);

  console.log(`\nNEXT_PUBLIC_ variables (${publicVars.length}):`);
  publicVars.forEach(v => console.log(v));

  // On server side, check for sensitive variables (do not show values)
  if (typeof window === 'undefined') {
    const serverVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SENDGRID_API_KEY',
      'REDIS_URL',
      'SENTRY_DSN',
    ];

    console.log('\nServer variable status:');
    serverVars.forEach(key => {
      const value = process.env[key];
      const status = value
        ? `set (${value.length} chars)`
        : 'not set';
      console.log(`  ${key}: ${status}`);
    });
  }

  console.log('====================================================\n');
}

// Usage (development only):
// import { debugEnv } from '@/lib/debug-env';
// if (process.env.NODE_ENV === 'development') debugEnv();
```

```typescript
// ============================================
// app/api/debug/env/route.ts
// Environment variable debug API (development only)
// ============================================
import { NextResponse } from 'next/server';

export async function GET() {
  // Never allow access in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  // Return debug info (hiding values)
  const envInfo = {
    nodeEnv: process.env.NODE_ENV,
    platform: process.platform,
    nodeVersion: process.version,
    variables: Object.keys(process.env)
      .sort()
      .reduce((acc, key) => {
        // Show only length for values (security)
        const value = process.env[key] || '';
        acc[key] = {
          set: value.length > 0,
          length: value.length,
          // Show values for NEXT_PUBLIC_ (already exposed to clients)
          value: key.startsWith('NEXT_PUBLIC_') ? value : '[hidden]',
        };
        return acc;
      }, {} as Record<string, any>),
  };

  return NextResponse.json(envInfo);
}
```

### 9.3 Verifying Configuration via Health Check Endpoint

```typescript
// ============================================
// app/api/health/route.ts
// Health check API (including configuration verification)
// ============================================
import { NextResponse } from 'next/server';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
  }[];
}

async function checkDatabase(): Promise<{
  status: 'pass' | 'fail';
  message: string;
  duration: number;
}> {
  const start = Date.now();
  try {
    // For Prisma:
    // await prisma.$queryRaw`SELECT 1`;
    // For Drizzle:
    // await db.execute(sql`SELECT 1`);
    return {
      status: 'pass',
      message: 'Database connection OK',
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Database connection failed: ${(error as Error).message}`,
      duration: Date.now() - start,
    };
  }
}

async function checkRedis(): Promise<{
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration: number;
}> {
  if (!process.env.REDIS_URL) {
    return { status: 'warn', message: 'Redis not configured', duration: 0 };
  }

  const start = Date.now();
  try {
    // Redis client PING
    // await redis.ping();
    return {
      status: 'pass',
      message: 'Redis connection OK',
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Redis connection failed: ${(error as Error).message}`,
      duration: Date.now() - start,
    };
  }
}

function checkRequiredEnvVars(): {
  status: 'pass' | 'fail';
  message: string;
} {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    return {
      status: 'fail',
      message: `Missing required env vars: ${missing.join(', ')}`,
    };
  }

  return { status: 'pass', message: 'All required env vars are set' };
}

export async function GET() {
  const [dbCheck, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);
  const envCheck = checkRequiredEnvVars();

  const checks = [
    { name: 'database', ...dbCheck },
    { name: 'redis', ...redisCheck },
    { name: 'env_vars', ...envCheck },
  ];

  const hasError = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');

  const health: HealthStatus = {
    status: hasError ? 'error' : hasWarn ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
    environment: process.env.NODE_ENV || 'unknown',
    checks,
  };

  return NextResponse.json(health, {
    status: hasError ? 503 : 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
```

---

## 10. Configuration Management Best Practices Checklist

### 10.1 Project Initial Setup

```
Checklist for project setup:

  □ Create .env.example listing all environment variables
  □ Add .env.local, .env.*.local to .gitignore
  □ Implement environment variable validation with Zod
  □ Set up secret leakage check with pre-commit hook
  □ Document the environment variable setup procedure in README.md
  □ Agree on environment variable naming conventions within the team
  □ Decide on the Feature Flags management policy
  □ Decide on the secret management method (Secrets Manager / Vault)
  □ Confirm the environment variable setup method in the CI/CD pipeline
  □ Implement a health check endpoint
```

### 10.2 Code Review Checklist

```
Code review points for environment configuration:

  □ When new environment variables are added:
    ├── Is .env.example updated?
    ├── Is the Zod schema updated?
    ├── Are appropriate default values set?
    ├── Is the need for NEXT_PUBLIC_ correct?
    └── Is the procedure for setting CI/CD secrets documented?

  □ Security:
    ├── Is sensitive information not exposed to the client?
    ├── Are there no hardcoded secrets?
    ├── Are secrets not included in log output?
    └── Are secrets not included in error messages?

  □ Configuration separation:
    ├── Are environment-specific values not hardcoded in code?
    ├── Are there no branches like if (env === 'production')?
    └── Can configuration changes be made without code changes?

  □ Feature Flags:
    ├── Is a PR planned to remove flags that are no longer needed?
    ├── Is the default value safe (OFF by default)?
    └── Is there a description of the flag in code or documentation?
```

### 10.3 Security Policy for Environment Configuration

```
Security policy template:

  1. Secret classification and management
     - Level 1 (Top secret): Database passwords, encryption keys
       → Managed with AWS Secrets Manager / HashiCorp Vault
       → Rotate every 90 days
     - Level 2 (Confidential): API keys, Webhook secrets
       → Stored as environment variables in CI/CD secrets
       → Rotate every 180 days
     - Level 3 (Internal use): Internal service URLs, port numbers
       → Managed with ConfigMap / environment variables
       → No rotation required

  2. Access control
     - Access to production secrets is limited to
       the SRE team and Tech Lead only
     - Secret changes require approval from at least 2 people
     - Regularly audit access logs

  3. Incident response
     - If a secret leak is suspected:
       (1) Immediately rotate the affected secret
       (2) Investigate the scope of impact (check access logs)
       (3) Create an incident report
       (4) Formulate and implement preventive measures

  4. Regular reviews
     - Conduct a quarterly inventory of environment variables
     - Delete unnecessary environment variables
     - Check the status of secret rotation
     - Clean up Feature Flags
```

### 10.4 Secret Rotation Implementation

```typescript
// ============================================
// lib/secret-rotation.ts
// Secret rotation support tool
// ============================================

interface RotationPolicy {
  secretName: string;
  maxAgeDays: number;
  lastRotated: Date;
  owners: string[];
}

const rotationPolicies: RotationPolicy[] = [
  {
    secretName: 'DATABASE_PASSWORD',
    maxAgeDays: 90,
    lastRotated: new Date('2025-12-01'),
    owners: ['sre-team@example.com'],
  },
  {
    secretName: 'JWT_SECRET',
    maxAgeDays: 90,
    lastRotated: new Date('2025-11-15'),
    owners: ['sre-team@example.com'],
  },
  {
    secretName: 'STRIPE_SECRET_KEY',
    maxAgeDays: 180,
    lastRotated: new Date('2025-10-01'),
    owners: ['payment-team@example.com'],
  },
  {
    secretName: 'SENDGRID_API_KEY',
    maxAgeDays: 180,
    lastRotated: new Date('2025-09-01'),
    owners: ['platform-team@example.com'],
  },
];

interface RotationCheckResult {
  secretName: string;
  daysSinceRotation: number;
  maxAgeDays: number;
  status: 'ok' | 'warning' | 'expired';
  owners: string[];
  message: string;
}

export function checkRotationStatus(): RotationCheckResult[] {
  const now = new Date();

  return rotationPolicies.map(policy => {
    const daysSince = Math.floor(
      (now.getTime() - policy.lastRotated.getTime()) / (1000 * 60 * 60 * 24)
    );

    const warningThreshold = policy.maxAgeDays * 0.8; // Warning at 80%

    let status: 'ok' | 'warning' | 'expired';
    let message: string;

    if (daysSince > policy.maxAgeDays) {
      status = 'expired';
      message = `Overdue by ${daysSince - policy.maxAgeDays} days. Rotate immediately.`;
    } else if (daysSince > warningThreshold) {
      status = 'warning';
      message = `${policy.maxAgeDays - daysSince} days until rotation deadline.`;
    } else {
      status = 'ok';
      message = `${policy.maxAgeDays - daysSince} days until next rotation.`;
    }

    return {
      secretName: policy.secretName,
      daysSinceRotation: daysSince,
      maxAgeDays: policy.maxAgeDays,
      status,
      owners: policy.owners,
      message,
    };
  });
}

// Output rotation status report
export function printRotationReport(): void {
  const results = checkRotationStatus();

  console.log('\n===== Secret Rotation Status =====\n');

  for (const result of results) {
    const icon =
      result.status === 'ok' ? '[OK]' :
      result.status === 'warning' ? '[WARN]' : '[EXPIRED]';

    console.log(`${icon} ${result.secretName}`);
    console.log(`  Last rotated: ${result.daysSinceRotation} days ago`);
    console.log(`  Max age: ${result.maxAgeDays} days`);
    console.log(`  Status: ${result.message}`);
    console.log(`  Owners: ${result.owners.join(', ')}`);
    console.log('');
  }

  const expired = results.filter(r => r.status === 'expired');
  if (expired.length > 0) {
    console.log(`\n[ALERT] ${expired.length} secret(s) have expired!`);
  }
}
```

---

## Summary

| Concept | Key Points | Recommended Tools |
|------|---------|-----------|
| Environment variable design | SCREAMING_SNAKE_CASE, classify with prefixes | - |
| Type safety | Startup-time validation with Zod, fail-fast | Zod, @t3-oss/env-nextjs |
| Environment isolation | Override with config files, avoid env branching in code | dotenv, direnv |
| Feature Flags | Gradual rollout, A/B testing, delete unused flags | LaunchDarkly, Unleash |
| Secret management | .env.local outside Git, encrypted storage with Secrets Manager | AWS Secrets Manager, Vault |
| CI/CD | Scope isolation with GitHub Environments, sensitive data with Secrets | GitHub Actions, Vercel |
| Kubernetes | Separate ConfigMap and Secret, External Secrets Operator | Sealed Secrets, ESO |
| Security | pre-commit hook, Secure by Default, regular rotation | husky, gitleaks |
| Debugging | Health check API, environment variable check script | - |

```
Configuration management maturity model:

  Level 1 (Basic):
    ├── Manage with .env files
    ├── Exclude sensitive files with .gitignore
    └── Create .env.example

  Level 2 (Standard):
    ├── Environment variable validation (Zod)
    ├── Per-environment config files
    ├── Secret check with pre-commit hook
    └── Secret management in CI/CD

  Level 3 (Advanced):
    ├── Introduce Secrets Manager / Vault
    ├── Introduce Feature Flags service
    ├── Automatic rotation
    ├── Implement audit logs
    └── Sealed Secrets / External Secrets Operator

  Level 4 (Enterprise):
    ├── Zero-trust configuration management
    ├── HSM (Hardware Security Module)
    ├── Compliance (SOC2, ISO27001)
    ├── Automated policy checks
    └── Configuration change management process (ITIL-based)
```

---

## Frequently Asked Questions (FAQ)

### Q1: How do I securely manage environment variables?

**Basic principles:**

1. **Never commit them**: Always add files containing actual values such as `.env`, `.env.local`, and `.env.production` to `.gitignore`
2. **Share the template**: List variable names and dummy values in `.env.example` and share it with the team
3. **Manage in layers**: Introduce a secret management system for production separate from development

**Recommended tools:**

```bash
# Local development
.env.local         # gitignore target, local-specific values
.env.example       # Git-managed, variable names and dummy values only

# Production environment
AWS Secrets Manager    # AWS environments
Vercel Environment Variables  # Vercel
GitHub Secrets        # GitHub Actions
HashiCorp Vault       # On-premises / multi-cloud
```

**Implementation example:**

```typescript
// env.ts - Startup-time validation
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

// Validate at startup, fail immediately on error
export const env = envSchema.parse(process.env);
```

### Q2: What are the best practices for managing .env files and .gitignore?

**Recommended file structure pattern:**

```
Project root/
├── .env.example          # ✓ Git-managed (variable names only)
├── .env                  # ✗ gitignore (common default values)
├── .env.local            # ✗ gitignore (local-specific values)
├── .env.development      # ✗ gitignore (for development environment)
├── .env.production       # ✗ gitignore (for production; typically not used)
└── .gitignore
```

**.gitignore configuration:**

```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.development
.env.production
.env.test

# However, exclude .env.example from gitignore (use ! for exception)
!.env.example
```

**How to write .env.example:**

```bash
# .env.example - Template shared with the team
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# External API
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxx

# Service configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development

# Authentication
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=http://localhost:3000
```

**Security check:**

```bash
# Prevent sensitive information from being mixed in with pre-commit hook
npm install --save-dev husky @commitlint/cli
npx husky add .husky/pre-commit "npx gitleaks protect --staged"

# Scan past commit history with gitleaks
docker run -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" -v
```

### Q3: What is the difference between build-time and runtime variables?

**Build-time Variables:**

```javascript
// Next.js example
// next.config.js
module.exports = {
  env: {
    BUILD_TIME: new Date().toISOString(),
    COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  },
};

// Usage in component
export default function Footer() {
  return <p>Built at: {process.env.BUILD_TIME}</p>;
  // Value is embedded at build time and available on the client side
}
```

**Characteristics:**
- Values are determined at build time and embedded in the bundle
- Changing them requires a rebuild
- Available on the client side (publicly exposed)
- Variables with the `NEXT_PUBLIC_*` prefix

**Runtime Variables:**

```javascript
// Available server-side only (Server Components / API Routes)
export async function GET() {
  const dbUrl = process.env.DATABASE_URL; // Loaded at runtime
  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  // ...
}
```

**Characteristics:**
- Loaded at server startup or request time
- Changing environment variables requires an app restart (no rebuild needed)
- Available server-side only (not exposed to clients)
- Secret information is managed here

**When to use each:**

| Use case | Type | Example |
|------|------|-----|
| API base URL | Build-time | `NEXT_PUBLIC_API_URL` |
| Google Analytics ID | Build-time | `NEXT_PUBLIC_GA_ID` |
| Database connection string | Runtime | `DATABASE_URL` |
| API secret key | Runtime | `STRIPE_SECRET_KEY` |
| Build version info | Build-time | `BUILD_ID`, `COMMIT_SHA` |

**Behavior in Vercel environment:**

```bash
# Build-time variable: Check "Exposed to Client" in Vercel UI
NEXT_PUBLIC_API_URL=https://api.example.com

# Runtime variable: Default (unchecked)
DATABASE_URL=postgresql://...
```

---

## Next Guides to Read

---

## References
1. The Twelve-Factor App. "III. Config - Store config in the environment." 12factor.net, 2017.
2. Next.js. "Environment Variables." nextjs.org/docs, 2024.
3. Vercel. "Environment Variables." vercel.com/docs, 2024.
4. Vite. "Env Variables and Modes." vitejs.dev/guide, 2024.
5. AWS. "AWS Secrets Manager User Guide." docs.aws.amazon.com, 2024.
6. HashiCorp. "Vault Documentation." developer.hashicorp.com/vault, 2024.
7. Bitnami. "Sealed Secrets." github.com/bitnami-labs/sealed-secrets, 2024.
8. External Secrets Operator. "Getting Started." external-secrets.io, 2024.
9. LaunchDarkly. "Feature Flags Best Practices." launchdarkly.com/blog, 2024.
10. Martin Fowler. "Feature Toggles (aka Feature Flags)." martinfowler.com, 2023.
