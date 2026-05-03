# Browser Security Model

> The browser is the cornerstone of security standing between users and web content. Systematically understanding the multi-layered defense mechanisms — sandbox, same-origin policy, CSP, site isolation, Cookie security attributes, and more — forms the foundation for developing secure web applications.

## What You Will Learn

- [ ] Understand the multi-layer structure of the browser sandbox model
- [ ] Grasp the principles and exceptions of the Same-Origin Policy
- [ ] Learn the design philosophy of CSP (Content Security Policy) and practical configuration
- [ ] Study the architecture of site isolation and Spectre mitigations
- [ ] Be able to correctly configure Cookie security attributes
- [ ] Utilize supplementary security mechanisms such as CORS, SRI, and Trusted Types
- [ ] Implement defense-in-depth through a combination of security headers

## Prerequisites

- Browser architecture → see: [Browser Architecture](./00-browser-architecture.md)
- HTML parsing and DOM construction → see: [HTML/CSS Parsing](./02-parsing-html-css.md)
- Basics of web security (XSS, CSRF, etc.) → see: Security Fundamentals

---

## 0. Overview of Browser Security

### 0.1 Why Browser Security Matters

The browser is one of the most widely used applications in modern computing; users routinely perform banking transactions, enter personal information, and view confidential documents within it. At the same time, the browser is also an environment that executes untrusted content (HTML, CSS, JavaScript from arbitrary websites). To address the fundamental challenge of "safely executing untrusted code," browsers adopt a Defense-in-Depth architecture that combines multiple security layers.

### 0.2 Defense-in-Depth Conceptual Diagram

```
+=====================================================================+
|                        User Operating Environment                   |
+=====================================================================+
|  Layer 5: UI-Level Protection                                       |
|  ┌─────────────────────────────────────────────────────────────┐    |
|  │ · Address bar display (anti-phishing)                        │    |
|  │ · Permission prompts (camera, location, etc.)               │    |
|  │ · Mixed content warnings                                    │    |
|  │ · Certificate error display                                 │    |
|  └─────────────────────────────────────────────────────────────┘    |
|  Layer 4: Network-Level Protection                                  |
|  ┌─────────────────────────────────────────────────────────────┐    |
|  │ · HTTPS/TLS communication encryption                         │    |
|  │ · HSTS (HTTP Strict Transport Security)                      │    |
|  │ · Certificate Transparency                                   │    |
|  │ · DNS over HTTPS (DoH)                                       │    |
|  └─────────────────────────────────────────────────────────────┘    |
|  Layer 3: Content-Level Protection                                  |
|  ┌─────────────────────────────────────────────────────────────┐    |
|  │ · CSP (Content Security Policy)                              │    |
|  │ · CORS (Cross-Origin Resource Sharing)                       │    |
|  │ · SRI (Subresource Integrity)                                │    |
|  │ · Trusted Types                                              │    |
|  │ · Referrer Policy                                            │    |
|  └─────────────────────────────────────────────────────────────┘    |
|  Layer 2: Origin-Level Protection                                   |
|  ┌─────────────────────────────────────────────────────────────┐    |
|  │ · Same-Origin Policy                                         │    |
|  │ · Cookie SameSite attribute                                  │    |
|  │ · Per-origin storage isolation                               │    |
|  └─────────────────────────────────────────────────────────────┘    |
|  Layer 1: Process-Level Protection                                  |
|  ┌─────────────────────────────────────────────────────────────┐    |
|  │ · Sandbox (OS-level privilege restriction)                   │    |
|  │ · Site Isolation (process separation)                        │    |
|  │ · V8 engine memory safety                                    │    |
|  └─────────────────────────────────────────────────────────────┘    |
|  Layer 0: OS-Level Protection                                       |
|  ┌─────────────────────────────────────────────────────────────┐    |
|  │ · ASLR (Address Space Layout Randomization)                  │    |
|  │ · DEP/NX (Data Execution Prevention)                         │    |
|  │ · seccomp-bpf (Linux) / Seatbelt (macOS) / LPAC (Windows)   │    |
|  └─────────────────────────────────────────────────────────────┘    |
+=====================================================================+
```

As shown in this diagram, browser security is not a single mechanism but six layers from the OS level to the UI level working in concert. Even if any one layer is breached, the other layers are designed to minimize damage.

### 0.3 Major Attack Vectors and Their Corresponding Defense Layers

| Attack Method | Overview | Primary Defense Layer |
|---------------|----------|-----------------------|
| XSS (Cross-Site Scripting) | Injection and execution of malicious scripts | CSP, Trusted Types, Same-Origin Policy |
| CSRF (Cross-Site Request Forgery) | Unauthorized requests exploiting user credentials | SameSite Cookie, CSRF Token, Origin header validation |
| Clickjacking | Invisible iframe tricks users into unintended actions | X-Frame-Options, CSP frame-ancestors |
| MITM (Man-in-the-Middle) | Eavesdropping and tampering with communications | HTTPS/TLS, HSTS, Certificate Pinning |
| Spectre/Meltdown | Memory reading via CPU speculative execution | Site Isolation, Cross-Origin Isolation |
| Drive-by Download | Automatic malware download exploiting vulnerabilities | Sandbox, Safe Browsing API |
| Supply Chain Attack | Tampering of third-party resources such as CDNs | SRI, CSP |
| DNS Rebinding | Bypassing origin restrictions by manipulating DNS responses | Same-Origin Policy, DNS Pinning |

---

## 1. Sandbox

### 1.1 Sandbox Basics

A sandbox is a mechanism that isolates a program's execution environment and strictly limits the resources it can access. In browsers, the sandbox is applied to the renderer process that handles web content (HTML/CSS/JavaScript), and its purpose is to minimize impact on the user's system even if the renderer process is compromised by an attacker.

### 1.2 Chromium Multi-Process Architecture

```
+-------------------------------------------------------------------+
|                     Chromium Process Model                         |
+-------------------------------------------------------------------+
|                                                                   |
|  ┌──────────────────────────────────────────┐                     |
|  │          Browser Process (Browser)        │  ← High privilege  |
|  │  · UI management (tabs, address bar)      │                     |
|  │  · Network I/O                            │                     |
|  │  · File system access                     │                     |
|  │  · Child process creation and management  │                     |
|  │  · Permission management                  │                     |
|  └──────────┬────────────┬──────────────────┘                     |
|             │ IPC (Mojo) │                                        |
|     ┌───────┴────┐  ┌────┴───────┐  ┌────────────┐               |
|     │ Renderer   │  │ Renderer   │  │ Renderer   │  ← Low priv.  |
|     │ Process A  │  │ Process B  │  │ Process C  │  (sandboxed)  |
|     │            │  │            │  │            │               |
|     │ site-a.com │  │ site-b.com │  │ site-c.com │               |
|     └────────────┘  └────────────┘  └────────────┘               |
|                                                                   |
|     ┌────────────┐  ┌────────────┐  ┌────────────┐               |
|     │  GPU       │  │ Network    │  │ Storage    │               |
|     │ Process    │  │ Service    │  │ Service    │               |
|     └────────────┘  └────────────┘  └────────────┘               |
+-------------------------------------------------------------------+
```

In Chromium, each site's content runs in an independent renderer process. The renderer process operates inside a sandbox with the following restrictions.

### 1.3 OS-Specific Sandbox Implementations

The concrete implementation of the sandbox differs per OS. Each OS's provided security mechanisms are used to minimize renderer process privileges.

| OS | Sandbox Technology | Main Restrictions |
|----|-------------------|-------------------|
| Linux | seccomp-bpf + Namespaces | System call filtering, isolation via PID/network namespaces |
| macOS | Seatbelt (sandbox_init) | Profile-based resource access control |
| Windows | Restricted Token + LPAC | Token privilege reduction, AppContainer isolation |
| Android | SELinux + seccomp-bpf | Mandatory access control + system call restrictions |
| ChromeOS | Minijail + Namespaces | Minimum-privilege jail process |

#### Sandbox Details on Linux

On Linux, Chromium uses seccomp-bpf (Secure Computing mode with Berkeley Packet Filter) to filter system calls. The system calls the renderer process can invoke are strictly whitelisted; file open(), network socket creation, process spawning, and similar operations are prohibited.

```c
// Conceptual pseudocode of a seccomp-bpf filter
// (Simplified from Chromium's actual implementation)

struct sock_filter filter[] = {
    // Verify architecture
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS,
             offsetof(struct seccomp_data, arch)),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL),

    // Get system call number
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS,
             offsetof(struct seccomp_data, nr)),

    // Allowed system calls
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_read, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_write, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_mmap, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_mprotect, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_futex, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),

    // Deny everything else (notify via SIGSYS signal)
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_TRAP),
};

struct sock_fprog prog = {
    .len = (unsigned short)(sizeof(filter) / sizeof(filter[0])),
    .filter = filter,
};

// Apply the sandbox
prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0);
prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog);
```

