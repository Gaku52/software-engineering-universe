# HTTP/2 and HTTP/3

> HTTP/2 solves HTTP/1.1 performance problems with binary framing and multiplexing. HTTP/3 goes further with QUIC-based speed improvements. Understand the protocol evolution that drives web performance.

## Prerequisites


To understand the design philosophy of HTTP/2 and HTTP/3, you need to know the limitations of HTTP/1.1 (especially TCP-level Head-of-Line Blocking) and how TLS works.

---

## What You Will Learn

- [ ] Understand the problems with HTTP/1.1 and the issues HTTP/2 solved
- [ ] Grasp the main HTTP/2 features (multiplexing, HPACK, server push, etc.)
- [ ] Learn the design philosophy and benefits of HTTP/3 and the QUIC protocol
- [ ] Master server configuration and verification methods for each protocol
- [ ] Use performance measurement tools (h2load, curl)
- [ ] Understand the criteria for adopting HTTP/2 and HTTP/3 in production

---

## 1. Problems with HTTP/1.1 -- Why HTTP/2 Was Needed

### 1.1 Head-of-Line Blocking (HoL Blocking)

The most serious problem with HTTP/1.1 is Head-of-Line Blocking. On a single TCP connection,
requests and responses are processed strictly in order. The next request cannot be processed
until the previous response completes.

```
HTTP/1.1 Head-of-Line Blocking:

  Client                          Server
    │                               │
    │──── GET /page.html ──────────→│
    │                               │ (processing...)
    │←── 200 OK + HTML ────────────│
    │                               │
    │──── GET /style.css ──────────→│  ← Can only send after HTML completes
    │                               │ (processing...)
    │←── 200 OK + CSS ─────────────│
    │                               │
    │──── GET /app.js ─────────────→│  ← Can only send after CSS completes
    │                               │ (processing...)
    │←── 200 OK + JS ──────────────│
    │                               │

  Total time = RTT × 3 + sum of each processing time
  → The more resources a page has, the more severe this becomes
```

HTTP/1.1 has a mechanism called Pipelining in its specification,
but in practice it was not correctly implemented in most servers and proxies, and browsers
also disable it by default. Pipelining still needed to guarantee response order,
so it did not fundamentally solve HoL Blocking.

### 1.2 Resource Consumption from Multiple TCP Connections

Browsers open up to 6 simultaneous TCP connections to the same origin to mitigate HoL Blocking.
However, this comes with the following costs.

```
6 connections to the same domain (HTTP/1.1):

  ┌────────────────────────────────────────────────┐
  │ Browser (6 connections to example.com)           │
  │                                                  │
  │  Conn 1: ─── 3-way HS ─── TLS HS ─── req/res ───│
  │  Conn 2: ─── 3-way HS ─── TLS HS ─── req/res ───│
  │  Conn 3: ─── 3-way HS ─── TLS HS ─── req/res ───│
  │  Conn 4: ─── 3-way HS ─── TLS HS ─── req/res ───│
  │  Conn 5: ─── 3-way HS ─── TLS HS ─── req/res ───│
  │  Conn 6: ─── 3-way HS ─── TLS HS ─── req/res ───│
  │                                                  │
  │  Per connection:                                  │
  │    TCP 3-way HS: 1 RTT                           │
  │    TLS 1.2 HS:   2 RTT                           │
  │    Total:        3 RTT × 6 connections = 18 RTT  │
  │                  handshake overhead               │
  │                                                  │
  │  Server-side impact:                              │
  │    · Socket resources × 6 (memory, FD usage)     │
  │    · TCP slow start × 6 (inefficient bandwidth)  │
  │    · 10,000 clients → 60,000 connections         │
  └────────────────────────────────────────────────┘
```

### 1.3 Header Redundancy

In HTTP/1.1, headers are sent uncompressed as plain text.
During navigation within a site, nearly identical headers such as Cookie,
User-Agent, and Accept-Language are sent repeatedly with every request.

```
Typical HTTP/1.1 request headers (~700 bytes):

GET /api/users HTTP/1.1
Host: api.example.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: application/json, text/plain, */*
Accept-Language: ja,en-US;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
Cookie: session=abc123def456; csrftoken=xyz789; preferences=theme%3Ddark%26lang%3Dja
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIx...
Referer: https://example.com/dashboard
Connection: keep-alive

→ 100 requests = ~70KB of headers alone transmitted
→ Non-negligible overhead on mobile connections
```

### 1.4 HTTP/1.1-Era Optimization Techniques (Made Unnecessary by HTTP/2)

A summary of techniques developers used to work around HTTP/1.1 limitations, and why HTTP/2
made them unnecessary.

```
┌─────────────────┬─────────────────────┬──────────────────────┐
│ Technique        │ Purpose in HTTP/1.1  │ Treatment in HTTP/2   │
├─────────────────┼─────────────────────┼──────────────────────┤
│ Domain sharding  │ Bypass 6-conn limit  │ Unnecessary (1-conn  │
│                  │ (cdn1, cdn2...)      │ mux); increases TLS  │
│                  │                     │ cost instead          │
├─────────────────┼─────────────────────┼──────────────────────┤
│ Sprite images    │ Reduce request count │ Unnecessary (parallel│
│                  │ Combine into 1 image │ fetch via mux);      │
│                  │                     │ hurts cache efficiency│
├─────────────────┼─────────────────────┼──────────────────────┤
│ CSS inlining     │ Reduce external reqs │ Unnecessary (parallel│
│                  │ Embed <style> in HTML│ fetch possible);     │
│                  │                     │ prevents caching      │
├─────────────────┼─────────────────────┼──────────────────────┤
│ File bundling    │ Combine JS/CSS into  │ Unnecessary (parallel│
│ (Bundling)       │ 1 file; reduce reqs  │ fetch via mux);      │
│                  │                     │ breaks diff caching   │
├─────────────────┼─────────────────────┼──────────────────────┤
│ Data URI scheme  │ Embed small images   │ Unnecessary (small   │
│                  │ as Base64; reduce    │ files fetched         │
│                  │ request count        │ efficiently via mux) │
└─────────────────┴─────────────────────┴──────────────────────┘

Note: Bundling may still be useful in HTTP/2 environments.
      When there are very many files (hundreds of modules),
      moderate bundling can optimize the initial load.
```

---

## 2. HTTP/2 Key Features

### 2.1 Binary Framing Layer

HTTP/2 introduced a binary-based framing layer, moving away from the text-based
protocol of HTTP/1.1. All HTTP communication is split into frames that flow
over logical channels called streams.

```
HTTP/2 Frame Structure:

  ┌─────────────────────────────────────────────┐
  │  Length (24 bits)                             │  Bytes in frame payload
  ├──────────────────────┬──────────────────────┤
  │  Type (8 bits)        │  Flags (8 bits)       │  Frame type and flags
  ├──────────────────────┴──────────────────────┤
  │  R │  Stream Identifier (31 bits)            │  Owning stream ID
  ├─────────────────────────────────────────────┤
  │                                               │
  │  Frame Payload (variable length)              │  Actual data
  │                                               │
  └─────────────────────────────────────────────┘

  Minimum frame header: 9 bytes
  Maximum payload size: 16,384 bytes (default)
                        up to 16,777,215 bytes (~16MB)

Major frame types:

  ┌────────────┬──────┬─────────────────────────────────┐
  │ Type        │ Val  │ Description                     │
  ├────────────┼──────┼─────────────────────────────────┤
  │ DATA       │ 0x00 │ HTTP body data                   │
  │ HEADERS    │ 0x01 │ HTTP headers (HPACK compressed)  │
  │ PRIORITY   │ 0x02 │ Stream priority (deprecated)     │
  │ RST_STREAM │ 0x03 │ Abort a stream                   │
  │ SETTINGS   │ 0x04 │ Negotiate connection parameters  │
  │ PUSH_PROMISE│0x05 │ Announce a server push           │
  │ PING       │ 0x06 │ Connection health check          │
  │ GOAWAY     │ 0x07 │ Notify connection close          │
  │ WINDOW_UPDATE│0x08│ Update flow-control window       │
  │ CONTINUATION│0x09 │ Continue a header block          │
  └────────────┴──────┴─────────────────────────────────┘
```

### 2.2 Streams and Multiplexing

The most important feature of HTTP/2 is multiplexing.
Multiple logical streams are established over a single TCP connection, and each stream
independently carries a request/response pair.

```
HTTP/1.1 vs HTTP/2 Resource Loading Flow:

  === HTTP/1.1 (6 connections, 12 resources) ===

  Time ──────────────────────────────────────→

  Conn 1: [──HTML──]                [──img3──]
  Conn 2:     [──CSS──]             [──img4──]
  Conn 3:     [──JS1──]             [──img5──]
  Conn 4:         [──JS2──]         [──img6──]
  Conn 5:             [──img1──]
  Conn 6:             [──img2──]

  → 6 connections, max 6 parallel; high connection setup cost
  → A slow connection doesn't affect others (upside)
  → Large connection management overhead

  === HTTP/2 (1 connection, 12 resources) ===

  Time ──────────────────────────────────→

  Stream 1:  [──HTML──]
  Stream 3:  [───CSS───]
  Stream 5:  [──JS1──]
  Stream 7:    [──JS2──]
  Stream 9:      [──img1──]
  Stream 11:     [──img2──]
  Stream 13:       [──img3──]
  Stream 15:       [──img4──]
  Stream 17:         [──img5──]
  Stream 19:         [──img6──]
  Stream 21:           [font1]
  Stream 23:           [font2]

  → All resources fetched in parallel over 1 connection
  → Connection established only once
  → Streams identified by ID (client-initiated = odd numbers)
  → Interleaved at the frame level
```

