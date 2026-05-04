# Network Optimization

> Optimize network performance for web applications. Systematically learn techniques such as latency reduction, bandwidth optimization, connection management, compression, and preloading to achieve a fast user experience.

---

## Prerequisites

Having the following knowledge before reading this guide will make understanding smoother.

- **Network debugging basics**: Being able to observe and measure network communication using tools like curl, Chrome DevTools, and tcpdump. See [Network Debugging](./02-network-debugging.md) for details
- **TCP/IP basics**: Understanding the TCP 3-way handshake, window size, and retransmission control mechanism. See [TCP Protocol](../01-protocols/00-tcp.md) for details
- **CDN mechanisms**: Understanding CDN cache strategies, edge servers, and the concept of Origin Shield. See [CDN](./01-cdn.md) for details
- **HTTP basics**: Knowing the differences between HTTP/1.1, HTTP/2, HTTP/3, cache headers, and request/response flow

---

## What You Will Learn

- [ ] Understand network performance bottlenecks
- [ ] Understand techniques for latency reduction and bandwidth optimization
- [ ] Learn connection management and resource optimization strategies
- [ ] Understand multiplexing and fast connections with HTTP/2 and HTTP/3
- [ ] Learn cache strategies and offline support using Service Workers
- [ ] Practice measuring and improving Core Web Vitals
- [ ] Understand CDN design and leveraging edge computing

---

## 1. Performance Bottlenecks

### 1.1 Web Page Load Time Breakdown

```
Web page load time breakdown:

  DNS resolution:      ~50ms
  TCP connection:      ~30ms (1.5 RTT)
  TLS handshake:       ~50ms (1-2 RTT)
  Request send:        ~5ms
  Server processing:   ~100ms (TTFB)
  Content transfer:    ~200ms
  Rendering:           ~300ms
  ─────────────────────────
  Total:               ~735ms

Major bottlenecks:
  ① Latency (round-trip time):
     → Depends on physical distance (speed of light limit)
     → RTT × number of round trips

  ② Bandwidth:
     → Transfer time for large files
     → Images, videos, JavaScript bundles

  ③ Server processing time:
     → DB queries, API calls, computation

  ④ Rendering:
     → DOM construction, CSS calculation, JavaScript execution
     → Render-blocking resources
```

### 1.2 Detailed Analysis of the Network Waterfall

```
Waterfall analysis of a typical web page:

  Request 1: HTML (index.html)
  ├── DNS  │ TCP │ TLS │ TTFB │ Download
  │   50ms │30ms │50ms │100ms │ 20ms     = 250ms
  │
  ├── Request 2: CSS (styles.css) - render-blocking
  │   ├── TTFB │ Download
  │   │   30ms │ 40ms     = 70ms (connection reused)
  │   │
  │   ├── Request 3: JS (app.js) - parser-blocking
  │   │   ├── TTFB │ Download │ Parse │ Execute
  │   │   │   30ms │ 100ms   │ 50ms  │ 200ms  = 380ms
  │   │   │
  │   │   ├── Request 4: API (GET /api/data) - fired from JS
  │   │   │   ├── DNS │ TCP │ TLS │ TTFB │ Download
  │   │   │   │   50ms│30ms│50ms │150ms │ 30ms   = 310ms
  │   │   │   │
  │   │   │   └── Request 5: Image (hero.webp) - displayed after API data
  │   │   │       ├── TTFB │ Download
  │   │   │       │   20ms │ 80ms     = 100ms
  │
  Total critical path: 250 + 70 + 380 + 310 + 100 = 1,110ms

  Optimized critical path:
  ├── preconnect: Pre-resolve API's DNS+TCP+TLS (-130ms)
  ├── preload: Fetch CSS and JS in parallel (-70ms)
  ├── async/defer: Remove JS parser blocking (-50ms)
  ├── SSR: No API call needed (-310ms)
  ├── priority hints: Priority-load hero image
  └── Result: 1,110ms → ~550ms (50% reduction)
```

### 1.3 Browser Concurrent Connection Limit

```
Browser concurrent connection limit:

  HTTP/1.1:
  ┌────────────────┬────────────────────┐
  │ Browser        │ Concurrent/host    │
  ├────────────────┼────────────────────┤
  │ Chrome         │ 6                  │
  │ Firefox        │ 6                  │
  │ Safari         │ 6                  │
  │ Edge           │ 6                  │
  └────────────────┴────────────────────┘

  → 7th and beyond requests wait in queue
  → Domain sharding: img1.example.com, img2.example.com
    → Workaround from HTTP/1.1 era (not recommended)

  HTTP/2:
  → Multiplex many streams over one connection
  → Concurrent connection limit is effectively unlimited
  → Domain sharding is counterproductive (connection establishment cost)

  HTTP/3:
  → QUIC-based connection establishment is fast
  → Head-of-Line Blocking resolved
  → Performance improved on packet loss
```

### 1.4 Critical Rendering Path

```
Critical Rendering Path (CRP):

  HTML → DOM Tree
    ↓
  CSS → CSSOM Tree
    ↓
  DOM + CSSOM → Render Tree
    ↓
  Layout (layout calculation)
    ↓
  Paint (screen drawing)
    ↓
  Composite

  Render-blocking resources:
  ① CSS (rendering does not happen until all CSS is parsed)
     Countermeasure: Inline Critical CSS
                     Async loading of non-critical CSS

  ② JavaScript (script tags block DOM parsing)
     Countermeasure: async / defer attributes
                     Place script tags at end of body
                     dynamic import

  Critical CSS example:
  <!-- Inline in head -->
  <style>
    /* Minimal CSS needed for the first view */
    body { margin: 0; font-family: sans-serif; }
    .hero { height: 100vh; display: flex; align-items: center; }
    .nav { position: fixed; top: 0; width: 100%; }
  </style>

  <!-- Load remaining CSS asynchronously -->
  <link rel="preload" href="/styles.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/styles.css"></noscript>
```

---

## 2. Latency Reduction

### 2.1 Leveraging CDN

```
CDN (Content Delivery Network) usage:

  Basic principle:
  → Deliver from edge servers close to users
  → RTT: 100ms → 5ms (Tokyo user fetches from Tokyo edge)
  → Reduce load on origin server

  CDN hierarchical structure:
  ┌──────────────────────────────────┐
  │ Origin server (us-east-1)        │
  └──────────────┬───────────────────┘
                 │
    ┌────────────┼────────────────┐
    │            │                │
  ┌─┴──┐    ┌──┴───┐     ┌─────┴──┐
  │Tokyo│    │London│     │SaoPaulo│  ← Edge servers
  │PoP  │    │PoP   │     │PoP    │
  └──┬──┘    └──┬───┘     └───┬───┘
     │          │              │
   User A     User B        User C

  Major CDN provider comparison:
  ┌──────────────┬─────────────┬──────────────────────────┐
  │ Provider     │ Edge count  │ Features                  │
  ├──────────────┼─────────────┼──────────────────────────┤
  │ CloudFront   │ 400+        │ AWS integration, Lambda@Edge │
  │ Cloudflare   │ 300+        │ Free plan, Workers        │
  │ Fastly       │ 90+         │ VCL, real-time purge      │
  │ Akamai       │ 4,000+      │ Largest scale, enterprise │
  │ Vercel Edge  │ Auto        │ Next.js optimized         │
  └──────────────┴─────────────┴──────────────────────────┘
```

### 2.2 CDN Cache Strategy

```nginx
# CDN cache strategy design

# 1. Static assets (file name changes on update: contenthash)
# /assets/app.a1b2c3.js
location ~* \.(js|css|woff2|png|jpg|webp|avif|svg)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    # immutable: browser won't send conditional requests either
    # Cache for 1 year (safe because filename contains hash)
}

# 2. HTML (always check for latest)
location ~* \.html$ {
    add_header Cache-Control "public, no-cache";
    # no-cache: verify with server every time (304 response with ETag)
    # → Necessary because HTML references the latest asset URLs
}

# 3. API responses (short-term cache + SWR)
location /api/ {
    add_header Cache-Control "public, max-age=10, stale-while-revalidate=60";
    # Use cache for 10 seconds
    # 10-70 seconds: return stale cache while revalidating in background
}

# 4. User-specific data (no caching)
location /api/me {
    add_header Cache-Control "private, no-store";
    # Do not cache on CDN
}
```

