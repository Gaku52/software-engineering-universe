# WebSocket

> WebSocket is a bidirectional real-time communication protocol established over HTTP. It is the foundation for applications that require server-side push — such as chat, real-time notifications, games, and financial data streams. Standardized in RFC 6455, this protocol overcomes the limitations of traditional HTTP polling and enables true full-duplex communication between client and server.

## Prerequisites

To get the most out of this guide, the following knowledge is required.

**Required**

**Recommended**
- Basic JavaScript knowledge (browser APIs, asynchronous processing)
- Node.js basics (needed for server-side implementation)

---

## What You Will Learn in This Chapter

- [ ] Understand the WebSocket handshake and how communication works
- [ ] Understand the differences from HTTP and the problems WebSocket solves
- [ ] Understand the frame structure and internal protocol behavior
- [ ] Learn implementation patterns for both server-side and client-side
- [ ] Learn practical development techniques using libraries such as Socket.IO
- [ ] Gain knowledge of scaling, security, and performance optimization
- [ ] Understand anti-patterns to prevent production issues before they happen

---

## 1. Why WebSocket Is Needed

### 1.1 Fundamental Limitations of HTTP

HTTP is based on a request/response model. Communication always originates from the client, and the server has no means to proactively send data to the client. This limitation was not a problem in the early Web — the request/response model was sufficient for serving static pages or handling one-off interactions like form submissions.

However, as web applications became more sophisticated, the demand for real-time capability increased rapidly. Use cases requiring instant data delivery from server to client — such as chat applications, stock tickers, online games, and collaborative editing tools — multiplied.

### 1.2 Traditional Workarounds and Their Limitations

```
Evolution of techniques to work around HTTP's limitations:

  ① Polling:
     ┌─────────┐         ┌─────────┐
     │ Client  │ ──GET──→│ Server  │    Client queries the server
     │         │ ←─200── │         │    at regular intervals
     │         │         │         │
     │         │ ──GET──→│         │    A request is made every interval
     │         │ ←─204── │         │    even when there is no data,
     │         │         │         │    wasting bandwidth
     │         │ ──GET──→│         │    Long intervals mean high latency;
     │         │ ←─200── │         │    short intervals increase server load
     └─────────┘         └─────────┘

     Problems:
     - Large numbers of wasteful requests (including when there is no data)
     - Real-time responsiveness depends on the interval
     - HTTP header overhead on every request (~800 bytes/request)
     - Unnecessary consumption of server CPU and memory

  ② Long Polling:
     ┌─────────┐         ┌─────────┐
     │ Client  │ ──GET──→│ Server  │    Server holds the response
     │         │         │ (wait)  │    until data is available
     │         │         │  ...    │
     │         │         │  ...    │    If no data by timeout,
     │         │ ←─200── │ (send)  │    returns an empty response
     │         │ ──GET──→│         │
     │         │         │ (wait)  │    Immediately sends next request
     └─────────┘         └─────────┘    to simulate push behavior

     Problems:
     - High resource consumption from holding connections on the server
     - Connection re-establishment cost (TCP/TLS handshake) on every request
     - At high message frequency, the load becomes equivalent to polling
     - Under HTTP/1.1, affected by browser concurrent connection limits
       (6 connections per domain)

  ③ Server-Sent Events (SSE):
     ┌─────────┐         ┌─────────┐
     │ Client  │ ──GET──→│ Server  │    One-way streaming from server
     │         │ ←─data──│         │    to client over an HTTP connection
     │         │ ←─data──│         │
     │         │ ←─data──│         │
     └─────────┘         └─────────┘

     Advantages: built-in automatic reconnection and event ID management
     Problems:
     - One-way only: server → client
     - Only text data (UTF-8) is supported
     - Under HTTP/1.1, affected by concurrent connection limits
     - Sending binary data requires a separate HTTP request
```

### 1.3 The Solution WebSocket Provides

WebSocket fundamentally solves all of the above problems. After the initial HTTP handshake, it switches protocols over the TCP connection and establishes a bidirectional full-duplex communication channel. This provides the following advantages:

1. **True bidirectional communication**: Client and server can send and receive messages on equal footing
2. **Low latency**: Always-on connection means no connection-establishment overhead
3. **Low overhead**: Frame headers are just 2–14 bytes (a fraction of HTTP header size)
4. **Binary data support**: Both text and binary can be efficiently transferred
5. **Protocol-level keep-alive**: Connection state monitored via Ping/Pong frames

### 1.4 Comparison Table of Real-Time Communication Technologies

```
  ┌────────────────┬───────────┬───────────┬───────────┬───────────┐
  │ Property       │ Polling   │ Long Poll │ SSE       │ WebSocket │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Direction      │ One-way   │ One-way   │ One-way   │ Two-way   │
  │                │ C→S       │ C→S       │ S→C       │ C↔S       │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Latency        │ High      │ Medium    │ Low       │ Lowest    │
  │ (average)      │ interval/2│ ~100ms    │ ~50ms     │ ~10ms     │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Server load    │ High      │ Med–High  │ Low       │ Low–Med   │
  │ (10K connections)│         │           │           │           │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Bandwidth eff. │ Low       │ Low–Med   │ High      │ Highest   │
  │ (headers)      │ ~800B/req │ ~800B/req │ ~50B/msg  │ ~6B/msg   │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Binary support │ Possible  │ Possible  │ No        │ Possible  │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Auto-reconnect │ Manual    │ Manual    │ Built-in  │ Manual    │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ HTTP/2 compat. │ Full      │ Full      │ Improved  │ Limited   │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Firewall       │ No issue  │ No issue  │ No issue  │ Caution   │
  │ transparency   │           │           │           │ needed    │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Impl. complexity│ Low      │ Medium    │ Low       │ High      │
  ├────────────────┼───────────┼───────────┼───────────┼───────────┤
  │ Recommended    │ Low-freq  │ Med-freq  │ Notif.    │ Real-     │
  │ use cases      │ updates   │ updates   │ feeds     │ time      │
  └────────────────┴───────────┴───────────┴───────────┴───────────┘
```

### 1.5 Use Cases Where WebSocket Is a Good Fit

WebSocket is not a universal solution. Below is a summary of cases with high and low suitability.

**High suitability:**
- Chat applications (1-on-1, group)
- Real-time collaborative editing (Google Docs-style)
- Financial data streaming (stock prices, exchange rates)
- Online games (multiplayer)
- Real-time monitoring dashboards for IoT devices
- Live sports score updates
- Real-time notification systems

**Low suitability:**
- Simple CRUD operations (REST API is sufficient)
- Low-frequency updates (polling is sufficient if intervals exceed 5 minutes)
- One-directional event notifications only (SSE is sufficient)
- Content distribution where SEO is important (HTTP is appropriate)
- File upload/download (HTTP is more efficient)

---

## 2. WebSocket Handshake

### 2.1 Overall Handshake Flow

A WebSocket connection is established using the HTTP Upgrade mechanism. This process is called the "opening handshake." The client sends an HTTP GET request including WebSocket upgrade headers, and the server responds with 101 Switching Protocols to complete the process.

```
Detailed WebSocket handshake flow:

  Client                          Server
      │                              │
      │  ① TCP 3-way handshake       │
      │  ─────── SYN ──────────────→ │
      │  ←────── SYN+ACK ─────────── │
      │  ─────── ACK ──────────────→ │
      │                              │
      │  ② TLS handshake (for wss://)│
      │  ─────── ClientHello ──────→ │
      │  ←────── ServerHello ─────── │
      │  ←────── Certificate ─────── │
      │  ─────── Key Exchange ─────→ │
      │  ←────── Finished ─────────  │
      │                              │
      │  ③ HTTP Upgrade Request      │
      │  ─── GET /chat HTTP/1.1 ───→ │
      │      Upgrade: websocket      │
      │      Connection: Upgrade     │
      │      Sec-WebSocket-Key: xxx  │
      │      Sec-WebSocket-Version: 13│
      │                              │
      │  ④ HTTP 101 Response         │
      │  ←── 101 Switching ───────── │
      │      Protocols               │
      │      Upgrade: websocket      │
      │      Connection: Upgrade     │
      │      Sec-WebSocket-Accept: yyy│
      │                              │
      │  ⑤ WebSocket communication   │
      │  ←════ WebSocket frame ════→ │
      │  ←════ WebSocket frame ════→ │
      │                              │
      │  ⑥ Closing handshake         │
      │  ─── Close Frame ──────────→ │
      │  ←── Close Frame ─────────── │
      │  ─── TCP FIN ──────────────→ │
      │                              │
```

### 2.2 Handshake Request in Detail

```
Client → Server (HTTP request):

  GET /chat HTTP/1.1
  Host: example.com
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
  Sec-WebSocket-Version: 13
  Sec-WebSocket-Protocol: chat, superchat
  Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
  Origin: https://example.com
  Cookie: session=abc123

Role of each header:
  ┌───────────────────────────┬─────────────────────────────────────────┐
  │ Header                    │ Description                             │
  ├───────────────────────────┼─────────────────────────────────────────┤
  │ Upgrade: websocket        │ Request protocol switch to WebSocket    │
  │                           │ (required)                              │
  ├───────────────────────────┼─────────────────────────────────────────┤
  │ Connection: Upgrade       │ Indicates that the Upgrade header is    │
  │                           │ hop-by-hop (required)                   │
  ├───────────────────────────┼─────────────────────────────────────────┤
  │ Sec-WebSocket-Key         │ 16 random bytes Base64-encoded.         │
  │                           │ Used for server verification (required) │
  ├───────────────────────────┼─────────────────────────────────────────┤
  │ Sec-WebSocket-Version     │ Protocol version. Currently 13 (reqd.)  │
  ├───────────────────────────┼─────────────────────────────────────────┤
  │ Sec-WebSocket-Protocol    │ List of candidate sub-protocols (opt.)  │
  ├───────────────────────────┼─────────────────────────────────────────┤
  │ Sec-WebSocket-Extensions  │ Desired extensions (optional)           │
  ├───────────────────────────┼─────────────────────────────────────────┤
  │ Origin                    │ Browser client origin (CORS-style check)│
  ├───────────────────────────┼─────────────────────────────────────────┤
  │ Cookie                    │ Auth credentials (when reusing session) │
  └───────────────────────────┴─────────────────────────────────────────┘
```

