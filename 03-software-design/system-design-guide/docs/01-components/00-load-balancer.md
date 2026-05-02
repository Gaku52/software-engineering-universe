# Load Balancer

> Understand how load balancers distribute traffic across multiple servers, and learn the differences between L4/L7, distribution algorithms, and health check strategies.

## What You Will Learn

1. How L4 (Transport Layer) and L7 (Application Layer) load balancers work and when to use each
2. Implementation and characteristics of major load balancing algorithms (Round Robin, Weighted, Least Connections, Consistent Hashing)
3. Health check design patterns (Active/Passive) and failover
4. Global load balancing and multi-region architecture design
5. Load balancing considerations for modern protocols such as gRPC and WebSocket

---

## Prerequisites

| Topic | Content | Reference Guide |
|---------|------|-----------|
| TCP/IP Basics | OSI reference model, differences between TCP and UDP | Network Fundamentals |
| HTTP/HTTPS | HTTP methods, status codes, TLS | Web Fundamentals |
| Scalability | Concepts of horizontal and vertical scaling | [Scalability](../00-fundamentals/01-scalability.md) |
| Availability | Redundancy, basics of eliminating SPOFs | [Reliability](../00-fundamentals/02-reliability.md) |
| DNS | How name resolution works, record types | Network Fundamentals |

---

## Why Study Load Balancers

Load balancers are one of the **most fundamental infrastructure components** in modern distributed systems. Every large-scale web service uses load balancers to handle traffic that a single server cannot process on its own.

**Business Impact:**
- **Availability**: Automatically reroutes traffic to healthy servers when a server fails (zero downtime)
- **Scalability**: Processing capacity scales linearly simply by adding backend servers
- **Latency**: Equalizes response time by routing to the least loaded server
- **Security**: Hides backend server IP addresses and helps mitigate DDoS attacks

**Real-World Examples:**
- Google processes hundreds of thousands of requests per second via its global LB
- Netflix distributes traffic across thousands of microservice instances
- AWS ELB (Elastic Load Balancing) is the foundational infrastructure for all AWS services

---

## 1. What Is a Load Balancer

A load balancer (LB) is a component that **distributes requests from clients across multiple backend servers**. Its goals are: (1) improved throughput, (2) ensured availability (service continues even if one server fails), and (3) equalized latency.

### ASCII Diagram 1: Basic Load Balancer Placement

```
  Clients
  ┌───┐ ┌───┐ ┌───┐ ┌───┐
  │ C1│ │ C2│ │ C3│ │ C4│
  └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘
    │      │      │      │
    └──────┴──┬───┴──────┘
              │
     ┌────────▼────────┐
     │  Load Balancer  │  ← Single entry point
     │  (VIP: 1.2.3.4) │     Exposed via Virtual IP
     └──┬─────┬─────┬──┘
        │     │     │
   ┌────▼┐ ┌─▼───┐ ┌▼────┐
   │ Srv │ │ Srv │ │ Srv │  ← Backend pool
   │  1  │ │  2  │ │  3  │
   │:8080│ │:8080│ │:8080│
   └─────┘ └─────┘ └─────┘
```

### Key Functions of a Load Balancer

```
┌──────────────────────────────────────────────┐
│         Load Balancer Feature List           │
├──────────────────────────────────────────────┤
│ 1. Traffic Distribution  - Route requests to multiple servers      │
│ 2. Health Checks         - Auto-detect and remove unhealthy servers │
│ 3. SSL/TLS Termination   - Centralized encryption/decryption        │
│ 4. Session Persistence   - Maintain continuous connections per client│
│ 5. Rate Limiting         - Control excessive requests               │
│ 6. Content Routing       - Route by URL path/header                 │
│ 7. DDoS Mitigation       - Filter malicious traffic                 │
│ 8. Compression & Caching - Optimize responses                       │
└──────────────────────────────────────────────┘
```

---

## 2. L4 vs L7 Load Balancers

### ASCII Diagram 2: OSI Reference Model and LB Operating Layers

```
  OSI Layer    L4 LB         L7 LB
  ─────────────────────────────────────
  7 Application              ✓ HTTP/HTTPS
  6 Presentation             ✓ SSL termination
  5 Session                  ✓ Cookie
  4 Transport   ✓ TCP/UDP
  3 Network     ✓ IP
  2 Data Link
  1 Physical

  L4: Routes based on IP + port number only
      → Fast, low latency, protocol-agnostic

  L7: Parses HTTP headers, URL, and Cookies to route
      → Flexible, content-based routing, SSL termination
```

### L4 Load Balancer Traffic Flow

```
  Client (10.0.0.5:54321)
     │
     │ SYN packet (DST: VIP:443)
     ▼
  ┌────────────────────┐
  │  L4 Load Balancer  │
  │  - Inspects IP/Port only │
  │  - Does not parse payload│
  │  - Forwards via NAT/DSR  │
  └─────────┬──────────┘
            │
     ┌──────┼──────┐
     │      │      │
     ▼      ▼      ▼
   Srv1   Srv2   Srv3
   (TCP connection established as-is)

  Forwarding Methods:
  ┌─────────────────────────────────────────┐
  │ NAT (Network Address Translation)       │
  │  - Rewrites DST IP/Port and forwards    │
  │  - Responses also go through LB (watch for bottleneck) │
  ├─────────────────────────────────────────┤
  │ DSR (Direct Server Return)              │
  │  - Responses go directly to client, bypassing LB │
  │  - High throughput (useful for video delivery)   │
  ├─────────────────────────────────────────┤
  │ IP Tunneling (IPIP)                     │
  │  - Encapsulates IP packets and forwards to backend │
  │  - Variant of DSR, useful for remote DC forwarding │
  └─────────────────────────────────────────┘
```

### Code Example 1: L7 Routing Rules (Nginx-style Configuration)