### 1.4 Operations Restricted and Permitted by the Sandbox

```
Privilege separation by sandbox:

  ┌──────────────────────────────────────────────────────────────┐
  │             Renderer Process (inside sandbox)                 │
  │                                                              │
  │  Restricted operations:                                       │
  │  ✗ Direct file system access (open, stat, unlink, etc.)      │
  │  ✗ Direct network socket creation (socket, connect, etc.)    │
  │  ✗ Spawning new processes (fork, execve, etc.)               │
  │  ✗ Direct access to OS APIs                                  │
  │  ✗ Access to other process memory                            │
  │  ✗ Direct hardware device control                            │
  │  ✗ Loading kernel modules                                    │
  │                                                              │
  │  Operations permitted via IPC:                               │
  │  ✓ Resource requests to the browser process (fetch, etc.)    │
  │  ✓ Access to user-permitted features (via Permissions API)   │
  │  ✓ Read/write to shared memory regions (for GPU drawing)     │
  │  ✓ Access to per-origin isolated storage                     │
  │                                                              │
  │  Operations permitted via JavaScript APIs:                   │
  │  ✓ HTTP requests with fetch() (within CORS)                  │
  │  ✓ Reading files selected by the user via <input type="file">│
  │  ✓ Geolocation API (after user permission)                   │
  │  ✓ Camera/Microphone (after user permission)                 │
  │  ✓ localStorage / IndexedDB (isolated per origin)            │
  │  ✓ Spawning Web Workers / Service Workers                    │
  └──────────────────────────────────────────────────────────────┘

  Permissions Policy (formerly Feature Policy):
  → Restrict browser features a web page can use via HTTP headers
  → Can also apply feature restrictions to iframes

  Example: Permissions-Policy: camera=(), microphone=(), geolocation=(self)
```

### 1.5 iframe sandbox Attribute

The HTML `<iframe>` element accepts a `sandbox` attribute that imposes additional restrictions on embedded content.

```html
<!-- Most restrictive setting (block all features) -->
<iframe src="https://untrusted.example.com" sandbox></iframe>

<!-- Selectively allow only necessary features -->
<iframe src="https://payment.example.com"
        sandbox="allow-scripts allow-forms allow-same-origin">
</iframe>

<!-- List of flags controllable via the sandbox attribute -->
<!--
  allow-forms            : Permit form submission
  allow-modals           : Permit modals such as alert(), confirm()
  allow-orientation-lock : Permit screen orientation lock
  allow-pointer-lock     : Permit Pointer Lock API
  allow-popups           : Permit window.open() and target="_blank"
  allow-popups-to-escape-sandbox : Do not inherit sandbox in popups
  allow-presentation     : Permit Presentation API
  allow-same-origin      : Treat as same origin (use with caution)
  allow-scripts          : Permit JavaScript execution
  allow-top-navigation   : Permit navigation of the parent frame
  allow-downloads        : Permit file downloads
-->
```

**Note**: Specifying both `allow-scripts` and `allow-same-origin` at the same time allows embedded content to remove its own sandbox attribute via JavaScript. Avoid this combination for untrusted content.

---

## 2. Same-Origin Policy

### 2.1 Definition of an Origin

The Same-Origin Policy (SOP) is the most fundamental security mechanism in browsers, first introduced in Netscape Navigator 2.0 in 1995. The core of SOP is the concept of an "origin."

**Origin** = scheme (protocol) + host (domain) + port number

```
Origin comparison examples:

  Reference URL: https://www.example.com:443/path/page.html

  ┌─────────────────────────────────────────┬──────────────┬──────────────────┐
  │ Comparison URL                           │ Same Origin  │ Reason           │
  ├─────────────────────────────────────────┼──────────────┼──────────────────┤
  │ https://www.example.com:443/other.html  │ Yes          │ Only path differs │
  │ https://www.example.com/other.html      │ Yes          │ 443 can be omitted│
  │ http://www.example.com/page.html        │ No           │ Scheme differs    │
  │ https://api.example.com/page.html       │ No           │ Host differs      │
  │ https://www.example.com:8080/page.html  │ No           │ Port differs      │
  │ https://example.com/page.html           │ No           │ Subdomain differs │
  └─────────────────────────────────────────┴──────────────┴──────────────────┘
```

### 2.2 What SOP Controls

The Same-Origin Policy controls cross-origin resource access as follows.

| Operation Category | Example | Behavior Cross-Origin |
|--------------------|---------|----------------------|
| Read | DOM access, Cookie reading, AJAX response | Prohibited in principle |
| Write | Links, redirects, form submissions | Permitted in principle |
| Embed | `<script>`, `<img>`, `<iframe>`, `<link>` | Permitted in principle |

```javascript
// Same-Origin Policy behavior example

// --- Same origin (permitted) ---
// Current page: https://app.example.com/dashboard

// DOM access
const iframe = document.getElementById('settings-frame');
// If the iframe source is same-origin, DOM access is allowed
const innerDoc = iframe.contentDocument;  // OK

// AJAX request
const response = await fetch('https://app.example.com/api/data');
const data = await response.json();  // OK: same origin

// --- Different origin (restricted) ---

// DOM access restriction
const externalFrame = document.getElementById('external-frame');
// If the iframe source is from a different origin
try {
    const doc = externalFrame.contentDocument;  // SecurityError
} catch (e) {
    console.error('Cross-origin DOM access blocked:', e.message);
}

// AJAX request restriction (without CORS)
try {
    const resp = await fetch('https://other-site.com/api/data');
    // If the server does not return appropriate CORS headers
    const data = await resp.json();  // TypeError: Failed to fetch
} catch (e) {
    console.error('Cross-origin request blocked:', e.message);
}

// Safe cross-origin communication via window.postMessage
// Sender (parent window)
const targetOrigin = 'https://trusted-partner.com';
externalFrame.contentWindow.postMessage(
    { type: 'greeting', payload: 'Hello!' },
    targetOrigin  // Always specify a concrete origin (avoid '*')
);

// Receiver (script inside iframe)
window.addEventListener('message', (event) => {
    // Origin validation is mandatory
    if (event.origin !== 'https://app.example.com') {
        console.warn('Rejected message from untrusted origin:', event.origin);
        return;
    }
    console.log('Received:', event.data);
});
```

### 2.3 SOP Exceptions and Relaxation Mechanisms

The Same-Origin Policy has several exceptions and relaxation mechanisms to accommodate legitimate use cases.

#### Relaxation via document.domain (deprecated)

```javascript
// Page at https://app.example.com
document.domain = 'example.com';

// Also set this on the page at https://api.example.com
document.domain = 'example.com';

// This causes both pages to be treated as same-origin
// Note: This feature is deprecated and scheduled for removal
// Alternatives: postMessage, CORS, Channel Messaging API
```

#### CORS (Cross-Origin Resource Sharing)

CORS is the standard mechanism for safely relaxing the SOP; it passes only cross-origin requests that the server has explicitly allowed.

```
CORS request flow (with preflight):

  Browser                                    Server
    │                                          │
    │  ① OPTIONS /api/data HTTP/1.1            │
    │  Origin: https://app.example.com         │
    │  Access-Control-Request-Method: POST     │
    │  Access-Control-Request-Headers:         │
    │    Content-Type, Authorization           │
    │ ──────────────────────────────────────>   │
    │                                          │
    │  ② 200 OK                                │
    │  Access-Control-Allow-Origin:            │
    │    https://app.example.com               │
    │  Access-Control-Allow-Methods:           │
    │    GET, POST, PUT                        │
    │  Access-Control-Allow-Headers:           │
    │    Content-Type, Authorization           │
    │  Access-Control-Max-Age: 86400           │
    │ <──────────────────────────────────────   │
    │                                          │
    │  ③ POST /api/data HTTP/1.1               │
    │  Origin: https://app.example.com         │
    │  Content-Type: application/json          │
    │  Authorization: Bearer token123          │
    │  {"key": "value"}                        │
    │ ──────────────────────────────────────>   │
    │                                          │
    │  ④ 200 OK                                │
    │  Access-Control-Allow-Origin:            │
    │    https://app.example.com               │
    │  {"result": "success"}                   │
    │ <──────────────────────────────────────   │
    │                                          │
```

```javascript
// Server-side CORS configuration example (Node.js / Express)

const express = require('express');
const app = express();

// Method 1: Manual CORS header configuration
app.use((req, res, next) => {
    // Whitelist of allowed origins
    const allowedOrigins = [
        'https://app.example.com',
        'https://staging.example.com'
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Respond to preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    next();
});

// Method 2: Using the cors middleware
const cors = require('cors');
app.use(cors({
    origin: ['https://app.example.com', 'https://staging.example.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
}));
```

### 2.4 SOP and Storage Isolation

