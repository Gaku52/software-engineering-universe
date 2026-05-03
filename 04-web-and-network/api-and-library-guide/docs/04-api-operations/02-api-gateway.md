# API Gateway

> An API gateway serves as the unified entry point for microservices. This guide systematically covers the design, construction, and operation of API gateways — from routing, centralized authentication, rate limiting, and request transformation to circuit breakers. Using Kong, AWS API Gateway, Nginx, and Envoy as primary examples, it comprehensively addresses the configuration patterns, security integration, and service mesh coordination required in production environments.

---

## What You Will Learn

- [ ] Understand the role and architecture of API gateways
- [ ] Compare and select among major gateway products (Kong, AWS API Gateway, Nginx, Envoy)
- [ ] Design BFF (Backend for Frontend) patterns
- [ ] Implement rate limiting algorithms (Token Bucket, Sliding Window)
- [ ] Configure authentication integration (JWT, OAuth 2.0, API Key) at the gateway layer
- [ ] Properly configure circuit breakers and retry strategies
- [ ] Understand integration with service meshes (Istio + Envoy)
- [ ] Practice monitoring and troubleshooting in production environments

---

## Prerequisites

- API monitoring and logging → See: [Monitoring and Logging](./01-monitoring-and-logging.md)
- Rate limiting concepts → See: [Rate Limiting](../03-api-security/01-rate-limiting.md)
- API authentication patterns → See: [Authentication Patterns](../03-api-security/00-authentication-patterns.md)

---

## 1. API Gateway Role and Architecture

### 1.1 Why API Gateways Are Necessary

In a microservices architecture, when clients communicate directly with individual services, the following problems arise.

```
┌─────────────────────────────────────────────────────────┐
│ Configuration Without a Gateway (Problem Pattern)         │
│                                                         │
│  Browser ─── https://user.api.example.com/users         │
│          ├── https://order.api.example.com/orders        │
│          ├── https://payment.api.example.com/pay         │
│          └── https://notify.api.example.com/notifications│
│                                                         │
│  Problems:                                              │
│   - Clients must know the endpoint of every service     │
│   - CORS configuration is scattered across services     │
│   - Authentication logic is duplicated in each service  │
│   - Rate limiting cannot be applied uniformly           │
│   - Adding, merging, or splitting services affects clients│
│   - TLS certificates must be managed per service        │
└─────────────────────────────────────────────────────────┘
```

An API gateway acts as the "front door" that resolves all these problems.

```
┌─────────────────────────────────────────────────────────────┐
│ Configuration With a Gateway (Recommended Pattern)           │
│                                                             │
│           ┌──────────────────┐                               │
│  Browser ─┤  API Gateway     ├─── User Service (internal)   │
│  Mobile  ─┤  (single URL)    ├─── Order Service (internal)  │
│  3rd App ─┤  api.example.com ├─── Payment Service (internal)│
│           └──────────────────┘                               │
│                  │                                           │
│                  ├── TLS termination                         │
│                  ├── Authentication & authorization          │
│                  ├── Rate limiting                           │
│                  ├── Routing                                 │
│                  ├── Request / response transformation       │
│                  ├── Load balancing                          │
│                  ├── Caching                                 │
│                  ├── Logging & metrics                       │
│                  └── Circuit breaker                         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Eight Key Functions of an API Gateway

```
API Gateway = Single entry point to microservices

  Client → API Gateway → User Service
                       → Order Service
                       → Payment Service
                       → Notification Service

