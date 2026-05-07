# Reverse Proxy

> Implement SSL termination, load balancing, and automatic service discovery in a Docker environment using Nginx / Traefik reverse proxy configurations.

---

## What You Will Learn

1. Understand the **characteristics and use cases of Nginx and Traefik**
2. Learn how to configure **SSL/TLS termination and automatic Let's Encrypt certificates**
3. Be able to build **dynamic routing and load balancing with Docker integration**
4. Learn configuration patterns for **WebSocket, gRPC, and TCP/UDP proxies**
5. Understand alternative reverse proxy options including **Caddy**
6. Be able to implement advanced security configurations including **mTLS, CORS, and WAF**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content of [Volumes and Storage](./01-volume-and-storage.md)

---

## 1. What Is a Reverse Proxy?

A reverse proxy sits between clients and backend servers, acting as a gateway that routes requests to the appropriate service.

### Role of a Reverse Proxy

```
Client (Browser)
    │
    │ HTTPS (443)
    ▼
┌──────────────────────────────────────────┐
│         Reverse Proxy                    │
│  ┌────────────────────────────────────┐  │
│  │  - SSL/TLS Termination             │  │
│  │  - Routing (Host/Path-based)       │  │
│  │  - Load Balancing                  │  │
│  │  - Rate Limiting                   │  │
│  │  - Response Caching                │  │
│  │  - gzip Compression               │  │
│  │  - Security Header Injection       │  │
│  └───────────┬────────────────────────┘  │
│              │ HTTP (80) Internal        │
│    ┌─────────┼─────────────┐             │
│    ▼         ▼             ▼             │
│ ┌──────┐ ┌──────┐    ┌──────┐          │
│ │ App1 │ │ App2 │    │ App3 │          │
│ │:3000 │ │:8080 │    │:5000 │          │
│ └──────┘ └──────┘    └──────┘          │
└──────────────────────────────────────────┘
```

### Key Features of a Reverse Proxy

| Feature | Description | Benefit |
|---------|-------------|---------|
| SSL/TLS Termination | Handles encrypted communication with clients | Backend can use plain HTTP only |
| Routing | Distributes requests based on Host/Path | Operate multiple services on a single IP |
| Load Balancing | Spreads load across multiple instances | Improved scalability and availability |
| Rate Limiting | Controls the number of requests | DDoS protection, API security |
| Caching | Caches responses | Reduces backend load, improves response speed |
| Compression | Compresses responses with gzip/Brotli | Reduces bandwidth, improves page speed |
| Security Headers | HSTS, CSP, X-Frame-Options, etc. | Prevents XSS, clickjacking |
| Access Logs | Records and analyzes requests | Auditing and troubleshooting |
| Authentication | Basic Auth, OAuth2 proxy | Offloads authentication from the backend |

### Nginx vs Traefik vs Caddy Comparison

| Property | Nginx | Traefik | Caddy |
|----------|-------|---------|-------|
| Configuration | Static config files | Dynamic (Docker API integration) | Caddyfile / JSON API |
| Docker Integration | Manual config or templates | Auto-detection via labels | Docker modules (plugins) |
| SSL Certificates | Manual or certbot | Built-in ACME (auto-obtain & renew) | Built-in ACME (automatic, HTTPS by default) |
| Dashboard | Paid (Nginx Plus) | Free and built-in | None (via API) |
| Performance | Very high | High | High |
| Learning Curve | Low (widely known) | Medium | Low (simple syntax) |
| Use Case | Stable, high-performance needs | Docker/K8s dynamic environments | Simple HTTPS environments |
| Middleware | Extended via modules | Built-in middleware | Handler chains |
| TCP/UDP Proxy | stream module | TCP Router | Layer 4 support |
| HTTP/3 Support | Experimental | Supported in v3.x | Supported by default |
| Config Reload | `nginx -s reload` | Automatic (hot reload) | Automatic (via API) |
| Memory Usage | Very low | Moderate | Low |

### Selection Flowchart

```
Choosing a Reverse Proxy
    │
    ├─ Do services dynamically scale up/down in Docker/K8s?
    │   ├─ Yes → Traefik recommended
    │   └─ No ─┐
    │          │
    ├─ Just want simple HTTPS with minimal setup?
    │   ├─ Yes → Caddy recommended
    │   └─ No ─┐
    │          │
    ├─ Need high performance and fine-grained tuning?
    │   ├─ Yes → Nginx recommended
    │   └─ No ─┐
    │          │
    └─ Nginx (reliable, with extensive documentation)
```

---

## 2. Nginx Reverse Proxy

### Code Example 1: Basic Nginx Reverse Proxy

```yaml
# docker-compose.yml
version: "3.9"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - proxy-net
    depends_on:
      - app
      - api

  app:
    image: my-frontend:latest
    networks:
      - proxy-net
    # Do not expose ports (access via Nginx only)

  api:
    image: my-api:latest
    networks:
      - proxy-net

networks:
  proxy-net:
    driver: bridge
```

```nginx
# nginx/conf.d/default.conf
upstream frontend {
    server app:3000;
}

upstream backend {
    server api:8080;
}

server {
    listen 80;
    server_name example.com;

    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Code Example 2: Nginx Load Balancing

```nginx
# nginx/conf.d/load-balance.conf

# Round robin (default)
upstream app_round_robin {
    server app-1:8080;
    server app-2:8080;
    server app-3:8080;
}

# Weighted round robin
upstream app_weighted {
    server app-1:8080 weight=5;  # 50% of requests
    server app-2:8080 weight=3;  # 30% of requests
    server app-3:8080 weight=2;  # 20% of requests
}

# Least connections
upstream app_least_conn {
    least_conn;
    server app-1:8080;
    server app-2:8080;
    server app-3:8080;
}

# IP hash (session persistence)
upstream app_ip_hash {
    ip_hash;
    server app-1:8080;
    server app-2:8080;
    server app-3:8080;
}

# With health check
upstream app_health {
    server app-1:8080 max_fails=3 fail_timeout=30s;
    server app-2:8080 max_fails=3 fail_timeout=30s;
    server app-backup:8080 backup;  # Fallback when all servers are down
}