A closer look at the internal mechanics of multiplexing.

```
Frames interleaved on a single TCP connection:

  TCP connection ─────────────────────────────────────────→

  │H1│D1│H3│D3│D1│H5│D5│D3│D1│D5│D3│D5│

  H = HEADERS frame  D = DATA frame
  Number = stream ID

  Expanded:
    Stream 1 (HTML):  [H1][D1]   [D1]   [D1]
    Stream 3 (CSS):      [H3][D3]   [D3]   [D3]
    Stream 5 (JS):            [H5][D5]   [D5][D5]

  → Frames from each stream are time-multiplexed
  → Receiver reassembles per stream ID
  → Large responses do not block small ones
```

### 2.3 HPACK (Header Compression)

HTTP/2 uses a dedicated header compression format called HPACK (RFC 7541).
HPACK consists of three components: a static table, a dynamic table, and Huffman coding.

```
How HPACK compression works:

  ┌────────────────────────────────────────────────┐
  │                 HPACK Encoder                   │
  │                                                  │
  │  1. Static table (61 entries, defined in RFC)    │
  │     ┌───────┬────────────────┬──────────────┐   │
  │     │ Index │ Header Name    │ Header Value │   │
  │     ├───────┼────────────────┼──────────────┤   │
  │     │ 1     │ :authority     │              │   │
  │     │ 2     │ :method        │ GET          │   │
  │     │ 3     │ :method        │ POST         │   │
  │     │ 4     │ :path          │ /            │   │
  │     │ 5     │ :path          │ /index.html  │   │
  │     │ 6     │ :scheme        │ http         │   │
  │     │ 7     │ :scheme        │ https        │   │
  │     │ ...   │ ...            │ ...          │   │
  │     │ 61    │ www-authenticate│             │   │
  │     └───────┴────────────────┴──────────────┘   │
  │                                                  │
  │  2. Dynamic table (FIFO, managed per connection) │
  │     ┌───────┬────────────────┬──────────────┐   │
  │     │ 62    │ host           │ api.example  │   │
  │     │ 63    │ authorization  │ Bearer xxx   │   │
  │     │ 64    │ custom-header  │ value123     │   │
  │     └───────┴────────────────┴──────────────┘   │
  │                                                  │
  │  3. Huffman coding                               │
  │     → Assign shorter bit sequences to frequent  │
  │       characters                                 │
  │     → Alphanumerics: 5-7 bits (less than ASCII's │
  │       8 bits)                                    │
  │     → Further compresses header values by 15-20% │
  └────────────────────────────────────────────────┘

  Example of effect:
    1st request:
      :method: GET             → Static table Index 2 (1 byte)
      :path: /api/users        → Name from static Index 4, value literal
      host: api.example.com    → Literal (added to dynamic table)
      authorization: Bearer... → Literal (added to dynamic table)
      Total: ~120 bytes (85% reduction from 800 bytes)

    2nd request:
      :method: GET             → Static table Index 2 (1 byte)
      :path: /api/users/123    → Name from static, only value literal
      host: api.example.com    → Dynamic table Index 62 (1 byte)
      authorization: Bearer... → Dynamic table Index 63 (1 byte)
      Total: ~30 bytes (96% reduction from 800 bytes)
```

### 2.4 Server Push

Server push is a feature that allows the server to preemptively send resources before
the client requests them. When it predicts that a CSS/JS request will follow HTML parsing,
it announces the push with a PUSH_PROMISE frame and then sends the resource.

```
Server push flow:

  Client                              Server
    │                                   │
    │──── HEADERS (GET /index.html) ───→│
    │                                   │
    │←── PUSH_PROMISE (Stream 2)  ─────│  "Sending /style.css"
    │←── PUSH_PROMISE (Stream 4)  ─────│  "Sending /app.js"
    │                                   │
    │←── HEADERS (Stream 1, 200 OK) ───│  index.html headers
    │←── DATA (Stream 1, HTML body) ───│  index.html body
    │                                   │
    │←── HEADERS (Stream 2, 200 OK) ───│  style.css headers
    │←── DATA (Stream 2, CSS body) ────│  style.css body
    │                                   │
    │←── HEADERS (Stream 4, 200 OK) ───│  app.js headers
    │←── DATA (Stream 4, JS body)  ────│  app.js body
    │                                   │

  Client can reject unwanted pushes with RST_STREAM

  Important history:
    Chrome 106 (October 2022) removed server push support
    Reasons:
      - Pushed resources waste bandwidth if already cached
      - Difficult to accurately determine what to push
      - 103 Early Hints is more flexible and effective
      - Push doesn't work as intended through CDNs

  Alternative technologies:
    103 Early Hints:
      Server sends hints before the final response (200)
      → Browser starts preload / preconnect early
      → Unlike server push, the browser decides what to fetch

    <link rel="preload">:
      Declare resource prefetching in HTML <head>
      → Delegate priority control to the browser
```

### 2.5 Flow Control

HTTP/2 performs flow control at two levels: stream level and connection level.
This is application-layer control, independent of TCP flow control.

```
How HTTP/2 flow control works:

  Initial window size: 65,535 bytes (changeable via SETTINGS)

  ┌──────────────────────────────────────────┐
  │ Connection-level flow control              │
  │   Controls total send volume across streams│
  │   Updated with WINDOW_UPDATE(Stream 0)    │
  │                                            │
  │  ┌────────────────────────────────────┐   │
  │  │ Stream 1 flow control               │   │
  │  │   Controls send volume on this stream│  │
  │  │   Updated with WINDOW_UPDATE(Str 1) │   │
  │  └────────────────────────────────────┘   │
  │  ┌────────────────────────────────────┐   │
  │  │ Stream 3 flow control               │   │
  │  │   Controls send volume on this stream│  │
  │  │   Updated with WINDOW_UPDATE(Str 3) │   │
  │  └────────────────────────────────────┘   │
  └──────────────────────────────────────────┘

  Sender:
    Sending DATA frame → window size decreases
    Window = 0 → stop sending

  Receiver:
    DATA received and processed → send WINDOW_UPDATE
    → Sender's window recovers → resume sending
```

### 2.6 Stream Priority

HTTP/2 lets you assign weights and dependency relationships to streams.
This allows important resources (CSS, fonts) to be delivered before images.

```
HTTP/2 stream priority dependency tree:

          Root (Stream 0)
          ├── Stream 1 (HTML)    weight: 256
          │   ├── Stream 3 (CSS) weight: 256   ← CSS gets top priority
          │   │   └── Stream 5 (JS) weight: 220
          │   └── Stream 7 (Font) weight: 183
          └── Stream 9 (Image)   weight: 110   ← Images are deferred

  Bandwidth allocation example (after parent stream completes):
    CSS:  256/(256+183) = 58% of bandwidth
    Font: 183/(256+183) = 42% of bandwidth
    → After CSS completes, JS gets 100% of bandwidth

  Note:
    RFC 9218 (Extensible Priorities) standardized a new priority
    scheme shared by HTTP/2 and HTTP/3.
    → Uses the Priority header field
    → Two parameters: urgency (u=0..7) and incremental (i=true/false)
    → Simpler and easier to implement than dependency trees
```

---

## 3. Verifying and Measuring HTTP/2

### 3.1 Confirming HTTP/2 Connections with curl

```bash
# Example 1: Verify HTTP/2 connection with curl
# --http2 flag requests HTTP/2
# -v (verbose) shows connection details

$ curl -v --http2 https://www.google.com/ -o /dev/null 2>&1 | head -30

* Connected to www.google.com (142.250.xx.xx) port 443
* ALPN: curl offers h2,http/1.1
* TLSv1.3 (OUT), TLS handshake, Client hello
* TLSv1.3 (IN), TLS handshake, Server hello
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
* ALPN: server accepted h2          ← HTTP/2 selected
* using HTTP/2
* [HTTP/2] [1] OPENED stream for https://www.google.com/
* [HTTP/2] [1] [:method: GET]
* [HTTP/2] [1] [:scheme: https]
* [HTTP/2] [1] [:authority: www.google.com]
* [HTTP/2] [1] [:path: /]
> GET / HTTP/2                       ← Request via HTTP/2
> Host: www.google.com
> User-Agent: curl/8.x.x
> Accept: */*
>
< HTTP/2 200                         ← Response via HTTP/2
< content-type: text/html; charset=UTF-8
< date: Thu, 01 Jan 2026 00:00:00 GMT
```