Key functions:
  (1) Routing:
     → /users/* → User Service
     → /orders/* → Order Service
     → Path-based, header-based, and query-parameter-based routing
     → Versioning: /v1/* → Service v1, /v2/* → Service v2

  (2) Centralized authentication & authorization:
     → JWT validation performed at the gateway
     → Each service only receives authenticated requests
     → API Key validation
     → OAuth 2.0 token introspection
     → mTLS for inter-service authentication

  (3) Rate limiting:
     → Global rate limiting
     → Per-client / per-plan limits
     → Token Bucket / Sliding Window algorithms
     → First line of defense against DDoS

  (4) Request / response transformation:
     → Adding / removing headers
     → Request body transformation (XML → JSON, etc.)
     → Response aggregation (API Composition)
     → GraphQL → REST transformation

  (5) Load balancing:
     → Distribution across service instances
     → Round-robin, least connections, weighted
     → Health checks (active / passive)

  (6) Caching:
     → Response caching (TTL control)
     → CDN integration (CloudFront, Fastly)
     → Conditional requests (ETag, Last-Modified)

  (7) Monitoring & logging:
     → Access logs (structured logging)
     → Metrics collection (latency, error rate, throughput)
     → Distributed tracing (OpenTelemetry, Jaeger)
     → Alert integration (PagerDuty, Slack)

  (8) Circuit breaker:
     → Block requests to failing services
     → Fallback responses
     → Prevent failure propagation (avoid cascade failures)
```

### 1.3 Deployment Patterns

API gateways can be deployed using multiple patterns. Understand the characteristics of each pattern and choose appropriately.

```
┌────────────────────────────────────────────────────────────────┐
│ Pattern 1: Centralized Gateway                                  │
│                                                                │
│   Client → [API Gateway] → Service A                           │
│                           → Service B                           │
│                           → Service C                           │
│                                                                │
│   Characteristics: A single gateway handles all traffic        │
│   Pros: Simple, centralized management                         │
│   Cons: Single point of failure, bottleneck for teams          │
├────────────────────────────────────────────────────────────────┤
│ Pattern 2: BFF (Backend for Frontend)                          │
│                                                                │
│   Web    → [Web BFF]    → Service A / B / C                    │
│   Mobile → [Mobile BFF] → Service A / B / C                    │
│   3rd    → [Public GW]  → Service A / B / C                    │
│                                                                │
│   Characteristics: Dedicated gateway per client type           │
│   Pros: Client optimization, team independence                 │
│   Cons: Increased management cost, risk of logic duplication   │
├────────────────────────────────────────────────────────────────┤
│ Pattern 3: Two-Tier Gateway                                    │
│                                                                │
│   Client → [Edge GW] → [Internal GW A] → Service A            │
│                       → [Internal GW B] → Service B            │
│                       → [Internal GW C] → Service C            │
│                                                                │
│   Characteristics: Edge layer (external) + internal layer (domain-based) │
│   Pros: Separation of concerns, domain team autonomy           │
│   Cons: Increased latency, more complex configuration          │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Comparison of Gateway Products

### 2.1 Feature Comparison of Major Products

| Item | AWS API Gateway | Kong | Nginx (Plus) | Envoy | Traefik | Apigee |
|------|----------------|------|-------------|-------|---------|--------|
| Type | Managed | OSS/Commercial | OSS/Commercial | OSS | OSS/Commercial | Managed |
| Deployment | Serverless | Self-hosted/K8s | Self-hosted/K8s | Sidecar/K8s | Self-hosted/K8s | Cloud |
| Protocols | HTTP, WebSocket | HTTP, gRPC, WebSocket | HTTP, TCP, UDP | HTTP, gRPC, TCP | HTTP, gRPC, TCP | HTTP, gRPC |
| Plugins | Lambda-centric | 300+ (Hub) | Modular | Filter chain | Middleware | Policy |
| Configuration | Console/CloudFormation/CDK | Admin API/declarative YAML | conf file | xDS API / YAML | YAML / Label | Console/API |
| K8s integration | None | Kong Ingress Controller | Ingress Controller | Istio / Gateway API | Ingress / CRD | Apigee Adapter |
| Service mesh | None | Kong Mesh (Kuma) | None | Istio data plane | Traefik Mesh | Apigee Service Mesh |
| Cost | Pay-per-use | OSS free/Enterprise paid | OSS free/Plus paid | Free | OSS free/Enterprise paid | Pay-per-use |
| Learning curve | Low | Medium | Low | High | Low–Medium | Medium–High |
| Best for | AWS environments | General purpose | High-performance reverse proxy | Service mesh | Containers/dynamic environments | Enterprise API management |

### 2.2 Performance Characteristics Comparison

| Metric | AWS API Gateway | Kong | Nginx | Envoy |
|--------|----------------|------|-------|-------|
| Latency (P99) | +10–30ms | +1–5ms | <+1ms | +1–3ms |
| Throughput | 10,000 RPS (default) | 50,000+ RPS | 100,000+ RPS | 50,000+ RPS |
| Memory usage | Managed | 200–500MB | 50–100MB | 100–300MB |
| Horizontal scaling | Automatic | Manual/K8s HPA | Manual/K8s HPA | Automatic via Istio |
| Warm-up | Cold starts occur | Not needed | Not needed | Not needed |

### 2.3 Selection Flowchart

```
                       ┌─────────────────┐
                       │ Gateway Selection│
                       └────────┬────────┘
                                │
                     ┌──────────▼──────────┐
                     │ AWS environment only?│
                     └─────┬─────────┬─────┘
                       Yes │         │ No
                           │         │
                   ┌───────▼───┐     │
                   │ AWS API GW │     │
                   └───────────┘     │
                              ┌──────▼──────────┐
                              │ Using K8s?       │
                              └──┬──────────┬───┘
                             Yes │          │ No
                                 │          │
                        ┌────────▼────┐  ┌──▼──────────┐
                        │ Service mesh│  │ Nginx       │
                        │ needed?     │  │ (simple)    │
                        └──┬─────┬───┘  └─────────────┘
                       Yes │     │ No
                           │     │
                  ┌────────▼──┐ ┌▼───────────┐
                  │ Envoy +   │ │ Kong       │
                  │ Istio     │ │ (plugins)  │
                  └───────────┘ └────────────┘
```

---

## 3. AWS API Gateway in Detail

### 3.1 Choosing an API Type

```
Three types of AWS API Gateway:

  (1) HTTP API (recommended – low cost):
     → 70% cheaper than REST API
     → Low latency (faster than REST API)
     → JWT Authorizer (native support)
     → Lambda proxy integration
     → Automatic CORS configuration
     → Limitations: no request/response transformation, no Usage Plans

  (2) REST API (full feature set):
     → Request/response transformation (VTL templates)
     → API keys + Usage Plans (API billing management)
     → AWS WAF integration
     → Caching (0.5GB–237GB)
     → Request validation
     → Canary release support

  (3) WebSocket API:
     → Bidirectional real-time communication
     → $connect / $disconnect / $default routes
     → Chat, gaming, financial real-time feeds
     → Lambda / DynamoDB backends
     → Connection management API (@connections)

Selection criteria:
  HTTP API ← When simple REST + JWT authentication is sufficient
  REST API ← When Usage Plans, WAF, or transformation are needed
  WebSocket API ← When real-time bidirectional communication is needed
```

### 3.2 Deployment with AWS SAM

```yaml
# AWS SAM template (production quality)
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Production API Gateway with Authentication and Rate Limiting

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  JwtIssuer:
    Type: String
    Description: JWT token issuer URL
  JwtAudience:
    Type: String
    Description: JWT token audience

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    MemorySize: 256
    Environment:
      Variables:
        ENVIRONMENT: !Ref Environment
        LOG_LEVEL: !If [IsProd, "warn", "debug"]
    Tracing: Active
  Api:
    Cors:
      AllowOrigin: "'https://app.example.com'"
      AllowHeaders: "'Authorization,Content-Type,X-Request-ID'"
      AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
      MaxAge: "'86400'"

Conditions:
  IsProd: !Equals [!Ref Environment, production]

Resources:
  # HTTP API Gateway
  ApiGateway:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: !Ref Environment
      Description: !Sub "API Gateway - ${Environment}"
      Auth:
        DefaultAuthorizer: JwtAuthorizer
        Authorizers:
          JwtAuthorizer:
            JwtConfiguration:
              issuer: !Ref JwtIssuer
              audience:
                - !Ref JwtAudience
      AccessLogSettings:
        DestinationArn: !GetAtt ApiAccessLogGroup.Arn
        Format: >-
          {"requestId":"$context.requestId",
           "ip":"$context.identity.sourceIp",
           "method":"$context.httpMethod",
           "path":"$context.path",
           "status":"$context.status",
           "latency":"$context.responseLatency",
           "userAgent":"$context.identity.userAgent",
           "integrationLatency":"$context.integrationLatency"}
      DefaultRouteSettings:
        ThrottlingBurstLimit: 200
        ThrottlingRateLimit: 100

  # CloudWatch Log Group
  ApiAccessLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub "/aws/apigateway/${Environment}/access-logs"
      RetentionInDays: !If [IsProd, 90, 14]

  # Users API
  ListUsersFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/users.list
      Description: List all users with pagination
      Events:
        ListUsers:
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiGateway
            Path: /users
            Method: GET

  GetUserFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/users.get
      Description: Get user by ID
      Events:
        GetUser:
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiGateway
            Path: /users/{userId}
            Method: GET

  CreateUserFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/users.create
      Description: Create a new user
      Events:
        CreateUser:
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiGateway
            Path: /users
            Method: POST

  # Health Check (no authentication)
  HealthCheckFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/health.check
      Description: Health check endpoint
      Events:
        HealthCheck:
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiGateway
            Path: /health
            Method: GET
            Auth:
              Authorizer: NONE

Outputs:
  ApiEndpoint:
    Description: API Gateway endpoint URL
    Value: !Sub "https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/${Environment}"
  ApiId:
    Description: API Gateway ID
    Value: !Ref ApiGateway
```

### 3.3 Custom Domains and Stage Management

```yaml
# Custom domain configuration
Resources:
  ApiDomainName:
    Type: AWS::ApiGatewayV2::DomainName
    Properties:
      DomainName: api.example.com
      DomainNameConfigurations:
        - CertificateArn: !Ref AcmCertificate
          EndpointType: REGIONAL
          SecurityPolicy: TLS_1_2

  ApiMapping:
    Type: AWS::ApiGatewayV2::ApiMapping
    Properties:
      DomainName: api.example.com
      ApiId: !Ref ApiGateway
      Stage: !Ref Environment
      ApiMappingKey: v1

  # Route 53 record
  DnsRecord:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneId: !Ref HostedZoneId
      Name: api.example.com
      Type: A
      AliasTarget:
        DNSName: !GetAtt ApiDomainName.RegionalDomainName
        HostedZoneId: !GetAtt ApiDomainName.RegionalHostedZoneId
```

### 3.4 AWS API Gateway Limitations

```
Key limits of AWS API Gateway:

  HTTP API:
  ├── Payload size: 10 MB
  ├── Timeout: 30 seconds
  ├── Requests/second: 10,000 (default, can be increased)
  ├── Route count: 300
  ├── Stage count: 10
  └── Authorizer: JWT only (no Lambda Authorizer → consider REST API)

  REST API:
  ├── Payload size: 10 MB
  ├── Timeout: 29 seconds
  ├── Requests/second: 10,000 (default, can be increased)
  ├── Resource count: 300
  ├── Stage count: 10
  ├── API key count: 10,000
  └── Usage Plan count: 300

  WebSocket API:
  ├── Message size: 128 KB (send) / 32 KB (receive frame)
  ├── Connection time: max 2 hours
  ├── Idle timeout: 10 minutes
  └── Concurrent connections: subject to default limits

  Common notes:
  → Cold starts: initial requests may have increased latency
  → VPC Link: required to connect to resources inside a VPC
  → Binary data: Content-Type mapping is required
  → CORS: automatic for HTTP API, manual configuration required for REST API
```

---

## 4. Kong Gateway in Detail

### 4.1 Architecture

Kong has an architecture separated into a control plane and a data plane.

```
┌────────────────────────────────────────────────────────────┐
│ Kong Architecture                                           │
│                                                            │
│  ┌─────────────────────────────────────┐                   │
│  │ Control Plane                       │                   │
│  │  ┌─────────┐  ┌──────────────────┐  │                   │
│  │  │ Admin API│  │ Database         │  │                   │
│  │  │ :8001    │  │ (PostgreSQL)     │  │                   │
│  │  └─────────┘  └──────────────────┘  │                   │
│  └──────────────────┬──────────────────┘                   │
│                     │ Configuration sync                    │
│  ┌──────────────────▼──────────────────┐                   │
│  │ Data Plane (Proxy)                  │                   │
│  │  ┌─────────┐  ┌──────────────────┐  │                   │
│  │  │ Proxy   │  │ Plugin Chain     │  │                   │
│  │  │ :8000   │  │ Auth → Rate Limit│  │                   │
│  │  │ :8443   │  │ → Log → Transform│  │                   │
│  │  └─────────┘  └──────────────────┘  │                   │
│  └─────────────────────────────────────┘                   │
│                                                            │
│  DB-less Mode: YAML config only, no DB required (recommended for K8s)  │
│  Hybrid Mode: CP/DP separation for enhanced security       │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Declarative Configuration (DB-less Mode)

```yaml
# kong.yml - production-quality declarative configuration
_format_version: "3.0"
_transform: true

# Service definitions
services:
  # User service
  - name: user-service
    url: http://user-service:3000
    connect_timeout: 5000
    read_timeout: 30000
    write_timeout: 30000
    retries: 3
    routes:
      - name: users-route
        paths:
          - /api/v1/users
        strip_path: false
        protocols:
          - https
        methods:
          - GET
          - POST
          - PUT
          - DELETE
        headers:
          x-api-version:
            - v1
    plugins:
      # JWT authentication
      - name: jwt
        config:
          secret_is_base64: false
          claims_to_verify:
            - exp
          header_names:
            - Authorization
          key_claim_name: iss
      # Rate limiting
      - name: rate-limiting
        config:
          minute: 100
          hour: 5000
          policy: redis
          redis:
            host: redis
            port: 6379
            timeout: 2000
          fault_tolerant: true
          hide_client_headers: false
      # CORS
      - name: cors
        config:
          origins:
            - https://app.example.com
            - https://staging.example.com
          methods:
            - GET
            - POST
            - PUT
            - DELETE
            - OPTIONS
          headers:
            - Authorization
            - Content-Type
            - X-Request-ID
          exposed_headers:
            - X-RateLimit-Remaining
            - X-RateLimit-Limit
          max_age: 86400
          credentials: true
      # Request transformation
      - name: request-transformer
        config:
          add:
            headers:
              - "X-Gateway-Version:kong-3.x"
              - "X-Forwarded-Service:user-service"
      # Response transformation
      - name: response-transformer
        config:
          remove:
            headers:
              - X-Powered-By
              - Server
          add:
            headers:
              - "X-Content-Type-Options:nosniff"
              - "X-Frame-Options:DENY"
              - "Strict-Transport-Security:max-age=31536000; includeSubDomains"

  # Order service
  - name: order-service
    url: http://order-service:3000
    connect_timeout: 5000
    read_timeout: 60000
    write_timeout: 60000
    retries: 2
    routes:
      - name: orders-route
        paths:
          - /api/v1/orders
        strip_path: false
        protocols:
          - https
    plugins:
      - name: rate-limiting
        config:
          minute: 50
          hour: 2000
          policy: redis
          redis:
            host: redis
            port: 6379
      - name: request-size-limiting
        config:
          allowed_payload_size: 5
          size_unit: megabytes

  # Health check (no authentication required)
  - name: health-service
    url: http://health-aggregator:3000
    routes:
      - name: health-route
        paths:
          - /health
        methods:
          - GET

# Global plugins
plugins:
  # Common logging for all services
  - name: tcp-log
    config:
      host: log-collector
      port: 5140
      tls: false
      keepalive: 60000
  # Prometheus metrics
  - name: prometheus
    config:
      per_consumer: true
      status_code_metrics: true
      latency_metrics: true
      bandwidth_metrics: true
  # Bot detection
  - name: bot-detection
    config:
      deny:
        - "curl"
        - "wget"

# Consumer definitions (API users)
consumers:
  - username: mobile-app
    keyauth_credentials:
      - key: mobile-app-key-xxxxx
    plugins:
      - name: rate-limiting
        config:
          minute: 200
          hour: 10000
          policy: redis
          redis:
            host: redis
            port: 6379

  - username: partner-api
    keyauth_credentials:
      - key: partner-key-yyyyy
    plugins:
      - name: rate-limiting
        config:
          minute: 50
          hour: 1000
          policy: redis
          redis:
            host: redis
            port: 6379

# Upstream definitions (load balancing)
upstreams:
  - name: user-service
    algorithm: round-robin
    healthchecks:
      active:
        type: http
        http_path: /health
        healthy:
          interval: 10
          successes: 3
        unhealthy:
          interval: 5
          http_failures: 3
          tcp_failures: 3
          timeouts: 3
      passive:
        type: http
        healthy:
          successes: 5
        unhealthy:
          http_failures: 5
          tcp_failures: 3
          timeouts: 3
    targets:
      - target: user-service-1:3000
        weight: 100
      - target: user-service-2:3000
        weight: 100
```

### 4.3 Kong on Kubernetes

```yaml
# K8s configuration using Kong Ingress Controller
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limiting-plugin
  namespace: api
config:
  minute: 100
  policy: local
  fault_tolerant: true
plugin: rate-limiting
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: jwt-plugin
  namespace: api
plugin: jwt
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: cors-plugin
  namespace: api
config:
  origins:
    - "https://app.example.com"
  methods:
    - GET
    - POST
    - PUT
    - DELETE
  headers:
    - Authorization
    - Content-Type
  credentials: true
  max_age: 86400
plugin: cors
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: user-api-ingress
  namespace: api
  annotations:
    konghq.com/plugins: rate-limiting-plugin,jwt-plugin,cors-plugin
    konghq.com/strip-path: "false"
    konghq.com/protocols: "https"
spec:
  ingressClassName: kong
  tls:
    - secretName: api-tls-secret
      hosts:
        - api.example.com
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api/v1/users
            pathType: Prefix
            backend:
              service:
                name: user-service
                port:
                  number: 3000
          - path: /api/v1/orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 3000
```

---

## 5. Nginx as an API Gateway

### 5.1 Basic Configuration

```nginx
# /etc/nginx/nginx.conf - API gateway configuration
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    multi_accept on;
    use epoll;
}

http {
    # Basic settings
    include /etc/nginx/mime.types;
    default_type application/json;
    charset utf-8;

    # Log format (JSON structured logging)
    log_format json_combined escape=json
        '{'
            '"time":"$time_iso8601",'
            '"remote_addr":"$remote_addr",'
            '"request_method":"$request_method",'
            '"request_uri":"$request_uri",'
            '"status":"$status",'
            '"body_bytes_sent":"$body_bytes_sent",'
            '"request_time":"$request_time",'
            '"upstream_response_time":"$upstream_response_time",'
            '"http_user_agent":"$http_user_agent",'
            '"http_x_request_id":"$http_x_request_id",'
            '"upstream_addr":"$upstream_addr"'
        '}';

    access_log /var/log/nginx/access.log json_combined;

    # Performance tuning
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 1000;

    # Buffer settings
    client_body_buffer_size 16k;
    client_max_body_size 10m;
    proxy_buffer_size 16k;
    proxy_buffers 4 32k;
    proxy_busy_buffers_size 64k;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types application/json application/xml text/plain;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api_global:10m rate=100r/s;
    limit_req_zone $http_x_api_key zone=api_key:10m rate=50r/s;
    limit_req_zone $binary_remote_addr zone=auth_endpoint:10m rate=10r/s;

    # Connection count limit
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

    # Upstream definitions
    upstream user_service {
        least_conn;
        server user-service-1:3000 weight=5 max_fails=3 fail_timeout=30s;
        server user-service-2:3000 weight=5 max_fails=3 fail_timeout=30s;
        server user-service-3:3000 weight=3 max_fails=3 fail_timeout=30s backup;
        keepalive 32;
    }

    upstream order_service {
        least_conn;
        server order-service-1:3000 max_fails=3 fail_timeout=30s;
        server order-service-2:3000 max_fails=3 fail_timeout=30s;
        keepalive 16;
    }

    upstream payment_service {
        server payment-service-1:3000 max_fails=2 fail_timeout=60s;
        server payment-service-2:3000 max_fails=2 fail_timeout=60s;
        keepalive 8;
    }

    # Cache settings
    proxy_cache_path /var/cache/nginx/api_cache
        levels=1:2
        keys_zone=api_cache:10m
        max_size=1g
        inactive=60m
        use_temp_path=off;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name api.example.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # Request ID generation
        set $request_id $http_x_request_id;
        if ($request_id = '') {
            set $request_id $request_id;
        }

        # Health check (no authentication required)
        location /health {
            access_log off;
            return 200 '{"status":"healthy"}';
        }

        # CORS Preflight
        location ~ ^/api/ {
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' 'https://app.example.com';
                add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
                add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Request-ID';
                add_header 'Access-Control-Max-Age' 86400;
                add_header 'Content-Length' 0;
                return 204;
            }

            # Fall through to the location blocks below
        }

        # Users API
        location /api/v1/users {
            limit_req zone=api_global burst=20 nodelay;
            limit_conn conn_limit 50;

            proxy_pass http://user_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Request-ID $request_id;

            proxy_connect_timeout 5s;
            proxy_read_timeout 30s;
            proxy_send_timeout 10s;

            # Response cache (GET requests only)
            proxy_cache api_cache;
            proxy_cache_methods GET;
            proxy_cache_valid 200 5m;
            proxy_cache_valid 404 1m;
            proxy_cache_key "$scheme$request_method$host$request_uri";
            proxy_cache_bypass $http_cache_control;
            add_header X-Cache-Status $upstream_cache_status;
        }

        # Orders API
        location /api/v1/orders {
            limit_req zone=api_global burst=10 nodelay;

            proxy_pass http://order_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Request-ID $request_id;

            proxy_connect_timeout 5s;
            proxy_read_timeout 60s;
            proxy_send_timeout 10s;
        }

        # Payments API (strict rate limiting)
        location /api/v1/payments {
            limit_req zone=auth_endpoint burst=5 nodelay;
            limit_conn conn_limit 10;

            proxy_pass http://payment_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Request-ID $request_id;

            proxy_connect_timeout 5s;
            proxy_read_timeout 120s;
            proxy_send_timeout 30s;

            # Cache disabled
            proxy_no_cache 1;
            proxy_cache_bypass 1;
        }

        # Error handling
        error_page 429 = @rate_limited;
        location @rate_limited {
            default_type application/json;
            return 429 '{"error":"rate_limit_exceeded","message":"Too many requests. Please retry after some time.","retry_after":60}';
        }

        error_page 502 503 504 = @service_unavailable;
        location @service_unavailable {
            default_type application/json;
            return 503 '{"error":"service_unavailable","message":"The service is temporarily unavailable. Please try again later."}';
        }
    }

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name api.example.com;
        return 301 https://$server_name$request_uri;
    }
}
```

---

## 6. Rate Limiting Design and Implementation

### 6.1 Comparison of Rate Limiting Algorithms

| Algorithm | Mechanism | Precision | Memory | Burst Allowed | Implementation Complexity |
|-----------|-----------|-----------|--------|---------------|--------------------------|
| Fixed Window | Count within fixed time window | Low | Small | 2x at window boundary | Low |
| Sliding Window Log | Record every request timestamp | High | Large | None | Medium |
| Sliding Window Counter | Weighted average of previous and current window | Medium–High | Small | Small | Medium |
| Token Bucket | Token consumption model | High | Small | Controllable | Medium |
| Leaky Bucket | Drain at a fixed rate | High | Small | None | Medium |

### 6.2 Token Bucket Algorithm Implementation

```javascript
// Token Bucket rate limiter (Redis-based)
const Redis = require('ioredis');

class TokenBucketRateLimiter {
  /**
   * @param {Object} options
   * @param {number} options.maxTokens - Maximum bucket capacity
   * @param {number} options.refillRate - Tokens refilled per second
   * @param {number} options.tokensPerRequest - Tokens consumed per request
   */
  constructor(options) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
    });
    this.maxTokens = options.maxTokens || 100;
    this.refillRate = options.refillRate || 10;
    this.tokensPerRequest = options.tokensPerRequest || 1;
    this.keyPrefix = 'ratelimit:token_bucket:';
  }

  /**
   * Rate limit check
   * @param {string} identifier - Client identifier (IP, API Key, User ID)
   * @returns {Object} { allowed, remaining, retryAfter, limit }
   */
  async checkLimit(identifier) {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();

    // Execute atomically via Lua script
    const luaScript = `
      local key = KEYS[1]
      local max_tokens = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local tokens_per_request = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])

      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1])
      local last_refill = tonumber(bucket[2])

      -- First access
      if tokens == nil then
        tokens = max_tokens
        last_refill = now
      end

      -- Refill tokens
      local elapsed = (now - last_refill) / 1000
      local new_tokens = elapsed * refill_rate
      tokens = math.min(max_tokens, tokens + new_tokens)

      -- Determine token consumption
      local allowed = 0
      local remaining = tokens
      local retry_after = 0

      if tokens >= tokens_per_request then
        tokens = tokens - tokens_per_request
        allowed = 1
        remaining = tokens
      else
        retry_after = math.ceil((tokens_per_request - tokens) / refill_rate)
        remaining = tokens
      end

      -- Update
      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
      redis.call('EXPIRE', key, math.ceil(max_tokens / refill_rate) + 10)

      return {allowed, math.floor(remaining), retry_after}
    `;

    const result = await this.redis.eval(
      luaScript, 1, key,
      this.maxTokens, this.refillRate, this.tokensPerRequest, now
    );

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfter: result[2],
      limit: this.maxTokens,
    };
  }

  /**
   * Express middleware
   */
  middleware(identifierFn) {
    return async (req, res, next) => {
      const identifier = identifierFn
        ? identifierFn(req)
        : req.headers['x-api-key'] || req.ip;

      try {
        const result = await this.checkLimit(identifier);

        // Set rate limit headers
        res.set('X-RateLimit-Limit', String(result.limit));
        res.set('X-RateLimit-Remaining', String(result.remaining));

        if (!result.allowed) {
          res.set('Retry-After', String(result.retryAfter));
          return res.status(429).json({
            error: 'rate_limit_exceeded',
            message: 'Too many requests',
            retryAfter: result.retryAfter,
            limit: result.limit,
          });
        }

        next();
      } catch (error) {
        // Allow request when Redis fails (fault-tolerant)
        console.error('Rate limiter error:', error.message);
        next();
      }
    };
  }
}

