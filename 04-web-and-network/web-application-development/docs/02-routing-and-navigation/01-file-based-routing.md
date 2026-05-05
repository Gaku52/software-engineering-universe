# File-Based Routing

> File-based routing is an intuitive approach where "file structure = URL structure." Master all patterns of file-based routing, including Next.js App Router, Remix routing conventions, layouts, loading states, and error handling.

## What You Will Learn

- [ ] Understand the concept and historical background of file-based routing
- [ ] Fully understand Next.js App Router file conventions
- [ ] Grasp design patterns for layouts, loading states, and errors
- [ ] Learn dynamic routes, route groups, and parallel routes
- [ ] Understand the comparison with Remix / React Router v7 file routing
- [ ] Compare with other frameworks such as Nuxt.js / SvelteKit
- [ ] Design directory structures for real-world projects
- [ ] Troubleshoot and avoid anti-patterns

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic concepts of client-side routing — [Client-Side Routing](./00-client-side-routing.md)
- Basic Next.js structure (differences between App Router and Pages Router, concepts of Server Components and Client Components)
- File system concepts (directory structure, relative/absolute paths, file naming conventions)

---

## 0. What Is File-Based Routing?

### 0.1 Overview and Historical Background

File-based routing is a routing mechanism where the directory structure on the file system directly maps to URL paths. In traditional React applications, routes had to be declared declaratively in code using `react-router`, but with file-based routing, routes are automatically generated simply by placing files in directories.

```
Traditional approach (code-based routing):
  // routes.tsx
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route path="/users" element={<Users />} />
    <Route path="/users/:id" element={<UserDetail />} />
    <Route path="/users/:id/edit" element={<UserEdit />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>

File-based routing:
  app/
  ├── page.tsx            → /
  ├── about/page.tsx      → /about
  ├── users/
  │   ├── page.tsx        → /users
  │   ├── [id]/
  │   │   ├── page.tsx    → /users/:id
  │   │   └── edit/
  │   │       └── page.tsx → /users/:id/edit
  └── settings/
      └── page.tsx        → /settings
```

This mechanism has existed since the PHP era, where placing an `index.php` file made that directory accessible via URL. Modern frameworks have evolved this intuitive approach to incorporate more advanced features as file conventions, such as layouts, error handling, and loading states.

### 0.2 Benefits of File-Based Routing

| Benefit | Details |
|---------|---------|
| Intuitive structure | URLs and file paths have a one-to-one correspondence, so you can instantly know where code lives |
| Zero configuration | No routing configuration files needed; routes work just by placing files |
| Colocation | Components, tests, and styles related to a page can be placed in the same directory |
| Automatic code splitting | Frameworks can automatically split code per page |
| Type safety | Frameworks can automatically generate types for route parameters |
| Team development efficiency | File structure acts as a list of routes, making onboarding of new members easier |

### 0.3 Drawbacks of File-Based Routing

| Drawback | Details |
|----------|---------|
| Framework dependency | You need to learn the specific conventions of each framework |
| Complex route expression | Conditional routes and advanced routing logic can become cumbersome |
| Increased file count | Large numbers of small files are created and directories tend to get deep |
| Difficulty refactoring | URL changes require file moves, and import paths change too |
| Test design | Routing logic unit tests are difficult due to constraints of file conventions |

### 0.4 File-Based Routing Comparison Across Major Frameworks

| Framework | Directory | Dynamic Routes | Catch-all | Layout | Route Groups |
|-----------|-----------|---------------|-----------|--------|-------------|
| Next.js App Router | `app/` | `[param]` | `[...slug]` | `layout.tsx` | `(group)` |
| Next.js Pages Router | `pages/` | `[param]` | `[...slug]` | `_app.tsx` | N/A |
| Remix v2 | `app/routes/` | `$param` → `[param]` | `$.tsx` | `_layout.tsx` | `_index` |
| Nuxt.js 3 | `pages/` | `[param]` | `[...slug]` | `layouts/` | N/A |
| SvelteKit | `src/routes/` | `[param]` | `[...rest]` | `+layout.svelte` | `(group)` |
| Astro | `src/pages/` | `[param]` | `[...slug]` | `layouts/` | N/A |

---

## 1. Next.js App Router File Conventions

### 1.1 Overall Directory Structure

The App Router introduced in Next.js 13 is a new routing system built on the premise of React Server Components. File placement inside the `app/` directory becomes the routing directly.

```
File conventions:
  app/
  ├── layout.tsx          ← Root layout (required)
  ├── page.tsx            ← Page for /
  ├── loading.tsx         ← Loading UI
  ├── error.tsx           ← Error UI
  ├── not-found.tsx       ← 404 UI
  ├── global-error.tsx    ← Global error UI (catches errors in layout.tsx)
  ├── template.tsx        ← Template (re-mounts on each transition)
  ├── default.tsx         ← Default display for parallel routes
  ├── favicon.ico         ← Favicon (auto-configured)
  ├── opengraph-image.png ← OGP image (auto-configured)
  ├── sitemap.ts          ← Sitemap generation
  ├── robots.ts           ← robots.txt generation
  ├── manifest.ts         ← Web App Manifest
  ├── users/
  │   ├── page.tsx        ← /users
  │   ├── loading.tsx     ← Loading for /users
  │   ├── error.tsx       ← Error for /users
  │   ├── [id]/
  │   │   ├── page.tsx    ← /users/:id
  │   │   ├── layout.tsx  ← Shared layout for /users/:id
  │   │   └── edit/
  │   │       └── page.tsx ← /users/:id/edit
  │   └── new/
  │       └── page.tsx    ← /users/new
  ├── blog/
  │   ├── page.tsx        ← /blog
  │   └── [...slug]/
  │       └── page.tsx    ← /blog/any/path/here
  └── api/
      └── webhooks/
          └── route.ts    ← API Route: POST /api/webhooks

Special file list:
  page.tsx       → The route's UI component (without this, the directory is not recognized as a route)
  layout.tsx     → Shared layout (not re-rendered, state is preserved)
  template.tsx   → Like layout but re-mounts on each transition (state is reset)
  loading.tsx    → Suspense fallback (automatically wrapped)
  error.tsx      → ErrorBoundary (automatically wrapped, 'use client' required)
  global-error.tsx → Catches errors in root layout ('use client' required)
  not-found.tsx  → UI when notFound() is called
  route.ts       → API Route (HTTP handler, cannot coexist with page.tsx)
  default.tsx    → Fallback when parallel route has no match
  middleware.ts  → Route-level middleware (placed in project root, not under app/)
```

### 1.2 Execution Order and Hierarchy of Special Files

Special files in the Next.js App Router are rendered as a component tree in the following hierarchy. Understanding this hierarchy is the key to correct error handling and loading design.

```
Component hierarchy (nested top to bottom):

  layout.tsx
  └── template.tsx
      └── error.tsx (ErrorBoundary)
          └── loading.tsx (Suspense)
              └── not-found.tsx
                  └── page.tsx

Actual React tree generated:

  <Layout>
    <Template>
      <ErrorBoundary fallback={<Error />}>
        <Suspense fallback={<Loading />}>
          <NotFoundBoundary fallback={<NotFound />}>
            <Page />
          </NotFoundBoundary>
        </Suspense>
      </ErrorBoundary>
    </Template>
  </Layout>
```

Important characteristics derived from this hierarchy:

1. **Errors in layout.tsx cannot be caught by error.tsx** — error.tsx is placed as a child of layout, so catching errors in layout itself requires the parent segment's error.tsx or global-error.tsx
2. **loading.tsx is inside error.tsx** — When an error occurs, the error display takes priority over the loading state
3. **template.tsx is a child of layout.tsx** — Even if template re-mounts, the state of layout is preserved

```typescript
// Experimental code to understand this hierarchy
// app/test/layout.tsx
export default function TestLayout({ children }: { children: React.ReactNode }) {
  console.log('Layout rendered');  // Not re-executed on page transitions
  return <div className="test-layout">{children}</div>;
}

// app/test/template.tsx
export default function TestTemplate({ children }: { children: React.ReactNode }) {
  console.log('Template rendered');  // Re-executed on each page transition
  return <div className="test-template">{children}</div>;
}

// app/test/error.tsx
'use client';
export default function TestError({ error, reset }: { error: Error; reset: () => void }) {
  console.log('Error boundary caught:', error.message);
  return <button onClick={reset}>Retry</button>;
}

// app/test/loading.tsx
export default function TestLoading() {
  console.log('Loading rendered');
  return <div>Loading...</div>;
}

// app/test/page.tsx
export default async function TestPage() {
  console.log('Page rendered');
  return <div>Test Page Content</div>;
}
```

### 1.3 Details of page.tsx

`page.tsx` is the most important file that makes a route renderable. Directories without `page.tsx` are not recognized as routes and accessing their URL results in a 404.

```typescript
// app/page.tsx — Top page (Server Component by default)
import { Suspense } from 'react';

// In Server Components, data fetching can be awaited directly
export default async function HomePage() {
  const featuredPosts = await getFeaturedPosts();
  const categories = await getCategories();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Welcome to Our Blog</h1>

      {/* Heavy data fetches are separated with Suspense */}
      <Suspense fallback={<FeaturedPostsSkeleton />}>
        <FeaturedPosts posts={featuredPosts} />
      </Suspense>

      <Suspense fallback={<CategoriesSkeleton />}>
        <Categories categories={categories} />
      </Suspense>
    </div>
  );
}

// Static metadata definition
export const metadata = {
  title: 'Home | My Blog',
  description: 'Welcome to our blog featuring the latest articles.',
  openGraph: {
    title: 'Home | My Blog',
    description: 'Welcome to our blog featuring the latest articles.',
    type: 'website',
  },
};
```