```
CloudFront cache behavior:

  Request flow:
  1. User → Edge: GET /api/products
  2. Edge: Is it in cache?
     ├── HIT: Respond from cache (<1ms)
     ├── MISS: Request to origin
     │   → Cache response + return to user
     └── STALE: Return stale cache while revalidating

  Cache hit rate targets:
  Static assets: > 95%
  API: > 70% (depends on content)
  HTML: > 50%

  Cache key design:
  → URL + Query String + Accept-Encoding + Accept (image format)
  → Exclude unnecessary headers and cookies from cache key
  → Appropriate Vary header settings
```

### 2.3 Pre-establishing Connections

```html
<!-- Pre-establishing connections -->

<!-- 1. dns-prefetch: Pre-resolve DNS only (lightweight) -->
<link rel="dns-prefetch" href="//api.example.com">
<link rel="dns-prefetch" href="//cdn.example.com">
<link rel="dns-prefetch" href="//fonts.googleapis.com">

<!-- 2. preconnect: Pre-establish DNS + TCP + TLS (recommended) -->
<link rel="preconnect" href="https://api.example.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- crossorigin: required for CORS requests -->

<!-- 3. preload: Priority download of resources -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/critical.css" as="style">
<link rel="preload" href="/hero.webp" as="image">

<!-- 4. prefetch: Pre-fetch resources needed for the next page (low priority) -->
<link rel="prefetch" href="/next-page.html">
<link rel="prefetch" href="/data/products.json">

<!-- 5. prerender: Pre-render the next page (Chrome) -->
<link rel="prerender" href="/likely-next-page">

<!-- 6. modulepreload: Pre-load ES modules -->
<link rel="modulepreload" href="/modules/app.js">
```

```
Measuring the effect of resource hints:

  Effect of preconnect:
  ┌─────────────────────┬────────────┬────────────┐
  │ Operation           │ preconnect │ None       │
  ├─────────────────────┼────────────┼────────────┤
  │ DNS resolution      │ Pre-done   │ 50ms       │
  │ TCP connection      │ Pre-done   │ 30ms       │
  │ TLS handshake       │ Pre-done   │ 50ms       │
  │ First request       │ Immediate  │ +130ms     │
  └─────────────────────┴────────────┴────────────┘

  Limit preconnect to at most 3-4 domains:
  → Excessive preconnect consumes CPU/memory
  → Use only for the most important external domains
```

### 2.4 HTTP/2 and HTTP/3

```
HTTP/2 optimizations:

  Key features:
  ① Multiplexing:
     → Process multiple streams in parallel over one TCP connection
     → Not dependent on request/response order
     → Resolves HTTP/1.1 Head-of-Line Blocking

  ② Header compression (HPACK):
     → Static table + dynamic table
     → Repeated headers referenced in 1 byte
     → Very effective for compressing large headers like Cookie

  ③ Server push:
     → Server sends resources before client requests
     → Push CSS/JS along with HTML
     → Note: Being deprecated due to conflict with browser cache
     → Alternative: 103 Early Hints

  ④ Stream priority:
     → Set priority: CSS > JS > images
     → Browser automatically sets optimal priority

HTTP/3 (QUIC) benefits:

  HTTP/2 problem (TCP Head-of-Line Blocking):
  → Packet loss at TCP level stops all streams
  → TCP constraints cannot be avoided even with HTTP/2

  HTTP/3 solution:
  → Uses QUIC (transport protocol over UDP)
  → Independent control per stream
  → Packet loss in one stream does not affect others

  Faster connection establishment:
  ┌─────────────┬───────┬───────────────┐
  │ Protocol    │ RTT   │ 0-RTT reconnect│
  ├─────────────┼───────┼───────────────┤
  │ HTTP/1.1+TLS│ 3 RTT │ N/A            │
  │ HTTP/2+TLS  │ 2 RTT │ N/A            │
  │ HTTP/3+QUIC │ 1 RTT │ 0 RTT (reconnect)│
  └─────────────┴───────┴───────────────┘

  Connection migration:
  → Maintain connection even when switching Wi-Fi → mobile
  → Connection identified by Connection ID (not IP-dependent)
```

```nginx
# HTTP/2 configuration in Nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/ssl/certs/example.com.pem;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    # ALPN (Application-Layer Protocol Negotiation)
    ssl_protocols TLSv1.2 TLSv1.3;

    # HTTP/2 server push (deprecated but for reference)
    # location / {
    #     http2_push /styles.css;
    #     http2_push /app.js;
    # }

    # 103 Early Hints (alternative)
    location / {
        add_header Link "</styles.css>; rel=preload; as=style" always;
        add_header Link "</app.js>; rel=preload; as=script" always;
    }
}

# HTTP/3 configuration in Nginx (nginx-quic)
server {
    listen 443 quic reuseport;
    listen 443 ssl http2;

    ssl_protocols TLSv1.3;  # HTTP/3 requires TLS 1.3

    add_header Alt-Svc 'h3=":443"; ma=86400';
    # Alt-Svc: notify browser of HTTP/3 support
}
```

### 2.5 Connection Reuse and Connection Pooling

```
Connection reuse:

  HTTP/1.1 Keep-Alive:
  → Connection: keep-alive (default)
  → Avoid TCP + TLS handshake costs
  → Set idle time with Keep-Alive-Timeout

  Nginx configuration:
  keepalive_timeout 65;        # Client connection timeout
  keepalive_requests 1000;     # Maximum requests per connection

  upstream backend {
      server app:3000;
      keepalive 32;             # Keep-Alive connection pool to backend
      keepalive_requests 100;
      keepalive_timeout 60s;
  }

  Server-side connection pooling:
  ┌──────────┐     Keep-Alive      ┌──────────┐
  │ Browser  │ ←────────────────→ │   Nginx  │
  └──────────┘                      └─────┬────┘
                                          │ Connection Pool
                                    ┌─────┴────┐
                                    │  App(N)  │
                                    │  DB Pool │
                                    │  Redis   │
                                    └──────────┘

  Database connection pooling:
  → PgBouncer: PostgreSQL connection pooling
  → Connection establishment: ~50ms → From pool: ~0.5ms
  → Transaction pooling: reuse connections per transaction
```

### 2.6 Geographic Distribution of Servers

```
Multi-region deployment:

  Configuration example:
  ┌──────────────────────────────────────────────────┐
  │              Route 53 / Cloudflare DNS            │
  │        Latency-based routing                      │
  └──────────┬─────────────┬─────────────┬───────────┘
             │             │             │
    ┌────────┴───┐  ┌──────┴────┐  ┌────┴────────┐
    │ us-east-1  │  │ eu-west-1 │  │ ap-northeast│
    │ Virginia   │  │ Ireland   │  │ Tokyo       │
    ├────────────┤  ├───────────┤  ├─────────────┤
    │ App Server │  │App Server │  │ App Server  │
    │ Read DB    │  │ Read DB   │  │ Read DB     │
    └────────────┘  └───────────┘  └─────────────┘
             │             │             │
             └─────────────┼─────────────┘
                    ┌──────┴──────┐
                    │ Primary DB  │
                    │ (us-east-1) │
                    └─────────────┘

  Latency comparison (Tokyo user):
  ┌──────────────┬──────────┐
  │ Server location│ RTT    │
  ├──────────────┼──────────┤
  │ Tokyo        │ ~5ms     │
  │ Singapore    │ ~70ms    │
  │ Virginia     │ ~170ms   │
  │ London       │ ~250ms   │
  └──────────────┴──────────┘

  Data synchronization strategy:
  → Eventually Consistent model
  → CRDTs (Conflict-free Replicated Data Types)
  → Read replica + write leader pattern
```

---

## 3. Bandwidth Optimization

### 3.1 Text Compression

```
Text compression comparison:

  Compression algorithms:
  ┌──────────┬──────────┬──────────┬──────────────────┐
  │ Method   │ Ratio    │ Speed    │ Support           │
  ├──────────┼──────────┼──────────┼──────────────────┤
  │ gzip     │ 70-80%   │ Fast     │ All browsers      │
  │ Brotli   │ 80-90%   │ Medium   │ All modern        │
  │ zstd     │ 75-85%   │ Fastest  │ Chrome 123+       │
  └──────────┴──────────┴──────────┴──────────────────┘

  Measured values (React app main.js: 500KB):
  ┌──────────┬────────────┬──────────────┐
  │ Method   │ Compressed │ Reduction    │
  ├──────────┼────────────┼──────────────┤
  │ None     │ 500KB      │ -            │
  │ gzip     │ 145KB      │ 71%          │
  │ Brotli   │ 120KB      │ 76%          │
  │ zstd     │ 130KB      │ 74%          │
  └──────────┴────────────┴──────────────┘
```

