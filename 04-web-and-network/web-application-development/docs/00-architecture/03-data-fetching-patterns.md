# Data Fetching Patterns

> Data fetching is at the heart of web applications. Understand the cache strategies of TanStack Query, SWR, React Server Components, and Server Actions, and know when to use each to achieve fast and reliable data retrieval.

## What You Will Learn

- [ ] Understand the fundamental concepts and historical evolution of data fetching
- [ ] Deeply understand the cache strategies of TanStack Query and SWR
- [ ] Know when to use Server Components vs. Server Actions
- [ ] Learn optimistic updates and real-time data synchronization
- [ ] Implement error handling and retry strategies
- [ ] Gain knowledge in performance optimization and troubleshooting

## Prerequisites

Having the following knowledge before reading this guide will aid comprehension:

- Understanding of component design and Server/Client boundaries — [Component Architecture](./02-component-architecture.md)
- Basics of asynchronous programming with the Fetch API and async/await
- Understanding of HTTP methods (GET/POST/PUT/DELETE) and status codes

---

## 1. Historical Evolution and Basic Concepts of Data Fetching

### 1.1 Evolution of Data Retrieval in Web Applications

Data fetching in web applications has undergone significant changes alongside technological advances. Understanding this history clarifies why current patterns exist and what problems they solve.

```
Data Fetching Evolution Timeline:

  Early 2000s: Synchronous page reloads
  ├─ Form submission → Server processing → Full page re-render
  ├─ Partial updates via iframe (hacky approach)
  └─ Limitation: Poor UX, high server load

  2005-2010: Rise of Ajax (XMLHttpRequest)
  ├─ Gmail adopted Ajax, making async communication mainstream
  ├─ jQuery.ajax() became the de facto standard
  ├─ JSON spread as a data format replacing XML
  └─ Challenges: Callback hell, manual cache management

  2015-2018: Fetch API and Promise-based communication
  ├─ Fetch API became a browser standard
  ├─ async/await improved readability of async code
  ├─ Data management with Redux + redux-saga / redux-thunk
  └─ Challenges: Lots of boilerplate, complex state management

  2019-2022: Era of dedicated data fetching libraries
  ├─ React Query (now TanStack Query) emerged
  ├─ SWR (Vercel) emerged
  ├─ Apollo Client / urql (for GraphQL)
  └─ Advantages: Declarative cache, retry, and optimistic updates

  2023 onwards: Server-first architecture
  ├─ React Server Components (RSC)
  ├─ Server Actions
  ├─ fetch() cache in Next.js App Router
  └─ Advantages: Zero bundle cost, direct DB/API access
```

### 1.2 Fundamental Data Fetching Patterns

Data fetching patterns used in modern web applications can be broadly classified into the following five categories.

```
Five Fundamental Data Fetching Patterns:

  1. Fetch-on-Render
     ├─ Fetch data when a component mounts
     ├─ Typical pattern with useEffect + fetch
     ├─ Advantage: Simple, easy to understand
     └─ Drawback: Waterfall problem, manual loading state management

  2. Fetch-Then-Render
     ├─ Begin rendering after data is fully fetched
     ├─ Fetch all data at the route level
     ├─ Advantage: Avoids waterfall
     └─ Drawback: Nothing is shown until all data is fetched

  3. Render-As-You-Fetch
     ├─ Start rendering and fetching data simultaneously
     ├─ Recommended pattern with Suspense + RSC
     ├─ Advantage: Fastest initial display, progressive rendering
     └─ Drawback: Complex to implement

  4. Server-Side Fetch
     ├─ Fetch data on the server and include it in HTML
     ├─ SSR / SSG / ISR
     ├─ Advantage: SEO support, faster initial display
     └─ Drawback: Server load, impact on TTFB

  5. Hybrid Fetch
     ├─ Combination of server and client
     ├─ RSC + TanStack Query combined
     ├─ Advantage: Optimal performance and UX
     └─ Drawback: Complex architecture
```

### 1.3 Common Challenges in Data Fetching

Regardless of the pattern chosen, the following challenges must be addressed.

```typescript
// Common challenges to address in data fetching

// 1. Loading state management
// Bad: Manual boolean flag management
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);
const [data, setData] = useState<User[] | null>(null);

useEffect(() => {
  setLoading(true);
  setError(null);
  fetchUsers()
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);

// Good: Declarative management with a dedicated library
const { data, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});

// 2. Cache consistency
// When the same data is used across multiple components,
// inconsistencies arise if the cache is not centrally managed

// 3. Race condition
// Bad: Fetching in useEffect can cause race conditions
useEffect(() => {
  // If the user switches quickly, old responses may
  // overwrite newer ones
  fetchUser(userId).then(setUser);
}, [userId]);

// Good: Cancel with AbortController
useEffect(() => {
  const controller = new AbortController();

  fetchUser(userId, { signal: controller.signal })
    .then(setUser)
    .catch(err => {
      if (err.name !== 'AbortError') setError(err);
    });

  return () => controller.abort();
}, [userId]);

// 4. Error handling and retry
// Appropriate handling is needed for network errors, timeouts, auth errors, etc.


// 5. Preventing memory leaks
// Prevent state updates to unmounted components
```

---

## 2. Data Fetching Options and Comparison

### 2.1 Comparison Table of Major Libraries and Frameworks

| Feature | TanStack Query | SWR | Apollo Client | Server Components |
|------|---------------|-----|---------------|-------------------|
| Runtime | Client | Client | Client | Server |
| Protocol | REST / GraphQL | REST / GraphQL | GraphQL | Direct DB/API |
| Bundle size | ~39KB (gzip: ~11KB) | ~12KB (gzip: ~4KB) | ~33KB (gzip: ~10KB) | 0KB (server-side) |
| Cache | Advanced (stale-while-revalidate) | stale-while-revalidate | Normalized cache | fetch() cache |
| DevTools | Yes (official) | No (unofficial available) | Yes (official) | No |
| Optimistic updates | Built-in | Manual implementation | Built-in | N/A |
| Infinite scroll | useInfiniteQuery | useSWRInfinite | fetchMore | N/A |
| SSR support | Hydration support | Hydration support | SSR support | Native |
| Real-time | Plugin | Plugin | Subscriptions | N/A |
| Learning cost | Medium | Low | High | Low–Medium |
| TypeScript | Full support | Full support | Full support | Full support |
| Pagination | Built-in | Manual | Built-in | Manual |
| Retry | Configurable | Configurable | Manual | Manual |

### 2.2 Selection Flowchart

```
Data Fetching Strategy Selection:

  Q1: Is SEO required?
  ├─ YES → Q2: How frequently does data update?
  │        ├─ Low (blog, etc.) → SSG / ISR
  │        ├─ Moderate → SSR (Server Components)
  │        └─ High (real-time) → SSR + client revalidation
  │
  └─ NO → Q3: What is the data update pattern?
           ├─ Read-heavy → Q4
           ├─ Write-heavy → Server Actions + useMutation
           └─ Real-time → TanStack Query + WebSocket / SSE

  Q4: What is the scale of the application?
  ├─ Small / Simple → SWR
  ├─ Medium to Large → TanStack Query
  └─ GraphQL API → Apollo Client / urql

Detailed Selection Criteria:
  · Read-only (no SEO): TanStack Query / SWR
  · Read-only (with SEO): Server Components
  · Data mutation: Server Actions + revalidate
  · Real-time: TanStack Query + WebSocket
  · GraphQL: Apollo Client + codegen
  · Small project: SWR (lightweight, simple)
  · Large project: TanStack Query (feature-rich, DevTools)
```

### 2.3 Architecture Diagrams for Each Approach

```
■ Client-side Fetching (TanStack Query / SWR)

  Browser                            Server
  ┌──────────────────┐              ┌──────────────┐
  │  React Component │              │              │
  │  ┌────────────┐  │   HTTP/REST  │   API Server │
  │  │ useQuery() │──┼─────────────→│   /api/users │
  │  └─────┬──────┘  │              │              │
  │        │         │              └──────────────┘
  │  ┌─────▼──────┐  │
  │  │ Query Cache│  │  ← stale-while-revalidate
  │  └────────────┘  │
  └──────────────────┘

■ Server-side Fetching (React Server Components)

  Server                             Browser
  ┌──────────────────┐              ┌──────────────┐
  │  Server Component│              │              │
  │  ┌────────────┐  │   RSC Stream │  Client      │
  │  │ await fetch│  │─────────────→│  Hydration   │
  │  │ / Prisma   │  │              │              │
  │  └────────────┘  │              └──────────────┘
  │  ┌────────────┐  │
  │  │ DB / API   │  │  ← Direct access (no network hop)
  │  └────────────┘  │
  └──────────────────┘

■ Hybrid Fetching (RSC + TanStack Query)

  サーバー                  ブラウザ
  ┌────────────┐           ┌─────────────────────┐
  │ RSC        │  Hydrate  │ Client Component     │
  │ Initial    │─────────→│ ┌─────────────────┐  │
  │ prefetch   │           │ │ TanStack Query   │  │
  └────────────┘           │ │ hydrate + refetch│  │
                           │ └─────────────────┘  │
                           └─────────────────────┘
```

