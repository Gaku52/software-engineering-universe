# MVC / MVVM — UI Design Pattern Comparison

> A practical guide for comparing the three UI architecture patterns — MVC, MVP, and MVVM — and choosing the best fit for your framework and platform. Covers historical background, data flow, testing strategies, and anti-patterns — everything you need for real-world work.

---

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| Object-Oriented Programming | Basics (classes, interfaces) | [02-programming](../../../../02-programming/) |
| TypeScript / JavaScript Fundamentals | Intermediate (types, async) | [02-programming](../../../../02-programming/) |
| HTML / CSS / DOM Basics | Basics | [04-web-and-network](../../../../04-web-and-network/) |
| Core Design Pattern Concepts | Basics (Observer, Strategy) | ../01-creational/ |
| Clean Code Principles | Basics (separation of concerns, SRP) | ../../clean-code-principles/ |

---

## What You Will Learn

1. **MVC (Model-View-Controller)** — structure, implementation in web frameworks, and the differences between server-side and client-side usage
2. **MVP (Model-View-Presenter)** — characteristics, improvements over MVC, and increased testability
3. **MVVM (Model-View-ViewModel)** — data binding, reactive design, and application in modern frameworks
4. **Choosing the right pattern** — optimal choices per framework and platform, and migration strategies
5. **Testing strategies** — how to write unit and integration tests for each pattern

---

## 1. Overview of UI Architecture Patterns

### WHY: Why Do UI Patterns Matter?

GUI applications tend to tightly couple "rendering", "input handling", "business logic", and "data persistence". Without patterns, the following problems arise:

1. **Hard to test** — logic cannot be verified without rendering the UI
2. **Change propagation** — changes to screens affect business logic
3. **Blocked parallel development** — designers and developers edit the same files
4. **No code reuse** — the same logic cannot be shared between web and mobile

To solve these problems, various UI architecture patterns have been devised since Smalltalk MVC in 1979.

### 1.1 Historical Relationships and Evolution of the Three Patterns

```
┌─────────────────────────────────────────────────────────────────────┐
│                Evolution of UI Architecture Patterns                │
│                                                                     │
│  1979 Smalltalk-80 (Trygve Reenskaug)                               │
│  ┌────────┐                                                         │
│  │  MVC   │ ← Original: separation pattern for desktop GUIs        │
│  └────┬───┘                                                         │
│       │                                                             │
│       ├─── 1996 Taligent MVP ──────────────┐                        │
│       │    Dolphin Smalltalk MVP            │                       │
│       │                                     │                       │
│  ┌────▼────┐                          ┌────▼─────┐                  │
│  │ Web MVC │ (2004 Rails)             │  MVVM    │ (2005 WPF)      │
│  │ Server  │                          │ ViewModel│ John Gossman    │
│  │ Side    │                          └──────────┘                  │
│  └────┬────┘                                                        │
│       │                                                             │
│  ┌────▼────────────────────────────────────────────┐                │
│  │ Client-Side MV* (2010s)                         │                │
│  │ Backbone.js → AngularJS → React → Vue → Svelte │                │
│  │ → effectively a MVVM + Flux/Redux hybrid        │                │
│  └─────────────────────────────────────────────────┘                │
│                                                                     │
│  Modern Frameworks:                                                 │
│  Rails/Django/Laravel → Server-Side MVC                             │
│  React/Vue/Svelte    → Close to MVVM (Component-Based)             │
│  SwiftUI/Compose     → MVVM (Declarative UI)                       │
│  Android Views       → MVP → MVVM (Jetpack)                        │
│  WPF / .NET MAUI     → MVVM (origin of data binding)              │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Comparison of the Three Patterns

```
┌────────────────── MVC ──────────────────┐
│                                         │
│   User Action                           │
│       │                                 │
│       ▼                                 │
│  ┌──────────┐   Update    ┌──────┐      │
│  │Controller│ ───────────→ │Model │     │
│  └──────────┘              └──┬───┘     │
│       │                      │          │
│       │ Select View   Notify │          │
│       ▼                      ▼          │
│  ┌────────────────────────────┐         │
│  │          View              │         │
│  └────────────────────────────┘         │
│                                         │
│  Key: Controller selects "what to       │
│       show". View may reference Model   │
│       directly (Observer).              │
└─────────────────────────────────────────┘

┌────────────────── MVP ──────────────────┐
│                                         │
│   User Action                           │
│       │                                 │
│       ▼                                 │
│  ┌──────┐  Event      ┌──────────┐      │
│  │ View │ ──────────→ │Presenter │      │
│  └──────┘             └────┬─────┘      │
│       ▲                    │            │
│       │ Update UI    Model op.          │
│       │                    ▼            │
│       │               ┌──────┐          │
│       └────────────── │Model │          │
│                       └──────┘          │
│                                         │
│  Key: View and Presenter are 1:1.       │
│       Presenter holds a View reference  │
│       and explicitly updates the UI.    │
└─────────────────────────────────────────┘

┌────────────────── MVVM ─────────────────┐
│                                         │
│   User Action                           │
│       │                                 │
│       ▼                                 │
│  ┌──────┐  Data      ┌──────────┐       │
│  │ View │←─Binding──→│ViewModel │      │
│  └──────┘             └─────┬────┘      │
│                             │           │
│                       Model op.         │
│                             ▼           │
│                       ┌──────┐          │
│                       │Model │          │
│                       └──────┘          │
│                                         │
│  Key: ViewModel does not know View.     │
│       Data binding automatically        │
│       handles two-way sync (reactive).  │
└─────────────────────────────────────────┘
```

### 1.3 Responsibility Matrix for Each Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│               Responsibility Placement Comparison               │
│                                                                 │
│  Responsibility      │  MVC           │  MVP          │  MVVM  │
│  ───────────────────┼────────────────┼───────────────┼────────│
│  Accept input       │  Controller    │  View         │  View  │
│  Interpret input    │  Controller    │  Presenter    │  VM    │
│  Business logic     │  Model         │  Model        │  Model │
│  Display data xform │  View/Controller│  Presenter   │  VM    │
│  UI rendering       │  View          │  View         │  View  │
│  UI update trigger  │  Model (notify)│  Presenter    │  Bind. │
│  State management   │  Model         │  Presenter    │  VM    │
│  View reference     │  Controller    │  Presenter    │  None  │
│  Testability        │  Medium        │  High         │  High  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Implementing MVC

### WHY: Why Did MVC Become the Standard for Server-Side Web?

MVC maps naturally to HTTP's request/response model:
- **Request** → Controller handles routing
- **Business logic** → processed in the Model
- **Response** → View generates HTML

This simple correspondence was adopted by frameworks like Rails (2004), Django (2005), and Laravel (2011), making it the de facto standard for web development.

### 2.1 MVC Structure (Ruby on Rails Example)

```ruby
# Model — business logic and data access
# app/models/user.rb
class User < ApplicationRecord
  has_many :posts, dependent: :destroy
  has_many :comments
  belongs_to :organization, optional: true

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :name, presence: true, length: { maximum: 100 }
  validates :age, numericality: { greater_than: 0, less_than: 150 }, allow_nil: true

  scope :active, -> { where(active: true) }
  scope :recent, -> { order(created_at: :desc).limit(10) }
  scope :with_posts, -> { includes(:posts).where.not(posts: { id: nil }) }

  # Business logic belongs in the Model
  def full_name
    "#{first_name} #{last_name}"
  end

  def deactivate!
    update!(active: false, deactivated_at: Time.current)
  end

  def can_post?
    active? && posts.where("created_at > ?", 1.day.ago).count < 10
  end
