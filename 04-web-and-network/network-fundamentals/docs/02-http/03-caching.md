# HTTP Caching

> HTTP caching is the backbone of web performance. Understand Cache-Control, ETags, and CDN mechanics, and design strategies for "what," "where," and "how long" to cache.

## Prerequisites

- Understanding of HTTP headers — Cache-Control, ETag, Last-Modified, Vary, Age, and other cache-related headers

HTTP caching is controlled by HTTP headers. Understanding Cache-Control directives, conditional requests (If-None-Match, If-Modified-Since), and the Vary header is essential for designing correct caching strategies.

---

## What You Will Learn

- [ ] Understand the fundamental principles and types of HTTP caching systematically
- [ ] Configure Cache-Control directives correctly for each situation
- [ ] Understand how conditional requests work with ETag and Last-Modified
- [ ] Design CDN cache configuration and operations
- [ ] Distinguish between cache invalidation and cache busting strategies
- [ ] Apply advanced patterns such as stale-while-revalidate

---

## 1. Basic Principles of HTTP Caching

### 1.1 Why Caching Is Necessary

In web applications, a design where every request reaches the origin server causes the following problems.

1. **Increased latency**: Round-trip time (RTT) to geographically distant servers dominates response speed
2. **Bandwidth waste**: Repeatedly transferring the same resource consumes network bandwidth
3. **Server load**: CPU, memory, and I/O load increase proportionally to the number of requests
4. **Higher costs**: In cloud environments, transfer volume and request count are billed directly
5. **Availability risk**: Service completely stops when the origin server fails

HTTP caching solves these problems comprehensively by storing copies of previously fetched resources at intermediate points (browsers, proxies, CDNs) and returning those copies for subsequent requests to the same resource.

### 1.2 Cache Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                  HTTP Cache Hierarchy                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User A       User B       User C                               │
│    │            │            │                                  │
│    ▼            ▼            ▼                                  │
│  ┌──────┐   ┌──────┐   ┌──────┐      Layer 1: Browser         │
│  │Browser│   │Browser│   │Browser│      Private cache          │
│  │Cache  │   │Cache  │   │Cache  │      (per user)             │
│  └──┬───┘   └──┬───┘   └──┬───┘                               │
│     │  miss     │  miss     │  miss                             │
│     ▼           ▼           ▼                                   │
│  ┌─────────────────────────────┐       Layer 2: Forward        │
│  │   Forward Proxy Cache       │       proxy cache              │
│  │   (corporate proxy, etc.)   │       (shared within org)      │
│  └──────────┬──────────────────┘                                │
│             │  miss                                             │
│             ▼                                                   │
│  ┌─────────────────────────────┐       Layer 3: CDN Edge        │
│  │   CDN Edge Server           │       Edge cache               │
│  │   (CloudFront/Cloudflare)   │       (geographically dist.)   │
│  └──────────┬──────────────────┘                                │
│             │  miss                                             │
│             ▼                                                   │
│  ┌─────────────────────────────┐       Layer 4: CDN Shield      │
│  │   CDN Origin Shield         │       Origin shield             │
│  │   (intermediate cache)      │       (origin protection)      │
│  └──────────┬──────────────────┘                                │
│             │  miss                                             │
│             ▼                                                   │
│  ┌─────────────────────────────┐       Layer 5: Reverse proxy   │
│  │   Reverse Proxy (nginx)     │       in front of server       │
│  └──────────┬──────────────────┘                                │
│             │  miss                                             │
│             ▼                                                   │
│  ┌─────────────────────────────┐       Layer 6: Application     │
│  │   Application Cache         │       Redis/Memcached, etc.    │
│  │   (Redis / Memcached)       │                                │
│  └──────────┬──────────────────┘                                │
│             │  miss                                             │
│             ▼                                                   │
│  ┌─────────────────────────────┐       Layer 7: Database        │
│  │   Database                  │       Persistent storage       │
│  └─────────────────────────────┘                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Private Cache vs Shared Cache

HTTP caches are broadly classified into "private caches" and "shared caches." This distinction is critically important from both security and performance perspectives.

| Property | Private Cache | Shared Cache |
|----------|---------------|--------------|
| Storage location | Browser | CDN, proxy |
| Users | Single user | Multiple users |
| User-specific data | Cacheable | Not cacheable (risk of information leakage) |
| Cache-Control directive | `private` | `public` |
| Capacity | Hundreds of MB to a few GB | Tens of TB to PB (distributed total) |
| Scope of effect | Return visits by same user | Accelerates first-time delivery to all users |
| Ease of invalidation | Instantly via browser operation | Propagation takes time via purge API, etc. |

**Important design principle**: Always set `Cache-Control: private` or `Cache-Control: no-store` on responses that include session information, personal data, or authentication tokens. Setting `public` may cause the CDN to cache the response and serve it to other users.

### 1.4 Cache Freshness Model

HTTP caching operates on the concept of "freshness." A cached response is "fresh" for a certain period, after which it is considered "stale."

```
┌────────────────────────────────────────────────────────────────┐
│              Cache Freshness Lifecycle                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Time 0          max-age (60s)                                 │
│  │                    │                                        │
│  ▼                    ▼                                        │
│  ├────── fresh ───────┼──── stale ────────────────────────▶    │
│  │  (return cache     │  (validation required)                 │
│  │   immediately)     │                                        │
│  │                    │                                        │
│  │  HTTP 200 received │  Send If-None-Match / If-Modified-Since│
│  │  Saved to cache    │  to validate                           │
│  │                    │                                        │
│  │  age = 0           │  age > max-age                         │
│  │                    │                                        │
│  │  Cache-Control:    │  304 Not Modified → reuse cache        │
│  │  max-age=60        │  200 OK → update with new response     │
│  │                    │                                        │
│  └────────────────────┴───────────────────────────────────────│
│                                                                │
│  Freshness calculation:                                        │
│  response_is_fresh = (age < max-age)                           │
│  age = now - date_header_value                                 │
│                                                                │
│  Heuristic caching:                                            │
│  When Cache-Control / Expires are absent, the browser          │
│  independently estimates freshness from Last-Modified          │
│  heuristic_freshness = (now - last_modified) * 0.1             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Note on heuristic caching**: For responses without a Cache-Control header, browsers independently estimate freshness from the Last-Modified header value. This can cause unintentional caching, so it is recommended to set explicit Cache-Control headers on all responses.

---

## 2. Cache-Control Header In Depth

### 2.1 Directives and Their Meanings

The Cache-Control header is the most important mechanism for controlling HTTP cache behavior. Standardized in RFC 9111, it can be used in both requests and responses.

**Response directives**:

| Directive | Meaning | Use case |
|-----------|---------|----------|
| `max-age=N` | Cache is valid (fresh) for N seconds | Basic TTL setting |
| `s-maxage=N` | Expiration time for shared caches in N seconds | CDN-specific TTL |
| `no-cache` | Store in cache but always validate with server before use | Resources like HTML that must always be up to date |
| `no-store` | Do not store in cache at all | Sensitive data |
| `private` | Can only be stored in private cache (browser) | User-specific data |
| `public` | Can be stored in shared caches | Publicly shared data common to all users |
| `must-revalidate` | Must validate with server after expiry (prohibits serving stale) | Critical resources |
| `proxy-revalidate` | `must-revalidate` limited to shared caches | For CDN/proxy |
| `immutable` | Declares that resource will not change | Assets with hashed filenames |
| `no-transform` | Prohibits content transformation by intermediate caches | Prevent transformations like image compression |
| `stale-while-revalidate=N` | Return stale cache for N seconds after expiry while updating in background | Better UX |
| `stale-if-error=N` | Return stale cache for N seconds on origin error | Better availability |

**Request directives**:

| Directive | Meaning | Use case |
|-----------|---------|----------|
| `no-cache` | Query origin without using cache | Force refresh |
| `no-store` | Do not store response in cache | Temporary confidential communication |
| `max-age=0` | Treat cache freshness as 0 (force validation) | Force revalidation |
| `max-stale=N` | Accept cache up to N seconds past expiry | Offline tolerance |
| `min-fresh=N` | Accept only cache that will remain fresh for at least N seconds | Strict freshness requirement |
| `only-if-cached` | Respond only if in cache (504 if not) | Offline mode |

### 2.2 Clearing Up Common Misconceptions

```
┌──────────────────────────────────────────────────────────────────┐
│             Difference Between no-cache and no-store             │
│                    (frequently misunderstood)                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ■ How no-cache works:                                           │
│                                                                  │
│  Client          Cache            Origin                         │
│    │── GET ───────▶│                │                            │
│    │               │ Cache exists   │                            │
│    │               │── If-None-Match ▶│                          │
│    │               │◀── 304 ─────────│  No change               │
│    │◀── cached ────│                │  → return cached           │
│    │               │                │                            │
│    │── GET ───────▶│                │                            │
│    │               │ Cache exists   │                            │
│    │               │── If-None-Match ▶│                          │
│    │               │◀── 200 ─────────│  Changed                 │
│    │◀── new ───────│ Updated        │  → return new response     │
│                                                                  │
│  → Stores in cache. Validates with server every time before use. │
│  → Saves bandwidth with 304 when unchanged.                      │
│                                                                  │
│  ■ How no-store works:                                           │
│                                                                  │
│  Client          Cache            Origin                         │
│    │── GET ───────▶│                │                            │
│    │               │── GET ─────────▶│                           │
│    │               │◀── 200 ─────────│                           │
│    │◀── 200 ───────│ Not saved      │                            │
│    │               │                │                            │
│    │── GET ───────▶│                │                            │
│    │               │── GET ─────────▶│  Full response every time │
│    │               │◀── 200 ─────────│                           │
│    │◀── 200 ───────│ Not saved      │                            │
│                                                                  │
│  → Never stores in cache. Full response required every time.     │
│  → No bandwidth savings.                                         │
│                                                                  │
│  Conclusion: "No caching" = no-store                             │
│              "Cache with validation" = no-cache                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Practical Cache-Control Configuration Patterns

