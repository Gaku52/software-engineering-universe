# Fetch and Streams

> The Fetch API is a modern HTTP client API designed as the successor to XMLHttpRequest. Combined with the Streams API, it enables incremental processing of large responses, progress display, and cancellation via AbortController. This chapter provides a comprehensive guide from the basics of the Fetch API through advanced patterns, streaming processing with the Streams API, and best practices for production use.

## What You Will Learn

- [ ] Understand the basics and advanced usage of the Fetch API
- [ ] Grasp the details of Request / Response objects
- [ ] Be able to implement streaming processing with the Streams API
- [ ] Learn request cancellation and timeout using AbortController
- [ ] Build production-level fetch wrappers and error handling
- [ ] Understand stream processing for Server-Sent Events / NDJSON / chunked transfer encoding
- [ ] Understand testing strategies and mocking techniques

## Prerequisites

Before studying this chapter, it is recommended to have acquired the following knowledge.

- **HTTP Basics**: Understanding of the structure of HTTP requests/responses, status codes, headers, and the meaning of methods (GET, POST, PUT, DELETE, etc.) is assumed. See [../../../network-fundamentals/docs/02-http/00-http-basics.md](../../../network-fundamentals/docs/02-http/00-http-basics.md) for details.

- **Promise and Async/Await**: The Fetch API is Promise-based, and writing asynchronous processing using `async`/`await` syntax is central. It is important to understand Promise chaining, error handling (`.catch()`, `try/catch`), and concurrent processing (`Promise.all()`, `Promise.race()`).

- **DOM API**: Since there are many situations where data retrieved with the Fetch API is reflected in the DOM, understand basic DOM operations (retrieving, creating, inserting elements). See [./00-dom-api.md](./00-dom-api.md) for details.

---

## 1. Fetch API Basics

### 1.1 Evolution from XMLHttpRequest to Fetch API

XMLHttpRequest (XHR) has long been used as the foundation of Ajax, but its callback-based API tends to become complex and its support for streaming processing was limited. The Fetch API was designed to solve these issues.

```javascript
// XMLHttpRequest (legacy pattern)
function fetchDataXHR(url, callback) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(null, JSON.parse(xhr.responseText));
      } else {
        callback(new Error(`HTTP ${xhr.status}`));
      }
    }
  };
  xhr.onerror = function () {
    callback(new Error('Network error'));
  };
  xhr.send();
}

// Fetch API (modern pattern)
async function fetchData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
```

The main advantages of the Fetch API are summarized below.

| Feature | XMLHttpRequest | Fetch API |
|---------|---------------|-----------|
| Async model | Callback | Promise |
| Streaming | Limited | ReadableStream |
| Request cancellation | xhr.abort() | AbortController |
| CORS control | Limited | mode option |
| Cache control | Manual headers | cache option |
| Service Worker integration | Not possible | Unified via FetchEvent |
| Syntax simplicity | Verbose | Simple |

### 1.2 Basic GET Request

```javascript
// Simplest GET
const response = await fetch('/api/users');
const users = await response.json();
console.log(users);

// Building query parameters with URLSearchParams
const params = new URLSearchParams({
  page: '1',
  limit: '20',
  sort: 'created_at',
  order: 'desc',
});
const response = await fetch(`/api/users?${params}`);
const data = await response.json();

// Adding array parameters
const params = new URLSearchParams();
params.append('tag', 'javascript');
params.append('tag', 'typescript');
params.append('tag', 'react');
// → tag=javascript&tag=typescript&tag=react

// Combining with URL object
const url = new URL('/api/search', 'https://api.example.com');
url.searchParams.set('q', 'fetch api');
url.searchParams.set('lang', 'en');
const response = await fetch(url);
// → https://api.example.com/api/search?q=fetch+api&lang=en
```

### 1.3 POST Request

```javascript
// Sending JSON
const response = await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
  }),
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}

const created = await response.json();
console.log('Created user:', created.id);

// Sending FormData (including file upload)
const formData = new FormData();
formData.append('name', 'John Doe');
formData.append('avatar', fileInput.files[0]);
formData.append('documents', file1);
formData.append('documents', file2);

// For FormData, Content-Type is set automatically (including boundary)
const response = await fetch('/api/users', {
  method: 'POST',
  body: formData,
  // headers: { 'Content-Type': 'multipart/form-data' } should NOT be set!
});

// Sending URLSearchParams (application/x-www-form-urlencoded)
const body = new URLSearchParams({
  username: 'john',
  password: 'secret123',
  grant_type: 'password',
});

const response = await fetch('/oauth/token', {
  method: 'POST',
  body, // Content-Type is automatically set to application/x-www-form-urlencoded
});
```

### 1.4 PUT / PATCH / DELETE Requests

```javascript
// PUT request (replace entire resource)
const response = await fetch(`/api/users/${userId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    role: 'editor',
    active: true,
  }),
});

// PATCH request (partial update)
const response = await fetch(`/api/users/${userId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    role: 'admin',
  }),
});

// JSON Patch format (RFC 6902)
const response = await fetch(`/api/users/${userId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json-patch+json' },
  body: JSON.stringify([
    { op: 'replace', path: '/role', value: 'admin' },
    { op: 'add', path: '/permissions/-', value: 'manage_users' },
    { op: 'remove', path: '/temporaryFlag' },
  ]),
});

// DELETE request
const response = await fetch(`/api/users/${userId}`, {
  method: 'DELETE',
});

if (response.status === 204) {
  console.log('Successfully deleted (no content)');
} else if (response.ok) {
  const result = await response.json();
  console.log('Deleted:', result);
}

// DELETE request with body
const response = await fetch('/api/users/batch', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ids: [1, 2, 3, 4, 5],
    reason: 'Account cleanup',
  }),
});
```

### 1.5 Important Notes About fetch

```javascript
// ★ Note 1: fetch only rejects on network errors
// → 404 and 500 are NOT rejected!
try {
  const response = await fetch('/api/nonexistent');
  // response.status === 404, but catch is not entered
  console.log(response.ok); // false
  console.log(response.status); // 404
} catch (err) {
  // Only when network disconnection / DNS resolution failure / CORS error etc.
  console.error('Network error:', err);
}

// ★ Note 2: Response body can only be read once
const response = await fetch('/api/data');
const json = await response.json();
// const text = await response.text(); // Error! body is already consumed

// Use clone if you want to read multiple times
const response = await fetch('/api/data');
const clone = response.clone();
const json = await response.json();
const text = await clone.text(); // This is OK

// ★ Note 3: Default cookie sending behavior
// Cookies are sent for same-origin requests (credentials: 'same-origin' is the default)
// Cookies are NOT sent for cross-origin requests
// credentials: 'include' is required to send cookies with cross-origin requests
const response = await fetch('https://other-domain.com/api/data', {
  credentials: 'include', // Send cookies with cross-origin
});

// ★ Note 4: Redirect handling
const response = await fetch('/api/redirect', {
  redirect: 'follow',  // Default: automatically follow redirects
  // redirect: 'error', // Error on redirect
  // redirect: 'manual', // Handle redirect manually
});

// With manual, an opaqueredirect response is returned
if (response.type === 'opaqueredirect') {
  const redirectUrl = response.url;
  console.log('Redirected to:', redirectUrl);
}
```

---

## 2. Request / Response Objects

### 2.1 Request Object

The fetch() function of the Fetch API internally creates a Request object. By explicitly creating a Request object, requests can be reused and manipulated in Service Workers.

```javascript
// Explicitly creating a Request object
const request = new Request('/api/users', {
  method: 'GET',
  headers: new Headers({
    'Accept': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9...',
  }),
  mode: 'cors',
  credentials: 'same-origin',
  cache: 'default',
  redirect: 'follow',
  referrer: 'about:client',
  referrerPolicy: 'strict-origin-when-cross-origin',
  integrity: 'sha256-abc123...', // Subresource Integrity
});

