# Navigation and Loading

> Follow every step from typing a URL in the browser address bar to the page being displayed. Understand in detail each phase: DNS resolution, TLS connection, HTTP communication, HTML parsing, and resource loading.

## What You Will Learn

- [ ] Understand the complete flow from navigation start to rendering
- [ ] Grasp resource loading priorities
- [ ] Learn page load performance metrics
- [ ] Understand network control via Service Workers
- [ ] Gain practical skills for Preload Scanner and resource hints
- [ ] Practice measurement and bottleneck identification using the Navigation Timing API
- [ ] Understand the impact of HTTP/2 and HTTP/3 on loading
- [ ] Understand the differences in navigation between SPAs and MPAs

---

## Prerequisites

- Browser architecture → Reference: [Browser Architecture](./00-browser-architecture.md)
- DNS resolution and HTTP communication → Reference: DNS
- TCP/TLS handshake → Reference: TCP

---

## 1. Overview of Navigation

### 1.1 The Complete Process from URL Input to Page Display

```
Complete process: URL input → page display

  ① URL input / click
     ↓
  ② URL parsing and security check
     ↓
  ③ Service Worker check (if registered)
     ↓
  ④ DNS resolution
     ↓
  ⑤ TCP connection (3-way handshake)
     ↓
  ⑥ TLS handshake (for HTTPS)
     ↓
  ⑦ HTTP request sent
     ↓
  ⑧ HTTP response received (first byte = TTFB)
     ↓
  ⑨ HTML parsing begins
     ↓
  ⑩ Sub-resource discovery and loading (CSS, JS, images, etc.)
     ↓
  ⑪ DOM construction + CSSOM construction
     ↓
  ⑫ Render tree construction
     ↓
  ⑬ Layout calculation
     ↓
  ⑭ Paint
     ↓
  ⑮ Composite (GPU compositing)
     ↓
  ⑯ Screen display
```

### 1.2 Detailed Timing Breakdown of Each Phase

```
Typical navigation timing (desktop + fiber connection):

  Phase                │ Duration    │ Cumulative
  ─────────────────────┼─────────────┼────────────
  URL parsing          │ <1ms        │ ~1ms
  Cache check          │ 1–5ms       │ ~5ms
  DNS resolution       │ 20–120ms    │ ~50ms
  TCP 3-way HS         │ 10–50ms     │ ~80ms
  TLS 1.3 HS           │ 10–50ms     │ ~120ms
  HTTP request sent    │ 1–5ms       │ ~125ms
  Server processing    │ 50–500ms    │ ~300ms
  First byte received  │ 1ms         │ ~300ms (TTFB)
  HTML transfer        │ 10–100ms    │ ~400ms
  HTML parse begins    │ <1ms        │ ~400ms
  CSS/JS download      │ 50–300ms    │ ~600ms
  DOM+CSSOM build      │ 50–200ms    │ ~700ms
  Render tree build    │ 10–50ms     │ ~750ms
  Layout calculation   │ 10–100ms    │ ~800ms
  Paint                │ 5–50ms      │ ~850ms
  Composite            │ 1–10ms      │ ~860ms
  ─────────────────────┼─────────────┼────────────
  Total                │             │ ~860ms

Mobile (4G LTE):
  DNS resolution: 50–200ms
  TCP + TLS: 100–300ms
  TTFB: 200–800ms
  Total: 1500–4000ms (2–5x desktop)
```

### 1.3 Browser Multi-Process Architecture and Navigation

```
Navigation via Chrome inter-process communication:

  Browser Process         Renderer Process (old page)    Renderer Process (new page)
  ┌──────────────┐        ┌──────────────────┐           ┌──────────────────┐
  │ UI Thread    │        │                  │           │                  │
  │  ↓           │        │                  │           │                  │
  │ URL parsing  │        │                  │           │                  │
  │  ↓           │        │                  │           │                  │
  │ Network      │        │                  │           │                  │
  │ Thread       │        │                  │           │                  │
  │  ↓           │        │                  │           │                  │
  │ DNS→TCP→TLS  │        │                  │           │                  │
  │  ↓           │        │                  │           │                  │
  │ HTTP send/recv│        │                  │           │                  │
  │  ↓           │        │                  │           │                  │
  │ Response     │─unload→│ beforeunload     │           │                  │
  │ header check │        │ unload           │           │                  │
  │  ↓           │        │ (discard)        │           │                  │
  │ Renderer     │────────────────────────────────────→  │ init             │
  │ select/launch│        │                  │           │  ↓               │
  │  ↓           │        │                  │           │ HTML parse        │
  │ Data transfer│────────────────────────────────────→  │ DOM build        │
  │              │        │                  │           │  ↓               │
  │              │        │                  │           │ Rendering         │
  └──────────────┘        └──────────────────┘           └──────────────────┘

  Navigation process transition:
  1. UI Thread of Browser Process receives URL input
  2. Network Thread handles the network request
  3. Check response Content-Type
     - text/html → launch Renderer Process
     - application/pdf → PDF Viewer
     - application/octet-stream → Download Manager
  4. Send unload event to old Renderer Process
  5. Transfer data to new Renderer Process
  6. New Renderer Process performs HTML parsing and rendering
```

### 1.4 Same-Site and Cross-Site Navigation

```
Same-Site navigation:
  example.com/page1 → example.com/page2
  → Can reuse the same Renderer Process
  → No process startup cost
  → Better memory efficiency

Cross-Site navigation:
  example.com → other-site.com
  → Launch a new Renderer Process
  → Security ensured by Site Isolation
  → Additional 50–150ms for process startup

Back/Forward Cache (bfcache):
  → Keeps entire pages in memory
  → Back/Forward navigation is instant (a few ms)
  → However, disabled under these conditions:
    - unload event listeners present
    - Cache-Control: no-store
    - WebSocket or WebRTC in use
    - HTTP connection (HTTPS only)
```

---

## 2. DNS Resolution in Detail

### 2.1 DNS Resolution Flow

```
DNS lookup hierarchy:

  Browser
  │
  ├── ① Check browser DNS cache (cached for seconds to minutes)
  │     → Chrome: chrome://net-internals/#dns
  │     → Hit → IP address obtained instantly (<1ms)
  │
  ├── ② Check OS DNS cache
  │     → /etc/hosts file is also consulted here
  │     → Windows: ipconfig /displaydns
  │     → macOS: dscacheutil -cachedump
  │     → Hit → IP address obtained (1–5ms)
  │
  ├── ③ Query resolver (ISP/public DNS)
  │     → Google DNS: 8.8.8.8
  │     → Cloudflare DNS: 1.1.1.1
  │     → Resolver cache hit → 10–30ms
  │
  ├── ④ Root DNS server (.)
  │     → "example.com" → "here is the nameserver for .com"
  │     → 13 root systems worldwide (anycast)
  │
  ├── ⑤ TLD nameserver (.com, .jp, etc.)
  │     → "example.com" → "here is the NS server for example.com"
  │
  └── ⑥ Authoritative DNS server (domain owner)
        → "example.com" → "93.184.216.34"
        → Returns with TTL

  Full resolution: 100–200ms
  Cache hit: <5ms
```

### 2.2 DNS over HTTPS (DoH) and DNS over TLS (DoT)

```
Traditional DNS:
  Port 53, plaintext UDP → ISP or attacker can snoop/tamper with DNS queries

DNS over HTTPS (DoH):
  → Encrypts DNS queries over HTTPS (443)
  → Directly supported by browsers
  → Chrome: chrome://settings/security → Secure DNS
  → Firefox: about:preferences#general → DNS over HTTPS

DNS over TLS (DoT):
  → Encrypts DNS queries over TLS (853)
  → Supported at the OS level

Performance impact:
  First time: DoH is slower by one TLS handshake (+50–100ms)
  Subsequent: Equivalent due to HTTP/2 connection reuse

Example (checking DoH settings in Chrome):
```

```javascript
// Measure DNS resolution time
async function measureDNSTime(hostname) {
  const start = performance.now();

  // Use Resource Timing API
  const img = new Image();
  img.src = `https://${hostname}/favicon.ico?t=${Date.now()}`;

  return new Promise((resolve) => {
    img.onload = img.onerror = () => {
      const entries = performance.getEntriesByName(img.src);
      if (entries.length > 0) {
        const entry = entries[0];
        resolve({
          dnsTime: entry.domainLookupEnd - entry.domainLookupStart,
          connectTime: entry.connectEnd - entry.connectStart,
          totalTime: performance.now() - start,
        });
      }
    };
  });
}

// Usage example
measureDNSTime('api.example.com').then(console.log);
// { dnsTime: 23.5, connectTime: 45.2, totalTime: 312.8 }
```

### 2.3 Implementing DNS Prefetch

```html
<!-- DNS prefetch: resolve DNS in advance only -->
<link rel="dns-prefetch" href="//api.example.com">
<link rel="dns-prefetch" href="//cdn.example.com">
<link rel="dns-prefetch" href="//fonts.googleapis.com">

<!-- preconnect: pre-establish DNS + TCP + TLS -->
<link rel="preconnect" href="https://api.example.com">
<link rel="preconnect" href="https://cdn.example.com" crossorigin>

<!--
  When to use dns-prefetch vs preconnect:

  dns-prefetch:
    - Cost: low (DNS resolution only)
    - Use for: external domains you might use
    - Suggested limit: 10–15

  preconnect:
    - Cost: medium (DNS + TCP + TLS)
    - Use for: external domains you will definitely use
    - Suggested limit: 3–5 (maintaining connections has a cost)
    - Connection is dropped if not used within 10 seconds
-->
```

```javascript
// Dynamic DNS prefetch
function prefetchDNS(hostname) {
  const link = document.createElement('link');
  link.rel = 'dns-prefetch';
  link.href = `//${hostname}`;
  document.head.appendChild(link);
}

