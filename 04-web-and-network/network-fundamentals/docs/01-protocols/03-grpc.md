# gRPC

> gRPC is a high-performance RPC framework developed by Google. It offers type-safe communication via Protocol Buffers, HTTP/2-based multiplexing, and four streaming patterns, making it the standard choice for microservice communication.

## Prerequisites

To get the most out of this guide, the following knowledge is required.

**Required**
- Protocol Buffers basics: understanding of the data serialization format

**Recommended**
- RESTful API design experience: to understand the differences from gRPC

---

## What You Will Learn

- [ ] Understand the basic concepts of gRPC and how it differs from REST
- [ ] Learn Protocol Buffers schema definitions
- [ ] Study the four streaming patterns
- [ ] Master server and client implementation
- [ ] Understand error handling and interceptor design
- [ ] Learn about gRPC-Web and mobile support
- [ ] Understand performance optimization and operational best practices

---

## 1. gRPC Basics

```
gRPC = Google Remote Procedure Call
     = HTTP/2 + Protocol Buffers RPC framework

RPC (Remote Procedure Call):
  → Call a remote function as if it were a local function

  Client                           Server
  ┌──────────────┐              ┌──────────────┐
  │ const user = │   HTTP/2     │ GetUser(req)  │
  │  await       │ ──────────→  │ {             │
  │  client      │              │   return user │
  │  .getUser()  │ ←──────────  │ }             │
  └──────────────┘   protobuf   └──────────────┘

  gRPC vs REST:
  ┌──────────────┬──────────────┬──────────────┐
  │              │ REST         │ gRPC         │
  ├──────────────┼──────────────┼──────────────┤
  │ Protocol     │ HTTP/1.1     │ HTTP/2       │
  │ Data format  │ JSON (text)  │ Protobuf (binary)│
  │ Schema       │ OpenAPI (opt)│ .proto (req.)│
  │ Streaming    │ Limited      │ 4 patterns   │
  │ Code gen     │ Optional     │ Automatic    │
  │ Browser      │ Native       │ grpc-web needed│
  │ Speed        │ Normal       │ Fast (5-10x) │
  │ Readability  │ High         │ Low          │
  │ Debugging    │ Easy w/ curl │ Dedicated tools│
  │ Load balance │ L7 LB        │ L7 gRPC LB   │
  │ Caching      │ HTTP standard│ Custom impl needed│
  └──────────────┴──────────────┴──────────────┘

gRPC history:
  2001: Developed internally at Google as "Stubby"
        → Became the company-wide standard for microservice communication
  2015: Open-sourced as gRPC 1.0
  2017: Donated to CNCF (Cloud Native Computing Foundation)
  2024: Full support from major cloud vendors
        → Tight integration with Kubernetes, Istio, Envoy, etc.

Major companies using gRPC:
  Google:    All inter-microservice communication
  Netflix:   Real-time streaming
  Slack:     Real-time messaging
  Square:    Payment processing
  Cisco:     Network device management
  CoreOS:    etcd client API
  Dropbox:   File sync service
```

---

## 2. Protocol Buffers


```protobuf
// user.proto — Schema definition
syntax = "proto3";

package user.v1;

// Go package path
option go_package = "github.com/example/user/v1;userv1";
// Java package
option java_package = "com.example.user.v1";
option java_multiple_files = true;

// Message definition (data structure)
message User {
  string id = 1;         // Field number (binary identifier)
  string name = 2;
  string email = 3;
  int32 age = 4;
  repeated string roles = 5;  // array
  Address address = 6;        // nested message
  optional string phone = 7;  // optional

  // enum field
  UserStatus status = 8;

  // Timestamp type (Well-Known Types)
  google.protobuf.Timestamp created_at = 9;
  google.protobuf.Timestamp updated_at = 10;

  // Map type
  map<string, string> metadata = 11;

  // oneof (exclusive fields)
  oneof notification_preference {
    EmailPreference email_pref = 12;
    SmsPreference sms_pref = 13;
    PushPreference push_pref = 14;
  }
}

// Enum definition
enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;  // Default value (required)
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_INACTIVE = 2;
  USER_STATUS_SUSPENDED = 3;
  USER_STATUS_DELETED = 4;
}

message EmailPreference {
  bool daily_digest = 1;
  bool weekly_summary = 2;
}

message SmsPreference {
  string phone_number = 1;
  bool urgent_only = 2;
}

message PushPreference {
  string device_token = 1;
  repeated string topics = 2;
}

message Address {
  string street = 1;
  string city = 2;
  string state = 3;
  string country = 4;
  string zip_code = 5;
  double latitude = 6;
  double longitude = 7;
}

// Import Well-Known Types
import "google/protobuf/timestamp.proto";
import "google/protobuf/duration.proto";
import "google/protobuf/empty.proto";
import "google/protobuf/field_mask.proto";
import "google/protobuf/wrappers.proto";
import "google/protobuf/any.proto";
import "google/protobuf/struct.proto";

// Service definition (RPC)
service UserService {
  // Unary: 1 request → 1 response
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);

  // Server Streaming: 1 request → multiple responses
  rpc ListUsers(ListUsersRequest) returns (stream User);
  rpc WatchUserUpdates(WatchUserUpdatesRequest) returns (stream UserEvent);

  // Client Streaming: multiple requests → 1 response
  rpc UploadUsers(stream User) returns (UploadUsersResponse);
  rpc BatchCreateUsers(stream CreateUserRequest) returns (BatchCreateUsersResponse);

  // Bidirectional Streaming: two-way stream
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
  rpc SyncUsers(stream UserSyncRequest) returns (stream UserSyncResponse);
}

message GetUserRequest {
  string id = 1;
  // Control returned fields with FieldMask
  google.protobuf.FieldMask field_mask = 2;
}

message GetUserResponse {
  User user = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
  int32 age = 3;
  repeated string roles = 4;
  Address address = 5;
}

message CreateUserResponse {
  User user = 1;
}

message UpdateUserRequest {
  string id = 1;
  User user = 2;
  // Specify fields to update with FieldMask (partial update)
  google.protobuf.FieldMask update_mask = 3;
}

message UpdateUserResponse {
  User user = 1;
}

message DeleteUserRequest {
  string id = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  string filter = 3;     // filter condition
  string order_by = 4;   // sort condition
}

message UploadUsersResponse {
  int32 count = 1;
  repeated string failed_ids = 2;
}

message BatchCreateUsersResponse {
  int32 success_count = 1;
  int32 failure_count = 2;
  repeated BatchError errors = 3;
}

message BatchError {
  int32 index = 1;
  string message = 2;
  int32 code = 3;
}

message WatchUserUpdatesRequest {
  repeated string user_ids = 1;
  repeated string event_types = 2;
}

message UserEvent {
  string event_type = 1;  // "created", "updated", "deleted"
  User user = 2;
  google.protobuf.Timestamp timestamp = 3;
}


message ChatMessage {
  string from = 1;
  string text = 2;
  int64 timestamp = 3;
  string room_id = 4;
}

message UserSyncRequest {
  string operation = 1;
  User user = 2;
  string client_id = 3;
}

message UserSyncResponse {
  string operation = 1;
  User user = 2;
  bool conflict = 3;
  User resolved_user = 4;
}
```

```
Protocol Buffers encoding:

  JSON:      {"id": "123", "name": "Taro", "age": 25}
  Size:      ~42 bytes

  Protobuf:  0a 03 31 32 33 12 04 54 61 72 6f 20 19
  Size:      ~13 bytes (~1/3 of JSON)

  Encoding by field number:
  → Field names are not included in the binary
  → Identified by field number + wire type
  → Backward compatibility: changing the number is fine; renaming is safe

  Wire types:
  ┌──────┬──────────────┬────────────────────────────┐
  │ Type │ Name         │ Used for                   │
  ├──────┼──────────────┼────────────────────────────┤
  │ 0    │ Varint       │ int32, int64, bool, enum    │
  │ 1    │ 64-bit       │ fixed64, sfixed64, double   │
  │ 2    │ Length-delim  │ string, bytes, message,     │
  │      │              │ repeated                    │
  │ 5    │ 32-bit       │ fixed32, sfixed32, float    │
  └──────┴──────────────┴────────────────────────────┘

  Encoding example (id = "123", field number 1, wire type 2):
  Byte 1: 0a = (1 << 3) | 2 = field 1, Length-delimited
  Byte 2: 03 = length 3 bytes
  Bytes 3-5: 31 32 33 = "123" (ASCII)

Protocol Buffers scalar types:
  ┌──────────┬──────────────────┬────────────────┐
  │ Proto type│ Go type          │ TypeScript type│
  ├──────────┼──────────────────┼────────────────┤
  │ double   │ float64          │ number         │
  │ float    │ float32          │ number         │
  │ int32    │ int32            │ number         │
  │ int64    │ int64            │ bigint/string  │
  │ uint32   │ uint32           │ number         │
  │ uint64   │ uint64           │ bigint/string  │
  │ sint32   │ int32            │ number         │
  │ sint64   │ int64            │ bigint/string  │
  │ fixed32  │ uint32           │ number         │
  │ fixed64  │ uint64           │ bigint/string  │
  │ sfixed32 │ int32            │ number         │
  │ sfixed64 │ int64            │ bigint/string  │
  │ bool     │ bool             │ boolean        │
  │ string   │ string           │ string         │
  │ bytes    │ []byte           │ Uint8Array     │
  └──────────┴──────────────────┴────────────────┘

  int32 vs sint32:
  → int32: efficient when positive values dominate (Varint)
  → sint32: efficient when negative values dominate (ZigZag + Varint)

  int64 note:
  → JavaScript number has 53-bit precision
  → int64 is converted to string or bigint in JS
  → Using string is safe when handling IDs in APIs
```