#### Pattern 1: Static Assets (Hashed Filenames)

```nginx
# nginx config example: static files with hash
# File examples: app.a1b2c3d4.js, style.e5f6g7h8.css
location ~* \.[0-9a-f]{8,}\.(js|css|woff2?|png|jpg|webp|avif|svg)$ {
    expires 365d;
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Cache-Strategy "immutable-asset";

    # gzip/brotli compression
    gzip_static on;
    brotli_static on;
}
```

In this pattern, filenames embed a content hash, so when file contents change, the filename itself changes. Therefore, the cache for the existing URL can be declared permanently valid. With the `immutable` directive, the browser will not even send conditional GET requests (revalidation requests) within the expiry period.

#### Pattern 2: HTML Documents

```nginx
# nginx config example: HTML files
location ~* \.html$ {
    add_header Cache-Control "no-cache";
    add_header X-Cache-Strategy "always-validate";

    # Enable ETag (nginx enables it by default)
    etag on;
}
```

HTML files include references to static assets, so they must always serve the latest version. With `no-cache`, the browser retains the cache but always validates with the server before use. If the ETag matches, a 304 response is returned, saving bandwidth.

#### Pattern 3: Public API Responses

```python
# FastAPI example: caching configuration for public API responses
from fastapi import FastAPI, Response
from fastapi.responses import JSONResponse
import hashlib
import json

app = FastAPI()

@app.get("/api/products")
async def get_products(response: Response):
    products = await fetch_products_from_db()

    # Generate ETag from response body
    body = json.dumps(products, sort_keys=True)
    etag = hashlib.md5(body.encode()).hexdigest()

    response.headers["Cache-Control"] = "public, max-age=60, s-maxage=300"
    response.headers["ETag"] = f'"{etag}"'
    response.headers["Vary"] = "Accept-Encoding"

    return products


@app.get("/api/products/{product_id}")
async def get_product(product_id: int, response: Response):
    product = await fetch_product_from_db(product_id)

    body = json.dumps(product, sort_keys=True)
    etag = hashlib.md5(body.encode()).hexdigest()

    # Individual product: shorter cache
    response.headers["Cache-Control"] = "public, max-age=30, s-maxage=120"
    response.headers["ETag"] = f'"{etag}"'
    response.headers["Vary"] = "Accept-Encoding"

    return product
```

#### Pattern 4: User-Specific API Responses

```python
# FastAPI example: caching configuration for user-specific data
from fastapi import FastAPI, Response, Depends

@app.get("/api/me/profile")
async def get_my_profile(
    response: Response,
    current_user = Depends(get_current_user)
):
    profile = await fetch_user_profile(current_user.id)

    # private: only browser can cache. Not stored in CDN
    response.headers["Cache-Control"] = "private, max-age=0, must-revalidate"
    response.headers["ETag"] = f'"{profile.version}"'

    return profile


@app.get("/api/me/settings")
async def get_my_settings(
    response: Response,
    current_user = Depends(get_current_user)
):
    settings = await fetch_user_settings(current_user.id)

    # Settings changes must be reflected in real time
    response.headers["Cache-Control"] = "private, no-cache"
    response.headers["ETag"] = f'"{settings.updated_at.isoformat()}"'

    return settings
```

#### Pattern 5: Sensitive Data

```python
# Do not cache sensitive data at all
@app.get("/api/me/payment-methods")
async def get_payment_methods(
    response: Response,
    current_user = Depends(get_current_user)
):
    methods = await fetch_payment_methods(current_user.id)

    # no-store: do not save to memory or disk
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"  # HTTP/1.0 backward compatibility

    return methods
```

### 2.4 Vary Header and Cache Keys

The `Vary` header specifies which request headers to include in the cache key. Even for the same URL, if request header values differ, they are treated as separate cache entries.

```
How the Vary header works:

  Response: Vary: Accept-Encoding, Accept-Language

  Cache key = URL + Accept-Encoding + Accept-Language

  Request 1: Accept-Encoding: gzip, Accept-Language: ja
    → Stored in cache entry A

  Request 2: Accept-Encoding: br, Accept-Language: ja
    → Stored in cache entry B (different Accept-Encoding)

  Request 3: Accept-Encoding: gzip, Accept-Language: en
    → Stored in cache entry C (different Accept-Language)

  Request 4: Accept-Encoding: gzip, Accept-Language: ja
    → Hit cache entry A

  Note: Specifying Vary: * effectively makes the resource uncacheable
  (since every request is considered unique)
```

**Vary design guidelines**:

| Scenario | Vary setting | Reason |
|----------|-------------|--------|
| Typical API | `Vary: Accept-Encoding` | Separate cache per compression format |
| Multi-language site | `Vary: Accept-Language` | Separate content per language |
| Content negotiation | `Vary: Accept` | Separate responses for JSON/XML, etc. |
| Authenticated API | `Vary: Authorization` | Separate responses per user (not recommended; use private instead) |

---

## 3. Conditional Requests (ETag / Last-Modified)

### 3.1 How ETag (Entity Tag) Works

An ETag is an opaque string that identifies a specific version of a resource. The server attaches it to responses, and the client sends it as a conditional header in subsequent requests.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ETag Validation Flow                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  === First Request ===                                              │
│                                                                     │
│  Client                    Server                                   │
│    │                         │                                      │
│    │── GET /api/users/42 ──▶│                                      │
│    │                         │  Fetch resource                      │
│    │                         │  Calculate ETag: "v1-abc123"         │
│    │                         │                                      │
│    │◀── 200 OK ─────────────│                                      │
│    │   ETag: "v1-abc123"     │                                      │
│    │   Cache-Control: no-cache                                      │
│    │   Content-Length: 245   │                                      │
│    │   Body: {"id":42,...}   │                                      │
│    │                         │                                      │
│    │  Browser saves response │                                      │
│    │  and ETag to cache      │                                      │
│    │                         │                                      │
│  === Second Request (No Change) ===                                 │
│    │                         │                                      │
│    │── GET /api/users/42 ──▶│                                      │
│    │   If-None-Match:        │                                      │
│    │   "v1-abc123"           │                                      │
│    │                         │  Fetch resource                      │
│    │                         │  Calculate ETag: "v1-abc123"         │
│    │                         │  → Match! No change                  │
│    │                         │                                      │
│    │◀── 304 Not Modified ───│                                      │
│    │   ETag: "v1-abc123"     │                                      │
│    │   (no body)             │  ★ Bandwidth saved                   │
│    │                         │                                      │
│    │  Restore response body  │                                      │
│    │  from cache             │                                      │
│    │                         │                                      │
│  === Third Request (Changed) ===                                    │
│    │                         │                                      │
│    │── GET /api/users/42 ──▶│                                      │
│    │   If-None-Match:        │                                      │
│    │   "v1-abc123"           │                                      │
│    │                         │  Fetch resource                      │
│    │                         │  Calculate ETag: "v2-def456"         │
│    │                         │  → Mismatch! Changed                 │
│    │                         │                                      │
│    │◀── 200 OK ─────────────│                                      │
│    │   ETag: "v2-def456"     │                                      │
│    │   Content-Length: 260   │                                      │
│    │   Body: {"id":42,...}   │  ★ Return new response               │
│    │                         │                                      │
│    │  Update cache with new  │                                      │
│    │  response               │                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Strong ETag vs Weak ETag