// Usage example
const rateLimiter = new TokenBucketRateLimiter({
  maxTokens: 100,     // Bucket capacity
  refillRate: 10,      // Refill 10 tokens per second
  tokensPerRequest: 1, // 1 request = 1 token
});

// Use with Express
const express = require('express');
const app = express();

// Global rate limiting
app.use(rateLimiter.middleware());

// Per-endpoint rate limiting
const strictLimiter = new TokenBucketRateLimiter({
  maxTokens: 10,
  refillRate: 1,
  tokensPerRequest: 1,
});

app.post('/api/v1/auth/login',
  strictLimiter.middleware((req) => `login:${req.ip}`),
  (req, res) => { /* ... */ }
);
```

### 6.3 Sliding Window Counter Implementation

```javascript
// Sliding Window Counter (balanced precision and memory efficiency)
class SlidingWindowRateLimiter {
  constructor(options) {
    this.redis = new Redis(options.redisUrl || 'redis://localhost:6379');
    this.windowSize = options.windowSize || 60; // seconds
    this.maxRequests = options.maxRequests || 100;
    this.keyPrefix = 'ratelimit:sliding:';
  }

  async checkLimit(identifier) {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(now / this.windowSize);
    const previousWindow = currentWindow - 1;
    const windowProgress = (now % this.windowSize) / this.windowSize;

    const luaScript = `
      local current_key = KEYS[1] .. ':' .. ARGV[1]
      local previous_key = KEYS[1] .. ':' .. ARGV[2]
      local max_requests = tonumber(ARGV[3])
      local window_progress = tonumber(ARGV[4])
      local window_size = tonumber(ARGV[5])

      local current_count = tonumber(redis.call('GET', current_key) or '0')
      local previous_count = tonumber(redis.call('GET', previous_key) or '0')

      -- Estimated rate via weighted average
      local estimated_count = previous_count * (1 - window_progress) + current_count

      if estimated_count >= max_requests then
        local retry_after = math.ceil(window_size * (1 - window_progress))
        return {0, math.floor(max_requests - estimated_count), retry_after}
      end

      -- Increment count
      redis.call('INCR', current_key)
      redis.call('EXPIRE', current_key, window_size * 2)

      local remaining = math.floor(max_requests - estimated_count - 1)
      return {1, remaining, 0}
    `;

    const result = await this.redis.eval(
      luaScript, 1, key,
      currentWindow, previousWindow,
      this.maxRequests, windowProgress, this.windowSize
    );

    return {
      allowed: result[0] === 1,
      remaining: Math.max(0, result[1]),
      retryAfter: result[2],
      limit: this.maxRequests,
    };
  }
}
```

---

## 7. Authentication Integration Patterns

### 7.1 Authentication Flow at the Gateway Layer

```
┌───────────────────────────────────────────────────────────────────┐
│ Gateway Authentication Flow                                        │
│                                                                   │
│  (1) API Key Authentication                                       │
│  Client ──[X-API-Key: xxx]──→ Gateway ──[Validate]──→ Backend    │
│                                  │                                │
│                                  ├── Validate Key via Redis/DB    │
│                                  ├── Check plan / quota           │
│                                  └── Attach X-Consumer-ID header  │
│                                                                   │
│  (2) JWT Bearer Token Authentication                              │
│  Client ──[Authorization: Bearer xxx]──→ Gateway ──→ Backend     │
│                                            │                      │
│                                            ├── Verify signature (RS256) │
│                                            ├── Check exp / iss    │
│                                            ├── Check scope        │
│                                            └── Attach X-User-ID   │
│                                                                   │
│  (3) OAuth 2.0 Token Introspection                                │
│  Client ──[Token]──→ Gateway ──→ Auth Server ──→ Gateway → Backend│
│                                      │                            │
│                                      ├── /introspect endpoint     │
│                                      ├── Check active / scope     │
│                                      └── Cache (5 minutes)        │
│                                                                   │
│  (4) mTLS (inter-service communication)                           │
│  Service A ──[Client Cert]──→ Gateway ──[Cert Verify]──→ Service B│
│                                  │                                │
│                                  ├── CA certificate chain verification │
│                                  ├── Service identification by CN/SAN  │
│                                  └── Certificate rotation support  │
└───────────────────────────────────────────────────────────────────┘
```

### 7.2 JWT Authentication Middleware Implementation

```javascript
// JWT authentication middleware for the gateway
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

