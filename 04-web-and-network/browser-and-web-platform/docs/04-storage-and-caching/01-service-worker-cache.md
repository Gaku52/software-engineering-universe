# Service Worker and Cache Strategies

> Service Worker is a browser API that enables offline support, background synchronization, and push notifications for web applications. Combined with the Cache API, it allows you to build resilient user experiences that are unaffected by network conditions. This chapter systematically covers everything from the Service Worker lifecycle, through the details of the five major cache strategies, practical implementation with Workbox, building PWAs (Progressive Web Apps), and debugging and troubleshooting.

## What You Will Learn

- [ ] Understand the Service Worker lifecycle and the mechanisms for registration and updates accurately
- [ ] Master the basic Cache API operations (open, put, match, delete)
- [ ] Understand the characteristics and appropriate use cases of the five cache strategies (Cache First, Network First, Stale-While-Revalidate, Cache Only, Network Only)
- [ ] Learn efficient Service Worker development using the Workbox library
- [ ] Learn the components of a PWA and the requirements for installability
- [ ] Understand cache versioning and strategies for deleting stale caches
- [ ] Learn how to implement an offline fallback page

---

## 1. Service Worker Fundamentals

### 1.1 What Is a Service Worker?

A Service Worker is a programmable proxy server that sits between the web page and the network. Unlike regular scripts, it has the following characteristics.

1. **Runs on an independent thread** -- it executes on a separate thread from the main (UI) thread, so it cannot access the DOM directly
2. **Event-driven** -- it starts only when needed and stops when idle
3. **Requires HTTPS** -- for security reasons, it only works in HTTPS environments (except for localhost)
4. **Stateless** -- state is reset on each startup, so IndexedDB or the Cache API must be used for persistence

```
+-------------------------------------------------------------------+
|  Browser                                                          |
|                                                                   |
|  +------------------+      +-------------------+                  |
|  |   Web Page        |      |  Service Worker   |                  |
|  |  (Main Thread)    | <--> |  (Worker Thread)  |                  |
|  |                  |      |                   |                  |
|  | - DOM operations |      | - fetch event     |                  |
|  | - UI rendering   |      | - push event      |                  |
|  | - User input     |      | - sync event      |                  |
|  +------------------+      +--------+----------+                  |
|                                     |                             |
|                                     v                             |
|                            +--------+----------+                  |
|                            |   Cache Storage   |                  |
|                            |  (Cache API)      |                  |
|                            +--------+----------+                  |
|                                     |                             |
+-------------------------------------|-----------------------------+
                                      |
                                      v
                             +--------+----------+
                             |   Network         |
                             |  (Remote server)  |
                             +-------------------+
```

### 1.2 Service Worker Scope

Service Workers have the concept of a "scope." The scope is the range of paths that the Service Worker controls.

```javascript
// Default scope: the directory where the Service Worker file is placed
// Registering /sw.js → scope is / (entire site)
navigator.serviceWorker.register('/sw.js');

// Registering /app/sw.js → scope is /app/
navigator.serviceWorker.register('/app/sw.js');

// Explicitly specify the scope
navigator.serviceWorker.register('/sw.js', {
  scope: '/app/'
});

// Note: the scope cannot be set higher than the location of the SW file
// Registering /app/sw.js with scope: '/' is not allowed (requires Service-Worker-Allowed header)
```

### 1.3 Differences Between Service Workers and Regular Scripts

| Property | Regular JavaScript | Service Worker |
|------|-------------------|----------------|
| Execution thread | Main thread | Worker thread |
| DOM access | Possible | Not available |
| window object | Available | Not available (use self) |
| Lifecycle | Synchronized with page | Independent of page |
| Network request interception | Not possible | Possible via fetch event |
| HTTPS requirement | None | Required (except localhost) |
| Persistence | Ends when page is closed | Managed by browser |
| Available APIs | All | Cache API, Fetch API, IndexedDB, postMessage, etc. |
| Background processing | Not possible | Supports Push, Sync events |

---

## 2. Service Worker Lifecycle (Detailed)

The Service Worker lifecycle is one of the areas where web developers most commonly get confused. Accurately understanding each phase is a prerequisite for stable implementation.

```
+-----------------------------------------------------------+
|              Service Worker Lifecycle                      |
+-----------------------------------------------------------+
|                                                           |
|  [Unregistered] --(register())--> [Registering]           |
|                               |                           |
|                               v                           |
|                          [Installing]                     |
|                          install event                    |
|                               |                           |
|                    +----------+----------+                 |
|                    |                     |                 |
|                    v                     v                 |
|              [Waiting]             [Install failed]       |
|            (waiting)                  (discarded)         |
|                    |                                       |
|      +-------------+-------------+                        |
|      |                           |                        |
|      v                           v                        |
| [Old SW in control]        [skipWaiting()]                 |
| Wait until all tabs closed   Activate immediately          |
|      |                           |                        |
|      +-------------+-------------+                        |
|                    |                                       |
|                    v                                       |
|              [Activating]                                  |
|              activate event                               |
|                    |                                       |
|                    v                                       |
|              [Active/Controlling]                          |
|              fetch, push, sync event handling             |
|                    |                                       |
|                    v                                       |
|              [Update check]                               |
|              Every 24h or on register() call              |
|              If any byte difference exists,               |
|              start installing new SW                      |
+-----------------------------------------------------------+
```

