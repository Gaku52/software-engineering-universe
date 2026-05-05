# Server State Management

> Server state is fundamentally different from client state. Master all server data management techniques—TanStack Query and SWR cache strategies, the stale-while-revalidate pattern, infinite scroll, polling, and prefetching.

## Prerequisites

To study this chapter effectively, it is recommended that you acquire the following knowledge in advance:

  - The 4 state categories and the characteristics of server state
  - The essential difference between server state and client state
  - The Single Source of Truth principle
- **Fetch API / Async Processing**
  - Basic usage of `fetch()` and error handling
  - Writing async processing with `async/await`
  - Understanding Promises (then, catch, finally)
  - HTTP cache basics (Cache-Control, ETag)
  - The difference between browser cache and application cache
  - The concept of the stale-while-revalidate pattern

## Learning Objectives

- [ ] Understand the characteristics of server state and its essential difference from client state
- [ ] Understand cache strategy design principles (staleTime, gcTime, invalidation)
- [ ] Master TanStack Query from its basic API to advanced patterns
- [ ] Learn optimistic update implementation patterns
- [ ] Master infinite scroll and pagination implementation techniques
- [ ] Understand UX optimization through prefetching
- [ ] Establish library selection criteria through comparison with SWR
- [ ] Learn server state management anti-patterns and troubleshooting

---

## 1. The Nature of Server State

### 1.1 The Fundamental Difference Between Server State and Client State

"State" in a web application can be broadly classified into two categories based on its owner and characteristics. Correctly understanding this distinction is the first step toward appropriate state management design.

```
Server State vs Client State:

  Client State:
  ┌─────────────────────────────────────────────────┐
  │  Owner:       The application itself             │
  │  Access:      Synchronous (instantly accessible in memory) │
  │  Freshness:   Always up to date (single source of truth)   │
  │  Examples:    UI open/close state, form input, theme settings │
  │  Updates:     Reflected instantly on user action            │
  │  Persistence: Session only (lost on reload)                 │
  └─────────────────────────────────────────────────┘

  Server State:
  ┌─────────────────────────────────────────────────┐
  │  Owner:       Remote server (client holds a copy) │
  │  Access:      Asynchronous (fetched over the network) │
  │  Freshness:   Becomes stale over time            │
  │  Examples:    User list, product data, notification list │
  │  Updates:     Other clients may modify concurrently │
  │  Persistence: Persisted on the server side       │
  └─────────────────────────────────────────────────┘
```

### 1.2 The 5 Challenges of Server State Management

To properly manage server state, you need to solve the following 5 challenges.

```
The 5 Major Challenges of Server State Management:

  1. Caching
     → When should data be re-fetched?
     → How to set cache expiration?
     → How to control memory usage?

  2. Synchronization
     → How to keep the client-side copy up to date?
     → Sync data across multiple tabs?
     → How to implement automatic background re-fetching?

  3. Deduplication
     → How to combine multiple requests for the same data?
     → What if multiple components need the same data?
     → How to save network bandwidth?

  4. Optimistic Updates
     → How to update the UI before the API responds to improve perceived speed?
     → How to implement rollback on update failure?
     → How to prevent race conditions?

  5. Lifecycle Management
     → What is the behavior on component mount/unmount?
     → When should unused cache be discarded?
     → How to prevent memory leaks?
```

### 1.3 Why a Dedicated Library Is Necessary

Attempting to manage server state with plain React (useEffect + useState) leads to many problems.

```typescript
// Anti-pattern: data fetching with useEffect + useState
// An example of problematic code

function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false; // flag for cleanup

    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();

        if (!cancelled) {
          setUsers(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      cancelled = true; // cancel on unmount
    };
  }, []);

  // Problems:
  // 1. No caching → network request on every render
  // 2. Cannot share data with other components
  // 3. No re-fetch on window focus
  // 4. No retry on error
  // 5. Optimistic updates are hard to implement
  // 6. Must manage loading/error/data 3-state every time
  // 7. Race condition handling is manual
  // 8. Pagination/infinite scroll implementation is complex

  if (loading) return <Loading />;
  if (error) return <Error message={error.message} />;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

```typescript
// Recommended: Using TanStack Query
// All of the above problems are solved

function UserList() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(res => res.json()),
    staleTime: 30 * 1000,          // treat cache as fresh for 30 seconds
    retry: 3,                       // retry 3 times on error
    refetchOnWindowFocus: true,     // re-fetch on window focus
  });

  // Benefits:
  // 1. Automatic cache management
  // 2. Cache shared across multiple components
  // 3. Background re-fetching
  // 4. Automatic retry
  // 5. Debugging with DevTools
  // 6. Full TypeScript support

  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### 1.4 The stale-while-revalidate Pattern in Detail

The core concept of server state management libraries is the "stale-while-revalidate" pattern. This concept originates from the HTTP Cache-Control header and is a strategy of immediately returning cached stale data while re-fetching the latest data in the background.

```
stale-while-revalidate flow:

  First request:
  ┌─────────┐     GET /api/users      ┌──────────┐
  │ Client  │ ──────────────────────→  │  Server  │
  │         │ ←────────────────────── │          │
  └─────────┘     Response + Data     └──────────┘
       │
       ▼
  ┌─────────────────────┐
  │ Saved to cache       │
  │ status: "fresh"      │
  │ staleTime: 30s       │
  └─────────────────────┘

  Second request within 30 seconds (fresh period):
  ┌─────────┐                          ┌──────────┐
  │ Client  │ → return immediately from cache     │  Server  │
  │         │    (no request)            │          │
  └─────────┘                          └──────────┘

  Request after 30 seconds have passed (stale period):
  ┌─────────┐                          ┌──────────┐
  │ Client  │ → return stale cache immediately               │
  │         │ ──── background re-fetch ──→ │ Server │
  │         │ ←──── receive new data ────  │        │
  │         │ → auto-update UI              └────────┘
  └─────────┘

  Benefits:
  → Users always see data instantly (improved UX)
  → Data is updated to the latest in the background
  → Network latency is not felt by users
```

```typescript
// Configuration example to experience stale-while-revalidate

// Case 1: staleTime = 0 (default)
// → cache is always stale → background re-fetch every time
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 0, // default value
});

// Case 2: staleTime = Infinity
// → cache is always fresh → no re-fetch unless explicitly invalidated
const { data } = useQuery({
  queryKey: ['config'],
  queryFn: fetchConfig,
  staleTime: Infinity,
});

// Case 3: A realistic setting
// → fresh for 5 minutes → background re-fetch after 5 minutes
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

---

## 2. TanStack Query from Basics to Advanced

### 2.1 Setup and Provider Configuration

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global default settings
      staleTime: 60 * 1000,           // fresh for 1 minute
      gcTime: 5 * 60 * 1000,          // keep cache for 5 minutes
      retry: 3,                        // retry 3 times
      retryDelay: (attemptIndex) =>    // exponential backoff
        Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,      // re-fetch on window focus
      refetchOnReconnect: true,        // re-fetch on network reconnect
      refetchOnMount: true,            // re-fetch on mount
    },
    mutations: {
      retry: 1,                        // retry mutations once
    },
  },
});
```

```typescript
// src/app/providers.tsx
'use client'; // for Next.js App Router

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  // Note: do not create QueryClient inside a component (SSR concern)
  // Create it once with useState or define it at the module level
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
```

### 2.2 Query Key Design Patterns

Query Keys are cache identifiers, and their design is directly tied to the cache strategy for the entire application.

```typescript
// Query Key design principles

// Principle 1: Use a hierarchical structure (expressed as arrays)
// → Allows partial invalidation with invalidateQueries

// Basic patterns
['users']                          // user list
['users', userId]                  // specific user
['users', userId, 'posts']         // posts for a specific user
['users', userId, 'posts', postId] // specific post for a specific user

// Including filter, sort, and pagination
['users', { page: 1, sort: 'name', filter: 'active' }]
['users', { search: 'John', role: 'admin' }]

// Invalidation granularity
queryClient.invalidateQueries({ queryKey: ['users'] });
// → invalidates ['users'], ['users', 1], ['users', 1, 'posts'], etc.

queryClient.invalidateQueries({ queryKey: ['users', 1] });
// → invalidates only ['users', 1] and ['users', 1, 'posts']
```

