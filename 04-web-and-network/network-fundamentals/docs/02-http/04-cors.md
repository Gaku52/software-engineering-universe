# CORS (Cross-Origin Resource Sharing)

> CORS is a mechanism for safely relaxing the browser's security feature known as the Same-Origin Policy. Understand preflight requests, allowed headers, and credentials configuration to set up CORS correctly.

## Prerequisites

Having the following knowledge will deepen your understanding before reading this guide:

- [HTTP Basics](./00-http-basics.md) — how requests/responses, headers, and status codes work
- Browser security model — Same-Origin Policy, sandboxing, and security boundaries
- [TLS/SSL](../03-security/00-tls-ssl.md) — basics of HTTPS encryption and certificates

Without understanding the Same-Origin Policy (SOP), the fundamental web security mechanism, you cannot grasp the essence of CORS. Knowing why browsers restrict cross-origin requests and what attacks they prevent clarifies the design intent of CORS and how to configure it correctly.

---

## What You Will Learn

- [ ] Understand the origin and purpose of the Same-Origin Policy
- [ ] Understand how CORS works and how browsers behave
- [ ] Clearly distinguish between simple requests and preflight requests
- [ ] Learn server-side CORS configuration (Express, nginx, various frameworks)
- [ ] Understand the caveats of CORS with credentials (Cookie/authentication information)
- [ ] Master CORS strategies for both development and production environments
- [ ] Understand security risks and best practices related to CORS

---

## 1. Same-Origin Policy (SOP)

### 1.1 Definition of Origin

To understand the Same-Origin Policy, you first need to understand the exact definition of "origin." An origin is determined by a combination of three elements.

```
Origin = scheme + host + port

  https://example.com:443/path/to/resource?query=value#fragment
  ↑        ↑            ↑    ↑                ↑         ↑
  scheme   host         port path             query     fragment

  * Only scheme, host, and port are used to determine the origin
  * Path, query, and fragment are not included in origin determination
```

### 1.2 Concrete Examples of Same-Origin Determination

```
Reference URL: https://www.example.com/page

Comparison target                           Result    Reason
───────────────────────────────────────────────────────────────
https://www.example.com/other               Same ○    Only path differs
https://www.example.com/page?q=1            Same ○    Only query differs
https://www.example.com:443/page            Same ○    Default port for HTTPS
http://www.example.com/page                 Diff ✗    Scheme differs
https://api.example.com/page                Diff ✗    Host (subdomain) differs
https://example.com/page                    Diff ✗    Host (www presence) differs
https://www.example.com:8443/page           Diff ✗    Port differs
https://www.example.org/page                Diff ✗    Domain differs

* Important: Even a different subdomain means a different origin
   www.example.com and api.example.com are different origins
```

### 1.3 Historical Background of the Same-Origin Policy

The Same-Origin Policy was a security model first introduced in Netscape Navigator 2.02 in 1995. As the Web evolved, it has served as a fundamental security boundary to prevent data theft between different websites.

```
Same-Origin Policy protection model:

  Attack scenario (without SOP):
  ┌──────────────────────────────────────────────────┐
  │ User is browsing evil.com                        │
  │                                                  │
  │  evil.com JS                                     │
  │    │                                             │
  │    │── fetch("https://bank.com/api/balance") ──→ │
  │    │   (User's cookie is automatically sent)     │
  │    │                                             │
  │    │←── { balance: 1000000 } ──────────────────  │
  │    │                                             │
  │    │── Send to evil.com server ──→               │
  │    │   (User's balance information is stolen)    │
  │                                                  │
  │  * Because of SOP, reading this response is      │
  │    blocked by the browser                        │
  └──────────────────────────────────────────────────┘
```

### 1.4 Scope of SOP

The Same-Origin Policy does not apply uniformly to all resources. For historical reasons, the scope differs as follows.

```
What SOP restricts vs. does not restrict:

  ┌─────────────────────────────────┐
  │     What SOP restricts          │
  ├─────────────────────────────────┤
  │ ・fetch / XMLHttpRequest        │
  │ ・Drawing cross-origin images   │
  │   onto Canvas (tainted canvas)  │
  │ ・Web Storage (localStorage,etc)│
  │ ・IndexedDB                     │
  │ ・Cookie (separate rules apply) │
  │ ・DOM access of iframe          │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │     What SOP does NOT restrict  │
  ├─────────────────────────────────┤
  │ ・<img src="...">               │
  │ ・<script src="...">            │
  │ ・<link rel="stylesheet" ...>   │
  │ ・<video> / <audio>             │
  │ ・<form action="...">           │
  │ ・@font-face                    │
  │ ・<iframe> (display OK, DOM no) │
  └─────────────────────────────────┘

  * <script> and <img> are not restricted by SOP because
    cross-origin usage has been common since the early Web
  * However, this has also become a breeding ground for
    attacks like JSONP and CSRF
```

---

## 2. How CORS Works

### 2.1 Overview of CORS

CORS (Cross-Origin Resource Sharing) is an HTTP header-based mechanism for safely relaxing the Same-Origin Policy. When a server explicitly declares "I allow access from this origin," the browser permits access to the response from cross-origin requests.

```
CORS conceptual diagram:

  ┌───────────────┐                        ┌───────────────┐
  │   Browser     │                        │   Server      │
  │               │                        │               │
  │ https://app   │                        │ https://api   │
  │ .example.com  │                        │ .example.com  │
  │               │                        │               │
  │  Frontend     │                        │  Backend      │
  │  (React, etc) │                        │  (Express,etc)│
  │               │                        │               │
  │  ① Send       │── HTTP Request ──→    │               │
  │    request    │   Origin: https://     │  ② Verify     │
  │               │   app.example.com      │    origin     │
  │               │                        │               │
  │  ④ Determine  │←── HTTP Response ──   │  ③ Add CORS   │
  │    if response│   Access-Control-      │    headers    │
  │    can be used│   Allow-Origin:        │               │
  │               │   https://app...       │               │
  └───────────────┘                        └───────────────┘

  Important: CORS is a browser security mechanism
  → Does not apply to server-to-server communication (curl, server-side HTTP clients)
  → It is the mechanism by which the browser decides "whether to pass the response to JS"
  → The request itself does reach the server (except for preflight)
```