### 2.3 Handshake Response in Detail

```
Server → Client (HTTP response):

  HTTP/1.1 101 Switching Protocols
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
  Sec-WebSocket-Protocol: chat
  Sec-WebSocket-Extensions: permessage-deflate

  101 Switching Protocols:
  → After this response, the same TCP connection switches to WebSocket protocol
  → HTTP semantics no longer apply
  → Communication is subsequently done in WebSocket frames
```

### 2.4 Computation of Sec-WebSocket-Accept

The Sec-WebSocket-Accept value is generated by concatenating the Sec-WebSocket-Key sent by the client with the GUID (magic string) defined in RFC 6455, computing a SHA-1 hash, and Base64-encoding the result. This mechanism is designed to prevent cross-protocol attacks.

```typescript
// Implementation of Sec-WebSocket-Accept computation
import { createHash } from 'crypto';

function computeAcceptKey(clientKey: string): string {
  // Magic string (GUID) defined in RFC 6455
  const MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

  // Step 1: Concatenate client key with GUID
  const combined = clientKey + MAGIC_STRING;
  // e.g.: "dGhlIHNhbXBsZSBub25jZQ==" + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

  // Step 2: Compute SHA-1 hash
  const hash = createHash('sha1').update(combined).digest();

  // Step 3: Base64-encode
  const acceptKey = hash.toString('base64');
  // Result: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="

  return acceptKey;
}

// Usage example
const clientKey = 'dGhlIHNhbXBsZSBub25jZQ==';
console.log(computeAcceptKey(clientKey));
// → "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
```

The purpose of this mechanism is to prove that the server understands the WebSocket protocol. It prevents an HTTP server from accidentally accepting a WebSocket connection, and also prevents proxies from performing cache poisoning attacks. Note, however, that this is not cryptographic authentication — it is simply a protocol compatibility check.

---

## 3. WebSocket Frame Structure

### 3.1 Frame Format in Detail

The WebSocket protocol sends and receives data in units called frames. Each frame consists of a header of 2 bytes or more and a payload.

```
WebSocket frame detailed structure (RFC 6455 Section 5.2):

   0                   1                   2                   3
   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
  ┌─┬─┬─┬─┬───────┬─┬─────────────────────────────────────────────┐
  │F│R│R│R│ opcode│M│    Payload length (7 bits)                   │
  │I│S│S│S│ (4bit)│A│                                              │
  │N│V│V│V│       │S│                                              │
  │ │1│2│3│       │K│                                              │
  ├─┴─┴─┴─┴───────┴─┼─────────────────────────────────────────────┤
  │ Extended payload length (16 or 64 bits, if payload len == 126  │
  │ or 127)                                                        │
  ├─────────────────────────────────────────────────────────────────┤
  │ Masking-key (32 bits, only if MASK bit is set)                 │
  ├─────────────────────────────────────────────────────────────────┤
  │ Payload Data (extension data + application data)               │
  │ ...                                                            │
  └─────────────────────────────────────────────────────────────────┘

  Field descriptions:
  ┌──────────────┬──────┬──────────────────────────────────────────┐
  │ Field        │ Bits │ Description                              │
  ├──────────────┼──────┼──────────────────────────────────────────┤
  │ FIN          │ 1    │ 1=final frame, 0=more continuation frames│
  ├──────────────┼──────┼──────────────────────────────────────────┤
  │ RSV1-3       │ 1 ea.│ For extensions. Usually 0.              │
  │              │      │ RSV1=1 used by permessage-deflate        │
  ├──────────────┼──────┼──────────────────────────────────────────┤
  │ Opcode       │ 4    │ Frame type (see below)                   │
  ├──────────────┼──────┼──────────────────────────────────────────┤
  │ MASK         │ 1    │ 1=mask key present (required for C→S)   │
  ├──────────────┼──────┼──────────────────────────────────────────┤
  │ Payload len  │ 7    │ 0-125: actual length                     │
  │              │      │ 126: next 2 bytes are actual length      │
  │              │      │ 127: next 8 bytes are actual length      │
  ├──────────────┼──────┼──────────────────────────────────────────┤
  │ Masking-key  │ 32   │ XOR mask key for payload                 │
  ├──────────────┼──────┼──────────────────────────────────────────┤
  │ Payload      │ var. │ Actual data                              │
  └──────────────┴──────┴──────────────────────────────────────────┘

  Opcode list:
  ┌──────┬────────────┬──────────────────────────────────────────┐
  │ Val  │ Name       │ Description                              │
  ├──────┼────────────┼──────────────────────────────────────────┤
  │ 0x0  │ Continuation│ Continuation frame for fragmented msg.  │
  │ 0x1  │ Text       │ Text data (UTF-8 encoded)                │
  │ 0x2  │ Binary     │ Binary data                              │
  │ 0x3-7│ Reserved   │ Reserved for future non-control frames   │
  │ 0x8  │ Close      │ Connection close request                 │
  │ 0x9  │ Ping       │ Health check request                     │
  │ 0xA  │ Pong       │ Response to Ping                         │
  │ 0xB-F│ Reserved   │ Reserved for future control frames       │
  └──────┴────────────┴──────────────────────────────────────────┘
```

### 3.2 Frame Masking

Masking is applied to all frames sent from client to server. This is required for security reasons and was introduced to prevent proxy cache poisoning attacks.

```typescript
// Implementation of the masking algorithm
function maskPayload(payload: Buffer, maskKey: Buffer): Buffer {
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    // XOR each byte with the corresponding byte of the mask key
    masked[i] = payload[i] ^ maskKey[i % 4];
  }
  return masked;
}

// Unmasking uses the same algorithm (XOR property: A ^ B ^ B = A)
function unmaskPayload(masked: Buffer, maskKey: Buffer): Buffer {
  return maskPayload(masked, maskKey); // same operation
}

// Usage example
const maskKey = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
const original = Buffer.from('Hello');
const masked = maskPayload(original, maskKey);
const restored = unmaskPayload(masked, maskKey);
console.log(restored.toString()); // → "Hello"
```

### 3.3 Message Fragmentation

Large messages can be split into multiple frames for transmission. This allows data to be sent in a streaming fashion while keeping memory usage low.

```
Example of message fragmentation:

  Splitting "Hello, World! This is a long message." into 3 frames:

  Frame 1: FIN=0, Opcode=0x1 (Text), Payload="Hello, "
    → First frame (FIN=0 means "more to come")
    → Opcode indicates the type of the whole message

  Frame 2: FIN=0, Opcode=0x0 (Continuation), Payload="World! This "
    → Middle frame (FIN=0, Opcode=0x0 indicates continuation)

  Frame 3: FIN=1, Opcode=0x0 (Continuation), Payload="is a long message."
    → Final frame (FIN=1 means "this is the last one")

  Important constraints:
  - Control frames (Ping/Pong/Close) cannot be fragmented
  - Control frames can be inserted in the middle of a fragmented message
  - Control frame payload must be 125 bytes or fewer
```

### 3.4 Closing Handshake

A WebSocket connection is terminated through a mutually agreed closing handshake.

```
Closing handshake flow:

  ┌─────────┐                      ┌─────────┐
  │ Client  │                      │ Server  │
  │         │ ── Close(1000) ────→ │         │  1. One side sends a Close frame
  │         │                      │         │     Status code + reason
  │         │ ←── Close(1000) ──── │         │  2. Other side responds with Close
  │         │                      │         │
  │         │ ── TCP FIN ────────→ │         │  3. TCP connection is terminated
  └─────────┘                      └─────────┘

  Status code list:
  ┌──────┬──────────────────┬───────────────────────────────────────┐
  │ Code │ Name             │ Description                          │
  ├──────┼──────────────────┼───────────────────────────────────────┤
  │ 1000 │ Normal Closure   │ Normal closure                       │
  │ 1001 │ Going Away       │ Server shutdown / page navigation    │
  │ 1002 │ Protocol Error   │ Protocol violation                   │
  │ 1003 │ Unsupported Data │ Received unsupported data type       │
  │ 1005 │ No Status Rcvd   │ No status code (internal use)        │
  │ 1006 │ Abnormal Closure │ Abnormal closure (internal, not sent)│
  │ 1007 │ Invalid Payload  │ Invalid payload (e.g., bad UTF-8)    │
  │ 1008 │ Policy Violation │ Policy violation                     │
  │ 1009 │ Message Too Big  │ Message size exceeded                │
  │ 1010 │ Mandatory Ext.   │ Required extension not supported     │
  │ 1011 │ Internal Error   │ Server internal error                │
  │ 1015 │ TLS Handshake    │ TLS handshake failure (internal)     │
  └──────┴──────────────────┴───────────────────────────────────────┘
```

---

## 4. Server Implementation Patterns

### 4.1 Full Implementation with Node.js + ws Library