```nginx
# Example L7 load balancer configuration

# Define backend pools
upstream api_servers {
    least_conn;                    # Least connections algorithm
    server api1.internal:8080 weight=3;  # High-spec server
    server api2.internal:8080 weight=1;  # Low-spec server
    server api3.internal:8080 weight=1;
    server api4.internal:8080 backup;    # Backup server
}

upstream static_servers {
    server static1.internal:80;
    server static2.internal:80;
}

# gRPC backend pool
upstream grpc_servers {
    least_conn;
    server grpc1.internal:50051;
    server grpc2.internal:50051;
}

server {
    listen 443 ssl http2;   # Enable HTTP/2
    server_name example.com;

    # SSL termination (key role of L7 LB)
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Path-based routing
    location /api/ {
        proxy_pass http://api_servers;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;

        # Timeout settings
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_send_timeout 10s;
    }

    location /static/ {
        proxy_pass http://static_servers;
        expires 30d;  # Add cache headers
        add_header Cache-Control "public, immutable";
    }

    # gRPC routing
    location /grpc/ {
        grpc_pass grpc://grpc_servers;
        grpc_set_header X-Real-IP $remote_addr;
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;  # Long timeout for WebSocket
    }

    # Header-based routing (canary release)
    location /api/v2/ {
        if ($http_x_canary = "true") {
            proxy_pass http://canary_servers;
        }
        proxy_pass http://api_servers;
    }
}
```

### Code Example 2: L4 Load Balancer Implementation (Simplified)

```python
import socket
import threading
import itertools
import time
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class Backend:
    """Backend server information"""
    host: str
    port: int
    healthy: bool = True
    active_connections: int = 0
    total_requests: int = 0
    total_errors: int = 0
    last_health_check: float = 0.0

    @property
    def address(self) -> tuple[str, int]:
        return (self.host, self.port)

    @property
    def error_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.total_errors / self.total_requests


class L4LoadBalancer:
    """Simple implementation of an L4 (TCP) load balancer

    Features:
    - Load distribution via round robin
    - Passive health checks (error rate monitoring)
    - Connection count tracking
    - Graceful shutdown
    """

    def __init__(self, listen_port: int, backends: list[Backend],
                 max_connections: int = 1024):
        self.listen_port = listen_port
        self.backends = backends
        self.max_connections = max_connections
        self._backend_index = 0
        self._lock = threading.Lock()
        self._active = True
        self._connection_count = 0

    def get_next_backend(self) -> Optional[Backend]:
        """Select the next healthy backend via round robin"""
        with self._lock:
            healthy_backends = [b for b in self.backends if b.healthy]
            if not healthy_backends:
                return None
            backend = healthy_backends[self._backend_index % len(healthy_backends)]
            self._backend_index += 1
            return backend

    def handle_connection(self, client_sock: socket.socket,
                         client_addr: tuple[str, int]):
        """Forward client connection to a backend"""
        backend = self.get_next_backend()
        if backend is None:
            print(f"[ERROR] No healthy backends available for {client_addr}")
            client_sock.close()
            return

        backend.active_connections += 1
        backend.total_requests += 1
        print(f"[ROUTE] {client_addr} → {backend.host}:{backend.port} "
              f"(active: {backend.active_connections})")

        try:
            backend_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            backend_sock.settimeout(5.0)  # Connection timeout
            backend_sock.connect(backend.address)

            # Bidirectional proxy (transparent TCP forwarding)
            def forward(src, dst, label):
                try:
                    while self._active:
                        data = src.recv(4096)
                        if not data:
                            break
                        dst.sendall(data)
                except (socket.error, OSError):
                    pass
                finally:
                    try:
                        src.close()
                    except OSError:
                        pass
                    try:
                        dst.close()
                    except OSError:
                        pass

            t1 = threading.Thread(target=forward,
                                  args=(client_sock, backend_sock, "C→B"))
            t2 = threading.Thread(target=forward,
                                  args=(backend_sock, client_sock, "B→C"))
            t1.start()
            t2.start()
            t1.join()
            t2.join()

        except (socket.error, OSError) as e:
            backend.total_errors += 1
            print(f"[ERROR] Backend {backend.host}:{backend.port}: {e}")
            # Passive health check: mark unhealthy if error rate exceeds 50%
            if backend.error_rate > 0.5 and backend.total_requests >= 10:
                backend.healthy = False
                print(f"[HEALTH] {backend.host}:{backend.port} → UNHEALTHY "
                      f"(error_rate: {backend.error_rate:.1%})")
            client_sock.close()
        finally:
            backend.active_connections -= 1

    def start(self):
        """Start the LB and begin listening for requests"""
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(("0.0.0.0", self.listen_port))
        server.listen(128)
        print(f"[START] L4 LB listening on :{self.listen_port}")
        print(f"[INFO] Backends: {[(b.host, b.port) for b in self.backends]}")

        try:
            while self._active:
                client_sock, addr = server.accept()
                if self._connection_count >= self.max_connections:
                    print(f"[REJECT] Max connections reached: {addr}")
                    client_sock.close()
                    continue
                self._connection_count += 1
                threading.Thread(
                    target=self._wrapped_handle,
                    args=(client_sock, addr),
                    daemon=True
                ).start()
        except KeyboardInterrupt:
            print("[SHUTDOWN] Graceful shutdown initiated...")
            self._active = False
        finally:
            server.close()

    def _wrapped_handle(self, client_sock, addr):
        try:
            self.handle_connection(client_sock, addr)
        finally:
            self._connection_count -= 1

    def get_stats(self) -> dict:
        """Get current statistics"""
        return {
            "active_connections": self._connection_count,
            "backends": [
                {
                    "address": f"{b.host}:{b.port}",
                    "healthy": b.healthy,
                    "active_connections": b.active_connections,
                    "total_requests": b.total_requests,
                    "error_rate": f"{b.error_rate:.1%}"
                }
                for b in self.backends
            ]
        }


# Example usage
if __name__ == "__main__":
    backends = [
        Backend("server1.internal", 8080),
        Backend("server2.internal", 8080),
        Backend("server3.internal", 8080),
    ]
    lb = L4LoadBalancer(listen_port=443, backends=backends)
    lb.start()
```

---

## 3. Load Balancing Algorithms

### ASCII Diagram 3: How Each Algorithm Works

```
■ Round Robin: Distribute one at a time in order
  R1→S1, R2→S2, R3→S3, R4→S1, R5→S2, R6→S3 ...

■ Weighted Round Robin: Ratio based on server performance
  S1(weight=3): ●●●
  S2(weight=1): ●
  S3(weight=1): ●
  R1→S1, R2→S1, R3→S1, R4→S2, R5→S3, R6→S1 ...

■ Least Connections: Route to server with fewest active connections
  S1: ■■■■ (4 connections)
  S2: ■■ (2 connections)    ← next request goes here
  S3: ■■■ (3 connections)

■ IP Hash: Same client IP always goes to the same server
  hash(10.0.0.1) % 3 = 0 → S1
  hash(10.0.0.2) % 3 = 2 → S3
  hash(10.0.0.1) % 3 = 0 → S1 (same)

■ Consistent Hashing: Route to nearest node on the hash ring
       S1
      / \
    /     \
  S3 ─── S2   key → nearest server clockwise on the ring
```

