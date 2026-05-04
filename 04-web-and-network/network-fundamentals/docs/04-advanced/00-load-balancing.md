# Load Balancing

> A load balancer is core infrastructure that distributes traffic across multiple servers to achieve availability and scalability. This guide systematically explains the operating principles of L4/L7, the mathematical background of distribution algorithms, practical AWS ALB/NLB configurations, and high-availability design with HAProxy.

## What You Will Learn in This Chapter

- [ ] Understand the operating principles of L4 (transport layer) and L7 (application layer) load balancing
- [ ] Grasp the characteristics, selection criteria, and mathematical background of 6 major distribution algorithms
- [ ] Master practical load balancer configuration with Nginx / HAProxy
- [ ] Learn AWS ALB / NLB / GWLB configuration patterns and construction with IaC (Terraform)
- [ ] Understand the principles of health check design and implementation of staged health checks
- [ ] Understand the mechanism of VRRP / Keepalived in high availability (HA) configurations
- [ ] Recognize anti-patterns and edge cases related to load balancers

---

## 1. Basic Concepts of Load Balancing

### 1.1 Why Load Balancing Is Needed

When running a service on a single server, the following limitations arise.

```
Problems with a single-server configuration:

  Group of clients
   │ │ │ │ │
   ▼ ▼ ▼ ▼ ▼
  ┌──────────┐
  │ Server   │ ← Single Point of Failure (SPOF)
  │ CPU: 95% │ ← Processing capacity limit
  │ Mem: 90% │ ← Memory shortage
  └──────────┘

  Problems:
  ① SPOF: Server failure = complete service outage
  ② Scale limit: Only vertical scaling (adding CPU/RAM)
  ③ No maintenance: Downtime during updates
  ④ Geographic constraint: Dependency on a single location
```

Introducing a load balancer fundamentally solves these problems.

```
After introducing a load balancer:

  Group of clients
   │ │ │ │ │
   ▼ ▼ ▼ ▼ ▼
  ┌────────────┐
  │ Load       │ ← Accepts requests via Virtual IP (VIP)
  │ Balancer   │ ← Distributes traffic
  └─┬──┬──┬──┬─┘
    │  │  │  │
  ┌─▼┐┌▼─┐┌▼─┐┌─▼┐
  │S1││S2││S3││S4│  ← Backend servers
  └──┘└──┘└──┘└──┘

  Problems resolved:
  ① High availability: S1 failure → continues on S2/S3/S4
  ② Horizontal scale: Adding servers increases processing capacity
  ③ Zero-downtime maintenance: Rolling deployment possible
  ④ Geographic distribution: Multi-region support
```

### 1.2 Basic Operation of a Load Balancer

A load balancer functions as a proxy between clients and servers. Its basic operation is as follows.

```
┌────────────────────────────────────────────────────────────┐
│              Load Balancer Processing Flow                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Receive request                                        │
│     Client ──TCP SYN──→ LB (VIP:443)                       │
│                                                            │
│  2. Determine destination                                  │
│     LB: selects backend based on algorithm                 │
│         references health check results, only healthy      │
│         servers are candidates                             │
│                                                            │
│  3. Forward request                                        │
│     LB ──forward request──→ Backend Server (S2)            │
│                                                            │
│  4. Return response                                        │
│     Backend Server (S2) ──response──→ LB ──→ Client       │
│                                                            │
│  * In DSR (Direct Server Return) mode:                     │
│     Backend Server (S2) ──response──→ Client (bypasses LB)│
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 1.3 DSR (Direct Server Return)

DSR is a method in which the response is returned directly from the backend server to the client without going through the load balancer. It avoids load balancer bottlenecks for large responses (such as video streaming).

```
Normal mode:
  Client → LB → Server
  Client ← LB ← Server   (LB can become a bottleneck)

DSR mode:
  Client → LB → Server
  Client ←────── Server   (response is returned directly)

  Advantage: LB bandwidth usage is significantly reduced
  Disadvantage: L7 features (response rewriting, etc.) cannot be used
               Server-side loopback configuration is required
```

---

## 2. L4 vs L7 Load Balancing

### 2.1 Position in the OSI Reference Model

```
┌──────────────────────────────────────────────────────────┐
│               OSI Reference Model and Load Balancers      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 7: Application Layer   ←── L7 LB operates here   │
│           HTTP, HTTPS, gRPC, WebSocket                   │
│           Routes by URL path, hostname, Cookie, headers  │
│                                                          │
│  Layer 6: Presentation Layer                             │
│           TLS/SSL termination performed here             │
│                                                          │
│  Layer 5: Session Layer                                  │
│                                                          │
│  Layer 4: Transport Layer     ←── L4 LB operates here   │
│           TCP, UDP                                       │
│           Routes by IP address + port number             │
│                                                          │
│  Layer 3: Network Layer       ←── GWLB operates here    │
│           IP packet forwarding                           │
│                                                          │
│  Layer 2: Data Link Layer                                │
│  Layer 1: Physical Layer                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 How L4 Load Balancing Works

An L4 load balancer routes based only on TCP/UDP header information (source IP, destination IP, source port, destination port). It does not inspect the packet payload at all.

```
L4 load balancing operation:

  Client: 192.168.1.100:54321
       │
       │  TCP SYN (dst: 10.0.0.1:443)
       ▼
  ┌─────────────┐
  │  L4 LB      │  Decision basis:
  │  10.0.0.1   │   - Source IP: 192.168.1.100
  │             │   - Destination port: 443
  │  NAT:       │   - Protocol: TCP
  │  dst →      │
  │  10.0.1.x   │  Does not inspect payload
  └──┬──────┬───┘  → Cannot distinguish HTTP/HTTPS
     │      │      → Cannot distinguish URL paths
     ▼      ▼
  10.0.1.1  10.0.1.2
  Server A  Server B

  Characteristics:
  · Can run in kernel space → high throughput
  · Routes per connection (not per packet)
  · All packets in the same connection go to the same server
  · TLS termination not possible (passthrough)
```

### 2.3 How L7 Load Balancing Works

An L7 load balancer understands HTTP/HTTPS protocols and performs intelligent routing based on the content of requests.

