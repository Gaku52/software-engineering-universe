# HTTP Basics

> HTTP is the foundational protocol of the Web. Understand the request/response model, methods, status codes, and headers to build the essential knowledge required for web development.

## Prerequisites


HTTP operates on top of TCP (or QUIC for HTTP/3) and uses DNS to resolve host names. Having this foundational knowledge allows you to understand how HTTP works at a deeper level.

---

## What You Will Learn

- [ ] Understand the structure of HTTP requests and responses
- [ ] Learn the meaning of each HTTP method and when to use them
- [ ] Study status code categories and key codes
- [ ] Understand the types and roles of HTTP headers
- [ ] Understand the relationship between connection management and performance
- [ ] Learn the basics of HTTPS and security
- [ ] Acquire HTTP debugging techniques for practical use

---

## 1. HTTP Fundamentals

```
HTTP (HyperText Transfer Protocol):
  → Protocol for transferring data over the Web
  → Stateless (each request is independent)
  → Text-based (HTTP/1.1) → Binary (HTTP/2 onward)
  → Runs on TCP (HTTP/1.1, HTTP/2) or UDP (HTTP/3)

Version history:
  HTTP/0.9 (1991): GET only, HTML only, no headers
  HTTP/1.0 (1996): Added headers, POST, status codes
                    TCP connection closed after each request
  HTTP/1.1 (1997): Keep-Alive, chunked transfer, Host header required
                    Pipelining (rarely used)
                    RFC 2616 → RFC 7230-7235 → RFC 9110-9112
  HTTP/2   (2015): Binary, multiplexing, server push, HPACK
                    RFC 7540 → RFC 9113
  HTTP/3   (2022): QUIC-based, runs over UDP, QPACK
                    RFC 9114

Request/Response model:
  Client                          Server
  ┌──────────┐                 ┌──────────┐
  │ Browser  │── Request ─────→│ Web Server│
  │          │←── Response ────│          │
  └──────────┘                 └──────────┘

  Communication flow (HTTP/1.1 + TLS):
  ① TCP 3-way handshake (SYN → SYN-ACK → ACK)
  ② TLS handshake (ClientHello → ServerHello → ...)
  ③ Send HTTP request
  ④ Receive HTTP response
  ⑤ Keep-Alive: send next request on the same TCP connection
  ⑥ Disconnect after idle timeout

What "stateless" means:
  → Each request carries no information from previous requests
  → The server does not remember client state
  → When state management is needed:
     · Cookie (session ID)
     · Token (JWT etc.)
     · Query parameters
     · Local storage

Benefits of stateless:
  → Easy horizontal scaling of servers
  → Any server can handle any request
  → Simple recovery on failure
  → Caching is effective

Drawbacks of stateless:
  → Authentication credentials must be sent every time
  → Requests tend to be large
  → A separate mechanism is needed for session management
```

---

## 2. HTTP Requests

```
Request structure:

  ┌─────────────────────────────────────────┐
  │ GET /api/users?page=1 HTTP/1.1          │ ← Request line
  ├─────────────────────────────────────────┤
  │ Host: api.example.com                   │ ← Headers
  │ Accept: application/json                │
  │ Authorization: Bearer eyJhbG...         │
  │ User-Agent: Mozilla/5.0                 │
  │ Accept-Encoding: gzip, deflate          │
  │ Connection: keep-alive                  │
  ├─────────────────────────────────────────┤
  │                                         │ ← Blank line (end of headers)
  ├─────────────────────────────────────────┤
  │ (Body — usually absent for GET)         │
  └─────────────────────────────────────────┘

Request-line structure:
  Method SP Request-Target SP HTTP-Version CRLF

  GET /api/users?page=1&sort=name HTTP/1.1\r\n
  ↑   ↑                          ↑
  Method  Request-Target         HTTP-Version

  Request-target forms:
  ① origin-form:   /api/users?page=1 (most common)
  ② absolute-form: http://example.com/api/users (via proxy)
  ③ authority-form: example.com:443 (for CONNECT method)
  ④ asterisk-form: * (for OPTIONS method)

POST request example:
  POST /api/users HTTP/1.1
  Host: api.example.com
  Content-Type: application/json
  Content-Length: 52
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  Accept: application/json
  X-Request-Id: 550e8400-e29b-41d4-a716-446655440000

  {"name": "Taro", "email": "taro@example.com"}

Form data example:
  POST /login HTTP/1.1
  Host: example.com
  Content-Type: application/x-www-form-urlencoded
  Content-Length: 32

  username=taro&password=secret123

Multipart form data example (file upload):
  POST /api/files HTTP/1.1
  Host: api.example.com
  Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
  Content-Length: 1234

  ------WebKitFormBoundary
  Content-Disposition: form-data; name="description"

  Profile image
  ------WebKitFormBoundary
  Content-Disposition: form-data; name="file"; filename="avatar.png"
  Content-Type: image/png

  [binary data]
  ------WebKitFormBoundary--
```

---

## 3. HTTP Methods