// Pass Request object to fetch
const response = await fetch(request);

// Cloning a Request (frequently used in Service Worker)
const clonedRequest = request.clone();

// Key properties of Request
console.log(request.url);        // Full URL
console.log(request.method);     // GET, POST, etc.
console.log(request.headers);    // Headers object
console.log(request.body);       // ReadableStream | null
console.log(request.mode);       // cors, no-cors, same-origin
console.log(request.credentials);// include, same-origin, omit
console.log(request.cache);      // default, no-store, reload, etc.
console.log(request.redirect);   // follow, error, manual
console.log(request.signal);     // AbortSignal

// Override options based on an existing Request
const authenticatedRequest = new Request(request, {
  headers: new Headers({
    ...Object.fromEntries(request.headers.entries()),
    'Authorization': `Bearer ${newToken}`,
  }),
});
```

### 2.2 Headers Object

```javascript
// Creating and manipulating Headers
const headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');
headers.append('X-Custom-Header', 'value1');
headers.append('X-Custom-Header', 'value2'); // Adding multiple values

// set overwrites, append adds
headers.set('X-Custom-Header', 'single-value'); // Overwrite

// Getting values
console.log(headers.get('Content-Type'));      // 'application/json'
console.log(headers.has('Authorization'));       // false
console.log(headers.get('X-Custom-Header'));    // 'single-value'

// Deleting a header
headers.delete('X-Custom-Header');

// Iteration
for (const [name, value] of headers) {
  console.log(`${name}: ${value}`);
}

// Initialization from an object
const headers = new Headers({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer token123',
  'Accept-Language': 'en,ja;q=0.9',
});

// Reading response headers
const response = await fetch('/api/data');
console.log(response.headers.get('Content-Type'));
console.log(response.headers.get('X-Request-Id'));
console.log(response.headers.get('X-RateLimit-Remaining'));

// ★ With CORS, headers not exposed by the server via Access-Control-Expose-Headers
//    cannot be read
// Server side: Access-Control-Expose-Headers: X-Request-Id, X-RateLimit-Remaining

// Converting Headers to an object
const headerObj = Object.fromEntries(headers.entries());
```

### 2.3 Response Object

```javascript
// Key properties of Response
const response = await fetch('/api/users');

console.log(response.ok);         // true (status 200-299)
console.log(response.status);     // 200
console.log(response.statusText); // 'OK'
console.log(response.url);        // Final URL of the request
console.log(response.redirected); // Whether a redirect occurred
console.log(response.type);       // 'basic', 'cors', 'opaque', etc.
console.log(response.headers);    // Headers object
console.log(response.body);       // ReadableStream

// Response body reading methods
const json = await response.json();        // JSON → Object
const text = await response.text();        // Text
const blob = await response.blob();        // Blob (binary data)
const buffer = await response.arrayBuffer(); // ArrayBuffer
const formData = await response.formData(); // FormData

// Creating a custom Response (used in Service Worker)
const customResponse = new Response(
  JSON.stringify({ message: 'Hello from cache' }),
  {
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Type': 'application/json',
      'X-Source': 'service-worker-cache',
    },
  }
);

// Static methods
const redirectResponse = Response.redirect('https://example.com/new-url', 301);
const errorResponse = Response.error(); // Network error response
const jsonResponse = Response.json({ ok: true }); // JSON response (new API)
```

---

## 3. AbortController In Depth

### 3.1 Basic Cancellation

```javascript
// AbortController basics
const controller = new AbortController();
const { signal } = controller;

// Pass signal to fetch
const fetchPromise = fetch('/api/large-data', { signal });

// Cancel on some condition
document.getElementById('cancelBtn').addEventListener('click', () => {
  controller.abort();
});

try {
  const response = await fetchPromise;
  const data = await response.json();
  console.log(data);
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Fetch was cancelled by user');
  } else {
    console.error('Fetch failed:', err);
  }
}
```

### 3.2 Implementing Timeouts

```javascript
// Method 1: setTimeout + AbortController
function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const { signal } = controller;

  // If there is an existing signal, combine with any()
  const combinedSignal = options.signal
    ? AbortSignal.any([signal, options.signal])
    : signal;

  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeout);

  return fetch(url, {
    ...options,
    signal: combinedSignal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

// Usage example
try {
  const response = await fetchWithTimeout('/api/slow-endpoint', {}, 3000);
  const data = await response.json();
} catch (err) {
  if (err.name === 'TimeoutError') {
    console.error('Request timed out after 3 seconds');
  } else if (err.name === 'AbortError') {
    console.error('Request was manually cancelled');
  }
}

// Method 2: AbortSignal.timeout() (recommended — check browser support)
const response = await fetch('/api/data', {
  signal: AbortSignal.timeout(5000),
});

// Method 3: Combining multiple signals
const userController = new AbortController();
const combinedSignal = AbortSignal.any([
  userController.signal,
  AbortSignal.timeout(10000),
]);

const response = await fetch('/api/data', { signal: combinedSignal });

// When the user presses the cancel button
cancelButton.onclick = () => userController.abort();
```

### 3.3 Cancellation Patterns in React

```typescript
import { useEffect, useState, useCallback } from 'react';

// Pattern 1: Cleanup in useEffect
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUsers() {
      try {
        setLoading(true);
        const response = await fetch('/api/users', {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setUsers(data);
        setError(null);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadUsers();
    return () => controller.abort(); // Cancel on unmount
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// Pattern 2: Custom hook
function useFetch<T>(url: string, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();

        if (isMounted) {
          setData(json);
        }
      } catch (err) {
        if (isMounted && err.name !== 'AbortError') {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [url]);

  return { data, loading, error };
}

// Using the custom hook
function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useFetch<User>(
    `/api/users/${userId}`
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return null;

  return <div>{data.name}</div>;
}

// Pattern 3: Debouncing searches with cancellation
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const controllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    // Cancel the previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const params = new URLSearchParams({ q: searchQuery });
      const response = await fetch(`/api/search?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Search failed:', err);
      }
    }
  }, []);

  // Debounce processing
  useEffect(() => {
    const timeoutId = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeoutId);
  }, [query, search]);

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <ul>
        {results.map(r => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 3.4 Advanced Uses of AbortController

```javascript
// Using AbortController beyond fetch
// Cancelling EventListeners
const controller = new AbortController();

document.addEventListener('click', handleClick, { signal: controller.signal });
document.addEventListener('keydown', handleKey, { signal: controller.signal });
document.addEventListener('scroll', handleScroll, { signal: controller.signal });

// Remove all listeners at once
controller.abort();

// Supporting cancellation in custom async processing
async function processItems(items, signal) {
  const results = [];

  for (const item of items) {
    // Check for cancellation at each iteration
    if (signal?.aborted) {
      throw new DOMException('Processing cancelled', 'AbortError');
    }

    const result = await processItem(item);
    results.push(result);
  }

  return results;
}

// Signal event listener
const controller = new AbortController();

controller.signal.addEventListener('abort', () => {
  console.log('Abort reason:', controller.signal.reason);
  // Cleanup processing
});

// Specifying abort reason
controller.abort(new Error('User navigated away'));
console.log(controller.signal.reason); // Error: User navigated away
```

---

## 4. Streams API In Depth

### 4.1 ReadableStream

ReadableStream is an interface for reading data asynchronously. The response.body of fetch() returns a ReadableStream.

```javascript
// Basic structure of ReadableStream
const stream = new ReadableStream({
  start(controller) {
    // Called when the stream is initialized
    controller.enqueue('Hello');
    controller.enqueue(' ');
    controller.enqueue('World');
    controller.close();
  },

  pull(controller) {
    // Called when the consumer requests data
    // Suitable for reading from asynchronous data sources
  },

  cancel(reason) {
    // Called when the stream is cancelled
    console.log('Stream cancelled:', reason);
  },
});

// Reading with a Reader
const reader = stream.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(value);
}

reader.releaseLock(); // Release the lock

// Counting strategy (backpressure control)
const stream = new ReadableStream(
  {
    start(controller) {
      // Enqueue data
    },
    pull(controller) {
      // If desiredSize is 0 or less, the buffer is full
      console.log('Desired size:', controller.desiredSize);
    },
  },
  new CountQueuingStrategy({ highWaterMark: 10 }) // Max 10 chunks
);

// ByteLengthQueuingStrategy
const stream = new ReadableStream(
  {
    // ...
  },
  new ByteLengthQueuingStrategy({ highWaterMark: 1024 * 64 }) // 64KB
);
```

### 4.2 Download Progress Display

```javascript
// A reusable download progress component
async function downloadWithProgress(url, onProgress) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Get file size from the Content-Length header
  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : null;

  if (!response.body) {
    // If body is null (normally this does not happen)
    return response.blob();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  const startTime = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.length;

    const elapsed = (Date.now() - startTime) / 1000;
    const speed = received / elapsed; // bytes/sec

    onProgress({
      loaded: received,
      total,
      percentage: total ? Math.round((received / total) * 100) : null,
      speed, // bytes/sec
      eta: total ? Math.round((total - received) / speed) : null, // seconds remaining
    });
  }

  // Combine chunks into a Blob
  const blob = new Blob(chunks);
  return blob;
}

// Usage example in React
function DownloadButton({ url, filename }) {
  const [progress, setProgress] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadWithProgress(url, setProgress);

      // Generate a download link
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  };

  return (
    <div>
      <button onClick={handleDownload} disabled={downloading}>
        {downloading ? 'Downloading...' : 'Download'}
      </button>
      {progress && (
        <div>
          <progress
            value={progress.loaded}
            max={progress.total || undefined}
          />
          <span>
            {progress.percentage !== null
              ? `${progress.percentage}%`
              : `${(progress.loaded / 1024 / 1024).toFixed(1)} MB`
            }
            {progress.speed && ` (${formatSpeed(progress.speed)})`}
            {progress.eta !== null && ` - ${progress.eta}s remaining`}
          </span>
        </div>
      )}
    </div>
  );
}

function formatSpeed(bytesPerSec) {
  if (bytesPerSec > 1024 * 1024) {
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
}
```

### 4.3 Upload Progress (Using XMLHttpRequest Together)

```javascript
// The Fetch API cannot directly get upload progress (as of 2024)
// Use XMLHttpRequest's upload.onprogress

function uploadWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.send(formData);
  });
}

// Chunked upload (split sending of large files)
async function chunkedUpload(url, file, chunkSize = 5 * 1024 * 1024) {
  const totalChunks = Math.ceil(file.size / chunkSize);
  const uploadId = crypto.randomUUID();

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(i));
    formData.append('totalChunks', String(totalChunks));

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Chunk ${i} upload failed: HTTP ${response.status}`);
    }

    console.log(`Uploaded chunk ${i + 1}/${totalChunks}`);
  }

  // Notify completion of all chunk uploads
  const response = await fetch(`${url}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, totalChunks }),
  });

  return response.json();
}
```

### 4.4 TransformStream

```javascript
// TransformStream basics
const uppercaseTransform = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase());
  },
});

