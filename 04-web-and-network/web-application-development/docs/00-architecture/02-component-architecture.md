# Component Architecture

> Component architecture determines the reusability and maintainability of UI. Master all patterns of scalable component architecture — from Atomic Design and Container/Presentational to Compound Components and Headless UI.

## What You Will Learn

- [ ] Understand the principles and granularity design for component splitting
- [ ] Grasp major component design patterns
- [ ] Learn how to use Headless UI and component libraries
- [ ] Master the principles and patterns of Props design
- [ ] Learn optimization of Server/Client component boundaries
- [ ] Understand component testing strategies
- [ ] Grasp component design for performance optimization
- [ ] Learn component management techniques in large-scale applications

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Project structure and feature-based design — [Project Structure](./01-project-structure.md)
- React basics (JSX, Props, State, Hooks)
- TypeScript type system (interface, type, Generics basics)

---

## 1. Principles of Component Splitting

### 1.1 Single Responsibility Principle (SRP)

The most important principle in component design is that one component has only one responsibility. This makes components easier to understand, test, and maintain.

```typescript
// ============================================
// Anti-pattern: All responsibilities in one component
// ============================================
function UserPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // データ取得ロジック
    fetch(`/api/users?page=${page}&filter=${filter}&sort=${sortBy}&q=${searchQuery}`)
      .then(res => res.json())
      .then(data => setUsers(data.users));
  }, [page, filter, sortBy, searchQuery]);

  const handleEdit = (user: User) => { /* 編集ロジック */ };
  const handleDelete = (id: string) => { /* 削除ロジック */ };
  const handleSearch = (query: string) => { /* 検索ロジック */ };
  const validateForm = () => { /* バリデーション */ };

  // 500行以上のJSX...
  return (
    <div>
      {/* 検索バー、フィルター、テーブル、ページネーション、
          編集モーダル、確認ダイアログ、通知 etc. */}
    </div>
  );
}

// ============================================
// Recommended pattern: Split components by responsibility
// ============================================

// Page component (responsible for composition only)
function UserPage() {
  return (
    <PageLayout title="User Management">
      <UserSearchBar />
      <UserFilters />
      <UserTableContainer />
      <Pagination />
    </PageLayout>
  );
}

// Search bar (responsible for search only)
function UserSearchBar() {
  const [query, setQuery] = useQueryParam('q', '');
  const debouncedQuery = useDebounce(query, 300);

  return (
    <SearchInput
      value={query}
      onChange={setQuery}
      placeholder="Search users..."
    />
  );
}

// Filters (responsible for filtering only)
function UserFilters() {
  const [filter, setFilter] = useQueryParam('filter', 'all');

  return (
    <FilterBar>
      <FilterChip value="all" active={filter === 'all'} onClick={() => setFilter('all')}>
        すべて
      </FilterChip>
      <FilterChip value="active" active={filter === 'active'} onClick={() => setFilter('active')}>
        アクティブ
      </FilterChip>
      <FilterChip value="inactive" active={filter === 'inactive'} onClick={() => setFilter('inactive')}>
        非アクティブ
      </FilterChip>
    </FilterBar>
  );
}

// Table container (bridge between data fetching and table display)
function UserTableContainer() {
  const { data: users, isLoading, error } = useUsers();

  if (error) return <ErrorMessage error={error} />;
  if (isLoading) return <TableSkeleton rows={10} columns={5} />;

  return <UserTable users={users} />;
}
```

### 1.2 Criteria for Splitting Decisions

It is important to clarify the criteria for when to split a component.

```
Signs that splitting is needed:
  ✓ Component exceeds 50 lines
  ✓ The same UI pattern appears 2+ times
  ✓ A clear unit to test exists
  ✓ Data fetching and UI rendering are mixed
  ✓ Multiple states are managed independently
  ✓ The component name would include "And"
  ✓ Complex conditional branches inside JSX

Signs of over-splitting:
  ✗ Props drilling of 10+ props occurs
  ✗ One change requires modifying 5+ files
  ✗ Component name is too abstract (Wrapper, Handler, Manager)
  ✗ Component is just a thin wrapper around an HTML element
  ✗ Large numbers of callbacks passed between parent and child
  ✗ Too many files, takes time to find anything
```

### 1.3 Component Granularity Design

Component granularity needs to be adjusted based on project scale and requirements. Having clear granularity standards allows the entire team to design consistently.

```typescript
// ============================================
// Granularity Level 1: Primitive Components
// Minimal unit extending HTML elements
// ============================================
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

function TextInput({ label, error, helperText, id, ...props }: TextInputProps) {
  const inputId = id ?? useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'rounded-md border px-3 py-2 text-sm',
          error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
}

// ============================================
// Granularity Level 2: Composite Components
// Functional units combining primitives
// ============================================
interface SearchFormProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  defaultQuery?: string;
  categories: Category[];
}

function SearchForm({ onSearch, defaultQuery = '', categories }: SearchFormProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [filters, setFilters] = useState<SearchFilters>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query, filters);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <TextInput
        label="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter keyword..."
      />
      <Select
        label="Category"
        options={categories}
        value={filters.category}
        onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
      />
      <Button type="submit" variant="primary">
        検索
      </Button>
    </form>
  );
}

// ============================================
// Granularity Level 3: Domain Components
// Units for a specific domain including business logic
// ============================================
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUser(userId);
  const { mutate: updateUser } = useUpdateUser();
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) return <ProfileSkeleton />;
  if (!user) return <NotFound message="User not found" />;

  return (
    <Card>
      <Card.Header>
        <Avatar src={user.avatar} alt={user.name} size="lg" />
        <div>
          <h2 className="text-xl font-bold">{user.name}</h2>
          <Badge variant={user.role === 'admin' ? 'primary' : 'secondary'}>
            {user.role}
          </Badge>
        </div>
        <Button variant="ghost" onClick={() => setIsEditing(true)}>
          編集
        </Button>
      </Card.Header>
      <Card.Body>
        <UserProfileDetails user={user} />
      </Card.Body>
      {isEditing && (
        <UserEditModal
          user={user}
          onSave={(data) => {
            updateUser({ id: userId, ...data });
            setIsEditing(false);
          }}
          onClose={() => setIsEditing(false)}
        />
      )}
    </Card>
  );
}

// ============================================
// Granularity Level 4: Page/Layout Components
// Screen-level combination of domain components
// ============================================
function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardLayout.Sidebar>
        <Navigation />
      </DashboardLayout.Sidebar>
      <DashboardLayout.Main>
        <PageHeader
          title="ダッシュボード"
          actions={<DateRangePicker />}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard metric="totalUsers" />
          <KPICard metric="activeUsers" />
          <KPICard metric="revenue" />
          <KPICard metric="conversionRate" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <RecentActivityFeed />
          <SalesChart period="monthly" />
        </div>
      </DashboardLayout.Main>
    </DashboardLayout>
  );
}
```

### 1.4 Atomic Design

Atomic Design is a design system methodology that organizes UI into 5 levels: Atoms, Molecules, Organisms, Templates, and Pages.

```
Atomic Design 5 Layers:

  Atoms:
  → Smallest UI unit
  → Button, Input, Label, Icon, Badge, Avatar
  → Elements that cannot be split further
  → Directly reference design tokens (color, font, spacing)

  Molecules:
  → Functional units combining Atoms
  → SearchBar = Input + Button + Icon
  → FormField = Label + Input + ErrorMessage
  → Has one clear function

  Organisms:
  → Complex UI composed of Molecules + Atoms
  → Header = Logo + Navigation + SearchBar + UserMenu
  → ProductCard = Image + Title + Price + AddToCartButton
  → Functions as a standalone UI

  Templates:
  → Defines the layout structure of the page
  → Places content placeholders
  → Framework without data

  Pages:
  → Templates filled with real data
  → The final screen seen by actual users
```