### Code Example 3: Implementation of Major Algorithms

```python
import hashlib
import random
import time
from collections import defaultdict
from bisect import bisect_right
from dataclasses import dataclass
from typing import Optional

@dataclass
class Server:
    """Backend server"""
    name: str
    weight: int = 1
    active_connections: int = 0
    response_time_ms: float = 0.0  # Average response time

    def __repr__(self):
        return self.name


class LoadBalancerAlgorithms:
    """Collection of major load balancing algorithm implementations"""

    def __init__(self, servers: list[Server]):
        self.servers = servers
        self.rr_index = 0

    # 1. Round Robin
    def round_robin(self) -> Server:
        """Distribute equally to each server. Simplest approach."""
        server = self.servers[self.rr_index % len(self.servers)]
        self.rr_index += 1
        return server

    # 2. Weighted Round Robin
    def weighted_round_robin(self) -> Server:
        """Weighted distribution based on server performance differences"""
        pool = []
        for server in self.servers:
            pool.extend([server] * server.weight)
        server = pool[self.rr_index % len(pool)]
        self.rr_index += 1
        return server

    # 3. Least Connections
    def least_connections(self) -> Server:
        """Select the server with the fewest active connections"""
        return min(self.servers, key=lambda s: s.active_connections)

    # 4. Weighted Least Connections
    def weighted_least_connections(self) -> Server:
        """Select the server with the smallest connections / weight ratio"""
        return min(self.servers,
                   key=lambda s: s.active_connections / max(s.weight, 1))

    # 5. IP Hash
    def ip_hash(self, client_ip: str) -> Server:
        """Same IP always routes to the same server (session affinity)"""
        hash_val = int(hashlib.md5(client_ip.encode()).hexdigest(), 16)
        return self.servers[hash_val % len(self.servers)]

    # 6. Least Response Time
    def least_response_time(self) -> Server:
        """Select the server with the shortest average response time"""
        return min(self.servers, key=lambda s: s.response_time_ms)

    # 7. Random
    def random_select(self) -> Server:
        """Select randomly. Statistically approaches even distribution with many servers."""
        return random.choice(self.servers)

    # 8. Power of Two Choices (P2C)
    def power_of_two_choices(self) -> Server:
        """Randomly pick two servers and select the one with fewer connections.
        More balanced than pure random, less costly than full scan.
        Used by Nginx and Envoy."""
        if len(self.servers) < 2:
            return self.servers[0]
        s1, s2 = random.sample(self.servers, 2)
        return s1 if s1.active_connections <= s2.active_connections else s2


# === Demo ===
servers = [
    Server("srv1", weight=3, active_connections=5, response_time_ms=10.0),
    Server("srv2", weight=1, active_connections=2, response_time_ms=25.0),
    Server("srv3", weight=1, active_connections=8, response_time_ms=15.0),
]
lb = LoadBalancerAlgorithms(servers)

print("=== Round Robin ===")
for _ in range(6):
    print(f"  → {lb.round_robin()}")
# Output:
#   → srv1
#   → srv2
#   → srv3
#   → srv1
#   → srv2
#   → srv3

print("\n=== Weighted Round Robin (srv1:3, srv2:1, srv3:1) ===")
lb.rr_index = 0
for _ in range(5):
    print(f"  → {lb.weighted_round_robin()}")
# Output:
#   → srv1
#   → srv1
#   → srv1
#   → srv2
#   → srv3

print("\n=== Least Connections ===")
print(f"  → {lb.least_connections()}")  # srv2 (2 connections)

print("\n=== IP Hash ===")
for ip in ["10.0.0.1", "10.0.0.2", "10.0.0.1"]:
    print(f"  {ip} → {lb.ip_hash(ip)}")
# 10.0.0.1 → same server (idempotent)

print("\n=== Power of Two Choices ===")
random.seed(42)
for _ in range(5):
    print(f"  → {lb.power_of_two_choices()}")
```

### Code Example 4: Consistent Hashing

```python
import hashlib
from bisect import bisect_right
from collections import Counter

class ConsistentHash:
    """
    Consistent Hashing
    Minimizes the number of keys remapped when servers are added/removed

    Virtual nodes: Assign multiple hash values to each physical server
    to achieve uniform distribution on the ring. Too few virtual nodes
    leads to skew.

    Typical virtual node counts:
    - 50: ~10% std dev → development/test environments
    - 150: ~5% std dev → production (recommended)
    - 500: ~2% std dev → when high precision is needed
    """

    def __init__(self, virtual_nodes: int = 150):
        self.virtual_nodes = virtual_nodes
        self.ring: list[int] = []           # Sorted hash values
        self.ring_map: dict[int, str] = {}  # hash value → real server
        self.servers: set[str] = set()

    def _hash(self, key: str) -> int:
        """SHA-256-based hash function (more uniform distribution than MD5)"""
        return int(hashlib.sha256(key.encode()).hexdigest(), 16)

    def add_server(self, server: str):
        """Add server: place virtual nodes on the ring"""
        self.servers.add(server)
        for i in range(self.virtual_nodes):
            vnode_key = f"{server}#vn{i}"
            h = self._hash(vnode_key)
            self.ring.append(h)
            self.ring_map[h] = server
        self.ring.sort()
        print(f"[ADD] {server} ({self.virtual_nodes} vnodes, "
              f"ring size: {len(self.ring)})")

    def remove_server(self, server: str):
        """Remove server: remove virtual nodes from the ring"""
        self.servers.discard(server)
        self.ring = [h for h in self.ring
                     if self.ring_map.get(h) != server]
        self.ring_map = {h: s for h, s in self.ring_map.items()
                         if s != server}
        print(f"[REMOVE] {server} (ring size: {len(self.ring)})")

    def get_server(self, key: str) -> str:
        """Get the server corresponding to a key (nearest clockwise)"""
        if not self.ring:
            raise Exception("No servers available")
        h = self._hash(key)
        idx = bisect_right(self.ring, h)
        if idx == len(self.ring):
            idx = 0  # Wrap around to the beginning past the end of the ring
        return self.ring_map[self.ring[idx]]

    def get_replicas(self, key: str, count: int = 3) -> list[str]:
        """Replica placement: get N distinct servers clockwise"""
        if not self.ring:
            raise Exception("No servers available")
        replicas = []
        h = self._hash(key)
        idx = bisect_right(self.ring, h)

        seen = set()
        for i in range(len(self.ring)):
            pos = (idx + i) % len(self.ring)
            server = self.ring_map[self.ring[pos]]
            if server not in seen:
                seen.add(server)
                replicas.append(server)
                if len(replicas) == count:
                    break
        return replicas


# === Demo: Verify impact of server addition/removal ===
ch = ConsistentHash(virtual_nodes=100)
for s in ["server-A", "server-B", "server-C"]:
    ch.add_server(s)

# Check distribution of 1000 keys
dist = Counter(ch.get_server(f"key-{i}") for i in range(1000))
print(f"\nDistribution: {dict(dist)}")
# Expected: approximately 333 keys per server (±~10% variance)

# Impact of adding a server (remapping rate)
before = {f"key-{i}": ch.get_server(f"key-{i}") for i in range(1000)}
ch.add_server("server-D")
after = {f"key-{i}": ch.get_server(f"key-{i}") for i in range(1000)}
moved = sum(1 for k in before if before[k] != after[k])
print(f"Remapped keys: {moved}/1000 ({moved/10:.1f}%)")
# Theoretical value: 1/4 = 25% (approximately 250 of 1000 keys move)

# Replica placement
print(f"\nReplica placement (key-42): {ch.get_replicas('key-42', 3)}")
```