end
```

```ruby
# Controller — request handling and response control
# app/controllers/users_controller.rb
class UsersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_user, only: [:show, :edit, :update, :destroy]

  def index
    @users = User.active.recent
    respond_to do |format|
      format.html                    # Render View template
      format.json { render json: @users }
    end
  end

  def show
    @posts = @user.posts.recent
  end

  def create
    @user = User.new(user_params)
    if @user.save
      UserMailer.welcome(@user).deliver_later
      redirect_to @user, notice: "User created successfully"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @user.update(user_params)
      redirect_to @user, notice: "User updated successfully"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @user.deactivate!
    redirect_to users_path, notice: "User deactivated"
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  def user_params
    params.require(:user).permit(:name, :email, :first_name, :last_name, :age)
  end
end
```

```erb
<!-- View — presentation -->
<!-- app/views/users/index.html.erb -->
<h1>User List</h1>

<div class="search-bar">
  <%= form_tag users_path, method: :get do %>
    <%= text_field_tag :q, params[:q], placeholder: "Search by name..." %>
    <%= submit_tag "Search" %>
  <% end %>
</div>

<% if @users.any? %>
  <div class="user-list">
    <% @users.each do |user| %>
      <div class="user-card">
        <h2><%= user.full_name %></h2>
        <p class="email"><%= user.email %></p>
        <p class="stats">Posts: <%= user.posts.count %></p>
        <%= link_to "Details", user_path(user), class: "btn" %>
      </div>
    <% end %>
  </div>
  <%= paginate @users %>
<% else %>
  <p class="empty-state">No users found</p>
<% end %>
```

### 2.2 MVC (Express + TypeScript)

```typescript
// ============================================================
// Model — business logic and data access
// ============================================================
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "moderator";
  active: boolean;
  createdAt: Date;
}

interface CreateUserDTO {
  name: string;
  email: string;
  role?: "admin" | "user" | "moderator";
}

class UserModel {
  constructor(private db: Database) {}

