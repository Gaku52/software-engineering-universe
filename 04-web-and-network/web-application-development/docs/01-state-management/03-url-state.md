# URL State (URL State Management)

> URL state is the "shareable state" of web apps. By reflecting search queries, filters, page numbers, and sort orders in the URL, you naturally achieve UX where bookmarking, sharing, and browser back/forward work as expected. The URL is not merely a resource identifier — it is a powerful mechanism for persisting application state.

## Prerequisites

To learn this chapter effectively, it is recommended to have prior knowledge of the following:

  - Basic usage of TanStack Query
  - The concept of caching and the stale-while-revalidate pattern
  - How data is identified by queryKey
- **Concept of client-side routing**
  - Basics of React Router or Next.js App Router
  - Understanding the browser History API (pushState, replaceState)
  - Difference between declarative and imperative navigation
- **URL query parameters**
  - Basic usage of the URLSearchParams API
  - Encoding/decoding of query strings
  - Understanding URL structure (pathname, search, hash)

## What You Will Learn

- [ ] Understand the importance of URL state and its design principles
- [ ] Master basic operations of the URLSearchParams API
- [ ] Learn how to use useSearchParams (React Router / Next.js)
- [ ] Learn how to use nuqs (type-safe URL state management)
- [ ] Understand integration patterns with Server Components
- [ ] Understand URL state debouncing, validation, and security
- [ ] Learn synchronization patterns between URL and application state
- [ ] Be able to design practical URL state management architectures

---

## 1. Importance and Fundamentals of URL State

### 1.1 Why URL State Matters

In web applications, the URL is not just a page address. The URL is the most fundamental and powerful mechanism for representing application state. Even in the principles of REST (Representational State Transfer), the URL is positioned as an identifier representing the state of a resource.

In applications where URL state management is properly implemented, the following user experiences are naturally achieved:

```
Excellent UX delivered by URL state:

1. Bookmarkability
   - Users can bookmark specific search results or filter states
   - The same state is restored when accessed later
   - Example: /products?q=laptop&sort=price-asc&page=2

2. Shareability
   - Copying a URL and sending it to another user shows the same screen
   - When sharing a link via Slack or Teams, the complete state is conveyed
   - Example: "Look at this search result" → just send the URL

3. Browser Navigation
   - The browser's back/forward buttons work as expected
   - Each state change is recorded in the browser history
   - The user's operation flow feels natural

4. SEO Friendly
   - Search engine crawlers can parse URLs with parameters
   - Category pages and filter pages can be indexed
   - Proper canonical URL configuration is possible

5. SSR Compatible
   - Server Components can receive searchParams
   - The server can fetch appropriate data during initial render
   - Both SEO and performance can be achieved simultaneously

6. Debuggability
   - You can tell the current state by looking at the URL
   - When reporting a bug, you can say "it reproduces at this URL"
   - State reproduction is easy in QA testing
```

### 1.2 What Should and Should Not Be Reflected in URL State

The first step in URL state design is clearly distinguishing which state should be reflected in the URL and which should not.

```
Cases where state should be reflected in the URL:
  ✓ Search queries: /products?q=laptop
  ✓ Filters: /products?category=electronics&brand=apple
  ✓ Sort: /products?sort=price&order=asc
  ✓ Pagination: /products?page=3&per_page=20
  ✓ Tab/View: /dashboard?view=chart
  ✓ Modal state: /products?modal=create
  ✓ Date ranges: /analytics?from=2024-01-01&to=2024-03-31
  ✓ Display density: /products?density=compact
  ✓ Language/locale: /products?lang=ja (pathname preferred: /ja/products)
  ✓ Comparison items: /compare?ids=1,2,3
  ✓ Accordion/section expansion: /faq?section=billing
  ✓ Map display range: /map?lat=35.68&lng=139.76&zoom=12

Cases where state should NOT be reflected in the URL:
  ✗ Temporary UI states (tooltips, hover, animations)
  ✗ Form intermediate values (drafts before submission)
  ✗ Authentication tokens or session information
  ✗ Large amounts of data (URLs have a practical limit of ~2048 characters)
  ✗ Sensitive information (passwords, personal data)
  ✗ Position information during drag
  ✗ Loading or error states
  ✗ Unread notification counts
  ✗ User-specific settings (dark mode, etc. → localStorage is appropriate)
```

### 1.3 Flowchart for Deciding URL State

A flowchart for deciding whether to include state in the URL is shown below.

```
Should this state be shareable with other users?
├── Yes → Should users be able to bookmark and return to the same state later?
│   ├── Yes → Include in URL state ✓
│   └── No  → Should users be able to return with browser back?
│       ├── Yes → Include in URL state ✓
│       └── No  → Manage with React state / Context
└── No  → Is this state safe from a security perspective?
    ├── Yes → Does it need to be persisted?
    │   ├── Yes → Manage with localStorage / Cookie
    │   └── No  → Manage with React state / Context
    └── No  → Manage with Cookie (HttpOnly) / server session
```

### 1.4 URL Structure and the Role of Each Part

Understanding the structure of a URL is a prerequisite for correctly managing URL state.

```
Complete URL structure:
https://example.com:443/products/electronics?q=laptop&page=2#reviews
└─┬─┘   └───┬──────┘└┬┘└───────┬──────────┘└──────┬───────┘└──┬───┘
scheme     host    port    pathname           search       hash
                                           (query string) (fragment)

Role of each part in state management:

pathname:
  - Represents the type/hierarchy of the resource
  - Example: /products, /products/123, /users/profile
  - Used by routing (React Router, Next.js App Router)
  - Important in RESTful design

search / query string:
  - Represents how the resource is displayed / filter conditions
  - Example: ?q=laptop&sort=price&page=2
  - Main target of URL state management
  - Expressed as key=value pairs

hash / fragment:
  - Represents a position within the page
  - Example: #reviews, #section-3
  - Not sent to the server (client-only)
  - Used for routing in the SPA era (Hash Router)
```

### 1.5 Basics of the URLSearchParams API

The most fundamental Web standard API for manipulating URL state is `URLSearchParams`. It is available in both browsers and Node.js.

```typescript
// === Basic URLSearchParams operations ===

// 1. Construction
const params1 = new URLSearchParams('q=laptop&page=2');
const params2 = new URLSearchParams({ q: 'laptop', page: '2' });
const params3 = new URLSearchParams([['q', 'laptop'], ['page', '2']]);
const params4 = new URLSearchParams(window.location.search);

// 2. Getting values
params1.get('q');        // 'laptop'
params1.get('page');     // '2' (always string)
params1.get('missing');  // null

// 3. Setting values
params1.set('sort', 'price');     // Add (overwrites existing key)
params1.append('tag', 'sale');    // Add (multiple values for same key allowed)
params1.append('tag', 'new');

// 4. Deleting values
params1.delete('page');           // Delete key and value

// 5. Checking existence
params1.has('q');                 // true
params1.has('page');              // false (deleted)

// 6. Iteration
for (const [key, value] of params1) {
  console.log(`${key}: ${value}`);
}
// q: laptop
// sort: price
// tag: sale
// tag: new

// 7. Getting array values
params1.getAll('tag');            // ['sale', 'new']

// 8. Stringification
params1.toString();               // 'q=laptop&sort=price&tag=sale&tag=new'

// 9. Sort (by key)
params1.sort();
params1.toString();               // 'q=laptop&sort=price&tag=new&tag=sale'

// 10. Size
params1.size;                     // 4 (number of entries)
```

```typescript
// === Practical helper functions for URLSearchParams ===

/**
 * Helper to update query parameters of the current URL
 */
function updateSearchParams(
  updates: Record<string, string | string[] | null | undefined>
): string {
  const params = new URLSearchParams(window.location.search);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) {
      params.delete(key);
    } else if (Array.isArray(value)) {
      params.delete(key);
      value.forEach(v => params.append(key, v));
    } else {
      params.set(key, value);
    }
  }

  // Remove default value keys to keep the URL clean
  return params.toString();
}

// Usage example
const newSearch = updateSearchParams({
  q: 'laptop',
  page: null,          // delete
  tags: ['sale', 'new'] // array
});
// → 'q=laptop&tags=sale&tags=new'

/**
 * Convert URLSearchParams to an object
 */
function searchParamsToObject(
  params: URLSearchParams
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }

  return result;
}

// Usage example
const params = new URLSearchParams('q=laptop&tag=sale&tag=new&page=2');
const obj = searchParamsToObject(params);
// { q: 'laptop', tag: ['sale', 'new'], page: '2' }

/**
 * Apply a diff of an object to URLSearchParams
 */
function mergeSearchParams(
  base: URLSearchParams,
  updates: Record<string, string | null>
): URLSearchParams {
  const merged = new URLSearchParams(base.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      merged.delete(key);
    } else {
      merged.set(key, value);
    }
  }

  return merged;
}
```

```typescript
// === Encoding considerations ===

// URLSearchParams automatically handles encode/decode
const params = new URLSearchParams();
params.set('q', 'Japanese search');
params.toString();  // 'q=Japanese+search'

params.get('q');    // 'Japanese search' (auto-decoded)

// Note: + is treated as a space
const params2 = new URLSearchParams('q=hello+world');
params2.get('q');   // 'hello world'

// Note: difference from encodeURIComponent
encodeURIComponent('hello world');  // 'hello%20world' (%20)
new URLSearchParams({ q: 'hello world' }).toString();  // 'q=hello+world' (+)

// Encoding special characters
const specialParams = new URLSearchParams();
specialParams.set('filter', 'price>100&stock>0');
specialParams.toString();  // 'filter=price%3E100%26stock%3E0'
// & and > are correctly encoded
```

---

## 2. useSearchParams (React Router / Next.js)

### 2.1 useSearchParams in React Router v6

React Router v6 provides the `useSearchParams` hook, which acts as a React wrapper around URLSearchParams.