// Resolve DNS when the user hovers over a link
document.querySelectorAll('a[href^="http"]').forEach((anchor) => {
  anchor.addEventListener(
    'mouseenter',
    () => {
      const url = new URL(anchor.href);
      if (url.hostname !== location.hostname) {
        prefetchDNS(url.hostname);
      }
    },
    { once: true }
  );
});
```

---

## 3. TCP Connection and TLS Handshake

### 3.1 TCP 3-Way Handshake

```
TCP 3-Way Handshake:

  Client                          Server
  │                              │
  │ ── SYN (seq=100) ──────────→│  ① SYN sent
  │                              │     Client requests connection
  │                              │
  │←── SYN+ACK (seq=300,ack=101)│  ② SYN+ACK received
  │                              │     Server responds
  │                              │
  │ ── ACK (ack=301) ──────────→│  ③ ACK sent
  │                              │     Connection established
  │                              │
  │ ── HTTP GET / ─────────────→│  ④ Data transmission possible
  │                              │

  Time required = RTT × 1.5
  (RTT: Round Trip Time)

  Fiber (domestic): RTT 5–20ms → TCP established 7–30ms
  4G LTE:          RTT 30–80ms → TCP established 45–120ms
  Overseas server: RTT 100–300ms → TCP established 150–450ms

TCP Fast Open (TFO):
  → Obtains a cookie on first connection
  → On subsequent connections, HTTP data is included in the SYN
  → Saves 1 RTT
  → Supported on Linux and macOS
```

### 3.2 TLS 1.3 Handshake

```
TLS 1.3 Handshake (1-RTT):

  Client                              Server
  │                                  │
  │ ── ClientHello ────────────────→│
  │    + Supported cipher suites     │
  │    + Key Share (key exchange params)│
  │    + SNI (Server Name Indication)│
  │                                  │
  │←── ServerHello ─────────────────│
  │    + Selected cipher suite       │
  │    + Key Share                   │
  │    + Certificate                 │
  │    + Certificate verification    │
  │    + Finished                    │
  │                                  │
  │ ── Finished ───────────────────→│
  │ ── HTTP Request ────────────────→│  Encrypted communication begins
  │                                  │

  TLS 1.2: 2-RTT (requires extra round trips)
  TLS 1.3: 1-RTT (key exchange included in first message)

  TLS 1.3 0-RTT (reconnection):
  → Uses previous session ticket
  → Includes application data in ClientHello
  → However, risk of replay attacks (GET-only recommended)

Comparison:
  TLS 1.2: TCP(1.5 RTT) + TLS(2 RTT) = 3.5 RTT
  TLS 1.3: TCP(1.5 RTT) + TLS(1 RTT) = 2.5 RTT
  TLS 1.3 0-RTT: TCP(1.5 RTT) + TLS(0 RTT) = 1.5 RTT
```

### 3.3 Connection Optimization with QUIC/HTTP/3

```
HTTP/3 (QUIC) Handshake:

  Legacy (HTTP/2 over TLS 1.3):
    TCP 3-way HS:  1.5 RTT
    TLS 1.3 HS:    1 RTT
    Total:          2.5 RTT

  HTTP/3 (QUIC):
    QUIC HS (integrated encryption): 1 RTT
    Total:                            1 RTT

  HTTP/3 0-RTT (reconnection):
    Total: 0 RTT (data sent in first packet)

  Client                          Server
  │                              │
  │ ── QUIC Initial ───────────→│  Encryption params + HTTP request
  │                              │  (for 0-RTT)
  │                              │
  │←── QUIC Handshake ──────────│  Encryption complete + HTTP response begins
  │                              │
  │ ── QUIC Short Header ──────→│  Subsequent encrypted data communication
  │                              │

Additional QUIC benefits:
  - Head-of-line blocking elimination
    → Packet loss in one stream does not affect others
  - Connection migration
    → Maintains connection when switching from Wi-Fi to 4G
  - Improved congestion control
    → Per-stream control
```

---

## 4. HTTP Request and Response

### 4.1 HTTP Request Structure

```http
GET /index.html HTTP/2
Host: example.com
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: ja,en-US;q=0.7,en;q=0.3
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Cookie: session=abc123; theme=dark
Cache-Control: max-age=0
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: none
Sec-Fetch-User: ?1
Upgrade-Insecure-Requests: 1
```

```
Request header roles:

  Accept-Encoding: gzip, deflate, br
  → Notifies the server of supported compression formats
  → Brotli (br) is 15–25% more efficient than Gzip

  Sec-Fetch-* headers:
  → Automatically added by the browser (cannot be tampered with)
  → Allows the server to determine the origin of the request

  Sec-Fetch-Dest: document    → Page navigation
  Sec-Fetch-Dest: image       → Image request
  Sec-Fetch-Dest: script      → Script request
  Sec-Fetch-Mode: navigate    → User-triggered navigation
  Sec-Fetch-Mode: cors        → CORS request
  Sec-Fetch-Site: same-origin → Same origin
  Sec-Fetch-Site: cross-site  → Cross-site
```

### 4.2 HTTP Response Structure and Caching

```http
HTTP/2 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 45230
Content-Encoding: br
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
ETag: "abc123"
Last-Modified: Mon, 20 Jan 2026 10:00:00 GMT
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

```
Cache control details:

  ┌──────────────────────────────────────────────────────────┐
  │ Cache-Control Directives                                  │
  ├──────────────────┬───────────────────────────────────────┤
  │ public           │ Storable in CDN/shared caches          │
  │ private          │ Browser cache only                     │
  │ no-cache         │ Validate with server every time (cache kept) │
  │ no-store         │ Do not cache at all                    │
  │ max-age=3600     │ Fresh for 3600 seconds                 │
  │ s-maxage=86400   │ Expiration for shared caches           │
  │ stale-while-     │ Serve stale while revalidating in      │
  │  revalidate=86400│  background (up to 86400 seconds)      │
  │ stale-if-error   │ Serve stale cache on error             │
  │ immutable        │ No revalidation even on reload within max-age │
  │ must-revalidate  │ Must revalidate after expiration       │
  └──────────────────┴───────────────────────────────────────┘

  Cache decision flow:

  Request issued
    ↓
  In cache? ─ No → Network request
    │ Yes
    ↓
  Within max-age? ─ Yes → Return from cache (200 from cache)
    │ No
    ↓
  ETag/Last-Modified present? ─ No → Network request
    │ Yes
    ↓
  Send conditional request
  If-None-Match: "abc123"
  If-Modified-Since: Mon, 20 Jan 2026 10:00:00 GMT
    ↓
  Server response
    ├─ 304 Not Modified → Use cache
    └─ 200 OK → Update with new response
```

### 4.3 Compression and Encoding

```javascript
// Server-side compression configuration (Node.js/Express)
const express = require('express');
const compression = require('compression');

const app = express();

// Configure Brotli + Gzip compression
app.use(
  compression({
    // Prefer Brotli
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    // Only compress responses larger than 1KB
    threshold: 1024,
  })
);

// Pre-compress static files (generate .br, .gz at build time)
// Nginx configuration example
/*
  # Prefer pre-compressed Brotli files
  brotli_static on;
  gzip_static on;

  # Dynamic compression (when no pre-compressed file exists)
  brotli on;
  brotli_comp_level 6;
  brotli_types text/html text/css application/javascript application/json;

  gzip on;
  gzip_comp_level 6;
  gzip_types text/html text/css application/javascript application/json;
*/

// Compression efficiency comparison (typical values)
const compressionRatios = {
  'HTML (100KB)': { gzip: '25KB (75%)', brotli: '20KB (80%)' },
  'CSS (50KB)': { gzip: '12KB (76%)', brotli: '9KB (82%)' },
  'JavaScript (200KB)': { gzip: '55KB (72%)', brotli: '45KB (77%)' },
  'JSON API (30KB)': { gzip: '6KB (80%)', brotli: '5KB (83%)' },
};
```

---

## 5. HTML Parsing and Resource Discovery

### 5.1 Parser Behavior Model

```
HTML parser behavior:

  <html>
  <head>
    <link rel="stylesheet" href="style.css">  ← render-blocking
    <script src="app.js"></script>              ← parser-blocking
  </head>
  <body>
    <img src="photo.jpg">                      ← non-blocking
    <script src="analytics.js" defer></script>  ← non-blocking
  </body>
  </html>

Parser blocking:
  Encounters <script> tag → parsing halts → JS downloads → JS executes → parsing resumes
  → Because JS may modify the DOM

Render blocking:
  CSS loading → rendering is deferred until CSSOM is complete
  → Needed for accurate style calculation

Solutions:
  ┌────────────────────┬──────────────────────────────────┐
  │ Attribute          │ Behavior                         │
  ├────────────────────┼──────────────────────────────────┤
  │ <script>           │ Parser-blocking (download+execute)│
  │ <script async>     │ Download in parallel, exec immediately on completion│
  │ <script defer>     │ Download in parallel, exec before DOMContentLoaded│
  │ <script type=module>│ defer equivalent + ESModules    │
  └────────────────────┴──────────────────────────────────┘

  Timeline:
  Parser:          ─────parse─────│halt│─parse─
  <script>:                       │DL→│exec│
  <script async>: │──DL──│exec│  parallel DL with parser
  <script defer>: │──DL──────│    │exec│  before DOMContentLoaded

Preload Scanner:
  → Continues scanning ahead even while the parser is blocked
  → Discovers <link>, <script>, <img> in advance
  → Starts downloading (does not wait for parser to resume)
```

### 5.2 Speculative Parsing in Detail