---

## 3. TanStack Query Complete Guide

### 3.1 Setup and Global Configuration

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

// Create a singleton instance of QueryClient
// On the server, a new instance must be created per request
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // === Cache control ===
        staleTime: 60 * 1000,           // Consider cache fresh for 60 seconds
        gcTime: 5 * 60 * 1000,          // Keep cache in memory for 5 min (formerly cacheTime)
        refetchInterval: false,          // Disable auto-polling (enable where needed)

        // === Retry control ===
        retry: 3,                        // Retry 3 times on failure
        retryDelay: (attemptIndex) =>     // Exponential backoff
          Math.min(1000 * 2 ** attemptIndex, 30000),

        // === Refetch triggers ===
        refetchOnWindowFocus: true,      // Refetch on window focus
        refetchOnReconnect: true,        // Refetch on network reconnect
        refetchOnMount: true,            // Refetch on component mount

        // === Structural sharing ===
        structuralSharing: true,         // Maintain referential equality of data

        // === Network mode ===
        networkMode: 'online',           // Pause requests when offline
      },
      mutations: {
        retry: 1,                        // Retry mutations only once
        networkMode: 'online',
      },
    },
  });
}

// Singleton in the browser, create new instance per request on the server
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new instance
    return makeQueryClient();
  }
  // Browser: use singleton
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
```

```typescript
// app/providers.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  // NOTE: Not using useState prevents re-creation across Suspense boundaries
  const queryClient = getQueryClient();

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

### 3.2 Query Key Design Patterns

Query Keys are the foundation of the TanStack Query cache system; thoughtful design is essential.

```typescript
// lib/query-keys.ts
// Query Key Factory pattern — recommended for large apps

export const queryKeys = {
  // === Users ===
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserFilters) =>
      [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.users.details(), id] as const,
    profile: (id: string) =>
      [...queryKeys.users.detail(id), 'profile'] as const,
    posts: (id: string) =>
      [...queryKeys.users.detail(id), 'posts'] as const,
  },

  // === Products ===
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters: ProductFilters) =>
      [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.products.details(), id] as const,
    reviews: (id: string) =>
      [...queryKeys.products.detail(id), 'reviews'] as const,
    inventory: (id: string) =>
      [...queryKeys.products.detail(id), 'inventory'] as const,
  },

  // === Orders ===
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters: OrderFilters) =>
      [...queryKeys.orders.lists(), filters] as const,
    detail: (id: string) =>
      [...queryKeys.orders.all, 'detail', id] as const,
  },
} as const;

// Type definitions
interface UserFilters {
  role?: 'admin' | 'user' | 'moderator';
  status?: 'active' | 'inactive';
  search?: string;
  page?: number;
  limit?: number;
}

interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'rating' | 'newest';
  page?: number;
}

interface OrderFilters {
  status?: 'pending' | 'processing' | 'shipped' | 'delivered';
  dateRange?: { start: Date; end: Date };
  page?: number;
}
```

```typescript
// Usage examples for the Query Key Factory

// Invalidate all user caches
queryClient.invalidateQueries({ queryKey: queryKeys.users.all });

// Invalidate filtered list
queryClient.invalidateQueries({
  queryKey: queryKeys.users.list({ role: 'admin' }),
});

// Invalidate only the detail cache for a specific user
queryClient.invalidateQueries({
  queryKey: queryKeys.users.detail('user-123'),
});

// Invalidate all list caches (regardless of filters)
queryClient.invalidateQueries({
  queryKey: queryKeys.users.lists(),
});

// Invalidate all caches related to a specific user
// (detail + profile + posts)
queryClient.invalidateQueries({
  queryKey: queryKeys.users.detail('user-123'),
});
```

### 3.3 Custom Hook Design Patterns

```typescript
// hooks/use-users.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/lib/api-client';
import type { User, CreateUserInput, UpdateUserInput, UserFilters } from '@/types';

/**
 * Custom hook to fetch a list of users
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useUsers({ role: 'admin', page: 1 });
 * ```
 */
export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: queryKeys.users.list(filters ?? {}),
    queryFn: () => api.users.list(filters),
    staleTime: 30 * 1000, // Cache for 30 seconds
    placeholderData: (previousData) => previousData, // Show previous data during page transitions
  });
}

/**
 * Custom hook to fetch user details
 * Sets initial data from list cache for instant display
 */
export function useUser(userId: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => api.users.get(userId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    // Set initial data from the list cache
    initialData: () => {
      const listsCache = queryClient.getQueriesData<{ users: User[] }>({
        queryKey: queryKeys.users.lists(),
      });
      for (const [, data] of listsCache) {
        const user = data?.users.find(u => u.id === userId);
        if (user) return user;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      // Get the timestamp of initial data (used for staleTime calculation)
      return queryClient.getQueryState(queryKeys.users.lists())
        ?.dataUpdatedAt;
    },
  });
}

/**
 * User search hook (with debounce)
 */
export function useUserSearch(searchTerm: string) {
  return useQuery({
    queryKey: queryKeys.users.list({ search: searchTerm }),
    queryFn: () => api.users.search(searchTerm),
    enabled: searchTerm.length >= 2, // Start searching after 2+ characters
    staleTime: 10 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * User creation mutation
 * Automatically invalidates the list cache on success
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserInput) => api.users.create(data),
    onSuccess: (newUser) => {
      // Invalidate list cache and re-fetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.lists(),
      });
      // Set detail cache for the new user
      queryClient.setQueryData(
        queryKeys.users.detail(newUser.id),
        newUser,
      );
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    },
  });
}