server {
    listen 80;

    location / {
        proxy_pass http://app_least_conn;
        proxy_next_upstream error timeout http_502 http_503;
        proxy_next_upstream_tries 3;
    }
}
```

### Load Balancing Algorithm Comparison

| Algorithm | Method | Characteristics | Use Case |
|-----------|--------|-----------------|----------|
| round_robin | Sequential distribution | Simple, even distribution | Stateless APIs |
| weighted | Weighted sequential | Accounts for server performance differences | Servers with different specs |
| least_conn | Fewest connections | Dynamically balances load | When processing times vary |
| ip_hash | IP-based | Same client goes to same server | When session persistence is required |
| hash | Hash of arbitrary key | Flexible, e.g., URI-based | Cache optimization |
| random two | Least connections from 2 random servers | Suited for distributed environments | Large-scale clusters |

### Code Example: Nginx Response Cache

```nginx
# nginx/conf.d/cache.conf

# Cache zone definition
proxy_cache_path /var/cache/nginx/api
    levels=1:2
    keys_zone=api_cache:10m
    max_size=1g
    inactive=60m
    use_temp_path=off;

proxy_cache_path /var/cache/nginx/static
    levels=1:2
    keys_zone=static_cache:10m
    max_size=5g
    inactive=7d
    use_temp_path=off;

server {
    listen 443 ssl http2;
    server_name example.com;

    # Static file cache
    location /static/ {
        proxy_pass http://frontend;
        proxy_cache static_cache;
        proxy_cache_valid 200 7d;
        proxy_cache_valid 404 1m;
        proxy_cache_use_stale error timeout updating http_502 http_503;

        # Add cache status to response header (for debugging)
        add_header X-Cache-Status $upstream_cache_status;
    }

    # API response cache (GET only)
    location /api/ {
        proxy_pass http://backend;
        proxy_cache api_cache;
        proxy_cache_methods GET HEAD;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 404 1m;
        proxy_cache_bypass $http_cache_control;
        proxy_no_cache $http_pragma;

        # Do not cache POST requests
        proxy_cache_bypass $request_method;

        add_header X-Cache-Status $upstream_cache_status;
    }

    # Cache purge endpoint (using proxy_cache_purge as Nginx Plus equivalent)
    location /purge/ {
        allow 10.0.0.0/8;
        deny all;
        proxy_cache_purge api_cache $scheme$proxy_host$request_uri;
    }
}
```

```yaml
# docker-compose.yml (with cache volume)
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx-cache:/var/cache/nginx
    tmpfs:
      - /var/cache/nginx/tmp:size=256m
    networks:
      - proxy-net

volumes:
  nginx-cache:
```

### Code Example: Nginx Rate Limiting

```nginx
# nginx/conf.d/rate-limit.conf

# Rate limit zone definition
# $binary_remote_addr: limit per client IP
# zone: shared memory zone name and size (1MB ≈ 16,000 IPs)
# rate: number of requests per second
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=1r/s;
limit_req_zone $server_name zone=global_limit:10m rate=1000r/s;

# Connection count limit
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

server {
    listen 443 ssl http2;
    server_name api.example.com;

    # Global connection limit (up to 100 connections per IP)
    limit_conn conn_limit 100;

    # Rate limiting for API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        # burst: number of requests allowed in a burst
        # nodelay: process burst requests immediately (no queuing)

        limit_req_status 429;
        limit_req_log_level warn;

        proxy_pass http://backend;
    }

    # Login endpoint (strict limit)
    location /api/auth/login {
        limit_req zone=login_limit burst=5;

        # Custom error page when rate limit is exceeded
        error_page 429 = @rate_limited;

        proxy_pass http://backend;
    }

    # JSON response when rate limited
    location @rate_limited {
        default_type application/json;
        return 429 '{"error": "Too Many Requests", "retry_after": 60}';
    }
}
```

### Code Example: Nginx WebSocket Proxy

```nginx
# nginx/conf.d/websocket.conf

# WebSocket connection map
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream websocket_backend {
    # Sticky session (WebSocket requires connecting to the same server)
    ip_hash;
    server ws-app-1:8080;
    server ws-app-2:8080;
}

server {
    listen 443 ssl http2;
    server_name ws.example.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # WebSocket endpoint
    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket connection timeout settings
        proxy_read_timeout 86400s;   # 24 hours
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;

        # Disable buffering (for real-time communication)
        proxy_buffering off;
    }

    # For Socket.IO (including polling fallback)
    location /socket.io/ {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_read_timeout 86400s;
        proxy_buffering off;
    }
}
```

### Code Example: Nginx gRPC Proxy

```nginx
# nginx/conf.d/grpc.conf

upstream grpc_backend {
    server grpc-app:50051;
}

server {
    listen 443 ssl http2;
    server_name grpc.example.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # gRPC proxy
    location / {
        grpc_pass grpc://grpc_backend;

        # gRPC health check
        grpc_set_header Host $host;

        # Timeout settings (for long-running streaming)
        grpc_read_timeout 300s;
        grpc_send_timeout 300s;

        # Error handling
        error_page 502 = /error502grpc;
    }

    # gRPC error response
    location = /error502grpc {
        internal;
        default_type application/grpc;
        add_header grpc-status 14;
        add_header grpc-message "Upstream unavailable";
        return 204;
    }
}
```

```yaml
# docker-compose.yml (gRPC service configuration)
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - proxy-net

  grpc-app:
    image: my-grpc-service:latest
    networks:
      - proxy-net
    # Do not expose ports (access via Nginx only)

networks:
  proxy-net:
    driver: bridge
```

### Code Example: Nginx Stream Module (TCP/UDP Proxy)

```nginx
# nginx/nginx.conf (main context)

# TCP/UDP load balancing
stream {
    # MySQL (TCP)
    upstream mysql_backend {
        server db-primary:3306;
        server db-replica-1:3306 backup;
    }

    server {
        listen 3306;
        proxy_pass mysql_backend;
        proxy_timeout 300s;
        proxy_connect_timeout 10s;
    }

    # Redis (TCP)
    upstream redis_backend {
        hash $remote_addr consistent;
        server redis-1:6379;
        server redis-2:6379;
        server redis-3:6379;
    }

    server {
        listen 6379;
        proxy_pass redis_backend;
        proxy_timeout 300s;
    }

    # DNS (UDP)
    upstream dns_backend {
        server dns-1:53;
        server dns-2:53;
    }

    server {
        listen 53 udp;
        proxy_pass dns_backend;
        proxy_timeout 5s;
        proxy_responses 1;
    }

    # SSL Passthrough (delegate SSL termination to backend)
    upstream ssl_passthrough {
        server app:443;
    }

    server {
        listen 8443;
        proxy_pass ssl_passthrough;
        proxy_protocol on;
    }
}
```

```yaml
# docker-compose.yml (Nginx Stream configuration)
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
      - "3306:3306"
      - "6379:6379"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    networks:
      - proxy-net
      - db-net

  db-primary:
    image: mysql:8
    networks:
      - db-net