class JwtAuthenticator {
  constructor(options) {
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.algorithms = options.algorithms || ['RS256'];
    this.clockTolerance = options.clockTolerance || 30;

    // JWKS client (dynamic public key retrieval)
    this.jwks = jwksClient({
      jwksUri: `${this.issuer}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10-minute cache
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });

    // Path exclusion configuration
    this.excludePaths = new Set(options.excludePaths || [
      '/health',
      '/metrics',
      '/api/v1/auth/login',
      '/api/v1/auth/register',
    ]);
  }

  /**
   * Retrieve the signing key for verification
   */
  getSigningKey(header) {
    return new Promise((resolve, reject) => {
      this.jwks.getSigningKey(header.kid, (err, key) => {
        if (err) return reject(err);
        resolve(key.getPublicKey());
      });
    });
  }

  /**
   * Express middleware
   */
  middleware() {
    return async (req, res, next) => {
      // Check excluded paths
      if (this.excludePaths.has(req.path)) {
        return next();
      }

      // Skip OPTIONS requests
      if (req.method === 'OPTIONS') {
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Missing or invalid Authorization header',
        });
      }

      const token = authHeader.substring(7);

      try {
        // Decode header first to obtain kid
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded || !decoded.header) {
          return res.status(401).json({
            error: 'invalid_token',
            message: 'Token could not be decoded',
          });
        }

        // Retrieve public key and verify
        const signingKey = await this.getSigningKey(decoded.header);
        const payload = jwt.verify(token, signingKey, {
          algorithms: this.algorithms,
          issuer: this.issuer,
          audience: this.audience,
          clockTolerance: this.clockTolerance,
        });

        // Attach verified info to the request
        req.user = {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles || [],
          scopes: payload.scope ? payload.scope.split(' ') : [],
        };

        // Set headers for backend services
        req.headers['x-user-id'] = payload.sub;
        req.headers['x-user-email'] = payload.email || '';
        req.headers['x-user-roles'] = (payload.roles || []).join(',');

        next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: 'token_expired',
            message: 'Token has expired',
            expiredAt: error.expiredAt,
          });
        }
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            error: 'invalid_token',
            message: error.message,
          });
        }
        console.error('JWT verification error:', error);
        return res.status(500).json({
          error: 'internal_error',
          message: 'Authentication service unavailable',
        });
      }
    };
  }

  /**
   * Scope-based authorization middleware
   */
  requireScopes(...requiredScopes) {
    return (req, res, next) => {
      if (!req.user || !req.user.scopes) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Insufficient permissions',
        });
      }

      const hasAllScopes = requiredScopes.every(
        scope => req.user.scopes.includes(scope)
      );

      if (!hasAllScopes) {
        return res.status(403).json({
          error: 'insufficient_scope',
          message: `Required scopes: ${requiredScopes.join(', ')}`,
          requiredScopes,
          currentScopes: req.user.scopes,
        });
      }

      next();
    };
  }
}

// Usage example
const auth = new JwtAuthenticator({
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com',
  algorithms: ['RS256'],
  excludePaths: ['/health', '/api/v1/auth/login'],
});

app.use(auth.middleware());

app.get('/api/v1/admin/users',
  auth.requireScopes('admin:read', 'users:list'),
  (req, res) => {
    // Accessible via req.user.id, req.user.roles
    res.json({ users: [] });
  }
);
```

---

## 8. Circuit Breaker Pattern

### 8.1 State Transition Model

```
┌───────────────────────────────────────────────────────────┐
│ Circuit Breaker State Transition Diagram                   │
│                                                           │
│    ┌──────────┐  Failure threshold exceeded ┌──────────┐  │
│    │  CLOSED  │ ─────────────────────────→  │   OPEN   │  │
│    │ (normal) │                             │ (tripped)│  │
│    │          │ ←───────────────────────────│          │  │
│    └──────────┘   3 successes               └────┬─────┘  │
│         ↑                                        │        │
│         │  Success                               │ Timeout│
│         │                                        ↓        │
│         │                              ┌──────────┐       │
│         └──────────────────────────────│HALF-OPEN │       │
│                          Success       │ (testing)│       │
│                                        └────┬─────┘       │
│                                             │              │
│                                             │ Failure      │
│                                             ↓              │
│                                        ┌──────────┐       │
│                                        │   OPEN   │       │
│                                        │ (re-trip)│       │
│                                        └──────────┘       │
│                                                           │
│  Parameter setting guidelines:                            │
│   Failure threshold: 5 consecutive failures or 50% error rate (last 10 requests) │
│   Timeout: transition to Half-Open after 30 seconds       │
│   Success threshold: return to Closed after 3 consecutive successes in Half-Open  │
│   Monitoring window: calculate error rate over the last 10 requests               │
└───────────────────────────────────────────────────────────┘
```

### 8.2 Production-Quality Circuit Breaker Implementation

```javascript
// Production-quality circuit breaker
const EventEmitter = require('events');

class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 3;
    this.resetTimeout = options.resetTimeout || 30000;
    this.monitorWindow = options.monitorWindow || 10;
    this.halfOpenMaxConcurrent = options.halfOpenMaxConcurrent || 1;

    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.halfOpenRequests = 0;
    this.requestHistory = [];

    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      stateChanges: [],
    };
  }

  getState() {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this._transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  _transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
      this.halfOpenRequests = 0;
      this.requestHistory = [];
    }
    if (newState === 'HALF_OPEN') {
      this.halfOpenRequests = 0;
      this.successes = 0;
    }

    this.metrics.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: new Date().toISOString(),
    });

    this.emit('stateChange', { from: oldState, to: newState, name: this.name });
  }

  _getErrorRate() {
    if (this.requestHistory.length < this.monitorWindow) {
      return 0;
    }
    const recentRequests = this.requestHistory.slice(-this.monitorWindow);
    const failures = recentRequests.filter(r => !r.success).length;
    return failures / recentRequests.length;
  }

  async execute(fn, fallback) {
    this.metrics.totalRequests++;
    const currentState = this.getState();

    // OPEN state: reject immediately
    if (currentState === 'OPEN') {
      this.metrics.rejectedRequests++;
      this.emit('rejected', { name: this.name, state: currentState });

      if (fallback) {
        return fallback(new Error(`Circuit ${this.name} is OPEN`));
      }
      throw new Error(`Circuit ${this.name} is OPEN`);
    }

    // HALF_OPEN state: limit concurrent requests
    if (currentState === 'HALF_OPEN') {
      if (this.halfOpenRequests >= this.halfOpenMaxConcurrent) {
        this.metrics.rejectedRequests++;
        if (fallback) {
          return fallback(new Error(`Circuit ${this.name} is HALF_OPEN (max concurrent)`));
        }
        throw new Error(`Circuit ${this.name} is HALF_OPEN (max concurrent reached)`);
      }
      this.halfOpenRequests++;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      if (fallback) return fallback(error);
      throw error;
    }
  }

  _onSuccess() {
    this.metrics.successfulRequests++;
    this.requestHistory.push({ success: true, timestamp: Date.now() });

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this._transitionTo('CLOSED');
        this.emit('recovery', { name: this.name });
      }
    }

    // Reset consecutive failure count in CLOSED state
    if (this.state === 'CLOSED') {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  _onFailure(error) {
    this.metrics.failedRequests++;
    this.requestHistory.push({ success: false, timestamp: Date.now(), error: error.message });
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this._transitionTo('OPEN');
      this.emit('trip', { name: this.name, error: error.message });
      return;
    }

    if (this.state === 'CLOSED') {
      this.failures++;
      const errorRate = this._getErrorRate();

      if (this.failures >= this.failureThreshold || errorRate >= 0.5) {
        this._transitionTo('OPEN');
        this.emit('trip', { name: this.name, error: error.message, errorRate });
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentState: this.getState(),
      errorRate: this._getErrorRate(),
      consecutiveFailures: this.failures,
    };
  }

  reset() {
    this._transitionTo('CLOSED');
  }
}

// Circuit breaker registry (managing multiple services)
class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }

  get(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({ name, ...options });

      breaker.on('stateChange', (event) => {
        console.log(`[CircuitBreaker] ${event.name}: ${event.from} → ${event.to}`);
      });
      breaker.on('trip', (event) => {
        console.error(`[CircuitBreaker] ${event.name} TRIPPED: ${event.error}`);
      });
      breaker.on('recovery', (event) => {
        console.log(`[CircuitBreaker] ${event.name} RECOVERED`);
      });

      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name);
  }

  getAllMetrics() {
    const metrics = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }
}

// Usage example
const registry = new CircuitBreakerRegistry();

async function getUser(id) {
  const breaker = registry.get('user-service', {
    failureThreshold: 5,
    resetTimeout: 30000,
    successThreshold: 3,
  });

  return breaker.execute(
    async () => {
      const response = await fetch(`http://user-service:3000/users/${id}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    (error) => ({
      id,
      name: 'Unknown User',
      _fallback: true,
      _error: error.message,
    })
  );
}