  async findAll(options?: {
    page?: number;
    limit?: number;
    active?: boolean;
  }): Promise<{ users: User[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    const whereClause = options?.active !== undefined
      ? "WHERE active = $3"
      : "";

    const params = options?.active !== undefined
      ? [limit, offset, options.active]
      : [limit, offset];

    const [rows, countResult] = await Promise.all([
      this.db.query(
        `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        params
      ),
      this.db.query(`SELECT COUNT(*) as total FROM users ${whereClause}`),
    ]);

    return { users: rows, total: countResult[0].total };
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.query(
      "SELECT * FROM users WHERE id = $1",
      [id]
    );
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db.query(
      "SELECT * FROM users WHERE email = $1",
      [id]
    );
    return rows[0] ?? null;
  }

  async create(data: CreateUserDTO): Promise<User> {
    const id = crypto.randomUUID();
    const rows = await this.db.query(
      `INSERT INTO users (id, name, email, role, active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW()) RETURNING *`,
      [id, data.name, data.email, data.role ?? "user"]
    );
    return rows[0];
  }

  async update(id: string, data: Partial<CreateUserDTO>): Promise<User | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        sets.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (sets.length === 0) return this.findById(id);

    params.push(id);
    const rows = await this.db.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return rows[0] ?? null;
  }
}

// ============================================================
// Controller — request handling and response control
// ============================================================
class UserController {
  constructor(private model: UserModel) {}

  async index(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const { users, total } = await this.model.findAll({ page, active: true });

    // Content Negotiation
    if (req.accepts("json")) {
      res.json({ data: users, total, page });
    } else {
      res.render("users/index", { users, total, page });
    }
  }

  async show(req: Request, res: Response): Promise<void> {
    const user = await this.model.findById(req.params.id);
    if (!user) {
      res.status(404).render("errors/404", { message: "User not found" });
      return;
    }
    res.render("users/show", { user });
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      // Validation
      const { name, email, role } = req.body;
      if (!name || !email) {
        res.status(422).render("users/new", {
          errors: ["Name and email are required"],
        });
        return;
      }

      // Duplicate check
      const existing = await this.model.findByEmail(email);
      if (existing) {
        res.status(422).render("users/new", {
          errors: ["This email address is already registered"],
        });
        return;
      }

      const user = await this.model.create({ name, email, role });
      res.redirect(`/users/${user.id}`);
    } catch (error) {
      res.status(500).render("errors/500", {
        message: "Failed to create user",
      });
    }
  }
}

// ============================================================
// Router (routing definition)
// ============================================================
const userModel = new UserModel(database);
const userController = new UserController(userModel);

router.get("/users", (req, res) => userController.index(req, res));
router.get("/users/:id", (req, res) => userController.show(req, res));
router.post("/users", (req, res) => userController.create(req, res));
```

### 2.3 MVC (Django / Python)

```python
# ============================================================
# Model — Django ORM
# ============================================================
# models.py
from django.db import models
from django.core.validators import MinValueValidator

class User(models.Model):
    """User model — consolidate business logic in the model"""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        USER = "user", "General User"
        MODERATOR = "moderator", "Moderator"

    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.email})"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    def deactivate(self):
        """Deactivate user (soft delete)"""
        self.active = False
        self.save(update_fields=["active"])


# ============================================================
# View (in Django, the View acts as the Controller)
# ============================================================
# views.py
from django.views.generic import ListView, DetailView, CreateView
from django.contrib.auth.mixins import LoginRequiredMixin

class UserListView(LoginRequiredMixin, ListView):
    """Display user list"""
    model = User
    template_name = "users/list.html"
    context_object_name = "users"
    paginate_by = 20

    def get_queryset(self):
        qs = super().get_queryset().filter(active=True)
        query = self.request.GET.get("q")
        if query:
            qs = qs.filter(name__icontains=query)
        return qs


class UserDetailView(LoginRequiredMixin, DetailView):
    """Display user detail"""
    model = User
    template_name = "users/detail.html"
    context_object_name = "user"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["posts"] = self.object.posts.all()[:10]
        return context


class UserCreateView(LoginRequiredMixin, CreateView):
    """Create user"""
    model = User
    template_name = "users/form.html"
    fields = ["name", "email", "role"]
    success_url = "/users/"

    def form_valid(self, form):
        # Additional business logic
        response = super().form_valid(form)
        send_welcome_email.delay(self.object.id)  # Async task
        return response
```

---

## 3. Implementing MVP

### WHY: Why Was MVP Born as an Improvement Over MVC?

The problem with MVC was that the View could directly reference the Model. This led to:
1. High coupling between View and Model
2. Mocking the Model is required to test the View
3. Ambiguity about where to place presentation logic

MVP addressed these issues by placing the Presenter as the sole intermediary between View and Model.

### 3.1 MVP (Android Kotlin — Traditional View System)

```kotlin
// ============================================================
// Contract — defines interfaces for View and Presenter
// ============================================================
interface UserListContract {
    interface View {
        fun showUsers(users: List<UserUiModel>)
        fun showLoading()
        fun hideLoading()
        fun showError(message: String)
        fun navigateToDetail(userId: String)
    }

    interface Presenter {
        fun loadUsers()
        fun onUserClicked(userId: String)
        fun onSearchQueryChanged(query: String)
        fun onDestroy()
    }
}

// ============================================================
// Model — data access and business logic
// ============================================================
data class User(
    val id: String,
    val name: String,
    val email: String,
    val active: Boolean
)

data class UserUiModel(
    val id: String,
    val displayName: String,
    val email: String,
    val statusBadge: String
)

interface UserRepository {
    suspend fun getUsers(): Result<List<User>>
    suspend fun searchUsers(query: String): Result<List<User>>
}

// ============================================================
// Presenter — the core of the logic
// ============================================================
class UserListPresenter(
    private val view: UserListContract.View,
    private val repository: UserRepository,
    private val dispatcher: CoroutineDispatcher = Dispatchers.Main
) : UserListContract.Presenter {

    private val scope = CoroutineScope(dispatcher + SupervisorJob())

    override fun loadUsers() {
        view.showLoading()
        scope.launch {
            repository.getUsers()
                .onSuccess { users ->
                    val uiModels = users.map { it.toUiModel() }
                    view.hideLoading()
                    view.showUsers(uiModels)
                }
                .onFailure { error ->
                    view.hideLoading()
                    view.showError("Failed to load users: ${error.message}")
                }
        }
    }

    override fun onUserClicked(userId: String) {
        view.navigateToDetail(userId)
    }

    override fun onSearchQueryChanged(query: String) {
        scope.launch {
            repository.searchUsers(query)
                .onSuccess { users ->
                    view.showUsers(users.map { it.toUiModel() })
                }
        }
    }

    override fun onDestroy() {
        scope.cancel()
    }

    private fun User.toUiModel() = UserUiModel(
        id = id,
        displayName = name,
        email = email,
        statusBadge = if (active) "Active" else "Inactive"
    )
}

// ============================================================
// View (Activity) — rendering only
// ============================================================
class UserListActivity : AppCompatActivity(), UserListContract.View {

    private lateinit var presenter: UserListContract.Presenter
    private lateinit var adapter: UserListAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_list)

        adapter = UserListAdapter { userId ->
            presenter.onUserClicked(userId)
        }
        recyclerView.adapter = adapter

        presenter = UserListPresenter(
            view = this,
            repository = UserRepositoryImpl(apiService)
        )
        presenter.loadUsers()
    }

    override fun showUsers(users: List<UserUiModel>) {
        adapter.submitList(users)
    }

    override fun showLoading() {
        progressBar.visibility = View.VISIBLE
    }

    override fun hideLoading() {
        progressBar.visibility = View.GONE
    }

    override fun showError(message: String) {
        Snackbar.make(rootView, message, Snackbar.LENGTH_LONG).show()
    }

    override fun navigateToDetail(userId: String) {
        startActivity(UserDetailActivity.intent(this, userId))
    }

    override fun onDestroy() {
        super.onDestroy()
        presenter.onDestroy()
    }
}
```

### 3.2 MVP Testing (Presenter Unit Tests)

```kotlin
// ============================================================
// Presenter tests — mocking the View
// ============================================================
class UserListPresenterTest {

    private lateinit var view: UserListContract.View
    private lateinit var repository: UserRepository
    private lateinit var presenter: UserListPresenter

    @Before
    fun setup() {
        view = mock()
        repository = mock()
        // Run synchronously with a test dispatcher
        presenter = UserListPresenter(view, repository, Dispatchers.Unconfined)
    }

    @Test
    fun `loadUsers - shows user list on success`() = runTest {
        // Arrange
        val users = listOf(
            User("1", "Alice", "alice@example.com", true),
            User("2", "Bob", "bob@example.com", false),
        )
        whenever(repository.getUsers()).thenReturn(Result.success(users))

        // Act
        presenter.loadUsers()

        // Assert
        verify(view).showLoading()
        verify(view).hideLoading()
        verify(view).showUsers(argThat { size == 2 })
        verify(view, never()).showError(any())
    }

    @Test
    fun `loadUsers - shows error message on failure`() = runTest {
        // Arrange
        whenever(repository.getUsers()).thenReturn(
            Result.failure(IOException("Network error"))
        )

        // Act
        presenter.loadUsers()

        // Assert
        verify(view).showLoading()
        verify(view).hideLoading()
        verify(view).showError(contains("Failed to load users"))
        verify(view, never()).showUsers(any())
    }

    @Test
    fun `onUserClicked - navigates to detail screen`() {
        // Act
        presenter.onUserClicked("user-123")

        // Assert
        verify(view).navigateToDetail("user-123")
    }
}
```

---

## 4. Implementing MVVM

### WHY: Why Did MVVM Become the Standard for Modern UI?

Problems with MVP:
1. Presenter holds a reference to the View, making lifecycle management complex (Activity recreation problem)
2. Procedural code calling View methods one by one is verbose
3. UI state is split between Presenter and View

MVVM solves these:
1. **ViewModel does not know the View** — no lifecycle issues
2. **Data binding** — state changes are automatically reflected in the UI
3. **Single source of truth** — ViewModel is the sole authoritative state source

### 4.1 MVVM Structure (React + hooks)

```
┌──────────────────────────────────────────────────────┐
│  MVVM Mapping in React                               │
│                                                      │
│  Model      = API client + domain logic              │
│  ViewModel  = Custom Hooks (useState, useEffect)     │
│  View       = JSX components                         │
│                                                      │
│  ┌────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │ JSX (View) │←──→│ useUsers()   │───→│ API /    │  │
│  │            │    │ (ViewModel)  │    │ Domain   │  │
│  │ Render data│    │ State mgmt   │    │ (Model)  │  │
│  │ Emit events│    │ Logic        │    │          │  │
│  └────────────┘    └──────────────┘    └──────────┘  │
│                                                      │
│  Why Custom Hook = ViewModel:                        │
│  1. Centralizes logic independent of UI              │
│  2. Exposes state and actions                        │
│  3. Does not know View (no JSX dependency)           │
│  4. Testable (via renderHook)                        │
└──────────────────────────────────────────────────────┘
```

```typescript
// ============================================================
// Model — API client and domain logic
// ============================================================
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

interface CreateUserInput {
  name: string;
  email: string;
}

// API client (Model layer)
class UserApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "/api") {
    this.baseUrl = baseUrl;
  }

  async fetchAll(params?: { search?: string; page?: number }): Promise<{
    users: User[];
    total: number;
  }> {
    const query = new URLSearchParams();
    if (params?.search) query.set("q", params.search);
    if (params?.page) query.set("page", String(params.page));

    const res = await fetch(`${this.baseUrl}/users?${query}`);
    if (!res.ok) throw new ApiError("Failed to fetch users", res.status);
    return res.json();
  }

  async create(data: CreateUserInput): Promise<User> {
    const res = await fetch(`${this.baseUrl}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new ApiError(error.message ?? "Failed to create user", res.status);
    }
    return res.json();
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/users/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new ApiError("Failed to delete user", res.status);
  }
}

class ApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "ApiError";
  }
}

// Domain logic (Model layer)
function sortUsers(users: User[], sortBy: "name" | "createdAt"): User[] {
  return [...users].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function filterUsers(users: User[], query: string): User[] {
  const lower = query.toLowerCase();
  return users.filter(
    (u) =>
      u.name.toLowerCase().includes(lower) ||
      u.email.toLowerCase().includes(lower)
  );
}

// ============================================================
// ViewModel — Custom Hook
// ============================================================
interface UserListState {
  users: User[];
  total: number;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  sortBy: "name" | "createdAt";
  page: number;
}

function useUserList(apiClient: UserApiClient = new UserApiClient()) {
  const [state, setState] = useState<UserListState>({
    users: [],
    total: 0,
    loading: true,
    error: null,
    searchQuery: "",
    sortBy: "createdAt",
    page: 1,
  });

  // Fetch data
  const loadUsers = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { users, total } = await apiClient.fetchAll({
        search: state.searchQuery,
        page: state.page,
      });
      setState((prev) => ({ ...prev, users, total, loading: false }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }));
    }
  }, [apiClient, state.searchQuery, state.page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Actions
  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query, page: 1 }));
  }, []);

  const setSortBy = useCallback((sortBy: "name" | "createdAt") => {
    setState((prev) => ({ ...prev, sortBy }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  const addUser = useCallback(
    async (input: CreateUserInput) => {
      const newUser = await apiClient.create(input);
      setState((prev) => ({
        ...prev,
        users: [newUser, ...prev.users],
        total: prev.total + 1,
      }));
    },
    [apiClient]
  );

  const deleteUser = useCallback(
    async (id: string) => {
      await apiClient.delete(id);
      setState((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== id),
        total: prev.total - 1,
      }));
    },
    [apiClient]
  );

  // Computed properties (ViewModel logic)
  const sortedUsers = useMemo(
    () => sortUsers(state.users, state.sortBy),
    [state.users, state.sortBy]
  );

  const hasNextPage = state.page * 20 < state.total;
  const hasPrevPage = state.page > 1;

  return {
    // State
    users: sortedUsers,
    total: state.total,
    loading: state.loading,
    error: state.error,
    searchQuery: state.searchQuery,
    sortBy: state.sortBy,
    page: state.page,
    hasNextPage,
    hasPrevPage,
    // Actions
    setSearchQuery,
    setSortBy,
    setPage,
    addUser,
    deleteUser,
    reload: loadUsers,
  };
}

// ============================================================
// View — pure display component
// ============================================================
function UserListPage() {
  const {
    users,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    page,
    setPage,
    hasNextPage,
    hasPrevPage,
    deleteUser,
    reload,
  } = useUserList();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  return (
    <div className="user-list-page">
      <h1>User List</h1>

      {/* Search + Sort */}
      <div className="controls">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name or email"
        />
        <SortSelect
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: "createdAt", label: "Date registered" },
            { value: "name", label: "Name" },
          ]}
        />
      </div>

      {/* User list */}
      <ul className="user-list">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onDelete={() => deleteUser(user.id)}
          />
        ))}
      </ul>

      {/* Pagination */}
      <Pagination
        page={page}
        onPrev={() => setPage(page - 1)}
        onNext={() => setPage(page + 1)}
        hasPrev={hasPrevPage}
        hasNext={hasNextPage}
      />
    </div>
  );
}
```

### 4.2 MVVM (SwiftUI)

```swift
import SwiftUI
import Combine