### 2.2 Simple Request

A simple request is sent directly to the server without a preflight. It is treated as a simple request when all of the following conditions are met.

```
Conditions for a simple request (all must be satisfied):

  ┌────────────────────────────────────────────────────┐
  │ Condition 1: HTTP method                           │
  │   One of: GET, HEAD, POST                         │
  ├────────────────────────────────────────────────────┤
  │ Condition 2: Headers (only the following allowed)  │
  │   ・Accept                                         │
  │   ・Accept-Language                                │
  │   ・Content-Language                               │
  │   ・Content-Type (see Condition 3)                 │
  │   ・Range (simple range specification only)        │
  ├────────────────────────────────────────────────────┤
  │ Condition 3: Content-Type (one of the following)   │
  │   ・application/x-www-form-urlencoded              │
  │   ・multipart/form-data                            │
  │   ・text/plain                                     │
  ├────────────────────────────────────────────────────┤
  │ Condition 4: ReadableStream is not used            │
  ├────────────────────────────────────────────────────┤
  │ Condition 5: No event listeners attached to        │
  │              XMLHttpRequestUpload                  │
  └────────────────────────────────────────────────────┘

  Simple request flow:

     Browser                              Server
     │                                     │
     │── GET /api/public/data ──────→     │
     │   Host: api.example.com             │
     │   Origin: https://app.example.com   │
     │                                     │
     │                              ┌──────┤ Validates origin
     │                              │      │ and adds CORS headers
     │                              └──────┤
     │                                     │
     │←── 200 OK ──────────────────       │
     │   Access-Control-Allow-Origin:      │
     │     https://app.example.com         │
     │   Content-Type: application/json    │
     │                                     │
     │   {"data": "public info"}           │
     │                                     │

  Browser determination:
  ・Allow-Origin matches the request's Origin → passes response to JS
  ・Allow-Origin is absent or mismatches → CORS error (response discarded)
```

### 2.3 Preflight Request

When simple request conditions are not met, the browser sends a preflight request using the OPTIONS method before the actual request to confirm the server's permission.

```
Typical cases where preflight occurs:

  ① HTTP method is PUT / DELETE / PATCH
  ② Content-Type is application/json
  ③ Custom headers are used (Authorization, X-Custom-Header, etc.)
  ④ Combination of the above

Detailed preflight sequence:

     Browser                              Server
     │                                     │
     │  * About to issue a PUT request     │
     │    via fetch()                      │
     │                                     │
     │  [Phase 1: Preflight]               │
     │                                     │
     │── OPTIONS /api/users/123 ────→     │
     │   Host: api.example.com             │
     │   Origin: https://app.example.com   │
     │   Access-Control-Request-Method:    │
     │     PUT                             │
     │   Access-Control-Request-Headers:   │
     │     Content-Type, Authorization     │
     │                                     │
     │                              ┌──────┤
     │                              │ Check │
     │                              │ perm. │
     │                              └──────┤
     │                                     │
     │←── 204 No Content ──────────       │
     │   Access-Control-Allow-Origin:      │
     │     https://app.example.com         │
     │   Access-Control-Allow-Methods:     │
     │     GET, POST, PUT, DELETE          │
     │   Access-Control-Allow-Headers:     │
     │     Content-Type, Authorization     │
     │   Access-Control-Max-Age: 86400     │
     │                                     │
     │  * Preflight succeeded              │
     │  * Cached for Max-Age duration      │
     │                                     │
     │  [Phase 2: Actual request]          │
     │                                     │
     │── PUT /api/users/123 ────────→     │
     │   Host: api.example.com             │
     │   Origin: https://app.example.com   │
     │   Content-Type: application/json    │
     │   Authorization: Bearer eyJhbG...   │
     │                                     │
     │   {"name": "Updated Name"}          │
     │                                     │
     │←── 200 OK ──────────────────       │
     │   Access-Control-Allow-Origin:      │
     │     https://app.example.com         │
     │   Content-Type: application/json    │
     │                                     │
     │   {"id": 123, "name": "Updated"}    │
     │                                     │

  Note: If preflight fails, the actual request is not sent
  → The server must handle OPTIONS requests
```

### 2.4 Preflight Caching

If preflight requests are sent with every request, they impact performance. The `Access-Control-Max-Age` header allows caching of preflight results.

```
How preflight caching works:

  With Max-Age: 86400 (24 hours)

  Time 00:00  First request
  ├── OPTIONS /api/data ──→ (preflight sent)
  ├── 204 response ←──
  ├── PUT /api/data ──→ (actual request)
  └── 200 response ←──

  Time 01:00  Second request
  ├── (preflight is cache hit → no need to send)
  ├── PUT /api/data ──→ (sent directly)
  └── 200 response ←──

  Time 12:00  Third request
  ├── (cache still valid)
  ├── DELETE /api/data ──→
  └── 200 response ←──

  Time 24:01  After cache expires
  ├── OPTIONS /api/data ──→ (preflight sent again)
  ├── 204 response ←──
  ├── PUT /api/data ──→
  └── 200 response ←──

  Max-Age limit per browser:
  ┌──────────────────────┬────────────────┐
  │ Browser              │ Limit          │
  ├──────────────────────┼────────────────┤
  │ Chrome/Edge          │ 7200s (2h)     │
  │ Firefox              │ 86400s (24h)   │
  │ Safari               │ 604800s (7d)   │
  └──────────────────────┴────────────────┘

  * Even if the server returns Max-Age: 86400, Chrome truncates it to 7200 seconds
  * Default is 5 seconds when Max-Age is omitted
```

---

## 3. CORS Headers in Detail

### 3.1 Response Headers Reference

