# SPA / MPA / SSR

> The rendering approach for a web application determines its performance and UX. Understand the characteristics and selection criteria for SPA, MPA, SSR, SSG, ISR, Streaming SSR, and React Server Components, then choose the architecture that best fits your project requirements.

## Prerequisites

Before studying this chapter, it is recommended to acquire the following knowledge.

- HTTP basics (request/response, status codes, cache headers)
  - Reference: `../../network-fundamentals/docs/02-http/00-http-basics.md`
- Browser rendering pipeline (DOM construction, CSSOM, layout, paint)
  - Reference: `../../browser-and-web-platform/docs/01-rendering/00-rendering-pipeline.md`
- HTML/CSS/JavaScript basics (DOM manipulation, event handling, asynchronous processing)

## What You Will Learn

- [ ] Understand the mechanics and characteristics of each rendering approach
- [ ] Grasp selection criteria from a performance and SEO perspective
- [ ] Learn the design of hybrid rendering
- [ ] Understand the Hydration mechanism and optimization techniques
- [ ] Learn practical use of React Server Components and Streaming SSR
- [ ] Understand Islands Architecture and Partial Hydration

## Prerequisites

Before studying this chapter, it is recommended to acquire the following knowledge.

- **HTTP basics**: Understanding the request/response model, status codes, and headers
  → Reference: `../../network-fundamentals/docs/02-http/00-http-basics.md`
- **Browser rendering**: Understanding the Critical Rendering Path, Paint, and Layout
  → Reference: `../../browser-and-web-platform/docs/01-rendering/00-rendering-pipeline.md`
- **HTML/CSS/JavaScript basics**: Understanding DOM manipulation, event handling, and asynchronous processing (Promise/async-await)

---

## 1. Overview of Rendering Approaches

### 1.1 Comparison of Approaches

```
Comparison of approaches:

         Initial Load  Interactivity  SEO   Server Load  Complexity  JS Bundle
─────────────────────────────────────────────────────────────────────────────
CSR/SPA   Slow         Best           Poor  Low          Low         Large
MPA       Fast         Low            Good  Moderate     Low         Minimal
SSR       Fast         High           Good  High         Moderate    Large
SSG       Fastest      High           Best  Lowest       Low         Moderate
ISR       Fast         High           Good  Low          Moderate    Moderate
Streaming Fast         High           Good  Moderate     High        Moderate
RSC       Fast         High           Good  Moderate     High        Small
Islands   Fast         Moderate       Good  Low          Moderate    Minimal

Rendering timing:
  CSR:       Rendered on the client (browser)
  MPA:       Server returns complete HTML per request (traditional)
  SSR:       Server renders per request + Hydration on client
  SSG:       Server renders at build time
  ISR:       On first request + periodic regeneration
  Streaming: Server renders incrementally
  RSC:       Server/client split at the component level
  Islands:   Only specific parts of the page are made interactive
```

### 1.2 Historical Evolution of Rendering Approaches

```
Evolution of web rendering:

  Early 2000s: Traditional MPA
  → PHP, JSP, Ruby on Rails
  → Server generates all HTML
  → Full page reload on every navigation

  Early 2010s: Rise of SPA
  → Backbone.js, AngularJS, React
  → Client-side routing
  → Rich interactions

  Late 2010s: SSR + SPA (Universal/Isomorphic)
  → Next.js, Nuxt.js
  → Server generates initial HTML + client Hydration
  → Both SEO and interactivity

  Early 2020s: SSG + ISR
  → Gatsby, Next.js SSG/ISR
  → Static HTML generated at build time
  → Fastest delivery via CDN

  Mid 2020s: RSC + Streaming + Islands
  → React Server Components
  → Streaming SSR with Suspense
  → Astro (Islands Architecture)
  → Minimizing JS bundles

  Current trends:
  → Hybrid approach (choose optimal method per page)
  → Server-first (server by default, client only when needed)
  → Progressive Enhancement (basic functionality works without JS)
```

---

## 2. CSR / SPA (Client Side Rendering / Single Page Application)

### 2.1 How SPA Works

```
SPA (Single Page Application):
  → Browser executes JS to generate HTML
  → Page transitions use client-side routing
  → Server only serves an empty HTML shell and JS bundle

  Flow:
  1. Browser: GET /
  2. Server: Returns empty HTML + JS bundle
  3. Browser: Executes JS → builds DOM → displays page
  4. Browser: API call → fetches data → updates page

  Initial HTML returned on first request:
  <html>
    <head>
      <title>App</title>
      <link rel="stylesheet" href="/assets/styles.a1b2c3.css">
    </head>
    <body>
      <div id="root"></div>     ← empty HTML
      <script src="/assets/app.d4e5f6.js"></script>  ← JS renders everything
    </body>
  </html>

  Page transition (/products → /products/123):
  → URL change (History API)
  → Load new JS component
  → API call
  → Partial DOM update
  → No HTML request to server
```

### 2.2 SPA Advantages and Disadvantages

```
Advantages:
  ✓ Fast page transitions (no server request)
  ✓ Rich interactions (animations, transitions)
  ✓ Low server load (serves static files only)
  ✓ Easy offline support (PWA, Service Worker)
  ✓ Complete separation of backend and frontend
  ✓ API can be shared with mobile apps
  ✓ Simple deployment (S3 + CloudFront, etc.)

Disadvantages:
  ✗ Slow initial load (download + parse + execute JS bundle)
  ✗ Difficult SEO (crawlers may not execute JS)
  ✗ Slow FCP / LCP (blank screen until JS executes)
  ✗ Nothing displayed if JS is disabled
  ✗ Risk of memory leaks (memory not released on page transitions)
  ✗ Bundle size management required
  ✗ Extra work needed for social media OGP

Use cases:
  → Admin panels, dashboards
  → Post-login applications
  → Tool-type apps that don't need SEO
  → Email clients, chat apps
  → Design tools (Figma, etc.)
  → Code editors (VS Code Web)

Frameworks:
  → React (Vite)
  → Vue (Vite)
  → Angular
  → Svelte (SvelteKit CSR mode)
```

