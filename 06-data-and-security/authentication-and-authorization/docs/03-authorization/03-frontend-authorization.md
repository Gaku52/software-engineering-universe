# Frontend Authorization

> Frontend authorization is "display control" for improving UX — it is not the final line of defense for security. This guide comprehensively covers route guards, conditional component rendering, permission-based UI control, declarative authorization with CASL/Zod, responsibility sharing with Server Components, and permission prefetching strategies.

## What You Will Learn

- [ ] Accurately understand the role and limitations of frontend authorization
- [ ] Implement route guards with Next.js Middleware and React Router
- [ ] Learn how to declaratively implement permission-based UI control
- [ ] Understand the division of authorization responsibilities between Server Components and Client Components
- [ ] Practice permission prefetching, caching, and real-time updates

### Prerequisites

- Basics of React (Context API, Hooks)
- Basics of Next.js App Router (Server Components, Middleware)

---

## 1. Principles of Frontend Authorization

### 1.1 Division of Responsibilities Between Frontend and Backend

```
Key Principle:

  Frontend authorization = UX optimization
  Server authorization   = Security guarantee

  ┌──────────────────────────────────────────────────────┐
  │              Authorization Layer Structure            │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │ Layer 1: Frontend (Display Control)           │    │
  │  │                                              │    │
  │  │  → Hide menu items the user lacks access to  │    │
  │  │  → Disable buttons (disabled) without perms  │    │
  │  │  → Redirect when accessing unauthorized pages │    │
  │  │  → Don't show unnecessary options to users   │    │
  │  │  → Explain to users why an action is blocked  │    │
  │  │                                              │    │
  │  │  Purpose: Improve user experience            │    │
  │  │  Trust level: Low (bypassable)               │    │
  │  └──────────────────────────────────────────────┘    │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │ Layer 2: BFF / API Gateway                    │    │
  │  │                                              │    │
  │  │  → Route-level authorization checks          │    │
  │  │  → Token validation                          │    │
  │  │  → Rate limiting                             │    │
  │  │                                              │    │
  │  │  Purpose: Coarse-grained access control      │    │
  │  │  Trust level: Medium                         │    │
  │  └──────────────────────────────────────────────┘    │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │ Layer 3: Backend (Security)                   │    │
  │  │                                              │    │
  │  │  → Permission check on every API request     │    │
  │  │  → Resource-level authorization (ownership)  │    │
  │  │  → Does not rely on frontend display state   │    │
  │  │  → Safe even if frontend is bypassed         │    │
  │  │                                              │    │
  │  │  Purpose: Security guarantee                 │    │
  │  │  Trust level: High (sole trust boundary)     │    │
  │  └──────────────────────────────────────────────┘    │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### 1.2 Why Frontend-Only Authorization Is Dangerous

```
Reasons why frontend-only authorization is dangerous:

  Attack Method 1: Manipulation via DevTools
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  // Run in DevTools Console                        │
  │  document.querySelector('[disabled]')               │
  │    .removeAttribute('disabled');                    │
  │  // → Disabled button becomes clickable             │
  │                                                    │
  │  // Show a hidden element                          │
  │  document.querySelector('.hidden')                  │
  │    .style.display = 'block';                       │
  │  // → Hidden admin menu becomes visible            │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Attack Method 2: Direct API calls
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  // Completely bypassing the frontend              │
  │  curl -X DELETE https://api.example.com/users/123  │
  │    -H "Cookie: session=stolen_session"             │
  │  // → Frontend display control is meaningless      │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Attack Method 3: JavaScript manipulation
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  // Overwrite state via React DevTools             │
  │  // user.role = 'viewer' → user.role = 'admin'     │
  │  // → Client-side permission checks are bypassed   │
  │                                                    │
  └────────────────────────────────────────────────────┘

  The correct approach:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ✓ Always perform authorization checks on backend  │
  │  ✓ Frontend controls display as a supplementary UX │
  │  ✓ Permission data must be fetched from backend    │
  │  ✓ Backend makes the final decision on operations  │
  │                                                    │
  └────────────────────────────────────────────────────┘
```

### 1.3 What Frontend Authorization Should Achieve

```
Specific purposes of frontend authorization:

  ① Preventive UI:
     → Block unauthorized operations proactively
     → Prevent users from encountering errors
     → Example: Hide Edit button if the user lacks edit permission

  ② Guidance:
     → Explain why an action is unavailable
     → Guide users on how to obtain permission
     → Example: "You need the Editor role to edit this"

  ③ Performance:
     → Prevent unnecessary API calls
     → Avoid fetching data the user isn't allowed to see
     → Example: Don't call the admin API if the user isn't an admin

  ④ Information minimization:
     → Don't fetch unauthorized data in the first place
     → Return only relevant data in Server Components based on permissions
     → Example: Don't even show the existence of the admin menu to regular users
```

---

## 2. Route Guards

### 2.1 Route Guards with Next.js Middleware

```typescript
// middleware.ts - Route guard with Next.js Middleware
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