---

## 4. Health Checks

### ASCII Diagram 4: Types of Health Checks

```
■ Active Health Check (LB → Backend)

  LB ──GET /health──→ Backend 1  → 200 OK  ✓ healthy
  LB ──GET /health──→ Backend 2  → 200 OK  ✓ healthy
  LB ──GET /health──→ Backend 3  → timeout ✗ unhealthy
                                      │
                        3 consecutive failures → removed from pool
                        2 consecutive successes → returned to pool

■ Passive Health Check (evaluated from real traffic)

  Client ──req──→ LB ──→ Backend 3 → 502 Error
                   │      (error rate > 50%)
                   │           │
                   │     automatically removed from pool
                   └──→ Backend 1 → 200 OK (retry)

■ Deep Health Check (includes dependencies)

  LB ──GET /health/deep──→ Backend
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
                  [DB OK]  [Redis OK]  [Kafka OK]
                              │
                    All OK → 200 {"status": "healthy"}
                    Some NG → 503 {"status": "degraded",
                                  "redis": "unhealthy"}
```

### Code Example 5: Health Check Implementation

```python
import asyncio
import aiohttp
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Callable

class ServerState(Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DRAINING = "draining"    # Rejects new connections, waits for existing to complete
    DEGRADED = "degraded"    # Operating with some functional limitations

@dataclass
class BackendServer:
    host: str
    port: int
    state: ServerState = ServerState.HEALTHY
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    active_connections: int = 0
    last_check_time: float = 0.0
    last_response_time_ms: float = 0.0
    total_requests: int = 0
    total_errors: int = 0

    @property
    def url(self):
        return f"http://{self.host}:{self.port}"

    @property
    def error_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.total_errors / self.total_requests


class HealthCheckManager:
    """Integrated management of active + passive health checks

    Design points:
    1. Active check: periodically call health endpoint
    2. Passive check: evaluate from real traffic response codes
    3. Deep check: comprehensive check including DB/Redis dependencies
    4. State transitions: use hysteresis to prevent frequent state changes
    """

    def __init__(self, servers: list[BackendServer],
                 check_interval: float = 10.0,
                 unhealthy_threshold: int = 3,
                 healthy_threshold: int = 2,
                 timeout: float = 3.0,
                 on_state_change: Optional[Callable] = None):
        self.servers = servers
        self.check_interval = check_interval
        self.unhealthy_threshold = unhealthy_threshold
        self.healthy_threshold = healthy_threshold
        self.timeout = timeout
        self.on_state_change = on_state_change

    async def active_check(self, server: BackendServer,
                           session: aiohttp.ClientSession):
        """Active health check"""
        start_time = time.time()
        try:
            async with session.get(
                f"{server.url}/health",
                timeout=aiohttp.ClientTimeout(total=self.timeout)
            ) as resp:
                elapsed = (time.time() - start_time) * 1000
                server.last_response_time_ms = elapsed
                server.last_check_time = time.time()

                if resp.status == 200:
                    body = await resp.json()
                    # Deep check: also verify dependency statuses
                    if body.get("status") == "degraded":
                        self._transition(server, ServerState.DEGRADED,
                                        "Degraded dependencies")
                    else:
                        self._mark_success(server)
                elif resp.status == 503:
                    self._mark_failure(server, f"HTTP {resp.status}")
                else:
                    self._mark_failure(server, f"HTTP {resp.status}")
        except asyncio.TimeoutError:
            self._mark_failure(server, "Timeout")
        except Exception as e:
            self._mark_failure(server, str(e))

    def passive_check(self, server: BackendServer, status_code: int,
                     response_time_ms: float = 0.0):
        """Passive health check (evaluated from real request results)"""
        server.total_requests += 1
        server.last_response_time_ms = response_time_ms

        if status_code >= 500:
            server.total_errors += 1
            self._mark_failure(server, f"HTTP {status_code}")
        else:
            self._mark_success(server)

    def _mark_success(self, server: BackendServer):
        server.consecutive_failures = 0
        server.consecutive_successes += 1
        if (server.state in (ServerState.UNHEALTHY, ServerState.DEGRADED)
                and server.consecutive_successes >= self.healthy_threshold):
            self._transition(server, ServerState.HEALTHY, "Recovered")

    def _mark_failure(self, server: BackendServer, reason: str):
        server.consecutive_successes = 0
        server.consecutive_failures += 1
        if (server.state == ServerState.HEALTHY
                and server.consecutive_failures >= self.unhealthy_threshold):
            self._transition(server, ServerState.UNHEALTHY, reason)

    def _transition(self, server: BackendServer, new_state: ServerState,
                    reason: str):
        """State transition and callback notification"""
        old_state = server.state
        if old_state == new_state:
            return
        server.state = new_state
        msg = (f"[HEALTH] {server.url}: {old_state.value} → "
               f"{new_state.value} ({reason})")
        print(msg)
        if self.on_state_change:
            self.on_state_change(server, old_state, new_state, reason)

    def get_healthy_servers(self) -> list[BackendServer]:
        """Return servers that are healthy or in degraded state"""
        return [s for s in self.servers
                if s.state in (ServerState.HEALTHY, ServerState.DEGRADED)]

    def get_stats(self) -> list[dict]:
        """Statistics for all servers"""
        return [
            {
                "url": s.url,
                "state": s.state.value,
                "active_connections": s.active_connections,
                "error_rate": f"{s.error_rate:.1%}",
                "last_response_ms": f"{s.last_response_time_ms:.1f}",
                "consecutive_failures": s.consecutive_failures,
            }
            for s in self.servers
        ]

    async def run_periodic_checks(self):
        """Run periodic active health checks"""
        async with aiohttp.ClientSession() as session:
            while True:
                tasks = [self.active_check(server, session)
                         for server in self.servers]
                await asyncio.gather(*tasks, return_exceptions=True)
                await asyncio.sleep(self.check_interval)
```