```
How the Preload Scanner (speculative parser) works:

  Main Parser                      Preload Scanner
  ─────────────────                ─────────────────
  <html> parse starts              │
  <head> parsed                    │
  <link rel="stylesheet"> found    │
   → CSS download starts           │
  <script src="app.js"> found      │
   → Parser blocked!               │
   → Waiting for JS download       │
   │                               │ Scans HTML ahead
   │ (halted)                      │ Finds <img src="hero.jpg">
   │                               │  → Download starts
   │                               │ Finds <script src="util.js">
   │                               │  → Download starts
   │                               │ Finds <link rel="stylesheet" href="page.css">
   │                               │  → Download starts
   │                               │
  app.js execution complete        │
  Parser resumes                   │
  hero.jpg → already downloaded!  │
  util.js → already downloaded!   │
  page.css → already downloaded!  │

  Benefits of Preload Scanner:
  → Without: discovers and downloads resources sequentially
  → With: prefetches and downloads in parallel during blocking
  → Typically 20–50% reduction in loading time

  Note: What the Preload Scanner cannot find:
  - Resources added dynamically by JavaScript
  - Resources referenced via CSS @import
  - CSS background-image
  - Web fonts (defined in CSS via @font-face)
  → These require explicit preload hints
```

### 5.3 Practical Guide: async / defer / module

```html
<!-- ❌ Parser-blocking: placement to avoid -->
<head>
  <script src="analytics.js"></script> <!-- blocks parsing -->
</head>

<!-- ✅ defer: executes in order after DOM is parsed -->
<head>
  <script src="vendor.js" defer></script>   <!-- executes 1st -->
  <script src="app.js" defer></script>      <!-- executes 2nd (order preserved) -->
  <script src="init.js" defer></script>     <!-- executes 3rd -->
</head>

<!-- ✅ async: for independent scripts -->
<head>
  <script src="analytics.js" async></script>  <!-- no dependencies -->
  <script src="ads.js" async></script>        <!-- no dependencies -->
</head>

<!-- ✅ type="module": ESModules (defer equivalent + strict mode) -->
<head>
  <script type="module" src="app.mjs"></script>
</head>

<!-- ✅ dynamic import: load only when needed -->
<script>
  // Load only when the user interacts
  document.getElementById('editor-btn').addEventListener('click', async () => {
    const { Editor } = await import('./editor.mjs');
    const editor = new Editor('#container');
    editor.init();
  });
</script>
```

```javascript
// Code to experiment with defer vs async behavior
// defer-test.js
console.log('defer script executed');
console.log('DOM ready:', document.readyState);
console.log('Body exists:', !!document.body);
// → "defer script executed"
// → "DOM ready: interactive"
// → "Body exists: true"

// async-test.js
console.log('async script executed');
console.log('DOM ready:', document.readyState);
// → "async script executed"
// → "DOM ready: loading" (may be "interactive" depending on when download completes)

// module-test.mjs
console.log('module script executed');
console.log('DOM ready:', document.readyState);
// → "module script executed"
// → "DOM ready: interactive" (same as defer)

// inline module is immediately treated as defer
// <script type="module">
//   console.log('inline module');
//   // → executes before DOMContentLoaded
// </script>
```

### 5.4 CSS Loading Strategy

```html
<!-- Critical CSS: inline to speed up FCP -->
<head>
  <style>
    /* Minimum CSS needed for First Paint (above-the-fold) */
    body { margin: 0; font-family: system-ui; }
    .header { background: #1a1a2e; color: white; padding: 16px; }
    .hero { min-height: 60vh; display: flex; align-items: center; }
    .hero h1 { font-size: 2.5rem; }
  </style>

  <!-- Load remaining CSS asynchronously -->
  <link rel="preload" href="/css/full.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/css/full.css"></noscript>
</head>
```

```javascript
// Automated critical CSS extraction (Node.js build script)
const critical = require('critical');

async function generateCriticalCSS() {
  const result = await critical.generate({
    // Target page HTML file or URL
    src: 'https://example.com',
    // Viewport size
    width: 1300,
    height: 900,
    // Inline it
    inline: true,
    // Output destination
    target: {
      html: 'dist/index.html',
      css: 'dist/critical.css',
      uncritical: 'dist/rest.css',
    },
  });

  console.log('Critical CSS extracted:', result.css.length, 'bytes');
}

// CSS @import delays rendering
// ❌ Bad: chained loading
// style.css → @import "reset.css" → @import "variables.css"
// → Downloaded sequentially

// ✅ Good: parallel loading
// <link rel="stylesheet" href="reset.css">
// <link rel="stylesheet" href="variables.css">
// <link rel="stylesheet" href="style.css">
```

---

## 6. Resource Priorities

### 6.1 Chrome Resource Loading Priority

```
Chrome resource loading priorities:

  ┌─────────────────┬──────────┬────────────────────┐
  │ Resource         │ Priority │ Notes              │
  ├─────────────────┼──────────┼────────────────────┤
  │ HTML            │ Highest  │ Top priority        │
  │ CSS (in head)   │ Highest  │ Render-blocking     │
  │ Font (CSS ref.) │ Highest  │ Required for text   │
  │ Script (in head)│ High     │ Changes with async/defer│
  │ Script (body end)│ Medium  │                    │
  │ Image (in viewport)│ Medium│ High if it's LCP   │
  │ Image (off-screen)│ Low    │ Target for lazy load│
  │ Prefetch        │ Lowest   │ Future navigation   │
  └─────────────────┴──────────┴────────────────────┘

  fetchpriority attribute:
  <img src="hero.jpg" fetchpriority="high">  ← boost priority for LCP image
  <img src="ad.jpg" fetchpriority="low">     ← lower priority for ad images
  <script src="app.js" fetchpriority="high"> ← boost priority for critical JS

  Resource hints:
  <link rel="preload" href="font.woff2" as="font" crossorigin>
  → Start downloading before discovery

  <link rel="preconnect" href="https://api.example.com">
  → Pre-establish DNS + TCP + TLS

  <link rel="prefetch" href="/next-page.html">
  → Prefetch during idle time (for next navigation)

  <link rel="modulepreload" href="/module.js">
  → Prefetch ES modules
```

### 6.2 Practical Use of fetchpriority

```html
<!-- Boost priority for the LCP element -->
<img src="/hero-banner.webp"
     alt="Hero Banner"
     fetchpriority="high"
     width="1200"
     height="600">

<!-- Lazy-load images below the fold -->
<img src="/product-1.webp"
     alt="Product 1"
     loading="lazy"
     fetchpriority="auto"
     width="400"
     height="300">

<!-- High priority only for the first carousel image -->
<div class="carousel">
  <img src="/slide-1.webp" fetchpriority="high">
  <img src="/slide-2.webp" fetchpriority="low" loading="lazy">
  <img src="/slide-3.webp" fetchpriority="low" loading="lazy">
</div>

<!-- Preload fonts -->
<link rel="preload"
      href="/fonts/NotoSansJP-Regular.woff2"
      as="font"
      type="font/woff2"
      crossorigin
      fetchpriority="high">

<!-- Boost priority for critical API requests -->
<script>
  // Use fetchpriority with the Fetch API
  const response = await fetch('/api/critical-data', {
    priority: 'high', // Fetch Priority API
  });

  // Low-priority prefetch
  const prefetchResponse = await fetch('/api/suggestions', {
    priority: 'low',
  });
</script>
```

### 6.3 HTTP/2 Priority and Multiplexing

```
HTTP/1.1 limitations:
  → One request/response per TCP connection
  → Browser allows up to 6 connections per domain
  → 7th and beyond wait in a queue

  Connection 1: ─[HTML]──[CSS]──[JS1]──[img1]──
  Connection 2: ──────[JS2]──[img2]──[img3]──
  Connection 3: ──────[font1]──[img4]──[img5]──
  Connection 4: ──────────[img6]──[img7]──
  Connection 5: ──────────[img8]──[img9]──
  Connection 6: ──────────[img10]──[img11]──
  Waiting:      ──────────────────[img12] [img13]...

HTTP/2 multiplexing:
  → Multiple streams in parallel over one TCP connection
  → One connection per domain handles all resources
  → Priority-based stream control

  Connection 1: ─[HTML]─┬─[CSS]─┬─[JS1]──┬─[JS2]───
                         ├─[font]┤        ├─[img1]──
                         │       │        ├─[img2]──
                         │       │        └─[img3]──

  Priority tree:
    HTML (weight: 256)
    ├── CSS (weight: 256, exclusive)
    ├── JS (weight: 220)
    ├── Font (weight: 256)
    └── Images (weight: 110)

HTTP/3 improvements:
  → Multiplexing at the QUIC stream level
  → Delay in one stream does not affect others
  → Faster recovery from packet loss
```

---

## 7. Page Load Events and Lifecycle

### 7.1 Key Event Timing

```
Key event timing:

  0ms  ─── navigationStart
  │
  50ms ─── DNS resolution complete
  │
  80ms ─── TCP connection complete
  │
  130ms ── TLS complete
  │
  150ms ── Request sent
  │
  250ms ── TTFB (first byte received)
  │         → Indicator of server processing time
  │
  300ms ── FP (First Paint)
  │         → First pixel displayed
  │
  400ms ── FCP (First Contentful Paint)
  │         → First text/image displayed
  │
  800ms ── DOMContentLoaded
  │         → DOM construction complete, defer scripts executed
  │         → jQuery's $(document).ready() fires here
  │
  1500ms ─ LCP (Largest Contentful Paint)
  │         → Largest content element displayed
  │         → Core Web Vitals metric
  │
  2000ms ─ load
  │         → All resources (images, etc.) loaded
  │         → window.onload fires here
  │
  3000ms ─ fully interactive
             → JS execution complete, user can interact

  DOMContentLoaded vs load:
  DOMContentLoaded: HTML parsing complete (images may not be done yet)
  load: Images, CSS, iframes, etc. all complete
```

### 7.2 Core Web Vitals in Detail