### 2.3 SPA Implementation Example

```typescript
// SPA setup with Vite + React

// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 3,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// App.tsx - routing
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, RequireAuth } from './features/auth';
import { AppLayout } from './shared/layouts/AppLayout';
import { PageSkeleton } from './shared/components/PageSkeleton';

// Code splitting: lazy-load each page
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const UserDetail = lazy(() => import('./pages/UserDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/:id" element={<UserDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
```

```typescript
// Data fetching in SPA (TanStack Query)
// pages/Users.tsx
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', { page, search }],
    queryFn: () =>
      fetch(`/api/users?page=${page}&search=${search}`).then(r => r.json()),
    staleTime: 30 * 1000,
  });

  if (isLoading) return <UserListSkeleton />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div>
      <h1>User List</h1>
      <SearchInput value={search} onChange={setSearch} />
      <UserTable users={data.users} />
      <Pagination
        currentPage={page}
        totalPages={data.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

### 2.4 SPA SEO Strategies

```
SPA SEO problems and solutions:

  Problems:
  → Googlebot can execute JS, but with delay
  → Other crawlers (Bing, Twitter, etc.) may not execute JS
  → Dynamic meta tags may not be reflected
  → OGP images may not be fetched

  Solution 1: Migrate to SSR / SSG (recommended)
  → Use SSR with Next.js, Nuxt.js
  → Apply SSR only to pages that need SEO

  Solution 2: Pre-rendering
  → Prerender.io, Rendertron
  → Detect crawler User-Agent
  → Return pre-rendered HTML

  Solution 3: react-helmet / @tanstack/react-head
  → Manage dynamic <title>, <meta> tags
  → However, may not be reflected in crawlers with CSR alone
```

```typescript
// Managing meta tags with react-helmet-async
import { Helmet } from 'react-helmet-async';

function ProductPage({ product }: { product: Product }) {
  return (
    <>
      <Helmet>
        <title>{product.name} | MyStore</title>
        <meta name="description" content={product.description} />
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={product.description} />
        <meta property="og:image" content={product.imageUrl} />
        <meta property="og:type" content="product" />
        <link rel="canonical" href={`https://mystore.com/products/${product.slug}`} />
      </Helmet>

      <div>
        <h1>{product.name}</h1>
        {/* ... */}
      </div>
    </>
  );
}
```

---

## 3. MPA (Multi Page Application)

### 3.1 How Traditional MPA Works

```
MPA (Multi Page Application):
  → Server generates complete HTML for each URL
  → Full page reload on every navigation
  → Rendered by server-side template engine

  Flow:
  1. Browser: GET /products
  2. Server: Template + data → generate HTML
  3. Browser: Receives HTML → displays immediately
  4. User: Clicks a link
  5. Browser: GET /products/123
  6. Server: Template + data → generate new HTML
  7. Browser: Full page reload → display HTML

  Advantages:
  ✓ Fast initial load (server generates HTML)
  ✓ Optimal for SEO (full HTML returned)
  ✓ Simple (no JS framework required)
  ✓ Works without JS
  ✓ No memory leak concern (everything discarded on page navigation)

  Disadvantages:
  ✗ Slow page transitions (full page reload)
  ✗ Rich interactions are difficult
  ✗ Hard to maintain state (lost on page navigation)
  ✗ Server and frontend are tightly coupled

  Use cases:
  → Blogs, news sites
  → Documentation sites
  → E-commerce (catalog pages)
  → Corporate sites

  Frameworks:
  → Rails + ERB/Slim
  → Django + Jinja2
  → Laravel + Blade
  → Spring Boot + Thymeleaf
  → Express + EJS/Pug
```

### 3.2 Modern MPA (htmx + View Transitions)

```html
<!-- htmx: Add SPA-like behavior to MPA -->
<!-- Partial updates without full page reload -->

<!-- Basic htmx usage example -->
<div id="user-list">
  <!-- User search: sends request to server on each input -->
  <input
    type="search"
    name="search"
    hx-get="/api/users/search"
    hx-trigger="input changed delay:300ms"
    hx-target="#user-results"
    hx-indicator="#search-spinner"
    placeholder="Search users..."
  >
  <span id="search-spinner" class="htmx-indicator">🔍</span>

  <div id="user-results">
    <!-- Replaced by HTML fragment returned from server -->
  </div>
</div>

<!-- Infinite scroll -->
<div id="posts">
  <article>Post 1</article>
  <article>Post 2</article>
  <!-- Fetch next page when last element is visible -->
  <div hx-get="/api/posts?page=2"
       hx-trigger="revealed"
       hx-swap="afterend"
       hx-select="article">
    Loading...
  </div>
</div>

<!-- View Transitions API (smooth transitions even in MPA) -->
<style>
  /* Page transition animation */
  @view-transition {
    navigation: auto;
  }

  ::view-transition-old(root) {
    animation: 0.3s ease-out fade-out;
  }

  ::view-transition-new(root) {
    animation: 0.3s ease-in fade-in;
  }

  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
```

```typescript
// Server implementation with Express + htmx
import express from 'express';

const app = express();