networks:
  proxy-net:
  db-net:
    internal: true
```

---

## 3. Traefik Reverse Proxy

Traefik integrates natively with Docker, automatically detecting container starts and stops to dynamically update its routing table.

### Code Example 3: Basic Traefik Configuration

```yaml
# docker-compose.yml
version: "3.9"

services:
  traefik:
    image: traefik:v3.1
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entryPoints.web.address=:80"
      - "--entryPoints.websecure.address=:443"
      # Let's Encrypt automatic certificates
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks:
      - proxy
    labels:
      # Traefik dashboard configuration
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.example.com`)"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.middlewares=auth"
      - "traefik.http.middlewares.auth.basicauth.users=admin:$$apr1$$xyz..."

  # --- Application Services ---
  frontend:
    image: my-frontend:latest
    networks:
      - proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`app.example.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"

  api:
    image: my-api:latest
    networks:
      - proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`app.example.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
      - "traefik.http.services.api.loadbalancer.server.port=8080"
      # Middleware: strip API path prefix
      - "traefik.http.routers.api.middlewares=api-strip"
      - "traefik.http.middlewares.api-strip.stripprefix.prefixes=/api"

networks:
  proxy:
    driver: bridge

volumes:
  letsencrypt:
```

### Traefik Service Discovery Flow

```
┌─────────────────────────────────────────────────────┐
│                   Docker Host                       │
│                                                     │
│  ┌──────────┐                                      │
│  │ Traefik  │◄───── Docker Socket (/var/run/...)   │
│  │          │       Watches container labels        │
│  └────┬─────┘                                      │
│       │                                             │
│       │  Detects new container startup              │
│       │  Generates routing rules from labels        │
│       │                                             │
│       │  e.g. Host(`app.example.com`)               │
│       │      → routes to frontend:3000              │
│       │                                             │
│  ┌────▼────────────────────────────────────────┐   │
│  │              Routing Table                  │   │
│  │                                              │   │
│  │  app.example.com      → frontend:3000       │   │
│  │  app.example.com/api  → api:8080            │   │
│  │  admin.example.com    → admin:4000          │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Code Example 4: Traefik Middleware Chain

```yaml
# docker-compose.yml (service section)
services:
  api:
    image: my-api:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.example.com`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"

      # Middleware chain
      - "traefik.http.routers.api.middlewares=rate-limit,compress,headers"

      # Rate limiting
      - "traefik.http.middlewares.rate-limit.ratelimit.average=100"
      - "traefik.http.middlewares.rate-limit.ratelimit.burst=50"
      - "traefik.http.middlewares.rate-limit.ratelimit.period=1m"

      # gzip compression
      - "traefik.http.middlewares.compress.compress=true"

      # Security headers
      - "traefik.http.middlewares.headers.headers.stsSeconds=31536000"
      - "traefik.http.middlewares.headers.headers.stsIncludeSubdomains=true"
      - "traefik.http.middlewares.headers.headers.frameDeny=true"
      - "traefik.http.middlewares.headers.headers.contentTypeNosniff=true"
      - "traefik.http.middlewares.headers.headers.browserXssFilter=true"

      # CORS settings
      - "traefik.http.middlewares.headers.headers.accessControlAllowOriginList=https://app.example.com"
      - "traefik.http.middlewares.headers.headers.accessControlAllowMethods=GET,POST,PUT,DELETE"
      - "traefik.http.middlewares.headers.headers.accessControlAllowHeaders=Content-Type,Authorization"
```

### Code Example: Traefik File Provider

In addition to Docker labels, routing rules can be defined in YAML/TOML files. This is useful for external services and backends that are not Docker containers.

```yaml
# docker-compose.yml
services:
  traefik:
    image: traefik:v3.1
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.file.directory=/etc/traefik/dynamic"
      - "--providers.file.watch=true"
      - "--entryPoints.web.address=:80"
      - "--entryPoints.websecure.address=:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/dynamic:/etc/traefik/dynamic:ro
    ports:
      - "80:80"
      - "443:443"
```

```yaml
# traefik/dynamic/external-services.yml
http:
  routers:
    # Routing to external services
    legacy-api:
      rule: "Host(`api.example.com`) && PathPrefix(`/v1`)"
      service: legacy-api-service
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - api-headers

    # Static file server
    cdn:
      rule: "Host(`cdn.example.com`)"
      service: cdn-service
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  services:
    legacy-api-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.100:8080"
          - url: "http://192.168.1.101:8080"
        healthCheck:
          path: /health
          interval: "10s"
          timeout: "3s"

    cdn-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.200:80"

  middlewares:
    api-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Source: "traefik"
        customResponseHeaders:
          X-Custom-Header: "my-value"
```

### Code Example: Traefik TCP/UDP Routing

```yaml
# docker-compose.yml
services:
  traefik:
    image: traefik:v3.1
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entryPoints.web.address=:80"
      - "--entryPoints.websecure.address=:443"
      - "--entryPoints.mysql.address=:3306"
      - "--entryPoints.postgres.address=:5432"
      - "--entryPoints.redis.address=:6379"
    ports:
      - "80:80"
      - "443:443"
      - "3306:3306"
      - "5432:5432"
      - "6379:6379"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  # MySQL TCP routing
  mysql:
    image: mysql:8
    labels:
      - "traefik.enable=true"
      - "traefik.tcp.routers.mysql.rule=HostSNI(`*`)"
      - "traefik.tcp.routers.mysql.entrypoints=mysql"
      - "traefik.tcp.services.mysql.loadbalancer.server.port=3306"

  # PostgreSQL TCP routing (with TLS)
  postgres:
    image: postgres:16-alpine
    labels:
      - "traefik.enable=true"
      - "traefik.tcp.routers.postgres.rule=HostSNI(`db.example.com`)"
      - "traefik.tcp.routers.postgres.entrypoints=postgres"
      - "traefik.tcp.routers.postgres.tls=true"
      - "traefik.tcp.routers.postgres.tls.certresolver=letsencrypt"
      - "traefik.tcp.services.postgres.loadbalancer.server.port=5432"

  # Redis TCP routing
  redis:
    image: redis:7-alpine
    labels:
      - "traefik.enable=true"
      - "traefik.tcp.routers.redis.rule=HostSNI(`*`)"
      - "traefik.tcp.routers.redis.entrypoints=redis"
      - "traefik.tcp.services.redis.loadbalancer.server.port=6379"
```