ETags come in two types: "strong validation" and "weak validation."

```
Strong ETag:
  ETag: "abc123"
  → Guarantees byte-for-byte exact match
  → Can be used for Range requests (partial downloads)
  → Typically generated from content hash (MD5, SHA-256, etc.)

Weak ETag:
  ETag: W/"abc123"
  → Indicates semantic equivalence (does not guarantee byte-for-byte match)
  → Ignores minor differences (whitespace, comments, date formats, etc.)
  → Cannot be used for Range requests

Usage:
  Static files → Strong ETag (file hash)
  Dynamic content → Weak ETag (semantic version)
  HTML templates → Weak ETag (tolerates minor differences in rendered output)
```

### 3.3 ETag Generation Strategies

```python
# ETag generation implementation example
import hashlib
import json
from datetime import datetime

class ETagGenerator:
    @staticmethod
    def from_content(content: bytes) -> str:
        """Generate ETag from content hash (strong ETag)"""
        hash_value = hashlib.sha256(content).hexdigest()[:16]
        return f'"{hash_value}"'

    @staticmethod
    def from_version(version: int, updated_at: datetime) -> str:
        """Generate ETag from version number and updated timestamp (weak ETag)"""
        raw = f"{version}-{updated_at.isoformat()}"
        hash_value = hashlib.md5(raw.encode()).hexdigest()[:12]
        return f'W/"{hash_value}"'

    @staticmethod
    def from_db_row(row: dict, fields: list[str]) -> str:
        """Generate ETag from specific fields in a database row"""
        subset = {k: row[k] for k in fields if k in row}
        raw = json.dumps(subset, sort_keys=True, default=str)
        hash_value = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return f'"{hash_value}"'

# Usage examples
etag1 = ETagGenerator.from_content(b'{"name": "Taro"}')
# → '"a1b2c3d4e5f6g7h8"'

etag2 = ETagGenerator.from_version(3, datetime(2025, 1, 15, 10, 30))
# → 'W/"1a2b3c4d5e6f"'

etag3 = ETagGenerator.from_db_row(
    {"id": 42, "name": "Taro", "email": "taro@example.com", "internal_flag": True},
    ["id", "name", "email"]  # exclude internal_flag
)
# → '"9f8e7d6c5b4a3210"'
```

### 3.4 Comparison with Last-Modified

| Property | ETag | Last-Modified |
|----------|------|---------------|
| Precision | Any granularity (down to bytes) | Second-level (cannot detect changes within 1 second) |
| Corresponding header | `If-None-Match` | `If-Modified-Since` |
| Multiple variants | Possible (comma-separated) | Not possible (single timestamp only) |
| Weak comparison | Possible with `W/"..."` | Inherently weak comparison |
| Server load | Requires hash computation | Can use filesystem mtime |
| Distributed environments | Stable with content-based approach | mtime may differ between servers |
| Range support | Strong ETag only | Not supported |
| Recommendation | Use preferentially | Use as supplementary |

**Recommendation**: Use ETags as the primary method and Last-Modified as supplementary. When both are present, ETag takes precedence per the HTTP specification.

### 3.5 Using Conditional Requests to Prevent Update Conflicts

ETags can be used not only for read caching, but also for preventing conflicts in update operations (optimistic locking).

```python
# Optimistic locking implementation for PUT/PATCH
from fastapi import FastAPI, Response, Request, HTTPException

@app.put("/api/users/{user_id}")
async def update_user(
    user_id: int,
    request: Request,
    response: Response,
    body: UserUpdate
):
    # Fetch current resource
    current = await fetch_user(user_id)
    current_etag = ETagGenerator.from_version(
        current.version, current.updated_at
    )

    # Validate If-Match header
    if_match = request.headers.get("If-Match")
    if if_match is None:
        raise HTTPException(
            status_code=428,
            detail="If-Match header is required for updates"
        )

    if if_match != current_etag:
        raise HTTPException(
            status_code=412,  # Precondition Failed
            detail="Resource has been modified by another request"
        )

    # Execute update
    updated = await update_user_in_db(user_id, body, current.version)
    new_etag = ETagGenerator.from_version(
        updated.version, updated.updated_at
    )

    response.headers["ETag"] = new_etag
    response.headers["Cache-Control"] = "private, no-cache"

    return updated
```

---

## 4. Cache Invalidation and Cache Busting

### 4.1 Two Challenges of Cache Invalidation

As Phil Karlton's famous quote goes — "There are only two hard things in Computer Science: cache invalidation and naming things" — cache invalidation is one of the fundamental challenges in software engineering.

**Challenge 1: Propagation delay**
CDN edge servers are distributed worldwide, and there is a time lag before a purge command propagates to all nodes.

**Challenge 2: Inability to control browser cache**
Once a resource is cached in the browser, there is no way to forcibly invalidate it from the server side. A resource delivered with `max-age=31536000` will not be updated unless the user clears the browser cache or accesses a different URL.

### 4.2 Cache Busting Strategies

```
┌─────────────────────────────────────────────────────────────────┐
│             Comparison of Cache Busting Strategies             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ■ Strategy 1: Content Hash (Recommended)                       │
│                                                                 │
│    Embed a hash of file content in the filename at build time   │
│                                                                 │
│    app.js  →  app.a1b2c3d4.js                                   │
│    style.css → style.e5f6g7h8.css                               │
│    logo.png → logo.9i0j1k2l.png                                 │
│                                                                 │
│    HTML: <script src="/assets/app.a1b2c3d4.js">                 │
│                                                                 │
│    Pros: Same URL as long as content unchanged → max cache eff. │
│          When content changes, URL itself changes → new version  │
│    Cons: Requires build tool configuration (Vite, webpack)      │
│                                                                 │
│  ■ Strategy 2: Version Query Parameter                          │
│                                                                 │
│    app.js?v=1.2.3                                               │
│    style.css?v=20250115                                         │
│                                                                 │
│    Pros: Simple to implement, no build tool needed              │
│    Cons: Some CDN/proxies may not include query params          │
│          in the cache key                                       │
│          Risk of bulk-invalidating all files at once            │
│                                                                 │
│  ■ Strategy 3: Directory-Based Versioning                       │
│                                                                 │
│    /v1/app.js → /v2/app.js                                      │
│    /assets/1.2.3/style.css                                      │
│                                                                 │
│    Pros: Works reliably across all caches                       │
│    Cons: Directory management is cumbersome, old versions linger│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Cache Busting Configuration with Build Tools

```javascript
// vite.config.ts — Cache busting configuration for Vite
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Include content hash in filenames (enabled by default)
    rollupOptions: {
      output: {
        // Entry point: app.[hash].js
        entryFileNames: 'assets/[name].[hash].js',
        // Code-split chunks: chunk-[name].[hash].js
        chunkFileNames: 'assets/chunk-[name].[hash].js',
        // Assets: [name].[hash].[ext]
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // Source map generation (hidden recommended for production)
    sourcemap: 'hidden',
  },
});
```

### 4.4 stale-while-revalidate Pattern

stale-while-revalidate (SWR) is a powerful pattern that balances cache freshness with user experience.

```
stale-while-revalidate behavior timeline:

  Cache-Control: max-age=60, stale-while-revalidate=300

  Time(s)   0         60                    360
            │          │                      │
            ▼          ▼                      ▼
  ┌─────────┼──────────┼──────────────────────┼──────────────▶
  │  Phase  │  FRESH   │  STALE-WHILE-        │  STALE
  │         │          │  REVALIDATE          │  (must validate)
  ├─────────┼──────────┼──────────────────────┼──────────────
  │  Action │Return    │Return cache          │Query server
  │         │cache     │immediately           │before returning
  │         │immed.    │+ query server in     │
  │         │          │background            │
  │         │          │→ next req gets new   │
  ├─────────┼──────────┼──────────────────────┼──────────────
  │Perceived│Instant   │Instant               │Delayed
  │  speed  │ (<5ms)   │ (<5ms)               │ (RTT)
  └─────────┴──────────┴──────────────────────┴──────────────

  Characteristics:
  - Users always get an instant response from 0 to 360 seconds
  - Between 60 and 360 seconds, slightly stale data may be returned
  - After the background update, the next request returns the latest data
  - Flexibly adjusts the trade-off between "speed" and "freshness"