// JSON Lines parser (NDJSON support)
function createNDJSONParser() {
  let buffer = '';

  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep the incomplete last line in the buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            controller.enqueue(parsed);
          } catch (e) {
            console.warn('Invalid JSON line:', trimmed);
          }
        }
      }
    },

    flush(controller) {
      // Process remaining buffer when stream ends
      const trimmed = buffer.trim();
      if (trimmed) {
        try {
          controller.enqueue(JSON.parse(trimmed));
        } catch (e) {
          console.warn('Invalid final JSON line:', trimmed);
        }
      }
    },
  });
}

// Usage example
async function* streamNDJSON(url) {
  const response = await fetch(url);
  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(createNDJSONParser())
    .getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
}

// Data filtering TransformStream
function createFilterStream(predicate) {
  return new TransformStream({
    transform(chunk, controller) {
      if (predicate(chunk)) {
        controller.enqueue(chunk);
      }
    },
  });
}

// Batching TransformStream
function createBatchStream(batchSize) {
  let batch = [];

  return new TransformStream({
    transform(chunk, controller) {
      batch.push(chunk);
      if (batch.length >= batchSize) {
        controller.enqueue(batch);
        batch = [];
      }
    },
    flush(controller) {
      if (batch.length > 0) {
        controller.enqueue(batch);
      }
    },
  });
}

// Building a pipeline
const response = await fetch('/api/events');
const reader = response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(createNDJSONParser())
  .pipeThrough(createFilterStream(event => event.type === 'message'))
  .pipeThrough(createBatchStream(10))
  .getReader();

while (true) {
  const { done, value: batch } = await reader.read();
  if (done) break;
  await processBatch(batch); // Process 10 items at a time
}
```

### 4.5 WritableStream

```javascript
// WritableStream basics
const writableStream = new WritableStream({
  start(controller) {
    console.log('Stream started');
  },

  write(chunk, controller) {
    console.log('Writing chunk:', chunk);
    // Asynchronous processing is also possible
    return processChunk(chunk);
  },

  close() {
    console.log('Stream closed');
  },

  abort(reason) {
    console.log('Stream aborted:', reason);
  },
});

// Writing to a WritableStream with a Writer
const writer = writableStream.getWriter();
await writer.write('Hello');
await writer.write(' World');
await writer.close();

// Piping from ReadableStream to WritableStream
const response = await fetch('/api/large-data');
await response.body.pipeTo(writableStream);

// Writing to a file (File System Access API)
async function saveStreamToFile(readableStream) {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: 'download.txt',
    types: [
      {
        description: 'Text files',
        accept: { 'text/plain': ['.txt'] },
      },
    ],
  });

  const writable = await fileHandle.createWritable();

  await readableStream
    .pipeThrough(new TextEncoderStream())
    .pipeTo(writable);
}

// Incremental writing to the DOM
function createDOMWritableStream(container) {
  return new WritableStream({
    write(chunk) {
      const element = document.createElement('div');
      element.textContent = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
      container.appendChild(element);
    },
  });
}

const container = document.getElementById('results');
const response = await fetch('/api/events');
await response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(createNDJSONParser())
  .pipeTo(createDOMWritableStream(container));
```

---

## 5. Server-Sent Events (SSE) and Streaming

### 5.1 EventSource API

```javascript
// Receiving SSE via EventSource
const eventSource = new EventSource('/api/events');

eventSource.onopen = () => {
  console.log('Connection opened');
};

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

eventSource.onerror = (event) => {
  console.error('EventSource error:', event);
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log('Connection closed');
  }
};

// Receiving named events
eventSource.addEventListener('user-update', (event) => {
  const user = JSON.parse(event.data);
  console.log('User updated:', user);
});

eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data);
  showNotification(notification);
});

// Close the connection
eventSource.close();

