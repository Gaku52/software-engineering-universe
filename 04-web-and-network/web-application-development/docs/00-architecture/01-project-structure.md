# Project Structure

> Project structure determines the productivity of the development team. Master the principles and patterns of scalable, maintainable directory design — from feature-based structures and layered architectures to monorepo design.

## Prerequisites

Before studying this chapter, it is recommended to acquire the following knowledge.

- Concepts of SPA/MPA/SSR and differences in rendering approaches
  - Reference: `./00-spa-mpa-ssr.md`
- Understanding of module systems (ESM vs CommonJS)
  - How import/export works
  - Principles of tree-shaking
  - Lazy loading with dynamic import

## What You Will Learn

- [ ] Understand feature-based directory design
- [ ] Grasp how to apply layered architecture
- [ ] Learn monorepo and package splitting design
- [ ] Master automating dependency rules with ESLint
- [ ] Understand test placement strategy and CI/CD integration
- [ ] Grasp selection criteria for structure based on project scale

## Prerequisites

Before studying this chapter, it is recommended to acquire the following knowledge.

- **SPA/MPA/SSR concepts**: Understanding the characteristics and selection criteria of each rendering approach
  → Reference: `./00-spa-mpa-ssr.md`
- **Module systems**: Differences between ESM (ES Modules) and CommonJS, how import/export works
- **Path resolution**: Understanding relative vs absolute paths, TypeScript paths configuration

---

## 1. Principles of Directory Design

### 1.1 Why Directory Design Matters

Directory design is the "first impression" of software architecture and directly impacts the overall quality of a project. The ideal structure allows new team members to predict where code lives the moment they open the repository, and to navigate to the file they need to modify without confusion.

**Benefits of good directory design:**

| Benefit | Description |
|---------|-------------|
| Discoverability | "Where is this code?" is intuitively clear |
| Changeability | The impact of feature additions and changes is clear and localized |
| Deletability | Unwanted features can be safely deleted directory by directory |
| Team scale | Multiple teams can work independently, reducing conflicts |
| Onboarding speed | New members can grasp the entire project in a short time |
| Test efficiency | Only tests for changed features need to be run |

### 1.2 Anti-pattern: Technical-based Structure

A common initial structure that many projects adopt is "technical-based" directory design. This groups files by their technical role.

```
Technical-based structure (anti-pattern):

  src/
  ├── components/         ← All components mixed together
  │   ├── Button.tsx
  │   ├── UserList.tsx
  │   ├── UserCard.tsx
  │   ├── OrderTable.tsx
  │   ├── OrderStatusBadge.tsx
  │   ├── AuthForm.tsx
  │   ├── SettingsPanel.tsx
  │   ├── DashboardChart.tsx
  │   └── ... (100+ files)
  ├── hooks/              ← All hooks mixed together
  │   ├── useUsers.ts
  │   ├── useOrders.ts
  │   ├── useAuth.ts
  │   ├── useLocalStorage.ts
  │   └── ... (50+ files)
  ├── utils/              ← All utilities mixed together
  │   ├── formatDate.ts
  │   ├── validateEmail.ts
  │   ├── calculatePrice.ts
  │   └── ... (30+ files)
  ├── types/              ← All types mixed together
  │   ├── user.ts
  │   ├── order.ts
  │   ├── auth.ts
  │   └── ...
  ├── api/                ← All API calls mixed together
  │   ├── users.ts
  │   ├── orders.ts
  │   └── auth.ts
  └── constants/
      ├── userRoles.ts
      └── orderStatus.ts
```

**Problems with technical-based structure:**

```
Problem 1: Lack of scalability
  - 100+ files line up in components/, making it impossible to find what you need
  - Sorting alphabetically by filename doesn't reveal relationships
  - You have to keep scrolling through the file tree in the IDE

Problem 2: Scattered related code
  - Code related to the User feature is scattered across 5+ locations:
    components/UserList.tsx, hooks/useUsers.ts, api/users.ts,
    types/user.ts, utils/formatUser.ts
  - Changing one feature requires navigating across multiple directories

Problem 3: Opaque dependencies
  - Hard to track which component uses which hook
  - Circular references are likely to occur
  - Cannot analyze the scope of impact

Problem 4: Difficulty deleting and refactoring
  - When deleting a feature, scattered related files lead to omissions
  - Hard to determine "is this utility used elsewhere?"
  - Dead code tends to accumulate
```

### 1.3 Recommended Pattern: Feature-based Structure

Feature-based structure groups code by business domain feature.

```
Feature-based structure (recommended):

  src/
  ├── features/           ← Group by feature
  │   ├── users/
  │   │   ├── components/
  │   │   │   ├── UserList.tsx
  │   │   │   ├── UserCard.tsx
  │   │   │   └── UserSearchInput.tsx
  │   │   ├── hooks/
  │   │   │   ├── useUsers.ts
  │   │   │   └── useUser.ts
  │   │   ├── api/
  │   │   │   ├── queries.ts
  │   │   │   └── actions.ts
  │   │   ├── types/
  │   │   │   └── user.ts
  │   │   ├── utils/
  │   │   │   └── format.ts
  │   │   ├── __tests__/
  │   │   │   ├── UserList.test.tsx
  │   │   │   └── useUsers.test.ts
  │   │   └── index.ts    ← Define public API
  │   ├── orders/
  │   │   ├── components/
  │   │   ├── hooks/
  │   │   ├── api/
  │   │   ├── types/
  │   │   ├── __tests__/
  │   │   └── index.ts
  │   ├── auth/
  │   │   ├── components/
  │   │   ├── hooks/
  │   │   ├── providers/
  │   │   └── index.ts
  │   └── notifications/
  │       ├── components/
  │       ├── hooks/
  │       └── index.ts
  ├── shared/             ← Shared components and utilities
  │   ├── components/
  │   │   ├── ui/
  │   │   │   ├── Button.tsx
  │   │   │   ├── Modal.tsx
  │   │   │   ├── Table.tsx
  │   │   │   └── Input.tsx
  │   │   └── layout/
  │   │       ├── Header.tsx
  │   │       ├── Sidebar.tsx
  │   │       └── Footer.tsx
  │   ├── hooks/
  │   │   ├── useLocalStorage.ts
  │   │   ├── useDebounce.ts
  │   │   └── useMediaQuery.ts
  │   ├── lib/
  │   │   ├── api-client.ts
  │   │   ├── auth.ts
  │   │   └── utils.ts
  │   ├── types/
  │   │   ├── api.ts
  │   │   └── common.ts
  │   └── constants/
  │       └── routes.ts
  └── app/                ← Routing and layouts
      ├── layout.tsx
      ├── page.tsx
      └── (routes)/
```