// Protected route definitions (path → allowed roles)
const protectedRoutes: Record<string, string[]> = {
  '/dashboard': ['viewer', 'editor', 'admin'],
  '/articles/new': ['editor', 'admin'],
  '/articles/edit': ['editor', 'admin'],
  '/admin': ['admin'],
  '/settings': ['editor', 'admin'],
  '/billing': ['admin'],
};

// Public routes (no authentication required)
const publicRoutes = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/about',
  '/pricing',
]);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  // Skip static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Allow public routes through
  if (publicRoutes.has(pathname)) {
    // Redirect logged-in users away from /login
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Authentication check
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role check for protected routes
  const matchedRoute = Object.keys(protectedRoutes).find(
    (route) => pathname.startsWith(route)
  );

  if (matchedRoute) {
    const allowedRoles = protectedRoutes[matchedRoute];
    const userRole = session.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      // Insufficient permissions: redirect to 403 page
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Exclude static files and internal paths
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

```
Middleware flow:

  Request
  │
  ├─ Static file? ──Yes──→ Skip (NextResponse.next())
  │
  ├─ Public route? ──Yes──→ Pass through
  │   └─ Logged in + /login? ──→ Redirect to /dashboard
  │
  ├─ Session exists? ──No──→ Redirect to /login (with callbackUrl)
  │
  ├─ Protected route? ──Yes──→ Role check
  │   ├─ Allowed role? ──Yes──→ NextResponse.next()
  │   └─ Not allowed? ──→ Redirect to /unauthorized
  │
  └─ Other ──→ NextResponse.next()

  Notes:
  ┌────────────────────────────────────────────────────┐
  │ · Middleware runs on the Edge Runtime               │
  │ · DB access is limited (Prisma cannot be used)     │
  │ · Typically decided by JWT validation only         │
  │ · Properly restrict target paths via matcher       │
  │ · Keep processing lightweight to minimize perf impact│
  └────────────────────────────────────────────────────┘
```

### 2.2 Permission Checks for Dynamic Routes

```typescript
// Resource-level authorization for dynamic routes
// When Middleware alone is insufficient → add checks in the page component

// app/articles/[id]/edit/page.tsx
import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';

export default async function EditArticlePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session) redirect('/login');

  // Fetch the article
  const article = await prisma.article.findUnique({
    where: { id: params.id },
  });

  if (!article) notFound();

  // Resource-level authorization check
  const canEdit =
    session.user.role === 'admin' ||
    article.authorId === session.user.id;

  if (!canEdit) {
    redirect('/unauthorized');
  }

  return <ArticleEditor article={article} />;
}
```

### 2.3 Route Guards with React Router

```typescript
// Route guards with React Router v6 (for SPAs)

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Basic route guard
function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallback,
}: {
  children?: React.ReactNode;
  requiredRole?: string[];
  requiredPermission?: string;
  fallback?: React.ReactNode;
}) {
  const { user, isLoading, can } = useAuth();
  const location = useLocation();

  // Show skeleton while loading
  if (isLoading) {
    return fallback ?? <FullPageSkeleton />;
  }

  // Not authenticated → redirect to login page
  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Role check
  if (requiredRole && !requiredRole.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Permission check
  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
}

// Usage example: Route definitions
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Routes requiring authentication
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },

  // Editor or above
  {
    element: <ProtectedRoute requiredRole={['editor', 'admin']} />,
    children: [
      { path: '/articles/new', element: <NewArticlePage /> },
      { path: '/articles/:id/edit', element: <EditArticlePage /> },
    ],
  },

  // Admin only
  {
    element: <ProtectedRoute requiredRole={['admin']} />,
    children: [
      { path: '/admin', element: <AdminDashboard /> },
      { path: '/admin/users', element: <UserManagementPage /> },
      { path: '/admin/settings', element: <AdminSettingsPage /> },
    ],
  },

  // Permission-based
  {
    element: <ProtectedRoute requiredPermission="billing:manage" />,
    children: [
      { path: '/billing', element: <BillingPage /> },
    ],
  },

  // 404 / 403
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
```

---

## 3. Permission-Based UI Control

### 3.1 AuthContext Design

```typescript
// lib/auth-context.tsx - Complete implementation of the permission context
'use client';

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';

// Permission type definition
type Permission = string; // "resource:action" format

interface AuthContextValue {
  // User information
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    image?: string;
  } | null;

  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;

  // Permissions
  permissions: Set<Permission>;
  permissionsLoading: boolean;

  // Permission check functions
  can: (action: string, resource?: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;

  // Role checks
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  permissions: new Set(),
  permissionsLoading: true,
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  hasRole: () => false,
  hasAnyRole: () => false,
});

// Fetch permissions
async function fetchPermissions(): Promise<Set<Permission>> {
  const res = await fetch('/api/auth/permissions');
  if (!res.ok) throw new Error('Failed to fetch permissions');
  const data = await res.json();
  return new Set<Permission>(data.permissions);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  // Fetch permissions (cache managed by React Query)
  const {
    data: permissions = new Set<Permission>(),
    isLoading: permissionsLoading,
  } = useQuery({
    queryKey: ['permissions', session?.user?.id],
    queryFn: fetchPermissions,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,   // Use cache for 5 minutes
    gcTime: 30 * 60 * 1000,     // Keep in memory for 30 minutes
    refetchOnWindowFocus: false, // Prevent refetch on tab switch
    retry: 2,
  });

  // Permission check: resource:action format
  const can = useCallback(
    (action: string, resource?: string): boolean => {
      if (!isAuthenticated) return false;

      // admin role has all permissions
      if (session?.user?.role === 'admin') return true;

      const permission = resource ? `${resource}:${action}` : action;
      return permissions.has(permission);
    },
    [isAuthenticated, session?.user?.role, permissions]
  );

  // Check if any of the given permissions are held
  const canAny = useCallback(
    (perms: string[]): boolean => {
      return perms.some((p) => {
        const [resource, action] = p.split(':');
        return can(action, resource);
      });
    },
    [can]
  );

  // Check if all of the given permissions are held
  const canAll = useCallback(
    (perms: string[]): boolean => {
      return perms.every((p) => {
        const [resource, action] = p.split(':');
        return can(action, resource);
      });
    },
    [can]
  );

  // Role check
  const hasRole = useCallback(
    (role: string): boolean => {
      return session?.user?.role === role;
    },
    [session?.user?.role]
  );

  const hasAnyRole = useCallback(
    (roles: string[]): boolean => {
      return roles.includes(session?.user?.role ?? '');
    },
    [session?.user?.role]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user
        ? {
            id: session.user.id!,
            name: session.user.name!,
            email: session.user.email!,
            role: session.user.role as string,
            image: session.user.image ?? undefined,
          }
        : null,
      isAuthenticated,
      isLoading: status === 'loading',
      permissions,
      permissionsLoading,
      can,
      canAny,
      canAll,
      hasRole,
      hasAnyRole,
    }),
    [session, isAuthenticated, status, permissions, permissionsLoading,
     can, canAny, canAll, hasRole, hasAnyRole]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 3.2 Permissions API Endpoint

```typescript
// app/api/auth/permissions/route.ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

// Permission mapping per role
const rolePermissions: Record<string, string[]> = {
  viewer: [
    'articles:read',
    'comments:read',
    'comments:create',
    'profile:read',
    'profile:update',
  ],
  editor: [
    'articles:read',
    'articles:create',
    'articles:update',
    'articles:publish',
    'comments:read',
    'comments:create',
    'comments:update',
    'comments:delete',
    'media:upload',
    'profile:read',
    'profile:update',
  ],
  admin: [
    'admin', // Special permission: encompasses all permissions
  ],
};

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ permissions: [] }, { status: 401 });
  }

  const role = session.user.role as string;
  const permissions = rolePermissions[role] ?? [];

  // User-specific additional permissions (when fetching from DB)
  // const userPermissions = await prisma.userPermission.findMany({
  //   where: { userId: session.user.id },
  //   select: { permission: true },
  // });
  // const extraPermissions = userPermissions.map(p => p.permission);

  return NextResponse.json({
    permissions: [...permissions],
    role,
  });
}
```

### 3.3 Authorized Component (Declarative Authorization)

```typescript
// components/authorized.tsx - Declarative permission-check component
'use client';