Browser storage mechanisms are isolated per origin.

| Storage Type | Isolation Unit | Capacity Estimate | Notes |
|--------------|----------------|-------------------|-------|
| Cookie | Domain + Path | 4KB/cookie, ~50 per domain | SameSite attribute controls sending |
| localStorage | Origin | 5-10MB | Synchronous API, blocks main thread |
| sessionStorage | Origin + Tab | 5-10MB | Cleared when tab is closed |
| IndexedDB | Origin | Hundreds of MB to GB | Asynchronous API, for large data |
| Cache API | Origin | Browser-dependent | Used with Service Worker |
| Web SQL | Origin | 5MB (initial) | Deprecated, no new use |

---

## 3. CSP (Content Security Policy)

### 3.1 CSP Design Philosophy

CSP is a security layer designed to mitigate the impact of XSS (Cross-Site Scripting) attacks. XSS attacks arise from input validation failures, but CSP functions as a secondary line of defense: "even if an XSS vulnerability exists, prevent execution of scripts injected by an attacker."

The core principle of CSP is to restrict the sources from which a web page can load resources, using a whitelist approach.

### 3.2 How to Configure CSP

CSP can be configured in two ways.

```
Method 1: HTTP response header (recommended)

  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com

Method 2: HTML <meta> tag

  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self' https://cdn.example.com">

  * frame-ancestors, report-uri, and sandbox directives cannot be used with meta tags
  * HTTP headers are processed earlier, so the HTTP header method is recommended
```

### 3.3 Complete CSP Directive Reference

```
List of major CSP directives:

  ┌──────────────────┬──────────────────────────────────────────────┐
  │ Directive         │ What it controls                             │
  ├──────────────────┼──────────────────────────────────────────────┤
  │ default-src      │ Fallback for other directives                 │
  │ script-src       │ JavaScript files and inline scripts           │
  │ script-src-elem  │ <script> elements only (excludes event handlers) │
  │ script-src-attr  │ Inline event handlers only (onclick, etc.)    │
  │ style-src        │ CSS files and inline styles                   │
  │ style-src-elem   │ <style> elements and <link rel="stylesheet">  │
  │ style-src-attr   │ style attributes only                         │
  │ img-src          │ Images (<img>, CSS background-image, etc.)    │
  │ connect-src      │ Destinations for fetch, XHR, WebSocket, EventSource │
  │ font-src         │ Web fonts                                     │
  │ frame-src        │ Sources for <iframe>, <frame>                 │
  │ child-src        │ Web Workers and iframes (frame-src takes precedence) │
  │ worker-src       │ Worker, SharedWorker, ServiceWorker           │
  │ media-src        │ <audio>, <video> media                        │
  │ object-src       │ <object>, <embed>, <applet>                   │
  │ manifest-src     │ Web App Manifest                              │
  │ base-uri         │ href of <base> element                        │
  │ form-action      │ action attribute of <form> (submit destination) │
  │ frame-ancestors  │ Parent frames allowed to embed this page      │
  │ navigate-to      │ Navigation destination restriction (experimental) │
  │ report-uri       │ Violation report destination (deprecated)     │
  │ report-to        │ Violation report endpoint group               │
  │ require-trusted-types-for │ Force Trusted Types enforcement     │
  │ trusted-types    │ Allowed Trusted Type policy names             │
  │ upgrade-insecure-requests │ Auto-upgrade HTTP to HTTPS          │
  │ sandbox          │ Apply same restrictions as iframe sandbox     │
  └──────────────────┴──────────────────────────────────────────────┘

  Source value specification:

  'self'             — Allow same origin only
  'none'             — Block everything
  'unsafe-inline'    — Allow inline scripts/styles (not recommended)
  'unsafe-eval'      — Allow eval(), Function(), setTimeout(string) (not recommended)
  'unsafe-hashes'    — Allow specific inline event handlers
  'nonce-{base64}'   — Allow only elements with the specified nonce
  'sha256-{hash}'    — Allow only inline code matching the specified hash
  'strict-dynamic'   — Also allow scripts dynamically loaded by trusted scripts
  https:             — Allow resources via the HTTPS scheme only
  data:              — Allow data: URIs
  blob:              — Allow blob: URIs
  mediastream:       — Allow mediastream: URIs
  *.example.com      — Wildcard host specification
```

### 3.4 Practical CSP Configuration by Level

#### Level 1: Basic XSS Defense

```
Content-Security-Policy:
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    frame-ancestors 'self';
    form-action 'self';
```

#### Level 2: Strict nonce-based Configuration (Recommended)

```html
<!-- Server generates a random nonce per request -->
<!-- HTTP header -->
<!-- Content-Security-Policy:
    default-src 'self';
    script-src 'nonce-dGhpcyBpcyBhIHNhbXBsZQ==' 'strict-dynamic';
    style-src 'nonce-dGhpcyBpcyBhIHNhbXBsZQ==';
    img-src 'self' data: https:;
    connect-src 'self' https://api.example.com;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    frame-ancestors 'none';
    form-action 'self';
    upgrade-insecure-requests;
-->

<!DOCTYPE html>
<html>
<head>
    <!-- Only scripts with a matching nonce are executed -->
    <script nonce="dGhpcyBpcyBhIHNhbXBsZQ==">
        // This script executes
        console.log('Trusted script executed');
    </script>

    <!-- Scripts without a nonce are blocked -->
    <script>
        // This script is blocked
        console.log('This will not execute');
    </script>

    <!-- Scripts injected by attackers are also blocked -->
    <!-- <script>alert('XSS')</script> → blocked -->

    <style nonce="dGhpcyBpcyBhIHNhbXBsZQ==">
        body { font-family: sans-serif; }
    </style>
</head>
<body>
    <h1>CSP Nonce Example</h1>
    <!-- With strict-dynamic, scripts dynamically loaded
         by trusted scripts are automatically permitted -->
</body>
</html>
```

#### Level 3: Hash-Based Configuration

```javascript
// Example of computing the hash of an inline script in Node.js
const crypto = require('crypto');

const inlineScript = `console.log('Hello, World!');`;
const hash = crypto.createHash('sha256')
    .update(inlineScript)
    .digest('base64');

console.log(`'sha256-${hash}'`);
// Output example: 'sha256-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

// Include this hash in the CSP header
// Content-Security-Policy: script-src 'sha256-xxxxxxxx...'
```

### 3.5 Using CSP Violation Reports

CSP has a reporting feature that can automatically notify the server when a policy violation occurs, allowing security issues in production to be detected early.

```javascript
// Example of gradual rollout using Report-Only mode

// Step 1: Investigate impact with Report-Only (no blocking)
// Content-Security-Policy-Report-Only:
//     default-src 'self';
//     script-src 'self' 'nonce-abc123';
//     report-uri /csp-report;
//     report-to csp-endpoint;

// Step 2: Implement a report endpoint (Express)
const express = require('express');
const app = express();

app.post('/csp-report', express.json({ type: 'application/csp-report' }),
    (req, res) => {
    const report = req.body['csp-report'];

    console.log('CSP Violation:', {
        blockedUri:        report['blocked-uri'],
        violatedDirective: report['violated-directive'],
        documentUri:       report['document-uri'],
        sourceFile:        report['source-file'],
        lineNumber:        report['line-number'],
        columnNumber:      report['column-number'],
        originalPolicy:    report['original-policy']
    });

    // In production, send to a log aggregation service
    // await logService.send('csp-violation', report);

    res.status(204).end();
});

// Header configuration example for Reporting API v1 (new standard)
// Report-To: {"group":"csp-endpoint",
//             "max_age":86400,
//             "endpoints":[{"url":"https://reports.example.com/csp"}]}
// Content-Security-Policy: ... report-to csp-endpoint;
```

### 3.6 CSP Integration with Major Frameworks

| Framework | CSP Compatibility | Main Challenges | Recommended Approach |
|-----------|------------------|-----------------|----------------------|
| React | Good | When using dangerouslySetInnerHTML | Use together with Trusted Types |
| Next.js | Good | nonce needs SSR support | Configure CSP in next.config.js |
| Vue.js | Needs care | Template compilation may need eval | Use runtime-only build |
| Angular | Needs care | AOT-less builds require unsafe-eval | Always use AOT compilation |
| Svelte | Good | No eval needed since it's compiled | Standard nonce-based CSP works |
| jQuery | Caution | DOM manipulation via .html() or .append() | Progressively replace jQuery |

---

## 4. Site Isolation

### 4.1 Background of Site Isolation

Site Isolation is a security architecture that Chromium fully introduced in 2018 (Chrome 67). In the traditional browser model, content from multiple sites could run inside the same renderer process. With Site Isolation, content from different sites is always executed in separate processes.

The direct trigger for this change was the **Spectre** vulnerability disclosed in January 2018. Because Spectre theoretically allows reading any memory region within the same process, a situation where data from different sites coexists in the same process became a severe security risk.