```typescript
// Recommended: Query Key Factory pattern
// src/lib/query-keys.ts

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  posts: (id: string) => [...userKeys.detail(id), 'posts'] as const,
} as const;

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  reviews: (id: string) => [...productKeys.detail(id), 'reviews'] as const,
  related: (id: string) => [...productKeys.detail(id), 'related'] as const,
} as const;

// Type definitions
type UserFilters = {
  page?: number;
  search?: string;
  role?: 'admin' | 'user';
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
};

type ProductFilters = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
};
```

```typescript
// Using the Query Key Factory

// Fetch list
const { data } = useQuery({
  queryKey: userKeys.list({ page: 1, role: 'admin' }),
  queryFn: () => api.users.list({ page: 1, role: 'admin' }),
});

// Fetch detail
const { data } = useQuery({
  queryKey: userKeys.detail(userId),
  queryFn: () => api.users.get(userId),
});

// Invalidate (all user-related cache)
queryClient.invalidateQueries({ queryKey: userKeys.all });

// Invalidate (list only)
queryClient.invalidateQueries({ queryKey: userKeys.lists() });

// Invalidate (specific user only)
queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
```

### 2.3 Cache Lifecycle in Detail

```
Cache Lifecycle:

  ┌──────────────────────────────────────────────────────────────┐
  │                 Cache Entry State Transitions                 │
  ├──────────────────────────────────────────────────────────────┤
  │                                                              │
  │  [Initial fetch]                                             │
  │       │                                                      │
  │       ▼                                                      │
  │  ┌─────────┐  staleTime elapses  ┌─────────┐               │
  │  │  Fresh   │ ──────────────────→ │  Stale  │               │
  │  │         │                     │         │               │
  │  └─────────┘                     └─────────┘               │
  │       │                               │                     │
  │       │                               │  Trigger fired      │
  │       │                               │  (windowFocus, mount, etc.) │
  │       │                               ▼                     │
  │       │                          ┌──────────┐               │
  │       │                          │ Fetching │               │
  │       │                          │ (re-fetching) │          │
  │       │                          └──────────┘               │
  │       │                               │                     │
  │       │                               ▼                     │
  │       │                          ┌─────────┐               │
  │       │                          │  Fresh   │ ← fresh again │
  │       │                          └─────────┘               │
  │       │                                                      │
  │  [No observers (all components unmounted)]                   │
  │       │                                                      │
  │       ▼                                                      │
  │  ┌──────────┐  gcTime elapses   ┌──────────┐               │
  │  │ Inactive  │ ──────────────→   │ Garbage  │               │
  │  │           │                   │ Collected │               │
  │  └──────────┘                   └──────────┘               │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘
```

```typescript
// Configuration examples to understand the relationship between staleTime and gcTime

// Pattern 1: High-frequency update data (chat, notifications)
const notificationsQuery = {
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  staleTime: 0,                    // always stale → background re-fetch every time
  gcTime: 5 * 60 * 1000,           // keep cache for 5 minutes
  refetchInterval: 10 * 1000,      // poll every 10 seconds
  refetchIntervalInBackground: false, // do not poll on background tabs
};

// Pattern 2: Medium-frequency update data (user list, post list)
const usersQuery = {
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 30 * 1000,            // fresh for 30 seconds
  gcTime: 10 * 60 * 1000,          // keep cache for 10 minutes
};

// Pattern 3: Low-frequency update data (master data, categories)
const categoriesQuery = {
  queryKey: ['categories'],
  queryFn: fetchCategories,
  staleTime: 24 * 60 * 60 * 1000,  // fresh for 24 hours
  gcTime: Infinity,                 // cache forever
};

// Pattern 4: User-action-dependent data (CRUD targets)
const userDetailQuery = (id: string) => ({
  queryKey: userKeys.detail(id),
  queryFn: () => fetchUser(id),
  staleTime: 60 * 1000,            // fresh for 1 minute
  gcTime: 5 * 60 * 1000,           // keep cache for 5 minutes
  placeholderData: keepPreviousData, // show previous data as placeholder
});
```

### 2.4 Full Explanation of useQuery Options

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query';

const {
  // === Returned data ===
  data,                    // fetched data (type-safe)
  dataUpdatedAt,           // timestamp of the last data update
  error,                   // error object
  errorUpdatedAt,          // timestamp of the last error update
  failureCount,            // consecutive failure count
  failureReason,           // most recent failure reason

  // === Status flags ===
  status,                  // 'pending' | 'error' | 'success'
  fetchStatus,             // 'fetching' | 'paused' | 'idle'
  isLoading,               // status === 'pending' && fetchStatus === 'fetching'
  isFetching,              // fetchStatus === 'fetching' (including background re-fetch)
  isPending,               // status === 'pending'
  isError,                 // status === 'error'
  isSuccess,               // status === 'success'
  isRefetching,            // isFetching && !isLoading
  isStale,                 // whether data is stale
  isPaused,                // fetchStatus === 'paused'
  isPlaceholderData,       // whether placeholderData is in use
  isFetched,               // whether fetch has completed at least once
  isFetchedAfterMount,     // whether fetch completed after mount

  // === Methods ===
  refetch,                 // manually re-fetch
} = useQuery({
  // === Required options ===
  queryKey: ['users', userId],  // cache key (array)
  queryFn: ({ signal }) =>      // data fetching function (AbortSignal recommended)
    fetch(`/api/users/${userId}`, { signal }).then(r => r.json()),

  // === Cache control ===
  staleTime: 60 * 1000,         // duration data is considered fresh (ms)
  gcTime: 5 * 60 * 1000,        // retention period for inactive cache (ms)

  // === Re-fetch control ===
  refetchOnWindowFocus: true,    // on window focus
  refetchOnReconnect: true,      // on network reconnect
  refetchOnMount: true,          // on component mount
  refetchInterval: false,        // polling interval (ms, false to disable)
  refetchIntervalInBackground: false, // poll even on background tabs?

  // === Retry control ===
  retry: 3,                      // retry count (true=infinite, false=0)
  retryDelay: (attempt) =>       // retry interval (exponential backoff recommended)
    Math.min(1000 * 2 ** attempt, 30000),
  retryOnMount: true,            // retry on mount?

  // === Conditional query ===
  enabled: !!userId,             // stop query execution when false

  // === Data transformation ===
  select: (data) => data.users,  // transform or filter the returned data

  // === Placeholder ===
  placeholderData: keepPreviousData,  // use previous data as placeholder
  // or fixed value: placeholderData: { users: [] },
  // or function: placeholderData: (previousData) => previousData,

  // === initialData ===
  initialData: undefined,        // initial data (saved to cache)
  initialDataUpdatedAt: undefined, // timestamp for initialData

  // === Structural sharing ===
  structuralSharing: true,       // referential identity optimization

  // === Network mode ===
  networkMode: 'online',         // 'online' | 'always' | 'offlineFirst'
});
```

### 2.5 Dependent Queries with the enabled Option

```typescript
// Dependent queries: execute the next query based on the result of another

// Step 1: Fetch user information
function useUserWithPosts(userId: string) {
  // First, fetch user info
  const userQuery = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => api.users.get(userId),
  });

  // Once the user's organization ID is available, fetch the organization
  const organizationQuery = useQuery({
    queryKey: ['organizations', userQuery.data?.organizationId],
    queryFn: () => api.organizations.get(userQuery.data!.organizationId),
    enabled: !!userQuery.data?.organizationId, // execute only when user data is available
  });

  // Fetch the user's post list
  const postsQuery = useQuery({
    queryKey: userKeys.posts(userId),
    queryFn: () => api.users.getPosts(userId),
    enabled: userQuery.isSuccess, // execute after user fetch succeeds
  });

  return {
    user: userQuery.data,
    organization: organizationQuery.data,
    posts: postsQuery.data,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
  };
}
```

```typescript
// Another pattern for dependent queries: search form

function useSearchResults(searchTerm: string) {
  // Execute query only when the search term is 2 or more characters
  return useQuery({
    queryKey: ['search', searchTerm],
    queryFn: () => api.search(searchTerm),
    enabled: searchTerm.length >= 2, // do not run for fewer than 2 characters
    staleTime: 5 * 60 * 1000,       // cache search results for 5 minutes
    placeholderData: keepPreviousData, // show previous results when search term changes
  });
}