```
L7 load balancing operation:

  Client
       │
       │  HTTPS request
       │  Host: api.example.com
       │  GET /v2/users/123
       │  Cookie: session=abc123
       │  Authorization: Bearer xyz
       ▼
  ┌──────────────────┐
  │    L7 LB         │  Decision basis:
  │                  │   - URL path: /v2/users/123
  │  TLS termination ✓│  - Hostname: api.example.com
  │  HTTP parsing  ✓ │   - Cookie: session=abc123
  │  Header inspect ✓│   - HTTP method: GET
  │  Cookie inspect ✓│   - Header: Authorization
  │  Compress/expand ✓│   - Content-Type
  │                  │   - Query parameters
  └─┬────┬────┬──┬──┘
    │    │    │  │
    ▼    ▼    ▼  ▼
  ┌──┐┌──┐┌──┐┌──┐
  │API││API││WS││Static│
  │v1 ││v2 ││  ││      │
  └──┘└──┘└──┘└──┘

  Routing rule examples:
  /v1/*          → API v1 server group
  /v2/*          → API v2 server group
  /ws/*          → WebSocket server group
  /static/*      → Static file server
  Host: admin.*  → Admin panel server
```

### 2.4 Detailed L4 vs L7 Comparison Table

```
┌───────────────────┬──────────────────────┬──────────────────────┐
│ Comparison item   │ L4 Load Balancer      │ L7 Load Balancer      │
├───────────────────┼──────────────────────┼──────────────────────┤
│ Operating layer   │ Transport layer (L4)  │ Application layer (L7)│
│ Decision basis    │ IP + port number      │ URL, headers, Cookie  │
│ Protocol support  │ TCP/UDP only          │ HTTP/HTTPS/gRPC/WS   │
│ Processing speed  │ Very fast             │ Slightly slower       │
│                   │                       │ (parsing cost)        │
│ Throughput        │ Millions of RPS       │ Hundreds of thousands │
│ Latency added     │ < 1ms                │ 1–5ms                 │
│ TLS termination   │ Not possible          │ Possible              │
│                   │ (passthrough)         │ (cert management)     │
│ Content routing   │ Not possible          │ Path-based            │
│                   │                       │ Host-based            │
│                   │                       │ Header-based          │
│ Health checks     │ TCP connection only   │ HTTP status check     │
│                   │                       │ Response body check   │
│ WebSocket         │ Passthrough           │ Protocol-aware        │
│ HTTP/2            │ Passthrough           │ Multiplexing-aware    │
│ gRPC              │ Passthrough           │ gRPC routing possible │
│ Session affinity  │ Source IP-based       │ Cookie-based          │
│ WAF integration   │ Not possible          │ Possible              │
│ Response editing  │ Not possible          │ Header add/remove     │
│ Client IP         │ Can be preserved      │ X-Forwarded-For added │
│ Typical impl.     │ LVS, NLB, HAProxy    │ Nginx, ALB, Envoy     │
│ Main use cases    │ DB, mail, gaming      │ Web API, micro-       │
│                   │ IoT, DNS              │ services, SPA         │
│ Cost              │ Low                   │ Slightly higher       │
└───────────────────┴──────────────────────┴──────────────────────┘

Selection guidelines:
  Choose L4 when:
    - Ultra-low latency is required (game servers, financial trading)
    - Direct TCP/UDP communication (database proxy)
    - TLS passthrough is needed (client certificate auth)
    - Large-scale connection handling (IoT device connections)

  Choose L7 when:
    - Path-based routing is needed (microservices)
    - TLS termination at the LB (centralized cert management)
    - A/B testing, canary deployments
    - WAF (Web Application Firewall) integration
    - Response compression and caching
```

---

## 3. Deep Dive into Distribution Algorithms

### 3.1 Round Robin

The most basic algorithm. Routes requests to backend servers in sequential order.

```
Round Robin operation:

  Request sequence: R1  R2  R3  R4  R5  R6  R7  R8  R9
  Destination:      S1  S2  S3  S1  S2  S3  S1  S2  S3

  Over time:
  ──────────────────────────────────────────────→ t

  S1: ■□□■□□■□□  (3 requests)
  S2: □■□□■□□■□  (3 requests)
  S3: □□■□□■□□■  (3 requests)

  ■ = processing a request

  Advantages:
    - Extremely simple implementation (one counter)
    - Near-zero overhead
    - Optimal when servers are homogeneous

  Disadvantages:
    - Does not account for differences in server capacity
    - Does not account for differences in request processing time
    - Cannot maintain sessions

  Pseudocode:
    counter = 0
    servers = [S1, S2, S3]

    function next_server():
        server = servers[counter % len(servers)]
        counter += 1
        return server
```

### 3.2 Weighted Round Robin

Takes into account differences in server performance and assigns weights based on processing capacity.

```
Weighted Round Robin operation:

  Weight settings: S1=5, S2=3, S3=2 (total 10)

  Distribution of 10 requests:
  R1→S1, R2→S1, R3→S1, R4→S1, R5→S1,
  R6→S2, R7→S2, R8→S2,
  R9→S3, R10→S3

  S1 (w=5): ■■■■■□□□□□  50% of requests (8 core, 32GB)
  S2 (w=3): □□□□□■■■□□  30% of requests (4 core, 16GB)
  S3 (w=2): □□□□□□□□■■  20% of requests (2 core, 8GB)

  Smooth Weighted Round Robin (Nginx method):
    → Does not route consecutively to the same server
    → S1, S2, S1, S3, S1, S2, S1, S1, S2, S3
    → Prevents bursty request concentration
```

### 3.3 Least Connections

Routes the request to the server with the fewest current active connections. Effective when processing time varies significantly per request.

```
Least Connections operation:

  State:
  S1: connections = 12  ──→ not selected
  S2: connections = 5   ──→ next request goes here ★
  S3: connections = 8   ──→ not selected

  Connection count changes over time:

  S1: ████████████____
  S2: █████___________  ← minimum → new request routed here
  S3: ████████________

  t=0: S1=12, S2=5, S3=8 → route to S2
  t=1: S1=11, S2=6, S3=7 → route to S2
  t=2: S1=10, S2=7, S3=6 → route to S3

  Weighted Least Connections:
    score = active_connections / weight
    S1: 12/5 = 2.4
    S2: 5/3  = 1.67  ← minimum score → selected
    S3: 8/2  = 4.0

  Advantages:
    - Strong for uneven processing time workloads
    - Effective when long-lived connections (WebSocket, etc.) exist
    - Automatically reduces requests to slow servers

  Disadvantages:
    - Overhead of tracking connection counts
    - Temporary request concentration immediately after adding a new server
```

### 3.4 IP Hash

Calculates a hash value from the client's IP address and routes to a fixed server.