```typescript
// app/dashboard/page.tsx — When a Client Component is needed
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div>
      <h1>Dashboard</h1>
      <DashboardContent data={data} />
    </div>
  );
}

// Note: Adding 'use client' to page.tsx makes the entire page
// a Client Component, losing the benefits of Server Components
// (data fetching, bundle size reduction).
// Keep page.tsx as a Server Component as much as possible,
// and separate only interactive parts as Client Components.
```

### 1.4 Details of route.ts (API Route)

`route.ts` is a special file for defining RESTful API endpoints. `page.tsx` and `route.ts` cannot coexist in the same directory.

```typescript
// app/api/users/route.ts — RESTful API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// GET /api/users — Retrieve user list
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const search = searchParams.get('search') ?? '';

  try {
    const users = await db.user.findMany({
      where: search
        ? { name: { contains: search, mode: 'insensitive' } }
        : undefined,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await db.user.count({
      where: search
        ? { name: { contains: search, mode: 'insensitive' } }
        : undefined,
    });

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/users — Create a user
const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'editor']).default('user'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createUserSchema.parse(body);

    const existingUser = await db.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    const user = await db.user.create({ data: validated });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/users/[id]/route.ts — Individual resource operations
import { NextRequest, NextResponse } from 'next/server';

// GET /api/users/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(user);
}

// PUT /api/users/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  try {
    const user = await db.user.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }
}

// DELETE /api/users/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await db.user.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }
}

// PATCH /api/users/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  try {
    const user = await db.user.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }
}
```

```typescript
// app/api/webhooks/stripe/route.ts — Webhook endpoint example
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text(); // raw body required
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCancelled(subscription);
      break;
    }
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

// route segment config: Webhooks need to be dynamic
export const dynamic = 'force-dynamic';
```

### 1.5 Route Segment Config

Each route segment can export configuration values to control caching, revalidation, runtime, and other behaviors.

```typescript
// app/blog/page.tsx
// All options for Route Segment Config

// Dynamic rendering control
export const dynamic = 'auto';
// 'auto'          — Default, framework decides
// 'force-dynamic' — Always dynamic rendering (SSR)
// 'error'         — Force static rendering (build error if dynamic functions exist)
// 'force-static'  — Force static rendering by making dynamic function return values empty

// Dynamic parameter control
export const dynamicParams = true;
// true  — Parameters not in generateStaticParams are generated dynamically
// false — Parameters not in generateStaticParams return 404

// Revalidation interval (seconds)
export const revalidate = 3600; // Revalidate every hour
// false — No revalidation (indefinite cache)
// 0     — Always dynamic rendering

// Runtime selection
export const runtime = 'nodejs';
// 'nodejs'  — Node.js runtime (default)
// 'edge'    — Edge Runtime (lightweight, with limitations)

// Explicit declaration of Node.js APIs used
export const preferredRegion = 'auto';
// 'auto'    — Framework decides
// 'global'  — Global
// 'home'    — Home region
// ['iad1', 'sfo1'] — Specific regions

// Maximum execution time (seconds)
export const maxDuration = 30;

export default async function BlogPage() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }, // Revalidation can also be set at fetch level
  }).then(res => res.json());

  return <PostList posts={posts} />;
}
```

---

## 2. Layout Design

### 2.1 Root Layout

The root layout is a required file placed at `app/layout.tsx` and must include `<html>` and `<body>` tags. It is shared across all pages and does not re-render on page transitions.

```typescript
// app/layout.tsx — Root layout
import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
});

export const metadata: Metadata = {
  title: {
    template: '%s | My App',       // Child page title goes into %s
    default: 'My App',              // Used when no title is set
  },
  description: 'A modern web application built with Next.js',
  metadataBase: new URL('https://example.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://example.com',
    siteName: 'My App',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@example',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSansJP.variable}`}
      suppressHydrationWarning  // Required for dark mode support with next-themes etc.
    >
      <body className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
              <Toaster />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 2.2 Nested Layouts

Layouts can be nested per directory, with child layouts placed inside parent layouts. This allows different layouts to be applied to each section.

```typescript
// app/dashboard/layout.tsx — Dashboard layout
import { Sidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Since it's a Server Component, authentication check can be done directly
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar user={session.user} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={session.user} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
```

```typescript
// app/dashboard/settings/layout.tsx — Settings page sub-layout
import { SettingsNav } from '@/components/settings/nav';

const settingsNavItems = [
  { href: '/dashboard/settings', label: 'General', icon: 'settings' },
  { href: '/dashboard/settings/profile', label: 'Profile', icon: 'user' },
  { href: '/dashboard/settings/billing', label: 'Billing', icon: 'credit-card' },
  { href: '/dashboard/settings/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/dashboard/settings/security', label: 'Security', icon: 'shield' },
  { href: '/dashboard/settings/api-keys', label: 'API Keys', icon: 'key' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="flex gap-8">
        <aside className="w-64 shrink-0">
          <SettingsNav items={settingsNavItems} />
        </aside>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

// The following layout hierarchy is formed as a result:
// RootLayout → DashboardLayout → SettingsLayout → Page
//
// When accessing /dashboard/settings/profile:
//   <RootLayout>
//     <DashboardLayout>
//       <SettingsLayout>
//         <ProfilePage />
//       </SettingsLayout>
//     </DashboardLayout>
//   </RootLayout>
```

### 2.3 Route Groups

Route groups are a feature that logically groups files without affecting the URL structure by wrapping directory names in parentheses `(name)`.

```
Route group usage examples:

app/
├── (marketing)/              ← Not included in URL
│   ├── layout.tsx            ← Layout for marketing pages
│   ├── page.tsx              ← / (top page)
│   ├── about/
│   │   └── page.tsx          ← /about
│   ├── pricing/
│   │   └── page.tsx          ← /pricing
│   ├── blog/
│   │   ├── page.tsx          ← /blog
│   │   └── [slug]/
│   │       └── page.tsx      ← /blog/:slug
│   └── contact/
│       └── page.tsx          ← /contact
│
├── (app)/                    ← Not included in URL
│   ├── layout.tsx            ← Application layout (authentication required)
│   ├── dashboard/
│   │   └── page.tsx          ← /dashboard
│   ├── projects/
│   │   ├── page.tsx          ← /projects
│   │   └── [id]/
│   │       └── page.tsx      ← /projects/:id
│   └── settings/
│       └── page.tsx          ← /settings
│
├── (auth)/                   ← Not included in URL
│   ├── layout.tsx            ← Auth page layout (centering, etc.)
│   ├── login/
│   │   └── page.tsx          ← /login
│   ├── register/
│   │   └── page.tsx          ← /register
│   └── forgot-password/
│       └── page.tsx          ← /forgot-password
│
└── layout.tsx                ← Root layout (common to all groups)
```

```typescript
// app/(marketing)/layout.tsx — Marketing layout
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-7xl mx-auto">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}

// app/(app)/layout.tsx — App layout (with authentication)
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1">
        <AppHeader user={session.user} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

// app/(auth)/layout.tsx — Auth page layout
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If already logged in, redirect to dashboard
  const session = await getSession();
  if (session) redirect('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <Logo className="mx-auto mb-8" />
        {children}
      </div>
    </div>
  );
}
```

### 2.4 Differences Between layout.tsx and template.tsx

`layout.tsx` and `template.tsx` have similar roles but with an important difference.

```typescript
// Characteristics of layout.tsx:
// - Not re-rendered on page transitions (state is preserved)
// - useEffect is not re-executed
// - DOM is reused

// Characteristics of template.tsx:
// - A new instance is created on each page transition
// - useEffect is executed every time
// - DOM is recreated

// Situations where template.tsx is appropriate:
// 1. Page transition animations
// 2. Page view logging
// 3. Per-page feedback forms

// app/dashboard/template.tsx — Page transition logging example
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analytics } from '@/lib/analytics';

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Since it's template.tsx, this executes on every transition
    analytics.pageView(pathname);
  }, [pathname]);

  return (
    <div className="animate-fadeIn">
      {children}
    </div>
  );
}

// If the same code was written in layout.tsx,
// useEffect would only execute on the first render,
// and logs would not be recorded for transitions between child pages.
```

| Characteristic | layout.tsx | template.tsx |
|----------------|------------|--------------|
| Re-mount | Does not re-mount | Re-mounts on each page transition |
| State preservation | Preserved | Reset |
| useEffect | First render only | Executes on each transition |
| Performance | High (reuse) | Low (recreation) |
| Use case | Navigation, sidebar | Animations, logging |

---

## 3. Dynamic Routes and Catch-All

### 3.1 Basics of Dynamic Routes

Dynamic routes are routing patterns that accept part of the URL as a parameter. They are defined by wrapping directory names in square brackets.