---

## 3. Protocol Buffers Best Practices

```protobuf
// === Managing field numbers ===

// Field number rules:
// 1-15: encoded in 1 byte → use for frequently occurring fields
// 16-2047: encoded in 2 bytes
// 2048+: 3 or more bytes
// 19000-19999: reserved (must not use)

message OptimizedMessage {
  // Assign 1-15 to frequently used fields
  string id = 1;
  string name = 2;
  int32 status = 3;

  // Less frequently used fields go at 16+
  string description = 16;
  map<string, string> metadata = 17;
  repeated string tags = 18;
}

// === Maintaining backward compatibility ===

// Safe changes:
// ✓ Adding fields (with a new number)
// ✓ Removing fields (reserve the number)
// ✓ Renaming fields (as long as the number stays the same)
// ✓ optional ↔ repeated (compatible)

// Breaking changes (always avoid):
// ✗ Changing a field number
// ✗ Changing a field type (int32 → string etc.)
// ✗ Reusing a deleted field number

message UserV2 {
  string id = 1;
  string full_name = 2;  // Rename is OK (same number)
  string email = 3;

  // Fields 4 and 5 were used previously → reserve them
  reserved 4, 5;
  reserved "age", "phone";

  // New fields use new numbers
  string display_name = 6;
  UserProfile profile = 7;
}

// === Package versioning ===

// Include the API version in the package name
// package company.service.v1;
// package company.service.v2;

// File structure:
// proto/
//   user/
//     v1/
//       user.proto
//       user_service.proto
//     v2/
//       user.proto
//       user_service.proto
```

```
Protocol Buffers performance comparison:

  Serialization speed (1M messages/sec):
  ┌──────────────┬───────┬──────────┐
  │ Format       │ Speed │ Relative │
  ├──────────────┼───────┼──────────┤
  │ Protobuf     │ 2.8M  │ 1x       │
  │ FlatBuffers  │ 3.2M  │ 0.87x    │
  │ MessagePack  │ 1.5M  │ 1.87x    │
  │ JSON         │ 0.8M  │ 3.5x     │
  │ XML          │ 0.3M  │ 9.3x     │
  └──────────────┴───────┴──────────┘

  Serialized size (same data):
  ┌──────────────┬────────┬──────────┐
  │ Format       │ Bytes  │ Relative │
  ├──────────────┼────────┼──────────┤
  │ Protobuf     │ 34     │ 1x       │
  │ FlatBuffers  │ 44     │ 1.29x    │
  │ MessagePack  │ 45     │ 1.32x    │
  │ JSON         │ 82     │ 2.41x    │
  │ XML          │ 137    │ 4.03x    │
  └──────────────┴────────┴──────────┘
```

---

## 4. The Four Streaming Patterns

```
① Unary RPC (standard RPC):
  Client ── Request ──→ Server
  Client ←── Response ── Server
  Examples: retrieve user info, authentication, change settings

  Characteristics:
  → Simplest pattern
  → Equivalent to REST request/response
  → The majority of API calls use this pattern

② Server Streaming RPC:
  Client ── Request ──→ Server
  Client ←── Data 1 ──── Server
  Client ←── Data 2 ──── Server
  Client ←── Data 3 ──── Server
  Client ←── Done ──────  Server
  Examples: incremental delivery of search results, log streaming,
            real-time stock prices, news feeds

  Characteristics:
  → Server sends data at any time
  → Client waits for the stream to complete
  → Best for returning large amounts of data incrementally

③ Client Streaming RPC:
  Client ── Data 1 ──→ Server
  Client ── Data 2 ──→
  Client ── Data 3 ──→
  Client ── Done ────→
  Client ←── Response ── Server
  Examples: file upload, batch data sending,
            sensor data collection, log aggregation

  Characteristics:
  → Client sends any number of messages
  → Server returns a response after receiving all messages
  → Best for aggregation processing

④ Bidirectional Streaming RPC:
  Client ── Data ──→ Server
  Client ←── Data ── Server
  Client ── Data ──→ Server
  Client ←── Data ── Server
  Examples: chat, real-time collaborative editing,
            game state sync, audio/video calls

  Characteristics:
  → Both sides send and receive messages independently
  → The sender controls the order
  → Two-way communication similar to WebSocket
  → Most flexible but also the most complex to implement

Streaming pattern selection criteria:
  ┌────────────────┬────────────────┬────────────────────────┐
  │ Pattern        │ Reason         │ Typical use cases      │
  ├────────────────┼────────────────┼────────────────────────┤
  │ Unary          │ Simple ops     │ CRUD, auth, config     │
  │ Server Stream  │ Large data     │ Search results, logs   │
  │ Client Stream  │ Data agg.      │ Upload, batch          │
  │ Bidi Stream    │ Real-time      │ Chat, game sync        │
  └────────────────┴────────────────┴────────────────────────┘
```

---

## 5. Server Implementation (Node.js / TypeScript)