```typescript
// ============================================
// Atomic Design の実装例
// ============================================

// --- Atom ---
function Badge({ children, variant = 'default' }: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variantClasses[variant])}>
      {children}
    </span>
  );
}

// --- Molecule ---
function UserInfo({ name, email, role }: {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}) {
  const roleBadgeVariant = {
    admin: 'error' as const,
    user: 'success' as const,
    guest: 'default' as const,
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} size="md" />
      <div>
        <p className="font-medium text-gray-900">{name}</p>
        <p className="text-sm text-gray-500">{email}</p>
      </div>
      <Badge variant={roleBadgeVariant[role]}>{role}</Badge>
    </div>
  );
}

// --- Organism ---
function UserListTable({ users, onEdit, onDelete }: {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
}) {
  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>ユーザー</Table.Head>
          <Table.Head>ステータス</Table.Head>
          <Table.Head>登録日</Table.Head>
          <Table.Head>操作</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {users.map(user => (
          <Table.Row key={user.id}>
            <Table.Cell>
              <UserInfo name={user.name} email={user.email} role={user.role} />
            </Table.Cell>
            <Table.Cell>
              <Badge variant={user.isActive ? 'success' : 'default'}>
                {user.isActive ? 'アクティブ' : '非アクティブ'}
              </Badge>
            </Table.Cell>
            <Table.Cell>{formatDate(user.createdAt)}</Table.Cell>
            <Table.Cell>
              <div className="flex gap-2">
                <IconButton icon="edit" onClick={() => onEdit(user)} label="編集" />
                <IconButton icon="delete" onClick={() => onDelete(user.id)} label="削除" variant="destructive" />
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

// --- Template ---
function AdminListTemplate({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        {/* ヘッダースロット */}
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          {/* メインコンテンツスロット */}
          {children}
        </div>
        <div className="w-64">
          {/* サイドバースロット */}
        </div>
      </div>
    </div>
  );
}
```

### 1.5 Component Splitting Best Practices Comparison

| Criterion | Split | Don't Split |
|------|---------|-----------|
| Lines | 50+ lines | 30 or fewer |
| Responsibility | Multiple concerns | Single concern |
| Reuse | Used in 2+ places | Used in only 1 place |
| Testing | Independent test needed | Tested with parent |
| State | Independent state management | Depends on parent state |
| Change frequency | Different from others | Changed at the same time |
| Team | Managed by different teams | Managed by same team |

---

## 2. Container / Presentational Pattern

### 2.1 Basic Concepts of the Pattern

The Container/Presentational pattern is a design pattern that separates components into logic-responsible (Container) and display-responsible (Presentational). A pattern popularized by Dan Abramov in the React community, it is one of the most fundamental approaches to achieving separation of concerns.

```
Container (logic-responsible):
  → Data fetching, state management, event handling
  → Has no UI (delegates to Presentational)
  → Often implemented as custom hooks
  → Consolidates side effects (API calls, storage access, etc.)

Presentational (display-responsible):
  → Only receives props and displays
  → Minimal internal state (open/close UI, hover state, etc.)
  → Easy to test (just pass props)
  → Easy to document in Storybook
  → High reusability
```

### 2.2 Implementation Patterns

```typescript
// ============================================
// Pattern 1: Classic Container/Presentational
// ============================================

// --- Container ---
function UserListContainer() {
  const { data: users, isLoading, error } = useUsers();
  const [filter, setFilter] = useState<UserFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const { mutate: deleteUser } = useDeleteUser();

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users
      .filter(u => filter === 'all' ? true : u.role === filter)
      .sort((a, b) => a[sortBy].localeCompare(b[sortBy]));
  }, [users, filter, sortBy]);

  const handleDelete = useCallback(async (userId: string) => {
    if (window.confirm('本当に削除しますか？')) {
      await deleteUser(userId);
    }
  }, [deleteUser]);

  return (
    <UserListView
      users={filteredUsers}
      isLoading={isLoading}
      error={error}
      filter={filter}
      sortBy={sortBy}
      onFilterChange={setFilter}
      onSortChange={setSortBy}
      onDelete={handleDelete}
    />
  );
}

// --- Presentational ---
interface UserListViewProps {
  users: User[];
  isLoading: boolean;
  error: Error | null;
  filter: UserFilter;
  sortBy: SortKey;
  onFilterChange: (filter: UserFilter) => void;
  onSortChange: (sort: SortKey) => void;
  onDelete: (userId: string) => void;
}

function UserListView({
  users,
  isLoading,
  error,
  filter,
  sortBy,
  onFilterChange,
  onSortChange,
  onDelete,
}: UserListViewProps) {
  if (error) {
    return (
      <Alert variant="error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <TableSkeleton rows={10} columns={4} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <FilterBar value={filter} onChange={onFilterChange} />
        <SortSelect value={sortBy} onChange={onSortChange} />
      </div>
      {users.length === 0 ? (
        <EmptyState
          icon="users"
          title="User not found"
          description="検索条件を変更してください"
        />
      ) : (
        <ul className="divide-y divide-gray-200">
          {users.map(user => (
            <li key={user.id} className="py-4">
              <UserCard user={user} onDelete={() => onDelete(user.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================
// Pattern 2: Separation via custom hook (modern approach)
// ============================================

// Custom hook = Container role
function useUserList() {
  const { data: users, isLoading, error } = useUsers();
  const [filter, setFilter] = useState<UserFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const { mutate: deleteUser } = useDeleteUser();

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users
      .filter(u => filter === 'all' ? true : u.role === filter)
      .sort((a, b) => a[sortBy].localeCompare(b[sortBy]));
  }, [users, filter, sortBy]);

  const handleDelete = useCallback(async (userId: string) => {
    if (window.confirm('本当に削除しますか？')) {
      await deleteUser(userId);
    }
  }, [deleteUser]);

  return {
    users: filteredUsers,
    isLoading,
    error,
    filter,
    sortBy,
    setFilter,
    setSortBy,
    handleDelete,
  };
}

// Component focuses on display
function UserList() {
  const {
    users,
    isLoading,
    error,
    filter,
    sortBy,
    setFilter,
    setSortBy,
    handleDelete,
  } = useUserList();

  // Display logic only
  if (error) return <ErrorMessage error={error} />;
  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <FilterBar value={filter} onChange={setFilter} />
      <SortSelect value={sortBy} onChange={setSortBy} />
      <UserListView users={users} onDelete={handleDelete} />
    </div>
  );
}

// ============================================
// Pattern 3: Natural separation via React Server Components
// ============================================

// Server Component = Container (data fetching)
// app/users/page.tsx
async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { profile: true },
  });

  return (
    <PageLayout>
      <PageHeader title="ユーザー一覧" />
      {/* Client Componentに表示を委譲 */}
      <UserListClient initialUsers={users} />
    </PageLayout>
  );
}

// Client Component = Presentational (interaction)
'use client';
function UserListClient({ initialUsers }: { initialUsers: User[] }) {
  const [filter, setFilter] = useState<UserFilter>('all');
  const filtered = initialUsers.filter(u =>
    filter === 'all' ? true : u.role === filter
  );

  return (
    <>
      <FilterBar value={filter} onChange={setFilter} />
      <UserGrid users={filtered} />
    </>
  );
}
```

### 2.3 Choosing Between Container/Presentational Approaches

| Approach | Pros | Cons | Use Case |
|-----------|---------|-----------|---------|
| Classic Container | Clear separation, easy testing | More files | Large teams |
| Custom hook | Flexible, reusable | Hook dependency management | Medium projects |
| RSC separation | Natural separation, performance | Next.js dependency | Next.js App Router |

---

## 3. Compound Components Pattern

### 3.1 Pattern Overview

Compound Components is a pattern that provides a group of related components as a single unit. The parent component manages state, and child components implicitly share that state. It is analogous to the relationship between HTML's `<select>` and `<option>`.

