# State Management Overview

> State management is the root of complexity in web applications. By understanding the four categories of state — local, global, server, and URL — and selecting the right tool for each, you can achieve simple and maintainable state management.

## Prerequisites

To study this chapter effectively, it is recommended that you acquire the following knowledge in advance:

  - REST API concepts, basic usage of fetch/axios, understanding of asynchronous processing
- **Basic React Hooks**
  - `useState`: Managing local state within a component
  - `useReducer`: Managing more complex state transitions
  - `useEffect`: Handling side effects and cleanup
- **Unidirectional Data Flow**
  - React's declarative UI concept (`UI = f(state)`)
  - Passing props and state lifting
  - State update flow through event handlers

## What You Will Learn

- [ ] Understand the four categories of state
- [ ] Grasp the criteria for selecting the right tool for each category
- [ ] Learn the design principles of state management
- [ ] Be able to design state with performance in mind
- [ ] Avoid common state management anti-patterns in real-world projects
- [ ] Be able to formulate state management strategies for large-scale applications

---

## 1. What Is State?

"State" in a web application refers to the totality of data that determines how the application should behave at any given moment. Whether a button was pressed, whether the user is logged in, what data was returned from an API, what parameters are in the URL — all of these are "state," and the UI is rendered as a function of this state.

```
UI = f(state)

What this equation means:
  - Given the same state, the same UI is rendered
  - When state changes, the UI re-renders
  - UI problems = state problems (the basic debugging approach)

React's basic mental model:
  1. Declare state (useState, useReducer)
  2. Declaratively describe the UI based on state
  3. Update state with event handlers
  4. React detects differences and efficiently updates the DOM

Important distinctions:
  - State: Data that changes over time
  - Constant: Data that does not change → should not be state
  - Derived value: Computable from existing state → should not be state
  - Props: Data passed from the parent → should not be state in child components
```

### 1.1 Why State Management Is Difficult

```
Why state management becomes complex:

  ① Scattered state:
     → The same data is needed across multiple components
     → Difficult to decide where to place it
     → Props Drilling vs Context vs external store

  ② State synchronization:
     → Mismatch between client-side cache and server data
     → State synchronization across multiple tabs
     → Consistency when switching between offline/online

  ③ State normalization:
     → Complexity of updating nested objects
     → The same entity existing in multiple places
     → Partial updates and overall consistency

  ④ Asynchronous state:
     → Managing the three states: loading, error, success
     → Handling multiple competing requests
     → Optimistic updates and rollback

  ⑤ Performance:
     → Unnecessary re-renders occurring
     → Memory leaks (lack of proper cleanup)
     → Management cost of large state trees
```

---

## 2. The Four Categories of State

```
Four state categories:

  ① Local state (UI State):
     → Temporary state specific to a component
     → Modal open/close, form input values, hover state
     → Tools: useState, useReducer
     → Lifecycle: from component mount to unmount

  ② Global state (Client State):
     → State shared across multiple components
     → Theme, language settings, user authentication state
     → Tools: Zustand, Jotai, Context
     → Lifecycle: the entire app's lifetime

  ③ Server state (Server State):
     → Data fetched from an API
     → User lists, product data, order history
     → Tools: TanStack Query, SWR
     → Lifecycle: based on cache expiration

  ④ URL state (URL State):
     → State reflected in the URL
     → Search queries, filters, page numbers, sort order
     → Tools: useSearchParams, nuqs
     → Lifecycle: linked to navigation

Common mistakes:
  ✗ Managing server state with useState
    → Caching, retries, and revalidation all become manual
    → Should be delegated to TanStack Query

  ✗ Placing local state globally
    → Unnecessary re-renders
    → useState is sufficient

  ✗ Managing URL state with useState
    → Not bookmarkable, not shareable
    → Use useSearchParams instead

  ✗ Managing derived values as state
    → A breeding ground for synchronization bugs
    → Should be computed with useMemo

Principle:
  "Manage state in the most local place possible, with the most appropriate tool."
```

### 2.1 State Category Decision Flowchart

```
State category decision flow:

  Q1: Is the data something fetched from an API?
  │
  ├─ Yes → Server state (TanStack Query / SWR)
  │
  └─ No
     │
     Q2: Should it be reflected in the URL? (Do you want to persist it via bookmark/share?)
     │
     ├─ Yes → URL state (useSearchParams / nuqs)
     │
     └─ No
        │
        Q3: Is it shared across multiple components?
        │
        ├─ Yes
        │  │
        │  Q4: How often is it updated?
        │  │
        │  ├─ Low frequency (theme/auth/language) → Context
        │  │
        │  └─ Medium to high frequency → Zustand / Jotai
        │
        └─ No → Local state (useState / useReducer)

Practical judgment examples:

  "Shopping cart contents"
  → Referenced across multiple pages → Global state
  → But if persisted to the server → Server state

  "Search result filter conditions"
  → Want to reflect in URL to enable bookmarking → URL state

  "Data being entered in a form"
  → Only used on that page → Local state

  "Currently logged-in user's information"
  → Fetched from API → Server state (managed with TanStack Query)
  → The authentication token itself → Global state
```

---

## 3. Local State in Depth

### 3.1 useState: The Simplest State Management

```typescript
// useState: the simplest approach
function ToggleButton() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <button onClick={() => setIsOpen(!isOpen)}>
      {isOpen ? 'Close' : 'Open'}
    </button>
  );
}

// Managing form input
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError('Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
      />
      <div className="password-field">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
```

### 3.2 Caveats of useState