```typescript
// === Project setup ===
// package.json dependencies:
// "@grpc/grpc-js": "^1.9.0"
// "@grpc/proto-loader": "^0.7.0"
// "google-protobuf": "^3.21.0"

// === Method 1: Dynamic loading (for development) ===
// server.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { v4 as uuidv4 } from 'uuid';

// Load Proto definition
const packageDef = protoLoader.loadSync('proto/user/v1/user_service.proto', {
  keepCase: true,         // keep field names as snake_case
  longs: String,          // convert int64 to string
  enums: String,          // convert enum to string
  defaults: true,         // include default values
  oneofs: true,           // include oneof fields
  includeDirs: ['proto'], // search directories for imports
});

const proto = grpc.loadPackageDefinition(packageDef) as any;

// In-memory data store (for demo)
const users = new Map<string, any>();

// === Unary RPC implementation ===
function getUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): void {
  const userId = call.request.id;

  // Retrieve information from metadata
  const metadata = call.metadata;
  const requestId = metadata.get('x-request-id')[0] || uuidv4();
  const authToken = metadata.get('authorization')[0];

  console.log(`[${requestId}] GetUser called for id: ${userId}`);

  // Authentication check
  if (!authToken) {
    callback({
      code: grpc.status.UNAUTHENTICATED,
      message: 'Authentication token is required',
      metadata: createErrorMetadata(requestId),
    });
    return;
  }

  const user = users.get(userId);

  if (!user) {
    callback({
      code: grpc.status.NOT_FOUND,
      message: `User ${userId} not found`,
      metadata: createErrorMetadata(requestId),
    });
    return;
  }

  // FieldMask support (return only the specified fields)
  const fieldMask = call.request.field_mask;
  if (fieldMask && fieldMask.paths.length > 0) {
    const filteredUser = filterByFieldMask(user, fieldMask.paths);
    callback(null, { user: filteredUser });
  } else {
    callback(null, { user });
  }
}

// === CreateUser implementation ===
function createUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): void {
  const { name, email, age, roles, address } = call.request;

  // Validation
  const errors: string[] = [];
  if (!name || name.trim().length === 0) {
    errors.push('name is required');
  }
  if (!email || !email.includes('@')) {
    errors.push('valid email is required');
  }
  if (age !== undefined && (age < 0 || age > 150)) {
    errors.push('age must be between 0 and 150');
  }

  if (errors.length > 0) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: `Validation failed: ${errors.join(', ')}`,
    });
    return;
  }

  // Duplicate email check
  for (const [, existingUser] of users) {
    if (existingUser.email === email) {
      callback({
        code: grpc.status.ALREADY_EXISTS,
        message: `User with email ${email} already exists`,
      });
      return;
    }
  }

  const user = {
    id: uuidv4(),
    name,
    email,
    age: age || 0,
    roles: roles || [],
    address: address || null,
    status: 'USER_STATUS_ACTIVE',
    created_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    updated_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    metadata: {},
  };

  users.set(user.id, user);
  console.log(`User created: ${user.id}`);

  callback(null, { user });
}

// === UpdateUser implementation (partial update with FieldMask support) ===
function updateUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): void {
  const { id, user: updateData, update_mask } = call.request;

  const existingUser = users.get(id);
  if (!existingUser) {
    callback({
      code: grpc.status.NOT_FOUND,
      message: `User ${id} not found`,
    });
    return;
  }

  // Partial update based on FieldMask
  if (update_mask && update_mask.paths.length > 0) {
    for (const path of update_mask.paths) {
      if (path in updateData) {
        existingUser[path] = updateData[path];
      }
    }
  } else {
    // Update all fields when no FieldMask is provided
    Object.assign(existingUser, updateData, { id });
  }

  existingUser.updated_at = {
    seconds: Math.floor(Date.now() / 1000),
    nanos: 0,
  };

  users.set(id, existingUser);
  callback(null, { user: existingUser });
}

// === Server Streaming implementation ===
function listUsers(call: grpc.ServerWritableStream<any, any>): void {
  const { page_size, filter, order_by } = call.request;
  const limit = page_size || 100;

  let userList = Array.from(users.values());

  // Filtering
  if (filter) {
    userList = applyFilter(userList, filter);
  }

  // Sorting
  if (order_by) {
    userList = applySort(userList, order_by);
  }

  // Limit to page size
  userList = userList.slice(0, limit);

  // Send one item at a time via stream
  let index = 0;
  const sendNext = () => {
    if (index < userList.length) {
      const canWrite = call.write(userList[index]);
      index++;

      if (canWrite) {
        // Send the next item immediately
        setImmediate(sendNext);
      } else {
        // Back-pressure: wait for the drain event
        call.once('drain', sendNext);
      }
    } else {
      call.end();
    }
  };

  sendNext();

  // Watch for client cancellation
  call.on('cancelled', () => {
    console.log('ListUsers stream cancelled by client');
  });
}

// === Client Streaming implementation ===
function uploadUsers(
  call: grpc.ServerReadableStream<any, any>,
  callback: grpc.sendUnaryData<any>,
): void {
  let count = 0;
  const failedIds: string[] = [];

  call.on('data', (user: any) => {
    try {
      // Validate and store
      if (!user.name || !user.email) {
        failedIds.push(user.id || 'unknown');
        return;
      }

      const id = user.id || uuidv4();
      users.set(id, { ...user, id });
      count++;
    } catch (error) {
      failedIds.push(user.id || 'unknown');
    }
  });

  call.on('end', () => {
    callback(null, {
      count,
      failed_ids: failedIds,
    });
  });

  call.on('error', (error: Error) => {
    console.error('Upload stream error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: `Stream error: ${error.message}`,
    });
  });
}

// === Bidirectional Streaming implementation ===
function chat(call: grpc.ServerDuplexStream<any, any>): void {
  const roomId = call.metadata.get('room-id')[0] as string || 'default';
  console.log(`Chat stream opened for room: ${roomId}`);

  call.on('data', (message: any) => {
    console.log(`[${roomId}] ${message.from}: ${message.text}`);

    // Echo back (broadcast in practice)
    call.write({
      from: 'server',
      text: `Received: ${message.text}`,
      timestamp: Date.now(),
      room_id: roomId,
    });

    // Bot response (for demo)
    if (message.text.toLowerCase().includes('hello')) {
      call.write({
        from: 'bot',
        text: `Hello, ${message.from}! Welcome to room ${roomId}.`,
        timestamp: Date.now(),
        room_id: roomId,
      });
    }
  });

  call.on('end', () => {
    console.log(`Chat stream closed for room: ${roomId}`);
    call.end();
  });

  call.on('error', (error: Error) => {
    console.error(`Chat stream error in room ${roomId}:`, error);
  });

  call.on('cancelled', () => {
    console.log(`Chat stream cancelled for room: ${roomId}`);
  });
}

// === Helper functions ===
function createErrorMetadata(requestId: string): grpc.Metadata {
  const metadata = new grpc.Metadata();
  metadata.set('x-request-id', requestId);
  return metadata;
}

function filterByFieldMask(obj: any, paths: string[]): any {
  const result: any = {};
  for (const path of paths) {
    if (path in obj) {
      result[path] = obj[path];
    }
  }
  return result;
}

function applyFilter(users: any[], filter: string): any[] {
  // Simple filter implementation (e.g., "status=active")
  const [key, value] = filter.split('=');
  return users.filter(u => String(u[key]) === value);
}

function applySort(users: any[], orderBy: string): any[] {
  const desc = orderBy.startsWith('-');
  const field = desc ? orderBy.slice(1) : orderBy;
  return users.sort((a, b) => {
    const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
    return desc ? -cmp : cmp;
  });
}

// === Server startup ===
function startServer(): void {
  const server = new grpc.Server({
    // Server settings
    'grpc.max_receive_message_length': 10 * 1024 * 1024, // 10MB
    'grpc.max_send_message_length': 10 * 1024 * 1024,    // 10MB
    'grpc.keepalive_time_ms': 60000,                      // 60 seconds
    'grpc.keepalive_timeout_ms': 20000,                   // 20 seconds
    'grpc.keepalive_permit_without_calls': 1,             // Keepalive even without calls
  });

  server.addService(proto.user.v1.UserService.service, {
    getUser,
    createUser,
    updateUser,
    listUsers,
    uploadUsers,
    chat,
  });

  const address = '0.0.0.0:50051';

  server.bindAsync(
    address,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Server bind error:', error);
        process.exit(1);
      }
      console.log(`gRPC server listening on port ${port}`);
    },
  );

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    server.tryShutdown((error) => {
      if (error) {
        console.error('Error during shutdown:', error);
        server.forceShutdown();
      }
      console.log('Server shut down successfully');
      process.exit(0);
    });
  });
}

startServer();
```

---

## 6. Client Implementation (Node.js / TypeScript)

```typescript
// client.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDef = protoLoader.loadSync('proto/user/v1/user_service.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: ['proto'],
});

const proto = grpc.loadPackageDefinition(packageDef) as any;

// === Create client ===
function createClient(address: string = 'localhost:50051') {
  const client = new proto.user.v1.UserService(
    address,
    grpc.credentials.createInsecure(),
    {
      // Client settings
      'grpc.keepalive_time_ms': 30000,
      'grpc.keepalive_timeout_ms': 10000,
      'grpc.max_receive_message_length': 10 * 1024 * 1024,
      'grpc.initial_reconnect_backoff_ms': 1000,
      'grpc.max_reconnect_backoff_ms': 30000,
    },
  );

  return client;
}

// === Call Unary RPC ===
async function getUser(
  client: any,
  userId: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Set metadata
    const metadata = new grpc.Metadata();
    metadata.set('authorization', 'Bearer my-token');
    metadata.set('x-request-id', generateRequestId());

    // Set deadline (timeout)
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5); // 5-second timeout

    client.getUser(
      { id: userId, field_mask: { paths: ['name', 'email'] } },
      metadata,
      { deadline },
      (error: grpc.ServiceError | null, response: any) => {
        if (error) {
          handleGrpcError(error);
          reject(error);
          return;
        }
        resolve(response.user);
      },
    );
  });
}

// === Call Server Streaming ===
async function listAllUsers(client: any): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const users: any[] = [];

    const metadata = new grpc.Metadata();
    metadata.set('authorization', 'Bearer my-token');

    const call = client.listUsers(
      { page_size: 100, filter: 'status=USER_STATUS_ACTIVE' },
      metadata,
    );

    call.on('data', (user: any) => {
      users.push(user);
      console.log(`Received user: ${user.name}`);
    });

    call.on('end', () => {
      console.log(`Total users received: ${users.length}`);
      resolve(users);
    });

    call.on('error', (error: grpc.ServiceError) => {
      handleGrpcError(error);
      reject(error);
    });

    call.on('status', (status: grpc.StatusObject) => {
      console.log(`Stream status: ${status.code} - ${status.details}`);
    });

    // Cancel after 10 seconds (timeout)
    setTimeout(() => {
      call.cancel();
    }, 10000);
  });
}

// === Call Client Streaming ===
async function batchUploadUsers(
  client: any,
  userList: any[],
): Promise<any> {
  return new Promise((resolve, reject) => {
    const metadata = new grpc.Metadata();
    metadata.set('authorization', 'Bearer my-token');

    const call = client.uploadUsers(
      metadata,
      (error: grpc.ServiceError | null, response: any) => {
        if (error) {
          handleGrpcError(error);
          reject(error);
          return;
        }
        console.log(`Uploaded ${response.count} users`);
        resolve(response);
      },
    );

    // Stream users one by one
    for (const user of userList) {
      call.write(user);
    }

    // End stream
    call.end();
  });
}

// === Call Bidirectional Streaming ===
async function startChat(
  client: any,
  userName: string,
  roomId: string,
): Promise<void> {
  const metadata = new grpc.Metadata();
  metadata.set('authorization', 'Bearer my-token');
  metadata.set('room-id', roomId);

  const call = client.chat(metadata);

  // Receive messages from server
  call.on('data', (message: any) => {
    console.log(`[${message.from}]: ${message.text}`);
  });

  call.on('end', () => {
    console.log('Chat stream ended');
  });

  call.on('error', (error: grpc.ServiceError) => {
    if (error.code !== grpc.status.CANCELLED) {
      handleGrpcError(error);
    }
  });

  // Send a message
  call.write({
    from: userName,
    text: 'Hello everyone!',
    timestamp: Date.now(),
    room_id: roomId,
  });

  // Send messages periodically (for demo)
  const interval = setInterval(() => {
    call.write({
      from: userName,
      text: `Ping at ${new Date().toISOString()}`,
      timestamp: Date.now(),
      room_id: roomId,
    });
  }, 5000);

  // End chat after 30 seconds
  setTimeout(() => {
    clearInterval(interval);
    call.end();
  }, 30000);
}

// === Error handling ===
function handleGrpcError(error: grpc.ServiceError): void {
  const statusName = Object.keys(grpc.status).find(
    key => grpc.status[key as keyof typeof grpc.status] === error.code,
  );

  console.error(`gRPC Error [${statusName}] (${error.code}): ${error.message}`);

  // Show metadata details
  if (error.metadata) {
    const requestId = error.metadata.get('x-request-id');
    if (requestId.length > 0) {
      console.error(`  Request ID: ${requestId[0]}`);
    }
  }

  // Handle based on error code
  switch (error.code) {
    case grpc.status.UNAVAILABLE:
      console.error('  → Service is unavailable. Retry with backoff.');
      break;
    case grpc.status.DEADLINE_EXCEEDED:
      console.error('  → Request timed out. Consider increasing deadline.');
      break;
    case grpc.status.UNAUTHENTICATED:
      console.error('  → Authentication failed. Check credentials.');
      break;
    case grpc.status.PERMISSION_DENIED:
      console.error('  → Permission denied. Check authorization.');
      break;
    case grpc.status.RESOURCE_EXHAUSTED:
      console.error('  → Rate limited. Back off and retry.');
      break;
    case grpc.status.NOT_FOUND:
      console.error('  → Resource not found.');
      break;
    default:
      console.error('  → Unexpected error.');
  }
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// === Main execution ===
async function main(): Promise<void> {
  const client = createClient();

  try {
    // Create user
    const created = await new Promise<any>((resolve, reject) => {
      client.createUser(
        { name: 'Taro', email: 'taro@example.com', age: 25 },
        (err: any, res: any) => err ? reject(err) : resolve(res),
      );
    });
    console.log('Created:', created.user);

    // Get user
    const user = await getUser(client, created.user.id);
    console.log('Got:', user);

    // List users (streaming)
    const allUsers = await listAllUsers(client);
    console.log('All users:', allUsers);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

main();
```