// EventSource limitations:
// - GET requests only
// - Cannot set custom headers
// - Authentication tokens must be sent via Cookie or URL parameters
```

### 5.2 SSE Processing with Fetch API

```javascript
// SSE via Fetch API (supports custom headers)
async function fetchSSE(url, options = {}) {
  const { onMessage, onError, signal, headers = {} } = options;

  const response = await fetch(url, {
    headers: {
      'Accept': 'text/event-stream',
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    const events = buffer.split('\n\n');
    buffer = events.pop(); // Keep incomplete event in buffer

    for (const eventStr of events) {
      if (!eventStr.trim()) continue;

      const event = parseSSEEvent(eventStr);
      if (event) {
        onMessage?.(event);
      }
    }
  }
}

function parseSSEEvent(eventStr) {
  const lines = eventStr.split('\n');
  const event = { data: '', type: 'message', id: null, retry: null };

  for (const line of lines) {
    if (line.startsWith('data:')) {
      event.data += (event.data ? '\n' : '') + line.slice(5).trim();
    } else if (line.startsWith('event:')) {
      event.type = line.slice(6).trim();
    } else if (line.startsWith('id:')) {
      event.id = line.slice(3).trim();
    } else if (line.startsWith('retry:')) {
      event.retry = parseInt(line.slice(6).trim(), 10);
    }
  }

  return event.data ? event : null;
}

// Usage example: ChatGPT-style streaming response
async function streamChatResponse(prompt) {
  const controller = new AbortController();

  await fetchSSE('/api/chat/stream', {
    signal: controller.signal,
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    onMessage(event) {
      if (event.data === '[DONE]') {
        console.log('Stream complete');
        return;
      }

      try {
        const data = JSON.parse(event.data);
        appendToChat(data.content);
      } catch (e) {
        console.warn('Failed to parse event:', event.data);
      }
    },
  });

  return controller;
}
```

### 5.3 Processing Streaming Responses from AI/LLM APIs

```typescript
// Streaming processing for OpenAI-compatible APIs
interface ChatChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

async function* streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: { model?: string; temperature?: number; signal?: AbortSignal } = {}
): AsyncGenerator<string> {
  const response = await fetch('/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model || 'gpt-4',
      messages,
      temperature: options.temperature ?? 0.7,
      stream: true,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`API error ${response.status}: ${error.message || response.statusText}`);
  }

  const reader = response.body!
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const chunk: ChatChunk = JSON.parse(trimmed.slice(6));
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
}

// Usage in a React component
function ChatStream({ messages }: { messages: Message[] }) {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const startStream = async () => {
    controllerRef.current = new AbortController();
    setResponse('');
    setIsStreaming(true);

    try {
      let fullResponse = '';
      for await (const chunk of streamChatCompletion(messages, {
        signal: controllerRef.current.signal,
      })) {
        fullResponse += chunk;
        setResponse(fullResponse);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Stream error:', err);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const stopStream = () => {
    controllerRef.current?.abort();
  };

  return (
    <div>
      <div className="response">{response}</div>
      {isStreaming ? (
        <button onClick={stopStream}>Stop</button>
      ) : (
        <button onClick={startStream}>Send</button>
      )}
    </div>
  );
}
```

---

## 6. Advanced Fetch Patterns

### 6.1 Retry Strategy

```typescript
// Retry with exponential backoff
interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    retryableStatuses = [408, 429, 500, 502, 503, 504],
    onRetry,
  } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // For retryable status codes
      if (retryableStatuses.includes(response.status) && attempt < maxRetries) {
        // Check the Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        let delay: number;

        if (retryAfter) {
          // Retry-After is in seconds or HTTP date format
          const retrySeconds = parseInt(retryAfter, 10);
          if (!isNaN(retrySeconds)) {
            delay = retrySeconds * 1000;
          } else {
            delay = new Date(retryAfter).getTime() - Date.now();
          }
        } else {
          // Exponential backoff + jitter
          delay = Math.min(
            baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
            maxDelay
          );
        }

        const error = new Error(`HTTP ${response.status}`);
        onRetry?.(attempt + 1, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelay
        );
        onRetry?.(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries reached');
}

// Usage example
const response = await fetchWithRetry('/api/unreliable', {}, {
  maxRetries: 5,
  baseDelay: 500,
  onRetry(attempt, error) {
    console.warn(`Retry ${attempt}: ${error.message}`);
  },
});
```

### 6.2 Concurrent Requests and Control

```typescript
// Concurrent requests with Promise.all
async function fetchMultiple(urls: string[]) {
  const responses = await Promise.all(
    urls.map(url => fetch(url).then(r => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    }))
  );
  return responses;
}

// Error-tolerant concurrent requests with Promise.allSettled
async function fetchMultipleSafe(urls: string[]) {
  const results = await Promise.allSettled(
    urls.map(url => fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }))
  );

  return results.map((result, i) => ({
    url: urls[i],
    status: result.status,
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : null,
  }));
}

