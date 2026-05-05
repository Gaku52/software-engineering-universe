# Zustand / Jotai

> Zustand is a store-based lightweight state management library, and Jotai is an atom-based bottom-up state management library. Understand each library's mental model, implementation patterns, and selection criteria to choose the best tool for your project.

## Prerequisites

To study this chapter effectively, it is recommended that you acquire the following knowledge in advance:

  - Understanding of the 4 state categories (local, global, server, URL) and when to use global state
  - Principles of state minimization and Single Source of Truth
- **React Hooks fundamentals**
  - How to use `useState`, `useReducer`, and `useContext`
  - Basics of optimization with `useMemo` and `useCallback`
  - How to create custom hooks
- **Immutable update patterns**
  - Object spread syntax (`{ ...obj, key: value }`)
  - Non-destructive array updates (map, filter, slice)
  - The concept of the Immer library (immutable updates with mutable-style syntax)

## Learning Objectives

- [ ] Understand Zustand store design and middleware
- [ ] Understand Jotai atom design and derived atoms
- [ ] Learn the criteria for choosing between the two
- [ ] Master advanced patterns for real-world use
- [ ] Understand testing strategies
- [ ] Learn performance optimization techniques

---

## 1. Zustand Basics

### 1.1 Basic Store Definition

```typescript
// Zustand: ultra-simple store-based state management
import { create } from 'zustand';

// --- Basic store ---
interface CounterStore {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  incrementBy: (amount: number) => void;
}

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
  incrementBy: (amount) => set((state) => ({ count: state.count + amount })),
}));

// Usage (select only the needed properties → minimal re-renders)
function Counter() {
  const count = useCounterStore((state) => state.count);
  const increment = useCounterStore((state) => state.increment);
  return <button onClick={increment}>{count}</button>;
}

// When retrieving multiple values at once
function CounterDisplay() {
  // Optimize re-renders for objects using shallow comparison
  const { count, increment, decrement } = useCounterStore(
    useShallow((state) => ({
      count: state.count,
      increment: state.increment,
      decrement: state.decrement,
    }))
  );

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
```

### 1.2 Understanding set and get in Detail

```typescript
// The create callback receives three arguments: set, get, and api
const useStore = create<MyStore>((set, get, api) => ({
  // === Using set ===

  // ① Pass an object (partial merge)
  setName: (name: string) => set({ name }),
  // → Other properties are preserved (equivalent to Object.assign)

  // ② Pass a function (update based on previous state)
  increment: () => set((state) => ({ count: state.count + 1 })),

  // ③ replace flag (replace the entire state)
  resetAll: () =>
    set(
      { count: 0, name: '', items: [] },
      true // 2nd argument: replace = true (replaces instead of merging)
    ),

  // === Using get ===
  // Synchronously retrieve the current store state
  doubleCount: () => get().count * 2,

  // Call other actions
  incrementAndLog: () => {
    get().increment();
    console.log('New count:', get().count);
  },

  // Reference state in async operations
  saveToServer: async () => {
    const { items, name } = get();
    await api.save({ items, name });
    set({ lastSaved: new Date() });
  },

  // === Using api ===
  // api.getState() = same as get
  // api.setState() = same as set
  // api.subscribe() = register a listener for state changes
  // api.getInitialState() = get the initial state
}));
```

### 1.3 Selector Best Practices

```typescript
interface TodoStore {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  setFilter: (filter: 'all' | 'active' | 'completed') => void;
}

const useTodoStore = create<TodoStore>((set) => ({
  todos: [],
  filter: 'all',
  addTodo: (text) =>
    set((state) => ({
      todos: [
        ...state.todos,
        { id: crypto.randomUUID(), text, completed: false },
      ],
    })),
  toggleTodo: (id) =>
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ),
    })),
  setFilter: (filter) => set({ filter }),
}));

// BAD: Creates a new object every render → always re-renders
function TodoListBad() {
  // A new object is returned every time, causing constant re-renders
  const { todos, filter } = useTodoStore((state) => ({
    todos: state.todos,
    filter: state.filter,
  }));
  // ...
}

// GOOD: Use useShallow
import { useShallow } from 'zustand/react/shallow';

function TodoListGood() {
  const { todos, filter } = useTodoStore(
    useShallow((state) => ({
      todos: state.todos,
      filter: state.filter,
    }))
  );
  // → Re-renders only when the actual value changes
}

// GOOD: Select individually
function TodoFilter() {
  const filter = useTodoStore((state) => state.filter);
  const setFilter = useTodoStore((state) => state.setFilter);
  // → Does not re-render when todos changes
  return (
    <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
      <option value="all">All</option>
      <option value="active">Active</option>
      <option value="completed">Completed</option>
    </select>
  );
}

// Define computed values as selectors outside the store
const selectFilteredTodos = (state: TodoStore) => {
  const { todos, filter } = state;
  switch (filter) {
    case 'active':
      return todos.filter((t) => !t.completed);
    case 'completed':
      return todos.filter((t) => t.completed);
    default:
      return todos;
  }
};

function FilteredTodoList() {
  // Note: this pattern returns a new array every time, causing re-renders
  // Combine with useMemo if performance becomes an issue
  const filteredTodos = useTodoStore(selectFilteredTodos);
  return (
    <ul>
      {filteredTodos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

---

## 2. Zustand Practical Patterns

### 2.1 Auth Store

```typescript
// --- Practical store (authentication) ---
interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.auth.login(email, password);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
      // Set the token on the HTTP client
      apiClient.setAuthToken(response.token);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    apiClient.clearAuthToken();
    // Cleanup after logout
    queryClient.clear();
  },

  refreshToken: async () => {
    const currentToken = get().token;
    if (!currentToken) return;

    try {
      const { token } = await api.auth.refresh(currentToken);
      set({ token });
      apiClient.setAuthToken(token);
    } catch {
      // Refresh failed → logout
      get().logout();
    }
  },

  clearError: () => set({ error: null }),
}));

// Usage from outside React (e.g., API interceptors)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { refreshToken, logout } = useAuthStore.getState();
      try {
        await refreshToken();
        // Retry
        return apiClient.request(error.config);
      } catch {
        logout();
      }
    }
    return Promise.reject(error);
  }
);
```

### 2.2 Cart Store (with Middleware)

```typescript
// --- Middleware ---
import { persist, devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  // Computed properties (used like getters)
  totalItems: () => number;
  totalPrice: () => number;
}