```
IP Hash operation:

  hash(client_ip) % server_count = server_index

  Example:
  hash("192.168.1.10") % 3 = 0 → S1
  hash("192.168.1.20") % 3 = 2 → S3
  hash("192.168.1.30") % 3 = 1 → S2
  hash("192.168.1.10") % 3 = 0 → S1 (same IP always goes to the same server)

  ┌──────────────┐     ┌──────┐
  │ 192.168.1.10 │────→│  S1  │  always S1
  └──────────────┘     └──────┘
  ┌──────────────┐     ┌──────┐
  │ 192.168.1.20 │────→│  S3  │  always S3
  └──────────────┘     └──────┘
  ┌──────────────┐     ┌──────┐
  │ 192.168.1.30 │────→│  S2  │  always S2
  └──────────────┘     └──────┘

  Problem: When the number of servers changes, almost all clients are rerouted
  Solution: Use Consistent Hashing
```

### 3.5 Consistent Hashing

An algorithm that minimizes the number of clients affected when servers are added or removed.

```
Consistent Hashing operation:

  Hash space arranged in a ring:

              0
           ╱     ╲
         ╱    S1   ╲
       ╱    (pos=30) ╲
      │                │
  270 │     Hash        │ 90
      │     Ring        │
       ╲              ╱
         ╲   S2     ╱
           ╲(pos=150)╱
             ╲   ╱
              180
                S3 (pos=210)

  Client IP hash value is assigned to the first server clockwise:

  hash("client_A") = 50  → clockwise → S2 (pos=150)
  hash("client_B") = 100 → clockwise → S2 (pos=150)
  hash("client_C") = 200 → clockwise → S3 (pos=210)
  hash("client_D") = 250 → clockwise → S1 (pos=30 ※ ring wraps)

  When S4 (pos=120) is added:
  → Only client_B (hash=100) changes from S2 → S4
  → Other clients are unaffected

  Virtual nodes:
    Each physical server is placed on the ring as multiple virtual nodes
    → Reduces load imbalance
    → S1 → S1_v1(30), S1_v2(120), S1_v3(250) distributed on the ring
```

### 3.6 Least Response Time

Considers health check response times and routes requests to the fastest-responding server.

```
Least Response Time operation:

  Continuously measuring response time for each server:

  S1: avg response time = 15ms  ← fastest → selected
  S2: avg response time = 45ms
  S3: avg response time = 30ms

  Response time updated using Exponential Moving Average (EMA):
    new_avg = α × latest_response + (1 - α) × old_avg
    α = 0.3 (weight for new value)

  Advantages:
    - Reflects actual server performance
    - Network latency is also considered

  Disadvantages:
    - Discrepancy between health check results and actual request processing time
    - Measurement overhead
    - May oscillate on servers with unstable performance
```

### 3.7 Algorithm Selection Flowchart

```
Algorithm selection:

  Is session affinity required?
    ├── Yes → Can Cookie-based be used?
    │         ├── Yes → L7 LB + Cookie Sticky
    │         └── No  → IP Hash or Consistent Hashing
    └── No  → Are server specs uniform?
              ├── Yes → Is request processing time uniform?
              │         ├── Yes → Round Robin
              │         └── No  → Least Connections
              └── No  → Weighted Round Robin or Weighted Least Connections

  Recommended by workload:
  ┌────────────────────────┬──────────────────────────┐
  │ Workload               │ Recommended algorithm     │
  ├────────────────────────┼──────────────────────────┤
  │ REST API (stateless)   │ Round Robin               │
  │ WebSocket long conn.   │ Least Connections         │
  │ Cache servers          │ Consistent Hashing        │
  │ Mixed hardware env.    │ Weighted Round Robin      │
  │ Real-time processing   │ Least Response Time       │
  │ Microservices          │ Round Robin + Health      │
  │ Game servers           │ Least Connections + geo   │
  └────────────────────────┴──────────────────────────┘
```

---

## 4. Nginx Load Balancing Configuration

### 4.1 Basic Configuration (Round Robin)

```nginx
# /etc/nginx/nginx.conf
# Nginx load balancer basic configuration

# Number of worker processes: match CPU core count
worker_processes auto;

# Event processing configuration
events {
    worker_connections 65536;   # Max connections per worker
    use epoll;                  # Use epoll on Linux
    multi_accept on;            # Accept multiple connections simultaneously
}

http {
    # Log format: includes upstream information
    log_format upstream_log '$remote_addr - $remote_user [$time_local] '
                           '"$request" $status $body_bytes_sent '
                           '"$http_referer" "$http_user_agent" '
                           'upstream: $upstream_addr '
                           'response_time: $upstream_response_time '
                           'status: $upstream_status';

    access_log /var/log/nginx/access.log upstream_log;

    # Upstream definition: backend server group
    upstream backend_servers {
        # Default is round robin
        server 10.0.1.1:8080;
        server 10.0.1.2:8080;
        server 10.0.1.3:8080;
    }

    server {
        listen 80;
        server_name api.example.com;

        location / {
            proxy_pass http://backend_servers;

            # Proxy header configuration
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeout configuration
            proxy_connect_timeout 10s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;

            # Buffering configuration
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
        }
    }
}
```

### 4.2 Advanced Nginx Configuration (Weighted, Health Checks, SSL Termination)

```nginx
# /etc/nginx/conf.d/load-balancer.conf
# Advanced load balancer configuration

# Weighted round robin + backup server
upstream api_servers {
    # Weighted round robin
    server 10.0.1.1:8080 weight=5 max_fails=3 fail_timeout=30s;
    server 10.0.1.2:8080 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.1.3:8080 weight=2 max_fails=3 fail_timeout=30s;

    # Backup server (used only when all others are down)
    server 10.0.1.99:8080 backup;

    # Passive health check configuration:
    #   max_fails=3:    exclude after 3 consecutive failures
    #   fail_timeout=30s: recheck after 30 seconds

    # Connection keepalive
    keepalive 32;
    keepalive_timeout 60s;
    keepalive_requests 1000;
}

# Least Connections algorithm
upstream websocket_servers {
    least_conn;
    server 10.0.2.1:8080;
    server 10.0.2.2:8080;
    server 10.0.2.3:8080;
}

# IP Hash (session affinity)
upstream session_servers {
    ip_hash;
    server 10.0.3.1:8080;
    server 10.0.3.2:8080;
    server 10.0.3.3:8080;

    # Temporarily exclude a server (preserves hash values)
    # server 10.0.3.4:8080 down;
}

# SSL termination + path-based routing
server {
    listen 443 ssl http2;
    server_name api.example.com;

    # SSL certificate
    ssl_certificate     /etc/ssl/certs/api.example.com.crt;
    ssl_certificate_key /etc/ssl/private/api.example.com.key;

    # SSL security configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS header
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Path-based routing
    location /api/ {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket server
    location /ws/ {
        proxy_pass http://websocket_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;  # Longer timeout for WebSocket
    }

    # Health check endpoint (LB itself)
    location /health {
        access_log off;
        return 200 '{"status": "healthy"}';
        add_header Content-Type application/json;
    }

    # Static files (served directly)
    location /static/ {
        alias /var/www/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 5. HAProxy Load Balancing

### 5.1 HAProxy Basic Configuration

HAProxy is a high-performance load balancer that operates in both L4 and L7 modes. Combined with Linux kernel optimization, it can handle millions of simultaneous connections.

```haproxy
# /etc/haproxy/haproxy.cfg
# HAProxy basic configuration