```
Core Web Vitals (metrics from 2024 onward):

  ┌────────────────────────────────────────────┐
  │ LCP (Largest Contentful Paint)              │
  │ → Time when the largest element in the viewport is displayed │
  │ → Good: ≤2.5s / Needs improvement: ≤4.0s / Poor: >4.0s │
  │                                            │
  │ Target elements:                            │
  │   - <img>                                   │
  │   - <image> inside <svg>                   │
  │   - Poster image of <video>                │
  │   - Elements with background-image         │
  │   - Block elements containing text nodes   │
  └────────────────────────────────────────────┘

  ┌────────────────────────────────────────────┐
  │ INP (Interaction to Next Paint)             │
  │ → Delay from user interaction to screen update │
  │ → Successor to FID (since March 2024)       │
  │ → Good: ≤200ms / Needs improvement: ≤500ms / Poor: >500ms │
  │                                            │
  │ Measured events:                            │
  │   - click / tap                             │
  │   - keydown / keyup                         │
  │   - mousedown / mouseup                     │
  │                                            │
  │ INP = input delay + processing time + presentation delay │
  │   Input delay: waiting while main thread is busy  │
  │   Processing time: event handler execution time   │
  │   Presentation delay: layout → paint → composite  │
  └────────────────────────────────────────────┘

  ┌────────────────────────────────────────────┐
  │ CLS (Cumulative Layout Shift)               │
  │ → Cumulative unexpected layout shifts       │
  │ → Good: ≤0.1 / Needs improvement: ≤0.25 / Poor: >0.25 │
  │                                            │
  │ Causes of CLS:                              │
  │   - Images/iframes without specified sizes  │
  │   - Dynamically inserted content            │
  │   - Web font loading (FOIT/FOUT)            │
  │   - Adding content via DOM manipulation     │
  └────────────────────────────────────────────┘
```

### 7.3 Implementing Performance Metric Measurement

```javascript
// Measure Core Web Vitals with the web-vitals library
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // "good" | "needs-improvement" | "poor"
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    // For LCP, information about the target element
    ...(metric.entries?.length && {
      element: metric.entries[metric.entries.length - 1]?.element?.tagName,
      url: metric.entries[metric.entries.length - 1]?.url,
    }),
  };

  // Send reliably with the Beacon API (even on page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/analytics', JSON.stringify(body));
  } else {
    fetch('/analytics', {
      method: 'POST',
      body: JSON.stringify(body),
      keepalive: true,
    });
  }
}

// Measure and send each metric
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);

// Detailed measurement using PerformanceObserver
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.setupObservers();
  }

  setupObservers() {
    // LCP
    this.observe('largest-contentful-paint', (entries) => {
      const last = entries[entries.length - 1];
      this.metrics.lcp = {
        value: last.startTime,
        element: last.element?.tagName,
        size: last.size,
        url: last.url,
      };
      console.log(`LCP: ${last.startTime.toFixed(0)}ms`, last.element);
    });

    // CLS
    let clsValue = 0;
    this.observe('layout-shift', (entries) => {
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          this.metrics.cls = { value: clsValue };
          console.log(
            `Layout shift: ${entry.value.toFixed(4)}`,
            `Total CLS: ${clsValue.toFixed(4)}`,
            entry.sources?.map((s) => s.node?.tagName)
          );
        }
      });
    });

    // Long Tasks (useful for investigating INP causes)
    this.observe('longtask', (entries) => {
      entries.forEach((entry) => {
        console.warn(
          `Long task: ${entry.duration.toFixed(0)}ms`,
          entry.attribution?.[0]?.containerType,
          entry.attribution?.[0]?.containerName
        );
      });
    });

    // Resource Timing (loading time per resource)
    this.observe('resource', (entries) => {
      entries.forEach((entry) => {
        if (entry.duration > 500) {
          console.warn(`Slow resource: ${entry.name}`, {
            duration: `${entry.duration.toFixed(0)}ms`,
            size: `${(entry.transferSize / 1024).toFixed(1)}KB`,
            type: entry.initiatorType,
          });
        }
      });
    });
  }

  observe(type, callback) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
    } catch (e) {
      console.warn(`PerformanceObserver for ${type} not supported`);
    }
  }

  getReport() {
    return {
      ...this.metrics,
      navigation: this.getNavigationTiming(),
      resources: this.getResourceSummary(),
    };
  }

  getNavigationTiming() {
    const entry = performance.getEntriesByType('navigation')[0];
    if (!entry) return null;

    return {
      dns: Math.round(entry.domainLookupEnd - entry.domainLookupStart),
      tcp: Math.round(entry.connectEnd - entry.connectStart),
      tls:
        entry.secureConnectionStart > 0
          ? Math.round(entry.connectEnd - entry.secureConnectionStart)
          : 0,
      ttfb: Math.round(entry.responseStart - entry.requestStart),
      download: Math.round(entry.responseEnd - entry.responseStart),
      domProcessing: Math.round(
        entry.domContentLoadedEventEnd - entry.responseEnd
      ),
      domContentLoaded: Math.round(entry.domContentLoadedEventEnd),
      load: Math.round(entry.loadEventEnd),
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    };
  }

  getResourceSummary() {
    const resources = performance.getEntriesByType('resource');
    const summary = {};

    resources.forEach((r) => {
      const type = r.initiatorType || 'other';
      if (!summary[type]) {
        summary[type] = { count: 0, totalSize: 0, totalDuration: 0 };
      }
      summary[type].count++;
      summary[type].totalSize += r.transferSize || 0;
      summary[type].totalDuration += r.duration;
    });

    return summary;
  }
}

// Usage example
const monitor = new PerformanceMonitor();
window.addEventListener('load', () => {
  // Get report after full page load
  setTimeout(() => {
    console.table(monitor.getReport().navigation);
    console.table(monitor.getReport().resources);
  }, 3000);
});
```

---

## 8. Navigation Timing API

### 8.1 Basic Measurement

```javascript
// Measure each phase of page loading
const entry = performance.getEntriesByType('navigation')[0];

console.log({
  // DNS
  dns: entry.domainLookupEnd - entry.domainLookupStart,

  // TCP connection
  tcp: entry.connectEnd - entry.connectStart,

  // TLS
  tls:
    entry.secureConnectionStart > 0
      ? entry.connectEnd - entry.secureConnectionStart
      : 0,

  // TTFB
  ttfb: entry.responseStart - entry.requestStart,

  // Content transfer
  download: entry.responseEnd - entry.responseStart,

  // DOM processing
  domProcessing: entry.domContentLoadedEventEnd - entry.responseEnd,

  // Total
  total: entry.loadEventEnd - entry.startTime,
});

// Measure Web Vitals
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`LCP: ${entry.startTime}ms`);
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

### 8.2 All Properties of Navigation Timing Level 2

```javascript
// Navigation Timing Level 2 timeline
const nav = performance.getEntriesByType('navigation')[0];

/*
  Timeline:

  startTime (0)
  │
  ├─ redirectStart ──── redirectEnd
  │   (if there are redirects)
  │
  ├─ fetchStart
  │   (request starts)
  │
  ├─ domainLookupStart ──── domainLookupEnd
  │   (DNS resolution)
  │
  ├─ connectStart ──── secureConnectionStart ──── connectEnd
  │   (TCP connection)  (TLS starts)               (TLS complete)
  │
  ├─ requestStart
  │   (request sent)
  │
  ├─ responseStart ──── responseEnd
  │   (TTFB)            (response fully received)
  │
  ├─ domInteractive
  │   (HTML parse complete, DOM is manipulable)
  │
  ├─ domContentLoadedEventStart ──── domContentLoadedEventEnd
  │   (DOMContentLoaded event)
  │
  └─ loadEventStart ──── loadEventEnd
      (load event)
*/

// Diagnostic report for production use
function generateLoadReport() {
  const nav = performance.getEntriesByType('navigation')[0];
  if (!nav) return null;

  const report = {
    // === Network layer ===
    redirect:
      nav.redirectEnd > 0
        ? `${(nav.redirectEnd - nav.redirectStart).toFixed(0)}ms (${nav.redirectCount} redirects)`
        : 'none',
    dns: `${(nav.domainLookupEnd - nav.domainLookupStart).toFixed(0)}ms`,
    tcp: `${(nav.connectEnd - nav.connectStart).toFixed(0)}ms`,
    tls:
      nav.secureConnectionStart > 0
        ? `${(nav.connectEnd - nav.secureConnectionStart).toFixed(0)}ms`
        : 'N/A',

    // === Server layer ===
    ttfb: `${(nav.responseStart - nav.requestStart).toFixed(0)}ms`,
    serverTime: `${(nav.responseStart - nav.connectEnd).toFixed(0)}ms`,

    // === Content transfer ===
    download: `${(nav.responseEnd - nav.responseStart).toFixed(0)}ms`,
    transferSize: `${(nav.transferSize / 1024).toFixed(1)}KB`,
    compressionRatio:
      nav.decodedBodySize > 0
        ? `${((1 - nav.encodedBodySize / nav.decodedBodySize) * 100).toFixed(0)}%`
        : 'N/A',

    // === Client layer ===
    domParsing: `${(nav.domInteractive - nav.responseEnd).toFixed(0)}ms`,
    domContentLoaded: `${nav.domContentLoadedEventEnd.toFixed(0)}ms`,
    load: `${nav.loadEventEnd.toFixed(0)}ms`,

    // === Protocol info ===
    protocol: nav.nextHopProtocol, // "h2", "h3", "http/1.1"
    type: nav.type, // "navigate", "reload", "back_forward", "prerender"
  };

  return report;
}