```typescript
// server.ts - Full-featured WebSocket server implementation
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';

// =============================================================
// Type definitions
// =============================================================
interface ClientInfo {
  id: string;
  ws: WebSocket;
  rooms: Set<string>;
  isAlive: boolean;
  lastActivity: number;
  metadata: Record<string, unknown>;
}

interface Message {
  type: string;
  room?: string;
  to?: string;
  data?: unknown;
  timestamp: number;
}

// =============================================================
// WebSocket server class
// =============================================================
class RealtimeServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientInfo> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval>;
  private messageHandlers: Map<string, (client: ClientInfo, msg: Message) => void>;

  constructor(port: number) {
    const server = createServer((req, res) => {
      // HTTP endpoint (health check, etc.)
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          connections: this.clients.size,
          rooms: this.rooms.size,
          uptime: process.uptime(),
        }));
        return;
      }
      res.writeHead(404).end();
    });

    this.wss = new WebSocketServer({
      server,
      // Authentication during handshake
      verifyClient: (info, callback) => {
        const token = this.extractToken(info.req);
        if (!token || !this.validateToken(token)) {
          callback(false, 401, 'Unauthorized');
          return;
        }
        callback(true);
      },
      // Maximum payload size (1MB)
      maxPayload: 1024 * 1024,
      // permessage-deflate compression
      perMessageDeflate: {
        zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
        zlibInflateOptions: { chunkSize: 10 * 1024 },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024, // Compress only messages >= 1KB
      },
    });

    // Register message handlers
    this.messageHandlers = new Map([
      ['join', this.handleJoin.bind(this)],
      ['leave', this.handleLeave.bind(this)],
      ['broadcast', this.handleBroadcast.bind(this)],
      ['direct', this.handleDirectMessage.bind(this)],
      ['room_message', this.handleRoomMessage.bind(this)],
    ]);

    this.setupConnectionHandler();
    this.heartbeatInterval = this.startHeartbeat();

    server.listen(port, () => {
      console.log(`WebSocket server listening on port ${port}`);
    });
  }

  // ---------------------------------------------------------
  // Connection handler
  // ---------------------------------------------------------
  private setupConnectionHandler(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = crypto.randomUUID();
      const clientInfo: ClientInfo = {
        id: clientId,
        ws,
        rooms: new Set(),
        isAlive: true,
        lastActivity: Date.now(),
        metadata: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          connectedAt: new Date().toISOString(),
        },
      };

      this.clients.set(clientId, clientInfo);
      console.log(`Client connected: ${clientId} (total: ${this.clients.size})`);

      // Welcome message
      this.sendTo(ws, {
        type: 'welcome',
        data: { clientId, serverTime: Date.now() },
        timestamp: Date.now(),
      });

      // Receive messages
      ws.on('message', (raw: RawData) => {
        try {
          clientInfo.lastActivity = Date.now();
          const message: Message = JSON.parse(raw.toString());
          this.routeMessage(clientInfo, message);
        } catch (error) {
          this.sendTo(ws, {
            type: 'error',
            data: { message: 'Invalid message format' },
            timestamp: Date.now(),
          });
        }
      });

      // Pong response
      ws.on('pong', () => {
        clientInfo.isAlive = true;
      });

      // Disconnect handler
      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`Client disconnected: ${clientId} (code: ${code})`);
        // Leave all rooms
        for (const room of clientInfo.rooms) {
          this.leaveRoom(clientId, room);
        }
        this.clients.delete(clientId);
      });

      // Error handler
      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for ${clientId}: ${error.message}`);
      });
    });
  }

  // ---------------------------------------------------------
  // Message routing
  // ---------------------------------------------------------
  private routeMessage(client: ClientInfo, message: Message): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(client, message);
    } else {
      this.sendTo(client.ws, {
        type: 'error',
        data: { message: `Unknown message type: ${message.type}` },
        timestamp: Date.now(),
      });
    }
  }

  // ---------------------------------------------------------
  // Message handlers
  // ---------------------------------------------------------
  private handleJoin(client: ClientInfo, msg: Message): void {
    const room = msg.room;
    if (!room) return;
    this.joinRoom(client.id, room);
    this.sendTo(client.ws, {
      type: 'joined',
      room,
      data: { members: this.getRoomMembers(room).length },
      timestamp: Date.now(),
    });
  }

  private handleLeave(client: ClientInfo, msg: Message): void {
    const room = msg.room;
    if (!room) return;
    this.leaveRoom(client.id, room);
  }

  private handleBroadcast(client: ClientInfo, msg: Message): void {
    this.broadcast({
      type: 'broadcast',
      data: { from: client.id, content: msg.data },
      timestamp: Date.now(),
    }, client.id);
  }

  private handleDirectMessage(client: ClientInfo, msg: Message): void {
    if (!msg.to) return;
    const target = this.clients.get(msg.to);
    if (target) {
      this.sendTo(target.ws, {
        type: 'direct',
        data: { from: client.id, content: msg.data },
        timestamp: Date.now(),
      });
    }
  }

  private handleRoomMessage(client: ClientInfo, msg: Message): void {
    const room = msg.room;
    if (!room || !client.rooms.has(room)) return;
    this.broadcastToRoom(room, {
      type: 'room_message',
      room,
      data: { from: client.id, content: msg.data },
      timestamp: Date.now(),
    }, client.id);
  }

  // ---------------------------------------------------------
  // Room management
  // ---------------------------------------------------------
  private joinRoom(clientId: string, room: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(clientId);
    this.clients.get(clientId)?.rooms.add(room);
  }

  private leaveRoom(clientId: string, room: string): void {
    this.rooms.get(room)?.delete(clientId);
    if (this.rooms.get(room)?.size === 0) {
      this.rooms.delete(room);
    }
    this.clients.get(clientId)?.rooms.delete(room);
  }

  private getRoomMembers(room: string): string[] {
    return Array.from(this.rooms.get(room) || []);
  }

  // ---------------------------------------------------------
  // Send utilities
  // ---------------------------------------------------------
  private sendTo(ws: WebSocket, message: Message): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: Message, excludeId?: string): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }

  private broadcastToRoom(room: string, message: Message, excludeId?: string): void {
    const data = JSON.stringify(message);
    const members = this.rooms.get(room);
    if (!members) return;
    for (const memberId of members) {
      if (memberId === excludeId) continue;
      const client = this.clients.get(memberId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  // ---------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------
  private startHeartbeat(): ReturnType<typeof setInterval> {
    return setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          console.log(`Client ${id} failed heartbeat, terminating`);
          client.ws.terminate();
          this.clients.delete(id);
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000);
  }

  // ---------------------------------------------------------
  // Auth utilities
  // ---------------------------------------------------------
  private extractToken(req: IncomingMessage): string | null {
    const url = parseUrl(req.url || '', true);
    return (url.query.token as string) || null;
  }

  private validateToken(token: string): boolean {
    // In a real application, perform JWT verification etc.
    return token.length > 0;
  }

  // ---------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------
  shutdown(): void {
    clearInterval(this.heartbeatInterval);
    this.clients.forEach((client) => {
      client.ws.close(1001, 'Server shutting down');
    });
    this.wss.close();
  }
}

// Start server
const server = new RealtimeServer(8080);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.shutdown();
  process.exit(0);
});
```

### 4.2 WebSocket Server in Go

```go
// main.go - Implementation with Go + gorilla/websocket
package main

import (
    "encoding/json"
    "log"
    "net/http"
    "sync"
    "time"

    "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        // In production, perform proper origin validation
        origin := r.Header.Get("Origin")
        return origin == "https://example.com"
    },
}

type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    register   chan *Client
    unregister chan *Client
    mu         sync.RWMutex
}

type Client struct {
    hub  *Hub
    conn *websocket.Conn
    send chan []byte
}

type Message struct {
    Type string          `json:"type"`
    Data json.RawMessage `json:"data"`
}

func newHub() *Hub {
    return &Hub{
        clients:    make(map[*Client]bool),
        broadcast:  make(chan []byte, 256),
        register:   make(chan *Client),
        unregister: make(chan *Client),
    }
}

func (h *Hub) run() {
    for {
        select {
        case client := <-h.register:
            h.mu.Lock()
            h.clients[client] = true
            h.mu.Unlock()
        case client := <-h.unregister:
            h.mu.Lock()
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
            }
            h.mu.Unlock()
        case message := <-h.broadcast:
            h.mu.RLock()
            for client := range h.clients {
                select {
                case client.send <- message:
                default:
                    close(client.send)
                    delete(h.clients, client)
                }
            }
            h.mu.RUnlock()
        }
    }
}

func (c *Client) readPump() {
    defer func() {
        c.hub.unregister <- c
        c.conn.Close()
    }()
    c.conn.SetReadLimit(512 * 1024) // 512KB
    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    c.conn.SetPongHandler(func(string) error {
        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        return nil
    })
    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            break
        }
        c.hub.broadcast <- message
    }
}

func (c *Client) writePump() {
    ticker := time.NewTicker(30 * time.Second)
    defer func() {
        ticker.Stop()
        c.conn.Close()
    }()
    for {
        select {
        case message, ok := <-c.send:
            if !ok {
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }
            c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
                return
            }
        case <-ticker.C:
            c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("Upgrade error:", err)
        return
    }
    client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
    client.hub.register <- client
    go client.writePump()
    go client.readPump()
}

func main() {
    hub := newHub()
    go hub.run()
    http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
        serveWs(hub, w, r)
    })
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

---

## 5. Client Implementation Patterns

### 5.1 Robust Browser Client

A practical WebSocket client requires reconnection logic, message queuing, and an event emitter pattern. The following is an implementation designed for production use.

```typescript
// websocket-client.ts - Production-ready WebSocket client
type MessageHandler = (data: unknown) => void;
type ConnectionState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected';

interface WebSocketClientOptions {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
}

class RobustWebSocketClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageQueue: string[] = [];
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private options: Required<WebSocketClientOptions>;

  constructor(options: WebSocketClientOptions) {
    this.options = {
      protocols: [],
      reconnect: true,
      maxReconnectAttempts: 10,
      reconnectBaseDelay: 1000,
      reconnectMaxDelay: 30000,
      heartbeatInterval: 30000,
      messageQueueSize: 100,
      ...options,
    };
  }

  // ---------------------------------------------------
  // Connection management
  // ---------------------------------------------------
  connect(): void {
    if (this.state === 'connecting' || this.state === 'connected') {
      console.warn('WebSocket is already connected or connecting');
      return;
    }

    this.state = 'connecting';
    this.emit('stateChange', { state: this.state });

    try {
      this.ws = new WebSocket(this.options.url, this.options.protocols);
    } catch (error) {
      this.handleConnectionFailure();
      return;
    }

    this.ws.onopen = () => {
      this.state = 'connected';
      this.reconnectAttempts = 0;
      this.emit('stateChange', { state: this.state });
      this.emit('connected', {});
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'pong') {
          // Handle heartbeat response
          return;
        }
        this.emit(message.type, message.data);
        this.emit('message', message);
      } catch {
        // Non-JSON message
        this.emit('rawMessage', event.data);
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.stopHeartbeat();
      const wasConnected = this.state === 'connected';
      this.state = 'disconnected';
      this.emit('stateChange', { state: this.state });
      this.emit('disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      // If unexpectedly disconnected and reconnect is enabled
      if (wasConnected && !event.wasClean && this.options.reconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.emit('error', { message: 'WebSocket connection error' });
    };
  }

  // ---------------------------------------------------
  // Reconnection (exponential backoff + jitter)
  // ---------------------------------------------------
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.emit('reconnectFailed', {
        attempts: this.reconnectAttempts,
      });
      return;
    }

    // Exponential backoff: baseDelay * 2^attempts
    const exponentialDelay =
      this.options.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.options.reconnectMaxDelay);

    // Jitter: random factor between 0.5 and 1.5
    const jitter = 0.5 + Math.random();
    const delay = Math.floor(cappedDelay * jitter);

    this.reconnectAttempts++;
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // ---------------------------------------------------
  // Message sending (with queue)
  // ---------------------------------------------------
  send(type: string, data: unknown = {}): boolean {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      return true;
    }

    // Add to queue while connecting
    if (this.messageQueue.length < this.options.messageQueueSize) {
      this.messageQueue.push(message);
      return false;
    }

    console.warn('Message queue is full, dropping message');
    return false;
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      this.ws.send(message);
    }
  }

  // ---------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ---------------------------------------------------
  // Event emitter
  // ---------------------------------------------------
  on(event: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  private emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in handler for event "${event}":`, error);
      }
    });
  }

  // ---------------------------------------------------
  // Disconnect
  // ---------------------------------------------------
  disconnect(code = 1000, reason = 'Normal closure'): void {
    this.state = 'disconnecting';
    this.options.reconnect = false; // Disable reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.stopHeartbeat();
    this.ws?.close(code, reason);
  }

  // ---------------------------------------------------
  // State accessors
  // ---------------------------------------------------
  getState(): ConnectionState {
    return this.state;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }
}