```typescript
// === React Router v6 useSearchParams ===
import { useSearchParams } from 'react-router-dom';

function ProductListPage() {
  // React wrapper for URLSearchParams
  const [searchParams, setSearchParams] = useSearchParams();

  // Getting values (always string | null)
  const query = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1');
  const sort = searchParams.get('sort') ?? 'newest';
  const categories = searchParams.getAll('category');

  // Method 1: Functional update (recommended)
  function handleSortChange(newSort: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('sort', newSort);
      next.delete('page'); // Reset page when sort changes
      return next;
    });
  }

  // Method 2: Object specification (replaces all params)
  function handleReset() {
    setSearchParams({}); // Clear all params
  }

  // Method 3: Pass URLSearchParams directly
  function handleSearch(q: string) {
    const params = new URLSearchParams(searchParams);
    if (q) {
      params.set('q', q);
    } else {
      params.delete('q');
    }
    params.delete('page'); // Reset page when search changes
    setSearchParams(params);
  }

  // Method 4: replace option (do not add to browser history)
  function handlePageChange(newPage: number) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage));
      return next;
    }, { replace: true }); // Don't add to history stack
  }

  return (
    <div>
      <SearchInput value={query} onSearch={handleSearch} />
      <SortSelect value={sort} onChange={handleSortChange} />
      <CategoryFilter selected={categories} onChange={handleCategoryChange} />
      <ProductGrid query={query} page={page} sort={sort} />
      <Pagination
        currentPage={page}
        onPageChange={handlePageChange}
      />
      <button onClick={handleReset}>Clear Filters</button>
    </div>
  );
}
```

```typescript
// === React Router: Default value patterns for useSearchParams ===

// Pattern 1: Inline default values
function useProductFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  return {
    query: searchParams.get('q') ?? '',
    page: Number(searchParams.get('page')) || 1,
    sort: searchParams.get('sort') ?? 'newest',
    category: searchParams.get('category') ?? 'all',
    perPage: Number(searchParams.get('per_page')) || 20,
  };
}

// Pattern 2: Pass default values to useSearchParams
function ProductPage() {
  const [searchParams, setSearchParams] = useSearchParams({
    sort: 'newest',
    page: '1',
    per_page: '20',
  });

  // Start with default values set
  const sort = searchParams.get('sort')!; // non-null
  const page = Number(searchParams.get('page')!);
}

// Pattern 3: Wrap in a custom hook
interface ProductFilterState {
  query: string;
  page: number;
  sort: 'newest' | 'price-asc' | 'price-desc' | 'popular';
  category: string | null;
  tags: string[];
  priceMin: number | null;
  priceMax: number | null;
}

const DEFAULT_FILTERS: ProductFilterState = {
  query: '',
  page: 1,
  sort: 'newest',
  category: null,
  tags: [],
  priceMin: null,
  priceMax: null,
};

function useProductFiltersAdvanced() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: ProductFilterState = {
    query: searchParams.get('q') ?? DEFAULT_FILTERS.query,
    page: Number(searchParams.get('page')) || DEFAULT_FILTERS.page,
    sort: (searchParams.get('sort') as ProductFilterState['sort'])
      ?? DEFAULT_FILTERS.sort,
    category: searchParams.get('category') ?? DEFAULT_FILTERS.category,
    tags: searchParams.getAll('tag'),
    priceMin: searchParams.has('price_min')
      ? Number(searchParams.get('price_min'))
      : null,
    priceMax: searchParams.has('price_max')
      ? Number(searchParams.get('price_max'))
      : null,
  };

  function setFilters(updates: Partial<ProductFilterState>) {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);

      // query
      if ('query' in updates) {
        if (updates.query) {
          params.set('q', updates.query);
        } else {
          params.delete('q');
        }
      }

      // page
      if ('page' in updates) {
        if (updates.page && updates.page > 1) {
          params.set('page', String(updates.page));
        } else {
          params.delete('page');
        }
      }

      // sort
      if ('sort' in updates) {
        if (updates.sort && updates.sort !== DEFAULT_FILTERS.sort) {
          params.set('sort', updates.sort);
        } else {
          params.delete('sort');
        }
      }

      // category
      if ('category' in updates) {
        if (updates.category) {
          params.set('category', updates.category);
        } else {
          params.delete('category');
        }
      }

      // tags (array)
      if ('tags' in updates) {
        params.delete('tag');
        updates.tags?.forEach(tag => params.append('tag', tag));
      }

      // price range
      if ('priceMin' in updates) {
        if (updates.priceMin !== null && updates.priceMin !== undefined) {
          params.set('price_min', String(updates.priceMin));
        } else {
          params.delete('price_min');
        }
      }

      if ('priceMax' in updates) {
        if (updates.priceMax !== null && updates.priceMax !== undefined) {
          params.set('price_max', String(updates.priceMax));
        } else {
          params.delete('price_max');
        }
      }

      // Reset page when filter changes
      if (!('page' in updates)) {
        params.delete('page');
      }

      return params;
    });
  }

  function resetFilters() {
    setSearchParams({});
  }

  const isFiltered = searchParams.toString() !== '';

  return { filters, setFilters, resetFilters, isFiltered };
}
```

### 2.2 useSearchParams in Next.js App Router

In Next.js App Router, `useSearchParams` is a read-only hook, and `useRouter` is used together to update the URL.

```typescript
// === Next.js App Router useSearchParams ===
'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';

function ProductFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Getting values
  const category = searchParams.get('category') ?? 'all';
  const sort = searchParams.get('sort') ?? 'newest';
  const page = Number(searchParams.get('page') ?? '1');
  const query = searchParams.get('q') ?? '';

  // URL update helper (memoized with useCallback)
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      // Reset page on filter change
      if (!('page' in updates)) {
        params.delete('page');
      }

      // useTransition prevents UI blocking
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, {
          scroll: false, // Maintain scroll position
        });
      });
    },
    [searchParams, router, pathname, startTransition]
  );

  return (
    <div className={isPending ? 'opacity-50' : ''}>
      {/* Search input */}
      <SearchInput
        defaultValue={query}
        onSearch={(q) => updateParams({ q: q || null })}
      />

      {/* Category select */}
      <select
        value={category}
        onChange={(e) => updateParams({
          category: e.target.value === 'all' ? null : e.target.value,
        })}
      >
        <option value="all">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="books">Books</option>
        <option value="clothing">Clothing</option>
      </select>

      {/* Sort select */}
      <select
        value={sort}
        onChange={(e) => updateParams({ sort: e.target.value })}
      >
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="popular">Most Popular</option>
      </select>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        onPageChange={(p) => updateParams({ page: String(p) })}
      />

      {/* Pending indicator */}
      {isPending && <LoadingSpinner />}
    </div>
  );
}
```

```typescript
// === Next.js: createQueryString utility ===
'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

/**
 * URL parameter management hook for Next.js App Router
 */
function useURLParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Generate a new query string (immutable)
   */
  const createQueryString = useCallback(
    (params: Record<string, string | string[] | null>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(params)) {
        if (value === null) {
          newParams.delete(key);
        } else if (Array.isArray(value)) {
          newParams.delete(key);
          value.forEach(v => newParams.append(key, v));
        } else {
          newParams.set(key, value);
        }
      }

      return newParams.toString();
    },
    [searchParams]
  );

  /**
   * Update URL (push)
   */
  const pushParams = useCallback(
    (params: Record<string, string | string[] | null>, options?: {
      scroll?: boolean;
      resetPage?: boolean;
    }) => {
      const updates = { ...params };
      if (options?.resetPage && !('page' in updates)) {
        updates.page = null;
      }

      const queryString = createQueryString(updates);
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(url, { scroll: options?.scroll ?? false });
    },
    [createQueryString, pathname, router]
  );

  /**
   * Update URL (replace - does not add to history)
   */
  const replaceParams = useCallback(
    (params: Record<string, string | string[] | null>) => {
      const queryString = createQueryString(params);
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(url, { scroll: false });
    },
    [createQueryString, pathname, router]
  );

  /**
   * Clear all params
   */
  const clearParams = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  return {
    searchParams,
    createQueryString,
    pushParams,
    replaceParams,
    clearParams,
  };
}

// Usage example
function FilterComponent() {
  const { searchParams, pushParams, clearParams } = useURLParams();

  return (
    <div>
      <button onClick={() => pushParams(
        { category: 'electronics', sort: 'price-asc' },
        { resetPage: true }
      )}>
        Electronics (Cheapest)
      </button>
      <button onClick={() => clearParams()}>
        Clear All Filters
      </button>
    </div>
  );
}
```

### 2.3 Comparison: React Router v6 vs Next.js

```
┌─────────────────────────┬────────────────────────┬───────────────────────────┐
│ Feature                 │ React Router v6        │ Next.js App Router        │
├─────────────────────────┼────────────────────────┼───────────────────────────┤
│ Hook name               │ useSearchParams        │ useSearchParams           │
│ Return value            │ [params, setParams]    │ ReadonlyURLSearchParams   │
│ Write method            │ setSearchParams()      │ router.push / replace     │
│ replace option          │ { replace: true }      │ router.replace()          │
│ Scroll control          │ none (manual)          │ { scroll: false }         │
│ Suspense required       │ No                     │ Yes (Suspense boundary)   │
│ Server Component support│ No                     │ searchParams prop         │
│ Transition support      │ Manual                 │ useTransition integration │
│ Array parameters        │ getAll()               │ getAll()                  │
│ Type safety             │ Low (manual parsing)   │ Low (manual parsing)      │
└─────────────────────────┴────────────────────────┴───────────────────────────┘
```

### 2.4 Suspense Boundary and useSearchParams in Next.js

When using `useSearchParams` in Next.js App Router, a Suspense boundary is required. This is because the value is client-only and cannot be determined at static render time.