```
Types of dynamic routes:

  [id]           → Single dynamic segment
                   /users/123        → params.id = "123"
                   /users/abc        → params.id = "abc"

  [slug]         → Naming is free (conventionally slug, id, name, etc. are used)
                   /posts/hello-world → params.slug = "hello-world"

  [...slug]      → Catch-all (one or more segments)
                   /docs/a           → params.slug = ["a"]
                   /docs/a/b         → params.slug = ["a", "b"]
                   /docs/a/b/c       → params.slug = ["a", "b", "c"]
                   /docs             → 404 (no match)

  [[...slug]]    → Optional catch-all
                   /docs             → params.slug = undefined
                   /docs/a           → params.slug = ["a"]
                   /docs/a/b         → params.slug = ["a", "b"]
```

### 3.2 Dynamic Route Implementation Examples

```typescript
// app/users/[id]/page.tsx — Basic dynamic route
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { UserProfile } from '@/components/user/profile';
import { UserPosts } from '@/components/user/posts';
import { UserPostsSkeleton } from '@/components/user/posts-skeleton';

interface UserPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;

  // Parameter validation
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    notFound();
  }

  const user = await getUser(id);
  if (!user) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* User basic info (displayed immediately) */}
      <UserProfile user={user} />

      {/* User post list (lazy loaded) */}
      <section className="mt-8">
        <h2 className="text-xl font-bold mb-4">Posts</h2>
        <Suspense fallback={<UserPostsSkeleton />}>
          <UserPosts userId={user.id} />
        </Suspense>
      </section>
    </div>
  );
}

// Static parameter generation (specify pages to generate at build time)
export async function generateStaticParams() {
  const users = await db.user.findMany({
    select: { id: true },
    take: 100, // Pre-generate only major user pages
  });

  return users.map((user) => ({
    id: user.id,
  }));
}

// Dynamic metadata generation
export async function generateMetadata({ params }: UserPageProps) {
  const { id } = await params;
  const user = await getUser(id);

  if (!user) {
    return {
      title: 'User Not Found',
    };
  }

  return {
    title: user.name,
    description: user.bio ?? `${user.name}'s profile`,
    openGraph: {
      title: user.name,
      description: user.bio ?? `${user.name}'s profile`,
      images: user.avatar ? [{ url: user.avatar }] : [],
    },
  };
}
```

### 3.3 Multiple Dynamic Segments

```typescript
// app/[locale]/blog/[category]/[slug]/page.tsx
// URL: /en/blog/tech/nextjs-routing
interface BlogPostPageProps {
  params: Promise<{
    locale: string;
    category: string;
    slug: string;
  }>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale, category, slug } = await params;

  // Locale validation
  const supportedLocales = ['en', 'ja', 'zh', 'ko'];
  if (!supportedLocales.includes(locale)) {
    notFound();
  }

  const post = await getPost({ locale, category, slug });
  if (!post) {
    notFound();
  }

  return (
    <article className="prose prose-lg mx-auto">
      <header>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{category}</span>
          <span>/</span>
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString(locale)}
          </time>
        </div>
        <h1>{post.title}</h1>
      </header>
      <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
    </article>
  );
}

export async function generateStaticParams() {
  const posts = await getAllPosts();

  return posts.flatMap((post) =>
    post.locales.map((locale) => ({
      locale,
      category: post.category,
      slug: post.slug,
    }))
  );
}
```

### 3.4 Practical Catch-All Route Examples

```typescript
import { notFound } from 'next/navigation';
import { getDocBySlug, getAllDocs } from '@/lib/docs';
import { TableOfContents } from '@/components/docs/toc';
import { DocBreadcrumb } from '@/components/docs/breadcrumb';
import { DocPagination } from '@/components/docs/pagination';

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params;

  // When accessing /docs, show introduction
  const docPath = slug?.join('/') ?? 'introduction';
  const doc = await getDocBySlug(docPath);

  if (!doc) {
    notFound();
  }

  return (
    <div className="flex gap-8">
      {/* Main content */}
      <article className="flex-1 min-w-0 prose prose-lg dark:prose-invert">
        <DocBreadcrumb segments={slug ?? []} />
        <h1>{doc.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: doc.contentHtml }} />
        <DocPagination current={docPath} />
      </article>

      {/* Table of contents sidebar */}
      <aside className="hidden xl:block w-64 shrink-0">
        <TableOfContents headings={doc.headings} />
      </aside>
    </div>
  );
}

export async function generateStaticParams() {
  const docs = await getAllDocs();

  return [
    { slug: undefined },  // /docs (introduction)
    ...docs.map((doc) => ({
      slug: doc.path.split('/'),
    })),
  ];
}

export async function generateMetadata({ params }: DocsPageProps) {
  const { slug } = await params;
  const docPath = slug?.join('/') ?? 'introduction';
  const doc = await getDocBySlug(docPath);

  return {
    title: doc?.title ?? 'Documentation',
    description: doc?.description ?? 'Project documentation',
  };
}
```

### 3.5 Priority of Dynamic Routes

In Next.js App Router, static routes take priority over dynamic routes. Understanding this priority is important to prevent unexpected behavior.

```
Route priority (highest first):

  1. Static route          /users/new        → app/users/new/page.tsx
  2. Dynamic route         /users/123        → app/users/[id]/page.tsx
  3. Catch-all             /users/123/posts  → app/users/[...slug]/page.tsx

Example: When accessing /users/new with the following file structure
  app/users/
  ├── [id]/page.tsx        ← /users/new does not match here
  ├── new/page.tsx         ← This takes priority ✓
  └── [...slug]/page.tsx   ← No match

Notes:
  - /users/new is a static route so it takes priority over [id]
  - Without explicitly creating new/page.tsx, it would match [id]
  - The same priority applies to API Routes
```

### 3.6 Using searchParams

In addition to dynamic route parameters, query parameters (searchParams) can be accessed directly in Server Components.

```typescript
// app/products/page.tsx — Filtering, sorting, pagination
interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    page?: string;
    q?: string;
  }>;
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const {
    category,
    sort = 'createdAt',
    order = 'desc',
    page = '1',
    q,
  } = await searchParams;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const limit = 20;

  const { products, total } = await getProducts({
    category,
    sort,
    order,
    page: currentPage,
    limit,
    search: q,
  });

  return (
    <div>
      <h1>Products</h1>

      {/* Filter bar */}
      <ProductFilters
        currentCategory={category}
        currentSort={sort}
        currentOrder={order}
        searchQuery={q}
      />

      {/* Product grid */}
      <ProductGrid products={products} />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(total / limit)}
        baseUrl="/products"
        searchParams={{ category, sort, order, q }}
      />
    </div>
  );
}

// searchParams can also be used in metadata
export async function generateMetadata({
  searchParams,
}: ProductsPageProps) {
  const { category, q } = await searchParams;

  let title = 'Products';
  if (category) title = `${category} Products`;
  if (q) title = `Search: ${q}`;

  return { title };
}
```

---

## 4. Loading and Error Handling

### 4.1 Detailed Design of loading.tsx

`loading.tsx` is the file convention expression of React's `<Suspense>`. It automatically provides a loading UI for all page components below the directory where it is placed.

```typescript
// app/users/loading.tsx — Skeleton UI implementation
export default function UsersLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />

      {/* Table header */}
      <div className="h-12 w-full bg-gray-100 animate-pulse rounded-t" />

      {/* Table row skeletons */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b"
        >
          {/* Avatar */}
          <div className="h-10 w-10 bg-gray-200 animate-pulse rounded-full" />
          {/* Name */}
          <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
          {/* Email */}
          <div className="h-4 w-48 bg-gray-200 animate-pulse rounded" />
          {/* Role */}
          <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
          {/* Date */}
          <div className="h-4 w-24 bg-gray-200 animate-pulse rounded ml-auto" />
        </div>
      ))}

      {/* Pagination skeleton */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-8 bg-gray-200 animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}
```

```typescript
// Reusable skeleton component
// components/ui/skeleton.tsx
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-gray-200 dark:bg-gray-700',
        animation === 'pulse' && 'animate-pulse',
        animation === 'wave' && 'animate-shimmer',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded',
        variant === 'text' && 'rounded h-4',
        className
      )}
      style={{ width, height }}
    />
  );
}

// app/dashboard/loading.tsx — Example using Skeleton component
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-6 border rounded-lg">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32 mt-2" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 border rounded-lg">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton variant="rectangular" className="h-64 w-full" />
        </div>
        <div className="p-6 border rounded-lg">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton variant="rectangular" className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
```

### 4.2 Combining with Suspense

`loading.tsx` provides a loading UI for an entire route segment, but for finer-grained control, use `<Suspense>` directly.

```typescript
// app/dashboard/page.tsx — Partial streaming with Suspense
import { Suspense } from 'react';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { RecentOrders } from '@/components/dashboard/recent-orders';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { TopProducts } from '@/components/dashboard/top-products';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* KPIs are displayed with highest priority */}
      <Suspense fallback={<KPICardsSkeleton />}>
        <KPICards />
      </Suspense>

      <div className="grid grid-cols-2 gap-6">
        {/* Chart loads independently */}
        <Suspense fallback={<ChartSkeleton />}>
          <SalesChart />
        </Suspense>

        {/* Top products also loads independently */}
        <Suspense fallback={<ListSkeleton />}>
          <TopProducts />
        </Suspense>
      </div>

      {/* Recent orders can wait */}
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}