---

## 7. Go Implementation

```go
// === Server side (Go) ===
// server/main.go
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "github.com/example/user/v1"
)

type userServer struct {
	pb.UnimplementedUserServiceServer
	mu    sync.RWMutex
	users map[string]*pb.User
}

func newUserServer() *userServer {
	return &userServer{
		users: make(map[string]*pb.User),
	}
}

// Unary RPC
func (s *userServer) GetUser(
	ctx context.Context,
	req *pb.GetUserRequest,
) (*pb.GetUserResponse, error) {
	// Get metadata
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Internal, "failed to get metadata")
	}

	// Authentication check
	authTokens := md.Get("authorization")
	if len(authTokens) == 0 {
		return nil, status.Error(codes.Unauthenticated, "missing auth token")
	}

	// Check context cancellation
	if ctx.Err() == context.Canceled {
		return nil, status.Error(codes.Canceled, "request canceled")
	}
	if ctx.Err() == context.DeadlineExceeded {
		return nil, status.Error(codes.DeadlineExceeded, "deadline exceeded")
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.users[req.Id]
	if !exists {
		return nil, status.Errorf(
			codes.NotFound,
			"user %s not found", req.Id,
		)
	}

	// Set response metadata
	header := metadata.New(map[string]string{
		"x-request-id": fmt.Sprintf("req-%d", time.Now().UnixNano()),
	})
	grpc.SetHeader(ctx, header)

	return &pb.GetUserResponse{User: user}, nil
}

// Server Streaming RPC
func (s *userServer) ListUsers(
	req *pb.ListUsersRequest,
	stream pb.UserService_ListUsersServer,
) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	for _, user := range s.users {
		// Check context cancellation
		if stream.Context().Err() != nil {
			return status.Error(codes.Canceled, "stream canceled")
		}

		if err := stream.Send(user); err != nil {
			return status.Errorf(codes.Internal, "send error: %v", err)
		}

		count++
		if req.PageSize > 0 && int32(count) >= req.PageSize {
			break
		}
	}

	return nil
}

// Client Streaming RPC
func (s *userServer) UploadUsers(
	stream pb.UserService_UploadUsersServer,
) error {
	var count int32

	for {
		user, err := stream.Recv()
		if err == io.EOF {
			// All messages received
			return stream.SendAndClose(&pb.UploadUsersResponse{
				Count: count,
			})
		}
		if err != nil {
			return status.Errorf(codes.Internal, "recv error: %v", err)
		}

		s.mu.Lock()
		s.users[user.Id] = user
		s.mu.Unlock()
		count++
	}
}

// Bidirectional Streaming RPC
func (s *userServer) Chat(
	stream pb.UserService_ChatServer,
) error {
	for {
		msg, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return status.Errorf(codes.Internal, "recv error: %v", err)
		}

		log.Printf("[%s] %s: %s", msg.RoomId, msg.From, msg.Text)

		// Send response
		reply := &pb.ChatMessage{
			From:      "server",
			Text:      fmt.Sprintf("Echo: %s", msg.Text),
			Timestamp: time.Now().Unix(),
			RoomId:    msg.RoomId,
		}

		if err := stream.Send(reply); err != nil {
			return status.Errorf(codes.Internal, "send error: %v", err)
		}
	}
}

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	// Server options
	opts := []grpc.ServerOption{
		grpc.MaxRecvMsgSize(10 * 1024 * 1024), // 10MB
		grpc.MaxSendMsgSize(10 * 1024 * 1024), // 10MB
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle:     15 * time.Minute,
			MaxConnectionAge:      30 * time.Minute,
			MaxConnectionAgeGrace: 5 * time.Second,
			Time:                  5 * time.Minute,
			Timeout:               1 * time.Second,
		}),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             5 * time.Second,
			PermitWithoutStream: true,
		}),
	}

	s := grpc.NewServer(opts...)
	pb.RegisterUserServiceServer(s, newUserServer())

	log.Printf("gRPC server listening on %v", lis.Addr())
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
```

---

## 8. gRPC Error Handling

```
gRPC Status Codes (separate from HTTP status codes):

  ┌────────────────────┬──────┬─────────────────────────────┐
  │ Code               │ Num  │ Description                 │
  ├────────────────────┼──────┼─────────────────────────────┤
  │ OK                 │ 0    │ Success                     │
  │ CANCELLED          │ 1    │ Cancelled by client         │
  │ UNKNOWN            │ 2    │ Unknown error               │
  │ INVALID_ARGUMENT   │ 3    │ Invalid argument            │
  │ DEADLINE_EXCEEDED  │ 4    │ Timeout                     │
  │ NOT_FOUND          │ 5    │ Resource not found          │
  │ ALREADY_EXISTS     │ 6    │ Already exists              │
  │ PERMISSION_DENIED  │ 7    │ No permission               │
  │ RESOURCE_EXHAUSTED │ 8    │ Rate limit exceeded, etc.   │
  │ FAILED_PRECONDITION│ 9    │ Precondition mismatch       │
  │ ABORTED            │ 10   │ Operation aborted (tx, etc) │
  │ OUT_OF_RANGE       │ 11   │ Out-of-range access         │
  │ UNIMPLEMENTED      │ 12   │ Unimplemented RPC           │
  │ INTERNAL           │ 13   │ Internal server error       │
  │ UNAVAILABLE        │ 14   │ Service unavailable         │
  │ DATA_LOSS          │ 15   │ Data loss                   │
  │ UNAUTHENTICATED    │ 16   │ Unauthenticated             │
  └────────────────────┴──────┴─────────────────────────────┘

  Mapping to HTTP status codes:
  ┌──────────────────────┬────────────────────┐
  │ gRPC Code            │ HTTP Status        │
  ├──────────────────────┼────────────────────┤
  │ OK                   │ 200 OK             │
  │ CANCELLED            │ 499 Client Closed  │
  │ UNKNOWN              │ 500 Internal       │
  │ INVALID_ARGUMENT     │ 400 Bad Request    │
  │ DEADLINE_EXCEEDED    │ 504 Gateway Timeout│
  │ NOT_FOUND            │ 404 Not Found      │
  │ ALREADY_EXISTS       │ 409 Conflict       │
  │ PERMISSION_DENIED    │ 403 Forbidden      │
  │ RESOURCE_EXHAUSTED   │ 429 Too Many Req   │
  │ FAILED_PRECONDITION  │ 400 Bad Request    │
  │ ABORTED              │ 409 Conflict       │
  │ OUT_OF_RANGE         │ 400 Bad Request    │
  │ UNIMPLEMENTED        │ 501 Not Implemented│
  │ INTERNAL             │ 500 Internal       │
  │ UNAVAILABLE          │ 503 Unavailable    │
  │ DATA_LOSS            │ 500 Internal       │
  │ UNAUTHENTICATED      │ 401 Unauthorized   │
  └──────────────────────┴────────────────────┘

  Error code selection guide:
  "Invalid argument"       → INVALID_ARGUMENT
  "Not found"              → NOT_FOUND
  "Already exists"         → ALREADY_EXISTS
  "Authentication required"→ UNAUTHENTICATED
  "No permission"          → PERMISSION_DENIED
  "Rate limited"           → RESOURCE_EXHAUSTED
  "Optimistic lock failed" → ABORTED
  "Unimplemented API"      → UNIMPLEMENTED
  "Transient failure"      → UNAVAILABLE (retryable)
  "Internal error"         → INTERNAL (may not be retryable)
```