function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300); // 300ms debounce
  const { data, isLoading, isPlaceholderData } = useSearchResults(debouncedSearch);

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      <div style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
        {data?.results.map(result => (
          <SearchResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}
```

### 2.6 Data Transformation with the select Option

```typescript
// Use select to transform server responses for the client

// Example 1: Extract only needed fields
const { data: userNames } = useQuery({
  queryKey: userKeys.lists(),
  queryFn: () => api.users.list(),
  select: (data) => data.map(user => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  })),
});

// Example 2: Filtering
const { data: activeUsers } = useQuery({
  queryKey: userKeys.lists(),
  queryFn: () => api.users.list(),
  select: (data) => data.filter(user => user.status === 'active'),
});

// Example 3: Aggregation
const { data: userCount } = useQuery({
  queryKey: userKeys.lists(),
  queryFn: () => api.users.list(),
  select: (data) => data.length,
});

// Important: select runs on cached data
// → Multiple components using the same queryKey with different select
//   will only issue one network request

// Performance note: stable reference for select
// Stabilizing the reference with useCallback prevents unnecessary recomputation
const selectActiveUsers = useCallback(
  (data: User[]) => data.filter(u => u.status === 'active'),
  []
);

const { data } = useQuery({
  queryKey: userKeys.lists(),
  queryFn: () => api.users.list(),
  select: selectActiveUsers,
});
```

---

## 3. Complete Guide to Mutations (Data Updates)

### 3.1 useMutation Basics

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Basic mutation definition
function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    // === Mutation function ===
    mutationFn: (newUser: CreateUserInput) =>
      api.users.create(newUser),

    // === Callbacks ===
    onMutate: async (variables) => {
      // Called before the mutation starts
      // Used for cache manipulation for optimistic updates
      console.log('Creating user:', variables);
    },

    onSuccess: (data, variables, context) => {
      // Called when the mutation succeeds
      // data: server response
      // variables: arguments passed to mutationFn
      // context: return value of onMutate

      // Invalidate cache to trigger re-fetch
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });

      // Or directly update the cache
      queryClient.setQueryData(
        userKeys.detail(data.id),
        data
      );
    },

    onError: (error, variables, context) => {
      // Called when the mutation fails
      console.error('Failed to create user:', error);
    },

    onSettled: (data, error, variables, context) => {
      // Called last regardless of success or failure
      // Cache invalidation can also be done here
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },

    // === Retry ===
    retry: 1,

    // === Network mode ===
    networkMode: 'online',
  });
}
```

```typescript
// Mutation usage example
function CreateUserForm() {
  const createUser = useCreateUser();

  const handleSubmit = async (formData: CreateUserInput) => {
    try {
      const newUser = await createUser.mutateAsync(formData);
      // mutateAsync returns a Promise → can use try/catch
      toast.success(`User "${newUser.name}" created`);
      router.push(`/users/${newUser.id}`);
    } catch (error) {
      toast.error('Failed to create user');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button
        type="submit"
        disabled={createUser.isPending}
      >
        {createUser.isPending ? 'Creating...' : 'Create User'}
      </button>
      {createUser.isError && (
        <p className="error">{createUser.error.message}</p>
      )}
    </form>
  );
}
```

### 3.2 Full CRUD Implementation Pattern

```typescript
// src/hooks/useUserMutations.ts
// Pattern that consolidates CRUD operations into a single custom hook

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userKeys } from '@/lib/query-keys';
import { api } from '@/lib/api';

// === Create ===
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.users.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

// === Update ===
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      api.users.update(id, data),
    onSuccess: (updatedUser) => {
      // Directly update the detail cache
      queryClient.setQueryData(
        userKeys.detail(updatedUser.id),
        updatedUser
      );
      // Invalidate the list cache
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

// === Delete ===
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove the detail cache entry
      queryClient.removeQueries({ queryKey: userKeys.detail(deletedId) });
      // Invalidate the list cache
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

// === Bulk Operations ===
export function useBulkDeleteUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => api.users.bulkDelete(ids),
    onSuccess: () => {
      // Invalidate all user-related cache
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
```

### 3.3 Full Implementation of Optimistic Updates

Optimistic updates are a pattern of immediately updating the UI without waiting for the server response. They greatly improve user experience, but require careful implementation.

```typescript
// Full implementation pattern for optimistic updates

export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Todo> }) =>
      api.todos.update(id, data),

    // Step 1: Optimistically update the cache in onMutate
    onMutate: async ({ id, data }) => {
      // Cancel in-flight re-fetches (so they don't overwrite the optimistic update)
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      await queryClient.cancelQueries({ queryKey: ['todos', id] });

      // Save the current cache (for rollback)
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);
      const previousTodo = queryClient.getQueryData<Todo>(['todos', id]);

      // Optimistically update the list cache
      if (previousTodos) {
        queryClient.setQueryData<Todo[]>(['todos'], (old) =>
          old?.map(todo =>
            todo.id === id ? { ...todo, ...data } : todo
          )
        );
      }

      // Optimistically update the detail cache
      if (previousTodo) {
        queryClient.setQueryData<Todo>(['todos', id], (old) =>
          old ? { ...old, ...data } : old
        );
      }

      // Return context for rollback
      return { previousTodos, previousTodo };
    },

    // Step 2: Rollback in onError
    onError: (error, { id }, context) => {
      // Restore the cache on error
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos'], context.previousTodos);
      }
      if (context?.previousTodo) {
        queryClient.setQueryData(['todos', id], context.previousTodo);
      }

      // Error notification
      toast.error('Update failed. Changes have been reverted.');
    },

    // Step 3: Re-validate the cache in onSettled
    onSettled: (_, __, { id }) => {
      // Sync with the latest server data regardless of success/failure
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['todos', id] });
    },
  });
}
```

```typescript
// Optimistic update: adding a list item

export function useAddTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newTodo: CreateTodoInput) => api.todos.create(newTodo),

    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

      // Add to the list with a temporary ID (UI updates immediately)
      const optimisticTodo: Todo = {
        id: `temp-${Date.now()}`, // temporary ID
        ...newTodo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old ? [...old, optimisticTodo] : [optimisticTodo]
      );

      return { previousTodos };
    },

    onSuccess: (serverTodo) => {
      // Update the cache with the official data returned from the server
      // (the temporary ID is replaced with the real ID)
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old?.map(todo =>
          todo.id.startsWith('temp-') ? serverTodo : todo
        )
      );
    },

    onError: (error, newTodo, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos'], context.previousTodos);
      }
      toast.error('Failed to add item');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

```typescript
// Optimistic update: deleting a list item

export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.todos.delete(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

      // Remove from list immediately
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old?.filter(todo => todo.id !== id)
      );

      return { previousTodos };
    },

    onError: (error, id, context) => {
      // Restore the list on failure
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos'], context.previousTodos);
      }
      toast.error('Failed to delete item');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

### 3.4 Mutation State Management and UI Patterns

```typescript
// UI display making full use of mutation states

function TodoItem({ todo }: { todo: Todo }) {
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 rounded-lg',
        deleteTodo.isPending && 'opacity-50 pointer-events-none',
      )}
    >
      <Checkbox
        checked={todo.completed}
        disabled={updateTodo.isPending}
        onCheckedChange={(checked) => {
          updateTodo.mutate({
            id: todo.id,
            data: { completed: checked as boolean },
          });
        }}
      />

      <span className={cn(
        todo.completed && 'line-through text-muted-foreground',
        updateTodo.isPending && 'animate-pulse',
      )}>
        {todo.title}
      </span>

      <button
        onClick={() => {
          if (confirm('Are you sure you want to delete this?')) {
            deleteTodo.mutate(todo.id);
          }
        }}
        disabled={deleteTodo.isPending}
      >
        {deleteTodo.isPending ? <Spinner /> : <TrashIcon />}
      </button>

      {/* Error display */}
      {updateTodo.isError && (
        <span className="text-red-500 text-sm">
          Update failed
          <button onClick={() => updateTodo.reset()}>Dismiss</button>
        </span>
      )}
    </div>
  );
}
```

---

## 4. Infinite Scroll and Pagination

### 4.1 useInfiniteQuery in Detail