```typescript
// ============================================
// Usage: Declarative and intuitive API
// ============================================

// Tabs component usage example
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
    <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="profile">
    <ProfileForm />
  </Tabs.Content>
  <Tabs.Content value="settings">
    <SettingsForm />
  </Tabs.Content>
  <Tabs.Content value="billing">
    <BillingInfo />
  </Tabs.Content>
</Tabs>

// Accordion component usage example
<Accordion type="single" defaultValue="item-1">
  <Accordion.Item value="item-1">
    <Accordion.Trigger>Section 1</Accordion.Trigger>
    <Accordion.Content>Section 1 content</Accordion.Content>
  </Accordion.Item>
  <Accordion.Item value="item-2">
    <Accordion.Trigger>Section 2</Accordion.Trigger>
    <Accordion.Content>Section 2 content</Accordion.Content>
  </Accordion.Item>
</Accordion>

// Dropdown menu usage example
<DropdownMenu>
  <DropdownMenu.Trigger>
    <Button variant="ghost">Menu</Button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item onSelect={() => navigate('/profile')}>
      Profile
    </DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Item onSelect={handleLogout} variant="destructive">
      Logout
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu>
```

### 3.2 Tabs Component Implementation

```typescript
// ============================================
// Complete implementation example of Compound Components: Tabs
// ============================================

// --- Type definitions ---
interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
}

// --- Context ---
const TabsContext = createContext<TabsContextType | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs sub-components must be used inside <Tabs>');
  }
  return context;
}

// --- Parent component ---
interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  children: ReactNode;
}

function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  orientation = 'horizontal',
  children,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeTab = isControlled ? controlledValue : internalValue;

  const setActiveTab = useCallback((newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  }, [isControlled, onValueChange]);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, orientation }}>
      <div
        className={cn(
          'flex',
          orientation === 'horizontal' ? 'flex-col' : 'flex-row'
        )}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// --- Tabs.List ---
Tabs.List = function TabsList({ children, className }: {
  children: ReactNode;
  className?: string;
}) {
  const { orientation } = useTabsContext();

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      className={cn(
        'flex gap-1',
        orientation === 'horizontal'
          ? 'border-b border-gray-200'
          : 'flex-col border-r border-gray-200',
        className
      )}
    >
      {children}
    </div>
  );
};

// --- Tabs.Trigger ---
Tabs.Trigger = function TabsTrigger({ value, children, disabled = false, className }: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;
  const ref = useRef<HTMLButtonElement>(null);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const triggers = ref.current?.parentElement?.querySelectorAll('[role="tab"]');
    if (!triggers) return;

    const currentIndex = Array.from(triggers).indexOf(ref.current!);
    let nextIndex: number;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % triggers.length;
        (triggers[nextIndex] as HTMLElement).focus();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
        (triggers[nextIndex] as HTMLElement).focus();
        break;
      case 'Home':
        e.preventDefault();
        (triggers[0] as HTMLElement).focus();
        break;
      case 'End':
        e.preventDefault();
        (triggers[triggers.length - 1] as HTMLElement).focus();
        break;
    }
  };

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      onKeyDown={handleKeyDown}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        isActive
          ? 'border-b-2 border-blue-500 text-blue-600'
          : 'text-gray-500 hover:text-gray-700',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
};

// --- Tabs.Content ---
Tabs.Content = function TabsContent({ value, children, className }: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { activeTab } = useTabsContext();
  const isActive = activeTab === value;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={cn('p-4 focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
};
```

### 3.3 Accordion Component Implementation

```typescript
// ============================================
// Compound Components: Accordion
// ============================================

type AccordionType = 'single' | 'multiple';

interface AccordionContextType {
  type: AccordionType;
  openItems: Set<string>;
  toggleItem: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextType | null>(null);

function useAccordionContext() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Accordion sub-components must be used inside <Accordion>');
  return ctx;
}

// --- Accordion body ---
interface AccordionProps {
  type?: AccordionType;
  defaultValue?: string | string[];
  children: ReactNode;
}

function Accordion({ type = 'single', defaultValue, children }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(() => {
    if (!defaultValue) return new Set();
    return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
  });

  const toggleItem = useCallback((value: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (type === 'single') {
          next.clear();
        }
        next.add(value);
      }
      return next;
    });
  }, [type]);

  return (
    <AccordionContext.Provider value={{ type, openItems, toggleItem }}>
      <div className="divide-y divide-gray-200 border rounded-lg">
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

// --- AccordionItem ---
const AccordionItemContext = createContext<string>('');

Accordion.Item = function AccordionItem({ value, children }: {
  value: string;
  children: ReactNode;
}) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className="border-b last:border-b-0">{children}</div>
    </AccordionItemContext.Provider>
  );
};

// --- AccordionTrigger ---
Accordion.Trigger = function AccordionTrigger({ children }: {
  children: ReactNode;
}) {
  const { openItems, toggleItem } = useAccordionContext();
  const value = useContext(AccordionItemContext);
  const isOpen = openItems.has(value);

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={`accordion-content-${value}`}
      onClick={() => toggleItem(value)}
      className="flex w-full items-center justify-between py-4 px-6 text-left font-medium transition-colors hover:bg-gray-50"
    >
      {children}
      <ChevronIcon
        className={cn(
          'h-4 w-4 transition-transform duration-200',
          isOpen && 'rotate-180'
        )}
      />
    </button>
  );
};

// --- AccordionContent ---
Accordion.Content = function AccordionContent({ children }: {
  children: ReactNode;
}) {
  const { openItems } = useAccordionContext();
  const value = useContext(AccordionItemContext);
  const isOpen = openItems.has(value);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div
      id={`accordion-content-${value}`}
      role="region"
      aria-labelledby={`accordion-trigger-${value}`}
      className="overflow-hidden transition-all duration-200"
      style={{ height: isOpen ? height : 0 }}
    >
      <div ref={contentRef} className="px-6 pb-4">
        {children}
      </div>
    </div>
  );
};
```

### 3.4 Benefits and Caveats of Compound Components Pattern

```
Benefits:
  ✓ Declarative and intuitive API
  ✓ Flexible layout customization
  ✓ Implicit state sharing between related components
  ✓ Avoids props drilling between components
  ✓ Independent styling for each sub-component

Caveats:
  ✗ Performance issues from excessive Context nesting
  ✗ TypeScript type definitions tend to be complex
  ✗ Managing static properties of function components (displayName, etc.)
  ✗ Hard to constrain usage of child components

Choosing implementation pattern:
  Static property approach:
    Tabs.List, Tabs.Trigger, Tabs.Content
    → Simple and intuitive
    → Tree-shaking may not work

  Named export approach:
    TabsList, TabsTrigger, TabsContent
    → Tree-shaking compatible
    → Import becomes verbose

  Recommended: shadcn/ui style named exports
    import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
```

---

## 4. Headless UI

### 4.1 Headless UI Concept

Headless UI is a UI component architecture that provides only logic, state management, and accessibility — with no styles included. This allows full visual customization while reusing complex interaction logic and accessibility.

```
Headless UI philosophy:
  → Complete separation of logic and presentation layers
  → WAI-ARIA standards compliance
  → Full keyboard navigation support
  → Automated focus management
  → Leaves all styling to the consumer

Problems with traditional UI libraries:
  → Difficult to customize appearance
  → Complex CSS overriding (!important hell)
  → Hard to integrate with design systems
  → Large bundle size

Problems solved by Headless UI:
  → Zero style constraints
  → Natural integration with existing CSS frameworks
  → Only required components can be used
  → No need to implement accessibility yourself
```

### 4.2 Comparison of Major Headless UI Libraries

```
Library comparison:

  ┌─────────────┬──────────┬─────────────┬──────────┬─────────┐
  │ Library      │ Developer│ Features     │ Size     │ Rating  │
  ├─────────────┼──────────┼─────────────┼──────────┼─────────┤
  │ Radix UI    │ WorkOS   │ Most popular, │ Medium   │ ★★★★★ │
  │             │          │ base of      │          │         │
  │             │          │ shadcn/ui    │          │         │
  ├─────────────┼──────────┼─────────────┼──────────┼─────────┤
  │ Headless UI │ Tailwind │ High         │ Small    │ ★★★★☆ │
  │             │ Labs     │ Tailwind fit │          │         │
  ├─────────────┼──────────┼─────────────┼──────────┼─────────┤
  │ React Aria  │ Adobe    │ Best         │ Large    │ ★★★★★ │
  │             │          │ accessibility│          │         │
  ├─────────────┼──────────┼─────────────┼──────────┼─────────┤
  │ Ariakit     │ OSS      │ Lightweight, │ Small    │ ★★★★☆ │
  │             │          │ composable   │          │         │
  │             │          │             │          │         │
  ├─────────────┼──────────┼─────────────┼──────────┼─────────┤
  │ Ark UI      │ Chakra   │ Zag.js      │ Medium   │ ★★★☆☆ │
  │             │          │ based,      │          │         │
  │             │          │ FW agnostic │          │         │
  └─────────────┴──────────┴─────────────┴──────────┴─────────┘
```