// Each section independently fetches → renders,
// so they appear in order of completion (streaming)
```

### 4.3 Detailed Design of error.tsx

`error.tsx` is the file convention expression of React's `ErrorBoundary`. The `'use client'` directive is required and it operates as a Client Component.

```typescript
// app/dashboard/error.tsx — Detailed error handling
'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send error to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Sentry, Datadog, etc.
      reportError(error);
    }
    console.error('Dashboard error:', error);
  }, [error]);

  // Display branching based on error type
  const isNetworkError = error.message.includes('fetch') ||
    error.message.includes('network');
  const isAuthError = error.message.includes('unauthorized') ||
    error.message.includes('401');

  if (isAuthError) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Session expired</h2>
        <p className="text-gray-500 mb-6">Please log in again.</p>
        <Link href="/login">
          <Button>Go to Login Page</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-16">
      <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">
        {isNetworkError
          ? 'A network error occurred'
          : 'An unexpected error occurred'}
      </h2>
      <p className="text-gray-500 mb-2">
        {isNetworkError
          ? 'Please check your internet connection.'
          : 'Please wait a moment and try again.'}
      </p>

      {/* Show error details in development environment */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 p-4 bg-red-50 border border-red-200 rounded max-w-lg w-full">
          <summary className="cursor-pointer text-red-700 font-mono text-sm flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Error Details
          </summary>
          <pre className="mt-2 text-xs text-red-600 overflow-x-auto whitespace-pre-wrap">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}

      {/* Error Digest (for error tracking in production) */}
      {error.digest && (
        <p className="text-xs text-gray-400 mt-2">
          Error ID: {error.digest}
        </p>
      )}

      <div className="flex gap-4 mt-6">
        <Button onClick={reset} variant="default">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
        <Link href="/">
          <Button variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

### 4.4 global-error.tsx

`global-error.tsx` is a special file for catching errors in the root layout (`app/layout.tsx`). Regular `error.tsx` is placed as a child of the layout, so it cannot catch errors in the layout itself.

```typescript
// app/global-error.tsx
'use client';

// global-error.tsx must include its own <html> and <body>
// (because RootLayout may be broken)
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-4xl font-bold text-red-600 mb-4">
            A critical error occurred
          </h1>
          <p className="text-gray-600 mb-6">
            An error occurred while starting the application.
          </p>
          {error.digest && (
            <p className="text-sm text-gray-400 mb-4">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Restart Application
          </button>
        </div>
      </body>
    </html>
  );
}
```

### 4.5 Design Patterns for not-found.tsx

`not-found.tsx` is the UI displayed when the `notFound()` function is called or when accessing an unmatched URL.

```typescript
// app/not-found.tsx — Global 404 page
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <h1 className="text-8xl font-bold text-gray-200 dark:text-gray-800">
        404
      </h1>
      <h2 className="text-2xl font-bold mt-4 mb-2">
        Page not found
      </h2>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        The page you are looking for may have been moved or deleted.
        Please check that the URL is correct.
      </p>

      {/* Search box */}
      <div className="relative w-full max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search the site..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-4">
        <Link
          href="/"
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          Return to Home
        </Link>
        <Link
          href="/contact"
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}

// app/users/[id]/not-found.tsx — Route segment specific 404
export default function UserNotFound() {
  return (
    <div className="text-center p-16">
      <h2 className="text-2xl font-bold mb-4">User not found</h2>
      <p className="text-gray-500 mb-6">
        The specified user does not exist or may have been deleted.
      </p>
      <Link
        href="/users"
        className="text-blue-500 hover:underline"
      >
        Back to User List
      </Link>
    </div>
  );
}
```

---

## 5. Parallel Routes and Intercepting Routes

### 5.1 Overview of Parallel Routes

Parallel routes are a feature that renders multiple pages in parallel within the same layout. They use the `@slot` directory naming convention and receive slots as props of the layout component.

```
Parallel routes directory structure:

  app/dashboard/
  ├── layout.tsx             ← Receives children + analytics + activity
  ├── page.tsx               ← children slot (default)
  ├── @analytics/
  │   ├── page.tsx           ← analytics slot
  │   ├── loading.tsx        ← Loading for analytics
  │   └── error.tsx          ← Error for analytics
  ├── @activity/
  │   ├── page.tsx           ← activity slot
  │   └── loading.tsx        ← Loading for activity
  └── @notifications/
      ├── page.tsx           ← notifications slot
      └── default.tsx        ← Default display during sub-navigation
```

```typescript
// app/dashboard/layout.tsx — Parallel routes layout
export default function DashboardLayout({
  children,
  analytics,
  activity,
  notifications,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  activity: React.ReactNode;
  notifications: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main content (8 columns) */}
      <div className="col-span-8 space-y-6">
        {children}

        {/* Analytics chart (independent loading) */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Analytics</h2>
          {analytics}
        </section>
      </div>

      {/* Sidebar (4 columns) */}
      <div className="col-span-4 space-y-6">
        {/* Notification panel */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Notifications</h2>
          {notifications}
        </section>

        {/* Activity feed */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
          {activity}
        </section>
      </div>
    </div>
  );
}
```

### 5.2 Benefits of Parallel Routes

Parallel routes have the following benefits.

```
1. Independent loading/error states
   → Each slot can have its own loading.tsx and error.tsx
   → An error in one section does not affect other sections

2. Independent data fetching
   → Each slot independently fetches and displays data
   → Streaming displays sections in order of completion

3. Conditional rendering
   → Different slots can be displayed based on user permissions

4. URL-driven display control
   → The content of each slot can be switched based on the URL path
```

```typescript
// app/dashboard/@analytics/page.tsx — Independent data fetching
export default async function AnalyticsSlot() {
  // This data fetch runs independently from other slots
  const analyticsData = await getAnalytics();

  return (
    <div>
      <BarChart data={analyticsData.dailyVisits} />
      <div className="grid grid-cols-3 gap-4 mt-4">
        <StatCard label="Page Views" value={analyticsData.pageViews} />
        <StatCard label="Unique Visitors" value={analyticsData.uniqueVisitors} />
        <StatCard label="Bounce Rate" value={`${analyticsData.bounceRate}%`} />
      </div>
    </div>
  );
}

// app/dashboard/@analytics/loading.tsx — Slot-specific loading
export default function AnalyticsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-48 bg-gray-100 animate-pulse rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}

// app/dashboard/@analytics/error.tsx — Slot-specific error
'use client';
export default function AnalyticsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="text-center p-4 bg-red-50 rounded">
      <p className="text-red-600 mb-2">Failed to load analytics data</p>
      <button onClick={reset} className="text-blue-500 underline">
        Retry
      </button>
    </div>
  );
}
```

### 5.3 Role of default.tsx

When a slot's URL does not match during sub-navigation in parallel routes, `default.tsx` is displayed as a fallback. If `default.tsx` is not present, a 404 is returned.

```typescript
// Problematic case:
// app/dashboard/@notifications/page.tsx is displayed at /dashboard
// But when navigating to /dashboard/settings,
// there is no settings/page.tsx for the @notifications slot
// → Without default.tsx, this returns 404

// app/dashboard/@notifications/default.tsx
export default function NotificationsDefault() {
  // Return same content as page.tsx or a simplified version
  return <NotificationsList />;
}

// Soft navigation vs hard navigation:
// - Soft navigation (Link click): previous state is preserved
// - Hard navigation (page reload, direct URL entry): default.tsx is used
```

### 5.4 Overview of Intercepting Routes

Intercepting routes are a feature that displays the content of another route as a modal or overlay while maintaining the current layout. This enables UX similar to Instagram's image display on the feed.

```
Intercepting route notation:

  (.)   → Intercept a route at the same level
  (..)  → Intercept a route one level up
  (..)(..) → Two levels up
  (...) → Intercept a route from the root (app/)
```

```
Practical example: Photo gallery + modal

  app/
  ├── layout.tsx
  ├── feed/
  │   ├── page.tsx                     ← Photo feed list
  │   └── @modal/
  │       ├── default.tsx              ← No modal (empty)
  │       └── (.)photo/[id]/
  │           └── page.tsx             ← Display photo in modal
  └── photo/
      └── [id]/
          └── page.tsx                 ← Full-screen photo display (for direct access)

Behavior:
  1. Access /feed → feed displayed, no modal
  2. Click a photo in the feed → URL changes to /photo/123 but
     actually (.)photo/[id]/page.tsx intercepts it,
     displaying the photo in a modal while keeping the feed in the background
  3. Direct access to /photo/123 → photo/[id]/page.tsx full-screen display
  4. Reload while modal is displayed → switches to full-screen display
```

```typescript
// app/feed/page.tsx — Photo feed
import Link from 'next/link';
import Image from 'next/image';

export default async function FeedPage() {
  const photos = await getPhotos();

  return (
    <div className="grid grid-cols-3 gap-1">
      {photos.map((photo) => (
        <Link key={photo.id} href={`/photo/${photo.id}`}>
          <Image
            src={photo.thumbnailUrl}
            alt={photo.title}
            width={300}
            height={300}
            className="w-full aspect-square object-cover hover:opacity-80 transition"
          />
        </Link>
      ))}
    </div>
  );
}

// app/feed/layout.tsx — Layout with modal slot
export default function FeedLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}

// app/feed/@modal/default.tsx — No modal
export default function Default() {
  return null;
}

// app/feed/@modal/(.)photo/[id]/page.tsx — Modal display
import { Modal } from '@/components/modal';

export default async function PhotoModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const photo = await getPhoto(id);

  return (
    <Modal>
      <Image
        src={photo.url}
        alt={photo.title}
        width={800}
        height={600}
        className="w-full"
      />
      <div className="p-4">
        <h2 className="text-xl font-bold">{photo.title}</h2>
        <p className="text-gray-500">{photo.description}</p>
      </div>
    </Modal>
  );
}

// app/photo/[id]/page.tsx — Full-screen display (direct access)
export default async function PhotoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const photo = await getPhoto(id);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Image
        src={photo.url}
        alt={photo.title}
        width={1200}
        height={800}
        className="w-full rounded-lg"
      />
      <h1 className="text-3xl font-bold mt-4">{photo.title}</h1>
      <p className="text-gray-500 mt-2">{photo.description}</p>
      <PhotoComments photoId={photo.id} />
    </div>
  );
}
```