```typescript
// === Why a Suspense boundary is required and how to handle it ===

// Bad: Using useSearchParams without Suspense causes a build error
function Page() {
  return <ProductFilters />; // Error: useSearchParams requires Suspense
}

// Good: Wrap with Suspense
import { Suspense } from 'react';

function Page() {
  return (
    <Suspense fallback={<FiltersSkeleton />}>
      <ProductFilters />
    </Suspense>
  );
}

// Good: Pattern of separating components
// app/products/page.tsx (Server Component)
export default function ProductsPage() {
  return (
    <div>
      <h1>Products</h1>
      <Suspense fallback={<div>Loading filters...</div>}>
        <ProductFilters />  {/* Client Component with useSearchParams */}
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid />     {/* Server Component or Client Component */}
      </Suspense>
    </div>
  );
}

// ProductFilters.tsx (Client Component)
'use client';
import { useSearchParams } from 'next/navigation';

function ProductFilters() {
  const searchParams = useSearchParams();
  // ... filter UI
}
```

---

## 3. nuqs (Type-Safe URL State Management)

### 3.1 Overview and Benefits of nuqs

nuqs (formerly next-usequerystate) is a type-safe search params management library designed for Next.js. Since 2024, it has also become available for React Router and Remix, evolving into a framework-agnostic URL state management library.

```
Key benefits of nuqs:

1. Type safety
   - Parsers automatically convert string → appropriate type
   - TypeScript type inference works completely
   - Errors are detected at compile time

2. Default values
   - Set type-safe default values with withDefault()
   - Default values are not included in the URL (keeps URL clean)

3. Serialization/deserialization
   - Automatically handles numbers, booleans, dates, enums, JSON
   - Custom parsers can also be defined

4. Batch updates
   - Update multiple parameters at once
   - Prevents unnecessary re-renders

5. Shallow routing support
   - No page reload by default
   - Can be integrated with Next.js data re-fetching

6. Server Component integration
   - Available from Server Components via createSearchParamsCache
   - SSR performance optimization
```

### 3.2 Installation and Setup

```bash
# Install
npm install nuqs

# For Next.js App Router: set up the provider in layout.tsx
```

```typescript
// app/layout.tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}

// For Next.js Pages Router
// pages/_app.tsx
import { NuqsAdapter } from 'nuqs/adapters/next/pages';

export default function App({ Component, pageProps }) {
  return (
    <NuqsAdapter>
      <Component {...pageProps} />
    </NuqsAdapter>
  );
}

// For React Router
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';

// For Remix
import { NuqsAdapter } from 'nuqs/adapters/remix';
```

### 3.3 Basic Usage

```typescript
// === nuqs basics: useQueryState ===
'use client';
import {
  useQueryState,
  parseAsInteger,
  parseAsBoolean,
  parseAsStringEnum,
  parseAsFloat,
  parseAsIsoDateTime,
  parseAsJson,
  parseAsArrayOf,
  parseAsString,
} from 'nuqs';

function ProductPage() {
  // String parameter (default parser)
  const [query, setQuery] = useQueryState('q', { defaultValue: '' });
  // URL: ?q=laptop → query = 'laptop'
  // URL: (none)    → query = ''

  // Numeric parameter
  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1)
  );
  // URL: ?page=3 → page = 3 (number type)
  // URL: (none)  → page = 1

  // Enum parameter
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringEnum(['newest', 'price-asc', 'price-desc', 'popular'])
      .withDefault('newest')
  );
  // URL: ?sort=price-asc → sort = 'price-asc'
  // Invalid values are ignored

  // Boolean parameter
  const [inStock, setInStock] = useQueryState(
    'in_stock',
    parseAsBoolean.withDefault(false)
  );
  // URL: ?in_stock=true → inStock = true

  // Nullable parameter (without withDefault)
  const [category, setCategory] = useQueryState('category');
  // URL: ?category=books → category = 'books'
  // URL: (none)           → category = null

  return (
    <div>
      {/* String input */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value || null)}
        placeholder="Search..."
      />

      {/* Sort select */}
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as typeof sort)}
      >
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="popular">Most Popular</option>
      </select>

      {/* Pagination */}
      <button
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </button>
      <span>Page {page}</span>
      <button onClick={() => setPage(page + 1)}>
        Next
      </button>

      {/* In stock filter */}
      <label>
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked || null)}
        />
        In Stock Only
      </label>

      {/* Category (nullable) */}
      <select
        value={category ?? ''}
        onChange={(e) => setCategory(e.target.value || null)}
      >
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="books">Books</option>
      </select>
    </div>
  );
}
```

### 3.4 Advanced Parsers

```typescript
// === nuqs advanced parsers ===

// 1. Float
const [price, setPrice] = useQueryState(
  'price',
  parseAsFloat.withDefault(0)
);
// URL: ?price=29.99 → price = 29.99

// 2. ISO datetime
const [date, setDate] = useQueryState(
  'date',
  parseAsIsoDateTime.withDefault(new Date())
);
// URL: ?date=2024-03-15T10:30:00.000Z → Date object

// 3. Array (comma-separated)
const [tags, setTags] = useQueryState(
  'tags',
  parseAsArrayOf(parseAsString, ',').withDefault([])
);
// URL: ?tags=sale,new,popular → tags = ['sale', 'new', 'popular']

// 4. Numeric array
const [ids, setIds] = useQueryState(
  'ids',
  parseAsArrayOf(parseAsInteger, ',').withDefault([])
);
// URL: ?ids=1,2,3 → ids = [1, 2, 3]

// 5. JSON parameter (complex objects)
interface PriceRange {
  min: number;
  max: number;
}

const [priceRange, setPriceRange] = useQueryState<PriceRange>(
  'price_range',
  parseAsJson<PriceRange>().withDefault({ min: 0, max: 10000 })
);
// URL: ?price_range={"min":100,"max":500}

// 6. Custom parser
import { createParser } from 'nuqs';

// Custom: numeric range from dash-separated value
const parseAsRange = createParser({
  parse: (value: string) => {
    const [min, max] = value.split('-').map(Number);
    if (isNaN(min) || isNaN(max)) return null;
    return { min, max };
  },
  serialize: (value: { min: number; max: number }) =>
    `${value.min}-${value.max}`,
});

const [range, setRange] = useQueryState(
  'range',
  parseAsRange.withDefault({ min: 0, max: 100 })
);
// URL: ?range=10-50 → { min: 10, max: 50 }

// 7. Custom: slugified string
const parseAsSlug = createParser({
  parse: (value: string) => value.replace(/-/g, ' '),
  serialize: (value: string) =>
    value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
});

const [searchTerm, setSearchTerm] = useQueryState(
  'q',
  parseAsSlug.withDefault('')
);
// URL: ?q=red-shoes → searchTerm = 'red shoes'
// setSearchTerm('Blue Jacket') → URL: ?q=blue-jacket
```

### 3.5 useQueryStates (Managing Multiple Parameters at Once)

```typescript
// === useQueryStates: Manage multiple parameters at once ===
import { useQueryStates, parseAsInteger, parseAsStringEnum } from 'nuqs';

// Define parsers in one place
const productFiltersParsers = {
  q: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(20),
  sort: parseAsStringEnum(['newest', 'price-asc', 'price-desc', 'popular'])
    .withDefault('newest'),
  category: parseAsString,
  tags: parseAsArrayOf(parseAsString, ',').withDefault([]),
  in_stock: parseAsBoolean.withDefault(false),
  price_min: parseAsInteger,
  price_max: parseAsInteger,
};

function ProductPage() {
  // Manage all parameters at once
  const [filters, setFilters] = useQueryStates(productFiltersParsers);

  // The type of filters is automatically inferred:
  // {
  //   q: string;
  //   page: number;
  //   per_page: number;
  //   sort: 'newest' | 'price-asc' | 'price-desc' | 'popular';
  //   category: string | null;
  //   tags: string[];
  //   in_stock: boolean;
  //   price_min: number | null;
  //   price_max: number | null;
  // }

  // Batch update (processed in batch → 1 URL update)
  function handleCategoryChange(category: string) {
    setFilters({
      category: category || null,
      page: 1,  // Reset page
    });
  }

  // Full reset
  function handleReset() {
    setFilters({
      q: '',
      page: 1,
      per_page: 20,
      sort: 'newest',
      category: null,
      tags: [],
      in_stock: false,
      price_min: null,
      price_max: null,
    });
  }

  // Conditional update
  function handlePriceRangeChange(min: number | null, max: number | null) {
    setFilters({
      price_min: min,
      price_max: max,
      page: 1,  // Reset page
    });
  }

  return (
    <div>
      <p>
        {filters.q && `Search: "${filters.q}"`}
        {filters.category && ` | Category: ${filters.category}`}
        {filters.tags.length > 0 && ` | Tags: ${filters.tags.join(', ')}`}
      </p>
      {/* UI components */}
    </div>
  );
}
```

### 3.6 nuqs + TanStack Query Integration

```typescript
// === nuqs + TanStack Query: Link URL state to data fetching ===
import { useQueryStates, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

const searchParsers = {
  q: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringEnum(['newest', 'price-asc', 'price-desc'])
    .withDefault('newest'),
  category: parseAsString,
};

function useProducts() {
  const [filters] = useQueryStates(searchParsers);

  return useQuery({
    // Use URL parameters directly as queryKey
    queryKey: ['products', filters],
    queryFn: () => api.products.list({
      q: filters.q || undefined,
      page: filters.page,
      sort: filters.sort,
      category: filters.category ?? undefined,
    }),
    // Prevent flicker on page change
    placeholderData: keepPreviousData,
    // Auto re-fetch when URL parameters change
    staleTime: 30_000,
  });
}

function ProductListPage() {
  const [filters, setFilters] = useQueryStates(searchParsers);
  const { data, isLoading, isFetching } = useProducts();

  return (
    <div>
      {/* Filter UI */}
      <SearchInput
        value={filters.q}
        onChange={(q) => setFilters({ q: q || null, page: 1 })}
      />

      {/* Loading state */}
      {isLoading && <ProductGridSkeleton />}

      {/* Data display */}
      {data && (
        <>
          <p>{data.meta.total} products found</p>
          {isFetching && <ProgressBar />}
          <ProductGrid products={data.items} />
          <Pagination
            currentPage={filters.page}
            totalPages={data.meta.totalPages}
            onPageChange={(page) => setFilters({ page })}
          />
        </>
      )}
    </div>
  );
}
```

### 3.7 nuqs Server Component Integration