```

### 4.5 CDN Cache Purge Implementation

```python
# CDN cache purge implementation example

import boto3
import time

class CDNCachePurger:
    """Utility for executing CDN cache purges"""

    def __init__(self, distribution_id: str):
        self.client = boto3.client('cloudfront')
        self.distribution_id = distribution_id

    def purge_paths(self, paths: list[str]) -> dict:
        """Purge cache for the specified paths"""
        response = self.client.create_invalidation(
            DistributionId=self.distribution_id,
            InvalidationBatch={
                'Paths': {
                    'Quantity': len(paths),
                    'Items': paths
                },
                'CallerReference': f'purge-{int(time.time())}'
            }
        )
        return {
            'invalidation_id': response['Invalidation']['Id'],
            'status': response['Invalidation']['Status'],
            'paths': paths
        }

    def purge_all(self) -> dict:
        """Purge all cache (be mindful of cost)"""
        return self.purge_paths(['/*'])


# Usage
purger = CDNCachePurger(distribution_id='E1A2B3C4D5E6F7')

# Purge specific paths
result = purger.purge_paths([
    '/api/products/*',
    '/images/hero.webp'
])
print(f"Invalidation ID: {result['invalidation_id']}")

# Full purge during deployment
result = purger.purge_all()
```

---

## 5. CDN Cache Design and Operations

### 5.1 Basic CDN Architecture

A CDN (Content Delivery Network) is infrastructure consisting of edge servers distributed worldwide that delivers content from a point close to the user.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CDN Architecture Detailed Diagram                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                     ┌──────────────┐                                 │
│                     │  Origin      │                                 │
│                     │  Server      │                                 │
│                     │  (Tokyo DC)  │                                 │
│                     └──────┬───────┘                                 │
│                            │                                         │
│                     ┌──────┴───────┐                                 │
│                     │  Origin      │  ← Aggregates requests from     │
│                     │  Shield      │    all edges. Reduces load on   │
│                     │  (Tokyo)     │    origin.                      │
│                     └──────┬───────┘                                 │
│                            │                                         │
│            ┌───────────────┼───────────────┐                         │
│            │               │               │                         │
│     ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐                 │
│     │  Edge POP   │ │  Edge POP   │ │  Edge POP   │  ← PoP:        │
│     │  Tokyo      │ │  Singapore  │ │  London     │    Point of     │
│     │  (10+ nodes)│ │  (10+ nodes)│ │  (10+ nodes)│    Presence     │
│     └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                 │
│            │               │               │                         │
│     ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐                 │
│     │  Users in   │ │  Users in   │ │  Users in   │                 │
│     │  Japan      │ │  ASEAN      │ │  Europe     │                 │
│     └─────────────┘ └─────────────┘ └─────────────┘                 │
│                                                                      │
│  Request flow:                                                       │
│  1. DNS resolution → returns IP of nearest Edge PoP                  │
│  2. Cache found at Edge PoP → return immediately (Cache HIT)         │
│  3. No cache at Edge PoP → query Origin Shield                       │
│  4. Cache found at Origin Shield → return to Edge and cache          │
│  5. No cache at Origin Shield → query Origin Server                  │
│  6. Origin Server responds → Shield → Edge → User                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Choosing CDN Cache Control Headers

Multiple headers exist for CDN cache control, each with different scopes.

| Header | Target | Standardization | Use case |
|--------|--------|-----------------|----------|
| `Cache-Control: s-maxage` | All shared caches (including CDN) | RFC 9111 | TTL common to CDN and proxies |
| `CDN-Cache-Control` | CDN only (not applied to proxies) | RFC 9213 | CDN-specific TTL |
| `Surrogate-Control` | Supported CDNs only (Fastly, etc.) | W3C TR | Advanced CDN-specific control |
| `Cloudflare-CDN-Cache-Control` | Cloudflare only | Proprietary | Cloudflare-specific control |

```
Header priority (CDN interpretation):

  CDN-specific header (Surrogate-Control, etc.)
    ↓ if absent
  CDN-Cache-Control
    ↓ if absent
  Cache-Control: s-maxage
    ↓ if absent
  Cache-Control: max-age
    ↓ if absent
  Expires header
    ↓ if absent
  Heuristic caching or no caching

  Recommendation: Use Cache-Control s-maxage as the base,
  and add CDN-Cache-Control only for CDN-specific requirements.
```

### 5.3 CloudFront Configuration Example

```yaml
# AWS CloudFormation CloudFront configuration example
AWSTemplateFormatVersion: '2010-09-09'
Description: CloudFront distribution with optimized caching

Resources:
  # Cache policy: for static assets
  StaticAssetsCachePolicy:
    Type: AWS::CloudFront::CachePolicy
    Properties:
      CachePolicyConfig:
        Name: StaticAssets-1Year
        DefaultTTL: 86400        # 1 day (when Cache-Control is absent)
        MaxTTL: 31536000         # 1 year (upper limit)
        MinTTL: 0                # 0 seconds (minimum)
        ParametersInCacheKeyAndForwardedToOrigin:
          CookiesConfig:
            CookieBehavior: none   # Do not include cookies in cache key
          HeadersConfig:
            HeaderBehavior: none   # Do not include headers in cache key
          QueryStringsConfig:
            QueryStringBehavior: none  # Do not include query params
          EnableAcceptEncodingGzip: true
          EnableAcceptEncodingBrotli: true

  # Cache policy: for API
  APICachePolicy:
    Type: AWS::CloudFront::CachePolicy
    Properties:
      CachePolicyConfig:
        Name: API-ShortTTL
        DefaultTTL: 60           # 1 minute
        MaxTTL: 300              # 5 minutes
        MinTTL: 0
        ParametersInCacheKeyAndForwardedToOrigin:
          CookiesConfig:
            CookieBehavior: none
          HeadersConfig:
            HeaderBehavior: whitelist
            Headers:
              - Accept
              - Accept-Language
          QueryStringsConfig:
            QueryStringBehavior: all  # Include all query params in key
          EnableAcceptEncodingGzip: true
          EnableAcceptEncodingBrotli: true

  # CloudFront distribution
  Distribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        HttpVersion: http2and3
        PriceClass: PriceClass_200  # Asia + Americas & Europe
        Origins:
          - Id: AppOrigin
            DomainName: app.example.com
            CustomOriginConfig:
              OriginProtocolPolicy: https-only
              OriginSSLProtocols: [TLSv1.2]
        DefaultCacheBehavior:
          # HTML: always validate
          TargetOriginId: AppOrigin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: !Ref APICachePolicy
          Compress: true
        CacheBehaviors:
          # Static assets
          - PathPattern: '/assets/*'
            TargetOriginId: AppOrigin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: !Ref StaticAssetsCachePolicy
            Compress: true
          # API
          - PathPattern: '/api/*'
            TargetOriginId: AppOrigin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: !Ref APICachePolicy
            Compress: true