**Benefits of feature-based structure:**

| Benefit | Details |
|---------|---------|
| High cohesion | Related code is consolidated in one directory |
| Low coupling | Dependencies between features can be explicitly controlled |
| Independent deploy | Easy future migration to micro-frontends |
| Team splitting | Ownership can be assigned per feature |
| Testability | Tests can be run and managed per feature |

### 1.4 Gradual Migration to Feature-based Structure

The steps to migrate from an existing technical-based project to feature-based are as follows.

```typescript
// Step 1: Create shared/ directory and move generic code
// Before migration
// src/components/Button.tsx → src/shared/components/ui/Button.tsx
// src/hooks/useLocalStorage.ts → src/shared/hooks/useLocalStorage.ts

// Step 2: Extract the most cohesive feature into features/
// src/components/UserList.tsx → src/features/users/components/UserList.tsx
// src/hooks/useUsers.ts → src/features/users/hooks/useUsers.ts
// src/api/users.ts → src/features/users/api/queries.ts
// src/types/user.ts → src/features/users/types/user.ts

// Step 3: Create index.ts to define the public API
// src/features/users/index.ts
export { UserList } from './components/UserList';
export { useUsers } from './hooks/useUsers';
export type { User } from './types/user';

// Step 4: Update existing imports
// Before
import { UserList } from '@/components/UserList';
import { useUsers } from '@/hooks/useUsers';

// After
import { UserList, useUsers } from '@/features/users';

// Step 5: Migrate remaining features one by one
// orders, auth, notifications, ...
```

**Notes during migration:**

```
1. Don't migrate everything at once
   - Migrate one feature at a time, running tests at each step
   - Create PRs per feature

2. Use automatic import update tools
   - VS Code "Move to a new file" feature
   - TypeScript Language Service updates references
   - Batch processing with jscodeshift

3. Import rule checks in CI
   - Set up ESLint import/no-restricted-paths
   - Prohibit access to migrated features via old paths

4. Documentation
   - Describe new structure rules in ARCHITECTURE.md
   - Record migration decision rationale in ADR (Architecture Decision Records)
```

### 1.5 Comparison of Structure Patterns

The appropriate pattern varies depending on the project scale and team composition.

```
Pattern comparison table:

  Pattern              | Scale          | Pros                          | Cons
  ---------------------|----------------|-------------------------------|--------------------
  Technical-based      | Small          | Simple, low learning cost     | Doesn't scale
  Feature-based        | Medium~large   | High cohesion, low coupling   | Initial design cost
  Layered              | Medium         | Clear responsibilities        | Many cross-cutting changes
  Modular monolith     | Large          | Ready for microservices       | Design skill required
  Micro-frontends      | Very large     | Full team independence        | High operational cost

  Selection criteria:
  - File count < 50     → Technical-based is OK
  - File count 50-200   → Feature-based recommended
  - File count 200+     → Feature-based + monorepo
  - Team 1-3 people     → Feature-based
  - Team 4-10 people    → Feature-based + strict import rules
  - Team 10+ people     → Monorepo + feature-based
```

---

## 2. Next.js App Router Project Structure

### 2.1 Basic Structure

The following shows the recommended structure when using Next.js 14+ App Router. App Router uses filesystem-based routing, where the directory structure directly corresponds to URLs.

```
Recommended structure (Next.js 14+):

  project-root/
  ├── src/
  │   ├── app/                    ← Routing (App Router)
  │   │   ├── layout.tsx          ← Root layout
  │   │   ├── page.tsx            ← / page
  │   │   ├── error.tsx           ← Global error UI
  │   │   ├── loading.tsx         ← Global loading UI
  │   │   ├── not-found.tsx       ← 404 page
  │   │   ├── global-error.tsx    ← Root error boundary
  │   │   ├── (marketing)/        ← Route group (no effect on URL)
  │   │   │   ├── layout.tsx      ← Marketing layout
  │   │   │   ├── page.tsx        ← /
  │   │   │   ├── about/
  │   │   │   │   └── page.tsx    ← /about
  │   │   │   ├── pricing/
  │   │   │   │   └── page.tsx    ← /pricing
  │   │   │   └── blog/
  │   │   │       ├── page.tsx    ← /blog
  │   │   │       └── [slug]/
  │   │   │           └── page.tsx ← /blog/:slug
  │   │   ├── (app)/              ← Authentication-required area
  │   │   │   ├── layout.tsx      ← Layout with auth check
  │   │   │   ├── dashboard/
  │   │   │   │   ├── page.tsx    ← /dashboard
  │   │   │   │   └── loading.tsx ← Dashboard loading
  │   │   │   ├── settings/
  │   │   │   │   ├── page.tsx    ← /settings
  │   │   │   │   ├── profile/
  │   │   │   │   │   └── page.tsx
  │   │   │   │   └── billing/
  │   │   │   │       └── page.tsx
  │   │   │   └── projects/
  │   │   │       ├── page.tsx    ← /projects
  │   │   │       ├── new/
  │   │   │       │   └── page.tsx ← /projects/new
  │   │   │       └── [id]/
  │   │   │           ├── page.tsx ← /projects/:id
  │   │   │           └── edit/
  │   │   │               └── page.tsx
  │   │   └── api/                ← API Routes (Route Handlers)
  │   │       ├── auth/
  │   │       │   └── [...nextauth]/
  │   │       │       └── route.ts
  │   │       └── webhooks/
  │   │           └── stripe/
  │   │               └── route.ts
  │   ├── features/               ← Feature modules
  │   │   ├── users/
  │   │   ├── projects/
  │   │   ├── billing/
  │   │   ├── auth/
  │   │   └── notifications/
  │   ├── shared/                 ← Shared resources
  │   │   ├── components/
  │   │   │   ├── ui/             ← Basic UI (shadcn/ui, etc.)
  │   │   │   └── layout/         ← Layout components
  │   │   ├── hooks/
  │   │   ├── lib/                ← Utilities
  │   │   │   ├── api-client.ts
  │   │   │   ├── auth.ts
  │   │   │   ├── db.ts
  │   │   │   └── utils.ts
  │   │   ├── types/
  │   │   └── constants/
  │   ├── middleware.ts            ← Next.js Middleware
  │   └── styles/
  │       └── globals.css
  ├── public/
  │   ├── images/
  │   ├── fonts/
  │   └── favicon.ico
  ├── prisma/                     ← Prisma schema
  │   ├── schema.prisma
  │   ├── seed.ts
  │   └── migrations/
  ├── tests/
  │   ├── e2e/                    ← E2E tests (Playwright)
  │   └── integration/            ← Integration tests
  ├── .github/
  │   └── workflows/
  ├── next.config.js
  ├── tailwind.config.ts
  ├── tsconfig.json
  ├── .env.local
  ├── .env.example
  └── package.json
```