```typescript
// === nuqs: searchParams cache for Server Components ===
import { createSearchParamsCache } from 'nuqs/server';
import { parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs';

// Define the parser cache for server use
const searchParamsCache = createSearchParamsCache({
  q: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringEnum(['newest', 'price-asc', 'price-desc'])
    .withDefault('newest'),
  category: parseAsString,
});

// app/products/page.tsx (Server Component)
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  // Parse searchParams with type safety
  const { q, page, sort, category } = await searchParamsCache.parse(
    await searchParams
  );

  // Fetch data in Server Component
  const products = await getProducts({
    query: q || undefined,
    page,
    sort,
    category: category ?? undefined,
  });

  return (
    <div>
      <h1>Products</h1>
      <Suspense fallback={<FiltersSkeleton />}>
        <ProductFilters />  {/* Client Component using nuqs */}
      </Suspense>
      <ProductGrid products={products.data} />
      <Pagination
        currentPage={page}
        totalPages={products.meta.totalPages}
      />
    </div>
  );
}
```

---

## 4. Integration with Server Components

### 4.1 searchParams in Next.js App Router

In Next.js App Router, page components that are Server Components can receive `searchParams` as props. This enables server-side data fetching based on URL state.

```typescript
// === Next.js App Router: searchParams in Server Components ===
// app/products/page.tsx

interface SearchParams {
  q?: string;
  page?: string;
  sort?: string;
  category?: string;
  tags?: string | string[];
  price_min?: string;
  price_max?: string;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Parse and validate parameters
  const page = Math.max(1, Number(params.page ?? '1'));
  const sort = validateSort(params.sort ?? 'newest');
  const category = params.category ?? null;
  const tags = Array.isArray(params.tags)
    ? params.tags
    : params.tags
      ? [params.tags]
      : [];
  const priceMin = params.price_min ? Number(params.price_min) : undefined;
  const priceMax = params.price_max ? Number(params.price_max) : undefined;

  // Server-side data fetch
  const products = await getProducts({
    query: params.q,
    page,
    sort,
    category,
    tags,
    priceMin,
    priceMax,
  });

  return (
    <div>
      {/* SEO: Dynamic metadata */}
      <h1>
        {category ? `${category} Products` : 'All Products'}
        {params.q && ` - "${params.q}"`}
      </h1>

      {/* Client Component: Filter UI */}
      <Suspense fallback={<FiltersSkeleton />}>
        <ProductFilters />
      </Suspense>

      {/* Server Component: Results display */}
      <p>{products.meta.total} products found</p>
      <ProductGrid products={products.data} />

      {/* Server Component: Pagination (link-based) */}
      <ServerPagination
        currentPage={page}
        totalPages={products.meta.totalPages}
        searchParams={params}
      />
    </div>
  );
}

// Validation function
function validateSort(sort: string): string {
  const validSorts = ['newest', 'oldest', 'price-asc', 'price-desc', 'popular'];
  return validSorts.includes(sort) ? sort : 'newest';
}
```

### 4.2 Server Component Pagination (Link-Based)

Since `useSearchParams` cannot be used in Server Components, pagination using `<Link>` components is recommended.

```typescript
// === Server Component: Link-based pagination ===
import Link from 'next/link';

interface ServerPaginationProps {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}

function ServerPagination({
  currentPage,
  totalPages,
  searchParams,
}: ServerPaginationProps) {
  function createPageURL(page: number): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page') continue; // page is set separately
      if (value === undefined) continue;

      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.set(key, value);
      }
    }

    if (page > 1) {
      params.set('page', String(page));
    }

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }

  // Generate list of page numbers
  const pages = generatePageNumbers(currentPage, totalPages);

  return (
    <nav aria-label="Pagination">
      {/* Previous page */}
      {currentPage > 1 ? (
        <Link href={createPageURL(currentPage - 1)}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true">Previous</span>
      )}

      {/* Page numbers */}
      {pages.map((page, index) => (
        page === '...' ? (
          <span key={`ellipsis-${index}`}>...</span>
        ) : (
          <Link
            key={page}
            href={createPageURL(Number(page))}
            aria-current={Number(page) === currentPage ? 'page' : undefined}
            className={Number(page) === currentPage ? 'active' : ''}
          >
            {page}
          </Link>
        )
      ))}

      {/* Next page */}
      {currentPage < totalPages ? (
        <Link href={createPageURL(currentPage + 1)}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true">Next</span>
      )}
    </nav>
  );
}

// Page number generation logic
function generatePageNumbers(
  current: number,
  total: number
): (string | number)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, '...', total];
  }

  if (current >= total - 2) {
    return [1, '...', total - 3, total - 2, total - 1, total];
  }

  return [1, '...', current - 1, current, current + 1, '...', total];
}
```

### 4.3 Dynamic Metadata and URL State

By dynamically generating metadata based on URL state, SEO optimization can be achieved.

```typescript
// === Dynamic metadata generation ===
// app/products/page.tsx

import { Metadata } from 'next';

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;

  let title = 'Products';
  let description = 'Browse our product catalog';

  if (params.q) {
    title = `Search: "${params.q}" - Products`;
    description = `Search results for "${params.q}"`;
  }

  if (params.category) {
    title = `${params.category} - Products`;
    description = `Browse ${params.category} products`;
  }

  const page = Number(params.page ?? '1');
  if (page > 1) {
    title += ` (Page ${page})`;
  }

  return {
    title,
    description,
    // Canonical URL to prevent pagination duplicates
    alternates: {
      canonical: params.q
        ? `/products?q=${encodeURIComponent(params.q)}`
        : params.category
          ? `/products?category=${params.category}`
          : '/products',
    },
    // Do not index search result pages
    robots: params.q ? { index: false } : undefined,
  };
}
```

### 4.4 Streaming SSR and URL State

You can leverage Next.js Streaming SSR to efficiently handle data fetching based on URL state.

```typescript
// === Streaming SSR pattern ===
// app/products/page.tsx

import { Suspense } from 'react';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;

  return (
    <div>
      <h1>Products</h1>

      {/* Filter UI: shown immediately (Client Component) */}
      <Suspense fallback={<FiltersSkeleton />}>
        <ProductFilters />
      </Suspense>

      {/* Search results: streamed after data fetch */}
      <Suspense fallback={<ProductGridSkeleton count={20} />}>
        <ProductResults searchParams={params} />
      </Suspense>

      {/* Sidebar: streamed independently */}
      <Suspense fallback={<SidebarSkeleton />}>
        <CategorySidebar />
      </Suspense>
    </div>
  );
}

// Server Component with data fetching
async function ProductResults({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  // The fallback is shown until this data fetch completes
  const products = await getProducts({
    query: searchParams.q,
    page: Number(searchParams.page ?? '1'),
    sort: searchParams.sort ?? 'newest',
    category: searchParams.category,
  });

  return (
    <>
      <p>{products.meta.total} products found</p>
      <ProductGrid products={products.data} />
      <ServerPagination
        currentPage={Number(searchParams.page ?? '1')}
        totalPages={products.meta.totalPages}
        searchParams={searchParams}
      />
    </>
  );
}
```

---

## 5. Design Patterns and Best Practices

### 5.1 URL State Design Principles

```
URL state design principles:

  1. Do not include default values in the URL:
     /products              ← default (page=1, sort=newest)
     /products?sort=price   ← only sort changed
     → URLs become simpler
     → Existing bookmarks are not broken when default values change

  2. Reset page on filter change:
     /products?category=books&page=3
     → change category → /products?category=electronics (page reset to 1)
     → Prevents users from viewing pages that don't exist

  3. Unify the style for array parameters:
     Style A: /products?tag=sale&tag=new     ← multiple same keys (Web standard)
     Style B: /products?tags=sale,new         ← comma-separated (simple)
     → Unify to one style throughout the project

  4. Debounce (search input):
     → Do not update URL on every keystroke
     → Apply a 300-500ms debounce
     → Prevents polluting browser history

  5. Shallow routing:
     → Update URL without re-rendering the entire page
     → Next.js: router.push(url, { scroll: false })
     → Perform data fetching on the client side

  6. URL normalization:
     → Unify parameter order (alphabetical by key name)
     → Unify casing
     → Remove unnecessary whitespace or encoding

  7. Backward compatibility:
     → When changing parameter names, also support old parameters
     → Forward old URLs to new URLs via redirects
```

### 5.2 Debounce Pattern

For values that change frequently such as search input, you need to use debouncing to limit how often the URL is updated.

```typescript
// === Debounce: Sync search input with URL ===
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * Debounce hook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced search input component
 */
function DebouncedSearchInput() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Local state (updates immediately)
  const [inputValue, setInputValue] = useState(
    searchParams.get('q') ?? ''
  );

  // Debounced value (confirmed after 300ms)
  const debouncedQuery = useDebounce(inputValue, 300);

  // Update URL when debounced value changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    } else {
      params.delete('q');
    }
    params.delete('page'); // Reset page on search change

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;

    // replace: don't leave history while typing
    router.replace(url, { scroll: false });
  }, [debouncedQuery, pathname, router, searchParams]);

  // Sync when URL is changed externally (e.g., browser back)
  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    if (urlQuery !== inputValue) {
      setInputValue(urlQuery);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="search"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder="Search products..."
    />
  );
}
```

```typescript
// === Debounce with nuqs ===
import { useQueryState } from 'nuqs';

function SearchWithNuqs() {
  const [query, setQuery] = useQueryState('q', {
    defaultValue: '',
    // In nuqs v2+, controlled via the shallow option
    shallow: true, // Prevent requests to the server
    throttleMs: 300, // Throttle URL updates
    history: 'replace', // Don't pollute history while typing
  });

  return (
    <input
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value || null)}
      placeholder="Search..."
    />
  );
}
```

### 5.3 URL State Validation

Since users may edit the URL directly, validation of URL state is essential.