### 2.1 Registration

```javascript
// main.js (page-side script)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        // Specifying updateViaCache: 'none' ignores the HTTP cache for the SW file itself
        updateViaCache: 'none'
      });

      console.log('SW registered:', registration.scope);

      // Manually trigger an update check (optional)
      registration.update();

      // Check registration state
      if (registration.installing) {
        console.log('Service Worker: Installing');
      } else if (registration.waiting) {
        console.log('Service Worker: Waiting (update available)');
      } else if (registration.active) {
        console.log('Service Worker: Active');
      }
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  });
}
```

### 2.2 Installation

```javascript
// sw.js
const CACHE_NAME = 'app-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/images/logo.svg',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');

  // waitUntil() tells the browser to wait until installation is complete
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching resources');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        // Calling skipWaiting() skips the waiting state and activates immediately
        // Note: the new SW becomes active while existing tabs are still controlled
        //       by the old SW, so be careful about compatibility
        return self.skipWaiting();
      })
  );
});
```

### 2.3 Activation

```javascript
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');

  // Delete old caches
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // clients.claim() immediately starts controlling all currently open tabs
        // Without this, the new SW will not start controlling until the next navigation
        return self.clients.claim();
      })
  );
});
```

### 2.4 How Updates Work

Service Worker updates are automatically checked at the following times:

1. When the user navigates to a page within the scope
2. When functional events like `push` or `sync` fire (if more than 24 hours have passed since the last check)
3. When `registration.update()` is called explicitly

```javascript
// Manual update check and notification
async function checkForUpdates() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  // Check for updates
  await registration.update();

  // Check if there is a waiting SW
  if (registration.waiting) {
    showUpdateNotification(registration.waiting);
  }

  // Watch for new SW installation
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // A new version is available
        showUpdateNotification(newWorker);
      }
    });
  });
}

function showUpdateNotification(worker) {
  // Show "Update available" in UI, notify SW when user clicks
  const updateBanner = document.getElementById('update-banner');
  updateBanner.style.display = 'block';
  updateBanner.querySelector('button').addEventListener('click', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
}

// SW side: receive skipWaiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Page side: reload when controller changes
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload();
});
```

---

## 3. Basic Cache API Operations

The Cache API is an asynchronous API available not only from Service Workers but also from regular Window contexts. It stores HTTP request/response pairs in a key-value format.

### 3.1 Basic Methods

```javascript
// --- caches.open(cacheName) ---
// Open the cache with the specified name (creates it if it doesn't exist)
const cache = await caches.open('my-cache-v1');

// --- cache.add(request) ---
// Fetch a request and store the response in the cache
await cache.add('/styles/main.css');
// Internally equivalent to:
// const response = await fetch('/styles/main.css');
// await cache.put('/styles/main.css', response);

// --- cache.addAll(requests) ---
// Add multiple requests to the cache at once
// If any one fails, all fail (atomic operation)
await cache.addAll([
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/app.js'
]);

// --- cache.put(request, response) ---
// Store a request/response pair directly in the cache
const response = await fetch('/api/data');
await cache.put('/api/data', response.clone());
// Note: use response.clone() because Response can only be read once

// --- cache.match(request, options) ---
// Search the cache for a response matching the request
const cachedResponse = await cache.match('/styles/main.css');
if (cachedResponse) {
  console.log('Cache hit!');
}

// Option: ignoreSearch ignores query parameters when matching
const result = await cache.match('/api/users', { ignoreSearch: true });
// /api/users?page=1 etc. will also match

// --- cache.delete(request) ---
// Delete a specific cache entry
const deleted = await cache.delete('/old-resource.js');
console.log('Deleted:', deleted); // true or false

// --- cache.keys() ---
// Get all requests (keys) in the cache
const requests = await cache.keys();
requests.forEach((request) => {
  console.log('Cached:', request.url);
});

// --- caches.keys() ---
// Get all cache names
const cacheNames = await caches.keys();
console.log('Available caches:', cacheNames);

// --- caches.delete(cacheName) ---
// Delete an entire cache
await caches.delete('old-cache-v1');

// --- caches.match(request) ---
// Search across all caches (returns the first match)
const anyMatch = await caches.match('/styles/main.css');
```

### 3.2 Cache API Constraints and Notes

| Item | Details |
|------|------|
| Storage limit | Varies by browser and device. Chrome allows up to 80% of disk space (up to 60% per origin) |
| Storable content | HTTP request/response pairs only (use IndexedDB for arbitrary data) |
| Key matching | Exact URL match by default. Vary headers are also considered |
| CORS responses | Opaque responses (no-cors) can be cached but status becomes 0 |
| Response consumption | A Response body can only be read once. Use clone() if needed multiple times |
| Persistence | May be evicted when explicitly deleted or when browser storage is under pressure |

---