```typescript
// ① Understanding batch updates
function Counter() {
  const [count, setCount] = useState(0);

  // NG: referencing a value within the same render cycle
  const handleClick = () => {
    setCount(count + 1);
    setCount(count + 1); // count still holds the old value → result: +1
  };

  // OK: use functional updates to reference the previous value
  const handleClickCorrect = () => {
    setCount((prev) => prev + 1);
    setCount((prev) => prev + 1); // prev is the updated value → result: +2
  };

  return <button onClick={handleClickCorrect}>{count}</button>;
}

// ② Lazy initialization of initial value
function ExpensiveComponent() {
  // NG: computeExpensiveValue() runs on every render
  // (the result is only used on the first render, but the function call happens every time)
  const [value, setValue] = useState(computeExpensiveValue());

  // OK: passing a function runs it only on the first render
  const [value2, setValue2] = useState(() => computeExpensiveValue());

  return <div>{value2}</div>;
}

// ③ Updating object state
function UserProfile() {
  const [user, setUser] = useState({
    name: 'Taro',
    email: 'taro@example.com',
    preferences: {
      theme: 'dark',
      language: 'en',
    },
  });

  // NG: direct mutation (React cannot detect the change)
  const updateThemeBad = () => {
    user.preferences.theme = 'light';
    setUser(user); // same reference → no re-render
  };

  // OK: update immutably
  const updateThemeGood = () => {
    setUser({
      ...user,
      preferences: {
        ...user.preferences,
        theme: 'light',
      },
    });
  };

  return <button onClick={updateThemeGood}>Change Theme</button>;
}
```

### 3.3 useReducer: Complex State Transitions

```typescript
// useReducer: complex state transitions
type State = { count: number; step: number; history: number[] };
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setStep'; step: number }
  | { type: 'reset' }
  | { type: 'undo' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return {
        ...state,
        count: state.count + state.step,
        history: [...state.history, state.count],
      };
    case 'decrement':
      return {
        ...state,
        count: state.count - state.step,
        history: [...state.history, state.count],
      };
    case 'setStep':
      return { ...state, step: action.step };
    case 'reset':
      return { count: 0, step: 1, history: [] };
    case 'undo': {
      const previous = state.history[state.history.length - 1];
      if (previous === undefined) return state;
      return {
        ...state,
        count: previous,
        history: state.history.slice(0, -1),
      };
    }
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, {
    count: 0,
    step: 1,
    history: [],
  });

  return (
    <div>
      <span>{state.count}</span>
      <button onClick={() => dispatch({ type: 'increment' })}>
        +{state.step}
      </button>
      <button onClick={() => dispatch({ type: 'decrement' })}>
        -{state.step}
      </button>
      <button onClick={() => dispatch({ type: 'undo' })}>
        Undo
      </button>
      <button onClick={() => dispatch({ type: 'reset' })}>
        Reset
      </button>
      <input
        type="number"
        value={state.step}
        onChange={(e) =>
          dispatch({ type: 'setStep', step: Number(e.target.value) })
        }
      />
    </div>
  );
}

// When to use useReducer:
// → Three or more related states
// → Complex state transition rules
// → The next state depends on the previous state
// → Undo/Redo is required
// → You want it to be easily testable (reducers are pure functions)
```

### 3.4 Practical Example: Multi-Step Form

```typescript
// State management for a multi-step form
type FormData = {
  // Step 1: Basic information
  firstName: string;
  lastName: string;
  email: string;
  // Step 2: Address
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  // Step 3: Payment
  cardNumber: string;
  expiryDate: string;
  cvv: string;
};

type FormState = {
  currentStep: number;
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  isSubmitting: boolean;
  completedSteps: Set<number>;
};

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormData; value: string }
  | { type: 'SET_ERRORS'; errors: Partial<Record<keyof FormData, string>> }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string };

const initialFormState: FormState = {
  currentStep: 0,
  data: {
    firstName: '',
    lastName: '',
    email: '',
    postalCode: '',
    prefecture: '',
    city: '',
    address: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
  },
  errors: {},
  isSubmitting: false,
  completedSteps: new Set(),
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        data: { ...state.data, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
      };

    case 'SET_ERRORS':
      return { ...state, errors: action.errors };

    case 'NEXT_STEP':
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, 2),
        completedSteps: new Set([
          ...state.completedSteps,
          state.currentStep,
        ]),
      };

    case 'PREV_STEP':
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 0),
      };

    case 'GO_TO_STEP':
      if (action.step <= state.currentStep || state.completedSteps.has(action.step - 1)) {
        return { ...state, currentStep: action.step };
      }
      return state;

    case 'SUBMIT_START':
      return { ...state, isSubmitting: true };

    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false };

    case 'SUBMIT_ERROR':
      return {
        ...state,
        isSubmitting: false,
        errors: { ...state.errors },
      };

    default:
      return state;
  }
}

function MultiStepForm() {
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const { currentStep, data, errors, isSubmitting } = state;

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (step === 0) {
      if (!data.firstName) newErrors.firstName = 'First name is required';
      if (!data.lastName) newErrors.lastName = 'Last name is required';
      if (!data.email) newErrors.email = 'Email is required';
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (step === 1) {
      if (!data.postalCode) newErrors.postalCode = 'Postal code is required';
      if (!data.prefecture) newErrors.prefecture = 'Prefecture is required';
      if (!data.city) newErrors.city = 'City is required';
    }

    if (step === 2) {
      if (!data.cardNumber) newErrors.cardNumber = 'Card number is required';
      if (!data.expiryDate) newErrors.expiryDate = 'Expiry date is required';
      if (!data.cvv) newErrors.cvv = 'CVV is required';
    }

    dispatch({ type: 'SET_ERRORS', errors: newErrors });
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      dispatch({ type: 'NEXT_STEP' });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    dispatch({ type: 'SUBMIT_START' });
    try {
      await submitOrder(data);
      dispatch({ type: 'SUBMIT_SUCCESS' });
    } catch (err) {
      dispatch({ type: 'SUBMIT_ERROR', error: 'Submission failed' });
    }
  };

  return (
    <div>
      <StepIndicator
        currentStep={currentStep}
        completedSteps={state.completedSteps}
        onStepClick={(step) => dispatch({ type: 'GO_TO_STEP', step })}
      />
      {currentStep === 0 && (
        <BasicInfoStep data={data} errors={errors} dispatch={dispatch} />
      )}
      {currentStep === 1 && (
        <AddressStep data={data} errors={errors} dispatch={dispatch} />
      )}
      {currentStep === 2 && (
        <PaymentStep data={data} errors={errors} dispatch={dispatch} />
      )}
      <div className="navigation">
        {currentStep > 0 && (
          <button onClick={() => dispatch({ type: 'PREV_STEP' })}>
            Back
          </button>
        )}
        {currentStep < 2 ? (
          <button onClick={handleNext}>Next</button>
        ) : (
          <button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Place Order'}
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 4. Choosing a Global State Solution

### 4.1 Library Comparison

```
Detailed library comparison:

  Zustand:
  → Simple, minimal boilerplate
  → Store = function (more intuitive than Redux)
  → Accessible from outside React
  → Bundle size: ~1.1kB (gzip)
  → TypeScript support: excellent (natural type inference)
  → DevTools: compatible with Redux DevTools
  → Middleware: persist, devtools, immer, subscribeWithSelector
  → Recommended for: medium-sized and larger apps
  → Learning cost: low

  Jotai:
  → Atom-based (spiritual successor to Recoil)
  → Fine-grained re-render control at the component level
  → Bundle size: ~3.8kB (gzip)
  → TypeScript support: excellent (leverages generics)
  → DevTools: Atoms Inspector in React DevTools
  → Extensions: atomWithStorage, atomWithQuery, atomWithMachine
  → Recommended for: complex UI state management
  → Learning cost: medium

  React Context:
  → Built into React, no additional dependencies
  → Not suitable for frequently changing values (re-render issue)
  → Bundle size: 0kB (built into React)
  → TypeScript support: requires manual type definitions
  → DevTools: viewable in React DevTools
  → Recommended for: low-frequency updates like theme, auth info
  → Learning cost: low

  Redux Toolkit:
  → Most mature ecosystem
  → Excellent DevTools
  → More boilerplate
  → Bundle size: ~12.7kB (gzip)
  → TypeScript support: excellent (RTK has powerful type inference)
  → Middleware: RTK Query, Thunk, Saga, Observable
  → Recommended for: large-scale enterprise apps
  → Learning cost: high

  Valtio:
  → Proxy-based state management
  → Can be written in a mutable style
  → Bundle size: ~3.3kB (gzip)
  → Recommended for: those who prefer a mutable API
  → Learning cost: low