### 2.2 Special Files in App Router

In Next.js App Router, certain filenames have special meanings.

```typescript
// --- layout.tsx ---
// Layout shared between pages. Not re-rendered when child routes navigate.
// src/app/(app)/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/shared/lib/auth';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Header } from '@/shared/components/layout/Header';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar user={session.user} />
      <div className="flex-1 flex flex-col">
        <Header user={session.user} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// --- page.tsx ---
// Defines the route UI. The directory containing this file corresponds to the URL.
// src/app/(app)/dashboard/page.tsx
import { Suspense } from 'react';
import { DashboardStats } from '@/features/dashboard/components/DashboardStats';
import { RecentActivity } from '@/features/dashboard/components/RecentActivity';
import { DashboardSkeleton } from '@/features/dashboard/components/DashboardSkeleton';

export const metadata = {
  title: 'Dashboard | MyApp',
  description: 'Your dashboard overview',
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardStats />
      </Suspense>
      <Suspense fallback={<div>Loading activity...</div>}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}

// --- error.tsx ---
// Error boundary. Catches runtime errors and displays a fallback UI.
// src/app/(app)/dashboard/error.tsx
'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { Button } from '@/shared/components/ui/Button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send log to error reporting service
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}

// --- loading.tsx ---
// Fallback UI for Suspense boundary. Used with streaming SSR.
// src/app/(app)/dashboard/loading.tsx
import { Skeleton } from '@/shared/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// --- not-found.tsx ---
// Custom 404 page
// src/app/not-found.tsx
import Link from 'next/link';
import { Button } from '@/shared/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-xl text-muted-foreground">Page not found</p>
      <Button asChild>
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}

// --- route.ts ---
// API Route Handler. Defines RESTful API endpoints.
// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'checkout.session.completed':
        // Handle payment completion
        break;
      case 'customer.subscription.updated':
        // Handle subscription update
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }
}
```

### 2.3 Using Route Groups

Route groups `()` logically group routes without affecting the URL.

```
Route group usage patterns:

  src/app/
  ├── (marketing)/          ← Public pages (with header/footer)
  │   ├── layout.tsx        ← Marketing layout
  │   ├── page.tsx
  │   ├── about/
  │   └── pricing/
  ├── (app)/                ← Pages requiring authentication (with sidebar)
  │   ├── layout.tsx        ← App layout (with auth check)
  │   ├── dashboard/
  │   └── settings/
  ├── (auth)/               ← Auth-related pages (minimal layout)
  │   ├── layout.tsx        ← Auth layout
  │   ├── login/
  │   ├── register/
  │   └── forgot-password/
  └── layout.tsx            ← Root layout (Providers, etc.)

  Benefits:
  ✓ Layouts can be separated per group
  ✓ Does not affect URL paths
  ✓ Clearly separates authenticated and unauthenticated areas
  ✓ Limits scope of CSS and logic
```

```typescript
// src/app/(auth)/layout.tsx — Minimal layout for auth pages
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        {children}
      </div>
    </div>
  );
}

// src/app/(marketing)/layout.tsx — Marketing layout
import { MarketingHeader } from '@/shared/components/layout/MarketingHeader';
import { Footer } from '@/shared/components/layout/Footer';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingHeader />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

### 2.4 Design Rules for the app/ Directory

```
  Rule 1: Only routing and page components in app/
    Files in app/ are responsible only for "which component to display at which URL"
    Delegate business logic, data fetching, and state management to features/

  Rule 2: Business logic goes in features/
    Page components only compose components from features/
    Do not write direct DB queries or API calls inside page files

  Rule 3: Things used by 2+ features go in shared/
    Generic UI like Button, Modal, Table goes in shared/components/
    Generic hooks like useLocalStorage, useDebounce go in shared/hooks/
    Date formatting, validation, etc. go in shared/lib/

  Rule 4: Direct imports between features are forbidden (go through shared/)
    features/users/ → features/orders/ is NOT OK
    Instead, define interfaces in shared/ and go through it
```

```typescript
// Rule violation example (BAD)
// src/app/(app)/dashboard/page.tsx
import { prisma } from '@/shared/lib/db';  // ← Direct DB access in page

export default async function DashboardPage() {
  const users = await prisma.user.findMany();  // ← Business logic mixed into page
  const orders = await prisma.order.findMany({
    where: { status: 'pending' },
    include: { user: true },
  });

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Displaying data directly */}
      <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
    </div>
  );
}

// Rule-compliant example (GOOD)
// src/app/(app)/dashboard/page.tsx
import { DashboardStats } from '@/features/dashboard/components/DashboardStats';
import { RecentOrders } from '@/features/orders/components/RecentOrders';
import { ActiveUsers } from '@/features/users/components/ActiveUsers';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <DashboardStats />
      <div className="grid grid-cols-2 gap-6">
        <RecentOrders />
        <ActiveUsers />
      </div>
    </div>
  );
}

// Data fetching is done inside features/
// src/features/dashboard/components/DashboardStats.tsx
import { getDashboardStats } from '../api/queries';

export async function DashboardStats() {
  const stats = await getDashboardStats();

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard title="Total Users" value={stats.totalUsers} />
      <StatCard title="Active Orders" value={stats.activeOrders} />
      <StatCard title="Revenue" value={`$${stats.revenue}`} />
      <StatCard title="Conversion" value={`${stats.conversionRate}%`} />
    </div>
  );
}
```

---

## 3. Feature Module Design

### 3.1 Feature Module Structure

Each feature module is a self-contained unit with a clear internal structure.

```typescript
// Internal structure of features/users/
// features/users/
// ├── components/           ← UI components
// │   ├── UserList.tsx      ← Server Component (includes data fetching)
// │   ├── UserCard.tsx      ← Server Component
// │   ├── UserAvatar.tsx    ← Server Component
// │   ├── UserSearchInput.tsx ← Client Component (interactive)
// │   └── UserForm.tsx      ← Client Component (form)
// ├── hooks/                ← Custom hooks
// │   ├── useUsers.ts       ← Fetch user list
// │   ├── useUser.ts        ← Fetch individual user
// │   └── useUserForm.ts    ← Form logic
// ├── api/                  ← Data fetching and mutation
// │   ├── queries.ts        ← Server-side queries / TanStack Query
// │   └── actions.ts        ← Server Actions
// ├── types/                ← Type definitions
// │   └── user.ts
// ├── utils/                ← Feature-specific utilities
// │   ├── format.ts         ← User name formatting, etc.
// │   └── validation.ts     ← Validation schema
// ├── constants/            ← Feature-specific constants
// │   └── roles.ts
// ├── __tests__/            ← Tests
// │   ├── UserList.test.tsx
// │   ├── useUsers.test.ts
// │   └── actions.test.ts
// └── index.ts              ← Public API