```
Complete CORS response header reference:

  ┌───────────────────────────────┬──────────────────────────────────┐
  │ Header                        │ Description / Use case           │
  ├───────────────────────────────┼──────────────────────────────────┤
  │ Access-Control-Allow-Origin   │ Specifies the allowed origin     │
  │                               │ Value: specific origin or *      │
  │                               │ Ex: https://app.example.com      │
  │                               │ * Multiple origins not directly  │
  │                               │   specifiable                    │
  ├───────────────────────────────┼──────────────────────────────────┤
  │ Access-Control-Allow-Methods  │ Lists allowed HTTP methods       │
  │                               │ Used in preflight response       │
  │                               │ Ex: GET, POST, PUT, DELETE       │
  ├───────────────────────────────┼──────────────────────────────────┤
  │ Access-Control-Allow-Headers  │ Lists allowed request headers    │
  │                               │ Used in preflight response       │
  │                               │ Ex: Content-Type, Authorization  │
  ├───────────────────────────────┼──────────────────────────────────┤
  │ Access-Control-Expose-Headers │ Specifies response headers       │
  │                               │ accessible from JS               │
  │                               │ Exposed by default: Content-Type,│
  │                               │ Cache-Control, Expires, etc.     │
  │                               │ Ex: X-Request-Id, X-Total-Count  │
  ├───────────────────────────────┼──────────────────────────────────┤
  │ Access-Control-Allow-         │ Whether to allow sending         │
  │ Credentials                   │ credentials (Cookie, auth info)  │
  │                               │ Value: true only (false=omit)    │
  │                               │ * Cannot be combined with        │
  │                               │   Allow-Origin: *                │
  ├───────────────────────────────┼──────────────────────────────────┤
  │ Access-Control-Max-Age        │ Seconds to cache preflight result│
  │                               │ Value: integer (seconds)         │
  │                               │ Ex: 86400 (24 hours)             │
  │                               │ * Upper limit varies per browser │
  └───────────────────────────────┴──────────────────────────────────┘
```

### 3.2 Request Headers Reference

```
CORS request headers (automatically added by browser):

  ┌────────────────────────────────┬─────────────────────────────────┐
  │ Header                         │ Description / Use case          │
  ├────────────────────────────────┼─────────────────────────────────┤
  │ Origin                         │ Origin of the request           │
  │                                │ Automatically added by browser  │
  │                                │ Cannot be changed by JS         │
  │                                │ Ex: https://app.example.com     │
  ├────────────────────────────────┼─────────────────────────────────┤
  │ Access-Control-Request-Method  │ HTTP method to actually use     │
  │                                │ Used in preflight (OPTIONS)     │
  │                                │ Ex: PUT                         │
  ├────────────────────────────────┼─────────────────────────────────┤
  │ Access-Control-Request-Headers │ List of headers to actually use │
  │                                │ Used in preflight (OPTIONS)     │
  │                                │ Ex: Content-Type, Authorization │
  └────────────────────────────────┴─────────────────────────────────┘

  * These headers are automatically set by the browser
  * They cannot be manually set from JavaScript (fetch API, etc.)
  * Spoofing the Origin header is not possible in normal browsers
```

### 3.3 Credentials and CORS

Special rules apply to cross-origin requests that include credentials such as cookies, Authorization headers, or TLS client certificates.

```
Credentials mode settings:

  For fetch API:
  ┌───────────────────────┬──────────────────────────────────────┐
  │ credentials value     │ Behavior                             │
  ├───────────────────────┼──────────────────────────────────────┤
  │ "omit"                │ Never sends cookies                  │
  │                       │ Also ignores cookies in response     │
  ├───────────────────────┼──────────────────────────────────────┤
  │ "same-origin"(default)│ Sends cookies only for same-origin  │
  │                       │ Does not send for cross-origin       │
  ├───────────────────────┼──────────────────────────────────────┤
  │ "include"             │ Sends cookies even cross-origin      │
  │                       │ Server must explicitly allow it      │
  └───────────────────────┴──────────────────────────────────────┘

  Constraints when using credentials:
  ┌──────────────────────────────────────────────────────┐
  │ When using credentials: "include"                    │
  │                                                      │
  │ Server must satisfy ALL of the following:            │
  │                                                      │
  │ 1. Access-Control-Allow-Credentials: true            │
  │ 2. Access-Control-Allow-Origin: (specific origin)    │
  │    * Wildcard "*" cannot be used                     │
  │ 3. Access-Control-Allow-Headers: (specific headers)  │
  │    * Wildcard "*" cannot be used                     │
  │ 4. Access-Control-Allow-Methods: (specific methods)  │
  │    * Wildcard "*" cannot be used                     │
  │ 5. Access-Control-Expose-Headers: (specific headers) │
  │    * Wildcard "*" cannot be used                     │
  └──────────────────────────────────────────────────────┘

  * In credentials mode, all wildcard specifications become invalid
  * This is an important security constraint
```

---

## 4. Server-Side Configuration

### 4.1 CORS Configuration in Express.js

```typescript
// ============================================================
// Express.js CORS configuration - Complete version
// ============================================================

import express from 'express';
import cors from 'cors';

const app = express();

// --------------------------------------------------
// Method 1: cors middleware (recommended)
// --------------------------------------------------

// Basic configuration
app.use(cors({
  // List of allowed origins
  origin: [
    'https://app.example.com',
    'https://admin.example.com',
    'https://staging.example.com',
  ],
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Allowed request headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-Id',
  ],
  // Response headers accessible from JS
  exposedHeaders: [
    'X-Total-Count',
    'X-Request-Id',
    'X-RateLimit-Remaining',
  ],
  // Allow credentials (cookies, etc.)
  credentials: true,
  // Cache duration for preflight results (seconds)
  maxAge: 86400,
  // Return 204 for OPTIONS requests (default: 204)
  optionsSuccessStatus: 204,
}));

// --------------------------------------------------
// Method 2: Dynamic origin validation (pattern matching)
// --------------------------------------------------

const corsOptionsWithDynamicOrigin = cors({
  origin: (origin, callback) => {
    // origin is undefined for same-origin requests
    // (or server-to-server communication)
    if (!origin) {
      return callback(null, true);
    }

    // Whitelist approach
    const whitelist = [
      'https://app.example.com',
      'https://admin.example.com',
    ];

    if (whitelist.includes(origin)) {
      return callback(null, true);
    }

    // Subdomain pattern matching
    const subdomainPattern = /^https:\/\/[\w-]+\.example\.com$/;
    if (subdomainPattern.test(origin)) {
      return callback(null, true);
    }

    // Allow localhost in development environment
    if (process.env.NODE_ENV === 'development') {
      const localhostPattern = /^http:\/\/localhost:\d+$/;
      if (localhostPattern.test(origin)) {
        return callback(null, true);
      }
    }

    // Origin not allowed
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  maxAge: 3600,
});

app.use(corsOptionsWithDynamicOrigin);

// --------------------------------------------------
// Method 3: Per-route CORS configuration
// --------------------------------------------------

// Public API allows wildcard
app.get('/api/public/*', cors({ origin: '*' }), (req, res) => {
  res.json({ data: 'public data' });
});

// Private API allows only specific origin
const privateCors = cors({
  origin: 'https://app.example.com',
  credentials: true,
});

app.get('/api/private/*', privateCors, (req, res) => {
  res.json({ data: 'private data' });
});

// --------------------------------------------------
// Method 4: Manual implementation (without middleware)
// --------------------------------------------------

app.use((req, res, next) => {
  const allowedOrigins = [
    'https://app.example.com',
    'https://admin.example.com',
  ];
  const origin = req.headers.origin;

  // Validate origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // Set Vary header (for CDN cache)
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-Total-Count, X-Request-Id'
  );

  // Respond to preflight request
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
```