```typescript
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';

// Cursor-based infinite scroll
function useInfiniteUsers(filters?: UserFilters) {
  return useInfiniteQuery({
    queryKey: ['users', 'infinite', filters],

    queryFn: async ({ pageParam, signal }) => {
      const response = await api.users.list({
        cursor: pageParam,
        limit: 20,
        ...filters,
        signal, // pass AbortSignal for cancellation support
      });
      return response;
    },

    // Initial page parameter
    initialPageParam: undefined as string | undefined,

    // Determine the next page parameter
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,

    // Previous page parameter (for bidirectional scroll)
    getPreviousPageParam: (firstPage) =>
      firstPage.meta.hasPreviousPage ? firstPage.meta.previousCursor : undefined,

    // Cache settings
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,

    // Limit the maximum number of pages (memory protection)
    maxPages: 10,
  });
}
```

```typescript
// Auto-loading with Intersection Observer

import { useInView } from 'react-intersection-observer';

function UserInfiniteList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    isFetching,
  } = useInfiniteUsers();

  // Intersection Observer: load the next page when the element enters the viewport
  const { ref: loadMoreRef } = useInView({
    threshold: 0,
    rootMargin: '200px', // trigger 200px before entering view (prefetch)
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  // Flatten all pages into a single array
  const allUsers = data?.pages.flatMap(page => page.data) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <UserCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorMessage
        error={error}
        onRetry={() => fetchNextPage()}
      />
    );
  }

  return (
    <div>
      {/* Background re-fetch indicator */}
      {isFetching && !isFetchingNextPage && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
      )}

      {/* User list */}
      <div className="grid grid-cols-3 gap-4">
        {allUsers.map(user => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-8 text-center">
        {isFetchingNextPage ? (
          <Spinner />
        ) : hasNextPage ? (
          <p className="text-muted-foreground">
            Scroll to load more
          </p>
        ) : (
          <p className="text-muted-foreground">
            All users shown ({allUsers.length} total)
          </p>
        )}
      </div>
    </div>
  );
}
```

### 4.2 Offset-Based Pagination

```typescript
// Offset-based pagination (traditional style)

function usePagedUsers(page: number, pageSize: number = 20) {
  return useQuery({
    queryKey: ['users', 'paged', { page, pageSize }],
    queryFn: () => api.users.list({
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    placeholderData: keepPreviousData, // no flicker on page transition
    staleTime: 30 * 1000,
  });
}

function UserPagedList() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const {
    data,
    isLoading,
    isPlaceholderData,
    isFetching,
  } = usePagedUsers(page, pageSize);

  // Prefetch the next page
  const queryClient = useQueryClient();
  useEffect(() => {
    if (data?.meta.hasNextPage) {
      queryClient.prefetchQuery({
        queryKey: ['users', 'paged', { page: page + 1, pageSize }],
        queryFn: () => api.users.list({
          offset: page * pageSize,
          limit: pageSize,
        }),
      });
    }
  }, [data, page, pageSize, queryClient]);

  if (isLoading) return <TableSkeleton rows={pageSize} />;

  return (
    <div style={{ opacity: isPlaceholderData ? 0.7 : 1 }}>
      {isFetching && <ProgressBar />}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination
        currentPage={page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
        disabled={isPlaceholderData}
      />
    </div>
  );
}
```

### 4.3 Combining with Virtualization

When displaying large amounts of data, combining with a virtualization library can dramatically improve performance.

```typescript
// Combining with @tanstack/react-virtual

import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedInfiniteList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteUsers();

  const allItems = data?.pages.flatMap(page => page.data) ?? [];

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allItems.length + 1 : allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // estimated height per row (px)
    overscan: 5,            // number of extra rows to render off-screen
  });

  // Load the next page when the last item becomes visible
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    if (!lastItem) return;

    if (
      lastItem.index >= allItems.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    virtualizer.getVirtualItems(),
    hasNextPage,
    isFetchingNextPage,
    allItems.length,
    fetchNextPage,
  ]);

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const isLoaderRow = virtualRow.index > allItems.length - 1;
          const item = allItems[virtualRow.index];

          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                isFetchingNextPage ? <Spinner /> : null
              ) : (
                <UserCard user={item} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 5. Prefetching and SSR Integration

### 5.1 Prefetching Based on User Interactions

Prefetching is the technique of fetching data in the background before the user actually needs it. When implemented properly, page transitions feel instantaneous.

```typescript
// Pattern 1: Prefetch on mouse hover
function UserListItem({ user }: { user: User }) {
  const queryClient = useQueryClient();

  const prefetchUserDetail = () => {
    queryClient.prefetchQuery({
      queryKey: userKeys.detail(user.id),
      queryFn: () => api.users.get(user.id),
      staleTime: 60 * 1000, // treat cache as fresh for 1 minute
    });
  };

  return (
    <Link
      to={`/users/${user.id}`}
      onMouseEnter={prefetchUserDetail}  // start prefetch on hover
      onFocus={prefetchUserDetail}       // also prefetch on keyboard focus
    >
      <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
        <Avatar src={user.avatarUrl} alt={user.name} />
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
    </Link>
  );
}
```

```typescript
// Pattern 2: Prefetch on route transition (React Router v6)

import { useQueryClient } from '@tanstack/react-query';

// Prefetch in the loader function
export const userDetailLoader =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const userId = params.userId!;

    // Do not request if cache is fresh
    await queryClient.ensureQueryData({
      queryKey: userKeys.detail(userId),
      queryFn: () => api.users.get(userId),
      staleTime: 60 * 1000,
    });

    // Prefetch related data in parallel
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: userKeys.posts(userId),
        queryFn: () => api.users.getPosts(userId),
      }),
      queryClient.prefetchQuery({
        queryKey: ['organizations', userId],
        queryFn: () => api.users.getOrganization(userId),
      }),
    ]);

    return null; // loader return value not used (use TanStack Query cache)
  };

// Router configuration
const router = createBrowserRouter([
  {
    path: '/users/:userId',
    element: <UserDetailPage />,
    loader: userDetailLoader(queryClient),
  },
]);
```

```typescript
// Pattern 3: Prefetch based on scroll position

function ProductGrid({ products }: { products: Product[] }) {
  const queryClient = useQueryClient();

  // Prefetch data for products approaching the viewport
  const prefetchProduct = useCallback((productId: string) => {
    queryClient.prefetchQuery({
      queryKey: productKeys.detail(productId),
      queryFn: () => api.products.get(productId),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  return (
    <div className="grid grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onVisible={() => prefetchProduct(product.id)} // prefetch when visible
        />
      ))}
    </div>
  );
}

// ProductCard that detects visibility with Intersection Observer
function ProductCard({
  product,
  onVisible,
}: {
  product: Product;
  onVisible: () => void;
}) {
  const { ref } = useInView({
    triggerOnce: true, // fire only once
    rootMargin: '100px',
    onChange: (inView) => {
      if (inView) onVisible();
    },
  });

  return (
    <div ref={ref}>
      <Link to={`/products/${product.id}`}>
        <img src={product.imageUrl} alt={product.name} />
        <h3>{product.name}</h3>
        <p>{product.price}</p>
      </Link>
    </div>
  );
}
```

### 5.2 SSR Integration with Next.js App Router

```typescript
// Prefetching in Next.js Server Components (App Router)
// app/users/page.tsx

import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import { UserList } from '@/components/UserList';

export default async function UsersPage() {
  // In Server Components, create a new QueryClient per request
  const queryClient = new QueryClient();

  // Fetch data on the server side
  await queryClient.prefetchQuery({
    queryKey: userKeys.lists(),
    queryFn: () => fetchUsersFromDB(), // access DB/API directly on the server
  });

  return (
    // Pass the server-side cache to the client with dehydrate
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserList />
    </HydrationBoundary>
  );
}
```

```typescript
// app/users/[userId]/page.tsx
// Prefetching for dynamic routes

import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';

interface PageProps {
  params: { userId: string };
}

export default async function UserDetailPage({ params }: PageProps) {
  const queryClient = new QueryClient();

  // Fetch data in parallel
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: userKeys.detail(params.userId),
      queryFn: () => fetchUserFromDB(params.userId),
    }),
    queryClient.prefetchQuery({
      queryKey: userKeys.posts(params.userId),
      queryFn: () => fetchUserPostsFromDB(params.userId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserDetail userId={params.userId} />
    </HydrationBoundary>
  );
}

// Client component
// components/UserDetail.tsx
'use client';

export function UserDetail({ userId }: { userId: string }) {
  // Data prefetched on the server is returned immediately from cache
  // → No loading indicator on initial render
  const { data: user } = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => api.users.get(userId), // client-side fallback
  });

  const { data: posts } = useQuery({
    queryKey: userKeys.posts(userId),
    queryFn: () => api.users.getPosts(userId),
  });

  if (!user) return null;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <h2>Posts</h2>
      {posts?.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

### 5.3 Notes on QueryClient Configuration for SSR

```typescript
// Important: QueryClient creation patterns for SSR environments

// Anti-pattern: create only one instance at the module level
// → Cache is shared across requests!
// const queryClient = new QueryClient(); // dangerous!

// Recommended pattern 1: Create a new instance in each Server Component
export default async function Page() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // SSR data is fresh for 1 minute
      },
    },
  });
  // ...
}

// Recommended pattern 2: Create once in Provider using useState
'use client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Initializing with useState ensures the same instance is used for the lifetime
  // of the component, and is not shared across requests during SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

---

## 6. Polling and Real-Time Updates

### 6.1 Polling (Periodic Re-fetching)

```typescript
// Basic polling
function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30 * 1000,            // re-fetch every 30 seconds
    refetchIntervalInBackground: false,     // stop on background tabs
  });
}
```

```typescript
// Conditional polling: change interval based on processing status

