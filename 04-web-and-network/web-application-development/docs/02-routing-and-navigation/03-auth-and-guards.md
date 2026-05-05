# Authentication Guards

> Authentication guards are the gatekeepers protecting the entry points of your application. Master the design and implementation of secure, user-friendly authentication flows — covering route protection, role-based access control, redirects, and session management.

## What You Will Learn

- [ ] Understand route protection patterns and their implementation
- [ ] Grasp the design of role-based access control (RBAC)
- [ ] Learn authentication checks with Next.js Middleware
- [ ] Understand guard implementation in React Router / Vue Router / Angular Router
- [ ] Learn the concepts of attribute-based access control (ABAC)
- [ ] Understand session management and token refresh strategies
- [ ] Learn multi-factor authentication (MFA) flow integration
- [ ] Implement authentication guards for OAuth / OpenID Connect integration
- [ ] Master testing techniques for authentication guards
- [ ] Understand security best practices and anti-patterns

---

## 1. Route Protection Patterns

### 1.1 Overall Architecture of Authentication Guards

Authentication guards verify that users have the appropriate authentication and authorization state when accessing resources within an application. In modern web applications, it is recommended to apply access control progressively across multiple layers.

```
Three Layers of Authentication Guards:

  ① Middleware (Front Line):
     → Checks before requests reach the application
     → Redirects at the earliest possible stage
     → Next.js middleware.ts
     → Runs server-side
     → Network-level protection

  ② Layout (Layout Layer):
     → Session verification in Server Components
     → Protects entire areas requiring authentication
     → Controls shared UI (sidebar, navigation)
     → Protection at the page group level

  ③ Page / Component (Page Layer):
     → Permission checks on individual pages
     → Fine-grained access control
     → Show/hide buttons and menus
     → Integration with feature flags

Recommended Design:
  → Middleware: Coarse-grained route protection (/app/* requires authentication)
  → Layout: Layout for authenticated areas + role verification
  → Component: Fine-grained control such as show/hide buttons
```

### 1.2 Classification of Protection Patterns

Authentication guard patterns can be classified along several axes.

```
[Classification of Authentication Patterns]

1. Redirect Type (Most Common)
   ├── Unauthenticated → Redirect to login page
   ├── Authenticated → Redirect to callbackUrl
   └── Insufficient permissions → 403 page or dashboard

2. Block Type (For APIs)
   ├── Unauthenticated → 401 Unauthorized
   ├── Insufficient permissions → 403 Forbidden
   └── Token expired → 401 + WWW-Authenticate header

3. Conditional Display Type (For UI)
   ├── Switch UI based on authentication state
   ├── Show/hide features based on role
   └── Graceful degradation

4. Progressive Type (Stepped Authentication)
   ├── Basic browsing → No authentication required
   ├── Interaction → Authentication required
   └── High-security operations → Re-authentication + MFA
```

### 1.3 Client-Side Guards vs. Server-Side Guards

```typescript
// ============================================
// Client-Side Guard (React example)
// ============================================

// ⚠️ Client-side-only protection is insufficient.
// It can be used to control UI visibility,
// but must NOT be the final line of security defense.

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null; // Redirecting
  }

  return <>{children}</>;
}

// ============================================
// Server-Side Guard (Next.js example)
// ============================================

// ✅ Server-side protection is recommended.
// Perform authentication checks in API routes and Server Components.

// app/(protected)/layout.tsx
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  return <>{children}</>;
}
```

### 1.4 The Principle of Defense in Depth

The most important principle in authentication guards is "defense in depth." The design must ensure that even if one layer is breached, other layers continue to provide protection.

```typescript
// ============================================
// Defense in Depth Implementation Example
// ============================================

// Layer 1: Middleware (Network Level)
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('session-token')?.value;
  if (!token && isProtectedRoute(request.nextUrl.pathname)) {
    return redirectToLogin(request);
  }
  // Basic token validation (signature check, etc.)
  if (token && !isValidTokenFormat(token)) {
    return redirectToLogin(request);
  }
  return NextResponse.next();
}

// Layer 2: Server Component (Application Level)
// app/(app)/layout.tsx
export default async function AppLayout({ children }) {
  const session = await getSession(); // Full validation including DB queries
  if (!session || session.isExpired) {
    redirect('/login');
  }
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

// Layer 3: API Route (Data Access Level)
// app/api/users/route.ts
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPermission(session.user.role, 'users:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const users = await db.users.findMany();
  return NextResponse.json(users);
}

// Layer 4: Database Level (RLS: Row-Level Security)
// Supabase example
// CREATE POLICY "Users can only read their own data"
// ON users FOR SELECT
// USING (auth.uid() = user_id);
```

---

## 2. Authentication Guards with Next.js Middleware

### 2.1 Basic Middleware Implementation

```typescript
// middleware.ts (project root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that do not require authentication
const publicPaths = ['/', '/login', '/register', '/about', '/pricing'];

// Public API endpoints
const publicApiPaths = ['/api/public', '/api/health', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (publicPaths.some(path => pathname === path)) {
    return NextResponse.next();
  }

  // Skip public API paths
  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Skip static files
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check session token
  const token = request.cookies.get('session-token')?.value;

  if (!token) {
    // Return 401 for API requests
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Redirect to login for page requests
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 2.2 Advanced Middleware Patterns

```typescript
// middleware.ts — Advanced authentication guard
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Type definition for route configuration
interface RouteConfig {
  pattern: RegExp;
  requireAuth: boolean;
  requiredRoles?: string[];
  rateLimit?: { max: number; windowMs: number };
}

// Route configuration
const routeConfigs: RouteConfig[] = [
  // Public routes
  { pattern: /^\/$/, requireAuth: false },
  { pattern: /^\/(login|register|forgot-password)$/, requireAuth: false },
  { pattern: /^\/api\/public\//, requireAuth: false },
  { pattern: /^\/api\/auth\//, requireAuth: false },
  { pattern: /^\/api\/webhooks\//, requireAuth: false },

  // Routes requiring authentication
  { pattern: /^\/dashboard/, requireAuth: true },
  { pattern: /^\/settings/, requireAuth: true },
  { pattern: /^\/api\//, requireAuth: true },

  // Admin-only routes
  { pattern: /^\/admin/, requireAuth: true, requiredRoles: ['admin'] },
  { pattern: /^\/api\/admin\//, requireAuth: true, requiredRoles: ['admin'] },

  // Routes for editor and above
  {
    pattern: /^\/content\/(create|edit)/,
    requireAuth: true,
    requiredRoles: ['editor', 'admin'],
  },
];

// JWT verification
async function verifyToken(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return payload as { sub: string; role: string; exp: number };
  } catch {
    return null;
  }
}

// Find route configuration
function findRouteConfig(pathname: string): RouteConfig | undefined {
  return routeConfigs.find(config => config.pattern.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // Get route configuration
  const routeConfig = findRouteConfig(pathname);

  // If no configuration found, require authentication by default
  if (!routeConfig) {
    const token = request.cookies.get('session-token')?.value;
    if (!token) {
      return redirectToLogin(request, pathname);
    }
    return NextResponse.next();
  }

  // Public routes
  if (!routeConfig.requireAuth) {
    // If an authenticated user accesses the login page
    const token = request.cookies.get('session-token')?.value;
    if (token && (pathname === '/login' || pathname === '/register')) {
      const payload = await verifyToken(token);
      if (payload) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    return NextResponse.next();
  }

  // Authentication check
  const token = request.cookies.get('session-token')?.value;
  if (!token) {
    return redirectToLogin(request, pathname);
  }

  // Token verification
  const payload = await verifyToken(token);
  if (!payload) {
    // Invalid token → delete cookie and redirect to login
    const response = redirectToLogin(request, pathname);
    response.cookies.delete('session-token');
    return response;
  }

  // Token expiry check (refresh if less than 5 minutes remain)
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp - now < 300) {
    // Add token refresh header
    const response = NextResponse.next();
    response.headers.set('X-Token-Refresh', 'true');
    return response;
  }

  // Role-based access check
  if (routeConfig.requiredRoles && routeConfig.requiredRoles.length > 0) {
    if (!routeConfig.requiredRoles.includes(payload.role)) {
      // Return 403 for API requests
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      // Redirect to 403 page for page requests
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }

  // Add user information to request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-User-Id', payload.sub);
  requestHeaders.set('X-User-Role', payload.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Helper to redirect to the login page
function redirectToLogin(request: NextRequest, callbackUrl: string) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', callbackUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 2.3 Chaining Middleware

Chaining multiple middleware functions in sequence is an effective way to separate concerns.

```typescript
// lib/middleware/chain.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type MiddlewareFunction = (
  request: NextRequest,
  response: NextResponse
) => Promise<NextResponse | null>;

// Build a middleware chain
export function createMiddlewareChain(...middlewares: MiddlewareFunction[]) {
  return async function chainedMiddleware(request: NextRequest) {
    let response = NextResponse.next();

    for (const middleware of middlewares) {
      const result = await middleware(request, response);
      if (result) {
        // Break the chain for redirects or early responses
        if (result.status === 301 || result.status === 302 || result.status === 401 || result.status === 403) {
          return result;
        }
        response = result;
      }
    }

    return response;
  };
}

// lib/middleware/auth.ts
export async function authMiddleware(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse | null> {
  const token = request.cookies.get('session-token')?.value;

  if (!token && isProtectedRoute(request.nextUrl.pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return null; // Continue chain
}

// lib/middleware/rateLimit.ts
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

export async function rateLimitMiddleware(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return null;
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;

  const current = rateLimitMap.get(ip);
  if (current && now - current.timestamp < windowMs) {
    if (current.count >= maxRequests) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
    current.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
  }

  return null;
}

// lib/middleware/logging.ts
export async function loggingMiddleware(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse | null> {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.nextUrl.pathname}`);

  // Add request ID to response headers
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-Id', requestId);

  return null;
}

// middleware.ts — Using the chain
import { createMiddlewareChain } from './lib/middleware/chain';
import { authMiddleware } from './lib/middleware/auth';
import { rateLimitMiddleware } from './lib/middleware/rateLimit';
import { loggingMiddleware } from './lib/middleware/logging';

export default createMiddlewareChain(
  loggingMiddleware,
  rateLimitMiddleware,
  authMiddleware
);
```

### 2.4 Integration with NextAuth.js (Auth.js)

```typescript
// middleware.ts — Integration with NextAuth.js v5
import { auth } from './auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      return Response.redirect(new URL('/login', req.url));
    }
    if (req.auth?.user?.role !== 'admin') {
      return Response.redirect(new URL('/403', req.url));
    }
  }

  // Protect authenticated areas
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/settings')) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return Response.redirect(loginUrl);
    }
  }

  // Prevent authenticated users from accessing auth pages
  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return Response.redirect(new URL('/dashboard', req.url));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

// auth.ts — NextAuth.js v5 configuration
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.hashedPassword) {
          throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );

        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = request.nextUrl.pathname.startsWith('/dashboard');
      if (isOnDashboard) return isLoggedIn;
      return true;
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
    newUser: '/onboarding',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
```

---

## 3. Authentication Guards in Layouts

### 3.1 Authentication Checks with Server Components

```typescript
// app/(app)/layout.tsx — Layout for authenticated areas
import { redirect } from 'next/navigation';
import { getSession } from '@/shared/lib/auth';
import { SessionProvider } from '@/shared/providers/SessionProvider';
import { Sidebar } from '@/shared/components/Sidebar';
import { Header } from '@/shared/components/Header';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Check session expiry
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    redirect('/login?reason=session_expired');
  }

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen">
        <Sidebar user={session.user} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header user={session.user} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}