// User search API (returns HTML fragment)
app.get('/api/users/search', async (req, res) => {
  const { search } = req.query;

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ],
    },
    take: 20,
  });

  // Return HTML fragment (not JSON)
  const html = users.map(user => `
    <div class="user-card" id="user-${user.id}">
      <h3>${user.name}</h3>
      <p>${user.email}</p>
      <button
        hx-delete="/api/users/${user.id}"
        hx-target="#user-${user.id}"
        hx-swap="outerHTML"
        hx-confirm="Are you sure you want to delete?"
      >Delete</button>
    </div>
  `).join('');

  res.send(html);
});
```

---

## 4. SSR (Server Side Rendering)

### 4.1 How SSR Works

```
SSR (Server Side Rendering):
  → Server generates HTML per request
  → Client performs Hydration to make it interactive

  Flow:
  1. Browser: GET /users
  2. Server: Executes React components → generates HTML string
  3. Server: Fetches data → embeds data in HTML
  4. Server: Sends complete HTML in response
  5. Browser: Displays HTML immediately (fast FCP)
  6. Browser: Downloads + parses JS bundle
  7. Browser: Hydration (attaches event listeners to DOM)
  8. Browser: Interactive (TTI)

  HTML generated on the server:
  <html>
    <head>
      <title>Users | MyApp</title>
      <meta name="description" content="User list">
      <link rel="stylesheet" href="/styles.css">
      <!-- Initial data for hydration fetched on server -->
      <script>
        window.__INITIAL_DATA__ = {"users":[{"id":1,"name":"Taro"},...]};
      </script>
    </head>
    <body>
      <div id="root">
        <h1>Users</h1>           ← Generated on server
        <ul>
          <li>Taro</li>          ← Displayed immediately
          <li>Hanako</li>
        </ul>
      </div>
      <script src="app.js"></script>  ← For Hydration
    </body>
  </html>
```

### 4.2 SSR Advantages and Disadvantages

```
Advantages:
  ✓ Fast initial load (HTML can be rendered immediately)
  ✓ Optimal for SEO (complete HTML returned to crawlers)
  ✓ Social media OGP support
  ✓ User-specific content can be shown on initial load
  ✓ Real-time reflection of dynamic data

Disadvantages:
  ✗ High server load (rendering per request)
  ✗ TTFB (Time to First Byte) is slower than SSG
  ✗ Not interactive during Hydration (Uncanny Valley)
  ✗ Server scaling required
  ✗ Code must work on both server and client
  ✗ Risk of Hydration mismatch errors

Use cases:
  → E-commerce sites (SEO + dynamic data + personalization)
  → Social networks (personal profile pages)
  → News sites (real-time updates)
  → Search results pages

Frameworks:
  → Next.js (React)
  → Nuxt (Vue)
  → Remix (React)
  → SvelteKit (Svelte)
  → Qwik City (Qwik)
  → Solid Start (SolidJS)
```

### 4.3 SSR Implementation in Next.js

```typescript
// SSR with Next.js App Router

// app/users/page.tsx
// Server Component by default = SSR

import { prisma } from '@/shared/lib/prisma';
import { UserList } from '@/features/users';
import { Metadata } from 'next';

// Dynamic metadata generation
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'User List | MyApp',
    description: 'Displays a list of registered users',
    openGraph: {
      title: 'User List',
      description: 'List of registered users',
      type: 'website',
    },
  };
}

// SSR: fetch data + generate HTML on every request
export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      createdAt: true,
    },
  });

  return (
    <main>
      <h1>User List</h1>
      <UserList users={users} />
    </main>
  );
}

// force-dynamic: no cache, always SSR
export const dynamic = 'force-dynamic';
```

```typescript
// SSR with Next.js Pages Router (getServerSideProps)

import { GetServerSideProps } from 'next';

interface Props {
  users: User[];
  totalCount: number;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const { page = '1', search = '' } = context.query;

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: search
        ? { name: { contains: String(search), mode: 'insensitive' } }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (Number(page) - 1) * 20,
    }),
    prisma.user.count({
      where: search
        ? { name: { contains: String(search), mode: 'insensitive' } }
        : {},
    }),
  ]);

  return {
    props: {
      users: JSON.parse(JSON.stringify(users)), // Serialize Date type
      totalCount,
    },
  };
};

export default function UsersPage({ users, totalCount }: Props) {
  return (
    <div>
      <h1>User List ({totalCount} items)</h1>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 4.4 Hydration in Detail

```
How Hydration works:

  Overview:
  → Takes the static HTML generated on the server and adds
    event listeners and state management on the client
    to make it interactive

  Flow:
  1. Server HTML:  <button>Like (0)</button>  ← appearance only
  2. JS download + parse
  3. React builds virtual DOM
  4. Reconcile server HTML with virtual DOM
  5. Attach event listeners
  6. <button onClick={handleLike}>Like (0)</button>  ← interactive

  Problems with Hydration:
  ① High processing cost:
     → Traverses the entire component tree
     → Can take several seconds for large apps

  ② Uncanny Valley:
     → HTML is displayed but clicks don't work
     → Users see what looks interactive but gets no response

  ③ Hydration Mismatch:
     → Error when server and client output differ
     → Causes: Date.now(), Math.random(), localStorage, etc.
```

```typescript
// Avoiding Hydration Mismatch

// Bad example: different output on server and client
function Greeting() {
  // ✗ Time differs between server and client
  const now = new Date();
  return <p>Current time: {now.toLocaleTimeString()}</p>;
}

// Good example: only runs on client
'use client';
import { useState, useEffect } from 'react';

function Greeting() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    // Set time only on client
    setTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <p>Current time: {time || 'Loading...'}</p>;
}

// Using suppressHydrationWarning (last resort)
function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    // When different classes are applied on server and client
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

---

## 5. SSG (Static Site Generation)

### 5.1 How SSG Works

```
SSG (Static Site Generation):
  → Pre-generates HTML for all pages at build time
  → Served as static files from CDN

  Flow:
  1. Build time: Fetch data → generate HTML for all pages
  2. Deploy: Upload generated HTML to CDN
  3. Browser: GET /about
  4. CDN: Returns pre-generated HTML (fastest)
  5. Browser: Display immediately + Hydration

  Advantages:
  ✓ Fastest display speed (static files served from CDN)
  ✓ Zero server load
  ✓ Optimal SEO
  ✓ High security (no server-side logic)
  ✓ Lowest hosting cost
  ✓ High stability (not affected by database failures)

  Disadvantages:
  ✗ Long build time (for large numbers of pages)
  ✗ Data updates require rebuild
  ✗ Not suitable for user-specific content
  ✗ May not be practical for very large page counts
  ✗ Access to data sources required at build time

  Use cases:
  → Blogs, documentation
  → Landing pages
  → Corporate sites
  → Marketing sites
  → Help centers

  Frameworks:
  → Next.js (React)
  → Astro (multi-framework, recommended)
  → Gatsby (React)
  → Hugo (Go)
  → 11ty / Eleventy (JS)
  → VitePress (Vue)
```

### 5.2 SSG Implementation in Next.js

```typescript
// SSG with Next.js App Router

// app/blog/[slug]/page.tsx

import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '@/features/blog/api';
import { Metadata } from 'next';

// Define paths to generate at build time
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// Dynamic metadata
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};

  return {
    title: `${post.title} | Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [{ url: post.ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.ogImage],
    },
  };
}

// Page component
export default async function BlogPost({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article>
      <header>
        <time dateTime={post.publishedAt}>
          {new Date(post.publishedAt).toLocaleDateString('en-US')}
        </time>
        <h1>{post.title}</h1>
        <p>{post.excerpt}</p>
      </header>
      <div
        className="prose prose-lg"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </article>
  );
}
```

### 5.3 SSG with Astro

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, getEntry } from 'astro:content';
import BlogLayout from '../../layouts/BlogLayout.astro';
import TableOfContents from '../../components/TableOfContents.astro';
// React components can also be used (Islands Architecture)
import ShareButton from '../../components/ShareButton.tsx';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content, headings } = await post.render();
---