```

### 5.4 Comparison of Major CDN Services

| Property | CloudFront (AWS) | Cloudflare | Fastly | Akamai |
|----------|-----------------|------------|--------|--------|
| PoPs | 600+ | 300+ | 70+ | 4,000+ |
| Free tier | 1TB/month | Unlimited (Free plan) | None | None |
| Purge speed | Several minutes | ~30 seconds | ~150ms | ~5 seconds |
| Edge computing | Lambda@Edge, Functions | Workers | Compute@Edge | EdgeWorkers |
| HTTP/3 support | Yes | Yes | Yes | Yes |
| WebSocket support | Yes | Yes | Yes | Yes |
| DDoS protection | AWS Shield | Included | Included | Kona Site Defender |
| Pricing model | Pay-per-use | Plan-based | Pay-per-use | Contract-based |
| Strength | AWS ecosystem integration | Ease of configuration | Purge speed | Large-scale delivery |

---

## 6. Practical Cache Strategy Design

### 6.1 Cache Strategy Matrix by Resource Type

| Resource type | Cache-Control | ETag | CDN | Busting | Notes |
|--------------|---------------|------|-----|---------|-------|
| HTML | `no-cache` | Yes | Short TTL (60s) | Not needed (always validates) | Ensures reference to latest assets |
| JS/CSS (hashed) | `public, max-age=31536000, immutable` | Not needed | Long TTL (1 year) | Filename hash | URL changes when content changes |
| Images (hashed) | `public, max-age=31536000, immutable` | Not needed | Long TTL (1 year) | Filename hash | WebP/AVIF conversion at CDN edge |
| Fonts | `public, max-age=31536000, immutable` | Not needed | Long TTL (1 year) | Filename hash | May need CORS configuration |
| Public API | `public, max-age=60, s-maxage=300` | Yes | Medium TTL | Not needed | Pay attention to Vary header |
| User-specific API | `private, no-cache` | Yes | None | Not needed | Do not cache in CDN |
| Sensitive data | `no-store` | None | None | Not needed | No caching at all |
| Service Worker | `no-cache, max-age=0` | Yes | Short TTL | Not needed | 24-hour limit (browser spec) |
| favicon.ico | `public, max-age=86400` | Yes | 1 day | Query parameter | Not changed frequently |
| robots.txt | `public, max-age=86400` | Yes | 1 day | Not needed | Crawling configuration |
| sitemap.xml | `public, max-age=3600` | Yes | 1 hour | Not needed | SEO-related |

### 6.2 Comprehensive Cache Configuration with nginx

```nginx
# /etc/nginx/conf.d/cache.conf
# Comprehensive caching configuration

# ── Common settings ──

# Define proxy cache
proxy_cache_path /var/cache/nginx levels=1:2
    keys_zone=app_cache:100m    # Metadata area for cache keys
    max_size=10g                # Maximum size on disk
    inactive=60m                # Delete after 60 minutes without access
    use_temp_path=off;          # Do not use temp files (performance improvement)

# Cache key definition
proxy_cache_key "$scheme$request_method$host$request_uri";

server {
    listen 443 ssl http2;
    server_name example.com;

    # ── Static assets (hashed) ──
    location ~* /assets/.*\.[0-9a-f]{8,}\.(js|css|woff2?|png|jpg|webp|avif|svg)$ {
        root /var/www/app/dist;

        # Cache for 1 year, declare as immutable
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Cache-Strategy "immutable-hashed-asset";

        # Use pre-compressed files if available
        gzip_static on;

        # Suppress access log (large volume of asset requests)
        access_log off;
    }

    # ── Static assets (no hash) ──
    location ~* \.(ico|png|jpg|jpeg|gif|svg|webp)$ {
        root /var/www/app/dist;
        add_header Cache-Control "public, max-age=86400";
        add_header X-Cache-Strategy "static-no-hash";
        etag on;
    }

    # ── HTML ──
    location ~* \.html$ {
        root /var/www/app/dist;
        add_header Cache-Control "no-cache";
        add_header X-Cache-Strategy "html-always-validate";
        etag on;
    }

    # ── SPA fallback ──
    location / {
        root /var/www/app/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
        etag on;
    }

    # ── Public API ──
    location /api/public/ {
        proxy_pass http://backend;
        proxy_cache app_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 404 1m;

        # Show cache hit status in response header
        add_header X-Cache-Status $upstream_cache_status;

        # Implement stale-while-revalidate
        proxy_cache_use_stale updating error timeout http_500 http_502;
        proxy_cache_background_update on;
        proxy_cache_lock on;

        # Handle Vary header appropriately
        proxy_ignore_headers Vary;
        proxy_cache_key "$scheme$request_method$host$request_uri$http_accept";
    }

    # ── Private API ──
    location /api/me/ {
        proxy_pass http://backend;
        proxy_no_cache 1;         # Do not cache
        proxy_cache_bypass 1;     # Bypass cache
        add_header Cache-Control "private, no-cache";
    }

    # ── Sensitive API ──
    location /api/secure/ {
        proxy_pass http://backend;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        add_header Cache-Control "no-store";
        add_header Pragma "no-cache";
    }
}
```

### 6.3 Cache Strategies with Service Worker

Using a Service Worker allows for more granular cache control on the browser side. The representative strategies are as follows.

```
Service Worker cache strategies:

  ■ Cache First
    → Return from cache if available. Fetch from network if not.
    → Use case: static assets, fonts

  ■ Network First
    → Try to fetch from network; return cache on failure
    → Use case: API, HTML

  ■ Stale While Revalidate
    → Return cache immediately while updating from network in background
    → Use case: news feeds, social media timelines

  ■ Cache Only
    → Access cache only (for offline-only assets)
    → Use case: pre-cached app shell

  ■ Network Only
    → Network only (never use cache)
    → Use case: payment processing, real-time data
```

```javascript
// Service Worker cache strategy implementation example
// sw.js

const CACHE_NAME = 'app-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/app.js',
  '/assets/style.css',
];

// Pre-cache app shell at install time
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Handle fetch events
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Static assets: Cache First
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // API: Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // HTML: Stale While Revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAME).then((c) => {
        c.put(request, response.clone());
      });
    }
    return response;
  });

  return cached || fetchPromise;
}
```

---

## 7. Anti-Patterns and Edge Cases

### 7.1 Anti-Pattern 1: Using max-age Without immutable

```
■ Anti-pattern:
  Cache-Control: public, max-age=31536000

  Problem:
  - The browser may send "conditional requests"
  - 304 round-trips occur during page transitions and reloads
  - Safari in particular tends to aggressively revalidate

  ┌─────────────────────────────────────────────────────┐
  │  Browser                         Server             │
  │    │                               │               │
  │    │── GET /app.a1b2.js ──────────▶│               │
  │    │   If-None-Match: "xyz"        │               │
  │    │                               │               │
  │    │◀── 304 Not Modified ──────────│               │
  │    │                               │               │
  │    │  ★ This round-trip is wasted! │               │
  │    │  The filename has a hash, so  │               │
  │    │  content will never change    │               │
  └─────────────────────────────────────────────────────┘

■ Correct pattern:
  Cache-Control: public, max-age=31536000, immutable

  → With immutable, the browser will not send conditional
    requests within the expiry period
  → Improves performance during page transitions
  → Particularly effective in mobile environments (low bandwidth, high latency)
```

**Magnitude of impact**: On high-traffic sites, unnecessary 304 requests can occur thousands to tens of thousands of times per second. Even with an RTT of ~50ms per request, the cumulative impact on user experience is non-negligible.

### 7.2 Anti-Pattern 2: Using Vary: *

```
■ Anti-pattern:
  Vary: *

  Problem:
  - Every request gets a unique cache key
  - The cache is effectively completely disabled
  - CDN/proxy cache hit rate becomes 0%
  - Often occurs unintentionally (framework default settings, etc.)

■ Common causes:
  1. Framework automatically adds Vary: *
  2. Middleware adds excessive Vary headers
  3. CORS middleware adds Vary: Origin and
     other middleware adds Vary: Accept-Encoding,
     which can be merged into Vary: * in some implementations

■ Correct pattern:
  Specify only the minimum necessary headers in Vary
  Vary: Accept-Encoding
  Vary: Accept-Encoding, Accept-Language

■ Debugging:
  curl -I https://example.com/api/data
  → Check the Vary header in the response
  → Check whether * is included or excessive headers are present
```

### 7.3 Anti-Pattern 3: Conflict Between Set-Cookie and Cache-Control

```
■ Anti-pattern:
  HTTP/1.1 200 OK
  Cache-Control: public, max-age=3600
  Set-Cookie: session=abc123; HttpOnly; Secure

  Problem:
  - A response containing Set-Cookie gets cached by the CDN
  - That session cookie is delivered to other users
  - Serious security vulnerability such as session hijacking