### 4.3 Practical Use of Radix UI

```typescript
// ============================================
// Building a custom Dialog with Radix UI + Tailwind CSS
// ============================================

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Dialog implementation in shadcn/ui style
const DialogRoot = Dialog.Root;
const DialogTrigger = Dialog.Trigger;

const DialogPortal = Dialog.Portal;

const DialogOverlay = forwardRef<
  React.ElementRef<typeof Dialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof Dialog.Overlay>
>(({ className, ...props }, ref) => (
  <Dialog.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = Dialog.Overlay.displayName;

const DialogContent = forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  React.ComponentPropsWithoutRef<typeof Dialog.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <Dialog.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-lg rounded-lg bg-white p-6 shadow-xl',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className
      )}
      {...props}
    >
      {children}
      <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:ring-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </Dialog.Close>
    </Dialog.Content>
  </DialogPortal>
));
DialogContent.displayName = Dialog.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);

const DialogTitle = forwardRef<
  React.ElementRef<typeof Dialog.Title>,
  React.ComponentPropsWithoutRef<typeof Dialog.Title>
>(({ className, ...props }, ref) => (
  <Dialog.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));

const DialogDescription = forwardRef<
  React.ElementRef<typeof Dialog.Description>,
  React.ComponentPropsWithoutRef<typeof Dialog.Description>
>(({ className, ...props }, ref) => (
  <Dialog.Description
    ref={ref}
    className={cn('text-sm text-gray-500', className)}
    {...props}
  />
));

// --- Usage example ---
function ConfirmDeleteDialog({ userName, onConfirm }: {
  userName: string;
  onConfirm: () => void;
}) {
  return (
    <DialogRoot>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {userName}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-6">
          <Dialog.Close asChild>
            <Button variant="outline">Cancel</Button>
          </Dialog.Close>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
```

### 4.4 How shadcn/ui Works and How to Use It

```
shadcn/ui design philosophy:
  → Radix UI (Headless) + Tailwind CSS (styles) + cva (variant management)
  → Not installed as an npm package
  → Add components by copy & paste
  → Fully customizable
  → Does not depend on node_modules
  → Peace of mind that component code is at hand

Setup steps:
  npx shadcn@latest init
  → tailwind.config.js configuration
  → CSS variable setup (theme colors)
  → Path configuration (components, lib, utils)

Adding components:
  npx shadcn@latest add button
  → src/components/ui/button.tsx is generated
  → Content can be freely edited

  npx shadcn@latest add dialog
  → src/components/ui/dialog.tsx is generated
  → Component wrapping Radix UI Dialog

  npx shadcn@latest add form
  → src/components/ui/form.tsx is generated
  → Integration with React Hook Form + Zod
```

```typescript
// shadcn/ui Button component (generated code)
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### 4.5 Component Library Selection Guide

| Category | Library | Features | Recommended Use |
|---------|-----------|------|-----------|
| Full style | MUI (Material UI) | Material Design compliant, feature-rich | Enterprise, Material preference |
| Full style | Ant Design | Enterprise-grade, from China | Admin panels, dashboards |
| Full style | Chakra UI | DX-focused, low learning cost | Small/medium scale, prototypes |
| Full style | Mantine | React-specific, modern design | React-only projects |
| Headless+style | shadcn/ui | Radix + Tailwind | New projects (recommended) |
| Headless+style | Ark UI | Zag.js based, FW agnostic | Multi-framework |
| Headless only | Radix UI | Most popular, high quality | Custom design |
| Headless only | React Aria | By Adobe, best a11y | Accessibility-focused |
| Headless only | Headless UI | By Tailwind Labs | Tailwind environment |

---

## 5. Props Design

### 5.1 Basic Principles of Props Design

Props design directly determines the usability and maintainability of a component. Good Props design achieves API consistency, type safety, and extensibility.

```typescript
// ============================================
// Principle 1: Extend HTML standard attributes
// ============================================

// Bad example: Uses custom prop names, ignores HTML standards
interface BadButtonProps {
  label: string;
  onPress: () => void;
  isDisabled: boolean;
  buttonType: 'submit' | 'button';
}

// Good example: Extends HTML standard attributes
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

function Button({
  variant = 'default',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className,
  ...props // onClick, type, form etc. are passed through as-is
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

// ============================================
// Principle 2: Composition using children
// ============================================

// Bad example: Control everything with props
<Card
  title="ユーザー情報"
  subtitle="基本情報"
  body={<UserDetails user={user} />}
  footer={<Button onClick={onSave}>Save</Button>}
  headerAction={<IconButton icon="edit" />}
/>

// Good example: children + Compound Components
<Card>
  <Card.Header>
    <Card.Title>User Information</Card.Title>
    <Card.Description>Basic Information</Card.Description>
    <Card.Action>
      <IconButton icon="edit" />
    </Card.Action>
  </Card.Header>
  <Card.Body>
    <UserDetails user={user} />
  </Card.Body>
  <Card.Footer>
    <Button onClick={onSave}>Save</Button>
  </Card.Footer>
</Card>

// ============================================
// Principle 3: Conditional Props (Discriminated Union)
// ============================================

// Require different props depending on status
type NotificationProps =
  | { type: 'success'; message: string }
  | { type: 'error'; message: string; retryAction: () => void }
  | { type: 'warning'; message: string; dismissable?: boolean }
  | { type: 'info'; message: string; link?: { label: string; href: string } };

function Notification(props: NotificationProps) {
  const baseClasses = 'p-4 rounded-lg flex items-start gap-3';

  switch (props.type) {
    case 'success':
      return (
        <div className={cn(baseClasses, 'bg-green-50 text-green-800')}>
          <CheckIcon className="h-5 w-5 text-green-500" />
          <p>{props.message}</p>
        </div>
      );
    case 'error':
      return (
        <div className={cn(baseClasses, 'bg-red-50 text-red-800')}>
          <XCircleIcon className="h-5 w-5 text-red-500" />
          <p>{props.message}</p>
          <Button size="sm" variant="outline" onClick={props.retryAction}>
            再試行
          </Button>
        </div>
      );
    case 'warning':
      return (
        <div className={cn(baseClasses, 'bg-yellow-50 text-yellow-800')}>
          <AlertIcon className="h-5 w-5 text-yellow-500" />
          <p>{props.message}</p>
          {props.dismissable && <CloseButton />}
        </div>
      );
    case 'info':
      return (
        <div className={cn(baseClasses, 'bg-blue-50 text-blue-800')}>
          <InfoIcon className="h-5 w-5 text-blue-500" />
          <p>{props.message}</p>
          {props.link && (
            <a href={props.link.href} className="underline">{props.link.label}</a>
          )}
        </div>
      );
  }
}

// Usage: Props are type-safely constrained
<Notification type="error" message="Save failed" retryAction={() => save()} />
// When type="error", retryAction is required
// When type="success", retryAction is not needed
```

### 5.2 Render Props and Slots Pattern

```typescript
// ============================================
// Render Props Pattern
// ============================================

// Flexible customization of DataTable
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  renderRow?: (item: T, index: number) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderHeader?: (column: ColumnDef<T>) => ReactNode;
  renderFooter?: (data: T[]) => ReactNode;
  renderLoading?: () => ReactNode;
  isLoading?: boolean;
}

function DataTable<T extends { id: string }>({
  data,
  columns,
  renderRow,
  renderEmpty,
  renderHeader,
  renderFooter,
  renderLoading,
  isLoading,
}: DataTableProps<T>) {
  if (isLoading && renderLoading) {
    return renderLoading();
  }

  if (data.length === 0 && renderEmpty) {
    return renderEmpty();
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.id}>
              {renderHeader ? renderHeader(col) : col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) =>
          renderRow ? (
            <Fragment key={item.id}>{renderRow(item, index)}</Fragment>
          ) : (
            <tr key={item.id}>
              {columns.map(col => (
                <td key={col.id}>{col.cell(item)}</td>
              ))}
            </tr>
          )
        )}
      </tbody>
      {renderFooter && (
        <tfoot>
          <tr><td colSpan={columns.length}>{renderFooter(data)}</td></tr>
        </tfoot>
      )}
    </table>
  );
}