```typescript
// === URL state validation ===
import { z } from 'zod';

// Define URL state with a Zod schema
const searchParamsSchema = z.object({
  q: z.string().max(200).optional().default(''),
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().min(10).max(100).optional().default(20),
  sort: z.enum(['newest', 'oldest', 'price-asc', 'price-desc', 'popular'])
    .optional().default('newest'),
  category: z.string().max(50).optional(),
  tags: z.string().transform(s => s ? s.split(',') : []).optional().default(''),
  price_min: z.coerce.number().nonnegative().optional(),
  price_max: z.coerce.number().nonnegative().optional(),
}).refine(
  (data) => {
    if (data.price_min !== undefined && data.price_max !== undefined) {
      return data.price_min <= data.price_max;
    }
    return true;
  },
  { message: 'price_min must be less than or equal to price_max' }
);

type ValidatedSearchParams = z.infer<typeof searchParamsSchema>;

// Validation in Server Component
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const rawParams = await searchParams;

  // Validation and application of default values
  const result = searchParamsSchema.safeParse(rawParams);

  if (!result.success) {
    // Redirect to defaults if invalid parameters
    redirect('/products');
  }

  const validParams = result.data;

  // ... data fetch
}

// Validation in a custom hook (Client Component)
function useValidatedSearchParams() {
  const searchParams = useSearchParams();

  const rawParams = Object.fromEntries(searchParams.entries());
  const result = searchParamsSchema.safeParse(rawParams);

  if (!result.success) {
    // Return default values
    return searchParamsSchema.parse({});
  }

  return result.data;
}
```

```typescript
// === XSS protection: Sanitizing URL state ===

/**
 * Sanitize URL parameters
 * Prevents XSS and injection attacks
 */
function sanitizeSearchParam(value: string): string {
  // Remove HTML tags
  const sanitized = value.replace(/<[^>]*>/g, '');

  // Remove control characters
  const cleaned = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Limit max length
  return cleaned.slice(0, 500);
}

/**
 * Safely display URL parameters
 */
function SafeSearchDisplay({ query }: { query: string }) {
  // React prevents XSS by default, but as additional protection:
  const safeQuery = sanitizeSearchParam(query);

  return (
    <h2>
      Search results for: <span className="highlight">{safeQuery}</span>
    </h2>
  );
}

// Danger: Do not use URL parameters directly in dangerouslySetInnerHTML
// Bad:
function DangerousComponent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';

  // Never do this!
  // return <div dangerouslySetInnerHTML={{ __html: q }} />;

  // Good: Display as React text node
  return <div>{q}</div>;
}
```

### 5.4 Working with the History API

The History API operates under the hood of URL state management. It is important to understand when to use push vs replace.

```typescript
// === History API: When to use push vs replace ===

/**
 * Cases where push (add to history) should be used:
 * - Filter changes
 * - Category changes
 * - Sort changes
 * - Search confirmation (after debounce)
 * → Users can go back to the previous filter state with browser back
 */
function handleFilterChange(newCategory: string) {
  // React Router
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('category', newCategory);
    return next;
  }); // Default is push

  // Next.js
  router.push(`${pathname}?category=${newCategory}`);
}

/**
 * Cases where replace (replace history) should be used:
 * - Real-time updates while typing in search (during debounce)
 * - Consecutive pagination clicks
 * - Frequent sort switching
 * - Normalization of initial parameters
 * → Browser back won't return to a large number of intermediate states
 */
function handleSearchInput(query: string) {
  // React Router
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (query) next.set('q', query);
    else next.delete('q');
    return next;
  }, { replace: true }); // Replace history

  // Next.js
  router.replace(`${pathname}?q=${encodeURIComponent(query)}`);
}

/**
 * popstate event: Detect browser back/forward
 */
useEffect(() => {
  function handlePopState(event: PopStateEvent) {
    // Handler when browser back/forward is pressed
    // React Router and Next.js handle this automatically,
    // but use this when custom logic is needed
    console.log('Navigation via browser back/forward');
    console.log('New URL:', window.location.href);
  }

  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, []);
```

### 5.5 Array Parameter Design Patterns

There are multiple ways to reflect array values such as multi-select filters in URLs. Understand the characteristics of each and choose the method appropriate for your project.

```typescript
// === Comparison of array parameter styles ===

// Style 1: Repeated same key (Web standard / URLSearchParams compliant)
// URL: ?tag=sale&tag=new&tag=popular
// Get: searchParams.getAll('tag') → ['sale', 'new', 'popular']
// Pro: Compliant with Web standards, naturally handled by URLSearchParams
// Con: URL tends to get long

// Style 2: Comma-separated
// URL: ?tags=sale,new,popular
// Get: searchParams.get('tags')?.split(',') ?? []
// Pro: Compact URL
// Con: Escaping needed if values contain commas

// Style 3: Bracket notation (PHP/Ruby on Rails style)
// URL: ?tags[]=sale&tags[]=new&tags[]=popular
// Get: Manual parsing required
// Pro: Compatibility with backend frameworks
// Con: Cannot be handled directly by URLSearchParams

// Style 4: JSON encoding
// URL: ?tags=["sale","new","popular"]
// Get: JSON.parse(searchParams.get('tags') ?? '[]')
// Pro: Can express complex structures
// Con: URL is hard to read, encoding makes it long

// Recommendation: Style 1 or Style 2
// Simple arrays → Style 2 (comma-separated)
// URLSearchParams compatibility focus → Style 1 (repeated same key)

// Implementation example: comma-separated helper
function useArrayParam(key: string): [string[], (values: string[]) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = searchParams.get(key)?.split(',').filter(Boolean) ?? [];

  const setValues = useCallback((newValues: string[]) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (newValues.length > 0) {
        params.set(key, newValues.join(','));
      } else {
        params.delete(key);
      }
      params.delete('page'); // Reset page
      return params;
    });
  }, [key, setSearchParams]);

  return [values, setValues];
}

// Usage example
function TagFilter() {
  const [selectedTags, setSelectedTags] = useArrayParam('tags');

  const allTags = ['sale', 'new', 'popular', 'limited', 'exclusive'];

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  }

  return (
    <div>
      {allTags.map(tag => (
        <button
          key={tag}
          onClick={() => toggleTag(tag)}
          className={selectedTags.includes(tag) ? 'active' : ''}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
```

---

## 6. Debounce, Throttle, and Optimization

### 6.1 Basic Principles of Performance Optimization

A URL state change triggers the following sequence of operations:
1. URL update (History API)
2. React re-render (detection of state change)
3. Data fetch (API call)
4. UI update (reflecting render results)

If these processes occur frequently, it becomes a performance issue, so appropriate optimization is necessary.

```typescript
// === Performance optimization: useDeferredValue ===
'use client';
import { useDeferredValue, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

function ProductListPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';

  // Defer the URL value (prevents UI blocking)
  const deferredQuery = useDeferredValue(query);

  // Filter with the deferred value
  const filteredProducts = useMemo(
    () => products.filter(p =>
      p.name.toLowerCase().includes(deferredQuery.toLowerCase())
    ),
    [products, deferredQuery]
  );

  // Change style while deferred to indicate loading
  const isStale = query !== deferredQuery;

  return (
    <div className={isStale ? 'opacity-70 transition-opacity' : ''}>
      <ProductGrid products={filteredProducts} />
    </div>
  );
}
```

```typescript
// === Performance optimization: useTransition ===
'use client';
import { useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

function OptimizedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleFilterChange(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');

    // startTransition: Update URL while maintaining UI responsiveness
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, {
        scroll: false,
      });
    });
  }

  return (
    <div>
      {/* Show loading state using isPending */}
      {isPending && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      <select
        onChange={(e) => handleFilterChange('category', e.target.value || null)}
        disabled={isPending}
      >
        <option value="">All</option>
        <option value="electronics">Electronics</option>
        <option value="books">Books</option>
      </select>
    </div>
  );
}
```

### 6.2 Limiting the Number of URL State Changes

```typescript
// === Throttle: Limit URL update frequency ===

/**
 * Throttle hook: Only update value at a fixed interval
 */
function useThrottle<T>(value: T, intervalMs: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdated.current;

    if (timeSinceLastUpdate >= intervalMs) {
      setThrottledValue(value);
      lastUpdated.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastUpdated.current = Date.now();
      }, intervalMs - timeSinceLastUpdate);

      return () => clearTimeout(timer);
    }
  }, [value, intervalMs]);

  return throttledValue;
}

// Usage: Sync slider value to URL
function PriceRangeSlider() {
  const [localMin, setLocalMin] = useState(0);
  const [localMax, setLocalMax] = useState(10000);

  // Update URL only every 100ms
  const throttledMin = useThrottle(localMin, 100);
  const throttledMax = useThrottle(localMax, 100);

  const { pushParams } = useURLParams();

  useEffect(() => {
    pushParams({
      price_min: throttledMin > 0 ? String(throttledMin) : null,
      price_max: throttledMax < 10000 ? String(throttledMax) : null,
    });
  }, [throttledMin, throttledMax]);

  return (
    <div>
      <input
        type="range"
        min={0}
        max={10000}
        value={localMin}
        onChange={(e) => setLocalMin(Number(e.target.value))}
      />
      <input
        type="range"
        min={0}
        max={10000}
        value={localMax}
        onChange={(e) => setLocalMax(Number(e.target.value))}
      />
      <p>{localMin} - {localMax}</p>
    </div>
  );
}
```

### 6.3 Diff Detection and Prevention of Unnecessary URL State Updates

```typescript
// === Prevent unnecessary URL updates ===

/**
 * Determine if URL state has actually changed
 */
function hasSearchParamsChanged(
  prev: URLSearchParams,
  next: URLSearchParams
): boolean {
  // Compare the number of the same keys
  const prevKeys = new Set(prev.keys());
  const nextKeys = new Set(next.keys());

  if (prevKeys.size !== nextKeys.size) return true;

  for (const key of prevKeys) {
    if (!nextKeys.has(key)) return true;

    const prevValues = prev.getAll(key).sort();
    const nextValues = next.getAll(key).sort();

    if (prevValues.length !== nextValues.length) return true;
    if (prevValues.some((v, i) => v !== nextValues[i])) return true;
  }

  return false;
}

/**
 * Hook that prevents unnecessary updates
 */
function useSafeSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const safeSetSearchParams = useCallback(
    (
      updater: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
      options?: { replace?: boolean }
    ) => {
      const nextParams = typeof updater === 'function'
        ? updater(new URLSearchParams(searchParams))
        : updater;

      // Don't update if there is no actual change
      if (!hasSearchParamsChanged(searchParams, nextParams)) {
        return;
      }

      setSearchParams(nextParams, options);
    },
    [searchParams, setSearchParams]
  );

  return [searchParams, safeSetSearchParams] as const;
}
```