---

## 5. Global Load Balancing

### ASCII Diagram 5: Multi-Region Architecture

```
  User (Tokyo)                    User (London)
      │                            │
      ▼                            ▼
  ┌──────────────────────────────────────┐
  │         GeoDNS / Route 53           │
  │   Tokyo users → ap-northeast-1      │
  │   European users → eu-west-1        │
  └──────────┬───────────────┬──────────┘
             │               │
    ┌────────▼───────┐ ┌────▼──────────┐
    │ ap-northeast-1 │ │  eu-west-1    │
    │ ┌────────────┐ │ │ ┌──────────┐  │
    │ │ L7 LB (ALB)│ │ │ │L7 LB(ALB│  │
    │ └─────┬──────┘ │ │ └────┬─────┘  │
    │   ┌───┼───┐    │ │  ┌──┼───┐    │
    │   │   │   │    │ │  │  │   │    │
    │  AZ-a AZ-c AZ-d│ │ AZ-a AZ-b AZ-c│
    │  │   │   │     │ │  │  │   │    │
    │  └───┼───┘     │ │  └──┼───┘    │
    │  ┌───▼───┐     │ │ ┌──▼────┐   │
    │  │L4(NLB)│     │ │ │L4(NLB)│   │
    │  └───────┘     │ │ └───────┘   │
    └────────────────┘ └──────────────┘

  3-Layer Architecture:
    Layer 1: GeoDNS (geography-based routing)
    Layer 2: L7 LB (content-based routing)
    Layer 3: L4 LB (fast transfer between AZs)
```

### Code Example 6: Global LB Configuration (AWS CDK)

```python
# Global LB configuration using AWS CDK
from aws_cdk import (
    Stack, Duration,
    aws_elasticloadbalancingv2 as elbv2,
    aws_ec2 as ec2,
    aws_route53 as route53,
    aws_route53_targets as targets,
    aws_globalaccelerator as ga,
)
from constructs import Construct


class GlobalLoadBalancerStack(Stack):
    """CDK stack for global LB configuration

    Architecture:
    1. AWS Global Accelerator (anycast)
    2. ALB (L7 LB) in each region
    3. Backend management with Auto Scaling Group
    4. Region failover with Route 53 health checks
    """

    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        # 1. VPC and subnets
        vpc = ec2.Vpc(self, "VPC",
            max_azs=3,
            nat_gateways=1,
        )

        # 2. Application Load Balancer (L7)
        alb = elbv2.ApplicationLoadBalancer(self, "ALB",
            vpc=vpc,
            internet_facing=True,
            load_balancer_name="api-alb",
        )

        # 3. Target group (with health check)
        target_group = elbv2.ApplicationTargetGroup(self, "TG",
            vpc=vpc,
            port=8080,
            protocol=elbv2.ApplicationProtocol.HTTP,
            target_type=elbv2.TargetType.INSTANCE,
            health_check=elbv2.HealthCheck(
                path="/health",
                interval=Duration.seconds(10),
                timeout=Duration.seconds(5),
                healthy_threshold_count=2,
                unhealthy_threshold_count=3,
                healthy_http_codes="200",
            ),
            deregistration_delay=Duration.seconds(30),
        )

        # 4. Listener configuration (HTTPS + path-based routing)
        https_listener = alb.add_listener("HTTPS",
            port=443,
            certificates=[certificate],
            default_action=elbv2.ListenerAction.forward([target_group]),
        )

        # Path-based routing
        https_listener.add_action("ApiV2",
            priority=10,
            conditions=[
                elbv2.ListenerCondition.path_patterns(["/api/v2/*"]),
            ],
            action=elbv2.ListenerAction.forward([v2_target_group]),
        )

        # Canary routing (send 10% of traffic to new version)
        https_listener.add_action("Canary",
            priority=20,
            conditions=[
                elbv2.ListenerCondition.path_patterns(["/api/*"]),
                elbv2.ListenerCondition.http_header("X-Canary", ["true"]),
            ],
            action=elbv2.ListenerAction.forward(
                target_groups=[target_group, canary_target_group],
                target_group_stickiness_duration=Duration.hours(1),
            ),
        )

        # 5. Global Accelerator
        accelerator = ga.Accelerator(self, "Accelerator",
            accelerator_name="global-api",
        )
        listener = accelerator.add_listener("Listener",
            port_ranges=[ga.PortRange(from_port=443, to_port=443)],
        )
        listener.add_endpoint_group("Region",
            endpoints=[ga.ApplicationLoadBalancerEndpoint(alb)],
        )
```

---

## 6. Comparison Tables

### Comparison Table 1: L4 vs L7 Load Balancers

| Item | L4 (Transport Layer) | L7 (Application Layer) |
|------|---------------------|----------------------|
| Inspection Target | IP + port | HTTP/HTTPS/gRPC headers |
| SSL Termination | Not possible (passthrough) | Possible |
| Content Routing | Not possible | Route by URL, header, Cookie |
| Performance | High (low overhead) | Lower (header parsing cost) |
| WebSocket | Supported via passthrough | Native support |
| gRPC | Per-connection (can be uneven) | Per-stream (even distribution) |
| Security | Limited (IP-based) | WAF, rate limiting, authentication |
| Suitable For | General TCP/UDP, DB connections, high RPS | HTTP API, web apps, microservices |
| Products | AWS NLB, HAProxy (TCP) | AWS ALB, Nginx, Envoy, Traefik |