// app/(app)/admin/layout.tsx — Admin-only area
import { redirect } from 'next/navigation';
import { getSession } from '@/shared/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/dashboard'); // Redirect to dashboard on insufficient permissions
  }

  return (
    <div className="admin-layout">
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
        Admin Mode — Please proceed with caution
      </div>
      {children}
    </div>
  );
}
```

### 3.2 Progressive Protection with Nested Layouts

```typescript
// ============================================
// Example of stepped authentication with nested layouts
// ============================================

// app/(marketing)/layout.tsx — Public area (no authentication required)
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-layout">
      <PublicNavbar />
      {children}
      <Footer />
    </div>
  );
}

// app/(app)/layout.tsx — Authenticated area (login required)
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <SessionProvider session={session}>
      <AppShell user={session.user}>
        {children}
      </AppShell>
    </SessionProvider>
  );
}

// app/(app)/settings/layout.tsx — Settings area (verified email required)
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user.emailVerified) {
    redirect('/verify-email?reason=settings_access');
  }

  return (
    <div className="max-w-4xl mx-auto">
      <SettingsNav />
      {children}
    </div>
  );
}

// app/(app)/settings/billing/layout.tsx — Billing settings (additional auth required)
export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Billing operations require authentication within the last 10 minutes
  const lastAuthAt = session?.user.lastAuthenticatedAt;
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  if (!lastAuthAt || new Date(lastAuthAt) < tenMinutesAgo) {
    redirect('/reauth?reason=billing_access&callbackUrl=/settings/billing');
  }

  return <>{children}</>;
}
```

### 3.3 Implementing SessionProvider

```typescript
// shared/providers/SessionProvider.tsx
'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';

// Session type definition
interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    image?: string;
    emailVerified?: boolean;
    lastAuthenticatedAt?: string;
  };
  expiresAt: string;
}

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  update: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({
  session: initialSession,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Auto-refresh session every 15 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          setSession(data.session);
        } else if (res.status === 401) {
          setSession(null);
          router.push('/login?reason=session_expired');
        }
      } catch (error) {
        console.error('Session refresh failed:', error);
      }
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [router]);

  // Check session on window focus
  useEffect(() => {
    const handleFocus = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          setSession(data.session);
        } else if (res.status === 401) {
          setSession(null);
          router.push('/login?reason=session_expired');
        }
      } catch (error) {
        console.error('Session check on focus failed:', error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [router]);

  // Update session
  const update = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/session', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        startTransition(() => {
          router.refresh();
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Sign out
  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      setSession(null);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return (
    <SessionContext.Provider value={{ session, isLoading: isLoading || isPending, update, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

// Custom hook
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

// Custom hook requiring authentication
export function useRequireAuth() {
  const { session, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/login');
    }
  }, [session, isLoading, router]);

  return { session, isLoading };
}
```

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Designing the Permission Model

```typescript
// ============================================
// Comprehensive RBAC Design
// ============================================

// Basic type definitions
type Role = 'viewer' | 'user' | 'editor' | 'moderator' | 'admin' | 'superadmin';

type Resource = 'users' | 'posts' | 'comments' | 'orders' | 'products' | 'settings' | 'analytics' | 'billing';

type Action = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'moderate' | 'export';

// Define Permission as a string literal type
type Permission = `${Resource}:${Action}`;

// Role hierarchy definition
const roleHierarchy: Record<Role, Role[]> = {
  viewer: [],
  user: ['viewer'],
  editor: ['user', 'viewer'],
  moderator: ['user', 'viewer'],
  admin: ['editor', 'moderator', 'user', 'viewer'],
  superadmin: ['admin', 'editor', 'moderator', 'user', 'viewer'],
};

// Direct permissions per role (excluding inherited permissions)
const directPermissions: Record<Role, Permission[]> = {
  viewer: [
    'posts:read',
    'comments:read',
    'products:read',
  ],
  user: [
    'posts:create',
    'comments:create',
    'orders:create',
    'orders:read',
  ],
  editor: [
    'posts:update',
    'posts:publish',
    'posts:delete',
    'comments:update',
    'products:create',
    'products:update',
  ],
  moderator: [
    'comments:moderate',
    'comments:delete',
    'users:read',
  ],
  admin: [
    'users:create',
    'users:update',
    'users:delete',
    'products:delete',
    'orders:update',
    'orders:delete',
    'settings:read',
    'settings:update',
    'analytics:read',
    'analytics:export',
  ],
  superadmin: [
    'billing:read',
    'billing:update',
    'settings:delete',
  ],
};

// Get all permissions (including inherited)
function getAllPermissions(role: Role): Permission[] {
  const direct = directPermissions[role] || [];
  const inherited = roleHierarchy[role]
    .flatMap(parentRole => getAllPermissions(parentRole));

  return [...new Set([...direct, ...inherited])];
}

// Permission check
function hasPermission(role: Role, permission: Permission): boolean {
  return getAllPermissions(role).includes(permission);
}

// Check multiple permissions (AND condition)
function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  const userPermissions = getAllPermissions(role);
  return permissions.every(p => userPermissions.includes(p));
}

// Check multiple permissions (OR condition)
function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  const userPermissions = getAllPermissions(role);
  return permissions.some(p => userPermissions.includes(p));
}

// Usage examples
console.log(hasPermission('editor', 'posts:publish'));  // true
console.log(hasPermission('editor', 'users:delete'));   // false
console.log(hasPermission('admin', 'posts:publish'));   // true (inherited from editor)
console.log(hasAllPermissions('admin', ['users:create', 'users:delete'])); // true
```

### 4.2 RBAC Implementation in React Components

```typescript
// ============================================
// Permission Check Components
// ============================================

// components/auth/RequirePermission.tsx
'use client';

import { useSession } from '@/shared/providers/SessionProvider';

interface RequirePermissionProps {
  permission: Permission | Permission[];
  mode?: 'all' | 'any'; // all: AND condition, any: OR condition
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showDisabled?: boolean; // If true, render as disabled instead of hiding
}

export function RequirePermission({
  permission,
  mode = 'all',
  children,
  fallback = null,
  showDisabled = false,
}: RequirePermissionProps) {
  const { session } = useSession();

  if (!session) return fallback;

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = mode === 'all'
    ? hasAllPermissions(session.user.role as Role, permissions)
    : hasAnyPermission(session.user.role as Role, permissions);

  if (!hasAccess) {
    if (showDisabled) {
      return (
        <div className="opacity-50 cursor-not-allowed pointer-events-none">
          {children}
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// components/auth/RequireRole.tsx
export function RequireRole({
  role,
  children,
  fallback = null,
}: {
  role: Role | Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { session } = useSession();

  if (!session) return fallback;

  const roles = Array.isArray(role) ? role : [role];
  const userRole = session.user.role as Role;

  // Check with role hierarchy in mind
  const hasRole = roles.some(r => {
    if (r === userRole) return true;
    // Check if the user's role inherits the required role
    return roleHierarchy[userRole]?.includes(r) ?? false;
  });

  if (!hasRole) return <>{fallback}</>;

  return <>{children}</>;
}

// ============================================
// Usage examples
// ============================================

function UserManagementPage() {
  const { session } = useSession();

  return (
    <div>
      <h1>User Management</h1>

      {/* Show the create user button only for admins */}
      <RequirePermission permission="users:create">
        <Button onClick={handleCreateUser}>
          Create New User
        </Button>
      </RequirePermission>

      {/* User list (requires read permission) */}
      <RequirePermission
        permission="users:read"
        fallback={<Alert>You do not have permission to view the user list</Alert>}
      >
        <UserTable>
          {users.map(user => (
            <UserRow key={user.id} user={user}>
              {/* Edit button: render as disabled if no permission */}
              <RequirePermission
                permission="users:update"
                showDisabled
              >
                <EditButton userId={user.id} />
              </RequirePermission>

              {/* Delete button: render with tooltip if no permission */}
              <RequirePermission
                permission="users:delete"
                fallback={
                  <Tooltip content="You do not have delete permission">
                    <DeleteButton disabled userId={user.id} />
                  </Tooltip>
                }
              >
                <DeleteButton userId={user.id} />
              </RequirePermission>

            </UserRow>
          ))}
        </UserTable>
      </RequirePermission>

      {/* Combining multiple permissions */}
      <RequirePermission
        permission={['analytics:read', 'analytics:export']}
        mode="all"
      >
        <AnalyticsDashboard />
      </RequirePermission>
    </div>
  );
}
```

### 4.3 Server-Side RBAC Implementation

```typescript
// ============================================
// Permission Checks in API Routes
// ============================================

// lib/auth/withPermission.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

type ApiHandler = (
  request: NextRequest,
  context: { params: Record<string, string>; session: Session }
) => Promise<NextResponse>;

// Higher-Order Function for permission checks
export function withPermission(
  permission: Permission | Permission[],
  handler: ApiHandler,
  mode: 'all' | 'any' = 'all'
) {
  return async (
    request: NextRequest,
    context: { params: Record<string, string> }
  ) => {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    const userRole = session.user.role as Role;

    const hasAccess = mode === 'all'
      ? hasAllPermissions(userRole, permissions)
      : hasAnyPermission(userRole, permissions);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          required: permissions,
          userRole: userRole,
        },
        { status: 403 }
      );
    }

    return handler(request, { ...context, session });
  };
}

// Usage: API route
// app/api/users/route.ts
import { withPermission } from '@/lib/auth/withPermission';

export const GET = withPermission('users:read', async (request, { session }) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
});

export const POST = withPermission('users:create', async (request, { session }) => {
  const body = await request.json();

  // Audit log
  await auditLog({
    action: 'users:create',
    actorId: session.user.id,
    details: { email: body.email },
  });

  const user = await prisma.user.create({
    data: body,
  });

  return NextResponse.json({ user }, { status: 201 });
});

export const DELETE = withPermission(
  ['users:delete', 'admin:access'],
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: userId! } });

    return NextResponse.json({ success: true });
  },
  'all'
);
```

---

## 5. Attribute-Based Access Control (ABAC)

### 5.1 ABAC Concepts and Differences from RBAC

While RBAC controls access based on roles, ABAC achieves more flexible access control based on attributes. Policies can be defined by combining user attributes, resource attributes, and environmental conditions.

```
[RBAC vs. ABAC Comparison]