```bash
# Example 2: Show detailed HTTP/2 frame info
# Using the nghttp command (from nghttp2 package)

$ nghttp -nv https://www.example.com/

[  0.023] Connected
[  0.050] recv SETTINGS frame
          (niv=3)
          [SETTINGS_MAX_CONCURRENT_STREAMS(0x03):100]
          [SETTINGS_INITIAL_WINDOW_SIZE(0x04):65535]
          [SETTINGS_MAX_FRAME_SIZE(0x05):16384]
[  0.050] send SETTINGS frame
          (niv=2)
          [SETTINGS_MAX_CONCURRENT_STREAMS(0x03):100]
          [SETTINGS_INITIAL_WINDOW_SIZE(0x04):65535]
[  0.050] send HEADERS frame
          ; END_STREAM | END_HEADERS
          (padlen=0)
          :method: GET
          :path: /
          :scheme: https
          :authority: www.example.com
[  0.075] recv HEADERS frame
          ; END_HEADERS
          :status: 200
          content-type: text/html
[  0.076] recv DATA frame
          ; END_STREAM
```

### 3.2 Benchmarking with h2load

h2load is an HTTP/2-capable benchmarking tool included with nghttp2.
It can compare performance across HTTP/1.1, HTTP/2, and HTTP/3.

```bash
# Example 3: HTTP/2 benchmark with h2load

# Basic usage
# -n: total requests  -c: concurrent connections  -m: max streams per connection
$ h2load -n 10000 -c 100 -m 10 https://www.example.com/

starting benchmark...
spawning thread #0: 100 total client(s). 10000 total requests
TLS Protocol: TLSv1.3
Cipher: TLS_AES_256_GCM_SHA384
Server Temp Key: X25519 253 bits
Application protocol: h2                 ← Connected via HTTP/2

finished in 2.35s, 4255.32 req/s, 6.23MB/s
requests: 10000 total, 10000 started, 10000 done, 10000 succeeded, 0 failed
status codes: 10000 2xx, 0 3xx, 0 4xx, 0 5xx
traffic: 14.64MB (15347712) total, 390.63KB (400000) headers, 14.17MB (14853600) data
                     min         max         mean         sd        +/- sd
time for request:     2.10ms    120.45ms     23.45ms     15.30ms    78.50%
time for connect:    45.20ms    185.30ms     98.45ms     35.20ms    65.00%
time to 1st byte:    48.30ms    210.50ms    115.20ms     40.10ms    62.00%
req/s           :      42.55       52.30       45.12        3.20    70.00%

# Comparative measurement against HTTP/1.1
$ h2load -n 10000 -c 100 --h1 https://www.example.com/
# → HTTP/1.1 req/s drops significantly due to 1 request per connection

# Measurement with HTTP/3 (if h2load supports it)
$ h2load -n 10000 -c 100 --npn-list h3 https://www.example.com/
```

### 3.3 Checking in Browser Developer Tools

```
How to verify HTTP/2 in Chrome DevTools:

  1. Open the Network tab
  2. Select any request
  3. Check the Headers tab:
     - "Protocol: h2" means HTTP/2
     - "Protocol: h3" means HTTP/3

  4. Showing the Protocol column (hidden by default):
     - Right-click the header row in the Network tab
     - Check "Protocol"
     - View the protocol for all requests at a glance

  5. Connection ID column:
     - Same Connection ID = sharing the same TCP connection
     - HTTP/2: many requests share the same ID
     - HTTP/1.1: different IDs scattered throughout

  Reading the Waterfall:
    HTTP/1.1: Staircase pattern (sequential loading)
    HTTP/2:   Parallel (many requests start simultaneously)
```

---

## 4. HTTP/3 (QUIC) Design and Mechanics

### 4.1 Overview of the QUIC Protocol

HTTP/3 is the third generation of HTTP, built on the QUIC protocol.
QUIC was originally developed by Google starting in 2012 and was standardized as RFC 9000 in 2021.

```
Protocol stack comparison:

  HTTP/1.1          HTTP/2           HTTP/3
  ┌──────────┐   ┌──────────┐    ┌──────────┐
  │  HTTP    │   │  HTTP/2  │    │  HTTP/3  │
  ├──────────┤   ├──────────┤    ├──────────┤
  │          │   │  TLS 1.2+│    │          │
  │  TCP     │   ├──────────┤    │  QUIC    │
  │          │   │  TCP     │    │(TLS 1.3  │
  ├──────────┤   ├──────────┤    │ built-in)│
  │  IP      │   │  IP      │    ├──────────┤
  └──────────┘   └──────────┘    │  UDP     │
                                  ├──────────┤
                                  │  IP      │
                                  └──────────┘

  QUIC characteristics:
    · Built on UDP (no kernel changes needed)
    · Integrates TLS 1.3 (encryption is mandatory)
    · Streams implemented at the transport layer
    · Connection identified by Connection ID
    · Implemented in user space (OS kernel-independent)
```

### 4.2 QUIC Connection Establishment (0-RTT / 1-RTT)

One of the biggest benefits of QUIC is faster connection establishment. The handshake that
requires 2-3 RTTs with TCP+TLS completes in 1 RTT with QUIC, or 0 RTT on reconnection.

```
Connection establishment comparison:

  === TCP + TLS 1.2 (HTTP/2) === Total 3 RTT ===

  Client                          Server
    │──── SYN ─────────────────→│        ┐
    │←── SYN-ACK ──────────────│        │ TCP: 1.5 RTT
    │──── ACK ─────────────────→│        ┘
    │──── ClientHello ─────────→│        ┐
    │←── ServerHello + Cert ───│        │ TLS 1.2: 2 RTT
    │──── Key Exchange ────────→│        │
    │←── Finished ─────────────│        ┘
    │──── HTTP Request ────────→│   ← Data can finally be sent here
    │←── HTTP Response ────────│

  === TCP + TLS 1.3 (HTTP/2) === Total 2 RTT ===

  Client                          Server
    │──── SYN ─────────────────→│        ┐
    │←── SYN-ACK ──────────────│        │ TCP: 1.5 RTT
    │──── ACK ─────────────────→│        ┘
    │──── ClientHello ─────────→│        ┐
    │←── ServerHello+Finished ─│        │ TLS 1.3: 1 RTT
    │──── Finished ────────────→│        ┘
    │──── HTTP Request ────────→│
    │←── HTTP Response ────────│

  === QUIC (HTTP/3) === First connection: 1 RTT ===

  Client                          Server
    │──── Initial(ClientHello) ─→│       ┐
    │←── Initial(ServerHello)  ──│       │ QUIC+TLS: 1 RTT
    │←── Handshake(Finished)   ──│       │
    │──── Handshake(Finished)  ──→│       ┘
    │──── HTTP Request ──────────→│  ← No TCP handshake needed
    │←── HTTP Response ──────────│

  === QUIC 0-RTT reconnection === Total 0 RTT ===

  Client                          Server
    │──── Initial + 0-RTT Data ──→│  ← Using previous session info,
    │←── Handshake + Response  ──│    send data immediately
    │                              │
    * Due to replay attack risk,
      only idempotent requests (GET, etc.) are recommended for 0-RTT
```

### 4.3 Stream Independence (Resolving TCP HoL Blocking)

HTTP/2 resolved application-layer HoL Blocking but TCP-layer HoL Blocking remained.
QUIC fundamentally solves this.

```
TCP-layer HoL Blocking (HTTP/2 problem):

  When a single packet is lost on a TCP connection,
  all streams must wait for retransmission

  TCP connection: ──[S1][S3][S5][S3][✗ S1 lost][S5]──
                                  ↑
                         Packet lost
                         ↓
  Stream 1: ──[data]─────────────[waiting for retransmit...]──→
  Stream 3: ──[data][data]───────[blocked]──→  ← Unrelated, yet stopped
  Stream 5: ──[data]────[data]───[blocked]──→  ← Unrelated, yet stopped

  TCP guarantees order, so data before the lost packet
  cannot be delivered to the application.

QUIC stream independence:

  QUIC connection: ──[S1][S3][S5][S3][✗ S1 lost][S5]──
                                    ↑
                           Packet lost
                           ↓
  Stream 1: ──[data]─────────────[waiting for retransmit...]──→ ← Affected
  Stream 3: ──[data][data]───────[data]──→        ← Unaffected!
  Stream 5: ──[data]────[data]───[data]──→        ← Unaffected!

  QUIC gives each stream independent ordering guarantees,
  so a loss on one stream does not affect others.
```

### 4.4 Connection Migration

TCP identifies connections by a 4-tuple: source IP:port + destination IP:port.
So when the IP address changes, the connection drops. QUIC identifies connections
by Connection ID, allowing connections to survive network switches.

```
Connection migration scenarios:

  === TCP (HTTP/2): Wi-Fi → Mobile switch ===

  On Wi-Fi:
    Client 192.168.1.10:54321 ←→ Server 203.0.113.1:443
    [TCP connection established, data in flight]

  Switch to mobile:
    Client IP changes to 100.64.0.50
    → TCP 4-tuple changes → connection drops
    → New TCP handshake (1 RTT)
    → New TLS handshake (1-2 RTT)
    → Total 2-3 RTT downtime + session rebuild

  === QUIC (HTTP/3): Wi-Fi → Mobile switch ===

  On Wi-Fi:
    Client 192.168.1.10 ←→ Server 203.0.113.1
    Connection ID: 0xABCD1234
    [QUIC connection established, data in flight]

  Switch to mobile:
    Client IP changes to 100.64.0.50
    → Connection ID remains 0xABCD1234
    → Path Validation (reachability check) only
    → Communication resumes in ~0.5 RTT
    → Stream state is preserved

  Use cases:
    · Wi-Fi ↔ mobile switch on the train
    · Moving from a café to outdoors
    · Network change during VPN connection
    · IoT device network transitions
```