const useCartStore = create<CartStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          items: [],

          addItem: (product: Product) =>
            set((state) => {
              const existing = state.items.find(
                (i) => i.productId === product.id
              );
              if (existing) {
                existing.quantity += 1;
              } else {
                state.items.push({
                  productId: product.id,
                  name: product.name,
                  price: product.price,
                  quantity: 1,
                  image: product.image,
                });
              }
            }),

          removeItem: (productId: string) =>
            set((state) => {
              state.items = state.items.filter(
                (i) => i.productId !== productId
              );
            }),

          updateQuantity: (productId: string, quantity: number) =>
            set((state) => {
              const item = state.items.find(
                (i) => i.productId === productId
              );
              if (item) {
                if (quantity <= 0) {
                  state.items = state.items.filter(
                    (i) => i.productId !== productId
                  );
                } else {
                  item.quantity = quantity;
                }
              }
            }),

          clearCart: () => set({ items: [] }),

          totalItems: () =>
            get().items.reduce((sum, item) => sum + item.quantity, 0),

          totalPrice: () =>
            get().items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            ),
        }))
      ),
      {
        name: 'cart-storage', // localStorage key
        // Persist only some fields
        partialize: (state) => ({ items: state.items }),
        // Custom storage (sessionStorage, etc.)
        // storage: createJSONStorage(() => sessionStorage),
        // Version management (migrations)
        version: 1,
        migrate: (persistedState, version) => {
          if (version === 0) {
            // Migration from v0 → v1
            return {
              ...(persistedState as any),
              items: (persistedState as any).items.map((item: any) => ({
                ...item,
                image: item.image ?? '/placeholder.png',
              })),
            };
          }
          return persistedState as CartStore;
        },
      }
    ),
    { name: 'CartStore' } // Name displayed in Redux DevTools
  )
);

// Monitor specific state changes with subscribeWithSelector
useCartStore.subscribe(
  (state) => state.items.length,
  (itemCount, prevItemCount) => {
    if (itemCount > prevItemCount) {
      toast.success('Item added to cart');
    }
  }
);
```

### 2.3 UI Store

```typescript
// A store that consolidates UI-related state
interface UIStore {
  // Sidebar
  sidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;

  // Modal
  activeModal: string | null;
  modalData: Record<string, unknown>;
  openModal: (id: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Breadcrumbs
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
}

const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Sidebar
      sidebarOpen: true,
      sidebarWidth: 240,
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      // Modal
      activeModal: null,
      modalData: {},
      openModal: (id, data = {}) =>
        set({ activeModal: id, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: {} }),

      // Toast notifications
      toasts: [],
      addToast: (toast) => {
        const id = crypto.randomUUID();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        // Auto-remove
        if (toast.duration !== Infinity) {
          setTimeout(() => {
            get().removeToast(id);
          }, toast.duration ?? 5000);
        }
      },
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Breadcrumbs
      breadcrumbs: [],
      setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
    }),
    {
      name: 'ui-preferences',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
      }),
    }
  )
);

// Type-safe modal helper
type ModalType = 'confirm' | 'editUser' | 'createProject';

interface ModalDataMap {
  confirm: { title: string; message: string; onConfirm: () => void };
  editUser: { userId: string };
  createProject: { teamId: string };
}

function useTypedModal<T extends ModalType>(type: T) {
  const activeModal = useUIStore((state) => state.activeModal);
  const modalData = useUIStore((state) => state.modalData);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);

  return {
    isOpen: activeModal === type,
    data: modalData as ModalDataMap[T],
    open: (data: ModalDataMap[T]) => openModal(type, data),
    close: closeModal,
  };
}

// Usage example
function UserList() {
  const editModal = useTypedModal('editUser');

  return (
    <div>
      <button onClick={() => editModal.open({ userId: '123' })}>
        Edit
      </button>
      {editModal.isOpen && (
        <EditUserModal
          userId={editModal.data.userId}
          onClose={editModal.close}
        />
      )}
    </div>
  );
}
```

### 2.4 Slice Pattern (for Large-Scale Apps)

```typescript
// For large apps, split the store into slices

// --- Type definitions ---
interface UserSlice {
  user: User | null;
  setUser: (user: User | null) => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

interface CartSlice {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  totalPrice: () => number;
}

interface NotificationSlice {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

// Combined type
type AppStore = UserSlice & CartSlice & NotificationSlice;

// --- Slice implementations ---
import { StateCreator } from 'zustand';

// UserSlice
const createUserSlice: StateCreator<AppStore, [], [], UserSlice> = (
  set,
  get
) => ({
  user: null,
  setUser: (user) => set({ user }),
  updateProfile: async (data) => {
    const currentUser = get().user;
    if (!currentUser) throw new Error('Not authenticated');

    const updated = await api.users.update(currentUser.id, data);
    set({ user: updated });

    // Cross-slice interaction: add a notification
    get().addNotification({
      type: 'success',
      title: 'Profile Updated',
      message: 'Your profile has been updated',
    });
  },
});

// CartSlice
const createCartSlice: StateCreator<AppStore, [], [], CartSlice> = (
  set,
  get
) => ({
  items: [],
  addItem: (product) =>
    set((state) => {
      const existing = state.items.find(
        (i) => i.productId === product.id
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
          },
        ],
      };
    }),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    })),
  totalPrice: () =>
    get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
});

// NotificationSlice
const createNotificationSlice: StateCreator<
  AppStore,
  [],
  [],
  NotificationSlice
> = (set, get) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        read: false,
      };
      return {
        notifications: [newNotification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    }),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        read: true,
      })),
      unreadCount: 0,
    })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
});

// --- Store creation ---
const useAppStore = create<AppStore>()(
  devtools((...a) => ({
    ...createUserSlice(...a),
    ...createCartSlice(...a),
    ...createNotificationSlice(...a),
  }))
);

// Helper exports per slice
export const useUser = () => useAppStore((state) => state.user);
export const useCartItems = () => useAppStore((state) => state.items);
export const useNotifications = () =>
  useAppStore((state) => state.notifications);
export const useUnreadCount = () =>
  useAppStore((state) => state.unreadCount);
```

### 2.5 Accessing Store Outside React

```typescript
// A powerful Zustand feature: access state outside React components

// Usage in API interceptors
import axios from 'axios';

const apiClient = axios.create({ baseURL: '/api' });

apiClient.interceptors.request.use((config) => {
  // Directly get the token from outside React
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Usage in WebSocket handlers
const socket = new WebSocket('wss://api.example.com/ws');

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'NEW_NOTIFICATION':
      // Directly update state from outside React
      useAppStore.getState().addNotification(data.notification);
      break;

    case 'CART_UPDATED':
      useCartStore.setState({ items: data.items });
      break;

    case 'USER_LOGGED_OUT':
      useAuthStore.getState().logout();
      break;
  }
});