### 6.4 URL Normalization

To unify different URLs that have the same meaning, URL normalization is performed.

```typescript
// === URL Normalization ===

/**
 * Normalize URL parameters
 * - Sort keys alphabetically
 * - Remove default values
 * - Remove empty values
 */
function normalizeSearchParams(
  params: URLSearchParams,
  defaults: Record<string, string> = {}
): URLSearchParams {
  const normalized = new URLSearchParams();

  // Get entries and sort
  const entries = Array.from(params.entries())
    .filter(([key, value]) => {
      // Remove empty values
      if (!value) return false;
      // Remove default values
      if (defaults[key] === value) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [key, value] of entries) {
    normalized.append(key, value);
  }

  return normalized;
}

// Usage example
const params = new URLSearchParams('page=1&sort=newest&q=laptop&category=');
const normalized = normalizeSearchParams(params, {
  page: '1',
  sort: 'newest',
});
normalized.toString(); // 'q=laptop' (default values and empty values removed)

/**
 * URL normalization middleware (Next.js)
 */
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // Check if normalization is needed
  const normalized = normalizeSearchParams(
    url.searchParams,
    { page: '1', sort: 'newest', per_page: '20' }
  );

  const currentSearch = url.searchParams.toString();
  const normalizedSearch = normalized.toString();

  // Redirect if normalized URL is different
  if (currentSearch !== normalizedSearch) {
    url.search = normalizedSearch ? `?${normalizedSearch}` : '';
    return NextResponse.redirect(url, { status: 301 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/products/:path*',
};
```

---

## 7. Anti-Patterns and Cautions

### 7.1 Common Anti-Patterns

It is important to understand and avoid common anti-patterns in URL state management.

```typescript
// === Anti-patterns collection ===

// Anti-pattern 1: Including sensitive information in the URL
// URL: /dashboard?token=eyJhbGciOiJIUzI1NiJ9...
// → URLs remain in browser history, server logs, and referrer headers
// → Authentication information should be stored in Cookies (HttpOnly)

// Anti-pattern 2: Stuffing large amounts of data into the URL
// URL: /products?ids=1,2,3,4,5,...,1000
// → URLs have a practical limit of ~2048 characters (depends on browser/server)
// → Large amounts of data should be stored in server-side sessions or localStorage

// Anti-pattern 3: Including default values in the URL
// URL: /products?page=1&sort=newest&per_page=20&view=grid
// → URL becomes verbose
// → Manage default values in code and omit them from the URL

// Anti-pattern 4: Not resetting page when filter changes
function BadFilterChange() {
  const [searchParams, setSearchParams] = useSearchParams();

  function handleCategoryChange(category: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('category', category);
      // Page not reset!
      // If you change category while on page=5,
      // page 5 may not exist in the new category
      return next;
    });
  }
}

// Correct pattern
function GoodFilterChange() {
  const [searchParams, setSearchParams] = useSearchParams();

  function handleCategoryChange(category: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('category', category);
      next.delete('page'); // Reset page
      return next;
    });
  }
}

// Anti-pattern 5: Using without type conversion
function BadTypeHandling() {
  const [searchParams] = useSearchParams();

  // Using string directly for comparison/arithmetic
  const page = searchParams.get('page'); // string | null
  if (page > 1) { /* Becomes string comparison! '9' > '10' is true */ }
}

// Correct pattern
function GoodTypeHandling() {
  const [searchParams] = useSearchParams();

  // Explicit type conversion
  const page = Number(searchParams.get('page') ?? '1');
  if (page > 1) { /* Numeric comparison */ }
}

// Anti-pattern 6: Creating new URLSearchParams on every render
function BadPerformance() {
  const [searchParams, setSearchParams] = useSearchParams();

  // new URLSearchParams is called on every render
  // → Reference changes every time, can cause infinite loops in useEffect
  const params = new URLSearchParams(searchParams);
  const query = params.get('q');

  useEffect(() => {
    // params is a new object every time, so infinite loop!
    fetchProducts(params);
  }, [params]); // Bad
}

// Correct pattern
function GoodPerformance() {
  const [searchParams] = useSearchParams();

  // Use primitive values in dependency array
  const query = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  useEffect(() => {
    fetchProducts({ q: query, page });
  }, [query, page]); // Stable because they are primitive values
}

// Anti-pattern 7: No validation of URL parameters
function BadValidation() {
  const [searchParams] = useSearchParams();

  // User might input ?page=-5 or ?page=abc
  const page = Number(searchParams.get('page'));
  // Can become NaN or a negative number

  // No validation of sort value
  const sort = searchParams.get('sort');
  // Any string can be entered (risk of SQL injection)
}

// Correct pattern
function GoodValidation() {
  const [searchParams] = useSearchParams();

  // With validation
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  // Validate with whitelist
  const validSorts = ['newest', 'oldest', 'price-asc', 'price-desc'] as const;
  const rawSort = searchParams.get('sort');
  const sort = validSorts.includes(rawSort as any)
    ? (rawSort as typeof validSorts[number])
    : 'newest';
}

// Anti-pattern 8: No debounce on search input
function BadSearchInput() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <input
      onChange={(e) => {
        // URL updated on every keystroke
        // → Large number of browser history entries created
        // → Network request occurs every time
        router.push(`${pathname}?q=${e.target.value}`);
      }}
    />
  );
}

// Anti-pattern 9: Using searchParams directly for object comparison
function BadComparison() {
  const [searchParams] = useSearchParams();

  // URLSearchParams is an object, so reference comparison
  useEffect(() => {
    // searchParams is a new instance every render
    // → Runs every time
  }, [searchParams]);

  // Convert to string for comparison
  const searchString = searchParams.toString();
  useEffect(() => {
    // String comparison, so won't run if content is the same
  }, [searchString]);
}
```

### 7.2 Security Considerations for URL State Management

```
Security checklist for URL state:

□ Are authentication tokens not included in URL parameters?
  → Use Cookie (HttpOnly, Secure, SameSite)

□ Are URL parameters not used directly in SQL queries?
  → Use parameterized queries
  → Validate with a whitelist

□ Are URL parameters not output directly as HTML?
  → Display as React text nodes (auto-escaping)
  → Do not use dangerouslySetInnerHTML

□ Is the length of URL parameters limited?
  → Set a maximum length as a DoS attack countermeasure

□ Are there no Open Redirect vulnerabilities?
  → Only allow internal URLs for redirect parameters
  → Prohibit redirects to external URLs

□ Are server resources not being manipulated via URL parameters?
  → Only include read-only parameters in the URL
  → Perform operations with side effects via POST requests

□ Is sensitive information not leaking through the Referrer header?
  → Set the Referrer-Policy header appropriately
  → Meta tag: <meta name="referrer" content="origin">
```

```typescript
// === Open Redirect Prevention ===

// Dangerous: Can redirect to external URLs
function DangerousRedirect() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  // If you access /login?redirect=https://evil.com,
  // after login you get redirected to evil.com
  router.push(redirectTo!); // Bad
}

// Safe: Only allow internal URLs
function SafeRedirect() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  function isInternalUrl(url: string): boolean {
    // Only allow paths starting with a slash
    if (!url.startsWith('/')) return false;
    // Reject protocol-relative URLs
    if (url.startsWith('//')) return false;
    // Reject backslashes (IE countermeasure)
    if (url.includes('\\')) return false;
    return true;
  }

  const safeRedirect = redirectTo && isInternalUrl(redirectTo)
    ? redirectTo
    : '/'; // Default redirect destination

  router.push(safeRedirect); // Safe
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests for URL State

```typescript
// === Testing URL state ===
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useProductFilters } from './useProductFilters';

// React Router tests
describe('useProductFilters', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/products?q=laptop&page=2']}>
        {children}
      </MemoryRouter>
    );
  }

  it('correctly retrieves filter values from URL', () => {
    const { result } = renderHook(() => useProductFilters(), { wrapper });

    expect(result.current.filters.query).toBe('laptop');
    expect(result.current.filters.page).toBe(2);
    expect(result.current.filters.sort).toBe('newest'); // default value
  });

  it('resets page when filter changes', () => {
    const { result } = renderHook(() => useProductFilters(), { wrapper });

    act(() => {
      result.current.setFilters({ category: 'electronics' });
    });

    expect(result.current.filters.category).toBe('electronics');
    expect(result.current.filters.page).toBe(1); // reset
  });

  it('uses default values for invalid values', () => {
    function invalidWrapper({ children }: { children: React.ReactNode }) {
      return (
        <MemoryRouter initialEntries={['/products?page=abc&sort=invalid']}>
          {children}
        </MemoryRouter>
      );
    }

    const { result } = renderHook(
      () => useProductFilters(),
      { wrapper: invalidWrapper }
    );

    expect(result.current.filters.page).toBe(1); // NaN → default
    expect(result.current.filters.sort).toBe('newest'); // invalid value → default
  });

  it('clears all parameters on reset', () => {
    const { result } = renderHook(() => useProductFilters(), { wrapper });

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters.query).toBe('');
    expect(result.current.filters.page).toBe(1);
    expect(result.current.isFiltered).toBe(false);
  });
});
```

### 8.2 E2E Tests (Playwright)

```typescript
// === Playwright: E2E tests for URL state ===
import { test, expect } from '@playwright/test';