```
┌────────┬──────────────────────────┬────────┬────────┬──────┐
│ Method │ Purpose                  │Idempot.│ Safe   │ Body │
├────────┼──────────────────────────┼────────┼────────┼──────┤
│ GET    │ Retrieve a resource      │ ✓      │ ✓      │ None │
│ POST   │ Create a resource        │ ✗      │ ✗      │ Yes  │
│ PUT    │ Replace a resource fully │ ✓      │ ✗      │ Yes  │
│ PATCH  │ Partially update         │ ✗      │ ✗      │ Yes  │
│ DELETE │ Delete a resource        │ ✓      │ ✗      │ Opt. │
│ HEAD   │ Retrieve headers only    │ ✓      │ ✓      │ None │
│ OPTIONS│ Check supported methods  │ ✓      │ ✓      │ None │
│ TRACE  │ Loopback test            │ ✓      │ ✓      │ None │
│ CONNECT│ Establish tunnel (HTTPS) │ ✗      │ ✗      │ None │
└────────┴──────────────────────────┴────────┴────────┴──────┘

Idempotency:
  → Sending the same request multiple times yields the same result
  → GET, PUT, DELETE are idempotent
  → POST is not idempotent (creates a new resource each time)
  → PATCH is not idempotent (relative changes may accumulate)

  Practical significance of idempotency:
  → When a network error makes it unclear whether a request was received
  → Idempotent methods can be safely retried
  → Non-idempotent methods use an Idempotency-Key header

  Example: payment API
  POST /api/payments
  Idempotency-Key: unique-key-12345
  → Re-sending with the same key prevents double charging

Safety:
  → Does not modify server state
  → GET, HEAD, OPTIONS are safe
  → Safe methods can be prefetched and cached
  → Web crawlers should use only safe methods

Practical usage:
  List:         GET  /api/users
  Detail:       GET  /api/users/123
  Create:       POST /api/users
  Full update:  PUT  /api/users/123
  Partial update: PATCH /api/users/123
  Delete:       DELETE /api/users/123
  Check exists: HEAD /api/users/123
  CORS check:   OPTIONS /api/users

Details of each method:

  GET:
  → Used to retrieve resources
  → Should not include a body (RFC 9110)
  → Use query parameters for filtering and pagination
  → Subject to caching
  → Bookmarkable
  → Safe to re-send with browser back button

  POST:
  → Used to create resources or trigger processing
  → Include data in the body
  → On success: 201 Created + Location header
  → Not cached (in general)
  → Same request may return different results

  PUT:
  → Used to fully replace a resource
  → Creates the resource if it does not exist (implementation-specific)
  → The sent data is the complete representation of the resource
  → Omitted fields become null/default values
  → Do not use for partial updates → use PATCH instead

  PATCH:
  → Used for partial updates
  → Send only the fields to change
  → JSON Merge Patch (RFC 7396):
    {"name": "Updated Name"}  ← updates only the name field
  → JSON Patch (RFC 6902):
    [{"op": "replace", "path": "/name", "value": "Updated Name"}]

  DELETE:
  → Used to delete a resource
  → On success: 204 No Content or 200 OK
  → Returns 204 even if already deleted (idempotency)
  → Soft delete vs. hard delete
```

```typescript
// TypeScript implementation examples for each method

// GET — retrieve a resource
async function getUsers(page: number = 1, perPage: number = 20): Promise<User[]> {
  const response = await fetch(
    `https://api.example.com/api/users?page=${page}&per_page=${perPage}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data.users;
}

// POST — create a resource
async function createUser(userData: CreateUserInput): Promise<User> {
  const response = await fetch('https://api.example.com/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': generateIdempotencyKey(),
    },
    body: JSON.stringify(userData),
  });

  if (response.status !== 201) {
    const error = await response.json();
    throw new HttpError(response.status, error.message);
  }

  // Get the URL of the created resource from the Location header
  const location = response.headers.get('Location');
  console.log(`Created at: ${location}`);

  return response.json();
}

// PUT — fully replace a resource
async function replaceUser(id: string, userData: User): Promise<User> {
  const response = await fetch(`https://api.example.com/api/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

// PATCH — partially update a resource
async function updateUser(
  id: string,
  updates: Partial<User>,
): Promise<User> {
  const response = await fetch(`https://api.example.com/api/users/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/merge-patch+json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'If-Match': currentETag,  // optimistic locking
    },
    body: JSON.stringify(updates),
  });

  if (response.status === 409) {
    throw new ConflictError('Resource was modified by another request');
  }

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

// DELETE — delete a resource
async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`https://api.example.com/api/users/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    // Already deleted — may be treated as success from an idempotency standpoint
    console.warn(`User ${id} already deleted`);
    return;
  }

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
}

// HEAD — check existence / retrieve metadata
async function checkUserExists(id: string): Promise<boolean> {
  const response = await fetch(`https://api.example.com/api/users/${id}`, {
    method: 'HEAD',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return response.status === 200;
}

// File upload (multipart/form-data)
async function uploadFile(file: File, description: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('description', description);

  const response = await fetch('https://api.example.com/api/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // Content-Type is set automatically by the browser for FormData
    },
    body: formData,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data.fileUrl;
}
```

---

## 4. Status Codes

```
Status code categories:
  1xx: Informational (processing in progress)
  2xx: Success
  3xx: Redirection
  4xx: Client error
  5xx: Server error

1xx Informational:
  ┌─────┬──────────────────────────────────────────────┐
  │ 100 │ Continue — safe to continue sending body      │
  │     │ → Confirm server can accept before sending     │
  │     │   a large body (use Expect: 100-continue)     │
  │ 101 │ Switching Protocols — protocol upgrade         │
  │     │ → Used when upgrading to WebSocket            │
  │ 102 │ Processing — in progress (WebDAV)             │
  │ 103 │ Early Hints — resource preload hints          │
  │     │ → Link: </style.css>; rel=preload             │
  │     │ → Alternative to HTTP/2 server push           │
  └─────┴──────────────────────────────────────────────┘

2xx Success:
  ┌─────┬──────────────────────────────────────────────┐
  │ 200 │ OK — success (most common)                    │
  │ 201 │ Created — resource creation succeeded         │
  │     │ → Success response for POST                   │
  │     │ → Return the created URL via Location header  │
  │ 202 │ Accepted — request received (not yet done)   │
  │     │ → Notify that async processing has started    │
  │     │ → Often returns a URL for polling             │
  │ 204 │ No Content — success (no body)                │
  │     │ → Success response for DELETE                 │
  │     │ → PUT/PATCH when no body is returned          │
  │ 206 │ Partial Content — partial content             │
  │     │ → Response to a Range request                 │
  │     │ → Video streaming, split download of large files│
  └─────┴──────────────────────────────────────────────┘