#--------------------------------------------------
# Global configuration
#--------------------------------------------------
global
    log         /dev/log local0
    log         /dev/log local1 notice
    chroot      /var/lib/haproxy
    pidfile     /var/run/haproxy.pid
    maxconn     100000              # Maximum simultaneous connections
    user        haproxy
    group       haproxy
    daemon

    # SSL/TLS configuration
    ssl-default-bind-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256
    ssl-default-bind-options no-sslv3 no-tlsv10 no-tlsv11

    # Performance tuning
    tune.ssl.default-dh-param 2048
    tune.bufsize 32768
    tune.maxrewrite 1024

#--------------------------------------------------
# Default configuration
#--------------------------------------------------
defaults
    log     global
    mode    http                    # L7 mode (use tcp for L4)
    option  httplog
    option  dontlognull
    option  http-server-close       # Reuse server-side connections
    option  forwardfor              # Add X-Forwarded-For header
    option  redispatch              # Retry on another server when backend fails

    retries                 3       # Number of retries
    timeout http-request    10s     # Request receive timeout
    timeout queue           1m      # Queue wait timeout
    timeout connect         10s     # Backend connection timeout
    timeout client          1m      # Client-side timeout
    timeout server          1m      # Server-side timeout
    timeout http-keep-alive 10s     # Keep-Alive timeout
    timeout check           10s     # Health check timeout

    # Error pages
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

#--------------------------------------------------
# Stats dashboard
#--------------------------------------------------
listen stats
    bind *:8404
    mode http
    stats enable
    stats uri /stats
    stats refresh 10s
    stats admin if LOCALHOST          # Admin operations from localhost only
    stats auth admin:SecureP@ss123    # Authentication

#--------------------------------------------------
# Frontend: HTTPS reception
#--------------------------------------------------
frontend https_front
    bind *:443 ssl crt /etc/ssl/certs/example.com.pem alpn h2,http/1.1
    bind *:80

    # HTTP → HTTPS redirect
    http-request redirect scheme https unless { ssl_fc }

    # Security headers
    http-response set-header Strict-Transport-Security "max-age=31536000"
    http-response set-header X-Content-Type-Options nosniff
    http-response set-header X-Frame-Options DENY

    # ACL (Access Control List) based routing
    acl is_api     path_beg /api/
    acl is_ws      path_beg /ws/
    acl is_static  path_beg /static/
    acl is_admin   hdr(host) -i admin.example.com
    acl is_health  path /health

    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny deny_status 429 if { sc_http_req_rate(0) gt 100 }

    # Backend routing
    use_backend api_backend     if is_api
    use_backend ws_backend      if is_ws
    use_backend static_backend  if is_static
    use_backend admin_backend   if is_admin
    use_backend health_backend  if is_health
    default_backend web_backend

#--------------------------------------------------
# Backend: API server
#--------------------------------------------------
backend api_backend
    balance roundrobin
    option httpchk GET /health HTTP/1.1\r\nHost:\ api.internal
    http-check expect status 200

    # Connection Draining: wait for in-flight requests when removing a server
    default-server inter 5s fall 3 rise 2 slowstart 60s

    server api1 10.0.1.1:8080 check weight 5
    server api2 10.0.1.2:8080 check weight 3
    server api3 10.0.1.3:8080 check weight 2

#--------------------------------------------------
# Backend: WebSocket server
#--------------------------------------------------
backend ws_backend
    balance leastconn
    option httpchk GET /health

    # Extended timeout for WebSocket
    timeout server 3600s
    timeout tunnel 3600s

    server ws1 10.0.2.1:8080 check
    server ws2 10.0.2.2:8080 check
    server ws3 10.0.2.3:8080 check

#--------------------------------------------------
# Backend: Static file server
#--------------------------------------------------
backend static_backend
    balance roundrobin
    option httpchk GET /health

    http-response set-header Cache-Control "public, max-age=2592000"

    server static1 10.0.3.1:80 check
    server static2 10.0.3.2:80 check

#--------------------------------------------------
# Backend: Admin panel
#--------------------------------------------------
backend admin_backend
    balance roundrobin

    # IP restriction
    acl allowed_ip src 10.0.0.0/8 172.16.0.0/12
    http-request deny unless allowed_ip

    server admin1 10.0.4.1:8080 check
    server admin2 10.0.4.2:8080 check

#--------------------------------------------------
# Backend: Web server (default)
#--------------------------------------------------
backend web_backend
    balance roundrobin
    option httpchk GET /health
    cookie SERVERID insert indirect nocache

    server web1 10.0.5.1:8080 check cookie web1
    server web2 10.0.5.2:8080 check cookie web2
    server web3 10.0.5.3:8080 check cookie web3

#--------------------------------------------------
# Backend: Health check
#--------------------------------------------------
backend health_backend
    mode http
    http-request return status 200 content-type application/json \
        lf-string '{"status":"healthy","timestamp":"%[date]"}'
```

### 5.2 HAProxy L4 Mode Configuration

```haproxy
# /etc/haproxy/haproxy-l4.cfg
# L4 (TCP) mode configuration example: database proxy

defaults
    mode tcp
    log global
    option tcplog
    timeout connect 10s
    timeout client  30m
    timeout server  30m

# PostgreSQL primary
frontend pgsql_front
    bind *:5432
    default_backend pgsql_backend

backend pgsql_backend
    balance leastconn
    option pgsql-check user haproxy  # PostgreSQL-specific health check

    server pgsql1 10.0.10.1:5432 check inter 3s fall 3 rise 2
    server pgsql2 10.0.10.2:5432 check inter 3s fall 3 rise 2 backup

# Redis Sentinel configuration
frontend redis_front
    bind *:6379
    default_backend redis_backend