Selection flow:
  Theme/auth/language (low-frequency updates) → Context
  Medium-scale shared state → Zustand
  Fine-grained atom-level control → Jotai
  Large-scale + strict architecture → Redux Toolkit
  Mutable-oriented → Valtio
```

### 4.2 Code Comparison Across Libraries

```typescript
// === The same feature implemented in each library (counter + theme) ===

// --- React Context ---
type ThemeContextType = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  count: number;
  increment: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [count, setCount] = useState(0);

  // Without memoizing value with useMemo, a new object is created on every render,
  // causing all consumers to re-render
  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
      count,
      increment: () => setCount((c) => c + 1),
    }),
    [theme, count]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// Context problem: when count changes, components that only use theme also re-render
function ThemeOnlyComponent() {
  const ctx = useContext(ThemeContext);
  // This component re-renders even when count changes!
  return <div className={ctx?.theme}>Theme only</div>;
}

// --- Zustand ---
import { create } from 'zustand';

interface AppStore {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  count: number;
  increment: () => void;
}

const useAppStore = create<AppStore>((set) => ({
  theme: 'light',
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Zustand: use selectors to get only what you need → minimal re-renders
function ThemeOnlyComponentZustand() {
  const theme = useAppStore((state) => state.theme);
  // This component does NOT re-render when count changes!
  return <div className={theme}>Theme only</div>;
}

// --- Jotai ---
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

const themeAtom = atom<'light' | 'dark'>('light');
const countAtom = atom(0);

// Derived atom
const themeClassAtom = atom((get) => {
  const theme = get(themeAtom);
  return theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-black';
});

function ThemeOnlyComponentJotai() {
  const themeClass = useAtomValue(themeClassAtom);
  // This component does NOT re-render when countAtom changes!
  return <div className={themeClass}>Theme only</div>;
}

function CounterJotai() {
  const [count, setCount] = useAtom(countAtom);
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Count: {count}
    </button>
  );
}
```

### 4.3 Context Re-render Problem and Solutions

```typescript
// Understanding the Context re-render problem

// NG: putting all state in one Context
const AppContext = createContext<{
  user: User | null;
  theme: Theme;
  notifications: Notification[];
  sidebarOpen: boolean;
} | null>(null);

// → When notifications updates, components that only use theme also re-render

// OK: split Context
const UserContext = createContext<User | null>(null);
const ThemeContext = createContext<Theme>('light');
const NotificationContext = createContext<Notification[]>([]);
const SidebarContext = createContext<{
  isOpen: boolean;
  toggle: () => void;
}>({
  isOpen: false,
  toggle: () => {},
});

// Even better: separate state from update functions
const ThemeValueContext = createContext<Theme>('light');
const ThemeDispatchContext = createContext<(theme: Theme) => void>(() => {});

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  return (
    <ThemeValueContext.Provider value={theme}>
      <ThemeDispatchContext.Provider value={setTheme}>
        {children}
      </ThemeDispatchContext.Provider>
    </ThemeValueContext.Provider>
  );
}

// Component that only needs the theme value
function ThemedComponent() {
  const theme = useContext(ThemeValueContext);
  // Does not re-render when setTheme changes
  return <div className={theme}>Theme applied</div>;
}

// Component that only performs theme updates
function ThemeToggle() {
  const setTheme = useContext(ThemeDispatchContext);
  // Does not re-render when the theme value changes
  return <button onClick={() => setTheme('dark')}>Dark Mode</button>;
}
```

---

## 5. Server State Overview

```typescript
// Problems with managing server state using useState
function UserListBad() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUsers()
      .then((data) => {
        if (!cancelled) {
          setUsers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Problems:
  // → No caching (if the same data is needed in another component, it re-fetches)
  // → No automatic revalidation (no way to notice when data becomes stale)
  // → No retry logic
  // → Loading/error state management is manual
  // → No deduplication of requests
  // → Difficult to implement optimistic updates
  // → No Suspense support
  // → No refetch on window focus

  return loading ? <Spinner /> : <UserTable users={users} />;
}

// Achieving the same with TanStack Query
function UserListGood() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // Treat cache as fresh for 5 minutes
    retry: 3,
    refetchOnWindowFocus: true,
  });

  // Features you get automatically:
  // ✓ Caching (fetching with the same queryKey from another component → returns from cache instantly)
  // ✓ Automatic revalidation (re-fetches in the background after staleTime expires)
  // ✓ Retry (automatically retries on failure)
  // ✓ Automatic loading/error state management
  // ✓ Automatic deduplication of requests
  // ✓ Refetch on window focus
  // ✓ Suspense support

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserTable users={users!} />;
}
```

### 5.1 The Unique Nature of Server State

```
How server state fundamentally differs from client state:

  ① Ownership is on the server:
     → What the client holds is merely a "snapshot"
     → Another user may change the data on the server
     → Periodic revalidation is necessary

  ② Fetched asynchronously:
     → A loading state always exists
     → Possibility of network errors
     → Latency considerations

  ③ The concept of caching is required:
     → Fetching the same data multiple times is wasteful
     → But there is the problem of stale cache
     → The stale-while-revalidate pattern

  ④ Optimistic updates are useful:
     → Immediately reflect user actions → improved UX
     → Check consistency after server response
     → Roll back on error