// Concurrency limit control
async function fetchWithConcurrencyLimit<T>(
  urls: string[],
  concurrency: number,
  fetcher: (url: string) => Promise<T>
): Promise<T[]> {
  const results: T[] = new Array(urls.length);
  let index = 0;

  async function worker() {
    while (index < urls.length) {
      const currentIndex = index++;
      results[currentIndex] = await fetcher(urls[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, urls.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

// Usage example: API calls with max 5 concurrent requests
const userIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const users = await fetchWithConcurrencyLimit(
  userIds.map(id => `/api/users/${id}`),
  5,
  async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
);

// Get the fastest response with Promise.race
async function fetchFastest(urls: string[]) {
  const controller = new AbortController();

  try {
    const result = await Promise.race(
      urls.map(async (url) => {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
    );

    // Cancel other requests after receiving the first response
    controller.abort();
    return result;
  } catch (err) {
    controller.abort();
    throw err;
  }
}
```

### 6.3 Request Queuing

```typescript
// Request queue (execute in order, supports rate limiting)
class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;
  private concurrency: number;
  private delayMs: number;

  constructor(concurrency = 1, delayMs = 0) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift()!;

    try {
      await task();
    } finally {
      if (this.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }
      this.running--;
      this.process();
    }
  }
}

// Usage example: API rate limiting (1 request per second)
const queue = new RequestQueue(1, 1000);

const results = await Promise.all(
  userIds.map(id =>
    queue.add(() => fetch(`/api/users/${id}`).then(r => r.json()))
  )
);
```

### 6.4 Cache Strategy

```typescript
// Fetch with in-memory cache
class FetchCache {
  private cache = new Map<string, {
    data: any;
    timestamp: number;
    etag?: string;
    lastModified?: string;
  }>();
  private ttl: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttl = ttlMs;
  }

  async fetch<T>(url: string, options?: RequestInit): Promise<T> {
    const cached = this.cache.get(url);
    const now = Date.now();

    // If cache is valid
    if (cached && now - cached.timestamp < this.ttl) {
      return cached.data;
    }

    // Conditional request (ETag / Last-Modified)
    const headers = new Headers(options?.headers);
    if (cached?.etag) {
      headers.set('If-None-Match', cached.etag);
    }
    if (cached?.lastModified) {
      headers.set('If-Modified-Since', cached.lastModified);
    }

    const response = await fetch(url, { ...options, headers });

    // 304 Not Modified
    if (response.status === 304 && cached) {
      cached.timestamp = now;
      return cached.data;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    this.cache.set(url, {
      data,
      timestamp: now,
      etag: response.headers.get('ETag') || undefined,
      lastModified: response.headers.get('Last-Modified') || undefined,
    });

    return data;
  }

  invalidate(url: string) {
    this.cache.delete(url);
  }

  invalidateAll() {
    this.cache.clear();
  }

  // Invalidate entries matching a pattern
  invalidatePattern(pattern: RegExp) {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

// Usage example
const apiCache = new FetchCache(60 * 1000); // 1 minute TTL

// Aggregate multiple requests to the same URL (deduplication)
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async fetch<T>(url: string, options?: RequestInit): Promise<T> {
    const key = `${options?.method || 'GET'}:${url}`;

    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    const promise = fetch(url, options)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }
}

const dedup = new RequestDeduplicator();

// Even if called simultaneously, the actual fetch only runs once
const [users1, users2, users3] = await Promise.all([
  dedup.fetch('/api/users'),
  dedup.fetch('/api/users'),
  dedup.fetch('/api/users'),
]);
```

---

## 7. Production-Level Fetch Wrapper

### 7.1 Type-Safe API Client

```typescript
// Error class hierarchy
class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
    public requestUrl: string,
    public requestMethod: string
  ) {
    super(`${requestMethod} ${requestUrl}: HTTP ${status} ${statusText}`);
    this.name = 'ApiError';
  }

  get isClientError() { return this.status >= 400 && this.status < 500; }
  get isServerError() { return this.status >= 500; }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isConflict() { return this.status === 409; }
  get isRateLimited() { return this.status === 429; }
}

class NetworkError extends Error {
  constructor(public originalError: Error) {
    super(`Network error: ${originalError.message}`);
    this.name = 'NetworkError';
  }
}

class TimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

// API client configuration
interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  getAuthToken?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
  onError?: (error: ApiError | NetworkError | TimeoutError) => void;
  retryOptions?: RetryOptions;
}

// Full-featured API client
class ApiClient {
  private config: Required<Omit<ApiClientConfig, 'getAuthToken' | 'onUnauthorized' | 'onError'>> & Partial<Pick<ApiClientConfig, 'getAuthToken' | 'onUnauthorized' | 'onError'>>;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      headers: {},
      retryOptions: { maxRetries: 0 },
      ...config,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
      timeout?: number;
    } = {}
  ): Promise<T> {
    // Build URL
    const url = new URL(path, this.config.baseUrl);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // Build headers
    const headers = new Headers({
      'Accept': 'application/json',
      ...this.config.headers,
      ...options.headers,
    });

    // Authentication token
    if (this.config.getAuthToken) {
      const token = await this.config.getAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // Body processing
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        body = options.body;
        // Do not set Content-Type for FormData (browser sets it automatically)
      } else {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(options.body);
      }
    }

    // Timeout configuration
    const timeout = options.timeout ?? this.config.timeout;
    const timeoutSignal = AbortSignal.timeout(timeout);
    const combinedSignal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: combinedSignal,
        credentials: 'same-origin',
      });

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text().catch(() => null);
        }

        const apiError = new ApiError(
          response.status,
          response.statusText,
          errorBody,
          url.toString(),
          method
        );

        // Special handling for 401
        if (apiError.isUnauthorized) {
          this.config.onUnauthorized?.();
        }

        this.config.onError?.(apiError);
        throw apiError;
      }

      // 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      // Parse response according to Content-Type
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        return response.json();
      } else if (contentType.includes('text/')) {
        return response.text() as Promise<T>;
      } else {
        return response.blob() as Promise<T>;
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;

      if (err instanceof DOMException) {
        if (err.name === 'TimeoutError') {
          const timeoutErr = new TimeoutError(timeout);
          this.config.onError?.(timeoutErr);
          throw timeoutErr;
        }
        if (err.name === 'AbortError') {
          throw err; // Pass through cancellation by the user
        }
      }

      const networkErr = new NetworkError(
        err instanceof Error ? err : new Error(String(err))
      );
      this.config.onError?.(networkErr);
      throw networkErr;
    }
  }

  // HTTP method shortcuts
  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>, options?: { signal?: AbortSignal }) {
    return this.request<T>('GET', path, { query, ...options });
  }

  post<T>(path: string, body?: unknown, options?: { signal?: AbortSignal }) {
    return this.request<T>('POST', path, { body, ...options });
  }

  put<T>(path: string, body?: unknown, options?: { signal?: AbortSignal }) {
    return this.request<T>('PUT', path, { body, ...options });
  }

  patch<T>(path: string, body?: unknown, options?: { signal?: AbortSignal }) {
    return this.request<T>('PATCH', path, { body, ...options });
  }

  delete<T>(path: string, options?: { signal?: AbortSignal }) {
    return this.request<T>('DELETE', path, options);
  }

  // Streaming request
  async *stream<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      signal?: AbortSignal;
    } = {}
  ): AsyncGenerator<T> {
    const url = new URL(path, this.config.baseUrl);
    const headers = new Headers({
      'Accept': 'text/event-stream',
      ...this.config.headers,
    });

    if (this.config.getAuthToken) {
      const token = await this.config.getAuthToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    let body: string | undefined;
    if (options.body) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), {
      method: options.method || 'POST',
      headers,
      body,
      signal: options.signal,
    });

    if (!response.ok) {
      throw new ApiError(
        response.status, response.statusText, null,
        url.toString(), options.method || 'POST'
      );
    }

    const reader = response.body!
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          yield JSON.parse(data) as T;
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

// Usage example
const api = new ApiClient({
  baseUrl: 'https://api.example.com',
  timeout: 15000,
  getAuthToken: () => localStorage.getItem('access_token'),
  onUnauthorized: () => {
    // Refresh token or redirect to login screen
    window.location.href = '/login';
  },
  onError: (error) => {
    // Send to error monitoring service
    errorTracker.capture(error);
  },
});

// Type-safe API calls
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// GET
const users = await api.get<PaginatedResponse<User>>('/users', {
  page: 1,
  limit: 20,
  role: 'admin',
});

// POST
const newUser = await api.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'editor',
});

// PATCH
const updated = await api.patch<User>(`/users/${userId}`, {
  role: 'admin',
});

// DELETE
await api.delete(`/users/${userId}`);

// Streaming
for await (const chunk of api.stream<{ content: string }>('/chat', {
  body: { message: 'Hello' },
})) {
  console.log(chunk.content);
}
```

### 7.2 Interceptor Pattern

```typescript
// Request / Response interceptors
type RequestInterceptor = (
  url: string,
  options: RequestInit
) => Promise<[string, RequestInit]> | [string, RequestInit];

type ResponseInterceptor = (
  response: Response,
  url: string,
  options: RequestInit
) => Promise<Response> | Response;

class InterceptableFetch {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) this.requestInterceptors.splice(index, 1);
    };
  }

  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) this.responseInterceptors.splice(index, 1);
    };
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Apply request interceptors in order
    let currentUrl = url;
    let currentOptions = { ...options };

    for (const interceptor of this.requestInterceptors) {
      [currentUrl, currentOptions] = await interceptor(currentUrl, currentOptions);
    }

    let response = await fetch(currentUrl, currentOptions);

    // Apply response interceptors in order
    for (const interceptor of this.responseInterceptors) {
      response = await interceptor(response, currentUrl, currentOptions);
    }

    return response;
  }
}

// Usage example
const client = new InterceptableFetch();

// Logging interceptor
client.addRequestInterceptor(async (url, options) => {
  console.log(`[API] ${options.method || 'GET'} ${url}`);
  const startTime = performance.now();
  (options as any).__startTime = startTime;
  return [url, options];
});

client.addResponseInterceptor(async (response, url, options) => {
  const duration = performance.now() - (options as any).__startTime;
  console.log(`[API] ${response.status} ${url} (${duration.toFixed(0)}ms)`);
  return response;
});

// Authentication interceptor
client.addRequestInterceptor(async (url, options) => {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return [url, { ...options, headers }];
});