// Usage example
const client = new RobustWebSocketClient({
  url: 'wss://api.example.com/ws',
  reconnect: true,
  maxReconnectAttempts: 15,
  reconnectBaseDelay: 1000,
  heartbeatInterval: 25000,
});

// Register event listeners
client.on('connected', () => {
  console.log('WebSocket connected');
  client.send('join', { room: 'general' });
});

client.on('chat', (data) => {
  console.log('Chat message:', data);
});

client.on('reconnecting', (info) => {
  console.log(`Reconnecting (attempt ${(info as any).attempt})...`);
});

client.connect();
```

### 5.2 WebSocket Integration with React Hooks

```typescript
// useWebSocket.ts - Custom hook for React
import { useRef, useState, useEffect, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: (event: CloseEvent) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  send: (data: unknown) => void;
  isConnected: boolean;
  lastMessage: unknown | null;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    onMessage,
    onConnect,
    onDisconnect,
    reconnect = true,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
      onConnect?.();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastMessage(data);
      onMessage?.(data);
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      onDisconnect?.(event);
      if (reconnect && !event.wasClean) {
        reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
      }
    };

    ws.onerror = () => {
      // Error handling (onclose follows)
    };

    wsRef.current = ws;
  }, [url, onMessage, onConnect, onDisconnect, reconnect, reconnectInterval]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close(1000);
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close(1000, 'User initiated disconnect');
  }, []);

  return { send, isConnected, lastMessage, disconnect };
}

// Usage in a component:
// function ChatRoom() {
//   const { send, isConnected, lastMessage } = useWebSocket({
//     url: 'wss://api.example.com/ws',
//     onMessage: (data) => console.log('Received:', data),
//   });
//
//   return (
//     <div>
//       <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
//       <button onClick={() => send({ type: 'chat', text: 'Hello!' })}>
//         Send
//       </button>
//     </div>
//   );
// }
```

---

## 6. High-Level Abstraction with Socket.IO

### 6.1 Overview of Socket.IO

Socket.IO is a real-time communication library built on top of WebSocket that provides many added values over the raw WebSocket API.

```
Comparison of raw WebSocket vs Socket.IO:

  ┌──────────────────────┬──────────────┬──────────────────────────┐
  │ Feature              │ Raw WebSocket│ Socket.IO                │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Auto-reconnect       │ Manual impl. │ Built-in                 │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Fallback             │ None         │ Long Polling → WebSocket │
  │ (if WS unsupported)  │              │                          │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Room feature         │ Manual impl. │ Built-in                 │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Namespaces           │ None         │ Built-in                 │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ ACK (delivery confirm)│ Manual impl.│ Built-in                 │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Binary support       │ Manual mgmt  │ Auto-detect & separate   │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Broadcast            │ Manual impl. │ Built-in (room-aware)    │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Middleware           │ None         │ Built-in                 │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Multi-server support │ Manual impl. │ Via Adapter (Redis etc.) │
  │ (Redis, etc.)        │              │                          │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Protocol             │ Standards    │ Custom protocol          │
  │ compatibility        │ compliant    │ (raw WS client won't work)│
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Overhead             │ Minimal      │ Slightly larger          │
  ├──────────────────────┼──────────────┼──────────────────────────┤
  │ Learning curve       │ Med–High     │ Low–Med                  │
  └──────────────────────┴──────────────┴──────────────────────────┘

  Important note: A Socket.IO client cannot connect to a raw WebSocket server,
  and vice versa. Socket.IO uses its own protocol layer.
```

### 6.2 Socket.IO Server Implementation

```typescript
// socket-io-server.ts - Implementation using Socket.IO
import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: ['https://example.com'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,    // Interval to send Ping
  pingTimeout: 20000,     // Timeout waiting for Pong response
  maxHttpBufferSize: 1e6, // Max 1MB
  transports: ['websocket', 'polling'], // Transport priority
});