### 4.2 Difference Between a "Site" and an "Origin"

```
Definition of "site" in site isolation:

  Site = scheme + eTLD+1 (effective Top-Level Domain + 1)

  eTLD+1 example:
    URL: https://mail.google.com/inbox
    eTLD: com
    eTLD+1: google.com
    Site: https://google.com

  ┌──────────────────────────────────┬──────────────────┬────────────┐
  │ URL                              │ Site             │ Origin     │
  ├──────────────────────────────────┼──────────────────┼────────────┤
  │ https://www.example.com/page     │ https://example.com│ https://www│
  │                                  │                  │ .example.com│
  │ https://app.example.com/dash     │ https://example.com│ https://app│
  │                                  │                  │ .example.com│
  │ https://www.example.co.uk/page   │ https://example  │ https://www│
  │                                  │ .co.uk           │ .example   │
  │                                  │                  │ .co.uk     │
  │ https://user.github.io/repo      │ https://user     │ https://   │
  │                                  │ .github.io       │ user.github│
  │                                  │                  │ .io        │
  └──────────────────────────────────┴──────────────────┴────────────┘

  Key differences:
  · Same-Origin Policy → per origin (scheme + host + port)
  · Site Isolation     → per site (scheme + eTLD+1)
  · SameSite Cookie    → per site (scheme + eTLD+1)

  * For public suffixes like github.io,
    user1.github.io and user2.github.io are treated as different sites
```

### 4.3 Site Isolation Architecture

```
Process placement with site isolation enabled:

  Tab 1: https://app.example.com/dashboard
  ┌──────────────────────────────────────────────────┐
  │  Renderer Process A (site: example.com)           │
  │  ┌─────────────────────────────────────────┐      │
  │  │ Main frame: app.example.com              │      │
  │  └─────────────────────────────────────────┘      │
  └──────────────────────────────────────────────────┘

  iframe inside Tab 1: https://ads.partner.com/banner
  ┌──────────────────────────────────────────────────┐
  │  Renderer Process B (site: partner.com)           │
  │  ┌─────────────────────────────────────────┐      │
  │  │ Sub-frame: ads.partner.com               │      │
  │  └─────────────────────────────────────────┘      │
  └──────────────────────────────────────────────────┘

  Tab 2: https://mail.example.com/inbox
  ┌──────────────────────────────────────────────────┐
  │  Renderer Process A (site: example.com) ← reused │
  │  ┌─────────────────────────────────────────┐      │
  │  │ Main frame: mail.example.com             │      │
  │  └─────────────────────────────────────────┘      │
  └──────────────────────────────────────────────────┘

  Tab 3: https://social.other-site.com
  ┌──────────────────────────────────────────────────┐
  │  Renderer Process C (site: other-site.com)        │
  │  ┌─────────────────────────────────────────┐      │
  │  │ Main frame: social.other-site.com        │      │
  │  └─────────────────────────────────────────┘      │
  └──────────────────────────────────────────────────┘

  * Frames of the same site run in the same process,
    but frames from different sites always run in separate processes
```

### 4.4 Spectre Vulnerability and Browser Countermeasures

Spectre is a side-channel attack that exploits CPU speculative execution, allowing attackers to indirectly read memory within the same process using a high-resolution timer.

Browser countermeasures against Spectre are multi-layered.

| Countermeasure | Description | Introduced |
|----------------|-------------|------------|
| Site Isolation | Run different sites in separate processes | Chrome 67 (2018) |
| Reduced performance.now() precision | Lower timer resolution to make timing attacks harder | January 2018 |
| Disabled SharedArrayBuffer | Remove means to build high-resolution timers | January 2018 |
| Cross-Origin Isolation | Safely re-enable SharedArrayBuffer | Chrome 91 (2021) |
| CORB (Cross-Origin Read Blocking) | Prevent cross-origin responses from being read within the process | Chrome 67 (2018) |
| ORB (Opaque Response Blocking) | Successor to CORB, protects a broader range of resources | Gradual rollout |

### 4.5 Cross-Origin Isolation

Cross-Origin Isolation is a mechanism for safely using features such as SharedArrayBuffer and high-precision timers. It is enabled by setting the following HTTP headers.

```
# Headers required to enable Cross-Origin Isolation

# 1. Cross-Origin-Opener-Policy (COOP)
# → Separate the browsing context group from windows of non-same-origin
Cross-Origin-Opener-Policy: same-origin

# 2. Cross-Origin-Embedder-Policy (COEP)
# → Require all resources embedded in the page to be explicitly permitted
#    by CORS or CORP
Cross-Origin-Embedder-Policy: require-corp

# Setting both:
# · self.crossOriginIsolated === true
# · SharedArrayBuffer becomes available
# · performance.now() precision recovers (5 microseconds)
# · performance.measureUserAgentSpecificMemory() becomes available
```

```javascript
// Check Cross-Origin Isolation status
if (self.crossOriginIsolated) {
    console.log('Cross-Origin Isolated: SharedArrayBuffer available');

    // Use high-precision timer
    const start = performance.now();
    // ... processing ...
    const elapsed = performance.now() - start;
    console.log(`Elapsed: ${elapsed} ms (high precision)`);

    // Use SharedArrayBuffer (shared memory with Web Worker)
    const sharedBuffer = new SharedArrayBuffer(1024);
    const view = new Int32Array(sharedBuffer);

    const worker = new Worker('worker.js');
    worker.postMessage({ buffer: sharedBuffer });
} else {
    console.warn('Not Cross-Origin Isolated');
    console.warn('Check the COOP and COEP headers');
}
```

### 4.6 CORB and ORB

Cross-Origin Read Blocking (CORB) is a mechanism that blocks sensitive cross-origin resources before they reach the renderer process.

```
CORB operation flow:

  Malicious page: https://evil.com
    │
    │  Attempts: <img src="https://bank.com/api/account">
    │  (Attack trying to read API response via image tag)
    │
    ▼
  Network Process
    │  Check Content-Type of response
    │  Content-Type: application/json → determined as HTML/XML/JSON
    │
    │  A JSON response is inappropriate for an <img> tag request
    │  → CORB replaces the response body with an empty one
    │
    ▼
  Renderer Process (evil.com)
    │  Receives an empty response body
    │  → Sensitive data never reaches the process's memory space
    │  → Cannot be read even with a Spectre attack
    │
    Result: Image load fails (this is the expected behavior)
```

---

## 5. Cookie Security

### 5.1 Complete Guide to Cookie Security Attributes

Cookies are a mechanism to complement HTTP's stateless nature, but without appropriate security attributes they are easily targeted by attacks.

```
Security attributes of the Set-Cookie header:

  Set-Cookie: session_id=a1b2c3d4e5f6;
    Secure;                    ← Send only over HTTPS connections
    HttpOnly;                  ← Inaccessible via JavaScript (document.cookie)
    SameSite=Lax;              ← Restrict sending in cross-site requests
    Path=/;                    ← Effective path for the cookie
    Domain=.example.com;       ← Effective domain for the cookie
    Max-Age=86400;             ← Expiry (in seconds; 86400 = 24 hours)
    Partitioned;               ← CHIPS: partition per top-level site

  Importance and recommended setting for each attribute:

  ┌──────────────┬───────────────┬──────────────────────────────────────┐
  │ Attribute    │ Recommended   │ Risk if not set                      │
  ├──────────────┼───────────────┼──────────────────────────────────────┤
  │ Secure       │ Always set    │ Cookie sent in plaintext over HTTP    │
  │ HttpOnly     │ Always set    │ Cookie stolen via XSS                 │
  │ SameSite     │ Lax or higher │ Risk of CSRF attacks                  │
  │ Path         │ Minimum range │ Cookie sent to unnecessary paths      │
  │ Domain       │ Minimum needed│ Cookie shared with subdomains         │
  │ Max-Age      │ Per use case  │ Treated as session cookie             │
  │ __Host- prefix│ Recommended  │ Possible Domain attribute override    │
  │ Partitioned  │ Recommended for 3P│ Potential tracking abuse         │
  └──────────────┴───────────────┴──────────────────────────────────────┘
```

### 5.2 SameSite Attribute in Detail