// Token refresh interceptor
client.addResponseInterceptor(async (response, url, options) => {
  if (response.status === 401) {
    const newToken = await refreshToken();
    if (newToken) {
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${newToken}`);
      return fetch(url, { ...options, headers });
    }
  }
  return response;
});
```

---

## 8. CORS (Cross-Origin Resource Sharing)

### 8.1 CORS Basics

```javascript
// Simple Request (no preflight required)
// Conditions: GET/HEAD/POST, specific headers only, specific Content-Types only
const response = await fetch('https://api.example.com/data', {
  method: 'GET',
  mode: 'cors', // Default
});

// Request requiring preflight
// When using custom headers or Content-Type: application/json
const response = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json', // triggers preflight
    'X-Custom-Header': 'value',          // triggers preflight
  },
  body: JSON.stringify({ key: 'value' }),
  mode: 'cors',
});

// Server-side configuration example (Express.js)
// app.use(cors({
//   origin: ['https://example.com', 'https://app.example.com'],
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
//   exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
//   credentials: true,
//   maxAge: 86400, // Cache duration of preflight result (seconds)
// }));
```

### 8.2 CORS Troubleshooting

```javascript
// Common CORS errors and solutions

// Error 1: No 'Access-Control-Allow-Origin' header
// → Set the Access-Control-Allow-Origin header on the server side

// Error 2: credentials flag is true but Access-Control-Allow-Origin is *
// → When using credentials: 'include', server must return a specific origin
// → Access-Control-Allow-Origin: https://app.example.com (* is not allowed)

// Error 3: Method not allowed
// → Add the HTTP method to the server's Access-Control-Allow-Methods

// no-cors mode (request is sent but response cannot be read)
const response = await fetch('https://third-party.com/api', {
  mode: 'no-cors', // opaque response (no access to status or body)
});
// response.type === 'opaque'
// response.status === 0
// response.body is null

// Bypassing CORS via proxy (development environment)
// vite.config.ts
// export default defineConfig({
//   server: {
//     proxy: {
//       '/api': {
//         target: 'https://api.example.com',
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/api/, ''),
//       },
//     },
//   },
// });
```

---

## 9. Testing Strategy

### 9.1 Mocking with MSW (Mock Service Worker)

```typescript
// msw v2 setup
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Handler definitions
const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ]);
  }),

  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;
    if (id === '999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      id: Number(id),
      name: 'John Doe',
      email: 'john@example.com',
    });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 3, ...body },
      { status: 201 }
    );
  }),

  // Mock streaming response
  http.get('/api/events', () => {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"type":"hello"}\n\n'));
        await new Promise(r => setTimeout(r, 100));
        controller.enqueue(encoder.encode('data: {"type":"update","value":42}\n\n'));
        await new Promise(r => setTimeout(r, 100));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }),

  // Error response
  http.get('/api/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),

  // Network error
  http.get('/api/network-error', () => {
    return HttpResponse.error();
  }),

  // Delayed response
  http.get('/api/slow', async () => {
    await new Promise(r => setTimeout(r, 5000));
    return HttpResponse.json({ data: 'slow response' });
  }),
];

const server = setupServer(...handlers);

// Test setup
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test examples
describe('API Client', () => {
  test('can fetch user list', async () => {
    const users = await api.get('/api/users');
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe('John Doe');
  });

  test('handles 404 error correctly', async () => {
    await expect(api.get('/api/users/999')).rejects.toThrow(ApiError);
    await expect(api.get('/api/users/999')).rejects.toMatchObject({
      status: 404,
    });
  });

  test('handles network error correctly', async () => {
    await expect(api.get('/api/network-error')).rejects.toThrow(NetworkError);
  });

  test('handles timeout correctly', async () => {
    const clientWithShortTimeout = new ApiClient({
      baseUrl: '',
      timeout: 100,
    });

    await expect(
      clientWithShortTimeout.get('/api/slow')
    ).rejects.toThrow(TimeoutError);
  });

  test('request can be cancelled', async () => {
    const controller = new AbortController();

    const promise = api.get('/api/slow', undefined, {
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).rejects.toThrow();
  });

  // Overriding a handler within a test
  test('retries on server error', async () => {
    let attempts = 0;

    server.use(
      http.get('/api/data', () => {
        attempts++;
        if (attempts <= 2) {
          return HttpResponse.json(null, { status: 503 });
        }
        return HttpResponse.json({ success: true });
      })
    );

    const result = await fetchWithRetry('/api/data', {}, { maxRetries: 3 });
    const data = await result.json();
    expect(data.success).toBe(true);
    expect(attempts).toBe(3);
  });
});
```

### 9.2 Mocking fetch in Unit Tests

```typescript
// Mocking global fetch (Vitest)
import { vi, describe, test, expect, beforeEach } from 'vitest';

describe('fetchData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('processes successful response', async () => {
    const mockData = { id: 1, name: 'Test' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const result = await fetchData('/api/test');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
  });

  test('processes HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ message: 'Server error' }),
    });

    await expect(fetchData('/api/test')).rejects.toThrow('HTTP 500');
  });

  test('AbortController is used correctly', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      // Verify that signal is passed
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });

    await fetchData('/api/test');
    expect(fetch).toHaveBeenCalled();
  });
});

// Mocking ReadableStream
function createMockReadableStream(chunks: string[]) {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

test('processes streaming response', async () => {
  const chunks = [
    'data: {"content":"Hello"}\n\n',
    'data: {"content":" World"}\n\n',
    'data: [DONE]\n\n',
  ];

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: createMockReadableStream(chunks),
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
  });

  const results: string[] = [];
  for await (const chunk of streamResponse('/api/stream')) {
    results.push(chunk.content);
  }

  expect(results).toEqual(['Hello', ' World']);
});
```

---

## 10. Performance Optimization

### 10.1 Connection Optimization

```javascript
// DNS prefetch
// <link rel="dns-prefetch" href="https://api.example.com">

// Preconnect (DNS + TCP + TLS)
// <link rel="preconnect" href="https://api.example.com">

// Prefetch (pre-loading resources)
// <link rel="prefetch" href="/api/next-page-data">

// Preload (high-priority resources)
// <link rel="preload" href="/api/critical-data" as="fetch" crossorigin>

// fetch priority hint
const response = await fetch('/api/critical-data', {
  priority: 'high', // 'high', 'low', 'auto'
});

const response = await fetch('/api/analytics', {
  priority: 'low',
  keepalive: true, // Keep request alive after page navigation
});

// Sending data when leaving a page with keepalive
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    fetch('/api/analytics/page-exit', {
      method: 'POST',
      body: JSON.stringify({
        page: window.location.pathname,
        duration: performance.now(),
      }),
      keepalive: true, // Keep sending even if page is closed
    });
  }
});

// navigator.sendBeacon (alternative to keepalive)
window.addEventListener('unload', () => {
  navigator.sendBeacon('/api/analytics/page-exit', JSON.stringify({
    page: window.location.pathname,
    duration: performance.now(),
  }));
});
```

### 10.2 Response Caching

```javascript
// Direct use of Cache API
const cacheName = 'api-cache-v1';

async function fetchWithCache(url, options = {}) {
  const cache = await caches.open(cacheName);

  // Search in cache
  const cachedResponse = await cache.match(url);
  if (cachedResponse) {
    // Check cache age
    const cachedDate = new Date(cachedResponse.headers.get('Date') || 0);
    const age = Date.now() - cachedDate.getTime();

    if (age < 5 * 60 * 1000) { // Within 5 minutes
      return cachedResponse;
    }
  }

  // Fetch from network
  const response = await fetch(url, options);

  if (response.ok) {
    // Save response to cache (clone is necessary)
    cache.put(url, response.clone());
  }

  return response;
}

// Stale-While-Revalidate pattern
async function staleWhileRevalidate(url, options = {}) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(url);

  // Update in the background
  const fetchPromise = fetch(url, options).then(response => {
    if (response.ok) {
      cache.put(url, response.clone());
    }
    return response;
  });

  // Return immediately if cached (simultaneously update in background)
  return cachedResponse || fetchPromise;
}
```

### 10.3 Bundle Size Considerations

```javascript
// fetch polyfill (rarely needed for legacy browser support anymore)
// Browsers supporting ES2017+ all implement fetch natively
// Safari 10.1+, Chrome 42+, Firefox 39+, Edge 14+

// ★ The whatwg-fetch polyfill is not needed in new projects
// ★ isomorphic-fetch is also not needed (Node.js 18+ has native fetch support)

// fetch in Node.js
// Node.js 18+: native fetch is available
// Node.js 16-17: use the undici package
// import { fetch } from 'undici';

// fetch in Deno: natively supported
// Bun: natively supported
```

---

## 11. Security Considerations

### 11.1 XSS Prevention

```javascript
// Safe processing of API responses

// ★ Do not insert response data directly into the DOM
const user = await fetch('/api/users/1').then(r => r.json());

// Dangerous: XSS vulnerability
// element.innerHTML = user.bio;

// Safe: use textContent
element.textContent = user.bio;

// React has XSS protection by default
// <div>{user.bio}</div> → automatically escaped

// ★ Use dangerouslySetInnerHTML only with trusted data
// <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />

// Sanitization with DOMPurify
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(user.richBio);
element.innerHTML = clean;
```

### 11.2 CSRF Prevention

```javascript
// Sending a CSRF token
async function fetchWithCSRF(url, options = {}) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
    || getCookie('XSRF-TOKEN');

  const headers = new Headers(options.headers);
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  return fetch(url, { ...options, headers, credentials: 'same-origin' });
}

// SameSite Cookie (server-side configuration)
// Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly

// Double Submit Cookie pattern
// 1. Server sends CSRF token in both Cookie and response body
// 2. Client includes the cookie token in the request header
// 3. Server verifies that Cookie and header token match
```

### 11.3 Protecting Sensitive Information

```javascript
// ★ Do not include access tokens in the URL
// Bad example: fetch(`/api/data?token=${accessToken}`)
// → URLs are recorded in logs, leaked via Referer header

// Good example: use Authorization header
fetch('/api/data', {
  headers: { 'Authorization': `Bearer ${accessToken}` },
});

// ★ Be careful about caching responses
// Set cache control headers for sensitive data
// Cache-Control: no-store, no-cache, must-revalidate
// Pragma: no-cache

// ★ Do not include sensitive information in error messages
// Bad example: throw new Error(`API key ${apiKey} is invalid`);
// Good example: throw new Error('Authentication failed');

// Restrict fetch destinations with Content-Security-Policy
// Content-Security-Policy: connect-src 'self' https://api.example.com
```

---

## 12. Production Pattern Collection

### 12.1 Pagination

```typescript
// Offset-based pagination
async function fetchPaginated<T>(
  url: string,
  page: number,
  limit: number
): Promise<{ data: T[]; total: number; hasMore: boolean }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const response = await fetch(`${url}?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const result = await response.json();
  return {
    data: result.data,
    total: result.total,
    hasMore: page * limit < result.total,
  };
}

// Cursor-based pagination
async function* fetchAllPages<T>(
  url: string,
  limit = 100
): AsyncGenerator<T[]> {
  let cursor: string | null = null;

  while (true) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`${url}?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    yield result.data;

    cursor = result.nextCursor;
    if (!cursor || result.data.length === 0) break;
  }
}

// Usage example: collecting all pages of data
async function fetchAllUsers() {
  const allUsers: User[] = [];

  for await (const page of fetchAllPages<User>('/api/users', 50)) {
    allUsers.push(...page);
    console.log(`Loaded ${allUsers.length} users so far...`);
  }

  return allUsers;
}

// Infinite scroll implementation (React)
function InfiniteScrollList() {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('cursor', cursor);

      const response = await fetch(`/api/items?${params}`);
      const result = await response.json();

      setItems(prev => [...prev, ...result.data]);
      setCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } catch (err) {
      console.error('Load more failed:', err);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  return (
    <div>
      {items.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
      {hasMore && <div ref={sentinelRef}>{loading ? 'Loading...' : ''}</div>}
    </div>
  );
}
```

### 12.2 Optimistic Updates

```typescript
// Optimistic update pattern
async function optimisticUpdate<T>(
  currentState: T,
  optimisticState: T,
  setState: (state: T) => void,
  apiCall: () => Promise<T>
): Promise<T> {
  // 1. Update UI immediately
  setState(optimisticState);

  try {
    // 2. API call
    const serverState = await apiCall();
    // 3. Overwrite with server result
    setState(serverState);
    return serverState;
  } catch (err) {
    // 4. Rollback on error
    setState(currentState);
    throw err;
  }
}

// Usage example in React (like button)
function LikeButton({ postId, initialLiked, initialCount }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  const toggleLike = async () => {
    const previousLiked = liked;
    const previousCount = count;

    // Optimistic update
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);

    try {
      const result = await fetch(`/api/posts/${postId}/like`, {
        method: liked ? 'DELETE' : 'POST',
      });

      if (!result.ok) throw new Error('Failed');

      const data = await result.json();
      setCount(data.likeCount);
    } catch (err) {
      // Rollback
      setLiked(previousLiked);
      setCount(previousCount);
      toast.error('Operation failed');
    }
  };

  return (
    <button onClick={toggleLike} className={liked ? 'liked' : ''}>
      {liked ? '❤' : '♡'} {count}
    </button>
  );
}
```

### 12.3 Polling and WebSocket

```typescript
// Long polling
async function longPoll(url: string, onMessage: (data: any) => void) {
  while (true) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60000), // 60-second timeout
      });

      if (response.ok) {
        const data = await response.json();
        onMessage(data);
      }
    } catch (err) {
      if (err.name === 'TimeoutError') {
        // Timeout is normal (reconnect)
        continue;
      }
      // Wait a bit and retry on error
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Interval polling (with exponential backoff)
class Poller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: number;
  private maxInterval: number;
  private currentInterval: number;

  constructor(
    private url: string,
    private onData: (data: any) => void,
    options: { interval?: number; maxInterval?: number } = {}
  ) {
    this.interval = options.interval || 5000;
    this.maxInterval = options.maxInterval || 60000;
    this.currentInterval = this.interval;
  }

  start() {
    this.poll();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async poll() {
    try {
      const response = await fetch(this.url);
      if (response.ok) {
        const data = await response.json();
        this.onData(data);
        this.currentInterval = this.interval; // Reset on success
      }
    } catch (err) {
      // Back off on error
      this.currentInterval = Math.min(
        this.currentInterval * 2,
        this.maxInterval
      );
    }

    this.timer = setTimeout(() => this.poll(), this.currentInterval);
  }
}

// Usage example
const poller = new Poller('/api/notifications', (data) => {
  updateNotifications(data);
}, { interval: 10000 });

poller.start();
// poller.stop();
```

---

## 13. Fetch in Node.js / Edge Runtime

### 13.1 Fetch API in Node.js

```javascript
// Native fetch in Node.js 18+
const response = await fetch('https://api.example.com/data');
const data = await response.json();

// Node.js-specific configuration
// ★ keepalive defaults to false in Node.js
const response = await fetch('https://api.example.com/data', {
  keepalive: true,
});

// ★ In Node.js, HTTPS certificate validation can be customized (when using undici)
import { Agent, fetch } from 'undici';

const agent = new Agent({
  connect: {
    rejectUnauthorized: false, // Development environment only
  },
});

const response = await fetch('https://self-signed.example.com/api', {
  dispatcher: agent,
});

// Proxy configuration (when using undici)
import { ProxyAgent, fetch } from 'undici';

const proxyAgent = new ProxyAgent('http://proxy.example.com:8080');
const response = await fetch('https://api.example.com/data', {
  dispatcher: proxyAgent,
});
```

### 13.2 Next.js fetch Extensions

```typescript
// fetch extensions in Next.js App Router
// Data fetching in Server Components

// Static rendering (executed at build time, cached)
const data = await fetch('https://api.example.com/posts', {
  cache: 'force-cache', // Default (prior to Next.js 14)
});

// Dynamic rendering (executed per request)
const data = await fetch('https://api.example.com/posts', {
  cache: 'no-store',
});

// ISR (Incremental Static Regeneration)
const data = await fetch('https://api.example.com/posts', {
  next: {
    revalidate: 60, // Revalidate every 60 seconds
  },
});

// Tag-based revalidation
const data = await fetch('https://api.example.com/posts', {
  next: {
    tags: ['posts'], // Invalidate with revalidateTag('posts')
  },
});

// Revalidation from a Server Action
'use server';
import { revalidateTag, revalidatePath } from 'next/cache';

async function createPost(formData: FormData) {
  await fetch('https://api.example.com/posts', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(formData)),
  });

  revalidateTag('posts');
  revalidatePath('/posts');
}
```

---

## 14. Debugging and Troubleshooting

### 14.1 Investigation with DevTools

```javascript
// Information available in the DevTools Network tab
// - Request/response headers
// - Request body
// - Response body
// - Timing (DNS, TCP, TLS, TTFB, content download)
// - CORS headers (including preflight requests)

// Debugging fetch in the console
// Intercept all fetch requests
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const [url, options] = args;
  console.group(`fetch: ${options?.method || 'GET'} ${url}`);
  console.log('Options:', options);

  const startTime = performance.now();

  try {
    const response = await originalFetch.apply(this, args);
    const duration = performance.now() - startTime;

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration.toFixed(0)}ms`);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    console.groupEnd();

    return response;
  } catch (err) {
    const duration = performance.now() - startTime;
    console.error(`Error after ${duration.toFixed(0)}ms:`, err);
    console.groupEnd();
    throw err;
  }
};

// Performance measurement with the Resource Timing API
const entries = performance.getEntriesByType('resource');
const fetchEntries = entries.filter(e => e.initiatorType === 'fetch');

for (const entry of fetchEntries) {
  console.log({
    name: entry.name,
    duration: entry.duration,
    transferSize: entry.transferSize,
    dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
    tcpConnect: entry.connectEnd - entry.connectStart,
    ttfb: entry.responseStart - entry.requestStart,
    download: entry.responseEnd - entry.responseStart,
  });
}
```

### 14.2 Common Problems and Solutions

```javascript
// Problem 1: JSON parse error
// → When the response is not JSON (HTML, error page, etc.)
try {
  const data = await response.json();
} catch (err) {
  if (err instanceof SyntaxError) {
    const text = await response.clone().text();
    console.error('Invalid JSON response:', text.substring(0, 200));
  }
}

// Problem 2: Memory leak (unconsumed response)
// → If the response body is not read, it stays in memory
const response = await fetch('/api/data');
if (!response.ok) {
  // ★ Also consume the body on error
  await response.text(); // or response.body?.cancel()
  throw new Error(`HTTP ${response.status}`);
}

// Problem 3: Simultaneous request limit
// → Browsers allow up to 6-8 parallel connections per domain
// → Limit concurrency when sending many requests

// Problem 4: fetch does not complete
// → Always set a timeout
// → Use AbortSignal.timeout()

// Problem 5: fetch inside a Service Worker
// → Watch out for infinite loops (calling fetch within a fetch event)
self.addEventListener('fetch', (event) => {
  // ★ Avoid fetching the same URL
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request); // Service Worker fetch is in a separate context
      })
    );
  }
});
```

---

## FAQ

### Q1: What is the difference between fetch and XMLHttpRequest?

**Answer:** The main differences between Fetch and XMLHttpRequest (XHR) are as follows. **(1) API design philosophy**: Fetch adopts a Promise-based modern async pattern (`async`/`await`), while XHR is callback-based. **(2) Streaming support**: Fetch is integrated with the Streams API and can read the response body incrementally, but XHR loads the entire response into memory. **(3) Request cancellation**: Fetch has a standard cancellation mechanism via AbortController, while XHR uses `xhr.abort()`. **(4) CORS and credentials**: Fetch allows explicit control with `mode` and `credentials` options, while XHR uses the `withCredentials` property. **(5) Progress events**: XHR makes it easy to get progress via `progress` events, but Fetch requires manual implementation with the Streams API Reader. In general, use Fetch for new development and only consider XHR for maintaining legacy code or situations where progress display is critical.

### Q2: What are practical use cases for the Streams API?

**Answer:** The Streams API excels in the following practical use cases. **(1) Downloading large files**: Files hundreds of MB to GB can be written to disk in chunks without loading them into memory at once, reducing memory usage. Progress display is also easy to implement. **(2) Real-time data streams**: Server-Sent Events or NDJSON-format streaming responses can be parsed incrementally, updating the UI as data arrives. Ideal for chat apps and dashboards. **(3) Data transformation pipelines**: Using TransformStream, you can build a pipeline of download → decompress → parse → display, processing efficiently with backpressure control. **(4) Incremental parsing of CSV/JSONL**: Files with millions of rows of CSV or JSON Lines can be processed line by line without loading them into memory at once, avoiding browser memory limits. **(5) Streaming playback of video/audio**: Incrementally decode as a media stream, minimizing wait time until playback starts (in combination with Media Source Extensions).

### Q3: How do I use fetch cancellation (AbortController)?

**Answer:** AbortController is used in the following patterns.

```javascript
// Basic pattern: manual cancellation
const controller = new AbortController();
const signal = controller.signal;