```nginx
# Brotli compression configuration in Nginx
# Requires ngx_brotli module

# Dynamic compression (compress on request)
brotli on;
brotli_comp_level 6;    # 1-11 (6 balances speed and ratio)
brotli_types
    text/plain
    text/css
    text/javascript
    application/json
    application/javascript
    application/x-javascript
    application/xml
    image/svg+xml;
brotli_min_length 1024;  # Do not compress below 1KB

# Static pre-compression (generate .br files at build time)
brotli_static on;
# → If app.js.br exists, serve it without dynamic compression
# → Generated with: brotli app.js at build time

# gzip fallback
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1024;
gzip_static on;
```

```javascript
// Build-time compression configuration with Vite
// vite.config.ts
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    // Brotli compression
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,     // Compress files over 1KB
    }),
    // gzip fallback
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
    }),
  ],
  build: {
    // Disable source maps in production
    sourcemap: false,
    // Chunk size warning threshold
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Separate vendor chunks
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
});
```

### 3.2 Image Optimization

```
Image format selection:

  Format comparison (same quality benchmark):
  ┌────────┬───────────┬──────────────────────┬──────────────┐
  │ Format │ Ratio     │ Use case              │ Browser     │
  ├────────┼───────────┼──────────────────────┼──────────────┤
  │ AVIF   │ 50%↓ JPEG │ Photos (next-gen, rec)│ Chrome/FF/Sf│
  │ WebP   │ 30%↓ JPEG │ Photos (recommended)  │ All modern  │
  │ JPEG XL│ 35%↓ JPEG │ Photos (experimental) │ Limited     │
  │ SVG    │ Very small│ Icons, logos          │ All         │
  │ PNG    │ Large     │ Only when transparent │ All         │
  │ JPEG   │ Baseline  │ Fallback              │ All         │
  └────────┴───────────┴──────────────────────┴──────────────┘

  Measured values (photo 1920x1080px, quality 80):
  ┌────────┬───────────┐
  │ Format │ File size │
  ├────────┼───────────┤
  │ PNG    │ 3.2MB     │
  │ JPEG   │ 280KB     │
  │ WebP   │ 195KB     │
  │ AVIF   │ 140KB     │
  └────────┴───────────┘
```

```html
<!-- Full implementation of responsive images -->

<!-- 1. Basic picture element -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg"
       alt="Product image"
       loading="lazy"
       decoding="async"
       width="800"
       height="600">
</picture>

<!-- 2. Responsive support (resolution and viewport width) -->
<picture>
  <!-- For desktop -->
  <source
    media="(min-width: 1024px)"
    srcset="hero-1600.avif 1600w, hero-1200.avif 1200w"
    sizes="100vw"
    type="image/avif">
  <source
    media="(min-width: 1024px)"
    srcset="hero-1600.webp 1600w, hero-1200.webp 1200w"
    sizes="100vw"
    type="image/webp">

  <!-- For mobile -->
  <source
    srcset="hero-800.avif 800w, hero-400.avif 400w"
    sizes="100vw"
    type="image/avif">
  <source
    srcset="hero-800.webp 800w, hero-400.webp 400w"
    sizes="100vw"
    type="image/webp">

  <img
    src="hero-800.jpg"
    alt="Hero image"
    loading="eager"
    fetchpriority="high"
    width="1600"
    height="900">
</picture>

<!-- 3. Next.js Image component (automatic optimization) -->
<!-- The above complexity is absorbed by the framework -->
```

```typescript
// Using Next.js Image component
import Image from 'next/image';

// Basic usage
function ProductCard({ product }: { product: Product }) {
  return (
    <div>
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={400}
        height={300}
        // Automatically converts to WebP/AVIF
        // Generates responsive srcset
        // lazy loading by default
        placeholder="blur"
        blurDataURL={product.blurHash}
      />
    </div>
  );
}

// Hero image (LCP target)
function HeroImage() {
  return (
    <Image
      src="/hero.jpg"
      alt="Main visual"
      fill                   // Fill parent element
      sizes="100vw"
      priority               // Disable lazy loading, add preload hint
      quality={85}
      className="object-cover"
    />
  );
}

// Image optimization settings in next.config.js
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.example.com',
        pathname: '/uploads/**',
      },
    ],
  },
};
```

### 3.3 JavaScript Optimization

```typescript
// Code Splitting

// 1. Route-based splitting (React Router)
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import(
  /* webpackChunkName: "analytics" */
  /* webpackPrefetch: true */
  './pages/Analytics'
));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Suspense>
  );
}

// 2. Component-based splitting
const HeavyEditor = lazy(() => import('./components/HeavyEditor'));
// → HeavyEditor is loaded only when needed

function EditorPage() {
  const [showEditor, setShowEditor] = useState(false);
  return (
    <div>
      <button onClick={() => setShowEditor(true)}>Open Editor</button>
      {showEditor && (
        <Suspense fallback={<EditorSkeleton />}>
          <HeavyEditor />
        </Suspense>
      )}
    </div>
  );
}

// 3. Conditional import
async function processImage(file: File) {
  // sharp is loaded only when used
  const { processWithSharp } = await import('./utils/imageProcessor');
  return processWithSharp(file);
}

// 4. Effective use of Tree Shaking
// Bad (entire bundle is imported)
import _ from 'lodash';
_.debounce(fn, 300);

// Good (only the needed function)
import debounce from 'lodash/debounce';
debounce(fn, 300);

// Best (Tree Shaking possible with ESModules)
import { debounce } from 'lodash-es';
debounce(fn, 300);
```

```
Bundle analysis and optimization:

  Target sizes:
  ┌─────────────────────────┬────────────────────┐
  │ Category                │ Target (after gzip) │
  ├─────────────────────────┼────────────────────┤
  │ Initial JS bundle(total)│ < 200KB             │
  │ Framework (React, etc.) │ < 45KB              │
  │ Chunk per route         │ < 100KB             │
  │ Third-party total       │ < 100KB             │
  └─────────────────────────┴────────────────────┘

  Analysis tools:
  → webpack-bundle-analyzer:
    npx webpack-bundle-analyzer stats.json

  → source-map-explorer:
    npx source-map-explorer build/static/js/*.js

  → Vite build report:
    npx vite-bundle-visualizer

  Alternatives for large libraries:
  ┌──────────────┬──────────┬──────────────┬──────────┐
  │ Library      │ Size     │ Alternative  │ Size     │
  ├──────────────┼──────────┼──────────────┼──────────┤
  │ moment       │ 72KB     │ day.js       │ 2KB      │
  │ lodash       │ 71KB     │ lodash-es    │ Tree-OK  │
  │ chart.js     │ 63KB     │ lightweight- │ 15KB     │
  │ uuid         │ 12KB     │ nanoid       │ 0.5KB    │
  │ axios        │ 13KB     │ fetch API    │ 0KB      │
  └──────────────┴──────────┴──────────────┴──────────┘
```

### 3.4 Font Optimization

```css
/* Font optimization implementation */

/* 1. font-display: swap to show text first */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-v13-latin-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;  /* FOUT: show unstyled text first */
}

/* font-display options:
   auto:     Browser decides
   block:    Hide for 3 seconds → show font (FOIT)
   swap:     Immediate fallback → font switch (FOUT) - recommended
   fallback: Hide 100ms → fallback → switch within 3s
   optional: Immediate fallback → use font if fast enough
*/

/* 2. Subset Japanese fonts */
/* Noto Sans JP: full = 5.7MB → subset = 200KB */
@font-face {
  font-family: 'Noto Sans JP';
  /* Define subset with unicode-range */
  src: url('/fonts/NotoSansJP-Regular-subset.woff2') format('woff2');
  unicode-range: U+3000-303F, U+3040-309F, U+30A0-30FF,
                 U+4E00-9FFF, U+FF00-FFEF;
  font-display: swap;
}

/* 3. System font stack (zero cost) */
body {
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    'Noto Sans',
    'Noto Sans JP',
    sans-serif;
}
```

```html
<!-- Font preloading -->
<link rel="preload"
      href="/fonts/inter-v13-latin-regular.woff2"
      as="font"
      type="font/woff2"
      crossorigin>

<!-- Optimal loading of Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
      rel="stylesheet">

<!-- Next.js next/font (optimized) -->
<!-- Downloads fonts at build time and self-hosts them -->
```

```typescript
// Using Next.js next/font
import { Inter, Noto_Sans_JP } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
  preload: false, // Japanese fonts are large so do not preload
});

export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${notoSansJP.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

### 3.5 Video and Media Optimization

```html
<!-- Video optimization -->