```
SameSite value and behavior comparison:

  ┌───────────┬──────────────────────────────────────────────────────┐
  │ Value     │ Behavior                                              │
  ├───────────┼──────────────────────────────────────────────────────┤
  │ Strict    │ Never sent in cross-site requests                     │
  │           │ → Cookie not sent even when following links from      │
  │           │   external sites                                      │
  │           │ → Most secure but may impact UX                       │
  │           │                                                       │
  │           │ Use case: bank site auth cookies, admin panels        │
  ├───────────┼──────────────────────────────────────────────────────┤
  │ Lax       │ Sent in top-level navigation (GET link clicks)        │
  │ (default) │ Not sent in POST, iframe, AJAX, image loads          │
  │           │ → Defends against primary CSRF attack vectors while   │
  │           │   supporting transitions via external links           │
  │           │                                                       │
  │           │ Use case: general web app session cookies             │
  ├───────────┼──────────────────────────────────────────────────────┤
  │ None      │ Always sent (Secure attribute must also be specified) │
  │           │ → Operates as a third-party cookie                    │
  │           │ → Phasing out as browser restrictions increase        │
  │           │                                                       │
  │           │ Use case: auth federation, embedded widgets           │
  └───────────┴──────────────────────────────────────────────────────┘

  Concrete scenarios for SameSite send control:

  User is viewing https://blog.com and a request to
  https://shop.example.com occurs:

  Scenario                           Strict    Lax    None
  ─────────────────────────────────────────────────────
  <a href="shop.example.com">        Not sent  Sent   Sent
  <form method="GET" action="...">   Not sent  Sent   Sent
  <form method="POST" action="...">  Not sent  Not sent Sent
  <img src="shop.example.com/...">   Not sent  Not sent Sent
  fetch("shop.example.com/...")      Not sent  Not sent Sent
  <iframe src="shop.example.com">    Not sent  Not sent Sent
```

### 5.3 Cookie Prefix Protection

```javascript
// __Host- prefix: the most restrictive cookie
// Requirements: Secure mandatory, no Domain attribute, Path=/ mandatory
// → Cookie scope is guaranteed to be limited to the current host

// Server-side configuration example (Express)
app.use((req, res, next) => {
    // __Host- prefix is recommended for session cookies
    res.cookie('__Host-session', sessionId, {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000  // 24 hours
        // domain must not be specified (__Host- requirement)
    });

    // __Secure- prefix: Secure attribute only is mandatory
    // Specifying Domain attribute is allowed
    res.cookie('__Secure-preferences', prefsToken, {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        domain: '.example.com',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days
    });

    next();
});
```

### 5.4 Third-Party Cookie Deprecation and Alternatives

```
Third-party cookie deprecation status:

  ┌──────────┬──────────────────────────────────────────────────────┐
  │ Browser  │ Status                                                │
  ├──────────┼──────────────────────────────────────────────────────┤
  │ Safari   │ Already blocked by ITP (Intelligent Tracking Prevention) │
  │          │ Third-party cookies fully blocked since 2020          │
  ├──────────┼──────────────────────────────────────────────────────┤
  │ Firefox  │ Blocked by ETP (Enhanced Tracking Protection)         │
  │          │ Storage also partitioned by Total Cookie Protection   │
  ├──────────┼──────────────────────────────────────────────────────┤
  │ Chrome   │ Gradual migration to Privacy Sandbox                  │
  │          │ CHIPS (Cookies Having Independent Partitioned State)  │
  │          │ Replaced by Topics API, Attribution Reporting API, etc.│
  └──────────┴──────────────────────────────────────────────────────┘

  Comparison of alternative technologies:

  ┌─────────────────────┬────────────────────┬─────────────────────┐
  │ Use Case            │ Previous Method     │ Alternative          │
  ├─────────────────────┼────────────────────┼─────────────────────┤
  │ Ad targeting        │ 3rd party Cookie    │ Topics API           │
  │ Conversion tracking │ 3rd party Cookie    │ Attribution Reporting│
  │ Auth federation (SSO)│ 3rd party Cookie   │ FedCM API            │
  │ Embedded widgets    │ 3rd party Cookie    │ CHIPS (Partitioned)  │
  │ Fraud detection     │ 3rd party Cookie    │ Private State Tokens │
  └─────────────────────┴────────────────────┴─────────────────────┘
```

---

## 6. Other Security Mechanisms

### 6.1 Subresource Integrity (SRI)

SRI is a mechanism that cryptographically verifies that resources loaded from external sources such as CDNs have not been tampered with.

```html
<!-- SRI usage example -->
<script
    src="https://cdn.example.com/lib/react.production.min.js"
    integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8w"
    crossorigin="anonymous">
</script>

<link
    rel="stylesheet"
    href="https://cdn.example.com/css/bootstrap.min.css"
    integrity="sha384-xOolHFLEh07PJGoPkLv1IbcEPTNtaed2xpHsD9ESMhqIYd0nLMwNLD69Npy4HI+"
    crossorigin="anonymous">

<!--
  SRI operation:
  1. Browser downloads the resource
  2. Compute the SHA hash of the downloaded resource
  3. Compare with the hash value in the integrity attribute
  4. Match → use the resource
     Mismatch → block the resource (treated as a network error)

  Why crossorigin="anonymous" is required:
  → SRI validates the hash of the response body, so
    the response must be accessible via CORS
-->
```

```bash
# How to generate an SRI hash
# Generate a sha384 hash from the command line
cat react.production.min.js | openssl dgst -sha384 -binary | openssl base64 -A

# Multiple hash algorithms can be specified (fallback)
# integrity="sha256-xxx sha384-yyy sha512-zzz"
# → Browser selects the strongest algorithm
```

### 6.2 Trusted Types

Trusted Types is an API that fundamentally prevents DOM XSS. It prohibits direct string assignment to dangerous DOM APIs such as innerHTML and instead accepts only sanitized "trusted type" objects.

```javascript
// Trusted Types configuration and usage example

// Force Trusted Types via CSP header
// Content-Security-Policy: require-trusted-types-for 'script';
//                          trusted-types myPolicy default;

// Create a policy
const sanitizePolicy = trustedTypes.createPolicy('myPolicy', {
    createHTML: (input) => {
        // Sanitize with DOMPurify or similar
        return DOMPurify.sanitize(input, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
            ALLOWED_ATTR: ['href', 'title']
        });
    },
    createScriptURL: (input) => {
        // Return only allowed URLs
        const url = new URL(input, document.baseURI);
        if (url.origin === location.origin) {
            return url.href;
        }
        throw new TypeError(`Untrusted script URL: ${input}`);
    },
    createScript: (input) => {
        // Direct script creation is prohibited in principle
        throw new TypeError('Script creation is not allowed');
    }
});

// Usage example: assigning to innerHTML
const userContent = '<p>Hello <b>World</b></p><script>alert("XSS")</script>';
const trustedHTML = sanitizePolicy.createHTML(userContent);
// → <p>Hello <b>World</b></p> (script tag is removed)

document.getElementById('content').innerHTML = trustedHTML;  // OK

// Direct assignment without Trusted Types is blocked
// document.getElementById('content').innerHTML = userContent;
// → TypeError: Failed to set 'innerHTML': This document requires
//   'TrustedHTML' assignment.

// Default policy (for fallback)
trustedTypes.createPolicy('default', {
    createHTML: (input) => {
        console.warn('Uncontrolled innerHTML usage detected:', input);
        return DOMPurify.sanitize(input);
    }
});
```

### 6.3 Referrer Policy

```
Referrer-Policy values and behavior:

  ┌─────────────────────────────────┬──────────────────────────────────┐
  │ Policy                          │ Referrer sent                     │
  ├─────────────────────────────────┼──────────────────────────────────┤
  │ no-referrer                     │ No referrer sent at all          │
  │ no-referrer-when-downgrade      │ Not sent on HTTPS→HTTP           │
  │ origin                          │ Origin only                       │
  │                                 │ (https://example.com/)            │
  │ origin-when-cross-origin        │ Same origin: full URL            │
  │                                 │ Cross-origin: origin only         │
  │ same-origin                     │ Same origin: full URL            │
  │                                 │ Cross-origin: not sent            │
  │ strict-origin                   │ HTTPS→HTTPS: origin only         │
  │                                 │ HTTPS→HTTP: not sent             │
  │ strict-origin-when-cross-origin │ Same origin: full URL            │
  │ (default)                       │ Cross-origin: origin only         │
  │                                 │ HTTPS→HTTP: not sent             │
  │ unsafe-url                      │ Always sends full URL (not recommended) │
  └─────────────────────────────────┴──────────────────────────────────┘

  Recommended: strict-origin-when-cross-origin (default in most browsers)
  When URLs contain sensitive information (tokens, etc.): no-referrer
```

### 6.4 Comprehensive Security Header Configuration Example