### Code Example: Traefik WebSocket & gRPC

```yaml
# docker-compose.yml
services:
  traefik:
    image: traefik:v3.1
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entryPoints.web.address=:80"
      - "--entryPoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  # WebSocket service
  ws-app:
    image: my-websocket-app:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ws.rule=Host(`ws.example.com`)"
      - "traefik.http.routers.ws.entrypoints=websecure"
      - "traefik.http.routers.ws.tls.certresolver=letsencrypt"
      - "traefik.http.services.ws.loadbalancer.server.port=8080"
      # Traefik supports WebSocket by default (no special configuration needed)
      # Sticky session (for WebSocket)
      - "traefik.http.services.ws.loadbalancer.sticky.cookie=true"
      - "traefik.http.services.ws.loadbalancer.sticky.cookie.name=ws_session"

  # gRPC service
  grpc-app:
    image: my-grpc-service:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grpc.rule=Host(`grpc.example.com`)"
      - "traefik.http.routers.grpc.entrypoints=websecure"
      - "traefik.http.routers.grpc.tls.certresolver=letsencrypt"
      - "traefik.http.services.grpc.loadbalancer.server.port=50051"
      # Use h2c scheme for gRPC
      - "traefik.http.services.grpc.loadbalancer.server.scheme=h2c"
```

### Traefik Middleware Reference

| Middleware | Purpose | Label Example |
|------------|---------|---------------|
| AddPrefix | Add a prefix to the path | `addprefix.prefix=/api` |
| StripPrefix | Remove a prefix from the path | `stripprefix.prefixes=/api` |
| RateLimit | Rate limiting | `ratelimit.average=100` |
| BasicAuth | Basic authentication | `basicauth.users=user:hash` |
| DigestAuth | Digest authentication | `digestauth.users=user:realm:hash` |
| ForwardAuth | Delegate to external auth server | `forwardauth.address=http://auth:9000` |
| Headers | Add custom headers | `headers.frameDeny=true` |
| Compress | gzip compression | `compress=true` |
| IPWhiteList | IP restriction | `ipallowlist.sourcerange=10.0.0.0/8` |
| Retry | Retry | `retry.attempts=3` |
| CircuitBreaker | Circuit breaker | `circuitbreaker.expression=...` |
| Buffering | Request/response buffering | `buffering.maxRequestBodyBytes=2000000` |
| Chain | Combine multiple middlewares | `chain.middlewares=auth,ratelimit` |
| RedirectScheme | HTTPS redirect | `redirectscheme.scheme=https` |
| InFlightReq | Limit concurrent requests | `inflightreq.amount=10` |
| PassTLSClientCert | Forward mTLS client certificate | `passtlsclientcert.pem=true` |

---

## 4. SSL/TLS Configuration

### Code Example 5: Let's Encrypt + Nginx (certbot)

```yaml
# docker-compose.yml
version: "3.9"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot-webroot:/var/www/certbot:ro
      - certbot-certs:/etc/letsencrypt:ro
    networks:
      - proxy-net

  certbot:
    image: certbot/certbot
    volumes:
      - certbot-webroot:/var/www/certbot
      - certbot-certs:/etc/letsencrypt
    # Initial certificate acquisition
    command: >
      certonly --webroot
      --webroot-path=/var/www/certbot
      --email admin@example.com
      --agree-tos --no-eff-email
      -d example.com -d www.example.com

volumes:
  certbot-webroot:
  certbot-certs:

networks:
  proxy-net:
```

```nginx
# nginx/conf.d/default.conf
server {
    listen 80;
    server_name example.com www.example.com;

    # For ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Mozilla recommended SSL settings (Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Automatic certificate renewal (cron or docker-compose)
# Renewal script
#!/bin/bash
docker compose run --rm certbot renew --quiet
docker compose exec nginx nginx -s reload
```

### SSL/TLS Configuration Best Practices

```nginx
# nginx/conf.d/ssl-params.conf
# Recommended settings based on Mozilla SSL Configuration Generator (Intermediate)

# Protocol: Allow only TLS 1.2 / 1.3 (TLS 1.0/1.1 have known vulnerabilities)
ssl_protocols TLSv1.2 TLSv1.3;

# Cipher suites (for TLS 1.2; TLS 1.3 determines cipher suites at the protocol level)
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

# Do not use server-side cipher suite preference (not needed for TLS 1.3)
ssl_prefer_server_ciphers off;

# DH parameters (improves key exchange security)
ssl_dhparam /etc/nginx/ssl/dhparam.pem;
# Generate command: openssl dhparam -out dhparam.pem 4096

# Session settings
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;  # Approximately 40,000 sessions
ssl_session_tickets off;

# OCSP Stapling (proxy verifies certificate validity)
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;

# Security headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
```

### Testing SSL Configuration

```bash
#!/bin/bash
# ssl-test.sh - SSL configuration verification script

DOMAIN="example.com"

echo "=== SSL Certificate Info ==="
echo | openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} 2>/dev/null | openssl x509 -noout -dates -subject -issuer

echo ""
echo "=== TLS Protocol Test ==="
for proto in tls1 tls1_1 tls1_2 tls1_3; do
    result=$(echo | openssl s_client -connect ${DOMAIN}:443 -${proto} 2>&1)
    if echo "$result" | grep -q "Cipher is"; then
        echo "${proto}: ENABLED"
    else
        echo "${proto}: DISABLED"
    fi
done

echo ""
echo "=== Cipher Suites ==="
nmap --script ssl-enum-ciphers -p 443 ${DOMAIN}

echo ""
echo "=== Security Headers ==="
curl -sI https://${DOMAIN} | grep -iE "strict-transport|x-frame|x-content-type|x-xss|referrer-policy|content-security|permissions-policy"

echo ""
echo "=== SSL Labs Test ==="
echo "https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN}"
```