RBAC:
  Basis = User role
  Example: "Admin role can delete users"
  Pros: Simple, easy to understand
  Cons: Hard to handle complex conditions

ABAC:
  Basis = User attributes + Resource attributes + Environmental conditions
  Example: "Department managers can only edit users in their own department,
            but only during business hours"
  Pros: Very flexible, fine-grained control
  Cons: Can become complex, hard to debug

Hybrid (Recommended):
  Coarse-grained control with RBAC + fine-grained conditions added with ABAC
  Example: "editor role" AND "resource owner" AND "before publication"
```

### 5.2 Implementing ABAC

```typescript
// ============================================
// ABAC (Attribute-Based Access Control) Implementation
// ============================================

// Attribute type definitions
interface UserAttributes {
  id: string;
  role: Role;
  department: string;
  location: string;
  clearanceLevel: number;
  isActive: boolean;
}

interface ResourceAttributes {
  ownerId: string;
  department: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'secret';
  status: 'draft' | 'review' | 'published' | 'archived';
  createdAt: Date;
}

interface EnvironmentAttributes {
  currentTime: Date;
  ipAddress: string;
  isBusinessHours: boolean;
  isVpnConnected: boolean;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

// Policy type definition
interface Policy {
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  condition: (
    user: UserAttributes,
    resource: ResourceAttributes,
    environment: EnvironmentAttributes,
    action: string
  ) => boolean;
}

// Policy engine
class PolicyEngine {
  private policies: Policy[] = [];

  addPolicy(policy: Policy): void {
    this.policies.push(policy);
  }

  evaluate(
    user: UserAttributes,
    resource: ResourceAttributes,
    environment: EnvironmentAttributes,
    action: string
  ): { allowed: boolean; matchedPolicies: string[] } {
    const matchedPolicies: string[] = [];
    let hasExplicitDeny = false;
    let hasExplicitAllow = false;

    for (const policy of this.policies) {
      if (policy.condition(user, resource, environment, action)) {
        matchedPolicies.push(policy.name);
        if (policy.effect === 'deny') {
          hasExplicitDeny = true;
        } else {
          hasExplicitAllow = true;
        }
      }
    }

    // Deny always takes priority over Allow (Deny-Override)
    return {
      allowed: hasExplicitAllow && !hasExplicitDeny,
      matchedPolicies,
    };
  }
}

// Example policy definitions
const policyEngine = new PolicyEngine();

// Policy 1: Owners can edit their own resources
policyEngine.addPolicy({
  name: 'owner-can-edit',
  description: 'Owners can edit their own resources',
  effect: 'allow',
  condition: (user, resource, env, action) => {
    return action === 'update' && resource.ownerId === user.id;
  },
});

// Policy 2: Managers in the same department can view resources
policyEngine.addPolicy({
  name: 'department-manager-read',
  description: 'Managers in the same department can view resources',
  effect: 'allow',
  condition: (user, resource, env, action) => {
    return (
      action === 'read' &&
      user.role === 'admin' &&
      user.department === resource.department
    );
  },
});

// Policy 3: Confidential data is only accessible during business hours and with VPN
policyEngine.addPolicy({
  name: 'confidential-business-hours-vpn',
  description: 'Confidential data is only accessible during business hours and with VPN',
  effect: 'deny',
  condition: (user, resource, env, action) => {
    return (
      resource.sensitivity === 'confidential' &&
      (!env.isBusinessHours || !env.isVpnConnected)
    );
  },
});

// Policy 4: Archived resources cannot be deleted
policyEngine.addPolicy({
  name: 'no-delete-archived',
  description: 'Archived resources cannot be deleted',
  effect: 'deny',
  condition: (user, resource, env, action) => {
    return action === 'delete' && resource.status === 'archived';
  },
});

// Policy 5: Access control based on clearance level
policyEngine.addPolicy({
  name: 'clearance-level-access',
  description: 'Access based on clearance level',
  effect: 'allow',
  condition: (user, resource, env, action) => {
    const sensitivityLevels = {
      public: 0,
      internal: 1,
      confidential: 2,
      secret: 3,
    };
    return user.clearanceLevel >= sensitivityLevels[resource.sensitivity];
  },
});

// Usage example
const result = policyEngine.evaluate(
  {
    id: 'user-1',
    role: 'editor',
    department: 'engineering',
    location: 'tokyo',
    clearanceLevel: 2,
    isActive: true,
  },
  {
    ownerId: 'user-1',
    department: 'engineering',
    sensitivity: 'confidential',
    status: 'draft',
    createdAt: new Date(),
  },
  {
    currentTime: new Date(),
    ipAddress: '192.168.1.1',
    isBusinessHours: true,
    isVpnConnected: true,
    deviceType: 'desktop',
  },
  'update'
);

console.log(result);
// { allowed: true, matchedPolicies: ['owner-can-edit', 'clearance-level-access'] }
```

### 5.3 Hybrid RBAC and ABAC Implementation

```typescript
// ============================================
// Hybrid Access Control
// ============================================

interface AccessDecision {
  allowed: boolean;
  reason: string;
  requiredActions?: string[];
}

class HybridAccessControl {
  // Step 1: Check baseline permissions with RBAC
  private checkRBAC(role: Role, permission: Permission): boolean {
    return hasPermission(role, permission);
  }

  // Step 2: Check additional conditions with ABAC
  private checkABAC(
    user: UserAttributes,
    resource: ResourceAttributes,
    environment: EnvironmentAttributes,
    action: string
  ): { allowed: boolean; matchedPolicies: string[] } {
    return policyEngine.evaluate(user, resource, environment, action);
  }

  // Integrated permission check
  authorize(
    user: UserAttributes,
    resource: ResourceAttributes,
    environment: EnvironmentAttributes,
    permission: Permission,
    action: string
  ): AccessDecision {
    // Step 1: RBAC check
    if (!this.checkRBAC(user.role, permission)) {
      return {
        allowed: false,
        reason: `Role '${user.role}' does not have permission '${permission}'`,
      };
    }

    // Step 2: ABAC check
    const abacResult = this.checkABAC(user, resource, environment, action);
    if (!abacResult.allowed) {
      return {
        allowed: false,
        reason: `ABAC policy denied: ${abacResult.matchedPolicies.join(', ')}`,
      };
    }

    // Step 3: Active user check
    if (!user.isActive) {
      return {
        allowed: false,
        reason: 'User account is deactivated',
      };
    }

    return {
      allowed: true,
      reason: 'Access granted',
    };
  }
}

// Usage in API routes
const accessControl = new HybridAccessControl();

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const resource = await getResource(body.resourceId);

  const decision = accessControl.authorize(
    session.user as UserAttributes,
    resource as ResourceAttributes,
    {
      currentTime: new Date(),
      ipAddress: request.headers.get('x-forwarded-for') || '',
      isBusinessHours: checkBusinessHours(),
      isVpnConnected: checkVpnConnection(request),
      deviceType: detectDeviceType(request),
    },
    'posts:update',
    'update'
  );

  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason },
      { status: 403 }
    );
  }

  // Update processing...
  const updated = await updateResource(body);
  return NextResponse.json({ data: updated });
}
```

---

## 6. Authentication Flows

### 6.1 Login / Logout Flow

```typescript
// ============================================
// Login Flow — Server Actions
// ============================================

// app/login/page.tsx
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string; reason?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Sign In</h2>
          {searchParams.reason === 'session_expired' && (
            <p className="mt-2 text-sm text-amber-600">
              Your session has expired. Please sign in again.
            </p>
          )}
          {searchParams.error && (
            <p className="mt-2 text-sm text-red-600">
              {searchParams.error}
            </p>
          )}
        </div>
        <LoginForm callbackUrl={searchParams.callbackUrl} />
      </div>
    </div>
  );
}

// components/auth/LoginForm.tsx
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { login } from '@/actions/auth';
import { useState } from 'react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2 px-4 border border-transparent
                 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600
                 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Signing in...' : 'Sign In'}
    </button>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction] = useFormState(login, { error: null });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl || '/dashboard'} />

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300
                       rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300
                         rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      {state?.error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
          {state.error}
        </div>
      )}

      <SubmitButton />

      <div className="flex items-center justify-between text-sm">
        <a href="/forgot-password" className="text-blue-600 hover:text-blue-500">
          Forgot your password?
        </a>
        <a href="/register" className="text-blue-600 hover:text-blue-500">
          Create an account
        </a>
      </div>
    </form>
  );
}

// actions/auth.ts — Server Actions
'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  callbackUrl: z.string().optional(),
});