3xx Redirection:
  ┌─────┬──────────────────────────────────────────────┐
  │ 301 │ Moved Permanently — permanent redirect        │
  │     │ → Method may change to GET                    │
  │     │ → SEO: search engines index the new URL       │
  │ 302 │ Found — temporary redirect                    │
  │     │ → Method may change to GET                    │
  │     │ → Implementation is ambiguous; prefer 307/308 │
  │ 303 │ See Other — refer to another URI              │
  │     │ → Redirect to GET after POST (PRG pattern)    │
  │ 304 │ Not Modified — cache is valid                 │
  │     │ → Result of a conditional request (If-None-Match etc.)│
  │     │ → No body (use cache)                         │
  │ 307 │ Temporary Redirect — temporary redirect       │
  │     │ → Method is preserved (recommended)           │
  │ 308 │ Permanent Redirect — permanent redirect       │
  │     │ → Method is preserved (recommended)           │
  └─────┴──────────────────────────────────────────────┘

  Choosing between 301, 302, 307, and 308:
  ┌────────────────┬──────────────┬──────────────┐
  │                │ Permanent    │ Temporary    │
  ├────────────────┼──────────────┼──────────────┤
  │ Method changes │ 301          │ 302          │
  │ Method kept    │ 308 (pref.)  │ 307 (pref.)  │
  └────────────────┴──────────────┴──────────────┘

  PRG (Post-Redirect-Get) pattern:
  ① Client: POST /order (submit order)
  ② Server: 303 See Other → /order/123
  ③ Client: GET /order/123 (order confirmation page)
  → Prevents double orders when browser refresh button is pressed

4xx Client errors:
  ┌─────┬──────────────────────────────────────────────┐
  │ 400 │ Bad Request — malformed request               │
  │     │ → JSON syntax error, missing required params  │
  │ 401 │ Unauthorized — not authenticated              │
  │     │ → Authentication required (not logged in)     │
  │     │ → Should include WWW-Authenticate header      │
  │ 403 │ Forbidden — access denied                     │
  │     │ → Authenticated but lacks permission          │
  │     │ → General user accessing an admin-only page   │
  │ 404 │ Not Found — resource does not exist           │
  │     │ → Wrong URL or resource has been deleted      │
  │ 405 │ Method Not Allowed — method not supported     │
  │     │ → Notify allowed methods via Allow header     │
  │     │ → Allow: GET, POST, HEAD                    │
  │ 406 │ Not Acceptable — mismatch with Accept header │
  │ 408 │ Request Timeout — request timed out          │
  │ 409 │ Conflict — conflict                          │
  │     │ → Optimistic lock failure                    │
  │     │ → Invalid resource state transition          │
  │ 410 │ Gone — permanently deleted                   │
  │     │ → Unlike 404, indicates it once existed      │
  │ 411 │ Length Required — Content-Length is required │
  │ 413 │ Content Too Large — body is too large        │
  │ 414 │ URI Too Long — URI is too long               │
  │ 415 │ Unsupported Media Type — Content-Type unsupported│
  │ 422 │ Unprocessable Content — validation error      │
  │     │ → JSON syntax is valid but data is invalid    │
  │ 429 │ Too Many Requests — rate limited              │
  │     │ → Notify retry time via Retry-After header    │
  │ 451 │ Unavailable For Legal Reasons — legal reason │
  └─────┴──────────────────────────────────────────────┘

  401 vs 403:
  → 401: "Who are you?" (authentication required)
  → 403: "You cannot enter" (authenticated but lacks permission)
  → Not logged in → 401
  → Logged in + insufficient permission → 403
  → For security, sometimes 404 is returned to hide resource existence

  400 vs 422:
  → 400: Request syntax is invalid (JSON parse error etc.)
  → 422: Syntax is valid but semantically invalid (validation failure)
  → In practice, using 400 uniformly is also common

5xx Server errors:
  ┌─────┬──────────────────────────────────────────────┐
  │ 500 │ Internal Server Error — internal error        │
  │     │ → Unhandled exception or bug on server side   │
  │     │ → Do not return details to client (security)  │
  │ 502 │ Bad Gateway — upstream server error           │
  │     │ → Proxy/gateway received invalid response     │
  │     │   from upstream server                        │
  │ 503 │ Service Unavailable — service down            │
  │     │ → Under maintenance or overloaded             │
  │     │ → Notify recovery time via Retry-After header │
  │ 504 │ Gateway Timeout — upstream timeout            │
  │     │ → Proxy could not get a response from upstream│
  └─────┴──────────────────────────────────────────────┘

  Retry strategy for 5xx errors:
  → 500: Retrying is likely to yield the same result
  → 502: Possible temporary upstream issue → retry recommended
  → 503: Temporary overload → retry with backoff
  → 504: Timeout → retry recommended
  → Use exponential backoff + jitter when retrying
```

---

## 5. HTTP Headers

```
Header categories:

  ① Request headers (client → server)
  ② Response headers (server → client)
  ③ Representation headers (information about resource representation)
  ④ Payload headers (information about the body)

Key request headers:
  ┌───────────────────────┬────────────────────────────────┐
  │ Header                │ Description                    │
  ├───────────────────────┼────────────────────────────────┤
  │ Host                  │ Target host (required in HTTP/1.1)│
  │ Accept                │ Acceptable media types         │
  │ Accept-Charset        │ Acceptable character sets      │
  │ Accept-Encoding       │ Acceptable compression formats │
  │ Accept-Language       │ Preferred language             │
  │ Authorization         │ Authentication credentials     │
  │ Cookie                │ Cookies                        │
  │ Content-Type          │ Media type of the body         │
  │ Content-Length        │ Size of the body (bytes)       │
  │ User-Agent            │ Client information             │
  │ Referer               │ Referring URL                  │
  │ Origin                │ Request origin (CORS)          │
  │ If-None-Match         │ Conditional request (ETag)     │
  │ If-Modified-Since     │ Conditional request (date/time)│
  │ Range                 │ Request for partial resource   │
  │ Cache-Control         │ Cache control (request side)   │
  │ X-Forwarded-For       │ Original client IP via proxy   │
  │ X-Request-Id          │ Request tracking ID            │
  └───────────────────────┴────────────────────────────────┘