### 4.2 CORS Configuration in nginx

```nginx
# ============================================================
# nginx CORS configuration - Complete version for production
# ============================================================

# Define origin whitelist using map
map $http_origin $cors_origin {
    default "";
    "https://app.example.com"     "https://app.example.com";
    "https://admin.example.com"   "https://admin.example.com";
    "https://staging.example.com" "https://staging.example.com";
    # Regex can also be used
    ~^https://[\w-]+\.example\.com$  $http_origin;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    location /api/ {
        # Handle preflight request (OPTIONS)
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin'
                       $cors_origin always;
            add_header 'Access-Control-Allow-Methods'
                       'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers'
                       'Content-Type, Authorization, X-Requested-With' always;
            add_header 'Access-Control-Allow-Credentials'
                       'true' always;
            add_header 'Access-Control-Max-Age'
                       86400 always;
            add_header 'Content-Type'
                       'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        # Add CORS headers to normal requests
        add_header 'Access-Control-Allow-Origin'
                   $cors_origin always;
        add_header 'Access-Control-Allow-Credentials'
                   'true' always;
        add_header 'Access-Control-Expose-Headers'
                   'X-Total-Count, X-Request-Id' always;
        add_header 'Vary' 'Origin' always;

        proxy_pass http://backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Public assets (no CORS headers or wildcard)
    location /static/ {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Cache-Control' 'public, max-age=31536000';
        root /var/www/assets;
    }
}
```

### 4.3 Cross-Origin Requests with fetch API

```typescript
// ============================================================
// fetch API CORS request examples
// ============================================================

// --- Example 1: Simple request (GET to fetch JSON) ---
async function fetchPublicData(): Promise<void> {
  try {
    const response = await fetch('https://api.example.com/api/public/data', {
      method: 'GET',
      // Satisfies simple request conditions,
      // so no preflight occurs
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Fetch succeeded:', data);
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      // TypeError occurs in case of CORS error
      console.error('CORS error or network error');
    } else {
      console.error('Other error:', error);
    }
  }
}

// --- Example 2: Request with credentials (send Cookie) ---
async function fetchWithCredentials(): Promise<void> {
  const response = await fetch('https://api.example.com/api/user/profile', {
    method: 'GET',
    credentials: 'include', // Send cookies
    // When credentials: 'include' is specified,
    // server must return Access-Control-Allow-Credentials: true
    // and * cannot be used for Allow-Origin
  });

  const profile = await response.json();
  console.log('Profile:', profile);
}

// --- Example 3: Request that triggers preflight ---
async function updateUser(userId: number, data: object): Promise<void> {
  const response = await fetch(
    `https://api.example.com/api/users/${userId}`,
    {
      method: 'PUT',                      // → triggers preflight (not simple)
      headers: {
        'Content-Type': 'application/json', // → triggers preflight
        'Authorization': 'Bearer eyJhbG...', // → triggers preflight
        'X-Request-Id': crypto.randomUUID(), // → triggers preflight
      },
      credentials: 'include',
      body: JSON.stringify(data),
    }
  );

  // Access to response headers
  // * Only headers included in Expose-Headers can be retrieved
  const requestId = response.headers.get('X-Request-Id');
  const totalCount = response.headers.get('X-Total-Count');

  const result = await response.json();
  console.log('Update result:', result);
}

// --- Example 4: CORS request with timeout using AbortController ---
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

## 5. Common CORS Errors and How to Fix Them

### 5.1 Error Pattern Reference

CORS errors are displayed in the browser console, but for security reasons, detailed error information cannot be obtained from JavaScript. Below is a comprehensive list of representative error patterns and their fixes.

```
Error pattern comparison table:

  ┌───┬──────────────────────────────┬──────────────────────┬─────────────────────────────┐
  │ # │ Console message (summary)    │ Cause                │ Fix                         │
  ├───┼──────────────────────────────┼──────────────────────┼─────────────────────────────┤
  │ 1 │ No 'Access-Control-Allow-    │ Server is not        │ Configure Allow-Origin      │
  │   │ Origin' header is present    │ returning CORS       │ header on server            │
  │   │                              │ headers              │                             │
  ├───┼──────────────────────────────┼──────────────────────┼─────────────────────────────┤
  │ 2 │ The value of the 'Access-    │ Allow-Origin value   │ Return a value that exactly │
  │   │ Control-Allow-Origin' header │ does not match the   │ matches Origin, or set it   │
  │   │ must not be the wildcard '*' │ request's Origin, or │ dynamically via whitelist   │
  │   │ when credentials mode is     │ * is used with       │                             │
  │   │ 'include'                    │ credentials          │                             │
  ├───┼──────────────────────────────┼──────────────────────┼─────────────────────────────┤
  │ 3 │ Response to preflight        │ Response to OPTIONS  │ Implement a handler for     │
  │   │ request doesn't pass access  │ request is invalid   │ OPTIONS method              │
  │   │ control check                │                      │                             │
  ├───┼──────────────────────────────┼──────────────────────┼─────────────────────────────┤
  │ 4 │ Method PUT is not allowed by │ Required method is   │ Add the method you need     │
  │   │ Access-Control-Allow-Methods │ not in Allow-Methods │ to Allow-Methods            │
  ├───┼──────────────────────────────┼──────────────────────┼─────────────────────────────┤
  │ 5 │ Request header field         │ Required header is   │ Add the header you need     │
  │   │ Authorization is not allowed │ not in Allow-Headers │ to Allow-Headers            │
  │   │ by Access-Control-Allow-     │                      │                             │
  │   │ Headers                      │                      │                             │
  ├───┼──────────────────────────────┼──────────────────────┼─────────────────────────────┤
  │ 6 │ Redirect is not allowed for  │ Preflight response   │ Respond to OPTIONS directly │
  │   │ a preflight request          │ is a redirect        │ (redirects not allowed)     │
  │   │                              │ (301/302)            │                             │
  └───┴──────────────────────────────┴──────────────────────┴─────────────────────────────┘
```