---

## 5. QPACK (Header Compression for HTTP/3)

HTTP/3 uses QPACK instead of HPACK.
HPACK had inter-stream ordering dependencies, but QPACK is designed to match
QUIC's stream independence.

```
Differences between HPACK and QPACK:

  HPACK (HTTP/2):
    · Dynamic table updates are processed in stream order
    · Stream A's reference may depend on Stream B's update
    → Conflicts with QUIC's stream independence

  QPACK (HTTP/3):
    · Encoder stream and decoder stream are separate
    · Dynamic table updates are managed via dedicated unidirectional streams
    · Explicitly manages the range of accessible entries

  ┌──────────────────────────────────────────┐
  │ QPACK stream structure                      │
  │                                            │
  │  Encoder stream (unidirectional)           │
  │    Client → Server                         │
  │    Notifies server of new dynamic table    │
  │    entries                                 │
  │                                            │
  │  Decoder stream (unidirectional)           │
  │    Server → Client                         │
  │    Acknowledges processed entries (ACK)    │
  │                                            │
  │  Request streams (bidirectional, multiple) │
  │    Send header blocks                       │
  │    Wait until required entries are ready   │
  └──────────────────────────────────────────┘

  Compression efficiency is roughly equivalent to HPACK,
  but inter-stream blocking is minimized.
```

---

## 6. Server Configuration in Practice

### 6.1 Nginx Configuration for HTTP/2 and HTTP/3

```nginx
# Example 4: Complete Nginx configuration enabling both HTTP/2 and HTTP/3

# /etc/nginx/conf.d/http2-http3.conf

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

# HTTPS + HTTP/2 + HTTP/3
server {
    # HTTP/2 over TLS
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;

    # HTTP/3 over QUIC (UDP)
    listen 443 quic reuseport;
    listen [::]:443 quic reuseport;
    http3 on;

    server_name example.com www.example.com;

    # TLS certificate
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # TLS settings (HTTP/3 requires TLS 1.3)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # QUIC settings
    ssl_early_data on;          # Enable 0-RTT
    quic_retry on;              # Enable address validation (DoS protection)
    quic_gso on;                # Generic Segmentation Offload

    # Announce HTTP/3 availability via Alt-Svc header
    # Browser will use HTTP/3 on subsequent connections
    add_header Alt-Svc 'h3=":443"; ma=86400' always;

    # HTTP/2 server push (deprecated, shown for reference)
    # http2_push /style.css;
    # http2_push /app.js;

    # Use 103 Early Hints instead
    # add_header Link "</style.css>; rel=preload; as=style" always;

    # HTTP/2 concurrent stream limit
    http2_max_concurrent_streams 128;

    # Content delivery
    root /var/www/example.com;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.2 HTTP/2 Server Implementation in Node.js

```javascript
// Example 5: Node.js HTTP/2 server implementation (with server push)

const http2 = require('node:http2');
const fs = require('node:fs');
const path = require('node:path');

// Create HTTP/2 secure server
const server = http2.createSecureServer({
    key: fs.readFileSync(path.join(__dirname, 'certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certs/server.crt')),
    // HTTP/2 specific settings
    settings: {
        maxConcurrentStreams: 100,     // Max concurrent streams
        initialWindowSize: 65535,      // Initial window size
        maxHeaderListSize: 65535,      // Max header list size
        enableConnectProtocol: false,  // WebSocket over HTTP/2
    },
    // Prefer TLS 1.3
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
});