// Usage in timers/schedulers
setInterval(() => {
  const { token, refreshToken } = useAuthStore.getState();
  if (token) {
    // Check token expiry
    const payload = parseJwt(token);
    const expiresIn = payload.exp * 1000 - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      // expires within 5 minutes
      refreshToken();
    }
  }
}, 60 * 1000); // Check every minute

// Usage in tests
describe('CartStore', () => {
  beforeEach(() => {
    // Reset state between tests
    useCartStore.setState({
      items: [],
    });
  });

  it('should add item', () => {
    useCartStore.getState().addItem({
      id: '1',
      name: 'Test Product',
      price: 1000,
      image: '/test.png',
    });

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });
});

// Monitor state changes with subscribe (outside React)
const unsubscribe = useAuthStore.subscribe(
  (state) => state.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      // Disconnect WebSocket when unauthenticated
      socket.close();
    }
  }
);
```

---

## 3. Jotai Basics

### 3.1 Primitive Atoms

```typescript
// Jotai: atom-based bottom-up state management
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

// --- Primitive atoms ---
// The most basic unit of state
const countAtom = atom(0);
const nameAtom = atom('');
const isDarkModeAtom = atom(false);
const selectedIdsAtom = atom<Set<string>>(new Set());
const formDataAtom = atom<FormData>({
  firstName: '',
  lastName: '',
  email: '',
});

// Usage: useAtom (read and write)
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Count: {count}
    </button>
  );
}

// useAtomValue (read-only)
function CountDisplay() {
  const count = useAtomValue(countAtom);
  return <span>Current count: {count}</span>;
}

// useSetAtom (write-only → this component does not re-render on value changes)
function IncrementButton() {
  const setCount = useSetAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>+1</button>;
}
```

### 3.2 Derived Atoms

```typescript
// --- Derived Atoms ---

// ① Read-only derived atom
const doubleCountAtom = atom((get) => get(countAtom) * 2);

const fullNameAtom = atom((get) => {
  const data = get(formDataAtom);
  return `${data.lastName} ${data.firstName}`;
});

// Depends on multiple atoms
const cartSummaryAtom = atom((get) => {
  const items = get(cartItemsAtom);
  const discount = get(discountAtom);
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const discountAmount = subtotal * discount;
  const total = subtotal - discountAmount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotal,
    discountAmount,
    total,
    itemCount,
    isEmpty: items.length === 0,
  };
});

function CartSummary() {
  const summary = useAtomValue(cartSummaryAtom);
  // Re-computes and re-renders only when cartItemsAtom or discountAtom changes
  return (
    <div>
      <p>Subtotal: {summary.subtotal.toLocaleString()}</p>
      <p>Discount: -{summary.discountAmount.toLocaleString()}</p>
      <p>Total: {summary.total.toLocaleString()}</p>
    </div>
  );
}

// ② Read-write derived atom
const countWithLimitAtom = atom(
  (get) => get(countAtom),
  (get, set, newValue: number) => {
    // Clamp the value to the range 0–100
    set(countAtom, Math.min(Math.max(newValue, 0), 100));
  }
);

// A derived atom that updates multiple atoms simultaneously
const resetAllAtom = atom(null, (get, set) => {
  set(countAtom, 0);
  set(nameAtom, '');
  set(isDarkModeAtom, false);
  set(selectedIdsAtom, new Set());
});

function ResetButton() {
  const resetAll = useSetAtom(resetAllAtom);
  return <button onClick={resetAll}>Reset All</button>;
}

// ③ Conditional derived atom
const currentUserAtom = atom<User | null>(null);
const isAdminAtom = atom((get) => {
  const user = get(currentUserAtom);
  return user?.role === 'admin';
});

const adminMenuItemsAtom = atom((get) => {
  const isAdmin = get(isAdminAtom);
  if (!isAdmin) return [];
  return [
    { label: 'User Management', path: '/admin/users' },
    { label: 'System Settings', path: '/admin/settings' },
    { label: 'Logs', path: '/admin/logs' },
  ];
});
```

### 3.3 Async Atoms

```typescript
// --- Async Atoms ---

// Basic: async initial value
const userAtom = atom(async () => {
  const response = await fetch('/api/user');
  return response.json() as Promise<User>;
});

// Use with Suspense
function UserProfile() {
  const user = useAtomValue(userAtom);
  // Suspense handles the loading state
  return <div>{user.name}</div>;
}

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile />
    </Suspense>
  );
}

// Read-write async atom
const todosAtom = atom<Todo[]>([]);

const fetchTodosAtom = atom(
  (get) => get(todosAtom),
  async (get, set) => {
    const response = await fetch('/api/todos');
    const todos = await response.json();
    set(todosAtom, todos);
  }
);

const addTodoAtom = atom(null, async (get, set, text: string) => {
  const response = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const newTodo = await response.json();
  set(todosAtom, [...get(todosAtom), newTodo]);
});

