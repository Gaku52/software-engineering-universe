# Client-Side Routing

> Client routing is the foundational technology of SPAs. Master all modern client routing patterns: React Router v6, TanStack Router's type-safe routing, loaders/actions, and route splitting.

## What You Will Learn

- [ ] Deeply understand how client-side routing works and the History API
- [ ] Use React Router v6's data routing (loader/action) in practice
- [ ] Understand TanStack Router's type-safe routing
- [ ] Learn implementation patterns for code splitting and preloading
- [ ] Understand security and access control for routing
- [ ] Master performance optimization and troubleshooting techniques

---

## 1. Fundamentals of Routing

### 1.1 Server-Side Routing vs Client-Side Routing

In web applications, there are broadly two approaches to routing. Understanding the characteristics of each is the first step toward selecting an appropriate architecture.

```
Server-side routing (traditional approach):
  Browser → HTTP request to server → Server generates HTML → Browser renders full page

  [User clicks a link]
       ↓
  [Browser sends GET request to server]
       ↓
  [Server consults routing table]
       ↓
  [Corresponding controller/handler runs]
       ↓
  [Full HTML page generated]
       ↓
  [Browser reloads and renders the full page]

  Characteristics:
  - Flash of unstyled content (FOUC) on each page transition
  - High server load
  - Naturally SEO-friendly
  - Works even with JavaScript disabled

Client-side routing (SPA approach):
  Browser → URL change via History API → JavaScript switches components → Partial update only

  [User clicks a link]
       ↓
  [JavaScript intercepts the event (preventDefault)]
       ↓
  [URL rewritten via History API]
       ↓
  [Router identifies component matching new URL]
       ↓
  [Only the matching component is rendered]
       ↓
  [Partial DOM update]

  Characteristics:
  - Instant page transitions (near-native app experience)
  - Light server load (only API requests)
  - Heavy initial load (download of entire JS bundle)
  - Requires additional effort for SEO
```

### 1.2 Details of the History API

At the core of client-side routing is the browser's History API. A precise understanding of this API lets you grasp the internal workings of routing libraries.

```typescript
// === Basic History API operations ===

// 1. pushState: Add a new entry to the history stack
// Change URL without a page reload
history.pushState(
  { userId: 123, page: 'profile' },  // state object (any data)
  '',                                  // title (ignored by most browsers)
  '/users/123/profile'                // new URL
);

// 2. replaceState: Replace the current history entry
// Used for redirects or after form submission
history.replaceState(
  { redirectedFrom: '/old-path' },
  '',
  '/new-path'
);

// 3. popstate event: Detect browser back/forward button
window.addEventListener('popstate', (event) => {
  console.log('Navigation detected');
  console.log('State:', event.state);  // state passed to pushState
  console.log('Current URL:', window.location.href);

  // Execute routing logic here
  handleRouteChange(window.location.pathname);
});

// 4. Manipulating history
history.back();      // Same as browser "back"
history.forward();   // Same as browser "forward"
history.go(-2);      // Go back 2 pages
history.go(0);       // Reload current page

// 5. Getting current state
console.log(history.state);   // state of current entry
console.log(history.length);  // number of entries in history stack
```

```typescript
// === Minimal client-side router implementation ===
// Educational implementation to understand the internals of routing libraries

interface Route {
  path: string;
  pattern: RegExp;
  paramNames: string[];
  handler: (params: Record<string, string>) => void;
}

class SimpleRouter {
  private routes: Route[] = [];
  private currentPath: string = '';

  constructor() {
    // Handle browser back/forward via popstate event
    window.addEventListener('popstate', () => {
      this.handleRouteChange(window.location.pathname);
    });

    // Intercept all link clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && anchor.href && anchor.origin === window.location.origin) {
        e.preventDefault();
        this.navigate(anchor.pathname);
      }
    });
  }

  // Register a route
  addRoute(path: string, handler: (params: Record<string, string>) => void): void {
    const paramNames: string[] = [];

    // Convert path pattern to a regular expression
    // Example: '/users/:userId/posts/:postId' → /^\/users\/([^\/]+)\/posts\/([^\/]+)$/
    const patternStr = path.replace(/:(\w+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    this.routes.push({
      path,
      pattern: new RegExp(`^${patternStr}$`),
      paramNames,
      handler,
    });
  }

  // Programmatic navigation
  navigate(path: string, options?: { replace?: boolean }): void {
    if (options?.replace) {
      history.replaceState({ path }, '', path);
    } else {
      history.pushState({ path }, '', path);
    }
    this.handleRouteChange(path);
  }

  // Route matching and handler execution
  private handleRouteChange(path: string): void {
    this.currentPath = path;

    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        // Extract parameters
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });

        route.handler(params);
        return;
      }
    }

    // 404: No matching route found
    console.warn(`No route matched for path: ${path}`);
    this.handle404();
  }

  private handle404(): void {
    document.getElementById('app')!.innerHTML = '<h1>404 - Page Not Found</h1>';
  }
}

// Usage example
const router = new SimpleRouter();

router.addRoute('/', () => {
  document.getElementById('app')!.innerHTML = '<h1>Home</h1>';
});

router.addRoute('/users', () => {
  document.getElementById('app')!.innerHTML = '<h1>Users List</h1>';
});

router.addRoute('/users/:userId', (params) => {
  document.getElementById('app')!.innerHTML = `<h1>User: ${params.userId}</h1>`;
});

router.addRoute('/users/:userId/posts/:postId', (params) => {
  document.getElementById('app')!.innerHTML =
    `<h1>User ${params.userId} - Post ${params.postId}</h1>`;
});

// Process the initial route
router.navigate(window.location.pathname, { replace: true });
```

### 1.3 Hash Router vs Browser Router

```
Hash Router:
  URL format: https://example.com/#/users/123

  How it works:
  - Uses the hash portion of the URL (everything after #)
  - Detects changes via the hashchange event
  - The hash portion is not sent to the server

  Advantages:
  ✓ No server configuration required at all
  ✓ Works out of the box with static file hosting
  ✓ Ideal for GitHub Pages, S3 static hosting
  ✓ Works with older browsers

  Disadvantages:
  ✗ Ugly URLs (contain #)
  ✗ Bad for SEO (crawlers may ignore content after #)
  ✗ Difficult to combine with SSR
  ✗ Conflicts with anchor links (in-page links)

  Use cases:
  - Admin panels / dashboards (no SEO needed)
  - Routing inside Electron apps
  - Static hosting environments (where server config is not possible)

Browser Router:
  URL format: https://example.com/users/123

  How it works:
  - Uses History API's pushState/replaceState
  - Detects changes via popstate event
  - Uses ordinary URL paths

  Advantages:
  ✓ Clean URLs
  ✓ Easy to support SEO
  ✓ Can be combined with SSR / SSG
  ✓ Anchor links work correctly

  Disadvantages:
  ✗ Requires SPA fallback configuration on the server
  ✗ Misconfiguration results in 404 errors on direct access

  Server configuration examples:

  Nginx:
    location / {
      try_files $uri $uri/ /index.html;
    }

  Apache (.htaccess):
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]

  Vercel (vercel.json):
    { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }

  Netlify (_redirects):
    /*    /index.html   200

Memory Router:
  URL format: URL is not changed (memory only)

  How it works:
  - Manages history in an in-memory array
  - Browser's URL bar is not changed

  Use cases:
  - Test environments (Jest, Vitest)
  - React Native
  - UI component development in Storybook
  - Applications inside iframes
```

```typescript
// === Hash Router implementation ===
import { createHashRouter, RouterProvider } from 'react-router-dom';

const hashRouter = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'users', element: <Users /> },
    ],
  },
]);

// URL: https://example.com/#/users

// === Browser Router implementation ===
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const browserRouter = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'users', element: <Users /> },
    ],
  },
]);

// URL: https://example.com/users

// === Memory Router implementation (for testing) ===
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// Usage example in tests
function renderWithRouter(element: React.ReactElement, initialEntries = ['/']) {
  const routes = [
    {
      path: '/',
      element: <RootLayout />,
      children: [
        { index: true, element: <Home /> },
        { path: 'users', element: <Users /> },
        { path: 'users/:userId', element: <UserDetail /> },
      ],
    },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries,
    initialIndex: 0,
  });

  return render(<RouterProvider router={router} />);
}

// Test code
describe('UserDetail', () => {
  it('should display user information', async () => {
    renderWithRouter(<UserDetail />, ['/users/42']);
    expect(await screen.findByText('User #42')).toBeInTheDocument();
  });
});
```

### 1.4 Routing Lifecycle