// ---------------------------------------------------
// Redis Adapter (multi-server support)
// ---------------------------------------------------
async function setupRedisAdapter(): Promise<void> {
  const pubClient = createClient({ url: 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis adapter connected');
}

// ---------------------------------------------------
// Middleware (authentication)
// ---------------------------------------------------
io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    // JWT verification (simplified for illustration)
    const decoded = verifyJWT(token);
    (socket as any).userId = decoded.userId;
    (socket as any).username = decoded.username;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// ---------------------------------------------------
// Namespace: chat
// ---------------------------------------------------
const chatNamespace = io.of('/chat');

chatNamespace.on('connection', (socket: Socket) => {
  const userId = (socket as any).userId;
  const username = (socket as any).username;
  console.log(`User connected: ${username} (${userId})`);

  // Join a room
  socket.on('joinRoom', async (roomName: string) => {
    await socket.join(roomName);
    socket.to(roomName).emit('userJoined', { userId, username, roomName });
    // Get number of members in room
    const members = await chatNamespace.in(roomName).fetchSockets();
    socket.emit('roomInfo', {
      roomName,
      memberCount: members.length,
    });
  });

  // Leave a room
  socket.on('leaveRoom', async (roomName: string) => {
    await socket.leave(roomName);
    socket.to(roomName).emit('userLeft', { userId, username, roomName });
  });

  // Send message (with ACK)
  socket.on('sendMessage', (data: { room: string; text: string }, ack) => {
    const message = {
      id: crypto.randomUUID(),
      from: { userId, username },
      text: data.text,
      timestamp: Date.now(),
    };
    socket.to(data.room).emit('newMessage', message);
    // Return delivery confirmation
    ack?.({ status: 'ok', messageId: message.id });
  });

  // Typing indicator
  socket.on('typing', (roomName: string) => {
    socket.to(roomName).volatile.emit('userTyping', { userId, username });
  });

  // Disconnect handler
  socket.on('disconnect', (reason: string) => {
    console.log(`User disconnected: ${username} (reason: ${reason})`);
  });
});

// ---------------------------------------------------
// Namespace: notifications
// ---------------------------------------------------
const notificationNamespace = io.of('/notifications');

notificationNamespace.on('connection', (socket: Socket) => {
  const userId = (socket as any).userId;
  // Join user-specific room (for individual notifications)
  socket.join(`user:${userId}`);
});

// Function to send notification from outside
function sendNotification(userId: string, notification: object): void {
  notificationNamespace.to(`user:${userId}`).emit('notification', notification);
}

// ---------------------------------------------------
// JWT verification (simplified)
// ---------------------------------------------------
function verifyJWT(token: string): { userId: string; username: string } {
  // In a real application, use the jsonwebtoken library etc.
  return { userId: 'user-1', username: 'demo' };
}

// ---------------------------------------------------
// Start server
// ---------------------------------------------------
async function main(): Promise<void> {
  await setupRedisAdapter();
  httpServer.listen(3000, () => {
    console.log('Socket.IO server listening on port 3000');
  });
}

main().catch(console.error);
```

### 6.3 Socket.IO Client Implementation

```typescript
// socket-io-client.ts - Socket.IO client
import { io, Socket } from 'socket.io-client';

class ChatService {
  private socket: Socket;

  constructor(serverUrl: string, authToken: string) {
    this.socket = io(`${serverUrl}/chat`, {
      auth: { token: authToken },
      transports: ['websocket'],          // Prefer WebSocket
      reconnection: true,                 // Enable auto-reconnect
      reconnectionAttempts: 10,           // Max reconnection attempts
      reconnectionDelay: 1000,            // Initial reconnection delay
      reconnectionDelayMax: 10000,        // Max reconnection delay
      timeout: 5000,                      // Connection timeout
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.socket.on('connect', () => {
      console.log('Connected to chat server');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error.message);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // If server explicitly disconnected, reconnect manually
        this.socket.connect();
      }
    });

    // Receive events
    this.socket.on('newMessage', (message) => {
      console.log('New message:', message);
    });

    this.socket.on('userJoined', (data) => {
      console.log(`${data.username} joined ${data.roomName}`);
    });

    this.socket.on('userTyping', (data) => {
      console.log(`${data.username} is typing...`);
    });
  }

  joinRoom(roomName: string): void {
    this.socket.emit('joinRoom', roomName);
  }

  sendMessage(room: string, text: string): Promise<{ status: string; messageId: string }> {
    return new Promise((resolve) => {
      // emit with ACK
      this.socket.emit('sendMessage', { room, text }, (response: any) => {
        resolve(response);
      });
    });
  }

  notifyTyping(room: string): void {
    this.socket.volatile.emit('typing', room);
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}
```

---

## 7. Scaling and Architecture

### 7.1 WebSocket Scaling Challenges

WebSocket connections are stateful. Unlike HTTP, where requests can be routed to any server, scaling requires special consideration.

```
WebSocket scaling architecture:

  ┌──────────────────────────────────────────────────────────────┐
  │                       Load Balancer                          │
  │                    (Sticky Sessions/IP Hash)                 │
  │  ┌──────────┐     ┌──────────┐     ┌──────────┐            │
  │  │ WS req A │     │ WS req B │     │ WS req C │            │
  └──┼──────────┼─────┼──────────┼─────┼──────────┼────────────┘
     │          │     │          │     │          │
     ▼          │     ▼          │     ▼          │
  ┌─────────┐  │  ┌─────────┐  │  ┌─────────┐  │
  │ WS      │  │  │ WS      │  │  │ WS      │  │
  │ Server 1│  │  │ Server 2│  │  │ Server 3│  │
  │(100 conn)│  │  │(100 conn)│  │  │(100 conn)│  │
  └────┬────┘  │  └────┬────┘  │  └────┬────┘  │
       │       │       │       │       │       │
       ▼       │       ▼       │       ▼       │
  ┌────────────┴───────────────┴───────────────┴───────────┐
  │                    Redis Pub/Sub                        │
  │              (inter-server message relay)              │
  │                                                        │
  │  When client A on Server1 sends a message to client B  │
  │  on Server2:                                           │
  │    A → Server1 → Redis(publish) → Server2 → B          │
  └────────────────────────────────────────────────────────┘

  Approximate max connections per server (typical hardware):
  ┌───────────────────┬──────────────────┬───────────────────┐
  │ Memory            │ Idle connections │ Active connections│
  ├───────────────────┼──────────────────┼───────────────────┤
  │ 1 GB              │ ~50,000          │ ~10,000           │
  │ 4 GB              │ ~200,000         │ ~50,000           │
  │ 16 GB             │ ~500,000+        │ ~150,000          │
  └───────────────────┴──────────────────┴───────────────────┘
  ※ Active connections include CPU cost of message processing
```

### 7.2 Load Balancer Configuration

Configuration example for a load balancer supporting WebSocket connections.

```nginx
# nginx.conf - Reverse proxy configuration with WebSocket support
upstream websocket_backend {
    # Sticky Session via IP hash
    ip_hash;

    server ws-server-1:8080;
    server ws-server-2:8080;
    server ws-server-3:8080;
}

server {
    listen 443 ssl;
    server_name ws.example.com;

    ssl_certificate     /etc/ssl/certs/example.com.crt;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    location /ws {
        proxy_pass http://websocket_backend;

        # Settings required for WebSocket upgrade
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forward client information
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout settings (accommodate long-lived WebSocket connections)
        proxy_read_timeout 86400s;  # 24 hours
        proxy_send_timeout 86400s;
    }
}
```

### 7.3 Security Considerations

WebSocket security requires countermeasures on two fronts: authentication during the initial HTTP handshake, and message validation during ongoing communication.

**Authentication strategies:**

1. **Token authentication during handshake**: Send JWT via query parameter or Cookie, and verify in the server's verifyClient hook
2. **Authentication via first message**: After connection is established, send credentials as the first message (since the WebSocket API cannot send custom headers)
3. **Periodic token refresh**: For long-lived connections where tokens may expire, implement a refresh mechanism over WebSocket

**Input validation:**

```typescript
// Example implementation of message validation
import { z } from 'zod';

// Define message schemas
const ChatMessageSchema = z.object({
  type: z.literal('chat'),
  room: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  text: z.string().min(1).max(5000).trim(),
});

const JoinRoomSchema = z.object({
  type: z.literal('join'),
  room: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});

const MessageSchema = z.discriminatedUnion('type', [
  ChatMessageSchema,
  JoinRoomSchema,
]);

// Validation on message receipt
function handleIncomingMessage(rawData: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    // Reject invalid JSON immediately
    return;
  }

  const result = MessageSchema.safeParse(parsed);
  if (!result.success) {
    console.warn('Invalid message:', result.error.issues);
    return;
  }

  // Process the validated message
  const message = result.data;
  switch (message.type) {
    case 'chat':
      processChatMessage(message);
      break;
    case 'join':
      processJoinRoom(message);
      break;
  }
}

// Rate limiter implementation
class RateLimiter {
  private counters: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const entry = this.counters.get(clientId);

    if (!entry || now > entry.resetAt) {
      this.counters.set(clientId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }
}

// Max 10 messages per second
const rateLimiter = new RateLimiter(10, 1000);

function processChatMessage(message: z.infer<typeof ChatMessageSchema>): void {
  // Message processing logic
}

function processJoinRoom(message: z.infer<typeof JoinRoomSchema>): void {
  // Room join logic
}
```

---

## 8. Anti-Patterns

### 8.1 Anti-Pattern 1: Unbounded Broadcast

Broadcasting indiscriminately to all clients causes the server's send load to explode in proportion to the number of connections. This is called a "broadcast storm" and is one of the most common causes of failures in production.

```typescript
// Bad example: unbounded broadcast to all clients
// 1,000 connections × 1,000 messages/sec = 1,000,000 messages/sec send load

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Forward to all clients → N^2 problem
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);  // Risk of overflowing the send buffer
      }
    });
  });
});

// Improved example: room-based distribution + rate limiting
wss.on('connection', (ws) => {
  const clientRooms = new Set<string>();
  const messageRateLimit = new RateLimiter(10, 1000);
  const clientId = crypto.randomUUID();

  ws.on('message', (raw) => {
    // Check rate limit
    if (!messageRateLimit.isAllowed(clientId)) {
      ws.send(JSON.stringify({ type: 'error', data: 'Rate limit exceeded' }));
      return;
    }

    const message = JSON.parse(raw.toString());

    // Send only to members in the room
    if (message.room && clientRooms.has(message.room)) {
      const roomMembers = rooms.get(message.room);
      if (roomMembers) {
        const payload = JSON.stringify(message);
        for (const memberId of roomMembers) {
          if (memberId === clientId) continue;
          const member = clients.get(memberId);
          if (member && member.readyState === WebSocket.OPEN) {
            // Check amount of buffered messages
            if (member.bufferedAmount < 1024 * 1024) {
              member.send(payload);
            }
          }
        }
      }
    }
  });
});
```

**Summary of problems:**
- The cost of sending 1 message is O(N) for N connections
- If everyone sends messages, the total cost is O(N^2)
- Sending without checking `bufferedAmount` causes unbounded memory growth in the send buffer
- Server CPU usage locks at 100%, unable to accept new connections

**Countermeasures:**
1. Limit distribution scope to room-based routing
2. Message rate limiting (per client, per room)
3. Monitor `bufferedAmount` and skip when threshold is exceeded
4. Message aggregation (batch sending)

### 8.2 Anti-Pattern 2: No Reconnection Strategy

WebSocket connections can unexpectedly disconnect for various reasons — network failures, server restarts, load balancer timeouts. A client without a reconnection strategy severely degrades user experience.

```typescript
// Bad example: no reconnection logic
const ws = new WebSocket('wss://api.example.com/ws');
ws.onclose = () => {
  console.log('Connection lost');  // That's it. User must manually reload.
};

// Even worse: immediate reconnect at fixed intervals
ws.onclose = () => {
  setTimeout(() => {
    new WebSocket('wss://api.example.com/ws');
    // Problem 1: All clients attempt reconnect simultaneously when server is down
    // Problem 2: "Thundering herd" — connection flood right after server recovers
    // Problem 3: Fixed interval means load is not distributed
  }, 1000);
};

// Improved example: exponential backoff + jitter + max attempts
class ReconnectionStrategy {
  private attempt = 0;
  private maxAttempts = 10;
  private baseDelay = 1000;    // 1 second
  private maxDelay = 60000;    // 60 seconds
  private timer: ReturnType<typeof setTimeout> | null = null;

  reset(): void {
    this.attempt = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  shouldRetry(): boolean {
    return this.attempt < this.maxAttempts;
  }

  getNextDelay(): number {
    // Exponential backoff
    const exponential = this.baseDelay * Math.pow(2, this.attempt);
    // Cap at max
    const capped = Math.min(exponential, this.maxDelay);
    // Full jitter (random in range 0 to capped)
    // Distributes reconnect timing across multiple clients
    const jittered = Math.random() * capped;

    this.attempt++;
    return Math.floor(jittered);
  }

  scheduleReconnect(callback: () => void): void {
    if (!this.shouldRetry()) {
      console.error('Max reconnection attempts reached');
      return;
    }
    const delay = this.getNextDelay();
    console.log(`Reconnecting in ${delay}ms (attempt ${this.attempt}/${this.maxAttempts})`);
    this.timer = setTimeout(callback, delay);
  }
}
```

Reconnection strategy comparison:

```
  ┌─────────────────┬──────────────┬──────────────┬──────────────────┐
  │ Strategy        │ Delay pattern│ Server load  │ Recovery speed   │
  ├─────────────────┼──────────────┼──────────────┼──────────────────┤
  │ Fixed interval  │ 1s,1s,1s,... │ Very high    │ Fast (overload)  │
  │ Exponential BO  │ 1s,2s,4s,8s  │ Medium       │ Fast at first    │
  │ +Jitter         │ Random       │ Low          │ Average          │
  │ +Jitter+Cap     │ Random       │ Lowest       │ Optimal balance  │
  └─────────────────┴──────────────┴──────────────┴──────────────────┘
```

### 8.3 Anti-Pattern 3: Event Listener Management with Memory Leaks

Neglecting the lifecycle management of WebSocket connections causes accumulating memory leaks from event listeners and timers, destabilizing the server over the long term.

```typescript
// Bad example: insufficient cleanup
wss.on('connection', (ws) => {
  // Sets timer but doesn't clear it on disconnect
  setInterval(() => {
    ws.ping();  // Timer keeps running even after disconnect
  }, 30000);

  // Adds external event listener but never removes it
  eventEmitter.on('globalUpdate', (data) => {
    ws.send(JSON.stringify(data));  // Causes error after disconnect
  });
});

// Improved example: complete cleanup
wss.on('connection', (ws) => {
  // Keep reference to timer
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  // Keep reference to event listener
  const globalUpdateHandler = (data: unknown) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };
  eventEmitter.on('globalUpdate', globalUpdateHandler);

  // Release all resources on disconnect
  ws.on('close', () => {
    clearInterval(heartbeat);
    eventEmitter.off('globalUpdate', globalUpdateHandler);
    // Other cleanup
  });
});
```

---

## 9. Edge Case Analysis

### 9.1 Edge Case 1: Connection Drops by Intermediate Proxies

In corporate networks or mobile communications, transparent proxies or load balancers may unexpectedly disconnect WebSocket connections. The following cases are particularly problematic.

```
Patterns of connection drops by intermediate proxies:

  Case 1: Idle timeout
  ┌─────────┐    ┌───────────┐    ┌─────────┐
  │ Client  │────│ Proxy/LB  │────│ Server  │
  │         │    │ (closes   │    │         │
  │         │    │  after 60s)│    │         │
  └─────────┘    └───────────┘    └─────────┘

  → Proxy closes connections with no data transfer for a set period
  → Countermeasure: send Ping/Pong every 30 seconds to prevent idle state

  Case 2: TLS inspection
  → Corporate firewall fails to analyze WSS connections
  → Countermeasure: use WSS and prepare HTTPS long polling as fallback

  Case 3: Proxy buffering
  → Some proxies buffer WebSocket frames,
     causing loss of real-time characteristics
  → Countermeasure: set X-Accel-Buffering: no header,
     or disable proxy buffering