### mTLS (Mutual TLS Authentication)

```nginx
# nginx/conf.d/mtls.conf

server {
    listen 443 ssl http2;
    server_name api-internal.example.com;

    # Server certificate
    ssl_certificate     /etc/nginx/ssl/server.pem;
    ssl_certificate_key /etc/nginx/ssl/server-key.pem;

    # Client certificate verification (mTLS)
    ssl_client_certificate /etc/nginx/ssl/ca.pem;
    ssl_verify_client on;
    ssl_verify_depth 2;

    # Forward client certificate info to backend
    location / {
        proxy_pass http://internal-api:8080;
        proxy_set_header X-Client-CN $ssl_client_s_dn_cn;
        proxy_set_header X-Client-Serial $ssl_client_serial;
        proxy_set_header X-Client-Verify $ssl_client_verify;
    }
}
```

```yaml
# docker-compose.yml (mTLS configuration)
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./ssl/server.pem:/etc/nginx/ssl/server.pem:ro
      - ./ssl/server-key.pem:/etc/nginx/ssl/server-key.pem:ro
      - ./ssl/ca.pem:/etc/nginx/ssl/ca.pem:ro
    networks:
      - proxy-net

  internal-api:
    image: my-internal-api:latest
    networks:
      - proxy-net
```

```bash
# Connection test using client certificate
curl -v \
  --cert client.pem \
  --key client-key.pem \
  --cacert ca.pem \
  https://api-internal.example.com/health
```

---

## 5. Caddy Reverse Proxy

Caddy is a modern reverse proxy that provides automatic HTTPS by default. Its configuration is very simple, making it well-suited for small to medium-scale environments.

### Code Example: Caddy Basic Configuration

```
# Caddyfile
{
    email admin@example.com
    # Automatic HTTPS (enabled by default, uses Let's Encrypt)
}

# Frontend
app.example.com {
    reverse_proxy frontend:3000
}

# API server (path-based)
app.example.com {
    handle /api/* {
        reverse_proxy api:8080
    }
    handle {
        reverse_proxy frontend:3000
    }
}

# Load balancing
app.example.com {
    reverse_proxy app-1:8080 app-2:8080 app-3:8080 {
        lb_policy least_conn
        health_uri /health
        health_interval 10s
        health_timeout 5s

        # Header settings
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
    }
}

# WebSocket
ws.example.com {
    reverse_proxy ws-app:8080
    # Caddy automatically supports WebSocket
}

# Security headers
*.example.com {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options DENY
        X-Content-Type-Options nosniff
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }
}
```

```yaml
# docker-compose.yml (Caddy configuration)
version: "3.9"

services:
  caddy:
    image: caddy:2-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3 (QUIC)
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data        # Certificate storage
      - caddy-config:/config    # Caddy configuration
    networks:
      - proxy

  frontend:
    image: my-frontend:latest
    networks:
      - proxy

  api:
    image: my-api:latest
    networks:
      - proxy

networks:
  proxy:

volumes:
  caddy-data:
  caddy-config:
```

### Caddy vs Nginx vs Traefik: Use Case Recommendations

| Use Case | Recommended | Reason |
|----------|-------------|--------|
| Personal blog / small site | Caddy | Automatic HTTPS with minimal configuration |
| Microservices (Docker) | Traefik | Dynamic service discovery |
| High-traffic API | Nginx | High performance, low memory |
| Kubernetes Ingress | Traefik / Nginx Ingress | Ecosystem integration |
| Internal tools | Caddy | Simple, fast setup |
| Legacy system integration | Nginx | Rich modules and configuration examples |

---

## 6. Practical Configuration: Multi-Service Production Environment

### Code Example 6: Complete Production Configuration

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  traefik:
    image: traefik:v3.1
    restart: always
    command:
      - "--log.level=WARN"
      - "--accesslog=true"
      - "--accesslog.filepath=/logs/access.log"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entryPoints.web.address=:80"
      - "--entryPoints.web.http.redirections.entryPoint.to=websecure"
      - "--entryPoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.email=ops@example.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
      - "--metrics.prometheus=true"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
      - traefik-logs:/logs
    networks:
      - proxy
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"

  web:
    image: registry.example.com/web:${VERSION}
    restart: always
    networks:
      - proxy
      - app-internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`www.example.com`)"
      - "traefik.http.routers.web.entrypoints=websecure"
      - "traefik.http.routers.web.tls.certresolver=le"
      - "traefik.http.services.web.loadbalancer.server.port=3000"
      - "traefik.http.services.web.loadbalancer.healthCheck.path=/health"
      - "traefik.http.services.web.loadbalancer.healthCheck.interval=10s"
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: "1.0"

  api:
    image: registry.example.com/api:${VERSION}
    restart: always
    networks:
      - proxy
      - app-internal
      - db-net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.example.com`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=le"
      - "traefik.http.services.api.loadbalancer.server.port=8080"

  db:
    image: postgres:16-alpine
    restart: always
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - db-net
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

networks:
  proxy:
    driver: bridge
  app-internal:
    driver: bridge
    internal: true
  db-net:
    driver: bridge
    internal: true

volumes:
  letsencrypt:
  traefik-logs:
  pgdata:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### Code Example: Production Nginx Configuration (Full Stack)

```yaml
# docker-compose.prod.yml (Nginx version)
version: "3.9"

services:
  nginx:
    image: nginx:1.27-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx-logs:/var/log/nginx
      - nginx-cache:/var/cache/nginx
    networks:
      - proxy
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: "0.5"

  frontend:
    image: registry.example.com/frontend:${VERSION}
    restart: always
    networks:
      - proxy
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 256M

  api:
    image: registry.example.com/api:${VERSION}
    restart: always
    networks:
      - proxy
      - backend
    environment:
      - DATABASE_URL=postgresql://app:${DB_PASSWORD}@db:5432/appdb
      - REDIS_URL=redis://redis:6379
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M

  worker:
    image: registry.example.com/worker:${VERSION}
    restart: always
    networks:
      - backend
    environment:
      - DATABASE_URL=postgresql://app:${DB_PASSWORD}@db:5432/appdb
      - REDIS_URL=redis://redis:6379
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G

  db:
    image: postgres:16-alpine
    restart: always
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: appdb
      POSTGRES_USER: app
    secrets:
      - db_password
    deploy:
      resources:
        limits:
          memory: 1G

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    networks:
      - backend
    deploy:
      resources:
        limits:
          memory: 512M