function TodoApp() {
  const [todos, fetchTodos] = useAtom(fetchTodosAtom);
  const addTodo = useSetAtom(addTodoAtom);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  return (
    <div>
      <button onClick={() => addTodo('New Task')}>Add</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 4. Jotai Practical Patterns

### 4.1 atomWithStorage (Persistence)

```typescript
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

// Persist to localStorage
const themeAtom = atomWithStorage<'light' | 'dark' | 'system'>(
  'app-theme',
  'system'
);

const languageAtom = atomWithStorage<'ja' | 'en' | 'zh'>('language', 'ja');

// Persist to sessionStorage
const sessionThemeAtom = atomWithStorage(
  'session-theme',
  'light',
  createJSONStorage(() => sessionStorage)
);

// Custom storage (e.g., AsyncStorage, MMKV)
const customStorage = createJSONStorage<string>(() => ({
  getItem: async (key) => {
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    await AsyncStorage.removeItem(key);
  },
}));

// Persist user preferences
interface UserPreferences {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  sidebarWidth: number;
  showLineNumbers: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
}

const userPreferencesAtom = atomWithStorage<UserPreferences>(
  'user-preferences',
  {
    fontSize: 14,
    lineHeight: 1.6,
    fontFamily: 'Inter',
    sidebarWidth: 240,
    showLineNumbers: true,
    autoSave: true,
    autoSaveInterval: 30000,
  }
);

// Derived atom to update individual properties
const fontSizeAtom = atom(
  (get) => get(userPreferencesAtom).fontSize,
  (get, set, fontSize: number) => {
    set(userPreferencesAtom, {
      ...get(userPreferencesAtom),
      fontSize: Math.min(Math.max(fontSize, 10), 24),
    });
  }
);
```

### 4.2 atomFamily (Dynamic Atoms)

```typescript
import { atomFamily, atomWithDefault } from 'jotai/utils';

// Basic atomFamily
const todoAtomFamily = atomFamily((id: string) =>
  atom<Todo | null>(null)
);

// Async atomFamily
const userAtomFamily = atomFamily((userId: string) =>
  atom(async () => {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) throw new Error('User not found');
    return response.json() as Promise<User>;
  })
);

function UserCard({ userId }: { userId: string }) {
  const user = useAtomValue(userAtomFamily(userId));
  return (
    <Suspense fallback={<Skeleton />}>
      <div>
        <img src={user.avatar} alt={user.name} />
        <h3>{user.name}</h3>
      </div>
    </Suspense>
  );
}

// Read-write atomFamily
interface FieldState {
  value: string;
  error: string | null;
  touched: boolean;
}

const fieldAtomFamily = atomFamily((fieldName: string) =>
  atom<FieldState>({
    value: '',
    error: null,
    touched: false,
  })
);

// Manage each form field independently
function FormField({ name, label }: { name: string; label: string }) {
  const [field, setField] = useAtom(fieldAtomFamily(name));

  const handleChange = (value: string) => {
    setField((prev) => ({
      ...prev,
      value,
      error: null, // Clear error on input
    }));
  };

  const handleBlur = () => {
    setField((prev) => ({ ...prev, touched: true }));
  };

  return (
    <div>
      <label>{label}</label>
      <input
        value={field.value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
      />
      {field.touched && field.error && (
        <span className="error">{field.error}</span>
      )}
    </div>
  );
}

// Whole-form validation
const formFieldNames = ['firstName', 'lastName', 'email', 'phone'];

const formValidAtom = atom((get) => {
  return formFieldNames.every((name) => {
    const field = get(fieldAtomFamily(name));
    return field.value.length > 0 && field.error === null;
  });
});

const formDataAtom = atom((get) => {
  const data: Record<string, string> = {};
  for (const name of formFieldNames) {
    data[name] = get(fieldAtomFamily(name)).value;
  }
  return data;
});
```

### 4.3 Filtering and Sorting Practical Patterns

```typescript
// State definitions
const filterAtom = atom<'all' | 'active' | 'completed'>('all');
const sortAtom = atom<'newest' | 'oldest' | 'name'>('newest');
const searchQueryAtom = atom('');
const todosAtom = atom<Todo[]>([]);

// Derived atom: apply filter → sort → search in sequence
const filteredTodosAtom = atom((get) => {
  const todos = get(todosAtom);
  const filter = get(filterAtom);

  switch (filter) {
    case 'active':
      return todos.filter((t) => !t.completed);
    case 'completed':
      return todos.filter((t) => t.completed);
    default:
      return todos;
  }
});

const sortedTodosAtom = atom((get) => {
  const filtered = get(filteredTodosAtom);
  const sortBy = get(sortAtom);

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.createdAt.getTime() - a.createdAt.getTime();
      case 'oldest':
        return a.createdAt.getTime() - b.createdAt.getTime();
      case 'name':
        return a.text.localeCompare(b.text);
      default:
        return 0;
    }
  });
});

const displayTodosAtom = atom((get) => {
  const sorted = get(sortedTodosAtom);
  const query = get(searchQueryAtom).toLowerCase();

  if (!query) return sorted;
  return sorted.filter(
    (t) =>
      t.text.toLowerCase().includes(query) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(query))
  );
});

// Stats atom
const todoStatsAtom = atom((get) => {
  const todos = get(todosAtom);
  return {
    total: todos.length,
    active: todos.filter((t) => !t.completed).length,
    completed: todos.filter((t) => t.completed).length,
    completionRate:
      todos.length > 0
        ? Math.round(
            (todos.filter((t) => t.completed).length / todos.length) * 100
          )
        : 0,
  };
});

// Usage
function TodoFilters() {
  const [filter, setFilter] = useAtom(filterAtom);
  const [sort, setSort] = useAtom(sortAtom);
  const [query, setQuery] = useAtom(searchQueryAtom);
  const stats = useAtomValue(todoStatsAtom);

  return (
    <div className="filters">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
        <option value="all">All ({stats.total})</option>
        <option value="active">Active ({stats.active})</option>
        <option value="completed">Completed ({stats.completed})</option>
      </select>
      <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="name">Name</option>
      </select>
      <span>Completion rate: {stats.completionRate}%</span>
    </div>
  );
}

function TodoList() {
  const displayTodos = useAtomValue(displayTodosAtom);
  return (
    <ul>
      {displayTodos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

### 4.4 atomWithReducer

```typescript
import { atomWithReducer } from 'jotai/utils';

// The atom equivalent of useReducer
type CountAction =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset' }
  | { type: 'set'; value: number };

const countReducerAtom = atomWithReducer(0, (state, action: CountAction) => {
  switch (action.type) {
    case 'increment':
      return state + 1;
    case 'decrement':
      return state - 1;
    case 'reset':
      return 0;
    case 'set':
      return action.value;
  }
});

function Counter() {
  const [count, dispatch] = useAtom(countReducerAtom);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <button onClick={() => dispatch({ type: 'reset' })}>Reset</button>
    </div>
  );
}

// More complex example: drag-and-drop state management
type DragState = {
  isDragging: boolean;
  draggedItem: string | null;
  dragOverTarget: string | null;
  startPosition: { x: number; y: number } | null;
};

type DragAction =
  | { type: 'START_DRAG'; item: string; position: { x: number; y: number } }
  | { type: 'DRAG_OVER'; target: string }
  | { type: 'DROP' }
  | { type: 'CANCEL' };

const dragAtom = atomWithReducer<DragState, DragAction>(
  {
    isDragging: false,
    draggedItem: null,
    dragOverTarget: null,
    startPosition: null,
  },
  (state, action) => {
    switch (action.type) {
      case 'START_DRAG':
        return {
          isDragging: true,
          draggedItem: action.item,
          dragOverTarget: null,
          startPosition: action.position,
        };
      case 'DRAG_OVER':
        return { ...state, dragOverTarget: action.target };
      case 'DROP':
      case 'CANCEL':
        return {
          isDragging: false,
          draggedItem: null,
          dragOverTarget: null,
          startPosition: null,
        };
    }
  }
);
```

### 4.5 Jotai and TanStack Query Integration

```typescript
import { atomWithQuery, atomWithMutation } from 'jotai-tanstack-query';

// Query atom
const usersQueryAtom = atomWithQuery(() => ({
  queryKey: ['users'],
  queryFn: async () => {
    const response = await fetch('/api/users');
    return response.json() as Promise<User[]>;
  },
  staleTime: 5 * 60 * 1000,
}));

// Query atom with parameters
const userIdAtom = atom<string | null>(null);

const userQueryAtom = atomWithQuery((get) => {
  const userId = get(userIdAtom);
  return {
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      const response = await fetch(`/api/users/${userId}`);
      return response.json() as Promise<User>;
    },
    enabled: !!userId,
  };
});