// Display as a table in the console
console.table(generateLoadReport());
```

### 8.3 Using the Resource Timing API

```javascript
// Analyze loading time of all resources
function analyzeResources() {
  const resources = performance.getEntriesByType('resource');

  // Classify by resource type
  const byType = {};
  resources.forEach((r) => {
    const type = r.initiatorType;
    if (!byType[type]) byType[type] = [];
    byType[type].push({
      name: r.name.split('/').pop().split('?')[0], // filename only
      duration: Math.round(r.duration),
      size: Math.round(r.transferSize / 1024), // KB
      protocol: r.nextHopProtocol,
      cached: r.transferSize === 0 && r.decodedBodySize > 0,
    });
  });

  // Identify slow resources
  const slowResources = resources
    .filter((r) => r.duration > 200)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10)
    .map((r) => ({
      name: r.name,
      duration: `${Math.round(r.duration)}ms`,
      size: `${Math.round(r.transferSize / 1024)}KB`,
      type: r.initiatorType,
    }));

  console.log('=== Resource Summary ===');
  Object.entries(byType).forEach(([type, items]) => {
    const totalSize = items.reduce((sum, r) => sum + r.size, 0);
    const avgDuration =
      items.reduce((sum, r) => sum + r.duration, 0) / items.length;
    const cachedCount = items.filter((r) => r.cached).length;

    console.log(
      `${type}: ${items.length} files, ${totalSize}KB total, ` +
        `avg ${Math.round(avgDuration)}ms, ${cachedCount} cached`
    );
  });

  console.log('\n=== Slowest Resources ===');
  console.table(slowResources);

  return { byType, slowResources };
}

// Using the Server Timing API
// Configure on server side:
// Server-Timing: db;dur=42, cache;desc="Cache Read";dur=5, app;dur=123

const nav = performance.getEntriesByType('navigation')[0];
if (nav.serverTiming) {
  nav.serverTiming.forEach((timing) => {
    console.log(`${timing.name}: ${timing.duration}ms (${timing.description})`);
  });
  // db: 42ms ()
  // cache: 5ms (Cache Read)
  // app: 123ms ()
}
```

---

## 9. Service Workers and Navigation

### 9.1 Service Worker Lifecycle

```
Service Worker lifecycle:

  ┌─────────────────────────────────────────────┐
  │ 1. Registration                              │
  │    navigator.serviceWorker.register('/sw.js')│
  │                                             │
  │ 2. Installation                              │
  │    → install event fires                     │
  │    → Pre-cache assets                        │
  │                                             │
  │ 3. Activation                                │
  │    → activate event fires                    │
  │    → Delete old caches                       │
  │                                             │
  │ 4. Controlling                               │
  │    → Intercepts requests via fetch event     │
  │    → Can also control navigation requests    │
  └─────────────────────────────────────────────┘

  Navigation control by Service Worker:

  Browser             Service Worker          Network
  │                   │                       │
  │ ── navigation ──→│                       │
  │                   │ fetch event fires      │
  │                   │                       │
  │                   │ Check cache            │
  │                   ├─ hit → return response │
  │                   │                       │
  │                   ├─ miss ────────────────→│ network
  │                   │                       │ request
  │                   │←────── response ──────│
  │←── response ──────│                       │
  │                   │                       │
```

### 9.2 Implementing Cache Strategies

```javascript
// sw.js - Service Worker
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/fonts/NotoSansJP-Regular.woff2',
  '/images/logo.svg',
];

// Cache on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Delete old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Cache strategy on fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigation requests: Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets: Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // API requests: Stale While Revalidate
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidateStrategy(request));
    return;
  }

  // Everything else: Network Only
  event.respondWith(fetch(request));
});

// Cache First: prefer cache, fall back to network
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

// Network First: prefer network, fall back to cache on failure
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request, { timeout: 3000 });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Offline fallback
    return caches.match('/offline.html');
  }
}

// Stale While Revalidate: return cache while updating in background
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

function isStaticAsset(url) {
  return /\.(css|js|woff2?|png|jpg|webp|svg|ico)$/.test(url.pathname);
}
```

### 9.3 Navigation Preload

```javascript
// Navigation Preload: start network request while waiting for SW to start
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Enable Navigation Preload
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Use the Navigation Preload response
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          // Fallback: regular network request
          return await fetch(event.request);
        } catch (error) {
          // Return cache when offline
          const cached = await caches.match(event.request);
          return cached || caches.match('/offline.html');
        }
      })()
    );
  }
});

/*
  Benefits of Navigation Preload:

  Without Navigation Preload:
    SW startup (50ms) → fetch event → network request (200ms)
    Total: 250ms

  With Navigation Preload:
    SW startup (50ms)
    Network request (200ms)  ← starts in parallel
    Total: 200ms (parallel with SW startup)

  → 50–100ms improvement
*/
```

---

## 10. SPA Navigation

### 10.1 Client-Side Navigation

```javascript
// SPA navigation using the History API
class SPARouter {
  constructor() {
    this.routes = new Map();
    this.currentPath = null;

    // Browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      this.navigate(location.pathname, false);
    });

    // Intercept link clicks
    document.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;

      const url = new URL(anchor.href);
      if (url.origin !== location.origin) return; // pass through external links

      event.preventDefault();
      this.navigate(url.pathname);
    });
  }

  route(path, handler) {
    this.routes.set(path, handler);
    return this;
  }

  async navigate(path, pushState = true) {
    if (path === this.currentPath) return;

    // Performance mark
    performance.mark('navigation-start');

    const handler = this.matchRoute(path);
    if (!handler) {
      console.warn(`No route for: ${path}`);
      return;
    }

    // Add to history
    if (pushState) {
      history.pushState({ path }, '', path);
    }

    this.currentPath = path;

    // Page transition animation
    const container = document.getElementById('app');
    container.classList.add('page-transitioning');

    try {
      const content = await handler(path);
      container.innerHTML = content;
    } finally {
      container.classList.remove('page-transitioning');
    }

    // Performance measurement
    performance.mark('navigation-end');
    performance.measure('spa-navigation', 'navigation-start', 'navigation-end');

    const measure = performance.getEntriesByName('spa-navigation').pop();
    console.log(`SPA Navigation: ${measure.duration.toFixed(0)}ms`);

    // Reset scroll position
    window.scrollTo(0, 0);

    // Send to analytics
    this.trackPageView(path);
  }

  matchRoute(path) {
    // Exact match
    if (this.routes.has(path)) return this.routes.get(path);

    // Routes with parameters
    for (const [pattern, handler] of this.routes) {
      const regex = new RegExp(
        '^' + pattern.replace(/:([^/]+)/g, '(?<$1>[^/]+)') + '$'
      );
      const match = path.match(regex);
      if (match) {
        return (p) => handler(p, match.groups);
      }
    }

    return null;
  }

  trackPageView(path) {
    // Soft Navigation API (Chrome experimental feature)
    if (window.PerformanceObserver) {
      try {
        new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            console.log('Soft navigation:', entry);
          });
        }).observe({ type: 'soft-navigation', buffered: true });
      } catch (e) {
        // Not supported
      }
    }
  }
}

// Usage example
const router = new SPARouter();
router
  .route('/', async () => {
    const data = await fetch('/api/home').then((r) => r.json());
    return renderHome(data);
  })
  .route('/products/:id', async (path, params) => {
    const data = await fetch(`/api/products/${params.id}`).then((r) =>
      r.json()
    );
    return renderProduct(data);
  });
```

### 10.2 View Transitions API

```javascript
// View Transitions API (Chrome 111+)
// Smooth animation during SPA navigation

async function navigateWithTransition(url) {
  // Fallback for browsers that don't support View Transitions
  if (!document.startViewTransition) {
    await updateDOM(url);
    return;
  }

  // Start View Transition
  const transition = document.startViewTransition(async () => {
    await updateDOM(url);
  });

  // Wait for transition to complete
  await transition.finished;
}

async function updateDOM(url) {
  const response = await fetch(url);
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Replace main content
  document.querySelector('main').innerHTML =
    doc.querySelector('main').innerHTML;

  // Update title
  document.title = doc.title;
}
```

```css
/* Custom animations for View Transitions */

/* Default fade-in/fade-out */
::view-transition-old(root) {
  animation: fade-out 0.3s ease-out;
}

::view-transition-new(root) {
  animation: fade-in 0.3s ease-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Assign custom transition names to specific elements */
.hero-image {
  view-transition-name: hero;
}

.page-title {
  view-transition-name: title;
}

/* Per-element animations */
::view-transition-old(hero) {
  animation: slide-out-left 0.4s ease-in;
}

::view-transition-new(hero) {
  animation: slide-in-right 0.4s ease-out;
}

@keyframes slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100%); opacity: 0; }
}

@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

### 10.3 Speculation Rules API (Prerendering)

```html
<!-- Speculation Rules API: pre-render the next navigation -->
<script type="speculationrules">
{
  "prerender": [
    {
      "where": {
        "and": [
          { "href_matches": "/*" },
          { "not": { "href_matches": "/logout" } },
          { "not": { "href_matches": "/api/*" } },
          { "not": { "selector_matches": ".no-prerender" } }
        ]
      },
      "eagerness": "moderate"
    }
  ],
  "prefetch": [
    {
      "urls": ["/products", "/about"],
      "eagerness": "eager"
    }
  ]
}
</script>

<!--
  eagerness types:
  - "eager": execute immediately
  - "moderate": execute on hover (200ms intent signal)
  - "conservative": execute on click/tap

  prefetch vs prerender:
  - prefetch: fetch HTML only (saves bandwidth)
  - prerender: render entire page in background (instant display)

  Limitations:
  - prerender is same-origin only
  - maximum 10 prerenders per page
  - be mindful of memory usage
-->
```