<!-- 1. Lazy loading + adaptive quality -->
<video
  poster="/video-poster.webp"
  preload="none"
  playsinline
  muted
  loop>
  <!-- Provide resolution in stages for low-bandwidth users -->
  <source src="/video-720p.mp4" type="video/mp4"
          media="(max-width: 768px)">
  <source src="/video-1080p.mp4" type="video/mp4">
</video>

<!-- 2. Lazy playback with Intersection Observer -->
<script>
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const video = entry.target;
    if (entry.isIntersecting) {
      video.play();
    } else {
      video.pause();
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('video[data-lazy]').forEach(v => observer.observe(v));
</script>
```

```
Media optimization checklist:

  Images:
  □ Use WebP/AVIF format
  □ Set responsive srcset + sizes
  □ Explicitly set width/height (prevent CLS)
  □ Set loading="lazy" for non-first-view images
  □ Set fetchpriority="high" for LCP images
  □ Use placeholder/blurHash

  Video:
  □ Set poster image
  □ preload="none" to save data
  □ Adaptive bitrate (HLS/DASH)
  □ Control elements outside first view with Intersection Observer

  SVG:
  □ Optimize with SVGO (remove unnecessary metadata)
  □ Inline small SVGs
  □ Use sprite sheets (for icons)
```

---

## 4. API Optimization

### 4.1 Minimizing Responses

```typescript
// Field selection in REST API
// GET /api/users?fields=id,name,email

// Server-side implementation (Express + Prisma)
app.get('/api/users', async (req, res) => {
  const fields = req.query.fields?.split(',') || [];

  const select = fields.length > 0
    ? Object.fromEntries(fields.map(f => [f, true]))
    : undefined; // Return all fields if not specified

  const users = await prisma.user.findMany({
    select,
    take: 20,
  });

  res.json({ data: users });
});

// GraphQL field selection (automatic optimization)
const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      email
      # avatar and profile not needed so not fetched
    }
  }
`;

// tRPC field selection
const users = await trpc.user.list.query({
  select: { id: true, name: true, email: true },
});
```

### 4.2 Batch Requests and DataLoader

```typescript
// Batch requests: consolidate multiple API calls into 1 request

// Client-side
const batchRequest = async (requests: BatchItem[]) => {
  const response = await fetch('/api/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  return response.json();
};

// Example: 3 APIs into 1 request
const results = await batchRequest([
  { method: 'GET', url: '/api/users/1' },
  { method: 'GET', url: '/api/users/1/orders' },
  { method: 'GET', url: '/api/users/1/notifications' },
]);

// Server-side: DataLoader pattern (N+1 prevention)
import DataLoader from 'dataloader';

// Batch user fetching
const userLoader = new DataLoader(async (userIds: readonly string[]) => {
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
  });
  // Return preserving the order of IDs
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id) || null);
});

// Usage (individual calls are batched automatically)
const user1 = await userLoader.load('user-1');
const user2 = await userLoader.load('user-2');
// → Batched into 1 SQL query: SELECT * FROM users WHERE id IN ('user-1', 'user-2')
```

### 4.3 Pagination

```typescript
// Cursor-based pagination (recommended)

// Benefits:
// → Consistent results (not affected by data additions/deletions mid-way)
// → Stable performance even with large data (no OFFSET needed)
// → Optimal for infinite scroll

// API design
// GET /api/posts?cursor=abc123&limit=20

// Server-side (Prisma)
async function getPosts(cursor?: string, limit = 20) {
  const posts = await prisma.post.findMany({
    take: limit + 1, // Fetch 1 more to determine if next page exists
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor element itself
    }),
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = posts.length > limit;
  const data = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return {
    data,
    nextCursor,
    hasMore,
  };
}

// Response example
{
  "data": [
    { "id": "post-20", "title": "..." },
    { "id": "post-19", "title": "..." }
  ],
  "nextCursor": "post-19",
  "hasMore": true
}

// Client-side (TanStack Query useInfiniteQuery)
function useInfinitePosts() {
  return useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam }) =>
      fetch(`/api/posts?cursor=${pageParam || ''}&limit=20`).then(r => r.json()),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: '',
  });
}
```

### 4.4 Cache Strategy Details

```
Overview of HTTP caching:

  Browser cache → CDN cache → Origin server

  Cache-Control header explanation:
  ┌─────────────────────────────────────────────────────────────┐
  │ Cache-Control: public, max-age=3600, stale-while-revalidate=86400 │
  │                                                              │
  │ public:        Can be stored in CDN/shared cache             │
  │ private:       Browser cache only (user-specific data)       │
  │ max-age=3600:  Cache valid for 3600 seconds (1 hour)         │
  │ s-maxage=3600: max-age applied to CDN only                   │
  │ no-cache:      Verify with server every time (ETag/Last-Modified)│
  │ no-store:      Do not cache at all                           │
  │ immutable:     No conditional requests needed within max-age  │
  │ stale-while-revalidate=86400:                               │
  │   After max-age expires, return stale cache for 86400s while revalidating │
  │ stale-if-error=86400:                                       │
  │   Return stale cache for 86400s on origin error             │
  └─────────────────────────────────────────────────────────────┘

  ETag + conditional requests:
  1. Response: ETag: "abc123"
  2. Next request: If-None-Match: "abc123"
  3. No change → 304 Not Modified (no body, saves bandwidth)
  4. Changed → 200 OK (new data)

  Cache invalidation (Cache Busting):
  → Content hash in file name: app.a1b2c3d4.js
  → Query parameter: styles.css?v=20240101 (not recommended: may not work on CDN)
```

```typescript
// Application-level cache strategy

// 1. TanStack Query cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // Consider fresh for 5 minutes
      gcTime: 30 * 60 * 1000,      // Keep in memory for 30 minutes
      refetchOnWindowFocus: true,   // Re-fetch on focus recovery
      refetchOnReconnect: true,     // Re-fetch on network recovery
      retry: 3,                     // Retry 3 times
      retryDelay: (attempt) =>      // Exponential backoff
        Math.min(1000 * 2 ** attempt, 30000),
    },
  },
});

// 2. Cache configuration per resource type
const userQuery = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  staleTime: 10 * 60 * 1000,       // User info: 10 minutes
  gcTime: 60 * 60 * 1000,          // Keep in memory 1 hour
});

const notificationsQuery = useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  staleTime: 30 * 1000,             // Notifications: 30 seconds (frequent updates)
  refetchInterval: 60 * 1000,       // Poll every 60 seconds
});

// 3. Service Worker cache (Workbox)
// Cache First: static assets
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Stale While Revalidate: API
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Network First: HTML
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
      }),
    ],
  })
);
```

### 4.5 Data Compression and Serialization

```typescript
// Efficient JSON serialization

// 1. Exclude unnecessary fields
function serializeUser(user: User) {
  const { password, internalNotes, ...publicData } = user;
  return publicData;
}

// 2. superjson: Serialization of Date, Map, Set, etc.
import superjson from 'superjson';

// Server
const data = { createdAt: new Date(), tags: new Set(['a', 'b']) };
const serialized = superjson.stringify(data);

// Client
const parsed = superjson.parse(serialized);
// parsed.createdAt is a Date object
// parsed.tags is a Set object

// 3. Protocol Buffers (for high-performance APIs)
// → 3-10x faster serialization than JSON
// → Payload is 50-80% smaller
// → Used with gRPC, Connect

// user.proto
// message User {
//   string id = 1;
//   string name = 2;
//   string email = 3;
//   google.protobuf.Timestamp created_at = 4;
// }

// 4. MessagePack (binary JSON)
// → Represents the same data structure as JSON in binary
// → 20-30% smaller than JSON
// → Parse speed 2-5x faster
```

### 4.6 Connection Pooling and Connection Management

```typescript
// Database connection pooling

// 1. Prisma connection pooling
// prisma/schema.prisma
// datasource db {
//   provider = "postgresql"
//   url      = env("DATABASE_URL")
//   // ?connection_limit=10&pool_timeout=30
// }

// 2. PgBouncer configuration
// pgbouncer.ini
// [databases]
// mydb = host=localhost port=5432 dbname=mydb
//
// [pgbouncer]
// pool_mode = transaction        # Reuse connections per transaction
// max_client_conn = 1000         # Maximum client connections
// default_pool_size = 20         # Pool size
// min_pool_size = 5              # Minimum pool size
// reserve_pool_size = 5          # Reserve pool

// 3. Redis connection pooling (ioredis)
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  // Cluster mode
  // sentinels: [{ host: 'sentinel1', port: 26379 }],
});

// 4. HTTP client connection pooling
import { Agent } from 'undici';

const agent = new Agent({
  connections: 100,         // Maximum connections
  pipelining: 10,          // Pipelining count
  keepAliveTimeout: 60000, // Keep-Alive timeout
  keepAliveMaxTimeout: 600000,
});

const response = await fetch('https://api.example.com/data', {
  dispatcher: agent,
});
```