backend redis_backend
    balance first                    # Route to the first healthy server
    option tcp-check
    tcp-check send PING\r\n
    tcp-check expect string +PONG

    server redis1 10.0.11.1:6379 check inter 1s fall 3 rise 2
    server redis2 10.0.11.2:6379 check inter 1s fall 3 rise 2
    server redis3 10.0.11.3:6379 check inter 1s fall 3 rise 2
```

---

## 6. Health Check Design

### 6.1 Types and Stages of Health Checks

```
Three stages of health checks:

┌──────────────────────────────────────────────────────────┐
│                   Health Check Hierarchy                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Level 1: Infrastructure level                           │
│  ┌────────────────────────────────────────────┐          │
│  │ TCP port connection check                  │          │
│  │ → Can port 8080 be connected?              │          │
│  │ → Minimum confirmation that process is up  │          │
│  └────────────────────────────────────────────┘          │
│                    ↓                                      │
│  Level 2: Application level                              │
│  ┌────────────────────────────────────────────┐          │
│  │ HTTP endpoint response check               │          │
│  │ → GET /health → 200 OK                    │          │
│  │ → Confirms application is working normally │          │
│  └────────────────────────────────────────────┘          │
│                    ↓                                      │
│  Level 3: Dependent service level                        │
│  ┌────────────────────────────────────────────┐          │
│  │ Deep Health Check                          │          │
│  │ → DB connection, cache connection,         │          │
│  │   external API                             │          │
│  │ → Are all dependent services healthy?      │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  Use Level 1-2 for load balancers                        │
│  Level 3 is used in Kubernetes Readiness Probes, etc.    │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Health Check Endpoint Implementation Example

```python
# Health check implementation example (Python / FastAPI)
from fastapi import FastAPI, Response, status
from datetime import datetime, timezone
import asyncpg
import aioredis
import time

app = FastAPI()
start_time = time.time()

# === Liveness Check (L1: Is the process alive?) ===
@app.get("/healthz")
async def liveness():
    """
    Liveness probe: Confirms that the application process is alive.
    Always returns 200 (except when detecting a deadlock).
    Used for Kubernetes livenessProbe and basic LB health checks.
    """
    return {"status": "alive"}


# === Readiness Check (L2: Ready to accept requests?) ===
@app.get("/ready")
async def readiness():
    """
    Readiness probe: Confirms the service can process requests.
    Also used to check initialization completion after startup.
    Recommended for LB health checks.
    """
    checks = {}
    is_ready = True

    # Database connection check
    try:
        conn = await asyncpg.connect(
            host="db.internal", port=5432,
            user="app", password="secret", database="mydb",
            timeout=3
        )
        await conn.fetchval("SELECT 1")
        await conn.close()
        checks["database"] = "connected"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"
        is_ready = False

    # Redis connection check
    try:
        redis = aioredis.from_url("redis://cache.internal:6379")
        await redis.ping()
        await redis.close()
        checks["cache"] = "connected"
    except Exception as e:
        checks["cache"] = f"error: {str(e)}"
        is_ready = False

    uptime_seconds = int(time.time() - start_time)

    response_data = {
        "status": "ready" if is_ready else "not_ready",
        "checks": checks,
        "uptime_seconds": uptime_seconds,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    if not is_ready:
        return Response(
            content=json.dumps(response_data),
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json"
        )
    return response_data


# === Deep Health Check (L3: Status of all dependent services) ===
@app.get("/health/deep")
async def deep_health():
    """
    Deep health check: Returns detailed status of all dependent services.
    Called from monitoring systems or operation dashboards.
    Do NOT use for LB health checks (can cause cascading failures).
    """
    checks = {}

    # Check each dependent service (omitted: same as above)
    # ...

    return {
        "status": "healthy",
        "version": "2.3.1",
        "checks": checks,
        "system": {
            "uptime_seconds": int(time.time() - start_time),
            "memory_usage_mb": get_memory_usage(),
            "cpu_percent": get_cpu_usage()
        }
    }
```

### 6.3 Health Check Parameter Design Guidelines

```
Relationships between health check parameters:

  interval (check interval)
  ────┤    ├────┤    ├────┤    ├────
      check    check    check

  fail threshold (unhealthy threshold) = 3
  ────X────X────X──→ removed
       fail   fail  fail

  rise threshold (recovery threshold) = 2
  ────✓────✓──→ recovered
      pass  pass

  Maximum time to detect a failure:
    = interval × fail_threshold
    = 10s × 3 = 30s

  Recommended parameters:

  ┌────────────────────┬──────────┬─────────┬──────────┐
  │ Service type       │ interval │ fall    │ rise     │
  ├────────────────────┼──────────┼─────────┼──────────┤
  │ Web API            │ 10s      │ 3       │ 2        │
  │ Real-time comm.    │ 3s       │ 2       │ 2        │
  │ Batch processing   │ 30s      │ 5       │ 3        │
  │ Database           │ 5s       │ 3       │ 2        │
  │ Cache              │ 3s       │ 2       │ 1        │
  └────────────────────┴──────────┴─────────┴──────────┘

  Notes:
  ① Too short an interval puts load on the backend
  ② Too few fail count causes unnecessary removal on transient errors (flapping)
  ③ Too many rise count makes recovery take too long
  ④ Timeout must be set shorter than interval
```

### 6.4 Graceful Shutdown and Connection Draining

```
Graceful shutdown flow:

  Time ──────────────────────────────────────────→

  t=0: Shutdown begins
  │
  ├─ ① Change health check response to 503
  │     GET /health → 503 Service Unavailable
  │
  ├─ ② LB detects health check failure
  │     (interval × fall = 10s × 3 = 30s later)
  │
  ├─ ③ LB removes the server
  │     → New requests go to other servers
  │
  ├─ ④ Connection draining begins
  │     → Wait for in-flight requests to complete
  │     → Timeout: 300s (AWS ALB default)
  │
  └─ ⑤ Process stops
        → All requests completed or timeout

  Connection draining operation:

  ┌──────────────────────────────────────────────────┐
  │ Draining begins                                  │
  │                                                  │
  │ In-flight requests:                              │
  │   R1: ████████████████████████──→ complete       │
  │   R2: ██████████████──→ complete                 │
  │   R3: ████████████████████████████████──→ complete│
  │                                                  │
  │ New requests:                                    │
  │   R4: ──→ rejected (redirected to other server)  │
  │   R5: ──→ rejected                               │
  │                                                  │
  │ Process stops after all requests complete        │
  └──────────────────────────────────────────────────┘
```

---

## 7. AWS Load Balancers

### 7.1 ALB / NLB / GWLB Comparison