export async function login(
  prevState: { error: string | null },
  formData: FormData
) {
  // Validation
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    callbackUrl: formData.get('callbackUrl'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { email, password, callbackUrl } = parsed.data;

  // User lookup
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.hashedPassword) {
    // Timing attack mitigation: apply the same processing time even for non-existent users
    await bcrypt.hash('dummy-password', 12);
    return { error: 'Invalid email address or password' };
  }

  // Password verification
  const isValid = await bcrypt.compare(password, user.hashedPassword);
  if (!isValid) {
    // Record failed login attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: { increment: 1 },
        lastFailedLoginAt: new Date(),
      },
    });

    // Account lock determination
    if (user.failedLoginAttempts >= 4) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
      });
      return { error: 'Your account has been locked. Please try again in 15 minutes.' };
    }

    return { error: 'Invalid email address or password' };
  }

  // Account lock check
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return { error: 'Your account is locked. Please wait a moment and try again.' };
  }

  // Login successful: reset failed attempts
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // Generate JWT token
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const token = await new SignJWT({
    sub: user.id,
    role: user.role,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set('session-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'login',
      ipAddress: '', // Retrieve from Request
      userAgent: '',
    },
  });

  redirect(callbackUrl || '/dashboard');
}

// Logout
export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session-token')?.value;

  if (token) {
    // Add token to blacklist (optional)
    await prisma.revokedToken.create({
      data: {
        token,
        revokedAt: new Date(),
      },
    });
  }

  cookieStore.delete('session-token');
  redirect('/login');
}
```

### 6.2 Session Management

```typescript
// ============================================
// Session Management Utilities
// ============================================

// lib/auth/session.ts
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  image?: string;
  emailVerified?: boolean;
  lastAuthenticatedAt?: string;
}

export interface Session {
  user: SessionUser;
  expiresAt: string;
  issuedAt: string;
}

// Get session
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session-token')?.value;

  if (!token) return null;

  try {
    // JWT verification
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Blacklist check (optional)
    const isRevoked = await prisma.revokedToken.findFirst({
      where: { token },
    });
    if (isRevoked) return null;

    // Retrieve user information from DB (to reflect the latest state)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        emailVerified: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
        image: user.image || undefined,
        emailVerified: !!user.emailVerified,
      },
      expiresAt: new Date((payload.exp || 0) * 1000).toISOString(),
      issuedAt: new Date((payload.iat || 0) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

// Refresh session (sliding window)
export async function refreshSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;

  // Issue a new token
  const token = await new SignJWT({
    sub: session.user.id,
    role: session.user.role,
    email: session.user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set('session-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return getSession();
}

// Delete session
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session-token');
}

// API Route: Session verification
// app/api/auth/session/route.ts
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  return NextResponse.json({ session });
}

export async function POST() {
  const session = await refreshSession();

  if (!session) {
    return NextResponse.json({ error: 'Session refresh failed' }, { status: 401 });
  }

  return NextResponse.json({ session });
}
```

### 6.3 Token Refresh Strategies

```typescript
// ============================================
// Token Refresh Implementation Patterns
// ============================================

// Pattern 1: Automatic refresh via Axios interceptors
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Manage multiple requests during a refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(undefined);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    // Refresh in background if X-Token-Refresh header is present
    if (response.headers['x-token-refresh'] === 'true') {
      refreshToken().catch(console.error);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Add to queue while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await refreshToken();
        processQueue();
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Redirect to login page
        window.location.href = '/login?reason=session_expired';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

async function refreshToken(): Promise<void> {
  const response = await fetch('/api/auth/session', { method: 'POST' });
  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
}

// Pattern 2: Fetch wrapper
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  if (response.status === 401) {
    // Attempt token refresh
    const refreshResponse = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshResponse.ok) {
      // Refresh succeeded: retry the original request
      response = await fetch(url, {
        ...options,
        credentials: 'include',
      });
    } else {
      // Refresh failed: redirect to login
      window.location.href = '/login?reason=session_expired';
    }
  }

  return response;
}
```

---

## 7. Authentication Guards in Other Frameworks

### 7.1 Authentication Guards with React Router v6

```typescript
// ============================================
// React Router v6 Authentication Guards
// ============================================

// auth/AuthContext.tsx
import { createContext, useContext, useState, useCallback } from 'react';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on initial load
  useEffect(() => {
    checkSession().finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Login failed');
    }

    const { user: loggedInUser } = await response.json();
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const { user: sessionUser } = await response.json();
        setUser(sessionUser);
      }
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// auth/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role | Role[];
  requiredPermission?: Permission | Permission[];
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallbackPath = '/login',
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={fallbackPath}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Role check
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user!.role as Role)) {
      return <Navigate to="/403" replace />;
    }
  }

  // Permission check
  if (requiredPermission) {
    const permissions = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];
    const hasAccess = permissions.every(p =>
      hasPermission(user!.role as Role, p)
    );
    if (!hasAccess) {
      return <Navigate to="/403" replace />;
    }
  }

  return <>{children}</>;
}