Navigation in client-side routing is processed through the following lifecycle.

```
Navigation lifecycle:

1. Trigger
   ├── User action (link click, form submission)
   ├── Programmatic (navigate(), router.push())
   └── Browser action (back, forward, direct URL entry)

2. Guard/Middleware check
   ├── Authentication check (is user logged in?)
   ├── Authorization check (does user have access?)
   ├── Leave confirmation (are there unsaved changes?)
   └── Redirect determination

3. URL update
   ├── pushState / replaceState executed
   └── Browser URL bar is updated

4. Route matching
   ├── Search for a route matching the new URL
   ├── Extraction of path parameters
   ├── Parsing of query parameters
   └── Wildcard/catch-all matching

5. Data fetching (loader execution)
   ├── Parallel data fetching
   ├── Cache check
   └── Loading state management

6. Rendering
   ├── Mounting new component
   ├── Preserving shared layouts
   ├── Animation/transitions
   └── Scroll position restoration

7. Post-processing
   ├── Page title update
   ├── Analytics event sending
   ├── Focus management (accessibility)
   └── Meta tag update
```

---

## 2. React Router v6 Deep Dive

### 2.1 Basic Route Definitions

React Router v6 offers two approaches: the traditional `<Routes>` component-based definition and the new data routing (`createBrowserRouter`). Data routing is currently recommended.

```typescript
// === Approach 1: Component-based (legacy, kept for backward compatibility) ===
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="users" element={<UsersLayout />}>
            <Route index element={<UserList />} />
            <Route path=":userId" element={<UserDetail />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function RootLayout() {
  return (
    <div>
      <nav>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
      <main>
        <Outlet /> {/* Child routes are rendered here */}
      </main>
    </div>
  );
}

// === Approach 2: Data routing (recommended) ===
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useLoaderData,
  useActionData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
  redirect,
  json,
} from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      {
        index: true,
        element: <HomePage />,
        loader: homeLoader,
      },
      {
        path: 'users',
        element: <UsersLayout />,
        errorElement: <UsersErrorBoundary />,
        children: [
          {
            index: true,
            element: <UserList />,
            loader: usersLoader,
          },
          {
            path: ':userId',
            element: <UserDetail />,
            loader: userDetailLoader,
            children: [
              {
                path: 'edit',
                element: <UserEdit />,
                loader: userEditLoader,
                action: userEditAction,
              },
            ],
          },
          {
            path: 'new',
            element: <CreateUser />,
            action: createUserAction,
          },
        ],
      },
      {
        path: 'settings',
        lazy: () => import('./pages/Settings'),
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        loader: adminLoader,  // Authentication check
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'users', element: <AdminUserManagement /> },
          { path: 'analytics', element: <AdminAnalytics /> },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}
```

### 2.2 Loader Pattern (Data Fetching)

Loaders were introduced in React Router v6.4 as a mechanism for route-level data fetching. They fetch data before the component renders, resolving the waterfall problem.

```typescript
// === Basic Loader ===
import type { LoaderFunctionArgs } from 'react-router-dom';

// Simple data fetching
async function usersLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '20');
  const search = url.searchParams.get('q') ?? '';

  const response = await fetch(
    `/api/users?page=${page}&limit=${limit}&q=${encodeURIComponent(search)}`,
    {
      signal: request.signal, // Cancel the request when navigation is cancelled
    }
  );

  if (!response.ok) {
    // Throwing an error response is caught by errorElement
    throw new Response('Failed to fetch users', {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json();
}

// Loader with parameters
async function userDetailLoader({ params, request }: LoaderFunctionArgs) {
  const { userId } = params;

  if (!userId) {
    throw new Response('User ID is required', { status: 400 });
  }

  const response = await fetch(`/api/users/${userId}`, {
    signal: request.signal,
  });

  if (response.status === 404) {
    throw new Response('User not found', { status: 404 });
  }

  if (!response.ok) {
    throw new Response('Server error', { status: 500 });
  }

  return response.json();
}

// Loader with authentication guard
async function adminLoader({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to login page (preserving the original URL)
    const url = new URL(request.url);
    return redirect(`/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }

  if (user.role !== 'admin') {
    throw new Response('Forbidden: Admin access required', { status: 403 });
  }

  return { user };
}

// Parallel data fetching (using Promise.all)
async function dashboardLoader({ request }: LoaderFunctionArgs) {
  const [stats, recentUsers, notifications] = await Promise.all([
    fetch('/api/stats', { signal: request.signal }).then(r => r.json()),
    fetch('/api/users/recent', { signal: request.signal }).then(r => r.json()),
    fetch('/api/notifications', { signal: request.signal }).then(r => r.json()),
  ]);

  return { stats, recentUsers, notifications };
}

// Staged data fetching with defer
import { defer, Await } from 'react-router-dom';

async function dashboardLoaderWithDefer({ request }: LoaderFunctionArgs) {
  // Important data is fetched immediately (awaited)
  const stats = await fetch('/api/stats', { signal: request.signal })
    .then(r => r.json());

  // Lower-priority data is fetched lazily (returned as a Promise)
  const recentUsersPromise = fetch('/api/users/recent', { signal: request.signal })
    .then(r => r.json());
  const notificationsPromise = fetch('/api/notifications', { signal: request.signal })
    .then(r => r.json());

  return defer({
    stats,                                    // Available immediately
    recentUsers: recentUsersPromise,          // Displayed lazily with Suspense
    notifications: notificationsPromise,      // Displayed lazily with Suspense
  });
}