```typescript
// components/modal.tsx — General-purpose modal component
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  const onDismiss = useCallback(() => {
    router.back();
  }, [router]);

  // Close modal with ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onDismiss]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onDismiss();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition z-10"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
```

---

## 6. Middleware and Routing Control

### 6.1 Middleware Basics

Next.js Middleware is a mechanism that allows code to run before a request completes. `middleware.ts` is placed in the project root (same level as `app/`).

```typescript
// middleware.ts (placed in project root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Authentication check
  const token = request.cookies.get('session-token')?.value;
  const protectedPaths = ['/dashboard', '/settings', '/admin'];

  if (protectedPaths.some(path => pathname.startsWith(path))) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Internationalization (i18n) redirect
  const locale = request.headers.get('accept-language')?.split(',')[0]?.split('-')[0] ?? 'en';
  const supportedLocales = ['en', 'ja'];
  const defaultLocale = 'en';

  if (!pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
    const pathnameLocale = supportedLocales.find(
      loc => pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`
    );

    if (!pathnameLocale) {
      const detectedLocale = supportedLocales.includes(locale) ? locale : defaultLocale;
      return NextResponse.redirect(
        new URL(`/${detectedLocale}${pathname}`, request.url)
      );
    }
  }

  // 3. Adding response headers
  const response = NextResponse.next();
  response.headers.set('x-request-id', crypto.randomUUID());
  response.headers.set('x-pathname', pathname);

  return response;
}