---

## 5. Web Vitals and Performance Measurement

### 5.1 Core Web Vitals Details

```
Core Web Vitals:

  ┌──────┬──────────────────────────────┬─────────────┬────────────┐
  │ Metric│ What is measured             │ Good        │ Poor       │
  ├──────┼──────────────────────────────┼─────────────┼────────────┤
  │ LCP  │ Largest content display      │ < 2.5s      │ > 4.0s     │
  │ INP  │ Interaction latency          │ < 200ms     │ > 500ms    │
  │ CLS  │ Layout shift                 │ < 0.1       │ > 0.25     │
  └──────┴──────────────────────────────┴─────────────┴────────────┘

  LCP (Largest Contentful Paint):
  → Time until the largest element in the viewport is displayed
  → Targets: <img>, <video>, background-image, text blocks
  → Improvements:
     ① Resource preloading: <link rel="preload">
     ② Image optimization: WebP/AVIF, srcset
     ③ Faster server response: TTFB < 800ms
     ④ Remove render blocking: async/defer
     ⑤ Set fetchpriority="high"

  INP (Interaction to Next Paint):
  → Time from user interaction to next paint update
  → Successor metric to FID (from March 2024)
  → Targets: click, tap, keypress
  → Improvements:
     ① Split long tasks: requestIdleCallback, setTimeout
     ② Optimize event handlers
     ③ Prevent unnecessary re-renders: React.memo, useMemo
     ④ Offload heavy processing to Web Worker
     ⑤ Use Concurrent Features: useTransition, useDeferredValue

  CLS (Cumulative Layout Shift):
  → Cumulative score of layout shifts during page load
  → Improvements:
     ① Explicitly set width/height on img/video
     ② font-display: swap + size-matching fallback
     ③ Reserve space for ads and embedded content in advance
     ④ Optimize where dynamic content is inserted
     ⑤ Use CSS containment
```

### 5.2 Supplementary Metrics

```
Network-related supplementary metrics:

  TTFB (Time to First Byte): < 800ms
  → Speed of server response
  → DNS + TCP + TLS + server processing time
  → Improvement: CDN, caching, server optimization

  FCP (First Contentful Paint): < 1.8s
  → First content display
  → Text, images, SVG, non-white canvas
  → Improvement: Critical CSS, preload, SSR

  Difference between TTFB and FCP:
  → Effect of render blocking
  → Large difference = CSS or JS is blocking

  TBT (Total Blocking Time):
  → Total main thread blocking time between FCP and TTI
  → Sum of blocking time exceeding 50ms for tasks over 50ms
  → Highly correlated with INP

  Speed Index:
  → Score of how fast page content is displayed
  → Measures visual progress
  → Target: < 3.4s
```

### 5.3 Performance Measurement Implementation

```typescript
// Measurement using Performance API

// 1. Navigation Timing API
function measurePageLoad() {
  const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];

  const metrics = {
    // DNS resolution time
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    // TCP connection time
    tcp: navigation.connectEnd - navigation.connectStart,
    // TLS handshake time
    tls: navigation.secureConnectionStart > 0
      ? navigation.connectEnd - navigation.secureConnectionStart
      : 0,
    // TTFB
    ttfb: navigation.responseStart - navigation.requestStart,
    // Content download time
    download: navigation.responseEnd - navigation.responseStart,
    // DOMContentLoaded
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
    // Load event
    load: navigation.loadEventEnd - navigation.startTime,
    // DOM parse time
    domParsing: navigation.domInteractive - navigation.responseEnd,
  };

  console.table(metrics);
  return metrics;
}

// 2. Resource Timing API
function measureResources() {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  // Top 10 slowest resources
  const slowest = resources
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10)
    .map(r => ({
      name: r.name.split('/').pop(),
      duration: Math.round(r.duration),
      size: r.transferSize,
      type: r.initiatorType,
      protocol: r.nextHopProtocol,
    }));

  console.table(slowest);

  // Totals by resource type
  const byType = resources.reduce((acc, r) => {
    const type = r.initiatorType;
    if (!acc[type]) acc[type] = { count: 0, totalSize: 0, totalDuration: 0 };
    acc[type].count++;
    acc[type].totalSize += r.transferSize;
    acc[type].totalDuration += r.duration;
    return acc;
  }, {} as Record<string, { count: number; totalSize: number; totalDuration: number }>);

  console.table(byType);
}

// 3. Core Web Vitals measurement (web-vitals library)
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

function reportWebVitals() {
  onLCP((metric) => {
    console.log('LCP:', metric.value, 'ms');
    console.log('LCP Element:', metric.entries[0]?.element);
    sendToAnalytics('LCP', metric);
  });

  onINP((metric) => {
    console.log('INP:', metric.value, 'ms');
    sendToAnalytics('INP', metric);
  });

  onCLS((metric) => {
    console.log('CLS:', metric.value);
    // Details of each CLS shift
    metric.entries.forEach(entry => {
      console.log('Shift:', entry.value, entry.sources);
    });
    sendToAnalytics('CLS', metric);
  });

  onFCP((metric) => {
    console.log('FCP:', metric.value, 'ms');
    sendToAnalytics('FCP', metric);
  });

  onTTFB((metric) => {
    console.log('TTFB:', metric.value, 'ms');
    sendToAnalytics('TTFB', metric);
  });
}

// 4. Custom performance marks
function measureCustom() {
  // Measure API call
  performance.mark('api-start');

  fetch('/api/users').then(async (res) => {
    performance.mark('api-end');
    performance.measure('api-call', 'api-start', 'api-end');

    const [measure] = performance.getEntriesByName('api-call');
    console.log('API call duration:', measure.duration, 'ms');
  });
}

// 5. Long Tasks API (for INP improvement)
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.duration > 50) {
      console.warn('Long Task detected:', {
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name,
      });
    }
  });
});
observer.observe({ type: 'longtask', buffered: true });
```

### 5.4 RUM (Real User Monitoring)

```typescript
// Collecting and sending RUM data

interface PerformanceData {
  url: string;
  userAgent: string;
  connectionType: string;
  effectiveType: string;
  lcp: number;
  inp: number;
  cls: number;
  fcp: number;
  ttfb: number;
  timestamp: number;
}

function collectPerformanceData(): void {
  const connection = (navigator as any).connection;

  const data: Partial<PerformanceData> = {
    url: window.location.href,
    userAgent: navigator.userAgent,
    connectionType: connection?.type || 'unknown',
    effectiveType: connection?.effectiveType || 'unknown',
    timestamp: Date.now(),
  };

  // Collect each metric with web-vitals
  onLCP(m => { data.lcp = m.value; maybeSend(data); });
  onINP(m => { data.inp = m.value; maybeSend(data); });
  onCLS(m => { data.cls = m.value; maybeSend(data); });
  onFCP(m => { data.fcp = m.value; maybeSend(data); });
  onTTFB(m => { data.ttfb = m.value; maybeSend(data); });
}

function maybeSend(data: Partial<PerformanceData>): void {
  // Send when all metrics are collected
  if (data.lcp && data.inp !== undefined && data.cls !== undefined) {
    sendBeacon(data);
  }
}

function sendBeacon(data: Partial<PerformanceData>): void {
  // sendBeacon: reliably sends even on page navigation
  navigator.sendBeacon('/api/analytics/performance', JSON.stringify(data));
}

// Aggregating and analyzing RUM data (server-side)
// → Analyze at p75 / p95 / p99 percentiles
// → Compare by network type
// → Compare by page
// → Detect regressions
```

### 5.5 Measurement Tools and Dashboards