// features/users/index.ts — Public API definition
// Only accessible from this file externally

// Components (only those allowed for external use)
export { UserList } from './components/UserList';
export { UserCard } from './components/UserCard';
export { UserAvatar } from './components/UserAvatar';

// Hooks
export { useUsers } from './hooks/useUsers';
export { useUser } from './hooks/useUser';

// Types
export type { User, CreateUserInput, UpdateUserInput } from './types/user';

// Actions
export { createUser, updateUser, deleteUser } from './api/actions';

// Note: Do not export internal implementations
// UserSearchInput, UserForm are treated as internal components
// format.ts, validation.ts are not exposed externally
```

### 3.2 API Layer Design

```typescript
// features/users/api/queries.ts
// Server-side data fetching (called from Server Components)
import { prisma } from '@/shared/lib/db';
import { cache } from 'react';

// Eliminate duplicate requests within the same render using React's cache()
export const getUsers = cache(async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}) => {
  const { page = 1, limit = 20, search, role } = params ?? {};

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(role && { role }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});

export const getUser = cache(async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${id}`);
  }

  return user;
});

// features/users/api/actions.ts
// Server Actions (mutations from forms or client)
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/db';
import { z } from 'zod';
import { CreateUserInput, UpdateUserInput } from '../types/user';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export async function createUser(input: CreateUserInput) {
  const validated = createUserSchema.parse(input);

  const existingUser = await prisma.user.findUnique({
    where: { email: validated.email },
  });

  if (existingUser) {
    return { error: 'A user with this email already exists' };
  }

  const user = await prisma.user.create({
    data: validated,
  });

  revalidatePath('/dashboard');
  revalidatePath('/users');

  return { data: user };
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await prisma.user.update({
    where: { id },
    data: input,
  });

  revalidatePath('/dashboard');
  revalidatePath(`/users/${id}`);
  revalidatePath('/users');

  return { data: user };
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });

  revalidatePath('/dashboard');
  revalidatePath('/users');

  return { success: true };
}
```

### 3.3 Type Definition Design

```typescript
// features/users/types/user.ts
// Type definitions used within the feature

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'member' | 'viewer';

// Types for API requests
export interface CreateUserInput {
  name: string;
  email: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  avatarUrl?: string | null;
}

// Response with pagination
export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Filter conditions
export interface UserFilters {
  search?: string;
  role?: UserRole;
  page?: number;
  limit?: number;
}

// User detail (including relations)
export interface UserDetail extends User {
  orders: {
    id: string;
    total: number;
    status: string;
    createdAt: Date;
  }[];
  _count: {
    orders: number;
  };
}
```

### 3.4 Implementing Dependency Rules

Strictly managing dependencies between features is the most important aspect of the feature-based structure.

```
Dependency Rules:

  Allowed dependencies:
  ✓ features/users/  → shared/         (using shared resources)
  ✓ app/            → features/users/   (used from pages)
  ✓ app/            → shared/           (using shared resources)

  Forbidden dependencies:
  ✗ features/users/  → features/orders/ (direct reference between features)
  ✗ shared/          → features/users/  (reference from shared to a specific feature)
  ✗ Inside features/users/ → accessed externally (only via index.ts)

  When cross-feature communication is needed:
  Method 1: Define interface in shared/
    Define UserEvent type in shared/types/events.ts
    features/users/ publishes UserEvent
    features/notifications/ subscribes to UserEvent

  Method 2: Orchestration in app/
    Combine both features in app/(app)/dashboard/page.tsx

  Method 3: Event bus pattern
    Define event bus in shared/lib/event-bus.ts
    Each feature independently publishes and subscribes to events
```

```typescript
// shared/lib/event-bus.ts — Event bus for cross-feature communication
type EventHandler<T = unknown> = (data: T) => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler);
    };
  }

  emit<T>(event: string, data: T): void {
    this.handlers.get(event)?.forEach(handler => handler(data));
  }
}

export const eventBus = new EventBus();

// shared/types/events.ts
export interface UserCreatedEvent {
  userId: string;
  email: string;
  name: string;
}

export interface OrderCompletedEvent {
  orderId: string;
  userId: string;
  total: number;
}

// features/users/api/actions.ts — Publishing events
import { eventBus } from '@/shared/lib/event-bus';
import type { UserCreatedEvent } from '@/shared/types/events';

export async function createUser(input: CreateUserInput) {
  const user = await prisma.user.create({ data: input });

  eventBus.emit<UserCreatedEvent>('user:created', {
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return { data: user };
}

// features/notifications/hooks/useUserEvents.ts — Subscribing to events
import { useEffect } from 'react';
import { eventBus } from '@/shared/lib/event-bus';
import type { UserCreatedEvent } from '@/shared/types/events';

export function useUserEvents() {
  useEffect(() => {
    const unsubscribe = eventBus.on<UserCreatedEvent>(
      'user:created',
      (data) => {
        // Show notification
        showNotification(`New user: ${data.name}`);
      }
    );

    return unsubscribe;
  }, []);
}
```

---

## 4. Path Aliases and Import Management

### 4.1 TypeScript Path Alias Configuration

Configuring path aliases eliminates the complexity of relative paths and greatly improves code readability and maintainability.

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@features/*": ["./src/features/*"],
      "@shared/*": ["./src/shared/*"],
      "@app/*": ["./src/app/*"],
      "@tests/*": ["./tests/*"]
    }
  }
}
```

```typescript
// Path alias usage examples

// BAD: Relative paths are hard to read when deeply nested
import { Button } from '../../../shared/components/ui/Button';
import { useUsers } from '../../users/hooks/useUsers';
import { formatDate } from '../../../shared/lib/utils';

// GOOD: Clear with path aliases
import { Button } from '@/shared/components/ui/Button';
import { useUsers } from '@/features/users';
import { formatDate } from '@/shared/lib/utils';

// Even better: Via feature's index.ts
import { UserList, useUsers, type User } from '@features/users';
import { Button, Modal, Table } from '@shared/components/ui';
```

### 4.2 Automating Import Rules with ESLint

Writing dependency rules only in documentation is insufficient. Use ESLint to automatically detect rule violations.

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['import', 'boundaries'],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
    // boundaries plugin configuration
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/*' },
      { type: 'features', pattern: 'src/features/*' },
      { type: 'shared', pattern: 'src/shared/*' },
    ],
    'boundaries/ignore': ['**/*.test.*', '**/*.spec.*'],
  },
  rules: {
    // Prohibit direct imports between features
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // Prohibit import from features/orders/ to features/users/
          {
            target: './src/features/users/**',
            from: './src/features/orders/**',
            message: 'Feature modules cannot import from other features directly. Use shared/ instead.',
          },
          {
            target: './src/features/orders/**',
            from: './src/features/users/**',
            message: 'Feature modules cannot import from other features directly. Use shared/ instead.',
          },
          // Prohibit import from shared/ to features/
          {
            target: './src/shared/**',
            from: './src/features/**',
            message: 'Shared modules cannot depend on feature modules.',
          },
        ],
      },
    ],

    // Enforce consistent import order
    'import/order': [
      'error',
      {
        groups: [
          'builtin',       // Node.js built-in modules
          'external',      // npm packages
          'internal',      // path aliases
          'parent',        // parent directories
          'sibling',       // same level
          'index',         // index files
          'type',          // type imports
        ],
        pathGroups: [
          { pattern: 'react', group: 'builtin', position: 'before' },
          { pattern: 'next/**', group: 'builtin', position: 'before' },
          { pattern: '@/features/**', group: 'internal', position: 'before' },
          { pattern: '@/shared/**', group: 'internal', position: 'after' },
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    // Prohibit direct access to feature internal files
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/features/*/components/*', '@/features/*/hooks/*', '@/features/*/api/*'],
            message: 'Import from the feature index file instead: @/features/<name>',
          },
        ],
      },
    ],
  },
};
```

### 4.3 Barrel Export Pattern and Its Caveats

```typescript
// Barrel Export (re-export from index.ts)
// src/shared/components/ui/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Modal } from './Modal';
export { Table } from './Table';
export { Select } from './Select';
export { Checkbox } from './Checkbox';
export { Skeleton } from './Skeleton';
export { Badge } from './Badge';
export { Card, CardHeader, CardContent, CardFooter } from './Card';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

// Consumer side
import { Button, Modal, Table } from '@/shared/components/ui';
```

**Barrel Export caveats:**

```
Benefits:
  ✓ Import statements become shorter, improving readability
  ✓ Public API can be explicitly controlled
  ✓ Changes to internal implementation don't affect the outside

Caveats:
  ✗ Tree-shaking interference
    The bundler may not be able to remove unused exports
    This has a large impact especially in Server Components

  ✗ Risk of circular references
    Multiple barrel files referencing each other can create cycles

  ✗ Performance
    Large numbers of re-exports become overhead for module resolution

Solutions:
  - Use index.ts selectively in features/ (recommended)
  - shared/components/ui/ barrel is OK
  - Use modularizeImports configuration in Next.js
```

```javascript
// next.config.js — Avoid barrel export issues with modularizeImports
/** @type {import('next').NextConfig} */
const nextConfig = {
  modularizeImports: {
    // Auto-convert to individual lodash imports
    'lodash': {
      transform: 'lodash/{{member}}',
    },
    // Auto-convert to individual @/shared/components/ui imports
    '@/shared/components/ui': {
      transform: '@/shared/components/ui/{{member}}',
    },
  },
};

module.exports = nextConfig;
```

---

## 5. Monorepo Design

### 5.1 Basic Monorepo Structure

Monorepos managing multiple applications and packages in a single repository are adopted in medium to large projects.

```
Monorepo structure (Turborepo + pnpm):

  monorepo/
  ├── apps/                     ← Applications
  │   ├── web/                  ← Next.js frontend
  │   │   ├── src/
  │   │   │   ├── app/
  │   │   │   ├── features/
  │   │   │   └── shared/
  │   │   ├── next.config.js
  │   │   ├── tailwind.config.ts
  │   │   ├── tsconfig.json     ← extends: @repo/typescript-config
  │   │   └── package.json
  │   ├── admin/                ← Admin panel
  │   │   ├── src/
  │   │   ├── next.config.js
  │   │   └── package.json
  │   ├── api/                  ← Backend API (Hono / Express)
  │   │   ├── src/
  │   │   │   ├── routes/
  │   │   │   ├── services/
  │   │   │   └── middleware/
  │   │   └── package.json
  │   ├── docs/                 ← Documentation site
  │   │   └── package.json
  │   └── mobile/               ← React Native / Expo
  │       └── package.json
  ├── packages/                 ← Shared packages
  │   ├── ui/                   ← Shared UI components
  │   │   ├── src/
  │   │   │   ├── Button.tsx
  │   │   │   ├── Modal.tsx
  │   │   │   └── index.ts
  │   │   ├── tsconfig.json
  │   │   └── package.json
  │   ├── db/                   ← Prisma schema + client
  │   │   ├── prisma/
  │   │   │   └── schema.prisma
  │   │   ├── src/
  │   │   │   └── client.ts
  │   │   └── package.json
  │   ├── auth/                 ← Authentication logic
  │   │   ├── src/
  │   │   └── package.json
  │   ├── email/                ← Email templates
  │   │   ├── src/
  │   │   └── package.json
  │   ├── config/               ← Shared configuration
  │   │   ├── eslint/
  │   │   │   ├── base.js
  │   │   │   ├── next.js
  │   │   │   └── package.json
  │   │   └── typescript/
  │   │       ├── base.json
  │   │       ├── next.json
  │   │       ├── node.json
  │   │       └── package.json
  │   ├── types/                ← Shared type definitions
  │   │   ├── src/
  │   │   │   ├── user.ts
  │   │   │   ├── order.ts
  │   │   │   └── index.ts
  │   │   └── package.json
  │   └── utils/                ← Shared utilities
  │       ├── src/
  │       │   ├── format.ts
  │       │   ├── validation.ts
  │       │   └── index.ts
  │       └── package.json
  ├── tooling/                  ← Dev tool configuration
  │   ├── github/
  │   │   └── workflows/
  │   └── docker/
  │       ├── Dockerfile.web
  │       └── docker-compose.yml
  ├── turbo.json                ← Turborepo configuration
  ├── pnpm-workspace.yaml       ← pnpm workspace definition
  ├── package.json              ← Root package.json
  ├── .gitignore
  └── .env.example
```

### 5.2 Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["DATABASE_URL", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": false
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

```json
// package.json (root)
{
  "name": "my-monorepo",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "type-check": "turbo type-check",
    "clean": "turbo clean",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "db:push": "pnpm --filter @repo/db db:push",
    "db:studio": "pnpm --filter @repo/db db:studio",
    "db:generate": "pnpm --filter @repo/db db:generate"
  },
  "devDependencies": {
    "prettier": "^3.2.0",
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### 5.3 Creating Shared Packages

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.tsx"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "^5.3.0"
  }
}
```

```typescript
// packages/ui/src/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
import { forwardRef } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