// Configuration of paths to apply Middleware to
export const config = {
  matcher: [
    // Exclude static files and internal paths
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 6.2 Practical Middleware Patterns

```typescript
// middleware.ts — Advanced Middleware patterns

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Rate Limiting (simplified)
const rateLimit = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimit.get(ip);

  if (!record || now > record.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---- API Rate Limiting ----
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const isAllowed = checkRateLimit(ip, 100, 60 * 1000); // 100 req/min

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  // ---- JWT Authentication ----
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/protected')) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const { payload } = await jwtVerify(token, secret);

      // ---- RBAC (Role-Based Access Control) ----
      if (pathname.startsWith('/admin') && payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // Add user information to request headers
      const response = NextResponse.next();
      response.headers.set('x-user-id', payload.sub as string);
      response.headers.set('x-user-role', payload.role as string);
      return response;
    } catch (error) {
      // Invalid token → redirect to login page
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('auth-token');
      return response;
    }
  }

  // ---- A/B Testing ----
  if (pathname === '/pricing') {
    const bucket = request.cookies.get('ab-test-pricing')?.value;
    if (!bucket) {
      const newBucket = Math.random() > 0.5 ? 'A' : 'B';
      const response = NextResponse.rewrite(
        new URL(`/pricing/${newBucket.toLowerCase()}`, request.url)
      );
      response.cookies.set('ab-test-pricing', newBucket, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      return response;
    }
    return NextResponse.rewrite(
      new URL(`/pricing/${bucket.toLowerCase()}`, request.url)
    );
  }

  // ---- Redirects (legacy URL support) ----
  const redirects: Record<string, string> = {
    '/blog': '/articles',
    '/docs/getting-started': '/docs/introduction',
    '/help': '/support',
  };

  if (redirects[pathname]) {
    return NextResponse.redirect(
      new URL(redirects[pathname], request.url),
      { status: 301 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## 7. Remix / React Router v7 File-Based Routing

### 7.1 Remix v2 Routing Conventions

Remix adopts different file conventions from Next.js. It is based on a flat file structure (flat routes) where nesting is expressed with dot (`.`) separators.

```
Remix v2 file structure:

  app/routes/
  ├── _index.tsx                    → /
  ├── about.tsx                     → /about
  ├── blog._index.tsx               → /blog
  ├── blog.$slug.tsx                → /blog/:slug
  ├── users._index.tsx              → /users
  ├── users.$id.tsx                 → /users/:id
  ├── users.$id_.edit.tsx           → /users/:id/edit
  ├── dashboard.tsx                 → /dashboard layout
  ├── dashboard._index.tsx          → /dashboard
  ├── dashboard.settings.tsx        → /dashboard/settings
  ├── dashboard.analytics.tsx       → /dashboard/analytics
  ├── $.tsx                         → catch-all (404)
  ├── _auth.tsx                     → auth layout (not included in URL)
  ├── _auth.login.tsx               → /login
  ├── _auth.register.tsx            → /register
  └── files.$.tsx                   → /files/* (catch-all)

Naming conventions:
  .        → Nesting separator (corresponds to / in URL)
  $param   → Dynamic segment
  _index   → Index route
  _prefix  → Pathless layout (not included in URL)
  $        → Catch-all
  name_    → Trailing underscore (escape from layout nesting)
```

### 7.2 Remix Route Components

In Remix, each route file contains `loader` (data fetching), `action` (data mutation), and `default export` (UI) in a single file.

```typescript
// app/routes/users.$id.tsx — Remix route module
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useLoaderData, useActionData, Form } from '@remix-run/react';
import { getUser, updateUser } from '~/models/user.server';

// ---- loader: Server-side data fetching ----
export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(params.id!);
  if (!user) {
    throw new Response('Not Found', { status: 404 });
  }
  return json({ user });
}

// ---- action: Form submission handling ----
export async function action({ params, request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'update') {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;

    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Name is required';
    if (!email) errors.email = 'Email is required';

    if (Object.keys(errors).length > 0) {
      return json({ errors }, { status: 400 });
    }

    await updateUser(params.id!, { name, email });
    return redirect(`/users/${params.id}`);
  }

  if (intent === 'delete') {
    await deleteUser(params.id!);
    return redirect('/users');
  }

  return json({ errors: { form: 'Unknown action' } }, { status: 400 });
}

// ---- meta: Metadata definition ----
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: data?.user.name ?? 'User Not Found' },
    { name: 'description', content: `${data?.user.name}'s profile` },
  ];
};

// ---- ErrorBoundary ----
export function ErrorBoundary() {
  return (
    <div className="text-center p-8">
      <h2 className="text-xl font-bold text-red-600">An error occurred</h2>
    </div>
  );
}

// ---- UI Component ----
export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{user.name}</h1>

      <Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="update" />

        <div>
          <label htmlFor="name" className="block text-sm font-medium">Name</label>
          <input
            id="name"
            name="name"
            defaultValue={user.name}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
          {actionData?.errors?.name && (
            <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={user.email}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
          {actionData?.errors?.email && (
            <p className="text-red-500 text-sm mt-1">{actionData.errors.email}</p>
          )}
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Update
        </button>
      </Form>
    </div>
  );
}
```

### 7.3 Comparison Between Next.js App Router and Remix

| Feature | Next.js App Router | Remix v2 |
|---------|-------------------|----------|
| Routing method | Nested directories | Flat files (dot separator) |
| Data fetching | async/await in Server Components | loader function |
| Data mutation | Server Actions | action function + Form |
| Layout | layout.tsx (directory) | Parent route's default export + Outlet |
| Loading | loading.tsx (auto Suspense) | useNavigation().state |
| Error handling | error.tsx (auto ErrorBoundary) | ErrorBoundary export |
| Metadata | generateMetadata / metadata | meta function |
| Streaming | React Suspense + Server Components | defer + Await |
| Rendering | SSR / SSG / ISR | SSR (+ client cache) |
| File placement | Colocation (non-page.tsx files ignored) | Only within routes/ |

---

## 8. File-Based Routing in Other Frameworks

### 8.1 SvelteKit

SvelteKit has conventions similar to Next.js App Router, but uses `+` as a prefix in file names.

```
SvelteKit directory structure:

  src/routes/
  ├── +page.svelte              → Page for /
  ├── +layout.svelte            → Root layout
  ├── +error.svelte             → Error UI
  ├── +page.server.ts           → Server-side load function
  ├── +layout.server.ts         → Server-side load for layout
  ├── about/
  │   └── +page.svelte          → /about
  ├── blog/
  │   ├── +page.svelte          → /blog
  │   ├── +page.server.ts       → Data fetching for /blog
  │   └── [slug]/
  │       ├── +page.svelte      → /blog/:slug
  │       └── +page.server.ts   → Data fetching for /blog/:slug
  ├── (auth)/                   → Route group (not included in URL)
  │   ├── +layout.svelte        → Common layout for auth pages
  │   ├── login/
  │   │   └── +page.svelte      → /login
  │   └── register/
  │       └── +page.svelte      → /register
  └── api/
      └── users/
          └── +server.ts        → API endpoint
```

```svelte
<!-- src/routes/blog/[slug]/+page.svelte -->
<script>
  export let data;  // From load in +page.server.ts
</script>

<article>
  <h1>{data.post.title}</h1>
  <div>{@html data.post.contentHtml}</div>
</article>
```

```typescript
// src/routes/blog/[slug]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = await getPost(params.slug);

  if (!post) {
    throw error(404, 'Post not found');
  }

  return { post };
};
```

### 8.2 Nuxt.js 3

Nuxt.js 3 is a Vue.js-based framework where files are placed in the `pages/` directory.

```
Nuxt.js 3 directory structure:

  pages/
  ├── index.vue                 → /
  ├── about.vue                 → /about
  ├── users/
  │   ├── index.vue             → /users
  │   └── [id].vue              → /users/:id
  ├── blog/
  │   ├── index.vue             → /blog
  │   └── [...slug].vue         → /blog/* (catch-all)

  layouts/
  ├── default.vue               → Default layout
  ├── auth.vue                  → Layout for auth pages
  └── admin.vue                 → Layout for admin panel
```

```vue
<!-- pages/users/[id].vue -->
<script setup lang="ts">
const route = useRoute();
const { data: user } = await useFetch(`/api/users/${route.params.id}`);

if (!user.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'User Not Found',
  });
}

useHead({
  title: user.value.name,
});
</script>

<template>
  <div class="max-w-4xl mx-auto py-8">
    <h1 class="text-2xl font-bold">{{ user.name }}</h1>
    <p class="text-gray-500">{{ user.email }}</p>
  </div>
</template>
```

### 8.3 Astro

Astro is a content-focused static site generator where files are placed in the `src/pages/` directory.

```
Astro directory structure:

  src/pages/
  ├── index.astro               → /
  ├── about.astro               → /about
  ├── blog/
  │   ├── index.astro           → /blog
  │   └── [slug].astro          → /blog/:slug
  ├── [...slug].astro           → catch-all
  └── api/
      └── users.ts              → API endpoint (in SSR mode)
```

```astro
---
// src/pages/blog/[slug].astro
import Layout from '../../layouts/Layout.astro';
import { getEntry } from 'astro:content';

const { slug } = Astro.params;
const post = await getEntry('blog', slug);

if (!post) {
  return Astro.redirect('/404');
}

const { Content } = await post.render();
---

<Layout title={post.data.title}>
  <article class="prose">
    <h1>{post.data.title}</h1>
    <Content />
  </article>
</Layout>
```

### 8.4 Special File Comparison Across Frameworks

| Feature | Next.js App Router | SvelteKit | Nuxt.js 3 | Remix v2 |
|---------|-------------------|-----------|-----------|----------|
| Page | `page.tsx` | `+page.svelte` | `index.vue` / `name.vue` | `route.tsx` |
| Layout | `layout.tsx` | `+layout.svelte` | `layouts/name.vue` | Parent route + `<Outlet />` |
| Error | `error.tsx` | `+error.svelte` | `error.vue` | `ErrorBoundary` export |
| Loading | `loading.tsx` | N/A (manual Suspense) | N/A (`<NuxtLoadingIndicator>`) | `useNavigation()` |
| Server data | Server Component | `+page.server.ts` | `useFetch()` | `loader` |
| Form handling | Server Actions | `+page.server.ts` (actions) | `useFetch()` + API | `action` + `<Form>` |
| 404 | `not-found.tsx` | `+error.svelte` (404) | `error.vue` (404) | `throw Response(404)` |
| API Route | `route.ts` | `+server.ts` | `server/api/` | `resource route` |
| Middleware | `middleware.ts` | `hooks.server.ts` | `server/middleware/` | N/A |

---

## 9. Practical Project Directory Design

### 9.1 SaaS Application Design Example

A complete directory design example for an actual SaaS application.

```
app/
├── layout.tsx                           ← Root layout
├── page.tsx                             ← Landing page (/)
├── globals.css
├── favicon.ico
├── opengraph-image.png
├── sitemap.ts
├── robots.ts
│
├── (marketing)/                         ← Marketing site
│   ├── layout.tsx                       ← Header + footer
│   ├── about/page.tsx                   ← /about
│   ├── pricing/page.tsx                 ← /pricing
│   ├── blog/
│   │   ├── page.tsx                     ← /blog (article list)
│   │   └── [slug]/page.tsx              ← /blog/:slug
│   ├── changelog/page.tsx               ← /changelog
│   ├── contact/page.tsx                 ← /contact
│   ├── legal/
│   │   ├── privacy/page.tsx             ← /legal/privacy
│   │   └── terms/page.tsx               ← /legal/terms
│   └── docs/
│       ├── layout.tsx                   ← Documentation sidebar
│
├── (auth)/                              ← Authentication flow
│   ├── layout.tsx                       ← Centering layout
│   ├── login/page.tsx                   ← /login
│   ├── register/page.tsx                ← /register
│   ├── forgot-password/page.tsx         ← /forgot-password
│   ├── reset-password/page.tsx          ← /reset-password
│   ├── verify-email/page.tsx            ← /verify-email
│   └── sso/
│       └── [provider]/page.tsx          ← /sso/:provider (google, github, etc.)
│
├── (app)/                               ← Application core
│   ├── layout.tsx                       ← Auth check + sidebar + header
│   ├── onboarding/
│   │   ├── page.tsx                     ← /onboarding (initial setup)
│   │   └── [step]/page.tsx              ← /onboarding/:step
│   ├── dashboard/
│   │   ├── page.tsx                     ← /dashboard
│   │   ├── loading.tsx                  ← Dashboard loading
│   │   ├── error.tsx                    ← Dashboard error
│   │   ├── @analytics/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── default.tsx
│   │   └── @activity/
│   │       ├── page.tsx
│   │       ├── loading.tsx
│   │       └── default.tsx
│   ├── projects/
│   │   ├── page.tsx                     ← /projects (list)
│   │   ├── loading.tsx
│   │   ├── new/page.tsx                 ← /projects/new (create new)
│   │   └── [projectId]/
│   │       ├── layout.tsx               ← Project context
│   │       ├── page.tsx                 ← /projects/:id (overview)
│   │       ├── settings/page.tsx        ← /projects/:id/settings
│   │       ├── members/page.tsx         ← /projects/:id/members
│   │       ├── tasks/
│   │       │   ├── page.tsx             ← /projects/:id/tasks
│   │       │   └── [taskId]/page.tsx    ← /projects/:id/tasks/:taskId
│   │       └── analytics/page.tsx       ← /projects/:id/analytics
│   ├── settings/
│   │   ├── layout.tsx                   ← Settings page sub-nav
│   │   ├── page.tsx                     ← /settings (general settings)
│   │   ├── profile/page.tsx             ← /settings/profile
│   │   ├── billing/page.tsx             ← /settings/billing
│   │   ├── team/page.tsx                ← /settings/team
│   │   ├── integrations/page.tsx        ← /settings/integrations
│   │   ├── notifications/page.tsx       ← /settings/notifications
│   │   ├── security/page.tsx            ← /settings/security
│   │   └── api-keys/page.tsx            ← /settings/api-keys
│   └── admin/                           ← Admin only
│       ├── layout.tsx                   ← Admin permission check
│       ├── page.tsx                     ← /admin
│       ├── users/
│       │   ├── page.tsx                 ← /admin/users
│       │   └── [id]/page.tsx            ← /admin/users/:id
│       └── system/page.tsx              ← /admin/system
│
├── api/                                 ← API Routes
│   ├── auth/
│   │   ├── [...nextauth]/route.ts       ← NextAuth.js
│   │   └── session/route.ts             ← Session check
│   ├── users/
│   │   ├── route.ts                     ← GET/POST /api/users
│   │   └── [id]/route.ts               ← GET/PUT/DELETE /api/users/:id
│   ├── projects/
│   │   ├── route.ts                     ← GET/POST /api/projects
│   │   └── [id]/
│   │       ├── route.ts                 ← GET/PUT/DELETE /api/projects/:id
│   │       └── tasks/route.ts           ← GET/POST /api/projects/:id/tasks
│   ├── webhooks/
│   │   ├── stripe/route.ts              ← Stripe Webhook
│   │   └── github/route.ts              ← GitHub Webhook
│   └── upload/route.ts                  ← File upload
│
└── _components/                         ← Components not included in routes
    ├── providers.tsx                     ← Global providers
    └── analytics.tsx                    ← Analytics
```

### 9.2 Colocation Pattern

In Next.js App Router, directories without `page.tsx` are not recognized as routes, so components related to a page can be placed in the same directory (colocation).

```
Recommended: Colocation pattern

  app/projects/[projectId]/
  ├── page.tsx                    ← Page component
  ├── loading.tsx                 ← Loading
  ├── error.tsx                   ← Error
  ├── _components/                ← Page-specific components
  │   ├── project-header.tsx
  │   ├── project-stats.tsx
  │   ├── project-timeline.tsx
  │   └── project-members.tsx
  ├── _hooks/                     ← Page-specific hooks
  │   ├── use-project.ts
  │   └── use-project-tasks.ts
  ├── _lib/                       ← Page-specific utilities
  │   ├── queries.ts
  │   └── actions.ts
  └── _types/                     ← Page-specific type definitions
      └── index.ts

Notes:
  - The _ (underscore) prefix is a convention and
    does not affect Next.js routing
  - Directories without page.tsx don't become routes at all
  - However, if a directory name is one of page, layout, loading, error,
    not-found, route, template, or default, it is recognized as a special file
```

```typescript
// app/projects/[projectId]/page.tsx
// Import colocated components
import { ProjectHeader } from './_components/project-header';
import { ProjectStats } from './_components/project-stats';
import { ProjectTimeline } from './_components/project-timeline';
import { getProject } from './_lib/queries';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) notFound();

  return (
    <div>
      <ProjectHeader project={project} />
      <ProjectStats project={project} />
      <ProjectTimeline projectId={project.id} />
    </div>
  );
}
```

### 9.3 Private Folders

In Next.js, folders with an underscore `_` prefix can be treated as private folders that are excluded from routing.

```
app/
├── _components/            ← Excluded from routing
│   ├── header.tsx
│   └── footer.tsx
├── _lib/                   ← Excluded from routing
│   ├── db.ts
│   └── auth.ts
├── _utils/                 ← Excluded from routing
│   └── format.ts
├── page.tsx
└── dashboard/
    ├── page.tsx
    └── _components/        ← Excluded from routing
        └── chart.tsx
```

---

## 10. Migrating from Pages Router to App Router

### 10.1 Migration Strategy

Migration from Next.js Pages Router (`pages/` directory) to App Router (`app/` directory) is recommended to be done incrementally. Since both routers can coexist, migration can proceed page by page.

```
Incremental migration steps:

  1. Create the app/ directory and place layout.tsx
  2. Move pages one by one from pages/ to app/
  3. For each page, convert:
     - getServerSideProps → async Server Component
     - getStaticProps → async Server Component + generateStaticParams
     - getStaticPaths → generateStaticParams
     - useRouter (next/router) → useRouter (next/navigation)
     - Head → metadata export
  4. Migrate providers from _app.tsx to app/layout.tsx
  5. Migrate settings from _document.tsx to app/layout.tsx
  6. Leave API Routes as-is in pages/api/ or migrate to app/api/
```

```typescript
// ---- Before migration: pages/users/[id].tsx ----
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

interface Props {
  user: User;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const { id } = context.params!;
  const user = await getUser(id as string);

  if (!user) {
    return { notFound: true };
  }

  return { props: { user } };
};

export default function UserPage({ user }: Props) {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{user.name} | My App</title>
        <meta name="description" content={`${user.name}'s profile`} />
      </Head>
      <div>
        <h1>{user.name}</h1>
        <button onClick={() => router.push('/users')}>
          Back to Users
        </button>
      </div>
    </>
  );
}

// ---- After migration: app/users/[id]/page.tsx ----
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface UserPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getUser(id);
  return {
    title: user?.name ?? 'User Not Found',
    description: user ? `${user.name}'s profile` : undefined,
  };
}

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;
  const user = await getUser(id);

  if (!user) {
    notFound();
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <BackButton />  {/* Separated into Client Component */}
    </div>
  );
}