// Metrics endpoint
app.get('/metrics/circuit-breakers', (req, res) => {
  res.json(registry.getAllMetrics());
});
```

---

## 9. Integration with Service Meshes

### 9.1 Basic Concepts of Service Meshes

A service mesh is an infrastructure layer that manages communication between microservices. While an API gateway manages "north-south" (external→internal) traffic, a service mesh manages "east-west" (inter-service) traffic.

```
┌───────────────────────────────────────────────────────────────────┐
│ API Gateway vs Service Mesh                                        │
│                                                                   │
│  North-South Traffic                                              │
│  ─────────────────────────────                                    │
│  External client → API Gateway → Internal services               │
│                                                                   │
│  · Handles requests from outside                                  │
│  · Authentication, rate limiting, TLS termination                 │
│  · API management, developer portal                               │
│                                                                   │
│  East-West Traffic                                                │
│  ─────────────────────────────                                    │
│  Internal service ↔ Sidecar proxy ↔ Internal service             │
│                                                                   │
│  · Encryption of inter-service communication (mTLS)               │
│  · Service discovery                                              │
│  · Load balancing, retries, circuit breakers                      │
│  · Traffic control (canary, A/B testing)                          │
│  · Observability (metrics, traces, logs)                          │
└───────────────────────────────────────────────────────────────────┘
```

### 9.2 Istio + Envoy Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│ Istio Architecture                                                 │
│                                                                   │
│  ┌─────────────────── Control Plane ──────────────────┐           │
│  │                                                     │           │
│  │   istiod (Pilot + Citadel + Galley unified)         │           │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │           │
│  │   │  Pilot   │ │ Citadel  │ │   Configuration  │   │           │
│  │   │ (Config) │ │ (Cert)   │ │   (Validation)   │   │           │
│  │   └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │           │
│  └────────┼─────────────┼───────────────┼─────────────┘           │
│           │ xDS API     │ mTLS certs     │ Config distribution     │
│  ┌────────▼─────────────▼───────────────▼─────────────┐           │
│  │                 Data Plane                          │           │
│  │                                                     │           │
│  │  ┌──────────────┐    ┌──────────────┐               │           │
│  │  │  Pod A       │    │  Pod B       │               │           │
│  │  │ ┌──────────┐ │    │ ┌──────────┐ │               │           │
│  │  │ │ Service A│ │    │ │ Service B│ │               │           │
│  │  │ └────┬─────┘ │    │ └────┬─────┘ │               │           │
│  │  │      │       │    │      │       │               │           │
│  │  │ ┌────▼─────┐ │    │ ┌────▼─────┐ │               │           │
│  │  │ │  Envoy   │◄├────┤►│  Envoy   │ │               │           │
│  │  │ │ (Sidecar)│ │mTLS│ │ (Sidecar)│ │               │           │
│  │  │ └──────────┘ │    │ └──────────┘ │               │           │
│  │  └──────────────┘    └──────────────┘               │           │
│  └─────────────────────────────────────────────────────┘           │
└───────────────────────────────────────────────────────────────────┘
```