/**
 * User update mutation (with optimistic update)
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      api.users.update(id, data),

    onMutate: async ({ id, data }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.users.detail(id),
      });

      // Save snapshot
      const previousUser = queryClient.getQueryData<User>(
        queryKeys.users.detail(id),
      );

      // Optimistically update the cache
      if (previousUser) {
        queryClient.setQueryData(
          queryKeys.users.detail(id),
          { ...previousUser, ...data },
        );
      }

      return { previousUser };
    },

    onError: (error, { id }, context) => {
      // Roll back on error
      if (context?.previousUser) {
        queryClient.setQueryData(
          queryKeys.users.detail(id),
          context.previousUser,
        );
      }
    },

    onSettled: (data, error, { id }) => {
      // Revalidate with fresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.lists(),
      });
    },
  });
}

/**
 * User deletion mutation
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.users.delete(userId),

    onMutate: async (userId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.users.lists(),
      });

      // Optimistically remove from all list caches
      const previousLists = queryClient.getQueriesData<{ users: User[] }>({
        queryKey: queryKeys.users.lists(),
      });

      queryClient.setQueriesData<{ users: User[] }>(
        { queryKey: queryKeys.users.lists() },
        (old) => old ? {
          ...old,
          users: old.users.filter(u => u.id !== userId),
        } : old,
      );

      return { previousLists };
    },

    onError: (error, userId, context) => {
      // Rollback
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.lists(),
      });
    },
  });
}
```

### 3.4 Implementing Infinite Scroll

```typescript
// hooks/use-infinite-products.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/lib/api-client';

interface ProductsResponse {
  products: Product[];
  nextCursor: string | null;
  totalCount: number;
}

export function useInfiniteProducts(filters?: ProductFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.list(filters ?? {}),
    queryFn: ({ pageParam }) => api.products.list({
      ...filters,
      cursor: pageParam,
      limit: 20,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ProductsResponse) => lastPage.nextCursor,
    // Previous page param (for bidirectional scroll)
    getPreviousPageParam: undefined,
    staleTime: 60 * 1000,
    // Limit max pages (memory saving)
    maxPages: 10,
  });
}

// Usage in a component
function InfiniteProductList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteProducts({ category: 'electronics' });

  // Auto-load with Intersection Observer
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <ProductGridSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  const allProducts = data?.pages.flatMap(page => page.products) ?? [];

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        {allProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
        {isFetchingNextPage && <Spinner />}
        {!hasNextPage && allProducts.length > 0 && (
          <p className="text-gray-500">All products displayed</p>
        )}
      </div>
    </div>
  );
}
```

### 3.5 Prefetch and Server-side Integration

```typescript
// TanStack Query integration with Server Components (Next.js App Router)

// app/users/page.tsx — Server Component
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/lib/api-client';
import { UserListClient } from './user-list-client';

export default async function UsersPage() {
  const queryClient = getQueryClient();

  // Pre-fetch data on the server side
  await queryClient.prefetchQuery({
    queryKey: queryKeys.users.list({}),
    queryFn: () => api.users.list(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserListClient />
    </HydrationBoundary>
  );
}

// app/users/user-list-client.tsx — Client Component
'use client';

import { useUsers } from '@/hooks/use-users';

export function UserListClient() {
  // Data prefetched on the server is instantly available
  // isLoading starts as false
  const { data, isLoading, error } = useUsers();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {data.users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

```typescript
// Route-level Prefetch (fetch data before navigation)

// Prefetch on link hover
function UserLink({ userId, children }: { userId: string; children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const prefetchUser = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.detail(userId),
      queryFn: () => api.users.get(userId),
      staleTime: 5 * 60 * 1000,
    });
  };

  return (
    <Link
      href={`/users/${userId}`}
      onMouseEnter={prefetchUser}
      onFocus={prefetchUser}
    >
      {children}
    </Link>
  );
}
```

### 3.6 Polling and Real-time Integration

```typescript
// Real-time updates via polling

// Periodic fetch of notification count
export function useNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api.notifications.getUnreadCount(),
    refetchInterval: 30 * 1000,          // Poll every 30 seconds
    refetchIntervalInBackground: false,   // Do not poll in background
    staleTime: 10 * 1000,
  });
}

// Poll job progress status (stop polling when complete)
export function useJobStatus(jobId: string) {
  return useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => api.jobs.getStatus(jobId),
    refetchInterval: (query) => {
      // Stop polling when job is complete
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    enabled: !!jobId,
  });
}

// WebSocket integration
export function useRealtimeOrders() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket('wss://api.example.com/ws/orders');

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);

      switch (update.type) {
        case 'ORDER_CREATED':
          // Invalidate list cache
          queryClient.invalidateQueries({
            queryKey: queryKeys.orders.lists(),
          });
          break;

        case 'ORDER_UPDATED':
          // Directly update the specific order cache
          queryClient.setQueryData(
            queryKeys.orders.detail(update.orderId),
            (old: Order | undefined) =>
              old ? { ...old, ...update.changes } : old,
          );
          break;

        case 'ORDER_DELETED':
          // Remove from cache
          queryClient.removeQueries({
            queryKey: queryKeys.orders.detail(update.orderId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.orders.lists(),
          });
          break;
      }
    };

    ws.onerror = () => {
      // Fall back to polling on WebSocket error
      console.warn('WebSocket error, falling back to polling');
    };

    return () => ws.close();
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.orders.lists(),
    queryFn: () => api.orders.list(),
    staleTime: 60 * 1000,
  });
}
```

---

## 4. SWR Detailed Guide

### 4.1 SWR Basics and Configuration

SWR (stale-while-revalidate) is a lightweight data fetching library developed by Vercel. As the name implies, it is based on the stale-while-revalidate HTTP cache invalidation strategy.

```typescript
// lib/swr-config.tsx
import { SWRConfig } from 'swr';

// Global fetcher function
const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    (error as any).info = await res.json();
    (error as any).status = res.status;
    throw error;
  }

  return res.json();
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // === Cache control ===
        dedupingInterval: 2000,         // 2秒以内の同一リクエストを重複排除
        revalidateOnFocus: true,        // Revalidate on focus
        revalidateOnReconnect: true,    // Revalidate on network reconnect
        revalidateIfStale: true,        // Revalidate stale data on mount

        // === Error handling ===
        shouldRetryOnError: true,
        errorRetryCount: 3,
        errorRetryInterval: 5000,

        // === Loading ===
        loadingTimeout: 3000,           // Mark as slow after 3 seconds
        focusThrottleInterval: 5000,    // Throttle for focus revalidation

        // === Custom cache provider ===
        provider: () => new Map(),

        onError: (error, key) => {
          if (error.status === 403 || error.status === 401) {
            // Global handling for auth errors
            console.error(`Auth error for ${key}:`, error);
          }
        },

        onLoadingSlow: (key) => {
          console.warn(`Slow loading detected for: ${key}`);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

### 4.2 Practical SWR Usage Patterns

```typescript
// hooks/use-swr-users.ts
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import useSWRInfinite from 'swr/infinite';

// Basic data fetching
export function useUser(userId: string | undefined) {
  return useSWR(
    userId ? `/api/users/${userId}` : null, // null disables fetching
  );
}

// Conditional fetching
export function useUserProfile(userId: string | undefined, enabled: boolean) {
  return useSWR(
    enabled && userId ? `/api/users/${userId}/profile` : null,
  );
}

// Dependent fetching (depends on previous data)
export function useUserProjects(userId: string | undefined) {
  const { data: user } = useUser(userId);
  // Do not fetch until user data is available
  return useSWR(
    user ? `/api/users/${user.id}/projects` : null,
  );
}

// Mutation with SWR
export function useCreateUser() {
  return useSWRMutation(
    '/api/users',
    async (url: string, { arg }: { arg: CreateUserInput }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      if (!res.ok) throw new Error('Failed to create user');
      return res.json();
    },
  );
}

// Infinite scroll with SWR
export function useInfiniteUsers() {
  const getKey = (pageIndex: number, previousPageData: any) => {
    // Reached the last page
    if (previousPageData && !previousPageData.nextCursor) return null;

    // First page
    if (pageIndex === 0) return '/api/users?limit=20';

    // Next page
    return `/api/users?cursor=${previousPageData.nextCursor}&limit=20`;
  };

  return useSWRInfinite(getKey);
}

// Optimistic update with SWR
export function useToggleLike(postId: string) {
  const { data, mutate } = useSWR(`/api/posts/${postId}`);

  const toggleLike = async () => {
    // Optimistic update
    const optimisticData = {
      ...data,
      isLiked: !data.isLiked,
      likeCount: data.isLiked ? data.likeCount - 1 : data.likeCount + 1,
    };

    try {
      await mutate(
        fetch(`/api/posts/${postId}/like`, { method: 'POST' }).then(r => r.json()),
        {
          optimisticData,
          rollbackOnError: true,  // Auto-rollback on error
          populateCache: true,    // Update cache with response
          revalidate: false,      // Skip revalidation (trust the response)
        },
      );
    } catch (error) {
      // Rollbackは自動で行われる
      console.error('Failed to toggle like:', error);
    }
  };

  return { data, toggleLike };
}
```

### 4.3 TanStack Query vs SWR Detailed Comparison

```
TanStack Query vs SWR Detailed Comparison:

  Bundle size:
  ├─ SWR:           ~4KB (gzipped)      ← Lightweight
  └─ TanStack Query: ~11KB (gzipped)    ← Feature-rich

  API design philosophy:
  ├─ SWR:           URL-based keys       ← Simple
  └─ TanStack Query: Array-based keys    ← Flexible

  DevTools:
  ├─ SWR:           No official (SWR DevTools is unofficial)
  └─ TanStack Query: Official DevTools    ← Strong debugging

  Mutations:
  ├─ SWR:           mutate() / useSWRMutation
  └─ TanStack Query: useMutation + onMutate/onSuccess/onError ← Advanced control

  Pagination:
  ├─ SWR:           useSWRInfinite       ← Basic
  └─ TanStack Query: useInfiniteQuery    ← Bidirectional, maxPages

  SSR integration:
  ├─ SWR:           fallback prop        ← Simple
  └─ TanStack Query: dehydrate/hydrate   ← Full control

  Offline support:
  ├─ SWR:           Basic
  └─ TanStack Query: networkMode setting  ← Advanced

  Recommended scenarios:
  ├─ SWR:           Small to medium scale, simple REST API, Next.js projects
  └─ TanStack Query: Medium to large scale, complex cache requirements, diverse data sources
```

---

## 5. Optimistic Updates

### 5.1 Basic Concepts and Design Principles

Optimistic updates are a pattern that immediately updates the UI without waiting for a server response. They greatly improve user experience, but require proper implementation of rollback handling on failure.

```
楽観的更新のフロー:

  通常のフロー（非楽観的）:
  ┌──────┐  リクエスト  ┌──────┐  レスポンス  ┌──────┐
  │ UI   │────────────→│Server│────────────→│UI更新│
  │(変更前)│  ← 待ち時間 →│      │             │(変更後)│
  └──────┘              └──────┘              └──────┘

  楽観的更新のフロー:
  ┌──────┐  即座にUI更新  ┌──────┐
  │ UI   │──────────────→│UI更新│
  │(変更前)│               │(変更後)│
  └──┬───┘               └──────┘
     │  リクエスト  ┌──────┐
     └────────────→│Server│
                    │      │
                    └──┬───┘
                       │ 成功 → 何もしない（or 再検証）
                       │ 失敗 → ロールバック
```

### 5.2 TanStack Query での楽観的更新パターン集

```typescript
// パターン1: リスト項目の追加（楽観的）
function useAddTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newTodo: CreateTodoInput) => api.todos.create(newTodo),

    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

      // 仮のIDとタイムスタンプでリストに追加
      const optimisticTodo: Todo = {
        id: `temp-${Date.now()}`,
        ...newTodo,
        completed: false,
        createdAt: new Date().toISOString(),
        _optimistic: true, // UIで「保存中...」表示に使える
      };

      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old ? [optimisticTodo, ...old] : [optimisticTodo],
      );

      return { previousTodos };
    },

    onSuccess: (serverTodo) => {
      // サーバーから返った本物のデータで仮データを置換
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old?.map(todo =>
          todo._optimistic ? serverTodo : todo,
        ),
      );
    },

    onError: (error, newTodo, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos);
      toast.error(`Todoの作成に失敗しました: ${error.message}`);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

// パターン2: お気に入りトグル（楽観的）
function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => api.favorites.toggle(productId),

    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      const previous = queryClient.getQueryData(['products']);

      queryClient.setQueryData(['products'], (old: Product[]) =>
        old.map(p =>
          p.id === productId
            ? { ...p, isFavorite: !p.isFavorite }
            : p,
        ),
      );

      return { previous };
    },

    onError: (error, productId, context) => {
      queryClient.setQueryData(['products'], context?.previous);
      toast.error('お気に入りの更新に失敗しました');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// パターン3: 並び替え（楽観的 — ドラッグ&ドロップ）
function useReorderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reorder: { id: string; newIndex: number }) =>
      api.items.reorder(reorder),

    onMutate: async ({ id, newIndex }) => {
      await queryClient.cancelQueries({ queryKey: ['items'] });
      const previousItems = queryClient.getQueryData<Item[]>(['items']);

      queryClient.setQueryData<Item[]>(['items'], (old) => {
        if (!old) return old;
        const items = [...old];
        const currentIndex = items.findIndex(item => item.id === id);
        if (currentIndex === -1) return old;

        const [removed] = items.splice(currentIndex, 1);
        items.splice(newIndex, 0, removed);

        return items.map((item, index) => ({
          ...item,
          order: index,
        }));
      });

      return { previousItems };
    },

    onError: (error, variables, context) => {
      queryClient.setQueryData(['items'], context?.previousItems);
      toast.error('並び替えに失敗しました');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

// パターン4: 複数キャッシュにまたがる楽観的更新
function useCompleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => api.orders.complete(orderId),

    onMutate: async (orderId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.orders.detail(orderId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.orders.lists() }),
        queryClient.cancelQueries({ queryKey: ['dashboard', 'stats'] }),
      ]);

      const previousOrder = queryClient.getQueryData(
        queryKeys.orders.detail(orderId),
      );
      const previousOrders = queryClient.getQueriesData({
        queryKey: queryKeys.orders.lists(),
      });
      const previousStats = queryClient.getQueryData(['dashboard', 'stats']);

      queryClient.setQueryData(
        queryKeys.orders.detail(orderId),
        (old: Order | undefined) =>
          old ? { ...old, status: 'completed', completedAt: new Date().toISOString() } : old,
      );

      queryClient.setQueriesData(
        { queryKey: queryKeys.orders.lists() },
        (old: { orders: Order[] } | undefined) =>
          old ? {
            ...old,
            orders: old.orders.map(o =>
              o.id === orderId ? { ...o, status: 'completed' } : o,
            ),
          } : old,
      );

      queryClient.setQueryData(
        ['dashboard', 'stats'],
        (old: DashboardStats | undefined) =>
          old ? {
            ...old,
            completedOrders: old.completedOrders + 1,
            pendingOrders: old.pendingOrders - 1,
          } : old,
      );

      return { previousOrder, previousOrders, previousStats };
    },

    onError: (error, orderId, context) => {
      if (context?.previousOrder) {
        queryClient.setQueryData(
          queryKeys.orders.detail(orderId),
          context.previousOrder,
        );
      }
      if (context?.previousOrders) {
        context.previousOrders.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousStats) {
        queryClient.setQueryData(['dashboard', 'stats'], context.previousStats);
      }
    },

    onSettled: (data, error, orderId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}
```

### 5.3 楽観的更新のアンチパターンと注意点

```typescript
// ❌ アンチパターン1: onMutate で cancelQueries を忘れる
// → 進行中の再取得が楽観的データを上書きしてしまう
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    // ❌ cancelQueries がない！
    const previous = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], /* ... */);
    return { previous };
  },
});