// app/users/[id]/_components/back-button.tsx
'use client';
import { useRouter } from 'next/navigation';

export function BackButton() {
  const router = useRouter();
  return (
    <button onClick={() => router.push('/users')}>
      Back to Users
    </button>
  );
}
```

### 10.2 Key Changes During Migration

| Item | Pages Router | App Router |
|------|-------------|-----------|
| Data fetching | `getServerSideProps` / `getStaticProps` | `async` Server Component |
| Static path generation | `getStaticPaths` | `generateStaticParams` |
| Metadata | `<Head>` component | `metadata` export / `generateMetadata` |
| Router | `useRouter` (next/router) | `useRouter` (next/navigation) |
| Redirect | redirect in `getServerSideProps` | `redirect()` function |
| 404 | `{ notFound: true }` | `notFound()` function |
| Layout | `_app.tsx` + `_document.tsx` | `layout.tsx` |
| API Route | `pages/api/route.ts` | `app/api/route/route.ts` |
| Client state | Default (Client Component) | `'use client'` must be explicit |
| Streaming | Not possible | `<Suspense>` / `loading.tsx` |

---

## 11. Troubleshooting

### 11.1 Common Problems and Solutions

```
Problem 1: Route not recognized (returns 404)
  Cause: page.tsx is not placed, or the file name is incorrect
  Solution:
    - Verify that page.tsx (lowercase) exists in the directory
    - Check it's not Page.tsx or page.jsx
    - TypeScript should use page.tsx, JavaScript should use page.jsx
    - Verify that page.tsx has a default export

Problem 2: Errors in layout.tsx are not caught
  Cause: error.tsx is a child of layout.tsx, so it cannot catch layout errors
  Solution:
    - Place error.tsx in the parent segment
    - For root layout, place global-error.tsx

Problem 3: error.tsx does not work
  Cause: Missing 'use client' directive
  Solution:
    - Always add 'use client' at the top of error.tsx
    - Same applies to global-error.tsx

Problem 4: loading.tsx is not displayed
  Cause: Page is not a Server Component, or not async
  Solution:
    - Verify that page.tsx is an async function
    - For Client Components ('use client'), loading.tsx only works on first load
    - Use Suspense explicitly

Problem 5: Parallel route shows 404
  Cause: Slot's URL does not match during sub-navigation
  Solution:
    - Place default.tsx in each slot
    - Soft navigation preserves previous state,
      but hard navigation requires default.tsx

Problem 6: route.ts and page.tsx are in the same directory
  Cause: page.tsx and route.ts cannot coexist in the same route segment
  Solution:
    - Move API Route to api/ directory
    - Or place page.tsx in a different directory

Problem 7: searchParams is undefined
  Cause: In Next.js 15+, searchParams became a Promise
  Solution:
    - Await it like: const { q } = await searchParams;
    - Also update TypeScript type definitions to Promise<...>
```

### 11.2 Debugging Techniques

```typescript
// Debugging routing

// 1. Check current route information (Client Component)
'use client';
import { usePathname, useSearchParams, useParams } from 'next/navigation';

function DebugRouting() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-black text-green-400 font-mono text-xs rounded-lg max-w-md z-50">
      <div>pathname: {pathname}</div>
      <div>searchParams: {searchParams.toString()}</div>
      <div>params: {JSON.stringify(params)}</div>
    </div>
  );
}

// 2. Logging in Server Component
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;

  // Output to server log
  console.log('[Page] params:', resolvedParams);
  console.log('[Page] searchParams:', resolvedSearch);

  // ...
}

// 3. Logging in Middleware
export function middleware(request: NextRequest) {
  console.log('[Middleware]', request.method, request.nextUrl.pathname);
  return NextResponse.next();
}
```

### 11.3 Performance Issues

```
Problem: Slow initial page load
  Items to check:
    1. Is data fetching creating a waterfall?
       → Parallelize with Promise.all(), or split with Suspense
    2. Is 'use client' scope too large?
       → Maximize Server Component usage, minimize Client Components
    3. Is generateStaticParams being used?
       → Pre-generate frequently accessed pages
    4. Is revalidate set appropriately?
       → Avoid unnecessary re-fetching

Problem: Slow page transitions
  Items to check:
    1. Is Link component's prefetch disabled unnecessarily?
       → Check that prefetch={false} is not set unnecessarily
    2. Are heavy operations being done in layout?
       → layout.tsx is not re-rendered, but
         template.tsx runs every time
    3. Are Suspense boundaries appropriate?
       → Split large components with Suspense
```

```typescript
// Performance optimization: avoiding waterfalls

// BAD: Waterfall (sequential execution)
export default async function DashboardPage() {
  const user = await getUser();           // 1. First get user
  const projects = await getProjects();   // 2. Then get projects (waiting)
  const notifications = await getNotifs(); // 3. Finally get notifications (waiting)

  return (/* ... */);
}

// OK: Parallel execution
export default async function DashboardPage() {
  const [user, projects, notifications] = await Promise.all([
    getUser(),
    getProjects(),
    getNotifications(),
  ]);

  return (/* ... */);
}

// BEST: Progressive display with Suspense
export default async function DashboardPage() {
  const user = await getUser(); // Light operation, displayed immediately

  return (
    <div>
      <UserHeader user={user} />

      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsList />  {/* Independent fetch */}
      </Suspense>

      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsFeed />  {/* Independent fetch */}
      </Suspense>
    </div>
  );
}
```

---

## 12. Anti-Patterns and How to Avoid Them

### 12.1 Common Anti-Patterns

```typescript
// ---- Anti-pattern 1: Making page.tsx a Client Component unnecessarily ----

// BAD: Making the entire page a Client Component
'use client';
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers);
  }, []);
  return <UserList users={users} />;
}

// GOOD: Separating Server Component + Client Component
// page.tsx (Server Component)
export default async function UsersPage() {
  const users = await getUsers(); // Fetch directly on the server
  return <UserList users={users} />;
}

// _components/user-list.tsx (Client Component, only interactive parts)
'use client';
export function UserList({ users }: { users: User[] }) {
  const [filter, setFilter] = useState('');
  const filtered = users.filter(u => u.name.includes(filter));
  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      {filtered.map(user => <UserCard key={user.id} user={user} />)}
    </div>
  );
}
```

```typescript
// ---- Anti-pattern 2: Trying to pass data as props from layout.tsx ----

// BAD: Cannot pass data from layout.tsx to children
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  // There is no way to pass user to children!
  return (
    <div>
      <Sidebar user={user} />
      {children}  {/* Cannot pass user */}
    </div>
  );
}