```
Performance measurement tools:

  Lab data (synthetic tests):
  ┌──────────────────┬────────────────────────────────────┐
  │ Tool             │ Features                            │
  ├──────────────────┼────────────────────────────────────┤
  │ Lighthouse       │ Chrome DevTools integration, score + suggestions │
  │ WebPageTest      │ Test from locations worldwide, Waterfall analysis │
  │ PageSpeed Insights│ Lighthouse + CrUX data             │
  │ unlighthouse     │ Audit entire site at once            │
  └──────────────────┴────────────────────────────────────┘

  Field data (real users):
  ┌──────────────────┬────────────────────────────────────┐
  │ Tool             │ Features                            │
  ├──────────────────┼────────────────────────────────────┤
  │ CrUX             │ Chrome real user data (free)        │
  │ Vercel Analytics │ For Next.js, automatic CWV measurement │
  │ Sentry           │ Error + performance measurement     │
  │ Datadog RUM      │ Enterprise-grade RUM                │
  │ SpeedCurve       │ RUM + synthetic tests + visualization │
  └──────────────────┴────────────────────────────────────┘

  Automated measurement in CI/CD:
  → Lighthouse CI: Measure score per PR
  → Bundlesize: Bundle size threshold check
  → web-vitals-reporter: CWV regression detection

  Lighthouse CI configuration example:
  // lighthouserc.js
  module.exports = {
    ci: {
      collect: {
        url: ['http://localhost:3000/', 'http://localhost:3000/products'],
        numberOfRuns: 3,
      },
      assert: {
        assertions: {
          'categories:performance': ['error', { minScore: 0.9 }],
          'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
          'interactive': ['error', { maxNumericValue: 3800 }],
          'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        },
      },
      upload: {
        target: 'temporary-public-storage',
      },
    },
  };
```

---

## 6. Service Workers and Offline Support

### 6.1 Service Worker Basics

```typescript
// Service Worker registration
// app.ts
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('SW registered:', registration.scope);
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  });
}

// sw.js - Service Worker
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/styles.css',
  '/app.js',
  '/icons/icon-192x192.png',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim(); // Control all clients
});

// Fetch: implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: Cache First
  if (request.destination === 'image' ||
      request.destination === 'style' ||
      request.destination === 'script') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML: Network First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request).catch(() => caches.match('/offline.html'))
    );
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request);
  }
}
```

### 6.2 Service Worker with Workbox

```typescript
// Workbox: Google's Service Worker library

// next.config.js (next-pwa)
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.example\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
  ],
});

module.exports = withPWA({
  // Next.js config
});
```

---

## 7. Edge Computing and Edge Functions

### 7.1 Edge Computing Overview

```
Edge Computing:

  Traditional architecture:
  User → CDN (static delivery only) → Origin server (logic)

  Edge computing:
  User → Edge (can execute logic) → Origin (only when needed)

  Benefits:
  → Dramatically reduced latency (execute logic close to user)
  → Reduced origin server load
  → Globally distributed processing
  → Fast cold starts (a few ms)

  Constraints:
  → Execution time limit (typically 50ms to 30 seconds)
  → Memory limit (128MB+)
  → Some Node.js APIs are unavailable
  → Stateless (persist with KV Store, etc.)
```

```typescript
// Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // A/B testing
    if (url.pathname === '/') {
      const bucket = request.headers.get('cf-connecting-ip')?.charCodeAt(0) % 2;
      const variant = bucket === 0 ? 'control' : 'experiment';
      const response = await fetch(`${url.origin}/variants/${variant}`);
      return new Response(response.body, {
        headers: {
          ...Object.fromEntries(response.headers),
          'X-Variant': variant,
        },
      });
    }

    // Region-specific content
    if (url.pathname === '/pricing') {
      const country = request.cf?.country || 'US';
      const currency = getCurrency(country);
      // Get cached pricing from KV Store
      const pricing = await env.PRICING_KV.get(`pricing:${currency}`, 'json');
      return Response.json(pricing);
    }

    return fetch(request);
  },
};

// Vercel Edge Functions
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Geography-based redirect
  const country = request.geo?.country || 'US';

  if (country === 'JP' && !request.nextUrl.pathname.startsWith('/ja')) {
    return NextResponse.redirect(new URL('/ja' + request.nextUrl.pathname, request.url));
  }

  // Rate limiting
  const ip = request.ip || 'unknown';
  // Implement rate limiting with Edge KV

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 7.2 Data Access at the Edge

```typescript
// Edge databases

// 1. Cloudflare D1 (edge SQLite)
export default {
  async fetch(request: Request, env: Env) {
    const { results } = await env.DB
      .prepare('SELECT * FROM products WHERE category = ?')
      .bind('electronics')
      .all();

    return Response.json(results);
  },
};

// 2. Vercel KV (edge Redis)
import { kv } from '@vercel/kv';

export async function GET(request: Request) {
  // Get session
  const session = await kv.get(`session:${sessionId}`);

  // Rate limiting
  const requests = await kv.incr(`ratelimit:${ip}`);
  if (requests === 1) {
    await kv.expire(`ratelimit:${ip}`, 60);
  }
  if (requests > 100) {
    return new Response('Too Many Requests', { status: 429 });
  }

  return Response.json({ data: session });
}

// 3. PlanetScale / Neon (edge-compatible DB)
import { neon } from '@neondatabase/serverless';

export async function GET(request: Request) {
  const sql = neon(process.env.DATABASE_URL!);
  const products = await sql`
    SELECT id, name, price FROM products
    WHERE category = 'electronics'
    ORDER BY created_at DESC
    LIMIT 20
  `;
  return Response.json(products);
}
```

---

## 8. Network Resilience

### 8.1 Retry and Backoff

```typescript
// Retry with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 1000,
): Promise<Response> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // 5xx errors are retry targets
      if (response.status >= 500 && attempt < maxRetries) {
        throw new Error(`Server error: ${response.status}`);
      }

      // 429 Too Many Requests: refer to Retry-After header
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        await sleep(retryAfter * 1000);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        // Exponential backoff + jitter
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = delay * 0.1 * Math.random();
        console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay + jitter}ms`);
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Circuit breaker pattern
class CircuitBreaker {
  private failures = 0;
  private lastFailure: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold = 5,          // Failure count threshold
    private resetTimeout = 30000,   // Time until reset (ms)
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

// Usage example
const apiBreaker = new CircuitBreaker(5, 30000);

async function fetchUserData(userId: string) {
  return apiBreaker.execute(() =>
    fetchWithRetry(`/api/users/${userId}`)
  );
}
```

### 8.2 Network Status Detection

```typescript
// Network status detection and adaptation

// 1. Online/Offline detection
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

// 2. Network Information API
function useNetworkQuality() {
  const [quality, setQuality] = useState<'fast' | 'slow' | 'offline'>('fast');

  useEffect(() => {
    const connection = (navigator as any).connection;
    if (!connection) return;

    const updateQuality = () => {
      if (!navigator.onLine) {
        setQuality('offline');
        return;
      }

      const effectiveType = connection.effectiveType;
      // effectiveType: 'slow-2g', '2g', '3g', '4g'
      if (effectiveType === '4g' && connection.downlink > 5) {
        setQuality('fast');
      } else {
        setQuality('slow');
      }
    };

    connection.addEventListener('change', updateQuality);
    updateQuality();

    return () => connection.removeEventListener('change', updateQuality);
  }, []);

  return quality;
}

// 3. Adaptive content delivery
function ProductImage({ product }: { product: Product }) {
  const quality = useNetworkQuality();

  return (
    <Image
      src={product.imageUrl}
      alt={product.name}
      quality={quality === 'fast' ? 85 : 50}  // Reduce quality on slow connection
      placeholder={quality === 'fast' ? 'blur' : 'empty'}
      loading={quality === 'fast' ? 'eager' : 'lazy'}
    />
  );
}

// 4. Save-Data header detection
// When user has data saver enabled
function useSaveData() {
  const connection = (navigator as any).connection;
  return connection?.saveData === true;
}

// Server-side Save-Data support
// Detect Save-Data: on header
// → Return lower quality images
// → Disable autoplay video
// → Skip loading unnecessary assets
```

---

## 9. Performance Optimization Checklist