### Comparison Table 2: Load Balancing Algorithm Comparison

| Algorithm | Uniformity | Session Affinity | Implementation Complexity | CPU Load | Suitable For |
|-------------|--------|--------------|-----------|---------|-------------|
| Round Robin | High | None | Lowest | Lowest | Homogeneous server pool |
| Weighted RR | High | None | Low | Low | Mixed-performance servers |
| Least Connections | High | None | Medium | Low | Uneven processing times |
| Weighted Least Connections | Highest | None | Medium | Low | Mixed-perf + uneven processing |
| IP Hash | Moderate | Yes | Low | Low | When session affinity is required |
| Consistent Hash | High | Yes | High | Medium | Caching, frequent scaling |
| Least Response Time | High | None | Medium | Medium | Latency-sensitive workloads |
| P2C | High | None | Low | Low | Large clusters (Envoy) |
| Random | Moderate | None | Lowest | Lowest | Large number of servers |

### Comparison Table 3: Major Load Balancer Product Comparison

| Product | Type | L4 | L7 | Throughput | Operations Model | Features |
|------|--------|:---:|:---:|------------|-----------|------|
| AWS ALB | Managed | - | ✓ | Auto-scales | Fully managed | HTTP routing, Lambda integration |
| AWS NLB | Managed | ✓ | - | Millions RPS | Fully managed | Ultra-low latency, static IP |
| Nginx | Software | ✓ | ✓ | ~100K RPS/node | Self-hosted | Flexible config, proven track record |
| HAProxy | Software | ✓ | ✓ | ~200K RPS/node | Self-hosted | High performance, detailed metrics |
| Envoy | Sidecar | ✓ | ✓ | ~50K RPS/node | Kubernetes | Service mesh, gRPC support |
| Traefik | Software | ✓ | ✓ | ~50K RPS/node | Kubernetes | Auto-discovery, Let's Encrypt |
| Cloudflare | CDN/LB | ✓ | ✓ | Unlimited | Fully managed | Global, DDoS protection |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Load Balancer Itself as a SPOF

```python
# BAD: Single LB handles all traffic

class SinglePointLB:
    """Single LB instance → becomes a SPOF"""

    def __init__(self, backends: list[str]):
        self.backends = backends
        # Only one LB → if the LB goes down, the entire service stops

    def route(self, request):
        # If this instance dies, all requests fail
        backend = self.select_backend()
        return forward(request, backend)


# GOOD: Redundant LB with Active-Standby configuration

class RedundantLBCluster:
    """Active-Standby redundancy using VRRP/keepalived"""

    def __init__(self, backends: list[str],
                 vip: str = "10.0.0.100",
                 priority: int = 100):
        self.backends = backends
        self.vip = vip          # Virtual IP (floating IP)
        self.priority = priority # Priority (higher = Active)
        self.is_active = False

    def configure_vrrp(self) -> dict:
        """VRRP (Virtual Router Redundancy Protocol) configuration"""
        return {
            "vrrp_instance": {
                "virtual_router_id": 51,
                "priority": self.priority,     # Active: 200, Standby: 100
                "virtual_ipaddress": [self.vip],
                "advert_int": 1,               # Heartbeat every 1 second
                "authentication": {
                    "auth_type": "PASS",
                    "auth_pass": "secret123",
                },
                # Active failure detected → Standby automatically promoted
                "track_script": {
                    "check_lb": {
                        "script": "/usr/local/bin/check_lb_health.sh",
                        "interval": 2,
                        "weight": -50,  # Demote with priority-50 on failure
                    }
                }
            }
        }
        # Active LB goes down → VIP moves to Standby
        # Failover time: typically 1-3 seconds

    def failover_to_standby(self):
        """Failover simulation"""
        print(f"[FAILOVER] Active LB down → VIP {self.vip} moving to Standby")
        self.is_active = False
        # Standby's priority becomes relatively higher, it acquires the VIP
```

### Anti-Pattern 2: Over-Reliance on Sticky Sessions

```python
# BAD: Pin all requests to the same server using Cookie

class StickySessionLB:
    """Sticky sessions: all requests go to the same server"""

    def __init__(self, backends: list[str]):
        self.backends = backends
        self.session_map: dict[str, str] = {}  # session_id → backend

    def route(self, request):
        session_id = request.cookies.get("SESSION_ID")
        if session_id in self.session_map:
            backend = self.session_map[session_id]
            # Problem 1: Session is lost if the backend goes down
            # Problem 2: Load concentrates on servers of popular users
            # Problem 3: Cannot migrate existing sessions during scale-out
            return forward(request, backend)
        else:
            backend = self.select_backend()
            self.session_map[session_id] = backend
            return forward(request, backend)


# GOOD: Store sessions in an external store to make stateless

import redis
import json

class StatelessLB:
    """Stateless LB + external session store"""

    def __init__(self, backends: list[str],
                 session_store: redis.Redis):
        self.backends = backends
        self.session_store = session_store
        self.rr_index = 0

    def route(self, request):
        # Sessions stored in Redis → readable from any server
        session_id = request.cookies.get("SESSION_ID")
        if session_id:
            session_data = self.session_store.get(f"session:{session_id}")
            request.session = json.loads(session_data) if session_data else {}

        # Can route to any backend
        backend = self.backends[self.rr_index % len(self.backends)]
        self.rr_index += 1
        return forward(request, backend)

    # Benefits:
    # - Sessions persist even when a server fails
    # - Perfectly even load distribution
    # - Free to scale out at any time
    # - Stateless JWT token authentication is also an option
```

### Anti-Pattern 3: Adding Backends Without Health Checks