## 4. The Five Major Cache Strategies in Detail

A cache strategy is a pattern that determines how the Service Worker combines the cache and the network to return a response when it receives a fetch event.

### 4.1 Cache First

Returns from cache if available; otherwise fetches from the network.

```
Request --> [Exists in Cache?]
                |          |
               YES         NO
                |          |
                v          v
        [Return from cache] [Go to Network]
                              |
                              v
                        [Save to Cache]
                              |
                              v
                        [Return response]
```

```javascript
// Cache First strategy implementation
self.addEventListener('fetch', (event) => {
  // Target: static assets with hash in filename
  if (event.request.url.match(/\.(css|js|woff2?|png|jpg|svg)(\?.*)?$/)) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            // Only cache successful responses
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open('static-assets-v1').then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          });
        })
    );
  }
});
```

**Use cases**: Built CSS/JS (filenames include hash), web fonts, logo images
**Pros**: Fast, offline support, reduced network load
**Cons**: Updates may not be reflected if cache is stale

### 4.2 Network First

Attempts network first; falls back to cache on failure.

```
Request --> [Go to Network]
                |        |
             Success    Failure
                |        |
                v        v
        [Save to Cache] [Exists in Cache?]
                |        |        |
                v       YES       NO
        [Return response]  |      |
                        v        v
                  [Return from   [Error or
                   cache]     offline page]
```

```javascript
// Network First strategy implementation (with timeout)
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      // Attempt network request with a timeout
      promiseWithTimeout(fetch(event.request), 3000)
        .then((networkResponse) => {
          // Success: save to cache and return
          const responseClone = networkResponse.clone();
          caches.open('api-cache-v1').then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(async () => {
          // Failure: return from cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // No cache either: return error response
          return new Response(
            JSON.stringify({ error: 'Offline', cached: false }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
  }
});

// Promise with timeout utility
function promiseWithTimeout(promise, ms) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeout]);
}
```

**Use cases**: API responses, HTML pages, dynamic content
**Pros**: Always prioritizes the latest data
**Cons**: Slow initial display when offline or on slow networks

### 4.3 Stale-While-Revalidate (SWR)

Returns an immediate response from the cache while fetching the latest version from the network in the background to update the cache.

```
Request --> [Exists in Cache?]
                |          |
               YES         NO
                |          |
                v          |
        [Return immediately  |
         from cache]        |
                |          |
                v          v
        [Fetch from       [Go to Network]
         Network in           |
         background]          v
                |       [Save to Cache]
                v             |
        [Update Cache]        v
        (latest version  [Return response]
         returned on
         next request)
```

```javascript
// Stale-While-Revalidate strategy implementation
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/content/')) {
    event.respondWith(
      caches.open('content-cache-v1').then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Fetch latest version from network in background
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // Update cache
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            })
            .catch(() => {
              // Network failure: do nothing (cache has already been returned)
              console.log('[SW] Background fetch failed, using cached version');
            });

          // Return cache immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
```

**Use cases**: User avatars, news feeds, social media timelines, content with moderate update frequency
**Pros**: Fast initial display + stays up-to-date in background
**Cons**: Initial display may be one version behind

### 4.4 Cache Only

Returns responses only from the cache. No network requests are made.

```javascript
// Cache Only strategy implementation
self.addEventListener('fetch', (event) => {
  // Use only for precached resources
  if (event.request.url.includes('/static/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Not in cache: return 404
        return new Response('Resource not found in cache', {
          status: 404,
          statusText: 'Not Found'
        });
      })
    );
  }
});
```

**Use cases**: Static resources precached during the install event
**Pros**: Fully offline, zero network communication
**Cons**: Fails if resource is not in cache

### 4.5 Network Only

Fetches responses only from the network. Cache is not used.

```javascript
// Network Only strategy implementation
self.addEventListener('fetch', (event) => {
  // Dynamic requests that should not be cached
  if (event.request.url.includes('/api/auth/') ||
      event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Network required' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
  }
});
```

**Use cases**: Authentication APIs, payment processing, real-time data
**Pros**: Always retrieves the latest data
**Cons**: Does not work at all when offline

### 4.6 Strategy Selection Guide (Comprehensive Comparison)

| Strategy | Speed | Freshness | Offline Support | Use Cases |
|------|------|------|---------------|---------|
| Cache First | Fastest | Low (cache-dependent) | Full support | Hashed CSS/JS, fonts, logos |
| Network First | Slow (network-dependent) | Latest | If cache available | API data, HTML pages |
| Stale-While-Revalidate | Fast | One behind | If cache available | Avatars, feeds, moderate-frequency content |
| Cache Only | Fastest | Fixed | Full support | Precached static resources |
| Network Only | Slow | Latest | No support | Auth APIs, payments, non-idempotent requests |

---

## 5. Practical Service Worker Implementation

### 5.1 Unified fetch Handler

In real applications, strategies are switched based on the type of request.