// ============================================================
// Model — data structures and business logic
// ============================================================
struct User: Identifiable, Codable, Equatable {
    let id: UUID
    var name: String
    var email: String
    let role: Role
    let createdAt: Date

    enum Role: String, Codable {
        case admin, user, moderator
    }

    var isAdmin: Bool { role == .admin }
}

// API client (Model layer)
protocol UserServiceProtocol {
    func fetchUsers() async throws -> [User]
    func createUser(name: String, email: String) async throws -> User
    func deleteUser(id: UUID) async throws
}

class UserService: UserServiceProtocol {
    private let session: URLSession
    private let baseURL: URL

    init(baseURL: URL = URL(string: "https://api.example.com")!,
         session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetchUsers() async throws -> [User] {
        let url = baseURL.appendingPathComponent("users")
        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([User].self, from: data)
    }

    func createUser(name: String, email: String) async throws -> User {
        var request = URLRequest(url: baseURL.appendingPathComponent("users"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["name": name, "email": email])

        let (data, _) = try await session.data(for: request)
        return try JSONDecoder().decode(User.self, from: data)
    }

    func deleteUser(id: UUID) async throws {
        var request = URLRequest(
            url: baseURL.appendingPathComponent("users/\(id.uuidString)")
        )
        request.httpMethod = "DELETE"
        let (_, _) = try await session.data(for: request)
    }
}

enum APIError: LocalizedError {
    case invalidResponse
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Invalid response from server"
        case .networkError(let error): return error.localizedDescription
        }
    }
}

// ============================================================
// ViewModel — UI state and logic
// ============================================================
@MainActor
class UserListViewModel: ObservableObject {
    // Published = data binding targets
    @Published var users: [User] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    @Published var showingAddSheet = false

    private let service: UserServiceProtocol

    init(service: UserServiceProtocol = UserService()) {
        self.service = service
    }

    // Computed properties — display data referenced by the View
    var filteredUsers: [User] {
        guard !searchText.isEmpty else { return users }
        return users.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.email.localizedCaseInsensitiveContains(searchText)
        }
    }

    var userCount: String {
        let count = filteredUsers.count
        return "\(count) user(s)"
    }

    var hasUsers: Bool { !filteredUsers.isEmpty }

    // Actions
    func loadUsers() async {
        isLoading = true
        errorMessage = nil
        do {
            users = try await service.fetchUsers()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func addUser(name: String, email: String) async {
        do {
            let newUser = try await service.createUser(name: name, email: email)
            users.insert(newUser, at: 0)
        } catch {
            errorMessage = "Failed to add user: \(error.localizedDescription)"
        }
    }

    func deleteUser(at offsets: IndexSet) async {
        let usersToDelete = offsets.map { filteredUsers[$0] }
        for user in usersToDelete {
            do {
                try await service.deleteUser(id: user.id)
                users.removeAll { $0.id == user.id }
            } catch {
                errorMessage = "Failed to delete user"
            }
        }
    }
}

// ============================================================
// View — declarative UI
// ============================================================
struct UserListView: View {
    @StateObject private var viewModel = UserListViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading...")
                } else if let error = viewModel.errorMessage {
                    ContentUnavailableView(
                        "Error",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else if viewModel.hasUsers {
                    userList
                } else {
                    ContentUnavailableView.search
                }
            }
            .navigationTitle("User List")
            .searchable(text: $viewModel.searchText, prompt: "Search by name or email")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Add") { viewModel.showingAddSheet = true }
                }
                ToolbarItem(placement: .status) {
                    Text(viewModel.userCount)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .sheet(isPresented: $viewModel.showingAddSheet) {
                AddUserSheet(viewModel: viewModel)
            }
            .refreshable {
                await viewModel.loadUsers()
            }
            .task {
                await viewModel.loadUsers()
            }
        }
    }

    private var userList: some View {
        List {
            ForEach(viewModel.filteredUsers) { user in
                NavigationLink(value: user) {
                    UserRow(user: user)
                }
            }
            .onDelete { offsets in
                Task { await viewModel.deleteUser(at: offsets) }
            }
        }
    }
}