// Usage example
<DataTable
  data={users}
  columns={userColumns}
  renderRow={(user) => (
    <tr className={user.isActive ? 'bg-white' : 'bg-gray-50'}>
      <td><UserInfo user={user} /></td>
      <td>{formatDate(user.createdAt)}</td>
      <td><UserActions user={user} /></td>
    </tr>
  )}
  renderEmpty={() => (
    <EmptyState
      icon="users"
      title="User not found"
      action={<Button onClick={onCreateUser}>Add User</Button>}
    />
  )}
  renderLoading={() => <TableSkeleton rows={5} columns={3} />}
  isLoading={isLoading}
/>
```

### 5.3 Variant Management (CVA: Class Variance Authority)

```typescript
// ============================================
// Practical variant management with CVA
// ============================================
import { cva, type VariantProps } from 'class-variance-authority';

// --- Alert component ---
const alertVariants = cva(
  // Base styles (always applied)
  'relative w-full rounded-lg border p-4 flex items-start gap-3',
  {
    variants: {
      variant: {
        default: 'bg-white border-gray-200 text-gray-900',
        info: 'bg-blue-50 border-blue-200 text-blue-900',
        success: 'bg-green-50 border-green-200 text-green-900',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
        error: 'bg-red-50 border-red-200 text-red-900',
      },
      size: {
        sm: 'p-3 text-sm',
        md: 'p-4 text-base',
        lg: 'p-6 text-lg',
      },
      dismissable: {
        true: 'pr-10',
        false: '',
      },
    },
    compoundVariants: [
      // Styles for specific combinations
      {
        variant: 'error',
        size: 'lg',
        className: 'border-2',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'md',
      dismissable: false,
    },
  }
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: ReactNode;
  onDismiss?: () => void;
}

function Alert({
  variant,
  size,
  dismissable,
  icon,
  onDismiss,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant, size, dismissable }), className)}
      {...props}
    >
      {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
      <div className="flex-1">{children}</div>
      {dismissable && (
        <button
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Usage example
<Alert variant="error" size="lg" dismissable onDismiss={() => setVisible(false)}>
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Failed to save data. Please try again.</AlertDescription>
</Alert>
```

---

## 6. Server / Client Component Boundaries

### 6.1 Component Design in Next.js App Router

In Next.js App Router, there are two types of components: Server Components and Client Components. Properly designing this boundary has a major impact on both performance and developer experience.

```
Basic rules:
  → Default is Server Component
  → 'use client' only when absolutely necessary
  → Push Client boundary as close to leaves as possible
  → Only serializable props can be passed from Server Component to Client Component
```

```typescript
// ============================================
// Good example: Small Client boundary
// ============================================

// page.tsx (Server Component)
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  const reviews = await getReviews(params.id);

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Server Component: static parts */}
      <h1 className="text-3xl font-bold">{product.name}</h1>
      <p className="mt-2 text-gray-600">{product.description}</p>

      {/* Server Component: image gallery (static) */}
      <ProductImageGallery images={product.images} />

      {/* Client Component: interactive parts only */}
      <ProductPrice price={product.price} discount={product.discount} />
      <AddToCartButton productId={product.id} />

      {/* Server Component: review list (static) */}
      <ReviewList reviews={reviews} />

      {/* Client Component: review submission form */}
      <ReviewForm productId={product.id} />
    </div>
  );
}

// ============================================
// Bad example: Entire page is Client
// ============================================

// 'use client';  ← Making the entire page Client
// function ProductPage({ params }) {
//   const { data: product } = useQuery(...);
//   // Everything runs client-side
//   // → Larger bundle size, slower initial load
// }
```

### 6.2 Criteria for Server/Client Component Selection

```
When to use Server Component:
  → Direct database access
  → Using server-side API keys and secrets
  → Large dependency packages (markdown parsers, syntax highlighters, etc.)
  → Processing sensitive information
  → Content where SEO is important
  → Parts where initial load performance matters

When to use Client Component:
  → React Hooks like useState, useEffect, useReducer are needed
  → Event handlers like onClick, onChange are needed
  → Access to browser APIs (localStorage, navigator, window, etc.)
  → Third-party client-side libraries
  → Using Context Provider
  → Animations and transitions
```

### 6.3 Boundary Design Patterns

```typescript
// ============================================
// Pattern 1: Make only interactive parts Client
// ============================================

// SearchableList.tsx (Server Component)
async function SearchableList() {
  // Fetch all data on server side
  const items = await fetchAllItems();

  return (
    <div>
      <h2>Item List</h2>
      {/* Make only search feature Client */}
      <SearchFilter items={items} />
    </div>
  );
}

// SearchFilter.tsx (Client Component)
'use client';
function SearchFilter({ items }: { items: Item[] }) {
  const [query, setQuery] = useState('');
  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <ul>
        {filtered.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </>
  );
}

// ============================================
// Pattern 2: Client boundary of Provider
// ============================================

// providers.tsx (Client Component)
'use client';
import { ThemeProvider } from 'next-themes';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// layout.tsx (Server Component)
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          {/* children remain as Server Component */}
          {children}
        </Providers>
      </body>
    </html>
  );
}

// ============================================
// Pattern 3: Pass Server Component as Children
// ============================================

// ClientWrapper.tsx (Client Component)
'use client';
function Sidebar({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside className={cn('transition-all', isOpen ? 'w-64' : 'w-16')}>
      <button onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'Close' : 'Open'}
      </button>
      {isOpen && children}
    </aside>
  );
}

// page.tsx (Server Component)
async function DashboardPage() {
  const navItems = await getNavItems(); // Fetch on server side

  return (
    <div className="flex">
      <Sidebar>
        {/* Server Componentのchildrenとして渡す */}
        <NavigationMenu items={navItems} />
      </Sidebar>
      <main>
        <DashboardContent />
      </main>
    </div>
  );
}
```

### 6.4 Server/Client 境界のアンチパターン

```typescript
// ============================================
// アンチパターン1: 不要な 'use client'
// ============================================

// 悪い: 静的なコンポーネントにuse clientを付けている
'use client'; // ← 不要！
function Footer() {
  return (
    <footer>
      <p>2024 My Company. All rights reserved.</p>
    </footer>
  );
}

// 良い: Server Componentとして維持
function Footer() {
  return (
    <footer>
      <p>2024 My Company. All rights reserved.</p>
    </footer>
  );
}

// ============================================
// アンチパターン2: Server Component で関数をpropsに渡す
// ============================================

// 悪い: Server Componentから関数をClient Componentに渡そうとする
async function Page() {
  const handleClick = () => { // ← シリアライズ不可能！
    console.log('clicked');
  };

  return <ClientButton onClick={handleClick} />; // エラー
}

// 良い: Server Actions を使う
async function Page() {
  async function handleSubmit(formData: FormData) {
    'use server';
    const name = formData.get('name');
    await saveUser({ name });
  }

  return (
    <form action={handleSubmit}>
      <input name="name" />
      <button type="submit">保存</button>
    </form>
  );
}

// ============================================
// アンチパターン3: Client境界が高すぎる
// ============================================

// 悪い: レイアウト全体をClientにしてしまう
'use client';
function Layout({ children }) {
  const [theme, setTheme] = useState('light');
  return (
    <div className={theme}>
      <Header />     {/* Server Componentにできるのに */}
      <Sidebar />    {/* Server Componentにできるのに */}
      {children}
      <Footer />     {/* Server Componentにできるのに */}
    </div>
  );
}