```python
# BAD: Add to backend pool without health checks

class UnsafeLB:
    """No health checks → sends traffic even to unhealthy servers"""

    def __init__(self, backends: list[str]):
        self.backends = backends

    def add_backend(self, backend: str):
        # Problem: Traffic is sent even while server is starting up
        # Problem: Requests arrive before DB connection pool is initialized
        self.backends.append(backend)

    def route(self, request):
        backend = random.choice(self.backends)
        # Routing to unhealthy servers causes many errors
        return forward(request, backend)


# GOOD: Add with warmup period and health checks

from enum import Enum

class BackendState(Enum):
    WARMING = "warming"    # Starting up (waiting for health checks)
    ACTIVE = "active"      # Healthy (ready to receive traffic)
    DRAINING = "draining"  # Draining (no new connections)
    REMOVED = "removed"    # Excluded

class SafeLB:
    """Safe backend management with health checks"""

    def __init__(self, backends: list[str],
                 warmup_health_checks: int = 3,
                 drain_timeout_sec: int = 30):
        self.backends = {b: BackendState.ACTIVE for b in backends}
        self.warmup_health_checks = warmup_health_checks
        self.drain_timeout_sec = drain_timeout_sec
        self._health_counts: dict[str, int] = {}

    def add_backend(self, backend: str):
        """Send traffic only after warmup period"""
        self.backends[backend] = BackendState.WARMING
        self._health_counts[backend] = 0
        print(f"[ADD] {backend} → WARMING "
              f"(need {self.warmup_health_checks} health checks)")

    def on_health_check_pass(self, backend: str):
        """Callback when health check passes"""
        if self.backends.get(backend) == BackendState.WARMING:
            self._health_counts[backend] = \
                self._health_counts.get(backend, 0) + 1
            if self._health_counts[backend] >= self.warmup_health_checks:
                self.backends[backend] = BackendState.ACTIVE
                print(f"[ACTIVE] {backend} → now receiving traffic")

    def remove_backend(self, backend: str):
        """Drain gracefully before removing"""
        self.backends[backend] = BackendState.DRAINING
        print(f"[DRAIN] {backend} → no new connections, "
              f"will be removed after {self.drain_timeout_sec}s")
        # Wait for existing connections to complete before transitioning to REMOVED

    def get_active_backends(self) -> list[str]:
        return [b for b, s in self.backends.items()
                if s == BackendState.ACTIVE]
```

---

## 8. Practice Problems

### Exercise 1 (Basic): Verify Weighted Round Robin Distribution

**Task**: Configure 4 servers with weights 5, 3, 1, and 1 respectively, distribute 10,000 requests, and compare the theoretical values with measured values.

```python
# Hint: Use the LoadBalancerAlgorithms class
from collections import Counter

servers = [
    Server("srv-A", weight=5),
    Server("srv-B", weight=3),
    Server("srv-C", weight=1),
    Server("srv-D", weight=1),
]
lb = LoadBalancerAlgorithms(servers)

results = Counter()
for _ in range(10000):
    server = lb.weighted_round_robin()
    results[server.name] += 1

print("=== Measured Distribution ===")
for name, count in sorted(results.items()):
    print(f"  {name}: {count} ({count/100:.1f}%)")

# Theoretical values: srv-A=50%, srv-B=30%, srv-C=10%, srv-D=10%
```

**Expected Output**:
```
=== Measured Distribution ===
  srv-A: 5000 (50.0%)
  srv-B: 3000 (30.0%)
  srv-C: 1000 (10.0%)
  srv-D: 1000 (10.0%)
```

### Exercise 2 (Advanced): Consistent Hashing Node Addition/Removal Simulation

**Task**: Measure the key remapping rate when adding 1 server and removing 1 server from a 5-server setup, and compare distribution variance for virtual node counts of 50, 150, and 500.

```python
# Hint: Use the ConsistentHash class
import statistics

for vnode_count in [50, 150, 500]:
    ch = ConsistentHash(virtual_nodes=vnode_count)
    for i in range(5):
        ch.add_server(f"server-{i}")

    # Measure distribution of 10000 keys
    dist = Counter(ch.get_server(f"key-{i}") for i in range(10000))
    values = list(dist.values())
    mean = statistics.mean(values)
    stdev = statistics.stdev(values)

    # Remapping rate when adding a server
    before = {f"key-{i}": ch.get_server(f"key-{i}") for i in range(10000)}
    ch.add_server("server-5")
    after = {f"key-{i}": ch.get_server(f"key-{i}") for i in range(10000)}
    moved = sum(1 for k in before if before[k] != after[k])

    print(f"\nVirtual nodes: {vnode_count}")
    print(f"  Distribution (mean: {mean:.0f}, std dev: {stdev:.0f}, "
          f"CV: {stdev/mean*100:.1f}%)")
    print(f"  Remapping rate: {moved/100:.1f}% (theoretical: {100/6:.1f}%)")
```

**Expected Output (approximate)**:
```
Virtual nodes: 50
  Distribution (mean: 2000, std dev: 200, CV: 10.0%)
  Remapping rate: 17.5% (theoretical: 16.7%)

Virtual nodes: 150
  Distribution (mean: 2000, std dev: 100, CV: 5.0%)
  Remapping rate: 16.9% (theoretical: 16.7%)

Virtual nodes: 500
  Distribution (mean: 2000, std dev: 40, CV: 2.0%)
  Remapping rate: 16.7% (theoretical: 16.7%)
```

### Exercise 3 (Expert): Full L7 Load Balancer Implementation

**Task**: Implement an L7 load balancer with the following features.
1. Path-based routing (`/api/*` and `/static/*` routed to different backend pools)
2. Health checks (10-second interval, removed after 3 consecutive failures)
3. Request rate limiting (100 req/sec per client IP)
4. Request/response logging