The stale-while-revalidate pattern:
  1. If data exists in cache, return it immediately (stale data)
  2. Fetch the latest data in the background (revalidate)
  3. Once the latest data is fetched, update the cache and reflect it in the UI

  User experience:
  → First time: Loading → data displayed
  → Second time onwards: cache displayed instantly → (background update) → switches to latest data
  → The user feels it "appeared instantly"
```

---

## 6. URL State Overview

```typescript
// Problems with managing URL state using useState
function SearchPageBad() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  // Problems:
  // → Not reflected in URL → not bookmarkable
  // → State is not restored with browser back/forward
  // → Copying and sharing the URL does not reproduce the search conditions
  // → Also disadvantageous for SEO

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} />
      <CategoryFilter value={category} onChange={setCategory} />
      <Pagination page={page} onChange={setPage} />
    </div>
  );
}

// When managed as URL state
function SearchPageGood() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? 'all';
  const page = Number(searchParams.get('page') ?? '1');

  const updateParams = (updates: Record<string, string>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  };

  // Benefits:
  // ✓ URL: /search?q=react&category=books&page=2
  // ✓ Bookmarkable
  // ✓ State restored with browser back/forward
  // ✓ Sharing the URL reproduces the search conditions
  // ✓ Can be used as initial value for SSR/SSG

  return (
    <div>
      <SearchInput
        value={query}
        onChange={(q) => updateParams({ q, page: '1' })}
      />
      <CategoryFilter
        value={category}
        onChange={(c) => updateParams({ category: c, page: '1' })}
      />
      <Pagination
        page={page}
        onChange={(p) => updateParams({ page: String(p) })}
      />
    </div>
  );
}

// More type-safe URL state management with nuqs
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';

function SearchPageNuqs() {
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [category, setCategory] = useQueryState(
    'category',
    parseAsString.withDefault('all')
  );
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  // Benefits of nuqs:
  // ✓ Type-safe (parseAsInteger automatically gives a number type)
  // ✓ Concise default value specification
  // ✓ Deep integration with Next.js App Router
  // ✓ Supports passing initial values from server components
  // ✓ Shallow routing (update URL without navigation)

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} />
      <CategoryFilter value={category} onChange={setCategory} />
      <Pagination page={page} onChange={setPage} />
    </div>
  );
}
```

### 6.1 What Should and Should Not Be URL State

```
What should be URL state:
  ✓ Search queries (?q=react)
  ✓ Filter conditions (?category=books&price=low)
  ✓ Sort order (?sort=price&order=asc)
  ✓ Page number (?page=3)
  ✓ View mode (?view=grid)
  ✓ Tab selection (?tab=settings)
  ✓ Date range (?from=2024-01-01&to=2024-12-31)
  ✓ Currently selected item ID (/items/123)

What should NOT be URL state:
  ✗ Data being entered in a form
  ✗ Modal open/close state (debatable, depends on the case)
  ✗ Hover state, drag state
  ✗ Animation state
  ✗ Authentication tokens
  ✗ Temporary error messages
  ✗ Large amounts of data (URL length limits)

Judgment criteria:
  "If you bookmark this page and open it later,
   should that state be restored?"
  → Yes → URL state
  → No → Local or global state
```

---

## 7. Design Principles

### 7.1 Minimizing State

```typescript
// Principle ①: Minimize state — do not make computable values into state

// NG: redundant state
function CartBad() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);     // computable from items
  const [itemCount, setItemCount] = useState(0);        // computable from items
  const [isEmpty, setIsEmpty] = useState(true);          // computable from items

  // Every time items is updated, the other three must also be synchronized → breeding ground for bugs
  const addItem = (item: CartItem) => {
    const newItems = [...items, item];
    setItems(newItems);
    setTotalPrice(newItems.reduce((sum, i) => sum + i.price * i.quantity, 0));
    setItemCount(newItems.reduce((sum, i) => sum + i.quantity, 0));
    setIsEmpty(false);
    // Forgetting to update even one causes inconsistency
  };

  return <div>{totalPrice}</div>;
}

// OK: derive from a single state
function CartGood() {
  const [items, setItems] = useState<CartItem[]>([]);

  // Derived values: computed with useMemo (only recalculated when items changes)
  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items]
  );
  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );
  const isEmpty = items.length === 0; // Light computation doesn't need useMemo

  const addItem = (item: CartItem) => {
    setItems((prev) => [...prev, item]);
    // totalPrice, itemCount are automatically recalculated → no inconsistency
  };

  return <div>{totalPrice}</div>;
}
```

### 7.2 Derived State

```typescript
// Principle ②: Derived State

// NG: redundant state that requires synchronization
function ProductListBad() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [sortedProducts, setSortedProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');

  // Whenever products, filter, or sortBy changes,
  // filteredProducts and sortedProducts must be updated manually
  useEffect(() => {
    const filtered = products.filter((p) =>
      p.name.toLowerCase().includes(filter.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [products, filter]);

  useEffect(() => {
    const sorted = [...filteredProducts].sort((a, b) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name)
        : a.price - b.price
    );
    setSortedProducts(sorted);
  }, [filteredProducts, sortBy]);
  // Problem: chained useEffects → hard to understand, prone to bugs

  return <ProductGrid products={sortedProducts} />;
}

// OK: compute as derived values
function ProductListGood() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');

  // Only three state values. Display data is obtained by computation.
  const displayProducts = useMemo(() => {
    return products
      .filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) =>
        sortBy === 'name'
          ? a.name.localeCompare(b.name)
          : a.price - b.price
      );
  }, [products, filter, sortBy]);

  return <ProductGrid products={displayProducts} />;
}
```

### 7.3 Colocate State

```typescript
// Principle ③: Colocate State (place state close to where it is used)