```
Network performance optimization checklist:

  Connection:
  □ Using CDN
  □ Enabled HTTP/2 or higher
  □ Set dns-prefetch / preconnect (max 3-4 domains)
  □ Keep-Alive is enabled
  □ Using TLS 1.3
  □ Considering 103 Early Hints
  □ Considering HTTP/3 (QUIC) support

  Transfer:
  □ Enabled Brotli/gzip compression
  □ Images are in WebP/AVIF format
  □ Responsive images (srcset + sizes) configured
  □ Set fetchpriority="high" on LCP images
  □ JavaScript is code-split
  □ Initial bundle < 200KB (after gzip)
  □ Fonts are WOFF2 + subsetted
  □ font-display: swap is set
  □ Critical CSS is inlined
  □ Non-critical CSS/JS is async/defer

  Caching:
  □ Static files have Cache-Control + hash-named files + immutable
  □ HTML has no-cache + ETag
  □ API has stale-while-revalidate
  □ CDN cache hit rate is monitored (target > 90%)
  □ Service Worker for offline support

  API:
  □ Not returning unnecessary fields
  □ Pagination (cursor-based recommended) is implemented
  □ N+1 issues don't occur (using DataLoader)
  □ Batch requests are considered
  □ Connection pooling is used

  Rendering:
  □ width/height explicitly set on img/video (prevent CLS)
  □ Space for dynamic content is reserved in advance
  □ Long tasks are split (INP improvement)
  □ React.memo / useMemo prevent unnecessary re-renders

  Monitoring:
  □ Core Web Vitals (LCP, INP, CLS) are measured
  □ TTFB is monitored (target < 800ms)
  □ Error rate is monitored
  □ RUM data is collected and analyzed
  □ Lighthouse score is automatically checked in CI/CD
  □ Bundle size trends are tracked

  Resilience:
  □ Retry + exponential backoff is implemented
  □ Timeouts are set
  □ Circuit breaker is considered
  □ Network status (Online/Offline) is handled
  □ Save-Data header is supported
```

---

## 10. Practical Optimization Flow

### 10.1 Performance Budget

```
Performance budget settings:

  Metrics-based budget:
  ┌──────────────────────────┬─────────────────┐
  │ Metric                   │ Budget           │
  ├──────────────────────────┼─────────────────┤
  │ LCP                      │ < 2.5s           │
  │ INP                      │ < 200ms          │
  │ CLS                      │ < 0.1            │
  │ TTFB                     │ < 800ms          │
  │ FCP                      │ < 1.8s           │
  │ Lighthouse Performance   │ > 90             │
  └──────────────────────────┴─────────────────┘

  Resource-based budget:
  ┌──────────────────────────┬─────────────────┐
  │ Resource                 │ Budget           │
  ├──────────────────────────┼─────────────────┤
  │ Initial JS (gzip)        │ < 200KB          │
  │ Initial CSS (gzip)       │ < 50KB           │
  │ Images (per page)        │ < 1MB            │
  │ Fonts                    │ < 100KB          │
  │ Total page size          │ < 2MB            │
  │ HTTP request count       │ < 50             │
  └──────────────────────────┴─────────────────┘

  When budget is exceeded:
  → Automatic check in CI/CD (Lighthouse CI, bundlesize)
  → Review in PR
  → When exceeded: reduce another resource or review feature
```

### 10.2 Phased Optimization Approach

```
Optimization priorities:

  Phase 1: Low Hanging Fruits (high effect + low effort)
  ① Enable compression (Brotli/gzip)
  ② Image optimization (WebP/AVIF conversion)
  ③ Set Cache-Control
  ④ Set preconnect / preload
  ⑤ font-display: swap

  Phase 2: Architectural improvements
  ⑥ Code splitting (route-based + component-based)
  ⑦ Tree Shaking + replace large libraries
  ⑧ Introduce SSR / ISR
  ⑨ Inline Critical CSS

  Phase 3: Advanced optimization
  ⑩ Service Worker + offline support
  ⑪ Edge Functions / edge computing
  ⑫ Introduce HTTP/3
  ⑬ Introduce RUM and continuous monitoring
  ⑭ Performance validation through A/B testing

  High ROI optimizations:
  → Image optimization: often accounts for 50% of page size
  → Code splitting: significantly reduces initial load
  → CDN + caching: dramatically improves TTFB
  → SSR: dramatically improves FCP / LCP
```

---

## FAQ (Frequently Asked Questions)

### Q1: What is the best tool for measuring network performance?

**A:** Use tools based on the purpose and phase of measurement.

**Local measurement during development:**

| Tool | Use | Benefits | Drawbacks |
|--------|------|------|------|
| **Chrome DevTools** | Detailed frontend analysis | Real-time, visual, Waterfall display | Browser-dependent, hard to automate |
| **Lighthouse** | Comprehensive performance evaluation | Also evaluates Core Web Vitals, Best Practices, SEO | Simulation (may differ from real user environment) |
| **WebPageTest** | Testing in diverse environments | Real device testing, video recording, comparison features | Free version has execution count limits |
| **curl** | API/backend measurement | Can be scripted, ideal for TTFB measurement | Cannot reproduce browser behavior |

**Automated measurement in CI/CD pipeline:**

```bash
# Lighthouse CI example
npm install -g @lhci/cli

# lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['https://staging.example.com'],
      numberOfRuns: 5,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', {minScore: 0.9}],
        'first-contentful-paint': ['error', {maxNumericValue: 1800}],
        'largest-contentful-paint': ['error', {maxNumericValue: 2500}],
        'cumulative-layout-shift': ['error', {maxNumericValue: 0.1}],
      },
    },
  },
};

# Run in CI
lhci autorun
```

**Real User Monitoring (RUM) in production:**

| Tool | Features | Cost |
|--------|------|--------|
| **Google Analytics 4** | Auto-collect Core Web Vitals, free | Free |
| **New Relic Browser** | Detailed analysis, error tracking | Paid ($99/month+) |
| **Datadog RUM** | Integrated with infrastructure monitoring, session replay | Paid ($1.50/1000 sessions) |
| **Sentry Performance** | Integrated with error monitoring, transaction tracking | Free tier available |

**Recommended approach:**
1. **During development**: Chrome DevTools + Lighthouse
2. **CI/CD**: Automatic check with Lighthouse CI
3. **Production**: Continuous monitoring with RUM (GA4 or paid service)
4. **API**: curl scripts + metrics visualization with Grafana/Prometheus

### Q2: What kernel parameters are used for TCP optimization?

**A:** Adjusting Linux kernel TCP parameters can achieve high throughput and low latency.

**Basic TCP parameters (`/etc/sysctl.conf`):**

```bash
# ============================================
# TCP window size optimization
# ============================================
# TCP receive buffer size (min, default, max)
net.ipv4.tcp_rmem = 4096 87380 67108864      # Max 64MB
# TCP send buffer size (min, default, max)
net.ipv4.tcp_wmem = 4096 65536 67108864      # Max 64MB
# Maximum socket buffer size
net.core.rmem_max = 67108864
net.core.wmem_max = 67108864

# ============================================
# TCP BBR congestion control algorithm (recommended)
# ============================================
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
# BBR is the latest congestion control algorithm developed by Google
# Faster and more stable than traditional CUBIC (especially in high-latency, packet-loss environments)

# ============================================
# TCP Fast Open (shortening 3-way handshake)
# ============================================
net.ipv4.tcp_fastopen = 3
# 3 = Enable on both client and server
# Include HTTP request in SYN on first connection → reduce 1 RTT

# ============================================
# TIME_WAIT countermeasures
# ============================================
net.ipv4.tcp_tw_reuse = 1
# Reuse sockets in TIME_WAIT state for new connections
# Note: Use with caution in NAT environments (possible packet confusion)

net.ipv4.ip_local_port_range = 1024 65535
# Expand ephemeral port range (default 32768-60999)
# Mitigate port exhaustion due to TIME_WAIT accumulation

# ============================================
# Keep-Alive settings
# ============================================
net.ipv4.tcp_keepalive_time = 600      # Start Keep-Alive after 600 seconds (10 min)
net.ipv4.tcp_keepalive_intvl = 60      # Send Keep-Alive probe every 60 seconds
net.ipv4.tcp_keepalive_probes = 3      # Disconnect after 3 failures

# ============================================
# Connection count limits
# ============================================
net.core.somaxconn = 65535             # listen() backlog queue size
net.core.netdev_max_backlog = 5000     # Network device backlog

# ============================================
# Other optimizations
# ============================================
net.ipv4.tcp_slow_start_after_idle = 0
# Disable slow start after idle (speed up Keep-Alive connections)

net.ipv4.tcp_mtu_probing = 1
# Enable Path MTU Discovery (automatically detect optimal MTU)
```

**Applying configuration:**

```bash
# Apply settings immediately
$ sudo sysctl -p

# Verify settings
$ sysctl net.ipv4.tcp_congestion_control
net.ipv4.tcp_congestion_control = bbr

# Current TCP statistics
$ ss -s
Total: 342
TCP:   120 (estab 45, closed 20, orphaned 3, timewait 15)
```

**Precautions:**
- **Always test in staging environment before applying to production**
- `tcp_tw_reuse` requires caution in NAT environments (timestamp issues)
- `tcp_tw_recycle` should **never be used** (removed in Linux 4.12)
- BBR is available in kernel 4.9 and later

**Measuring the effect:**