// 良い: テーマ切り替えのみをClientに
function Layout({ children }) {
  return (
    <ThemeProvider> {/* ClientのProvider */}
      <Header />     {/* Server Component */}
      <Sidebar />    {/* Server Component */}
      {children}
      <Footer />     {/* Server Component */}
    </ThemeProvider>
  );
}
```

---

## 7. コンポーネントのパフォーマンス最適化

### 7.1 React.memo による再レンダリング最適化

```typescript
// ============================================
// React.memo の適切な使い方
// ============================================

// React.memo を使うべき場面
// → 親が頻繁に再レンダリングされるが、子のpropsは変わらない
// → レンダリングコストが高い（大きなリスト、複雑な計算等）

// --- 例: 高コストのリストアイテム ---
const UserRow = memo(function UserRow({ user, onEdit }: {
  user: User;
  onEdit: (user: User) => void;
}) {
  return (
    <tr>
      <td>
        <div className="flex items-center gap-3">
          <Avatar src={user.avatar} alt={user.name} />
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      </td>
      <td>
        <Badge variant={user.isActive ? 'success' : 'default'}>
          {user.isActive ? 'アクティブ' : '非アクティブ'}
        </Badge>
      </td>
      <td>
        <Button variant="ghost" size="sm" onClick={() => onEdit(user)}>
          編集
        </Button>
      </td>
    </tr>
  );
});

// 親コンポーネント: onEditをuseCallbackで安定化
function UserTable({ users }: { users: User[] }) {
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // useCallbackで参照を安定化（React.memoの効果を最大化）
  const handleEdit = useCallback((user: User) => {
    setEditingUser(user);
  }, []);

  return (
    <table>
      <tbody>
        {users.map(user => (
          <UserRow key={user.id} user={user} onEdit={handleEdit} />
        ))}
      </tbody>
    </table>
  );
}

// ============================================
// React.memo を使うべきでない場面
// ============================================

// 1. propsが毎回変わるコンポーネント
//    → メモ化のオーバーヘッドが無駄
// 2. レンダリングコストが低いコンポーネント
//    → 比較コスト > レンダリングコスト
// 3. childrenを受け取るコンポーネント
//    → childrenは毎回新しいオブジェクト

// 悪い例: 毎回propsが変わる
const BadMemo = memo(function BadMemo({ items }: { items: Item[] }) {
  return <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
});

// 親: items を毎レンダリングで新しい配列を作成
function Parent() {
  const items = data.filter(d => d.active); // ← 毎回新しい配列
  return <BadMemo items={items} />; // ← memo の効果なし
}

// 良い例: useMemo で配列を安定化
function Parent() {
  const items = useMemo(() => data.filter(d => d.active), [data]);
  return <BadMemo items={items} />; // ← memo が効く
}
```

### 7.2 useMemo と useCallback

```typescript
// ============================================
// useMemo: 計算結果のメモ化
// ============================================

function ExpensiveComponent({ data, filters }: {
  data: DataItem[];
  filters: Filters;
}) {
  // 重い計算をメモ化
  const processedData = useMemo(() => {
    return data
      .filter(item => matchesFilters(item, filters))
      .map(item => transformItem(item))
      .sort((a, b) => b.score - a.score);
  }, [data, filters]);

  // グラフ用の集計データ
  const chartData = useMemo(() => {
    return processedData.reduce((acc, item) => {
      const month = item.date.substring(0, 7);
      acc[month] = (acc[month] || 0) + item.value;
      return acc;
    }, {} as Record<string, number>);
  }, [processedData]);

  return (
    <div>
      <DataChart data={chartData} />
      <DataTable data={processedData} />
    </div>
  );
}

// ============================================
// useCallback: コールバック関数のメモ化
// ============================================

function ParentComponent() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Item[]>([]);

  // setItemsは安定した参照なのでdeps不要
  const handleAddItem = useCallback((item: Item) => {
    setItems(prev => [...prev, item]);
  }, []);

  // 外部の値に依存する場合はdepsに含める
  const handleSubmit = useCallback(async () => {
    await submitItems(items, count);
  }, [items, count]);

  return (
    <div>
      <ItemList items={items} onAdd={handleAddItem} />
      <SubmitButton onSubmit={handleSubmit} />
      <Counter count={count} setCount={setCount} />
    </div>
  );
}
```

### 7.3 コンポーネントの遅延読み込み

```typescript
// ============================================
// React.lazy + Suspense による遅延読み込み
// ============================================

// 通常のimport（バンドルに含まれる）
// import HeavyChart from './HeavyChart';

// 遅延import（必要時にのみ読み込む）
const HeavyChart = lazy(() => import('./HeavyChart'));
const CodeEditor = lazy(() => import('./CodeEditor'));
const MarkdownPreview = lazy(() => import('./MarkdownPreview'));

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="analytics">分析</TabsTrigger>
          <TabsTrigger value="editor">エディタ</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel /> {/* 通常読み込み */}
        </TabsContent>

        <TabsContent value="analytics">
          <Suspense fallback={<ChartSkeleton />}>
            <HeavyChart /> {/* 遅延読み込み */}
          </Suspense>
        </TabsContent>

        <TabsContent value="editor">
          <Suspense fallback={<EditorSkeleton />}>
            <CodeEditor /> {/* 遅延読み込み */}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Next.js での dynamic import
// ============================================
import dynamic from 'next/dynamic';

// SSRを無効化して遅延読み込み
const MapComponent = dynamic(() => import('./Map'), {
  ssr: false, // サーバーサイドではレンダリングしない
  loading: () => <MapSkeleton />,
});

// 名前付きエクスポートの遅延読み込み
const BarChart = dynamic(
  () => import('./charts').then(mod => ({ default: mod.BarChart })),
  { loading: () => <ChartSkeleton /> }
);

function LocationPage() {
  return (
    <div>
      <h1>店舗検索</h1>
      <MapComponent locations={locations} />
      <BarChart data={chartData} />
    </div>
  );
}
```

### 7.4 仮想化（Virtualization）

```typescript
// ============================================
// 大量データの仮想スクロール
// ============================================