// Component using defer
function Dashboard() {
  const { stats, recentUsers, notifications } = useLoaderData() as {
    stats: StatsData;
    recentUsers: Promise<User[]>;
    notifications: Promise<Notification[]>;
  };

  return (
    <div>
      {/* Shown immediately */}
      <StatsPanel data={stats} />

      {/* Shows Skeleton until data arrives */}
      <Suspense fallback={<UserListSkeleton />}>
        <Await resolve={recentUsers} errorElement={<UserListError />}>
          {(users: User[]) => <RecentUsersList users={users} />}
        </Await>
      </Suspense>

      <Suspense fallback={<NotificationsSkeleton />}>
        <Await resolve={notifications} errorElement={<NotificationsError />}>
          {(items: Notification[]) => <NotificationsList items={items} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

### 2.3 Action Pattern (Data Mutation)

Actions are a mechanism for handling form submissions and data mutations. They emulate the behavior of HTML `<form>` while intercepting with JavaScript, enabling progressive enhancement.

```typescript
// === Basic Action ===
import type { ActionFunctionArgs } from 'react-router-dom';

// Create user action
async function createUserAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  // Validation
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;

  const errors: Record<string, string> = {};

  if (!name || name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!email || !email.includes('@')) {
    errors.email = 'Please enter a valid email address';
  }
  if (!role || !['admin', 'user', 'viewer'].includes(role)) {
    errors.role = 'Please select a valid role';
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors, values: { name, email, role } }, { status: 400 });
  }

  // API call
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      return json(
        { errors: { server: error.message }, values: { name, email, role } },
        { status: response.status }
      );
    }

    const user = await response.json();
    return redirect(`/users/${user.id}`);
  } catch (error) {
    return json(
      { errors: { server: 'A network error occurred' }, values: { name, email, role } },
      { status: 500 }
    );
  }
}

// Edit user action
async function userEditAction({ request, params }: ActionFunctionArgs) {
  const { userId } = params;
  const formData = await request.formData();
  const intent = formData.get('intent');

  // Intent pattern: handle multiple operations in a single Action
  switch (intent) {
    case 'update': {
      const name = formData.get('name') as string;
      const email = formData.get('email') as string;

      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      return redirect(`/users/${userId}`);
    }

    case 'delete': {
      await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      return redirect('/users');
    }

    case 'deactivate': {
      await fetch(`/api/users/${userId}/deactivate`, { method: 'POST' });
      return json({ success: true, message: 'User has been deactivated' });
    }

    default:
      return json({ error: 'Unknown intent' }, { status: 400 });
  }
}

// === Form component using Action ===
import { Form, useActionData, useNavigation } from 'react-router-dom';

function CreateUserForm() {
  const actionData = useActionData() as {
    errors?: Record<string, string>;
    values?: Record<string, string>;
  } | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Form method="post" className="user-form">
      <div className="form-field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={actionData?.values?.name}
          aria-invalid={!!actionData?.errors?.name}
          aria-describedby={actionData?.errors?.name ? 'name-error' : undefined}
        />
        {actionData?.errors?.name && (
          <p id="name-error" className="error">{actionData.errors.name}</p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={actionData?.values?.email}
          aria-invalid={!!actionData?.errors?.email}
          aria-describedby={actionData?.errors?.email ? 'email-error' : undefined}
        />
        {actionData?.errors?.email && (
          <p id="email-error" className="error">{actionData.errors.email}</p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="role">Role</label>
        <select
          id="role"
          name="role"
          defaultValue={actionData?.values?.role ?? 'user'}
        >
          <option value="user">Regular User</option>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
        {actionData?.errors?.role && (
          <p className="error">{actionData.errors.role}</p>
        )}
      </div>

      {actionData?.errors?.server && (
        <div className="alert alert-error">{actionData.errors.server}</div>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Create User'}
      </button>
    </Form>
  );
}

// === useFetcher: Data operations without navigation ===
import { useFetcher } from 'react-router-dom';

function UserRow({ user }: { user: User }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state === 'submitting'
    && fetcher.formData?.get('intent') === 'delete';

  if (isDeleting) {
    // Optimistic UI: hide row while deleting
    return null;
  }

  return (
    <tr>
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td>
        {/* fetcher.Form does not trigger navigation */}
        <fetcher.Form method="post" action={`/users/${user.id}/edit`}>
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            onClick={(e) => {
              if (!confirm('Are you sure you want to delete this?')) {
                e.preventDefault();
              }
            }}
          >
            Delete
          </button>
        </fetcher.Form>
      </td>
    </tr>
  );
}

// === Concurrent operations using multiple useFetchers ===
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}

function TodoItem({ todo }: { todo: Todo }) {
  const toggleFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  // Optimistic UI
  const isToggling = toggleFetcher.state !== 'idle';
  const isDeleting = deleteFetcher.state !== 'idle';

  const optimisticCompleted = isToggling ? !todo.completed : todo.completed;

  if (isDeleting) return null;

  return (
    <li style={{ opacity: isToggling ? 0.5 : 1 }}>
      <toggleFetcher.Form method="post" action={`/todos/${todo.id}`}>
        <input type="hidden" name="intent" value="toggle" />
        <input type="hidden" name="completed" value={String(!todo.completed)} />
        <button type="submit">
          {optimisticCompleted ? '✓' : '○'}
        </button>
      </toggleFetcher.Form>

      <span className={optimisticCompleted ? 'completed' : ''}>
        {todo.title}
      </span>

      <deleteFetcher.Form method="post" action={`/todos/${todo.id}`}>
        <input type="hidden" name="intent" value="delete" />
        <button type="submit">Delete</button>
      </deleteFetcher.Form>
    </li>
  );
}
```

### 2.4 Error Handling

```typescript
// === Error Boundary ===
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

function RootErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    // When a Response object is thrown
    switch (error.status) {
      case 401:
        return (
          <div className="error-page">
            <h1>Authentication Required</h1>
            <p>You need to be logged in to access this page.</p>
            <Link to="/login">Go to Login</Link>
          </div>
        );
      case 403:
        return (
          <div className="error-page">
            <h1>Access Denied</h1>
            <p>You do not have permission to view this page.</p>
            <Link to="/">Back to Home</Link>
          </div>
        );
      case 404:
        return (
          <div className="error-page">
            <h1>Page Not Found</h1>
            <p>The page you are looking for does not exist or has been moved.</p>
            <Link to="/">Back to Home</Link>
          </div>
        );
      default:
        return (
          <div className="error-page">
            <h1>An Error Occurred</h1>
            <p>Status code: {error.status}</p>
            <p>{error.statusText}</p>
            <Link to="/">Back to Home</Link>
          </div>
        );
    }
  }

  // Unexpected error (JavaScript error, etc.)
  console.error('Unexpected error:', error);

  return (
    <div className="error-page">
      <h1>An Unexpected Error Occurred</h1>
      <p>We apologize. Something went wrong.</p>
      <pre>{error instanceof Error ? error.message : 'Unknown error'}</pre>
      <button onClick={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  );
}

// Error boundary for child routes
function UsersErrorBoundary() {
  const error = useRouteError();

  return (
    <div className="error-container">
      <h2>Failed to Load User Information</h2>
      {isRouteErrorResponse(error) && error.status === 404 ? (
        <p>The specified user does not exist.</p>
      ) : (
        <p>An error occurred while communicating with the server. Please try again later.</p>
      )}
      <Link to="/users">Back to Users List</Link>
    </div>
  );
}
```

### 2.5 Navigation State Management

```typescript
// === useNavigation: Global navigation state ===
import { useNavigation } from 'react-router-dom';

function GlobalLoadingIndicator() {
  const navigation = useNavigation();

  // navigation.state values:
  // 'idle'       - doing nothing
  // 'loading'    - loader is running (GET navigation)
  // 'submitting' - action is running (POST/PUT/DELETE)

  if (navigation.state === 'idle') return null;

  return (
    <div className="global-loading-bar">
      <div
        className="progress"
        style={{
          width: navigation.state === 'submitting' ? '30%' : '70%'
        }}
      />
    </div>
  );
}

// NProgress-style loading bar
function NProgressBar() {
  const navigation = useNavigation();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (navigation.state !== 'idle') {
      setProgress(30);
      const timer1 = setTimeout(() => setProgress(60), 200);
      const timer2 = setTimeout(() => setProgress(80), 500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setProgress(100);
      const timer = setTimeout(() => setProgress(0), 300);
      return () => clearTimeout(timer);
    }
  }, [navigation.state]);

  if (progress === 0) return null;

  return (
    <div
      className="nprogress-bar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '3px',
        width: `${progress}%`,
        backgroundColor: '#0070f3',
        transition: progress === 100 ? 'width 0.2s' : 'width 0.5s ease',
        zIndex: 9999,
      }}
    />
  );
}

// === Detailed useNavigation info ===
function DebugNavigation() {
  const navigation = useNavigation();

  return (
    <div className="debug-panel">
      <h4>Navigation State</h4>
      <dl>
        <dt>State</dt>
        <dd>{navigation.state}</dd>

        <dt>Location</dt>
        <dd>{navigation.location?.pathname ?? 'N/A'}</dd>

        <dt>Form Method</dt>
        <dd>{navigation.formMethod ?? 'N/A'}</dd>

        <dt>Form Action</dt>
        <dd>{navigation.formAction ?? 'N/A'}</dd>

        <dt>Form Data</dt>
        <dd>
          {navigation.formData
            ? JSON.stringify(Object.fromEntries(navigation.formData))
            : 'N/A'}
        </dd>
      </dl>
    </div>
  );
}
```

### 2.6 Programmatic Navigation

```typescript
// === useNavigate hook ===
import { useNavigate, useSearchParams } from 'react-router-dom';

function UserProfile() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.auth.logout();
    // Redirect to login page
    navigate('/login', { replace: true }); // Replace history (prevents going back)
  };

  const handleEditClick = () => {
    // Navigate with relative path
    navigate('edit');  // From /users/123 goes to /users/123/edit
  };

  const handleBackClick = () => {
    navigate(-1); // Same as browser back
  };

  const handleNavigateWithState = () => {
    // Navigate while passing state
    navigate('/checkout', {
      state: {
        fromPage: 'cart',
        selectedItems: [1, 2, 3],
      },
    });
  };

  return (
    <div>
      <button onClick={handleEditClick}>Edit</button>
      <button onClick={handleBackClick}>Back</button>
      <button onClick={handleLogout}>Logout</button>
      <button onClick={handleNavigateWithState}>Checkout</button>
    </div>
  );
}

// === useSearchParams: Query parameter management ===
function UserSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1');
  const sort = searchParams.get('sort') ?? 'name';

  const handleSearch = (newQuery: string) => {
    setSearchParams((prev) => {
      prev.set('q', newQuery);
      prev.set('page', '1'); // Reset page on search
      return prev;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      prev.set('page', String(newPage));
      return prev;
    });
  };

  const handleSortChange = (newSort: string) => {
    setSearchParams((prev) => {
      prev.set('sort', newSort);
      prev.set('page', '1');
      return prev;
    });
  };

  return (
    <div>
      <SearchInput value={query} onChange={handleSearch} />
      <SortSelector value={sort} onChange={handleSortChange} />
      <UserList query={query} page={page} sort={sort} />
      <Pagination page={page} onChange={handlePageChange} />
    </div>
  );
}

// === useLocation: Current location info ===
import { useLocation } from 'react-router-dom';

function CheckoutPage() {
  const location = useLocation();
  const state = location.state as { fromPage?: string; selectedItems?: number[] } | null;

  // Contents of the location object:
  // {
  //   pathname: '/checkout',
  //   search: '?coupon=SAVE20',
  //   hash: '#summary',
  //   state: { fromPage: 'cart', selectedItems: [1, 2, 3] },
  //   key: 'default'
  // }

  return (
    <div>
      {state?.fromPage === 'cart' && (
        <p>Came from cart. Selected items: {state.selectedItems?.join(', ')}</p>
      )}
    </div>
  );
}

// === Navigation tracking for analytics ===
function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    // Send page view to Google Analytics
    if (typeof window.gtag !== 'undefined') {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: location.pathname + location.search,
      });
    }

    // Update page title
    const routeTitles: Record<string, string> = {
      '/': 'Home',
      '/users': 'Users',
      '/settings': 'Settings',
      '/about': 'About',
    };
    document.title = routeTitles[location.pathname] ?? 'MyApp';
  }, [location]);

  return null; // Does not render UI
}
```

---

## 3. TanStack Router Deep Dive

### 3.1 Basics of Type-Safe Routing

TanStack Router is a library that provides 100% type-safe routing. Path parameters, search params, and loader data are all strictly checked by TypeScript's type system.

```typescript
// === TanStack Router: Fully type-safe routing ===
import {
  createRouter,
  createRoute,
  createRootRoute,
  createRootRouteWithContext,
  Outlet,
  Link,
  useParams,
  useSearch,
  useLoaderData,
  useNavigate,
} from '@tanstack/react-router';

// Type-safe route definitions
const rootRoute = createRootRoute({
  component: () => (
    <div>
      <nav>
        {/* Link's to only allows defined routes */}
        <Link to="/">Home</Link>
        <Link to="/users" search={{ page: 1 }}>Users</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet />
    </div>
  ),
  notFoundComponent: () => <div>Page Not Found</div>,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <h1>Home Page</h1>,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: () => <h1>About This Service</h1>,
});

// Type-safe search params validation
import { z } from 'zod';

const usersSearchSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  q: z.string().optional(),
  sort: z.enum(['name', 'email', 'createdAt']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

type UsersSearch = z.infer<typeof usersSearchSchema>;

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  validateSearch: usersSearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    limit: search.limit,
    q: search.q,
    sort: search.sort,
    order: search.order,
  }),
  loader: async ({ deps }) => {
    const params = new URLSearchParams({
      page: String(deps.page),
      limit: String(deps.limit),
      sort: deps.sort,
      order: deps.order,
      ...(deps.q ? { q: deps.q } : {}),
    });
    const response = await fetch(`/api/users?${params}`);
    return response.json() as Promise<{
      users: User[];
      total: number;
      hasMore: boolean;
    }>;
  },
  component: UsersPage,
});

function UsersPage() {
  // Everything is type-safe: search is of type UsersSearch
  const search = useSearch({ from: '/users' });
  const { users, total, hasMore } = useLoaderData({ from: '/users' });
  const navigate = useNavigate();

  const handlePageChange = (newPage: number) => {
    navigate({
      to: '/users',
      search: (prev) => ({
        ...prev,
        page: newPage,
      }),
    });
  };

  const handleSearchChange = (query: string) => {
    navigate({
      to: '/users',
      search: (prev) => ({
        ...prev,
        q: query || undefined,
        page: 1, // Reset page on search
      }),
    });
  };

  return (
    <div>
      <h1>Users ({total} total)</h1>
      <SearchInput value={search.q ?? ''} onChange={handleSearchChange} />
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {/* Type check for params: userId is guaranteed to be a string */}
            <Link
              to="/users/$userId"
              params={{ userId: String(user.id) }}
            >
              {user.name}
            </Link>
          </li>
        ))}
      </ul>
      <Pagination
        page={search.page}
        hasMore={hasMore}
        onChange={handlePageChange}
      />
    </div>
  );
}

// Type-safe route with dynamic parameter
const userDetailRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: '$userId',
  loader: async ({ params }) => {
    // params.userId is automatically of type string
    const response = await fetch(`/api/users/${params.userId}`);
    if (!response.ok) throw new Error('User not found');
    return response.json() as Promise<User>;
  },
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = useParams({ from: '/users/$userId' });
  const user = useLoaderData({ from: '/users/$userId' });

  return (
    <div>
      <h1>{user.name}</h1>
      <p>ID: {userId}</p>
      <p>Email: {user.email}</p>
    </div>
  );
}

// Building the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  usersRoute.addChildren([
    userDetailRoute,
  ]),
]);

// Create the router
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',    // Preload on hover
  defaultPreloadDelay: 100,    // Delay before preloading starts
});

// Type declaration for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Application entry point
function App() {
  return <RouterProvider router={router} />;
}
```

### 3.2 Routing with Context

```typescript
// === Injecting authentication context ===
import { createRootRouteWithContext } from '@tanstack/react-router';

interface RouterContext {
  auth: {
    user: User | null;
    isAuthenticated: boolean;
    login: (credentials: Credentials) => Promise<void>;
    logout: () => Promise<void>;
  };
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

// Route with authentication guard
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: async ({ context }) => {
    // Get authentication info from context
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: '/dashboard' },
      });
    }
  },
  loader: async ({ context }) => {
    // Integration with TanStack Query
    return context.queryClient.ensureQueryData({
      queryKey: ['dashboard'],
      queryFn: fetchDashboardData,
    });
  },
  component: DashboardPage,
});

// Inject context into the router
const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // Provided at app render time
    queryClient,
  },
});

function App() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth, queryClient }} />;
}
```

### 3.3 TanStack Router and TanStack Query Integration

```typescript
// === Full integration with TanStack Query ===
import { queryOptions } from '@tanstack/react-query';

// Define query options
const usersQueryOptions = (search: UsersSearch) =>
  queryOptions({
    queryKey: ['users', search],
    queryFn: () => fetchUsers(search),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['users', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000,
  });

// Utilize Query in route definition
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  validateSearch: usersSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    // ensureQueryData returns cache if available, otherwise fetches
    await context.queryClient.ensureQueryData(usersQueryOptions(deps));
  },
  component: UsersPage,
});

function UsersPage() {
  const search = useSearch({ from: '/users' });
  // In components, use useSuspenseQuery for type-safe data access
  const { data } = useSuspenseQuery(usersQueryOptions(search));

  return (
    <div>
      {data.users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}

// Using Prefetch
function UserCard({ user }: { user: User }) {
  const queryClient = useQueryClient();

  return (
    <Link
      to="/users/$userId"
      params={{ userId: String(user.id) }}
      // Prefetch data on hover
      preload="intent"
      onMouseEnter={() => {
        queryClient.prefetchQuery(userQueryOptions(String(user.id)));
      }}
    >
      {user.name}
    </Link>
  );
}
```

---

## 4. Code Splitting and Performance Optimization

### 4.1 Route-Based Code Splitting

```typescript
// === React.lazy + Suspense (basic pattern) ===
import { lazy, Suspense } from 'react';

const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </Suspense>
  );
}

// === React Router's lazy (recommended: can also split loader/action) ===
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        path: 'settings',
        lazy: async () => {
          // Split not just the component but also loader/action
          const { Settings, settingsLoader, settingsAction } =
            await import('./pages/Settings');
          return {
            Component: Settings,
            loader: settingsLoader,
            action: settingsAction,
          };
        },
      },
      {
        path: 'analytics',
        lazy: async () => {
          const { Analytics, analyticsLoader } =
            await import('./pages/Analytics');
          return {
            Component: Analytics,
            loader: analyticsLoader,
          };
        },
      },
      {
        path: 'admin',
        lazy: async () => {
          const { AdminLayout, adminLoader } =
            await import('./pages/admin/AdminLayout');
          return {
            Component: AdminLayout,
            loader: adminLoader,
          };
        },
        children: [
          {
            index: true,
            lazy: async () => {
              const { AdminDashboard, dashboardLoader } =
                await import('./pages/admin/Dashboard');
              return {
                Component: AdminDashboard,
                loader: dashboardLoader,
              };
            },
          },
          {
            path: 'users',
            lazy: async () => {
              const { AdminUsers, adminUsersLoader } =
                await import('./pages/admin/Users');
              return {
                Component: AdminUsers,
                loader: adminUsersLoader,
              };
            },
          },
        ],
      },
    ],
  },
]);

// === TanStack Router's code splitting ===
// TanStack Router supports automatic route file splitting
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
}).lazy(() => import('./routes/users.lazy').then((m) => m.Route));

// routes/users.lazy.ts
import { createLazyRoute } from '@tanstack/react-router';

export const Route = createLazyRoute('/users')({
  component: UsersPage,
  pendingComponent: UsersSkeleton,
  errorComponent: UsersError,
});
```

### 4.2 Preload Strategy

```typescript
// === Preloading on hover (most effective) ===
import { usePrefetchableLink } from './hooks/usePrefetchableLink';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const prefetch = () => {
    // Method 1: Pre-fetch chunks via link[rel=prefetch]
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = `/assets/pages/${to.replace(/^\//, '')}.js`;
    document.head.appendChild(link);
  };

  return (
    <Link to={to} onMouseEnter={prefetch} onFocus={prefetch}>
      {children}
    </Link>
  );
}

// === Preloading with React Router ===
// With data routing, use router.preloadRoute
function PrefetchableLink({ to, children }: { to: string; children: React.ReactNode }) {
  const router = useRouter();

  const handleMouseEnter = () => {
    // Pre-run the route's lazy component and loader
    router.preloadRoute(to);
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}

// === TanStack Router preload configuration ===
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',   // 'intent' = preload on hover/focus
  defaultPreloadDelay: 50,     // 50ms delay (ignore fast mouse-overs)
  defaultPreloadStaleTime: 30_000, // Preload data expiry (30 seconds)
});

// Control preloading per link
<Link to="/users" preload="viewport">  {/* Preload when in viewport */}
  Users
</Link>

<Link to="/settings" preload="intent">  {/* Preload on hover/focus */}
  Settings
</Link>

<Link to="/about" preload={false}>  {/* No preloading */}
  About
</Link>

// === Viewport preload using Intersection Observer ===
function ViewportPrefetchLink({ to, children }: { to: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [prefetched, setPrefetched] = useState(false);

  useEffect(() => {
    if (!ref.current || prefetched) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Prefetch when entering viewport
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = `/assets/pages/${to.replace(/^\//, '')}.js`;
          document.head.appendChild(link);
          setPrefetched(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Prefetch 100px before entering
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, prefetched]);

  return (
    <Link ref={ref} to={to}>
      {children}
    </Link>
  );
}
```

### 4.3 Scroll Position Management

```typescript
// === React Router scroll restoration ===
import { ScrollRestoration } from 'react-router-dom';

function RootLayout() {
  return (
    <div>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      {/* Automatically manage scroll position on navigation */}
      <ScrollRestoration
        getKey={(location) => {
          // Restore scroll position using URL path as key
          // Default is location.key (per browser history entry)
          return location.pathname;
        }}
      />
    </div>
  );
}

// === Custom scroll management ===
function useScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    // Scroll to top if no hash
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Scroll to the matching element if there is a hash
      const element = document.getElementById(location.hash.slice(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location.pathname, location.hash]);
}

// Preserving scroll position in an infinite scroll list
function InfiniteUserList() {
  const [scrollPosition, setScrollPosition] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Save scroll position to state
  useEffect(() => {
    const handleScroll = () => {
      if (listRef.current) {
        setScrollPosition(listRef.current.scrollTop);
      }
    };

    const list = listRef.current;
    list?.addEventListener('scroll', handleScroll);
    return () => list?.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position when returning
  useEffect(() => {
    const savedPosition = location.state?.scrollPosition;
    if (savedPosition && listRef.current) {
      listRef.current.scrollTop = savedPosition;
    }
  }, [location.state]);

  const handleItemClick = (userId: string) => {
    navigate(`/users/${userId}`, {
      state: { scrollPosition },
    });
  };

  return (
    <div ref={listRef} style={{ height: '100vh', overflow: 'auto' }}>
      {users.map((user) => (
        <div key={user.id} onClick={() => handleItemClick(user.id)}>
          {user.name}
        </div>
      ))}
    </div>
  );
}
```

---

## 5. Authentication, Authorization, and Route Guards

### 5.1 Authentication Pattern Implementation

Authentication in routing is one of the most important elements for ensuring application security. Note that client-side authentication guards are merely for UX improvement, and true security must be guaranteed on the server side.

```typescript
// === Authentication pattern with React Router ===

// Approach 1: Loader-based authentication guard (recommended)
async function protectedLoader({ request }: LoaderFunctionArgs) {
  const token = getAuthToken();

  if (!token) {
    const url = new URL(request.url);
    return redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }

  // Verify token validity with server
  try {
    const response = await fetch('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
      signal: request.signal,
    });

    if (!response.ok) {
      // Invalid token: redirect to login page
      clearAuthToken();
      return redirect('/login?reason=session_expired');
    }

    const user = await response.json();
    return { user };
  } catch (error) {
    throw new Response('Authentication service unavailable', { status: 503 });
  }
}

// Approach 2: Authentication guard via layout route
const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage />, action: loginAction },
      { path: 'register', element: <RegisterPage />, action: registerAction },
    ],
  },
  {
    path: '/app',
    element: <AuthenticatedLayout />,
    loader: protectedLoader,  // Apply authentication to all child routes
    errorElement: <AuthErrorBoundary />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'profile', element: <Profile /> },
      {
        path: 'admin',
        loader: adminRoleLoader,  // Additional permission check
        element: <AdminPanel />,
        children: [
          { index: true, element: <AdminOverview /> },
          { path: 'users', element: <AdminUsers /> },
        ],
      },
    ],
  },
]);