```go
// === Rich Error Model (google.rpc.Status) ===
// Go implementation example

import (
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func validateAndReturnError(req *pb.CreateUserRequest) error {
	// Field validation errors
	var violations []*errdetails.BadRequest_FieldViolation

	if req.Name == "" {
		violations = append(violations, &errdetails.BadRequest_FieldViolation{
			Field:       "name",
			Description: "Name is required and cannot be empty",
		})
	}

	if !isValidEmail(req.Email) {
		violations = append(violations, &errdetails.BadRequest_FieldViolation{
			Field:       "email",
			Description: "Email must be a valid email address",
		})
	}

	if req.Age < 0 || req.Age > 150 {
		violations = append(violations, &errdetails.BadRequest_FieldViolation{
			Field:       "age",
			Description: "Age must be between 0 and 150",
		})
	}

	if len(violations) > 0 {
		st := status.New(codes.InvalidArgument, "validation failed")

		br := &errdetails.BadRequest{
			FieldViolations: violations,
		}

		st, err := st.WithDetails(br)
		if err != nil {
			return status.Error(codes.Internal, "failed to attach error details")
		}

		return st.Err()
	}

	return nil
}

// Error with retry information
func rateLimitError() error {
	st := status.New(codes.ResourceExhausted, "rate limit exceeded")

	retryInfo := &errdetails.RetryInfo{
		RetryDelay: durationpb.New(30 * time.Second),
	}

	st, _ = st.WithDetails(retryInfo)
	return st.Err()
}

// Error with debug information
func internalErrorWithDebug(err error) error {
	st := status.New(codes.Internal, "internal server error")

	debugInfo := &errdetails.DebugInfo{
		StackEntries: []string{
			"github.com/example/service/handler.go:42",
			"github.com/example/service/main.go:15",
		},
		Detail: err.Error(),
	}

	st, _ = st.WithDetails(debugInfo)
	return st.Err()
}
```

---

## 9. Interceptors (Middleware)

```go
// === Interceptors in Go ===

// Unary server interceptor (logging)
func loggingUnaryInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	start := time.Now()

	// Get metadata
	md, _ := metadata.FromIncomingContext(ctx)
	requestID := ""
	if ids := md.Get("x-request-id"); len(ids) > 0 {
		requestID = ids[0]
	}

	// Execute handler
	resp, err := handler(ctx, req)

	// Log output
	duration := time.Since(start)
	statusCode := codes.OK
	if err != nil {
		statusCode = status.Code(err)
	}

	log.Printf(
		"[%s] %s | %s | %v | %s",
		requestID,
		info.FullMethod,
		statusCode,
		duration,
		err,
	)

	return resp, err
}

// Unary server interceptor (authentication)
func authUnaryInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	// Skip auth for health checks, etc.
	if info.FullMethod == "/grpc.health.v1.Health/Check" {
		return handler(ctx, req)
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing metadata")
	}

	tokens := md.Get("authorization")
	if len(tokens) == 0 {
		return nil, status.Error(codes.Unauthenticated, "missing token")
	}

	token := strings.TrimPrefix(tokens[0], "Bearer ")

	// Validate token
	claims, err := validateToken(token)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
	}

	// Add user info to context
	ctx = context.WithValue(ctx, "user_id", claims.UserID)
	ctx = context.WithValue(ctx, "user_roles", claims.Roles)

	return handler(ctx, req)
}

// Stream server interceptor (logging)
func loggingStreamInterceptor(
	srv interface{},
	ss grpc.ServerStream,
	info *grpc.StreamServerInfo,
	handler grpc.StreamHandler,
) error {
	start := time.Now()

	err := handler(srv, ss)

	duration := time.Since(start)
	statusCode := codes.OK
	if err != nil {
		statusCode = status.Code(err)
	}

	log.Printf(
		"Stream %s | %s | %v",
		info.FullMethod,
		statusCode,
		duration,
	)

	return err
}

// Recovery interceptor (panic recovery)
func recoveryUnaryInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (resp interface{}, err error) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic recovered in %s: %v\n%s",
				info.FullMethod, r, debug.Stack())
			err = status.Errorf(codes.Internal, "internal error")
		}
	}()
	return handler(ctx, req)
}

// Metrics interceptor
func metricsUnaryInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	start := time.Now()

	resp, err := handler(ctx, req)

	duration := time.Since(start)
	statusCode := status.Code(err)

	// Record Prometheus metrics
	grpcRequestsTotal.WithLabelValues(
		info.FullMethod,
		statusCode.String(),
	).Inc()

	grpcRequestDuration.WithLabelValues(
		info.FullMethod,
	).Observe(duration.Seconds())

	return resp, err
}

// Set interceptors at server startup
func main() {
	s := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			recoveryUnaryInterceptor,   // 1st: panic recovery
			loggingUnaryInterceptor,    // 2nd: logging
			metricsUnaryInterceptor,    // 3rd: metrics
			authUnaryInterceptor,       // 4th: authentication
		),
		grpc.ChainStreamInterceptor(
			loggingStreamInterceptor,
		),
	)
	// ...
}
```

```typescript
// === Interceptors in TypeScript ===

// Client-side interceptor (retry)
import * as grpc from '@grpc/grpc-js';

function retryInterceptor(
  options: grpc.InterceptorOptions,
  nextCall: grpc.NextCall,
): grpc.InterceptingCall {
  const maxRetries = 3;
  const retryableStatuses = [
    grpc.status.UNAVAILABLE,
    grpc.status.DEADLINE_EXCEEDED,
    grpc.status.RESOURCE_EXHAUSTED,
  ];

  let retryCount = 0;
  let savedMetadata: grpc.Metadata;
  let savedMessage: any;
  let savedReceiveMessage: any;

  const requester = new grpc.RequesterBuilder()
    .withStart((metadata, listener, next) => {
      savedMetadata = metadata;
      const newListener = new grpc.ListenerBuilder()
        .withOnReceiveStatus((status, next) => {
          if (
            retryableStatuses.includes(status.code) &&
            retryCount < maxRetries
          ) {
            retryCount++;
            const delay = Math.pow(2, retryCount) * 100; // exponential backoff
            console.log(
              `Retrying (${retryCount}/${maxRetries}) after ${delay}ms`,
            );
            setTimeout(() => {
              // Execute retry
              const newCall = nextCall(options);
              newCall.start(savedMetadata, listener);
              newCall.sendMessage(savedMessage);
              newCall.halfClose();
            }, delay);
          } else {
            next(status);
          }
        })
        .build();
      next(metadata, newListener);
    })
    .withSendMessage((message, next) => {
      savedMessage = message;
      next(message);
    })
    .build();

  return new grpc.InterceptingCall(nextCall(options), requester);
}

// Set interceptors on the client
const client = new proto.user.v1.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure(),
  {
    interceptors: [retryInterceptor],
  },
);
```

---

## 10. gRPC-Web and Connect

```
gRPC-Web:
  → Access gRPC server directly from browser
  → Limitation: Unary and Server Streaming only
  → Client Streaming and Bidi Streaming not supported
  → Requires Envoy or gRPC-Web proxy

  Browser ─── gRPC-Web ──→ Envoy Proxy ─── gRPC ──→ gRPC server

  Envoy proxy setup:
  ┌─────────────────────────────────────────┐
  │ Browser                                 │
  │ (gRPC-Web / HTTP/1.1 or HTTP/2)         │
  └────────────┬────────────────────────────┘
               ↓
  ┌─────────────────────────────────────────┐
  │ Envoy Proxy                              │
  │ - gRPC-Web ↔ gRPC translation           │
  │ - Add CORS headers                       │
  │ - TLS termination                        │
  └────────────┬────────────────────────────┘
               ↓
  ┌─────────────────────────────────────────┐
  │ gRPC server (HTTP/2)                    │
  └─────────────────────────────────────────┘

Connect Protocol (new alternative):
  → gRPC-compatible protocol developed by Buf
  → Supports HTTP/1.1, HTTP/2, HTTP/3
  → Browser connects directly without proxy
  → Compatible with gRPC, gRPC-Web, and Connect protocols
  → Testable with curl (JSON support)

  Connect advantages:
  ① No proxy needed
  ② Debuggable with curl
  ③ Streaming support (including Server Streaming)
  ④ Compatible with gRPC servers
  ⑤ Reuse existing Protobuf definitions as-is
```

```typescript
// === gRPC-Web client (browser) ===
// Using @connectrpc/connect-web

import { createConnectTransport } from '@connectrpc/connect-web';
import { createClient } from '@connectrpc/connect';
import { UserService } from './gen/user/v1/user_service_connect';

// Create transport
const transport = createConnectTransport({
  baseUrl: 'https://api.example.com',
  // Use gRPC-Web protocol
  // useBinaryFormat: true,
});

// Create client
const client = createClient(UserService, transport);

// Unary RPC
async function getUser(id: string) {
  try {
    const response = await client.getUser({ id });
    console.log('User:', response.user);
    return response.user;
  } catch (error) {
    if (error instanceof ConnectError) {
      console.error(`Error [${error.code}]: ${error.message}`);
      // Get error details
      for (const detail of error.details) {
        console.error('Detail:', detail);
      }
    }
    throw error;
  }
}

// Server Streaming
async function watchUsers() {
  try {
    for await (const event of client.watchUserUpdates({
      eventTypes: ['created', 'updated'],
    })) {
      console.log(`Event: ${event.eventType}`, event.user);
      // Update UI
      updateUserList(event);
    }
  } catch (error) {
    console.error('Stream error:', error);
  }
}
```

---

## 11. Deadlines and Timeouts

```
Deadline:
  → Absolute expiry time for a request
  → "Cancel if no response by this time"
  → gRPC uses "deadline" rather than "timeout"

  Important: Deadlines propagate across services

  Client                  Service A               Service B
  Deadline: 5s            Remaining: 4.5s         Remaining: 3s
  ─────────────→          ─────────────→          ──────→
                           Process: 0.5s            Process: 1s
                           Remaining: 4.5s          Remaining: 3s
  ←─────────────          ←─────────────          ←──────

  Deadline propagation:
  → Client sets 5-second deadline
  → Service A receives with 4.5s remaining
  → Remaining time propagates to Service B's request
  → Expires anywhere → DEADLINE_EXCEEDED error

Recommended deadline values:
  ┌─────────────────────┬──────────┐
  │ Operation            │ Deadline │
  ├─────────────────────┼──────────┤
  │ Fast lookup          │ 100ms    │
  │ Normal CRUD          │ 1-5s     │
  │ Search / aggregation │ 10-30s   │
  │ Batch processing     │ 60-300s  │
  │ File upload          │ 300-600s │
  └─────────────────────┴──────────┘

  Behavior when deadline expires:
  → Server should abort processing (save resources)
  → Check with ctx.Err()
  → Consider rollback of side effects that already completed
```