// ✅ 正しいパターン
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] }); // ✅
    const previous = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], /* ... */);
    return { previous };
  },
});

// ❌ アンチパターン2: onSettled で invalidateQueries を忘れる
// → サーバーとの不整合が残る可能性がある
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => { /* 楽観的更新 */ },
  onError: (error, vars, context) => { /* ロールバック */ },
  // ❌ onSettled がない！
});

// ❌ アンチパターン3: 重要なデータに楽観的更新を使う
// 決済処理、在庫管理など、整合性が絶対に必要な操作には不適切
useMutation({
  mutationFn: processPayment,
  onMutate: async () => {
    // ❌ 決済処理に楽観的更新は危険！
    queryClient.setQueryData(['balance'], (old) => old - amount);
  },
});
```

---

## 6. React Server Components でのデータ取得

### 6.1 Server Components の基本と制約

React Server Components（RSC）は、サーバーでのみ実行されるコンポーネントである。クライアントに JavaScript を送信しないため、バンドルサイズに影響を与えず、データベースやファイルシステムに直接アクセスできる。

```
Server Components の特徴:

  ✅ できること:
  ├─ async/await で直接データ取得
  ├─ データベースに直接アクセス（Prisma, Drizzle 等）
  ├─ ファイルシステムの読み取り
  ├─ 機密情報（APIキー等）の安全な使用
  ├─ 重い依存関係のサーバーサイド実行（マークダウンパーサー等）
  └─ Suspense によるストリーミングSSR

  ❌ できないこと:
  ├─ useState, useEffect 等の React Hooks
  ├─ ブラウザ API（localStorage, window等）
  ├─ イベントハンドラ（onClick, onChange 等）
  ├─ Context Provider / Consumer
  └─ CSS-in-JS（ランタイム生成）
```

### 6.2 データ取得パターンの実装

```typescript
// ===========================
// パターン1: 基本的なデータ取得
// ===========================

// app/users/page.tsx — Server Component
import { prisma } from '@/lib/prisma';
import { UserList } from './user-list';

export default async function UsersPage() {
  // Server Component で直接データベースにアクセス
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      createdAt: true,
    },
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">ユーザー一覧</h1>
      <UserList users={users} />
    </div>
  );
}

// ===========================
// パターン2: 並列データ取得（ウォーターフォール防止）
// ===========================

// app/dashboard/page.tsx
async function DashboardPage() {
  // ❌ ウォーターフォール（逐次実行）
  // const users = await getRecentUsers();    // 200ms
  // const orders = await getRecentOrders();  // 300ms
  // const stats = await getDashboardStats(); // 150ms
  // 合計: 650ms

  // ✅ 並列実行
  const [users, orders, stats] = await Promise.all([
    getRecentUsers(),     // 200ms
    getRecentOrders(),    // 300ms
    getDashboardStats(),  // 150ms
  ]);
  // 合計: 300ms（最も遅いリクエストの時間）

  return (
    <Dashboard>
      <UserSection users={users} />
      <OrderSection orders={orders} />
      <StatsSection stats={stats} />
    </Dashboard>
  );
}

// ===========================
// パターン3: Suspense による段階的レンダリング
// ===========================

// app/products/[id]/page.tsx
import { Suspense } from 'react';

async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  return (
    <div>
      {/* 即座に表示（プロダクト情報は既に取得済み） */}
      <ProductHeader product={product} />

      {/* レビューは独立して取得・表示 */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={id} />
      </Suspense>

      {/* おすすめも独立して取得・表示 */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations productId={id} />
      </Suspense>
    </div>
  );
}

// 各セクションは独立した async Server Component
async function ProductReviews({ productId }: { productId: string }) {
  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: { select: { name: true, avatar: true } } },
  });

  return (
    <section>
      <h2>レビュー ({reviews.length})</h2>
      {reviews.map(review => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </section>
  );
}

async function Recommendations({ productId }: { productId: string }) {
  const recommendations = await getRecommendations(productId);

  return (
    <section>
      <h2>おすすめ商品</h2>
      <div className="grid grid-cols-4 gap-4">
        {recommendations.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
```

### 6.3 Next.js の fetch() キャッシュ戦略

Next.js App Router では、fetch() 関数にキャッシュ制御のオプションが追加されており、SSR/SSG/ISR をきめ細かく制御できる。

```typescript
// Next.js fetch() キャッシュオプション

// ===========================
// 静的データ（ビルド時に取得、再検証なし）— SSG相当
// ===========================
async function getStaticContent() {
  const res = await fetch('https://api.example.com/content', {
    cache: 'force-cache', // デフォルト値（Next.js 14以降は 'no-store' がデフォルト）
  });
  return res.json();
}

// ===========================
// 動的データ（リクエストごとに取得）— SSR相当
// ===========================
async function getDynamicData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store', // キャッシュしない
  });
  return res.json();
}

// ===========================
// 時間ベースの再検証 — ISR相当
// ===========================
async function getRevalidatedData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }, // 1時間ごとに再検証
  });
  return res.json();
}