// Role-based access control (RBAC)
async function adminRoleLoader({ request }: LoaderFunctionArgs) {
  const parentData = await protectedLoader({ request } as LoaderFunctionArgs);

  if ('user' in parentData && parentData.user.role !== 'admin') {
    throw new Response('Forbidden: Admin access required', { status: 403 });
  }

  return parentData;
}

// === Login action ===
async function loginAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const errors: Record<string, string> = {};
  if (!email) errors.email = 'Please enter your email address';
  if (!password) errors.password = 'Please enter your password';

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 401) {
      return json({
        errors: { form: 'Incorrect email address or password' },
      }, { status: 401 });
    }

    if (!response.ok) {
      return json({
        errors: { form: 'Login failed. Please try again later' },
      }, { status: 500 });
    }

    const { token } = await response.json();
    setAuthToken(token);

    // Redirect to the page before login
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo') ?? '/app';
    return redirect(redirectTo);
  } catch (error) {
    return json({
      errors: { form: 'A network error occurred' },
    }, { status: 500 });
  }
}
```

### 5.2 Unsaved Changes Guard

```typescript
// === Preventing navigation with useBlocker ===
import { useBlocker } from 'react-router-dom';

function EditForm() {
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });

  // Block navigation when the form has changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  return (
    <div>
      <Form
        method="post"
        onChange={() => setIsDirty(true)}
        onSubmit={() => setIsDirty(false)}
      >
        <input
          name="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
        <input
          name="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        />
        <button type="submit">Save</button>
      </Form>

      {/* Confirmation dialog when blocked */}
      {blocker.state === 'blocked' && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Changes Not Saved</h2>
            <p>If you leave this page, your changes will be lost.</p>
            <div className="modal-actions">
              <button onClick={() => blocker.proceed()}>
                Discard Changes and Leave
              </button>
              <button onClick={() => blocker.reset()}>
                Stay on This Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Combining with beforeunload (when closing browser tab) ===
function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Browser's standard dialog is shown
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}