### 9.3 Istio Configuration Examples

```yaml
# VirtualService: traffic routing
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: user-service-vs
  namespace: api
spec:
  hosts:
    - user-service
  http:
    # Canary release: route 10% of traffic to v2
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: user-service
            subset: v2
          weight: 100
    - route:
        - destination:
            host: user-service
            subset: v1
          weight: 90
        - destination:
            host: user-service
            subset: v2
          weight: 10
      timeout: 10s
      retries:
        attempts: 3
        perTryTimeout: 3s
        retryOn: 5xx,reset,connect-failure,retriable-4xx
      fault:
        delay:
          percentage:
            value: 0.1
          fixedDelay: 5s
---
# DestinationRule: subset definition and circuit breaker
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: user-service-dr
  namespace: api
spec:
  host: user-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
        connectTimeout: 5s
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
        maxRequestsPerConnection: 10
        maxRetries: 3
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    loadBalancer:
      simple: LEAST_REQUEST
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
---
# PeerAuthentication: mTLS configuration
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: api
spec:
  mtls:
    mode: STRICT
---
# AuthorizationPolicy: inter-service authorization
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: user-service-authz
  namespace: api
spec:
  selector:
    matchLabels:
      app: user-service
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/api/sa/order-service"
              - "cluster.local/ns/api/sa/api-gateway"
      to:
        - operation:
            methods: ["GET", "POST"]
            paths: ["/users/*"]
    - from:
        - source:
            principals:
              - "cluster.local/ns/api/sa/api-gateway"
      to:
        - operation:
            methods: ["DELETE"]
            paths: ["/users/*"]
---
# RequestAuthentication: JWT authentication (Istio Ingress Gateway)
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: istio-system
spec:
  selector:
    matchLabels:
      istio: ingressgateway
  jwtRules:
    - issuer: "https://auth.example.com/"
      jwksUri: "https://auth.example.com/.well-known/jwks.json"
      audiences:
        - "https://api.example.com"
      forwardOriginalToken: true
      outputPayloadToHeader: "x-jwt-payload"
```

### 9.4 Two-Tier Configuration: Istio Gateway + API Gateway

```yaml
# Istio Ingress Gateway (entry point for external traffic)
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: api-gateway
  namespace: istio-system
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: api-tls-credential
      hosts:
        - "api.example.com"
---
# VirtualService: Istio Ingress → Kong Gateway
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-routing
  namespace: api
spec:
  hosts:
    - "api.example.com"
  gateways:
    - istio-system/api-gateway
  http:
    - match:
        - uri:
            prefix: /api/
      route:
        - destination:
            host: kong-proxy.kong-system.svc.cluster.local
            port:
              number: 80
      corsPolicy:
        allowOrigins:
          - exact: "https://app.example.com"
        allowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        allowHeaders:
          - Authorization
          - Content-Type
          - X-Request-ID
        maxAge: "86400s"
```

---

## 10. BFF (Backend for Frontend) Pattern in Detail

### 10.1 BFF Design Principles

```
BFF Pattern Overview:

  ┌───────────────────────────────────────────────────────────────┐
  │                                                               │
  │  Web Browser ─── Web BFF ───┐                                 │
  │                              │                                │
  │  iOS App ────── Mobile BFF ──┼──→ User Service                │
  │  Android App ──┘              │    Order Service               │
  │                              │    Payment Service             │
  │  Partner API ── Public GW ───┘    Notification Service        │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘

  Responsibilities of each BFF:
  ┌────────────────────────────────────────────────────────────┐
  │ Web BFF:                                                   │
  │  ├── Full-featured responses                               │
  │  ├── Data aggregation for SSR                              │
  │  ├── Cookie-based authentication (HttpOnly, Secure, SameSite) │
  │  ├── CSRF protection                                       │
  │  ├── HTML metadata generation (OGP, SEO)                   │
  │  └── WebSocket connection management                       │
  │                                                            │
  │ Mobile BFF:                                                │
  │  ├── Lightweight responses (field selection, bandwidth saving) │
  │  ├── Push notification token management                    │
  │  ├── Bearer Token authentication (OAuth 2.0)               │
  │  ├── Offline support (delta sync API)                      │
  │  ├── App-version compatibility layer                       │
  │  └── Device info header processing                         │
  │                                                            │
  │ Public API GW:                                             │
  │  ├── REST + pagination (cursor-based)                      │
  │  ├── API Key authentication + Usage Plans                  │
  │  ├── Strict rate limiting (per plan)                       │
  │  ├── Auto-generated OpenAPI spec                           │
  │  ├── Webhook delivery                                      │
  │  └── API versioning (URL / Header)                         │
  └────────────────────────────────────────────────────────────┘
```

### 10.2 BFF Implementation Example (Node.js / Express)

```javascript
// Web BFF - API Composition pattern
const express = require('express');
const axios = require('axios');

const app = express();

// Service clients (with circuit breaker)
const serviceClients = {
  user: createServiceClient('http://user-service:3000', 'user-service'),
  order: createServiceClient('http://order-service:3000', 'order-service'),
  product: createServiceClient('http://product-service:3000', 'product-service'),
};

function createServiceClient(baseURL, name) {
  const client = axios.create({
    baseURL,
    timeout: 5000,
    headers: { 'Content-Type': 'application/json' },
  });
  const breaker = registry.get(name, {
    failureThreshold: 5,
    resetTimeout: 30000,
  });

  return {
    async get(path, options = {}) {
      return breaker.execute(
        () => client.get(path, options).then(r => r.data),
        () => options.fallback || null
      );
    },
    async post(path, data, options = {}) {
      return breaker.execute(
        () => client.post(path, data, options).then(r => r.data),
        () => options.fallback || null
      );
    },
  };
}

// Dashboard API: aggregate data from multiple services
app.get('/bff/dashboard', async (req, res) => {
  const userId = req.headers['x-user-id'];

  try {
    // Parallel requests (use Promise.allSettled to handle partial failures)
    const [userResult, ordersResult, recommendationsResult] = await Promise.allSettled([
      serviceClients.user.get(`/users/${userId}`, {
        fallback: { id: userId, name: 'User', _fallback: true },
      }),
      serviceClients.order.get(`/orders?userId=${userId}&limit=5`, {
        fallback: { items: [], total: 0, _fallback: true },
      }),
      serviceClients.product.get(`/recommendations?userId=${userId}&limit=10`, {
        fallback: { items: [], _fallback: true },
      }),
    ]);

    // Aggregate responses
    const dashboard = {
      user: userResult.status === 'fulfilled' ? userResult.value : null,
      recentOrders: ordersResult.status === 'fulfilled' ? ordersResult.value : { items: [] },
      recommendations: recommendationsResult.status === 'fulfilled'
        ? recommendationsResult.value
        : { items: [] },
      _metadata: {
        timestamp: new Date().toISOString(),
        partial: [userResult, ordersResult, recommendationsResult]
          .some(r => r.status === 'rejected' || (r.value && r.value._fallback)),
      },
    };

    // Return 206 Partial Content on partial failure
    const statusCode = dashboard._metadata.partial ? 206 : 200;
    res.status(statusCode).json(dashboard);
  } catch (error) {
    console.error('Dashboard aggregation error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Mobile BFF: lightweight response + field selection
app.get('/bff/mobile/feed', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const fields = req.query.fields ? req.query.fields.split(',') : null;
  const appVersion = req.headers['x-app-version'] || '1.0.0';

  try {
    const [orders, notifications] = await Promise.all([
      serviceClients.order.get(`/orders?userId=${userId}&limit=20`),
      serviceClients.user.get(`/users/${userId}/notifications?unread=true`),
    ]);

    let feed = {
      orders: orders?.items || [],
      unreadCount: notifications?.total || 0,
      notifications: (notifications?.items || []).slice(0, 5),
    };

    // Field selection (bandwidth saving)
    if (fields) {
      const filteredFeed = {};
      for (const field of fields) {
        if (feed[field] !== undefined) {
          filteredFeed[field] = feed[field];
        }
      }
      feed = filteredFeed;
    }

    // App version compatibility
    if (compareVersions(appVersion, '2.0.0') < 0) {
      // Convert to v1 format
      feed = transformToV1Format(feed);
    }

    res.json(feed);
  } catch (error) {
    console.error('Mobile feed error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function transformToV1Format(feed) {
  return {
    data: feed.orders || [],
    badge: feed.unreadCount || 0,
  };
}
```