```javascript
// sw.js -- Unified Service Worker implementation
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v1';
const API_CACHE = 'api-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/images/logo.svg'
];

// ==========================================
// Install: precache
// ==========================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ==========================================
// Activate: delete old caches
// ==========================================
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ==========================================
// Fetch: apply strategy based on request type
// ==========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Forward POST, PUT, DELETE directly to network
  if (request.method !== 'GET') {
    return;
  }

  // API requests: Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 3000));
    return;
  }

  // HTML navigation: Network First (with offline fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, DYNAMIC_CACHE, 3000)
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Static assets: Cache First
  if (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font' ||
      request.destination === 'image') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Others: Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// ==========================================
// Strategy functions
// ==========================================
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Resource not available', { status: 404 });
  }
}

async function networkFirst(request, cacheName, timeoutMs) {
  try {
    const response = await promiseWithTimeout(fetch(request), timeoutMs);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise;
}

function promiseWithTimeout(promise, ms) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeout]);
}
```

### 5.2 Offline Fallback Page

```html
<!-- offline.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
      color: #333;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1.5rem; }
    button {
      padding: 0.75rem 2rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 1rem;
    }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#128268;</div>
    <h1>No connection</h1>
    <p>It looks like you are not connected to the internet.<br>Please check your connection and try again.</p>
    <button onclick="window.location.reload()">Retry</button>
  </div>
</body>
</html>
```

---

## 6. Service Worker Development with Workbox

Workbox is a set of libraries developed by Google for Service Workers. It provides features such as cache strategy implementations, precache manifest generation, and routing, significantly improving the productivity and quality of Service Worker development.

### 6.1 Workbox Architecture

```
+-----------------------------------------------------------+
|  Workbox Module Structure                                  |
+-----------------------------------------------------------+
|                                                           |
|  workbox-routing          workbox-strategies              |
|  +------------------+    +------------------+             |
|  | registerRoute()  |--->| CacheFirst       |             |
|  | NavigationRoute  |    | NetworkFirst     |             |
|  | RegExpRoute      |    | StaleWhileRevali.|             |
|  +------------------+    | NetworkOnly      |             |
|                          | CacheOnly        |             |
|                          +--------+---------+             |
|                                   |                       |
|  workbox-precaching        workbox-expiration             |
|  +------------------+    +------------------+             |
|  | precacheAndRoute()|    | ExpirationPlugin |             |
|  | __WB_MANIFEST    |    | maxEntries       |             |
|  +------------------+    | maxAgeSeconds    |             |
|                          +------------------+             |
|                                                           |
|  workbox-cacheable-response   workbox-background-sync     |
|  +------------------+         +------------------+        |
|  | CacheableResp.   |         | BackgroundSync   |        |
|  | Plugin           |         | Plugin           |        |
|  | statuses: [0,200]|         | Queue            |        |
|  +------------------+         +------------------+        |
|                                                           |
|  workbox-window (page side)                               |
|  +------------------+                                     |
|  | Workbox class     |                                     |
|  | register()        |                                     |
|  | messageSkipWaiting|                                     |
|  +------------------+                                     |
+-----------------------------------------------------------+
```

### 6.2 How to Install Workbox

Workbox can be installed in three ways.

```javascript
// Method 1: Load via importScripts from CDN (for prototyping)
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Method 2: Install as npm packages (recommended)
// npm install workbox-precaching workbox-routing workbox-strategies
//            workbox-expiration workbox-cacheable-response

// Method 3: Generate project with Workbox CLI
// npx workbox-cli wizard
```

### 6.3 Service Worker Implementation with Workbox

```javascript
// sw.js -- Workbox-based Service Worker

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// ==========================================
// Precache: manifest generated at build time
// ==========================================
// __WB_MANIFEST is automatically replaced with the list of files to precache
// by build tools (workbox-webpack-plugin, workbox-build, @vite-plugin/pwa, etc.)
precacheAndRoute(self.__WB_MANIFEST);

// Automatically clean up outdated precaches
cleanupOutdatedCaches();

// ==========================================
// Images: Cache First + expiration + size limit
// ==========================================
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]  // Allow opaque responses as well
      }),
      new ExpirationPlugin({
        maxEntries: 100,           // Max 100 entries
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true    // Auto-delete when storage is low
      })
    ]
  })
);

// ==========================================
// Fonts: Cache First (long-term caching)
// ==========================================
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
      })
    ]
  })
);

// ==========================================
// CSS / JS: Stale-While-Revalidate
// ==========================================
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

// ==========================================
// API: Network First + timeout
// ==========================================
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60 // 5 minutes
      })
    ]
  })
);

// ==========================================
// HTML navigation: Network First + offline fallback
// ==========================================
const navigationHandler = new NetworkFirst({
  cacheName: 'pages-cache',
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200]
    })
  ]
});

// NavigationRoute only matches requests with mode: 'navigate'
const navigationRoute = new NavigationRoute(navigationHandler, {
  // Excluded paths: skip requests for API and static files
  denylist: [
    /\/api\//,
    /\.(js|css|png|jpg|svg|woff2?)$/
  ]
});

registerRoute(navigationRoute);

// ==========================================
// Background sync: form submissions when offline
// ==========================================
const bgSyncPlugin = new BackgroundSyncPlugin('form-submissions', {
  maxRetentionTime: 24 * 60 // 24 hours (in minutes)
});

registerRoute(
  ({ url }) => url.pathname === '/api/submit',
  new NetworkFirst({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);
```