struct UserRow: View {
    let user: User

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(user.name).font(.headline)
                if user.isAdmin {
                    Text("Admin")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.blue.opacity(0.2))
                        .cornerRadius(4)
                }
            }
            Text(user.email)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}
```

### 4.3 MVVM (Vue 3 Composition API)

```typescript
// ============================================================
// Model — API client
// ============================================================
// api/userApi.ts
import type { User, CreateUserInput } from '@/types'

export const userApi = {
  async fetchAll(params?: { search?: string; page?: number }): Promise<{
    users: User[];
    total: number;
  }> {
    const query = new URLSearchParams()
    if (params?.search) query.set('q', params.search)
    if (params?.page) query.set('page', String(params.page))
    const res = await fetch(`/api/users?${query}`)
    if (!res.ok) throw new Error('Failed to fetch users')
    return res.json()
  },

  async create(data: CreateUserInput): Promise<User> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create user')
    return res.json()
  },
}

// ============================================================
// ViewModel — Composable
// ============================================================
// composables/useUserList.ts
import { ref, computed, watch } from 'vue'
import { userApi } from '@/api/userApi'
import type { User } from '@/types'

export function useUserList() {
  // Reactive state
  const users = ref<User[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const sortBy = ref<'name' | 'createdAt'>('createdAt')

  // Computed properties (auto-updated reactively)
  const sortedUsers = computed(() => {
    return [...users.value].sort((a, b) => {
      if (sortBy.value === 'name') return a.name.localeCompare(b.name)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  })

  const isEmpty = computed(() => users.value.length === 0 && !loading.value)

  // Actions
  async function loadUsers() {
    loading.value = true
    error.value = null
    try {
      const result = await userApi.fetchAll({ search: searchQuery.value })
      users.value = result.users
      total.value = result.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function addUser(name: string, email: string) {
    const newUser = await userApi.create({ name, email })
    users.value.unshift(newUser)
    total.value++
  }

  // Watch searchQuery changes and auto-search
  watch(searchQuery, () => {
    loadUsers()
  }, { debounce: 300 } as any)

  // Initial load
  loadUsers()

  return {
    users: sortedUsers,
    total,
    loading,
    error,
    searchQuery,
    sortBy,
    isEmpty,
    loadUsers,
    addUser,
  }
}

// ============================================================
// View — template
// ============================================================
// components/UserListPage.vue
// <script setup lang="ts">
// import { useUserList } from '@/composables/useUserList'
//
// const {
//   users, loading, error, searchQuery, sortBy, isEmpty, addUser, loadUsers
// } = useUserList()
// </script>
//
// <template>
//   <div class="user-list-page">
//     <h1>User List</h1>
//     <input v-model="searchQuery" placeholder="Search..." />
//     <select v-model="sortBy">
//       <option value="createdAt">Date registered</option>
//       <option value="name">Name</option>
//     </select>
//     <div v-if="loading">Loading...</div>
//     <div v-else-if="error">{{ error }}</div>
//     <div v-else-if="isEmpty">No users found</div>
//     <ul v-else>
//       <li v-for="user in users" :key="user.id">
//         {{ user.name }} ({{ user.email }})
//       </li>
//     </ul>
//   </div>
// </template>
```

### 4.4 MVVM Testing (React Custom Hook Tests)

```typescript
// ============================================================
// ViewModel (Custom Hook) tests
// ============================================================
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUserList } from "./useUserList";

// Mock API Client
const mockApiClient = {
  fetchAll: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
} as unknown as UserApiClient;

describe("useUserList (ViewModel)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fetches user list on initial load", async () => {
    const mockUsers = [
      { id: "1", name: "Alice", email: "alice@example.com", role: "user", createdAt: "2024-01-01" },
      { id: "2", name: "Bob", email: "bob@example.com", role: "admin", createdAt: "2024-01-02" },
    ];
    (mockApiClient.fetchAll as jest.Mock).mockResolvedValue({
      users: mockUsers,
      total: 2,
    });

    const { result } = renderHook(() => useUserList(mockApiClient));

    // Initial state: loading
    expect(result.current.loading).toBe(true);

    // Wait for data fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Assertions
    expect(result.current.users).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();
  });

  test("resets page when search query changes", async () => {
    (mockApiClient.fetchAll as jest.Mock).mockResolvedValue({
      users: [],
      total: 0,
    });

    const { result } = renderHook(() => useUserList(mockApiClient));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Set page to 2
    act(() => {
      result.current.setPage(2);
    });
    expect(result.current.page).toBe(2);

    // Searching resets page to 1
    act(() => {
      result.current.setSearchQuery("Alice");
    });
    expect(result.current.page).toBe(1);
    expect(result.current.searchQuery).toBe("Alice");
  });

  test("optimistically updates when a user is added", async () => {
    const initialUsers = [
      { id: "1", name: "Alice", email: "alice@example.com", role: "user", createdAt: "2024-01-01" },
    ];
    (mockApiClient.fetchAll as jest.Mock).mockResolvedValue({
      users: initialUsers,
      total: 1,
    });

    const newUser = {
      id: "2",
      name: "Bob",
      email: "bob@example.com",
      role: "user",
      createdAt: "2024-01-02",
    };
    (mockApiClient.create as jest.Mock).mockResolvedValue(newUser);

    const { result } = renderHook(() => useUserList(mockApiClient));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Add user
    await act(async () => {
      await result.current.addUser({ name: "Bob", email: "bob@example.com" });
    });

    // Verify optimistic update
    expect(result.current.users).toHaveLength(2);
    expect(result.current.total).toBe(2);
  });

  test("sets error message on API error", async () => {
    (mockApiClient.fetchAll as jest.Mock).mockRejectedValue(
      new Error("Network error")
    );

    const { result } = renderHook(() => useUserList(mockApiClient));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.users).toHaveLength(0);
  });
});
```

---

## 5. Pattern Selection Criteria

### 5.1 Recommendations by Platform / Framework

```
┌──────────────────────────────────────────────────────────────┐
│          Framework → Pattern Mapping                         │
│                                                              │
│  Web (Server-Side):                                          │
│    Rails / Django / Laravel   → MVC (built into framework)   │
│    Express / Fastify / Hono   → MVC (manual, thin Controller)│
│    Spring Boot                → MVC (@Controller, @Service)  │
│    Go (net/http, Gin, Echo)   → MVC (handler + service)      │
│                                                              │
│  Web (Client-Side):                                          │
│    React                      → MVVM (Custom Hooks = VM)     │
│    Vue.js 3                   → MVVM (Composition API = VM)  │
│    Angular                    → MVVM (Component + Service)   │
│    Svelte                     → MVVM (Store = VM)            │
│    Solid.js                   → MVVM (createSignal = VM)     │
│                                                              │
│  Mobile:                                                     │
│    SwiftUI (iOS)              → MVVM (ObservableObject)      │
│    UIKit (iOS, legacy)        → MVC → MVP                    │
│    Jetpack Compose (Android)  → MVVM (StateFlow + ViewModel) │
│    Android Views (legacy)     → MVP → MVVM (LiveData)        │
│    Flutter                    → MVVM (Provider / Bloc / Riverpod)│
│    React Native               → MVVM (hooks-based)           │
│                                                              │
│  Desktop:                                                    │
│    WPF / .NET MAUI            → MVVM (origin, INotifyPropertyChanged)│
│    Electron + React           → MVVM                         │
│    Tauri + Solid/Svelte       → MVVM                         │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Pattern Selection Flowchart

```
┌────────────────────────────────────────────────────────────┐
│               Pattern Selection Flowchart                  │
│                                                            │
│  Q1: Server-side web app?                                  │
│    Yes → MVC (follow framework conventions)                │
│    No  → Q2                                                │
│                                                            │
│  Q2: Reactive UI / SPA / Mobile?                           │
│    Yes → Q3                                                │
│    No  → MVC (simple server rendering)                     │
│                                                            │
│  Q3: Does the framework support data binding?              │
│    Yes → MVVM (React hooks, SwiftUI, Vue Composition, etc) │
│    No  → Q4                                                │
│                                                            │
│  Q4: Is View testability the top priority?                 │
│    Yes → MVP (test via View interface)                     │
│    No  → MVC (custom implementation)                       │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Comparison Tables

### 6.1 MVC / MVP / MVVM Pattern Comparison

| Aspect | MVC | MVP | MVVM |
|------|-----|-----|------|
| **View-Logic Coupling** | Via Controller | Via Presenter | DataBinding |
| **View Knowledge** | Controller selects View | Presenter updates View | ViewModel does not know View |
| **Testability** | Medium (Controller tests) | High (Presenter tests) | High (ViewModel tests) |
| **Data Flow** | Triangle (M<->V, C->M, C->V) | Linear (V<->P<->M) | Linear (V<->VM<->M) |
| **State Management** | Held in Model | Held in Presenter | Held in ViewModel |
| **View Role** | Display + some logic | Display only (Passive View) | Display + binding |
| **Complexity** | Low | Medium | Medium–High |
| **Learning Curve** | Low | Medium | Medium (reactive concepts needed) |
| **Boilerplate** | Low | High (Contract definitions) | Medium (binding setup) |
| **Primary Use** | Server-side Web | Android (old), .NET WinForms | SPA, Mobile, WPF |
| **Representative Frameworks** | Rails, Django, Laravel | Android Views | React, SwiftUI, WPF |

### 6.2 Framework Implementation Comparison

| Framework | Pattern | Model | ViewModel/Controller | View | Binding |
|--------------|---------|-------|---------------------|------|--------------|
| **Rails** | MVC | ActiveRecord | Controller | ERB/Slim | None (template) |
| **Django** | MVC (MTV) | ORM Model | View (=Controller) | Template | None (template) |
| **Spring Boot** | MVC | @Entity / @Service | @Controller | Thymeleaf | None (template) |
| **React** | MVVM-like | API / Store | Custom Hooks | JSX | useState / useEffect |
| **Vue 3** | MVVM | API / Pinia | Composition API | Template | ref / reactive |
| **Svelte** | MVVM | API / Store | $state rune | Template | Auto-reactive |
| **Angular** | MVVM | Service / NgRx | Component class | Template | [(ngModel)] / Signal |
| **SwiftUI** | MVVM | Service layer | ObservableObject | View struct | @Published / @Binding |
| **Jetpack Compose** | MVVM | Repository | ViewModel | @Composable | StateFlow / MutableState |
| **WPF** | MVVM | Data Layer | ViewModel (INotifyPropertyChanged) | XAML | {Binding} |
| **Flutter** | MVVM-like | Repository | Provider/Bloc/Riverpod | Widget | ChangeNotifier / Stream |

### 6.3 Testing Strategy Comparison

| Pattern | Unit Test Targets | Mock Targets | Ease of Testing | UI Test Necessity |
|---------|------------------|-----------|-------------------|---------------|
| **MVC** | Model, Controller | DB, external API | Medium | High (View has logic) |
| **MVP** | Model, Presenter | View (Interface), DB | High | Low (View is passive) |
| **MVVM** | Model, ViewModel | API Client | High | Low (all logic in VM) |

---

## 7. Anti-Patterns

### 7.1 Fat Controller (MVC)

```ruby
# BAD: Stuffing business logic into the Controller
class OrdersController < ApplicationController
  def create
    user = User.find(params[:user_id])
    items = params[:items].map { |i| Product.find(i[:product_id]) }

    # Business logic leaking into Controller...
    total = items.sum(&:price)
    tax = total * 0.10
    discount = user.vip? ? total * 0.05 : 0
    final_total = total + tax - discount

    order = Order.create!(user: user, total: final_total, tax: tax)
    items.each { |item| order.order_items.create!(product: item) }

    # Notifications also in Controller...
    OrderMailer.confirmation(order).deliver_later
    SlackNotifier.new_order(order)

    redirect_to order
  end
end

# GOOD: Extract into a Service Object
# app/services/create_order_service.rb
class CreateOrderService
  def initialize(user_id:, items:)
    @user = User.find(user_id)
    @items = items.map { |i| Product.find(i[:product_id]) }
  end

  def call
    order = build_order
    persist_order(order)
    send_notifications(order)
    Result.success(order)
  rescue => e
    Result.failure(e.message)
  end

  private

  def build_order
    calculator = PriceCalculator.new(@items, @user)
    Order.new(
      user: @user,
      total: calculator.final_total,
      tax: calculator.tax
    )
  end

  def persist_order(order)
    ActiveRecord::Base.transaction do
      order.save!
      @items.each { |item| order.order_items.create!(product: item) }
    end
  end

  def send_notifications(order)
    OrderMailer.confirmation(order).deliver_later
    SlackNotifier.new_order(order)
  end
end

# Keep the Controller thin
class OrdersController < ApplicationController
  def create
    result = CreateOrderService.new(
      user_id: params[:user_id],
      items: params[:items]
    ).call

    if result.success?
      redirect_to result.order
    else
      render :new, status: :unprocessable_entity
    end
  end
end
```

**Why it's bad**: The Controller should only handle request routing and response control. Including business logic makes it hard to test and prevents logic reuse.

### 7.2 God ViewModel (MVVM)

```typescript
// BAD: Stuffing all logic into one ViewModel
function useDashboardGodViewModel() {
  // User management
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  // Order management
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState("all");
  // Notification management
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Settings management
  const [settings, setSettings] = useState({});
  const [theme, setTheme] = useState("light");
  // Analytics dashboard
  const [analytics, setAnalytics] = useState({});
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  // ... 200+ lines of logic

  return { /* 50+ properties and methods */ };
}

// GOOD: Split ViewModel by responsibility
function useUserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  // Only user list logic (within 30 lines)
  return { users, search, setSearch, loadUsers, addUser };
}

function useOrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderFilter>("all");
  // Only order management logic
  return { orders, filter, setFilter, loadOrders };
}

function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Only notification logic
  return { notifications, unreadCount, markAsRead };
}

// Compose only what's needed in the component
function DashboardPage() {
  const userList = useUserList();
  const orders = useOrderManagement();
  const notifications = useNotifications();

  return (
    <Dashboard>
      <UserSection {...userList} />
      <OrderSection {...orders} />
      <NotificationBell {...notifications} />
    </Dashboard>
  );
}
```

**Why it's bad**: A bloated ViewModel is hard to test and makes it impossible to predict the scope of changes. A good rule of thumb: no more than 3–5 state values and 5–8 methods per ViewModel.

### 7.3 Business Logic in the View (Common to All Patterns)

```typescript
// BAD: Business logic inside the View component
function OrderSummary({ order }: { order: Order }) {
  // Business logic mixed into View
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const taxRate = order.country === "JP" ? 0.10 : order.country === "US" ? 0.08 : 0.20;
  const tax = subtotal * taxRate;
  const discount = order.coupon
    ? order.coupon.type === "percent"
      ? subtotal * (order.coupon.value / 100)
      : order.coupon.value
    : 0;
  const total = subtotal + tax - discount;
  const freeShipping = total > 5000;

  return (
    <div>
      <p>Subtotal: {subtotal.toLocaleString()}</p>
      <p>Tax: {tax.toLocaleString()}</p>
      <p>Discount: -{discount.toLocaleString()}</p>
      <p>Total: {total.toLocaleString()}</p>
      {freeShipping && <p>Free shipping</p>}
    </div>
  );
}