test.describe('Product Filters - URL State', () => {
  test('filters are restored from URL parameters', async ({ page }) => {
    // Access directly with a specific URL state
    await page.goto('/products?q=laptop&category=electronics&sort=price-asc');

    // Confirm values are reflected in the filter UI
    await expect(page.locator('input[type="search"]')).toHaveValue('laptop');
    await expect(page.locator('select[name="category"]')).toHaveValue('electronics');
    await expect(page.locator('select[name="sort"]')).toHaveValue('price-asc');
  });

  test('URL is updated when filter changes', async ({ page }) => {
    await page.goto('/products');

    // Change category
    await page.selectOption('select[name="category"]', 'electronics');

    // Confirm URL has been updated
    await expect(page).toHaveURL(/category=electronics/);

    // Confirm page has been reset
    await expect(page).not.toHaveURL(/page=/);
  });

  test('filter state is restored with browser back', async ({ page }) => {
    await page.goto('/products');

    // Change filter
    await page.selectOption('select[name="category"]', 'electronics');
    await expect(page).toHaveURL(/category=electronics/);

    // Change filter again
    await page.selectOption('select[name="sort"]', 'price-asc');
    await expect(page).toHaveURL(/sort=price-asc/);

    // Browser back
    await page.goBack();

    // Confirm previous filter state is restored
    await expect(page).toHaveURL(/category=electronics/);
    await expect(page).not.toHaveURL(/sort=price-asc/);
  });

  test('search input is debounced', async ({ page }) => {
    await page.goto('/products');

    // Type quickly
    await page.locator('input[type="search"]').fill('laptop');

    // Wait for debounce period
    await page.waitForTimeout(500);

    // Confirm URL reflects only the final value
    await expect(page).toHaveURL(/q=laptop/);
  });

  test('same state is restored from shared URL', async ({ page, context }) => {
    // User A sets filters
    await page.goto('/products');
    await page.selectOption('select[name="category"]', 'electronics');
    await page.selectOption('select[name="sort"]', 'price-asc');

    // Get URL
    const sharedUrl = page.url();

    // User B accesses the same URL (new tab)
    const newPage = await context.newPage();
    await newPage.goto(sharedUrl);

    // Confirm the same filter state is restored
    await expect(newPage.locator('select[name="category"]')).toHaveValue('electronics');
    await expect(newPage.locator('select[name="sort"]')).toHaveValue('price-asc');
  });

  test('invalid URL parameters are handled safely', async ({ page }) => {
    // Access URL with invalid values
    await page.goto('/products?page=-1&sort=invalid&q=<script>alert(1)</script>');

    // Confirm page doesn't crash
    await expect(page.locator('h1')).toBeVisible();

    // Confirm invalid values are corrected to defaults
    // (depends on implementation: redirect or apply default values)
  });
});
```

### 8.3 Helper Function Tests for URL State

```typescript
// === Tests for helper functions ===
import { describe, it, expect } from 'vitest';
import { normalizeSearchParams, searchParamsToObject } from './url-utils';

describe('normalizeSearchParams', () => {
  it('removes default values', () => {
    const params = new URLSearchParams('page=1&sort=newest&q=laptop');
    const normalized = normalizeSearchParams(params, {
      page: '1',
      sort: 'newest',
    });

    expect(normalized.toString()).toBe('q=laptop');
  });

  it('removes empty values', () => {
    const params = new URLSearchParams('q=&category=&sort=price');
    const normalized = normalizeSearchParams(params);

    expect(normalized.toString()).toBe('sort=price');
  });

  it('sorts keys', () => {
    const params = new URLSearchParams('z=1&a=2&m=3');
    const normalized = normalizeSearchParams(params);

    expect(normalized.toString()).toBe('a=2&m=3&z=1');
  });

  it('returns empty params', () => {
    const params = new URLSearchParams('page=1&sort=newest');
    const normalized = normalizeSearchParams(params, {
      page: '1',
      sort: 'newest',
    });

    expect(normalized.toString()).toBe('');
  });
});

describe('searchParamsToObject', () => {
  it('returns single values as string', () => {
    const params = new URLSearchParams('q=laptop&page=2');
    const obj = searchParamsToObject(params);

    expect(obj).toEqual({ q: 'laptop', page: '2' });
  });

  it('returns multiple values as array', () => {
    const params = new URLSearchParams('tag=a&tag=b&tag=c');
    const obj = searchParamsToObject(params);

    expect(obj).toEqual({ tag: ['a', 'b', 'c'] });
  });

  it('correctly handles mixed values', () => {
    const params = new URLSearchParams('q=laptop&tag=a&tag=b&page=1');
    const obj = searchParamsToObject(params);

    expect(obj).toEqual({
      q: 'laptop',
      tag: ['a', 'b'],
      page: '1',
    });
  });
});
```

---

## 9. Practical Case Studies

### 9.1 E-Commerce Product Search Page

A complete implementation example of URL state management for an actual e-commerce site.

```typescript
// === Complete implementation: E-commerce product search ===

// 1. Shared parser definitions (searchParams.ts)
import {
  parseAsString,
  parseAsInteger,
  parseAsFloat,
  parseAsBoolean,
  parseAsStringEnum,
  parseAsArrayOf,
  createSearchParamsCache,
} from 'nuqs';

export const productSearchParsers = {
  // Search
  q: parseAsString.withDefault(''),

  // Pagination
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(24),

  // Sort
  sort: parseAsStringEnum([
    'relevance',
    'newest',
    'price-asc',
    'price-desc',
    'rating',
    'popular',
  ]).withDefault('relevance'),

  // Filters
  category: parseAsString,
  brand: parseAsString,
  tags: parseAsArrayOf(parseAsString, ',').withDefault([]),
  in_stock: parseAsBoolean.withDefault(false),
  price_min: parseAsFloat,
  price_max: parseAsFloat,
  rating_min: parseAsInteger,

  // Display settings
  view: parseAsStringEnum(['grid', 'list']).withDefault('grid'),
};

// Cache for Server Components
export const productSearchParamsCache = createSearchParamsCache(
  productSearchParsers
);

// Type definition
export type ProductSearchParams = {
  [K in keyof typeof productSearchParsers]: ReturnType<
    (typeof productSearchParsers)[K]['parse']
  >;
};
```

```typescript
// 2. Server Component (page.tsx)
import { Suspense } from 'react';
import { productSearchParamsCache } from './searchParams';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const filters = await productSearchParamsCache.parse(await searchParams);

  // Server-side data fetch
  const [products, categories, brands] = await Promise.all([
    getProducts(filters),
    getCategories(),
    getBrands(filters.category),
  ]);

  return (
    <div className="flex gap-6">
      {/* Sidebar: Filters */}
      <aside className="w-64 shrink-0">
        <Suspense fallback={<FiltersSkeleton />}>
          <ProductFiltersSidebar
            categories={categories}
            brands={brands}
          />
        </Suspense>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        {/* Search bar & sort */}
        <Suspense fallback={<SearchBarSkeleton />}>
          <SearchAndSort totalCount={products.meta.total} />
        </Suspense>

        {/* Active filters display */}
        <Suspense fallback={null}>
          <ActiveFilters />
        </Suspense>

        {/* Product grid */}
        <ProductGrid
          products={products.data}
          view={filters.view ?? 'grid'}
        />

        {/* Pagination */}
        <ServerPagination
          currentPage={filters.page}
          totalPages={products.meta.totalPages}
          searchParams={Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null)
          )}
        />
      </main>
    </div>
  );
}
```

```typescript
// 3. Client Component: Active filters display
'use client';
import { useQueryStates } from 'nuqs';
import { productSearchParsers } from './searchParams';

function ActiveFilters() {
  const [filters, setFilters] = useQueryStates(productSearchParsers);

  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.q) {
    activeFilters.push({
      key: 'q',
      label: `Search: "${filters.q}"`,
      onRemove: () => setFilters({ q: '', page: 1 }),
    });
  }

  if (filters.category) {
    activeFilters.push({
      key: 'category',
      label: `Category: ${filters.category}`,
      onRemove: () => setFilters({ category: null, page: 1 }),
    });
  }

  if (filters.brand) {
    activeFilters.push({
      key: 'brand',
      label: `Brand: ${filters.brand}`,
      onRemove: () => setFilters({ brand: null, page: 1 }),
    });
  }

  filters.tags.forEach((tag, index) => {
    activeFilters.push({
      key: `tag-${index}`,
      label: `Tag: ${tag}`,
      onRemove: () => setFilters({
        tags: filters.tags.filter((_, i) => i !== index),
        page: 1,
      }),
    });
  });

  if (filters.in_stock) {
    activeFilters.push({
      key: 'in_stock',
      label: 'In Stock Only',
      onRemove: () => setFilters({ in_stock: false, page: 1 }),
    });
  }

  if (filters.price_min !== null || filters.price_max !== null) {
    const min = filters.price_min ?? 0;
    const max = filters.price_max ?? 'unlimited';
    activeFilters.push({
      key: 'price',
      label: `Price: $${min} - $${max}`,
      onRemove: () => setFilters({
        price_min: null,
        price_max: null,
        page: 1,
      }),
    });
  }

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {activeFilters.map((filter) => (
        <span
          key={filter.key}
          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
        >
          {filter.label}
          <button
            onClick={filter.onRemove}
            className="ml-1 hover:text-blue-600"
            aria-label={`Remove filter: ${filter.label}`}
          >
            x
          </button>
        </span>
      ))}

      <button
        onClick={() => setFilters({
          q: '',
          category: null,
          brand: null,
          tags: [],
          in_stock: false,
          price_min: null,
          price_max: null,
          rating_min: null,
          page: 1,
          sort: 'relevance',
        })}
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Clear All
      </button>
    </div>
  );
}
```

### 9.2 Dashboard Filter Panel

```typescript
// === Dashboard: Date range filter ===
'use client';
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

const dashboardParsers = {
  from: parseAsString,
  to: parseAsString,
  preset: parseAsStringEnum([
    'today',
    '7d',
    '30d',
    '90d',
    'year',
    'custom',
  ]).withDefault('30d'),
  metric: parseAsStringEnum([
    'revenue',
    'orders',
    'visitors',
    'conversion',
  ]).withDefault('revenue'),
  granularity: parseAsStringEnum([
    'hour',
    'day',
    'week',
    'month',
  ]).withDefault('day'),
};