networks:
  proxy:
    driver: bridge
  backend:
    driver: bridge
    internal: true

volumes:
  nginx-logs:
  nginx-cache:
  pgdata:
  redis-data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

```nginx
# nginx/nginx.conf (production main configuration)
user nginx;
worker_processes auto;
worker_rlimit_nofile 65535;

error_log /var/log/nginx/error.log warn;
pid       /var/run/nginx.pid;

events {
    worker_connections 4096;
    multi_accept on;
    use epoll;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Log format (JSON)
    log_format json_combined escape=json
        '{'
        '"time":"$time_iso8601",'
        '"remote_addr":"$remote_addr",'
        '"request":"$request",'
        '"status":$status,'
        '"body_bytes_sent":$body_bytes_sent,'
        '"request_time":$request_time,'
        '"upstream_response_time":"$upstream_response_time",'
        '"http_user_agent":"$http_user_agent",'
        '"http_referer":"$http_referer",'
        '"upstream_addr":"$upstream_addr"'
        '}';

    access_log /var/log/nginx/access.log json_combined;

    # Performance optimization
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 1000;
    types_hash_max_size 2048;
    client_max_body_size 50m;

    # gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Brotli compression (if module is available)
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Security
    server_tokens off;

    # Common SSL settings
    include /etc/nginx/conf.d/ssl-params.conf;

    # Site configurations
    include /etc/nginx/conf.d/*.conf;
}
```

### Code Example: Zero-Downtime Deployment

```bash
#!/bin/bash
# deploy.sh - Zero-downtime deployment script

set -euo pipefail

VERSION=$1
SERVICE=$2
COMPOSE_FILE="docker-compose.prod.yml"
REPLICAS=${3:-3}

echo "=== Deployment started: ${SERVICE} v${VERSION} ==="

# Pull new image
echo "[1/5] Pulling new image..."
docker compose -f ${COMPOSE_FILE} pull ${SERVICE}

# Start new instances (keep old instances running)
echo "[2/5] Starting rolling update..."
for i in $(seq 1 ${REPLICAS}); do
    echo "  Updating instance ${i}/${REPLICAS}..."

    # Update one instance at a time
    VERSION=${VERSION} docker compose -f ${COMPOSE_FILE} up -d \
        --no-deps --scale ${SERVICE}=${REPLICAS} ${SERVICE}

    # Wait for health check to pass
    echo "  Waiting for health check..."
    sleep 10

    # Confirm health check
    HEALTH_URL="http://localhost/health"
    for attempt in $(seq 1 30); do
        if curl -sf ${HEALTH_URL} > /dev/null 2>&1; then
            echo "  Health check OK (attempt ${attempt})"
            break
        fi
        if [ ${attempt} -eq 30 ]; then
            echo "  Health check failed! Rolling back..."
            docker compose -f ${COMPOSE_FILE} rollback ${SERVICE} 2>/dev/null || true
            exit 1
        fi
        sleep 2
    done
done

# Clean up old containers
echo "[3/5] Removing old containers..."
docker image prune -f

# Reload proxy configuration (when using Nginx)
echo "[4/5] Reloading proxy configuration..."
docker compose -f ${COMPOSE_FILE} exec -T nginx nginx -s reload 2>/dev/null || true

echo "[5/5] Deployment complete: ${SERVICE} v${VERSION}"
echo "=== Success ==="
```

### Code Example: ForwardAuth (OAuth2 Proxy)

Access control using an external authentication service. Can integrate with OAuth2 providers such as Google, GitHub, and Azure AD.

```yaml
# docker-compose.yml
services:
  traefik:
    image: traefik:v3.1
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entryPoints.websecure.address=:443"
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  # OAuth2 Proxy
  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:latest
    environment:
      OAUTH2_PROXY_PROVIDER: google
      OAUTH2_PROXY_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      OAUTH2_PROXY_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      OAUTH2_PROXY_COOKIE_SECRET: ${COOKIE_SECRET}
      OAUTH2_PROXY_EMAIL_DOMAINS: "example.com"
      OAUTH2_PROXY_UPSTREAM: "static://200"
      OAUTH2_PROXY_HTTP_ADDRESS: "0.0.0.0:4180"
      OAUTH2_PROXY_REVERSE_PROXY: "true"
      OAUTH2_PROXY_SET_XAUTHREQUEST: "true"
      OAUTH2_PROXY_COOKIE_SECURE: "true"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.oauth2.rule=Host(`auth.example.com`)"
      - "traefik.http.routers.oauth2.entrypoints=websecure"
      - "traefik.http.routers.oauth2.tls.certresolver=le"
      - "traefik.http.services.oauth2.loadbalancer.server.port=4180"
      # ForwardAuth middleware definition
      - "traefik.http.middlewares.oauth-auth.forwardauth.address=http://oauth2-proxy:4180/oauth2/auth"
      - "traefik.http.middlewares.oauth-auth.forwardauth.trustForwardHeader=true"
      - "traefik.http.middlewares.oauth-auth.forwardauth.authResponseHeaders=X-Auth-Request-User,X-Auth-Request-Email"

  # Protected application
  admin-dashboard:
    image: my-admin-app:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.admin.rule=Host(`admin.example.com`)"
      - "traefik.http.routers.admin.entrypoints=websecure"
      - "traefik.http.routers.admin.tls.certresolver=le"
      # Apply OAuth2 authentication
      - "traefik.http.routers.admin.middlewares=oauth-auth"
      - "traefik.http.services.admin.loadbalancer.server.port=3000"
```

---

## 7. Monitoring, Logging, and Troubleshooting

### Traefik Metrics + Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
services:
  traefik:
    image: traefik:v3.1
    command:
      - "--metrics.prometheus=true"
      - "--metrics.prometheus.entryPoint=metrics"
      - "--entryPoints.metrics.address=:8082"
      - "--accesslog=true"
      - "--accesslog.format=json"
      - "--accesslog.filepath=/logs/access.log"
      - "--accesslog.fields.headers.defaultMode=keep"

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    networks:
      - monitoring
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.prometheus.rule=Host(`prometheus.example.com`)"
      - "traefik.http.routers.prometheus.middlewares=oauth-auth"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    networks:
      - monitoring
      - proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=Host(`grafana.example.com`)"
      - "traefik.http.services.grafana.loadbalancer.server.port=3000"

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring:
    internal: true