function useJobStatus(jobId: string) {
  return useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => api.jobs.getStatus(jobId),

    // Stop polling when the job is complete
    refetchInterval: (query) => {
      const status = query.state.data?.status;

      if (status === 'completed' || status === 'failed') {
        return false; // stop polling
      }
      if (status === 'processing') {
        return 2 * 1000; // poll every 2 seconds while processing
      }
      return 10 * 1000; // poll every 10 seconds otherwise
    },

    // only fetch if there is no initial data
    enabled: !!jobId,
  });
}

// Usage example: monitoring file upload progress
function UploadProgress({ jobId }: { jobId: string }) {
  const { data: job } = useJobStatus(jobId);

  if (!job) return <Spinner />;

  return (
    <div>
      <ProgressBar value={job.progress} max={100} />
      <p>Status: {job.status}</p>
      {job.status === 'completed' && <p>Completed!</p>}
      {job.status === 'failed' && <p>Error: {job.error}</p>}
    </div>
  );
}
```

### 6.2 Integration with WebSockets

```typescript
// Receive real-time updates via WebSocket and update the cache

// src/hooks/useRealtimeUpdates.ts
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'USER_UPDATED':
          // Directly update the cache for the specific user
          queryClient.setQueryData(
            userKeys.detail(message.payload.id),
            message.payload
          );
          // Invalidate the user list as well
          queryClient.invalidateQueries({ queryKey: userKeys.lists() });
          break;

        case 'USER_CREATED':
          // Invalidate the list cache to trigger re-fetch
          queryClient.invalidateQueries({ queryKey: userKeys.lists() });
          break;

        case 'USER_DELETED':
          // Remove from cache
          queryClient.removeQueries({
            queryKey: userKeys.detail(message.payload.id),
          });
          queryClient.invalidateQueries({ queryKey: userKeys.lists() });
          break;

        case 'NOTIFICATION':
          // Invalidate notification cache
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          break;
      }
    };

    ws.onclose = () => {
      // Reconnection logic
      console.log('WebSocket closed, attempting reconnect...');
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);
}

// Usage in App.tsx
function App() {
  useRealtimeUpdates();
  return <RouterProvider router={router} />;
}
```

```typescript
// Integration with Server-Sent Events (SSE)

function useSSEUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('data-update', (event) => {
      const data = JSON.parse(event.data);

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: [data.entity],
      });
    });

    eventSource.addEventListener('cache-invalidate', (event) => {
      const { queryKey } = JSON.parse(event.data);
      queryClient.invalidateQueries({ queryKey });
    });

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
      // Reconnection logic
      setTimeout(() => {
        // reconnect
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);
}
```

### 6.3 Choosing Between Polling and WebSockets

```
Real-Time Update Method Comparison:

┌─────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Characteristic  │ Polling          │ SSE              │ WebSocket        │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Direction       │ Client →         │ Server →         │ Bidirectional    │
│                 │ Server           │ Client           │                  │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Real-time       │ Low              │ High             │ Highest          │
│                 │ (depends on      │ (server push)    │ (server push)    │
│                 │  interval)       │                  │                  │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Complexity      │ Simple           │ Moderate         │ Complex          │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Server load     │ High             │ Moderate         │ Low to moderate  │
│                 │ (periodic req.)  │ (keep-alive)     │ (keep-alive)     │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Scalability     │ Good             │ Good             │ Caution needed   │
│                 │ (stateless)      │ (HTTP compliant) │ (stateful)       │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Use cases       │ Dashboard,       │ Notifications,   │ Chat,            │
│                 │ job monitoring   │ news feed        │ collaboration    │
└─────────────────┴──────────────────┴──────────────────┴──────────────────┘

Recommendations:
  → Low update frequency (30+ seconds): Polling
  → One-way push from server: SSE
  → Bidirectional real-time communication: WebSocket
  → Want to start easily: Polling → migrate to SSE/WebSocket as needed
```

---

## 7. Error Handling and Retry

### 7.1 Global Error Handling

```typescript
// src/lib/query-client.ts
// Global error handling configuration

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Handle all query errors here

      // Auth error: redirect to login page
      if (error instanceof ApiError && error.status === 401) {
        // Token expired → redirect to login
        window.location.href = '/login';
        return;
      }

      // 403 Forbidden: insufficient permissions notification
      if (error instanceof ApiError && error.status === 403) {
        toast.error('You do not have permission to perform this action');
        return;
      }

      // Notify on error only if cache already has data
      // (first-load errors are handled at the component level)
      if (query.state.data !== undefined) {
        toast.error(`Failed to update data: ${error.message}`);
      }
    },
  }),

  mutationCache: new MutationCache({
    onError: (error, variables, context, mutation) => {
      // Handle all mutation errors here

      // Auth error
      if (error instanceof ApiError && error.status === 401) {
        window.location.href = '/login';
        return;
      }

      // Validation errors are handled at the component level
      if (error instanceof ApiError && error.status === 422) {
        return; // skip global handling
      }

      // Other errors
      toast.error(`Operation failed: ${error.message}`);
    },
  }),

  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Do not retry for specific HTTP status codes
        if (error instanceof ApiError) {
          if ([400, 401, 403, 404, 422].includes(error.status)) {
            return false; // no retry
          }
        }
        // Retry up to 3 times for everything else
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

### 7.2 Component-Level Error Handling

```typescript
// Error handling with Error Boundary and Suspense

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense } from 'react';

function UserSection() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="p-4 border border-red-300 rounded-lg bg-red-50">
              <h3 className="font-bold text-red-800">
                Failed to fetch data
              </h3>
              <p className="text-red-600 mt-1">{error.message}</p>
              <button
                onClick={resetErrorBoundary}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}
        >
          <Suspense fallback={<UserListSkeleton />}>
            <UserList />
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

// Suspense-compatible with useSuspenseQuery
function UserList() {
  // useSuspenseQuery guarantees data is always defined (never undefined)
  const { data: users } = useSuspenseQuery({
    queryKey: userKeys.lists(),
    queryFn: () => api.users.list(),
  });

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### 7.3 Custom Error Classes and API Client

```typescript
// src/lib/api-error.ts
// Custom error class

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  // Whether it is a validation error
  get isValidationError(): boolean {
    return this.status === 422;
  }

  // Whether it is an auth error
  get isAuthError(): boolean {
    return this.status === 401;
  }

  // Whether it is a forbidden error
  get isForbidden(): boolean {
    return this.status === 403;
  }

  // Whether it is a not found error
  get isNotFound(): boolean {
    return this.status === 404;
  }

  // Whether it is a server error
  get isServerError(): boolean {
    return this.status >= 500;
  }
}
```

```typescript
// src/lib/api-client.ts
// API client with error handling

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));

    throw new ApiError(
      errorBody.message || `HTTP error ${response.status}`,
      response.status,
      errorBody.code,
      errorBody.details,
    );
  }

  // For 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// API definitions