```nginx
# Recommended security header configuration in Nginx

server {
    listen 443 ssl http2;
    server_name example.com;

    # --- TLS Configuration ---
    ssl_certificate     /etc/ssl/certs/example.com.pem;
    ssl_certificate_key /etc/ssl/private/example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # --- Security Headers ---

    # HSTS: Force HTTPS (max-age=2 years, including subdomains)
    add_header Strict-Transport-Security
        "max-age=63072000; includeSubDomains; preload" always;

    # CSP: Restrict resource loading
    # * nonce is dynamically generated by the application per request
    add_header Content-Security-Policy
        "default-src 'self'; script-src 'self' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests;"
        always;

    # X-Content-Type-Options: Prevent MIME sniffing
    add_header X-Content-Type-Options "nosniff" always;

    # X-Frame-Options: Prevent clickjacking
    # (recommended to use together with CSP frame-ancestors)
    add_header X-Frame-Options "DENY" always;

    # Referrer Policy
    add_header Referrer-Policy
        "strict-origin-when-cross-origin" always;

    # Permissions Policy: Disable unnecessary features
    add_header Permissions-Policy
        "camera=(), microphone=(), geolocation=(self), payment=(self)"
        always;

    # Cross-Origin Isolation (when needed)
    # add_header Cross-Origin-Opener-Policy "same-origin" always;
    # add_header Cross-Origin-Embedder-Policy "require-corp" always;

    # Cross-Origin Resource Policy
    add_header Cross-Origin-Resource-Policy "same-origin" always;
}
```

---

## 7. Anti-Patterns

### 7.1 Anti-Pattern 1: Carelessly Using `unsafe-inline` and `unsafe-eval` in CSP

**Problematic code:**

```
Content-Security-Policy:
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
```

**Why this is a problem:**

Specifying `unsafe-inline` in `script-src` almost completely disables CSP's XSS protection. If an attacker succeeds in HTML injection, inline scripts like `<script>alert(document.cookie)</script>` execute as-is. Similarly, specifying `unsafe-eval` permits APIs that generate code from strings, such as `eval()`, the `Function()` constructor, and `setTimeout('string')`, greatly expanding the attack surface.

The primary purpose of introducing CSP is to mitigate the impact of XSS, and using `unsafe-inline` and `unsafe-eval` undermines that purpose. Specifying these in `script-src` is like installing a surveillance camera on a door without a lock — it provides no fundamental defense.

**Correct approach:**

```
Content-Security-Policy:
    default-src 'self';
    script-src 'self' 'nonce-{server-generated-random}' 'strict-dynamic';
    style-src 'self' 'nonce-{server-generated-random}';
```

Use a nonce-based CSP, generate a random nonce per request on the server side, and attach it only to legitimate script elements. Combining with `strict-dynamic` automatically permits scripts dynamically loaded by trusted scripts.

### 7.2 Anti-Pattern 2: Attempting to Combine `Access-Control-Allow-Origin: *` with `credentials: true` in CORS

**Problematic code:**

```javascript
// Server side
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Client side
fetch('https://api.example.com/user/profile', {
    credentials: 'include'  // Cross-origin request including cookies
});
```

**Why this is a problem:**

By specification, browsers reject the combination of `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Credentials: true`. When using `credentials: true`, `Access-Control-Allow-Origin` must specify a concrete origin.

However, in an attempt to work around this constraint, a pattern of "echoing back the request's Origin header as Access-Control-Allow-Origin" is often seen. This is effectively the same as allowing all origins and makes the application vulnerable to CSRF attacks.

**Correct approach:**

```javascript
// Server side: manage allowed origins with a whitelist
const allowedOrigins = new Set([
    'https://app.example.com',
    'https://staging.example.com',
    'https://admin.example.com'
]);

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');  // Required for cache correctness
    }

    next();
});
```

### 7.3 Anti-Pattern 3: Not Validating origin in postMessage

**Problematic code:**

```javascript
// Receiver: no origin validation
window.addEventListener('message', (event) => {
    // Dangerous: processes messages from any origin
    const data = event.data;
    document.getElementById('output').innerHTML = data.html;
});
```

**Why this is a problem:**

`postMessage` is a safe API for cross-origin communication, but if the receiver does not validate `event.origin`, an attacker's page can send arbitrary messages. The example above also assigns received data directly to `innerHTML`, creating a DOM XSS vulnerability.

**Correct approach:**

```javascript
// Receiver: with origin validation
window.addEventListener('message', (event) => {
    // Origin validation is mandatory
    if (event.origin !== 'https://trusted-partner.com') {
        console.warn('Message from untrusted origin rejected:', event.origin);
        return;
    }

    // Also validate the type and structure of the data
    if (typeof event.data !== 'object' || event.data.type !== 'update') {
        return;
    }

    // Use textContent instead of innerHTML (prevent XSS)
    document.getElementById('output').textContent = event.data.text;
});
```

---

## 8. Edge Case Analysis

### 8.1 Edge Case 1: Origin of `blob:` URLs and `data:` URLs

`blob:` URLs and `data:` URLs follow different origin determination rules than normal HTTP URLs.

```javascript
// Origin of blob: URLs
// → Inherits the origin of the creating document

const htmlContent = '<html><body><script>alert(document.domain)</script></body></html>';
const blob = new Blob([htmlContent], { type: 'text/html' });
const blobUrl = URL.createObjectURL(blob);
// blobUrl = "blob:https://example.com/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
// → The origin of this blob URL is https://example.com

// Origin of data: URLs
// → Treated as Opaque Origin
// → Not same-origin with any other origin

const dataUrl = 'data:text/html,<script>alert(document.domain)</script>';
// → document.domain of a page opened with a data: URL is "" (empty string)
// → From the same-origin policy perspective, it matches no other origin

// Security notes:
// 1. Allowing data: in CSP enables resource loading from data: URLs
//    → Specifying data: in script-src is dangerous
//       An attacker can inject data:text/javascript,alert(1)

// 2. blob: URLs inherit the origin, so
//    blob:-based script execution is allowed by CSP script-src 'self'
//    Some browsers impose additional restrictions

// 3. When using data: URLs in iframes
const iframe = document.createElement('iframe');
iframe.src = 'data:text/html,<h1>Hello</h1>';
// → Inside the iframe is an Opaque Origin
// → DOM access from the parent page causes SecurityError
```

### 8.2 Edge Case 2: Service Worker Scope and Security Boundaries

Service Workers are powerful, but their scope and security boundaries require careful attention.

```javascript
// Service Worker scope restrictions

// The Service Worker script URL determines the upper bound of its scope
// SW registered at /sw.js → scope covers all of /
// SW registered at /app/sw.js → scope covers all of /app/

// Case 1: Trying to exceed the scope upper bound (error)
navigator.serviceWorker.register('/app/sw.js', {
    scope: '/'  // Error: scope of /app/sw.js is limited to /app/
});

// Case 2: Expand upper bound with Service-Worker-Allowed header
// Server attaches the following to the SW script response:
// Service-Worker-Allowed: /
// → This allows the scope of /app/sw.js to extend to /

// Security notes:

// 1. Service Workers can only be registered over HTTPS (or localhost)
// 2. Service Workers are isolated per origin
// 3. Scripts loaded via importScripts() must also be same-origin
//    (external scripts with CORS configured are allowed)

// 4. Relationship between Service Worker cached responses and CSP
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // CSP is also applied to cached responses
                // However, the CSP header from the cached response
                // (the one from the original server response) is used
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});

// 5. Navigation Preload and Service Workers
// → With Navigation Preload, SW startup and
//    network requests run in parallel
// → Security headers from the network response are used
```

### 8.3 Edge Case 3: WebSocket and Same-Origin Policy

```javascript
// WebSocket is not subject to Same-Origin Policy restrictions
// → WebSocket connections to any origin are possible

// This is a deliberate design decision for the following reasons:
// 1. The WebSocket handshake uses HTTP, so the server
//    can validate the Origin header
// 2. WebSocket supports automatic cookie sending by the browser,
//    allowing server-side authentication checks

// Server-side Origin validation (required)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
    const origin = req.headers.origin;
    const allowedOrigins = ['https://app.example.com'];

    if (!allowedOrigins.includes(origin)) {
        ws.close(1008, 'Origin not allowed');
        return;
    }

    // Accept the connection
    ws.on('message', (message) => {
        // Handle message
    });
});

// CSP connect-src also applies to WebSocket
// Content-Security-Policy: connect-src 'self' wss://ws.example.com
```

---

## 9. Exercises

### 9.1 Exercise 1: Basic — CSP Header Design

Design a CSP header that satisfies the following requirements.

**Requirements:**
- Load scripts only from your domain `https://app.example.com`
- Load stylesheets and fonts from CDN `https://cdn.jsdelivr.net`
- Allow fetch requests to API server `https://api.example.com`
- Load images from your domain and any HTTPS source
- Prohibit embedding in iframes entirely
- Control inline scripts with a nonce
- Form submission destination is your domain only

**Model answer:**

```
Content-Security-Policy:
    default-src 'none';
    script-src 'self' 'nonce-{random}' 'strict-dynamic';
    style-src 'self' https://cdn.jsdelivr.net 'nonce-{random}';
    img-src 'self' https:;
    font-src 'self' https://cdn.jsdelivr.net;
    connect-src 'self' https://api.example.com;
    frame-src 'none';
    frame-ancestors 'none';
    form-action 'self';
    base-uri 'self';
    upgrade-insecure-requests;
```