<BlogLayout title={post.data.title} description={post.data.description}>
  <article>
    <h1>{post.data.title}</h1>
    <time datetime={post.data.publishedAt.toISOString()}>
      {post.data.publishedAt.toLocaleDateString('en-US')}
    </time>

    <TableOfContents headings={headings} />

    <div class="prose">
      <Content />
    </div>

    <!-- Islands Architecture: only this component is interactive -->
    <ShareButton
      client:visible
      title={post.data.title}
      url={Astro.url.href}
    />
  </article>
</BlogLayout>
```

---

## 6. ISR (Incremental Static Regeneration)

### 6.1 How ISR Works

```
ISR = SSG + periodic regeneration:
  → Returns a static page like SSG on first access
  → Periodically regenerates pages in the background
  → stale-while-revalidate pattern

  Flow:
  1. First request: SSR → cache HTML
  2. Within revalidate seconds: return cached HTML (instant)
  3. Request after revalidate seconds:
     → Return stale cache immediately
     → Regenerate in the background
  4. Next request: return new HTML

  Advantages:
  ✓ SSG speed + data freshness
  ✓ Short build time (no need to pre-generate all pages)
  ✓ CDN caching works
  ✓ No rebuild needed when data updates
  ✓ Scales to millions of pages

  Disadvantages:
  ✗ Data may be stale by the revalidate interval
  ✗ First access is as slow as SSR (cache miss)
  ✗ May have limitations outside Next.js Vercel deployments

  Use cases:
  → E-commerce product pages
  → Blog article pages
  → Content with moderate update frequency
  → Documentation (CMS integration)
```

### 6.2 ISR Implementation

```typescript
// ISR with Next.js App Router

// app/products/[id]/page.tsx
import { notFound } from 'next/navigation';

// ISR: revalidate every 60 seconds
export const revalidate = 60;

// Pages to generate at build time (top products only)
export async function generateStaticParams() {
  // Generate only top 100 products at build time
  const topProducts = await prisma.product.findMany({
    orderBy: { salesCount: 'desc' },
    take: 100,
    select: { id: true },
  });

  return topProducts.map((p) => ({
    id: p.id,
  }));
  // Pages not generated at build time are generated on first access
}

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!product) notFound();

  return (
    <div>
      <ProductHeader product={product} />
      <ProductGallery images={product.images} />
      <ProductInfo product={product} />
      <ReviewList reviews={product.reviews} />
    </div>
  );
}
```

```typescript
// On-demand ISR (On-demand Revalidation)

// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// Immediately regenerate specific pages via webhook
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidation-secret');

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const body = await request.json();

  // Path-based revalidation
  if (body.path) {
    revalidatePath(body.path);
    return NextResponse.json({ revalidated: true, path: body.path });
  }

  // Tag-based revalidation
  if (body.tag) {
    revalidateTag(body.tag);
    return NextResponse.json({ revalidated: true, tag: body.tag });
  }

  return NextResponse.json({ error: 'Missing path or tag' }, { status: 400 });
}

// On-demand regeneration via CMS webhook
// POST /api/revalidate
// Body: { "path": "/products/123" }
// or:   { "tag": "products" }

// Tag-based cache management
// app/products/[id]/page.tsx
async function getProduct(id: string) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    next: { tags: [`product-${id}`, 'products'] },
  });
  return res.json();
}

// Revalidate product-123 tag → /products/123 page is regenerated
// Revalidate products tag → all product pages are regenerated
```

---

## 7. Streaming SSR

### 7.1 How Streaming Works

```
Streaming SSR:
  → Sends HTML from server incrementally
  → Display important parts first, slow data arrives later
  → React 18 + Suspense + Server Components

  Traditional SSR:
  Fetch data ──────────→ Generate HTML ──→ Send ──→ Display
  (waits until all data is ready)

  Streaming SSR:
  Fetch data A ──→ HTML(A) ──→ Send ──→ Display immediately
  Fetch data B ────────→ HTML(B) ──→ Send ──→ Fallback → Display real data
  Fetch data C ──────────────→ HTML(C) → Send → Fallback → Display real data

  Advantages:
  ✓ Greatly improved TTFB (first byte returns quickly)
  ✓ Fast FCP (important content displayed first)
  ✓ Slow data fetching does not block the entire page
  ✓ Better user experience (incremental content display)

  Technical mechanics:
  → HTTP Transfer-Encoding: chunked
  → React renderToPipeableStream / renderToReadableStream
  → Independent stream per Suspense boundary
```

### 7.2 Streaming SSR Implementation

```typescript
// Streaming SSR with Next.js App Router