```bash
# Bandwidth measurement before and after BBR activation
$ iperf3 -c target.example.com -t 30

# Sample results:
# CUBIC:  850 Mbps  (traditional congestion control)
# BBR:   1,100 Mbps  (30% improvement)
```

### Q3: How much performance improvement does HTTP/3 provide?

**A:** HTTP/3 (QUIC) provides significant improvements in certain environments, but it is not effective in all cases.

**Main HTTP/3 improvements:**

| Improvement | HTTP/2 issue | HTTP/3 solution | Effect |
|---------|--------------|----------------|---------|
| **Head-of-Line Blocking** | All streams stop if TCP-level packet loss | QUIC is UDP-based with independent streams | +30-50% faster on packet loss |
| **Connection establishment** | TCP (1.5 RTT) + TLS (1-2 RTT) = 2.5-3.5 RTT | Integrated with QUIC (0-1 RTT) | First connect -40%, reconnect -70% faster |
| **Connection migration** | IP change disconnects (Wi-Fi ↔ mobile switch) | Continues via Connection ID | Improved mobile user experience |
| **Congestion control** | OS kernel dependent | QUIC's own congestion control | Increased optimization flexibility |

**Measured data (Google example):**

```
Improvement by environment:

  ┌─────────────────────────┬────────────┬────────────┐
  │ Environment             │ Latency    │ Page load  │
  ├─────────────────────────┼────────────┼────────────┤
  │ Wired, low latency(<10ms)│ +5%        │ +2-3%     │
  │ Wi-Fi, medium (10-50ms) │ +10-15%    │ +8-12%    │
  │ Mobile, high (50-200ms) │ +20-30%    │ +15-25%   │
  │ High packet loss (1-5%) │ +40-60%    │ +30-50%   │
  └─────────────────────────┴────────────┴────────────┘

  Conclusion: Large effect in mobile, high-latency, packet-loss environments
```

**Enabling HTTP/3 (Nginx example):**

```nginx
# HTTP/3 support in Nginx 1.25.0 and later
server {
    listen 443 ssl;
    listen 443 quic reuseport;  # HTTP/3 (QUIC) listening

    ssl_certificate     /etc/ssl/certs/example.com.crt;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    # Advertise HTTP/3 with Alt-Svc header
    add_header Alt-Svc 'h3=":443"; ma=86400';

    # QUIC parameters
    quic_retry on;
    ssl_early_data on;

    location / {
        # Regular settings
    }
}
```

**Checking HTTP/3 activation:**

```bash
# HTTP/3 connection test with curl (curl 7.66 and later)
$ curl --http3 -I https://example.com

# Check if Alt-Svc is in response headers
Alt-Svc: h3=":443"; ma=86400

# Check "h3" in Protocol column in Chrome DevTools
# Or check QUIC sessions at chrome://net-internals/#http3
```

**Cases where HTTP/3 should be introduced:**
- ✅ Many mobile users
- ✅ Global deployment (users in high-latency environments)
- ✅ Real-time performance is critical (video streaming, games)
- ✅ Environments where packet loss is likely

**Cases where HTTP/3 is unnecessary:**
- ❌ Intranet / local network only
- ❌ Server-to-server communication (API-to-API, etc.)
- ❌ Legacy systems (high implementation cost)

**Conclusion: HTTP/3 can provide 15-50% improvement in mobile and high-latency environments. Via CDN (Cloudflare, CloudFront), it can be enabled by configuration alone.**

### Q4: How should Brotli and Gzip compression be used?

**A:** Prioritize Brotli and configure Gzip as fallback.

**Compression ratio comparison (measured data):**

| Content type | Original size | Gzip (level 6) | Brotli (level 6) | Brotli (level 11) |
|---------------|---------|----------------|-------------------|-------------------|
| JavaScript (React) | 500 KB | 145 KB (71%) | 125 KB (75%) | 110 KB (78%) |
| CSS (Tailwind) | 300 KB | 45 KB (85%) | 38 KB (87%) | 32 KB (89%) |
| HTML | 100 KB | 25 KB (75%) | 20 KB (80%) | 17 KB (83%) |
| JSON (API) | 200 KB | 30 KB (85%) | 25 KB (88%) | 22 KB (89%) |

**Practical configuration:**

```nginx
# Brotli + Gzip combined configuration in Nginx
# Brotli (requires separate module installation)
brotli on;
brotli_comp_level 6;          # 4-6 recommended for dynamic (balance speed/ratio)
brotli_static on;             # Prefer pre-compressed files (.br)
brotli_types text/plain text/css application/javascript application/json
             image/svg+xml application/xml;

# Gzip (fallback for Brotli-unsupported clients)
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/javascript application/json;
```

**Pre-compression at build time (recommended):**

```javascript
// vite.config.js
import viteCompression from 'vite-plugin-compression';

export default {
  plugins: [
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
  ]
};
// → dist/assets/app.a1b2c3.js     (original file)
// → dist/assets/app.a1b2c3.js.br  (Brotli pre-compressed)
// → dist/assets/app.a1b2c3.js.gz  (Gzip pre-compressed)
```

**Conclusion: Pre-compress static assets with Brotli level 11 at build time, use Brotli level 4-6 for real-time compression of dynamic content. When using CDN, leaving automatic compression to the CDN is also effective.**

### Q5: What is the optimal way to use resource hints (preconnect, prefetch, preload)?

**A:** Resource hints can be bandwidth-intensive if overused, so select carefully based on resource type.

**Criteria for choosing:**

```
Resource hint selection flow:

  Used on current page?
  ├── Yes → Parser discovers it early?
  │         ├── Yes → No hint needed (normal loading)
  │         └── No  → <link rel="preload">
  │                    Example: fonts in CSS, JS dynamic import
  │
  └── No → Used on next page?
           ├── Yes → <link rel="prefetch">
           │          Example: next page's JS/CSS/data
           └── Unknown → Don't use
```

**Specific configuration examples:**

```html
<head>
  <!-- preconnect: Early connection to third parties (up to 2-4 per page) -->
  <link rel="preconnect" href="https://api.example.com">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>

  <!-- dns-prefetch: Lightweight version of preconnect (when many domains) -->
  <link rel="dns-prefetch" href="https://analytics.example.com">

  <!-- preload: Important resources for current page (up to 3-5 per page) -->
  <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/api/critical-data" as="fetch" crossorigin>
  <link rel="preload" as="image" href="/images/hero.webp" fetchpriority="high">

  <!-- prefetch: Resources for next page (fetched during idle time) -->
  <link rel="prefetch" href="/next-page/bundle.js">
</head>
```

**Precautions:**
- preload generates a Chrome warning if not used within 3 seconds
- prefetch is just a "hint" and the browser may ignore it
- On mobile, prefetch may be ignored in data-saving mode
- Too many preconnects can actually degrade performance (CPU/memory consumption)

---

## Summary

| Concept | Key Points |
|------|---------|
| Latency | CDN + preconnect + HTTP/2+ + edge computing |
| Bandwidth | Brotli compression + WebP/AVIF + code splitting + Tree Shaking |
| Caching | Cache-Control + ETag + SWR + Service Worker |
| API | Field selection + cursor-based pagination + batching + connection pooling |
| Measurement | Core Web Vitals + Lighthouse + RUM + CI/CD auto-check |
| Resilience | Retry + circuit breaker + network status detection |
| Edge | Edge Functions + KV Store + edge DB |

---

## Guides to Read Next

After mastering network performance optimization techniques, it is recommended to proceed to the following topics.

- **Browser and Web Platform**: Deep dive into frontend optimization using Service Workers, Cache API, and Web Workers
- **Web Application Development**: Learn framework-specific optimization techniques in React/Next.js such as code splitting, SSR/ISR, and image optimization
- **Infrastructure**: Master server-side performance tuning (DB optimization, cache strategies, horizontal scaling)

---

## References

1. web.dev. "Web Performance." Google, 2024.
2. Grigorik, I. "High Performance Browser Networking." O'Reilly, 2013.
3. RFC 7932. "Brotli Compressed Data Format." IETF, 2016.
4. RFC 9000. "QUIC: A UDP-Based Multiplexed and Secure Transport." IETF, 2021.
5. RFC 9114. "HTTP/3." IETF, 2022.
6. web.dev. "Core Web Vitals." Google, 2024.
7. Cloudflare. "Workers Documentation." developers.cloudflare.com, 2024.
8. Vercel. "Edge Functions." vercel.com/docs, 2024.
9. workboxjs.org. "Workbox Documentation." Google, 2024.
10. TanStack. "TanStack Query Documentation." tanstack.com, 2024.