// NG: state unnecessarily made global
// store.ts
const useStore = create<{
  modalOpen: boolean;           // ← only used by one component
  tooltipText: string;          // ← only used by one component
  dropdownItems: string[];      // ← only used by one component
  searchQuery: string;          // ← actually needs to be shared
  user: User | null;            // ← actually needs to be shared
}>((set) => ({
  // ...
}));

// OK: what should be local stays local
function Modal() {
  const [isOpen, setIsOpen] = useState(false); // local is sufficient
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      {isOpen && <ModalDialog onClose={() => setIsOpen(false)} />}
    </>
  );
}

// Only put what truly needs to be shared in the global store
const useStore = create<{
  searchQuery: string;
  user: User | null;
}>((set) => ({
  searchQuery: '',
  user: null,
}));
```

### 7.4 Props Drilling and Composition

```typescript
// Principle ④: Acceptable range of Props Drilling and alternatives

// Props Drilling: 2-3 levels is acceptable
function App() {
  const [user, setUser] = useState<User | null>(null);
  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: User | null }) {
  return <Header user={user} />;
}

function Header({ user }: { user: User | null }) {
  return <UserMenu user={user} />;
}

// For 4 or more levels → solve with composition
// Composition pattern: use children to "skip" intermediate components
function App() {
  const [user, setUser] = useState<User | null>(null);
  return (
    <Dashboard>
      <Header>
        <UserMenu user={user} />
      </Header>
    </Dashboard>
  );
}

function Dashboard({ children }: { children: React.ReactNode }) {
  return <div className="dashboard">{children}</div>;
}

function Header({ children }: { children: React.ReactNode }) {
  return <header>{children}</header>;
}

// → Dashboard and Header don't need to know about user
// → Only UserMenu receives user
// → Props Drilling is eliminated
```

### 7.5 Single Source of Truth

```typescript
// Principle ⑤: Single Source of Truth

// NG: managing the same user data in multiple places
function App() {
  // For header display
  const [headerUser, setHeaderUser] = useState<User | null>(null);
  // For profile page
  const [profileUser, setProfileUser] = useState<User | null>(null);
  // For settings page
  const [settingsUser, setSettingsUser] = useState<User | null>(null);
  // → Updating one and forgetting another causes inconsistency

  return <div>...</div>;
}

// OK: centralize server data management with TanStack Query
function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
  });
}

// Any component calling this references the same cache
function Header() {
  const { data: user } = useCurrentUser();
  return <div>{user?.name}</div>;
}

function ProfilePage() {
  const { data: user } = useCurrentUser();
  return <div>{user?.email}</div>;
}

function SettingsPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();

  const updateUser = async (data: Partial<User>) => {
    await api.updateUser(data);
    // Invalidate cache → all components get the latest data
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });
  };

  return <UserSettingsForm user={user!} onSave={updateUser} />;
}
```

### 7.6 Immutability

```typescript
// Principle ⑥: Immutability

// NG: direct mutation
function TodoListBad() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const toggleTodo = (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed; // direct mutation!
      setTodos([...todos]); // spreading creates a new array but the original object is already mutated
    }
  };

  return <div>{/* ... */}</div>;
}

// OK: update immutably
function TodoListGood() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const addTodo = (text: string) => {
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, completed: false },
    ]);
  };

  const removeTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  return <div>{/* ... */}</div>;
}

// Use Immer for deeply nested state
import { produce } from 'immer';

function NestedStateUpdate() {
  const [state, setState] = useState({
    users: {
      byId: {
        '1': {
          name: 'Taro',
          address: {
            city: 'Tokyo',
            zip: '100-0001',
          },
        },
      },
    },
  });

  // Without Immer: a cascade of spreads
  const updateCityManual = () => {
    setState({
      ...state,
      users: {
        ...state.users,
        byId: {
          ...state.users.byId,
          '1': {
            ...state.users.byId['1'],
            address: {
              ...state.users.byId['1'].address,
              city: 'Osaka',
            },
          },
        },
      },
    });
  };

  // With Immer: intuitive syntax
  const updateCityImmer = () => {
    setState(
      produce((draft) => {
        draft.users.byId['1'].address.city = 'Osaka';
      })
    );
  };

  return <div>{/* ... */}</div>;
}
```

---

## 8. Performance Optimization

### 8.1 Understanding Re-renders

```typescript
// Conditions that trigger React re-renders:
// 1. state changes
// 2. props change
// 3. The parent component re-renders
// 4. The context value changes

// Re-render optimization techniques

// ① React.memo: skip re-render if props haven't changed
const ExpensiveList = React.memo(function ExpensiveList({
  items,
}: {
  items: Item[];
}) {
  console.log('ExpensiveList rendered');
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});