// Mutation atom
const createUserMutationAtom = atomWithMutation(() => ({
  mutationFn: async (data: CreateUserInput) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json() as Promise<User>;
  },
  onSuccess: () => {
    // Invalidate cache
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
}));

// Usage
function UserList() {
  const [{ data: users, isLoading, error }] = useAtom(usersQueryAtom);
  const [, createUser] = useAtom(createUserMutationAtom);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <button onClick={() => createUser({ name: 'New User', email: 'new@example.com' })}>
        Add User
      </button>
      <ul>
        {users?.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 5. Zustand vs Jotai: Detailed Comparison

### 5.1 Differences in Mental Model

```
Zustand: Top-down (store-based)
  ┌─────────────────────────────────┐
  │           AppStore              │
  │  ┌───────┐ ┌──────┐ ┌───────┐  │
  │  │ user  │ │ cart │ │ ui    │  │
  │  └───────┘ └──────┘ └───────┘  │
  └─────────────────────────────────┘
           ↓         ↓         ↓
       Component  Component  Component

  → Start design from "what stores are needed?"
  → Define the store shape first; components reference it
  → Closer to the Redux mental model

Jotai: Bottom-up (atom-based)
       atom    atom    atom    atom
        ↓       ↓       ↓       ↓
     ┌──┴──┐ ┌──┴──┐ ┌──┴──────┴──┐
     │     │ │     │ │ derived    │
     └──┬──┘ └──┬──┘ └──────┬─────┘
        ↓       ↓           ↓
    Component Component  Component

  → Start design from "what state does this component need?"
  → Combine small atoms to build the required state
  → Closer to the Recoil mental model
```

### 5.2 Performance Characteristics

```typescript
// === Differences in re-rendering ===

// Zustand: explicit optimization with selectors
function ZustandExample() {
  // Option 1: Individual selectors (most efficient)
  const count = useStore((s) => s.count);
  const name = useStore((s) => s.name);
  // → Re-renders only when count or name changes

  // Option 2: useShallow (retrieve multiple values at once)
  const { count, name } = useStore(
    useShallow((s) => ({ count: s.count, name: s.name }))
  );
  // → Re-renders only when count or name changes
  // → Determined by shallow comparison

  // Note: creating a new object inside a selector causes re-render every time
  // BAD:
  const state = useStore((s) => ({ count: s.count })); // new object every time
  // → Solved with useShallow
}

// Jotai: automatic optimization at the atom level
function JotaiExample() {
  const count = useAtomValue(countAtom);
  // → Re-renders only when countAtom changes
  // → Changes to nameAtom have no effect
  // → Automatically optimized without selectors

  // Derived atoms also automatically track dependencies
  const displayName = useAtomValue(displayNameAtom);
  // → Recomputes only when atoms that displayNameAtom depends on change
}

// Performance comparison:
// Zustand:
//   ✓ Precise control with selectors
//   ✗ Incorrect selector usage can cause unnecessary re-renders
//   ✓ useShallow allows optimized retrieval of multiple values

// Jotai:
//   ✓ Automatically optimized at the atom level
//   ✓ Dependency tracking for derived atoms is automatic
//   ✗ Over-splitting atoms can scatter code
```

### 5.3 DevTools and Debugging

```typescript
// === Zustand DevTools ===
import { devtools } from 'zustand/middleware';

const useStore = create<AppStore>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () =>
        set(
          (state) => ({ count: state.count + 1 }),
          false, // replace = false
          'increment' // action name (shown in DevTools)
        ),
    }),
    {
      name: 'AppStore', // store name shown in DevTools
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// In Redux DevTools:
// - Inspect state snapshots
// - Time-travel debugging
// - Review action history
// - Inspect state diffs

// === Jotai DevTools ===
import { DevTools } from 'jotai-devtools';
import 'jotai-devtools/styles.css';

// Add debug labels to atoms
const countAtom = atom(0);
countAtom.debugLabel = 'countAtom';

const nameAtom = atom('');
nameAtom.debugLabel = 'nameAtom';

// Place the DevTools component
function App() {
  return (
    <Provider>
      <DevTools />
      <MainContent />
    </Provider>
  );
}

// In React DevTools "Atoms" tab:
// - Inspect current value of each atom
// - Visualize dependencies between atoms
// - Monitor value changes in real time
```

---

## 6. Selection Guide

### 6.1 Choosing by Project Characteristics

```
When to choose Zustand:
  ✓ You want a clear "store" concept
  ✓ You need to access state from outside React (API interceptors, etc.)
  ✓ You need middleware (persist, devtools, immer)
  ✓ Your team has Redux experience
  ✓ The state structure is determined upfront
  ✓ You need to update state from WebSockets or timers
  ✓ You want to directly manipulate state in tests

When to choose Jotai:
  ✓ Fine-grained re-render control at the component level
  ✓ Many derived states (computed values)
  ✓ State that grows and shrinks dynamically (atomFamily)
  ✓ Integration with Suspense / Concurrent React
  ✓ You want to build state bottom-up
  ✓ You want to manage each form field independently
  ✓ Complex filtering/sorting logic

In common:
  → Both are TypeScript-first
  → Both are lightweight (< 5KB)
  → Both are optimized for React 18+
  → Both are developed by pmndrs (Poimandres)

Using both (the most common real-world pattern):
  → Zustand: global stores for auth, cart, UI preferences, etc.
  → Jotai: dynamic state such as forms, filters, and sorting
  → TanStack Query: server data
  → useState: local UI state
```

### 6.2 Scenario-Based Selection

```
Scenario 1: E-commerce App
  Auth state → Zustand (persist + access outside React)
  Cart → Zustand (persist + shared across multiple pages)
  Product data → TanStack Query
  Product filters → URL state (nuqs)
  Theme/language → Zustand (persist)
  Modal state → useState (local)

Scenario 2: Dashboard / Admin Panel
  Auth state → Zustand
  Dashboard widget layout → Zustand (persist + drag-and-drop)
  Per-widget data → TanStack Query
  Filters/date range → URL state
  Sidebar/theme → Zustand (persist)
  Table column settings → Jotai (atomFamily per column)

Scenario 3: Real-Time Collaboration Tool
  WebSocket connection → Zustand (access outside React)
  Document state → Zustand or Jotai (depends on requirements)
  User presence → Zustand (updated via WebSocket)
  Cursor position → Jotai (atomFamily per user)
  Editor settings → Jotai (atomWithStorage)
  File list → TanStack Query

Scenario 4: Form-Heavy App (e.g., application systems)
  Auth → Zustand
  Form data → React Hook Form + Zod
  Dynamic form fields → Jotai (atomFamily)
  Wizard progress → useReducer
  Submission data → TanStack Query
  Draft saving → Zustand (persist)
```

---

## 7. Testing Strategies

### 7.1 Testing Zustand

```typescript
import { renderHook, act } from '@testing-library/react';

// Utility to reset a store for testing
function resetStore<T extends object>(useStore: any) {
  const initialState = useStore.getInitialState();
  useStore.setState(initialState, true);
}

describe('useCartStore', () => {
  beforeEach(() => {
    resetStore(useCartStore);
  });

  it('should add an item to the cart', () => {
    const { result } = renderHook(() =>
      useCartStore(
        useShallow((state) => ({
          items: state.items,
          addItem: state.addItem,
        }))
      )
    );

    act(() => {
      result.current.addItem({
        id: 'p1',
        name: 'Test Product',
        price: 1000,
        image: '/test.png',
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual({
      productId: 'p1',
      name: 'Test Product',
      price: 1000,
      quantity: 1,
      image: '/test.png',
    });
  });

  it('should increment quantity for existing item', () => {
    // Set state directly for concise test setup
    useCartStore.setState({
      items: [
        {
          productId: 'p1',
          name: 'Test Product',
          price: 1000,
          quantity: 1,
          image: '/test.png',
        },
      ],
    });

    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem({
        id: 'p1',
        name: 'Test Product',
        price: 1000,
        image: '/test.png',
      });
    });

    expect(result.current.items[0].quantity).toBe(2);
  });

  it('should calculate total price correctly', () => {
    useCartStore.setState({
      items: [
        { productId: 'p1', name: 'Product A', price: 1000, quantity: 2, image: '' },
        { productId: 'p2', name: 'Product B', price: 500, quantity: 3, image: '' },
      ],
    });

    expect(useCartStore.getState().totalPrice()).toBe(3500);
  });

  it('should remove an item', () => {
    useCartStore.setState({
      items: [
        { productId: 'p1', name: 'Product A', price: 1000, quantity: 1, image: '' },
        { productId: 'p2', name: 'Product B', price: 500, quantity: 1, image: '' },
      ],
    });

    act(() => {
      useCartStore.getState().removeItem('p1');
    });

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].productId).toBe('p2');
  });
});

// Component integration test
import { render, screen, fireEvent } from '@testing-library/react';

describe('CartComponent', () => {
  beforeEach(() => {
    resetStore(useCartStore);
  });

  it('should display cart items', () => {
    useCartStore.setState({
      items: [
        { productId: 'p1', name: 'Product A', price: 1000, quantity: 2, image: '' },
      ],
    });

    render(<CartComponent />);

    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('2,000')).toBeInTheDocument();
  });

  it('should remove item when delete button is clicked', () => {
    useCartStore.setState({
      items: [
        { productId: 'p1', name: 'Product A', price: 1000, quantity: 1, image: '' },
      ],
    });

    render(<CartComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryByText('Product A')).not.toBeInTheDocument();
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
```

### 7.2 Testing Jotai

```typescript
import { renderHook, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';

// Test wrapper
function TestProvider({
  initialValues,
  children,
}: {
  initialValues: Array<[any, any]>;
  children: React.ReactNode;
}) {
  return (
    <Provider>
      <HydrateAtoms initialValues={initialValues}>
        {children}
      </HydrateAtoms>
    </Provider>
  );
}

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: Array<[any, any]>;
  children: React.ReactNode;
}) {
  useHydrateAtoms(initialValues);
  return children;
}

describe('Todo Atoms', () => {
  it('should filter todos by status', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestProvider
        initialValues={[
          [
            todosAtom,
            [
              { id: '1', text: 'Task 1', completed: false },
              { id: '2', text: 'Task 2', completed: true },
              { id: '3', text: 'Task 3', completed: false },
            ],
          ],
          [filterAtom, 'active'],
        ]}
      >
        {children}
      </TestProvider>
    );

    const { result } = renderHook(
      () => useAtomValue(filteredTodosAtom),
      { wrapper }
    );

    expect(result.current).toHaveLength(2);
    expect(result.current.every((t) => !t.completed)).toBe(true);
  });

  it('should calculate stats correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestProvider
        initialValues={[
          [
            todosAtom,
            [
              { id: '1', text: 'Task 1', completed: false },
              { id: '2', text: 'Task 2', completed: true },
              { id: '3', text: 'Task 3', completed: true },
            ],
          ],
        ]}
      >
        {children}
      </TestProvider>
    );

    const { result } = renderHook(
      () => useAtomValue(todoStatsAtom),
      { wrapper }
    );

    expect(result.current).toEqual({
      total: 3,
      active: 1,
      completed: 2,
      completionRate: 67,
    });
  });
});

// Test using createStore (no Provider needed)
describe('Todo Atoms (with createStore)', () => {
  it('should toggle todo', () => {
    const store = createStore();

    store.set(todosAtom, [
      { id: '1', text: 'Task 1', completed: false },
    ]);

    // When toggleTodoAtom is a write atom
    store.set(toggleTodoAtom, '1');

    const todos = store.get(todosAtom);
    expect(todos[0].completed).toBe(true);
  });
});
```

---

## 8. Advanced Patterns

### 8.1 Zustand: Temporal Middleware (Undo/Redo)

```typescript
import { temporal } from 'zundo';

interface EditorStore {
  content: string;
  fontSize: number;
  setContent: (content: string) => void;
  setFontSize: (size: number) => void;
}

const useEditorStore = create<EditorStore>()(
  temporal(
    (set) => ({
      content: '',
      fontSize: 14,
      setContent: (content) => set({ content }),
      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      limit: 50, // Maximum history entries
      // Include only specific fields in history
      partialize: (state) => ({
        content: state.content,
      }),
      // Debounce (avoid creating a history entry on every keystroke while typing)
      handleSet: (handleSet) => {
        let timeoutId: NodeJS.Timeout;
        return (state) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            handleSet(state);
          }, 500);
        };
      },
    }
  )
);

// Undo/Redo buttons
function UndoRedoButtons() {
  const { undo, redo, pastStates, futureStates } =
    useEditorStore.temporal.getState();

  return (
    <div>
      <button onClick={undo} disabled={pastStates.length === 0}>
        Undo ({pastStates.length})
      </button>
      <button onClick={redo} disabled={futureStates.length === 0}>
        Redo ({futureStates.length})
      </button>
    </div>
  );
}
```

### 8.2 Jotai: focusAtom (Lens Pattern)

```typescript
import { focusAtom } from 'jotai-optics';

// An atom that focuses on a specific field of a large object
interface AppConfig {
  editor: {
    fontSize: number;
    fontFamily: string;
    theme: string;
    lineNumbers: boolean;
  };
  sidebar: {
    width: number;
    collapsed: boolean;
    position: 'left' | 'right';
  };
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
}

const configAtom = atom<AppConfig>({
  editor: {
    fontSize: 14,
    fontFamily: 'monospace',
    theme: 'vs-dark',
    lineNumbers: true,
  },
  sidebar: {
    width: 240,
    collapsed: false,
    position: 'left',
  },
  notifications: {
    enabled: true,
    sound: true,
    desktop: false,
  },
});

// Focus on specific fields with focusAtom
const editorConfigAtom = focusAtom(configAtom, (optic) =>
  optic.prop('editor')
);
const fontSizeAtom = focusAtom(configAtom, (optic) =>
  optic.prop('editor').prop('fontSize')
);
const sidebarWidthAtom = focusAtom(configAtom, (optic) =>
  optic.prop('sidebar').prop('width')
);

// Updating fontSizeAtom automatically updates the nested value in configAtom
function FontSizeControl() {
  const [fontSize, setFontSize] = useAtom(fontSizeAtom);
  return (
    <input
      type="range"
      min={10}
      max={24}
      value={fontSize}
      onChange={(e) => setFontSize(Number(e.target.value))}
    />
  );
  // → configAtom.editor.fontSize is updated
  // → Components using sidebar or notifications do not re-render
}
```

### 8.3 Combining Zustand and Jotai

```typescript
// In real-world apps, it is common to use both

// Zustand: app-wide global store (accessible outside React)
const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: async (email, password) => {
        const result = await api.login(email, password);
        set({ user: result.user, token: result.token });
      },
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'auth' }
  )
);

// Jotai: screen-specific dynamic state (flexible with atoms)
const searchQueryAtom = atom('');
const filtersAtom = atom<Filter[]>([]);
const sortAtom = atom<SortConfig>({ field: 'createdAt', order: 'desc' });
const pageAtom = atom(1);

// Referencing Zustand state from Jotai
const currentUserAtom = atom((get) => {
  // Get directly from the Zustand store
  return useAuthStore.getState().user;
});

// For a more reactive approach: use subscribe
const currentUserReactiveAtom = atom<User | null>(null);

// Set up synchronization at app startup
useAuthStore.subscribe(
  (state) => state.user,
  (user) => {
    // Update the atom via the Jotai store
    jotaiStore.set(currentUserReactiveAtom, user);
  }
);
```

---

## 9. Migration Guide

### 9.1 Migrating from Redux to Zustand

```typescript
// === Redux Toolkit ===
// store/todoSlice.ts
const todoSlice = createSlice({
  name: 'todos',
  initialState: {
    items: [] as Todo[],
    filter: 'all' as FilterType,
  },
  reducers: {
    addTodo: (state, action: PayloadAction<string>) => {
      state.items.push({
        id: crypto.randomUUID(),
        text: action.payload,
        completed: false,
      });
    },
    toggleTodo: (state, action: PayloadAction<string>) => {
      const todo = state.items.find((t) => t.id === action.payload);
      if (todo) todo.completed = !todo.completed;
    },
    setFilter: (state, action: PayloadAction<FilterType>) => {
      state.filter = action.payload;
    },
  },
});

// Component
function TodoList() {
  const todos = useSelector((state: RootState) => state.todos.items);
  const dispatch = useDispatch();
  return (
    <button onClick={() => dispatch(todoSlice.actions.addTodo('New'))}>
      Add
    </button>
  );
}

// === The same thing in Zustand ===
// stores/useTodoStore.ts
interface TodoStore {
  items: Todo[];
  filter: FilterType;
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  setFilter: (filter: FilterType) => void;
}

const useTodoStore = create<TodoStore>()(
  immer((set) => ({
    items: [],
    filter: 'all',
    addTodo: (text) =>
      set((state) => {
        state.items.push({
          id: crypto.randomUUID(),
          text,
          completed: false,
        });
      }),
    toggleTodo: (id) =>
      set((state) => {
        const todo = state.items.find((t) => t.id === id);
        if (todo) todo.completed = !todo.completed;
      }),
    setFilter: (filter) => set({ filter }),
  }))
);

// Component (no Provider needed!)
function TodoList() {
  const todos = useTodoStore((state) => state.items);
  const addTodo = useTodoStore((state) => state.addTodo);
  return <button onClick={() => addTodo('New')}>Add</button>;
}

// Migration highlights:
// 1. No Provider/configureStore needed
// 2. useSelector → useStore(selector)
// 3. dispatch(action) → store.action()
// 4. createSlice → define directly inside create()
// 5. Same syntax available with immer middleware
// 6. Redux DevTools still work
```

### 9.2 Migrating from Context to Jotai

```typescript
// === React Context ===
const TodoContext = createContext<{
  todos: Todo[];
  filter: FilterType;
  addTodo: (text: string) => void;
  setFilter: (filter: FilterType) => void;
} | null>(null);

function TodoProvider({ children }: { children: React.ReactNode }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');

  const addTodo = useCallback((text: string) => {
    setTodos((prev) => [...prev, { id: crypto.randomUUID(), text, completed: false }]);
  }, []);

  const value = useMemo(
    () => ({ todos, filter, addTodo, setFilter }),
    [todos, filter, addTodo]
  );

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
}

// Problem: components that only use filter still re-render when todos changes

// === The same thing in Jotai ===
const todosAtom = atom<Todo[]>([]);
const filterAtom = atom<FilterType>('all');

const addTodoAtom = atom(null, (get, set, text: string) => {
  set(todosAtom, [
    ...get(todosAtom),
    { id: crypto.randomUUID(), text, completed: false },
  ]);
});

// No Provider needed; each atom updates independently
function TodoFilters() {
  const [filter, setFilter] = useAtom(filterAtom);
  // This component does NOT re-render when todosAtom changes!
  return (
    <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
      <option value="all">All</option>
      <option value="active">Active</option>
    </select>
  );
}

// Migration highlights:
// 1. No Provider needed (Jotai scopes implicitly to the React tree)
// 2. No manual optimization with useMemo/useCallback
// 3. Each atom is independent → re-renders are automatically optimized
// 4. No need to split Context (Value/Dispatch separation)
```

---

## 10. Best Practices Summary

```
Zustand Best Practices:
  1. Use selectors to retrieve only what you need
  2. Define actions inside the store (so they can be used outside components too)
  3. When persisting with persist, use partialize to persist only necessary fields
  4. Add action names in devtools for easier debugging
  5. Use the slice pattern for large-scale apps
  6. Reset state in tests using getInitialState()
  7. Use immer middleware to simplify nested updates

Jotai Best Practices:
  1. Keep atoms small (one atom = one concern)
  2. Use derived atoms actively (derive state at the atom level)
  3. Add debugLabel for easier debugging
  4. Use useAtomValue / useSetAtom appropriately (prevent unnecessary re-renders)
  5. Manage dynamic state with atomFamily
  6. Persist state with atomWithStorage
  7. Use focusAtom to focus on specific fields of nested objects

Common Best Practices:
  1. Delegate server data to TanStack Query (do not put it in stores/atoms)
  2. Use useState for local state (avoid excessive globalization)
  3. Define TypeScript types accurately
  4. Write tests (store/atom logic as pure functions)
  5. Measure performance before optimizing (avoid premature optimization)
```

---

## FAQ

### Q1: How should I choose between Zustand and Jotai?

**A:** Decide based on mental model and technical requirements:

**When to choose Zustand:**
- You want a clear "store" concept (intuitive for Redux users)
- You need to access state from outside React (API interceptors, WebSocket handlers, etc.)
- You want to leverage middleware (persist, devtools, immer)
- You want a simple library with a low learning curve
- **Examples:** auth state, cart, UI settings (sidebar, theme)

**When to choose Jotai:**
- You need fine-grained re-render control at the component level
- You have many derived states (computed values)
- State grows and shrinks dynamically (atomFamily)
- You prioritize integration with Suspense / Concurrent React
- You want to build state bottom-up
- **Examples:** complex filtering, forms (manage each field independently), dynamic tables

**Using both (the most common real-world pattern):**
```typescript
// Zustand: global static state
const useAuthStore = create(/* auth */);
const useUIStore = create(/* theme, sidebar */);

// Jotai: sections with many dynamic or derived states
const searchQueryAtom = atom('');
const filtersAtom = atom([]);
const filteredResultsAtom = atom((get) => /* derived */);
```

### Q2: What is the strategy for splitting stores?

**A:** Split based on Separation of Concerns:

**Anti-pattern: One giant store**
```typescript
// BAD: stuffing everything into a single store
const useMegaStore = create({
  user, theme, cart, notifications, sidebar, modal, ...
  // → 50+ properties, bloated, hard to test
});
```

**Best practice: Split by domain**
```typescript
// GOOD: separate stores per concern
const useAuthStore = create(/* auth-related */);
const useCartStore = create(/* cart-related */);
const useUIStore = create(/* UI state */);
const useNotificationStore = create(/* notifications */);

// For large scale: slice pattern
const useAppStore = create((...a) => ({
  ...createAuthSlice(...a),
  ...createCartSlice(...a),
  ...createUISlice(...a),
}));
```

**Criteria for splitting:**
- **Domain boundaries:** clearly distinguishable by business logic (auth, cart, notifications, etc.)
- **Update frequency:** isolate frequently updated state (minimize re-renders)
- **Lifecycle:** separate state with different persistence needs or reset timing
- **Testability:** split into units that can be tested independently

### Q3: How do I debug a store with DevTools?

**A:** DevTools usage for both Zustand and Jotai:

**Zustand: Redux DevTools**
```typescript
import { devtools } from 'zustand/middleware';

const useStore = create<Store>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () =>
        set(
          (state) => ({ count: state.count + 1 }),
          false,
          'increment' // ← action name (shown in DevTools)
        ),
    }),
    {
      name: 'MyStore', // ← store name
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// In Redux DevTools:
// - Inspect state snapshots
// - Time-travel debugging (go back to previous state)
// - Review action history
// - Inspect diffs
```

**Jotai: jotai-devtools**
```typescript
import { DevTools } from 'jotai-devtools';
import 'jotai-devtools/styles.css';

// Add labels to atoms
const countAtom = atom(0);
countAtom.debugLabel = 'countAtom';

// Place the DevTools component
function App() {
  return (
    <Provider>
      <DevTools />
      <MainApp />
    </Provider>
  );
}

// In DevTools:
// - Inspect the current value of each atom
// - Visualize dependencies between atoms
// - Monitor value changes in real time
```

**Debugging Tips:**
- **Zustand:** Use meaningful action names (`'cart/addItem'` rather than just `'increment'`)
- **Jotai:** Always set debugLabel (without it, atoms get auto-generated names like `atom1`, `atom2`)
- **Production:** disable devtools (`enabled: process.env.NODE_ENV === 'development'`)

---

## Summary

| Feature | Zustand | Jotai |
|---------|---------|-------|
| Model | Store-based (top-down) | Atom-based (bottom-up) |
| API | create() | atom() + useAtom() |
| Re-renders | Optimized with selectors | Automatically optimized per atom |
| Middleware | persist, devtools, immer, temporal | atomWithStorage, atomFamily, focusAtom |
| Access outside React | getState(), setState(), subscribe() | Possible via createStore() |
| DevTools | Redux DevTools | jotai-devtools |
| Bundle size | ~1.1kB (gzip) | ~3.8kB (gzip) |
| Learning curve | Low (especially for Redux users) | Medium (requires understanding the atom concept) |
| Suitable scale | Medium to large | Small to large |
| Async handling | async/await inside the store | Async atoms or jotai-tanstack-query |
| Testing | Direct manipulation via getState()/setState() | Test with createStore() or Provider |
| SSR support | hydrate middleware | Provider + useHydrateAtoms |

---

## Further Reading

---

## References
1. Zustand. "Bear necessities for state management." github.com/pmndrs/zustand, 2024.
2. Jotai. "Primitive and flexible state management." jotai.org, 2024.
3. Daishi Kato. "When I Use Jotai vs Zustand." blog.axlight.com, 2024.
4. Daishi Kato. "Zustand Internals." blog.axlight.com, 2023.
5. TkDodo. "Working with Zustand." tkdodo.eu, 2024.
6. Jotai. "Comparison with Recoil." jotai.org/docs/basics/comparison, 2024.
7. pmndrs. "Zustand Middleware." github.com/pmndrs/zustand/wiki, 2024.
8. zundo. "Undo/Redo middleware for Zustand." github.com/charkour/zundo, 2024.
9. jotai-optics. "Optics for Jotai." github.com/jotaijs/jotai-optics, 2024.
10. jotai-tanstack-query. "TanStack Query integration." github.com/jotaijs/jotai-tanstack-query, 2024.