### 6.4 Using Workbox Window on the Page Side

```javascript
// main.js -- page-side script
import { Workbox } from 'workbox-window';

if ('serviceWorker' in navigator) {
  const wb = new Workbox('/sw.js');

  // When a new SW is installed and enters the waiting state
  wb.addEventListener('waiting', (event) => {
    // Show UI to notify the user of an update
    const shouldUpdate = confirm(
      'A new version is available. Would you like to update?'
    );

    if (shouldUpdate) {
      // Tell the waiting SW to skip waiting
      wb.messageSkipWaiting();
    }
  });

  // When the controller changes (new SW becomes active)
  wb.addEventListener('controlling', () => {
    // Reload the page to apply the new SW
    window.location.reload();
  });

  // When the SW becomes active for the first time
  wb.addEventListener('activated', (event) => {
    if (!event.isUpdate) {
      // Initial install: notify that caching is complete
      console.log('Service Worker has been installed');
    }
  });

  wb.register();
}
```

### 6.5 Integration with Build Tools

```javascript
// vite.config.js -- Vite + VitePWA plugin
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt', // 'autoUpdate' or 'prompt'
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'My Application',
        short_name: 'MyApp',
        description: 'A progressive web application',
        theme_color: '#3b82f6',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Glob patterns for precaching
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Runtime caching configuration
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.example\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
```

```javascript
// webpack.config.js -- Webpack + InjectManifest
const { InjectManifest } = require('workbox-webpack-plugin');

module.exports = {
  // ... webpack configuration
  plugins: [
    new InjectManifest({
      swSrc: './src/sw.js',        // Source SW file
      swDest: 'sw.js',             // Output destination
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      include: [/\.html$/, /\.js$/, /\.css$/, /\.woff2$/],
      exclude: [/\.map$/, /manifest\.json$/]
    })
  ]
};
```

---

## 7. Building PWAs (Progressive Web Apps)

### 7.1 PWA Requirements and Components

A PWA meets the following three requirements to become a web app installable from the browser.

```
+-----------------------------------------------------------+
|  PWA Components                                            |
+-----------------------------------------------------------+
|                                                           |
|  1. Service Worker                                        |
|     - Has a fetch event handler                           |
|     - Can return responses when offline                   |
|                                                           |
|  2. Web App Manifest (manifest.json)                      |
|     - name (or short_name)                                |
|     - icons (192x192 or larger)                           |
|     - start_url                                           |
|     - display (standalone, fullscreen, minimal-ui)        |
|                                                           |
|  3. HTTPS                                                 |
|     - All pages are served over HTTPS                     |
|     - localhost is an exception for development           |
|                                                           |
|  +----------------------------------------------------+   |
|  | Additional requirements to be installable (Chrome) |   |
|  | - beforeinstallprompt event fires                   |   |
|  | - User has browsed the site for 30+ seconds         |   |
|  | - Service Worker has a fetch handler                |   |
|  +----------------------------------------------------+   |
+-----------------------------------------------------------+
```

### 7.2 Web App Manifest Details

```json
{
  "name": "Task Management Application",
  "short_name": "Tasks",
  "description": "A progressive web app for efficiently managing team tasks",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "lang": "en",
  "dir": "ltr",
  "categories": ["productivity", "utilities"],
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/maskable-icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Desktop home screen"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Mobile home screen"
    }
  ],
  "shortcuts": [
    {
      "name": "New Task",
      "short_name": "New",
      "description": "Create a new task",
      "url": "/tasks/new?source=shortcut",
      "icons": [
        {
          "src": "/icons/shortcut-new.png",
          "sizes": "96x96"
        }
      ]
    },
    {
      "name": "Today's Tasks",
      "short_name": "Today",
      "url": "/tasks/today?source=shortcut"
    }
  ],
  "share_target": {
    "action": "/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "media",
          "accept": ["image/*", "video/*"]
        }
      ]
    }
  },
  "protocol_handlers": [
    {
      "protocol": "web+task",
      "url": "/tasks/%s"
    }
  ]
}
```

### 7.3 display Mode Comparison

| display mode | Browser UI | Address bar | Status bar | Use case |
|---------------|------------|-------------|--------------|------|
| fullscreen | Hidden | Hidden | Hidden | Games, immersive content |
| standalone | Hidden | Hidden | Shown | General apps (recommended) |
| minimal-ui | Minimal | Shown (reduced) | Shown | Apps that need navigation features |
| browser | Full | Shown | Shown | Regular websites |

### 7.4 Controlling the Install Prompt