### 5.2 Debugging Steps

Below are systematic debugging steps when a CORS error occurs.

```
CORS error debugging flowchart:

  START: CORS error displayed in console
    │
    ├── Step 1: Check the Network tab in browser DevTools
    │   │
    │   ├── Is there an OPTIONS request?
    │   │   ├── YES → Check the preflight response (Step 2a)
    │   │   └── NO  → Check the simple request response (Step 2b)
    │   │
    │   Step 2a: Check preflight response
    │   ├── Is the status code 200 or 204?
    │   │   ├── NO → Implement/fix the OPTIONS handler
    │   │   └── YES → Check response headers
    │   │       ├── Is Allow-Origin correct?
    │   │       ├── Does Allow-Methods include the required method?
    │   │       └── Does Allow-Headers include the required headers?
    │   │
    │   Step 2b: Check response headers
    │   ├── Does Allow-Origin header exist?
    │   │   ├── NO → Add CORS configuration to server
    │   │   └── YES → Confirm value matches request's Origin
    │   │
    │   Step 3: Check Credentials-related issues
    │   ├── Are you using credentials: 'include'?
    │   │   ├── YES → Check Allow-Origin is not *
    │   │   │         Check Allow-Credentials: true is present
    │   │   └── NO → Proceed to Step 4
    │   │
    │   Step 4: Directly check server response with curl
    │       $ curl -v -X OPTIONS \
    │         -H "Origin: https://app.example.com" \
    │         -H "Access-Control-Request-Method: PUT" \
    │         https://api.example.com/api/data
    │
    └── END: Identify cause → Fix → Clear browser cache → Revalidate
```

### 5.3 CORS Debugging Commands with curl

```bash
# ============================================================
# CORS debugging with curl
# ============================================================

# --- Simulate a preflight request ---
curl -v -X OPTIONS \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  https://api.example.com/api/users

# Expected response headers:
# < HTTP/2 204
# < access-control-allow-origin: https://app.example.com
# < access-control-allow-methods: GET, POST, PUT, DELETE
# < access-control-allow-headers: Content-Type, Authorization
# < access-control-max-age: 86400

# --- Simulate a simple request ---
curl -v \
  -H "Origin: https://app.example.com" \
  https://api.example.com/api/public/data

# --- Simulate a request with credentials ---
curl -v \
  -H "Origin: https://app.example.com" \
  -H "Cookie: session=abc123" \
  https://api.example.com/api/user/profile

# Expected response headers:
# < access-control-allow-origin: https://app.example.com
# < access-control-allow-credentials: true
# (If Allow-Origin is *, it will be a browser error)
```

---

## 6. Handling CORS in Development Environment

### 6.1 Bypass via Proxy (Recommended)

In development environments, avoiding CORS altogether is the least troublesome approach. By configuring a proxy on the frontend development server to relay API requests, all requests appear to be same-origin and CORS becomes unnecessary.

```
How the proxy works:

  Traditional (CORS required):
  ┌─────────────────┐                    ┌─────────────────┐
  │ Browser         │──── direct comm ──→│ API server      │
  │ localhost:5173  │     different origin│ localhost:8080  │
  │                 │←── CORS error ──   │                 │
  └─────────────────┘                    └─────────────────┘

  With proxy (CORS not needed):
  ┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
  │ Browser         │──→│ Vite Dev     │──→│ API server      │
  │ localhost:5173  │    │ Server       │    │ localhost:8080  │
  │                 │    │ /api → proxy │    │                 │
  │ /api/users is   │    │              │    │ /api/users      │
  │ same-origin     │←──│              │←──│                 │
  └─────────────────┘    └──────────────┘    └─────────────────┘

  From the browser's perspective, /api/users is a request to
  localhost:5173 → same-origin → no CORS
```

```typescript
// ============================================================
// Vite proxy configuration (vite.config.ts)
// ============================================================

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Forward requests starting with /api to backend
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Rewrite request path (if needed)
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },

      // WebSocket proxy
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },

      // Route to multiple backends
      '/auth': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    },
  },
});
```

```typescript
// ============================================================
// webpack-dev-server proxy configuration (webpack.config.js)
// ============================================================

module.exports = {
  devServer: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        pathRewrite: { '^/api': '/api' },
        // Error handling
        onError: (err, req, res) => {
          console.error('Proxy error:', err);
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end('Bad Gateway: Backend server is not responding');
        },
      },
    },
  },
};
```

```typescript
// ============================================================
// Next.js rewrite configuration (next.config.js)
// ============================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```

### 6.2 Per-Environment CORS Configuration Pattern

```typescript
// ============================================================
// Per-environment CORS configuration (Express.js)
// ============================================================

import cors from 'cors';

function getCorsOptions(): cors.CorsOptions {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return {
        origin: [
          'https://app.example.com',
          'https://admin.example.com',
        ],
        credentials: true,
        maxAge: 86400,
      };

    case 'staging':
      return {
        origin: [
          'https://staging-app.example.com',
          'https://staging-admin.example.com',
        ],
        credentials: true,
        maxAge: 3600,
      };

    case 'development':
      return {
        origin: (origin, callback) => {
          // Allow any port of localhost in development
          if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        maxAge: 0, // No cache (for easier debugging)
      };

    case 'test':
      return {
        origin: '*', // Allow all origins in test environment
        credentials: false,
      };

    default:
      return {
        origin: false, // Disable CORS (fail safe)
      };
  }
}

app.use(cors(getCorsOptions()));
```