```javascript
// Add Speculation Rules dynamically
function addSpeculationRules(urls) {
  // Remove existing rules
  document
    .querySelectorAll('script[type="speculationrules"]')
    .forEach((el) => el.remove());

  const rules = {
    prerender: [
      {
        urls: urls,
        eagerness: 'moderate',
      },
    ],
  };

  const script = document.createElement('script');
  script.type = 'speculationrules';
  script.textContent = JSON.stringify(rules);
  document.head.appendChild(script);
}

// Decide prerender targets based on user behavior
function predictNextNavigation() {
  // Identify the most likely links
  const links = Array.from(document.querySelectorAll('a[href^="/"]'));
  const visibleLinks = links.filter((link) => {
    const rect = link.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.top <= window.innerHeight &&
      rect.width > 0 &&
      rect.height > 0
    );
  });

  // Make links in the viewport prerender candidates
  const urls = visibleLinks.slice(0, 3).map((link) => link.href);
  addSpeculationRules(urls);
}

// Monitor in-viewport links with Intersection Observer
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const href = entry.target.getAttribute('href');
        if (href) addSpeculationRules([href]);
      }
    });
  },
  { rootMargin: '200px' }
);

document.querySelectorAll('a[href^="/"]').forEach((link) => {
  observer.observe(link);
});
```

---

## 11. Performance Optimization in Practice

### 11.1 Optimizing the Critical Rendering Path

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- 1. Pre-establish DNS/connections -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>
  <link rel="dns-prefetch" href="//analytics.example.com">

  <!-- 2. Critical CSS (inlined) -->
  <style>
    /* Minimum CSS needed for above-the-fold */
    :root { --primary: #1a1a2e; --text: #333; }
    body { margin: 0; font-family: system-ui, sans-serif; color: var(--text); }
    .header { background: var(--primary); color: white; padding: 1rem; }
    .hero { min-height: 50vh; display: grid; place-items: center; }
  </style>

  <!-- 3. Preload important fonts -->
  <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

  <!-- 4. Non-critical CSS (async loading) -->
  <link rel="preload" href="/css/app.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/css/app.css"></noscript>

  <!-- 5. JavaScript with defer -->
  <script src="/js/vendor.js" defer></script>
  <script src="/js/app.js" defer></script>

  <!-- 6. Independent analytics with async -->
  <script src="/js/analytics.js" async></script>
</head>
<body>
  <header class="header">
    <nav>...</nav>
  </header>

  <main class="hero">
    <!-- 7. LCP candidate image with high priority -->
    <img src="/images/hero.webp"
         alt="Hero Image"
         fetchpriority="high"
         width="1200"
         height="600"
         decoding="async">
  </main>

  <section class="products">
    <!-- 8. Below-fold images with lazy loading -->
    <img src="/images/product-1.webp"
         alt="Product 1"
         loading="lazy"
         width="400"
         height="300"
         decoding="async">
  </section>

  <!-- 9. Speculation Rules -->
  <script type="speculationrules">
  {
    "prefetch": [
      { "where": { "href_matches": "/products/*" }, "eagerness": "moderate" }
    ]
  }
  </script>
</body>
</html>
```

### 11.2 Loading Performance Checklist

```
Performance optimization checklist:

  ■ Network layer
  □ Use HTTP/2 or HTTP/3
  □ Use a CDN (serve from geographically close servers)
  □ Enable Brotli compression
  □ Use preconnect for critical domains
  □ Use dns-prefetch for external domains
  □ Remove unnecessary redirects

  ■ Cache layer
  □ Long max-age + immutable for static assets
  □ stale-while-revalidate for HTML
  □ Offline support with Service Worker
  □ Conditional requests with ETag/Last-Modified
  □ Monitor CDN cache hit rate

  ■ Resource layer
  □ Inline critical CSS
  □ Load non-critical CSS asynchronously
  □ Apply defer/async to JavaScript
  □ fetchpriority="high" for LCP images
  □ loading="lazy" for below-fold images
  □ Remove unused JavaScript (tree shaking)
  □ Code splitting (dynamic import)

  ■ Image/media layer
  □ Use WebP/AVIF format
  □ Serve appropriately sized images (srcset)
  □ Prevent CLS with width/height attributes
  □ Auto-optimize with image CDN

  ■ Font layer
  □ Use WOFF2 format
  □ Set font-display: swap/optional
  □ Preload fonts
  □ Font subsetting (especially important for CJK)

  ■ JavaScript execution layer
  □ Split Long Tasks (under 50ms)
  □ Defer non-critical work with requestIdleCallback
  □ Free main thread with Web Worker
  □ Measure impact of third-party scripts
```

### 11.3 Waterfall Analysis in Practice

```javascript
// Implement analysis equivalent to Chrome DevTools Network tab in code
class WaterfallAnalyzer {
  analyze() {
    const resources = performance.getEntriesByType('resource');
    const nav = performance.getEntriesByType('navigation')[0];

    // Generate waterfall data
    const waterfall = resources.map((r) => ({
      name: this.getShortName(r.name),
      type: r.initiatorType,
      start: Math.round(r.startTime),
      end: Math.round(r.startTime + r.duration),
      duration: Math.round(r.duration),
      size: Math.round(r.transferSize / 1024),
      protocol: r.nextHopProtocol,

      // Breakdown by phase
      phases: {
        blocked: Math.round(r.fetchStart - r.startTime),
        dns: Math.round(r.domainLookupEnd - r.domainLookupStart),
        connect: Math.round(r.connectEnd - r.connectStart),
        tls:
          r.secureConnectionStart > 0
            ? Math.round(r.connectEnd - r.secureConnectionStart)
            : 0,
        waiting: Math.round(r.responseStart - r.requestStart),
        download: Math.round(r.responseEnd - r.responseStart),
      },
    }));

    // Identify bottlenecks
    const bottlenecks = this.findBottlenecks(waterfall);

    return { waterfall, bottlenecks };
  }

  findBottlenecks(waterfall) {
    const issues = [];

    waterfall.forEach((r) => {
      // Slow DNS resolution
      if (r.phases.dns > 50) {
        issues.push({
          resource: r.name,
          issue: `DNS resolution slow: ${r.phases.dns}ms`,
          recommendation: 'Add <link rel="dns-prefetch"> or <link rel="preconnect">',
        });
      }

      // Slow TTFB
      if (r.phases.waiting > 200) {
        issues.push({
          resource: r.name,
          issue: `TTFB slow: ${r.phases.waiting}ms`,
          recommendation: 'Check server response time, consider CDN or caching',
        });
      }

      // Slow download (large file)
      if (r.phases.download > 500) {
        issues.push({
          resource: r.name,
          issue: `Download slow: ${r.phases.download}ms (${r.size}KB)`,
          recommendation: 'Enable compression, reduce file size, or use CDN',
        });
      }

      // Long blocking time (HTTP/1.1 concurrent connection limit)
      if (r.phases.blocked > 100) {
        issues.push({
          resource: r.name,
          issue: `Blocked: ${r.phases.blocked}ms`,
          recommendation: 'Upgrade to HTTP/2, reduce number of requests',
        });
      }
    });

    return issues;
  }

  getShortName(url) {
    try {
      const u = new URL(url);
      return u.pathname.split('/').pop() || u.pathname;
    } catch {
      return url;
    }
  }

  // Text-based waterfall display
  printWaterfall() {
    const { waterfall, bottlenecks } = this.analyze();
    const maxEnd = Math.max(...waterfall.map((r) => r.end));
    const width = 60;

    console.log('=== Waterfall ===');
    console.log(`${'Resource'.padEnd(25)} ${'Timeline'.padEnd(width)} Duration`);

    waterfall.forEach((r) => {
      const startPos = Math.round((r.start / maxEnd) * width);
      const endPos = Math.round((r.end / maxEnd) * width);
      const barLen = Math.max(1, endPos - startPos);

      const bar =
        ' '.repeat(startPos) +
        '\u2588'.repeat(barLen) +
        ' '.repeat(width - startPos - barLen);

      console.log(
        `${r.name.substring(0, 24).padEnd(25)} ${bar} ${r.duration}ms`
      );
    });

    if (bottlenecks.length > 0) {
      console.log('\n=== Bottlenecks ===');
      bottlenecks.forEach((b) => {
        console.log(`${b.resource}: ${b.issue}`);
        console.log(`  → ${b.recommendation}`);
      });
    }
  }
}

// Usage example
window.addEventListener('load', () => {
  setTimeout(() => {
    const analyzer = new WaterfallAnalyzer();
    analyzer.printWaterfall();
  }, 1000);
});
```

---

## 12. Troubleshooting in Production

### 12.1 Common Loading Problems and Solutions

```
Problem 1: TTFB is slow (>600ms)
─────────────────────────────────
Causes:
  - Long server processing time (DB queries, API calls)
  - Geographically distant server
  - SSL certificate validation takes time

Solutions:
  - Introduce CDN (edge caching)
  - Server-side caching (Redis, Memcached)
  - Optimize database queries
  - HTTP/2 Server Push (or Early Hints 103)

Problem 2: LCP is slow (>2.5s)
────────────────────────────────
Causes:
  - LCP element (image/text) discovered late
  - CSS blocking rendering
  - Waiting for web font loading
  - JavaScript blocking rendering

Solutions:
  - preload + fetchpriority="high" for LCP image
  - Inline critical CSS
  - font-display: optional/swap
  - Include content in HTML via SSR/SSG

Problem 3: CLS is high (>0.1)
───────────────────────────────
Causes:
  - Images/iframes without width/height
  - Dynamically inserted ads/banners
  - Web font FOUT (Flash of Unstyled Text)
  - Components loaded asynchronously

Solutions:
  - Specify aspect-ratio or width/height for all media
  - Reserve placeholder for ad slots
  - font-display: optional
  - Fix content insertion position (min-height)

Problem 4: JavaScript loading is slow
──────────────────────────────────────
Causes:
  - Large bundle size (>200KB gzipped)
  - Loading unused code shared across all pages
  - Too many third-party scripts

Solutions:
  - Code splitting (route-based)
  - Remove unused code with tree shaking
  - Lazy loading with dynamic import
  - Audit and remove third-party scripts
```

### 12.2 Performance Auditing with Lighthouse

```javascript
// Running Lighthouse CLI (Node.js)
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

  const result = await lighthouse(url, {
    port: chrome.port,
    output: 'json',
    onlyCategories: ['performance'],
    settings: {
      // Mobile simulation
      formFactor: 'mobile',
      throttling: {
        rttMs: 150, // RTT
        throughputKbps: 1638.4, // 1.6 Mbps
        cpuSlowdownMultiplier: 4, // CPU 4x slowdown
      },
      screenEmulation: {
        mobile: true,
        width: 412,
        height: 823,
        deviceScaleFactor: 1.75,
      },
    },
  });

  const report = JSON.parse(result.report);
  const audits = report.audits;

  console.log('=== Performance Score ===');
  console.log(`Score: ${report.categories.performance.score * 100}`);

  console.log('\n=== Core Web Vitals ===');
  console.log(`FCP: ${audits['first-contentful-paint'].displayValue}`);
  console.log(`LCP: ${audits['largest-contentful-paint'].displayValue}`);
  console.log(`TBT: ${audits['total-blocking-time'].displayValue}`);
  console.log(`CLS: ${audits['cumulative-layout-shift'].displayValue}`);
  console.log(`SI:  ${audits['speed-index'].displayValue}`);

  console.log('\n=== Opportunities ===');
  const opportunities = Object.values(audits).filter(
    (a) => a.details?.type === 'opportunity' && a.details?.overallSavingsMs > 0
  );

  opportunities
    .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs)
    .forEach((opp) => {
      console.log(
        `${opp.title}: ~${Math.round(opp.details.overallSavingsMs)}ms savings`
      );
    });

  await chrome.kill();
  return report;
}