// Route definitions
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // Public routes
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },

      // Routes requiring authentication
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings/*',
        element: (
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'profile', element: <ProfileSettings /> },
          { path: 'security', element: <SecuritySettings /> },
          {
            path: 'billing',
            element: (
              <ProtectedRoute requiredPermission="billing:read">
                <BillingSettings />
              </ProtectedRoute>
            ),
          },
        ],
      },

      // Admin routes
      {
        path: 'admin/*',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'users', element: <UserManagement /> },
          { path: 'analytics', element: <AdminAnalytics /> },
        ],
      },

      // Error pages
      { path: '403', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
```

### 7.2 Navigation Guards with Vue Router

```typescript
// ============================================
// Vue Router Navigation Guards
// ============================================

// router/index.ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

// Extend route meta types
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiredRoles?: string[];
    requiredPermissions?: string[];
    title?: string;
  }
}

const routes: RouteRecordRaw[] = [
  // Public routes
  {
    path: '/',
    component: () => import('@/layouts/PublicLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/pages/Home.vue') },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/pages/Login.vue'),
        meta: { title: 'Login' },
      },
    ],
  },

  // Routes requiring authentication
  {
    path: '/app',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/Dashboard.vue'),
        meta: { title: 'Dashboard' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/Settings.vue'),
        meta: { title: 'Settings' },
      },
    ],
  },

  // Admin routes
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, requiredRoles: ['admin'] },
    children: [
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/pages/admin/Users.vue'),
        meta: { title: 'User Management', requiredPermissions: ['users:read'] },
      },
    ],
  },

  // 403 page
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/pages/Forbidden.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Global navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Update page title
  document.title = to.meta.title
    ? `${to.meta.title} | MyApp`
    : 'MyApp';

  // Routes that do not require authentication
  if (!to.meta.requiresAuth) {
    // Authenticated user accessing the login page
    if (to.name === 'login' && authStore.isAuthenticated) {
      return next({ name: 'dashboard' });
    }
    return next();
  }

  // If not authenticated
  if (!authStore.isAuthenticated) {
    // Attempt session check
    await authStore.checkSession();

    if (!authStore.isAuthenticated) {
      return next({
        name: 'login',
        query: { redirect: to.fullPath },
      });
    }
  }

  // Role check
  if (to.meta.requiredRoles?.length) {
    const hasRole = to.meta.requiredRoles.includes(authStore.user!.role);
    if (!hasRole) {
      return next({ name: 'forbidden' });
    }
  }

  // Permission check
  if (to.meta.requiredPermissions?.length) {
    const hasAllPermissions = to.meta.requiredPermissions.every(p =>
      authStore.hasPermission(p)
    );
    if (!hasAllPermissions) {
      return next({ name: 'forbidden' });
    }
  }

  next();
});

// Post-navigation hook
router.afterEach((to, from) => {
  // Send analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: to.fullPath,
    });
  }
});

export default router;
```

### 7.3 Angular Router Guards

```typescript
// ============================================
// Angular Router Guards
// ============================================

// auth.guard.ts — Functional Guard (Angular 15+)
import { inject } from '@angular/core';
import { Router, CanActivateFn, CanMatchFn } from '@angular/router';
import { AuthService } from './auth.service';
import { map, tap } from 'rxjs/operators';

// canActivate guard
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated$.pipe(
    tap(isAuthenticated => {
      if (!isAuthenticated) {
        router.navigate(['/login'], {
          queryParams: { returnUrl: state.url },
        });
      }
    })
  );
};

// Role-based guard
export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredRoles = route.data?.['roles'] as string[] | undefined;

  if (!requiredRoles?.length) return true;

  return authService.user$.pipe(
    map(user => {
      if (!user) return false;
      return requiredRoles.includes(user.role);
    }),
    tap(hasRole => {
      if (!hasRole) {
        router.navigate(['/403']);
      }
    })
  );
};

// Permission-based guard
export const permissionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredPermissions = route.data?.['permissions'] as string[] | undefined;

  if (!requiredPermissions?.length) return true;

  return authService.user$.pipe(
    map(user => {
      if (!user) return false;
      return requiredPermissions.every(p => authService.hasPermission(user.role, p));
    }),
    tap(hasPermission => {
      if (!hasPermission) {
        router.navigate(['/403']);
      }
    })
  );
};

// Route definitions
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard, roleGuard, permissionGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    children: [
      {
        path: 'users',
        component: UserManagementComponent,
        canActivate: [permissionGuard],
        data: { permissions: ['users:read'] },
      },
    ],
  },
];
```

---

## 8. Authentication Guard Comparison Tables

### 8.1 Comparison by Framework

| Feature | Next.js | React Router | Vue Router | Angular |
|---------|---------|-------------|------------|---------|
| Guard location | middleware.ts + Layout | ProtectedRoute component | beforeEach hook | canActivate guard |
| Server-side support | Middleware + Server Component | Requires separate handling for SSR | Requires separate handling for SSR | Requires separate handling for SSR |
| Role-based | Custom implementation | Custom implementation | Route meta + guard | Route data + guard |
| Redirect | redirect() / NextResponse.redirect | Navigate component | next({ name: 'login' }) | router.navigate() |
| Lazy load protection | Dynamic import + auth check | React.lazy + ProtectedRoute | Dynamic import + guard | loadChildren + canMatch |
| TypeScript support | Native | Native | RouteMeta extension | Native |

### 8.2 Comparison of Authentication Methods

| Method | Security | UX | Implementation Complexity | Use Case |
|--------|----------|----|--------------------------|----------|
| Session Cookie | High | Good | Low | General web apps |
| JWT (Cookie) | High | Good | Medium | API integration |
| JWT (localStorage) | Low (XSS vulnerable) | Good | Low | Not recommended |
| OAuth 2.0 | High | Good | High | Social login |
| Session + JWT Hybrid | Highest | Good | High | Enterprise |
| Passkey / WebAuthn | Highest | Excellent | High | Next-gen authentication |

### 8.3 Comparison of Token Storage Locations

| Storage | XSS Resistance | CSRF Resistance | Server-side Access | Notes |
|---------|---------------|-----------------|-------------------|-------|
| HttpOnly Cookie | High (inaccessible from JS) | Requires mitigation (SameSite) | Yes | Recommended |
| localStorage | Low (can be stolen via XSS) | High (not auto-sent) | No | Not recommended |
| sessionStorage | Low (can be stolen via XSS) | High (not auto-sent) | No | Tab-scoped only |
| Memory (variable) | Medium (lost on reload) | High | No | For SPAs |
| IndexedDB | Low (can be stolen via XSS) | High | No | For large data |

---

## 9. Multi-Factor Authentication (MFA) Flow Integration

### 9.1 MFA Overview and Integration with Authentication Guards

Multi-Factor Authentication (MFA) significantly enhances security by combining multiple authentication factors: "knowledge," "possession," and "biometrics." To integrate MFA with authentication guards, an additional authentication step must be added to the standard login flow.

```
[MFA Authentication Factors]

1. Knowledge Factor (Something you know)
   ├── Password
   ├── PIN code
   └── Security questions

2. Possession Factor (Something you have)
   ├── TOTP (Google Authenticator, etc.)
   ├── SMS / Email OTP
   ├── Hardware key (YubiKey, etc.)
   └── Push notification

3. Biometric Factor (Something you are)
   ├── Fingerprint authentication
   ├── Face recognition
   └── Iris recognition

[MFA Login Flow]

  1. User logs in with email + password
  2. Password verification succeeds
  3. Check if MFA is enabled
     ├── MFA disabled → Create session → Go to dashboard
     └── MFA enabled → Issue temporary token → Go to MFA verification page
  4. User enters MFA code
  5. MFA code verified
     ├── Success → Create session (with MFA-verified flag)
     └── Failure → Show error (with retry limit)
```

### 9.2 TOTP-Based MFA Implementation

```typescript
// ============================================
// TOTP (Time-based One-Time Password) MFA Implementation
// ============================================

// lib/auth/totp.ts
import { createHmac, randomBytes } from 'crypto';
import { encode as base32Encode, decode as base32Decode } from 'hi-base32';

// Generate TOTP secret
export function generateTOTPSecret(): string {
  const buffer = randomBytes(20);
  return base32Encode(buffer).replace(/=/g, '');
}

// Generate TOTP code
export function generateTOTPCode(secret: string, timeStep = 30): string {
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(time));

  const decodedSecret = Buffer.from(base32Decode(secret));
  const hmac = createHmac('sha1', decodedSecret);
  hmac.update(timeBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

// Verify TOTP code (also allows adjacent time windows)
export function verifyTOTPCode(
  secret: string,
  code: string,
  window = 1
): boolean {
  for (let i = -window; i <= window; i++) {
    const timeStep = 30;
    const time = Math.floor(Date.now() / 1000 / timeStep) + i;
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(time));

    const decodedSecret = Buffer.from(base32Decode(secret));
    const hmac = createHmac('sha1', decodedSecret);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const expectedCode = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % 1000000;

    if (expectedCode.toString().padStart(6, '0') === code) {
      return true;
    }
  }
  return false;
}

// Generate URI for QR code
export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string
): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ============================================
// MFA Setup API
// ============================================

// app/api/auth/mfa/setup/route.ts
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = generateTOTPSecret();
  const uri = generateTOTPUri(secret, session.user.email, 'MyApp');

  // Save secret temporarily (not activated yet)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingMFASecret: secret },
  });

  return NextResponse.json({ secret, uri });
}

// app/api/auth/mfa/verify/route.ts
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await request.json();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.pendingMFASecret) {
    return NextResponse.json(
      { error: 'MFA setup not initiated' },
      { status: 400 }
    );
  }

  // Code verification
  const isValid = verifyTOTPCode(user.pendingMFASecret, code);
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid verification code' },
      { status: 400 }
    );
  }

  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    randomBytes(4).toString('hex')
  );

  // Activate MFA
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaSecret: user.pendingMFASecret,
      pendingMFASecret: null,
      mfaEnabled: true,
      mfaBackupCodes: backupCodes.map(code =>
        bcrypt.hashSync(code, 10)
      ),
    },
  });

  return NextResponse.json({
    success: true,
    backupCodes, // Displayed only once
  });
}
```

### 9.3 Implementing an MFA Authentication Guard

```typescript
// ============================================
// MFA-Aware Authentication Guard
// ============================================

// MFA check in middleware.ts
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('session-token')?.value;
  const mfaToken = request.cookies.get('mfa-verified')?.value;

  // Authentication check (standard flow)
  if (!token && isProtectedRoute(pathname)) {
    return redirectToLogin(request, pathname);
  }

  if (token) {
    const payload = await verifyToken(token);
    if (!payload) {
      return redirectToLogin(request, pathname);
    }

    // MFA check
    // For users with MFA enabled who have not completed MFA verification
    if (payload.mfaEnabled && !mfaToken && pathname !== '/auth/mfa') {
      // Redirect to MFA page for any access other than the MFA verification page
      return NextResponse.redirect(new URL('/auth/mfa', request.url));
    }
  }

  return NextResponse.next();
}

// app/auth/mfa/page.tsx — MFA Verification Page
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MFAVerificationPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  // Focus the first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Numbers only

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCode.every(c => c !== '') && index === 5) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Move to previous input on Backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = [...code];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);

    if (pastedData.length === 6) {
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (verificationCode: string) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      if (response.ok) {
        router.push('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || 'The verification code is incorrect');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Two-Factor Authentication</h2>
          <p className="mt-2 text-gray-600">
            Enter the 6-digit code shown in your authenticator app
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={el => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={isLoading}
              className="w-12 h-14 text-center text-2xl font-mono
                         border-2 border-gray-300 rounded-lg
                         focus:border-blue-500 focus:ring-2 focus:ring-blue-200
                         disabled:opacity-50"
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        <div className="text-center">
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-500"
            onClick={() => {/* Switch to backup code entry mode */}}
          >
            Use a backup code
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 9.4 Step-Up Authentication

This pattern requires additional authentication for high-security operations.

```typescript
// ============================================
// Step-Up Authentication Implementation
// ============================================

// lib/auth/stepUpAuth.ts

// Authentication level definitions
enum AuthLevel {
  BASIC = 1,       // Password only
  MFA = 2,         // Password + MFA
  RECENT_MFA = 3,  // Recent MFA (within 5 minutes)
  BIOMETRIC = 4,   // Biometric authentication
}

// Required authentication level per operation
const operationAuthLevels: Record<string, AuthLevel> = {
  'view:dashboard': AuthLevel.BASIC,
  'edit:profile': AuthLevel.BASIC,
  'change:password': AuthLevel.MFA,
  'change:email': AuthLevel.MFA,
  'enable:mfa': AuthLevel.MFA,
  'view:billing': AuthLevel.MFA,
  'update:billing': AuthLevel.RECENT_MFA,
  'delete:account': AuthLevel.RECENT_MFA,
  'transfer:funds': AuthLevel.RECENT_MFA,
  'export:all-data': AuthLevel.RECENT_MFA,
};

// Get current authentication level
function getCurrentAuthLevel(session: Session): AuthLevel {
  if (!session) return 0;

  const now = Date.now();
  const lastMfaAt = session.user.lastMfaVerifiedAt
    ? new Date(session.user.lastMfaVerifiedAt).getTime()
    : 0;
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  if (lastMfaAt > fiveMinutesAgo) {
    return AuthLevel.RECENT_MFA;
  }

  if (session.mfaVerified) {
    return AuthLevel.MFA;
  }

  return AuthLevel.BASIC;
}

// Check authentication level
export function requireAuthLevel(
  session: Session,
  operation: string
): { allowed: boolean; requiredLevel: AuthLevel; currentLevel: AuthLevel } {
  const requiredLevel = operationAuthLevels[operation] || AuthLevel.BASIC;
  const currentLevel = getCurrentAuthLevel(session);

  return {
    allowed: currentLevel >= requiredLevel,
    requiredLevel,
    currentLevel,
  };
}

// React Hook
export function useStepUpAuth() {
  const { session } = useSession();
  const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAuth = useCallback(
    (operation: string, action: () => void) => {
      const result = requireAuthLevel(session!, operation);

      if (result.allowed) {
        action();
      } else {
        setPendingAction(() => action);
        setIsReauthModalOpen(true);
      }
    },
    [session]
  );

  const onReauthSuccess = useCallback(() => {
    setIsReauthModalOpen(false);
    pendingAction?.();
    setPendingAction(null);
  }, [pendingAction]);

  return { requireAuth, isReauthModalOpen, setIsReauthModalOpen, onReauthSuccess };
}

// Usage example
function BillingPage() {
  const { requireAuth, isReauthModalOpen, setIsReauthModalOpen, onReauthSuccess } = useStepUpAuth();

  const handleUpdateBilling = () => {
    requireAuth('update:billing', () => {
      // Process billing information update
      updateBillingInfo();
    });
  };

  return (
    <div>
      <h1>Billing Settings</h1>
      <Button onClick={handleUpdateBilling}>
        Update Billing Information
      </Button>

      <ReauthModal
        isOpen={isReauthModalOpen}
        onClose={() => setIsReauthModalOpen(false)}
        onSuccess={onReauthSuccess}
      />
    </div>
  );
}
```

---

## 10. Authentication Guards with OAuth / OpenID Connect Integration

### 10.1 OAuth 2.0 Flow Overview