```python
# Hint: Implement using aiohttp + asyncio
import asyncio
import aiohttp
from aiohttp import web
from collections import defaultdict
import time

class L7LoadBalancer:
    """Advanced L7 load balancer implementation"""

    def __init__(self):
        self.route_table: dict[str, list[BackendServer]] = {}
        self.health_manager: Optional[HealthCheckManager] = None
        self.rate_limits: dict[str, list[float]] = defaultdict(list)
        self.rate_limit_rps = 100

    def add_route(self, prefix: str, backends: list[BackendServer]):
        """Register a backend pool for a path prefix"""
        self.route_table[prefix] = backends

    def check_rate_limit(self, client_ip: str) -> bool:
        """Token bucket-style rate limiting"""
        now = time.time()
        # Keep request timestamps from the past 1 second
        self.rate_limits[client_ip] = [
            t for t in self.rate_limits[client_ip]
            if now - t < 1.0
        ]
        if len(self.rate_limits[client_ip]) >= self.rate_limit_rps:
            return False
        self.rate_limits[client_ip].append(now)
        return True

    def resolve_backend(self, path: str) -> Optional[BackendServer]:
        """Select a backend based on path"""
        for prefix, backends in self.route_table.items():
            if path.startswith(prefix):
                healthy = [b for b in backends
                          if b.state == ServerState.HEALTHY]
                if healthy:
                    # Select using least connections
                    return min(healthy,
                              key=lambda b: b.active_connections)
        return None

    async def handle_request(self, request: web.Request) -> web.Response:
        """Request handler"""
        client_ip = request.remote
        start_time = time.time()

        # Rate limit check
        if not self.check_rate_limit(client_ip):
            return web.json_response(
                {"error": "Rate limit exceeded"},
                status=429
            )

        # Resolve backend
        backend = self.resolve_backend(request.path)
        if backend is None:
            return web.json_response(
                {"error": "No backend available"},
                status=503
            )

        # Forward request
        backend.active_connections += 1
        try:
            async with aiohttp.ClientSession() as session:
                target_url = f"{backend.url}{request.path}"
                async with session.request(
                    method=request.method,
                    url=target_url,
                    headers=dict(request.headers),
                    data=await request.read(),
                ) as resp:
                    body = await resp.read()
                    elapsed = (time.time() - start_time) * 1000
                    print(f"[{request.method}] {request.path} → "
                          f"{backend.url} {resp.status} "
                          f"{elapsed:.1f}ms")
                    return web.Response(
                        body=body,
                        status=resp.status,
                        headers=dict(resp.headers),
                    )
        except Exception as e:
            elapsed = (time.time() - start_time) * 1000
            print(f"[ERROR] {request.path} → {backend.url}: {e} "
                  f"{elapsed:.1f}ms")
            return web.json_response(
                {"error": "Backend error"},
                status=502
            )
        finally:
            backend.active_connections -= 1
```

---

## 9. FAQ

### Q1: What LB architecture is used for global services?

A 3-layer architecture is common: (1) DNS-based geographic distribution (GeoDNS/Route 53), (2) L7 LB per region (ALB/Nginx), (3) L4 LB per AZ (NLB). Traffic is routed to the region closest to the user, and within the region it is distributed across AZs. Cloudflare and AWS Global Accelerator use anycast to route to the nearest PoP (Point of Presence) at the BGP level. With AWS Global Accelerator, two static IP addresses are assigned, and users connect with low latency to the nearest region from edge locations worldwide.

### Q2: What is the throughput limit of a load balancer?

Software LBs (Nginx) can handle tens of thousands to hundreds of thousands of RPS per node; hardware LBs (F5 BIG-IP) can handle millions of RPS. AWS ALB auto-scales and is theoretically unlimited, but sudden traffic spikes (e.g., 0 → 1M RPS) may cause the LB itself to lag in scaling and result in 503 errors. To prevent this: (1) contact AWS Support in advance to request pre-warming, (2) ramp up traffic gradually, or (3) use NLB (which is statically scaled). If the LB becomes a bottleneck, use DNS round-robin to distribute across multiple LBs.

### Q3: How does gRPC load balancing differ from HTTP?

gRPC uses HTTP/2, which multiplexes multiple streams over a single TCP connection. With L4 LB, routing is per connection, meaning all requests flow through one connection, creating imbalance. gRPC requires an L7 LB (Envoy, Linkerd) to distribute at the stream level. Client-side LB (gRPC built-in `round_robin` policy) is also an option. In Kubernetes environments, Envoy-based service meshes (Istio) have become the de facto standard for gRPC load balancing.

### Q4: How should I choose between ALB and NLB?

Use AWS ALB (L7) when you need routing based on HTTP request content (path-based, host-based, header-based). It is suited for REST APIs, WebSocket, and gRPC. Use AWS NLB (L4) when you need ultra-low latency (microseconds) and high throughput (millions of RPS). It is suited for general TCP/UDP load balancing, when static IP addresses are needed, and when used as a DB proxy. The two can be combined — placing ALB behind NLB is used when mutual TLS (mTLS) authentication is required.

### Q5: What is load balancer warm-up?

Managed LBs such as AWS ALB internally scale according to traffic volume. A sudden traffic surge (e.g., 0 → 1M RPS at the start of a sale) may result in 503 errors if the LB cannot scale fast enough. To prevent this: (1) contact AWS Support in advance to request pre-warming, (2) ramp up traffic gradually, or (3) use NLB (which is statically scaled).

### Q6: What is the relationship between service meshes and LBs?

Service meshes (Istio/Envoy, Linkerd) provide LB functionality as a sidecar proxy for all service-to-service communication in microservices environments. A sidecar is injected into each Pod and transparently handles service discovery, load balancing, retries, circuit breaking, mTLS, and metrics collection. Whereas traditional LBs provide centralized management at the "entry point," service meshes provide distributed management at "each node." Traditional LBs are sufficient for 10 or fewer services, but for 20+ services, consider adopting a service mesh for unified observability and security management.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| Role of LB | Traffic distribution, availability, latency equalization, security |
| L4 vs L7 | L4 is fast and general-purpose (TCP/UDP); L7 is flexible and HTTP-specific (routing, SSL termination) |
| Key Algorithms | RR, weighted, least connections, P2C, consistent hash |
| Health Checks | Active (periodic polling) + passive (real traffic evaluation) must be used together |
| LB Redundancy | Eliminate SPOF with Active-Standby (VRRP) and DNS distribution |
| Global Architecture | 3-layer: GeoDNS → L7 LB → L4 LB |
| gRPC Support | L7 LB (e.g., Envoy) required for stream-level distribution |
| Service Mesh | For large-scale environments with 20+ services, consider Envoy/Istio-based distributed LB |

---

## Guides to Read Next

- [Caching](./01-caching.md) -- Cache layer placed behind the LB
- [CDN](./03-cdn.md) -- Global static content delivery and edge LB
- [Scalability](../00-fundamentals/01-scalability.md) -- Horizontal scaling using LBs
- [Reliability](../00-fundamentals/02-reliability.md) -- Circuit breakers, retries, and LB integration
- [Message Queue](./02-message-queue.md) -- Smoothing backend load with asynchronous processing

---

## References

1. Karger, D. et al. (1997). "Consistent Hashing and Random Trees." *STOC '97*.
2. Mitzenmacher, M. (2001). "The Power of Two Choices in Randomized Load Balancing." *IEEE Transactions on Parallel and Distributed Systems*.
3. Nginx Documentation -- https://nginx.org/en/docs/http/load_balancing.html
4. Envoy Proxy Documentation -- https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/
5. AWS Elastic Load Balancing Documentation -- https://docs.aws.amazon.com/elasticloadbalancing/