```

```typescript
// Robust connection management with proxy awareness
class ProxyAwareWebSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongReceived = true;
  private missedPongs = 0;
  private readonly MAX_MISSED_PONGS = 2;

  connect(url: string): void {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.startPingPong();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'pong') {
        this.pongReceived = true;
        this.missedPongs = 0;
        return;
      }
      // Normal message processing
    };

    this.ws.onclose = () => {
      this.stopPingPong();
    };
  }

  private startPingPong(): void {
    // 25-second interval (less than half of most proxy 60-second timeouts)
    this.pingTimer = setInterval(() => {
      if (!this.pongReceived) {
        this.missedPongs++;
        if (this.missedPongs >= this.MAX_MISSED_PONGS) {
          // Proxy may have silently closed the connection
          console.warn('Connection appears dead, reconnecting...');
          this.ws?.close(4000, 'Pong timeout');
          return;
        }
      }
      this.pongReceived = false;
      this.ws?.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }, 25000);
  }

  private stopPingPong(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
```

### 9.2 Edge Case 2: Message Ordering Guarantee and Loss

WebSocket over TCP guarantees ordering, but at the application level, message ordering problems and loss can occur in the following situations.

**Occurrence patterns:**

1. **Message loss during reconnection**: Messages sent by the server while the client is disconnected and before reconnection is complete are lost
2. **Order reversal in multi-server environments**: Messages routed via Redis Pub/Sub and direct sends may arrive out of order
3. **Client-side buffer overflow**: If messages arrive faster than the application can process, browser memory may be exhausted

```typescript
// Implementation of message order guarantee and gap detection
interface SequencedMessage {
  seq: number;         // Sequence number
  type: string;
  data: unknown;
  timestamp: number;
}

class OrderedMessageHandler {
  private expectedSeq = 0;
  private buffer: Map<number, SequencedMessage> = new Map();
  private maxBufferSize = 1000;
  private lastProcessedSeq = -1;

  // Process on message receipt
  receive(message: SequencedMessage): SequencedMessage[] {
    const processed: SequencedMessage[] = [];

    // Duplicate check
    if (message.seq <= this.lastProcessedSeq) {
      console.warn(`Duplicate message detected: seq=${message.seq}`);
      return processed;
    }

    // Process immediately if in expected order
    if (message.seq === this.expectedSeq) {
      processed.push(message);
      this.lastProcessedSeq = message.seq;
      this.expectedSeq++;

      // Also process consecutive messages in the buffer
      while (this.buffer.has(this.expectedSeq)) {
        const buffered = this.buffer.get(this.expectedSeq)!;
        this.buffer.delete(this.expectedSeq);
        processed.push(buffered);
        this.lastProcessedSeq = this.expectedSeq;
        this.expectedSeq++;
      }
    } else if (message.seq > this.expectedSeq) {
      // Preceding message missing → save to buffer
      if (this.buffer.size < this.maxBufferSize) {
        this.buffer.set(message.seq, message);
      }
      console.warn(
        `Gap detected: expected=${this.expectedSeq}, received=${message.seq}, ` +
        `missing ${message.seq - this.expectedSeq} message(s)`
      );
    }

    return processed;
  }

  // Notify server of missing range on reconnect
  getMissingRange(): { from: number; to: number } | null {
    if (this.buffer.size === 0) return null;
    const minBuffered = Math.min(...this.buffer.keys());
    return { from: this.expectedSeq, to: minBuffered - 1 };
  }

  // Reset for reconnection (preserving last processed sequence number)
  resetForReconnect(): number {
    this.buffer.clear();
    return this.lastProcessedSeq;
  }
}

// Server side: resend missing messages on reconnect
class MessageHistory {
  private history: SequencedMessage[] = [];
  private maxHistory = 10000;

  store(message: SequencedMessage): void {
    this.history.push(message);
    // Remove old messages
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  getMessagesSince(seq: number): SequencedMessage[] {
    return this.history.filter((msg) => msg.seq > seq);
  }
}
```

### 9.3 Edge Case 3: Browser Background Tab Restrictions

Modern browsers may throttle timers or suspend connections in background tabs to limit resource consumption.

```typescript
// Background tab countermeasures
class VisibilityAwareConnection {
  private ws: WebSocket | null = null;
  private isBackgrounded = false;
  private lastServerMessage = Date.now();

  constructor() {
    // Monitor state with Page Visibility API
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.onBackground();
      } else {
        this.onForeground();
      }
    });
  }

  private onBackground(): void {
    this.isBackgrounded = true;
    // In background, extend ping interval to reduce unnecessary messages
    this.ws?.send(JSON.stringify({
      type: 'presence',
      status: 'background',
    }));
  }

  private onForeground(): void {
    this.isBackgrounded = false;
    // Check connection state on returning to foreground
    const timeSinceLastMessage = Date.now() - this.lastServerMessage;

    if (timeSinceLastMessage > 60000) {
      // If no messages for 60+ seconds, connection may be dead
      this.ws?.close(4001, 'Stale connection');
      // Reconnection logic kicks in
    } else {
      // Connection is alive → request latest data
      this.ws?.send(JSON.stringify({
        type: 'presence',
        status: 'foreground',
        lastSeq: this.getLastProcessedSeq(),
      }));
    }
  }

  private getLastProcessedSeq(): number {
    // Return last processed sequence number
    return 0; // Implementation omitted
  }
}
```

---

## 10. Performance Optimization

### 10.1 Message Compression

WebSocket has a permessage-deflate extension (RFC 7692) defined, which enables per-message zlib compression.

```
How permessage-deflate works:

  Without compression:
    Client → [JSON text 2KB] → Server

  With compression:
    Client → [deflate compressed ~400B] → Server

  Typical compression ratios (for JSON data):
  ┌──────────────────┬───────────┬──────────┬───────────┐
  │ Data size        │ Before    │ After    │ Ratio     │
  ├──────────────────┼───────────┼──────────┼───────────┤
  │ Small JSON       │ 100 B     │ ~90 B    │ 10%       │
  │ (not recommended)│           │          │           │
  ├──────────────────┼───────────┼──────────┼───────────┤
  │ Medium JSON      │ 1 KB      │ ~300 B   │ 70%       │
  ├──────────────────┼───────────┼──────────┼───────────┤
  │ Large JSON       │ 10 KB     │ ~2 KB    │ 80%       │
  ├──────────────────┼───────────┼──────────┼───────────┤
  │ Repetitive data  │ 50 KB     │ ~5 KB    │ 90%       │
  └──────────────────┴───────────┴──────────┴───────────┘

  Note: Compression of small messages has CPU overhead that outweighs benefits
  → Generally set a threshold (e.g., 1024 bytes) and only compress above it
```

### 10.2 Leveraging Binary Protocols

JSON over WebSocket has excellent readability, but its overhead becomes a problem in high-frequency communication. Using binary serialization formats such as Protocol Buffers or MessagePack can significantly improve bandwidth usage and parsing speed.

```typescript
// Example of binary communication using MessagePack
import { encode, decode } from '@msgpack/msgpack';

// JSON vs MessagePack size comparison
const chatMessage = {
  type: 'chat',
  room: 'general',
  from: { id: 'user-123', name: 'Alice' },
  text: 'Hello, World!',
  timestamp: 1709712000000,
};

// JSON: approximately 120 bytes
const jsonSize = JSON.stringify(chatMessage).length;

// MessagePack: approximately 80 bytes (~33% smaller)
const msgpackData = encode(chatMessage);
const msgpackSize = msgpackData.byteLength;

// Usage with WebSocket
function sendBinary(ws: WebSocket, data: object): void {
  const encoded = encode(data);
  ws.send(encoded); // Sent as binary frame (opcode 0x2)
}

function receiveBinary(event: MessageEvent): object {
  if (event.data instanceof ArrayBuffer) {
    return decode(new Uint8Array(event.data)) as object;
  }
  return JSON.parse(event.data);
}
```

---

## 11. Exercises

### 11.1 Basic Exercise: Implementing an Echo Server

**Goal:** Understand the basic send/receive mechanics of WebSocket

```
Tasks:
  1. Create a WebSocket server with Node.js + ws library
  2. Echo received messages back to the client unchanged
  3. Send a welcome message on connection
  4. Output a log on disconnect
  5. Test the connection using the WebSocket API from the browser console

Expected behavior:
  Client → "Hello" → Server
  Client ← "Echo: Hello" ← Server

Hints:
  - Create an instance of WebSocketServer
  - Accept clients via the 'connection' event
  - Receive messages via the 'message' event, process, and return them
  - Use ws.send() to send messages

Extension tasks:
  - Attach a receive timestamp to each message
  - Count total messages and include in the response
  - Include the number of connected clients in the welcome message
```

### 11.2 Applied Exercise: Implementing a Chat Room

**Goal:** Practice room management, broadcasting, and message format design

```
Tasks:
  1. Implement a WebSocket server supporting multiple chat rooms
  2. Implement the following message types:
     - join: join a room
     - leave: leave a room
     - message: send a message within a room
     - list_rooms: get list of existing rooms
     - list_members: get list of room members
  3. Use JSON format with a 'type' field to identify message types
  4. Notify other members in the room when someone joins or leaves
  5. Implement Ping/Pong health checks at 30-second intervals