// app/products/[id]/page.tsx
import { Suspense } from 'react';
import { ProductHeader } from '@/features/products';
import { ReviewsSkeleton, RecommendationsSkeleton } from '@/shared/components/skeletons';

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  // Start response immediately (basic product info can be fetched quickly)
  const product = await getProduct(params.id);

  return (
    <div>
      {/* Displayed immediately (First Chunk) */}
      <ProductHeader product={product} />
      <ProductGallery images={product.images} />
      <ProductPrice price={product.price} />

      {/* Reviews: requires separate DB query → deferred with Suspense */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={params.id} />
      </Suspense>

      {/* Recommendations: requires ML inference → deferred with Suspense */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations productId={params.id} />
      </Suspense>

      {/* Stock info: external API → deferred with Suspense */}
      <Suspense fallback={<StockSkeleton />}>
        <StockInfo productId={params.id} />
      </Suspense>
    </div>
  );
}

// ProductReviews is an async Server Component
async function ProductReviews({ productId }: { productId: string }) {
  // Even if this fetch takes 2 seconds, the whole page is not blocked
  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { name: true, avatar: true } } },
  });

  return (
    <section>
      <h2>Reviews ({reviews.length})</h2>
      {reviews.map(review => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </section>
  );
}
```

```typescript
// Automatic Streaming via loading.tsx

// app/dashboard/loading.tsx
// → Automatically displayed when navigating to /dashboard
export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-200 animate-pulse rounded" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 animate-pulse rounded" />
    </div>
  );
}

// app/dashboard/page.tsx
// Suspense boundary is automatically set when loading.tsx is present
export default async function DashboardPage() {
  const [stats, recentOrders, topProducts] = await Promise.all([
    getStats(),
    getRecentOrders(),
    getTopProducts(),
  ]);

  return (
    <div>
      <StatsCards stats={stats} />
      <RecentOrdersTable orders={recentOrders} />
      <TopProductsChart products={topProducts} />
    </div>
  );
}
```

---

## 8. React Server Components (RSC)

### 8.1 RSC Concept

```
RSC (React Server Components):
  → Use server or client per component
  → Default in Next.js App Router
  → JS of Server Components is not sent to the client

  Server Component (default):
  → Rendered on server
  → Not included in JS bundle (reduces bundle size)
  → Can fetch data with async/await
  → Cannot use state management or event handlers
  → Can use Node.js APIs (fs, crypto, etc.)
  → Can directly access DB/filesystem

  Client Component ('use client'):
  → Rendered in browser
  → Included in JS bundle
  → Can use useState, useEffect
  → Can use event handlers
  → Can use browser APIs (localStorage, window, etc.)

  RSC Payload:
  → Output of Server Components is a serialized React element format
  → Not HTML, but a description of the virtual DOM
  → Contains references to Client Components
  → Differential updates are possible (state is maintained on navigation)
```

### 8.2 RSC Implementation Patterns

```typescript
// Server Component (default)
// features/users/components/UserList.tsx

import { prisma } from '@/shared/lib/prisma';
import { UserCard } from './UserCard';
import { UserSearchInput } from './UserSearchInput'; // Client Component

// async Server Component: direct DB access
export async function UserList({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const query = searchParams.q || '';
  const page = Number(searchParams.page || '1');

  // Fetch data directly on server (no API needed)
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: query
        ? { name: { contains: query, mode: 'insensitive' } }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (page - 1) * 20,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.user.count({
      where: query
        ? { name: { contains: query, mode: 'insensitive' } }
        : {},
    }),
  ]);

  return (
    <div>
      {/* Client Component: requires interaction */}
      <UserSearchInput defaultValue={query} />

      {/* Server Component: static display */}
      <p>{total} users</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>

      <ServerPagination total={total} page={page} perPage={20} />
    </div>
  );
}

// Client Component
// features/users/components/UserSearchInput.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export function UserSearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    params.set('page', '1');

    startTransition(() => {
      router.push(`/users?${params.toString()}`);
    });
  }, 300);

  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          handleSearch(e.target.value);
        }}
        placeholder="Search users..."
        className="w-full px-4 py-2 border rounded-lg"
      />
      {isPending && (
        <div className="absolute right-3 top-3">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  );
}
```

### 8.3 Server/Client Boundary Design

```
When to use Server vs Client:

  Use Server Component:
  ✓ Database access
  ✓ Server-only API calls (internal microservices)
  ✓ Large dependency libraries (markdown parsers, syntax highlighters)
  ✓ Handling sensitive information (API keys, tokens)
  ✓ Static UI display

  Use Client Component:
  ✓ Needs useState, useEffect
  ✓ Event handlers like onClick, onChange
  ✓ Browser APIs (localStorage, window, navigator)
  ✓ Third-party client libraries (maps, charts)
  ✓ Custom hooks (with state)
  ✓ React Context (Provider)

  Best practices for boundary design:
  → Keep Client boundary as close to the leaf as possible
  → Do not mark entire pages as 'use client'
  → Isolate only interactive parts as Client Components

  ┌─────────────────────────────────────────────┐
  │ ProductPage (Server)                         │
  │ ┌───────────────────────────────────────┐   │
  │ │ ProductInfo (Server)                   │   │
  │ │ → Name, description, specs (static)   │   │
  │ └───────────────────────────────────────┘   │
  │ ┌──────────────┐ ┌────────────────────┐    │
  │ │ AddToCart     │ │ ImageGallery       │    │
  │ │ (Client)     │ │ (Client)           │    │
  │ │ → onClick    │ │ → Swipe gesture    │    │
  │ │ → useState   │ │ → useState        │    │
  │ └──────────────┘ └────────────────────┘    │
  │ ┌───────────────────────────────────────┐   │
  │ │ Reviews (Server)                       │   │
  │ │ → async data fetch, static display    │   │
  │ │ ┌─────────────────────────────────┐   │   │
  │ │ │ ReviewForm (Client)              │   │   │
  │ │ │ → Form input, submission        │   │   │
  │ │ └─────────────────────────────────┘   │   │
  │ └───────────────────────────────────────┘   │
  └─────────────────────────────────────────────┘
```

```typescript
// Passing data from Server Component to Client Component