// ===========================
// タグベースの再検証（オンデマンド）
// ===========================
async function getTaggedData() {
  const res = await fetch('https://api.example.com/products', {
    next: { tags: ['products'] }, // タグを付与
  });
  return res.json();
}

// Server Action やAPI Route から再検証をトリガー
import { revalidateTag, revalidatePath } from 'next/cache';

export async function updateProduct(formData: FormData) {
  'use server';
  await db.products.update(/* ... */);

  // タグベースの再検証
  revalidateTag('products');

  // パスベースの再検証
  revalidatePath('/products');
  revalidatePath('/products/[id]', 'page');
}
```

```typescript
// キャッシュ戦略の比較表
//
// | 方式 | キャッシュ | 再検証 | ユースケース |
// |------|----------|--------|-------------|
// | force-cache | あり | なし | 静的コンテンツ |
// | no-store | なし | 毎回 | ユーザー固有データ |
// | revalidate: N | あり | N秒後 | ニュース、ブログ |
// | tags + revalidateTag | あり | オンデマンド | EC商品、CMS |

// データ取得関数のパターン（推奨）
// lib/data.ts

import { cache } from 'react';

// React cache() でリクエスト内の重複排除
// 同一リクエスト内で複数回呼んでも1回のDBアクセスに
export const getUser = cache(async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) throw new Error('User not found');
  return user;
});

// unstable_cache でクロスリクエストキャッシュ
import { unstable_cache } from 'next/cache';

export const getCachedUser = unstable_cache(
  async (userId: string) => {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  },
  ['user'], // キャッシュキー
  {
    revalidate: 3600, // 1時間
    tags: ['users'],  // 再検証タグ
  },
);
```

---

## 7. Server Actions

### 7.1 Server Actions の基本

Server Actions は React のサーバーサイドミューテーション機能である。`'use server'` ディレクティブで定義された関数は、サーバー上でのみ実行され、フォーム送信やデータ変更に使用される。

```typescript
// app/actions/user-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// バリデーションスキーマ
const CreateUserSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内です'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  role: z.enum(['admin', 'user', 'moderator']).default('user'),
});

const UpdateUserSchema = CreateUserSchema.partial().extend({
  id: z.string().uuid(),
});

// 型安全なアクション結果
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; errors: Record<string, string[]> };

// ===========================
// ユーザー作成アクション
// ===========================
export async function createUser(
  prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // 認証チェック
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return {
      success: false,
      errors: { _form: ['権限がありません'] },
    };
  }

  // バリデーション
  const parsed = CreateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  // 重複チェック
  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    return {
      success: false,
      errors: { email: ['このメールアドレスは既に使用されています'] },
    };
  }

  // データ作成
  try {
    await prisma.user.create({ data: parsed.data });
  } catch (error) {
    return {
      success: false,
      errors: { _form: ['ユーザーの作成に失敗しました'] },
    };
  }

  // キャッシュ無効化
  revalidatePath('/users');

  // リダイレクト
  redirect('/users');
}

// ===========================
// ユーザー更新アクション
// ===========================
export async function updateUser(
  prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = UpdateUserSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, ...data } = parsed.data;

  try {
    await prisma.user.update({
      where: { id },
      data,
    });
  } catch (error) {
    return {
      success: false,
      errors: { _form: ['ユーザーの更新に失敗しました'] },
    };
  }

  revalidatePath('/users');
  revalidatePath(`/users/${id}`);

  return { success: true };
}

// ===========================
// ユーザー削除アクション
// ===========================
export async function deleteUser(userId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return {
      success: false,
      errors: { _form: ['権限がありません'] },
    };
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    return {
      success: false,
      errors: { _form: ['ユーザーの削除に失敗しました'] },
    };
  }

  revalidatePath('/users');
  return { success: true };
}
```

### 7.2 クライアント側のフォーム実装

```typescript
// app/users/create/page.tsx
'use client';

import { useActionState } from 'react';
import { createUser } from '@/app/actions/user-actions';

export default function CreateUserPage() {
  const [state, action, isPending] = useActionState(createUser, null);

  return (
    <div className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">ユーザー作成</h1>

      <form action={action} className="space-y-4">
        {/* グローバルエラー */}
        {state?.errors?._form && (
          <div className="bg-red-50 text-red-600 p-3 rounded">
            {state.errors._form.map((error, i) => (
              <p key={i}>{error}</p>
            ))}
          </div>
        )}

        {/* 名前フィールド */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            名前
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 block w-full rounded border-gray-300"
            aria-describedby="name-error"
          />
          {state?.errors?.name && (
            <p id="name-error" className="mt-1 text-sm text-red-500">
              {state.errors.name[0]}
            </p>
          )}
        </div>

        {/* メールフィールド */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded border-gray-300"
            aria-describedby="email-error"
          />
          {state?.errors?.email && (
            <p id="email-error" className="mt-1 text-sm text-red-500">
              {state.errors.email[0]}
            </p>
          )}
        </div>

        {/* ロール選択 */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium">
            ロール
          </label>
          <select
            id="role"
            name="role"
            className="mt-1 block w-full rounded border-gray-300"
          >
            <option value="user">ユーザー</option>
            <option value="admin">管理者</option>
            <option value="moderator">モデレーター</option>
          </select>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? '作成中...' : 'ユーザーを作成'}
        </button>
      </form>
    </div>
  );
}
```

### 7.3 Server Actions + useOptimistic

```typescript
// Server Actions と楽観的更新の組み合わせ
'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleTodoComplete } from '@/app/actions/todo-actions';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticTodos, setOptimisticTodo] = useOptimistic(
    initialTodos,
    (state: Todo[], updatedTodo: Todo) =>
      state.map(todo =>
        todo.id === updatedTodo.id ? updatedTodo : todo,
      ),
  );

  const handleToggle = (todo: Todo) => {
    startTransition(async () => {
      // 楽観的にUIを更新
      setOptimisticTodo({ ...todo, completed: !todo.completed });
      // Server Action を実行
      await toggleTodoComplete(todo.id);
    });
  };

  return (
    <ul className="space-y-2">
      {optimisticTodos.map(todo => (
        <li
          key={todo.id}
          className="flex items-center gap-3 p-3 bg-white rounded shadow"
        >
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => handleToggle(todo)}
            disabled={isPending}
          />
          <span className={todo.completed ? 'line-through text-gray-400' : ''}>
            {todo.title}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

### 7.4 Server Actions のセキュリティ考慮事項

```typescript
// Server Actions のセキュリティベストプラクティス

'use server';

import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';

// ===========================
// 1. 認証・認可チェックは必ず実行
// ===========================
export async function sensitiveAction(formData: FormData) {
  // ❌ 認証チェックなしは危険
  // await db.users.delete({ where: { id: formData.get('id') } });

  // ✅ 必ず認証チェック
  const session = await auth();
  if (!session) {
    throw new Error('Unauthorized');
  }

  // ✅ 認可チェック（リソースの所有者確認）
  const resourceId = formData.get('id') as string;
  const resource = await db.resources.findUnique({ where: { id: resourceId } });
  if (resource?.ownerId !== session.user.id) {
    throw new Error('Forbidden');
  }
}

// ===========================
// 2. レート制限
// ===========================
export async function rateLimitedAction(formData: FormData) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') ?? 'unknown';

  const { success } = await rateLimit.limit(ip);
  if (!success) {
    return { errors: { _form: ['リクエストが多すぎます。しばらく待ってからお試しください'] } };
  }

  // ... 処理
}

// ===========================
// 3. 入力のサニタイズ
// ===========================
export async function sanitizedAction(formData: FormData) {
  // ✅ 必ずバリデーション&サニタイズ
  const input = z.object({
    content: z.string()
      .min(1)
      .max(10000)
      .transform(val => DOMPurify.sanitize(val)),
  }).parse({
    content: formData.get('content'),
  });
}

// ===========================
// 4. CSRF 保護（Next.js が自動で行うが、追加対策も可能）
// ===========================
// Server Actions は POST リクエストとして送信され、
// Origin ヘッダーのチェックが自動で行われる。
// ただし、追加のトークンベース保護も推奨。
```

---

## 8. エラーハンドリングとリトライ戦略

### 8.1 エラーの分類と対処方針

```
エラーの分類:

  1. ネットワークエラー（一時的）
  ├─ タイムアウト
  ├─ DNS解決失敗
  ├─ 接続拒否
  └─ 対処: リトライ（指数バックオフ）

  2. クライアントエラー（4xx）
  ├─ 400 Bad Request → バリデーションエラー表示
  ├─ 401 Unauthorized → ログインページへリダイレクト
  ├─ 403 Forbidden → 権限不足メッセージ
  ├─ 404 Not Found → 存在しないリソース表示
  ├─ 409 Conflict → 競合解決UI
  ├─ 422 Unprocessable Entity → フォームエラー表示
  ├─ 429 Too Many Requests → レート制限待機
  └─ 対処: リトライしない（422/429 は例外あり）

  3. サーバーエラー（5xx）
  ├─ 500 Internal Server Error → リトライ
  ├─ 502 Bad Gateway → リトライ
  ├─ 503 Service Unavailable → リトライ（Retry-After ヘッダー確認）
  └─ 対処: リトライ（指数バックオフ + ジッター）
```

### 8.2 TanStack Query のエラーハンドリング実装

```typescript
// lib/api-client.ts
// エラーの型定義と処理

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
    public retryable: boolean,
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

// リトライ可能かどうかを判定
function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    // 4xx はリトライしない（429 は例外）
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }
    // 5xx はリトライする
    return true;
  }
  // ネットワークエラーはリトライする
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  return false;
}

// フェッチラッパー
export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      res.statusText,
      data,
      isRetryableError(new ApiError(res.status, res.statusText, data, false)),
    );
  }

  return res.json();
}
```

```typescript
// QueryClient のグローバルエラーハンドリング
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // リトライ不可のエラーはリトライしない
        if (error instanceof ApiError && !error.retryable) {
          return false;
        }
        // 最大3回リトライ
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        // 指数バックオフ + ジッター
        const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
        const jitter = Math.random() * 1000;
        return baseDelay + jitter;
      },
    },
  },
});

// コンポーネントレベルのエラーハンドリング
function UserProfile({ userId }: { userId: string }) {
  const { data, error, isLoading, isError } = useUser(userId);

  if (isLoading) return <ProfileSkeleton />;

  if (isError) {
    if (error instanceof ApiError) {
      switch (error.status) {
        case 401:
          return <LoginRedirect />;
        case 403:
          return <AccessDenied />;
        case 404:
          return <UserNotFound />;
        default:
          return <GenericError message={error.message} />;
      }
    }
    return <NetworkError onRetry={() => window.location.reload()} />;
  }

  return <ProfileView user={data} />;
}

// Error Boundary との統合
'use client';

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="p-6 bg-red-50 rounded-lg text-center">
              <h2 className="text-lg font-semibold text-red-800">
                エラーが発生しました
              </h2>
              <p className="mt-2 text-red-600">{error.message}</p>
              <button
                onClick={resetErrorBoundary}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                再試行
              </button>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

### 8.3 Next.js App Router のエラーハンドリング

```typescript
// Next.js App Router では、error.tsx でルートレベルのエラーを処理する

// app/users/error.tsx
'use client';

import { useEffect } from 'react';

export default function UsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // エラーログをサービスに送信
    console.error('Users page error:', error);
    // Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <h2 className="text-2xl font-bold text-red-600 mb-4">
        ユーザーデータの読み込みに失敗しました
      </h2>
      <p className="text-gray-600 mb-6">
        {error.message || '予期しないエラーが発生しました'}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        再試行
      </button>
    </div>
  );
}

// app/users/not-found.tsx
export default function UsersNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <h2 className="text-2xl font-bold mb-4">ユーザーが見つかりません</h2>
      <p className="text-gray-600">
        指定されたユーザーは存在しないか、削除された可能性があります。
      </p>
    </div>
  );
}