Key response headers:
  ┌───────────────────────────┬────────────────────────────────┐
  │ Header                    │ Description                    │
  ├───────────────────────────┼────────────────────────────────┤
  │ Content-Type              │ Media type of the body         │
  │ Content-Length            │ Size of the body (bytes)       │
  │ Content-Encoding          │ Compression format of the body │
  │ Content-Disposition       │ Filename on download           │
  │ Set-Cookie                │ Cookie settings                │
  │ Cache-Control             │ Cache control                  │
  │ ETag                      │ Resource version               │
  │ Last-Modified             │ Resource last modified time    │
  │ Location                  │ Redirect or created URI        │
  │ WWW-Authenticate          │ Specify auth method (on 401)   │
  │ Allow                     │ List of allowed methods (on 405)│
  │ Retry-After               │ Retry time (on 429/503)        │
  │ Access-Control-Allow-*    │ CORS headers                   │
  │ Strict-Transport-Security │ HSTS (enforce HTTPS)           │
  │ X-Content-Type-Options    │ Prevent MIME sniffing          │
  │ X-Frame-Options           │ Prevent clickjacking           │
  │ Content-Security-Policy   │ CSP (prevent XSS)             │
  │ X-Request-Id              │ Request tracking (custom)      │
  └───────────────────────────┴────────────────────────────────┘

Common values for Content-Type:
  ┌─────────────────────────────────────┬──────────────────────┐
  │ Content-Type                        │ Use case             │
  ├─────────────────────────────────────┼──────────────────────┤
  │ application/json                    │ JSON                 │
  │ application/json; charset=utf-8     │ JSON (with charset)  │
  │ application/x-www-form-urlencoded   │ Form data            │
  │ multipart/form-data                 │ File upload          │
  │ text/html; charset=utf-8            │ HTML                 │
  │ text/plain                          │ Plain text           │
  │ text/css                            │ CSS                  │
  │ text/javascript                     │ JavaScript           │
  │ application/javascript              │ JavaScript (preferred)│
  │ application/xml                     │ XML                  │
  │ application/octet-stream            │ Binary data          │
  │ image/png                           │ PNG image            │
  │ image/jpeg                          │ JPEG image           │
  │ image/svg+xml                       │ SVG                  │
  │ application/pdf                     │ PDF                  │
  │ application/zip                     │ ZIP                  │
  │ application/graphql+json            │ GraphQL              │
  │ application/problem+json            │ RFC 7807 error       │
  │ application/merge-patch+json        │ JSON Merge Patch     │
  │ application/json-patch+json         │ JSON Patch           │
  └─────────────────────────────────────┴──────────────────────┘