// 1. Pass as props (serializable data only)
// Server Component
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);

  return (
    <div>
      <h1>{product.name}</h1>
      {/* Only pass serializable values */}
      <AddToCartButton
        productId={product.id}
        price={product.price}
        inStock={product.stock > 0}
      />
    </div>
  );
}

// 2. Children pattern (pass Server Component into Client Component)
// Client Component
'use client';
function TabPanel({ children, tabs }: { children: React.ReactNode; tabs: string[] }) {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div>
      <div className="flex gap-2">
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}>{tab}</button>
        ))}
      </div>
      {children} {/* Render Server Component children as-is */}
    </div>
  );
}

// Server Component
async function ProductDetailPage() {
  return (
    <TabPanel tabs={['Details', 'Reviews', 'Specifications']}>
      {/* These are executed as Server Components */}
      <ProductDetails />
      <ProductReviews />
      <ProductSpecs />
    </TabPanel>
  );
}

// 3. What cannot be passed
// ✗ Functions (onClick, etc.): not serializable
// ✗ Date objects: must be converted to string/number
// ✗ Map, Set: must be converted to array/object
// ✗ Class instances: must be converted to plain objects
```

---

## 9. Islands Architecture

### 9.1 Islands Concept

```
Islands Architecture:
  → Most of the page is static HTML
  → Only interactive parts are implemented as JavaScript "islands"
  → Each "island" hydrates independently

  Traditional SSR:
  ┌────────────────────────────────────────┐
  │ ████████████████████████████████████████│ ← Entire page is Hydration target
  │ ██ Header ██ Nav █████████████████████ │ ← Not interactive until all JS loads
  │ ██████████████████████████████████████ │
  │ ██ Content ████████████████████████████│
  │ ██████████████████████████████████████ │
  │ ██ Sidebar ███ Footer █████████████████│
  └────────────────────────────────────────┘

  Islands Architecture:
  ┌────────────────────────────────────────┐
  │                      ┌──────────┐     │
  │ Header(HTML)         │ SearchBar│     │ ← Interactive island
  │                      │ (Island) │     │
  │                      └──────────┘     │
  │                                        │
  │ Content (HTML) ─── Static HTML ───────│
  │                                        │
  │           ┌──────────────┐             │
  │           │ ImageCarousel│             │ ← Interactive island
  │           │ (Island)     │             │
  │           └──────────────┘             │
  │                                        │
  │ Footer (HTML) ────────────────────────│
  └────────────────────────────────────────┘

  Advantages:
  ✓ Minimal JS bundle
  ✓ Greatly improved TTI (Time to Interactive)
  ✓ No Hydration needed for static parts
  ✓ Each island loads and executes independently

  Frameworks:
  → Astro (most popular)
  → Fresh (Deno)
  → Eleventy + is-land
```

### 9.2 Islands Implementation with Astro

```astro
---
// src/pages/index.astro
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
import Features from '../components/Features.astro';
// Interactive islands (React components)
import ContactForm from '../components/ContactForm.tsx';
import TestimonialCarousel from '../components/TestimonialCarousel.tsx';
import PricingCalculator from '../components/PricingCalculator.tsx';
---

<Layout title="MyService">
  <!-- Static HTML: no JS -->
  <Hero />

  <!-- Static HTML: no JS -->
  <Features />

  <!-- Island: Hydrates when entering the viewport -->
  <TestimonialCarousel client:visible />

  <!-- Island: Hydrates on page load (important interaction) -->
  <PricingCalculator client:load />

  <!-- Island: Hydrates when browser is idle (low priority) -->
  <ContactForm client:idle />

  <!-- Island: Hydrates based on media query -->
  <MobileMenu client:media="(max-width: 768px)" />
</Layout>
```

```
Astro client directives:

  client:load      → Hydrate immediately on page load
  client:idle      → Hydrate when browser is idle
  client:visible   → Hydrate when entering the viewport
  client:media     → Hydrate when media query matches
  client:only      → Render on client only, no SSR

  Performance impact:
  ┌──────────────┬──────────┬──────────────────────────┐
  │ Directive    │ JS sent  │ Use case                  │
  ├──────────────┼──────────┼──────────────────────────┤
  │ (none)       │ 0KB      │ Static display only       │
  │ client:visible│ Deferred│ Below the fold            │
  │ client:idle  │ Deferred │ Low-priority features     │
  │ client:load  │ Immediate│ Important interactions    │
  │ client:only  │ Immediate│ Features that don't need SSR│
  └──────────────┴──────────┴──────────────────────────┘
```

---

## 10. Partial Hydration and Selective Hydration

### 10.1 React 18 Selective Hydration

```typescript
// React 18 Selective Hydration
// Hydrates independently per Suspense boundary

// Prioritizes hydration of the area the user clicked
import { Suspense } from 'react';

function App() {
  return (
    <div>
      {/* This part hydrates first */}
      <Header />
      <Navigation />

      <main>
        {/* If clicked during Hydration, gets priority */}
        <Suspense fallback={<ProductListSkeleton />}>
          <ProductList />
        </Suspense>

        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      </main>

      {/* Hydrates last */}
      <Suspense fallback={<FooterSkeleton />}>
        <Footer />
      </Suspense>
    </div>
  );
}

// How it works:
// 1. Server sends HTML as a stream
// 2. Each Suspense boundary hydrates independently
// 3. User clicks ProductList
// 4. React prioritizes hydration of ProductList
// 5. Click event is replayed after Hydration completes
```

### 10.2 Qwik Resumability

```
Qwik's approach (alternative to Hydration):

  Traditional Hydration:
  → Render on server
  → Rebuild entire component tree on client
  → Attach event listeners
  → Problem: O(n) processing cost (proportional to component count)

  Qwik Resumability:
  → Render on server
  → Embed references to event handlers in HTML
  → Load code on client only when needed (Lazy loading)
  → Problem: O(1) initial cost

  <!-- Example Qwik HTML output -->
  <button on:click="./chunk-abc.js#handleClick_1">
    Like (0)
  </button>
  <!-- JS is loaded and executed only when the event fires -->

  Comparison:
  ┌──────────┬──────────┬───────────────────────────┐
  │ Approach │ Initial JS│ TTI                        │
  ├──────────┼──────────┼───────────────────────────┤
  │ SPA      │ Full bundle│ After JS load + execute  │
  │ SSR+Hydr │ Full bundle│ After Hydration completes│
  │ Islands  │ Islands only│ After island Hydration  │
  │ Qwik     │ ~1KB     │ Instant (loads on event)  │
  └──────────┴──────────┴───────────────────────────┘