```

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: traefik
    static_configs:
      - targets: ["traefik:8082"]

  - job_name: nginx
    static_configs:
      - targets: ["nginx-exporter:9113"]
```

### Nginx Log Analysis and Alerting

```yaml
# docker-compose.logging.yml
services:
  # Nginx metrics exporter
  nginx-exporter:
    image: nginx/nginx-prometheus-exporter:latest
    command:
      - -nginx.scrape-uri=http://nginx:8080/stub_status
    networks:
      - monitoring

  # Log forwarding
  fluentd:
    image: fluent/fluentd:v1.17
    volumes:
      - ./fluentd/fluent.conf:/fluentd/etc/fluent.conf:ro
      - nginx-logs:/var/log/nginx:ro
    networks:
      - monitoring
```

```nginx
# nginx/conf.d/status.conf
# Stub status for metrics (not exposed externally)
server {
    listen 8080;
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    deny all;

    location /stub_status {
        stub_status;
    }

    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
```

### Troubleshooting Checklist

| Symptom | Cause | Solution |
|---------|-------|----------|
| 502 Bad Gateway | Backend not running or network unreachable | Check logs with `docker compose logs backend` |
| 503 Service Unavailable | All upstream servers are down | Check health checks, run `docker compose ps` |
| 504 Gateway Timeout | Backend response is slow | Increase `proxy_read_timeout` value |
| SSL certificate error | Certificate expired or incorrect path | `openssl x509 -dates -in cert.pem` |
| WebSocket disconnects | Insufficient timeout setting | Set `proxy_read_timeout 86400s` |
| Cookie lost | Secure/SameSite settings mismatch | Enforce HTTPS, verify cookie settings |
| IP address is 127.0.0.1 | X-Forwarded-For not set | Set `proxy_set_header X-Forwarded-For` |
| CORS error | Headers not configured | Configure CORS with add_header / middleware |
| Let's Encrypt failure | Port 80 unreachable from outside | Check firewall and DNS settings |
| 413 Entity Too Large | File size limit | Set `client_max_body_size 50m` |

```bash
#!/bin/bash
# proxy-debug.sh - Reverse proxy debug script

DOMAIN=${1:-"example.com"}

echo "=== DNS Resolution ==="
dig +short ${DOMAIN}

echo ""
echo "=== Port Reachability ==="
nc -zv ${DOMAIN} 80 2>&1
nc -zv ${DOMAIN} 443 2>&1

echo ""
echo "=== HTTP Response ==="
curl -sI http://${DOMAIN} | head -5

echo ""
echo "=== HTTPS Response ==="
curl -sI https://${DOMAIN} | head -10

echo ""
echo "=== SSL Certificate ==="
echo | openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} 2>/dev/null | openssl x509 -noout -dates

echo ""
echo "=== Response Headers ==="
curl -sI https://${DOMAIN} | grep -iE "server|x-forwarded|strict-transport|x-frame|x-content-type"

echo ""
echo "=== Docker Container Status ==="
docker compose ps 2>/dev/null || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== Nginx Configuration Test ==="
docker compose exec nginx nginx -t 2>&1 || echo "No Nginx container found"

echo ""
echo "=== Recent Error Logs ==="
docker compose logs --tail=20 nginx 2>/dev/null || docker compose logs --tail=20 traefik 2>/dev/null
```

---

## Anti-Patterns

### Anti-Pattern 1: Directly Exposing Backend Ports

```yaml
# BAD: Expose backend service ports to the outside
services:
  nginx:
    ports:
      - "80:80"
  app:
    ports:
      - "3000:3000"  # Directly accessible → bypasses the proxy
  db:
    ports:
      - "5432:5432"  # Worst pattern

# GOOD: Only expose the proxy; isolate backends via networks
services:
  nginx:
    ports:
      - "80:80"
      - "443:443"
  app:
    # Do not expose ports
    networks:
      - internal
  db:
    networks:
      - db-only
```

**Why this is a problem**: The security features of the reverse proxy (rate limiting, authentication, header injection) are bypassed, leaving the backend vulnerable to direct attacks.

### Anti-Pattern 2: Unrestricted Docker Socket Mount

```yaml
# BAD: Mount Docker socket with write access
volumes:
  - /var/run/docker.sock:/var/run/docker.sock

# GOOD: Mount as read-only
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro

# More secure: Use Docker Socket Proxy
services:
  socket-proxy:
    image: tecnativa/docker-socket-proxy
    environment:
      CONTAINERS: 1
      SERVICES: 0
      TASKS: 0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - socket-proxy

  traefik:
    image: traefik:v3.1
    command:
      - "--providers.docker.endpoint=tcp://socket-proxy:2375"
    networks:
      - socket-proxy
      - proxy
    # Do not mount Docker socket directly
```

**Why this is a problem**: Write access to the Docker socket is equivalent to root access on the host. If Traefik is compromised, the entire host is at risk.

### Anti-Pattern 3: Insecure SSL Configuration

```nginx
# BAD: Allow old protocols and weak cipher suites
ssl_protocols SSLv3 TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
ssl_ciphers ALL:!aNULL;

# BAD: No HSTS header
# → Vulnerable to downgrade attacks when users access over HTTP

# GOOD: TLS 1.2/1.3 only, strong cipher suites, with HSTS
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

**Why this is a problem**: SSL Labs score drops, and there is a risk of man-in-the-middle attacks and protocol downgrade attacks. PCI DSS compliance requires TLS 1.2 or higher.

### Anti-Pattern 4: Insufficient Timeout Settings

```nginx
# BAD: Default timeout (60s) with large file uploads
location /api/upload {
    proxy_pass http://backend;
    # No timeout setting → 504 error for large files
}

# GOOD: Appropriate timeouts per endpoint
location /api/upload {
    proxy_pass http://backend;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 60s;
    client_max_body_size 100m;
    client_body_timeout 300s;
}