---

## 7. CORS Configuration by Framework

### 7.1 Comparison Table by Major Framework

```
Comparison of CORS configuration methods by framework:

  ┌────────────────┬──────────────────────┬──────────────────────────────┐
  │ Framework      │ Configuration method  │ Characteristics              │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ Express.js     │ cors middleware       │ Most flexible, dynamic       │
  │                │ or manual middleware  │ origin support               │
  │                │                      │ npm: cors package            │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ Fastify        │ @fastify/cors        │ Similar API to Express cors  │
  │                │ plugin               │ Schema validation support    │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ Hono           │ cors() middleware    │ Lightweight, Edge Runtime    │
  │                │ (hono/cors)          │ support (Cloudflare Workers) │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ Django         │ django-cors-headers  │ Centrally configured in      │
  │                │ package              │ settings.py                  │
  │                │                      │ CORS_ALLOWED_ORIGINS, etc.   │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ Flask          │ flask-cors extension │ Decorator or app-wide config │
  │                │                      │ Per-resource configuration   │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ Spring Boot    │ @CrossOrigin         │ Annotation-based             │
  │                │ WebMvcConfigurer     │ Global or per-controller     │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ ASP.NET Core   │ services.AddCors()   │ Policy-based                 │
  │                │ app.UseCors()        │ Named policy support         │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ Go (net/http)  │ Manual or            │ rs/cors package is common    │
  │                │ rs/cors package      │ Middleware pattern           │
  ├────────────────┼──────────────────────┼──────────────────────────────┤
  │ Rust (Actix)   │ actix-cors crate     │ Builder pattern              │
  │                │                      │ Also available via tower-http│
  └────────────────┴──────────────────────┴──────────────────────────────┘
```

### 7.2 Hono (for Edge Runtime)

```typescript
// ============================================================
// Hono CORS configuration (Cloudflare Workers / Deno Deploy, etc.)
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Global CORS configuration
app.use('/api/*', cors({
  origin: [
    'https://app.example.com',
    'https://admin.example.com',
  ],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['X-Total-Count', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400,
}));

// Dynamic origin validation
app.use('/api/v2/*', cors({
  origin: (origin) => {
    // Subdomain pattern matching
    if (/^https:\/\/[\w-]+\.example\.com$/.test(origin)) {
      return origin;
    }
    return null; // Not allowed
  },
  credentials: true,
}));

// Public API uses wildcard
app.use('/api/public/*', cors({
  origin: '*',
  maxAge: 3600,
}));

app.get('/api/data', (c) => {
  return c.json({ message: 'Hello from Edge!' });
});

export default app;
```

### 7.3 CORS Configuration in Django

```python
# ============================================================
# Django CORS configuration (django-cors-headers)
# ============================================================

# settings.py

INSTALLED_APPS = [
    # ...
    'corsheaders',
    # ...
]

MIDDLEWARE = [
    # CORS middleware should be placed as high as possible
    # (to add CORS headers before other middleware modifies the response)
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    # ...
]

# --- Allowed origins ---
CORS_ALLOWED_ORIGINS = [
    'https://app.example.com',
    'https://admin.example.com',
]

# Regex-based allow (for subdomain support)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://[\w-]+\.example\.com$',
]

# --- Allowed methods ---
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# --- Allowed headers ---
CORS_ALLOW_HEADERS = [
    'accept',
    'authorization',
    'content-type',
    'x-csrftoken',
    'x-requested-with',
]

# --- Credentials ---
CORS_ALLOW_CREDENTIALS = True

# --- Preflight cache ---
CORS_PREFLIGHT_MAX_AGE = 86400

# --- Expose Headers ---
CORS_EXPOSE_HEADERS = [
    'x-total-count',
    'x-request-id',
]
```

### 7.4 Go (net/http + rs/cors)