function DashboardFilters() {
  const [filters, setFilters] = useQueryStates(dashboardParsers);

  // Calculate date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();

    switch (filters.preset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case '7d':
        return { from: subDays(now, 7), to: now };
      case '30d':
        return { from: subDays(now, 30), to: now };
      case '90d':
        return { from: subDays(now, 90), to: now };
      case 'year':
        return { from: subDays(now, 365), to: now };
      case 'custom':
        return {
          from: filters.from ? new Date(filters.from) : subDays(now, 30),
          to: filters.to ? new Date(filters.to) : now,
        };
      default:
        return { from: subDays(now, 30), to: now };
    }
  }, [filters.preset, filters.from, filters.to]);

  function handlePresetChange(preset: string) {
    if (preset === 'custom') {
      setFilters({
        preset: 'custom',
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: format(dateRange.to, 'yyyy-MM-dd'),
      });
    } else {
      setFilters({
        preset: preset as any,
        from: null,
        to: null,
      });
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Preset select */}
      <select
        value={filters.preset}
        onChange={(e) => handlePresetChange(e.target.value)}
      >
        <option value="today">Today</option>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
        <option value="90d">Last 90 Days</option>
        <option value="year">Last Year</option>
        <option value="custom">Custom Range</option>
      </select>

      {/* Custom date range (shown only when preset=custom) */}
      {filters.preset === 'custom' && (
        <>
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => setFilters({ from: e.target.value || null })}
          />
          <span>to</span>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => setFilters({ to: e.target.value || null })}
          />
        </>
      )}

      {/* Metric select */}
      <select
        value={filters.metric}
        onChange={(e) => setFilters({ metric: e.target.value as any })}
      >
        <option value="revenue">Revenue</option>
        <option value="orders">Orders</option>
        <option value="visitors">Visitors</option>
        <option value="conversion">Conversion Rate</option>
      </select>

      {/* Granularity select */}
      <select
        value={filters.granularity}
        onChange={(e) => setFilters({ granularity: e.target.value as any })}
      >
        <option value="hour">Hourly</option>
        <option value="day">Daily</option>
        <option value="week">Weekly</option>
        <option value="month">Monthly</option>
      </select>
    </div>
  );
}
```

---

## 10. URL State Management Tool Comparison

### 10.1 Tool Selection Guide

| Tool | Type Safety | Framework | Batch Update | SSR Support | Learning Cost | Recommended For |
|------|-------------|-----------|--------------|-------------|---------------|-----------------|
| URLSearchParams | Low | None (Web standard) | Manual | Yes | Low | Simple cases |
| useSearchParams (RR) | Low | React Router | Manual | No | Low | React Router projects |
| useSearchParams (Next) | Low | Next.js | Manual | Yes | Low | Next.js projects |
| nuqs | High | Next/RR/Remix | Automatic | Yes | Medium | When type safety is needed |
| qs library | Low | None | Manual | Yes | Low | Serializing nested objects |
| Custom hook | Medium | Any | Manual | Depends | High | When special requirements exist |

### 10.2 Recommendations by Project Scale

```
Small projects (1-3 pages with filters):
  → useSearchParams + custom helper functions
  → No additional libraries needed
  → Simple and easy to understand

Medium projects (5-10 pages with filters):
  → Introduce nuqs
  → Great benefits from type safety and batch updates
  → Share parser definitions to maintain consistency

Large projects (10+ pages, complex filters):
  → nuqs + Zod validation
  → Server Component integration (searchParamsCache)
  → URL normalization middleware
  → Regression test URL state with E2E tests
```

---

## 11. Troubleshooting

### 11.1 Common Issues and Solutions

```
Issue 1: useSearchParams requires a Suspense boundary (Next.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: In Next.js App Router, useSearchParams is a client-only value
Solution: Wrap with <Suspense> or provide a fallback
  <Suspense fallback={<Loading />}>
    <ComponentWithSearchParams />
  </Suspense>

Issue 2: URL parameters disappear / are reset
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: Passing an object to setSearchParams replaces all parameters
Solution: Use functional update
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('key', 'value');
    return next;
  });

Issue 3: Infinite loop in useEffect
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: searchParams object is newly created on every render
Solution: Use primitive values in dependency array
  const query = searchParams.get('q') ?? '';
  useEffect(() => { ... }, [query]); // string

Issue 4: Browser back doesn't work
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: Using router.replace (not added to history)
Solution: Use router.push for filter changes
  replace → Only for real-time updates while typing in search
  push → When confirming a filter

Issue 5: Non-ASCII characters appear garbled
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: Manually using encodeURIComponent / decodeURIComponent
Solution: Use URLSearchParams (auto encode/decode)
  params.set('q', 'Japanese text'); // Auto encoded
  params.get('q'); // 'Japanese text' (auto decoded)

Issue 6: Parameter order changes every time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: URLSearchParams preserves insertion order
Solution: Sort alphabetically with params.sort()
  → Also effective for improving cache hit rate

Issue 7: URL is not updated with nuqs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: Missing NuqsAdapter configuration
Solution: Set up NuqsAdapter in layout.tsx
  import { NuqsAdapter } from 'nuqs/adapters/next/app';

Issue 8: searchParams is undefined in Server Component
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: In Next.js 15+, searchParams was changed to a Promise
Solution: Resolve with await
  const params = await searchParams; // Next.js 15+

Issue 9: API is called every time even for the same filter
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: Using object references in queryKey
Solution: Use primitive values or JSON.stringify in queryKey
  queryKey: ['products', query, page, sort] // OK
  queryKey: ['products', JSON.stringify(filters)] // OK
  queryKey: ['products', filtersObject] // Bad (reference comparison)

Issue 10: URL is not updated in iOS Safari
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cause: iOS Safari History API limit (100 times/30 seconds)
Solution: Add throttle to limit URL update frequency
  → Pay special attention with sliders and real-time input
```

### 11.2 Debugging Techniques

```typescript
// === Debugging URL state ===

// 1. Log the current URL state
function useDebugSearchParams() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group('URL State');
      console.log('URL:', window.location.href);
      console.log('Search:', searchParams.toString());
      console.log('Params:', Object.fromEntries(searchParams.entries()));
      console.groupEnd();
    }
  }, [searchParams]);
}

// 2. Track URL changes
function useTrackURLChanges() {
  const searchParams = useSearchParams();
  const prevRef = useRef(searchParams.toString());

  useEffect(() => {
    const current = searchParams.toString();
    if (prevRef.current !== current) {
      console.log('URL changed:');
      console.log('  Before:', prevRef.current);
      console.log('  After:', current);
      prevRef.current = current;
    }
  }, [searchParams]);
}

// 3. Check URL state in React DevTools
// When using nuqs, you can check the value of each parameter
// in the component tree of React DevTools

// 4. Check History in browser developer tools
// Performance tab → Check Navigation timing
// Application tab → Check History API state
```

---

## FAQ

### Q1: How should URL state and React state be synchronized?
Use the URL as the Single Source of Truth, and use React state only for UI optimization. For real-time input like search fields, manage the intermediate value with local useState and reflect it in the URL after debouncing. When the browser goes back, detect the URL change and sync the local state. Using the nuqs library automates this synchronization, significantly simplifying the implementation.

### Q2: How should search filters be persisted in the URL?
Express single-value filters as ordinary query parameters like `?category=electronics`, and exclude default values from the URL to keep it clean. For multi-value filters (like brand selection), use comma-separated format `?brands=apple,samsung`. Always reset the page number to 1 when a filter changes. Also consider the maximum URL length (browser-dependent, but about 2000 characters), and consider storing an excessive number of parameters in a server-side session.

### Q3: How should URL state be managed with Next.js App Router?
In Server Components, receive URL parameters as `searchParams` props and use them for data fetching. In Client Components, update the URL with `useSearchParams` or nuqs's `useQueryState`. By clearly separating the roles of Server Components and Client Components — Server Components for data fetching, Client Components for URL update operations — you can achieve both performance and UX.

---

## Summary

### URL State Management Selection Matrix

| Criterion | URLSearchParams | useSearchParams | nuqs |
|-----------|----------------|----------------|------|
| Type safety required | - | - | Best |
| Next.js App Router | OK | OK | Best |
| React Router | OK | Best | OK |
| Server Component integration | Manual | Manual | Best |
| Complex filters (10+ params) | Manual | Manual | Best |
| Avoid additional libraries | Best | OK | - |
| Batch updates needed | Manual | Manual | Best |
| Custom parsers needed | Manual | Manual | Best |

### URL State Design Checklist

```
At design time:
□ Identified state to include in URL
□ Designed to exclude default values from URL
□ Unified the format for array parameters
□ Decided on naming conventions for parameter names (snake_case / camelCase)
□ Considered the URL length limit

At implementation time:
□ Using type-safe parsers (nuqs or Zod)
□ Resetting page when filter changes
□ Applying debounce to search input
□ Using push / replace appropriately
□ XSS and Open Redirect countermeasures in place
□ Validation implemented

At test time:
□ Test for state restoration from URL
□ Test for browser back/forward
□ Test for handling invalid URL parameters
□ Test for shared URL behavior
□ Verify filter operations with E2E tests
```

---

## Next Guides to Read

---

## References
1. nuqs. "Type-safe search params state manager for Next.js." github.com/47ng/nuqs, 2024.
2. Next.js. "useSearchParams." nextjs.org/docs/app/api-reference/functions/use-search-params, 2024.
3. React Router. "useSearchParams." reactrouter.com/en/main/hooks/use-search-params, 2024.
4. MDN Web Docs. "URLSearchParams." developer.mozilla.org/en-US/docs/Web/API/URLSearchParams, 2024.
5. Lee Robinson. "Search Params in Next.js." leerob.io, 2024.
6. Web.dev. "URL pattern API." web.dev/articles/urlpattern, 2024.
7. OWASP. "Unvalidated Redirects and Forwards." owasp.org, 2024.
8. Kent C. Dodds. "URL State Management in React." epicreact.dev, 2024.