// packages/ui/src/index.ts
export { Button, type ButtonProps, buttonVariants } from './Button';
export { Input, type InputProps } from './Input';
export { Modal, type ModalProps } from './Modal';
export { Table } from './Table';
```

```typescript
// apps/web/src/app/page.tsx — Using shared packages
import { Button } from '@repo/ui';
import { formatDate } from '@repo/utils';
import type { User } from '@repo/types';

export default function HomePage() {
  return (
    <div>
      <h1>Welcome</h1>
      <Button variant="default" size="lg">
        Get Started
      </Button>
    </div>
  );
}
```

### 5.4 Monorepo Tool Comparison

```
Detailed tool comparison:

  Feature              | Turborepo      | Nx              | pnpm workspace
  ---------------------|----------------|-----------------|------------------
  Remote cache         | ✓ (Vercel)    | ✓ (Nx Cloud)   | ✗
  Local cache          | ✓             | ✓              | ✗
  Parallel task exec   | ✓             | ✓              | Limited
  Dependency graph viz | ✓             | ✓ (rich)       | ✗
  Code generation      | ✗             | ✓ (Generator)  | ✗
  Plugins              | Few            | Many           | ✗
  Configuration        | Minimal        | Moderate       | Least
  Learning cost        | Low            | Moderate       | Lowest
  Performance          | Fast           | Fast           | Moderate
  Recommended for      | Web/frontend   | Enterprise     | Small scale

  Selection guide:
  - Web frontend focused → Turborepo (strong Vercel integration)
  - Enterprise/large scale → Nx (rich tools and plugins)
  - Minimal, simple setup → pnpm workspace (no extra tools needed)
  - Includes React Native → Turborepo or Nx