// ② useMemo: memoize computation results
function Dashboard({ orders }: { orders: Order[] }) {
  // Recalculate only when orders changes
  const stats = useMemo(() => {
    return {
      total: orders.length,
      revenue: orders.reduce((sum, o) => sum + o.total, 0),
      averageOrder: orders.reduce((sum, o) => sum + o.total, 0) / orders.length,
      byStatus: orders.reduce(
        (acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }, [orders]);

  return (
    <div>
      <StatCard title="Total Orders" value={stats.total} />
      <StatCard title="Revenue" value={stats.revenue} />
      <StatCard title="Average Order Value" value={stats.averageOrder} />
    </div>
  );
}

// ③ useCallback: memoize callbacks
function ParentComponent() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  // Without useCallback: a new function is generated every time text changes
  // → ChildComponent re-renders even with React.memo
  const handleClickBad = () => {
    setCount((c) => c + 1);
  };

  // With useCallback: a new function is created only when count changes
  const handleClickGood = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <MemoizedChild onClick={handleClickGood} count={count} />
    </div>
  );
}

const MemoizedChild = React.memo(function Child({
  onClick,
  count,
}: {
  onClick: () => void;
  count: number;
}) {
  console.log('Child rendered');
  return <button onClick={onClick}>Count: {count}</button>;
});
```

### 8.2 State Structure and Performance

```typescript
// The impact of state structure on performance

// NG: a flat large array → any single change re-renders the whole thing
function BigListBad() {
  const [items, setItems] = useState<Item[]>(generateItems(10000));

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
    // Maps over the entire array of 10,000 elements to create a new array
    // → items is a new reference → the entire list re-renders
  };

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} onClick={() => toggleItem(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}

// OK: normalized data structure + React.memo
function BigListGood() {
  const [itemsById, setItemsById] = useState<Record<string, Item>>({});
  const [itemIds, setItemIds] = useState<string[]>([]);

  const toggleItem = useCallback((id: string) => {
    setItemsById((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id].selected },
    }));
    // Only the changed item gets a new object
  }, []);

  return (
    <ul>
      {itemIds.map((id) => (
        <MemoizedItem
          key={id}
          id={id}
          item={itemsById[id]}
          onToggle={toggleItem}
        />
      ))}
    </ul>
  );
}

const MemoizedItem = React.memo(function ItemRow({
  id,
  item,
  onToggle,
}: {
  id: string;
  item: Item;
  onToggle: (id: string) => void;
}) {
  return (
    <li onClick={() => onToggle(id)}>
      {item.name} {item.selected ? '✓' : ''}
    </li>
  );
});
// → Only the changed item re-renders
```

### 8.3 Virtualization

```typescript
// Performance measure for large lists: virtualization
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated height of each row (px)
    overscan: 5, // Number of rows to render outside the viewport
  });

  return (
    <div
      ref={parentRef}
      style={{ height: '400px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
  // Even with 10,000 items, only what is visible (+ overscan) is rendered
  // → Dramatically reduces DOM node count
}
```

---

## 9. State Management Architecture in Practice

### 9.1 Small-Scale Apps (~10 pages)

```
Recommended setup:
  - Local state: useState / useReducer
  - Server state: TanStack Query
  - URL state: useSearchParams
  - Global state: React Context (only when needed)

Directory structure:
  src/
  ├── components/
  │   ├── Header.tsx          // local state only
  │   └── SearchForm.tsx      // local + URL state
  ├── hooks/
  │   ├── useUsers.ts         // TanStack Query
  │   └── useAuth.ts          // TanStack Query + Context
  ├── contexts/
  │   └── AuthContext.tsx      // authentication state
  └── pages/
      └── UsersPage.tsx       // URL state + server state

Characteristics:
  → Only additional library is TanStack Query
  → Context limited to 1-2 uses (auth, theme, etc.)
  → Simple with low learning cost
```

### 9.2 Medium-Scale Apps (10-50 pages)

```
Recommended setup:
  - Local state: useState / useReducer
  - Server state: TanStack Query
  - URL state: nuqs
  - Global state: Zustand

Directory structure:
  src/
  ├── components/
  ├── hooks/
  │   ├── queries/            // TanStack Query custom hooks
  │   │   ├── useUsers.ts
  │   │   ├── useProducts.ts
  │   │   └── useOrders.ts
  │   └── mutations/          // TanStack Query mutations
  │       ├── useCreateUser.ts
  │       └── useUpdateProduct.ts
  ├── stores/                 // Zustand stores
  │   ├── useUIStore.ts       // UI state (sidebar, modal, etc.)
  │   ├── useCartStore.ts     // cart state
  │   └── usePreferenceStore.ts  // user preferences
  └── pages/

Characteristics:
  → Efficiently manage client state with Zustand
  → Centralize server state management with TanStack Query
  → Type-safe URL state management with nuqs
  → Clear separation of responsibilities
```

### 9.3 Large-Scale Apps (50+ pages)

```
Recommended setup:
  - Local state: useState / useReducer
  - Server state: TanStack Query
  - URL state: nuqs
  - Global state: Zustand (split by domain)
  - Form state: React Hook Form + Zod

Directory structure:
  src/
  ├── features/               // module split by feature
  │   ├── auth/
  │   │   ├── hooks/
  │   │   │   ├── useLogin.ts
  │   │   │   └── useCurrentUser.ts
  │   │   ├── stores/
  │   │   │   └── useAuthStore.ts
  │   │   └── components/
  │   ├── products/
  │   │   ├── hooks/
  │   │   │   ├── queries/
  │   │   │   └── mutations/
  │   │   ├── stores/
  │   │   └── components/
  │   └── orders/
  │       ├── hooks/
  │       ├── stores/
  │       └── components/
  ├── shared/
  │   ├── stores/             // state shared across the entire app
  │   │   └── useUIStore.ts
  │   └── hooks/
  │       └── useSearchParams.ts
  └── lib/
      ├── queryClient.ts      // TanStack Query configuration
      └── api.ts              // API client

Characteristics:
  → Feature-based module split for clear responsibilities
  → Each feature has its own store, hooks, and components
  → Shared state is centralized in shared/
  → Minimizes conflicts in team development
```

### 9.4 Collection of State Management Implementation Patterns

```typescript
// Pattern 1: encapsulate state logic in a custom hook
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse } as const;
}

// Usage example
function Sidebar() {
  const { value: isOpen, toggle, setFalse: close } = useToggle(false);
  return (
    <>
      <button onClick={toggle}>Menu</button>
      {isOpen && <SidebarContent onClose={close} />}
    </>
  );
}

// Pattern 2: domain-specific state management with useReducer + Context
type CartState = {
  items: CartItem[];
  discount: number;
};

type CartAction =
  | { type: 'ADD_ITEM'; item: Product; quantity: number }
  | { type: 'REMOVE_ITEM'; productId: string }
  | { type: 'UPDATE_QUANTITY'; productId: string; quantity: number }
  | { type: 'APPLY_DISCOUNT'; code: string; discount: number }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(
        (i) => i.productId === action.item.id
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.productId === action.item.id
              ? { ...i, quantity: i.quantity + action.quantity }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            productId: action.item.id,
            name: action.item.name,
            price: action.item.price,
            quantity: action.quantity,
          },
        ],
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.productId !== action.productId),
      };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: action.quantity }
            : i
        ),
      };
    case 'APPLY_DISCOUNT':
      return { ...state, discount: action.discount };
    case 'CLEAR':
      return { items: [], discount: 0 };
  }
}