import { useAuth } from '@/lib/auth-context';
import type { ReactNode } from 'react';

interface AuthorizedProps {
  // Single permission check
  permission?: string;
  // Multiple permissions (any)
  anyPermission?: string[];
  // Multiple permissions (all)
  allPermissions?: string[];
  // Role check
  role?: string;
  anyRole?: string[];
  // Display when unauthorized
  fallback?: ReactNode;
  // Whether to render as disabled when unauthorized
  showDisabled?: boolean;
  // Children
  children: ReactNode;
}

export function Authorized({
  permission,
  anyPermission,
  allPermissions,
  role,
  anyRole,
  fallback = null,
  showDisabled = false,
  children,
}: AuthorizedProps) {
  const { can, canAny, canAll, hasRole, hasAnyRole, permissionsLoading } = useAuth();

  // Show nothing while permissions are loading (prevent flicker)
  if (permissionsLoading) return null;

  let authorized = true;

  // Permission checks
  if (permission) {
    const [resource, action] = permission.split(':');
    authorized = can(action, resource);
  }

  if (anyPermission) {
    authorized = canAny(anyPermission);
  }

  if (allPermissions) {
    authorized = canAll(allPermissions);
  }

  // Role checks
  if (role) {
    authorized = hasRole(role);
  }

  if (anyRole) {
    authorized = hasAnyRole(anyRole);
  }

  if (!authorized) {
    if (showDisabled) {
      // Render in disabled state
      return (
        <div className="opacity-50 pointer-events-none" aria-disabled="true">
          {children}
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage example
function ArticleCard({ article }: { article: Article }) {
  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-xl font-bold">{article.title}</h2>
      <p className="text-gray-600 mt-2">{article.excerpt}</p>

      <div className="flex gap-2 mt-4">
        {/* Show only to users with update permission */}
        <Authorized permission="articles:update">
          <Link href={`/articles/${article.id}/edit`} className="btn-secondary">
            Edit
          </Link>
        </Authorized>

        {/* Delete permission: show in disabled state */}
        <Authorized
          permission="articles:delete"
          showDisabled
          fallback={
            <button disabled className="btn-danger opacity-50" title="You don't have permission to delete">
              Delete
            </button>
          }
        >
          <button
            className="btn-danger"
            onClick={() => deleteArticle(article.id)}
          >
            Delete
          </button>
        </Authorized>

        {/* Publish permission */}
        <Authorized permission="articles:publish">
          {article.status === 'draft' && (
            <button
              className="btn-primary"
              onClick={() => publishArticle(article.id)}
            >
              Publish
            </button>
          )}
        </Authorized>

        {/* Admin only */}
        <Authorized role="admin">
          <button
            className="btn-outline"
            onClick={() => viewAuditLog(article.id)}
          >
            Audit Log
          </button>
        </Authorized>
      </div>
    </div>
  );
}
```

### 3.4 useAuthorized Hook

```typescript
// hooks/useAuthorized.ts - Permission check as a hook
'use client';

import { useAuth } from '@/lib/auth-context';
import { useMemo } from 'react';

interface UseAuthorizedOptions {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  role?: string;
  anyRole?: string[];
}

interface UseAuthorizedResult {
  authorized: boolean;
  loading: boolean;
}

export function useAuthorized(options: UseAuthorizedOptions): UseAuthorizedResult {
  const { can, canAny, canAll, hasRole, hasAnyRole, permissionsLoading } = useAuth();

  const authorized = useMemo(() => {
    if (permissionsLoading) return false;

    if (options.permission) {
      const [resource, action] = options.permission.split(':');
      if (!can(action, resource)) return false;
    }

    if (options.anyPermission) {
      if (!canAny(options.anyPermission)) return false;
    }

    if (options.allPermissions) {
      if (!canAll(options.allPermissions)) return false;
    }

    if (options.role) {
      if (!hasRole(options.role)) return false;
    }

    if (options.anyRole) {
      if (!hasAnyRole(options.anyRole)) return false;
    }

    return true;
  }, [options, can, canAny, canAll, hasRole, hasAnyRole, permissionsLoading]);

  return {
    authorized,
    loading: permissionsLoading,
  };
}

// Usage example
function ArticleActions({ article }: { article: Article }) {
  const { authorized: canEdit } = useAuthorized({ permission: 'articles:update' });
  const { authorized: canDelete } = useAuthorized({ permission: 'articles:delete' });
  const { authorized: isAdmin } = useAuthorized({ role: 'admin' });

  return (
    <div className="flex gap-2">
      {canEdit && <EditButton articleId={article.id} />}
      {canDelete && <DeleteButton articleId={article.id} />}
      {isAdmin && <AdminActions articleId={article.id} />}
    </div>
  );
}
```

---

## 4. Navigation Permission Control

### 4.1 Permission-Based Navigation Definitions

```typescript
// lib/navigation.ts - Navigation item definitions
import {
  HomeIcon,
  DocumentIcon,
  UsersIcon,
  CogIcon,
  CreditCardIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;   // Required permission
  role?: string;         // Required role
  badge?: string;        // Badge display
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    // Accessible by all users
  },
  {
    label: 'Articles',
    href: '/articles',
    icon: DocumentIcon,
    permission: 'articles:read',
    children: [
      { label: 'List', href: '/articles', icon: DocumentIcon },
      { label: 'New', href: '/articles/new', icon: DocumentIcon, permission: 'articles:create' },
      { label: 'Drafts', href: '/articles/drafts', icon: DocumentIcon, permission: 'articles:update' },
    ],
  },
  {
    label: 'User Management',
    href: '/admin/users',
    icon: UsersIcon,
    permission: 'users:read',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    permission: 'analytics:read',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: CogIcon,
    children: [
      { label: 'General', href: '/settings/general', icon: CogIcon },
      { label: 'Billing', href: '/settings/billing', icon: CreditCardIcon, permission: 'billing:manage' },
      { label: 'Members', href: '/settings/members', icon: UsersIcon, permission: 'users:read' },
      { label: 'Security', href: '/settings/security', icon: ShieldCheckIcon, role: 'admin' },
    ],
  },
];
```

### 4.2 Sidebar Permission Filtering

```typescript
// components/sidebar.tsx - Permission-based sidebar
'use client';

import { useAuth } from '@/lib/auth-context';
import { navItems, type NavItem } from '@/lib/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function Sidebar() {
  const { can, hasRole, permissionsLoading } = useAuth();
  const pathname = usePathname();

  // Filter navigation items based on permissions
  const filterNavItems = (items: NavItem[]): NavItem[] => {
    return items
      .filter((item) => {
        // Permission check
        if (item.permission) {
          const [resource, action] = item.permission.split(':');
          if (!can(action, resource)) return false;
        }
        // Role check
        if (item.role && !hasRole(item.role)) return false;
        return true;
      })
      .map((item) => ({
        ...item,
        // Recursively filter children
        children: item.children ? filterNavItems(item.children) : undefined,
      }))
      // Hide parent items whose all children have been filtered out
      .filter((item) => {
        if (item.children && item.children.length === 0) return false;
        return true;
      });
  };

  // Show skeleton while permissions are loading
  if (permissionsLoading) {
    return <SidebarSkeleton />;
  }

  const visibleItems = filterNavItems(navItems);

  return (
    <nav className="w-64 bg-gray-900 text-white min-h-screen p-4">
      {visibleItems.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const [isOpen, setIsOpen] = useState(
    item.children?.some((child) => pathname.startsWith(child.href)) ?? false
  );
  const isActive = pathname === item.href;
  const Icon = item.icon;

  if (item.children && item.children.length > 0) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg
            hover:bg-gray-800 transition-colors ${
              isActive ? 'bg-gray-800' : ''
            }`}
        >
          <Icon className="w-5 h-5" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        {isOpen && (
          <div className="ml-4 mt-1 space-y-1">
            {item.children.map((child) => (
              <NavLink key={child.href} item={child} pathname={pathname} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg
        hover:bg-gray-800 transition-colors ${
          isActive ? 'bg-gray-800 text-white' : 'text-gray-300'
        }`}
    >
      <Icon className="w-5 h-5" />
      <span>{item.label}</span>
      {item.badge && (
        <span className="ml-auto bg-blue-500 text-xs px-2 py-0.5 rounded-full">
          {item.badge}
        </span>
      )}
    </Link>
  );
}
```

---

## 5. Authorization in Server Components

### 5.1 Server-Side Permission Evaluation (Recommended Pattern)

```typescript
// Authorization in Next.js Server Components (recommended)
// Check permissions on the server → don't send unnecessary data to the client

// app/articles/[id]/page.tsx
import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';

export default async function ArticlePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session) redirect('/login');

  // Fetch article data
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { name: true, image: true } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!article) notFound();

  // Evaluate permissions on the server side
  const permissions = {
    canEdit:
      session.user.role === 'admin' ||
      article.authorId === session.user.id,
    canPublish:
      ['admin', 'editor'].includes(session.user.role) &&
      article.status === 'draft',
    canDelete:
      session.user.role === 'admin',
    canModerateComments:
      ['admin', 'moderator'].includes(session.user.role),
    canViewAnalytics:
      session.user.role === 'admin' ||
      article.authorId === session.user.id,
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Article content (Server Component) */}
      <article>
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <AuthorInfo author={article.author} />
        <ArticleContent content={article.content} />
      </article>

      {/* Action bar (Client Component, permissions passed via props) */}
      <ArticleActions
        articleId={article.id}
        status={article.status}
        {...permissions}
      />

      {/* Comments section */}
      <CommentSection
        comments={article.comments}
        canModerate={permissions.canModerateComments}
      />

      {/* Analytics data (only fetched on server if authorized) */}
      {permissions.canViewAnalytics && (
        <ArticleAnalytics articleId={article.id} />
      )}
    </div>
  );
}
```

```typescript
// Client Component (receives permissions via props)
// Uses permission flags already evaluated on the server
'use client';