// Usage example
runLighthouse('https://example.com');
```

### 12.3 Implementing Real User Monitoring (RUM)

```javascript
// RUM data collection for production
class RUMCollector {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.data = {
      url: location.href,
      userAgent: navigator.userAgent,
      connection: this.getConnectionInfo(),
      timestamp: Date.now(),
      metrics: {},
    };
  }

  getConnectionInfo() {
    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (!conn) return null;

    return {
      effectiveType: conn.effectiveType, // "4g", "3g", "2g", "slow-2g"
      downlink: conn.downlink, // Mbps
      rtt: conn.rtt, // ms
      saveData: conn.saveData, // boolean
    };
  }

  collectNavigationTiming() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return;

    this.data.metrics.navigation = {
      type: nav.type,
      protocol: nav.nextHopProtocol,
      redirectCount: nav.redirectCount,
      dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
      tcp: Math.round(nav.connectEnd - nav.connectStart),
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      download: Math.round(nav.responseEnd - nav.responseStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      transferSize: nav.transferSize,
    };
  }

  collectWebVitals() {
    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.data.metrics.lcp = {
        value: Math.round(lastEntry.startTime),
        element: lastEntry.element?.tagName,
        url: lastEntry.url,
      };
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS
    let clsValue = 0;
    let clsEntries = [];
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push({
            value: entry.value,
            sources: entry.sources?.map((s) => ({
              node: s.node?.tagName,
              previousRect: s.previousRect,
              currentRect: s.currentRect,
            })),
          });
        }
      });
      this.data.metrics.cls = { value: clsValue, entries: clsEntries };
    }).observe({ type: 'layout-shift', buffered: true });

    // INP
    let maxINP = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > maxINP) {
          maxINP = entry.duration;
          this.data.metrics.inp = {
            value: entry.duration,
            type: entry.name,
            target: entry.target?.tagName,
          };
        }
      });
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  }

  send() {
    this.collectNavigationTiming();

    // Send on page unload
    const sendData = () => {
      const blob = new Blob([JSON.stringify(this.data)], {
        type: 'application/json',
      });
      navigator.sendBeacon(this.endpoint, blob);
    };

    // Prefer visibilitychange (pagehide as fallback)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sendData();
      }
    });

    // Support for iOS Safari
    window.addEventListener('pagehide', sendData);
  }
}

// Usage example
const rum = new RUMCollector('/api/rum');
rum.collectWebVitals();
rum.send();
```

---

## 13. Comparing Early Hints (103) and Server Push

### 13.1 HTTP 103 Early Hints

```
How 103 Early Hints works:

  Client                          Server
  │                              │
  │ ── GET /index.html ────────→│
  │                              │ Server processing begins
  │                              │ (e.g., DB queries take 300ms)
  │                              │
  │←── 103 Early Hints ─────────│  ← Sent ahead while server is still processing!
  │    Link: </style.css>; rel=preload; as=style
  │    Link: </app.js>; rel=preload; as=script
  │    Link: <https://cdn.example.com>; rel=preconnect
  │                              │
  │  CSS/JS download starts      │ Server still processing...
  │  ↓↓↓ parallel downloads ↓↓↓ │
  │                              │ Server processing complete
  │←── 200 OK ──────────────────│
  │    <html>...                 │
  │                              │
  │  CSS/JS → already downloaded!

  Benefits:
  → Effectively uses server processing wait time
  → Especially effective when TTFB is long
  → Expected improvement of 100–300ms

  Configuration example (Nginx):
```

```nginx
# 103 Early Hints in Nginx
location / {
    # Return 103 Early Hints
    add_header Link "</css/app.css>; rel=preload; as=style" early;
    add_header Link "</js/app.js>; rel=preload; as=script" early;
    add_header Link "<https://fonts.googleapis.com>; rel=preconnect" early;

    # Proxy to backend
    proxy_pass http://backend;
}
```

```javascript
// 103 Early Hints in Node.js (Express)
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  // Send 103 Early Hints ahead of time
  res.writeEarlyHints({
    link: [
      '</css/app.css>; rel=preload; as=style',
      '</js/app.js>; rel=preload; as=script',
      '<https://cdn.example.com>; rel=preconnect',
    ],
  });

  // Normal response processing (DB queries, etc.)
  const data = await fetchDataFromDB();

  res.render('index', { data });
});
```

---

## 14. Image Optimization and Loading Strategies

### 14.1 Responsive Image Delivery

```html
<!-- Optimal image delivery with srcset + sizes -->
<img
  src="/images/hero-800.webp"
  srcset="
    /images/hero-400.webp 400w,
    /images/hero-800.webp 800w,
    /images/hero-1200.webp 1200w,
    /images/hero-1600.webp 1600w
  "
  sizes="(max-width: 600px) 100vw,
         (max-width: 1200px) 50vw,
         800px"
  alt="Hero Image"
  width="1200"
  height="600"
  fetchpriority="high"
  decoding="async"
>

<!-- Format switching with picture element -->
<picture>
  <!-- AVIF (most efficient, limited browser support) -->
  <source
    type="image/avif"
    srcset="/images/hero-400.avif 400w,
           /images/hero-800.avif 800w,
           /images/hero-1200.avif 1200w"
    sizes="(max-width: 600px) 100vw, 800px"
  >
  <!-- WebP (widely supported) -->
  <source
    type="image/webp"
    srcset="/images/hero-400.webp 400w,
           /images/hero-800.webp 800w,
           /images/hero-1200.webp 1200w"
    sizes="(max-width: 600px) 100vw, 800px"
  >
  <!-- Fallback (JPEG) -->
  <img
    src="/images/hero-800.jpg"
    alt="Hero Image"
    width="1200"
    height="600"
    loading="eager"
    decoding="async"
  >
</picture>
```

### 14.2 Image Lazy Loading Patterns

```javascript
// Hybrid strategy: native lazy loading + Intersection Observer
class ImageLazyLoader {
  constructor(options = {}) {
    this.rootMargin = options.rootMargin || '200px 0px';
    this.threshold = options.threshold || 0.01;
    this.loaded = new Set();

    // Check for native lazy loading support
    this.supportsNativeLazy = 'loading' in HTMLImageElement.prototype;

    if (!this.supportsNativeLazy) {
      this.setupIntersectionObserver();
    }
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: this.rootMargin,
        threshold: this.threshold,
      }
    );

    // Observe images with a data-src attribute
    document.querySelectorAll('img[data-src]').forEach((img) => {
      this.observer.observe(img);
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }

    if (srcset) {
      img.srcset = srcset;
      img.removeAttribute('data-srcset');
    }

    img.classList.add('loaded');
    this.loaded.add(src);
  }
}

// Usage example
const lazyLoader = new ImageLazyLoader({ rootMargin: '300px 0px' });
```

---

## 15. Advanced Preload Strategies

### 15.1 Comprehensive Guide to Resource Hints

```html
<!--
  Complete guide to resource hints:

  ┌──────────────────┬───────────────────┬──────────────┬──────────┐
  │ Hint             │ Action             │ Cost         │ Use case │
  ├──────────────────┼───────────────────┼──────────────┼──────────┤
  │ dns-prefetch     │ DNS only           │ Very low     │ External domains│
  │ preconnect       │ DNS+TCP+TLS        │ Low          │ Definite use│
  │ preload          │ Download resource  │ Medium       │ Current page│
  │ prefetch         │ Download future res│ Low (idle)   │ Next page │
  │ modulepreload    │ Download+parse ESM │ Medium       │ JS modules│
  │ prerender        │ Render whole page  │ High         │ Next page │
  └──────────────────┴───────────────────┴──────────────┴──────────┘
-->

<!-- dns-prefetch: add to any external domain -->
<link rel="dns-prefetch" href="//analytics.google.com">
<link rel="dns-prefetch" href="//fonts.gstatic.com">
<link rel="dns-prefetch" href="//api.stripe.com">

<!-- preconnect: important origins you will definitely use (up to 3–5) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://cdn.example.com" crossorigin>