// app/users/loading.tsx — ローディングUI
export default function UsersLoading() {
  return (
    <div className="container mx-auto py-8">
      <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gray-200 animate-pulse rounded"
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 9. パフォーマンス最適化

### 9.1 データフェッチングのパフォーマンス指標

```
パフォーマンス最適化で注目すべき指標:

  1. Time to First Byte (TTFB)
     ├─ サーバーが最初のバイトを返すまでの時間
     ├─ 目標: 200ms以下
     └─ 影響: サーバーサイドフェッチの速度

  2. First Contentful Paint (FCP)
     ├─ 最初のコンテンツが描画されるまでの時間
     ├─ 目標: 1.8秒以下
     └─ 影響: ローディングUIの表示速度

  3. Largest Contentful Paint (LCP)
     ├─ 最大のコンテンツが描画されるまでの時間
     ├─ 目標: 2.5秒以下
     └─ 影響: データ取得完了後のレンダリング速度

  4. Time to Interactive (TTI)
     ├─ ユーザーが操作可能になるまでの時間
     ├─ 目標: 3.8秒以下
     └─ 影響: JavaScript のロードと実行

  5. Network Waterfall
     ├─ リクエストの連鎖的な遅延
     ├─ 目標: 最小化（並列化）
     └─ 測定: Chrome DevTools → Network タブ
```

### 9.2 キャッシュ戦略の最適化

```typescript
// ===========================
// staleTime と gcTime の最適な設定
// ===========================

// データの特性に応じた staleTime の設定指針
const cacheStrategies = {
  // ほぼ変更されないデータ（設定、マスタデータ）
  static: {
    staleTime: 24 * 60 * 60 * 1000, // 24時間
    gcTime: 48 * 60 * 60 * 1000,     // 48時間
  },

  // たまに変更されるデータ（ユーザープロフィール）
  semiStatic: {
    staleTime: 5 * 60 * 1000,        // 5分
    gcTime: 30 * 60 * 1000,           // 30分
  },

  // 頻繁に変更されるデータ（通知、フィード）
  dynamic: {
    staleTime: 30 * 1000,             // 30秒
    gcTime: 5 * 60 * 1000,            // 5分
  },

  // リアルタイムデータ（チャット、株価）
  realtime: {
    staleTime: 0,                     // 常にstale
    gcTime: 60 * 1000,                // 1分
    refetchInterval: 5 * 1000,        // 5秒ポーリング
  },
};

// 使用例
export function useAppConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.config.get(),
    ...cacheStrategies.static,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list(),
    ...cacheStrategies.dynamic,
  });
}
```

### 9.3 リクエストの最適化テクニック

```typescript
// ===========================
// 1. リクエストの並列化
// ===========================

// useQueries で複数クエリを並列実行
function DashboardWidgets() {
  const results = useQueries({
    queries: [
      {
        queryKey: ['dashboard', 'revenue'],
        queryFn: () => api.dashboard.getRevenue(),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['dashboard', 'users'],
        queryFn: () => api.dashboard.getUserStats(),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['dashboard', 'orders'],
        queryFn: () => api.dashboard.getOrderStats(),
        staleTime: 5 * 60 * 1000,
      },
    ],
  });

  const isLoading = results.some(r => r.isLoading);
  const hasError = results.some(r => r.isError);

  if (isLoading) return <DashboardSkeleton />;
  if (hasError) return <DashboardError />;

  const [revenue, users, orders] = results.map(r => r.data);

  return (
    <div className="grid grid-cols-3 gap-6">
      <RevenueWidget data={revenue} />
      <UsersWidget data={users} />
      <OrdersWidget data={orders} />
    </div>
  );
}

// ===========================
// 2. データの正規化と選択的取得
// ===========================

// select オプションで必要なデータのみ抽出
function useUserNames() {
  return useQuery({
    queryKey: queryKeys.users.list({}),
    queryFn: () => api.users.list(),
    // select でデータを変換（メモ化される）
    select: (data) => data.users.map(u => ({
      id: u.id,
      name: u.name,
    })),
  });
}

// 複数コンポーネントが同じクエリから異なるデータを選択
function useUserCount() {
  return useQuery({
    queryKey: queryKeys.users.list({}),
    queryFn: () => api.users.list(),
    select: (data) => data.totalCount, // カウントのみ
  });
}

// ===========================
// 3. バッチリクエスト
// ===========================

// 短時間に発生する複数リクエストをバッチ化
class RequestBatcher {
  private queue: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }[]> = new Map();
  private timeout: NodeJS.Timeout | null = null;

  async get<T>(id: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.queue.has(id)) {
        this.queue.set(id, []);
      }
      this.queue.get(id)!.push({ resolve, reject });

      // 10ms のデバウンス後にバッチリクエスト送信
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = setTimeout(() => this.flush(), 10);
    });
  }

  private async flush() {
    const ids = [...this.queue.keys()];
    const callbacks = new Map(this.queue);
    this.queue.clear();

    try {
      // 一括取得API
      const results = await api.batch.get(ids);

      for (const [id, data] of Object.entries(results)) {
        callbacks.get(id)?.forEach(cb => cb.resolve(data));
      }
    } catch (error) {
      for (const cbs of callbacks.values()) {
        cbs.forEach(cb => cb.reject(error));
      }
    }
  }
}

const userBatcher = new RequestBatcher();

// 個別のuseQuery が自動的にバッチ化される
export function useUserBatched(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => userBatcher.get<User>(userId),
    staleTime: 5 * 60 * 1000,
  });
}

// ===========================
// 4. Prefetch 戦略
// ===========================

// ルートプリフェッチ（ナビゲーション前）
function NavigationMenu() {
  const queryClient = useQueryClient();

  const routes = [
    { path: '/dashboard', prefetch: () => prefetchDashboard(queryClient) },
    { path: '/users', prefetch: () => prefetchUsers(queryClient) },
    { path: '/products', prefetch: () => prefetchProducts(queryClient) },
  ];

  return (
    <nav>
      {routes.map(route => (
        <Link
          key={route.path}
          href={route.path}
          onMouseEnter={route.prefetch}
          onFocus={route.prefetch}
        >
          {route.path}
        </Link>
      ))}
    </nav>
  );
}

async function prefetchDashboard(queryClient: QueryClient) {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'stats'],
      queryFn: () => api.dashboard.getStats(),
      staleTime: 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'recent-orders'],
      queryFn: () => api.orders.list({ limit: 5 }),
      staleTime: 30 * 1000,
    }),
  ]);
}
```

### 9.4 バンドルサイズの最適化

```typescript
// ===========================
// 1. 条件付きインポート（Code Splitting）
// ===========================

// DevTools はプロダクションでは読み込まない
import { lazy, Suspense } from 'react';

const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then(mod => ({
    default: mod.ReactQueryDevtools,
  })),
);

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <Suspense fallback={null}>
          <ReactQueryDevtools />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}

// ===========================
// 2. Tree Shaking の活用
// ===========================

// ❌ Bad: ライブラリ全体をインポート
import * as TanStackQuery from '@tanstack/react-query';

// ✅ Good: 必要な関数のみインポート
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ===========================
// 3. サーバーコンポーネントでの重い処理
// ===========================

// Server Component ではバンドルサイズを気にせず使える
// app/admin/analytics/page.tsx (Server Component)
import { Chart } from 'heavy-chart-library'; // クライアントには送信されない
import { marked } from 'marked';              // クライアントには送信されない

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();
  const reportHtml = marked(data.report);

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
      <AnalyticsChart data={data.chartData} />
    </div>
  );
}
```

---

## 10. テスト戦略

### 10.1 TanStack Query のテスト

```typescript
// テストユーティリティ
// test/utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,         // テストではリトライしない
        gcTime: Infinity,     // テスト中はキャッシュを保持
        staleTime: Infinity,  // テスト中はstaleにしない
      },
    },
  });
}

export function renderWithClient(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const testQueryClient = createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient: testQueryClient,
  };
}

// フック単体のテスト用ラッパー
export function createWrapper() {
  const testQueryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

```typescript
// カスタムフックのテスト
// hooks/__tests__/use-users.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useUsers, useCreateUser } from '../use-users';
import { createWrapper } from '@/test/utils';

// MSW でAPIモック
const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json({
      users: [
        { id: '1', name: 'Alice', email: 'alice@example.com' },
        { id: '2', name: 'Bob', email: 'bob@example.com' },
      ],
      totalCount: 2,
    });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      id: '3',
      ...body,
    }, { status: 201 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useUsers', () => {
  it('ユーザー一覧を取得できる', async () => {
    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    // 初期状態はローディング
    expect(result.current.isLoading).toBe(true);

    // データ取得完了を待つ
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.users).toHaveLength(2);
    expect(result.current.data?.users[0].name).toBe('Alice');
  });

  it('エラー時にエラー状態になる', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json(
          { message: 'Internal Server Error' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useCreateUser', () => {
  it('ユーザーを作成できる', async () => {
    const { result } = renderHook(() => useCreateUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'Charlie',
      email: 'charlie@example.com',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      id: '3',
      name: 'Charlie',
      email: 'charlie@example.com',
    });
  });
});
```

### 10.2 Server Components のテスト

```typescript
// Server Components のテスト
// app/users/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react';
import UsersPage from '../page';

// Prisma のモック
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: new Date() },
        { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: new Date() },
      ]),
    },
  },
}));