```javascript
// install-prompt.js -- controlling the install prompt
class PWAInstallManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // beforeinstallprompt: when the browser determines the app is installable
    window.addEventListener('beforeinstallprompt', (event) => {
      // Suppress the default prompt
      event.preventDefault();
      this.deferredPrompt = event;

      // Show a custom "Install" button
      this.showInstallButton();
    });

    // appinstalled: when installation is complete
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.hideInstallButton();

      // Record installation in analytics
      this.trackInstallation();
    });

    // Monitor display-mode changes (whether opened in standalone mode)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      if (e.matches) {
        console.log('PWA opened in standalone mode');
      }
    });
  }

  showInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) {
      btn.style.display = 'block';
      btn.addEventListener('click', () => this.promptInstall());
    }
  }

  hideInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) {
      btn.style.display = 'none';
    }
  }

  async promptInstall() {
    if (!this.deferredPrompt) return;

    // Show the install prompt
    this.deferredPrompt.prompt();

    // Wait for user's choice
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log('Install prompt outcome:', outcome);

    if (outcome === 'accepted') {
      console.log('User accepted installation');
    } else {
      console.log('User declined installation');
    }

    this.deferredPrompt = null;
  }

  trackInstallation() {
    // Send install event to Google Analytics or similar
    if (typeof gtag === 'function') {
      gtag('event', 'pwa_install', {
        event_category: 'PWA',
        event_label: 'install'
      });
    }
  }

  // Determine if running as PWA
  static isRunningAsPWA() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true || // iOS Safari
      document.referrer.includes('android-app://') // TWA
    );
  }
}

// Initialize
const pwaInstaller = new PWAInstallManager();
```

### 7.5 PWA Support for iOS Safari

iOS Safari only supports a subset of Web App Manifest features and requires proprietary meta tags in some cases.

```html
<head>
  <!-- Standard manifest -->
  <link rel="manifest" href="/manifest.json">

  <!-- Settings for iOS Safari -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Task Manager">

  <!-- Icons for iOS -->
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png">

  <!-- Splash screen for iOS -->
  <link rel="apple-touch-startup-image"
        media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        href="/splash/iPhone_13_portrait.png">
  <link rel="apple-touch-startup-image"
        media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        href="/splash/iPhone_13_Pro_Max_portrait.png">

  <!-- Theme color -->
  <meta name="theme-color" content="#3b82f6">

  <!-- Windows tile settings -->
  <meta name="msapplication-TileColor" content="#3b82f6">
  <meta name="msapplication-TileImage" content="/icons/mstile-144x144.png">
</head>
```

---

## 8. Advanced Cache Patterns

### 8.1 Cache Versioning Strategy

Cache versioning is an important mechanism for properly managing old caches when an application is updated.

```javascript
// Cache versioning approaches

// Approach 1: Single version number (simple but coarse-grained)
const CACHE_VERSION = 'v3';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;

// Approach 2: Separate versions per resource type
const CACHES = {
  static: 'static-v5',
  images: 'images-v2',
  api: 'api-v1',
  pages: 'pages-v3'
};

// Approach 3: Use build hash (integrated with build tools)
const BUILD_HASH = '8f4a2c1e'; // Injected at build time
const CACHES_BY_HASH = {
  precache: `precache-${BUILD_HASH}`,
  runtime: 'runtime-v1'
};

// Delete old caches in the activate event
self.addEventListener('activate', (event) => {
  const validCacheNames = Object.values(CACHES);
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          // Delete anything not in the valid cache names
          if (!validCacheNames.includes(key)) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});
```

### 8.2 Handling Range Requests

Video and audio playback requires handling Range Requests (partial content retrieval).

```javascript
// Cache First strategy with Range Request support
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.destination === 'video' || request.destination === 'audio') {
    event.respondWith(handleRangeRequest(request));
  }
});

async function handleRangeRequest(request) {
  const cache = await caches.open('media-cache');
  const cachedResponse = await cache.match(request.url, { ignoreSearch: true });

  if (!cachedResponse) {
    // Not in cache: fetch from network and cache
    try {
      const networkResponse = await fetch(request);
      // Save entire content to cache (without Range)
      const fullRequest = new Request(request.url);
      cache.put(fullRequest, networkResponse.clone());
      return networkResponse;
    } catch (error) {
      return new Response('Media not available offline', { status: 503 });
    }
  }

  // In cache: handle Range header
  const rangeHeader = request.headers.get('Range');
  if (!rangeHeader) {
    return cachedResponse;
  }

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const bytes = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader);

  if (!bytes) {
    return new Response(arrayBuffer, {
      status: 200,
      headers: cachedResponse.headers
    });
  }

  const start = Number(bytes[1]);
  const end = bytes[2] ? Number(bytes[2]) : arrayBuffer.byteLength - 1;
  const slicedBuffer = arrayBuffer.slice(start, end + 1);

  return new Response(slicedBuffer, {
    status: 206,
    statusText: 'Partial Content',
    headers: new Headers({
      'Content-Type': cachedResponse.headers.get('Content-Type'),
      'Content-Range': `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
      'Content-Length': slicedBuffer.byteLength
    })
  });
}
```

### 8.3 Cache Size Management

Build a mechanism to manage cache size so that storage quotas are not exceeded.

```javascript
// Cache size management utility
class CacheManager {
  constructor(cacheName, options = {}) {
    this.cacheName = cacheName;
    this.maxEntries = options.maxEntries || 100;
    this.maxAgeMs = (options.maxAgeSeconds || 7 * 24 * 60 * 60) * 1000;
  }