<!-- preload: resources definitely needed by the current page -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/css/critical.css" as="style">
<link rel="preload" href="/images/hero.webp" as="image" type="image/webp"
      imagesrcset="/images/hero-400.webp 400w, /images/hero-800.webp 800w"
      imagesizes="100vw">

<!-- prefetch: resources needed for the next navigation -->
<link rel="prefetch" href="/js/product-page.js">
<link rel="prefetch" href="/api/popular-products" as="fetch" crossorigin>

<!-- modulepreload: preload ES modules -->
<link rel="modulepreload" href="/js/modules/cart.mjs">
<link rel="modulepreload" href="/js/modules/auth.mjs">
```

### 15.2 Priority Hints in Practice

```javascript
// Using the Fetch Priority API
// Control priority of important API requests

// High priority: data the user is waiting for
const criticalData = await fetch('/api/user-profile', {
  priority: 'high',
});

// Low priority: background prefetch
const prefetchData = await fetch('/api/recommendations', {
  priority: 'low',
});

// Image priority control
function loadImage(src, priority = 'auto') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.fetchPriority = priority;
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Load LCP image with high priority
await loadImage('/images/hero.webp', 'high');

// Load decoration image with low priority
await loadImage('/images/background-pattern.webp', 'low');
```

---

## FAQ

### Q1. When should I use preload vs prefetch?

**A:** Decide based on **when the resource is used**.

| Method | Use | Timing | Priority | Example |
|--------|-----|--------|----------|---------|
| **preload** | Resources **definitely used** on the current page | Fetch immediately | High | Critical CSS/fonts on the current page |
| **prefetch** | Resources possibly needed on the **next page** | Fetch during idle | Low | JS/images for the next page |

```html
<!-- ❌ Wrong: preload for next page resources -->
<link rel="preload" href="/next-page.css" as="style">

<!-- ✅ Correct: preload for current page critical CSS -->
<link rel="preload" href="/critical.css" as="style">

<!-- ✅ Correct: prefetch for next page resources -->
<link rel="prefetch" href="/next-page.css" as="style">
```

**Decision flow:**
```
Does this resource need to be used on the current page?
├─ YES → preload (fetch immediately with high priority)
└─ NO → Will it be used on the next page?
         ├─ YES → prefetch (fetch during idle with low priority)
         └─ NO → Do nothing
```

**Common mistakes:**
- Preloading all resources and slowing things down (contention for bandwidth)
- Preloading non-critical resources and delaying truly needed ones
- Prefetching when the user won't navigate to that page (waste)

**Best practices:**
```html
<!-- 1. Preload critical CSS/fonts only -->
<link rel="preload" href="/critical.css" as="style">
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>

<!-- 2. Prefetch pages you are likely to navigate to next -->
<link rel="prefetch" href="/likely-next-page.html">

<!-- 3. Pre-render with Speculation Rules API -->
<script type="speculationrules">
{
  "prerender": [
    {"source": "list", "urls": ["/dashboard"]}
  ]
}
</script>
```

---

### Q2. How do I optimize the Critical Rendering Path?

**A:** **Minimize render-blocking resources** and **prioritize above-the-fold content**.

#### What is the Critical Rendering Path (CRP)?

```
HTML → DOM
CSS  → CSSOM  } → Render Tree → Layout → Paint
JS   → Execute
```

**Bottlenecks:**
- CSS: rendering is blocked until all CSS is loaded
- JavaScript: `<script>` blocks HTML parsing
- Large HTML/CSS: increases parse time

#### Optimization strategies (in priority order)

**1. CSS optimization (most important)**
```html
<!-- ❌ Bad: all CSS is render-blocking -->
<link rel="stylesheet" href="/all-styles.css">

<!-- ✅ Good: inline critical CSS -->
<style>
/* Only the minimum styles needed above the fold */
.hero { display: flex; ... }
.nav { position: sticky; ... }
</style>

<!-- Load remaining CSS asynchronously -->
<link rel="preload" href="/non-critical.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/non-critical.css"></noscript>

<!-- Conditional loading with media queries -->
<link rel="stylesheet" href="/print.css" media="print">
```

**2. JavaScript optimization**
```html
<!-- ❌ Bad: parser-blocking -->
<script src="/app.js"></script>

<!-- ✅ Good: use defer/async -->
<script src="/app.js" defer></script>
<script src="/analytics.js" async></script>

<!-- ✅ Modules are defer by default -->
<script type="module" src="/app.js"></script>
```

**3. Pre-connect with resource hints**
```html
<!-- Pre-execute DNS resolution + TCP connection + TLS -->
<link rel="preconnect" href="https://cdn.example.com">
<link rel="dns-prefetch" href="https://analytics.example.com">
```

**4. Lazy-load images**
```html
<!-- Only above-the-fold images loaded immediately -->
<img src="/hero.webp" fetchpriority="high" alt="Hero">

<!-- Below-the-fold images with lazy loading -->
<img src="/gallery-1.webp" loading="lazy" alt="Gallery">
```

#### Measurement and verification

```javascript
// Measure the Critical Rendering Path
const perfData = performance.getEntriesByType('navigation')[0];

console.log({
  // HTML loaded (DOM construction can start)
  domInteractive: perfData.domInteractive,

  // CSS/JS loaded (rendering possible)
  domContentLoaded: perfData.domContentLoadedEventEnd,

  // All resources loaded
  loadComplete: perfData.loadEventEnd,

  // First paint
  firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,

  // LCP (largest contentful paint)
  lcp: '(measure with PerformanceObserver)'
});
```

**Lighthouse audit items:**
- Eliminate render-blocking resources
- Reduce unused CSS
- Minify CSS/JS
- Remove unused JavaScript
- Defer offscreen images

---

### Q3. How does a Service Worker affect navigation?

**A:** A Service Worker **intercepts network requests** and lets you implement caching strategies.

#### Service Worker Lifecycle and Navigation

```
Navigation starts
  ↓
Service Worker registered?
  ├─ NO → Normal network request
  └─ YES → Service Worker fetch event
            ↓
         fetch handler implemented?
            ├─ NO → Network request (fallback)
            └─ YES → Execute cache strategy
                      ↓
                   - Cache First (prefer cache)
                   - Network First (prefer network)
                   - Stale While Revalidate (return cache + update in background)
                   - Cache Only / Network Only
```

#### Impact by cache strategy

**1. Cache First (fastest, offline capable)**
```javascript
// sw.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

**Impact:**
- TTFB under **1ms** (on cache hit)
- Offline operation possible
- May serve stale content

**2. Network First (always fresh data)**
```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
```

**Impact:**
- Always fresh content
- Limited speed improvement when online
- Fallback when offline

**3. Stale While Revalidate (balanced)**
```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open('my-cache').then(cache => {
      return cache.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
        return response || fetchPromise;
      });
    })
  );
});
```

**Impact:**
- Returns cache immediately (fast)
- Updates in background (fresh on next access)
- Improves Core Web Vitals (LCP)

#### Impact on navigation (example numbers)

| Strategy | TTFB | LCP | Offline | Freshness |
|----------|------|-----|---------|-----------|
| No Service Worker | 300ms | 2.5s | No | Yes |
| Cache First | **5ms** | **0.8s** | Yes | May be stale |
| Network First | 300ms | 2.5s | Partial | Yes |
| Stale While Revalidate | **5ms** | **0.8s** | Yes | Yes (next access) |

#### Notes

**1. Service Worker installation delay**
```javascript
// On first visit, Service Worker is not yet registered
// → Takes effect from the second visit onward

// Registration
navigator.serviceWorker.register('/sw.js');

// Wait for activation
self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // also control existing pages
});
```

**2. Cache invalidation**
```javascript
// Clear cache with version management
const CACHE_VERSION = 'v2';

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_VERSION)
          .map(name => caches.delete(name))
      );
    })
  );
});
```

**3. Navigation Preload (Chrome 59+)**
```javascript
// Start network request in parallel with Service Worker startup
self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.navigationPreload.enable());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    event.preloadResponse // result of Navigation Preload
      .then(response => response || fetch(event.request))
  );
});
```

**Impact:** Absorbs Service Worker startup delay (50–100ms)

---

## Summary

| Concept | Key Point |
|---------|-----------|
| Navigation | DNS → TCP → TLS → HTTP → parse → rendering |
| Parser blocking | `<script>` halts HTML parsing |
| Solutions | defer / async / preload / preconnect |
| Priority | CSS = highest, images = depends on viewport |
| Events | DOMContentLoaded (DOM complete) vs load (all complete) |
| Core Web Vitals | LCP (≤2.5s), INP (≤200ms), CLS (≤0.1) |
| Service Worker | Offline support, cache strategies |
| HTTP/2 / HTTP/3 | Multiplexing, 0-RTT connection |
| Early Hints | Preload resources while waiting for server processing |
| Speculation Rules | Pre-render the next navigation |
| RUM | Collect performance data from real users |
| Image optimization | WebP/AVIF, srcset, lazy loading |

---

## Guides to Read Next
→ [HTML/CSS Parsing](./02-parsing-html-css.md)

---

## References
1. Mariko Kosaka. "Inside look at modern web browser (Part 2)." Google, 2018.
2. web.dev. "Optimizing resource loading." Google, 2024.
3. web.dev. "Core Web Vitals." Google, 2024.
4. MDN Web Docs. "Navigation Timing API." Mozilla, 2024.
5. MDN Web Docs. "Resource Timing API." Mozilla, 2024.
6. IETF. "RFC 9110: HTTP Semantics." 2022.
7. IETF. "RFC 9114: HTTP/3." 2022.
8. web.dev. "Speculation Rules API." Google, 2024.
9. Chrome Developers. "Early Hints." Google, 2023.
10. W3C. "Navigation Timing Level 2." 2023.