function EditPage() {
  const [isDirty, setIsDirty] = useState(false);

  // Warning when closing/reloading browser tab
  useUnsavedChangesWarning(isDirty);

  // Warning for React Router navigation
  const blocker = useBlocker(isDirty);

  return (
    <div>
      {/* Form content */}
    </div>
  );
}
```

---

## 6. Page Transition Animations

### 6.1 Using the View Transitions API

```typescript
// === View Transitions API (supports modern browsers) ===
import { useNavigate } from 'react-router-dom';

function AnimatedLink({ to, children }: { to: string; children: React.ReactNode }) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (document.startViewTransition) {
      // When View Transitions API is supported
      document.startViewTransition(() => {
        navigate(to);
      });
    } else {
      // Fallback: normal navigation
      navigate(to);
    }
  };

  return (
    <a href={to} onClick={handleClick}>
      {children}
    </a>
  );
}

// Define transition animations in CSS
// styles.css:
// ::view-transition-old(root) {
//   animation: fade-out 0.15s ease-in;
// }
// ::view-transition-new(root) {
//   animation: fade-in 0.15s ease-out;
// }
// @keyframes fade-out {
//   from { opacity: 1; }
//   to { opacity: 0; }
// }
// @keyframes fade-in {
//   from { opacity: 0; }
//   to { opacity: 1; }
// }

// === Page transitions using framer-motion ===
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, Outlet } from 'react-router-dom';