■ Correct pattern:
  Option A: Make it uncacheable
    Cache-Control: private, no-cache
    Set-Cookie: session=abc123; HttpOnly; Secure

  Option B: Avoid including Set-Cookie
    Cache-Control: public, max-age=3600
    (No Set-Cookie — handle session management at a separate endpoint)

  Option C: Configure CDN to remove Set-Cookie
    (e.g., CloudFront Response Headers Policy)
```

### 7.4 Edge Case 1: Cache Anomalies Due to Clock Skew

```
■ Situation:
  When the client and server clocks are out of sync

  Server time: 2025-01-15 10:00:00
  Client time: 2025-01-15 09:55:00 (5 minutes behind)

  Response:
    Date: Wed, 15 Jan 2025 10:00:00 GMT
    Cache-Control: max-age=300

  Client calculation:
    age = client_now - date = -300 seconds (negative!)
    → Behavior varies depending on implementation

  ■ Possible problems:
    - Cache may be valid longer/shorter than expected
    - Age header becomes negative, causing parse errors
    - Freshness evaluation becomes inconsistent between CDN nodes

  ■ Countermeasures:
    - Server side: Synchronize time accurately with NTP
    - Application side: Also use Age header to calculate relative freshness
      response_age = max(0, age_header_value)
      freshness_lifetime = max_age - response_age
    - CDN side: Many CDNs automatically append the Age header,
      reducing the impact of clock skew
```

### 7.5 Edge Case 2: Implicit Cache Invalidation by POST/PUT/DELETE

```
■ HTTP specification (RFC 9111 Section 4.4):

  When a successful response (2xx) to an unsafe method
  (POST, PUT, DELETE, PATCH) is received, the cache
  MUST invalidate any stored responses for the same URI.

  Also, caches for URIs in Content-Location or Location
  headers MUST be invalidated.

  ■ Example:
    1. GET /api/users/42 → 200 (stored in cache)
    2. PUT /api/users/42 → 200 (success)
    3. Cache for /api/users/42 is automatically invalidated
    4. Next GET /api/users/42 → queries the server

  ■ Notes:
    - This invalidation only applies to the local cache
    - CDN cache is not automatically invalidated
    - Explicit purge is required for CDN cache invalidation

  ■ CDN best practices:
    After POST /api/users/42 succeeds:
    1. Application calls the CDN purge API
    2. Or, set a short s-maxage and wait for natural expiry
    3. Or, use the CDN "update on origin request" feature
```

### 7.6 Edge Case 3: Range Requests and Caching

```
■ Situation:
  Partial download of a large file (e.g., video)

  Request:
    GET /video/lecture.mp4 HTTP/1.1
    Range: bytes=0-1048575

  Response:
    HTTP/1.1 206 Partial Content
    Content-Range: bytes 0-1048575/104857600
    ETag: "abc123"
    Cache-Control: public, max-age=3600

  ■ Cache challenges:
    - Partial responses (206) can be cached, but
      cache implementation becomes complex
    - Requests with different Range values come for the same URL
    - Some CDNs do not cache 206 by default

  ■ Best practices:
    - Have the CDN cache the full file and
      handle Range requests at the edge
    - Use strong ETags (weak ETags do not support Range)
    - CloudFront: automatically supports Range
    - Cloudflare: Range cache optimization on Enterprise plan
```

---

## 8. Cache Monitoring and Debugging

### 8.1 Measuring Cache Hit Rate

Continuously measuring the cache hit rate is essential to quantitatively understand the effectiveness of caching.

```
Cache hit rate calculation:

  hit_rate = cache_hits / (cache_hits + cache_misses) * 100

  Benchmarks:
  ┌──────────────────┬────────────┬─────────────────────────────┐
  │ Hit rate         │ Rating     │ Action                      │
  ├──────────────────┼────────────┼─────────────────────────────┤
  │ 95%+             │ Excellent  │ Maintain current state      │
  │ 80-95%           │ Good       │ Fine-tuning can improve     │
  │ 50-80%           │ Needs work │ Review TTL, cache keys      │
  │ Below 50%        │ Critical   │ Fundamental strategy review │
  └──────────────────┴────────────┴─────────────────────────────┘
```

### 8.2 Using Debug Headers

```bash
# Check cache headers with curl
curl -I https://example.com/assets/app.a1b2c3.js

# Expected response headers:
# HTTP/2 200
# cache-control: public, max-age=31536000, immutable
# etag: "abc123"
# x-cache: Hit from cloudfront           ← CloudFront cache status
# age: 12345                             ← Seconds elapsed since cached
# cf-cache-status: HIT                   ← Cloudflare cache status
# x-cache-status: HIT                    ← nginx cache status

# Cache status headers by CDN:
#
# CloudFront:
#   X-Cache: Hit from cloudfront
#   X-Cache: Miss from cloudfront
#   X-Cache: RefreshHit from cloudfront  ← Returned via SWR
#
# Cloudflare:
#   CF-Cache-Status: HIT
#   CF-Cache-Status: MISS
#   CF-Cache-Status: EXPIRED
#   CF-Cache-Status: STALE
#   CF-Cache-Status: DYNAMIC             ← Not eligible for caching
#   CF-Cache-Status: BYPASS
#
# Fastly:
#   X-Cache: HIT
#   X-Cache: MISS
#   X-Cache-Hits: 5                      ← Number of hits
#   X-Served-By: cache-tyo...            ← Edge server that responded
```

### 8.3 Checking Cache with Browser DevTools

```
Steps to verify in Chrome DevTools:

  1. Open the Network tab
  2. Uncheck "Disable cache" (to observe normal cache behavior)
  3. Load the page
  4. For each resource, check:

     Size column:
       - (disk cache) → fetched from disk cache
       - (memory cache) → fetched from memory cache
       - (ServiceWorker) → fetched from Service Worker
       - numeric → fetched from network

     Status column:
       - 200 → new fetch or restored from cache
       - 304 → validated with server (no change)

     Headers tab:
       - Check Cache-Control, ETag, Age in Response Headers
       - Check If-None-Match, If-Modified-Since in Request Headers

  5. Checking "Disable cache":
     → Cache-Control: no-cache is added to requests
     → All resources are fetched from network
     → Useful during debugging
```

### 8.4 Key Cache-Related Metrics

| Metric | Measurement method | Target | Meaning |
|--------|-------------------|--------|---------|
| CDN hit rate | CDN dashboard | 90%+ | Proportion of responses served by CDN |
| 304 response rate | Access log analysis | HTML: 60%+ | Effectiveness of bandwidth savings |
| TTFB (Time To First Byte) | RUM / Synthetic | <200ms | Time to first byte |
| Bytes saved | CDN dashboard | — | Transfer volume reduction effect |
| Purge success rate | CDN API logs | 99.9%+ | Reliability of purges |
| Stale delivery rate | Custom header | <5% | Proportion of stale content delivered |

---

## 9. Advanced Cache Patterns

### 9.1 Tag-Based Purging with Surrogate Keys

Traditional path-based purging requires enumerating all related URLs. Surrogate Keys (tag-based purging) allows attaching tags to resources and purging by tag.

```
How Surrogate Keys work (Fastly example):

  ■ Attach tags to responses:
    GET /api/products/42

    HTTP/1.1 200 OK
    Surrogate-Key: product-42 category-electronics all-products
    Cache-Control: public, s-maxage=3600

    GET /api/categories/electronics

    HTTP/1.1 200 OK
    Surrogate-Key: category-electronics all-categories
    Cache-Control: public, s-maxage=3600

  ■ When product 42 is updated:
    PURGE tag: product-42

    → /api/products/42 is purged
    → Other URLs referencing /api/products/42 can also be purged

  ■ When all products are updated:
    PURGE tag: all-products

    → All URLs with the all-products tag are bulk-purged

  Benefits:
  - No need to enumerate URLs to purge
  - Invalidation based on logical relationships between content
  - Bulk purge of thousands of URLs is fast (Fastly: within 150ms)