// Pattern 3: Zustand slice pattern
interface UserSlice {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

interface UISlice {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

interface NotificationSlice {
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

// Combine slices
type AppStore = UserSlice & UISlice & NotificationSlice;

const useAppStore = create<AppStore>()((...a) => ({
  ...createUserSlice(...a),
  ...createUISlice(...a),
  ...createNotificationSlice(...a),
}));

// Each slice is defined in a separate file
// stores/userSlice.ts
const createUserSlice: StateCreator<AppStore, [], [], UserSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
});

// stores/uiSlice.ts
const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  sidebarOpen: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  theme: 'light',
  setTheme: (theme) => set({ theme }),
});
```

---

## 10. React 19 and the Evolution of State Management

### 10.1 useActionState (formerly useFormState)

```typescript
// React 19's useActionState
import { useActionState } from 'react';

type FormState = {
  error: string | null;
  success: boolean;
};

async function submitAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    await login(email, password);
    return { error: null, success: true };
  } catch (err) {
    return { error: 'Login failed', success: false };
  }
}

function LoginForm() {
  const [state, action, isPending] = useActionState(submitAction, {
    error: null,
    success: false,
  });

  return (
    <form action={action}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      {state.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### 10.2 useOptimistic

```typescript
// React 19's useOptimistic
import { useOptimistic, useTransition } from 'react';

function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  );
  const [isPending, startTransition] = useTransition();

  const addTodo = async (text: string) => {
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text,
      completed: false,
    };

    startTransition(async () => {
      // Optimistically update the UI (displayed immediately)
      addOptimisticTodo(newTodo);
      // Send to server
      const savedTodo = await api.createTodo(newTodo);
      // Replace with actual data from server response
      setTodos((prev) => [...prev, savedTodo]);
    });
  };

  return (
    <div>
      <AddTodoForm onAdd={addTodo} />
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 10.3 The use() Hook

```typescript
// React 19's use() hook
import { use, Suspense } from 'react';

// Read a Promise directly
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);
  // Suspense automatically handles the Loading state
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

function App() {
  const userPromise = fetchUser(1); // Pass the Promise (don't await it)
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}

// Read Context conditionally (use can be called inside if statements)
function ConditionalTheme({ useTheme }: { useTheme: boolean }) {
  // Traditional useContext could only be called at the top level
  // use() can be used inside conditionals
  if (useTheme) {
    const theme = use(ThemeContext);
    return <div className={theme}>Theme applied</div>;
  }
  return <div>Default</div>;
}
```

---

## 11. Testing Strategy

### 11.1 Testing State Management

```typescript
// Testing useReducer (easy because it's a pure function)
describe('formReducer', () => {
  const initialState: FormState = {
    currentStep: 0,
    data: { firstName: '', lastName: '', email: '' },
    errors: {},
    isSubmitting: false,
  };

  it('should update a field', () => {
    const result = formReducer(initialState, {
      type: 'UPDATE_FIELD',
      field: 'firstName',
      value: 'Taro',
    });
    expect(result.data.firstName).toBe('Taro');
    // Also verify that the error is cleared
    expect(result.errors.firstName).toBeUndefined();
  });

  it('should advance to next step', () => {
    const result = formReducer(initialState, { type: 'NEXT_STEP' });
    expect(result.currentStep).toBe(1);
  });

  it('should not go below step 0', () => {
    const result = formReducer(initialState, { type: 'PREV_STEP' });
    expect(result.currentStep).toBe(0);
  });
});

// Testing Zustand store
import { act, renderHook } from '@testing-library/react';

describe('useCartStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useCartStore.setState({ items: [], discount: 0 });
  });

  it('should add an item to the cart', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem({
        id: '1',
        name: 'Test Product',
        price: 1000,
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].name).toBe('Test Product');
  });

  it('should calculate total correctly', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem({ id: '1', name: 'Product A', price: 1000 });
      result.current.addItem({ id: '2', name: 'Product B', price: 2000 });
    });

    expect(result.current.total).toBe(3000);
  });
});

// Testing TanStack Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

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
  it('should fetch users successfully', async () => {
    // Mock API with MSW
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json([
          { id: '1', name: 'Taro' },
          { id: '2', name: 'Hanako' },
        ]);
      })
    );

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    // Initial state: loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data fetch to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('Taro');
  });
});
```

---

## 12. Common Anti-Patterns and Solutions

### 12.1 State Synchronization via useEffect

```typescript
// Anti-pattern ①: synchronizing state with useEffect

// NG: copying props into state
function UserProfile({ user }: { user: User }) {
  const [name, setName] = useState(user.name);

  // Updating state when props change...
  useEffect(() => {
    setName(user.name);
  }, [user.name]);
  // → One frame delay, unnecessary re-renders

  return <div>{name}</div>;
}

// OK: use key to reset the component
function UserProfilePage({ userId }: { userId: string }) {
  return <EditableUserProfile key={userId} userId={userId} />;
}

function EditableUserProfile({ userId }: { userId: string }) {
  const { data: user } = useUser(userId);
  const [name, setName] = useState(user?.name ?? '');
  // When key changes, the entire component remounts and state is reset
  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}

// Anti-pattern ②: chaining useEffects
// NG: "useEffect → setState → another useEffect → setState ..."
function FilteredListBad() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('');
  const [filtered, setFiltered] = useState<Item[]>([]);
  const [sorted, setSorted] = useState<Item[]>([]);

  useEffect(() => {
    setFiltered(items.filter((i) => i.name.includes(filter)));
  }, [items, filter]);

  useEffect(() => {
    setSorted([...filtered].sort((a, b) => a.name.localeCompare(b.name)));
  }, [filtered]);
  // → 3 renders occur (items change → filtered change → sorted change)

  return <List items={sorted} />;
}