Message protocol example:
  Send:    { "type": "join", "room": "general" }
  Receive: { "type": "joined", "room": "general", "members": 3 }

  Send:    { "type": "message", "room": "general", "text": "Hi!" }
  Receive: { "type": "message", "room": "general",
             "from": "user-abc", "text": "Hi!",
             "timestamp": 1709712000000 }

Extension tasks:
  - Add nickname functionality
  - Retain message history (latest 50 messages)
  - Implement typing indicator
  - Add direct message functionality
```

### 11.3 Advanced Exercise: Real-Time Collaboration

**Goal:** Understand the basic concepts of OT (Operational Transformation) or CRDT, and tackle the challenges of concurrent editing

```
Tasks:
  1. Implement a real-time editor where multiple users can edit text simultaneously
  2. Design an architecture including:
     - WebSocket server (relaying operations and resolving conflicts)
     - Client (textarea and WebSocket communication)
     - Operation log (recording edit history)
  3. Send/receive operations in the following format:
     - insert: { type: "insert", pos: 5, text: "hello" }
     - delete: { type: "delete", pos: 5, len: 3 }
  4. Implement basic conflict resolution:
     - Simultaneous inserts at same position → determine order by client ID
     - Overlap between delete range and insert position → adjust position
  5. Implement undo/redo functionality

Architecture:
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │ Editor A │ ←──→ │  Server  │ ←──→ │ Editor B │
  │ (Browser)│      │ (Node.js)│      │ (Browser)│
  └──────────┘      └────┬─────┘      └──────────┘
                         │
                    ┌────┴─────┐
                    │ Document │
                    │  State   │
                    │ (In-mem) │
                    └──────────┘

  Hints:
  - Start with a simple "last write wins" approach
  - Then add sequence-number-based conflict detection
  - Finally implement the basic form of the OT algorithm

  Reference algorithms:
  - OT (Operational Transformation): used in Google Docs
  - CRDT (Conflict-free Replicated Data Type): used in Figma, Notion

Extension tasks:
  - Real-time sharing of cursor position
  - Assign per-user cursor colors
  - Offline editing and synchronization on reconnect
  - Persist operation history (save to database)
```

---

## 12. WebSocket, HTTP/2, and HTTP/3

### 12.1 WebSocket in HTTP/2

HTTP/2 has Server Push and stream multiplexing built in, but these are not replacements for WebSocket. HTTP/2 Server Push is intended for prefetching resources and cannot send data at arbitrary times.

RFC 8441 (Bootstrapping WebSockets with HTTP/2) standardized a mechanism for establishing WebSocket over an HTTP/2 connection. This allows WebSocket communication while benefiting from HTTP/2's multiplexing.

### 12.2 HTTP/3 (QUIC) and WebSocket

HTTP/3 is based on the QUIC protocol over UDP. RFC 9220 (Bootstrapping WebSockets with HTTP/3) has also standardized WebSocket connections over HTTP/3. QUIC's Head-of-line blocking avoidance and connection migration (maintaining the connection when switching from Wi-Fi to mobile) also benefit WebSocket communication.

### 12.3 WebTransport

WebTransport is a new API built on top of HTTP/3, attracting attention as a candidate replacement for WebSocket.

```
Comparison of WebTransport and WebSocket:
  ┌──────────────────┬───────────────────┬────────────────────────┐
  │ Property         │ WebSocket         │ WebTransport           │
  ├──────────────────┼───────────────────┼────────────────────────┤
  │ Transport        │ TCP               │ QUIC (UDP)             │
  ├──────────────────┼───────────────────┼────────────────────────┤
  │ HOL Blocking     │ Yes               │ No                     │
  ├──────────────────┼───────────────────┼────────────────────────┤
  │ Reliability      │ Fully guaranteed  │ Reliable/unreliable    │
  │                  │                   │ selectable             │
  ├──────────────────┼───────────────────┼────────────────────────┤
  │ Multiple streams │ 1 stream/conn.    │ Multiple streams       │
  ├──────────────────┼───────────────────┼────────────────────────┤
  │ Connection       │ Not supported     │ Supported              │
  │ migration        │                   │ (QUIC feature)         │
  ├──────────────────┼───────────────────┼────────────────────────┤
  │ 0-RTT connection │ Not supported     │ Supported              │
  ├──────────────────┼───────────────────┼────────────────────────┤
  │ Browser support  │ Almost all        │ Chromium-based only    │
  │ (as of 2025)     │                   │ (expanding)            │
  ├──────────────────┼───────────────────┼────────────────────────┤
  │ Maturity         │ High              │ Evolving               │
  └──────────────────┴───────────────────┴────────────────────────┘
```

---

## 13. Testing and Debugging

### 13.1 WebSocket Testing Methods

```typescript
// Example WebSocket server test using Jest + ws
import { WebSocketServer, WebSocket } from 'ws';

describe('WebSocket Server', () => {
  let wss: WebSocketServer;
  let serverPort: number;

  beforeAll((done) => {
    wss = new WebSocketServer({ port: 0 }, () => {
      serverPort = (wss.address() as any).port;
      done();
    });

    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'echo') {
          ws.send(JSON.stringify({
            type: 'echo',
            data: msg.data,
            timestamp: Date.now(),
          }));
        }
      });
    });
  });

  afterAll((done) => {
    wss.close(done);
  });

  test('should echo messages back', (done) => {
    const client = new WebSocket(`ws://localhost:${serverPort}`);

    client.on('open', () => {
      client.send(JSON.stringify({ type: 'echo', data: 'hello' }));
    });

    client.on('message', (data) => {
      const response = JSON.parse(data.toString());
      expect(response.type).toBe('echo');
      expect(response.data).toBe('hello');
      expect(response.timestamp).toBeDefined();
      client.close();
      done();
    });
  });

  test('should handle multiple concurrent connections', (done) => {
    const clientCount = 10;

    for (let i = 0; i < clientCount; i++) {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      client.on('open', () => {
        client.send(JSON.stringify({ type: 'echo', data: `msg-${i}` }));
      });
      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.data).toBe(`msg-${i}`);
        client.close();
        completedCount++;
        if (completedCount === clientCount) {
          done();
        }
      });
    }
  });
});
```

### 13.2 Debugging Tools

The following tools are useful for debugging WebSocket communication.

1. **Chrome DevTools**: Network tab → WS filter → real-time view of sent/received messages
2. **wscat**: Tool for testing WebSocket connections from the command line
3. **Postman**: Supports WebSocket request send/receive
4. **Wireshark**: Analyzes WebSocket frames at the packet level

```bash
# Testing with wscat
# Install
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8080

# Connect with sub-protocol
wscat -c ws://localhost:8080 -s chat

# Connect with custom headers
wscat -c ws://localhost:8080 -H "Authorization: Bearer token123"
```

---

## 14. FAQ

### Q1: How many WebSocket connections can be maintained?

**A:** The maximum number of connections on a single server depends primarily on memory and file descriptor limits. On Linux, the default file descriptor limit is 1024, but it can be raised with `ulimit -n`. Memory consumption per connection is approximately 20–50 KB in idle state, so a server with 4 GB of memory can theoretically maintain over 100,000 connections. However, factoring in CPU load from message processing and application-specific memory usage, the practical limit is lower. The C10K problem (10,000 simultaneous connections) is easily solved on modern servers, and C100K (100,000 connections) and beyond are achievable with proper tuning and architecture design.

### Q2: Should I choose WebSocket or SSE (Server-Sent Events)?

**A:** The choice depends on the directionality and requirements of the communication. For one-directional notifications from server to client (news feeds, stock price updates, progress notifications), SSE is appropriate. SSE operates over HTTP, making it highly compatible with existing infrastructure, and provides auto-reconnect and event ID management as built-in features. SSE also performs well in HTTP/2 environments. On the other hand, if real-time sends from client to server are also needed (chat, games, collaborative editing), WebSocket is appropriate. If "push from server" is the only goal, there's no need to take on WebSocket's complexity — SSE should be the first candidate.

### Q3: Are CORS restrictions applied to WebSocket connections?

**A:** CORS policy is not applied to WebSocket connections themselves. Browsers do not send preflight requests (OPTIONS) for WebSocket connections. However, browsers automatically include an `Origin` header in the handshake request, allowing origin-based access control to be implemented by validating the `Origin` header on the server side. This is configured via the `verifyClient` option in the ws library, and the `cors` option in Socket.IO. Since the Origin header is set automatically by the browser, non-browser clients (like curl or Node.js) can set any arbitrary value — so Origin validation alone cannot ensure complete security. Combining it with token-based authentication is recommended.

### Q4: Should WebSocket communication be protected with TLS (WSS)?

**A:** In production, always use WSS (WebSocket over TLS). There are three reasons. First, plaintext WebSocket communication is vulnerable to man-in-the-middle attacks and packet sniffing. Second, many corporate network and ISP transparent proxies cannot correctly handle unencrypted WebSocket connections, causing connection failures. Using WSS significantly improves the chance of passing through proxies. Third, in HTTP/2 environments TLS is effectively required, and WSS connections can also benefit from HTTP/2 multiplexing. The performance impact is negligible except for a slight overhead on initial connection, since TLS 1.3 handshakes complete in 1 RTT.

### Q5: What should I do if WebSocket connections disconnect frequently?

**A:** Frequent disconnections can have multiple causes. (1) Load balancer or proxy idle timeout: periodically send Ping/Pong frames to prevent idle state (recommended interval: 25–30 seconds). (2) Network instability: implement auto-reconnect with exponential backoff, adding jitter to avoid load concentration on the server. (3) Insufficient server-side resources: monitor memory usage and file descriptor counts, and configure appropriate resource limits. (4) Client tab goes to background: use the Page Visibility API to reduce communication frequency in background tabs. Additionally, analyzing the close code and reason in disconnect events helps identify the cause of disconnection.

### Q6: How should I differentiate between WebSocket and SSE?

**Comparison Table**

| Property | WebSocket | SSE (Server-Sent Events) |
|------|-----------|--------------------------|
| Direction | **Bidirectional** (full-duplex) | **One-way** (server → client) |
| Protocol | Dedicated protocol (ws://, wss://) | Stream over HTTP/HTTPS |
| Auto-reconnect | Implementation required (Socket.IO standard) | **Browser built-in** |
| Event ID | Implementation required | **Standard support** (last-event-id) |
| Binary | Supported | Text only (Base64 encoding required) |
| Browser support | All modern browsers | Legacy IE/Edge not supported |
| HTTP/2 optimization | Limited | **Excellent performance** (multiplexed over 1 conn.) |
| CORS | Origin validation required | Standard CORS policy applies |

**Decision criteria**

**Cases to choose SSE:**
```
✅ Server push only (client → server via HTTP POST)
   Example: news feed, stock price updates, progress notifications, dashboards