```

---

## 11. Selection Flowchart and Practical Guide

### 11.1 Selection Flowchart

```
Is SEO required?
├── NO → Admin panel / dashboard?
│   ├── YES → SPA (Vite + React)
│   └── NO → Is real-time critical?
│       ├── YES → SPA (WebSocket + React)
│       └── NO → Depends on requirements (SPA or SSR)
└── YES → Is the content dynamic?
    ├── NO → How often is it updated?
    │   ├── Rarely → SSG (Astro / Next.js)
    │   ├── Low → SSG + On-demand Revalidation
    │   └── Moderate → ISR (Next.js, revalidate: 60)
    └── YES → User-specific content?
        ├── YES → SSR + Streaming (Next.js App Router)
        └── NO → Number of pages?
            ├── Few → SSR
            └── Many → ISR + On-demand Revalidation

Content site (blog, docs)?
├── YES → Heavy JS interaction?
│   ├── YES → Next.js SSG/ISR
│   └── NO → Astro (Islands Architecture)
└── NO → Follow flowchart above
```

### 11.2 Hybrid Approach in Practice

```
Real-world best practices:
  → Use hybrid approach within a single app
  → Choose optimal method per page
  → Next.js App Router: combine RSC + ISR + Streaming

Example (E-commerce site):
  / (home)            → SSG (rarely updated)
  /products           → ISR (regenerate every 60 seconds)
  /products/[id]      → ISR + Streaming (product info + reviews)
  /search             → SSR (depends on search query)
  /cart               → CSR (user-specific, no SEO needed)
  /checkout           → SSR (payment flow, security critical)
  /account            → CSR (post-login, no SEO needed)
  /blog               → SSG (Astro, minimal JS)
  /blog/[slug]        → SSG + On-demand Revalidation