```go
// === Deadline implementation (Go) ===

// Client side
func callWithDeadline(client pb.UserServiceClient) error {
	// Set 5-second deadline
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.GetUser(ctx, &pb.GetUserRequest{Id: "123"})
	if err != nil {
		st, ok := status.FromError(err)
		if ok && st.Code() == codes.DeadlineExceeded {
			log.Println("Request timed out!")
			return err
		}
		return err
	}

	log.Printf("User: %v", resp.User)
	return nil
}

// Server side (processing with deadline check)
func (s *userServer) HeavyComputation(
	ctx context.Context,
	req *pb.HeavyRequest,
) (*pb.HeavyResponse, error) {
	results := make([]string, 0)

	for i := 0; i < 1000; i++ {
		// Periodically check deadline
		select {
		case <-ctx.Done():
			// Deadline exceeded or cancelled
			return nil, status.Error(
				codes.DeadlineExceeded,
				"operation canceled due to deadline",
			)
		default:
			// Continue processing
			result := processItem(i)
			results = append(results, result)
		}
	}

	return &pb.HeavyResponse{Results: results}, nil
}
```

---

## 12. Load Balancing and Service Mesh

```
gRPC Load Balancing:

  HTTP/1.1 LB: Distributes per connection → not ideal for gRPC
  gRPC LB:     Distributes per request (RPC) → requires L7 LB

  ① Client-side LB:
     → Client maintains list of servers
     → Executes round-robin, weighted routing, etc. itself
     → Integrates with service discovery (DNS, Consul, etcd)

     Client (with built-in LB logic)
          ↓ ↓ ↓
     Server1  Server2  Server3

  ② Proxy LB (L7):
     → Envoy, Nginx, HAProxy, etc.
     → Distributes per HTTP/2 stream
     → Health check and circuit breaker support

     Client → L7 LB → Server1/2/3

  ③ Service Mesh:
     → Istio, Linkerd, etc.
     → Sidecar proxy handles LB
     → Also integrates mTLS, tracing, rate limiting

     ┌──────────────────────┐
     │ Pod                  │
     │ ┌────────┐ ┌───────┐│
     │ │ App    │→│ Envoy ││──→ other Pods
     │ │(gRPC)  │ │sidecar││
     │ └────────┘ └───────┘│
     └──────────────────────┘

  gRPC LB in Kubernetes:
  → Standard Service is L4 (TCP) LB
  → Not suitable for gRPC (all RPCs concentrate on one connection)
  → Solutions:
     ① Headless Service + client-side LB
     ② Istio / Linkerd (service mesh)
     ③ gRPC-aware Ingress (Envoy, Traefik)

Envoy gRPC load balancing configuration:
  clusters:
  - name: grpc_backend
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    http2_protocol_options: {}
    health_checks:
    - grpc_health_check: {}
      timeout: 5s
      interval: 10s
    load_assignment:
      cluster_name: grpc_backend
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend1
                port_value: 50051
        - endpoint:
            address:
              socket_address:
                address: backend2
                port_value: 50051
```

---

## 13. Health Checks and Reflection

```protobuf
// === gRPC Health Checking Protocol ===
// grpc.health.v1.Health service (standard spec)

// Proto to use:
// grpc/health/v1/health.proto (bundled with gRPC)

service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}

message HealthCheckRequest {
  string service = 1;  // empty string = entire server
}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
    SERVICE_UNKNOWN = 3;
  }
  ServingStatus status = 1;
}
```

```go
// Health check implementation in Go
import (
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func main() {
	s := grpc.NewServer()

	// Register health check server
	healthServer := health.NewServer()
	healthpb.RegisterHealthServer(s, healthServer)

	// Set service status
	healthServer.SetServingStatus(
		"user.v1.UserService",
		healthpb.HealthCheckResponse_SERVING,
	)

	// During maintenance
	// healthServer.SetServingStatus(
	//   "user.v1.UserService",
	//   healthpb.HealthCheckResponse_NOT_SERVING,
	// )

	// gRPC Reflection (for debugging)
	// Allows tools like grpcurl to retrieve service info
	reflection.Register(s)

	// Start server...
}
```

```bash
# === Testing with grpcurl ===

# List services (when Reflection is enabled)
grpcurl -plaintext localhost:50051 list

# List methods of a service
grpcurl -plaintext localhost:50051 list user.v1.UserService

# Describe a method
grpcurl -plaintext localhost:50051 describe user.v1.UserService.GetUser

# Call Unary RPC
grpcurl -plaintext \
  -d '{"id": "123"}' \
  localhost:50051 user.v1.UserService/GetUser

# Call with metadata
grpcurl -plaintext \
  -H 'authorization: Bearer my-token' \
  -H 'x-request-id: test-001' \
  -d '{"name": "Taro", "email": "taro@example.com"}' \
  localhost:50051 user.v1.UserService/CreateUser

# Health check
grpcurl -plaintext localhost:50051 grpc.health.v1.Health/Check

# Health check for a specific service
grpcurl -plaintext \
  -d '{"service": "user.v1.UserService"}' \
  localhost:50051 grpc.health.v1.Health/Check

# Call Server Streaming
grpcurl -plaintext \
  -d '{"page_size": 10}' \
  localhost:50051 user.v1.UserService/ListUsers

# Call specifying proto file (without Reflection)
grpcurl -plaintext \
  -import-path ./proto \
  -proto user/v1/user_service.proto \
  -d '{"id": "123"}' \
  localhost:50051 user.v1.UserService/GetUser
```

---

## 14. Security

```
gRPC Security:

  ① TLS / mTLS:
     → Encrypt communication (TLS)
     → Mutual authentication (mTLS): both client and server hold certificates
     → mTLS is recommended between microservices

  ② Token authentication:
     → Set JWT in Authorization header
     → Send as metadata
     → Validate in interceptor

  ③ API key:
     → Set API key in metadata
     → Mainly used for service-to-service authentication

  mTLS configuration:
  ┌──────────┐    TLS    ┌──────────┐
  │ Client   │ ←──────→  │ Server   │
  │ cert.pem │  mutual   │ cert.pem │
  │ key.pem  │  verify   │ key.pem  │
  └──────────┘           └──────────┘
       ↑                      ↑
       └──── Verified by CA cert ────┘
```

```go
// === TLS configuration (Go) ===

// Server side (TLS)
func startTLSServer() {
	creds, err := credentials.NewServerTLSFromFile(
		"server-cert.pem",
		"server-key.pem",
	)
	if err != nil {
		log.Fatalf("failed to load TLS: %v", err)
	}

	s := grpc.NewServer(grpc.Creds(creds))
	// Register services...
}

// Server side (mTLS)
func startMTLSServer() {
	cert, err := tls.LoadX509KeyPair("server-cert.pem", "server-key.pem")
	if err != nil {
		log.Fatalf("failed to load server cert: %v", err)
	}

	certPool := x509.NewCertPool()
	ca, err := os.ReadFile("ca-cert.pem")
	if err != nil {
		log.Fatalf("failed to load CA cert: %v", err)
	}
	certPool.AppendCertsFromPEM(ca)

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    certPool,
	}

	creds := credentials.NewTLS(tlsConfig)
	s := grpc.NewServer(grpc.Creds(creds))
	// Register services...
}

// Client side (mTLS)
func createMTLSClient() pb.UserServiceClient {
	cert, _ := tls.LoadX509KeyPair("client-cert.pem", "client-key.pem")

	certPool := x509.NewCertPool()
	ca, _ := os.ReadFile("ca-cert.pem")
	certPool.AppendCertsFromPEM(ca)

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      certPool,
	}

	creds := credentials.NewTLS(tlsConfig)
	conn, _ := grpc.Dial("localhost:50051", grpc.WithTransportCredentials(creds))
	return pb.NewUserServiceClient(conn)
}
```

---

## 15. Performance Optimization

```
gRPC Performance Tuning:

  ① Message size:
     → Default maximum: 4MB (send and receive)
     → Large messages: raise size limit
     → Very large data: split into streaming chunks

  ② Keepalive:
     → Maintain connections to reduce handshake cost
     → Set on both client and server
     → Align with load balancer idle timeout

  ③ Connection pooling:
     → Multiplexed over one connection, but use multiple for high CPU load
     → Watch concurrent streams per channel (connection)
     → HTTP/2 default concurrent streams: 100

  ④ Compression:
     → Reduce message size with gzip compression
     → Trade-off between CPU and network bandwidth
     → Effective for text-heavy messages

  ⑤ Batch processing:
     → Send batches instead of many small RPCs
     → Use Client Streaming for sequential sends
     → Use repeated fields for batch requests

Performance comparison (rough benchmarks):
  ┌──────────────────────┬───────────┬───────────┐
  │ Metric               │ REST/JSON │ gRPC      │
  ├──────────────────────┼───────────┼───────────┤
  │ Serialization speed  │ 1x        │ 5-10x     │
  │ Message size         │ 1x        │ 0.3-0.5x  │
  │ Latency              │ 1x        │ 0.5-0.7x  │
  │ Throughput           │ 1x        │ 2-5x      │
  │ CPU usage            │ 1x        │ 0.5-0.8x  │
  └──────────────────────┴───────────┴───────────┘
```