Content negotiation with the Accept header:
  Accept: application/json, text/html;q=0.9, */*;q=0.8

  → Use q-value (quality value) to set preference
  → q=1.0 is the default (highest priority)
  → Server returns the most appropriate format

  Accept-Language: ja, en-US;q=0.9, en;q=0.8
  → Japanese first, then US English, then English in general

  Accept-Encoding: gzip, deflate, br
  → Accept compression in order: gzip, deflate, Brotli
```

---

## 6. HTTP Responses

```
Response structure:

  ┌─────────────────────────────────────────┐
  │ HTTP/1.1 200 OK                         │ ← Status line
  ├─────────────────────────────────────────┤
  │ Content-Type: application/json          │ ← Headers
  │ Content-Length: 85                      │
  │ Cache-Control: no-cache                 │
  │ ETag: "abc123"                          │
  │ X-Request-Id: 550e8400-e29b-...        │
  │ Strict-Transport-Security: max-age=...  │
  ├─────────────────────────────────────────┤
  │                                         │ ← Blank line
  ├─────────────────────────────────────────┤
  │ {                                       │ ← Body
  │   "id": "123",                          │
  │   "name": "Taro",                       │
  │   "email": "taro@example.com"           │
  │ }                                       │
  └─────────────────────────────────────────┘

Status-line structure:
  HTTP-Version SP Status-Code SP Reason-Phrase CRLF

  HTTP/1.1 200 OK\r\n
  ↑        ↑   ↑
  Version  Code  Reason phrase

  Note: HTTP/2 and later do not send a reason phrase

Chunked transfer encoding (HTTP/1.1):
  HTTP/1.1 200 OK
  Transfer-Encoding: chunked
  Content-Type: text/html

  4\r\n          ← chunk size (hexadecimal)
  Wiki\r\n       ← chunk data
  6\r\n
  pedia \r\n
  0\r\n          ← terminal chunk (size 0)
  \r\n           ← end of trailers

  → Used when Content-Length is unknown
  → Server sends data incrementally as it is generated
  → Not needed in HTTP/2+ since data is sent in frames

Compressed response:
  HTTP/1.1 200 OK
  Content-Encoding: gzip
  Content-Type: application/json
  Vary: Accept-Encoding

  [gzip-compressed binary data]

  Comparison of compression formats:
  ┌──────────┬────────────┬────────────────────┐
  │ Format   │ Ratio      │ Browser support    │
  ├──────────┼────────────┼────────────────────┤
  │ gzip     │ Good       │ All browsers       │
  │ deflate  │ Good       │ All browsers       │
  │ br       │ Best       │ All major browsers │
  │ zstd     │ Excellent  │ Growing support    │
  └──────────┴────────────┴────────────────────┘

  Brotli (br) benefits:
  → 15–25% smaller than gzip for text data
  → Slightly slower compression than gzip
  → Requires HTTPS (not available over HTTP)
  → Pre-compress static files to avoid speed issues
```

---

## 7. Connection Management

```
HTTP/1.0:
  → Establishes and closes TCP connection for each request
  → Inefficient (3-way handshake every time)

  Connect ── Request ── Response ── Disconnect
  Connect ── Request ── Response ── Disconnect
  Connect ── Request ── Response ── Disconnect

HTTP/1.1 Keep-Alive:
  → Send multiple requests over a single TCP connection
  → Connection: keep-alive (default in HTTP/1.1)
  → Connection: close to explicitly close

  Connect ── Request 1 ── Response 1
          ── Request 2 ── Response 2
          ── Request 3 ── Response 3 ── Disconnect

  Keep-Alive settings (server side):
  → Timeout: maximum idle time
  → Max requests: maximum number of requests per connection

  Nginx:
  keepalive_timeout 65;    # 65 seconds
  keepalive_requests 100;  # up to 100 requests

HTTP/1.1 Pipelining:
  → Send the next request without waiting for the previous response
  → Responses must be returned in the same order as requests
  → Head-of-Line Blocking problem
  → Rarely used in practice (disabled in browsers too)

  Request 1 ── Request 2 ── Request 3
  Response 1 ── Response 2 ── Response 3
  (If Response 1 is slow, everything waits)

Concurrent connections in HTTP/1.1:
  → Browser opens up to 6 connections to the same domain (implementation-specific)
  → This allows a maximum of 6 requests in parallel
  → Domain sharding: increase connection count by using multiple domains
     → Counterproductive in HTTP/2 (one connection can multiplex)

HTTP/2 multiplexing:
  → Handle multiple streams in parallel over a single TCP connection
  → Eliminates Head-of-Line Blocking (at the HTTP layer)
  → Fewer connections → better resource efficiency

  Stream 1: ── Request ── Response ──
  Stream 2: ── Request ──── Response ──
  Stream 3: ── Request ── Response ──
  (All in parallel over a single TCP connection)
```

---

## 8. Cookies

```
How cookies work:

  Server → Client:
  Set-Cookie: session_id=abc123; Path=/; HttpOnly; Secure; SameSite=Lax

  Client → Server (subsequent requests):
  Cookie: session_id=abc123

Set-Cookie attributes:
  ┌───────────────┬───────────────────────────────────────────┐
  │ Attribute     │ Description                                │
  ├───────────────┼───────────────────────────────────────────┤
  │ Name=Value    │ Cookie name and value                      │
  │ Domain        │ Domain to send to (including subdomains)   │
  │ Path          │ Path to send to                            │
  │ Expires       │ Expiry (specific date/time)                │
  │ Max-Age       │ Expiry (seconds; takes precedence over Expires)│
  │ HttpOnly      │ Not accessible via JavaScript (XSS defense)│
  │ Secure        │ Send only over HTTPS connections           │
  │ SameSite      │ Controls sending in cross-site requests    │
  │               │ Strict: never send cross-site              │
  │               │ Lax: send only on top-level navigation (default)│
  │               │ None: always send (Secure required)        │
  │ Partitioned   │ CHIPS (third-party cookie isolation)       │
  │ __Host-prefix │ Enforces Secure, Path=/, no Domain         │
  │ __Secure-prefix│ Enforces Secure                           │
  └───────────────┴───────────────────────────────────────────┘

Recommended secure cookie settings:
  Set-Cookie: __Host-session=abc123;
    Path=/;
    Secure;
    HttpOnly;
    SameSite=Lax;
    Max-Age=3600

  → __Host- prefix: locks to domain, requires Secure
  → HttpOnly: prevents cookie theft via XSS attacks
  → Secure: prevents sending over non-HTTPS
  → SameSite=Lax: prevents CSRF attacks
  → Max-Age: sets session expiry

Cookie vs Token (JWT):
  ┌────────────────┬──────────────┬──────────────┐
  │                │ Cookie       │ JWT          │
  ├────────────────┼──────────────┼──────────────┤
  │ Storage        │ Browser auto │ JS-managed   │
  │ Sending        │ Automatic    │ Manual       │
  │ CSRF defense   │ Required     │ Not needed   │
  │ XSS defense    │ HttpOnly     │ Difficult    │
  │ Size           │ 4KB limit    │ Less limited │
  │ Server state   │ Session      │ Stateless    │
  │ Logout         │ Destroy sess.│ Invalidate token│
  │ Cross-domain   │ SameSite limit│ Flexible    │
  └────────────────┴──────────────┴──────────────┘
```

---

## 9. Security Headers

```
Recommended security headers:

  ① Strict-Transport-Security (HSTS):
     Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
     → Enforce HTTPS (automatically redirect HTTP to HTTPS)
     → max-age: duration the browser remembers (1 year)
     → includeSubDomains: also applies to subdomains
     → preload: register in browser preload list

  ② Content-Security-Policy (CSP):
     Content-Security-Policy:
       default-src 'self';
       script-src 'self' https://cdn.example.com;
       style-src 'self' 'unsafe-inline';
       img-src 'self' data: https:;
       connect-src 'self' https://api.example.com;
       font-src 'self' https://fonts.googleapis.com;
       frame-ancestors 'none';
     → Prevent XSS attacks
     → Restrict allowed resource origins

  ③ X-Content-Type-Options:
     X-Content-Type-Options: nosniff
     → Disable MIME type sniffing
     → Strictly interpret Content-Type

  ④ X-Frame-Options:
     X-Frame-Options: DENY
     → Prohibit embedding in iframes
     → Prevent clickjacking
     → Superseded by CSP frame-ancestors

  ⑤ Referrer-Policy:
     Referrer-Policy: strict-origin-when-cross-origin
     → Control referrer information sent
     → Same origin: full URL
     → Cross origin: origin only

  ⑥ Permissions-Policy:
     Permissions-Policy:
       camera=(),
       microphone=(),
       geolocation=(self),
       payment=(self "https://pay.example.com")
     → Control browser feature permissions

  ⑦ X-XSS-Protection (deprecated but kept for compatibility):
     X-XSS-Protection: 0
     → Disable browser XSS filter
     → CSP is the recommended alternative
```

```typescript
// Security header configuration in Express.js
import helmet from 'helmet';

app.use(helmet());

// Custom configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.example.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.example.com'],
      fontSrc: ["'self'", 'https://fonts.googleapis.com'],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Security header configuration in Nginx
// add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
// add_header X-Content-Type-Options "nosniff" always;
// add_header X-Frame-Options "DENY" always;
// add_header Referrer-Policy "strict-origin-when-cross-origin" always;
// add_header Content-Security-Policy "default-src 'self';" always;
// add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
```

---

## 10. HTTP Debugging

```bash
# === Inspecting HTTP with curl ===

# Show request and response details
curl -v https://api.example.com/users/123

# Response headers only
curl -I https://api.example.com/users/123

# POST request
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-token" \
  -d '{"name": "Taro", "email": "taro@example.com"}'

# PATCH request
curl -X PATCH https://api.example.com/users/123 \
  -H "Content-Type: application/merge-patch+json" \
  -H "Authorization: Bearer my-token" \
  -d '{"name": "Updated Taro"}'

# DELETE request
curl -X DELETE https://api.example.com/users/123 \
  -H "Authorization: Bearer my-token"

# Response body + HTTP status code
curl -s -o /dev/null -w "%{http_code}" https://api.example.com/health

# Display timing information
curl -s -o /dev/null -w "
DNS Lookup:    %{time_namelookup}s
TCP Connect:   %{time_connect}s
TLS Handshake: %{time_appconnect}s
TTFB:          %{time_starttransfer}s
Total Time:    %{time_total}s
" https://api.example.com/users

# Follow redirects
curl -L -v https://example.com/old-page

# File upload
curl -X POST https://api.example.com/files \
  -H "Authorization: Bearer my-token" \
  -F "file=@/path/to/image.png" \
  -F "description=Profile image"

# Save and send cookies
curl -c cookies.txt https://example.com/login
curl -b cookies.txt https://example.com/dashboard

# Connect using HTTP/2
curl --http2 -v https://api.example.com/users

# Via proxy
curl -x http://proxy.example.com:8080 https://api.example.com/users

# Conditional request (ETag)
curl -H "If-None-Match: \"abc123\"" https://api.example.com/users/123

# HTTPie (curl alternative, more human-friendly)
# GET
http GET https://api.example.com/users Authorization:"Bearer my-token"

# POST
http POST https://api.example.com/users \
  name=Taro email=taro@example.com \
  Authorization:"Bearer my-token"

# Response body only
http --body GET https://api.example.com/users
```

```typescript
// === HTTP debugging in the browser ===

// Debugging with Fetch API
async function debugRequest(url: string): Promise<void> {
  console.time('Request Duration');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  console.timeEnd('Request Duration');

  // Status information
  console.log('Status:', response.status, response.statusText);
  console.log('OK:', response.ok);
  console.log('Redirected:', response.redirected);
  console.log('Type:', response.type);
  console.log('URL:', response.url);

  // Response headers
  console.log('Headers:');
  response.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  // Body
  const data = await response.json();
  console.log('Body:', data);
}

// Measurement with Performance API
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'resource') {
      const resource = entry as PerformanceResourceTiming;
      console.log({
        name: resource.name,
        duration: `${resource.duration.toFixed(2)}ms`,
        dns: `${(resource.domainLookupEnd - resource.domainLookupStart).toFixed(2)}ms`,
        tcp: `${(resource.connectEnd - resource.connectStart).toFixed(2)}ms`,
        ttfb: `${(resource.responseStart - resource.requestStart).toFixed(2)}ms`,
        download: `${(resource.responseEnd - resource.responseStart).toFixed(2)}ms`,
        size: resource.transferSize,
        protocol: resource.nextHopProtocol,  // "h2", "h3"
      });
    }
  }
});
observer.observe({ type: 'resource', buffered: true });
```

---

## 11. HTTPS and TLS

```
HTTPS = HTTP + TLS (Transport Layer Security)

  HTTP:   http://example.com (port 80)
  HTTPS:  https://example.com (port 443)

TLS handshake (TLS 1.3):
  Client                   Server
  │── ClientHello ──→      │
  │   (cipher suite list,  │
  │    key share params)   │
  │                        │
  │←── ServerHello ───     │
  │   (selected cipher,    │
  │    key share params,   │
  │    certificate,        │
  │    Finished)           │
  │                        │
  │── Finished ──→         │
  │                        │
  │←→ Encrypted comms ←→  │

  TLS 1.2: connection established in 2 RTT
  TLS 1.3: connection established in 1 RTT (0-RTT reconnect also possible)

Certificate types:
  ┌────────┬──────────────────────────────────┐
  │ Type   │ Description                       │
  ├────────┼──────────────────────────────────┤
  │ DV     │ Domain Validated (auto-issuable)  │
  │ OV     │ Organization Validated (confirms company existence)│
  │ EV     │ Extended Validation (strict review)│
  └────────┴──────────────────────────────────┘

  Let's Encrypt: free DV certificate (auto-renewable)

Why HTTPS is necessary:
  ① Eavesdropping prevention: encrypts communication content
  ② Tampering prevention: ensures data integrity
  ③ Impersonation prevention: authenticates the server
  ④ SEO: Google favors HTTPS
  ⑤ HTTP/2: de facto requires HTTPS
  ⑥ Brotli compression: only available over HTTPS
  ⑦ Service Worker: only works over HTTPS
  ⑧ Geolocation API etc.: only work over HTTPS

Mixed Content:
  → HTTP resources on an HTTPS page
  → Browser blocks or warns
  → "Passive" mixed content (images etc.): warning only
  → "Active" mixed content (scripts etc.): blocked
  → Solution: unify all resources to HTTPS
```

---

## 12. URL/URI Structure

```
URI (Uniform Resource Identifier) structure:

  https://user:pass@api.example.com:443/v1/users?page=1&sort=name#section1
  ├──┤   ├───────┤ ├───────────────┤├──┤├────────┤├──────────────┤├───────┤
  scheme authority   host           port path      query           fragment

  Description of each part:
  ┌───────────┬─────────────────────────────────────────┐
  │ Part      │ Description                              │
  ├───────────┼─────────────────────────────────────────┤
  │ scheme    │ Protocol (http, https, ftp, etc.)        │
  │ userinfo  │ Credentials (deprecated, security risk)  │
  │ host      │ Hostname or IP address                   │
  │ port      │ Port number (default if omitted)         │
  │ path      │ Resource path                            │
  │ query     │ Query parameters (?key=value&...)        │
  │ fragment  │ In-page position (#section)              │
  └───────────┴─────────────────────────────────────────┘

  URI vs URL vs URN:
  → URI: identifier for a resource (superordinate concept)
  → URL: indicates where a resource is (https://example.com/page)
  → URN: indicates the name of a resource (urn:isbn:0451450523)
  → In practice, URI and URL are used almost interchangeably

URL encoding:
  → Percent-encode characters that cannot be used in a URI
  → Space → %20 (or + in query strings)
  → Japanese → %E6%97%A5%E6%9C%AC (hex-encoded UTF-8 bytes)

  Safe characters (no encoding needed):
  A-Z, a-z, 0-9, - _ . ~

  Reserved characters (encode as needed based on usage):
  : / ? # [ ] @ ! $ & ' ( ) * + , ; =
```

```typescript
// URL manipulation (JavaScript/TypeScript)

// URL object
const url = new URL('https://api.example.com/v1/users?page=1&sort=name');

console.log(url.protocol);   // "https:"
console.log(url.hostname);   // "api.example.com"
console.log(url.port);       // "" (default port)
console.log(url.pathname);   // "/v1/users"
console.log(url.search);     // "?page=1&sort=name"
console.log(url.hash);       // ""
console.log(url.origin);     // "https://api.example.com"

// Query parameter manipulation
const params = url.searchParams;
console.log(params.get('page'));    // "1"
console.log(params.get('sort'));    // "name"
params.set('page', '2');
params.append('filter', 'active');
console.log(url.toString());
// "https://api.example.com/v1/users?page=2&sort=name&filter=active"

// Using URLSearchParams
const searchParams = new URLSearchParams({
  page: '1',
  per_page: '20',
  sort: '-created_at',
  status: 'active',
});
const apiUrl = `https://api.example.com/users?${searchParams}`;
// "https://api.example.com/users?page=1&per_page=20&sort=-created_at&status=active"

// Encoding
encodeURIComponent('Hello World');    // "Hello%20World"
encodeURIComponent('name=Taro');      // "name%3DTaro"
decodeURIComponent('%E5%90%8D%E5%89%8D');  // "name" (Japanese: 名前)

// encodeURI vs encodeURIComponent
encodeURI('https://example.com/path?q=hello world');
// "https://example.com/path?q=hello%20world"
encodeURIComponent('https://example.com/path?q=hello world');
// "https%3A%2F%2Fexample.com%2Fpath%3Fq%3Dhello%20world"
// → encodeURIComponent also encodes reserved characters
```

---

## 13. Server Implementation Example

```typescript
// HTTP server implementation with Express.js

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// === Middleware ===

// Security headers
app.use(helmet());

// Response compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,  // compression level (1-9)
  threshold: 1024,  // do not compress below 1KB
}));

// Assign request ID
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Access logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Parse JSON body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === Routing ===

// GET — list
app.get('/api/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.per_page as string) || 20, 100);
    const sort = req.query.sort as string || 'created_at';

    const { users, total } = await getUsersList(page, perPage, sort);

    res.status(200).json({
      data: users,
      meta: {
        total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

// GET — detail (with conditional request support)
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        type: 'https://api.example.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: `User ${req.params.id} not found`,
      });
    }

    // Generate ETag
    const etag = generateETag(user);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Last-Modified', user.updated_at.toUTCString());

    // Check conditional request
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince && new Date(ifModifiedSince) >= user.updated_at) {
      return res.status(304).end();
    }

    res.status(200).json({ data: user });
  } catch (error) {
    handleError(res, error);
  }
});

// POST — create resource
app.post('/api/users', async (req, res) => {
  try {
    // Validation
    const errors = validateCreateUser(req.body);
    if (errors.length > 0) {
      return res.status(422).json({
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 422,
        detail: 'The request body contains invalid fields.',
        errors,
      });
    }

    const user = await createUser(req.body);

    res
      .status(201)
      .setHeader('Location', `/api/users/${user.id}`)
      .json({ data: user });
  } catch (error) {
    if (error instanceof DuplicateError) {
      return res.status(409).json({
        type: 'https://api.example.com/errors/conflict',
        title: 'Conflict',
        status: 409,
        detail: error.message,
      });
    }
    handleError(res, error);
  }
});

// PATCH — partial update (with optimistic locking)
app.patch('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        type: 'https://api.example.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: `User ${req.params.id} not found`,
      });
    }

    // Optimistic locking: validate ETag with If-Match header
    const ifMatch = req.headers['if-match'];
    if (ifMatch && ifMatch !== generateETag(user)) {
      return res.status(412).json({
        type: 'https://api.example.com/errors/precondition-failed',
        title: 'Precondition Failed',
        status: 412,
        detail: 'Resource has been modified since last retrieval.',
      });
    }

    const updatedUser = await updateUser(req.params.id, req.body);
    const newETag = generateETag(updatedUser);

    res
      .setHeader('ETag', newETag)
      .status(200)
      .json({ data: updatedUser });
  } catch (error) {
    handleError(res, error);
  }
});

// DELETE — delete resource
app.delete('/api/users/:id', async (req, res) => {
  try {
    const deleted = await deleteUser(req.params.id);

    if (!deleted) {
      // Idempotency: return 204 even if already deleted
      return res.status(204).end();
    }

    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
});

// HEAD — check existence (same logic as GET, no body)
app.head('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).end();
    }

    res.setHeader('ETag', generateETag(user));
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

// OPTIONS — CORS is handled automatically by the cors middleware

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
function handleError(res: express.Response, error: unknown): void {
  console.error('Internal error:', error);

  res.status(500).json({
    type: 'https://api.example.com/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred.',
  });
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 14. Fetch API and HTTP Clients

```typescript
// === Fetch API in detail ===

// Basic options
const response = await fetch(url, {
  method: 'GET',                    // HTTP method
  headers: new Headers({            // Headers
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token',
  }),
  body: JSON.stringify(data),       // Body (not allowed for GET/HEAD)
  mode: 'cors',                     // CORS mode
  credentials: 'include',           // Send cookies
  cache: 'no-cache',                // Cache control
  redirect: 'follow',               // Redirect handling
  referrerPolicy: 'strict-origin-when-cross-origin',
  signal: AbortSignal.timeout(5000), // Timeout (5 seconds)
  keepalive: true,                   // Send even after page unload
  priority: 'high',                  // Priority (high/low/auto)
});

// === Reading the response ===
// response.json()        — JSON
// response.text()        — text
// response.blob()        — binary (Blob)
// response.arrayBuffer() — binary (ArrayBuffer)
// response.formData()    — FormData
// response.body          — ReadableStream (streaming)

// Reading a streaming response
async function streamResponse(url: string): Promise<string> {
  const response = await fetch(url);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
    console.log('Received chunk:', decoder.decode(value));
  }

  return result;
}

// Timeout and cancellation
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fetch with retry
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx errors
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;  // exponential backoff
        const jitter = Math.random() * 1000;          // jitter
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retries failed');
}
```

---

## FAQ

### Q1: What is HTTP method idempotency and why does it matter?

```
Idempotency:
  → The property that sending the same request multiple times yields the same result (side effects)
  → No state changes occur from the second request onward

Idempotent methods:
  GET    — Reading any number of times does not change state
  PUT    — Updating with the same data multiple times results in the same state
  DELETE — Idempotent even if already deleted (many implementations return 204, not 404)
  HEAD   — Like GET, does not modify state

Non-idempotent methods:
  POST   — Creates a new resource every time
  PATCH  — If changes are relative (+1 etc.), repeating accumulates them

Practical importance:
  1. Retry strategy on network errors
     → Idempotent methods can be safely retried
     → Non-idempotent methods use Idempotency-Key

  2. Browser "Back" button
     → GET is safely re-sent; POST shows a warning

  3. Proxy/CDN caching
     → Only idempotent methods can be cached

Implementation example guaranteeing idempotency:
  POST /api/payments
  Idempotency-Key: unique-key-12345
  → Re-sending with the same key prevents double charging
```

### Q2: What are the roles and key HTTP headers?

```
Roles of HTTP headers:
  ① Transmit metadata
     → Content-Type (data format), Content-Length (size)
  ② Content negotiation
     → Accept (preferred format), Accept-Language (preferred language)
  ③ Authentication and authorization
     → Authorization (credentials), Cookie (session)
  ④ Cache control
     → Cache-Control, ETag, Last-Modified
  ⑤ Security
     → HSTS, CSP, X-Content-Type-Options
  ⑥ Debugging and tracing
     → X-Request-Id (request tracking)

Key request headers:
  ┌─────────────────────┬───────────────────────────────┐
  │ Host                │ Target host (required in HTTP/1.1)│
  │ Accept              │ Acceptable media types         │
  │ Authorization       │ Auth credentials (Bearer token etc.)│
  │ Content-Type        │ Media type of the body         │
  │ User-Agent          │ Client information             │
  │ Origin              │ Origin info for CORS           │
  │ If-None-Match       │ Conditional request (ETag)     │
  └─────────────────────┴───────────────────────────────┘

Key response headers:
  ┌─────────────────────┬───────────────────────────────┐
  │ Content-Type        │ Media type of the body         │
  │ Cache-Control       │ Cache control                  │
  │ ETag                │ Resource version identifier    │
  │ Location            │ Redirect or created URI        │
  │ Set-Cookie          │ Cookie settings                │
  │ Access-Control-*    │ CORS headers                   │
  │ Strict-Transport-   │ Enforce HTTPS (HSTS)           │
  │   Security          │                                │
  └─────────────────────┴───────────────────────────────┘
```

### Q3: How does HTTP/1.1 Keep-Alive work and what are its benefits?

```
Keep-Alive (persistent connection):
  → A mechanism for sending multiple HTTP requests over a single TCP connection
  → Enabled by default in HTTP/1.1 (Connection: keep-alive)

HTTP/1.0 (without Keep-Alive):
  Connect ── GET /page.html ── Response ── Disconnect
  Connect ── GET /style.css ── Response ── Disconnect
  Connect ── GET /app.js    ── Response ── Disconnect

  → Each request requires TCP 3-way handshake + TLS handshake
  → Wastes RTT × 3 (TCP + TLS + HTTP)

HTTP/1.1 (with Keep-Alive):
  Connect ── GET /page.html ── Response
          ── GET /style.css ── Response
          ── GET /app.js    ── Response ── Disconnect (after timeout)

  → Only the first handshake is needed; subsequent requests are sent continuously

Keep-Alive settings (server side):
  Response headers:
  Connection: keep-alive
  Keep-Alive: timeout=65, max=100

  → timeout: maximum idle time (seconds)
  → max: maximum number of requests per connection

  Nginx configuration example:
  keepalive_timeout 65;    # 65 seconds
  keepalive_requests 100;  # up to 100 requests

Benefits:
  ① Reduced latency
     → Eliminates repeated handshakes
  ② Reduced server resources
     → Less overhead from creating/destroying sockets
  ③ More efficient congestion control
     → TCP congestion window remains grown

Caveats:
  → Too long a timeout setting can exhaust server sockets
  → HTTP/2 goes further (handles multiple streams in parallel via multiplexing)
```

---

## Summary

| Concept | Key Point |
|---------|-----------|
| HTTP | Stateless request/response protocol |
| Methods | GET (retrieve), POST (create), PUT (update), PATCH (partial update), DELETE (delete) |
| Idempotency | GET, PUT, DELETE are idempotent; POST, PATCH are not |
| Status codes | 2xx (success), 3xx (redirect), 4xx (client error), 5xx (server error) |
| Headers | Content-Type, Authorization, Cache-Control, ETag, etc. |
| Cookie | Secure settings with HttpOnly, Secure, SameSite |
| HTTPS | Encryption, authentication, and integrity via TLS |
| Security | HSTS, CSP, X-Content-Type-Options, etc. |
| Debugging | curl, HTTPie, browser DevTools |

---

## Further Reading

---

## References
1. RFC 9110. "HTTP Semantics." IETF, 2022.
2. RFC 9111. "HTTP Caching." IETF, 2022.
3. RFC 9112. "HTTP/1.1." IETF, 2022.
4. MDN Web Docs. "HTTP." Mozilla, 2024.
5. OWASP. "HTTP Security Response Headers." OWASP, 2024.
6. web.dev. "Fetch API." Google, 2024.
7. RFC 6265bis. "Cookies: HTTP State Management Mechanism." IETF, 2024.
8. RFC 8446. "The Transport Layer Security (TLS) Protocol Version 1.3." IETF, 2018.