```go
// ============================================================
// Go CORS configuration (github.com/rs/cors)
// ============================================================

package main

import (
    "log"
    "net/http"

    "github.com/rs/cors"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/data", handleData)
    mux.HandleFunc("/api/users", handleUsers)

    // CORS configuration
    c := cors.New(cors.Options{
        AllowedOrigins: []string{
            "https://app.example.com",
            "https://admin.example.com",
        },
        AllowedMethods: []string{
            "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS",
        },
        AllowedHeaders: []string{
            "Content-Type",
            "Authorization",
            "X-Request-Id",
        },
        ExposedHeaders: []string{
            "X-Total-Count",
            "X-Request-Id",
        },
        AllowCredentials: true,
        MaxAge:           86400,
        // Debug mode (enable only during development)
        Debug: false,
    })

    handler := c.Handler(mux)

    log.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", handler))
}

func handleData(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"message": "Hello from Go!"}`))
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("X-Total-Count", "42")
    w.Write([]byte(`{"users": []}`))
}
```

---

## 8. Security Considerations

### 8.1 Anti-Patterns

Understand representative anti-patterns in CORS configuration to avoid security risks.

```
Anti-pattern 1: Reflecting Origin directly (Origin Reflection)

  ✗ Dangerous implementation:

  app.use((req, res, next) => {
    // Return the request's Origin directly in Allow-Origin
    res.setHeader(
      'Access-Control-Allow-Origin',
      req.headers.origin  // ← No validation!
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  Problems:
  ┌──────────────────────────────────────────────────────┐
  │ 1. Requests from any origin are allowed              │
  │ 2. Combined with Credentials: true, this is fatal    │
  │    → Attacker's site can use user's cookies to       │
  │      access the API and read the response            │
  │ 3. Equivalent to Allow-Origin: * but also allows     │
  │    Credentials, making it effectively more dangerous │
  │    than *                                            │
  └──────────────────────────────────────────────────────┘

  ✓ Correct implementation:

  const ALLOWED_ORIGINS = new Set([
    'https://app.example.com',
    'https://admin.example.com',
  ]);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
  });
```

```
Anti-pattern 2: Access-Control-Allow-Origin: * in production

  ✗ Dangerous usage:

  // Using * on an authenticated API in production
  app.use(cors({
    origin: '*',
    // credentials: true cannot be combined with *,
    // so Cookie sending is not possible, but has these problems:
  }));

  Problems:
  ┌──────────────────────────────────────────────────────┐
  │ 1. Data may be retrieved from unintended origins     │
  │ 2. With Bearer token auth, any origin can access     │
  │    the API by sending the token in headers           │
  │ 3. Risk of internal API being called externally      │
  │ 4. Rate limiting and IP restrictions may be bypassed │
  └──────────────────────────────────────────────────────┘

  ✓ Cases where * is acceptable:
  ┌──────────────────────────────────────────────────────┐
  │ ・Fully public API (no auth, no sensitive data)      │
  │ ・Static assets delivered via CDN (images, fonts)    │
  │ ・Public dataset APIs (government open data, etc.)   │
  │ ・Embeddable endpoints like oEmbed                   │
  └──────────────────────────────────────────────────────┘
```

### 8.2 Importance of the Vary Header

```
CDN caching pitfall with CORS:

  Scenario: CDN caches a CORS response

  ① https://app-a.example.com makes a request
     → Server returns Allow-Origin: https://app-a.example.com
     → CDN caches this response

  ② https://app-b.example.com makes a request to the same URL
     → CDN returns the cached response
     → Allow-Origin: https://app-a.example.com (still app-a!)
     → CORS error for app-b

  Fix: Set Vary: Origin header

  res.setHeader('Vary', 'Origin');
  // → CDN maintains separate caches per value of Origin header
  // → Separate caches are created for app-a and app-b

  Vary header flow:
  ┌──────────────────┐
  │ CDN cache        │
  │                  │
  │ Key: URL + Origin│
  │                  │
  │ /api/data        │
  │ + Origin: app-a  │──→ Allow-Origin: app-a
  │                  │
  │ /api/data        │
  │ + Origin: app-b  │──→ Allow-Origin: app-b
  │                  │
  │ /api/data        │
  │ + Origin: (none) │──→ no Allow-Origin
  └──────────────────┘
```

### 8.3 Danger of null Origin

```
Notes on null origin:

  Cases where Origin: null is sent:
  ┌──────────────────────────────────────────────────────┐
  │ ・Requests from file:// protocol                     │
  │ ・Requests from data: URI                            │
  │ ・Sandboxed iframes                                  │
  │ ・Requests during redirect chains                    │
  │ ・Anonymization by browser privacy protection        │
  └──────────────────────────────────────────────────────┘

  ✗ Dangerous implementation:

  // Allowing null origin
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // If allowedOrigins contains 'null' (the string),
  // access from data: URI or sandboxed iframe becomes possible

  ✓ Safe implementation:

  // Explicitly reject null origin
  if (origin && origin !== 'null' && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
```

---

## FAQ (Frequently Asked Questions)

### Q1: Common ways to resolve CORS errors — identifying the cause from the error message

```
■ Representative CORS errors and solutions:

Error 1: "has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header"

  Cause: Server is not returning the Access-Control-Allow-Origin header

  Solution:
  // Express.js
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');
    next();
  });

  // nginx
  add_header Access-Control-Allow-Origin https://app.example.com;

  // Development only (forbidden in production)
  res.setHeader('Access-Control-Allow-Origin', '*');

Error 2: "The value of the 'Access-Control-Allow-Origin' header must not be '*' when credentials mode is 'include'"

  Cause: When using credentials: 'include' (cookie sending),
         wildcard (*) cannot be used

  Solution:
  // Explicitly specify a specific origin
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

Error 3: "has been blocked by CORS policy: Method POST is not allowed by Access-Control-Allow-Methods"

  Cause: Allowed methods are not returned in the preflight request

  Solution:
  app.options('/api/*', (req, res) => {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.status(204).send();
  });

Error 4: "Request header field authorization is not allowed by Access-Control-Allow-Headers"

  Cause: Custom headers (Authorization, etc.) are not allowed

  Solution:
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');

Error 5: "CORS policy: Response to preflight request doesn't pass access control check: status is 401"

  Cause: Authentication is required for the preflight request (OPTIONS)

  Solution:
  // Make OPTIONS requests not require authentication
  app.options('/api/*', (req, res) => {
    // Skip authentication check
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send();
  });

Debugging steps:
  1. Open the Network tab in browser DevTools
  2. Confirm that preflight (OPTIONS) is succeeding
  3. Check response headers:
     ・Is Access-Control-Allow-Origin correct?
     ・Is Access-Control-Allow-Methods included?
     ・Is Access-Control-Allow-Headers included?
  4. Verify directly with curl:
     curl -I -X OPTIONS https://api.example.com/users \
       -H "Origin: https://app.example.com" \
       -H "Access-Control-Request-Method: POST"
```

### Q2: When preflight requests occur — when OPTIONS is sent

```
■ Simple request vs. preflight request:

Simple request (no preflight):
  When all of the following conditions are met, no preflight occurs

  ① Method is one of:
     GET, HEAD, POST

  ② Only the following headers are used (besides auto-set ones):
     Accept
     Accept-Language
     Content-Language
     Content-Type (only the following values)
       ・application/x-www-form-urlencoded
       ・multipart/form-data
       ・text/plain

  ③ ReadableStream is not used in the request

  ④ No event listeners registered on XMLHttpRequest

Cases that trigger preflight:

  ✓ Using custom headers (Authorization, X-Request-Id, etc.)
  fetch('https://api.example.com/users', {
    headers: {
      'Authorization': 'Bearer token',  // ← triggers preflight
    },
  });

  ✓ Content-Type is application/json
  fetch('https://api.example.com/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',  // ← triggers preflight
    },
    body: JSON.stringify({ name: 'Taro' }),
  });

  ✓ PUT, DELETE, PATCH methods
  fetch('https://api.example.com/users/123', {
    method: 'DELETE',  // ← triggers preflight
  });