**Explanation:**
- `default-src 'none'` blocks all resources by default; individual resources are allowed using a whitelist approach
- `script-src` specifies `'nonce-{random}'`, where a random nonce is generated per request on the server side
- `'strict-dynamic'` automatically permits scripts dynamically loaded by nonce-bearing scripts
- `frame-ancestors 'none'` prevents clickjacking (equivalent to X-Frame-Options: DENY)
- `upgrade-insecure-requests` automatically upgrades HTTP requests to HTTPS

### 9.2 Exercise 2: Intermediate — CORS Configuration and Debugging

Describe the cause and remedy when the following error message occurs.

**Scenario:**
A frontend at `https://app.example.com` sent a POST request to `https://api.example.com/users` and the following error occurred.

```
Access to fetch at 'https://api.example.com/users' from origin
'https://app.example.com' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Model answer:**

Cause: The server at `https://api.example.com` is not returning appropriate CORS headers in response to the preflight request (OPTIONS method). When a POST request uses `Content-Type: application/json` or an Authorization header, it does not meet the conditions for a Simple Request, so the browser sends a preflight request before the actual request.

Remedy:

```javascript
// Fix on the server side (Express)
app.options('/users', (req, res) => {
    // Respond to preflight request
    res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers',
        'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
});

app.post('/users', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');
    // ... business logic
    res.json({ success: true });
});
```

Debugging points:
1. Check for the presence of an OPTIONS request in the Network tab of the browser DevTools
2. Verify that the OPTIONS response status code is 2xx
3. Verify that the response headers contain the required `Access-Control-Allow-*` headers
4. Verify that the `Vary: Origin` header is set (for CDN/proxy cache correctness)

### 9.3 Exercise 3: Advanced — Comprehensive Security Header Audit

Audit the following HTTP response headers, identify all security issues, and suggest improvements.

```
HTTP/1.1 200 OK
Content-Type: text/html
Set-Cookie: session=abc123; Path=/
X-Powered-By: Express 4.18.2
Server: nginx/1.24.0
```

**Model answer:**

| # | Issue | Risk | Improvement |
|---|-------|------|-------------|
| 1 | No CSP header | XSS attack impact is maximized | Add `Content-Security-Policy` |
| 2 | No HSTS header | Risk of downgrade attacks (HTTP connection) | Add `Strict-Transport-Security` |
| 3 | Cookie has no Secure attribute | Session cookie sent in plaintext over HTTP | Add `Secure` |
| 4 | Cookie has no HttpOnly attribute | Session cookie stolen via XSS | Add `HttpOnly` |
| 5 | Cookie has no SameSite attribute | CSRF attack risk (browser default is Lax but explicit is recommended) | Add `SameSite=Lax` |
| 6 | X-Powered-By header exposed | Framework version info leaks to attackers | Remove `X-Powered-By` |
| 7 | Server header contains version info | Server software vulnerabilities can be identified | Hide the version number |
| 8 | No X-Content-Type-Options | Risk of MIME sniffing attacks | Add `X-Content-Type-Options: nosniff` |
| 9 | No X-Frame-Options | Risk of clickjacking attacks | Add `X-Frame-Options: DENY` |
| 10 | No Referrer-Policy | Sensitive path info may leak via referrer | Add `Referrer-Policy: strict-origin-when-cross-origin` |
| 11 | No Permissions-Policy | Unnecessary browser features may be abused | Disable unnecessary features with `Permissions-Policy` |
| 12 | Cookie has no __Host- prefix | Cookie scope may be too broad | Change to `__Host-session` |

Improved response headers:

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Set-Cookie: __Host-session=abc123; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xxx' 'strict-dynamic'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
```

---

## 10. FAQ

### Q1: My existing site breaks when I introduce CSP. How do I roll it out gradually?

Use the `Content-Security-Policy-Report-Only` header for a gradual CSP rollout. With this header, policy violations are reported but resources are not blocked.

Recommended rollout procedure:

1. **Investigation phase**: Set `Content-Security-Policy-Report-Only` with a relaxed policy and collect reports with `report-uri`. This gives you visibility into all resource sources loaded by the site.

2. **Analysis phase**: Analyze the collected reports to distinguish legitimate resources from unnecessary ones. Identify locations of inline scripts and inline styles, and plan migration to nonces or hashes.

3. **Gradual application**: Start migrating low-impact directives (`object-src 'none'`, `base-uri 'self'`) to the production CSP header first, then gradually expand the scope.

4. **Production application**: Migrate all directives to the `Content-Security-Policy` header and keep `Report-Only` for testing future policy changes.

### Q2: If Same-Origin Policy exists, why do CSRF attacks succeed?

The Same-Origin Policy restricts "reading responses" but does not restrict "sending requests" themselves. Form submissions (`<form method="POST">`) and image tag requests (`<img src="...">`) are sent even cross-origin. The browser automatically attaches the target site's cookies to these requests.

Attacker's page:
```html
<!-- Page set up by the attacker on evil.com -->
<form id="csrf-form"
      action="https://bank.example.com/transfer"
      method="POST">
    <input type="hidden" name="to" value="attacker-account">
    <input type="hidden" name="amount" value="1000000">
</form>
<script>document.getElementById('csrf-form').submit();</script>
```

In this case:
- The browser sends a POST request to `bank.example.com`
- If the user is logged in to `bank.example.com`, cookies are automatically attached
- The server cannot distinguish it from a legitimate request

**Countermeasures:**
- `SameSite=Lax` or `SameSite=Strict` Cookie attribute
- CSRF token (embed a random server-generated token in the form)
- Origin header validation
- Require a custom header (`X-Requested-With`, etc.; a preflight occurs, making CSRF harder)

### Q3: How does `strict-dynamic` in Content-Security-Policy work?

`strict-dynamic` is a source expression introduced in CSP Level 3 that propagates trust to scripts dynamically generated or loaded by scripts already trusted via a nonce or hash.

```javascript
// CSP header:
// Content-Security-Policy: script-src 'nonce-abc123' 'strict-dynamic'

// The following nonce-bearing script executes
// <script nonce="abc123">
//     // Scripts dynamically loaded by this script are also permitted
//     const script = document.createElement('script');
//     script.src = 'https://any-cdn.com/library.js';
//     document.head.appendChild(script);
//     // → This script executes via 'strict-dynamic'
//     //   (even without any-cdn.com in the whitelist)
// </script>
```

Behavior when `strict-dynamic` is enabled:
- Scripts added via `createElement('script')` from scripts directly trusted by nonce/hash are automatically permitted
- Scripts inserted via `document.write()` are blocked (parser-inserted scripts are dangerous)
- URL-based source expressions like `https:` or `http:` are ignored (`strict-dynamic` takes precedence)
- `'self'` and specific hostnames are also ignored

This maintains compatibility with existing script loaders and module bundlers while blocking inline scripts directly injected by attackers.

### Q4: Why is it necessary to set both `X-Frame-Options` and CSP's `frame-ancestors`?

`X-Frame-Options` is an older header that supports only two values: `DENY` and `SAMEORIGIN`. CSP's `frame-ancestors` is more flexible and can specify particular origins. The reason to set both is as a fallback for older browsers that do not support CSP's `frame-ancestors`.

However, when both are set, CSP `frame-ancestors` takes precedence (per the CSP spec). Therefore, modern browsers that support CSP use the `frame-ancestors` value, while legacy browsers that do not support CSP use `X-Frame-Options`.

### Q5: What is the role of browser extensions in the browser security model?

Browser extensions have higher privileges than normal web pages and occupy a special position in the security model.

- Extensions operate based on the permissions declared in `manifest.json`
- `content_scripts` can access web page DOM but operate in an isolated JavaScript execution environment (isolated world)
- `background` scripts (Service Worker) have privileged access to browser APIs
- CSP applies to web pages; extensions have their own CSP applied
- Extensions can intercept and modify network requests via the `webRequest` API (migrated to `declarativeNetRequest` in Manifest V3)

Extension installation requires an explicit user action and goes through a store review process, providing a certain level of trustworthiness. However, malicious extensions can bypass the browser security model, so choosing extensions carefully is important.

### Q6: What are the best practices for CSP configuration?

Recommended best practices for CSP in production:

**1. Adopt nonce-based CSP**
```http
Content-Security-Policy:
  script-src 'nonce-{random}' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
```

- Generate a different nonce per request and attach it to trusted script tags
- `'strict-dynamic'` also permits scripts dynamically loaded by nonce-bearing scripts
- Avoid `'unsafe-inline'` and `'unsafe-eval'` (allow attackers to inject inline scripts)

**2. Explicitly set all important directives**
```http
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{random}' 'strict-dynamic';
  style-src 'self' 'nonce-{random}';
  img-src 'self' https: data:;
  font-src 'self';
  connect-src 'self';
  frame-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'none';
  object-src 'none';
  upgrade-insecure-requests;