```go
// === Connection pooling and compression (Go) ===

import "google.golang.org/grpc/encoding/gzip"

// Client with gzip compression enabled
func createCompressedClient() pb.UserServiceClient {
	conn, _ := grpc.Dial(
		"localhost:50051",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(
			grpc.UseCompressor(gzip.Name),
		),
	)
	return pb.NewUserServiceClient(conn)
}

// Connection pool (managing multiple connections)
type ClientPool struct {
	clients []pb.UserServiceClient
	conns   []*grpc.ClientConn
	mu      sync.Mutex
	next    int
}

func NewClientPool(address string, size int) (*ClientPool, error) {
	pool := &ClientPool{
		clients: make([]pb.UserServiceClient, size),
		conns:   make([]*grpc.ClientConn, size),
	}

	for i := 0; i < size; i++ {
		conn, err := grpc.Dial(address,
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		)
		if err != nil {
			pool.Close()
			return nil, err
		}
		pool.conns[i] = conn
		pool.clients[i] = pb.NewUserServiceClient(conn)
	}

	return pool, nil
}

func (p *ClientPool) GetClient() pb.UserServiceClient {
	p.mu.Lock()
	defer p.mu.Unlock()

	client := p.clients[p.next]
	p.next = (p.next + 1) % len(p.clients)
	return client
}

func (p *ClientPool) Close() {
	for _, conn := range p.conns {
		if conn != nil {
			conn.Close()
		}
	}
}
```

---

## 16. Testing

```go
// === Testing gRPC server (Go) ===

import (
	"testing"
	"google.golang.org/grpc/test/bufconn"
)

const bufSize = 1024 * 1024

func setupTestServer(t *testing.T) (pb.UserServiceClient, func()) {
	lis := bufconn.Listen(bufSize)

	s := grpc.NewServer()
	pb.RegisterUserServiceServer(s, newUserServer())

	go func() {
		if err := s.Serve(lis); err != nil {
			t.Fatalf("server exited with error: %v", err)
		}
	}()

	// In-memory connection using bufconn
	conn, err := grpc.DialContext(
		context.Background(),
		"bufnet",
		grpc.WithContextDialer(func(ctx context.Context, s string) (net.Conn, error) {
			return lis.Dial()
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}

	client := pb.NewUserServiceClient(conn)

	cleanup := func() {
		conn.Close()
		s.Stop()
	}

	return client, cleanup
}

func TestGetUser(t *testing.T) {
	client, cleanup := setupTestServer(t)
	defer cleanup()

	ctx := context.Background()

	// First create a user
	createResp, err := client.CreateUser(ctx, &pb.CreateUserRequest{
		Name:  "Test User",
		Email: "test@example.com",
		Age:   25,
	})
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Get the created user
	getResp, err := client.GetUser(ctx, &pb.GetUserRequest{
		Id: createResp.User.Id,
	})
	if err != nil {
		t.Fatalf("GetUser failed: %v", err)
	}

	if getResp.User.Name != "Test User" {
		t.Errorf("expected name 'Test User', got '%s'", getResp.User.Name)
	}
}

func TestGetUser_NotFound(t *testing.T) {
	client, cleanup := setupTestServer(t)
	defer cleanup()

	_, err := client.GetUser(context.Background(), &pb.GetUserRequest{
		Id: "nonexistent-id",
	})

	if err == nil {
		t.Fatal("expected error, got nil")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatal("expected gRPC status error")
	}

	if st.Code() != codes.NotFound {
		t.Errorf("expected NOT_FOUND, got %v", st.Code())
	}
}

func TestListUsers_Streaming(t *testing.T) {
	client, cleanup := setupTestServer(t)
	defer cleanup()

	ctx := context.Background()

	// Create test data
	for i := 0; i < 5; i++ {
		client.CreateUser(ctx, &pb.CreateUserRequest{
			Name:  fmt.Sprintf("User %d", i),
			Email: fmt.Sprintf("user%d@example.com", i),
		})
	}

	// Retrieve via streaming
	stream, err := client.ListUsers(ctx, &pb.ListUsersRequest{
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("ListUsers failed: %v", err)
	}

	var users []*pb.User
	for {
		user, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("stream recv error: %v", err)
		}
		users = append(users, user)
	}

	if len(users) != 5 {
		t.Errorf("expected 5 users, got %d", len(users))
	}
}
```

---

## 17. gRPC Adoption Criteria

```
When gRPC is a good fit:
  ✓ Service-to-service communication (internal APIs)
  ✓ Low latency is critical
  ✓ Type safety is required
  ✓ Streaming is needed
  ✓ Polyglot environment (unified code generation)
  ✓ High throughput is required
  ✓ Manage Protocol definitions as IDL
  ✓ Efficient transfer of binary data

When REST is a good fit:
  ✓ Public APIs
  ✓ Direct browser access
  ✓ Simple CRUD
  ✓ Readability and debuggability are priorities
  ✓ Caching (CDN, etc.)
  ✓ Third-party integrations
  ✓ Published documentation

When GraphQL is a good fit:
  ✓ Frontend needs flexible data fetching
  ✓ Multiple resources in one request
  ✓ Client-driven data fetching patterns

Hybrid architecture (recommended pattern):
  External → REST API Gateway → Internal gRPC microservices

  Browser/Mobile
       ↓ REST/GraphQL
  API Gateway (REST ↔ gRPC translation)
       ↓ gRPC
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ User    │←→│ Order   │←→│ Payment │
  │ Service │  │ Service │  │ Service │
  └─────────┘  └─────────┘  └─────────┘
                  ↕ gRPC
              ┌─────────┐
              │Inventory│
              │ Service │
              └─────────┘

  Adoption patterns in real companies:
  ┌──────────┬──────────────┬──────────────────────┐
  │ Layer    │ Protocol     │ Reason               │
  ├──────────┼──────────────┼──────────────────────┤
  │ External │ REST         │ Versatile, documented│
  │ BFF      │ GraphQL      │ Frontend-optimized   │
  │ Internal │ gRPC         │ Fast, type-safe      │
  │ Events   │ Kafka/NATS   │ Async, decoupled     │
  │ Realtime │ WebSocket    │ Browser bidirectional│
  └──────────┴──────────────┴──────────────────────┘

Migration strategy (REST → gRPC):
  Phase 1: Build new services with gRPC
  Phase 2: REST ↔ gRPC translation at API Gateway
  Phase 3: Gradually migrate internal communication to gRPC
  Phase 4: Keep public APIs as REST

  Key points:
  → Migrate incrementally, not all at once
  → Design for REST and gRPC coexistence
  → Set up version management for Proto definitions
  → Add Proto lint/breaking checks to CI/CD
```

---

## 18. Buf (Proto Management Tool)

```yaml
# buf.yaml — Buf configuration file
version: v2
modules:
  - path: proto
    name: buf.build/example/user
lint:
  use:
    - DEFAULT
  except:
    - PACKAGE_VERSION_SUFFIX
breaking:
  use:
    - FILE
  except:
    - EXTENSION_NO_DELETE

# buf.gen.yaml — Code generation settings
version: v2
managed:
  enabled: true
  override:
    - file_option: go_package_prefix
      value: github.com/example/gen
plugins:
  - remote: buf.build/protocolbuffers/go
    out: gen/go
    opt:
      - paths=source_relative
  - remote: buf.build/grpc/go
    out: gen/go
    opt:
      - paths=source_relative
  - remote: buf.build/connectrpc/go
    out: gen/go
    opt:
      - paths=source_relative
  - remote: buf.build/connectrpc/es
    out: gen/ts
```

```bash
# Main Buf commands

# Lint check proto files
buf lint

# Detect breaking changes
buf breaking --against '.git#branch=main'

# Generate code
buf generate

# Format proto files
buf format -w

# Update dependencies
buf dep update

# Push to BSR (Buf Schema Registry)
buf push
```

---

## 19. FAQ (Frequently Asked Questions)

### Q1: How should I choose between gRPC and REST API?

**Comparison table**

| Aspect | gRPC | REST API |
|--------|------|----------|
| **Serialization** | Protocol Buffers (binary) | JSON (text) |
| **Performance** | Fast (binary, HTTP/2) | Slower (text, HTTP/1.1) |
| **Schema definition** | .proto file (required) | OpenAPI (optional) |
| **Streaming** | 4 native streaming types | Limited (SSE, chunked transfer) |
| **Browser support** | Requires gRPC-Web | Native support |
| **Human readability** | Not readable (binary) | Easy (JSON) |
| **Ecosystem** | Go, Java-centric | Nearly all languages |
| **Learning curve** | Steep (Protobuf, HTTP/2) | Gentle |
| **Caching** | Complex (HTTP/2 constraints) | HTTP caching mechanisms available |

**Decision criteria**

**When to choose gRPC**
```
✅ Service-to-service communication (internal APIs)
   - Low latency is critical
   - Strict type safety required
   - Polyglot environment (unified via code generation)

✅ Bidirectional streaming required
   - Chat, real-time data feeds
   - Two-way communication with IoT devices

✅ High-frequency, high-volume communication
   - Efficient via HTTP/2 multiplexing
   - Reduced payload size with binary format

Examples: Kubernetes API Server, Netflix internal APIs, Uber internal services
```