export const api = {
  users: {
    list: (params?: UserFilters) =>
      apiClient<PaginatedResponse<User>>(`/users?${new URLSearchParams(params as any)}`),
    get: (id: string) =>
      apiClient<User>(`/users/${id}`),
    create: (data: CreateUserInput) =>
      apiClient<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateUserInput) =>
      apiClient<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiClient<void>(`/users/${id}`, { method: 'DELETE' }),
  },
};
```

### 7.4 Retry Strategies in Detail

```typescript
// Retry strategy patterns

// Pattern 1: Exponential backoff (recommended)
const retryWithExponentialBackoff = {
  retry: 3,
  retryDelay: (attemptIndex: number) => {
    // 1s → 2s → 4s (max 30s)
    return Math.min(1000 * 2 ** attemptIndex, 30000);
  },
};

// Pattern 2: Exponential backoff with jitter (for many clients)
const retryWithJitter = {
  retry: 3,
  retryDelay: (attemptIndex: number) => {
    const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
    // Add ±25% jitter (spread concurrent requests to the server)
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    return baseDelay + jitter;
  },
};

// Pattern 3: Smart retry based on error type
const smartRetry = {
  retry: (failureCount: number, error: unknown) => {
    if (error instanceof ApiError) {
      // Do not retry for client errors
      if (error.status >= 400 && error.status < 500) {
        return false;
      }
      // Retry for rate limit errors (with longer interval)
      if (error.status === 429) {
        return failureCount < 5;
      }
    }
    // Retry up to 3 times for network errors and server errors
    return failureCount < 3;
  },
  retryDelay: (attemptIndex: number, error: unknown) => {
    // Longer interval for rate limiting
    if (error instanceof ApiError && error.status === 429) {
      const retryAfter = error.details?.retryAfter;
      if (retryAfter) {
        return parseInt(retryAfter) * 1000;
      }
      return 60 * 1000; // default: wait 1 minute
    }
    return Math.min(1000 * 2 ** attemptIndex, 30000);
  },
};
```

---

## 8. TanStack Query vs SWR: Detailed Comparison

### 8.1 Feature Comparison Table

```
TanStack Query vs SWR Detailed Comparison:

┌──────────────────────────┬──────────────────┬──────────────────┐
│ Feature                  │ TanStack Query   │ SWR              │
├──────────────────────────┼──────────────────┼──────────────────┤
│ Developer                │ TanStack         │ Vercel           │
│ Bundle size (gzip)       │ ~13KB            │ ~4KB             │
│ TypeScript               │ Full support     │ Full support     │
│ DevTools                 │ Excellent (GUI)  │ Limited (SWR)    │
│ Framework support        │ React, Vue,      │ React only       │
│                          │ Solid, Svelte,   │                  │
│                          │ Angular          │                  │
├──────────────────────────┼──────────────────┼──────────────────┤
│ [Data Fetching]          │                  │                  │
│ Basic query              │ useQuery         │ useSWR           │
│ Parallel queries         │ useQueries       │ Use hooks        │
│ Dependent queries        │ enabled          │ Conditional      │
│                          │                  │ fetcher          │
│ Suspense support         │ useSuspenseQuery │ suspense: true   │
│ Prefetching              │ prefetchQuery    │ preload          │
│ Initial data             │ initialData      │ fallbackData     │
├──────────────────────────┼──────────────────┼──────────────────┤
│ [Data Updates]           │                  │                  │
│ Mutation                 │ useMutation      │ useSWRMutation   │
│ Optimistic updates       │ Built-in         │ optimisticData   │
│ Cache invalidation       │ invalidateQueries│ mutate           │
│ Direct cache update      │ setQueryData     │ mutate(data)     │
├──────────────────────────┼──────────────────┼──────────────────┤
│ [Pagination]             │                  │                  │
│ Infinite scroll          │ useInfiniteQuery │ useSWRInfinite   │
│ Pagination               │ keepPreviousData │ keepPreviousData │
├──────────────────────────┼──────────────────┼──────────────────┤
│ [Cache Control]          │                  │                  │
│ staleTime                │ Flexible         │ dedupingInterval │
│                          │                  │ as substitute    │
│ gcTime                   │ Configurable     │ Limited          │
│ Structural sharing       │ Yes              │ No               │
│ Offline support          │ 3 modes          │ Limited          │
│ Cache persistence        │ persistQueryClient│ Custom impl.    │
├──────────────────────────┼──────────────────┼──────────────────┤
│ [Other]                  │                  │                  │
│ Retry                    │ Detailed config  │ Basic config     │
│ Polling                  │ refetchInterval  │ refreshInterval  │
│ Window focus             │ Yes              │ Yes              │
│ Network reconnect        │ Yes              │ Yes              │
│ SSR integration          │ HydrationBoundary│ SWRConfig        │
│ Middleware               │ No               │ Yes              │
│ Learning curve           │ Moderate         │ Low              │
└──────────────────────────┴──────────────────┴──────────────────┘
```

### 8.2 SWR Implementation Examples

```typescript
// Basic data fetching with SWR

import useSWR from 'swr';

// Fetcher function
const fetcher = (url: string) =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  });