```

**3. Test with Report-Only mode**
Before applying to production, monitor violations with `Content-Security-Policy-Report-Only` to prevent false positives.

**4. Configure a report collection endpoint**
```http
Content-Security-Policy: ...; report-uri /csp-violation-report;
```
Collecting and analyzing CSP violations detects attack attempts and configuration errors.

**5. Harden gradually**
Start with `default-src 'self'` and gradually eliminate `'unsafe-inline'`, migrating to nonce/hash-based approaches.

### Q7: Please explain the browser sandbox mechanism in detail.

The browser sandbox uses OS-level privilege restriction mechanisms to strictly limit the operations a renderer process can perform.

**Sandbox implementation on Windows:**
- **Job Objects**: Apply resource restrictions to process groups
- **Integrity Levels**: Assign a "Low Integrity" label to the process, prohibiting access to resources at higher Integrity Levels
- **Restricted Tokens**: Remove many privileges from the process's access token
- **AppContainer**: Sandbox environment introduced in Windows 8, similar to UWP apps

**Sandbox implementation on macOS:**
- **Seatbelt (sandbox-exec)**: Apple's proprietary sandbox framework
- Define accessible resources (file system, network, IPC, etc.) in a profile
- The renderer process starts with a heavily restricted profile

**Sandbox implementation on Linux:**
- **namespaces**: Isolate resources visible to the process (PID, network, mount points, etc.)
- **seccomp-bpf**: Filter system calls so only allowed ones can execute
- **cgroups**: Restrict resource usage (CPU, memory, etc.)

**What the sandbox restricts:**
- Direct file system access is prohibited (accessible only via the browser process)
- Direct network socket creation is prohibited
- Device driver access is prohibited
- Access to other processes is prohibited
- Direct access to the window system is restricted

As a result, even if a renderer process is compromised by an attacker, they cannot read the user's files or install malware. For an attacker to further compromise the system, they would need to find a vulnerability to escape the sandbox (sandbox escape is an advanced attack and typically commands high bounties in bug bounty programs).

---

## 11. Evolution of Browser Security and Future Outlook

### 11.1 Privacy Sandbox

Privacy Sandbox, promoted by Google, is an initiative aimed at building a web ecosystem that does not rely on third-party cookies. It consists of the following major APIs.

| API Name | Purpose | Replaces Third-Party Cookie For |
|----------|----------|---------------------------------|
| Topics API | Interest-based advertising | Cookie-based user profiling |
| Protected Audience (FLEDGE) | Retargeting advertising | Third-party cookie retargeting |
| Attribution Reporting | Conversion measurement | Cookie-based attribution |
| Private State Tokens | Fraud prevention (bot detection) | Third-party cookie trust evaluation |
| FedCM | Auth federation (SSO) | Third-party cookie SSO |
| CHIPS | Partitioned cookies | Unrestricted third-party cookies |
| Fenced Frames | Ad display isolation | iframe + third-party cookies |
| Shared Storage | Limited cross-site storage | Third-party cookie state sharing |

### 11.2 Speculation Rules API and Security

The Speculation Rules API declaratively controls page pre-rendering and prefetching. From a security standpoint, the following considerations are important.

```html
<!-- Speculation Rules example -->
<script type="speculationrules">
{
    "prerender": [
        {
            "where": {
                "href_matches": "/products/*"
            },
            "eagerness": "moderate"
        }
    ],
    "prefetch": [
        {
            "urls": ["/api/featured-products"],
            "requires": ["anonymous-client-ip-when-cross-origin"]
        }
    ]
}
</script>

<!--
  Security considerations:
  1. Pre-rendered pages may produce side effects (API calls, analytics, etc.)
     before the user actually navigates
  2. Cross-origin prefetches may expose the user's IP address
     to the prefetch target
     → Mitigated by "requires": ["anonymous-client-ip-when-cross-origin"]
  3. CSP is also applied to pre-rendered pages
-->
```

---

## FAQ

### Q1: How do I prevent existing inline scripts from breaking when introducing CSP?
To roll out CSP gradually, first use the `Content-Security-Policy-Report-Only` header to collect only violation reports and understand the scope of impact. Then attach a `nonce` attribute to inline scripts (a value randomly generated server-side for each request) and specify `'nonce-<value>'` in the CSP header, which allows only legitimate inline scripts to execute. Use `'unsafe-inline'` as a last resort; wherever possible, the combination of `nonce` + `strict-dynamic` is recommended.

### Q2: How should I think about the relationship between Same-Origin Policy and CORS?
The Same-Origin Policy (SOP) is the browser's default security policy that restricts cross-origin resource access. CORS (Cross-Origin Resource Sharing) is a mechanism to safely introduce exceptions to SOP. When a server explicitly specifies an allowed origin in the `Access-Control-Allow-Origin` header, the browser exposes the cross-origin request response to JavaScript. SOP is "deny by default," and CORS is "explicitly allow."

### Q3: How should I choose between Lax, Strict, and None for the SameSite Cookie attribute?
`SameSite=Lax` (default) sends cookies on top-level navigation (link clicks) but does not send cross-site cookies in iframes or AJAX requests. This is the most versatile choice. `SameSite=Strict` never sends cookies in cross-site requests, meaning the logged-in state is not maintained even when arriving via a link from an external site. `SameSite=None; Secure` sends cookies cross-site but requires HTTPS, and will face increasing restrictions as third-party cookies are phased out. Using `Lax` for authentication cookies and `None` for embedded widgets is common practice.

---

## Summary

### Security Mechanism Reference Table

| Concept | Protected Against | Configured At | Key Point |
|---------|-------------------|---------------|-----------|
| Sandbox | Process privilege escalation | OS/browser internals | Renderer privilege restriction, OS isolation |
| Same-Origin Policy | Cross-origin data theft | Browser internals (automatic) | Determined by scheme + host + port |
| CSP | XSS impact mitigation | HTTP header | nonce + strict-dynamic recommended |
| Site Isolation | Spectre and side-channel attacks | Browser internals (automatic) | Run different sites in separate processes |
| Cookie security | Session hijacking, CSRF | Set-Cookie header | Secure + HttpOnly + SameSite=Lax |
| SRI | CDN resource tampering | HTML integrity attribute | sha384 or stronger hash recommended |
| CORS | Safe cross-origin communication | HTTP response headers | Whitelist + Vary: Origin |
| Trusted Types | DOM XSS | CSP + JavaScript API | Prohibit direct string assignment to innerHTML etc. |
| HSTS | Downgrade attacks | HTTP response header | Adding to preload list is recommended |
| Permissions Policy | Misuse of unnecessary features | HTTP header / iframe attribute | Explicitly disable features you don't use |

### Security Checklist

Before deploying to production, it is recommended to verify the following items.

- [ ] HTTPS is enabled and HTTP redirect is configured
- [ ] HSTS header is set (with a sufficiently long `max-age`)
- [ ] CSP header is set without `unsafe-inline` / `unsafe-eval`
- [ ] Cookies have Secure, HttpOnly, and SameSite attributes
- [ ] X-Content-Type-Options: nosniff is set
- [ ] X-Frame-Options or CSP frame-ancestors is set
- [ ] CDN resources have SRI (integrity attribute)
- [ ] CORS configuration uses a whitelist approach
- [ ] Version information in Server / X-Powered-By headers is hidden
- [ ] Referrer-Policy is appropriately configured
- [ ] Unnecessary features are disabled with Permissions-Policy

---

## Next Guides to Read

- [Rendering Pipeline](../01-rendering/00-rendering-pipeline.md)
- Browser Storage (Cookie, localStorage, IndexedDB in detail)
- Fetch API and CORS in practice

---

## References

1. Chromium Project. "Site Isolation Design Document." The Chromium Projects, 2018. https://www.chromium.org/Home/chromium-security/site-isolation/
2. MDN Web Docs. "Content Security Policy (CSP)." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
3. W3C. "Content Security Policy Level 3." W3C Working Draft, 2023. https://www.w3.org/TR/CSP3/
4. Reis, C., Moshchuk, A., and Oskov, N. "Site Isolation: Process Separation for Web Sites within the Browser." USENIX Security Symposium, 2019.
5. Kocher, P., Horn, J., Fogh, A. et al. "Spectre Attacks: Exploiting Speculative Execution." IEEE S&P, 2019.
6. Google. "Privacy Sandbox." Web.dev, 2024. https://web.dev/privacy-sandbox/
7. OWASP. "OWASP Secure Headers Project." OWASP Foundation, 2024. https://owasp.org/www-project-secure-headers/
8. Barth, A. "The Web Origin Concept." RFC 6454, IETF, 2011.
9. West, M. "Incrementally Better Cookies." RFC 6265bis, IETF, 2024.
10. W3C. "Trusted Types." W3C Working Draft, 2023. https://www.w3.org/TR/trusted-types/