describe('UsersPage (Server Component)', () => {
  it('ユーザー一覧を表示する', async () => {
    // Server Component を await して結果を取得
    const page = await UsersPage();

    render(page);

    expect(screen.getByText('ユーザー一覧')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
```

### 10.3 Server Actions のテスト

```typescript
// Server Actions のテスト
// app/actions/__tests__/user-actions.test.ts
import { createUser, updateUser, deleteUser } from '../user-actions';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// モック
jest.mock('@/lib/prisma');
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: '1', role: 'admin' },
  }),
}));

describe('createUser', () => {
  it('有効なデータでユーザーを作成する', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
    });

    const formData = new FormData();
    formData.set('name', 'Test User');
    formData.set('email', 'test@example.com');
    formData.set('role', 'user');

    await createUser(null, formData);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/users');
    expect(redirect).toHaveBeenCalledWith('/users');
  });

  it('無効なメールアドレスでエラーを返す', async () => {
    const formData = new FormData();
    formData.set('name', 'Test User');
    formData.set('email', 'invalid-email');

    const result = await createUser(null, formData);

    expect(result).toEqual({
      success: false,
      errors: expect.objectContaining({
        email: expect.any(Array),
      }),
    });
  });

  it('重複メールアドレスでエラーを返す', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'existing@example.com',
    });

    const formData = new FormData();
    formData.set('name', 'Test User');
    formData.set('email', 'existing@example.com');

    const result = await createUser(null, formData);

    expect(result).toEqual({
      success: false,
      errors: {
        email: ['このメールアドレスは既に使用されています'],
      },
    });
  });
});
```

---

## 11. トラブルシューティング

### 11.1 よくある問題と解決策

```
問題1: useQuery が無限ループする

  原因: queryFn の中でオブジェクトリテラルを作成している
  ┌─────────────────────────────────────────────────┐
  │ ❌ Bad:                                          │
  │ useQuery({                                      │
  │   queryKey: ['users'],                          │
  │   queryFn: () => fetchUsers({ page: 1 }),       │
  │   // ↑ { page: 1 } が毎回新しい参照を作る       │
  │ });                                             │
  │                                                 │
  │ ✅ Good:                                         │
  │ const params = useMemo(() => ({ page: 1 }), []); │
  │ useQuery({                                      │
  │   queryKey: ['users', params],                  │
  │   queryFn: () => fetchUsers(params),            │
  │ });                                             │
  └─────────────────────────────────────────────────┘

問題2: データが古いまま更新されない

  原因: staleTime が長すぎる / invalidateQueries を忘れている
  ┌─────────────────────────────────────────────────┐
  │ 確認手順:                                        │
  │ 1. DevTools でキャッシュの状態を確認              │
  │ 2. staleTime の設定値を確認                      │
  │ 3. mutation の onSettled で invalidate しているか │
  │ 4. queryKey が正しいか（一致しないと別キャッシュ） │
  └─────────────────────────────────────────────────┘

問題3: SSR 時のハイドレーションミスマッチ

  原因: サーバーとクライアントでデータが異なる
  ┌─────────────────────────────────────────────────┐
  │ 解決策:                                          │
  │ 1. dehydrate/HydrationBoundary を正しく使う      │
  │ 2. サーバーで取得するデータとクライアントの        │
  │    queryKey を一致させる                         │
  │ 3. suppressHydrationWarning の使用（最終手段）    │
  └─────────────────────────────────────────────────┘

問題4: メモリリーク警告が出る

  原因: アンマウント後に状態更新が行われている
  ┌─────────────────────────────────────────────────┐
  │ TanStack Query を使えばほぼ解消される             │
  │ 手動 fetch の場合は AbortController を使用する    │
  └─────────────────────────────────────────────────┘

問題5: WebSocket 接続が頻繁に切断される

  原因: コンポーネントの再マウント / ネットワーク不安定
  ┌─────────────────────────────────────────────────┐
  │ 解決策:                                          │
  │ 1. WebSocket 接続をシングルトンで管理             │
  │ 2. 再接続ロジックの実装（指数バックオフ）         │
  │ 3. useRef で接続を保持                          │
  │ 4. Heartbeat の実装                             │
  └─────────────────────────────────────────────────┘
```

### 11.2 デバッグテクニック

```typescript
// ===========================
// 1. TanStack Query DevTools の活用
// ===========================

// DevTools でできること:
// - 全クエリのキャッシュ状態を一覧表示
// - 個々のクエリの stale / fresh / fetching 状態を確認
// - キャッシュの手動無効化・削除
// - クエリデータの直接編集
// - リフェッチのトリガー

// ===========================
// 2. カスタムロガーの実装
// ===========================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 開発環境でのみログを出力
      ...(process.env.NODE_ENV === 'development' && {
        meta: {
          onSettled: (data: unknown, error: unknown, query: any) => {
            if (error) {
              console.error(
                `[Query Error] ${query.queryKey}:`,
                error,
              );
            } else {
              console.log(
                `[Query Success] ${query.queryKey}:`,
                `${JSON.stringify(data).length} bytes`,
              );
            }
          },
        },
      }),
    },
  },
});

// ===========================
// 3. ネットワークリクエストの検査
// ===========================

// Chrome DevTools の Network タブでの確認項目:
// - リクエストの順序とタイミング（ウォーターフォール）
// - レスポンスサイズ（過大なデータ取得の検出）
// - キャッシュヒット状況（304 Not Modified）
// - CORS エラーの確認

// ===========================
// 4. Performance API での計測
// ===========================