```

### 5.5 Monorepo CI/CD Design

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-type-check, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  # Deploy only affected packages
  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Needed for turbo change detection
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      # Deploy only changed apps
      - run: pnpm turbo build --filter=...[HEAD~1]
```

---

## 6. Test Placement Strategy

### 6.1 Test File Placement Patterns

There are multiple patterns for placing test files; choose based on project characteristics.

```
Pattern 1: Colocation (recommended)
  Place tests close to the target file

  features/users/
  ├── components/
  │   ├── UserList.tsx
  │   ├── UserList.test.tsx      ← Component test
  │   ├── UserCard.tsx
  │   └── UserCard.test.tsx
  ├── hooks/
  │   ├── useUsers.ts
  │   └── useUsers.test.ts       ← Hook test
  ├── api/
  │   ├── actions.ts
  │   └── actions.test.ts        ← Server Actions test
  └── utils/
      ├── format.ts
      └── format.test.ts         ← Utility test

  Benefits:
  ✓ Relationship with test target is immediately clear
  ✓ Tests disappear together when feature is deleted
  ✓ Easy to notice when tests are missing

Pattern 2: __tests__ directory
  Create a __tests__ directory inside the feature

  features/users/
  ├── components/
  │   ├── UserList.tsx
  │   └── UserCard.tsx
  ├── hooks/
  │   └── useUsers.ts
  └── __tests__/
      ├── UserList.test.tsx
      ├── UserCard.test.tsx
      └── useUsers.test.ts

  Benefits:
  ✓ Tests and production code are clearly separated
  ✓ File tree is cleaner
  ✓ Easy to operate on tests alone

Pattern 3: Top-level tests directory
  Used for integration tests and E2E tests

  project-root/
  ├── src/
  │   └── features/
  └── tests/
      ├── unit/                  ← Unit tests (not recommended, prefer colocation)
      ├── integration/           ← Integration tests
      │   ├── users.test.ts
      │   └── orders.test.ts
      └── e2e/                   ← E2E tests (Playwright)
          ├── auth.spec.ts
          ├── dashboard.spec.ts
          └── fixtures/
              └── test-data.ts
```

### 6.2 Test Configuration Files

```typescript
// vitest.config.ts — Unit test configuration
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'tests/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/index.ts',    // barrel files
        'src/app/**',          // routing files
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
});

// playwright.config.ts — E2E test configuration
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 6.3 Practical Test Examples

```typescript
// features/users/components/UserList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UserList } from './UserList';

// Testing async Server Component
describe('UserList', () => {
  it('displays the user list', async () => {
    // Test by directly rendering the Server Component
    const result = await UserList({ page: 1 });
    render(result);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(21); // header + 20 rows
  });

  it('shows empty state message when there are 0 users', async () => {
    vi.mocked(getUsers).mockResolvedValueOnce({
      users: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const result = await UserList({ page: 1 });
    render(result);

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });
});

// features/users/hooks/useUsers.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { useUsers } from './useUsers';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('useUsers', () => {
  it('can fetch the user list', async () => {
    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.users).toHaveLength(20);
  });

  it('can apply search filter', async () => {
    const { result } = renderHook(
      () => useUsers({ search: 'John' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: expect.stringContaining('John') }),
      ])
    );
  });
});

// features/users/api/actions.test.ts — Server Actions tests
import { describe, it, expect, beforeEach } from 'vitest';
import { createUser, updateUser, deleteUser } from './actions';
import { prisma } from '@/shared/lib/db';

// Mock Prisma
vi.mock('@/shared/lib/db', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can create a user with valid input', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'member',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createUser({
      name: 'John Doe',
      email: 'john@example.com',
    });

    expect(result.data).toBeDefined();
    expect(result.data?.name).toBe('John Doe');
    expect(prisma.user.create).toHaveBeenCalledOnce();
  });

  it('returns error for existing email address', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: '1',
      name: 'Existing',
      email: 'john@example.com',
      role: 'member',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createUser({
      name: 'John Doe',
      email: 'john@example.com',
    });

    expect(result.error).toBe('A user with this email already exists');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('throws error on validation failure', async () => {
    await expect(
      createUser({ name: '', email: 'invalid' })
    ).rejects.toThrow();
  });
});
```

### 6.4 Test File Naming Conventions

```
Naming convention comparison:

  Pattern              | Example                  | Use
  ---------------------|--------------------------|------------------
  *.test.ts(x)        | UserList.test.tsx        | Unit tests
  *.spec.ts(x)        | auth.spec.ts             | E2E tests
  *.integration.ts    | api.integration.ts       | Integration tests
  *.stories.tsx       | Button.stories.tsx       | Storybook

  Recommended:
  - Unit tests → *.test.ts(x) (colocation)
  - E2E tests → *.spec.ts (tests/e2e/ directory)
  - Integration tests → *.integration.ts (tests/integration/)
  - Storybook → *.stories.tsx (colocation)