Preflight flow:

  1. Browser sends OPTIONS request:
     OPTIONS /api/users HTTP/1.1
     Origin: https://app.example.com
     Access-Control-Request-Method: POST
     Access-Control-Request-Headers: content-type, authorization

  2. Server returns permission information:
     HTTP/1.1 204 No Content
     Access-Control-Allow-Origin: https://app.example.com
     Access-Control-Allow-Methods: GET, POST, PUT, DELETE
     Access-Control-Allow-Headers: content-type, authorization
     Access-Control-Max-Age: 86400

  3. Browser sends the actual POST request
     POST /api/users HTTP/1.1
     Content-Type: application/json
     Authorization: Bearer token

Preflight caching:
  Access-Control-Max-Age: 86400 (seconds)
  → Skip preflight for 24 hours and send requests directly
  → Each browser has an upper limit (Chrome: 2 hours)
```

### Q3: Credentials mode configuration — how to send Cookies or Authorization headers

```
■ Types of credentials mode:

┌─────────────┬────────────────────────────────────────┐
│ Mode        │ Behavior                               │
├─────────────┼────────────────────────────────────────┤
│ omit        │ Do not send credentials (default)      │
│             │ → No cookies, no Authorization         │
│             │                                        │
│ same-origin │ Send only for same-origin              │
│             │ → Not sent cross-origin                │
│             │                                        │
│ include     │ Always send (even cross-origin)        │
│             │ → Sends cookies and Authorization      │
│             │ → Requires special configuration       │
│             │   on the server side                   │
└─────────────┴────────────────────────────────────────┘

Client-side configuration:

  fetch('https://api.example.com/users', {
    credentials: 'include',  // ← Send Cookie/Authorization
    headers: {
      'Authorization': 'Bearer token',
    },
  });

Required server-side configuration (when credentials: 'include'):

  ✓ Specify a concrete origin in Access-Control-Allow-Origin (* not allowed)
  res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');

  ✓ Return Access-Control-Allow-Credentials: true
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  ✗ Incorrect example (will cause an error):
  res.setHeader('Access-Control-Allow-Origin', '*');  // ← Not allowed
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // Error: "The value of the 'Access-Control-Allow-Origin' header
  //         must not be '*' when credentials mode is 'include'"

Dynamic origin implementation:

  // Express.js
  const allowedOrigins = [
    'https://app.example.com',
    'https://admin.example.com',
  ];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
  });

Cookie configuration (when sending cross-origin):

  Set-Cookie: session_id=abc123;
    SameSite=None;   ← Allow cross-site sending
    Secure;          ← HTTPS required
    HttpOnly;        ← XSS protection
    Path=/;
    Domain=.example.com

  Notes:
  → When using SameSite=None, the Secure attribute is required
  → SameSite=None does not work over HTTP connections
  → Chrome uses SameSite=Lax as default since 2020

Security notes:
  → credentials: 'include' increases the risk of CSRF attacks
  → Always implement CSRF protection (CSRF tokens)
  → Only allow trusted origins
  → SameSite=Lax or Strict is recommended for cookies (where possible)
```

---

## Summary

| Concept | Key point |
|---------|-----------|
| **Same-Origin Policy** | Same origin only when scheme + host + port all match |
| **CORS** | Mechanism for safely allowing cross-origin requests (controlled server-side) |
| **Simple request** | GET/HEAD/POST + limited headers → no preflight |
| **Preflight request** | OPTIONS → permission check → actual request (custom headers, PUT/DELETE, etc.) |
| **Credentials** | credentials: 'include' + Allow-Origin (not *) + Allow-Credentials: true |
| **Security** | Minimize wildcards (*), reject null origin, validate with Vary: Origin |

### Key Points

1. **CORS is controlled server-side**: Browsers automatically block cross-origin requests and only allow them through when the server explicitly permits. CORS errors cannot be resolved from the client side (JavaScript) alone.

2. **Understanding preflight requests (OPTIONS) is key**: When using custom headers (Authorization, etc.) or application/json, the browser sends an OPTIONS request before the actual request. The server must return 204 without requiring authentication, and use Access-Control-Allow-* headers to communicate permission.

3. **Use credentials: 'include' carefully**: When sending Cookies/Authorization, wildcards (*) cannot be used in Allow-Origin. Implement a dynamic origin response that returns specific origins, and always combine with CSRF protection (CSRF tokens).

---

## Next Guides to Read

- [TLS/SSL](../03-security/00-tls-ssl.md) - Learn about HTTPS encryption, certificates, and cipher suite mechanics
- [Authentication methods](../03-security/01-authentication.md) - Learn about OAuth 2.0, JWT, session management, and other auth fundamentals needed for CORS with credentials
- [Network attacks and defenses](../03-security/02-common-attacks.md) - Learn about attack patterns that exploit misconfigured CORS and how to defend against them

---

## References

1. Fetch Living Standard. "CORS Protocol." WHATWG, 2024.
   https://fetch.spec.whatwg.org/#http-cors-protocol
   Official CORS specification. Defines Same-Origin Policy, preflight requests,
   and credentials mode in detail.

2. MDN Web Docs. "Cross-Origin Resource Sharing (CORS)." Mozilla, 2024.
   https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
   Practical guide to CORS. Detailed explanations of error messages,
   configuration examples, and debugging methods.

3. web.dev. "Cross-Origin Resource Sharing (CORS)." Google, 2024.
   https://web.dev/cross-origin-resource-sharing/
   Google best practices. Secure CORS configuration,
   performance optimization (preflight caching).

4. OWASP. "CORS Security Cheat Sheet." OWASP, 2024.
   https://cheatsheetseries.owasp.org/cheatsheets/CORS_Security_Cheat_Sheet.html
   CORS configuration from a security perspective. Common vulnerabilities,
   secure implementation patterns, and attack scenarios.

5. RFC 6454. "The Web Origin Concept." IETF, 2011.
   https://www.rfc-editor.org/rfc/rfc6454
   Definition of origin and official specification of Same-Origin Policy.
   Defines the concept of security boundaries.

6. "Understanding CORS and Dealing with CORS Errors in Angular." Bitovi, 2023.
   https://www.bitovi.com/blog/understanding-cors-and-dealing-with-cors-errors-in-angular
   Implementation examples and troubleshooting. CORS handling patterns
   in Angular/React/Vue.js.