✅ Auto-reconnect and event ID management needed
   → SSE provides these as standard features

✅ Efficient communication in HTTP/2 environments
   → SSE multiplexes multiple streams over a single HTTP/2 connection

✅ Simple implementation
   → Client: new EventSource(url)
   → Server: Content-Type: text/event-stream
```

**Cases to choose WebSocket:**
```
✅ Bidirectional real-time communication needed
   Example: chat, games, collaborative editing, remote control

✅ Binary data send/receive
   Example: image/video streaming, file transfer

✅ Low latency is top priority
   → WebSocket has minimal frame overhead

✅ Custom protocol implementation
   → Extensible via sub-protocol (Sec-WebSocket-Protocol)
```

**Implementation comparison**

```javascript
// SSE (server → client)
const eventSource = new EventSource('/api/updates');
eventSource.addEventListener('message', (event) => {
  console.log('Received:', event.data);
});
// Auto-reconnect: browser handles automatically

// WebSocket (bidirectional)
const ws = new WebSocket('wss://example.com/socket');
ws.addEventListener('message', (event) => {
  console.log('Received:', event.data);
});
ws.send(JSON.stringify({ type: 'chat', message: 'Hello' }));
// Reconnect: must implement yourself (Socket.IO does it automatically)
```

### Q7: What are the WebSocket security measures (WSS, auth, Origin validation)?

**1. Making WSS (WebSocket Secure) mandatory**

```javascript
// ❌ Absolutely not acceptable in production
const ws = new WebSocket('ws://example.com/socket');

// ✅ Always use WSS (TLS encryption)
const ws = new WebSocket('wss://example.com/socket');
```

**Why use WSS:**
- Prevent MITM (Man-in-the-Middle) attacks: prevents eavesdropping and tampering
- Proxy transparency: prevents transparent proxies in corporate networks from mishandling WS
- Cookie protection: Cookies with the Secure attribute are only sent over WSS

**2. Origin validation (prevents CSRF-like attacks)**

```javascript
// Server side (Node.js + ws)
const WebSocket = require('ws');
const wss = new WebSocket.Server({
  verifyClient: (info) => {
    const origin = info.origin || info.req.headers.origin;
    const allowedOrigins = ['https://example.com', 'https://app.example.com'];

    if (!allowedOrigins.includes(origin)) {
      console.warn(`Rejected connection from: ${origin}`);
      return false; // Reject connection
    }
    return true; // Allow connection
  }
});
```

**Note**: The Origin header can be forged by non-browser clients (curl, etc.). Must be combined with token authentication.

**3. Token-based authentication**

```javascript
// Client: include token in connection URL
const token = localStorage.getItem('authToken');
const ws = new WebSocket(`wss://example.com/socket?token=${token}`);

// Or, send auth message after connection
ws.addEventListener('open', () => {
  ws.send(JSON.stringify({ type: 'auth', token: token }));
});

// Server: verify token
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'wss://example.com');
  const token = url.searchParams.get('token');

  if (!verifyToken(token)) {
    ws.close(1008, 'Unauthorized'); // Policy Violation
    return;
  }

  // Process as authenticated user
  ws.userId = getUserIdFromToken(token);
});
```

**4. Rate limiting (DoS countermeasure)**

```javascript
const clients = new Map(); // userId -> { ws, messageCount, lastReset }

wss.on('connection', (ws, req) => {
  const userId = authenticateUser(req);

  clients.set(userId, {
    ws: ws,
    messageCount: 0,
    lastReset: Date.now()
  });

  ws.on('message', (data) => {
    const client = clients.get(userId);
    const now = Date.now();

    // Reset count every minute
    if (now - client.lastReset > 60000) {
      client.messageCount = 0;
      client.lastReset = now;
    }

    client.messageCount++;

    // Rate limit: 100 messages per minute
    if (client.messageCount > 100) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    // Normal processing
    handleMessage(ws, data);
  });
});
```

**5. Input validation and sanitization**

```javascript
ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data);
  } catch (e) {
    ws.close(1003, 'Invalid JSON'); // Unsupported Data
    return;
  }

  // Schema validation (using Joi, Zod, etc.)
  const schema = Joi.object({
    type: Joi.string().valid('chat', 'typing', 'presence').required(),
    content: Joi.string().max(1000),
  });

  const { error } = schema.validate(message);
  if (error) {
    ws.close(1003, 'Invalid message format');
    return;
  }

  // XSS countermeasure: HTML escaping
  const sanitizedContent = escapeHtml(message.content);
  broadcastToRoom(ws.roomId, { ...message, content: sanitizedContent });
});
```

### Q8: What is the WebSocket scaling strategy (horizontal scaling, Sticky Session)?

**Problem: WebSocket is a stateful protocol**

```
Client 1 ── [Load Balancer] ── Server A (holds connection)
Client 2 ──                  ─ Server B (holds connection)
Client 3 ──                  ─ Server C (holds connection)

Challenge: When client 1 is connected to Server A,
           how to deliver client 2's message to client 1?
```

**Solution 1: Sticky Session**

```nginx
# Nginx configuration example
upstream websocket_backend {
    ip_hash; # Same IP address routes to same server
    server 192.168.1.101:3000;
    server 192.168.1.102:3000;
    server 192.168.1.103:3000;
}

server {
    location /socket {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Problem:**
- If user A and user B are on different servers, message delivery fails
- → Solve with Redis Pub/Sub

**Solution 2: Redis Pub/Sub (inter-server messaging)**

```javascript
const redis = require('redis');
const publisher = redis.createClient();
const subscriber = redis.createClient();

// Server A: receives message → broadcasts to all servers via Redis
wss.on('connection', (ws, req) => {
  const userId = authenticateUser(req);

  ws.on('message', (data) => {
    const message = JSON.parse(data);

    // Deliver to all servers via Redis
    publisher.publish('chat:room:123', JSON.stringify({
      userId: userId,
      content: message.content,
      timestamp: Date.now()
    }));
  });
});

// All servers: receive message from Redis → deliver to connected clients
subscriber.subscribe('chat:room:123');
subscriber.on('message', (channel, data) => {
  const message = JSON.parse(data);

  // Deliver to all clients connected to this server
  wss.clients.forEach(client => {
    if (client.roomId === 'room:123' && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
});
```

**Architecture diagram:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Server A   │     │  Server B   │     │  Server C   │
│ (3 ws conn) │     │ (2 ws conn) │     │ (4 ws conn) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Redis Pub/Sub  │ ← Message hub
                  │  (chat:room:*)  │
                  └─────────────────┘
```

---

## FAQ

### Q1: How should I choose between WebSocket and SSE?
SSE is specialized for one-directional streaming from server to client. Since it operates over HTTP, it has high compatibility with proxies and firewalls, and includes built-in automatic reconnection. SSE is suitable for server-to-client-only data delivery such as notifications, news feeds, and dashboard updates. For bidirectional real-time communication such as chat, games, and collaborative editing, choose WebSocket. SSE is also simpler from an infrastructure perspective.

### Q2: What are the most important considerations for scaling WebSocket?
Sticky Session (session affinity) and the message broadcast mechanism. Since WebSocket is a stateful connection, clients must always connect to the same server instance. Configure Sticky Session on the load balancer, and use a message broker such as Redis Pub/Sub or NATS for message delivery across multiple servers. Additionally, designing for connection count limits (OS file descriptor limits) and heartbeat monitoring (Ping/Pong) is important.

### Q3: Should I use Socket.IO or the raw WebSocket API?
Socket.IO is recommended for production environments. It includes built-in functionality needed for production: automatic reconnection (with exponential backoff), room features, namespaces, binary transfer, and fallback (HTTP long polling for environments that don't support WebSocket). On the other hand, the raw WebSocket API is appropriate for simple use cases requiring minimal overhead, or when custom protocol design is needed. Note that Socket.IO uses its own protocol and cannot communicate with raw WebSocket clients.

---

## Summary

| Concept | Key points |
|------|---------|
| WebSocket | Bidirectional real-time communication protocol over HTTP (RFC 6455) |
| Handshake | Protocol switch via HTTP 101 Switching Protocols |
| Frame | 2–14 byte header, supports text/binary |
| Masking | Required for client→server; XOR-based obfuscation |
| Connection management | Ping/Pong (30-second interval), exponential backoff reconnect |
| Scaling | Horizontal scaling via Sticky Session + Redis Pub/Sub |
| Socket.IO | High-level abstraction: auto-reconnect, rooms, namespaces, etc. |
| Security | WSS required, Origin validation, token auth, input validation |
| Alternatives | SSE (one-directional notifications), WebTransport (next-gen) |
| Anti-patterns | Unbounded broadcast, no reconnection strategy, memory leaks |

---

## Next Guides to Read

---

## References

1. Fette, I. and Melnikov, A. "The WebSocket Protocol." RFC 6455, IETF, December 2011. https://datatracker.ietf.org/doc/html/rfc6455
2. Yoshino, T. "Compression Extensions for WebSocket." RFC 7692, IETF, December 2015. https://datatracker.ietf.org/doc/html/rfc7692
3. McManus, P. "Bootstrapping WebSockets with HTTP/2." RFC 8441, IETF, September 2018. https://datatracker.ietf.org/doc/html/rfc8441
4. Hamilton, R. "Bootstrapping WebSockets with HTTP/3." RFC 9220, IETF, June 2022. https://datatracker.ietf.org/doc/html/rfc9220