// Stream handler (HTTP/2-specific event)
server.on('stream', (stream, headers) => {
    const reqPath = headers[':path'];
    const method = headers[':method'];

    console.log(`${method} ${reqPath} (Stream ID: ${stream.id})`);

    if (reqPath === '/') {
        // Return main HTML
        stream.respond({
            ':status': 200,
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=3600',
        });

        // Use Link header as alternative to 103 Early Hints
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>HTTP/2 Demo</title>
    <link rel="stylesheet" href="/style.css">
    <script src="/app.js" defer></script>
</head>
<body>
    <h1>HTTP/2 Server Running</h1>
    <p>Stream ID: ${stream.id}</p>
    <p>Protocol: HTTP/2</p>
</body>
</html>`;
        stream.end(html);

    } else if (reqPath === '/style.css') {
        stream.respond({
            ':status': 200,
            'content-type': 'text/css',
            'cache-control': 'public, max-age=86400',
        });
        stream.end(`
            body {
                font-family: 'Helvetica Neue', Arial, sans-serif;
                max-width: 800px;
                margin: 2rem auto;
                padding: 0 1rem;
                background: #f5f5f5;
            }
            h1 { color: #2563eb; }
        `);

    } else if (reqPath === '/app.js') {
        stream.respond({
            ':status': 200,
            'content-type': 'application/javascript',
            'cache-control': 'public, max-age=86400',
        });
        stream.end(`
            console.log('HTTP/2 connection established');
            document.addEventListener('DOMContentLoaded', () => {
                const info = document.createElement('p');
                info.textContent = 'JavaScript loaded via HTTP/2 stream';
                document.body.appendChild(info);
            });
        `);

    } else {
        stream.respond({ ':status': 404 });
        stream.end('Not Found');
    }
});

// Error handling
server.on('error', (err) => {
    console.error('Server error:', err);
});

server.on('sessionError', (err) => {
    console.error('Session error:', err);
});

// Session events (for debugging)
server.on('session', (session) => {
    console.log('New HTTP/2 session established');

    session.on('close', () => {
        console.log('HTTP/2 session closed');
    });

    // Monitor flow control
    session.on('localSettings', (settings) => {
        console.log('Local settings:', settings);
    });

    session.on('remoteSettings', (settings) => {
        console.log('Remote settings:', settings);
    });
});

const PORT = 8443;
server.listen(PORT, () => {
    console.log(`HTTP/2 server listening on https://localhost:${PORT}`);
});
```

### 6.3 HTTP/3 (QUIC) Server Configuration

```
HTTP/3-capable server software:

  ┌─────────────────┬──────────────┬────────────────────────┐
  │ Server           │ QUIC library  │ Status                 │
  ├─────────────────┼──────────────┼────────────────────────┤
  │ Nginx 1.25+     │ quictls     │ Official support        │
  │ Caddy 2.x       │ quic-go     │ Enabled by default      │
  │ LiteSpeed       │ lsquic      │ Official (fastest tier) │
  │ Apache (exp.)   │ mod_http3   │ Experimental support    │
  │ H2O             │ quicly      │ Official support        │
  │ Cloudflare      │ quiche      │ Enabled across CDN      │
  │ Node.js (exp.)  │ ngtcp2      │ --experimental-quic     │
  └─────────────────┴──────────────┴────────────────────────┘
```

```
# HTTP/3 auto-configuration with Caddy
# Caddyfile (Caddy enables HTTP/3 automatically)

example.com {
    root * /var/www/example.com
    file_server

    # TLS is obtained and renewed automatically (Let's Encrypt)
    # HTTP/3 is enabled by default

    # HTTPS redirect is also automatic
    encode gzip zstd

    header {
        # Security headers
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
    }

    # API reverse proxy
    handle /api/* {
        reverse_proxy localhost:3000
    }
}
```

---

## 7. Detailed Protocol Version Comparison

### 7.1 Feature Comparison Table

```
┌─────────────────────┬────────────┬─────────────┬─────────────┐
│ Feature              │ HTTP/1.1   │ HTTP/2      │ HTTP/3      │
├─────────────────────┼────────────┼─────────────┼─────────────┤
│ Release year         │ 1997(RFC)  │ 2015(RFC)   │ 2022(RFC)   │
│ RFC document         │ RFC 9110   │ RFC 9113    │ RFC 9114    │
│ Transport layer      │ TCP        │ TCP         │ QUIC (UDP)  │
│ Message format       │ Text       │ Binary      │ Binary      │
│ Multiplexing         │ None       │ Yes         │ Yes         │
│ Header compression   │ None       │ HPACK       │ QPACK       │
│ Server push          │ None       │ Yes (fading)│ Yes (deprec)│
│ Encryption           │ Optional   │ De facto    │ Mandatory   │
│ Connection RTT       │ 1-3 RTT   │ 2-3 RTT     │ 1 RTT(0-RTT)│
│ HoL Blocking         │ HTTP+TCP   │ TCP only    │ None        │
│ Flow control         │ TCP only   │ 2-level     │ 2-level     │
│ Connection migration │ No         │ No          │ Yes         │
│ Priority control     │ None       │ Dependency  │ Priority    │
│                     │            │ tree        │ header      │
│ TLS version          │ 1.0+      │ 1.2+        │ 1.3 only    │
└─────────────────────┴────────────┴─────────────┴─────────────┘
```

### 7.2 Performance Characteristics Comparison

```
┌──────────────────────┬────────────┬────────────┬────────────┐
│ Scenario              │ HTTP/1.1   │ HTTP/2     │ HTTP/3     │
├──────────────────────┼────────────┼────────────┼────────────┤
│ Low-latency env.      │ Good       │ Best       │ Good       │
│ (LAN, same DC)        │            │            │            │
├──────────────────────┼────────────┼────────────┼────────────┤
│ High-latency env.     │ Poor       │ Improved   │ Best       │
│ (overseas server)     │ HoL severe │ TCP HoL    │ No HoL     │
│                      │            │ remains    │            │
├──────────────────────┼────────────┼────────────┼────────────┤
│ With packet loss      │ Poor       │ Poor       │ Best       │
│ (mobile network)      │ Full stop  │ Full stop  │ Partial    │
├──────────────────────┼────────────┼────────────┼────────────┤
│ Few large files       │ Normal     │ Little     │ Little     │
│ (video download)      │            │ improvement│ improvement│
├──────────────────────┼────────────┼────────────┼────────────┤
│ Many small files      │ Very poor  │ Best       │ Best       │
│ (SPA, API calls)      │ Conn limit │ Mux effect │ Mux effect │
├──────────────────────┼────────────┼────────────┼────────────┤
│ Network switch        │ Drop       │ Drop       │ Continues  │
│ (Wi-Fi↔Mobile)        │ Reconnect  │ Reconnect  │ Migration  │
├──────────────────────┼────────────┼────────────┼────────────┤
│ First connection      │ 1 RTT     │ 2-3 RTT   │ 1 RTT     │
│                      │ (TCP only) │ (TCP+TLS)  │ (QUIC)    │
├──────────────────────┼────────────┼────────────┼────────────┤
│ Reconnection speed    │ 1 RTT     │ 1-2 RTT   │ 0 RTT     │
│                      │ (TCP)      │(TLS resume)│(0-RTT)    │
├──────────────────────┼────────────┼────────────┼────────────┤
│ Server resource use   │ High       │ Low        │ Moderate   │
│                      │ Many conns │ 1 conn     │ UDP proc.  │
├──────────────────────┼────────────┼────────────┼────────────┤
│ Firewall traversal    │ Fine       │ Fine       │ UDP block  │
│                      │            │            │ possible   │
└──────────────────────┴────────────┴────────────┴────────────┘
```

---

## 8. Anti-Patterns

### 8.1 Anti-Pattern 1: Continuing Domain Sharding in HTTP/2 Environments

```
Incorrect configuration:

  Continuing to use multiple domains on an HTTP/2 site:

  <link rel="stylesheet" href="https://static1.example.com/style.css">
  <script src="https://static2.example.com/app.js"></script>
  <img src="https://static3.example.com/hero.jpg">
  <img src="https://cdn.example.com/logo.png">

  Problems:
  ┌────────────────────────────────────────────────────┐
  │  HTTP/2 + domain sharding = counterproductive       │
  │                                                    │
  │  · A TLS connection is needed per domain           │
  │    static1: TCP HS (1 RTT) + TLS HS (1-2 RTT)     │
  │    static2: TCP HS (1 RTT) + TLS HS (1-2 RTT)     │
  │    static3: TCP HS (1 RTT) + TLS HS (1-2 RTT)     │
  │    cdn:     TCP HS (1 RTT) + TLS HS (1-2 RTT)     │
  │    → Total 8-12 RTT connection overhead            │
  │                                                    │
  │  · Independent TCP slow start per connection        │
  │    → Reduced bandwidth efficiency                  │
  │                                                    │
  │  · HPACK dynamic table is independent per connection│
  │    → Degraded header compression efficiency        │
  │                                                    │
  │  · HTTP/2 stream priority cannot be coordinated    │
  │    across connections                              │
  │    → Cannot prioritize delivery of critical        │
  │      resources                                     │
  └────────────────────────────────────────────────────┘

  Correct approach:
    · Consolidate to one domain (or the minimum needed)
    · HTTP/2 multiplexing provides sufficient parallelism
    · If using a CDN, consolidate to a single HTTP/2-capable CDN
```

### 8.2 Anti-Pattern 2: Premature Full Migration to HTTP/3

```
Incorrect decision:

  "HTTP/3 is the latest, so let's drop HTTP/2 and use only HTTP/3"

  Problems:
  ┌────────────────────────────────────────────────────┐
  │  HTTP/3 only = many clients unable to connect       │
  │                                                    │
  │  1. Corporate firewalls                             │
  │     · Many enterprises block UDP 443               │
  │     · HTTP/3 (QUIC) runs over UDP                  │
  │     · TCP 443 (HTTPS) only is common               │
  │                                                    │
  │  2. Older clients                                   │
  │     · Browsers without HTTP/3 (IE, old Safari)     │
  │     · HTTP libraries without HTTP/3 support        │
  │     · Internal tools, scripts, bots                │
  │                                                    │
  │  3. Some ISPs/networks                              │
  │     · UDP traffic may have lower QoS priority       │
  │     · Some ISPs throttle UDP bandwidth              │
  │                                                    │
  │  4. Difficulty debugging                            │
  │     · QUIC is encrypted; hard to observe at        │
  │       intermediary devices                         │
  │     · tcpdump analysis is harder than TCP           │
  │     · Wireshark support is less mature than TCP     │
  └────────────────────────────────────────────────────┘

  Correct approach:
    · Keep HTTP/2 as the baseline
    · Offer HTTP/3 as an additional option (Alt-Svc header)
    · Browser automatically selects the best protocol
    · Fallback: HTTP/3 → HTTP/2 → HTTP/1.1

  Gradual upgrade via Alt-Svc header:
    1. Client connects via HTTP/2
    2. Server returns Alt-Svc: h3=":443"; ma=86400
    3. Client tries HTTP/3 on next connection
    4. Falls back to HTTP/2 if HTTP/3 is unavailable
```

### 8.3 Anti-Pattern 3: Leaving HTTP/2 SETTINGS Parameters Untuned

```
Incorrect configuration (left at defaults):

  Problematic situations:
    · Microservices handling a large volume of API requests
    · Default SETTINGS_MAX_CONCURRENT_STREAMS = 100
    · Initial window size too small

  ┌────────────────────────────────────────────────────┐
  │  SETTINGS parameters to tune                         │
  │                                                    │
  │  SETTINGS_MAX_CONCURRENT_STREAMS                   │
  │    Default: 100                                     │
  │    API-intensive: increase to 256-1000              │
  │    Resource-constrained: decrease to 32-64          │
  │                                                    │
  │  SETTINGS_INITIAL_WINDOW_SIZE                       │
  │    Default: 65,535 (64KB)                           │
  │    High-bandwidth env.: 1,048,576 (1MB) or more    │
  │    Low-bandwidth env.: reduce to 16,384 (16KB)      │
  │                                                    │
  │  SETTINGS_MAX_FRAME_SIZE                            │
  │    Default: 16,384 (16KB)                           │
  │    Large file delivery: expand to 65,536 (64KB)     │
  │    Reduces frame-splitting overhead                  │
  │                                                    │
  │  SETTINGS_HEADER_TABLE_SIZE                         │
  │    Default: 4,096 (4KB)                             │
  │    Many header types: expand to 8,192-16,384        │
  │    Memory-constrained: reduce to 2,048              │
  └────────────────────────────────────────────────────┘
```

---

## 9. Edge Case Analysis

### 9.1 Edge Case 1: QUIC Connections and UDP Blocking

```
Scenario:
  Environment where UDP 443 is blocked (corporate network, hotel Wi-Fi)

  ┌──────────────────────────────────────────────────┐
  │                                                    │
  │  Client ──── Firewall ──── Internet ──── Server   │
  │                  │                                  │
  │                  ├── TCP 443: allowed (HTTPS)      │
  │                  ├── TCP 80:  allowed (HTTP)       │
  │                  └── UDP 443: blocked              │
  │                                                    │
  └──────────────────────────────────────────────────┘

  Impact:
    1. Browser attempts HTTP/3 → timeout
    2. Fallback delay occurs (300ms to several seconds)
    3. Falls back to HTTP/2 → normal operation

  Browser behavior:
    Chrome's Happy Eyeballs v2 implementation:
      · Tries HTTP/3 and HTTP/2 simultaneously
      · Uses whichever succeeds first
      · Selects HTTP/2 if HTTP/3 doesn't respond within a timeout
      · Skips HTTP/3 attempts for a period afterward

  Server-side mitigation:
    # Set Alt-Svc max-age appropriately
    # Too long means clients in UDP-blocked environments time out repeatedly
    add_header Alt-Svc 'h3=":443"; ma=3600' always;
    # Use ma=3600 (1 hour) rather than ma=86400 (24 hours)
    # Reduces fallback frequency for UDP-blocked clients

  Client-side mitigation:
    # Disable HTTP/3 in curl
    curl --http2 https://example.com/  # Force HTTP/2

    # Disable HTTP/3 in browser (for debugging)
    # Chrome: chrome://flags/#enable-quic → Disabled
    # Firefox: about:config → network.http.http3.enable → false
```

### 9.2 Edge Case 2: When HTTP/2 TCP HoL Blocking Becomes a Problem

```
Scenario:
  A case where HTTP/2 multiplexing backfires on
  high-packet-loss mobile networks (3G / unstable Wi-Fi)

  2% packet loss environment:

  === HTTP/1.1 (6 connections) ===
    Conn 1: [Stream A]─────[lost]─retransmit─[done]
    Conn 2: [Stream B]────────────────[done]  ← Unaffected
    Conn 3: [Stream C]────────────────[done]  ← Unaffected
    Conn 4: [Stream D]─[lost]─retransmit──[done]
    Conn 5: [Stream E]────────────────[done]  ← Unaffected
    Conn 6: [Stream F]────────────────[done]  ← Unaffected

    → 2 of 6 connections affected, 4 normal
    → Packet loss impact is spread out

  === HTTP/2 (1 connection) ===
    TCP conn: [A][B][C][D][lost][E][F]
                            ↑
                     Loss of this packet
                     stops all streams A-F

    → With 1 connection, a loss affects all streams
    → Can be slower than HTTP/1.1's 6 connections

  === HTTP/3 (QUIC) ===
    QUIC conn: [A][B][C][D][lost][E][F]
                            ↑
                     Stream D loss
    Stream A: ──────────[done]  ← Unaffected
    Stream B: ──────────[done]  ← Unaffected
    Stream C: ──────────[done]  ← Unaffected
    Stream D: ──[waiting retransmit]────  ← Affected
    Stream E: ──────────[done]  ← Unaffected
    Stream F: ──────────[done]  ← Unaffected

    → Only Stream D affected, others normal

  Observed data trends:
    Packet loss 0%:   HTTP/2 ≈ HTTP/3 > HTTP/1.1
    Packet loss 1%:   HTTP/3 > HTTP/2 > HTTP/1.1
    Packet loss 2%+:  HTTP/3 >> HTTP/1.1 > HTTP/2
    → As packet loss increases, HTTP/2 can become worse than HTTP/1.1
```

### 9.3 Edge Case 3: Memory Issues with Large Numbers of HTTP/2 Streams

```
Scenario:
  Using HTTP/2 gRPC for microservice communication.
  Thousands of streams existing simultaneously on one connection.

  ┌────────────────────────────────────────────────┐
  │  Problematic pattern: gRPC over HTTP/2          │
  │                                                │
  │  Service A → Service B (gRPC)                  │
  │  Concurrent requests: 5,000 streams             │
  │                                                │
  │  Memory consumption:                            │
  │    State management per stream:                 │
  │      · HPACK dynamic table: 4KB/connection      │
  │      · Flow control window: management struct   │
  │      · Stream buffer: variable                  │
  │      · Priority tree node: per stream           │
  │                                                │
  │  5,000 streams × management struct ≈ tens of MB │
  │  per connection                                 │
  │  100 connections × tens of MB = several GB of   │
  │  memory consumption                             │
  │                                                │
  │  Mitigation:                                    │
  │    1. Limit MAX_CONCURRENT_STREAMS appropriately │
  │       (set to 100-500 on server side)           │
  │    2. Control connection count with pooling      │
  │    3. Set stream timeouts                        │
  │    4. Periodically refresh connections via GOAWAY│
  └────────────────────────────────────────────────┘
```

---

## 10. Exercises

### 10.1 Basic Exercise: Verifying and Analyzing HTTP/2 Connections

```
Objective:
  Understand the HTTP/2 connection establishment process and observe actual traffic

Task 1: Verify HTTP/2 connection with curl
  1. Confirm HTTP/2 connection with the following command
     $ curl -v --http2 https://www.google.com/ -o /dev/null 2>&1

  Check points:
    a. Is "h2" selected in the ALPN negotiation?
    b. What is the protocol version in the response?
    c. What is the TLS version and cipher suite?

  2. Force HTTP/1.1 and compare
     $ curl -v --http1.1 https://www.google.com/ -o /dev/null 2>&1

  Check points:
    a. Is there a difference in the connection establishment steps?
    b. Is there a difference in how headers are displayed?
    c. What is the difference in the format of the response status line?

Task 2: HTTP/2 frame analysis with nghttp
  1. Install nghttp2 and run the following
     # macOS
     $ brew install nghttp2

     # Ubuntu/Debian
     $ sudo apt install nghttp2-client

  2. Check frame details
     $ nghttp -nv https://www.example.com/

  Check points:
    a. What does the SETTINGS frame contain?
    b. What is the MAX_CONCURRENT_STREAMS value?
    c. Diagram the relationship between HEADERS and DATA frames

Task 3: Verification in Chrome DevTools
  1. Open the Network tab in Chrome DevTools
  2. Display the Protocol column
  3. Access the following sites and check the protocol
     - https://www.google.com/
     - https://www.cloudflare.com/
     - https://www.facebook.com/
  4. Check each site's Connection ID and confirm that
     multiple resources are retrieved over the same connection

Expected deliverables:
  · Screenshots of each command's output
  · Summary table of differences in connection steps between HTTP/1.1 and HTTP/2
  · Chrome DevTools screenshot with explanation
```

### 10.2 Applied Exercise: Building and Benchmarking an HTTP/2 Server

```
Objective:
  Build an HTTP/2 server and measure the performance difference vs HTTP/1.1

Task 1: Build a Node.js HTTP/2 server
  1. Create a self-signed certificate
     $ openssl req -x509 -newkey rsa:2048 -keyout server.key \
       -out server.crt -days 365 -nodes \
       -subj "/CN=localhost"

  2. Implement an HTTP/2 server referencing Example 5 in this guide
  3. Add the following features:
     a. /api/data endpoint (JSON response)
     b. Static file serving (images, CSS, JS)
     c. Include the stream ID in response headers

Task 2: Build a Nginx HTTP/2 server
  1. Build a Nginx HTTP/2 server using Docker
     # Dockerfile
     FROM nginx:latest
     COPY nginx.conf /etc/nginx/conf.d/default.conf
     COPY certs/ /etc/nginx/certs/
     COPY html/ /var/www/html/

  2. Create nginx.conf referencing Example 4 in this guide
  3. Place 100 small image files and create an HTML page
     that loads all images from a list page

Task 3: Benchmark comparison
  1. Measure HTTP/2 performance with h2load
     $ h2load -n 10000 -c 50 -m 10 https://localhost:8443/

  2. Measure HTTP/1.1 performance
     $ h2load -n 10000 -c 50 --h1 https://localhost:8443/

  3. Compare on the following dimensions:
     a. Requests per second (req/s)
     b. Average response time
     c. Connection establishment time
     d. How results change with different concurrency (10, 50, 100, 500)

  4. Graph the results and write up analysis

Expected deliverables:
  · Source code for a working HTTP/2 server
  · Nginx configuration file
  · Benchmark comparison table and graph
  · Analysis report on the performance difference between HTTP/1.1 and HTTP/2
```

### 10.3 Advanced Exercise: HTTP/3 (QUIC) Verification and Protocol Selection Strategy

```
Objective:
  Verify HTTP/3 in practice and define a protocol selection strategy
  for production environments

Task 1: Build an HTTP/3 server
  1. Build an HTTP/3 server using Caddy
     $ brew install caddy   # macOS
     # or
     $ sudo apt install caddy   # Ubuntu

  2. Create the following Caddyfile
     localhost {
         root * /path/to/html
         file_server
         # Caddy supports HTTP/3 by default
     }

  3. Start the server and verify HTTP/3 connection
     $ caddy run --config Caddyfile

  4. Verify HTTP/3 connection with curl (requires curl 7.66+)
     $ curl -v --http3-only https://localhost/
     # or
     $ curl -v --http3 https://localhost/

Task 2: Protocol comparison under packet loss
  1. Create a simulated degraded network environment using tc (traffic control)
     (requires Linux environment)
     # Add 2% packet loss
     $ sudo tc qdisc add dev lo root netem loss 2%

  2. Measure each protocol's performance under the following conditions:
     a. Packet loss 0%
     b. Packet loss 1%
     c. Packet loss 2%
     d. Packet loss 5%

  3. Measurement method:
     $ h2load -n 1000 -c 10 --h1 https://localhost:8443/     # HTTP/1.1
     $ h2load -n 1000 -c 10 https://localhost:8443/           # HTTP/2
     $ h2load -n 1000 -c 10 --npn-list h3 https://localhost:8443/  # HTTP/3

  4. Graph performance vs packet loss rate

  Cleanup after testing:
     $ sudo tc qdisc del dev lo root

Task 3: Define a protocol selection strategy
  Propose an optimal protocol configuration for each scenario below.
  Each proposal must include rationale and a configuration example.

  Scenario A: E-commerce site (global deployment)
    · Users: Browser users worldwide
    · Content: Large number of product images, SPA
    · Requirements: Low latency, high availability
    · Constraints: Uses CDN, accessed from corporate networks

  Scenario B: Internal microservice platform
    · Communication: gRPC between services
    · Environment: Kubernetes cluster
    · Requirements: High throughput, low latency
    · Constraints: Behind firewall, stable network

  Scenario C: Real-time mobile game communication
    · Users: Mobile devices (4G/5G/Wi-Fi)
    · Communication: API calls + real-time data
    · Requirements: Fast recovery from connection drops
    · Constraints: Mobile network, roaming

Expected deliverables:
  · Setup guide for the HTTP/3 server
  · Measurement results and analysis report under packet loss
  · Protocol selection proposal for each scenario
    (including protocol config, configuration example, and fallback strategy)
```

---

## 11. Practical Troubleshooting

### 11.1 Common Issues When Migrating to HTTP/2

```
Problem 1: ALPN negotiation failure
  Symptom: HTTP/1.1 is used even after configuring HTTP/2 support
  Cause: TLS library does not support ALPN

  Diagnose:
    $ openssl s_client -alpn h2 -connect example.com:443

  Fix:
    · Upgrade to OpenSSL 1.0.2 or later
    · For Nginx: confirm it was built with OpenSSL
      $ nginx -V 2>&1 | grep -o 'openssl-[^ ]*'

Problem 2: Large number of RST_STREAM with HTTP/2 connections
  Symptom: Many requests failing in Chrome DevTools
  Cause: MAX_CONCURRENT_STREAMS is too low

  Diagnose:
    $ nghttp -nv https://example.com/ 2>&1 | grep SETTINGS

  Fix:
    # Nginx
    http2_max_concurrent_streams 256;

Problem 3: WAF false positives with HTTP/2
  Symptom: WAF (Web Application Firewall) blocking legitimate requests
  Cause: WAF not correctly parsing HTTP/2 binary frames

  Fix:
    · Update WAF to an HTTP/2-compatible version
    · Place WAF after HTTP/2 termination
    · In a CDN → WAF → Origin setup, sometimes
      downgrade CDN-WAF leg to HTTP/1.1
```

### 11.2 HTTP/3 Deployment Checklist

```
HTTP/3 Deployment Checklist:

  Server side:
    □ Nginx 1.25+ / Caddy 2.x / LiteSpeed installed
    □ QUIC-capable TLS library (quictls, BoringSSL, etc.)
    □ UDP 443 port opened in firewall
    □ Alt-Svc header configured correctly
    □ HTTP/2 fallback configured
    □ TLS 1.3 certificate configuration is correct
    □ QUIC version negotiation configured
    □ 0-RTT enablement and security risk considered

  Network side:
    □ Load balancer supports UDP (for L4 LB)
    □ CDN supports HTTP/3 (Cloudflare, Fastly, AWS CloudFront, etc.)
    □ UDP rate limiting is set appropriately
    □ UDP flooding considered in DDoS protection

  Client side:
    □ HTTP/3 support verified for target browsers
    □ Fallback for HTTP/3-unsupported clients confirmed
    □ HTTP library in mobile app supports HTTP/3
    □ HTTP/3 works through proxy connections

  Monitoring:
    □ Monitoring HTTP/3 vs HTTP/2 traffic ratio
    □ Monitoring fallback rate
    □ Monitoring QUIC connection error rate
    □ 0-RTT usage rate and replay attack detection
```

---

## 12. 103 Early Hints -- Alternative to Server Push

After HTTP/2 server push was deprecated, 103 Early Hints (RFC 8297) has drawn
attention as an alternative.

```
103 Early Hints flow:

  Client                              Server
    │                                   │
    │──── GET /index.html ─────────────→│
    │                                   │
    │←── 103 Early Hints ──────────────│
    │    Link: </style.css>; rel=preload; as=style
    │    Link: </app.js>; rel=preload; as=script
    │                                   │
    │   (Browser starts fetching style.css and app.js)
    │                                   │
    │                                   │ (generating HTML...)
    │                                   │
    │←── 200 OK ───────────────────────│
    │    Content-Type: text/html        │
    │    <html>...</html>               │
    │                                   │

  Differences from server push:

  ┌──────────────────┬──────────────────┬──────────────────┐
  │                  │ Server Push      │ 103 Early Hints  │
  ├──────────────────┼──────────────────┼──────────────────┤
  │ Who decides      │ Server           │ Browser          │
  │ to fetch         │ (force-sends)    │ (decides based   │
  │                  │                  │ on hints)         │
  ├──────────────────┼──────────────────┼──────────────────┤
  │ Cache awareness  │ No (always sends)│ Yes (skips if    │
  │                  │ → bandwidth waste│ already cached)  │
  ├──────────────────┼──────────────────┼──────────────────┤
  │ CDN support      │ Complex          │ Simple           │
  │                  │ (CDN-dependent)  │ (CDN can forward)│
  ├──────────────────┼──────────────────┼──────────────────┤
  │ Browser support  │ Removed in       │ Supported by     │
  │                  │ Chrome 106       │ major browsers   │
  ├──────────────────┼──────────────────┼──────────────────┤
  │ HTTP/1.1 support │ No               │ Yes              │
  └──────────────────┴──────────────────┴──────────────────┘
```

### 103 Early Hints Configuration in Nginx

```nginx
# Example of configuring 103 Early Hints in Nginx

server {
    listen 443 ssl;
    http2 on;
    server_name example.com;

    # Send Early Hints on the main page
    location / {
        # Send 103 response first
        add_header Link "</style.css>; rel=preload; as=style" early;
        add_header Link "</app.js>; rel=preload; as=script" early;
        add_header Link "</fonts/main.woff2>; rel=preload; as=font; crossorigin" early;

        try_files $uri $uri/ /index.html;
    }
}
```

---

## 13. Adoption Status and Outlook

```
HTTP/2 and HTTP/3 adoption (estimated as of 2025):

  ┌──────────────────────────────────────────────────┐
  │  Protocol distribution across the web             │
  │                                                    │
  │  HTTP/1.1: ████████████████████  ~55%             │
  │  HTTP/2:   ████████████          ~33%             │
  │  HTTP/3:   ████                  ~12%             │
  │                                                    │
  │  Major service support:                            │
  │    Google:     HTTP/3 fully deployed              │
  │    Facebook:   HTTP/3 fully deployed              │
  │    Cloudflare: HTTP/3 enabled by default          │
  │    AWS:        HTTP/3 supported on CloudFront     │
  │    Akamai:     HTTP/3 supported                   │
  │    Fastly:     HTTP/3 supported                   │
  │                                                    │
  │  Browser support:                                  │
  │    Chrome:    HTTP/3 (Chrome 87+)                 │
  │    Firefox:   HTTP/3 (Firefox 88+)                │
  │    Safari:    HTTP/3 (Safari 14+)                 │
  │    Edge:      HTTP/3 (Chromium-based)             │
  └──────────────────────────────────────────────────┘

  Outlook:
    1. Accelerated HTTP/3 adoption
       → CDNs enabling it by default means HTTP/3 is used automatically
       → Increasingly common without administrators noticing

    2. QUIC v2 (RFC 9369)
       → Improved version of QUIC standardized
       → Stronger encryption, performance improvements

    3. WebTransport
       → New bidirectional communication protocol over QUIC/HTTP/3
       → Expected as the successor to WebSocket
       → Optimized for low-latency real-time communication

    4. Multipath QUIC
       → Simultaneously uses multiple network paths
       → Double bandwidth with simultaneous Wi-Fi + mobile
       → Seamless migration during network switches
```

---

## 14. FAQ

### FAQ 1: Which should be prioritized, HTTP/2 or HTTP/3?

```
Q: When building a new service, should HTTP/2 or HTTP/3
   be prioritized?

A: The best approach is to first ensure solid HTTP/2 adoption,
   then configure HTTP/3 as an additional option.

  Reasons:
    1. HTTP/2 is the de facto standard
       → Supported by virtually all browsers, servers, and CDNs
       → Migration from HTTP/1.1 has the biggest impact
       → Multiplexing alone promises significant performance gains

    2. HTTP/3 requires fallback
       → Environments that block UDP exist
       → HTTP/3 only means some clients cannot connect
       → Gradual upgrade via Alt-Svc is the standard approach

    3. Ease of adoption
       → HTTP/2: just change Nginx configuration
       → HTTP/3: requires opening UDP port, compatible server,
         and firewall configuration changes

  Recommended phases:
    Phase 1: Fully deploy HTTP/2
    Phase 2: Automatically serve HTTP/3 via CDN
    Phase 3: Enable HTTP/3 on origin servers
```

### FAQ 2: What is the relationship between gRPC and HTTP/2?

```
Q: Why did gRPC choose HTTP/2?
   Is migration to HTTP/3 planned?

A: Why gRPC chose HTTP/2 and the outlook for HTTP/3 migration

  Why HTTP/2 was chosen:
    1. Bidirectional streaming
       → Leverages HTTP/2 streams
       → Simultaneous client → server and server → client
         communication is possible

    2. Multiplexing
       → Multiple concurrent RPC calls on one connection
       → Reduces connection count between microservices

    3. Header compression
       → Efficient transmission of gRPC metadata
       → Repeated metadata compressed with HPACK

    4. Flow control
       → Per-stream backpressure
       → Send control matched to receiver's processing capacity

  Status of HTTP/3 (gRPC over QUIC):
    → HTTP/3 support in gRPC's official spec is in progress
    → Connect protocol (Buf) supports HTTP/3
    → Inside data centers, TCP HoL Blocking has little impact,
      so HTTP/2 is sufficient in many cases
    → For gRPC-Web over the internet, HTTP/3 offers bigger benefits

  Current recommendation:
    Inside data center: HTTP/2 is sufficient
    Over the internet: Consider HTTP/3 support
```

### FAQ 3: Why is my page slow even when using HTTP/2?

```
Q: I migrated to HTTP/2 but page load speed hasn't improved.
   What are the possible causes?

A: HTTP/2 alone doesn't solve all page speed problems.
   The following causes need to be investigated.

  1. Slow server processing time (TTFB)
     → HTTP/2 optimizes the communication protocol
     → Does not improve server-side DB queries or processing delays
     → Fix: Measure and optimize server processing with an APM tool

  2. Third-party resource delays
     → Ads, analytics, fonts from external domains
     → Connection establishment needed per domain
     → Fix: Use dns-prefetch and preconnect

  3. Render-blocking resources
     → Large CSS or JS blocking rendering
     → Fast retrieval via HTTP/2 doesn't eliminate parse/execution time
     → Fix: Critical CSS, Code Splitting, defer/async

  4. Insufficient image optimization
     → Uncompressed large images are heavy even with HTTP/2
     → Fix: WebP/AVIF, appropriate sizing, lazy loading

  5. HTTP/2 priority not taking effect
     → Browser and server may interpret priority differently
     → Fix: Use the fetchpriority attribute
       <img src="hero.jpg" fetchpriority="high">
       <img src="below-fold.jpg" fetchpriority="low">

  6. Remaining excessive domain sharding
     → As explained in Anti-Pattern 1
     → Fix: Consolidate domains as much as possible

  Diagnosis steps:
    1. Chrome DevTools → Performance tab,
       check Largest Contentful Paint (LCP)
    2. Check the waterfall in the Network tab
    3. Use Lighthouse for bottleneck suggestions
    4. Run detailed analysis with WebPageTest
```

### FAQ 4: What is the right MAX_CONCURRENT_STREAMS for HTTP/2?

```
Q: What should HTTP/2 MAX_CONCURRENT_STREAMS be set to?

A: The optimal value varies by workload.

  General website:
    Recommended: 100-128
    Reason: Normal pages consist of fewer than 100 requests
    Nginx default: 128

  SPA / heavy web apps:
    Recommended: 256
    Reason: API calls + resource fetches can exceed 100

  Microservice communication (gRPC):
    Recommended: 100-1000 (determine via load testing)
    Reason: Many RPC calls may run concurrently
    Note: Too large a value increases memory consumption

  CDN / reverse proxy:
    Recommended: 100-256
    Reason: Many origin requests processed in parallel
    Cloudflare: 256
    AWS ALB: 128

  Rough calculation:
    Expected peak concurrent requests × 1.5 = recommended value
    Example: 150 peak requests → 225 → round up to 256
```

### FAQ 5: Are there security risks with 0-RTT reconnection?

```
Q: Is QUIC's 0-RTT reconnection safe? Is there a replay attack risk?

A: 0-RTT has a replay attack risk.
   It must be used with appropriate countermeasures.

  Replay attack scenario:
    1. Client sends GET /api/balance via 0-RTT
    2. Attacker captures that packet
    3. Attacker resends the same packet to server
    4. Server processes it as a legitimate request

  Countermeasures:
    1. Allow 0-RTT only for idempotent requests
       → GET is safe (no side effects)
       → POST, PUT, DELETE require 1-RTT

    2. Server-side replay detection
       → Manage replay tokens
       → Reject duplicate processing of the same token

    3. Anti-Replay mechanism (RFC 8446 Section 8)
       → Timestamp-based validation
       → Reject duplicate requests within a time window

  Nginx configuration:
    ssl_early_data on;      # Enable 0-RTT

    # Check Early-Data header on application side
    proxy_set_header Early-Data $ssl_early_data;
    # If $ssl_early_data is "1", it's a 0-RTT request
    # → Return 425 Too Early for side-effectful operations

  Recommendation:
    · Static content: 0-RTT enabled (low risk)
    · API (GET): 0-RTT enabled (verify idempotency)
    · API (POST, etc.): 0-RTT disabled (replay risk)
    · Payment processing: 0-RTT disabled (replay absolutely unacceptable)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just from theory but from writing actual code and observing its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in day-to-day development work. It is particularly important during code reviews and architecture design.

---

## 15. Summary

```
HTTP protocol evolution and selection criteria:

  ┌─────────────────────────────────────────────────────┐
  │                                                       │
  │  HTTP/1.1 (1997)                                     │
  │    · Text-based, simple, widely adopted              │
  │    · HoL Blocking and header redundancy are issues   │
  │    · Still active in legacy systems                  │
  │                                                       │
  │          ↓ Multiplexing, header compression, binary  │
  │                                                       │
  │  HTTP/2 (2015)                                       │
  │    · Multiplexing on a single connection             │
  │    · HPACK header compression                        │
  │    · TCP-layer HoL Blocking persists                 │
  │    · Now required as modern web standard             │
  │                                                       │
  │          ↓ QUIC (UDP), stream independence,          │
  │            connection migration                       │
  │                                                       │
  │  HTTP/3 (2022)                                       │
  │    · Runs on QUIC, HoL Blocking fully eliminated     │
  │    · 1 RTT connection, 0-RTT reconnection            │
  │    · Connection migration (network switch support)   │
  │    · Adoption growing, increasingly used via CDN    │
  │                                                       │
  └─────────────────────────────────────────────────────┘

  Protocol selection flowchart:

    Building a new service?
    ├── Yes → Deploy HTTP/2 as baseline
    │         ├── Using CDN? → Also serve HTTP/3 automatically via CDN
    │         └── Mobile-focused? → Consider HTTP/3 on origin too
    └── Existing service?
        ├── HTTP/1.1 only → Prioritize migration to HTTP/2
        └── HTTP/2 in place → Consider adding HTTP/3
            ├── Using CDN → Enable HTTP/3 on CDN side
            └── No CDN → Consider HTTP/3 support on server

  Key points to remember:
    1. HTTP/2 is essential in modern web development
    2. HTTP/3 is introduced incrementally as an added option
    3. Fallback configuration (HTTP/3 → HTTP/2 → HTTP/1.1) is important
    4. HTTP/1.1 optimizations like domain sharding are unnecessary with HTTP/2
    5. Server push is deprecated; use 103 Early Hints
    6. HTTP/3's advantage is pronounced in high-packet-loss environments
    7. 0-RTT is convenient but understand and mitigate replay attack risk
```

---

## Further Reading

---

## References

1. RFC 9113. "HTTP/2." IETF, 2022.
   https://www.rfc-editor.org/rfc/rfc9113
   Official HTTP/2 specification. Defines binary framing, multiplexing,
   HPACK, server push, flow control, and stream priority in full.

2. RFC 9114. "HTTP/3." IETF, 2022.
   https://www.rfc-editor.org/rfc/rfc9114
   Official HTTP/3 specification. Defines HTTP semantics mapping over QUIC,
   QPACK, and stream management.

3. RFC 9000. "QUIC: A UDP-Based Multiplexed and Secure Transport." IETF, 2021.
   https://www.rfc-editor.org/rfc/rfc9000
   Official QUIC transport protocol specification. Defines connection establishment,
   streams, flow control, connection migration, and packet protection.

4. RFC 7541. "HPACK: Header Compression for HTTP/2." IETF, 2015.
   https://www.rfc-editor.org/rfc/rfc7541
   Specification for HPACK, HTTP/2's header compression format. Defines the
   static table, dynamic table, and Huffman coding in detail.

5. RFC 9204. "QPACK: Field Compression for HTTP/3." IETF, 2022.
   https://www.rfc-editor.org/rfc/rfc9204
   Specification for QPACK, HTTP/3's header compression format. Adapts HPACK
   to QUIC's stream independence design.

6. RFC 8297. "An HTTP Status Code for Indicating Hints." IETF, 2017.
   https://www.rfc-editor.org/rfc/rfc8297
   Specification for the 103 Early Hints status code. A recommended technique
   as an alternative to server push.

7. RFC 9218. "Extensible Prioritization Scheme for HTTP." IETF, 2022.
   https://www.rfc-editor.org/rfc/rfc9218
   New priority scheme shared by HTTP/2 and HTTP/3. Defines simple priority
   control with two parameters: urgency and incremental.

---

## Summary

| Protocol | Key Improvements | Transport | Main Benefits | Main Challenges |
|----------|-----------------|-----------|--------------|-----------------|
| **HTTP/1.1** | Keep-Alive | TCP | Simple, widely supported | Head-of-Line Blocking, connection count limit |
| **HTTP/2** | Binary framing, multiplexing, HPACK, server push | TCP (TLS recommended) | Parallel processing of many requests on 1 connection, header compression | TCP-level HoL Blocking persists |
| **HTTP/3** | QUIC, QPACK, 0-RTT, connection migration | UDP (QUIC) | TCP HoL Blocking eliminated, fast handshake, mobile-optimized | UDP firewall issues, CPU load |

### Key Points

1. **The core of HTTP/2 is multiplexing**: Processing multiple streams in parallel over a single TCP connection resolves HTTP/1.1's pipelining problem and application-layer Head-of-Line Blocking. However, HoL Blocking from TCP-level packet loss persists.

2. **HTTP/3 renovates from the transport layer up**: The QUIC protocol (stream multiplexing over UDP) ensures packet loss affects only the impacted stream. TLS 1.3 integration provides 1-RTT handshake, 0-RTT reconnection, and connection migration, delivering real value in mobile environments.

3. **Incremental adoption is recommended**: HTTP/2 is widely supported and has low adoption risk. Introduce HTTP/3 with fallback (Alt-Svc header), verify effectiveness while monitoring. Watch out for UDP blocking and increased CPU load, and use CDNs to spread the load.