---

## 11. Retry Strategies and Timeout Design

### 11.1 Comparison of Retry Patterns

| Pattern | Description | Use Case | Caution |
|---------|-------------|----------|---------|
| Immediate Retry | Retry instantly | Transient network errors | Adds load to service |
| Fixed Interval | Retry at fixed intervals | Short-lived failures | Thundering herd problem |
| Exponential Backoff | Exponentially growing intervals | General retry scenarios | Must set a maximum interval |
| Exponential + Jitter | Exponential + random jitter | Recommended for distributed systems | Standard best practice |
| Circuit Breaker + Retry | Retry within CB | Combined with failure detection | Complex but most robust |

### 11.2 Exponential Backoff with Jitter Implementation

```javascript
// Production-quality retry utility
class RetryPolicy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;  // 1 second
    this.maxDelay = options.maxDelay || 30000;    // 30 seconds
    this.jitterFactor = options.jitterFactor || 0.5;
    this.retryableErrors = options.retryableErrors || [
      'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE',
      'EAI_AGAIN', 'EHOSTUNREACH',
    ];
    this.retryableStatusCodes = options.retryableStatusCodes || [
      408, 429, 500, 502, 503, 504,
    ];
  }

  /**
   * Determine whether an error is retryable
   */
  isRetryable(error) {
    // Network errors
    if (error.code && this.retryableErrors.includes(error.code)) {
      return true;
    }
    // HTTP status codes
    if (error.response && this.retryableStatusCodes.includes(error.response.status)) {
      return true;
    }
    return false;
  }

  /**
   * Calculate the delay before the next retry
   * Exponential Backoff with Full Jitter
   */
  calculateDelay(attempt) {
    // Exponential backoff
    const exponentialDelay = Math.min(
      this.maxDelay,
      this.baseDelay * Math.pow(2, attempt)
    );
    // Full Jitter: random value in [0, exponentialDelay]
    const jitter = Math.random() * exponentialDelay * this.jitterFactor;
    return Math.floor(exponentialDelay * (1 - this.jitterFactor) + jitter);
  }

  /**
   * Execute a function with retry
   */
  async execute(fn, context = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn(attempt);
        return result;
      } catch (error) {
        lastError = error;

        // Final attempt or non-retryable error
        if (attempt === this.maxRetries || !this.isRetryable(error)) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);

        // Respect Retry-After header for 429 responses
        const retryAfterHeader = error.response?.headers?.['retry-after'];
        const actualDelay = retryAfterHeader
          ? Math.max(delay, parseInt(retryAfterHeader) * 1000)
          : delay;

        console.warn(
          `[Retry] ${context.name || 'request'} attempt ${attempt + 1}/${this.maxRetries}`,
          `delay=${actualDelay}ms`,
          `error=${error.message}`
        );

        await new Promise(resolve => setTimeout(resolve, actualDelay));
      }
    }

    throw lastError;
  }
}

// Timeout hierarchy design
class TimeoutConfig {
  /**
   * Timeout hierarchy:
   *   Client > Gateway > Service > DB / External API
   *
   *   Client: 30s → Gateway: 25s → Service: 20s → DB: 5s
   *   Each layer has a margin to allow proper error responses to be returned
   */
  static getConfig(tier) {
    const configs = {
      // Gateway facing external clients
      gateway: {
        connectTimeout: 5000,
        readTimeout: 25000,
        writeTimeout: 10000,
        idleTimeout: 60000,
      },
      // Inter-service communication
      service: {
        connectTimeout: 3000,
        readTimeout: 20000,
        writeTimeout: 5000,
        idleTimeout: 30000,
      },
      // Database connection
      database: {
        connectTimeout: 2000,
        queryTimeout: 5000,
        poolTimeout: 10000,
      },
      // External API calls
      externalApi: {
        connectTimeout: 5000,
        readTimeout: 15000,
        writeTimeout: 5000,
      },
    };
    return configs[tier];
  }
}

// Usage example: calling a service from the gateway
const retryPolicy = new RetryPolicy({
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 5000,
});

async function callUserService(userId) {
  const timeouts = TimeoutConfig.getConfig('service');

  return retryPolicy.execute(
    async (attempt) => {
      const response = await axios.get(
        `http://user-service:3000/users/${userId}`,
        {
          timeout: timeouts.readTimeout,
          headers: {
            'X-Retry-Attempt': String(attempt),
            'X-Request-Timeout': String(timeouts.readTimeout),
          },
        }
      );
      return response.data;
    },
    { name: `getUser(${userId})` }
  );
}
```

---

## 12. Monitoring and Observability

### 12.1 Metrics Design for API Gateways

The metrics to collect at the gateway are based on the RED method (Rate, Error, Duration).

```
API Gateway Metrics Framework:

  (1) Rate (request rate)
      ├── requests_total: total request count
      ├── requests_per_second: RPS (requests per second)
      └── requests_by_route: request count per route

  (2) Error (error rate)
      ├── errors_total: total error count
      ├── error_rate: error rate (4xx + 5xx) / total
      ├── errors_by_status: error count by status code
      └── circuit_breaker_trips: circuit breaker trip count

  (3) Duration (latency)
      ├── request_duration_seconds: request processing time
      │   ├── P50 (median)
      │   ├── P95
      │   ├── P99
      │   └── P99.9
      ├── upstream_response_time: upstream response time
      └── gateway_processing_time: gateway's own processing time

  (4) Saturation
      ├── active_connections: active connection count
      ├── connection_pool_usage: connection pool utilization
      ├── rate_limit_remaining: remaining rate limit quota
      └── memory_usage: memory usage
```

### 12.2 Prometheus Metrics Collection (Express Middleware)

```javascript
// Prometheus metrics collection middleware
const promClient = require('prom-client');

// Default metrics (CPU, memory, event loop)
promClient.collectDefaultMetrics({
  prefix: 'api_gateway_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'api_gateway_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestTotal = new promClient.Counter({
  name: 'api_gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
});

const activeConnections = new promClient.Gauge({
  name: 'api_gateway_active_connections',
  help: 'Number of active connections',
});

const circuitBreakerState = new promClient.Gauge({
  name: 'api_gateway_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['service'],
});

const rateLimitHits = new promClient.Counter({
  name: 'api_gateway_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['identifier_type', 'endpoint'],
});

const upstreamResponseTime = new promClient.Histogram({
  name: 'api_gateway_upstream_response_time_seconds',
  help: 'Upstream service response time',
  labelNames: ['service'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
});

// Metrics collection middleware
function metricsMiddleware() {
  return (req, res, next) => {
    activeConnections.inc();
    const startTime = process.hrtime.bigint();

    // Record metrics on response completion
    res.on('finish', () => {
      activeConnections.dec();
      const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
      const route = req.route?.path || req.path;
      const service = req.headers['x-target-service'] || 'unknown';

      httpRequestDuration.observe(
        { method: req.method, route, status_code: res.statusCode, service },
        duration
      );

      httpRequestTotal.inc(
        { method: req.method, route, status_code: res.statusCode, service }
      );
    });

    next();
  };
}

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.send(await promClient.register.metrics());
});

// PromQL query examples for Grafana dashboards
const grafanaQueries = {
  // RPS (requests per second)
  rps: 'rate(api_gateway_http_requests_total[5m])',

  // Error rate (5xx)
  errorRate: 'sum(rate(api_gateway_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(api_gateway_http_requests_total[5m]))',

  // P99 latency
  p99Latency: 'histogram_quantile(0.99, sum(rate(api_gateway_http_request_duration_seconds_bucket[5m])) by (le, route))',

  // Upstream response time by service
  upstreamP95: 'histogram_quantile(0.95, sum(rate(api_gateway_upstream_response_time_seconds_bucket[5m])) by (le, service))',

  // Circuit breaker state
  cbState: 'api_gateway_circuit_breaker_state',

  // Rate limit hit rate
  rateLimitRate: 'rate(api_gateway_rate_limit_hits_total[5m])',
};
```

### 12.3 Distributed Tracing Integration

```javascript
// Distributed tracing via OpenTelemetry
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { Resource } = require('@opentelemetry/resources');
const {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} = require('@opentelemetry/semantic-conventions');

// SDK initialization
const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'api-gateway',
    [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4317',
  }),
  instrumentations: [
    new HttpInstrumentation({
      requestHook: (span, request) => {
        span.setAttribute('http.route', request.path);
        span.setAttribute('gateway.client_ip', request.headers['x-real-ip'] || request.ip);
      },
    }),
    new ExpressInstrumentation(),
  ],
});

sdk.start();

// Trace context propagation middleware
function tracePropagation() {
  return (req, res, next) => {
    // Forward W3C Trace Context headers to upstream services
    const traceParent = req.headers['traceparent'];
    const traceState = req.headers['tracestate'];

    if (traceParent) {
      req.traceContext = { traceParent, traceState };
    }

    // Set request ID (linked to trace ID)
    const requestId = req.headers['x-request-id'] || generateRequestId();
    req.headers['x-request-id'] = requestId;
    res.set('X-Request-ID', requestId);

    next();
  };
}