**When to choose REST**
```
✅ Public APIs (external-facing)
   - Direct browser calls needed
   - Easy to test with curl
   - Wide ecosystem (API Gateway, CDN)

✅ Simple CRUD operations
   - HTTP methods (GET, POST, PUT, DELETE) are sufficient
   - HTTP status codes are intuitive

✅ Caching strategy is important
   - Leverage CDN, browser cache
   - ETag, Cache-Control headers

Examples: GitHub API, Stripe API, Twilio API
```

**Hybrid approach**
```
Internal communication: gRPC (between microservices)
External-facing: REST (for clients)
Translation layer: Envoy, gRPC-Gateway for bridging
```

### Q2: What is the state of browser support for gRPC (gRPC-Web)?

**Problem: Browsers do not natively support gRPC**

Browser constraints:
- Cannot fully control HTTP/2 (Fetch API is HTTP/1.1 equivalent)
- Cannot send Trailer headers
- Cannot use custom frame types (gRPC-specific)

**Solution 1: gRPC-Web (official protocol)**

```
Browser ──→ gRPC-Web ──→ Envoy Proxy ──→ gRPC server
            (HTTP/1.1)    (translation)   (HTTP/2)
```

**Implementation example**

```javascript
// Client (browser)
import { UserServiceClient } from './gen/user_grpc_web_pb';

const client = new UserServiceClient('https://api.example.com');

const request = new GetUserRequest();
request.setUserId('123');

client.getUser(request, {}, (err, response) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('User:', response.toObject());
  }
});
```

```yaml
# Envoy configuration (gRPC-Web → gRPC translation)
static_resources:
  listeners:
    - address:
        socket_address:
          address: 0.0.0.0
          port_value: 8080
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                codec_type: AUTO
                http_filters:
                  - name: envoy.filters.http.grpc_web  # gRPC-Web translation
                  - name: envoy.filters.http.cors
                  - name: envoy.filters.http.router
                route_config:
                  virtual_hosts:
                    - domains: ["*"]
                      routes:
                        - match: { prefix: "/" }
                          route:
                            cluster: grpc_backend
                            timeout: 30s
  clusters:
    - name: grpc_backend
      type: LOGICAL_DNS
      http2_protocol_options: {}  # Enable HTTP/2
      load_assignment:
        cluster_name: grpc_backend
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: grpc-server
                      port_value: 50051
```

**Solution 2: Connect (newer approach)**

```javascript
// Connect: lighter than gRPC-Web, no Envoy needed
import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { UserService } from "./gen/user_connect";

const transport = createConnectTransport({
  baseUrl: "https://api.example.com",
});

const client = createPromiseClient(UserService, transport);

const response = await client.getUser({ userId: "123" });
console.log(response);
```

**gRPC-Web vs Connect**

| Feature | gRPC-Web | Connect |
|---------|----------|---------|
| Proxy required | **Envoy required** | Not needed (server-native) |
| Protocol | Custom (application/grpc-web) | HTTP/JSON compatible |
| Streaming | Server-side only | Unary + Server-side |
| Browser compatibility | All modern browsers | All modern browsers |
| Ecosystem | Mature (since 2018) | Newer (since 2022) |

### Q3: How do I choose among the 4 gRPC streaming patterns?

**1. Unary RPC (1 request → 1 response)**

```protobuf
rpc GetUser(GetUserRequest) returns (GetUserResponse);
```

**Use case**: Normal RPC call (equivalent to REST GET)

```go
// Server implementation
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserResponse, error) {
    user := s.db.FindUserByID(req.UserId)
    return &pb.GetUserResponse{User: user}, nil
}
```

**2. Server Streaming RPC (1 request → multiple responses)**

```protobuf
rpc ListUsers(ListUsersRequest) returns (stream User);
```

**Use case**: Paginated delivery of large data sets, real-time notifications

```go
// Server implementation
func (s *server) ListUsers(req *pb.ListUsersRequest, stream pb.UserService_ListUsersServer) error {
    users := s.db.GetAllUsers()
    for _, user := range users {
        if err := stream.Send(user); err != nil {
            return err
        }
    }
    return nil
}

// Client implementation
stream, err := client.ListUsers(ctx, &pb.ListUsersRequest{})
for {
    user, err := stream.Recv()
    if err == io.EOF {
        break
    }
    fmt.Println(user)
}
```

**Real-world examples**:
- File download (chunked)
- Log streaming
- Real-time stock/exchange rate feeds

**3. Client Streaming RPC (multiple requests → 1 response)**

```protobuf
rpc UploadFile(stream FileChunk) returns (UploadResponse);
```

**Use case**: Uploading large data, batch processing

```go
// Client implementation
stream, err := client.UploadFile(ctx)
file, _ := os.Open("large-file.dat")
buf := make([]byte, 1024*64) // 64KB chunk

for {
    n, err := file.Read(buf)
    if err == io.EOF {
        break
    }
    stream.Send(&pb.FileChunk{Data: buf[:n]})
}

response, err := stream.CloseAndRecv()
fmt.Println("Upload complete:", response.FileId)
```

**Real-world examples**:
- File upload
- Metrics aggregation (multiple data points → aggregated result)
- Bulk insert

**4. Bidirectional Streaming RPC (multiple requests ↔ multiple responses)**

```protobuf
rpc Chat(stream ChatMessage) returns (stream ChatMessage);
```

**Use case**: Bidirectional real-time communication

```go
// Server implementation
func (s *server) Chat(stream pb.ChatService_ChatServer) error {
    for {
        msg, err := stream.Recv()
        if err == io.EOF {
            return nil
        }
        // Broadcast to all connected clients
        s.broadcast(msg)
    }
}

// Client implementation
stream, err := client.Chat(ctx)

// Send goroutine
go func() {
    for msg := range msgChan {
        stream.Send(msg)
    }
}()

// Receive goroutine
for {
    msg, err := stream.Recv()
    if err == io.EOF {
        break
    }
    fmt.Println("Received:", msg)
}
```

**Real-world examples**:
- Chat applications
- Real-time game communication
- Voice/video call signaling

**Selection flowchart**
```
Question: Does the data exchange complete in a single round-trip?
  Yes → Unary RPC

  No → Is the primary flow server → client data delivery?
    Yes → Server Streaming RPC

    No → Is the primary flow client → server data sending?
      Yes → Client Streaming RPC

      No → Is simultaneous bidirectional communication needed?
        Yes → Bidirectional Streaming RPC
```

---

## FAQ

### Q1: How should I choose between gRPC and REST API?
gRPC is ideal for internal service-to-service communication. Key benefits include type safety via Protocol Buffers, high throughput from HTTP/2 multiplexing, native streaming support, and automatic code generation. REST is better suited for public-facing APIs and direct browser access. gRPC has no native browser support and requires a proxy such as gRPC-Web or Connect RPC. In practice, a common pattern is to use an API gateway for REST↔gRPC translation: REST externally, gRPC internally.

### Q2: How do I maintain backward compatibility when changing Protocol Buffers schemas?
Protocol Buffers has built-in versioning through field numbers. Three rules for backward compatibility: (1) Never change the number or type of an existing field. (2) Add new fields with new numbers (old clients simply ignore unknown fields). (3) When removing a field, reserve its number with `reserved` to prevent future reuse. The Buf tool's `buf breaking` command can automatically detect breaking changes in your CI/CD pipeline.

### Q3: How do I choose among the four gRPC streaming patterns?
Unary RPC (1:1) is the most commonly used pattern for normal request/response cycles. Server Streaming (1:N) is used for continuous server-to-client data delivery (log streaming, incremental search results, etc.). Client Streaming (N:1) suits large data uploads from the client (file uploads, sensor data collection, etc.). Bidirectional Streaming (N:N) is used for chat, real-time sync, and interactive processing pipelines. The recommended approach is to start with Unary and expand to a streaming pattern only when the requirements demand it.

---

## Summary

| Concept | Key Points |
|---------|-----------|
| gRPC | High-performance RPC framework using HTTP/2 + Protobuf |
| Protocol Buffers | Binary serialization, 1/3 the size of JSON |
| Streaming | 4 types: Unary, Server, Client, Bidirectional |
| Interceptors | Middleware for logging, authentication, metrics, etc. |
| Error handling | 16 status codes + Rich Error Model |
| Deadline | Propagated timeouts prevent cascading failures |
| Security | TLS/mTLS + token authentication |
| gRPC-Web/Connect | gRPC access from browsers |
| Use case | Best for microservice communication; combine with REST externally |
| Buf | Proto management, lint, breaking change detection |

---

## Further Reading

**Protocol deep-dives**

**Implementation and Security**

**Operations and Monitoring**

---

## References
1. gRPC Documentation. "Introduction to gRPC." grpc.io, 2024.
2. Google. "Protocol Buffers Language Guide." protobuf.dev, 2024.
3. gRPC. "gRPC Health Checking Protocol." github.com/grpc, 2024.
4. Buf. "Buf CLI Documentation." buf.build, 2024.
5. Connect. "Connect Protocol Specification." connectrpc.com, 2024.
6. CNCF. "gRPC in Cloud Native Architecture." cncf.io, 2024.
7. Google. "gRPC Error Handling." grpc.io/docs/guides/error, 2024.
8. Envoy Proxy. "gRPC Bridging." envoyproxy.io, 2024.