function useQueryWithTiming<T>(options: UseQueryOptions<T>) {
  const startTime = performance.now();

  const result = useQuery({
    ...options,
    queryFn: async (...args) => {
      const fetchStart = performance.now();
      const data = await options.queryFn!(...args);
      const fetchEnd = performance.now();

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Fetch Timing] ${JSON.stringify(options.queryKey)}: ${(fetchEnd - fetchStart).toFixed(2)}ms`,
        );
      }

      return data;
    },
  });

  useEffect(() => {
    if (result.isSuccess) {
      const totalTime = performance.now() - startTime;
      if (totalTime > 3000) {
        console.warn(
          `[Slow Query] ${JSON.stringify(options.queryKey)}: ${totalTime.toFixed(2)}ms`,
        );
      }
    }
  }, [result.isSuccess]);

  return result;
}
```

### 11.3 本番環境での監視

```typescript
// ===========================
// エラー監視の統合（Sentry 例）
// ===========================

import * as Sentry from '@sentry/nextjs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // 最後のリトライ失敗時に Sentry に報告
        if (failureCount >= 2) {
          Sentry.captureException(error, {
            tags: { type: 'query_error' },
            extra: { failureCount },
          });
        }
        return failureCount < 3;
      },
    },
    mutations: {
      onError: (error) => {
        Sentry.captureException(error, {
          tags: { type: 'mutation_error' },
        });
      },
    },
  },
});

// ===========================
// パフォーマンス監視
// ===========================

// Web Vitals の収集
export function reportWebVitals(metric: {
  id: string;
  name: string;
  value: number;
}) {
  // Analytics に送信
  if (metric.name === 'LCP' && metric.value > 2500) {
    console.warn(`LCP is too slow: ${metric.value}ms`);
    Sentry.captureMessage(`Slow LCP detected: ${metric.value}ms`, 'warning');
  }
}
```

---

## 12. パターンの使い分けチートシート

### 12.1 ユースケース別推奨パターン

| ユースケース | 推奨パターン | 理由 |
|-------------|-------------|------|
| ブログ記事一覧 | SSG + ISR | SEO必要、更新頻度低い |
| ECサイト商品一覧 | RSC + revalidateTag | SEO必要、商品更新時に再検証 |
| ダッシュボード | RSC + TanStack Query | 初期データSSR、以降クライアント更新 |
| ユーザー設定画面 | TanStack Query | SEO不要、CRUD操作あり |
| チャットアプリ | TanStack Query + WebSocket | リアルタイム更新必須 |
| フォーム送信 | Server Actions | プログレッシブエンハンスメント |
| ファイルアップロード | useMutation | 進捗表示、エラーハンドリング |
| 検索機能 | TanStack Query + デバウンス | 動的フィルタリング |
| 無限スクロール | useInfiniteQuery | ページネーション管理 |
| マスタデータ | TanStack Query (staleTime: long) | 変更頻度が低い |
| 通知バッジ | TanStack Query + polling | 定期的な更新 |
| 管理画面テーブル | TanStack Query + RSC prefetch | ソート・フィルタ・ページネーション |

### 12.2 実装フローの決定木

```
データフェッチング実装フロー:

  Step 1: まず Server Component で実装を試みる
  ├─ async/await で直接データ取得
  ├─ Suspense で段階的レンダリング
  └─ バンドルサイズ影響なし

  Step 2: インタラクティブ性が必要か？
  ├─ YES → Client Component に移行
  │        ├─ 小規模 → SWR
  │        └─ 中〜大規模 → TanStack Query
  └─ NO → Server Component のまま

  Step 3: データ変更が必要か？
  ├─ フォーム送信 → Server Actions + useActionState
  ├─ 楽観的更新 → useMutation + onMutate
  └─ リアルタイム → WebSocket / SSE + Query invalidation

  Step 4: パフォーマンス最適化
  ├─ Prefetch（ナビゲーション前）
  ├─ 適切な staleTime 設定
  ├─ 並列データ取得（Promise.all / useQueries）
  └─ Streaming SSR（Suspense 境界の配置）
```

---

## FAQ

### Q1: TanStack QueryとSWRはどちらを選ぶべきか？
TanStack Queryはより多くの機能（楽観的更新、無限スクロール、オフライン対応、Mutation管理）を備えており、中〜大規模アプリケーションに適している。SWRはAPIがシンプルで学習コストが低く、読み取り中心の小規模プロジェクトに向いている。実務では、Mutationが多いアプリケーション（CRUD操作、フォーム送信が頻繁）にはTanStack Query、主にデータ表示がメインのダッシュボードやブログにはSWRを選ぶのが一般的である。Vercel製品との統合を重視する場合はSWRが自然な選択肢となる。

### Q2: Server ComponentsとTanStack Queryは併用すべきか？
Next.js App Routerを使用する場合、Server Componentsでの直接データ取得（fetch + cache）とTanStack Queryの併用が推奨される。初回表示に必要なデータはServer Componentsで取得してHTMLに含め、インタラクティブなデータ操作（フィルタリング、ページネーション、楽観的更新）にはTanStack Queryを使う。Server Componentsで取得したデータをTanStack Queryの初期データ（`initialData`）として渡すことで、ハイドレーション時のフラッシュを防ぎつつクライアントサイドのキャッシュ管理を実現できる。

### Q3: データフェッチングのウォーターフォール問題をどう回避するか？
ウォーターフォールとは、複数のデータ取得が直列に実行され、合計待ち時間が長くなる問題である。回避策は3つある。(1) `Promise.all` で並列化: 依存関係のないリクエストを同時に実行する。(2) `useQueries` で複数クエリを並列実行: TanStack Queryが自動的に並列管理する。(3) Suspense境界の活用: 各データ取得コンポーネントを独立した `<Suspense>` で囲み、Streaming SSRで段階的にレンダリングする。特にServer Componentsでは、非同期コンポーネントを `<Suspense>` で囲むだけで自動的に並列化される。

---

## まとめ

### 主要パターンの総括

| パターン | 実行環境 | 用途 | キャッシュ | 複雑度 |
|---------|---------|------|----------|--------|
| Server Components | サーバー | SEO必要な読み取り | fetch()キャッシュ | 低 |
| TanStack Query | クライアント | インタラクティブな読み取り | stale-while-revalidate | 中 |
| SWR | クライアント | シンプルな読み取り | stale-while-revalidate | 低 |
| Server Actions | サーバー | フォーム送信・データ変更 | revalidate | 低 |
| useMutation | クライアント | 楽観的更新 | onMutate/onSettled | 中 |
| useInfiniteQuery | クライアント | 無限スクロール | cursor/page管理 | 中 |
| WebSocket + Query | クライアント | リアルタイム更新 | invalidation | 高 |
| Apollo Client | クライアント | GraphQL | 正規化キャッシュ | 高 |

### ベストプラクティスまとめ

```
データフェッチングの10箇条:

  1. Server Component を第一選択とする
     → SEO対応、バンドルサイズゼロ、直接DBアクセス

  2. Query Key は Factory パターンで一元管理する
     → キャッシュの無効化が容易、型安全

  3. staleTime はデータの特性に応じて適切に設定する
     → 静的: 24h、準静的: 5min、動的: 30sec

  4. 楽観的更新は cancelQueries + ロールバック をセットで
     → UIの即応性を確保しつつ、整合性を維持

  5. エラーハンドリングは分類に応じて対処する
     → 4xx: リトライしない、5xx: 指数バックオフ

  6. ウォーターフォールを避ける
     → Promise.all、useQueries、Suspense で並列化

  7. Prefetch でナビゲーション体験を向上させる
     → マウスホバー、ルート遷移前

  8. テストは MSW + renderHook でカスタムフックを検証する
     → API モックで実際のネットワークに依存しない

  9. DevTools で開発中のキャッシュ状態を常に確認する
     → stale / fresh / fetching の遷移を把握

  10. 本番環境ではエラー監視とパフォーマンス計測を導入する
     → Sentry + Web Vitals で問題を早期発見
```

---

## 次に読むべきガイド

---

## 参考文献
1. TanStack. "TanStack Query Documentation." tanstack.com, 2024.
2. Next.js. "Data Fetching." nextjs.org/docs, 2024.
3. SWR. "React Hooks for Data Fetching." swr.vercel.app, 2024.
4. Vercel. "Server Actions and Mutations." nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations, 2024.
5. React. "React Server Components." react.dev/reference/rsc/server-components, 2024.
6. Kent C. Dodds. "How React Query Works Internally." epicreact.dev, 2023.
7. Dominik Dorfmeister (TkDodo). "Practical React Query." tkdodo.eu/blog, 2024.
8. Lee Robinson. "Understanding React Server Components." leerob.io, 2024.
9. Apollo. "Apollo Client Documentation." apollographql.com/docs, 2024.
10. MDN Web Docs. "Fetch API." developer.mozilla.org/docs/Web/API/Fetch_API, 2024.