// GOOD: Move business logic to ViewModel
function useOrderSummary(order: Order) {
  return useMemo(() => {
    const calculator = new OrderCalculator(order);
    return {
      subtotal: calculator.subtotal,
      tax: calculator.tax,
      discount: calculator.discount,
      total: calculator.total,
      freeShipping: calculator.isFreeShipping,
    };
  }, [order]);
}

// View handles display only
function OrderSummary({ order }: { order: Order }) {
  const { subtotal, tax, discount, total, freeShipping } = useOrderSummary(order);

  return (
    <div>
      <p>Subtotal: {subtotal.toLocaleString()}</p>
      <p>Tax: {tax.toLocaleString()}</p>
      <p>Discount: -{discount.toLocaleString()}</p>
      <p>Total: {total.toLocaleString()}</p>
      {freeShipping && <p>Free shipping</p>}
    </div>
  );
}
```

**Why it's bad**: Business logic in the View means (1) the same calculation is duplicated across multiple Views, (2) unit testing the logic requires UI rendering, and (3) designers risk breaking logic when changing layout.

### 7.4 Direct View Manipulation from ViewModel (MVVM Violation)

```typescript
// BAD: ViewModel directly manipulates the DOM
function useScrollToTop() {
  const scrollToTop = () => {
    // ViewModel knows about the View (DOM)!
    document.getElementById("scroll-container")?.scrollTo(0, 0);
    document.title = "Page Top";
  };
  return { scrollToTop };
}

// GOOD: ViewModel only exposes state; View handles side effects
function useListViewModel() {
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false);

  const resetList = () => {
    // Change state only
    setShouldScrollToTop(true);
    setPage(1);
  };

  return { shouldScrollToTop, setShouldScrollToTop, resetList };
}