// @tanstack/react-virtual を使用
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // 各アイテムの推定高さ
    overscan: 5, // 画面外に余分にレンダリングする数
  });

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
        {virtualizer.getVirtualItems().map(virtualRow => (
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
            <ItemRow item={items[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// 10,000件のアイテムでもスムーズに動作
function LargeDataList() {
  const { data: items } = useItems(); // 10,000件

  return (
    <div>
      <p>{items?.length.toLocaleString()} 件のアイテム</p>
      <VirtualizedList items={items ?? []} />
    </div>
  );
}
```

---

## 8. コンポーネントのテスト戦略

### 8.1 テストの種類と使い分け

```
テストピラミッド:

  ┌────────────────┐
  │    E2E テスト    │  → 少数: ユーザーフロー全体
  │   (Playwright)  │
  ├────────────────┤
  │  統合テスト      │  → 中程度: コンポーネント間の連携
  │  (Testing Lib)  │
  ├────────────────┤
  │  単体テスト      │  → 多数: 個別コンポーネント
  │  (Vitest)       │
  └────────────────┘

各テストの役割:
  単体テスト:
  → 個々のコンポーネントを独立してテスト
  → propsを渡してレンダリング結果を検証
  → イベントハンドラの動作を検証
  → 高速、安定、保守容易

  統合テスト:
  → 複数コンポーネントの連携をテスト
  → データ取得 → 表示 → インタラクション
  → APIモック + コンポーネントレンダリング

  E2Eテスト:
  → 実際のブラウザで動作確認
  → ユーザーの操作フロー全体
  → CI/CDパイプラインで実行
```

### 8.2 コンポーネントの単体テスト

```typescript
// ============================================
// Vitest + React Testing Library
// ============================================

import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Button } from './Button';
import { UserCard } from './UserCard';
import { SearchForm } from './SearchForm';

// --- Button コンポーネントのテスト ---
describe('Button', () => {
  it('デフォルトのvariantでレンダリングされる', () => {
    render(<Button>クリック</Button>);
    const button = screen.getByRole('button', { name: 'クリック' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary');
  });

  it('destructive variantが適用される', () => {
    render(<Button variant="destructive">削除</Button>);
    const button = screen.getByRole('button', { name: '削除' });
    expect(button).toHaveClass('bg-destructive');
  });

  it('isLoading時にSpinnerが表示される', () => {
    render(<Button isLoading>保存</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('クリックイベントが発火する', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>クリック</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disabled時にクリックが無効になる', async () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>クリック</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});

// --- UserCard コンポーネントのテスト ---
describe('UserCard', () => {
  const mockUser = {
    id: '1',
    name: 'テストユーザー',
    email: 'test@example.com',
    role: 'admin' as const,
    isActive: true,
    avatar: '/avatar.png',
  };

  it('ユーザー情報が正しく表示される', () => {
    render(<UserCard user={mockUser} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('テストユーザー')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('アクティブステータスのバッジが表示される', () => {
    render(<UserCard user={mockUser} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('アクティブ')).toBeInTheDocument();
  });

  it('編集ボタンのクリックでonEditが呼ばれる', async () => {
    const handleEdit = vi.fn();
    render(<UserCard user={mockUser} onEdit={handleEdit} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '編集' }));
    expect(handleEdit).toHaveBeenCalledWith(mockUser);
  });
});

// --- SearchForm コンポーネントのテスト ---
describe('SearchForm', () => {
  it('検索クエリを入力して送信できる', async () => {
    const handleSearch = vi.fn();
    render(
      <SearchForm
        onSearch={handleSearch}
        categories={[
          { id: '1', name: 'カテゴリA' },
          { id: '2', name: 'カテゴリB' },
        ]}
      />
    );

    // テキスト入力
    const searchInput = screen.getByPlaceholderText('キーワードを入力...');
    await userEvent.type(searchInput, 'テスト検索');

    // フォーム送信
    await userEvent.click(screen.getByRole('button', { name: '検索' }));

    expect(handleSearch).toHaveBeenCalledWith(
      'テスト検索',
      expect.any(Object)
    );
  });
});
```

### 8.3 Storybookによるコンポーネントドキュメント

```typescript
// ============================================
// Storybook 7+ のCSF3形式
// ============================================

import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'ghost', 'link'],
      description: 'ボタンのスタイルバリアント',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: 'ボタンのサイズ',
    },
    isLoading: {
      control: 'boolean',
      description: 'ローディング状態',
    },
    disabled: {
      control: 'boolean',
      description: '無効状態',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// デフォルトストーリー
export const Default: Story = {
  args: {
    children: 'ボタン',
  },
};

// バリアント一覧
export const Variants: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// サイズ一覧
export const Sizes: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

// ローディング状態
export const Loading: Story = {
  args: {
    isLoading: true,
    children: '保存中...',
  },
};

// アイコン付き
export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button leftIcon={<PlusIcon className="h-4 w-4" />}>
        追加
      </Button>
      <Button rightIcon={<ArrowRightIcon className="h-4 w-4" />}>
        次へ
      </Button>
      <Button variant="destructive" leftIcon={<TrashIcon className="h-4 w-4" />}>
        削除
      </Button>
    </div>
  ),
};
```

---

## 9. 大規模アプリケーションでのコンポーネント管理

### 9.1 ディレクトリ構成のパターン

```
推奨ディレクトリ構成（Feature-based）:

  src/
  ├── app/                      # Next.js App Router ルーティング
  │   ├── (auth)/               # 認証レイアウトグループ
  │   │   ├── login/
  │   │   └── register/
  │   ├── (dashboard)/          # ダッシュボードレイアウトグループ
  │   │   ├── users/
  │   │   ├── products/
  │   │   └── settings/
  │   └── layout.tsx
  ├── components/
  │   ├── ui/                   # 汎用UIコンポーネント（shadcn/ui等）
  │   │   ├── button.tsx
  │   │   ├── dialog.tsx
  │   │   ├── input.tsx
  │   │   └── ...
  │   ├── layout/               # レイアウトコンポーネント
  │   │   ├── header.tsx
  │   │   ├── sidebar.tsx
  │   │   └── footer.tsx
  │   └── shared/               # 共通ドメインコンポーネント
  │       ├── data-table.tsx
  │       ├── empty-state.tsx
  │       └── page-header.tsx
  ├── features/                 # 機能ごとのモジュール
  │   ├── users/
  │   │   ├── components/       # ユーザー機能のコンポーネント
  │   │   │   ├── user-card.tsx
  │   │   │   ├── user-form.tsx
  │   │   │   └── user-table.tsx
  │   │   ├── hooks/            # ユーザー機能のフック
  │   │   │   ├── use-users.ts
  │   │   │   └── use-user-form.ts
  │   │   ├── api/              # ユーザーAPI
  │   │   │   └── users.ts
  │   │   ├── types/            # ユーザー型定義
  │   │   │   └── user.ts
  │   │   └── index.ts          # 公開API
  │   ├── products/
  │   │   ├── components/
  │   │   ├── hooks/
  │   │   ├── api/
  │   │   └── index.ts
  │   └── auth/
  │       ├── components/
  │       ├── hooks/
  │       └── index.ts
  ├── hooks/                    # グローバルフック
  │   ├── use-debounce.ts
  │   ├── use-media-query.ts
  │   └── use-local-storage.ts
  ├── lib/                      # ユーティリティ
  │   ├── utils.ts
  │   ├── api-client.ts
  │   └── validations.ts
  └── types/                    # グローバル型定義
      └── global.d.ts
```

### 9.2 コンポーネントの命名規則

```
命名規則のベストプラクティス:

  コンポーネント名:
  → PascalCase を使用
  → 具体的な名前にする（Button, UserCard, ProductList）
  → 抽象的な名前を避ける（Wrapper, Container, Manager）
  → ドメイン接頭辞で名前空間を表現（UserCard, UserForm, UserTable）

  ファイル名:
  → kebab-case を推奨（user-card.tsx, product-list.tsx）
  → shadcn/ui スタイル: button.tsx, dialog.tsx
  → 1ファイル1コンポーネントが基本
  → 関連する小さなコンポーネントは同居可能

  Props型名:
  → コンポーネント名 + Props（ButtonProps, UserCardProps）
  → interface を使用（typeでも可だが統一する）

  フック名:
  → use + 動詞/名詞（useUsers, useDebounce, useLocalStorage）
  → カスタムフックは必ず use で始める

  定数・バリアント:
  → camelCase（buttonVariants, alertStyles）
  → UPPER_SNAKE_CASE は設定値のみ（MAX_RETRY_COUNT）
```

### 9.3 コンポーネント設計チェックリスト

```
新しいコンポーネントを作成する際のチェックリスト:

  設計:
  □ 単一責任原則を満たしているか
  □ 適切な粒度レベルか（プリミティブ/複合/ドメイン/ページ）
  □ 既存コンポーネントで代替できないか
  □ 再利用の可能性はあるか

  Props設計:
  □ HTML標準属性を拡張しているか
  □ 必要最小限のpropsか
  □ TypeScriptの型定義が適切か
  □ デフォルト値が設定されているか
  □ Discriminated Unionで型安全か

  アクセシビリティ:
  □ 適切なARIA属性が設定されているか
  □ キーボードナビゲーションに対応しているか
  □ フォーカス管理が適切か
  □ スクリーンリーダーで正しく読み上げられるか
  □ 色のコントラスト比が十分か

  パフォーマンス:
  □ 不要な再レンダリングがないか
  □ React.memoが必要か検討したか
  □ 大きな依存は遅延読み込みしているか
  □ 大量データは仮想化しているか

  テスト:
  □ 単体テストが書かれているか
  □ Storybookストーリーがあるか
  □ エッジケース（空データ、エラー、ローディング）をテストしているか

  Server/Client境界:
  □ Server Componentで十分ではないか
  □ Client境界は最小限か
  □ propsはシリアライズ可能か
```

---

## 10. トラブルシューティング

### 10.1 よくある問題と解決策

```typescript
// ============================================
// 問題1: propsバケツリレー（Prop Drilling）
// ============================================

// 問題: 深い階層にpropsを渡すために中間コンポーネントが不要なpropsを受け取る
function App() {
  const [theme, setTheme] = useState('light');
  return <Layout theme={theme} setTheme={setTheme} />;
}
function Layout({ theme, setTheme }) {
  return <Sidebar theme={theme} setTheme={setTheme} />;
}
function Sidebar({ theme, setTheme }) {
  return <ThemeToggle theme={theme} setTheme={setTheme} />;
}

// 解決策1: Context API
const ThemeContext = createContext<{
  theme: string;
  setTheme: (theme: string) => void;
}>({ theme: 'light', setTheme: () => {} });

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// どの階層からでもアクセス可能
function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      {theme === 'light' ? 'ダークモード' : 'ライトモード'}
    </button>
  );
}

// 解決策2: コンポジション（childrenを活用）
function Layout() {
  return (
    <div className="flex">
      <Sidebar />
      <main>{/* ... */}</main>
    </div>
  );
}

// ============================================
// 問題2: 不要な再レンダリング
// ============================================

// 問題: Contextの値が変わると全ての消費者が再レンダリング
function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);

  // ← user, theme, notifications のどれが変わっても全消費者が再レンダリング
  return (
    <AppContext.Provider value={{ user, setUser, theme, setTheme, notifications, setNotifications }}>
      {children}
    </AppContext.Provider>
  );
}

// 解決策: Contextを分割する
function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================
// 問題3: コンポーネントの循環依存
// ============================================

// 問題: A が B をimport し、B が A をimportする
// ComponentA.tsx
// import { ComponentB } from './ComponentB'; // ← 循環！
// ComponentB.tsx
// import { ComponentA } from './ComponentA'; // ← 循環！

// 解決策: 共通部分を別ファイルに抽出
// shared.tsx - 共通の型やユーティリティ
export interface SharedProps { /* ... */ }

// ComponentA.tsx
import { SharedProps } from './shared';
// ComponentAのみの実装

// ComponentB.tsx
import { SharedProps } from './shared';
// ComponentBのみの実装
```

### 10.2 デバッグのテクニック

```typescript
// ============================================
// React DevTools でのコンポーネントデバッグ
// ============================================

// 1. displayName の設定（React DevToolsで識別しやすくする）
const MemoizedComponent = memo(function MyComponent(props) {
  return <div>{/* ... */}</div>;
});
MemoizedComponent.displayName = 'MemoizedComponent';

// forwardRef の場合
const ForwardedInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});
ForwardedInput.displayName = 'ForwardedInput';

// 2. useDebugValue でカスタムフックの値をDevToolsに表示
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useDebugValue(isOnline ? 'オンライン' : 'オフライン');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// 3. React Profiler で再レンダリングの原因を特定
import { Profiler } from 'react';

function onRender(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  console.log(`[${id}] ${phase}: ${actualDuration.toFixed(2)}ms`);
}

function App() {
  return (
    <Profiler id="UserList" onRender={onRender}>
      <UserList />
    </Profiler>
  );
}

// 4. why-did-you-render ライブラリ
// wdyr.ts
import React from 'react';
if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    logOnDifferentValues: true,
  });
}

// 特定のコンポーネントを追跡
UserList.whyDidYouRender = true;
```

---

## FAQ

### Q1: Atomic DesignとFeature-based構成はどう共存させるか？
Atomic Designはコンポーネントの粒度（Atoms/Molecules/Organisms/Templates/Pages）を定義するための設計思想であり、Feature-basedはプロジェクトのディレクトリ構成のアプローチである。両者は共存可能で、実務では `shared/components/ui/` にAtoms/Molecules相当の汎用UIコンポーネント（Button, Input, Card等）を配置し、`features/xxx/components/` にOrganism相当のドメイン固有コンポーネントを配置するパターンが多い。Atomic Designの5階層を厳密に守る必要はなく、「汎用UI」と「ドメインUI」の2層に簡略化するのが実践的である。

### Q2: Server ComponentとClient Componentの境界はどう決めるか？
基本原則は「Client Componentを可能な限り小さく、末端に配置する」である。データ取得やレンダリングのみのコンポーネントはServer Component、useState/useEffectやイベントハンドラを使うコンポーネントはClient Componentにする。具体的には、ページ全体をServer Componentで構築し、検索入力、モーダル、フォームなどインタラクティブな部分のみを `'use client'` で囲む。こうすることでJavaScriptバンドルサイズが最小化され、初期ロードが高速になる。

### Q3: コンポーネントライブラリ（shadcn/ui等）はカスタマイズすべきか？
shadcn/uiはコピー&ペースト型のUIライブラリであり、プロジェクトに直接コードを取り込むため自由にカスタマイズできる。推奨アプローチは、まずshadcn/uiのデフォルトスタイルをそのまま使い、デザイン要件に合わせて段階的にカスタマイズすることである。Tailwind CSSの設定（`tailwind.config.ts`）でブランドカラーやフォントを調整し、個別コンポーネントのvariantsをcva（class-variance-authority）で管理すると一貫性を保ちやすい。ゼロからUIを構築するよりも、既存ライブラリをベースにカスタマイズする方が圧倒的に効率的である。

---

## まとめ

### Component Architectureパターンの全体マップ

| パターン | 用途 | 適用場面 | 難易度 |
|---------|------|---------|--------|
| SRP分割 | 責任の分離 | 全プロジェクト | 低 |
| Atomic Design | UIの階層化 | デザインシステム | 中 |
| Container/Presentational | ロジックとUIの分離 | データ表示コンポーネント | 低 |
| Custom Hooks | ロジックの再利用 | 共通処理の抽出 | 低 |
| Compound Components | 関連UIの宣言的な組み合わせ | Tabs, Accordion等 | 中 |
| Headless UI | ロジック提供、スタイルは自由 | カスタムUI構築 | 中 |
| Variants（cva） | バリアント管理 | デザインシステム | 低 |
| Render Props | 表示のカスタマイズ | 柔軟なUI | 中 |
| Server/Client境界 | Client を最小限に | Next.js App Router | 中 |
| React.memo | 再レンダリング最適化 | パフォーマンス改善 | 中 |
| Virtualization | 大量データ表示 | リスト/テーブル | 高 |
| Lazy Loading | バンドル最適化 | 大きなコンポーネント | 低 |

### 設計判断のフローチャート

```
新しいUIを作る時の判断フロー:

  1. 既存コンポーネントで代替可能？
     → Yes: 既存を使う
     → No: 次へ

  2. UIライブラリ（shadcn/ui等）に同等品がある？
     → Yes: ライブラリを使う
     → No: 次へ

  3. 複数箇所で再利用する？
     → Yes: components/ui/ に汎用コンポーネントを作成
     → No: features/xxx/components/ にドメインコンポーネントを作成

  4. インタラクティブ要素がある？
     → Yes: Client Component（'use client'）
     → No: Server Component のまま

  5. ロジックが複雑？
     → Yes: カスタムフックに抽出
     → No: コンポーネント内にロジックを保持

  6. 大量データを表示する？
     → Yes: 仮想化を検討
     → No: 通常レンダリング
```

---

## 次に読むべきガイド

---

## 参考文献
1. Radix. "Primitives." radix-ui.com, 2024.
2. shadcn/ui. "Re-usable components." ui.shadcn.com, 2024.
3. patterns.dev. "Component Patterns." patterns.dev, 2024.
4. React. "Server Components." react.dev, 2024.
5. Kent C. Dodds. "One React Component Pattern To Rule Them All." kentcdodds.com, 2024.
6. Dan Abramov. "Presentational and Container Components." medium.com, 2015.
7. TanStack. "React Virtual." tanstack.com, 2024.
8. Storybook. "Component Story Format." storybook.js.org, 2024.
9. Joe Bell. "Class Variance Authority." cva.style, 2024.
10. Adobe. "React Aria." react-spectrum.adobe.com, 2024.