```
┌───────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Comparison item   │ ALB               │ NLB               │ GWLB              │
│                   │ (Application)     │ (Network)         │ (Gateway)         │
├───────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Layer             │ L7                │ L4                │ L3+L4             │
│ Protocol          │ HTTP, HTTPS,      │ TCP, UDP, TLS     │ IP protocol       │
│                   │ gRPC, WebSocket   │                   │                   │
│ Performance       │ Hundreds of K RPS │ Millions of RPS   │ -                 │
│ Latency           │ ms order          │ μs order          │ -                 │
│ Static IP         │ None (DNS name)   │ Yes (EIP support) │ Yes               │
│ TLS termination   │ Yes               │ Yes (TLS LB)      │ No                │
│ Path routing      │ Yes               │ No                │ No                │
│ Host routing      │ Yes               │ No                │ No                │
│ Health checks     │ HTTP/HTTPS/gRPC   │ TCP/HTTP/HTTPS    │ HTTP/HTTPS/TCP    │
│ Sticky Session    │ Cookie-based      │ Source IP-based   │ 5-tuple-based     │
│ WAF integration   │ Yes               │ No                │ No                │
│ Lambda integration│ Yes               │ No                │ No                │
│ Cross-zone        │ Enabled by default│ Disabled by default│ Disabled by default│
│ Pricing model     │ LCU-based         │ NLCU-based        │ GWLCU-based       │
│ Main use cases    │ Web apps, API     │ Gaming, IoT,      │ Security          │
│                   │ Microservices     │ financial trading  │ appliances        │
└───────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

### 7.2 ALB Architecture

```
ALB architecture:

  ┌─────────────────────────────────────────────────────────┐
  │                       Internet                          │
  └──────────────────────┬──────────────────────────────────┘
                         │
  ┌──────────────────────▼──────────────────────────────────┐
  │                    ALB (L7)                              │
  │  ┌──────────────────────────────────────────────┐       │
  │  │ Listener                                      │       │
  │  │   - HTTPS:443 → TLS termination              │       │
  │  │   - HTTP:80 → HTTPS redirect                  │       │
  │  └──────────────────────────────────────────────┘       │
  │                                                         │
  │  ┌──────────────────────────────────────────────┐       │
  │  │ Listener Rules                               │       │
  │  │   Priority 1: Host=api.*  → TG-api           │       │
  │  │   Priority 2: Path=/ws/* → TG-websocket      │       │
  │  │   Priority 3: Header=X-Api-Version:v2 → TG-v2│       │
  │  │   Default:    → TG-default                    │       │
  │  └──────────────────────────────────────────────┘       │
  └──┬────────────┬────────────┬────────────┬───────────────┘
     │            │            │            │
     ▼            ▼            ▼            ▼
  ┌──────┐   ┌──────┐   ┌──────────┐  ┌──────────┐
  │TG-api│   │TG-ws │   │TG-v2     │  │TG-default│
  ├──────┤   ├──────┤   ├──────────┤  ├──────────┤
  │ECS   │   │EC2   │   │ECS       │  │EC2       │
  │Fargate│  │i-xxx │   │Fargate   │  │i-yyy     │
  │      │   │i-yyy │   │          │  │i-zzz     │
  └──────┘   └──────┘   └──────────┘  └──────────┘

  Target Group (TG) settings:
    - Target type: instance / ip / lambda
    - Protocol: HTTP / HTTPS / gRPC
    - Health check: path, interval, thresholds
    - Sticky session: Cookie settings
    - Deregistration delay: connection draining
    - Slow start: gradually increase traffic to new targets
```

### 7.3 Building ALB with Terraform

```hcl
# terraform/modules/alb/main.tf
# AWS ALB + Target Group + Listener configuration

# --- ALB itself ---
resource "aws_lb" "main" {
  name               = "app-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = true    # Prevent accidental deletion
  enable_http2              = true     # Enable HTTP/2
  idle_timeout              = 60       # Idle timeout (seconds)
  drop_invalid_header_fields = true    # Drop invalid headers

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

# --- ALB security group ---
resource "aws_security_group" "alb_sg" {
  name_prefix = "alb-sg-"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from Internet (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- Target Group: API ---
resource "aws_lb_target_group" "api" {
  name                 = "api-tg"
  port                 = 8080
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"          # Use ip for Fargate
  deregistration_delay = 30            # Draining wait time

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 10
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 3600             # 1 hour
    enabled         = false
  }

  # Slow start: gradually increase traffic to new targets
  slow_start = 60                      # Ramp up to 100% over 60 seconds

  tags = {
    Service = "api"
  }
}

# --- Target Group: WebSocket ---
resource "aws_lb_target_group" "websocket" {
  name        = "ws-tg"
  port        = 8081
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/ws/health"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 3
    interval            = 5
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true             # Sticky recommended for WebSocket
  }
}

# --- HTTPS listener ---
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# --- HTTP → HTTPS redirect ---
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# --- Listener rule: WebSocket path ---
resource "aws_lb_listener_rule" "websocket" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.websocket.arn
  }

  condition {
    path_pattern {
      values = ["/ws/*"]
    }
  }
}

# --- Listener rule: API versioning ---
resource "aws_lb_listener_rule" "api_v2" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_v2.arn
  }

  condition {
    http_header {
      http_header_name = "X-Api-Version"
      values           = ["v2"]
    }
  }
}

# --- WAF integration ---
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = var.waf_web_acl_arn
}
```

### 7.4 Building NLB with Terraform

```hcl
# terraform/modules/nlb/main.tf
# AWS NLB (L4) configuration

resource "aws_lb" "nlb" {
  name               = "app-nlb"
  internal           = false
  load_balancer_type = "network"
  subnets            = var.public_subnet_ids

  enable_deletion_protection       = true
  enable_cross_zone_load_balancing = true  # Cross-zone LB

  # Assign static IP (Elastic IP)
  dynamic "subnet_mapping" {
    for_each = var.public_subnet_ids
    content {
      subnet_id     = subnet_mapping.value
      allocation_id = var.eip_allocation_ids[subnet_mapping.key]
    }
  }

  tags = {
    Environment = var.environment
    Service     = "game-server"
  }
}

# --- Target Group: TCP ---
resource "aws_lb_target_group" "tcp" {
  name        = "game-tcp-tg"
  port        = 7777
  protocol    = "TCP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  # TCP health check
  health_check {
    enabled             = true
    port                = "traffic-port"
    protocol            = "TCP"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 10
  }

  # Connection settings
  connection_termination = false
  deregistration_delay   = 300

  # Proxy Protocol v2 (preserve client IP)
  proxy_protocol_v2 = true

  stickiness {
    enabled = true
    type    = "source_ip"
  }
}

# --- UDP target group (game servers, etc.) ---
resource "aws_lb_target_group" "udp" {
  name        = "game-udp-tg"
  port        = 7778
  protocol    = "UDP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  health_check {
    enabled             = true
    port                = 7777         # Health check via TCP port
    protocol            = "TCP"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 10
  }
}

# --- TCP listener ---
resource "aws_lb_listener" "tcp" {
  load_balancer_arn = aws_lb.nlb.arn
  port              = 7777
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tcp.arn
  }
}

# --- TLS listener (TLS termination at NLB) ---
resource "aws_lb_listener" "tls" {
  load_balancer_arn = aws_lb.nlb.arn
  port              = 443
  protocol          = "TLS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tcp.arn
  }
}
```

---

## 8. High Availability (HA) Configuration

### 8.1 Active-Standby Configuration

The load balancer itself must not be a single point of failure, so an HA configuration is needed.

```
Active-Standby configuration:

  ┌──────────────────────────────────────────────────┐
  │              Virtual IP (VIP): 10.0.0.100         │
  │              DNS: lb.example.com                  │
  └──────────┬───────────────────┬────────────────────┘
             │                   │
    ┌────────▼────────┐ ┌───────▼─────────┐
    │ LB1 (Active)    │ │ LB2 (Standby)   │
    │ 10.0.0.1        │ │ 10.0.0.2        │
    │                 │ │                 │
    │ VRRP Master     │ │ VRRP Backup     │
    │ Priority: 100   │ │ Priority: 50    │
    │ ★ Holds VIP    │ │                 │
    └─────┬──┬──┬─────┘ └─────┬──┬──┬─────┘
          │  │  │              │  │  │
     ┌────▼──▼──▼──────────────▼──▼──▼────┐
     │        Backend server group          │
     │  S1    S2    S3    S4    S5    S6   │
     └────────────────────────────────────┘

  Failover:
  1. LB1 fails
  2. VRRP detects failure (within 2–3 seconds)
  3. LB2 takes over VIP and is promoted to Master
  4. Clients target the VIP and are unaware of the switch
  5. Downtime: approximately 1–3 seconds
```

### 8.2 Active-Active Configuration

```
Active-Active configuration:

  ┌───────────────────────────────────────────────┐
  │           DNS Round Robin                      │
  │  lb.example.com → 10.0.0.1, 10.0.0.2         │
  └───────┬───────────────────────┬───────────────┘
          │                       │
  ┌───────▼───────┐     ┌────────▼──────┐
  │ LB1 (Active)  │     │ LB2 (Active)  │
  │ 10.0.0.1      │     │ 10.0.0.2      │
  │ 50% traffic   │     │ 50% traffic   │
  └──┬──┬──┬──────┘     └──┬──┬──┬──────┘
     │  │  │                │  │  │
     └──┼──┼────────────────┼──┼──┘
        │  │                │  │
   ┌────▼──▼────────────────▼──▼────┐
   │      Backend server group       │
   │  S1    S2    S3    S4    S5    │
   └────────────────────────────────┘

  Advantages:
    - Both LBs always handle traffic → better resource efficiency
    - When one fails, the other continues handling requests

  Disadvantages:
    - DNS TTL issue (switchover may take time)
    - Session sharing mechanism required
```

### 8.3 VRRP Configuration with Keepalived

```bash
# /etc/keepalived/keepalived.conf
# Keepalived VRRP configuration (Active-Standby)

# --- Global configuration ---
global_defs {
    router_id LB1                    # Node identifier
    script_user root
    enable_script_security

    notification_email {
        ops@example.com              # Failure notification email
    }
    notification_email_from keepalived@example.com
    smtp_server smtp.example.com
    smtp_connect_timeout 30
}

# --- Script to check if HAProxy is alive ---
vrrp_script check_haproxy {
    script "/usr/bin/killall -0 haproxy"   # Check if process exists
    interval 2                              # Check every 2 seconds
    weight -20                              # Decrease priority by 20 on failure
    fall 3                                  # Mark unhealthy after 3 consecutive failures
    rise 2                                  # Mark healthy after 2 consecutive successes
}

# --- VRRP instance ---
vrrp_instance VI_1 {
    state MASTER                             # Initial state: MASTER
    interface eth0                           # Interface to monitor
    virtual_router_id 51                     # VRRP group ID (same for the pair)
    priority 100                             # Priority (higher = MASTER)
    advert_int 1                             # VRRP advertisement interval (seconds)

    authentication {
        auth_type PASS
        auth_pass secretpass                 # VRRP authentication password
    }

    # Virtual IP address
    virtual_ipaddress {
        10.0.0.100/24 dev eth0               # VIP for clients
    }

    # Monitor health check script
    track_script {
        check_haproxy
    }

    # Notification scripts on state transition
    notify_master "/etc/keepalived/notify.sh MASTER"
    notify_backup "/etc/keepalived/notify.sh BACKUP"
    notify_fault  "/etc/keepalived/notify.sh FAULT"
}
```

```bash
#!/bin/bash
# /etc/keepalived/notify.sh
# Notification script for VRRP state transitions

STATE=$1
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

case $STATE in
    "MASTER")
        echo "$TIMESTAMP: Transitioned to MASTER" >> /var/log/keepalived-notify.log
        # Notify via Slack/PagerDuty, etc.
        curl -s -X POST "https://hooks.slack.com/services/xxx" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"$(hostname) is now MASTER at $TIMESTAMP\"}"
        ;;
    "BACKUP")
        echo "$TIMESTAMP: Transitioned to BACKUP" >> /var/log/keepalived-notify.log
        ;;
    "FAULT")
        echo "$TIMESTAMP: FAULT detected" >> /var/log/keepalived-notify.log
        curl -s -X POST "https://hooks.slack.com/services/xxx" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"ALERT: $(hostname) entered FAULT state at $TIMESTAMP\"}"
        ;;
esac
```

---

## Prerequisites

Having the following knowledge before reading this guide will make understanding smoother.

- **TCP basics**: Understand the 3-way handshake, connection management, and TCP flags (SYN, ACK, FIN, RST). See [TCP Protocol](../01-protocols/00-tcp.md) for details.
- **HTTP basics**: Know the HTTP methods (GET/POST/PUT/DELETE), status codes, and the roles of request/response headers. See [HTTP Basics](../02-http/00-http-basics.md) for details.
- **DNS mechanism**: Understand the name resolution flow, A/AAAA records, and the concept of TTL. See [DNS](../00-introduction/03-dns.md) for details.
- **Linux command-line basics**: Know how to use basic tools such as `curl`, `ping`, `ss`/`netstat`.

---

## FAQ

### Q1: What are the selection criteria for L4 vs L7 load balancing?

**A:** Use the following criteria.

**Cases to choose L4:**
- Ultra-low latency is required (game servers, financial trading, real-time communication)
- Protocols that directly handle TCP/UDP (database proxy, VPN, DNS, mail server)
- TLS passthrough is needed (client certificate authentication performed at the backend)
- Large-scale connection handling (millions of simultaneous IoT device connections, etc.)
- Maximum throughput is the top priority (millions of RPS required)

**Cases to choose L7:**
- Path-based routing is needed (microservices architecture, API versioning)
- TLS termination at the LB (centralized certificate management, reduced backend load)
- A/B testing, canary deployments, blue-green deployments
- WAF (Web Application Firewall) integration
- Response compression, caching, and header manipulation
- WebSocket or gRPC routing controlled by HTTP paths

**Pattern combining both:**
- Deploy multiple L7 LBs (ALB/Nginx) and bundle them with an L4 LB (NLB)
- L4 distributes large volumes of traffic, while L7 provides fine-grained routing control

### Q2: How should health checks be designed?

**A:** Design health checks in three stages.

**Level 1: Infrastructure level (used for basic LB health checks)**
- TCP port connection check (`nc -zv <host> <port>`)
- Minimum liveness check only
- Failure = process is not running or port is closed

**Level 2: Application level (recommended for standard LB health checks)**
- HTTP endpoint response check (e.g., `GET /health → 200 OK`)
- Confirms the application is working normally
- Confirms response time is within threshold
- Lightweight connection check to dependent services (about `SELECT 1` to DB)

**Level 3: Deep health check (for monitoring systems and operators)**
- Detailed check of all dependent services (DB, cache, external API, queue, etc.)
- Provided at `/health/deep` or `/health/detailed` endpoints
- Do NOT use for LB health checks (can cause cascading failures)

**Health check parameter design guidelines:**

| Service type | interval | fall (unhealthy threshold) | rise (healthy threshold) | timeout |
|------------|---------|---------------------|-------------------|---------|
| Web API | 10s | 3 times | 2 times | 5s |
| Real-time communication | 3s | 2 times | 2 times | 2s |
| Batch processing | 30s | 5 times | 3 times | 10s |
| Database | 5s | 3 times | 2 times | 3s |

**Notes:**
- Too short an `interval` puts load on the backend
- Too few `fall` causes unnecessary removal on transient errors (flapping)
- Too many `rise` makes recovery take too long
- `timeout` must always be set shorter than `interval`

### Q3: How should session affinity (Session Affinity) be implemented?

**A:** Choose the following method based on the nature of the application.

**Recommended: Stateless design + external store (most robust)**
- Store session information in Redis or DynamoDB
- Load balancer distributes freely with round robin
- Sessions can continue on other servers even if one fails
- Sessions are maintained even when horizontally scaling

**Method 1: Cookie-based (used with L7 LB)**
```nginx
# Nginx example
upstream backend {
    server 10.0.1.1:8080;
    server 10.0.1.2:8080;
    server 10.0.1.3:8080;
    sticky cookie srv_id expires=1h domain=.example.com path=/;
}
```
- LB issues a Cookie and routes to the same server
- For AWS ALB: enable the Stickiness setting in Target Group
- Advantage: No application-side changes needed
- Disadvantage: Session loss on server failure, Cookie tampering risk

**Method 2: IP Hash (used with L4 LB)**
```haproxy
backend app_backend
    balance source  # Hash by source IP
    server app1 10.0.1.1:8080
    server app2 10.0.1.2:8080
    server app3 10.0.1.3:8080
```
- Fixes routing destination by client IP
- For AWS NLB: sticky by source IP is the default behavior
- Advantage: No Cookie needed, simple
- Disadvantage: Clients behind NAT all concentrate on the same server; session loss on IP change

**Method 3: Application level (JWT, etc.)**
```javascript
// Including server ID in JWT (not recommended)
const token = jwt.sign({ userId: 123, serverId: 'app-2' }, secret);

// Recommended: use JWT but manage sessions with an external store
const token = jwt.sign({ userId: 123, sessionId: 'uuid' }, secret);
// Retrieve session info from Redis using sessionId
```
- Include server identifier in JWT token
- Or combine JWT + external store
- Advantage: Does not depend on LB, shareable between microservices
- Disadvantage: High implementation cost

**Conclusion: Strongly recommend stateless + external store for new systems. Use Cookie-based only when migration of existing systems is difficult.**

---

## Summary

| Concept | Key points |
|---------|-----------|
| L4 vs L7 | L4=fast/low-feature, L7=flexible/high-feature; choose based on use case |
| Algorithms | Round Robin (basic), Least Connections (long connections), Consistent Hashing (cache) |
| Health checks | 3-stage design (infra/app/deep); use Level 1-2 for LB |
| Sessions | Stateless + external store is best, Cookie-based as second choice |
| HA configuration | VRRP/Keepalived for active-standby, DNS RR for active-active |
| AWS | ALB=L7/microservices, NLB=L4/ultra-fast, GWLB=security appliances |
| Operations | Zero-downtime deployment with graceful shutdown + connection draining |

---

## Next Guides to Read

After understanding load balancing, it is recommended to proceed to the following topics.

- **[CDN (Content Delivery Network)](./01-cdn.md)**: As an extension of load balancing, learn about geographically distributed content delivery networks and cache strategies
- **[Network Debugging](./02-network-debugging.md)**: Master debugging tools and troubleshooting methods to isolate problems in load balancers and backends
- **[Performance Optimization](./03-performance.md)**: Practice comprehensive network performance tuning based on load balancing design

---

## References

1. Nginx. "HTTP Load Balancing." nginx.org, 2024.
2. HAProxy Technologies. "HAProxy Configuration Manual." haproxy.com, 2024.
3. AWS. "Elastic Load Balancing Documentation." docs.aws.amazon.com, 2024.
4. Karger, D., et al. "Consistent Hashing and Random Trees: Distributed Caching Protocols for Relieving Hot Spots on the World Wide Web." ACM, 1997.
5. RFC 5798. "Virtual Router Redundancy Protocol (VRRP) Version 3." IETF, 2010.
6. Google. "The Google File System." SOSP, 2003.