```
[OAuth 2.0 Authorization Code Flow]

  1. User clicks "Sign in with Google"
  2. App redirects to Google's authorization endpoint
     URL: https://accounts.google.com/o/oauth2/v2/auth
     Parameters:
       - client_id: App's client ID
       - redirect_uri: Callback URL
       - response_type: code
       - scope: openid email profile
       - state: Random string for CSRF protection
       - code_challenge: PKCE challenge
  3. User authenticates and authorizes in Google
  4. Google redirects to callback URL (with authorization code)
  5. App exchanges authorization code for tokens on the backend
     POST https://oauth2.googleapis.com/token
  6. Obtain access token + ID token
  7. Retrieve user information from ID token
  8. Create session, redirect to dashboard

[Key Security Points]
  - Prevent CSRF attacks with the state parameter
  - Prevent authorization code interception with PKCE (Proof Key for Code Exchange)
  - Perform token exchange on the backend (protect client secret)
  - Prevent replay attacks with the nonce parameter
```

### 10.2 OAuth Callback Handler

```typescript
// ============================================
// OAuth Callback Processing
// ============================================

// app/api/auth/callback/[provider]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const providers: Record<string, OAuthProvider> = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  github: {
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = providers[params.provider];
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Error check
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/login?error=missing_params', request.url)
    );
  }

  // State verification (CSRF protection)
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth-state')?.value;
  if (state !== storedState) {
    return NextResponse.redirect(
      new URL('/login?error=invalid_state', request.url)
    );
  }
  cookieStore.delete('oauth-state');

  // Retrieve PKCE verifier
  const codeVerifier = cookieStore.get('oauth-code-verifier')?.value;
  cookieStore.delete('oauth-code-verifier');

  try {
    // Token exchange
    const tokenResponse = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/${params.provider}`,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      throw new Error('Token exchange failed');
    }

    // Retrieve user information
    const userInfoResponse = await fetch(provider.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Create or update user
    const user = await prisma.user.upsert({
      where: {
        email: userInfo.email,
      },
      update: {
        name: userInfo.name,
        image: userInfo.picture || userInfo.avatar_url,
        lastLoginAt: new Date(),
      },
      create: {
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.picture || userInfo.avatar_url,
        role: 'user',
        emailVerified: new Date(),
        accounts: {
          create: {
            provider: params.provider,
            providerAccountId: String(userInfo.sub || userInfo.id),
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expires_in
              ? Math.floor(Date.now() / 1000) + tokens.expires_in
              : undefined,
          },
        },
      },
    });

    // Create session
    const sessionToken = await createSessionToken(user);
    cookieStore.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // Redirect to callbackUrl
    const callbackUrl = cookieStore.get('oauth-callback-url')?.value || '/dashboard';
    cookieStore.delete('oauth-callback-url');

    return NextResponse.redirect(new URL(callbackUrl, request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=oauth_failed', request.url)
    );
  }
}
```

---

## 11. Testing Authentication Guards

### 11.1 Unit Tests

```typescript
// ============================================
// Unit Tests for Authentication Guards
// ============================================

// __tests__/auth/permissions.test.ts
import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getAllPermissions,
} from '@/lib/auth/permissions';

describe('RBAC Permission System', () => {
  describe('hasPermission', () => {
    it('viewer can read posts', () => {
      expect(hasPermission('viewer', 'posts:read')).toBe(true);
    });

    it('viewer cannot delete users', () => {
      expect(hasPermission('viewer', 'users:delete')).toBe(false);
    });

    it('admin inherits editor permissions', () => {
      expect(hasPermission('admin', 'posts:publish')).toBe(true);
    });

    it('editor does not have admin permissions', () => {
      expect(hasPermission('editor', 'users:delete')).toBe(false);
    });

    it('superadmin has all permissions', () => {
      expect(hasPermission('superadmin', 'billing:update')).toBe(true);
      expect(hasPermission('superadmin', 'users:delete')).toBe(true);
      expect(hasPermission('superadmin', 'posts:publish')).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('admin has both users:create and users:delete', () => {
      expect(
        hasAllPermissions('admin', ['users:create', 'users:delete'])
      ).toBe(true);
    });

    it('editor does not have users:create', () => {
      expect(
        hasAllPermissions('editor', ['posts:publish', 'users:create'])
      ).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('editor has either posts:publish or users:create', () => {
      expect(
        hasAnyPermission('editor', ['posts:publish', 'users:create'])
      ).toBe(true);
    });

    it('viewer has neither posts:create nor users:create', () => {
      expect(
        hasAnyPermission('viewer', ['posts:create', 'users:create'])
      ).toBe(false);
    });
  });

  describe('getAllPermissions', () => {
    it('retrieves all permissions based on role hierarchy', () => {
      const adminPerms = getAllPermissions('admin');
      // Direct admin permissions
      expect(adminPerms).toContain('users:create');
      expect(adminPerms).toContain('users:delete');
      // Inherited from editor
      expect(adminPerms).toContain('posts:publish');
      // Inherited from viewer
      expect(adminPerms).toContain('posts:read');
      // Does not include superadmin permissions
      expect(adminPerms).not.toContain('billing:update');
    });

    it('returns permissions without duplicates', () => {
      const perms = getAllPermissions('admin');
      const unique = [...new Set(perms)];
      expect(perms.length).toBe(unique.length);
    });
  });
});

// __tests__/auth/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSession, refreshSession } from '@/lib/auth/session';

// Mock setup
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('new-token'),
  })),
}));

describe('Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no valid token is present', async () => {
    const { cookies } = await import('next/headers');
    (cookies as any).mockReturnValue({
      get: () => null,
    });

    const session = await getSession();
    expect(session).toBeNull();
  });

  it('returns null for an invalid token', async () => {
    const { cookies } = await import('next/headers');
    (cookies as any).mockReturnValue({
      get: () => ({ value: 'invalid-token' }),
    });

    const { jwtVerify } = await import('jose');
    (jwtVerify as any).mockRejectedValue(new Error('Invalid token'));

    const session = await getSession();
    expect(session).toBeNull();
  });
});
```

### 11.2 Integration Tests (E2E)

```typescript
// ============================================
// Playwright E2E Tests
// ============================================

// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Seed test user data
    await page.request.post('/api/test/seed', {
      data: {
        users: [
          { email: 'user@test.com', password: 'password123', role: 'user' },
          { email: 'admin@test.com', password: 'admin123', role: 'admin' },
        ],
      },
    });
  });

  test('unauthenticated users cannot access the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Should be redirected to login page
    await expect(page).toHaveURL(/\/login/);
    // callbackUrl should be set
    expect(page.url()).toContain('callbackUrl=%2Fdashboard');
  });

  test('can log in with correct credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'user@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
    // User name should be visible
    await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
  });

  test('shows an error with incorrect credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'user@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Error message should be displayed
    await expect(
      page.locator('text=Invalid email address or password')
    ).toBeVisible();
    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('regular users cannot access admin pages', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Access admin page
    await page.goto('/admin');
    // Should be redirected to 403 page or dashboard
    await expect(page).toHaveURL(/\/(403|dashboard)/);
  });

  test('admins can access admin pages', async ({ page }) => {
    // Log in as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Access admin page
    await page.goto('/admin');
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('text=Admin Mode')).toBeVisible();
  });

  test('cannot access dashboard after logging out', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Log out
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL('/login');

    // Try to access dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('callbackUrl works correctly', async ({ page }) => {
    // Access settings page (unauthenticated)
    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/login.*callbackUrl/);

    // Log in
    await page.fill('input[name="email"]', 'user@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should be redirected to settings page
    await expect(page).toHaveURL('/settings/profile');
  });
});
```

### 11.3 Testing Middleware

```typescript
// ============================================
// Testing Next.js Middleware
// ============================================

// __tests__/middleware.test.ts
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// Helper to create mock NextRequest
function createMockRequest(
  url: string,
  options: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const request = new NextRequest(new URL(url, 'http://localhost:3000'));

  if (options.cookies) {
    Object.entries(options.cookies).forEach(([name, value]) => {
      request.cookies.set(name, value);
    });
  }

  if (options.headers) {
    Object.entries(options.headers).forEach(([name, value]) => {
      request.headers.set(name, value);
    });
  }

  return request;
}

describe('Middleware', () => {
  it('allows public paths through', async () => {
    const request = createMockRequest('/');
    const response = await middleware(request);
    expect(response.status).not.toBe(302);
    expect(response.status).not.toBe(401);
  });

  it('redirects to login when accessing a protected path without authentication', async () => {
    const request = createMockRequest('/dashboard');
    const response = await middleware(request);
    expect(response.status).toBe(307); // Temporary Redirect
    expect(response.headers.get('location')).toContain('/login');
  });

  it('returns 401 when accessing an API without authentication', async () => {
    const request = createMockRequest('/api/users');
    const response = await middleware(request);
    expect(response.status).toBe(401);
  });

  it('allows through with a valid token', async () => {
    const request = createMockRequest('/dashboard', {
      cookies: { 'session-token': 'valid-jwt-token' },
    });

    // Mock JWT verification
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-1', role: 'user', exp: Date.now() / 1000 + 3600 },
      protectedHeader: { alg: 'HS256' },
    } as any);

    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it('returns 403 when a non-admin user accesses /admin', async () => {
    const request = createMockRequest('/admin', {
      cookies: { 'session-token': 'valid-jwt-token' },
    });

    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-1', role: 'user', exp: Date.now() / 1000 + 3600 },
      protectedHeader: { alg: 'HS256' },
    } as any);

    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/403');
  });
});
```

---

## 12. Security Best Practices

### 12.1 Recommendations

```
[Authentication Guard Best Practices]

1. Implement Defense in Depth
   - Check at three layers: Middleware + Layout + API Route
   - Validate on both client and server
   - Consider RLS at the database level as well

2. Token Management
   - Use HttpOnly + Secure + SameSite=Lax cookies
   - Set appropriate token expiry (not too long)
   - Implement refresh token rotation
   - Invalidate tokens server-side on logout

3. Password Security
   - Hash with bcrypt / argon2 (stretching with 12+ rounds)
   - Timing attack mitigation (apply same processing time for non-existent users)
   - Account lock mechanism (lock for 15 minutes after 5 failures)
   - Password strength check (zxcvbn, etc.)

4. Session Management
   - Set session expiry
   - Refresh session with sliding window
   - Manage sessions across multiple devices
   - Detect suspicious logins (different IP / device)

5. CSRF Mitigation
   - Set SameSite cookie attribute
   - Use CSRF tokens (for form submissions)
   - Validate Origin / Referer headers

6. Input Validation
   - Server-side validation (Zod, etc.)
   - SQL injection prevention (ORM / parameter binding)
   - XSS prevention (input sanitization)