  // Add entry (automatically removes old ones)
  async put(request, response) {
    const cache = await caches.open(this.cacheName);

    // Record timestamp in headers
    const headers = new Headers(response.headers);
    headers.set('sw-cache-timestamp', Date.now().toString());

    const timestampedResponse = new Response(await response.blob(), {
      status: response.status,
      statusText: response.statusText,
      headers
    });

    await cache.put(request, timestampedResponse);

    // Apply entry count limit
    await this.expireEntries();
  }

  // Delete expired and excess entries
  async expireEntries() {
    const cache = await caches.open(this.cacheName);
    const keys = await cache.keys();

    // Collect entries with timestamps
    const entries = await Promise.all(
      keys.map(async (request) => {
        const response = await cache.match(request);
        const timestamp = response.headers.get('sw-cache-timestamp');
        return {
          request,
          timestamp: timestamp ? parseInt(timestamp, 10) : 0
        };
      })
    );

    // Sort from oldest to newest
    entries.sort((a, b) => a.timestamp - b.timestamp);

    const now = Date.now();
    let deleted = 0;

    for (const entry of entries) {
      const isExpired = (now - entry.timestamp) > this.maxAgeMs;
      const isOverLimit = (entries.length - deleted) > this.maxEntries;

      if (isExpired || isOverLimit) {
        await cache.delete(entry.request);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`[CacheManager] Deleted ${deleted} entries from ${this.cacheName}`);
    }
  }

  // Check storage usage
  static async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { usage, quota } = await navigator.storage.estimate();
      return {
        usageMB: (usage / (1024 * 1024)).toFixed(2),
        quotaMB: (quota / (1024 * 1024)).toFixed(2),
        percentUsed: ((usage / quota) * 100).toFixed(2)
      };
    }
    return null;
  }
}
```

### 8.4 Navigation Preload

Navigation Preload is a mechanism that improves navigation performance by parallelizing Service Worker startup with network requests.

```javascript
// Enable Navigation Preload in the activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        // Enable Navigation Preload
        await self.registration.navigationPreload.enable();
        // Set a custom header (optional)
        await self.registration.navigationPreload.setHeaderValue('true');
      }
    })()
  );
});

// Use preloadResponse in the fetch event
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Use the Navigation Preload response
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            // Save to cache
            const cache = await caches.open('pages-cache');
            cache.put(event.request, preloadResponse.clone());
            return preloadResponse;
          }

          // Fall back to normal fetch if preload is unavailable
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // Offline: fall back to cache
          const cached = await caches.match(event.request);
          return cached || caches.match('/offline.html');
        }
      })()
    );
  }
});
```

---

## Prerequisites

To get the most out of this chapter, it is recommended that you have acquired the following prerequisite knowledge.

- **Web Storage basics**: It is desirable to understand how to use localStorage and sessionStorage, storage limitations, and the security model. See [Web Storage and Cookies](./00-web-storage.md) for details.
- **Understanding the Fetch API**: Understanding the basic operations of the Fetch API (handling Request/Response objects, CORS, opaque responses), which forms the foundation of Service Worker network interception, is required. See [Fetch API and Streams](../03-web-apis/01-fetch-and-streams.md) for details.
- **Promise-based asynchronous programming**: All Service Worker APIs are Promise-based, so being able to use asynchronous control patterns such as async/await, Promise.all, and Promise.race is a prerequisite.

Even without this knowledge it is possible to work through this chapter, but reading the above guides first will deepen your understanding.

---

## FAQ

### Q1: When should skipWaiting() and clients.claim() be used in Service Worker lifecycle management?

**A**: Use `skipWaiting()` and `clients.claim()` under the following conditions.

- **When to use skipWaiting()**:
  - When all versions of the application are mutually compatible (cache keys and data structures don't change)
  - When you want to apply an emergency bug fix or critical security patch immediately
  - When you want rapid iteration in a prototype or development environment

- **When NOT to use skipWaiting()**:
  - When new and old Service Workers change cache schemas or data structures (risk of breaking tabs controlled by old SW)
  - In environments with many users who have multiple tabs open and you want to maintain consistency

- **When to use clients.claim()**:
  - When you want the Service Worker to immediately take control of already-open pages on first install
  - When combined with `skipWaiting()` to make a new SW immediately control all tabs

In practice, it is recommended to show the user a "Update available" banner and only call `skipWaiting()` when the user explicitly approves.

### Q2: What are the criteria for choosing a cache strategy (Cache First vs Network First, etc.)?

**A**: Select based on the following criteria according to the characteristics of the resource.

| Resource type | Recommended strategy | Reason |
|------------|---------|------|
| Build-hashed JS/CSS | Cache First | Versioned by hash, so can be permanently used once cached |
| Web fonts | Cache First | Extremely low change frequency; long-term caching is effective |
| Logos and icon images | Cache First | Brand assets rarely change and fast display is required |
| API responses | Network First | Prioritize latest data; only return from cache when offline |
| HTML pages | Network First or Stale-While-Revalidate | Prioritize fresh content; fall back to cache when offline |
| User avatar images | Stale-While-Revalidate | Display immediately while fetching latest version in background |
| News feed | Stale-While-Revalidate or Network First | Freshness is important but immediate display is also required |
| Auth API, payment processing | Network Only | Do not use cache for security and data integrity |
| Precached static resources | Cache Only | Limit to what was explicitly cached in the install event |

When selecting a strategy, consider the tradeoff between user experience (speed vs freshness) and the need for offline support.

### Q3: What is the best practice for Service Worker updates and versioning?

**A**: Combining the following approaches enables safe and efficient update management.

**1. Include a version number or build hash in the cache name**

```javascript
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
```

Or use a hash injected by the build tool.

```javascript
const BUILD_HASH = '__BUILD_HASH__'; // Replaced by Webpack/Vite
const STATIC_CACHE = `static-${BUILD_HASH}`;
```

**2. Delete old caches in the activate event**

```javascript
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => !validCaches.includes(key))
           .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});