```

### 9.2 Edge Side Includes (ESI)

ESI is a markup language for dynamically assembling parts of a page. Processed at the CDN edge, it allows applying different cache policies to each part of a page.

```html
<!-- ESI example: page composition -->
<!-- Header: user-specific, shorter cache -->
<esi:include src="/fragments/header"
  onerror="continue"
  maxwait="500" />

<!-- Main content: public, longer cache -->
<esi:include src="/fragments/product/42" />

<!-- Sidebar: public, moderate cache -->
<esi:include src="/fragments/sidebar/recommendations" />

<!-- Footer: public, long-term cache -->
<esi:include src="/fragments/footer" />

<!--
  /fragments/header       → Cache-Control: private, max-age=60
  /fragments/product/42   → Cache-Control: public, s-maxage=3600
  /fragments/sidebar/...  → Cache-Control: public, s-maxage=600
  /fragments/footer       → Cache-Control: public, s-maxage=86400

  → No need to make the entire page uncacheable
  → Public parts are cached at the CDN
  → Only user-specific parts are fetched every time
-->
```

### 9.3 Cache Stampede Prevention

```
■ What is Cache Stampede:
  A phenomenon where a large number of requests
  simultaneously reach the origin server the moment
  a cache entry expires.
  Also known as the "Thundering Herd" problem.

  Timeline:

  ─────────────────────────────┬───────────────────────────
  ◀── Cache valid ─────────────│──── Cache expired ──────▶
                               │
                    Request 1 ─┼──▶ Origin ──▶ Response
                    Request 2 ─┼──▶ Origin ──▶ Response
                    Request 3 ─┼──▶ Origin ──▶ Response
                    ...        │
                    Request N ─┼──▶ Origin ──▶ Response
                               │
                    ★ N requests hit origin simultaneously
                    ★ Origin may become overloaded

■ Solution 1: Request Coalescing
  Combine requests for the same key into one and
  deliver the result to all requests.

  ─────────────────────────────┬───────────────────────────
                               │
                    Request 1 ─┤
                    Request 2 ─┼──▶ Only one goes to Origin
                    Request 3 ─┤
                               │
                    Same result returned to all requests

  nginx: proxy_cache_lock on;
  Varnish: coalescing is enabled by default

■ Solution 2: Probabilistic Early Expiration
  Start probabilistic updates slightly before cache expiry.

  Formula:
    should_refresh = (random() < beta * log(random()))
                     && (now > expiry - delta)

  → Only one request triggers the update before expiry
  → Remaining requests continue using existing cache

■ Solution 3: stale-while-revalidate
  Cache-Control: max-age=60, stale-while-revalidate=300
  → Return stale cache after expiry while sending
    only one update request in the background
```

### 9.4 Cache Isolation in Multi-Tenant Environments

```
■ Challenge:
  In SaaS applications that serve different content per tenant,
  the cache key must include a tenant identifier.

■ Method 1: Subdomain-based
  tenant-a.app.example.com → hostname included in cache key
  tenant-b.app.example.com → naturally isolated per tenant

■ Method 2: Path-based
  app.example.com/tenant-a/api/data
  app.example.com/tenant-b/api/data
  → Naturally isolated because URLs differ

■ Method 3: Header-based
  app.example.com/api/data
  X-Tenant-ID: tenant-a

  Vary: X-Tenant-ID
  → Separate cache entry per header value

  Note: CDN cache key must be configured to include X-Tenant-ID
  CloudFront: Add to Headers in Cache Policy
  Cloudflare: Add to Custom Headers in Cache Key

■ Security notes:
  - Rigorously test that tenant A's cache is not delivered to tenant B
  - Missing Vary header configuration can cause serious data leakage
  - Double-check both CDN settings and application settings
```

---

## 10. Cache Considerations in HTTP/2 and HTTP/3

### 10.1 HTTP/2 Server Push and Caching

```
■ Basics of HTTP/2 Server Push:
  A feature where the server proactively sends resources
  (CSS, JS, etc.) that will be needed along with the HTML response.

  GET /index.html HTTP/2

  Response:
    PUSH_PROMISE: /assets/style.a1b2.css
    PUSH_PROMISE: /assets/app.c3d4.js

    DATA: <html>...</html>
    DATA: /* content of style.a1b2.css */
    DATA: /* content of app.c3d4.js */

■ Problems with caching:
  - Resources are pushed even when the browser already has them cached
  - Results in bandwidth waste
  - Chrome 106 and later removed Server Push support

■ Alternative: 103 Early Hints
  HTTP/1.1 103 Early Hints
  Link: </assets/style.a1b2.css>; rel=preload; as=style
  Link: </assets/app.c3d4.js>; rel=preload; as=script

  HTTP/1.1 200 OK
  Content-Type: text/html
  ...

  → Browser checks cache before starting to fetch
  → Avoids unnecessary transfers
  → CloudFront and Cloudflare both support this
```

### 10.2 HTTP/3 (QUIC) and Caching

```
■ HTTP/3-specific cache considerations:

  1. Connection resumption (0-RTT):
     QUIC's 0-RTT handshake caches previous connection
     information and reuses it.
     → Faster connection establishment, but risks replay attacks
     → Unsafe methods (POST, etc.) should not be sent with 0-RTT

  2. Server certificate caching:
     QUIC uses TLS 1.3 and caches session tickets
     to speed up reconnection

  3. HTTP header compression (QPACK):
     HTTP/3 uses QPACK for header compression
     Frequently appearing headers like Cache-Control are
     compressed efficiently
     → Cache behavior itself is the same as HTTP/2

  4. Connection migration:
     Connections are maintained even during network switching
     (Wi-Fi → mobile), preserving cache consistency
```

---

## 11. Security and Caching

### 11.1 Cache Poisoning Attacks

```
■ Web Cache Poisoning:
  An attack where the attacker causes malicious responses
  to be stored in the cache and served to other users.

  Attack method:
  1. Discover a header not included in the cache key (Unkeyed Input)
  2. Confirm that the header is reflected in the response
  3. Send a request with a malicious value
  4. The CDN caches that response
  5. The malicious response is served to other users

  Example:
    GET /page HTTP/1.1
    Host: example.com
    X-Forwarded-Host: evil.com     ← Unkeyed Input

    Response:
    <link href="https://evil.com/style.css" rel="stylesheet">
    → If this response is cached,
      evil.com's CSS is delivered to all users

■ Countermeasures:
  1. Eliminate Unkeyed Inputs
     → Add to Vary all headers that are reflected in responses
     → Remove handling of unnecessary headers from the application

  2. Configure CDN cache keys appropriately
     → Include necessary headers in the cache key

  3. Thoroughly validate response inputs
     → Do not unconditionally embed header values in responses

  4. Use Cache-Control: private as the default
     → Only explicitly mark resources as public for CDN caching
```

### 11.2 Cache Deception Attacks

```
■ Web Cache Deception:
  An attack where the attacker causes the victim to access
  a specially crafted URL, causing the victim's personal
  data to be cached by the CDN.

  Attack method:
  1. Attacker tricks victim into accessing:
     https://example.com/api/me/profile/nonexistent.css

  2. Server returns the /api/me/profile response
     (for frameworks that ignore trailing path segments)

  3. CDN sees the .css extension and caches it as a static file
     Cache-Control: public, max-age=31536000

  4. Attacker accesses the same URL and retrieves the victim's profile

■ Countermeasures:
  1. Strictly normalize paths
     → /api/me/profile/xxx.css returns 404

  2. Content-type-based cache control
     → Do not cache application/json at the CDN

  3. Avoid extension-based cache rules
     → Cache based on response headers, not path patterns

  4. Always set Cache-Control: private on user-specific responses
```

---

## FAQ (Frequently Asked Questions)

### Q1: How to distinguish Cache-Control directives — what is the difference between max-age, no-cache, and no-store?

```
Key Cache-Control directives:

┌──────────────────┬───────────────────────────────────────────┐
│ Directive        │ Meaning and use case                      │
├──────────────────┼───────────────────────────────────────────┤
│ max-age=seconds  │ Cache expiry time (in seconds)            │
│                  │ → Best for static resources (max-age=31536000) │
│ no-cache         │ Validate with server every time           │
│                  │   (conditional requests)                  │
│                  │ → Use together with ETag                  │
│                  │ → Can reuse cache with 304 Not Modified   │
│ no-store         │ Never cache (do not save to memory)       │
│                  │ → Use for confidential data, personal info│
│ private          │ Cache only in browser (CDN not allowed)   │
│                  │ → Required for user-specific data         │
│ public           │ Can cache at all layers including CDN     │
│                  │ → Static resources, public API responses  │
│ must-revalidate  │ Must revalidate after expiry (no stale)   │
│ immutable        │ Resource that will absolutely never change │
│                  │ → /assets/app.abc123.js (with hash)       │
└──────────────────┴───────────────────────────────────────────┘

Practical usage:

  Static resources (JS/CSS/images, hashed URL):
  Cache-Control: public, max-age=31536000, immutable
  → Cache for 1 year, CDN-deliverable, change the URL itself when content changes

  HTML (frequently updated):
  Cache-Control: no-cache
  ETag: "abc123"
  → Validate every time, 304 Not Modified if unchanged

  User-specific data (dashboard, etc.):
  Cache-Control: private, no-cache
  ETag: "user-123-version-5"
  → Browser-only cache, validate every time

  Sensitive information (credit card info, etc.):
  Cache-Control: private, no-store, must-revalidate
  → No caching at all

  API response (user-specific):
  Cache-Control: private, max-age=300
  → 5-minute browser cache (CDN not allowed)

  API response (public data):
  Cache-Control: public, max-age=600, stale-while-revalidate=86400
  → Cache for 10 minutes, return stale data for 24 hours while updating in background

Notes:
  → no-cache ≠ no caching (caches with validation)
  → no-store = the true "no caching"
  → must-revalidate prohibits serving stale after expiry
```

### Q2: Difference between CDN cache and browser cache — how to use them

```
■ CDN cache vs browser cache:

┌────────────────┬──────────────────┬──────────────────┐
│ Aspect         │ CDN cache        │ Browser cache    │
├────────────────┼──────────────────┼──────────────────┤
│ Storage        │ Edge server      │ User device      │
│ Sharing        │ Shared by all    │ Per individual   │
│ Control        │ public           │ private          │
│ On HIT         │ Reduce origin load│ No network needed│
│ Invalidation   │ Purge API        │ User-dependent   │
│ Resources      │ Static files     │ All resources    │
│ Security       │ Sensitive data NG│ Sensitive OK     │
└────────────────┴──────────────────┴──────────────────┘

Usage strategy:

  Public static resources (JS/CSS/images):
  Cache-Control: public, max-age=31536000, immutable
  → Long-term cache at CDN and browser
  → Update cache by changing URL (/app.v2.js)

  HTML files:
  Cache-Control: public, max-age=0, must-revalidate
  → CDN caches, but validates every time
  → ETag detects changes, 304 returned if unchanged

  User-specific data:
  Cache-Control: private, max-age=300
  → Browser-only 5-minute cache
  → CDN does not cache (private directive)

  Public API data (weather info, etc.):
  Cache-Control: public, max-age=600, s-maxage=3600
  → Browser: 10-minute cache
  → CDN: 1-hour cache (s-maxage takes priority)

  API requiring authentication:
  Cache-Control: private, no-store
  → CDN caching prohibited, browser also does not cache

CDN-specific headers:
  s-maxage=seconds — CDN-specific max-age (takes priority over max-age)
  stale-while-revalidate — return stale cache while updating in background after expiry
  stale-if-error — return stale cache when origin error occurs

Cloudflare example:
  Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400
  → Browser: 5-minute cache
  → CDN: 1-hour cache
  → Return stale data for 24 hours after expiry while updating in background
```

### Q3: Cache invalidation (Cache Busting) methods — URL change vs Purge API

```
■ Cache busting strategies:

┌──────────────────┬─────────────────────────────────────┐
│ Method           │ Details                             │
├──────────────────┼─────────────────────────────────────┤
│ ① URL change     │ /app.v1.js → /app.v2.js              │
│ (recommended)    │ /app.abc123.js (hash embedded)       │
│                  │ → Reliable, effective for both CDN  │
│                  │   and browser                       │
│                  │ → Automated by webpack/Vite etc.    │
│                  │                                     │
│ ② Query string   │ /app.js?v=2                          │
│                  │ → Simple but ignored by some CDNs   │
│                  │ → Some proxies strip query params   │
│                  │                                     │
│ ③ CDN Purge API  │ Delete via Cloudflare/Fastly API    │
│                  │ → Immediate effect                  │
│                  │ → Takes time to propagate to all    │
│                  │   edge servers                      │
│                  │                                     │
│ ④ Cache-Control  │ Cache-Control: no-cache             │
│   header change  │ → Validate every time, ETag detects │
│                  │ → Reduce traffic with 304 responses │
└──────────────────┴─────────────────────────────────────┘

Recommended patterns:

  Static resources (JS/CSS/images):
  → URL change (hash embedded)
  → /assets/app.abc123.js
  → max-age=31536000, immutable

  webpack/Vite configuration:
  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
  }
  → Hash changes when file content changes
  → HTML references the new URL

  HTML files:
  → Cache-Control: no-cache + ETag
  → Validate every time, 304 if unchanged

  Emergency cache clear:
  → CDN Purge API
  curl -X POST https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache \
    -H "Authorization: Bearer {token}" \
    -d '{"files":["https://example.com/app.js"]}'

Patterns to avoid:
  ✗ /app.js?v=random() — different URL every time, 0% cache hit rate
  ✗ Cache-Control: no-store on all resources — performance degradation
  ✗ Too short max-age (1 second, etc.) — excessive validation requests
```

---

## Summary

| Concept | Key point |
|---------|-----------|
| **Cache hierarchy** | Browser → Forward proxy → CDN → Reverse proxy → Origin |
| **Cache-Control** | max-age (expiry), private/public (scope), no-cache (validate), no-store (prohibit) |
| **Conditional requests** | ETag (version identification), Last-Modified (timestamp-based), 304 Not Modified |
| **CDN strategy** | s-maxage (CDN-specific), stale-while-revalidate (async update), Purge API |
| **Cache busting** | URL change (hash embedded) is most reliable; query string is supplementary |
| **Security** | no-store for sensitive data, private for user-specific data, handle Vary carefully |

### Key Points

1. **Think of caching as a layered structure**: Apply different strategies to each of the browser, forward proxy, CDN, and reverse proxy. Use the private directive to cache only in the browser, and public to enable caching at all layers including the CDN.

2. **Long-term cache + URL change for static resources**: Cache JS/CSS/images with max-age=31536000 (1 year) + immutable, and change the URL itself (hash embedded) when content changes. Use no-cache + ETag to validate HTML every time.

3. **Balance availability and performance with stale-while-revalidate**: By returning stale cache after expiry while asynchronously updating in the background, users always get fast responses while also receiving the latest data. Resistance to origin failures also improves.

---

## Next Guides to Read


---

## References

1. RFC 9111. "HTTP Caching." IETF, 2022.
   https://www.rfc-editor.org/rfc/rfc9111
   Official specification for HTTP caching. Defines Cache-Control, conditional requests,
   and cache hierarchy. Successor to RFC 7234.

2. RFC 5861. "HTTP Cache-Control Extensions for Stale Content." IETF, 2010.
   https://www.rfc-editor.org/rfc/rfc5861
   Specification for stale-while-revalidate and stale-if-error. Defines cache delivery
   strategies for origin failure scenarios.

3. MDN Web Docs. "HTTP Caching." Mozilla, 2024.
   https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching
   Practical guide to HTTP caching. Detailed explanations of browser cache behavior
   and Cache-Control directives.

4. web.dev. "HTTP Cache." Google, 2024.
   https://web.dev/http-cache/
   Google best practices. Cache strategies, performance measurement,
   and Cache-Control configuration examples.

5. Cloudflare Docs. "Cache." Cloudflare, 2024.
   https://developers.cloudflare.com/cache/
   CDN cache implementation details. Purge API, Cache Rules,
   and custom cache key configuration.

6. Fastly Developer Hub. "Cache Control Tutorial." Fastly, 2024.
   https://developer.fastly.com/learning/concepts/cache-control/
   Edge cache best practices. Details of cache control using VCL
   (Varnish Configuration Language).