7. Audit Logging
   - Log login / logout events
   - Log permission changes
   - Log critical operations
   - Log unauthorized access attempts
```

### 12.2 Cookie Security Settings

```typescript
// ============================================
// Guidelines for Secure Cookie Configuration
// ============================================

// lib/auth/cookies.ts

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
  domain?: string;
}

// Recommended settings for session cookies
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,     // Inaccessible from JavaScript (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only
  sameSite: 'lax',    // CSRF protection (allows cross-site GET navigation)
  maxAge: 7 * 24 * 60 * 60, // 7 days
  path: '/',
  // domain: '.example.com', // Required for subdomain sharing
};

// CSRF token cookie settings
export const CSRF_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: false,    // Readable from JavaScript (to include in forms)
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict', // Strict CSRF protection
  maxAge: 60 * 60,    // 1 hour
  path: '/',
};

// OAuth state cookie settings
export const OAUTH_STATE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',    // Required for OAuth redirects
  maxAge: 10 * 60,    // 10 minutes (valid only during OAuth flow)
  path: '/',
};

// ============================================
// Guide for Choosing the SameSite Attribute
// ============================================
//
// 'strict': Most restrictive. Cookies are not sent with requests from external sites.
//           Note: Cookies are also not sent during OAuth redirects.
//
// 'lax':    Cookies are sent for cross-site GET navigation.
//           Not sent for cross-site POST requests.
//           Recommended for general web apps.
//
// 'none':   Cookies are always sent cross-site. Requires the Secure attribute.
//           Use only when third-party cookies are needed.
```

---

## 13. Anti-Patterns and Mitigations

### 13.1 Common Mistakes

```typescript
// ============================================
// Anti-Pattern Collection
// ============================================

// BAD Anti-pattern 1: Client-side-only protection
// Client-side conditional rendering can easily be bypassed
function BadProtectedPage() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;  // BAD: Can be circumvented via DevTools
  return <SecretContent />;
}

// GOOD Correct pattern: Server-side protection
export default async function ProtectedPage() {
  const session = await getSession();
  if (!session) redirect('/login'); // GOOD: Controlled by the server
  return <SecretContent />;
}

// ─────────────────────────────────────────

// BAD Anti-pattern 2: Storing tokens in localStorage
localStorage.setItem('token', jwt); // BAD: Can be stolen via XSS
fetch('/api/data', {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

// GOOD Correct pattern: Use HttpOnly cookies
// Set cookie on the server (inaccessible from JavaScript)
cookieStore.set('session-token', jwt, {
  httpOnly: true,  // GOOD: Protected from XSS
  secure: true,
  sameSite: 'lax',
});

// ─────────────────────────────────────────

// BAD Anti-pattern 3: Permission check only on the frontend
function DeleteButton({ userId }: { userId: string }) {
  const { user } = useAuth();
  // BAD: Frontend-only check is insufficient
  if (user.role !== 'admin') return null;
  return <button onClick={() => deleteUser(userId)}>Delete</button>;
}

// GOOD Correct pattern: Permission check in the API as well
// Frontend: UI control
function DeleteButton({ userId }: { userId: string }) {
  const { user } = useAuth();
  if (user.role !== 'admin') return null; // UI control
  return <button onClick={() => deleteUser(userId)}>Delete</button>;
}

// Backend: Actual permission check GOOD
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session.user.role, 'users:delete')) {
    return forbidden(); // GOOD: Always check on the server too
  }
  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}

// ─────────────────────────────────────────

// BAD Anti-pattern 4: Using user input directly as callbackUrl
const callbackUrl = searchParams.get('callbackUrl');
redirect(callbackUrl); // BAD: Open redirect vulnerability

// GOOD Correct pattern: Validate the callbackUrl
function sanitizeCallbackUrl(url: string | null): string {
  if (!url) return '/dashboard';

  // Allow relative paths only
  if (!url.startsWith('/')) return '/dashboard';

  // Reject URLs containing a protocol
  if (url.includes('://')) return '/dashboard';

  // Reject double slashes (protection against //evil.com)
  if (url.startsWith('//')) return '/dashboard';

  // Check against allowed path prefixes
  const allowedPrefixes = ['/dashboard', '/settings', '/admin', '/app'];
  if (!allowedPrefixes.some(prefix => url.startsWith(prefix))) {
    return '/dashboard';
  }

  return url;
}

// ─────────────────────────────────────────

// BAD Anti-pattern 5: Information leakage via error messages
if (!user) return { error: 'User not found' };
// BAD: Confirms whether the email address exists

if (!isValid) return { error: 'Password is incorrect' };
// BAD: Confirms the account exists

// GOOD Correct pattern: Use vague error messages
return { error: 'Invalid email address or password' };
// GOOD: Cannot determine which one is wrong

// ─────────────────────────────────────────

// BAD Anti-pattern 6: Hardcoding JWT secret
const secret = 'my-super-secret-key-12345'; // BAD: Secret in source code

// GOOD Correct pattern: Use environment variables
const secret = process.env.JWT_SECRET!;
// Additionally, throw an error at startup if the secret is not set
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// ─────────────────────────────────────────

// BAD Anti-pattern 7: Token expiry that is too long
.setExpirationTime('365d') // BAD: 1 year is too long

// GOOD Correct pattern: Appropriate expiry times
// Access token: 15 minutes to 1 hour
.setExpirationTime('1h')
// Refresh token: 7 to 30 days
// Session cookie: 7 days (extended with sliding window)
```

### 13.2 Security Checklist

```
[Authentication Guard Security Checklist]

□ Authentication
  □ Are passwords hashed with bcrypt / argon2?
  □ Is timing attack mitigation implemented?
  □ Is there an account lock mechanism?
  □ Is the password reset flow secure?
  □ Is an MFA option available?

□ Session Management
  □ Are session tokens stored in HttpOnly cookies?
  □ Is the Secure flag set?
  □ Is the SameSite attribute set?
  □ Is the session expiry appropriate?
  □ Are sessions invalidated server-side on logout?

□ Authorization
  □ Are permission checks performed server-side?
  □ Do all API endpoints have authorization checks?
  □ Is IDOR (Insecure Direct Object Reference) mitigated?
  □ Is horizontal privilege escalation mitigated?
  □ Is vertical privilege escalation mitigated?

□ Input Validation
  □ Are callbackUrl / redirectUrl values validated?
  □ Is user input sanitized?
  □ Is SQL injection prevention in place?

□ Communication
  □ Is HTTPS enforced?
  □ Is the HSTS header set?
  □ Is CSP (Content Security Policy) configured?

□ Auditing
  □ Are login / logout events logged?
  □ Are permission changes logged?
  □ Is detection and notification of unauthorized access attempts in place?
```

---

## 14. Troubleshooting

### 14.1 Common Issues and Solutions

```
[Issue 1: Infinite Redirect Loop]

Symptom: A loop occurs: /login → /dashboard → /login → ...

Cause:
  - The Middleware is also protecting the login page itself
  - Incorrect session cookie settings (path or domain issue)
  - The redirect destination route is also protected

Solution:
  - Include the login page in publicPaths
  - Set the cookie path to '/'
  - Exclude the login page in the matcher configuration

  // middleware.ts
  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|login|register).*)'],
  };

---

[Issue 2: redirect() in Server Component Does Not Work]

Symptom: Calling redirect() does not redirect the page

Cause:
  - redirect() is being caught by a try-catch block
  - Rendering continues after redirect()
  - The server-side redirect is being used inside a Client Component

Solution:
  - redirect() throws an exception, so do not catch it

  // BAD
  try {
    const session = await getSession();
    if (!session) redirect('/login');
  } catch (error) {
    // The redirect exception is also caught here
  }

  // GOOD
  const session = await getSession();
  if (!session) redirect('/login');
  // Code after redirect() is never executed

---

[Issue 3: Cannot Access DB from Middleware]

Symptom: Calling Prisma from Middleware throws an error

Cause:
  Middleware runs in the Edge Runtime, which restricts Node.js APIs.
  The Prisma client assumes the Node.js runtime.

Solution:
  - In Middleware, only perform JWT signature verification; avoid DB access
  - Perform full DB validation in Layout / Server Components
  - Use an Edge-compatible DB client (e.g., @prisma/client/edge)

  // Middleware: JWT signature verification only (lightweight)
  export function middleware(request: NextRequest) {
    const token = request.cookies.get('session-token')?.value;
    if (!token) return redirectToLogin(request);

    // Verify JWT signature only (no DB access)
    try {
      jwtVerify(token, secret); // jose supports Edge Runtime
    } catch {
      return redirectToLogin(request);
    }
    return NextResponse.next();
  }

  // Layout: Full validation (with DB access)
  export default async function Layout({ children }) {
    const session = await getSession(); // Fetch latest info from DB
    if (!session) redirect('/login');
    return <>{children}</>;
  }

---

[Issue 4: CORS Error Prevents Login]

Symptom: When the frontend and backend are on different domains,
         cookies are not sent / set

Cause:
  - credentials: 'include' is not configured
  - Incorrect CORS settings on the server
  - Cookie SameSite setting is too strict