```

---

## 7. Naming Conventions and File Structure Guidelines

### 7.1 File Naming Conventions

```
File naming convention list:

  Type                    | Convention      | Example
  ------------------------|-----------------|--------------------
  React components        | PascalCase      | UserList.tsx
  Custom hooks            | camelCase       | useUsers.ts
  Utility functions       | camelCase       | formatDate.ts
  Type definition files   | camelCase       | user.ts
  Constant files          | camelCase       | routes.ts
  Test files              | target.test     | UserList.test.tsx
  Storybook               | target.stories  | Button.stories.tsx
  Server Actions          | camelCase       | actions.ts
  API queries             | camelCase       | queries.ts
  Config files            | kebab-case      | next.config.js
  CSS/styles              | kebab-case      | globals.css
  Directory names         | kebab-case      | user-profile/
  Feature directories     | kebab-case      | order-management/

  Special Next.js files:
  - page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx
  - route.ts (API Route Handlers)
  - middleware.ts
  - template.tsx (layout reset version)
  - default.tsx (default for Parallel Routes)
```

### 7.2 Directory Naming Conventions

```typescript
// Directory names use kebab-case
// GOOD
src/features/user-management/
src/features/order-processing/
src/shared/components/data-table/

// BAD
src/features/UserManagement/    // PascalCase is reserved for component names
src/features/userManagement/    // camelCase is reserved for file names
src/features/user_management/   // snake_case is not used

// Exceptions: Next.js dynamic routes and route groups
src/app/[slug]/                 // Dynamic segment
src/app/(marketing)/            // Route group
src/app/[...catchAll]/          // Catch-all segment
src/app/@modal/                 // Parallel Routes (Named Slot)
src/app/(.)photo/               // Intercepting Routes
```

### 7.3 Export Naming Conventions

```typescript
// Components: named export with PascalCase
// features/users/components/UserList.tsx
export function UserList({ users }: UserListProps) { ... }

// BAD: default export (can't maintain name consistency)
export default function UserList() { ... }
// When importing in another file, any name can be used:
// import UsersList from './UserList';  // Different name still works

// Hooks: named export with camelCase
// features/users/hooks/useUsers.ts
export function useUsers(filters?: UserFilters) { ... }

// Types: named export with PascalCase (with type keyword)
// features/users/types/user.ts
export interface User { ... }
export type UserRole = 'admin' | 'member' | 'viewer';

// Constants: UPPER_SNAKE_CASE
// shared/constants/config.ts
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Alternative to enum: as const object
export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
```

---

## 8. Design Checklist

### 8.1 Project Initial Setup Checklist

```
Project initial setup checklist:

  Directory structure:
  □ Is the module split done with feature-based approach?
  □ Does each feature define its public API in index.ts?
  □ Are direct imports between features prohibited?
  □ Are shared components in shared/?
  □ Does app/ contain only routing?
  □ Is the test file placement rule established?

  Naming conventions:
  □ Components → PascalCase
  □ Hooks → camelCase (use prefix)
  □ Directories → kebab-case
  □ Constants → UPPER_SNAKE_CASE
  □ Are path aliases configured? (@/, @features/, @shared/)
  □ Are test files near their targets?

  Tool configuration:
  □ Is TypeScript strict mode enabled?
  □ Are ESLint import rules configured?
  □ Is Prettier configured?
  □ Are pre-commit checks set up with husky + lint-staged?
  □ Is the CI/CD pipeline configured?

  Scalability:
  □ Does adding new features not impact existing code?
  □ Is it easy to delete a feature?
  □ Can team members place files without confusion?
  □ Can tests be run per feature?

  Documentation:
  □ Does ARCHITECTURE.md exist?
  □ Is the procedure for adding features documented?
  □ Are dependency rules explicitly stated?
  □ Are ADR (Architecture Decision Records) maintained?
```

### 8.2 Code Review Checklist

```
Project structure checks during code review:

  File placement:
  □ Are new files in the correct directory?
  □ Is feature-specific code not placed in shared/?
  □ Is generic code not confined inside feature/?
  □ Have test files been added?

  Dependencies:
  □ Are there no direct imports between features?
  □ Is there no dependency from shared/ to features/?
  □ Has no circular reference occurred?
  □ Have no unnecessary dependencies been added?

  Public API:
  □ Have new components/hooks been added to index.ts?
  □ Is internal implementation not unnecessarily exposed?
  □ Are types properly exported?

  Naming:
  □ Does it follow naming conventions?
  □ Does the component name match the file name?
  □ Are overly generic names avoided (data, info, handler)?
```

### 8.3 ARCHITECTURE.md Template

```markdown
# Architecture

## Directory Structure

This project uses feature-based structure.

### Rules
1. Place only routing and page components in `app/`
2. Place business logic in `features/`
3. Place things used by 2+ features in `shared/`
4. Direct imports between features are prohibited

### Steps to Add a New Feature
1. Create `src/features/<feature-name>/` directory
2. Create components/, hooks/, api/, types/ subdirectories
3. Define public API in index.ts
4. Add tests
5. Add new feature to ESLint rules

### Dependency Diagram
app/ → features/ → shared/
app/ → shared/

### ADR
Decision records are stored in docs/adr/.
```

---

## 9. Troubleshooting

### 9.1 Common Problems and Solutions

```
Problem 1: "Can't determine which feature this belongs to"

  Solutions:
  - Consult domain experts
  - Decide based on user stories or use cases
  - Place tentatively and refactor later
  - If it spans two features, create a new feature or place in shared/

Problem 2: "shared/ has grown bloated and reverted to technical-based structure"

  Solutions:
  - Give shared/ its own structure (components/ui/, hooks/, lib/)
  - Periodically verify that items are actually used by 2+ features
  - Move things used by only one feature back inside that feature

Problem 3: "There's logic to share between features"

  Solutions:
  - Extract as utility into shared/lib/
  - Define common types in shared/types/
  - Use event bus pattern for loosely coupled communication
  - Place React Context in shared/