```

**3. Notify the user of updates and get explicit approval**

```javascript
// Page side
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload();
});

const registration = await navigator.serviceWorker.getRegistration();
registration.addEventListener('updatefound', () => {
  const newWorker = registration.installing;
  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      // Notify user that "Update is available"
      showUpdateBanner(() => {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
      });
    }
  });
});

// SW side
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

**4. Leverage tools like Workbox or VitePWA**

Using Workbox's `precacheAndRoute(__WB_MANIFEST)` automatically manages versioning through a manifest generated at build time.

**5. Validate the Service Worker version in the CI/CD pipeline**

Record the hash of the Service Worker file at deployment time and treat it as a new version only when it changes, preventing unnecessary updates.

---

## Summary

Service Worker and cache strategies are core technologies for offline support and performance optimization in modern web applications. The content of this chapter is organized in the table below.

| Category | Key technologies/strategies | Purpose |
|---------|--------------|------|
| Lifecycle management | register, install, activate, skipWaiting, clients.claim | Service Worker registration, update, and activation control |
| Cache operations | Cache API (open, put, match, delete, keys) | Caching of HTTP requests/responses |
| Cache strategies | Cache First, Network First, Stale-While-Revalidate, Cache Only, Network Only | Selecting the optimal delivery method based on resource characteristics |
| Integrated development | Workbox (precaching, routing, strategies, expiration, backgroundSync) | Efficient Service Worker development and improved maintainability |
| PWA construction | Web App Manifest, beforeinstallprompt, installability | Realizing installable web applications |
| Versioning | Cache name management, deleting old caches in activate event | Safe updates and proper storage management |
| Advanced patterns | Navigation Preload, Range Request support, cache size management | Performance optimization and support for large files |

### Key Points

1. **Service Worker has a complex lifecycle**: It is important to accurately understand each phase of install, waiting, and activate, and to understand the effects of `skipWaiting()` and `clients.claim()`. Improper use can cause inconsistent application state between multiple tabs.

2. **Cache strategies are a "combination," not just one**: By using different strategies based on the nature of resources — Cache First for static assets, Network First for APIs, Stale-While-Revalidate for user avatars — you can achieve the optimal balance of speed and freshness.

3. **Workbox greatly reduces implementation complexity**: While it is possible to implement fetch event handlers manually, using Workbox allows you to implement advanced features such as automatic precache manifest generation, expiration management, and background sync concisely. Introducing Workbox is strongly recommended, especially for large-scale projects.

By mastering Service Worker and cache strategies, you can build robust and responsive web applications that are unaffected by network conditions.

---

## What to Read Next

After understanding the foundations of Service Worker, it is recommended to move on to performance measurement and user experience optimization.

- **[Performance API](./02-performance-api.md)**: Learn how to measure Navigation Timing, Resource Timing, and Core Web Vitals (LCP/INP/CLS), and practice performance auditing with Lighthouse. You will be able to quantitatively evaluate the impact of Service Worker caching on performance metrics.

---

## References

1. Google Developers. "Service Worker API." MDN Web Docs, 2024. https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
2. Google. "Service Workers: an Introduction." web.dev, 2024. https://web.dev/articles/service-workers-introduction
3. Google. "The Service Worker Lifecycle." web.dev, 2024. https://web.dev/articles/service-worker-lifecycle
4. Google. "Workbox: JavaScript Libraries for adding offline support to web apps." GitHub, 2024. https://github.com/GoogleChrome/workbox
5. Google. "The Offline Cookbook." web.dev, 2024. https://web.dev/articles/offline-cookbook
6. Jake Archibald. "The Service Worker Lifecycle." 2016. https://jakearchibald.com/2016/service-worker-lifecycle/
7. W3C. "Service Workers Nightly." W3C Editor's Draft, 2024. https://w3c.github.io/ServiceWorker/
8. Google. "Progressive Web Apps." web.dev, 2024. https://web.dev/explore/progressive-web-apps
9. Google. "Web App Manifest." MDN Web Docs, 2024. https://developer.mozilla.org/en-US/docs/Web/Manifest