Solution:
  // Frontend
  fetch('https://api.example.com/auth/login', {
    method: 'POST',
    credentials: 'include', // Send cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  // Backend (Next.js API Route)
  const response = NextResponse.json({ success: true });
  response.headers.set('Access-Control-Allow-Origin', 'https://app.example.com');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  // Cookie settings
  response.cookies.set('session-token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',  // Required for cross-domain (Secure is mandatory)
    domain: '.example.com', // Subdomain sharing
  });

---

[Issue 5: Session Expires Unexpectedly]

Symptom: Users are logged out even while active

Cause:
  - Token expiry is too short
  - Sliding window is not implemented
  - Session conflict across multiple tabs
  - Server time drift

Solution:
  - Set an appropriate token expiry (recommended: 7 days)
  - Implement token expiry extension in Middleware
  - Synchronize tabs with BroadcastChannel
  - Synchronize server time with NTP

  // Cross-tab session synchronization
  const channel = new BroadcastChannel('auth');
  channel.addEventListener('message', (event) => {
    if (event.data.type === 'LOGOUT') {
      // Logged out in another tab
      window.location.href = '/login';
    }
    if (event.data.type === 'SESSION_UPDATED') {
      // Session updated in another tab
      refreshSession();
    }
  });

  // Notify on logout
  function logout() {
    channel.postMessage({ type: 'LOGOUT' });
    // ... logout processing
  }

---

[Issue 6: Permission Changes Are Not Reflected in Real Time]

Symptom: When an admin changes a user's role,
         the change is not reflected in that user's session

Cause:
  If role information is embedded in the JWT,
  the old information is used until the token is refreshed.

Solution:
  - Always verify the role from the DB when retrieving a session
  - Include only the user ID in the token; retrieve permissions from the DB each time
  - Force-invalidate the user's session on permission change

  // Retrieve the latest permissions from DB when fetching the session
  export async function getSession(): Promise<Session | null> {
    const token = getTokenFromCookie();
    const payload = await verifyToken(token);

    // Retrieve the latest information from DB (this is the key point)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) return null;

    return { user }; // Return the latest info from DB
  }
```

### 14.2 Debugging Techniques

```typescript
// ============================================
// Debugging Authentication Guards
// ============================================

// 1. Middleware debug logging
export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware]', {
      pathname: request.nextUrl.pathname,
      method: request.method,
      hasCookie: !!request.cookies.get('session-token'),
      headers: Object.fromEntries(request.headers),
    });
  }

  // ... authentication logic
}

// 2. Session debug endpoint (development only)
// app/api/debug/session/route.ts
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await getSession();
  const token = request.cookies.get('session-token')?.value;

  let tokenInfo = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.JWT_SECRET!)
      );
      tokenInfo = {
        sub: payload.sub,
        role: payload.role,
        iat: new Date((payload.iat || 0) * 1000).toISOString(),
        exp: new Date((payload.exp || 0) * 1000).toISOString(),
        expiresIn: `${Math.floor(((payload.exp || 0) - Date.now() / 1000) / 60)} minutes`,
      };
    } catch (e) {
      tokenInfo = { error: (e as Error).message };
    }
  }

  return NextResponse.json({
    session,
    token: tokenInfo,
    cookies: Object.fromEntries(
      request.cookies.getAll().map(c => [c.name, '***'])
    ),
  });
}

// 3. Permission debug component (development only)
function PermissionDebugger() {
  if (process.env.NODE_ENV !== 'development') return null;

  const { session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  if (!session) return null;

  const allPerms = getAllPermissions(session.user.role as Role);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-800 text-white px-3 py-1 rounded text-xs"
      >
        Debug: {session.user.role}
      </button>
      {isOpen && (
        <div className="absolute bottom-10 right-0 bg-white border shadow-lg
                        rounded-lg p-4 w-80 max-h-96 overflow-y-auto">
          <h3 className="font-bold mb-2">Permission List</h3>
          <ul className="text-xs space-y-1">
            {allPerms.map(p => (
              <li key={p} className="font-mono">{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## Summary

### Authentication Guard Design Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| Defense in Depth | Protect across multiple layers | Middleware + Layout + API |
| Least Privilege | Grant only the minimum necessary permissions | RBAC / ABAC |
| Fail-Safe | Deny by default | Explicit allow required |
| Complete Mediation | Check every access | Auth check per API route |
| Secure Defaults | Safe initial settings | HttpOnly + Secure + SameSite |

### Roles per Layer

| Layer | Role | Tools | Appropriate Use |
|-------|------|-------|-----------------|
| Middleware | Route protection | middleware.ts | Coarse-grained access control, token verification |
| Layout | Area protection | Server Component | Session verification, shared UI control |
| Component | Element control | RBAC + RequirePermission | Show/hide buttons |
| API Route | Data protection | withPermission HOF | Final defense for data access |
| Database | Row-level protection | RLS / Policies | Final data protection |

### Framework Selection Guide

| Requirement | Recommended Framework | Reason |
|-------------|----------------------|--------|
| SSR + Authentication | Next.js | Middleware + Server Component integration |
| SPA | React Router + backend | Client guard + API protection |
| Enterprise | Angular | Built-in guard system |
| Lightweight SPA | Vue Router | Simple navigation guards |

---

## Prerequisites

To get the most out of this chapter, it is recommended to have prior knowledge of the following topics.

- **Navigation Patterns**: Basic design of routing and navigation → `./02-navigation-patterns.md`
- **Authentication Basics**: The difference between authentication and authorization, JWT and session-based authentication → `../../network-fundamentals/docs/03-security/01-authentication.md`
- **Middleware Concepts**: The role of middleware as an intermediate layer in request processing

Understanding these concepts enables you to implement secure and user-friendly authentication guards.

---

## FAQ

### Q1: What is the best practice for implementing authentication checks in Middleware?

**A:** In Middleware, perform only lightweight token verification. Detailed permission checks should be done in Layout or API Routes.

```typescript
// =========================================
// middleware.ts (Recommended Implementation)
// =========================================
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;

  // 1. Skip public paths
  const publicPaths = ['/login', '/signup', '/forgot-password', '/api/health'];
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 2. Check for token presence
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Verify token (lightweight verification only)
  try {
    const payload = await verifyJWT(token);

    // Add userId to request headers for use in subsequent processing
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    // Invalid token → redirect to login page
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth-token'); // Delete the invalid token
    return response;
  }
}

// Specify paths to apply Middleware to
export const config = {
  matcher: [
    // Paths requiring authentication
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/protected/:path*',
    // Exclude: static files, Next.js internal paths
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

// =========================================
// layout.tsx (Detailed permission check)
// =========================================
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  // Detailed permission check
  if (!session.user.roles.includes('admin')) {
    redirect('/forbidden');
  }

  return <div>{children}</div>;
}
```

**Key Points**:
- Middleware runs in the Edge Runtime, so avoid database access
- Session validation should be done in Server Components
- Token refresh should be handled in API Routes

### Q2: How do I implement RBAC (Role-Based Access Control)?

**A:** Assign roles to users and define a permission set per role. Enforce permission checks at every layer: components, APIs, and the database.

```typescript
// =========================================
// Type definitions
// =========================================
type Role = 'admin' | 'editor' | 'viewer';
type Permission =
  | 'users:read'
  | 'users:write'
  | 'posts:read'
  | 'posts:write'
  | 'posts:delete';

const rolePermissions: Record<Role, Permission[]> = {
  admin: ['users:read', 'users:write', 'posts:read', 'posts:write', 'posts:delete'],
  editor: ['users:read', 'posts:read', 'posts:write'],
  viewer: ['posts:read'],
};

// =========================================
// Permission check function
// =========================================
function hasPermission(userRoles: Role[], permission: Permission): boolean {
  return userRoles.some(role =>
    rolePermissions[role]?.includes(permission)
  );
}

// =========================================
// Usage in Server Component
// =========================================
import { getServerSession } from 'next-auth';

export default async function AdminPage() {
  const session = await getServerSession();

  if (!session || !hasPermission(session.user.roles, 'users:write')) {
    return <Forbidden message="You don't have permission to manage users" />;
  }

  return <UserManagement />;
}

// =========================================
// Usage in Client Component
// =========================================
'use client';

import { useSession } from 'next-auth/react';

function DeleteButton({ postId }: { postId: string }) {
  const { data: session } = useSession();

  if (!session || !hasPermission(session.user.roles, 'posts:delete')) {
    return null; // Hide the button
  }

  return (
    <button onClick={() => deletePost(postId)}>
      Delete
    </button>
  );
}

// =========================================
// Usage in API Route
// =========================================
import { getServerSession } from 'next-auth';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!hasPermission(session.user.roles, 'posts:delete')) {
    return new Response('Forbidden', { status: 403 });
  }

  await deletePost(params.id);
  return new Response('Deleted', { status: 200 });
}
```

### Q3: How do I handle SSR with authentication state?

**A:** Retrieve the session in a Server Component and pass it to Client Components via Context. This ensures the authentication state matches between the initial render and the client side.

```typescript
// =========================================
// app/layout.tsx (Server Component)
// =========================================
import { getServerSession } from 'next-auth';
import { SessionProvider } from '@/components/session-provider';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Retrieve session on the server
  const session = await getServerSession();

  return (
    <html>
      <body>
        {/* Pass to the client side */}
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

// =========================================
// components/session-provider.tsx (Client Component)
// =========================================
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: any;
}) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}

// =========================================
// components/user-menu.tsx (Client Component)
// =========================================
'use client';

import { useSession } from 'next-auth/react';

export function UserMenu() {
  const { data: session, status } = useSession();

  // The session received from the server is available on initial render
  if (status === 'loading') {
    return <UserMenuSkeleton />;
  }

  if (!session) {
    return <LoginButton />;
  }

  return (
    <div>
      <p>Welcome, {session.user.name}</p>
      <LogoutButton />
    </div>
  );
}

// =========================================
// app/dashboard/page.tsx (Server Component)
// =========================================
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch authenticated data on the server side
  const userData = await fetchUserData(session.user.id);

  return <Dashboard data={userData} />;
}
```

**Key Points**:
- Passing the session retrieved in a Server Component to the client prevents Hydration errors on initial render
- Fetch sensitive data in Server Components; do not send it to the client
- `useSession` monitors authentication state changes and updates the UI in real time

---

## What to Read Next

---

## References
1. Next.js. "Authentication." nextjs.org/docs, 2024.
2. Auth.js. "NextAuth.js Documentation." authjs.dev, 2024.
3. Clerk. "Authentication for Next.js." clerk.com, 2024.
4. OWASP. "Authentication Cheat Sheet." cheatsheetseries.owasp.org, 2024.
5. OWASP. "Authorization Cheat Sheet." cheatsheetseries.owasp.org, 2024.
6. OWASP. "Session Management Cheat Sheet." cheatsheetseries.owasp.org, 2024.
7. RFC 6749. "The OAuth 2.0 Authorization Framework." datatracker.ietf.org, 2012.
8. RFC 7519. "JSON Web Token (JWT)." datatracker.ietf.org, 2015.
9. React Router. "Authentication." reactrouter.com/docs, 2024.
10. Vue Router. "Navigation Guards." router.vuejs.org, 2024.
11. Angular. "Route Guards." angular.dev/guide/routing, 2024.
12. NIST SP 800-63B. "Digital Identity Guidelines: Authentication and Lifecycle Management." nist.gov, 2020.