Problem 4: "Circular references are occurring"

  Solutions:
  - Visualize dependency graph with tools like madge
  - Extract common dependencies into shared/
  - Reverse dependencies by defining interfaces (types) in shared/
  - Enable ESLint import/no-cycle rule

Problem 5: "Tests are fragile (Fragile Tests)"

  Solutions:
  - Test against public API, not internal implementation
  - Only test exports from index.ts
  - Minimize mocks
  - Ensure test independence (eliminate dependencies between tests)
```

### 9.2 Performance Optimization

```typescript
// Problem: Unnecessary module loading from barrel exports
// BAD: Even when using just one from shared/components/ui/index.ts,
// all components may be loaded
import { Button } from '@/shared/components/ui';

// GOOD: Direct import (reliably tree-shakeable)
import { Button } from '@/shared/components/ui/Button';

// GOOD: Configure modularizeImports in next.config.js (mentioned above)

// Problem: Dynamic import of large feature modules
// Lazy-load heavy features on the client side
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(
  () => import('@/features/analytics/components/HeavyChart'),
  {
    loading: () => <Skeleton className="h-64" />,
    ssr: false, // Client-side only
  }
);

// Problem: Data prefetching in Server Components
// features/users/components/UserList.tsx
import { Suspense } from 'react';
import { getUsers } from '../api/queries';

// Parallelize data fetching with Streaming SSR
export async function UserList() {
  const { users } = await getUsers();

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

---

## FAQ

### Q1: Should I choose monorepo or multi-repo?

**A:** Decide based on project scale and team composition.

**When monorepo is suitable:**

| Benefit | Description |
|---------|-------------|
| Easy code sharing | Centrally manage types and utilities in shared/ packages |
| Dependency consistency | Unify library versions across all packages |
| Atomic changes | Can change API and frontend in the same PR |
| Refactoring efficiency | Rename Symbol in IDE fixes all packages at once |

Examples: Microservices (Web/Mobile/Admin), common base across multiple products

**When multi-repo is suitable:**

| Benefit | Description |
|---------|-------------|
| Independent release cycles | Each repository can deploy independently |
| Access control | Permissions separated per repository |
| Build speed | Impact is limited, CI/CD is faster |

Examples: Completely independent product groups, managed by different teams

**Hybrid approach:**
- Main app → monorepo (apps/web, apps/mobile, packages/shared)
- Independent products → separate repositories
- Common libraries → published as npm packages

### Q2: Which is better: feature-based or layer-based structure?

**A:** Use both depending on scale and requirements.

**Strengths of feature-based structure:**

```
features/
├── user-management/     ← Self-contained per feature
│   ├── components/      ← UI for this feature only
│   ├── hooks/           ← Logic for this feature only
│   ├── api/             ← API communication for this feature only
│   └── types/           ← Type definitions for this feature only
└── order-processing/    ← Another feature similarly
```

- **High cohesion**: Related code is physically close
- **Easy to delete**: Deleting a feature means deleting the directory
- **Team scale**: Multiple teams can work independently
- **Use case**: Medium to large apps (10+ features)

**Strengths of layer-based structure:**

```
src/
├── components/    ← All UI components
├── hooks/         ← All custom hooks
├── api/           ← All API communication
└── types/         ← All type definitions
```

- **Simple**: Clearly classified by technical role
- **Low learning cost**: Easy to understand even for beginners
- **Use case**: Small apps (fewer than 5 features), prototypes

**Recommended strategy:**
1. Start with layer-based at project start
2. Migrate to feature-based when features exceed 5
3. Place shared components (Button, Modal, etc.) in shared/

### Q3: When should I change the project structure?

**A:** Consider restructuring when you see these signals.

**Signals that indicate structure change is needed:**

| Signal | Symptom | Action |
|--------|---------|--------|
| Takes time to find files | "Where is this code?" requires searching every time | Migrate to feature-based |
| Import statements getting long | `../../../components/UserCard` | Introduce path aliases |
| Frequent circular references | Cross-feature dependencies have become complex | Visualize dependency graph → refactor |
| Duplicated code | Same logic in multiple places | Commonalize in shared/ |
| Tests are fragile | Internal changes cause test failures | Test only public API (index.ts) |
| Long build time | Takes more than 5 minutes | Introduce Turborepo, optimize monorepo |

**Gradual migration steps:**

```bash
# Step 1: Introduce path aliases (low impact)
# Add paths configuration to tsconfig.json
# Replace relative paths with @/features/xxx

# Step 2: Create shared/ directory (moderate impact)
# Move common components to shared/components/
# Move common hooks to shared/hooks/

# Step 3: Create features/ directory (high impact)
# Create directory per feature
# Move related files to feature directory
# Define public API in index.ts

# Step 4: Add ESLint rules (low impact)
# Enforce dependency rules with no-restricted-imports

# Step 5: Monorepo migration (highest impact)
# Introduce Turborepo, split packages
```

**Timing guidelines:**
- Project start to 3 months: Layer-based is OK
- 3 to 6 months (5+ features): Consider migrating to feature-based
- 6+ months (multiple apps): Consider monorepo migration

---

## Summary

| Concept | Key Points |
|---------|-----------|
| Feature-based | Split directories per feature for high cohesion and low coupling |
| Public API | Define external interface in index.ts, hide internal implementation |
| Dependency rules | No direct references between features. Auto-checked with ESLint |
| App Router | app/ for routing only, business logic in features/ |
| Monorepo | Manage multiple apps with Turborepo + pnpm workspace |
| Path aliases | Improve readability and migration ease with @features/, @shared/ |
| Test placement | Colocation recommended. E2E tests in top-level tests/ |
| Naming conventions | Components=PascalCase, hooks=camelCase, directories=kebab-case |
| Barrel Export | Convenient but be aware of tree-shaking impact. Use modularizeImports as mitigation |

---

## Next Guides to Read

---

## References
1. Bulletproof React. "Project Structure." github.com/alan2207/bulletproof-react, 2024.
2. Next.js. "Project Organization." nextjs.org/docs, 2024.
3. Turborepo. "Getting Started." turbo.build, 2024.
4. Nx. "Why Nx?" nx.dev, 2024.
5. Kent C. Dodds. "Colocation." kentcdodds.com, 2019.
6. Dan Abramov. "Presentational and Container Components." (Deprecated pattern, but historically important), 2015.
7. Feature-Sliced Design. "Architectural methodology for frontend projects." feature-sliced.design, 2024.
8. Mark Erikson. "Scaling React Applications." Redux documentation, 2024.
9. Vercel. "Monorepos with Turborepo." vercel.com/docs, 2024.
10. pnpm. "Workspace." pnpm.io/workspaces, 2024.