// OK: compute synchronously with useMemo
function FilteredListGood() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('');

  const displayItems = useMemo(() => {
    return items
      .filter((i) => i.name.includes(filter))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, filter]);
  // → Completes in a single render

  return <List items={displayItems} />;
}
```

### 12.2 Bloated Global Store

```typescript
// Anti-pattern ③: putting everything in the global store

// NG: one massive store
const useMegaStore = create<{
  // UI state
  sidebarOpen: boolean;
  modalOpen: boolean;
  activeTab: string;
  tooltipText: string;
  dropdownOpen: boolean;
  // User state
  user: User | null;
  isAuthenticated: boolean;
  // Product state
  products: Product[];
  selectedProduct: Product | null;
  // Cart state
  cartItems: CartItem[];
  cartTotal: number;
  // Search state
  searchQuery: string;
  searchResults: Product[];
  // Notification state
  notifications: Notification[];
  // ... 50+ properties
}>((set) => ({
  // ... enormous action definitions
}));

// OK: split by concern
const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  get total() {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  },
}));

// Delegate server data to TanStack Query (don't put it in the store)
function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: fetchProducts });
}
```

### 12.3 Holding Unnecessary State

```typescript
// Anti-pattern ④: copying props into state

// NG
function UserCard({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  // → Changes to user.name or user.email will not be reflected
  //   (used only once as the initial value)

  return (
    <div>
      <p>{name}</p>
      <p>{email}</p>
    </div>
  );
}

// OK: use props directly
function UserCard({ user }: { user: User }) {
  return (
    <div>
      <p>{user.name}</p>
      <p>{user.email}</p>
    </div>
  );
}

// When editing is needed, only make the edited value state
function EditableUserCard({ user, onSave }: {
  user: User;
  onSave: (data: Partial<User>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const startEditing = () => {
    setEditName(user.name); // Set initial value when editing starts
    setIsEditing(true);
  };

  const save = () => {
    onSave({ name: editName });
    setIsEditing(false);
  };

  return (
    <div>
      {isEditing ? (
        <>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <button onClick={save}>Save</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </>
      ) : (
        <>
          <p>{user.name}</p>
          <button onClick={startEditing}>Edit</button>
        </>
      )}
    </div>
  );
}
```

---

## 13. State Management Checklist

```
State management checklist at project start:

  □ Have you categorized your state?
    - Four categories: local, global, server, URL
  □ Are you using TanStack Query / SWR for server state?
    - Data fetching with useState + useEffect is NG
  □ Are you using URL state appropriately?
    - State that should be bookmarkable/shareable should go in the URL
  □ Is global state truly necessary?
    - Are you globalizing things that could be local?
  □ Are you making derived values into state?
    - Values computable from existing state should use useMemo
  □ Are re-render optimizations appropriate?
    - Context splitting, selectors, React.memo
  □ Is the design testable?
    - Reducers are pure functions, stores are resettable
  □ Is it type-safe with TypeScript?
    - Are you avoiding any, leveraging discriminated unions?

State management checkpoints during code review:
  □ Are you synchronizing state with useEffect? → Use useMemo / derived values instead
  □ Are you copying props into useState? → Use them directly or reset with key
  □ Is the global store bloating? → Split it
  □ Is the same data managed in multiple places? → Single Source of Truth
  □ Is immutability maintained? → Immer or spread operators
  □ Is memoization appropriate? → But also avoid excessive memoization
```

---

## 14. History and Evolution of State Management Libraries

```
History of React state management libraries:

  2014: Flux (proposed by Facebook)
  → Popularized the concept of unidirectional data flow
  → Multiple implementations (Fluxxor, Alt, Reflux, etc.)

  2015: Redux (Dan Abramov)
  → Unified Flux implementations
  → Single store, pure reducers, immutability
  → Became the de facto standard in the React ecosystem
  → Criticized for excessive boilerplate

  2016-2018: MobX
  → Automatically tracks state changes with the Observable pattern
  → Less boilerplate
  → Also criticized for too much "magic"

  2019: Redux Toolkit
  → Dramatically reduced Redux boilerplate
  → createSlice, createAsyncThunk
  → Became the officially recommended way to write Redux

  2020: Recoil (experimental by Facebook)
  → Atom-based state management
  → Designed with React concurrent features in mind
  → Maintenance stagnating as of 2025

  2020: React Query (TanStack Query)
  → Revolutionarily simplified server state management
  → Spread the awareness that "server state is not client state"

  2021: Zustand
  → Simple, lightweight, minimal boilerplate
  → Accessible from outside React
  → Rapidly growing market share

  2021: Jotai
  → Simplifies the Recoil concept
  → Atom-based, TypeScript-first
  → pmndrs (same developer group as Zustand)

  2022-2024: The Server Component era
  → Next.js App Router / React Server Components
  → Fetch data on the server → reduces the need for client state
  → Identifying "what truly needs to be managed on the client" becomes critical

  2024-2026: Current trends
  → Lightweight libraries (Zustand, Jotai) dominate
  → TanStack Query is the de facto standard for server state management
  → Growing interest in URL state management (nuqs, etc.)
  → React 19's new hooks (useActionState, useOptimistic, use)
  → Interest in signals (Preact Signals, Angular Signals)
```

---

## Summary

| Category | Examples | Recommended Tools | Reason for Selection |
|---------|-----|-----------|---------|
| Local | Modal open/close, input values | useState, useReducer | Built into React, no additional dependencies |
| Global | Theme, authentication | Zustand, Context | Lightweight, simple, type-safe |
| Server | API data | TanStack Query | Automatic caching, revalidation, retry |
| URL | Search, filters | useSearchParams, nuqs | Bookmarkable, shareable, SEO-friendly |
| Form | Validation | React Hook Form + Zod | Performance, type-safe |

### The Golden Rules of State Management

```
1. "Manage state in the most local place possible, with the most appropriate tool."

2. "Keep state minimal. Do not make computable values into state."

3. "Manage server data as server state."

4. "Manage what should be in the URL as URL state."

5. "Global state is a last resort. Start local, then try composition."

6. "Maintain a Single Source of Truth."

7. "Maintain immutability. Never mutate directly."

8. "Design for testability."
```

---