# For WebSocket endpoints
location /ws {
    proxy_pass http://ws-backend;
    proxy_read_timeout 86400s;  # 24 hours
    proxy_send_timeout 86400s;
}
```

**Why this is a problem**: File uploads and WebSocket connections disconnect intermittently, degrading user experience. Conversely, excessively long timeouts waste resources, so set appropriate values per endpoint.

---

## FAQ

### Q1: Which should I choose, Nginx or Traefik?

**Nginx recommended**: When a static configuration is sufficient, in high-traffic environments, or when you already have operational expertise with Nginx.
**Traefik recommended**: When containers are frequently added or removed dynamically, when Let's Encrypt automation is needed, or in Kubernetes/Swarm environments.

For small scale, the simplicity of Nginx is an advantage. In dynamic microservices environments, Traefik's service discovery is overwhelmingly convenient.

### Q2: What should I do if Let's Encrypt certificate renewal fails?

1. Verify that port 80 is reachable from the outside (HTTP-01 challenge)
2. Confirm that DNS settings are correct
3. Check that you have not hit the rate limit (5 times per week)
4. Debug using the `--staging` flag to obtain a test certificate

```bash
# Test certificate acquisition in staging environment
certbot certonly --staging --webroot -w /var/www/certbot -d example.com
```

### Q3: How do I get the client's real IP address behind a reverse proxy?

```nginx
# Set headers on the Nginx side
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Read the `X-Real-IP` or `X-Forwarded-For` header on the application side. However, make sure to only trust headers from trusted proxies (to prevent IP spoofing).

```nginx
# Trusted proxy configuration
set_real_ip_from 10.0.0.0/8;
set_real_ip_from 172.16.0.0/12;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

### Q4: How do I use wildcard certificates in a Docker environment?

Wildcard certificates (`*.example.com`) require a DNS-01 challenge. Traefik can automatically obtain them by configuring a DNS provider.

```yaml
# Traefik + Cloudflare DNS-01 challenge
services:
  traefik:
    image: traefik:v3.1
    command:
      - "--certificatesresolvers.le.acme.dnschallenge=true"
      - "--certificatesresolvers.le.acme.dnschallenge.provider=cloudflare"
      - "--certificatesresolvers.le.acme.email=admin@example.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
    environment:
      CF_API_EMAIL: ${CF_API_EMAIL}
      CF_DNS_API_TOKEN: ${CF_DNS_API_TOKEN}
```

### Q5: How can I achieve dynamic routing for microservices with Nginx?

Dynamic routing is difficult with Nginx alone, but the following approaches can help:

1. **nginx-proxy (jwilder/nginx-proxy)**: Automatic configuration based on Docker environment variables
2. **consul-template**: Automatic configuration generation using Consul + templates
3. **confd**: Template generation from etcd/Consul/environment variables

```yaml
# Dynamic routing using jwilder/nginx-proxy
services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - certs:/etc/nginx/certs:ro

  # Automatic routing just by setting VIRTUAL_HOST
  app1:
    image: my-app1:latest
    environment:
      VIRTUAL_HOST: app1.example.com
      VIRTUAL_PORT: 3000

  app2:
    image: my-app2:latest
    environment:
      VIRTUAL_HOST: app2.example.com
      VIRTUAL_PORT: 8080
```

### Q6: How do I combine Docker Compose scale with load balancing?

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - app

  app:
    image: my-app:latest
    # Do not expose ports
    deploy:
      replicas: 3
```

```nginx
# nginx/conf.d/default.conf
# Use Docker Compose internal DNS round-robin
upstream app_cluster {
    # Docker DNS resolution automatically distributes to all scaled instances
    server app:8080;
}

# DNS resolution is cached, so add resolver configuration
resolver 127.0.0.11 valid=10s;

server {
    listen 80;
    location / {
        set $upstream app:8080;
        proxy_pass http://$upstream;
    }
}
```

```bash
# Scale up
docker compose up -d --scale app=5

# Scale down
docker compose up -d --scale app=2
```

---

## Summary

| Topic | Key Point |
|-------|-----------|
| Nginx | Static configuration, high performance, broad expertise. Use `proxy_pass` to forward |
| Traefik | Auto-detection with Docker integration, label-based configuration, built-in ACME |
| Caddy | HTTPS by default, simple configuration, HTTP/3 support |
| SSL/TLS | Free certificates with Let's Encrypt. Enforce TLS 1.2 or higher |
| mTLS | Mutual authentication with client certificates. Useful for protecting internal APIs |
| Load Balancing | Choose round_robin / least_conn / ip_hash based on use case |
| WebSocket | Upgrade/Connection headers and extended timeouts are required |
| gRPC | HTTP/2 required. Nginx uses `grpc_pass`, Traefik uses `h2c` scheme |
| TCP/UDP | Nginx stream module, Traefik TCP router |
| Security | Do not expose backend ports; mount Docker socket as read-only |
| Headers | Always set X-Real-IP / X-Forwarded-For / HSTS |
| Monitoring | Visualize metrics with Prometheus + Grafana |
| Deployment | Zero-downtime with rolling updates |

---

## Next Guides to Read

- [Production Best Practices](../04-production/00-production-best-practices.md) -- Non-root users, health checks, resource limits
- [Monitoring](../04-production/01-monitoring.md) -- Collecting Traefik metrics and dashboards
- [Container Security](../06-security/00-container-security.md) -- Security hardening including the proxy layer

---

## References

1. Nginx Official Documentation "Reverse Proxy" -- https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/
2. Traefik Official Documentation "Docker Provider" -- https://doc.traefik.io/traefik/providers/docker/
3. Mozilla "SSL Configuration Generator" -- https://ssl-config.mozilla.org/
4. Let's Encrypt Documentation -- https://letsencrypt.org/docs/
5. Traefik Labs (2024) "Traefik Proxy Documentation" -- https://doc.traefik.io/traefik/
6. Caddy Official Documentation "Reverse Proxy" -- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
7. Nginx Official Documentation "Stream Module" -- https://nginx.org/en/docs/stream/ngx_stream_core_module.html
8. OWASP "Secure Headers Project" -- https://owasp.org/www-project-secure-headers/
9. Nginx Official Documentation "gRPC Proxy" -- https://nginx.org/en/docs/http/ngx_http_grpc_module.html
10. OAuth2 Proxy Documentation -- https://oauth2-proxy.github.io/oauth2-proxy/