interface ArticleActionsProps {
  articleId: string;
  status: string;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
}

function ArticleActions({
  articleId,
  status,
  canEdit,
  canPublish,
  canDelete,
}: ArticleActionsProps) {
  return (
    <div className="flex gap-2 border-t border-b py-4 my-8">
      {canEdit && (
        <Link href={`/articles/${articleId}/edit`} className="btn-secondary">
          Edit
        </Link>
      )}
      {canPublish && (
        <button
          className="btn-primary"
          onClick={() => publishArticle(articleId)}
        >
          Publish
        </button>
      )}
      {canDelete && (
        <button
          className="btn-danger"
          onClick={() => {
            if (confirm('Are you sure you want to delete this?')) {
              deleteArticle(articleId);
            }
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}
```

### 5.2 When to Use Server Components vs Client Components

```
Comparison of authorization patterns for Server Components and Client Components:

  ┌──────────────────┬───────────────────┬──────────────────────┐
  │ Item             │ Server Component  │ Client Component     │
  ├──────────────────┼───────────────────┼──────────────────────┤
  │ Where checked    │ Server            │ Client               │
  │ Data fetching    │ Direct DB access  │ Via API              │
  │ Security         │ High (tamper-proof)│ Low (bypassable)    │
  │ Unnecessary data │ None              │ Permission data sent │
  │ Interactivity    │ None              │ Yes (onClick, etc.)  │
  │ Performance      │ High (no JS bundle)│ Permission fetch cost│
  │ Recommended use  │ Initial rendering │ Interactive UI       │
  └──────────────────┴───────────────────┴──────────────────────┘

  Recommended patterns:

  ① Initial rendering: Evaluate permissions in Server Component
     → Don't render unauthorized UI elements at all
     → Don't send unauthorized data to the client

  ② Interactive operations: Client Component + props
     → Pass permissions evaluated in Server Component as props
     → Client Component controls display based on flags

  ③ Dynamic permission changes: Client Component + Context
     → When permissions change in real time (e.g., role changes)
     → Fetch permissions from AuthContext for display control
```

---

## 6. Permission Prefetching and Caching

### 6.1 Prefetching with React Query

```typescript
// lib/permissions-provider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 30 * 60 * 1000,   // 30 minutes
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

```typescript
// hooks/usePermissions.ts
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

export function usePermissions() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['permissions'],
    queryFn: async (): Promise<Set<string>> => {
      const res = await fetch('/api/auth/permissions');
      if (!res.ok) throw new Error('Failed to fetch permissions');
      const data = await res.json();
      return new Set<string>(data.permissions);
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Automatically updated on login events
  });
}

// Manual permission refresh (on role or permission change)
export function useInvalidatePermissions() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['permissions'] });
  }, [queryClient]);
}

// Prefetch permissions (call immediately after login)
export function usePrefetchPermissions() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['permissions'],
      queryFn: async () => {
        const res = await fetch('/api/auth/permissions');
        const data = await res.json();
        return new Set<string>(data.permissions);
      },
    });
  }, [queryClient]);
}
```

### 6.2 Real-Time Permission Updates on Change

```typescript
// hooks/usePermissionsSync.ts
// Detect permission changes via WebSocket or Server-Sent Events

'use client';

import { useEffect } from 'react';
import { useInvalidatePermissions } from './usePermissions';
import { useSession } from 'next-auth/react';

export function usePermissionsSync() {
  const invalidatePermissions = useInvalidatePermissions();
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;

    // Monitor permission changes via Server-Sent Events
    const eventSource = new EventSource(
      `/api/auth/permissions/stream?userId=${session.user.id}`
    );

    eventSource.addEventListener('permissions_changed', () => {
      // Invalidate permission cache and refetch
      invalidatePermissions();
    });

    eventSource.addEventListener('role_changed', () => {
      invalidatePermissions();
    });

    eventSource.onerror = () => {
      // Reconnect after 5 seconds on connection error
      eventSource.close();
      setTimeout(() => {
        // Reconnection logic (implementation omitted)
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [session?.user?.id, invalidatePermissions]);
}
```

---

## 7. Declarative Authorization with CASL

### 7.1 CASL Overview

```
Features of CASL (Isomorphic Authorization):

  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ① Isomorphic: same rules on server and client     │
  │  ② Declarative: define rules to enable checks      │
  │  ③ React integration: Can component                │
  │  ④ TypeScript: type-safe permission definitions    │
  │  ⑤ Performance: caching of rule evaluation         │
  │                                                    │
  └────────────────────────────────────────────────────┘

  CASL vs custom implementation:

  ┌──────────────────┬──────────────────┬──────────────┐
  │ Item             │ CASL             │ Custom       │
  ├──────────────────┼──────────────────┼──────────────┤
  │ Rule definition  │ Declarative DSL  │ Procedural   │
  │ Conditional perms│ Built-in support │ Custom impl  │
  │ React integration│ @casl/react      │ Custom comp  │
  │ Field-level      │ Supported        │ Custom impl  │
  │ Learning cost    │ Medium           │ Low          │
  │ Bundle size      │ ~8KB (gzip)      │ No deps      │
  │ Recommended for  │ Complex ABAC     │ Simple RBAC  │
  └──────────────────┴──────────────────┴──────────────┘
```

### 7.2 CASL Implementation

```typescript
// lib/ability.ts - Permission definitions with CASL
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';

// Action type definitions
type Actions = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'manage';

// Subject (resource) type definitions
type Subjects =
  | 'Article'
  | 'Comment'
  | 'User'
  | 'Organization'
  | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

// Build Ability based on role
export function defineAbilityFor(user: {
  id: string;
  role: string;
  organizationId?: string;
}): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case 'admin':
      // Admin has all permissions
      can('manage', 'all');
      break;

    case 'editor':
      can('read', 'Article');
      can('create', 'Article');
      // Can only edit/delete/publish own articles
      can('update', 'Article', { authorId: user.id });
      can('delete', 'Article', { authorId: user.id });
      can('publish', 'Article', { authorId: user.id });
      // Comments
      can('read', 'Comment');
      can('create', 'Comment');
      can('update', 'Comment', { authorId: user.id });
      can('delete', 'Comment', { authorId: user.id });
      break;

    case 'viewer':
      can('read', 'Article');
      can('read', 'Comment');
      can('create', 'Comment');
      can('update', 'Comment', { authorId: user.id });
      // Published articles only
      cannot('read', 'Article', { status: 'draft' });
      break;

    default:
      // Guest: read published articles only
      can('read', 'Article', { status: 'published' });
  }

  return build();
}
```

```typescript
// components/can.tsx - CASL React component
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { createContextualCan } from '@casl/react';
import { type AppAbility } from '@/lib/ability';

// Ability context
const AbilityContext = createContext<AppAbility>(undefined!);

export function AbilityProvider({
  ability,
  children,
}: {
  ability: AppAbility;
  children: ReactNode;
}) {
  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}

export function useAbility(): AppAbility {
  return useContext(AbilityContext);
}

// CASL Can component
export const Can = createContextualCan(AbilityContext.Consumer);

// Usage example
function ArticleActions({ article }: { article: Article }) {
  return (
    <div className="flex gap-2">
      <Can I="update" this={article}>
        <Link href={`/articles/${article.id}/edit`}>Edit</Link>
      </Can>

      <Can I="delete" this={article}>
        <button onClick={() => deleteArticle(article.id)}>Delete</button>
      </Can>

      <Can I="publish" this={article}>
        {article.status === 'draft' && (
          <button onClick={() => publishArticle(article.id)}>Publish</button>
        )}
      </Can>

      {/* Negation with "not" */}
      <Can not I="update" this={article}>
        <p className="text-gray-500">You don't have permission to edit this article</p>
      </Can>
    </div>
  );
}
```

---

## 8. Error Pages and Fallbacks

### 8.1 Authorization Error Page Implementation

```typescript
// app/unauthorized/page.tsx - 403 Unauthorized page
import { auth } from '@/auth';
import Link from 'next/link';

export default async function UnauthorizedPage() {
  const session = await auth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-gray-300">403</div>
        <h1 className="text-2xl font-bold mt-4">Access Denied</h1>
        <p className="text-gray-600 mt-2">
          You do not have permission to access this page.
        </p>

        {session ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-gray-500">
              Logged in as: {session.user?.email}
              (Role: {session.user?.role})
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/dashboard" className="btn-primary">
                Back to Dashboard
              </Link>
              <Link href="/settings" className="btn-secondary">
                Check Permissions
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <Link href="/login" className="btn-primary">
              Log In
            </Link>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-8">
          If this problem persists, please contact an administrator.
        </p>
      </div>
    </div>
  );
}
```

---

## 9. Anti-Patterns

### 9.1 Frontend-Only Authorization

```typescript
// ✗ Dangerous: authorization on frontend only (no backend check)
function DeleteButton({ articleId }: { articleId: string }) {
  const { user } = useAuth();

  if (user?.role !== 'admin') return null; // This alone is insufficient!

  const handleDelete = async () => {
    // Without a permission check on the API side, anyone can call it directly
    await fetch(`/api/articles/${articleId}`, { method: 'DELETE' });
  };

  return <button onClick={handleDelete}>Delete</button>;
}

// ✓ Correct: check on both frontend and backend
// API side:
// if (session.user.role !== 'admin') {
//   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
// }
```

### 9.2 Hardcoding Permission Data

```typescript
// ✗ Problem: hardcoding permissions in the frontend
const ADMIN_EMAILS = ['admin@example.com', 'boss@example.com'];

function AdminPanel() {
  const { user } = useAuth();
  if (!ADMIN_EMAILS.includes(user?.email ?? '')) return null;
  return <AdminDashboard />;
}

// ✓ Correct: fetch permissions from the server
function AdminPanel() {
  const { hasRole } = useAuth();
  if (!hasRole('admin')) return null;
  return <AdminDashboard />;
}
```

### 9.3 Inconsistent Permission Checks

```typescript
// ✗ Problem: different logic on frontend and backend
// Frontend: editor can also publish
const canPublish = hasRole('editor') || hasRole('admin');

// Backend: only admin can publish
// if (user.role !== 'admin') return 403;

// → Editor clicks Publish button → gets 403 error
// → Poor UX (button is visible but fails)

// ✓ Correct: share permission logic between frontend and backend
// Define a shared permissions file and use it on both sides
// Or obtain permission flags from the permissions API
```

---

## 10. Exercises

### Exercise 1: Basic — Implement Route Guards and ProtectedRoute (Difficulty: Basic)

```
Task:
  In Next.js App Router, implement a route guard using Middleware
  and a ProtectedRoute component.

Requirements:
  ① /dashboard is accessible by all authenticated users
  ② /admin is for admin role only
  ③ /articles/new is for editor and admin only
  ④ Unauthenticated users are redirected to /login (with callbackUrl)
  ⑤ Insufficient permissions redirect to /unauthorized

Hints:
  → Use the auth() function to get the session inside Middleware
  → Restrict target paths using matcher

Verification:
  □ Unauthenticated access to /dashboard → redirects to /login
  □ Viewer accessing /admin → redirects to /unauthorized
  □ Editor accessing /articles/new → access granted
  □ Returns to the original page after login
```

### Exercise 2: Applied — Permission-Based UI Control (Difficulty: Applied)

```
Task:
  Implement AuthContext and the Authorized component, and apply
  permission-based UI control to an article management screen.

Requirements:
  ① Fetch permissions from API and cache them
  ② Conditional rendering using the Authorized component
  ③ Buttons without permission are hidden or disabled
  ④ Navigation permission filtering
  ⑤ Initial permission evaluation in Server Component

Hints:
  → Cache permissions with React Query
  → Layer structure: AuthProvider → Authorized → useAuth
  → Pass permission flags from Server Component via props

Verification:
  □ Viewer can only view articles
  □ Editor can create, edit, and delete articles
  □ Admin can perform all operations
  □ Navigation changes based on permissions
```

### Exercise 3: Advanced — CASL + Real-Time Permission Updates (Difficulty: Advanced)

```
Task:
  Implement declarative authorization using the CASL library
  and real-time permission updates via WebSocket.

Requirements:
  ① Define conditional authorization with CASL (e.g., only edit own articles)
  ② UI control using the Can component
  ③ Notify permission changes in real time via WebSocket
  ④ Admin changes another user's role → UI updates immediately
  ⑤ Field-level permissions (restrict editing of specific fields)

Hints:
  → Use @casl/ability + @casl/react
  → Use the subject() helper to specify resource type
  → WebSocket: use socket.io-client

Verification:
  □ Editor can only edit their own articles
  □ Admin changes a role → target user's UI changes immediately
  □ Field-level restrictions work correctly
```

---

## 11. FAQ

### Q1: Should I perform permission checks in Server Components or Client Components?

```
A: Server Components are recommended wherever possible.

Reasons:
  → Evaluated on the server, so cannot be tampered with
  → Unauthorized data is never sent to the client
  → Reduces JS bundle size (permission logic stays on the server)

When to use Client Components:
  → Interactive UI (onClick, state changes)
  → When real-time permission updates are needed
  → Dynamic display toggling based on user interaction

Recommended pattern:
  Evaluate permissions in Server Component → pass as boolean flags
  to Client Components via props
```

### Q2: How long should the permission cache TTL be?

```
A: 5 minutes is generally recommended.

Considerations:
  → Too short: more API calls, reduced performance
  → Too long: delay before permission changes take effect

  ┌──────────────┬──────────────────────────────────┐
  │ staleTime    │ Use case                         │
  ├──────────────┼──────────────────────────────────┤
  │ 1 minute     │ When strict permission control is needed │
  │ 5 min (rec.) │ General web applications         │
  │ 15 minutes   │ When permission changes are rare  │
  │ Real-time    │ WebSocket + invalidate            │
  └──────────────┴──────────────────────────────────┘

  When real-time behavior is required:
  → Notify permission changes via WebSocket / SSE
  → Immediately update cache via invalidateQueries
```

### Q3: Should I completely hide navigation items the user doesn't have access to?

```
A: It depends on the situation.

When to hide completely:
  → When the existence of a page should not be known for security reasons
  → Admin features (regular users have no need to know)

When to show as disabled / grayed out:
  → When you want users to know the feature exists (to encourage upgrades)
  → "Available with a Pro plan upgrade"

Recommendations:
  → Security-related: hide completely
  → Business-related: disabled + tooltip explanation
```

### Q4: What are the best practices for permission management in large-scale apps?

```
A: The following structure is recommended.

  ① Permission definitions: centralized file (lib/permissions.ts)
  ② Permission fetching: dedicated API + React Query cache
  ③ Permission checks: AuthContext + Authorized component
  ④ Route guard: Middleware (coarse-grained check)
  ⑤ Page level: Server Components (fine-grained check)
  ⑥ UI level: Authorized component / Can (CASL)
  ⑦ API level: final check on backend (mandatory)

Example of centralized permission definitions:
  // lib/permissions.ts
  export const PERMISSIONS = {
    ARTICLES_CREATE: 'articles:create',
    ARTICLES_READ: 'articles:read',
    // ...
  } as const;

  // Use the same constants on both frontend and backend
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world development?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and when designing system architecture.

---

## Summary

| Item | Key Point |
|------|-----------|
| Principle | Frontend = UX optimization, Backend = security guarantee |
| Route guards | Implemented with Next.js Middleware + Auth.js |
| UI control | AuthContext + Authorized component |
| Server Components | Evaluate permissions on server → pass to client via props (recommended) |
| Navigation | Recursive filtering based on permissions |
| Caching | React Query with 5-minute cache, instant update via WebSocket |
| CASL | Best for complex conditional authorization. Simple RBAC can be custom-built |
| Required | Frontend authorization is supplementary. API-level authorization is mandatory |

---

## Further Reading


---

## References

1. OWASP. "Authorization Testing." owasp.org, 2024.
2. Next.js. "Middleware." nextjs.org/docs/app/building-your-application/routing/middleware, 2024.
3. CASL. "React Integration." casl.js.org/v6/en/package/casl-react, 2024.
4. TanStack. "React Query." tanstack.com/query/latest, 2024.
5. Auth.js. "Session Management." authjs.dev/getting-started/session-management, 2024.
6. React Router. "Authentication." reactrouter.com/en/main/start/concepts, 2024.