Example (SaaS app):
  / (landing page)    → SSG
  /pricing            → SSG + ISR
  /docs               → SSG (Astro / VitePress)
  /login              → CSR
  /dashboard          → CSR (SPA)
  /settings           → CSR (SPA)
  /admin              → CSR (SPA)
  /api/*              → Serverless API

Example (Media site):
  /                   → ISR (regenerate every 5 minutes)
  /category/[slug]    → ISR (every 5 minutes)
  /article/[slug]     → ISR + On-demand (CMS Webhook)
  /author/[slug]      → ISR (every 1 hour)
  /search             → SSR
```

### 11.3 Real-world Performance Comparison

```
Real-world performance comparison (same app, mobile 3G):

  E-commerce product list page (displaying 20 products):
  ┌──────────────┬────────┬────────┬────────┬────────┐
  │ Approach     │ TTFB   │ FCP    │ LCP    │ TTI    │
  ├──────────────┼────────┼────────┼────────┼────────┤
  │ CSR          │ 200ms  │ 4.2s   │ 5.8s   │ 5.8s   │
  │ SSR          │ 800ms  │ 1.2s   │ 2.1s   │ 4.5s   │
  │ SSG          │ 100ms  │ 0.8s   │ 1.5s   │ 3.8s   │
  │ ISR          │ 150ms  │ 0.9s   │ 1.6s   │ 3.9s   │
  │ SSR+Streaming│ 300ms  │ 0.9s   │ 1.8s   │ 3.5s   │
  │ RSC          │ 350ms  │ 1.0s   │ 1.9s   │ 2.8s   │
  │ Astro(Islands)│ 100ms │ 0.7s   │ 1.3s   │ 1.5s   │
  └──────────────┴────────┴────────┴────────┴────────┘

  JS bundle size comparison (after gzip):
  ┌──────────────┬──────────────────┐
  │ Approach     │ Initial JS bundle │
  ├──────────────┼──────────────────┤
  │ CSR          │ 185KB            │
  │ SSR          │ 185KB            │
  │ SSG          │ 165KB            │
  │ RSC          │ 95KB             │
  │ Astro        │ 15KB (islands only)│
  │ Qwik         │ 1KB              │
  └──────────────┴──────────────────┘
```

---

## Summary

| Approach | Initial Load | SEO | JS Bundle | Use Cases |
|----------|-------------|-----|-----------|-----------|
| CSR/SPA | Slow | Poor | Large | Admin panels, dashboards |
| MPA | Fast | Good | Minimal | Blogs (htmx) |
| SSR | Fast | Good | Large | E-commerce, social networks |
| SSG | Fastest | Best | Moderate | Blogs, documentation |
| ISR | Fast | Good | Moderate | Product pages, articles |
| Streaming | Fast | Good | Moderate | Complex pages |
| RSC | Fast | Good | Small | Hybrid (Next.js) |
| Islands | Fast | Good | Minimal | Content sites (Astro) |
| Qwik | Fastest | Good | Tiny | Performance-critical |

---

## FAQ

### Q1. Which should I choose: SPA, MPA, or SSR? What are the selection criteria?

**A.** Use the following criteria based on project requirements.

**When to choose SPA (CSR):**
- Admin panels and dashboards (no SEO needed)
- Post-login applications (authentication is a prerequisite)
- High interactivity required (real-time editing, complex UI)
- Examples: Notion, Figma, Gmail

**When to choose MPA (traditional):**
- SEO is the top priority and want to minimize JavaScript dependency
- Mostly static content (blogs, documentation)
- Lightweight interactions with htmx are sufficient
- Examples: Corporate sites, blogs (htmx + Go/Rails)

**When to choose SSR (Next.js App Router, etc.):**
- Both SEO and interactivity are required
- Display different content per user (personalization)
- E-commerce sites, social networks, news sites
- Examples: Vercel official site, e-commerce sites

**When to choose SSG (Next.js / Astro):**
- Static content with low update frequency
- Fastest initial load needed
- Documentation, blogs, landing pages
- Examples: Technical blogs (Astro), documentation sites (VitePress)

**When to choose Hybrid (mixed SSR + SSG + CSR):**
- Large applications with multiple mixed requirements
- Optimize per page within a single app using Next.js App Router
- Examples: E-commerce (home=SSG, product page=ISR, cart=CSR, search=SSR)

### Q2. What is the difference between Next.js App Router and Pages Router? Which should I use?

**A.** **For new projects after 2024, App Router is recommended.** However, migrate existing projects gradually.

**App Router advantages:**
- Reduced bundle size via React Server Components (RSC)
- Improved TTFB via Streaming SSR
- Standardized layout sharing (layout.tsx)
- Simplified form handling via Server Actions
- Advanced routing such as Parallel Routes / Intercepting Routes

**Pages Router advantages:**
- Stability (mature technology, abundant case studies)
- Lower learning cost (familiar to traditional React developers)
- Some libraries still don't support App Router

**Migration decision criteria:**
- New project → App Router
- Existing project (small to medium) → Gradually migrate to App Router
- Existing project (large, stable production) → Staying on Pages Router is also an option

### Q3. How do I choose between SSG and ISR?

**A.** Decide based on the trade-off between data update frequency and build time.

**When to choose SSG (Static Site Generation):**
- Data updates very infrequently (once a month or less)
- Few pages (under 100)
- Build time is within acceptable range (within a few minutes)
- Examples: Corporate sites, documentation, small blogs

**When to choose ISR (Incremental Static Regeneration):**
- Data is updated regularly (every few minutes to hours)
- Many pages (thousands to tens of thousands)
- Want to reduce build time
- Examples: Large e-commerce product pages, news sites

**Next.js implementation example:**

```typescript
// SSG: generate all pages at build time
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => ({ slug: post.slug }));
}

// ISR: regenerate every 60 seconds + On-demand Revalidation
export const revalidate = 60;

export default async function Page({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  return <Article post={post} />;
}

// On-demand Revalidation (called from CMS webhook)
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const { path } = await request.json();
  revalidatePath(path);
  return Response.json({ revalidated: true });
}
```

**ISR notes:**
- First request returns the built page (Stale)
- Regenerates in the background
- When regeneration fails, continues to return the old page (safe fallback)

---

## FAQ (Frequently Asked Questions)

### Q1: What are the selection criteria for SPA, MPA, and SSR?

**A:** Select based on project requirements using the following criteria.

| Requirement | Recommended | Reason |
|-------------|-------------|--------|
| SEO is critical (blogs, e-commerce) | SSG / ISR | Optimize crawlers with static HTML, fastest LCP |
| SEO needed + dynamic content (social, news) | SSR / RSC | Generate initial HTML with server rendering |
| No SEO + high interactivity (admin panel) | SPA (CSR) | Fast page transitions on the client side |
| Content sites (docs, marketing) | Islands (Astro) | Maximize performance with minimal JS |
| Hybrid requirements (entire e-commerce site) | Next.js App Router | Mix SSG/ISR/SSR/CSR per page |

In practice, a **hybrid approach** using frameworks like Next.js App Router to combine optimal methods per route is the modern standard.

### Q2: What is the difference between Next.js App Router and Pages Router?

**A:** App Router (Next.js 13+) is a new architecture based on React Server Components.

| Aspect | App Router | Pages Router |
|--------|-----------|--------------|
| Rendering | Server Components by default | Client Components by default |
| Layout | Defined hierarchically with layout.tsx | Shared across all pages via _app.tsx |
| Data fetching | Write async/await directly | getServerSideProps / getStaticProps |
| Routing | Directory-based (app/) | File-based (pages/) |
| Streaming | Native support (Suspense) | Manual implementation |
| Bundle size | Can be greatly reduced with Server Components | All included in client bundle |

**Recommendation:** New projects should adopt App Router and take full advantage of Server Components. Pages Router is in maintenance mode for existing projects.

### Q3: How do I choose between SSG and ISR?

**A:** Decide based on data update frequency and page count.

**When SSG (Static Site Generation) is suitable:**
- All pages can be pre-generated at build time (limited page count)
- Content is mostly static (blog articles, documentation, landing pages)
- Updates can be handled by redeployment
- Examples: Personal blog (50 articles), corporate site (20 pages)

```typescript
// app/blog/[slug]/page.tsx (Next.js App Router)
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => ({ slug: post.slug }));
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  return <Article post={post} />;
}
```

**When ISR (Incremental Static Regeneration) is suitable:**
- Enormous number of pages (thousands to tens of thousands)
- Content is regularly updated (product info, articles)
- Want to integrate with CMS updates via On-demand Revalidation
- Examples: E-commerce product pages (100,000 items), media sites (10,000 articles)

```typescript
// app/products/[id]/page.tsx
export const revalidate = 3600; // regenerate every 1 hour

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  return <ProductDetail product={product} />;
}
```

**Hybrid strategy:**
- Top 100 popular products → SSG (generated at build time)
- Other products → ISR (generated on first access, revalidated every 1 hour)
- On CMS update → On-demand Revalidation (instant reflection via webhook)

---

## Next Guides to Read


---

## References

1. Vercel. "Rendering Fundamentals." nextjs.org/docs, 2024.
2. patterns.dev. "Rendering Patterns." patterns.dev, 2024.
3. web.dev. "Rendering on the Web." web.dev, 2024.
4. Astro. "Why Astro?" docs.astro.build, 2024.
5. React. "Server Components." react.dev, 2024.
6. Builder.io. "Qwik: Resumable Framework." qwik.dev, 2024.
7. htmx. "htmx - high power tools for HTML." htmx.org, 2024.
8. Jason Miller. "Islands Architecture." jasonformat.com, 2020.
9. Dan Abramov. "The Two Reacts." overreacted.io, 2023.
10. Ryan Carniato. "The Future of Rendering." dev.to, 2023.