// View executes side effects
function ListView() {
  const { shouldScrollToTop, setShouldScrollToTop, resetList } = useListViewModel();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldScrollToTop) {
      containerRef.current?.scrollTo(0, 0);
      setShouldScrollToTop(false);
    }
  }, [shouldScrollToTop]);

  return <div ref={containerRef}>...</div>;
}
```

**Why it's bad**: The core of MVVM is that the ViewModel does not know the View. When the ViewModel manipulates the DOM, (1) the ViewModel can only be tested in a browser environment, (2) porting to React Native or similar is impossible, and (3) it causes errors in SSR.

---

## 8. Practice Exercises

### Exercise 1 (Beginner): Separation of Concerns in MVC

Refactor the following "Fat Controller" to properly separate responsibilities between Model and Controller.

```typescript
// Target for refactoring
class ProductController {
  async search(req: Request, res: Response) {
    const { query, minPrice, maxPrice, category } = req.query;
    const products = await db.query("SELECT * FROM products");

    // Filtering (business logic)
    let filtered = products;
    if (query) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );
    }
    if (minPrice) {
      filtered = filtered.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter(p => p.price <= Number(maxPrice));
    }
    if (category) {
      filtered = filtered.filter(p => p.category === category);
    }

    // Sorting (business logic)
    filtered.sort((a, b) => b.salesCount - a.salesCount);

    // Pagination
    const page = Number(req.query.page) || 1;
    const perPage = 20;
    const start = (page - 1) * perPage;
    const paged = filtered.slice(start, start + perPage);

    res.json({ data: paged, total: filtered.length });
  }
}
```

**Expected output structure**:
- `ProductModel` class: `search(criteria)`, `sortByPopularity()`, `paginate(page, perPage)` methods
- `ProductController` class: thin request handling only (within 10 lines)

---

### Exercise 2 (Intermediate): Testable MVVM Design

Design a ViewModel for a TODO list app that meets the following requirements:

**Requirements**:
1. Add, toggle completion, and delete TODOs
2. Filtering: All / Active / Completed
3. Display the count of remaining incomplete tasks
4. Toggle all (mark all tasks as complete/incomplete at once)

**Tests**: Implement a ViewModel that passes all of the following test cases:

```typescript
describe("useTodoList", () => {
  test("can add a TODO", () => {
    // addTodo("Buy milk") → length of todos increases by 1
  });

  test("cannot add an empty TODO", () => {
    // addTodo("") → length of todos does not change
  });

  test("can toggle the completion state of a TODO", () => {
    // toggleTodo(id) → completed is inverted
  });

  test("can display only Active items with filter", () => {
    // filter = "active" → only completed: false
  });

  test("remaining incomplete task count is correct", () => {
    // 1 of 3 completed → remainingCount = 2
  });

  test("toggle all works correctly", () => {
    // toggleAll() → all completed: true
    // toggleAll() again → all completed: false
  });
});
```

**Expected output**: Complete implementation of the `useTodoList()` Custom Hook and test code

---

### Exercise 3 (Advanced): Migration Between Patterns

Migrate the following existing MVP implementation (Android Kotlin) to MVVM (Jetpack Compose), starting from this MVP code:

```kotlin
// Existing MVP code
interface WeatherContract {
    interface View {
        fun showTemperature(temp: String)
        fun showCondition(condition: String)
        fun showLoading()
        fun hideLoading()
        fun showError(message: String)
    }
    interface Presenter {
        fun loadWeather(city: String)
        fun onDestroy()
    }
}
```

**Migration requirements**:
1. Redesign as `WeatherViewModel` (extends `ViewModel()`)
2. UI state management using `StateFlow`
3. Type-safe state representation with `sealed class WeatherUiState`
4. Implement the View as a `@Composable` function for Compose UI
5. Unit tests using `FakeWeatherRepository`

**Expected output**:
- `WeatherUiState` sealed class
- `WeatherViewModel` class
- `WeatherScreen` Composable
- `WeatherViewModelTest` test class

---

## 9. FAQ

### Q1. Is React MVC or MVVM?

**A.** React itself is a "View library" and does not enforce a specific pattern. However, in practice:

- **Custom Hooks** = ViewModel (state management, business logic)
- **API client / Store** = Model (data access, domain logic)
- **JSX components** = View (UI rendering)

This structure is **close to MVVM**. Facebook initially advocated "Flux (unidirectional data flow)", but the development style after Hooks was introduced is very close to MVVM's data binding. The combination of `useState` and `useEffect` functions as an implicit binding mechanism.

However, note that React's "state update → re-render" is **unidirectional**, unlike the **two-way** binding in WPF. Strictly speaking, it can be called a "unidirectional data binding MVVM variant."

### Q2. Are server-side and client-side MVC the same thing?

**A.** The name is the same, but the operating model is fundamentally different:

| Aspect | Server-Side MVC | Client-Side MVC |
|--------|-------------------|---------------------|
| **Lifecycle** | Per request/response (stateless) | App launch to close (stateful) |
| **State persistence** | DB + session | In-memory (reactive) |
| **View update** | Regenerates entire HTML | Partial DOM updates |
| **User interaction** | HTTP requests | Event handlers |
| **Controller lifetime** | Only during request processing | Entire app lifetime |

A server-side Controller is disposable — "1 request = 1 instance" — but a client-side Controller/ViewModel lives continuously. Due to this difference, **MVVM fits more naturally** than MVC on the client side.

### Q3. What should I do when a MVVM ViewModel becomes too large?

**A.** There are three approaches:

1. **Split the ViewModel** — separate ViewModels for each logical section of the screen
   ```typescript
   // Multiple ViewModels for one screen
   function Dashboard() {
     const header = useHeaderViewModel();
     const userList = useUserListViewModel();
     const stats = useStatsViewModel();
   }
   ```

2. **Introduce a UseCase / Interactor layer** — extract business logic out of the ViewModel
   ```typescript
   // ViewModel only calls UseCases
   function useOrderViewModel(createOrder: CreateOrderUseCase) {
     const submit = async (data) => {
       const result = await createOrder.execute(data);
       // ViewModel handles presentation logic only
     };
   }
   ```

3. **Composable ViewModels** — compose small ViewModels to build large screens
   ```typescript
   function usePagination() { /* pagination logic */ }
   function useSearch() { /* search logic */ }
   function useSort() { /* sort logic */ }

   // Compose
   function useUserList() {
     const pagination = usePagination();
     const search = useSearch();
     const sort = useSort();
     // Combine and return
   }
   ```

**Rule of thumb**: Consider splitting when a ViewModel has 5+ state values or 8+ methods.

### Q4. When should I migrate from MVC to MVVM?

**A.** Consider migrating when you see these signs:

1. **Controller bloat** — a single Controller exceeds 300 lines
2. **Untestable code** — more logic requires mocking the UI to test
3. **Reactive requirements** — real-time updates or complex UI state transitions are needed
4. **Cross-platform** — you want to share logic between web and mobile

That said, there is no need to forcibly migrate a "working server-side MVC." Following the framework's conventions is the best approach.

### Q5. Should I choose MVP or MVVM?

**A.** As of today (2024 and beyond), you should **choose MVVM in almost every case**. Reasons:

1. All major frameworks (React, SwiftUI, Compose, Vue, Angular) are designed for MVVM
2. Reactive programming has become mainstream, making data binding feel natural
3. MVP's "View interface + Presenter" is more verbose than MVVM's "ViewModel + binding"

**Exception**: MVP is valid when building a UI without a framework (e.g., custom rendering engines).

### Q6. What is the relationship between Clean Architecture and MVC/MVVM?

**A.** They are orthogonal concepts and are used together:

```
┌──────────────────────────────────────────────────┐
│  Clean Architecture Layer Structure              │
│                                                  │
│  Presentation Layer ← apply MVC/MVVM here        │
│    ├── View (JSX / Template)                     │
│    └── ViewModel / Controller                    │
│                                                  │
│  Application Layer                               │
│    └── UseCase / Interactor                      │
│                                                  │
│  Domain Layer                                    │
│    ├── Entity                                    │
│    └── Repository Interface                      │
│                                                  │
│  Infrastructure Layer                            │
│    ├── Repository Implementation                 │
│    └── External Services                         │
└──────────────────────────────────────────────────┘
```

MVC/MVVM is a **Presentation Layer pattern**, while Clean Architecture defines **dependency rules across all layers**. The two are complementary.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping straight to advanced topics. We recommend fully understanding the core concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is applied frequently in day-to-day development. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Points |
|------|---------|
| **MVC** | De facto standard for server-side web. Maps naturally to HTTP request/response. Keep the Controller thin. |
| **MVP** | Clear separation between View and Presenter. High testability but lots of boilerplate. Used in legacy Android. |
| **MVVM** | Declarative UI via data binding. De facto for SPA and mobile. ViewModel does not know the View. |
| **Selection criteria** | Follow the framework's recommended pattern. When in doubt, choose MVVM. |
| **Common principles** | Separation of concerns, thin Controller/ViewModel, testable design. |
| **Testing** | MVC: Controller tests. MVP: Presenter tests. MVVM: ViewModel tests. Make all testable without the View. |
| **Direction of evolution** | MVC(1979) → MVP(1990s) → MVVM(2005) → Declarative UI(2019+). Passivation of the View is a consistent trend. |
| **Anti-patterns** | Fat Controller, God ViewModel, business logic in View, ViewModel directly manipulating the View. |

---

## What to Read Next

- [01-repository-pattern.md](./01-repository-pattern.md) — Abstracting the data access layer (Model layer design in MVVM)
- [02-event-sourcing-cqrs.md](./02-event-sourcing-cqrs.md) — Event-driven architecture (Command/Query separation in CQRS)
- [../02-behavioral/](../02-behavioral/) — Observer pattern (the foundation of MVVM's data binding)
- ../../clean-code-principles/ — Separation of concerns, SOLID principles
- ../../system-design-guide/ — Overall picture of architecture design

---

## References

1. **Trygve Reenskaug** — "The original MVC reports" (1979) — https://folk.universitetetioslo.no/trygver/themes/mvc/mvc-index.html
2. **Martin Fowler** — "GUI Architectures" — https://martinfowler.com/eaaDev/uiArchs.html
3. **Microsoft** — "The MVVM Pattern" — https://learn.microsoft.com/en-us/dotnet/architecture/maui/mvvm
4. **Apple Developer Documentation** — "Model-View-ViewModel" — https://developer.apple.com/documentation/swiftui/model-data
5. **Android Developers** — "Guide to app architecture" — https://developer.android.com/topic/architecture
6. **Josh W. Comeau** — "The Wave of React" — Explanation of Custom Hooks as ViewModel pattern
7. **Robert C. Martin** — "Clean Architecture" (2017) — Relationship between Presentation Layer patterns and Clean Architecture