// Basic usage
function UserList() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    '/api/users',
    fetcher,
    {
      revalidateOnFocus: true,      // re-fetch on window focus
      revalidateOnReconnect: true,  // re-fetch on network reconnect
      refreshInterval: 0,           // polling disabled (0 = off)
      dedupingInterval: 2000,       // deduplicate requests within 2 seconds
      errorRetryCount: 3,           // retry 3 times
    }
  );

  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {isValidating && <RefetchIndicator />}
      <ul>
        {data.map((user: User) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

```typescript
// SWR: Conditional fetching (dependent queries)
function useUserDetail(userId: string | null) {
  return useSWR(
    userId ? `/api/users/${userId}` : null, // null = do not fetch
    fetcher,
  );
}

// SWR: Mutation and optimistic updates
function TodoList() {
  const { data: todos, mutate } = useSWR('/api/todos', fetcher);

  const toggleTodo = async (id: string, completed: boolean) => {
    // Optimistic update
    const optimisticData = todos.map((todo: Todo) =>
      todo.id === id ? { ...todo, completed } : todo
    );

    await mutate(
      async () => {
        await api.todos.update(id, { completed });
        return await fetcher('/api/todos');
      },
      {
        optimisticData,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      }
    );
  };

  return (
    <ul>
      {todos?.map((todo: Todo) => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={(e) => toggleTodo(todo.id, e.target.checked)}
          />
          {todo.title}
        </li>
      ))}
    </ul>
  );
}
```

```typescript
// SWR: Infinite scroll
import useSWRInfinite from 'swr/infinite';

function useInfiniteUsers() {
  const getKey = (pageIndex: number, previousPageData: any) => {
    if (previousPageData && !previousPageData.data.length) return null; // last page
    return `/api/users?page=${pageIndex + 1}&limit=20`;
  };

  const { data, error, size, setSize, isLoading, isValidating } =
    useSWRInfinite(getKey, fetcher);

  const users = data ? data.flatMap(page => page.data) : [];
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.data?.length === 0;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.data?.length < 20);

  return {
    users,
    isLoading,
    isLoadingMore,
    isReachingEnd,
    loadMore: () => setSize(size + 1),
    isValidating,
    error,
  };
}
```

### 8.3 Library Selection Guidelines

```
Criteria for choosing a library:

  When you should choose TanStack Query:
  ┌─────────────────────────────────────────────────────────┐
  │ - Large-scale CRUD applications                          │
  │ - Complex cache management needed (frequent hierarchical  │
  │   invalidation)                                          │
  │ - Heavy use of optimistic updates                        │
  │ - DevTools debugging is important                        │
  │ - Offline support required                               │
  │ - Want to use it with frameworks other than React        │
  │ - Team has server state management experience            │
  └─────────────────────────────────────────────────────────┘

  When you should choose SWR:
  ┌─────────────────────────────────────────────────────────┐
  │ - Primarily simple data fetching                         │
  │ - Want to minimize bundle size                           │
  │ - Next.js projects (made by Vercel, good compatibility)  │
  │ - Want to minimize learning curve                        │
  │ - Want to use the middleware pattern                     │
  │ - Want to get started quickly (simple API)               │
  └─────────────────────────────────────────────────────────┘

  Conclusion:
  → When in doubt, choose TanStack Query (feature-rich, less likely to hit limitations)
  → SWR is sufficient for small projects or prototypes
  → Either choice gives you the benefits of stale-while-revalidate
```

---

## 9. Anti-Patterns and Pitfalls

### 9.1 Common Anti-Patterns

```typescript
// Anti-pattern 1: Manipulating queryClient inside useEffect
// Bad
function UserDetail({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => api.users.get(userId),
  });

  // Manipulating cache inside useEffect risks an infinite loop
  useEffect(() => {
    if (data) {
      queryClient.setQueryData(['currentUser'], data);
    }
  }, [data, queryClient]);
}

// Good: use select
function UserDetail({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => api.users.get(userId),
  });
  // If needed, reference the same data via a separate query
}
```

```typescript
// Anti-pattern 2: Referencing state inside queryFn
// Bad
function SearchResults() {
  const [filter, setFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['search'],        // filter is not included in queryKey
    queryFn: () => api.search(filter), // query does not re-run when filter changes
  });
}

// Good: include parameters in queryKey
function SearchResults() {
  const [filter, setFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['search', filter],      // include filter in queryKey
    queryFn: () => api.search(filter), // query re-runs when filter changes
    enabled: filter.length >= 2,
  });
}
```

```typescript
// Anti-pattern 3: Creating QueryClient inside a component
// Bad
function App() {
  // A new QueryClient is created on every render
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MyApp />
    </QueryClientProvider>
  );
}

// Good: create once with useState
function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MyApp />
    </QueryClientProvider>
  );
}
```

```typescript
// Anti-pattern 4: Misusing mutate vs mutateAsync
// Bad: trying to use the return value of mutate
function CreateButton() {
  const createUser = useCreateUser();

  const handleClick = () => {
    // mutate returns void → then and catch do not work
    const result = createUser.mutate(userData);
    console.log(result); // undefined
  };
}

// Good: use mutateAsync when you need the return value
function CreateButton() {
  const createUser = useCreateUser();

  const handleClick = async () => {
    try {
      const newUser = await createUser.mutateAsync(userData);
      router.push(`/users/${newUser.id}`);
    } catch (error) {
      // error handling
    }
  };
}

// Good: mutate is fine when using callbacks
function CreateButton() {
  const createUser = useCreateUser();

  const handleClick = () => {
    createUser.mutate(userData, {
      onSuccess: (newUser) => {
        router.push(`/users/${newUser.id}`);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };
}
```

```typescript
// Anti-pattern 5: Misconfiguring staleTime and gcTime
// Bad: gcTime < staleTime is nonsensical
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 10 * 60 * 1000,    // fresh for 10 minutes
  gcTime: 1 * 60 * 1000,        // GC after 1 minute → may be discarded while still fresh
});

// Good: set gcTime >= staleTime
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 10 * 60 * 1000,    // fresh for 10 minutes
  gcTime: 15 * 60 * 1000,       // GC after 15 minutes (longer than staleTime)
});
```

```typescript
// Anti-pattern 6: Forgetting invalidate in onSettled for optimistic updates
// Bad
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previous = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['todos'], context?.previous);
  },
  // no onSettled → cache is never synced with the latest server data
});

// Good: always re-validate in onSettled
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previous = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['todos'], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] }); // always re-validate
  },
});
```

### 9.2 Performance Pitfalls

```typescript
// Pitfall 1: Creating new object references in select every time
// Bad: inline select creates a new function reference every time
function ActiveUserCount() {
  const { data: count } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    // new function reference every time → structural sharing may not work
    select: (data) => data.filter(u => u.active).length,
  });
  return <span>{count}</span>;
}

// Good: use a stable reference with useCallback
function ActiveUserCount() {
  const selectCount = useCallback(
    (data: User[]) => data.filter(u => u.active).length,
    []
  );

  const { data: count } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    select: selectCount,
  });
  return <span>{count}</span>;
}
```

```typescript
// Pitfall 2: Memory leak in infinite scroll
// Bad: page count grows without limit
function InfiniteList() {
  const { data } = useInfiniteQuery({
    queryKey: ['items'],
    queryFn: fetchItems,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // no maxPages → memory grows with prolonged use
  });
}

// Good: set maxPages to limit memory usage
function InfiniteList() {
  const { data } = useInfiniteQuery({
    queryKey: ['items'],
    queryFn: fetchItems,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    maxPages: 10, // cache up to 10 pages at most
  });
}
```

---

## 10. Testing Strategies

### 10.1 Testing Custom Hooks

```typescript
// src/hooks/__tests__/useUsers.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// MSW server setup
const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
    ]);
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,     // no retry in tests
        gcTime: Infinity, // prevent cache from being discarded during tests
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Tests
describe('useUsers', () => {
  it('should fetch the user list', async () => {
    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    // Initial state is loading
    expect(result.current.isLoading).toBe(true);

    // Wait until data is fetched
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify data
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe('Alice');
  });

  it('should enter an error state on error', async () => {
    // Override to return an error for this test only
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

    expect(result.current.error).toBeDefined();
  });
});
```

### 10.2 Testing Mutations

```typescript
describe('useCreateUser', () => {
  it('should create a user and update the cache', async () => {
    const newUser = { name: 'Charlie', email: 'charlie@example.com' };

    server.use(
      http.post('/api/users', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ id: '3', ...body as object });
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Pre-populate the user list cache
    queryClient.setQueryData(['users', 'list'], [
      { id: '1', name: 'Alice' },
    ]);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateUser(), { wrapper });

    // Execute mutation
    result.current.mutate(newUser);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Mutation result
    expect(result.current.data).toEqual({ id: '3', ...newUser });

    // Verify the cache was invalidated
    const queryState = queryClient.getQueryState(['users', 'list']);
    expect(queryState?.isInvalidated).toBe(true);
  });
});
```

### 10.3 Testing Optimistic Updates

```typescript
describe('useUpdateTodo (optimistic update)', () => {
  it('should update UI immediately and rollback on error', async () => {
    // Configure API to return an error
    server.use(
      http.patch('/api/todos/:id', () => {
        return HttpResponse.json(
          { message: 'Server Error' },
          { status: 500 },
        );
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const initialTodos = [
      { id: '1', title: 'Buy milk', completed: false },
      { id: '2', title: 'Walk dog', completed: false },
    ];
    queryClient.setQueryData(['todos'], initialTodos);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateTodo(), { wrapper });

    // Execute optimistic update
    result.current.mutate({ id: '1', data: { completed: true } });

    // Verify the cache was updated immediately (optimistic update)
    await waitFor(() => {
      const todos = queryClient.getQueryData<Todo[]>(['todos']);
      expect(todos?.[0].completed).toBe(true);
    });

    // Verify that the update is rolled back after the error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify the cache was restored
    const todos = queryClient.getQueryData<Todo[]>(['todos']);
    expect(todos?.[0].completed).toBe(false);
  });
});
```

---

## 11. Advanced Patterns

### 11.1 Parallel Queries with useQueries

```typescript
// Execute multiple queries in parallel

import { useQueries } from '@tanstack/react-query';

function DashboardStats({ userIds }: { userIds: string[] }) {
  // Execute a dynamic number of queries in parallel
  const userQueries = useQueries({
    queries: userIds.map(id => ({
      queryKey: userKeys.detail(id),
      queryFn: () => api.users.get(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = userQueries.some(q => q.isLoading);
  const isError = userQueries.some(q => q.isError);
  const users = userQueries
    .filter(q => q.isSuccess)
    .map(q => q.data!);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage />;

  return (
    <div className="grid grid-cols-3 gap-4">
      {users.map(user => (
        <UserStatCard key={user.id} user={user} />
      ))}
    </div>
  );
}
```

### 11.2 Cache Persistence

```typescript
// Persist TanStack Query cache
// Allows cache to be restored on app restart

import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (set longer for persistence)
    },
  },
});

// Persist using localStorage
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  throttleTime: 1000, // save at most once per second (performance measure)
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

// Persistence configuration
persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // expires after 24 hours
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // Persist only specific queries
      const queryKey = query.queryKey as string[];
      return ['categories', 'config', 'user-preferences'].some(key =>
        queryKey.includes(key)
      );
    },
  },
});
```

### 11.3 Offline Support

```typescript
// Offline-first application

import { onlineManager } from '@tanstack/react-query';

// Custom online detection (alternative to navigator.onLine)
onlineManager.setEventListener((setOnline) => {
  const onlineHandler = () => setOnline(true);
  const offlineHandler = () => setOnline(false);

  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);

  return () => {
    window.removeEventListener('online', onlineHandler);
    window.removeEventListener('offline', offlineHandler);
  };
});

// Mutation queue when offline
// Use networkMode: 'offlineFirst'
const mutation = useMutation({
  mutationFn: api.todos.create,
  networkMode: 'offlineFirst', // queue offline mutations for later execution
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});

// Offline indicator UI
function OfflineIndicator() {
  const isOnline = onlineManager.isOnline();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
      You are offline. Changes will be synced when you reconnect.
    </div>
  );
}
```

### 11.4 Custom Hook Design Principles

```typescript
// Custom hook design principles

// Principle 1: Make query options injectable from outside
function useUsers(options?: Partial<UseQueryOptions<User[]>>) {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: () => api.users.list(),
    staleTime: 30 * 1000,
    ...options, // allow caller to override
  });
}

// Usage example
const { data } = useUsers({
  staleTime: Infinity,      // no re-fetch needed on this screen
  enabled: isAuthenticated, // only when authenticated
});

// Principle 2: Combine related Query + Mutation
function useTodos() {
  const queryClient = useQueryClient();

  const todosQuery = useQuery({
    queryKey: ['todos'],
    queryFn: () => api.todos.list(),
  });

  const addMutation = useMutation({
    mutationFn: api.todos.create,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Todo> }) =>
      api.todos.update(id, data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.todos.delete,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  return {
    todos: todosQuery.data ?? [],
    isLoading: todosQuery.isLoading,
    error: todosQuery.error,
    addTodo: addMutation.mutate,
    updateTodo: updateMutation.mutate,
    deleteTodo: deleteMutation.mutate,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Principle 3: Share configuration with queryOptions helper functions
import { queryOptions } from '@tanstack/react-query';

export function userListQueryOptions(filters?: UserFilters) {
  return queryOptions({
    queryKey: userKeys.list(filters ?? {}),
    queryFn: () => api.users.list(filters),
    staleTime: 30 * 1000,
  });
}

// Use in components
function UserList() {
  const { data } = useQuery(userListQueryOptions({ role: 'admin' }));
}

// Use in loaders
export async function loader({ params }: LoaderFunctionArgs) {
  return queryClient.ensureQueryData(userListQueryOptions());
}

// Use in prefetching
queryClient.prefetchQuery(userListQueryOptions());
```

---

## FAQ

### Q1: How should I configure TanStack Query's cache strategy?
Adjust `staleTime` and `gcTime` based on the nature of the data. For real-time data (stock prices, chat), use `staleTime: 0` to always re-fetch; for frequently changing data (notifications, dashboards), use 30 seconds to 1 minute; for moderately changing data (user lists), use 5–10 minutes; for rarely changing data (settings, master data), use 30 minutes to 1 hour; and for immutable data, use `Infinity`. The default `gcTime` is 5 minutes; always set it longer than `staleTime`.

### Q2: When should optimistic updates be implemented?
Implement them for high-frequency operations (likes, favorites, checkboxes), situations where instant feedback is important (comment posting, adding todos), and cases where failure rates are low and rollback is easy. Avoid them for payment/billing processing, situations requiring complex server-side validation, and cases with significant side effects like email sending. When implementing, always set up `onMutate` for optimistic update, `onError` for rollback, and `onSettled` for re-fetch as a complete trio.

### Q3: What is the difference between staleTime and gcTime?
`staleTime` is the duration data is considered "fresh"—while fresh, data is returned from cache without re-fetching. The default is 0 (becomes stale immediately). `gcTime` is the time until cache is discarded from memory; it starts counting from when the last component unmounts. The default is 5 minutes. A key rule is `staleTime < gcTime`: longer staleTime reduces re-fetch frequency and improves performance, while longer gcTime speeds up page navigation.

---

## Summary

### Pattern Quick Reference

| Pattern | Use Case | API |
|---------|----------|-----|
| staleTime | Set data freshness deadline | `useQuery({ staleTime })` |
| gcTime | Retention period for inactive cache | `useQuery({ gcTime })` |
| invalidateQueries | Invalidate cache after mutation | `queryClient.invalidateQueries()` |
| setQueryData | Directly update cache | `queryClient.setQueryData()` |
| useInfiniteQuery | Infinite scroll | `useInfiniteQuery({ getNextPageParam })` |
| prefetchQuery | Prefetch on hover/route transition | `queryClient.prefetchQuery()` |
| placeholderData | Show previous data on page transition | `useQuery({ placeholderData })` |
| enabled | Conditional query execution | `useQuery({ enabled })` |
| select | Transform/filter cached data | `useQuery({ select })` |
| useSuspenseQuery | Suspense-compatible query | `useSuspenseQuery()` |
| refetchInterval | Polling (periodic re-fetch) | `useQuery({ refetchInterval })` |
| networkMode | Offline support | `useQuery({ networkMode })` |

### Cache Strategy Cheat Sheet

```
Cache strategy by data type:

┌──────────────────┬──────────┬──────────┬──────────────────────┐
│ Data type        │ staleTime│ gcTime   │ Other                │
├──────────────────┼──────────┼──────────┼──────────────────────┤
│ Real-time        │ 0        │ 5 min    │ refetchInterval      │
│ (notifications,  │          │          │ WebSocket integration │
│  chat)           │          │          │                      │
├──────────────────┼──────────┼──────────┼──────────────────────┤
│ User data        │ 30s–2min │ 10 min   │ invalidateQueries    │
│ (lists, detail)  │          │          │ Optimistic updates   │
├──────────────────┼──────────┼──────────┼──────────────────────┤
│ Master data      │ 1–24 hrs │ Infinity │ Fetch only once      │
│ (categories,     │          │          │ staleTime: Infinity  │
│  settings)       │          │          │                      │
├──────────────────┼──────────┼──────────┼──────────────────────┤
│ Search results   │ 5 min    │ 10 min   │ keepPreviousData     │
│                  │          │          │ Debounce             │
├──────────────────┼──────────┼──────────┼──────────────────────┤
│ Pagination       │ 30 sec   │ 5 min    │ keepPreviousData     │
│                  │          │          │ Prefetch next page   │
└──────────────────┴──────────┴──────────┴──────────────────────┘
```

### Implementation Checklist

```
Server State Management Implementation Checklist:

  Setup:
  □ Defined QueryClient default settings
  □ Placed QueryClientProvider
  □ Enabled DevTools in development environment
  □ Configured global error handling (QueryCache, MutationCache)

  Query Key:
  □ Introduced Query Key Factory pattern
  □ All parameters used in queryFn are included in queryKey
  □ Designed with hierarchical structure to allow partial invalidation

  Cache Strategy:
  □ Set staleTime per data type
  □ Verified gcTime is >= staleTime
  □ Configured appropriate re-fetch triggers (windowFocus, reconnect)

  Mutation:
  □ Calling invalidateQueries for related cache in onSettled
  □ Implemented onMutate + onError + onSettled for optimistic updates
  □ Using mutate and mutateAsync appropriately

  Error Handling:
  □ Configured global handling for auth errors (401)
  □ Configured retry strategy (no retry for client errors)
  □ Implemented Error Boundary for UI-level error display

  Performance:
  □ Set up prefetching for important pages
  □ Set maxPages for infinite scroll
  □ Verified referential stability of select
  □ Considered virtualization for large data displays

  Testing:
  □ Set up API mocking with MSW
  □ Wrote tests for custom hooks
  □ Tested optimistic update rollback
```

---

## Further Reading

---

## References
1. TkDodo. "Practical React Query." tkdodo.eu, 2024.
2. TanStack. "TanStack Query Documentation v5." tanstack.com, 2024.
3. SWR. "React Hooks for Data Fetching." swr.vercel.app, 2024.