// GOOD: Shared context or individual data fetching
// Method 1: React Context + Client Component Provider
// layout.tsx
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  return (
    <UserProvider initialUser={user}>
      <Sidebar />
      {children}
    </UserProvider>
  );
}

// Method 2: Individual data fetching in each page.tsx (recommended)
// Next.js deduplicates fetch by default,
// so the same request is only executed once
```

```typescript
// ---- Anti-pattern 3: Directory structure that is too deep ----

// BAD: Too deep nesting
// app/dashboard/settings/account/profile/edit/confirm/page.tsx
// → /dashboard/settings/account/profile/edit/confirm

// GOOD: Use route groups and flat structures
// app/(app)/settings/page.tsx         → /settings
// app/(app)/settings/profile/page.tsx → /settings/profile
// Keep depth to 3-4 levels maximum
```

```typescript
// ---- Anti-pattern 4: Overusing API Routes ----

// BAD: Using API Route when Server Component can fetch directly
// app/api/users/route.ts
export async function GET() {
  const users = await db.user.findMany();
  return NextResponse.json(users);
}

// app/users/page.tsx
export default async function UsersPage() {
  // No need to call the API Route
  const res = await fetch('http://localhost:3000/api/users');
  const users = await res.json();
  return <UserList users={users} />;
}

// GOOD: Direct database access in Server Component
export default async function UsersPage() {
  const users = await db.user.findMany();
  return <UserList users={users} />;
}

// Use API Routes for:
// - Webhooks from external services
// - Fetches from the client (Client Components)
// - Public API exposure
// - Cron job endpoints
```

```typescript
// ---- Anti-pattern 5: Inappropriate use of generateStaticParams ----

// BAD: Trying to pre-generate all records
export async function generateStaticParams() {
  // Pre-generating 1 million users → enormous build time
  const users = await db.user.findMany();
  return users.map(u => ({ id: u.id }));
}

// GOOD: Pre-generate only frequently accessed pages
export async function generateStaticParams() {
  // Pre-generate only top 100, rest on demand
  const topUsers = await db.user.findMany({
    orderBy: { viewCount: 'desc' },
    take: 100,
    select: { id: true },
  });
  return topUsers.map(u => ({ id: u.id }));
}

// With dynamicParams = true (default),
// parameters not pre-generated are generated on demand
```

### 12.2 Security Considerations

```typescript
// 1. Validation of dynamic route parameters
// Always treat parameters as user input and validate them

// BAD: Trust and use parameters directly
export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // SQL injection risk (without using ORM)
  const user = await sql`SELECT * FROM users WHERE id = ${id}`;
  return <div>{user.name}</div>;
}

// GOOD: Validation + Parameterized Query
export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    notFound();
  }

  // Use ORM (parameterized query)
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();

  return <div>{user.name}</div>;
}

// 2. Preventing sensitive information leakage from Server Components
// Since Server Component rendering results are sent to the client,
// sensitive information must not be included directly

// BAD: Sending sensitive information to the client
export default async function AdminPage() {
  const config = await getSystemConfig();
  return (
    <div>
      {/* DB connection string is sent to the client! */}
      <pre>{JSON.stringify(config, null, 2)}</pre>
    </div>
  );
}

// GOOD: Select only necessary information
export default async function AdminPage() {
  const config = await getSystemConfig();
  return (
    <div>
      <p>App Version: {config.version}</p>
      <p>Environment: {config.environment}</p>
      {/* Do not include sensitive info like DB connection strings */}
    </div>
  );
}

// 3. Authentication in middleware.ts
// In addition to authentication checks in Server Components,
// also perform pre-checks in middleware.ts (double-checking)
```

---

## 13. Best Practices Checklist

### 13.1 Directory Design

- [ ] Using route groups `(name)` to separate layouts for marketing, app, and auth
- [ ] Keeping directory depth to 4 levels or less
- [ ] Leveraging colocation (`_components/` etc.) to place related files nearby
- [ ] Using intermediate directories without `page.tsx` only for layout purposes
- [ ] Making non-routing files explicit with Private Folders (`_` prefix)

### 13.2 Layout Design

- [ ] Placing `<html>` and `<body>` tags in the root layout
- [ ] Placing shared providers (Theme, Auth, Query) in the root layout
- [ ] Performing authentication checks in the layout.tsx of the corresponding route group
- [ ] Using `template.tsx` only when truly necessary
- [ ] Avoiding heavy processing in layouts to maintain performance

### 13.3 Data Fetching

- [ ] Fetching data directly in Server Components, avoiding API Route calls
- [ ] Avoiding waterfalls with `Promise.all()` or `Suspense`
- [ ] Pre-generating frequently accessed pages with `generateStaticParams`
- [ ] Setting `revalidate` appropriately to avoid unnecessary re-fetching
- [ ] Intentionally configuring `dynamicParams`

### 13.4 Error Handling

- [ ] Placing `error.tsx` in each major section
- [ ] Adding `'use client'` directive to `error.tsx`
- [ ] Placing `global-error.tsx` at the root
- [ ] Implementing display branching based on error type
- [ ] Sending errors to a monitoring service in production
- [ ] Customizing `not-found.tsx` to display user-friendly 404 pages

### 13.5 Performance

- [ ] Minimizing `'use client'` usage and being aware of Client Component boundaries
- [ ] Splitting heavy components with `<Suspense>` and leveraging streaming
- [ ] Implementing skeleton UI with `loading.tsx` to prevent CLS (Cumulative Layout Shift)
- [ ] Defining static metadata with `metadata` object, using `generateMetadata` only for dynamic cases

---

## FAQ

### Q1: What is the migration strategy from App Router to Pages Router?
Incremental migration is recommended. Since `app/` and `pages/` can coexist, start implementing new pages with App Router and migrate existing pages as needed. Phase 1: create `app/layout.tsx` and root layout to start coexistence. Phase 2: gradually migrate existing pages. Phase 3: complete migration. Note: when `pages/` and `app/` conflict on the same path, `app/` takes priority. Replace `getServerSideProps` with Server Components and `getStaticProps` with `generateStaticParams`.

### Q2: How do I choose between dynamic routes and catch-all routes?

### Q3: How do I use route groups effectively?
Route groups `(name)` are used to separate layout and middleware scope without affecting the URL. There are four main usage patterns: (1) Layout separation (different layouts for marketing site and application), (2) Auth area separation (controlling presence/absence of auth checks with `(auth)/` and `(protected)/`), (3) Internationalization (changing layouts per section with `[locale]/(shop)/` and `[locale]/(blog)/`), (4) A/B testing (assigning `(variant-a)/` and `(variant-b)/` with Middleware).

---

## Summary

| Concept | Key Points |
|---------|-----------|
| File conventions | page, layout, loading, error, not-found, template, default, route |
| Route groups | `(name)` splits layouts without including in URL |
| Parallel routes | `@slot` for parallel display, independent loading/error |
| Intercepting | `(.)path` for modal display, direct access shows full screen |
| Component hierarchy | Layout > Template > ErrorBoundary > Suspense > NotFound > Page |
| Middleware | Authentication, i18n, Rate Limiting, A/B testing |
| Route Segment Config | `dynamic`, `revalidate`, `runtime`, `dynamicParams` |
| Colocation | `_components/` etc. co-locates page-specific files |
| Migration | Can incrementally migrate from Pages Router |

### Framework Selection Criteria

| Requirement | Recommended Framework | Reason |
|-------------|----------------------|--------|
| React + SSR/SSG | Next.js App Router | Richest ecosystem |
| React + Web Standards | Remix / React Router v7 | Progressive enhancement |
| Vue.js | Nuxt.js 3 | Integration with Vue ecosystem |
| Svelte | SvelteKit | Lightweight and fast |
| Content site | Astro | Minimum JS with Islands Architecture |
| Type safety priority | SvelteKit / Next.js | Rich automatic type generation |

---

## Next Guides to Read

---

## References
1. Next.js. "Routing Fundamentals." nextjs.org/docs/app/building-your-application/routing, 2025.
2. Next.js. "File Conventions." nextjs.org/docs/app/api-reference/file-conventions, 2025.
3. Next.js. "Parallel Routes." nextjs.org/docs/app/building-your-application/routing/parallel-routes, 2025.
4. Next.js. "Intercepting Routes." nextjs.org/docs/app/building-your-application/routing/intercepting-routes, 2025.
5. Next.js. "Route Handlers." nextjs.org/docs/app/building-your-application/routing/route-handlers, 2025.
6. Next.js. "Middleware." nextjs.org/docs/app/building-your-application/routing/middleware, 2025.
7. Remix. "Route File Naming v2." remix.run/docs/en/main/file-conventions/routes, 2025.
8. Remix. "Route Module." remix.run/docs/en/main/route/component, 2025.
9. SvelteKit. "Routing." kit.svelte.dev/docs/routing, 2025.
10. Nuxt.js. "Pages Directory." nuxt.com/docs/guide/directory-structure/pages, 2025.
11. Astro. "Routing." docs.astro.build/en/guides/routing, 2025.
12. Vercel. "Understanding Next.js App Router." vercel.com/blog, 2025.
13. Kent C. Dodds. "Full Stack Components." kentcdodds.com, 2024.
14. Lee Robinson. "Next.js App Router: Routing Patterns." leerob.io, 2024.