fetch('/api/data', { signal })
  .then(response => response.json())
  .catch(err => {
    if (err.name === 'AbortError') {
      console.log('Request was cancelled');
    } else {
      throw err;
    }
  });

// Cancel on user action
cancelButton.addEventListener('click', () => {
  controller.abort(); // Immediately abort the fetch
});

// Timeout configuration (modern browsers)
const signal = AbortSignal.timeout(5000); // 5-second timeout
fetch('/api/slow', { signal });

// Combining multiple conditions (user cancel OR timeout)
const userController = new AbortController();
const combinedSignal = AbortSignal.any([
  userController.signal,
  AbortSignal.timeout(10000)
]);
fetch('/api/data', { signal: combinedSignal });

// Automatic cleanup in React etc.
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal })
    .then(/* ... */);

  return () => controller.abort(); // Automatically abort on component unmount
}, []);
```

**Note**: After `abort()`, the fetch is immediately rejected with `AbortError`, but server-side processing continues (the HTTP request itself cannot be cancelled). On the client side, only the response is ignored.

---

## Summary

| Concept | Key Points |
|---------|-----------|
| Fetch API | Successor to XMLHttpRequest, Promise-based, must check response.ok |
| Request / Response | Immutable, clone() to duplicate, body can only be read once |
| AbortController | Request cancellation, timeout, combine with AbortSignal.any() |
| ReadableStream | Incremental response processing, backpressure control |
| TransformStream | Transformation pipeline for stream data |
| WritableStream | Data write destination, connect with pipeTo() |
| SSE | Server-Sent Events, process with EventSource or Fetch+Streams |
| Retry | Exponential backoff, Retry-After header, jitter |
| Cache | ETag / Last-Modified conditional requests, Cache API |
| CORS | Preflight, credentials, mode configuration |
| Security | CSRF prevention, XSS protection, safe token transmission |
| Testing | Mocking with MSW, integration testing |

---

## Next Guides to Read

- [02-intersection-resize-observer.md](./02-intersection-resize-observer.md) -- Observer APIs (IntersectionObserver, ResizeObserver, MutationObserver)
- [../04-storage-and-caching/00-web-storage.md](../04-storage-and-caching/00-web-storage.md) -- Web Storage API (localStorage, sessionStorage, IndexedDB)
- [../04-storage-and-caching/01-service-worker-cache.md](../04-storage-and-caching/01-service-worker-cache.md) -- Service Worker and Cache API

---

## References

1. Fetch Living Standard. WHATWG, 2024. https://fetch.spec.whatwg.org/
2. MDN Web Docs. "Fetch API." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
3. MDN Web Docs. "Streams API." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
4. MDN Web Docs. "AbortController." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/AbortController
5. MDN Web Docs. "ReadableStream." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
6. MDN Web Docs. "TransformStream." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/TransformStream
7. Jake Archibald. "Streams — The Definitive Guide." web.dev, 2023.
8. Web.dev. "Fetch API." Google, 2024. https://web.dev/articles/introduction-to-fetch
9. MSW Documentation. "Mock Service Worker." 2024. https://mswjs.io/
10. Undici Documentation. "Node.js HTTP Client." 2024. https://undici.nodejs.org/