function AnimatedLayout() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

// Use AnimatedLayout in route definition
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        element: <AnimatedLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'about', element: <About /> },
          { path: 'users', element: <Users /> },
        ],
      },
    ],
  },
]);

// === Animation with controlled slide direction ===
function DirectionalLayout() {
  const location = useLocation();
  const [direction, setDirection] = useState(1);
  const previousPath = useRef(location.pathname);

  // Determine slide direction based on path depth
  useEffect(() => {
    const prevDepth = previousPath.current.split('/').length;
    const currentDepth = location.pathname.split('/').length;
    setDirection(currentDepth >= prevDepth ? 1 : -1);
    previousPath.current = location.pathname;
  }, [location.pathname]);

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={location.pathname}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## 7. Anti-Patterns and Cautions

### 7.1 Common Anti-Patterns

```typescript
// === Anti-pattern 1: Navigation inside useEffect (conditional redirect) ===

// Bad: Component-level redirect
function ProtectedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Problem: Redirect happens after the component mounts,
  // so protected content briefly flashes
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) return null; // Returns null to prevent flash, but insufficient

  return <div>Protected Content</div>;
}

// Good: Loader-level redirect
async function protectedLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser();
  if (!user) {
    return redirect('/login');
  }
  return { user };
}
// Redirect happens before the component renders


// === Anti-pattern 2: State management and URL inconsistency ===

// Bad: Managing filter state with useState
function UserList() {
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);
  // Problem: Filter state is not restored when URL is shared
  // State is also not restored with browser back
  return <div>...</div>;
}

// Good: Manage filter state with URL parameters
function UserList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') ?? 'active';
  const page = Number(searchParams.get('page') ?? '1');
  // URL: /users?filter=active&page=1
  // The same state is restored by sharing the URL
  // Also works correctly with browser back
  return <div>...</div>;
}


// === Anti-pattern 3: Hardcoded paths ===

// Bad: Scattering path string literals
function Navigation() {
  return (
    <nav>
      <Link to="/users">Users</Link>
      <Link to="/users/new">New User</Link>
      <Link to="/settings/profile">Profile Settings</Link>
    </nav>
  );
}

// Good: Centralize route paths as constants
const ROUTES = {
  HOME: '/',
  USERS: {
    LIST: '/users',
    NEW: '/users/new',
    DETAIL: (id: string) => `/users/${id}`,
    EDIT: (id: string) => `/users/${id}/edit`,
  },
  SETTINGS: {
    ROOT: '/settings',
    PROFILE: '/settings/profile',
    NOTIFICATIONS: '/settings/notifications',
  },
  ADMIN: {
    ROOT: '/admin',
    USERS: '/admin/users',
    ANALYTICS: '/admin/analytics',
  },
} as const;

function Navigation() {
  return (
    <nav>
      <Link to={ROUTES.USERS.LIST}>Users</Link>
      <Link to={ROUTES.USERS.NEW}>New User</Link>
      <Link to={ROUTES.SETTINGS.PROFILE}>Profile Settings</Link>
    </nav>
  );
}

// With TanStack Router, paths can be specified with type safety, so this problem doesn't arise


// === Anti-pattern 4: Direct navigation via window.location ===

// Bad: Using window.location loses all SPA state
function LogoutButton() {
  const handleLogout = () => {
    clearToken();
    window.location.href = '/login'; // Full page reload occurs
  };
  return <button onClick={handleLogout}>Logout</button>;
}

// Good: Use the router's navigation functionality
function LogoutButton() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await api.auth.logout();
    clearToken();
    navigate('/login', { replace: true }); // Navigate within the SPA
  };
  return <button onClick={handleLogout}>Logout</button>;
}
// Exception: For external site redirects (OAuth callback etc.), use window.location


// === Anti-pattern 5: Excessively nested routes ===

// Bad: Unnecessarily deep nesting
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout1 />,
    children: [{
      element: <Layout2 />,
      children: [{
        element: <Layout3 />,
        children: [{
          path: 'users',
          element: <Users />,
          // Must go through 3 levels of Outlet
        }],
      }],
    }],
  },
]);

// Good: Flat structure with only necessary layouts nested
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'users', element: <Users /> },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
        ],
      },
    ],
  },
]);
```

### 7.2 Security Considerations

```
Security for client-side routing:

1. Do not trust client-side authentication
   - Route guards are for UX improvement only
   - True access control is implemented on the API server
   - JWT expiry checks are also done on the server
   - Role determination on the frontend is reference information only

2. Path parameter injection countermeasures
   - Consider the possibility of malicious values in :userId
   - Validate parameters inside loader/action
   - Sanitize before passing to APIs

3. Open Redirect prevention
   - Validate redirectTo parameter
   - Prohibit redirects to external URLs
   - Restrict redirect destinations with a whitelist

4. Prevent sensitive information exposure in URLs
   - Do not include tokens or secret data in path parameters
   - Do not include personal information in search params
   - Use state to pass sensitive data (but note it remains in browser history)

5. CSRF countermeasures
   - Verify CSRF tokens on form submissions in actions
   - Configure SameSite Cookie
```

```typescript
// === Open Redirect prevention example ===
function safeRedirect(to: string, defaultRedirect: string = '/'): string {
  // Verify that the redirect destination is safe
  if (
    !to ||
    !to.startsWith('/') ||    // Only allow relative paths
    to.startsWith('//') ||    // Reject protocol-relative URLs
    to.includes('\\')         // Reject backslashes
  ) {
    return defaultRedirect;
  }

  // Check allowed path prefixes
  const allowedPrefixes = ['/app', '/dashboard', '/settings', '/users'];
  const isAllowed = allowedPrefixes.some((prefix) => to.startsWith(prefix));

  return isAllowed ? to : defaultRedirect;
}

// Usage example
async function loginAction({ request }: ActionFunctionArgs) {
  // ... login processing ...

  const url = new URL(request.url);
  const redirectTo = safeRedirect(
    url.searchParams.get('redirectTo') ?? '',
    '/app'
  );

  return redirect(redirectTo);
}

// === Parameter validation ===
import { z } from 'zod';

const userIdSchema = z.string().regex(/^\d+$/, 'User ID must be numeric');

async function userLoader({ params }: LoaderFunctionArgs) {
  const result = userIdSchema.safeParse(params.userId);

  if (!result.success) {
    throw new Response('Invalid user ID format', { status: 400 });
  }

  const response = await fetch(`/api/users/${result.data}`);
  if (!response.ok) {
    throw new Response('User not found', { status: 404 });
  }

  return response.json();
}
```

---

## 8. Testing Strategy

### 8.1 Routing Tests

```typescript
// === Testing React Router ===
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// Test router factory
function createTestRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <Home /> },
          {
            path: 'users',
            element: <UserList />,
            loader: () => [
              { id: 1, name: 'Alice' },
              { id: 2, name: 'Bob' },
            ],
          },
          {
            path: 'users/:userId',
            element: <UserDetail />,
            loader: ({ params }) => ({
              id: params.userId,
              name: `User ${params.userId}`,
            }),
          },
          {
            path: 'login',
            element: <LoginPage />,
            action: loginAction,
          },
        ],
      },
    ],
    { initialEntries }
  );
}

// Test cases
describe('Routing', () => {
  it('should render the home page at /', () => {
    const router = createTestRouter(['/']);
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('should navigate to users page', async () => {
    const router = createTestRouter(['/']);
    render(<RouterProvider router={router} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Users' }));

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('should display user detail with correct params', async () => {
    const router = createTestRouter(['/users/42']);
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('User 42')).toBeInTheDocument();
    });
  });

  it('should handle loader errors', async () => {
    const failingRouter = createMemoryRouter(
      [
        {
          path: '/',
          element: <div />,
          errorElement: <div>An error occurred</div>,
          loader: () => {
            throw new Response('Not Found', { status: 404 });
          },
        },
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={failingRouter} />);

    await waitFor(() => {
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });
  });

  it('should handle form submission', async () => {
    const router = createTestRouter(['/login']);
    render(<RouterProvider router={router} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      // Verify redirect after successful login
      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
  });
});

// === Unit tests for Loader/Action ===
describe('usersLoader', () => {
  it('should fetch users with pagination', async () => {
    // API mock
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]),
    });

    const request = new Request('http://localhost/users?page=2&limit=10');
    const result = await usersLoader({ request, params: {} } as LoaderFunctionArgs);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result).toHaveLength(2);
  });

  it('should throw on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const request = new Request('http://localhost/users');

    await expect(
      usersLoader({ request, params: {} } as LoaderFunctionArgs)
    ).rejects.toBeInstanceOf(Response);
  });
});
```

---

## 9. Routing Library Comparison and Selection Guide

### 9.1 Detailed Comparison Table

| Item | React Router v6 | TanStack Router | Next.js App Router |
|------|-----------------|-----------------|---------------------|
| **Type safety** | Partial (manual typing) | Full (auto inference) | Partial |
| **Search Params** | Manual (useSearchParams) | Built-in validation | nuqs recommended |
| **Data fetching** | loader/action | loader/beforeLoad | Server Components |
| **Code splitting** | lazy() | lazy routes + auto split | Automatic (file-based) |
| **SSR support** | Via Remix | SSR support available | First class |
| **File-based** | Not supported (manual) | Available via plugin | Default |
| **Bundle size** | ~14KB (gzip) | ~12KB (gzip) | Included in Next.js |
| **Learning cost** | Low to medium | Medium | Medium to high |
| **Ecosystem** | Largest (most widely used) | Growing | Next.js ecosystem |
| **Preload** | Manual implementation | Built-in (intent/viewport) | Automatic |
| **Devtools** | None | Official Devtools | Next.js Devtools |
| **Middleware** | Via loader | beforeLoad | middleware.ts |
| **Error handling** | errorElement | errorComponent | error.tsx |
| **Pending UI** | useNavigation | pendingComponent | loading.tsx |
| **Optimistic UI** | useFetcher | Manual | useOptimistic |
| **Initial release** | 2014 (v1) | 2022 | 2023 (App Router) |

### 9.2 Selection Flowchart

```
Selecting a routing library:

Q1: Are you using a full-stack framework?
  Yes → Q2: Choosing Next.js?
    Yes → Use Next.js App Router
    No  → Q3: Choosing Remix?
      Yes → Use React Router (built into Remix)
      No  → Use the selected framework's router

  No → Q4: How much do you value type safety?
    Top priority → TanStack Router
      - Need type-safe validation of search params
      - Need automatic type inference for path parameters
      - Want to leverage TypeScript to the fullest

    Important but not required → Q5: What is the project scale?
      Large-scale / long-term → TanStack Router
        - Great benefit from type safety
        - Safety when refactoring
        - Can handle a growing codebase

      Small to medium scale → React Router v6
        - Extensive documentation and community
        - Low learning cost
        - Many tutorials and examples available

    Not a priority → React Router v6
      - The most widely used standard
      - Easy for teams to adopt
```

### 9.3 Migration Strategy

```typescript
// === React Router v5 → v6 migration ===

// v5 style
import { Switch, Route, useHistory, useParams } from 'react-router-dom';

function AppV5() {
  return (
    <Switch>
      <Route exact path="/" component={Home} />
      <Route path="/users/:userId" component={UserDetail} />
      <Route component={NotFound} />  {/* 404 */}
    </Switch>
  );
}

function UserDetailV5() {
  const { userId } = useParams<{ userId: string }>();
  const history = useHistory();

  const handleBack = () => history.push('/users');

  return <div>User: {userId}</div>;
}

// v6 style
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';

function AppV6() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/users/:userId" element={<UserDetail />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function UserDetailV6() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const handleBack = () => navigate('/users');

  return <div>User: {userId}</div>;
}

// Migration checklist:
// 1. Switch → Routes
// 2. component/render → element (pass as JSX)
// 3. Remove exact (v6 defaults to exact match)
// 4. useHistory → useNavigate
// 5. history.push() → navigate()
// 6. history.replace() → navigate(path, { replace: true })
// 7. Redirect → Navigate component
// 8. Change nested route structure to Outlet-based
// 9. Remove withRouter HOC, replace with hooks
// 10. activeClassName → className callback (NavLink)
```

---

## 10. Troubleshooting

### 10.1 Common Issues and Solutions

```
Issue 1: Direct browser URL access returns 404
  Cause: Server does not support SPA fallback
  Solutions:
  - Nginx: try_files $uri $uri/ /index.html;
  - Vercel: Add rewrites to vercel.json
  - Netlify: Place _redirects file in public/
  - Express: app.get('*', (req, res) => res.sendFile('index.html'));
  - Dev environment: Vite handles this automatically (historyApiFallback)

Issue 2: Scroll position does not reset after page transition
  Cause: ScrollRestoration is not configured
  Solutions:
  - React Router: Add <ScrollRestoration /> component
  - TanStack Router: Configure the scrollRestoration option
  - Manual: Run window.scrollTo(0, 0) in useEffect

Issue 3: Outlet is not shown in nested routes
  Cause: <Outlet /> component is not placed in the parent route
  Solutions:
  - Add <Outlet /> to the parent route component
  - Check the structure of layout components

Issue 4: useLoaderData returns undefined
  Cause: loader is not set in the route definition,
        or createBrowserRouter is not being used
  Solutions:
  - Add a loader function to the route definition
  - Migrate from BrowserRouter to createBrowserRouter
  - Confirm that data routing API is being used

Issue 5: NavLink's active style is not applied correctly
  Cause: Incorrect path matching configuration
  Solutions:
  - Add end property to NavLink for root path
    <NavLink to="/" end>Home</NavLink>
  - Specify className in function form
    <NavLink to="/users" className={({ isActive }) =>
      isActive ? 'active' : ''
    }>

Issue 6: Loader runs multiple times
  Cause: Double execution in React Strict Mode,
        or triggered by search params changes
  Solutions:
  - Strict Mode is development only (runs once in production)
  - Utilize caching inside loader (e.g., TanStack Query)
  - Explicitly declare dependencies with loaderDeps (TanStack Router)

Issue 7: Lazy route chunk loading fails
  Cause: Old chunk files deleted after deployment
  Solutions:
  - Suggest reload from error boundary
  - Manage cache with Service Worker
  - Add hashes to chunk files (default in Vite/Webpack)
  - Execute full reload with window.location.reload()

Issue 8: Form data disappears on browser back
  Cause: State inconsistency when restoring from browser bfcache
  Solutions:
  - Save form data to sessionStorage
  - Use location.state to retain data
  - Implement leave confirmation with useBlocker
```

```typescript
// === Chunk load error recovery ===
const router = createBrowserRouter([
  {
    path: '/settings',
    lazy: async () => {
      try {
        const { Settings } = await import('./pages/Settings');
        return { Component: Settings };
      } catch (error) {
        // Fallback when chunk loading fails
        if (
          error instanceof TypeError &&
          error.message.includes('Failed to fetch dynamically imported module')
        ) {
          // A new version may have been deployed
          // Reload the page to get the latest manifest
          window.location.reload();
          return { Component: () => <div>Reloading...</div> };
        }
        throw error;
      }
    },
  },
]);

// === Routing log for debugging ===
function RouteLogger() {
  const location = useLocation();
  const navigation = useNavigation();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group(`[Router] Navigation to ${location.pathname}`);
      console.log('Search:', location.search);
      console.log('Hash:', location.hash);
      console.log('State:', location.state);
      console.log('Key:', location.key);
      console.groupEnd();
    }
  }, [location]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && navigation.state !== 'idle') {
      console.log(
        `[Router] ${navigation.state}: ${navigation.location?.pathname ?? 'unknown'}`
      );
    }
  }, [navigation]);

  return null;
}
```

---

## 11. Accessibility and Routing

### 11.1 Focus Management

In client-side routing, the browser's default focus management does not work on page transitions, so developers need to explicitly control focus.

```typescript
// === Focus management on page transitions ===
function useFocusOnNavigate() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Move focus to main content after page transition
    if (mainRef.current) {
      mainRef.current.focus();
    }

    // Notify screen reader of page change
    const pageTitle = document.title;
    const announcement = document.getElementById('route-announcement');
    if (announcement) {
      announcement.textContent = `Navigated to ${pageTitle}`;
    }
  }, [location.pathname]);

  return mainRef;
}

function RootLayout() {
  const mainRef = useFocusOnNavigate();

  return (
    <div>
      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Live region for screen readers */}
      <div
        id="route-announcement"
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      <nav aria-label="Main navigation">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/users">Users</NavLink>
      </nav>

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}  // Make it focusable programmatically
        style={{ outline: 'none' }}  // Hide focus ring
      >
        <Outlet />
      </main>
    </div>
  );
}

// === CSS: Skip link ===
// .skip-link {
//   position: absolute;
//   top: -40px;
//   left: 0;
//   background: #000;
//   color: #fff;
//   padding: 8px;
//   z-index: 100;
//   transition: top 0.2s;
// }
// .skip-link:focus {
//   top: 0;
// }
// .sr-only {
//   position: absolute;
//   width: 1px;
//   height: 1px;
//   padding: 0;
//   margin: -1px;
//   overflow: hidden;
//   clip: rect(0, 0, 0, 0);
//   white-space: nowrap;
//   border: 0;
// }
```

### 11.2 Accessible Links and Navigation

```typescript
// === Navigation using aria attributes ===
function AccessibleNavigation() {
  const location = useLocation();

  return (
    <nav aria-label="Main navigation">
      <ul role="menubar">
        <li role="none">
          <NavLink
            to="/"
            end
            role="menuitem"
            aria-current={location.pathname === '/' ? 'page' : undefined}
          >
            Home
          </NavLink>
        </li>
        <li role="none">
          <NavLink
            to="/users"
            role="menuitem"
            aria-current={location.pathname.startsWith('/users') ? 'page' : undefined}
          >
            Users
          </NavLink>
        </li>
        <li role="none">
          <NavLink
            to="/settings"
            role="menuitem"
            aria-current={location.pathname.startsWith('/settings') ? 'page' : undefined}
          >
            Settings
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

// === Breadcrumbs ===
import { useMatches, Link } from 'react-router-dom';

function Breadcrumbs() {
  const matches = useMatches();

  // Filter only routes that have breadcrumb info in handle
  const crumbs = matches.filter((match) =>
    (match.handle as any)?.breadcrumb
  );

  return (
    <nav aria-label="Breadcrumbs">
      <ol className="breadcrumbs">
        {crumbs.map((match, index) => {
          const isLast = index === crumbs.length - 1;
          const breadcrumb = (match.handle as any).breadcrumb(match.data);

          return (
            <li key={match.id}>
              {isLast ? (
                <span aria-current="page">{breadcrumb}</span>
              ) : (
                <Link to={match.pathname}>{breadcrumb}</Link>
              )}
              {!isLast && <span aria-hidden="true"> / </span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Set breadcrumb info in route definition
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    handle: { breadcrumb: () => 'Home' },
    children: [
      {
        path: 'users',
        element: <UsersLayout />,
        handle: { breadcrumb: () => 'Users' },
        loader: usersLoader,
        children: [
          {
            path: ':userId',
            element: <UserDetail />,
            handle: {
              breadcrumb: (data: User) => data.name,
            },
            loader: userDetailLoader,
          },
        ],
      },
    ],
  },
]);
```

---

## Summary

### Quick Reference for Routing Library Selection

| Use Case | Recommended Library | Reason |
|----------|-------------------|--------|
| Vite + React (new project) | React Router v6 | Most standard, extensive docs |
| Type safety above all | TanStack Router | Full type inference including search params |
| Full-stack React | Next.js App Router | First-class SSR/RSC support |
| Remix project | React Router (built-in) | Remix's standard router |
| Admin panel / dashboard | React Router v6 (Hash) | No server config needed |
| Large TypeScript project | TanStack Router | Refactoring safety, developer experience |
| SEO-important site | Next.js App Router | Automatic SSR/SSG support |

### Implementation Checklist

```
Routing implementation checklist:

Basic setup:
  [ ] Router type selected (Browser / Hash / Memory)
  [ ] Server SPA fallback configured
  [ ] 404 page implemented
  [ ] Error boundaries placed

Data fetching:
  [ ] Data fetching implemented in loader
  [ ] Cancellation support via request.signal
  [ ] Staged data fetching with defer
  [ ] Error handling (network errors, 404, etc.)

Authentication/authorization:
  [ ] Authentication guard (loader-based)
  [ ] Role-based access control
  [ ] Redirect URL safety validation
  [ ] Login flow implemented

Performance:
  [ ] Route-based code splitting
  [ ] Preload strategy configured
  [ ] Scroll position restoration
  [ ] Loading UI implemented

Accessibility:
  [ ] Focus management (on page transitions)
  [ ] Skip link implemented
  [ ] aria-current set (navigation)
  [ ] Screen reader notified of page changes

Testing:
  [ ] Routing integration tests
  [ ] Loader/action unit tests
  [ ] Error path tests
  [ ] Authentication flow tests
```

---

## Prerequisites

To get the most out of this chapter, it is recommended to have the following knowledge:

- **URL State Management**: Design patterns for treating URLs as part of application state → `../01-state-management/03-url-state.md`
- **Browser History API**: How `pushState`, `replaceState`, and `popstate` events work
- **SPA/MPA/SSR concepts**: Architectural differences and routing requirements for each → `../00-architecture/00-spa-mpa-ssr.md`

Understanding these concepts enables you to make more appropriate design decisions for client-side routing.

---

## FAQ

### Q1: What is the difference between Hash routing and History routing?

**A:** Hash routing uses the URL fragment (everything after `#`), so no server configuration is required and it works with older browsers. History routing uses the History API to achieve clean URLs, but requires SPA fallback configuration on the server side.

```
Hash Routing:
  URL: https://example.com/#/users/123
  Advantages:
    - No server configuration needed (# and beyond is not sent to server)
    - Supports older browsers
    - Works out of the box on static hosting like GitHub Pages
  Disadvantages:
    - Bad for SEO (crawlers may ignore content after #)
    - Ugly URLs

History Routing:
  URL: https://example.com/users/123
  Advantages:
    - Clean, SEO-friendly URLs
    - Better user experience
  Disadvantages:
    - SPA fallback configuration required on server
      (e.g., return index.html for all paths)
```

**Recommendation**: For new projects, adopt History routing and configure the server accordingly. Use Hash routing only in static hosting environments.

### Q2: What are the criteria for choosing a routing library?

**A:** Decide based on project scale, type safety requirements, team familiarity, and degree of framework integration.

```
Selection criteria matrix:

1. Project scale
   Small to medium (~50 routes) → React Router v6 (simple, low learning cost)
   Large (50+ routes) → TanStack Router (type-safe, easy to refactor)

2. Type safety
   TypeScript + type safety priority → TanStack Router (type inference including search params)
   JavaScript or loose types → React Router v6

3. Framework integration
   Next.js → App Router (file-based)
   Remix → React Router (built-in)
   Vite + React → React Router v6 or TanStack Router

4. Team familiarity
   Many React Router veterans → React Router v6 (easy migration)
   New team → TanStack Router (latest patterns)
```

### Q3: How do I implement dynamic routing and what are the caveats?

**A:** Define path parameters as URL segments and retrieve them inside the component. Always implement validation and error handling.

```typescript
// React Router v6 example
// Route definition
<Route path="/users/:userId/posts/:postId" element={<PostDetail />} />

// Get inside component
import { useParams } from 'react-router-dom';

function PostDetail() {
  const { userId, postId } = useParams<{ userId: string; postId: string }>();

  // Note: useParams always returns string | undefined
  // Conversion and validation is needed when treating as numbers

  const userIdNum = Number(userId);
  const postIdNum = Number(postId);

  if (isNaN(userIdNum) || isNaN(postIdNum)) {
    // Error handling
    return <NotFound />;
  }

  // Data fetching
  const { data } = useQuery({
    queryKey: ['post', userIdNum, postIdNum],
    queryFn: () => fetchPost(userIdNum, postIdNum),
  });

  return <div>{/* ... */}</div>;
}

// TanStack Router example (type-safe)
const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId/posts/$postId',
  // Parameter validation + parsing
  parseParams: (params) => ({
    userId: z.number().parse(Number(params.userId)),
    postId: z.number().parse(Number(params.postId)),
  }),
  // Type inference works in loader
  loader: async ({ params }) => {
    // params.userId, params.postId are of type number
    return fetchPost(params.userId, params.postId);
  },
});
```

**Caveats**:
- Parameters are always retrieved as strings, so don't forget conversion processing for numbers, dates, etc.
- Implement error handling for invalid values (e.g., `userId: "abc"`)
- If SEO is important, also generate dynamic route metadata dynamically

---

## Next Guides to Read

---

## References
1. React Router. "React Router v6 Documentation." reactrouter.com, 2024.
2. TanStack. "TanStack Router Documentation." tanstack.com, 2024.
3. MDN Web Docs. "History API." developer.mozilla.org, 2024.
4. Web.dev. "View Transitions API." web.dev, 2024.
5. Kent C. Dodds. "Client-side Routing in React Applications." kentcdodds.com, 2023.
6. TkDodo. "Type-safe Search Params." tkdodo.eu, 2024.
7. Ryan Florence. "Data Loading in React Router." remix.run/blog, 2023.
8. W3C. "WAI-ARIA Authoring Practices - Navigation." w3.org/WAI, 2024.