function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}
```

---

## FAQ

### Q1: What are the criteria for deciding whether an API Gateway is necessary?

Introducing an API Gateway is particularly effective in the following situations.

| Situation | Gateway Not Needed | Gateway Recommended |
|-----------|-------------------|---------------------|
| Number of services | Monolith, 1–2 services | 3+ microservices |
| Client types | Single web app only | Multiple clients: Web, Mobile, third-party APIs, etc. |
| Authentication requirements | Different auth per service | Unified authentication & authorization needed |
| Rate limiting | Not needed, or already implemented per service | Global rate limiting required |
| TLS termination | Each service handles TLS directly | Centralize TLS termination in one place |
| Operational burden | Per-service config changes are acceptable | Unified config management and monitoring needed |

**Typical cases where Gateway is not needed**:
- Simple monolithic applications
- Systems with an internal admin panel only
- Few services with no plans to grow

**Typical cases where Gateway is essential**:
- Systems with 10+ microservices
- Multi-device support requiring BFF (Backend for Frontend) patterns
- Platform businesses providing an API to third parties
- Legacy system modernization transition (Strangler Fig Pattern)

For a minimal configuration, it is also practical to start with Nginx as a reverse proxy and migrate to Kong or AWS API Gateway once authentication integration and rate limiting become necessary.

### Q2: How should you compare Kong vs AWS API Gateway and other tools?

A comparison of major API Gateway products is shown below.

| Product | Type | Key Features | Use Case |
|---------|------|-------------|----------|
| **Kong Gateway** | OSS + Enterprise | - Rich plugin ecosystem<br>- Kubernetes Native (Ingress Controller)<br>- High performance (C + Lua)<br>- Self-hosted or Kong Konnect (SaaS) | Medium–large scale, Kubernetes environments, customizability-focused |
| **AWS API Gateway** | Managed (SaaS) | - Easy integration with AWS services<br>- Serverless (Lambda integration)<br>- Automatic scalability<br>- Pay-per-use model | AWS environments, serverless-centric, minimize operational burden |
| **Nginx / Nginx Plus** | OSS + Commercial | - High performance, low latency<br>- Proven as a reverse proxy<br>- Config-file based<br>- Dynamic config and health checks with Plus | Legacy environment compatibility, simple routing |
| **Envoy Proxy** | OSS (CNCF) | - Standard proxy for service meshes<br>- Dynamic config via xDS protocol<br>- Istio data plane<br>- Advanced traffic control | Kubernetes + service mesh environments, advanced microservice traffic control |
| **Azure API Management** | Managed (SaaS) | - Azure integration<br>- Developer portal included<br>- API versioning and transformation | Azure environments, API product management focus |
| **Tyk** | OSS + Enterprise | - GraphQL support<br>- API analytics<br>- Developer portal | API-as-a-Product, building developer ecosystems |

**Selection flowchart**:

```
Primarily AWS environment?
  → Yes → Serverless-centric?
           → Yes → AWS API Gateway
           → No → Kong on EKS or ALB + Lambda Authorizer
  → No → Kubernetes environment?
          → Yes → Service mesh (Istio) needed?
                   → Yes → Envoy (Istio)
                   → No → Kong Ingress Controller
          → No → Existing Nginx assets?
                  → Yes → Nginx Plus
                  → No → Kong (Docker Compose / VM)
```

**Estimated cost comparison** (assuming 100M requests per month):
- AWS API Gateway: $350–500 (REST API), $100–150 (HTTP API)
- Kong (self-hosted): $100–200 (infrastructure cost) + operational cost
- Kong Konnect (SaaS): $1500–3000/month (Enterprise)
- Nginx Plus: $2500/year/instance

### Q3: What Gateway patterns are used in microservices environments?

Three representative placement patterns for API Gateways in microservices architectures are as follows.

#### Pattern 1: Single API Gateway (Simple Configuration)

```
         ┌─────────────────┐
Internet─┤  API Gateway    ├─── User Service
         │  (Kong / AWS)   ├─── Order Service
         └─────────────────┘└─── Payment Service

Pros:
  - Simple configuration
  - Low operational cost
  - Easy to apply unified policies

Cons:
  - Gateway becomes SPOF (single point of failure)
  - Scaling limitations
  - All teams share the same gateway, requiring coordination for changes
```

#### Pattern 2: BFF (Backend for Frontend) Pattern

```
         ┌──────────────┐
Web App ─┤ Web BFF      ├─┐
         └──────────────┘ │
         ┌──────────────┐ │  ┌────────────┐
Mobile ──┤ Mobile BFF   ├─┼──┤ User Svc   │
         └──────────────┘ │  ├────────────┤
         ┌──────────────┐ │  │ Order Svc  │
Partner ─┤ Partner API  ├─┘  ├────────────┤
         └──────────────┘    │ Payment    │
                             └────────────┘

Pros:
  - API design optimized for client characteristics
  - Each team can manage their gateway independently
  - Failure blast radius is limited

Cons:
  - Number of gateways increases, raising operational costs
  - Risk of duplicating common functionality (auth, logging, etc.)
  - Applying common policies across services becomes complex
```

#### Pattern 3: Layered Gateway (Large-Scale Configuration)

```
                    ┌──────────────────┐
Internet ───────────┤ Edge Gateway     ├── DDoS protection, TLS termination, WAF
                    │ (Cloudflare/CDN) │
                    └─────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         ┌────v─────┐   ┌────v─────┐   ┌────v─────┐
         │ Web BFF  │   │Mobile BFF│   │ API GW   │
         └────┬─────┘   └────┬─────┘   └────┬─────┘
              │               │               │
         ┌────v──────────────v───────────────v────┐
         │         Service Mesh (Istio/Envoy)     │
         │  ┌────────┐ ┌────────┐ ┌────────┐     │
         │  │User Svc│ │Order   │ │Payment │     │
         │  └────────┘ └────────┘ └────────┘     │
         └──────────────────────────────────────┘

Pros:
  - High scalability through role separation
  - Separation of security layer (Edge) and business logic layer (BFF)
  - Advanced control of inter-microservice communication via service mesh

Cons:
  - Complex architecture
  - Requires advanced operational skills
  - Latency overhead from multiple proxy layers
```

**Recommended approach**:
- Startup, small-scale: Start with Pattern 1 (single Gateway)
- Multiple client types (Web/Mobile/Partner): Pattern 2 (BFF)
- Enterprise, high-traffic: Pattern 3 (layered + Service Mesh)

---

## Summary

| Concept | Key Point |
|---------|-----------|
| API Gateway role | "Front door" that centralizes routing, authentication, rate limiting, and TLS termination |
| Key functions | (1) Routing, (2) Auth & authorization, (3) Rate limiting, (4) Request transformation, (5) Load balancing, (6) Caching, (7) Logging, (8) Circuit breaker |
| Kong Gateway | Lua plugin ecosystem, Kubernetes Ingress Controller, high performance |
| AWS API Gateway | Managed service, Lambda integration, pay-per-use, minimal operational burden |
| Nginx | High-performance reverse proxy, config-file based, strong in legacy environments |
| Envoy Proxy | Service mesh data plane, xDS dynamic config, Istio standard |
| BFF pattern | Dedicated gateway per client type, optimized API delivery |
| Rate limiting | Token Bucket (burst-tolerant), Sliding Window (strict limiting) |
| Circuit breaker | Automatically trips when upstream service fails, fail-fast behavior |
| Service mesh integration | Istio + Envoy for East-West traffic control; Gateway handles North-South |

**Key takeaways**:
1. **An API Gateway is not "mandatory"**: Overkill for monoliths and small-scale systems. Consider introducing one when the number of services reaches 3+, or when multiple client types need to be supported.
2. **Incremental adoption**: It is practical to start with Nginx as a reverse proxy, then add authentication and rate limiting with Kong, and eventually transition to a service mesh.
3. **Set up monitoring at the same time as the Gateway**: Building metrics, logging, and tracing in from the early stage makes troubleshooting significantly easier.

---

## Next Guides to Read

→ [SDK Design](../02-sdk-and-libraries/00-sdk-design.md) — Designing SDKs for API consumers
→ [Authentication Patterns](../03-api-security/00-authentication-patterns.md) — API authentication at the Gateway

---

## References

1. Kong Inc. "Kong Gateway Documentation." Kong Inc., 2024. https://docs.konghq.com/gateway/latest/
2. Amazon Web Services. "Amazon API Gateway Developer Guide." AWS, 2024. https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html
3. Nginx Inc. "NGINX Reverse Proxy." Nginx Inc., 2024. https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/
4. Envoy Proxy Authors. "Envoy Proxy Documentation." Cloud Native Computing Foundation, 2024. https://www.envoyproxy.io/docs/envoy/latest/
5. Richardson, Chris. "Microservices Patterns: With Examples in Java." Manning Publications, 2018. https://www.manning.com/books/microservices-patterns
6. Newman, Sam. "Building Microservices: Designing Fine-Grained Systems, 2nd Edition." O'Reilly Media, 2021. https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/
7. Microsoft. "API Gateway pattern." Microsoft Azure Architecture Center, 2024. https://learn.microsoft.com/en-us/azure/architecture/microservices/design/gateway
