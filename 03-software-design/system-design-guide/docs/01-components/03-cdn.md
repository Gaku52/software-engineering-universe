# CDN (Content Delivery Network)

> This chapter explains how to minimize latency and reduce origin server load by leveraging edge servers distributed worldwide, delivering content from the closest location to the user — with comparisons of CloudFront, Cloudflare, and Fastly.

## What You Will Learn

1. **CDN Fundamentals** --- How edge caching, origin shields, and POPs (Points of Presence) work, and the mechanisms behind latency reduction
2. **Comparison of Major CDN Services** --- Characteristics and selection criteria for Amazon CloudFront, Cloudflare, and Fastly
3. **Cache Strategies and Invalidation** --- Practical approaches to Cache-Control headers, cache key design, and purge strategies
4. **Edge Computing** --- Techniques for reducing origin load by executing code at CDN edges
5. **Security and Availability** --- Design for DDoS protection, WAF, TLS termination, and origin protection

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| HTTP Protocol | Basic | Web Fundamentals |
| Caching | Basic | [Caching](./01-caching.md) |
| Load Balancer | Basic | [Load Balancer](./00-load-balancer.md) |
| DNS | Basic | Web Fundamentals |

---

## 0. WHY --- Why CDN Is Necessary

### 0.1 Problems Without CDN

```
User (Tokyo) --------> Origin (Virginia)
   RTT: 180ms             Processing: 50ms

Total response time: 180ms (RTT) + 50ms (processing) + 180ms (RTT) = 410ms
Including TLS handshake: ~600ms

--- After CDN ---

User (Tokyo) --> CDN Edge (Tokyo)
   RTT: 5ms       Cache HIT

Total response time: 5ms (RTT) + 0ms (processing) + 5ms (RTT) = 10ms
→ 60x speedup
```

### 0.2 Value Delivered by CDN

```
              4 Values of CDN

 ┌──────────────────────────────────────────────┐
 │                                              │
 │  1. Latency Reduction                        │
 │     └─ Served from geographically closer     │
 │        edge nodes                            │
 │        e.g.: 180ms → 5ms (97% reduction)    │
 │                                              │
 │  2. Origin Load Reduction                    │
 │     └─ Cache hits reduce requests reaching   │
 │        origin by 85-99%                      │
 │                                              │
 │  3. Improved Availability                    │
 │     └─ Even when origin fails, serves from   │
 │        cache (stale-if-error)                │
 │                                              │
 │  4. Security                                 │
 │     └─ DDoS absorption, WAF, TLS termination │
 │        Attacks blocked at the edge           │
 │                                              │
 └──────────────────────────────────────────────┘
```

### 0.3 Quantitative Impact

| Metric | Without CDN | With CDN | Improvement |
|------|---------|---------|--------|
| TTFB (Time to First Byte) | 400-800ms | 10-50ms | 90-98% |
| Page Load Time (3G) | 8-15s | 2-5s | 60-75% |
| Origin Server Load | 100% | 5-20% | 80-95% |
| Bandwidth Cost | $10,000/month | $2,000/month | 80% |
| Availability (SLA) | 99.9% | 99.99% | 10x improvement |
| DDoS Resilience | Several Gbps | Several Tbps | 1000x |

---

## 1. CDN Basic Architecture

### 1.1 Request Flow

```
User (Tokyo)                    CDN Edge (Tokyo POP)          Origin Server (us-east-1)
     |                                  |                              |
     |--- DNS resolution ------------>  |                              |
     |<-- CDN Edge IP address --------  |                              |
     |                                  |                              |
     |--- GET /img/hero.jpg ---------->|                              |
     |                                  |-- Cache check                |
     |                                  |   HIT? --> Respond immediately|
     |                                  |   MISS? ----GET /img/hero.jpg-->|
     |                                  |<--------- 200 OK + data -----|
     |                                  |-- Store in cache             |
     |<--------- 200 OK + data ---------|                              |
     |   (X-Cache: Miss from CDN)       |                              |
     |                                  |                              |
     |--- GET /img/hero.jpg ---------->|                              |
     |<--------- 200 OK (Cache HIT) ---|  (No request to origin)      |
     |   (X-Cache: Hit from CDN)        |                              |
     |   (Age: 120)                     |                              |
```

### 1.2 Global POP Placement and Anycast

```
                        CDN Global Network

   North America           Europe                 Asia-Pacific
  +-------+              +-------+              +-------+
  | POP   |              | POP   |              | POP   |
  | NYC   |              | LDN   |              | TYO   |  <-- Nearest to user
  +-------+              +-------+              +-------+
  | POP   |              | POP   |              | POP   |
  | SFO   |              | FRA   |              | SIN   |
  +-------+              +-------+              +-------+
  | POP   |              | POP   |              | POP   |
  | IAD   |              | AMS   |              | SYD   |
  +-------+              +-------+              +-------+
       \                    |                    /
        +------- Origin Shield (intermediate cache) --+
                          |
                   +-------------+
                   |   Origin    |
                   |   Server    |
                   +-------------+

  Anycast routing:
  All POPs advertise the same IP address
  → BGP automatically routes to the nearest POP
  → Faster and more accurate nearest-POP selection than DNS-based methods
```

### 1.3 Cache Hierarchy and Origin Shield

```
Layer 1: Browser cache          (RTT = 0ms)
    ↓ MISS
Layer 2: CDN Edge (POP)        (RTT = 1-20ms)
    ↓ MISS
Layer 3: Origin Shield          (RTT = 20-50ms)
    ↓ MISS
Layer 4: Origin Server          (RTT = 50-300ms)

  Cache hit rate targets:
  - Static assets: 95%+ (HIT at L2)
  - Dynamic content: 60-80% (short TTL + Stale-While-Revalidate)
  - API responses: 30-60% (cache key design is key)

  Effect of Origin Shield:
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  Without Origin Shield:                             │
  │    POP_TYO ─┐                                      │
  │    POP_SIN ─┼─→ Origin  (3 requests reach origin)  │
  │    POP_SYD ─┘                                      │
  │                                                     │
  │  With Origin Shield:                                │
  │    POP_TYO ─┐                                      │
  │    POP_SIN ─┼─→ Shield ──→ Origin  (1 request)     │
  │    POP_SYD ─┘    (aggregated)                       │
  │                                                     │
  │  → Reduces requests to origin by 60-90%             │
  └─────────────────────────────────────────────────────┘
```

### 1.4 CDN DNS Resolution Process

```python
"""Explanation of the CDN DNS resolution flow"""

# 1. User accesses cdn.example.com
# 2. DNS resolution flow:

#   cdn.example.com
#     → CNAME: d123.cloudfront.net
#       → Anycast IP: 13.224.x.x (IP of the nearest POP)

# When using GeoDNS (Cloudflare):
#   cdn.example.com
#     → Anycast IP: 104.16.x.x
#     → BGP routing reaches the nearest POP

# 3. DNS TTL design
dns_config = {
    "cdn.example.com": {
        "type": "CNAME",
        "value": "d123456.cloudfront.net",
        "ttl": 300,  # 5 minutes: short enough to accommodate CDN switching
    },
    # A/AAAA records (Cloudflare Anycast)
    "api.example.com": {
        "type": "A",
        "value": "104.16.132.229",  # Anycast IP
        "ttl": 300,
        "proxied": True,  # Cloudflare proxy enabled
    }
}
```

---

## 2. Cache-Control Design

### 2.1 Header Directives Reference

| Directive | Meaning | Example Usage |
|--------|------|--------|
| `public` | Cacheable by both CDN and browser | Static assets |
| `private` | Only cacheable by browser | User-specific content |
| `no-cache` | Validate with origin on every request (ETag/Last-Modified) | APIs where freshness is critical |
| `no-store` | No caching at all | Personal data, payment pages |
| `max-age=N` | Cache valid for N seconds | General TTL control |
| `s-maxage=N` | max-age for CDN (browser uses max-age) | Separate TTL for CDN and browser |
| `stale-while-revalidate=N` | Serve stale cache for N seconds after expiry while updating in background | High-availability APIs |
| `stale-if-error=N` | Serve stale cache for N seconds when origin errors | Availability-critical scenarios |
| `immutable` | Content will not change (no revalidation needed) | Hashed assets |
| `must-revalidate` | Must validate with origin after expiry | HTML pages |
| `no-transform` | Prohibit transformation by CDN/proxy | Prevent automatic image optimization |

### 2.2 Cache-Control Decision Flowchart

```
What type of content is it?
  │
  ├─ Personal data / payment related ──→ private, no-store
  │
  ├─ User-specific dynamic content ──→ private, max-age=0, must-revalidate
  │
  ├─ Shared dynamic content (API)
  │   │
  │   ├─ Real-time freshness required ──→ public, s-maxage=5, stale-while-revalidate=30
  │   └─ Tolerates a few minutes delay ──→ public, s-maxage=300, stale-while-revalidate=600
  │
  ├─ HTML pages ──→ public, s-maxage=60, max-age=0, must-revalidate
  │
  └─ Static assets
      │
      ├─ With hash (main.a1b2c3.js) ──→ public, max-age=31536000, immutable
      └─ Without hash (logo.png) ──→ public, max-age=86400
```

### 2.3 Configuration Examples by Asset Type

```nginx
# Cache-Control configuration examples in Nginx

# Hashed static assets (CSS/JS): 1-year cache + immutable
location ~* \.(?:css|js)$ {
    # File name includes hash: main.a1b2c3.js
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Content-Type-Options "nosniff";
    # Brotli / Gzip compression (when pre-compressed files are available)
    gzip_static on;
    brotli_static on;
}

# Images: 30-day cache + automatic WebP/AVIF conversion
location ~* \.(?:jpg|jpeg|png|gif|webp|avif|svg)$ {
    add_header Cache-Control "public, max-age=2592000";
    add_header Vary "Accept";  # Content negotiation via Accept header
}

# Fonts: 1-year cache + CORS
location ~* \.(?:woff2?|ttf|otf|eot)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header Access-Control-Allow-Origin "*";
}

# HTML: CDN 60 seconds, no browser cache
location ~* \.html$ {
    add_header Cache-Control "public, s-maxage=60, max-age=0, must-revalidate";
    # Serve stale cache for 5 minutes on origin failure
    add_header Cache-Control "stale-if-error=300" always;
}

# API responses: CDN 10 seconds + stale-while-revalidate
location /api/ {
    add_header Cache-Control "public, s-maxage=10, stale-while-revalidate=60, stale-if-error=300";
    add_header Vary "Accept-Encoding, Authorization";
}

# Personal data: no caching
location /api/user/profile {
    add_header Cache-Control "private, no-store";
    add_header Pragma "no-cache";  # HTTP/1.0 compatibility
}
```

### 2.4 ETag and Conditional Requests

```python
"""Implementation of conditional requests using ETag"""
import hashlib
from fastapi import FastAPI, Request, Response

app = FastAPI()

def generate_etag(content: bytes) -> str:
    """Generate an ETag from content"""
    return f'"{hashlib.sha256(content).hexdigest()[:16]}"'

@app.get("/api/products/{product_id}")
async def get_product(product_id: str, request: Request):
    product = await fetch_product(product_id)
    content = json.dumps(product).encode()
    etag = generate_etag(content)

    # Check the client's If-None-Match
    if_none_match = request.headers.get("If-None-Match")
    if if_none_match == etag:
        # Content unchanged → return 304 (saves bandwidth)
        return Response(status_code=304, headers={
            "ETag": etag,
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        })

    return Response(
        content=content,
        media_type="application/json",
        headers={
            "ETag": etag,
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
            "Vary": "Accept-Encoding",
        }
    )

# Request / response flow:
#
# 1st request: GET /api/products/123
#   → 200 OK + ETag: "a1b2c3d4e5f6g7h8"
#
# 2nd request: GET /api/products/123
#              If-None-Match: "a1b2c3d4e5f6g7h8"
#   → 304 Not Modified (no body, saves bandwidth)
#
# CDN behavior:
#   CDN cache expired → conditional request to origin
#   → 304 → CDN updates cache and resets TTL
#   → Significantly reduces data transfer to origin
```

---

## 3. Amazon CloudFront Configuration

### 3.1 Creating a Distribution

```python
# Creating a CloudFront distribution (boto3)
import boto3

cf = boto3.client('cloudfront')

distribution_config = {
    'CallerReference': 'my-app-2026',
    'Origins': {
        'Quantity': 2,
        'Items': [
            {
                # S3 origin (static assets)
                'Id': 'S3-static-assets',
                'DomainName': 'my-static-assets.s3.amazonaws.com',
                'S3OriginConfig': {
                    'OriginAccessIdentity':
                        'origin-access-identity/cloudfront/XXXXXXX'
                },
                'OriginShield': {
                    'Enabled': True,
                    'OriginShieldRegion': 'ap-northeast-1',  # Tokyo
                },
            },
            {
                # ALB origin (dynamic API)
                'Id': 'ALB-api',
                'DomainName': 'api-internal.example.com',
                'CustomOriginConfig': {
                    'HTTPPort': 80,
                    'HTTPSPort': 443,
                    'OriginProtocolPolicy': 'https-only',
                    'OriginSslProtocols': {
                        'Quantity': 1, 'Items': ['TLSv1.2']
                    },
                    'OriginKeepaliveTimeout': 60,  # Keep-Alive duration in seconds
                    'OriginReadTimeout': 30,
                },
            },
        ]
    },
    'DefaultCacheBehavior': {
        'TargetOriginId': 'S3-static-assets',
        'ViewerProtocolPolicy': 'redirect-to-https',
        'CachePolicyId': '658327ea-f89d-4fab-a63d-7e88639e58f6',
        'Compress': True,              # Automatic Brotli/Gzip compression
        'AllowedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']},
    },
    'CacheBehaviors': {
        'Quantity': 1,
        'Items': [{
            'PathPattern': '/api/*',
            'TargetOriginId': 'ALB-api',
            'ViewerProtocolPolicy': 'https-only',
            'AllowedMethods': {
                'Quantity': 7,
                'Items': ['GET','HEAD','OPTIONS','PUT','POST','PATCH','DELETE'],
            },
            'CachePolicyId': '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
            'OriginRequestPolicyId':
                '216adef6-5c7f-47e4-b989-5492eafa07d3',  # AllViewer
            'ForwardedValues': {
                'QueryString': True,
                'Headers': {'Quantity': 3, 'Items': [
                    'Authorization', 'Accept', 'Content-Type'
                ]},
                'Cookies': {'Forward': 'none'},
            },
        }],
    },
    'Enabled': True,
    'PriceClass': 'PriceClass_200',    # North America, Europe, Asia
    'HttpVersion': 'http2and3',        # Enable HTTP/2 + HTTP/3 (QUIC)
    'Comment': 'Production distribution with S3 + ALB origins',
}

response = cf.create_distribution(DistributionConfig=distribution_config)
print(f"Distribution ID: {response['Distribution']['Id']}")
print(f"Domain: {response['Distribution']['DomainName']}")
```

### 3.2 CloudFront Functions (Lightweight Edge Processing)

```javascript
// CloudFront Functions: URL rewriting + security header injection
// Runtime: JavaScript (ES 5.1), max execution time: 1ms, max memory: 2MB

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // 1. SPA fallback: /app/* → /app/index.html
    if (uri.startsWith('/app/') && !uri.includes('.')) {
        request.uri = '/app/index.html';
    }

    // 2. Append .html if no extension present
    if (!uri.includes('.') && uri !== '/') {
        request.uri = uri + '/index.html';
    }

    // 3. Add security headers (for response events)
    if (event.response) {
        var response = event.response;
        response.headers['strict-transport-security'] = {
            value: 'max-age=63072000; includeSubDomains; preload'
        };
        response.headers['x-content-type-options'] = {
            value: 'nosniff'
        };
        response.headers['x-frame-options'] = {
            value: 'DENY'
        };
        response.headers['x-xss-protection'] = {
            value: '1; mode=block'
        };
        response.headers['content-security-policy'] = {
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
                   "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        };
        return response;
    }

    return request;
}
```

### 3.3 Lambda@Edge (Advanced Edge Processing)

```python
# Lambda@Edge: A/B testing + image optimization routing
# Runtime: Node.js / Python, max execution time: 5s (viewer) / 30s (origin)

import json
import hashlib

def viewer_request_handler(event, context):
    """Viewer request: A/B test distribution"""
    request = event['Records'][0]['cf']['request']
    headers = request['headers']

    # Determine A/B test group from cookies
    cookies = headers.get('cookie', [{}])[0].get('value', '')
    ab_group = None

    for cookie in cookies.split(';'):
        cookie = cookie.strip()
        if cookie.startswith('ab_group='):
            ab_group = cookie.split('=')[1]
            break

    # Assign group based on hash if not yet assigned
    if not ab_group:
        client_ip = event['Records'][0]['cf']['request']['clientIp']
        hash_val = int(hashlib.md5(client_ip.encode()).hexdigest(), 16)
        ab_group = 'A' if hash_val % 100 < 50 else 'B'

    # Pass group to origin via custom header
    request['headers']['x-ab-group'] = [{'key': 'X-AB-Group', 'value': ab_group}]

    return request

def origin_response_handler(event, context):
    """Origin response: set A/B group cookie"""
    response = event['Records'][0]['cf']['response']
    request = event['Records'][0]['cf']['request']

    ab_group = request['headers'].get('x-ab-group', [{}])[0].get('value', 'A')

    # Persist A/B group via Set-Cookie
    response['headers']['set-cookie'] = [{
        'key': 'Set-Cookie',
        'value': f'ab_group={ab_group}; Path=/; Max-Age=604800; SameSite=Lax'
    }]

    return response
```

### 3.4 Cache Invalidation

```bash
# CloudFront cache invalidation (purge)
# Note: Up to 1,000 paths/month free; additional paths cost $0.005 each

# Purge specific paths
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/index.html" "/api/*"

# Purge all cache (emergency only)
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/*"

# Check invalidation status
aws cloudfront get-invalidation \
  --distribution-id E1234567890 \
  --id I1234567890
```

```python
# Cache busting implementation in Python
import boto3
import hashlib
import json
from datetime import datetime

class CDNInvalidator:
    """CloudFront cache invalidation manager"""

    def __init__(self, distribution_id: str):
        self.cf = boto3.client('cloudfront')
        self.distribution_id = distribution_id

    def invalidate_paths(self, paths: list[str]) -> str:
        """Invalidate cache for the specified paths"""
        caller_ref = f"inv-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        response = self.cf.create_invalidation(
            DistributionId=self.distribution_id,
            InvalidationBatch={
                'Paths': {
                    'Quantity': len(paths),
                    'Items': paths,
                },
                'CallerReference': caller_ref,
            }
        )
        invalidation_id = response['Invalidation']['Id']
        print(f"Invalidation created: {invalidation_id}")
        print(f"Status: {response['Invalidation']['Status']}")
        return invalidation_id

    def wait_for_invalidation(self, invalidation_id: str):
        """Wait until invalidation is complete"""
        waiter = self.cf.get_waiter('invalidation_completed')
        print(f"Waiting for invalidation {invalidation_id}...")
        waiter.wait(
            DistributionId=self.distribution_id,
            Id=invalidation_id,
            WaiterConfig={'Delay': 10, 'MaxAttempts': 30}
        )
        print("Invalidation completed.")

    def deploy_with_cache_busting(
        self, s3_bucket: str, local_dir: str, html_files: list[str]
    ):
        """
        Deployment with cache busting:
        1. Upload hashed assets (no purge needed)
        2. Upload HTML files (short TTL)
        3. Purge HTML files only
        """
        s3 = boto3.client('s3')
        html_paths = []

        for html_file in html_files:
            s3.upload_file(
                Filename=f"{local_dir}/{html_file}",
                Bucket=s3_bucket,
                Key=html_file,
                ExtraArgs={
                    'ContentType': 'text/html',
                    'CacheControl': 'public, s-maxage=60, max-age=0, must-revalidate',
                }
            )
            html_paths.append(f"/{html_file}")

        # Purge HTML only (hashed assets do not need purging)
        if html_paths:
            inv_id = self.invalidate_paths(html_paths)
            self.wait_for_invalidation(inv_id)

# Usage example
invalidator = CDNInvalidator("E1234567890")

# Deploy
invalidator.deploy_with_cache_busting(
    s3_bucket="my-static-assets",
    local_dir="./dist",
    html_files=["index.html", "about/index.html"]
)
```

---

## 4. Cloudflare Configuration

### 4.1 Edge Computing with Cloudflare Workers

```javascript
// Cloudflare Workers: API response caching at the edge
// V8 isolate-based: startup time < 1ms, CPU 50ms/request

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cache = caches.default;

    // Cache only GET requests
    if (request.method !== 'GET') {
      return fetch(request);
    }

    // 1. Cache check
    const cacheKey = new Request(url.toString(), request);
    let response = await cache.match(cacheKey);

    if (response) {
      // Cache HIT: add header and return
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('X-Cache-Status', 'HIT');
      return newResponse;
    }

    // 2. Fetch from origin
    response = await fetch(request);

    // 3. Cache successful responses only
    if (response.ok) {
      const cacheResponse = new Response(response.body, response);
      cacheResponse.headers.set(
        'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600'
      );
      cacheResponse.headers.set('X-Cache-Status', 'MISS');

      // Write to cache asynchronously (does not delay the response)
      const ctx = { waitUntil: (p) => p };
      ctx.waitUntil(cache.put(cacheKey, cacheResponse.clone()));

      return cacheResponse;
    }

    return response;
  }
};
```

### 4.2 Cloudflare Workers: Geo-Based Routing

```javascript
// Cloudflare Workers: origin selection based on geographic information
export default {
  async fetch(request, env) {
    const cf = request.cf;  // Cloudflare request metadata

    // Retrieve geographic information
    const country = cf.country;       // "JP"
    const continent = cf.continent;   // "AS"
    const city = cf.city;             // "Tokyo"
    const latitude = cf.latitude;
    const longitude = cf.longitude;
    const asn = cf.asn;               // ISP AS number

    // Select the nearest origin server per continent
    const origins = {
      'AS': 'https://api-ap.example.com',    // Asia
      'NA': 'https://api-us.example.com',    // North America
      'EU': 'https://api-eu.example.com',    // Europe
      'SA': 'https://api-us.example.com',    // South America → fallback to North America
      'AF': 'https://api-eu.example.com',    // Africa → fallback to Europe
      'OC': 'https://api-ap.example.com',    // Oceania → fallback to Asia
    };

    const originUrl = origins[continent] || origins['NA'];

    // Forward request to origin
    const url = new URL(request.url);
    const originRequest = new Request(
      `${originUrl}${url.pathname}${url.search}`,
      request
    );

    const response = await fetch(originRequest);

    // Add routing info to response (for debugging)
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Origin-Region', continent);
    newResponse.headers.set('X-Client-Country', country);

    return newResponse;
  }
};
```

### 4.3 Cloudflare Workers KV: Edge Data Store

```javascript
// Configuration management at the edge using Workers KV
// KV: eventual consistency, optimized for reads (propagates within 60 seconds)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Retrieve feature flags (respond immediately at the edge)
    if (url.pathname === '/api/feature-flags') {
      const flags = await env.FEATURE_FLAGS.get('current', { type: 'json' });
      return new Response(JSON.stringify(flags), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
        }
      });
    }

    // Rate limiting (implemented at the edge)
    if (url.pathname.startsWith('/api/')) {
      const clientIp = request.headers.get('CF-Connecting-IP');
      const rateLimitKey = `ratelimit:${clientIp}`;

      // Get current request count
      const current = parseInt(await env.RATE_LIMITS.get(rateLimitKey) || '0');

      if (current >= 100) {  // 100 req/min
        return new Response('Rate limit exceeded', {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
          }
        });
      }

      // Update count (TTL: 60 seconds)
      await env.RATE_LIMITS.put(rateLimitKey, String(current + 1), {
        expirationTtl: 60
      });
    }

    return fetch(request);
  }
};
```

---

## 5. Cache Key Design

### 5.1 Components of a Cache Key

```
Cache Key = URL + elements specified by Vary header

Default key:  scheme + host + path + query string
Example: https://example.com/api/products?page=1&sort=price

Custom key elements:
  - Headers: Accept-Encoding, Accept-Language
  - Cookies: session_id, ab_group
  - Device: Mobile / Desktop
  - Region: country code
```

### 5.2 Cache Key Optimization Implementation

```python
"""Best practices for cache key design"""
from urllib.parse import urlparse, parse_qs, urlencode

class CacheKeyBuilder:
    """CDN cache key design and normalization"""

    # Parameters that do not affect caching (to be excluded)
    EXCLUDED_PARAMS = {
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
        'utm_content',    # UTM tracking parameters
        'fbclid',         # Facebook click ID
        'gclid',          # Google click ID
        '_ga',            # Google Analytics
        'ref', 'source',  # Referral parameters
        '_t', 'timestamp', 'nocache',  # Cache busting
    }

    # Parameters to include in cache keys (whitelist approach)
    INCLUDED_PARAMS = {
        '/api/products': {'page', 'sort', 'category', 'limit'},
        '/api/search': {'q', 'page', 'sort', 'filters'},
    }

    @classmethod
    def normalize_cache_key(cls, url: str) -> str:
        """Normalize URL to generate a cache key"""
        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)

        # Method 1: Exclusion list approach
        filtered_params = {
            k: v for k, v in params.items()
            if k.lower() not in cls.EXCLUDED_PARAMS
        }

        # Sort parameters for normalization
        sorted_params = urlencode(
            sorted(filtered_params.items()), doseq=True
        )

        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}" + \
               (f"?{sorted_params}" if sorted_params else "")

    @classmethod
    def normalize_with_whitelist(cls, url: str, path: str) -> str:
        """Generate cache key using whitelist approach"""
        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)

        allowed = cls.INCLUDED_PARAMS.get(path, set())
        filtered_params = {
            k: v for k, v in params.items() if k in allowed
        }

        sorted_params = urlencode(
            sorted(filtered_params.items()), doseq=True
        )
        return f"{parsed.path}?{sorted_params}" if sorted_params else parsed.path

# Test
urls = [
    "https://example.com/api/products?page=1&sort=price&utm_source=google",
    "https://example.com/api/products?utm_source=twitter&page=1&sort=price",
    "https://example.com/api/products?page=1&sort=price&fbclid=abc123",
]

for url in urls:
    normalized = CacheKeyBuilder.normalize_cache_key(url)
    print(f"Original: {url}")
    print(f"Cache Key: {normalized}")
    print()

# Output:
# All 3 URLs are normalized to the same cache key:
# https://example.com/api/products?page=1&sort=price
```

### 5.3 Vary Header Design

```python
"""Cache variation management via Vary header"""
from fastapi import FastAPI, Request, Response

app = FastAPI()

@app.get("/api/products")
async def get_products(request: Request):
    """Response variations based on device and language"""
    # Determine locale from Accept-Language
    lang = request.headers.get("Accept-Language", "en")
    locale = "ja" if "ja" in lang else "en"

    # Determine device from User-Agent
    ua = request.headers.get("User-Agent", "")
    is_mobile = "Mobile" in ua

    products = await fetch_products(locale=locale, mobile=is_mobile)

    return Response(
        content=json.dumps(products),
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "public, s-maxage=300",
            # Vary: instructs CDN to treat responses as separate caches if these headers differ
            "Vary": "Accept-Language, Accept-Encoding",
            # Warning: Never use Vary: User-Agent!
            # → Generates countless variations and defeats caching
            # Use the CDN's built-in device detection instead
        }
    )

# How Vary header works:
#
# With Vary: Accept-Encoding:
#   GET /api/products (Accept-Encoding: gzip)  → Cache A (gzip version)
#   GET /api/products (Accept-Encoding: br)    → Cache B (brotli version)
#   GET /api/products (Accept-Encoding: none)  → Cache C (uncompressed version)
#
# With Vary: Accept-Language:
#   GET /api/products (Accept-Language: ja)    → Cache D (Japanese version)
#   GET /api/products (Accept-Language: en)    → Cache E (English version)
```

---

## 6. Comparison of Major CDN Services

### Comparison Table 1: Feature Comparison

| Feature | CloudFront | Cloudflare | Fastly |
|-----|-----------|------------|--------|
| **POP Count** | 450+ | 300+ | 90+ |
| **Edge Computing** | Lambda@Edge / CloudFront Functions | Workers (V8 isolate) | Compute@Edge (Wasm) |
| **Free Tier** | 1TB/month (12 months) | Unlimited bandwidth (Free plan) | None |
| **Cache Purge Speed** | Seconds to tens of seconds | < 30ms (Instant Purge) | < 150ms |
| **DDoS Protection** | AWS Shield Standard (free) | Built-in (all plans) | Shield |
| **WAF** | AWS WAF (additional cost) | Built-in (Pro and above) | Next-Gen WAF |
| **HTTP/3 (QUIC)** | Supported | Supported | Supported |
| **WebSocket** | Supported | Supported | Supported |
| **Image Optimization** | Not supported (implement via Lambda@Edge) | Polish / Image Resizing | Image Optimizer |
| **Logging** | S3 / Kinesis | Logpush | Real-time log streaming |
| **Pricing Model** | Pay-per-use (requests + bandwidth) | Plan + pay-per-use | Pay-per-use |
| **Best For** | AWS ecosystem integration | General-purpose / security-focused | Fast purge / API caching |

### Comparison Table 2: Use Case Selection Guide

| Use Case | Recommended CDN | Reason |
|------------|---------|------|
| Integration with AWS S3/ALB | CloudFront | IAM-based access control, OAI/OAC |
| Immediate cache purge required | Cloudflare / Fastly | < 150ms purge across all POPs |
| Start for free | Cloudflare | Free plan: unlimited bandwidth + DDoS protection |
| JS execution at the edge | Cloudflare | Workers: < 1ms startup, 50ms CPU/req |
| Dynamic API caching | Fastly | Tag-based purge with Surrogate-Key |
| Global video delivery | CloudFront | MediaStore + CloudFront integration |
| Multi-cloud environment | Cloudflare / Fastly | Cloud-agnostic |
| Wasm execution at the edge | Fastly | Compute@Edge: supports Rust/Go/JS |

### Comparison Table 3: Cost Comparison (10TB/month delivery)

| Cost Item | CloudFront | Cloudflare Pro | Fastly |
|-----------|-----------|---------------|--------|
| Base fee | $0 | $20/month | $50/month |
| Bandwidth (10TB, North America) | ~$850 | $0 (unlimited) | ~$800 |
| HTTPS requests (100M) | ~$100 | $0 (included) | ~$75 |
| Cache purge | $0 (1000/month free) | $0 (included) | $0 (included) |
| WAF | ~$5/rule | $0 (included) | Separate cost |
| **Total (estimate)** | **~$950** | **~$20** | **~$925** |
| **Notes** | Value of AWS integration | Best cost-performance | Value of purge speed |

---

## 7. Advanced Topics

### 7.1 Surrogate-Key (Tag-Based Purge)

```python
"""Tag-based cache purging using Fastly's Surrogate-Key"""
from fastapi import FastAPI, Response

app = FastAPI()

@app.get("/api/products/{product_id}")
async def get_product(product_id: str):
    product = await fetch_product(product_id)

    return Response(
        content=json.dumps(product),
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "public, s-maxage=3600",
            # Surrogate-Key: assign multiple tags
            # → enables purging by tag
            "Surrogate-Key": f"product-{product_id} "
                             f"category-{product['category']} "
                             f"all-products",
        }
    )

@app.get("/api/categories/{category_id}")
async def get_category(category_id: str):
    products = await fetch_products_by_category(category_id)

    return Response(
        content=json.dumps(products),
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "public, s-maxage=3600",
            "Surrogate-Key": f"category-{category_id} all-products",
        }
    )

# Purge examples:
# 1. When a specific product is updated:
#    POST /service/{id}/purge/product-123
#    → Purge only the cache for product-123
#
# 2. When an entire category is updated:
#    POST /service/{id}/purge/category-electronics
#    → Purge all products in the electronics category + category listing
#
# 3. Purge all products:
#    POST /service/{id}/purge/all-products
#
# Benefits:
# - More flexible than URL-based purging
# - Precise purging without wildcards
# - Batch purge of related content
```

### 7.2 Image Optimization CDN Pipeline

```python
"""Image optimization pipeline at CDN edge"""
from dataclasses import dataclass
from enum import Enum
from typing import Optional

class ImageFormat(Enum):
    WEBP = "webp"
    AVIF = "avif"
    JPEG = "jpeg"
    PNG = "png"

@dataclass
class ImageTransform:
    width: Optional[int] = None
    height: Optional[int] = None
    quality: int = 80
    format: ImageFormat = ImageFormat.WEBP
    fit: str = "cover"  # cover, contain, fill

class ImageOptimizationCDN:
    """
    Image optimization design at CDN edge

    URL pattern: /images/{transforms}/{original_path}
    Example: /images/w_800,h_600,q_80,f_webp/photos/hero.jpg
    """

    # Responsive image presets
    PRESETS = {
        'thumbnail': ImageTransform(width=150, height=150, quality=60),
        'card':      ImageTransform(width=400, height=300, quality=75),
        'hero':      ImageTransform(width=1920, height=1080, quality=80),
        'og':        ImageTransform(width=1200, height=630, quality=85),
    }

    @staticmethod
    def generate_srcset(image_path: str, widths: list[int]) -> str:
        """Generate srcset for responsive images"""
        srcset_entries = []
        for w in widths:
            url = f"/images/w_{w},f_auto/{image_path}"
            srcset_entries.append(f"{url} {w}w")
        return ",\n  ".join(srcset_entries)

    @staticmethod
    def generate_picture_tag(image_path: str) -> str:
        """Generate <picture> tag (AVIF > WebP > JPEG fallback)"""
        return f"""<picture>
  <!-- AVIF (best compression) -->
  <source
    type="image/avif"
    srcset="{ImageOptimizationCDN.generate_srcset(image_path, [400, 800, 1200])}"
    sizes="(max-width: 768px) 100vw, 50vw" />
  <!-- WebP (broad browser support) -->
  <source
    type="image/webp"
    srcset="{ImageOptimizationCDN.generate_srcset(image_path, [400, 800, 1200])}"
    sizes="(max-width: 768px) 100vw, 50vw" />
  <!-- JPEG fallback -->
  <img
    src="/images/w_800,f_jpeg/{image_path}"
    loading="lazy"
    decoding="async"
    alt="" />
</picture>"""

# Example of image optimization request in Cloudflare Workers:
#
# export default {
#   async fetch(request) {
#     const url = new URL(request.url);
#     const accept = request.headers.get('Accept') || '';
#
#     // Determine format supported by browser
#     let format = 'jpeg';
#     if (accept.includes('image/avif')) format = 'avif';
#     else if (accept.includes('image/webp')) format = 'webp';
#
#     // Use Cloudflare Image Resizing
#     return fetch(url.toString(), {
#       cf: {
#         image: {
#           width: 800,
#           height: 600,
#           quality: 80,
#           format: format,
#           fit: 'cover',
#         }
#       }
#     });
#   }
# };
```

### 7.3 CDN and Security

```python
"""CDN security design: DDoS protection + WAF + Bot management"""
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class CDNSecurityConfig:
    """CDN security configuration design"""

    # 1. TLS / SSL configuration
    tls_config: dict = field(default_factory=lambda: {
        'min_version': 'TLSv1.2',
        'preferred_ciphers': [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
        ],
        'hsts': {
            'enabled': True,
            'max_age': 63072000,  # 2 years
            'include_subdomains': True,
            'preload': True,
        },
        'ocsp_stapling': True,
    })

    # 2. WAF rules
    waf_rules: dict = field(default_factory=lambda: {
        'managed_rules': [
            'OWASP Top 10',           # SQL Injection, XSS, etc.
            'Known Bad Inputs',        # Known attack patterns
            'Bot Management',          # Malicious bot detection
        ],
        'custom_rules': [
            {
                'name': 'Block non-standard methods',
                'condition': 'http.request.method not in {"GET" "POST" "PUT" "DELETE" "PATCH" "OPTIONS"}',
                'action': 'block',
            },
            {
                'name': 'Rate limit login',
                'condition': 'http.request.uri.path eq "/api/auth/login"',
                'action': 'rate_limit',
                'rate': '10 per minute per ip',
            },
        ],
    })

    # 3. Origin protection
    origin_protection: dict = field(default_factory=lambda: {
        # Origin only accepts requests from CDN
        'allowed_ips': 'CDN IP ranges only',
        'origin_secret_header': {
            'name': 'X-Origin-Verify',
            'value': 'shared-secret-value',  # CDN → Origin authentication
        },
        # CloudFront: OAC (Origin Access Control)
        'oac_enabled': True,
    })

    # 4. DDoS protection layers
    ddos_protection: dict = field(default_factory=lambda: {
        'layer_3_4': {
            'provider': 'CDN built-in',  # TCP/UDP flood
            'capacity': '100+ Tbps',
        },
        'layer_7': {
            'rate_limiting': True,        # HTTP flood
            'challenge_page': True,       # JS challenge
            'geo_blocking': ['KP', 'IR'], # Block specific countries
        },
    })

# Origin protection implementation example (Nginx)
NGINX_ORIGIN_PROTECTION = """
# Allow only CDN IP ranges
# CloudFront IP ranges: https://d7uri8nf7uskq.cloudfront.net/tools/list-cloudfront-ips
geo $is_cdn {
    default         0;
    13.224.0.0/14   1;  # CloudFront
    52.84.0.0/15    1;  # CloudFront
    99.84.0.0/16    1;  # CloudFront
    # ... (include all ranges)
}

server {
    # Deny access from non-CDN sources
    if ($is_cdn = 0) {
        return 403;
    }

    # Verify the secret header from CDN
    if ($http_x_origin_verify != "shared-secret-value") {
        return 403;
    }
}
"""
```

### 7.4 CDN Monitoring and Observability

```python
"""CDN performance monitoring"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class CDNMetrics:
    """Metrics to track in CDN monitoring"""

    # Cache efficiency
    cache_hit_ratio: float       # Target: static 95%+, dynamic 60%+
    cache_miss_ratio: float
    cache_expired_ratio: float   # Ratio of TTL-expired cache

    # Performance
    ttfb_p50_ms: float           # Target: < 50ms
    ttfb_p95_ms: float           # Target: < 200ms
    ttfb_p99_ms: float           # Target: < 500ms
    total_latency_ms: float

    # Origin health
    origin_request_count: int    # Target: 5-20% of total requests
    origin_error_rate: float     # Target: < 0.1%
    origin_response_time_ms: float

    # Bandwidth / cost
    bandwidth_gb: float
    request_count: int
    cost_usd: float

    # Errors
    http_4xx_rate: float         # Target: < 1%
    http_5xx_rate: float         # Target: < 0.01%

class CDNMonitor:
    """CDN metrics collection and analysis"""

    # Alert thresholds
    ALERT_THRESHOLDS = {
        'cache_hit_ratio_low': 0.80,       # Warning below 80%
        'origin_error_rate_high': 0.01,     # Warning at 1% or above
        'ttfb_p95_high_ms': 200,            # Warning at 200ms or above
        'http_5xx_rate_high': 0.001,        # Critical at 0.1% or above
    }

    @staticmethod
    def analyze_cache_efficiency(metrics: CDNMetrics) -> dict:
        """Analyze cache efficiency and provide recommendations"""
        analysis = {'status': 'healthy', 'recommendations': []}

        if metrics.cache_hit_ratio < 0.80:
            analysis['status'] = 'degraded'
            analysis['recommendations'].append(
                "Cache hit ratio is low. "
                "Check the following: (1) Is the TTL too short? "
                "(2) Are there too many Vary headers? "
                "(3) Are unnecessary query parameters included in the cache key?"
            )

        if metrics.cache_expired_ratio > 0.30:
            analysis['recommendations'].append(
                "Too many expired caches. Consider extending TTL or "
                "introducing stale-while-revalidate."
            )

        if metrics.origin_error_rate > 0.01:
            analysis['status'] = 'critical'
            analysis['recommendations'].append(
                "Origin error rate is high. "
                "Mitigate user impact by configuring the stale-if-error header."
            )

        return analysis

    @staticmethod
    def calculate_cost_savings(
        total_requests: int,
        cache_hit_ratio: float,
        avg_origin_cost_per_request: float = 0.00001,
    ) -> dict:
        """Calculate cost savings achieved by CDN"""
        requests_served_by_cache = int(total_requests * cache_hit_ratio)
        requests_to_origin = total_requests - requests_served_by_cache
        origin_cost = requests_to_origin * avg_origin_cost_per_request
        saved_cost = requests_served_by_cache * avg_origin_cost_per_request

        return {
            'total_requests': total_requests,
            'cache_hits': requests_served_by_cache,
            'origin_requests': requests_to_origin,
            'origin_cost_usd': round(origin_cost, 2),
            'saved_cost_usd': round(saved_cost, 2),
            'saving_ratio': f"{cache_hit_ratio * 100:.1f}%",
        }
```

---

## 8. S3 + CloudFront CDK Configuration

```python
# AWS CDK v2: Production setup with CloudFront + S3 + WAF
from aws_cdk import (
    Stack, Duration, RemovalPolicy,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_certificatemanager as acm,
    aws_route53 as route53,
    aws_route53_targets as targets,
    aws_wafv2 as wafv2,
)
from constructs import Construct

class CDNStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        # 1. S3 bucket (static assets)
        bucket = s3.Bucket(
            self, "StaticAssets",
            removal_policy=RemovalPolicy.RETAIN,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            versioned=True,  # Enable versioning
        )

        # 2. ACM certificate (must be created in us-east-1)
        certificate = acm.Certificate(
            self, "Certificate",
            domain_name="cdn.example.com",
            validation=acm.CertificateValidation.from_dns(),
        )

        # 3. Cache policy
        cache_policy = cloudfront.CachePolicy(
            self, "CachePolicy",
            cache_policy_name="OptimizedCaching",
            default_ttl=Duration.hours(24),
            max_ttl=Duration.days(365),
            min_ttl=Duration.seconds(0),
            header_behavior=cloudfront.CacheHeaderBehavior.allow_list(
                "Accept-Encoding", "Accept-Language"
            ),
            query_string_behavior=cloudfront.CacheQueryStringBehavior.allow_list(
                "page", "sort", "category"  # Only necessary parameters
            ),
            cookie_behavior=cloudfront.CacheCookieBehavior.none(),
            enable_accept_encoding_gzip=True,
            enable_accept_encoding_brotli=True,
        )

        # 4. CloudFront distribution
        distribution = cloudfront.Distribution(
            self, "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3Origin(
                    bucket,
                    origin_shield_region="ap-northeast-1",
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cache_policy,
                compress=True,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD,
            ),
            domain_names=["cdn.example.com"],
            certificate=certificate,
            http_version=cloudfront.HttpVersion.HTTP2_AND_3,
            price_class=cloudfront.PriceClass.PRICE_CLASS_200,
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",  # SPA fallback
                    ttl=Duration.seconds(10),
                ),
            ],
        )

        # 5. Route 53 record
        zone = route53.HostedZone.from_lookup(
            self, "Zone", domain_name="example.com"
        )
        route53.ARecord(
            self, "CDNRecord",
            zone=zone,
            record_name="cdn",
            target=route53.RecordTarget.from_alias(
                targets.CloudFrontTarget(distribution)
            ),
        )
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Applying the Same TTL to All Responses

```python
# Bad: Uniform Cache-Control for all URLs
class BadCacheMiddleware:
    """Applies the same TTL to all responses"""
    async def __call__(self, request, call_next):
        response = await call_next(request)
        # Cache everything for 1 day
        response.headers["Cache-Control"] = "public, max-age=86400"
        return response

# Problems:
# - index.html updates won't be reflected for 24 hours
# - API responses are returned stale
# - Risk of personal data being cached by CDN
# - Hashed JS files are unnecessarily re-fetched every day

# Good: Optimize TTL per asset type
class GoodCacheMiddleware:
    """Set Cache-Control based on asset type"""

    CACHE_RULES = [
        # (path pattern, Cache-Control)
        (r'^/api/user/', 'private, no-store'),
        (r'^/api/', 'public, s-maxage=10, stale-while-revalidate=60, stale-if-error=300'),
        (r'\.[a-f0-9]{8,}\.(js|css)$', 'public, max-age=31536000, immutable'),
        (r'\.(jpg|png|webp|avif)$', 'public, max-age=2592000'),
        (r'\.html$', 'public, s-maxage=60, max-age=0, must-revalidate'),
    ]

    async def __call__(self, request, call_next):
        response = await call_next(request)
        path = request.url.path

        for pattern, cache_control in self.CACHE_RULES:
            if re.match(pattern, path):
                response.headers["Cache-Control"] = cache_control
                break
        else:
            # Default: no cache (fail safe)
            response.headers["Cache-Control"] = "private, no-cache"

        return response
```

### Anti-Pattern 2: Including Unnecessary Elements in Cache Keys

```python
# Bad: Generating cache keys with Vary: User-Agent
class BadVaryConfig:
    """Uses Vary: User-Agent"""
    def get_response_headers(self):
        return {
            "Cache-Control": "public, s-maxage=300",
            "Vary": "User-Agent",  # Thousands of UAs → thousands of cache variations
        }
    # Result: Cache hit rate drops below 5%

# Bad: Including all query parameters in cache key
# /products?utm_source=google&utm_medium=cpc → Cache MISS
# /products?utm_source=twitter              → Cache MISS
# /products                                 → Cache MISS
# → 3 separate cache entries for the same content

# Good: Include only necessary parameters in cache key
class GoodVaryConfig:
    """Use CDN's built-in device detection instead of Vary: User-Agent"""
    def get_response_headers(self, request):
        return {
            "Cache-Control": "public, s-maxage=300",
            "Vary": "Accept-Encoding, Accept-Language",
            # Device detection: use CDN headers instead
            # CloudFront: CloudFront-Is-Mobile-Viewer
            # Cloudflare: CF-Device-Type
        }

    def configure_cache_policy(self):
        """Exclude UTM parameters from CloudFront cache policy"""
        return {
            'QueryStringBehavior': 'whitelist',
            'QueryStrings': ['page', 'sort', 'category', 'q'],
            # utm_*, fbclid, gclid are automatically excluded
        }
```

### Anti-Pattern 3: Relying on CDN Purge for Deployments

```python
# Bad: Purging all cache on every deployment
class BadDeployment:
    """Purges /* on every deployment"""
    def deploy(self):
        # 1. Upload files
        upload_files()

        # 2. Purge all cache
        invalidate_all("/*")

        # Problems:
        # - Several seconds to tens of seconds of lag until purge completes
        # - During purge, old HTML may reference new JS → errors
        # - Consistency across all POPs is not guaranteed at a single moment
        # - Purge costs apply (CloudFront: charged beyond 1000 paths/month)

# Good: Eliminate the need for purging with cache busting
class GoodDeployment:
    """Deployment without purging using hashed file names"""
    def deploy(self):
        # 1. Assets with hashed file names (no purge needed)
        #    main.js → main.a1b2c3d4.js (new file = new cache entry)
        upload_hashed_assets()

        # 2. HTML with short TTL (s-maxage=60) for natural refresh
        upload_html(cache_control="s-maxage=60, must-revalidate")

        # 3. Purge HTML only in emergencies
        invalidate_paths(["/index.html"])

        # Benefits:
        # - No consistency issues (new JS is already in CDN when HTML references it)
        # - Minimal purge cost (HTML only)
        # - Instant rollback to previous version (just revert HTML path)
```

---

## 10. Practice Exercises

### Exercise 1 (Basic): Cache-Control Header Design

Design the optimal `Cache-Control` header for each of the following content types.

```
1. Hashed JavaScript: main.a1b2c3.js
2. HTML page: /index.html
3. User profile API: /api/user/profile
4. Product list API: /api/products?page=1
5. User avatar image: /images/avatar/user-123.jpg
6. Font file: /fonts/noto-sans.woff2
7. Real-time stock price API: /api/stocks/AAPL
```

**Expected output:**

```
1. public, max-age=31536000, immutable
   Reason: New URL when hash changes → 1-year cache is safe

2. public, s-maxage=60, max-age=0, must-revalidate
   Reason: CDN caches for 60 seconds; browser validates every time

3. private, no-store
   Reason: Personal data; must not be cached by CDN

4. public, s-maxage=300, stale-while-revalidate=600
   Reason: Shared content; 5-minute cache + background refresh

5. public, max-age=86400, stale-while-revalidate=604800
   Reason: Avatars change infrequently; 1-day cache + 1-week SWR

6. public, max-age=31536000, immutable
   Reason: Fonts are immutable; CORS headers also required

7. public, s-maxage=5, stale-while-revalidate=10, stale-if-error=60
   Reason: Freshness is critical, but stale data is acceptable on error
```

### Exercise 2 (Applied): CDN Cache Key Optimization

Analyze the following access logs and propose measures to improve the cache hit rate.

```python
access_logs = [
    {"url": "/products?page=1&utm_source=google", "cache": "MISS"},
    {"url": "/products?page=1&utm_source=twitter", "cache": "MISS"},
    {"url": "/products?page=1", "cache": "MISS"},
    {"url": "/products?page=1&fbclid=abc", "cache": "MISS"},
    {"url": "/api/user/profile", "cache": "MISS", "vary": "User-Agent"},
    {"url": "/api/user/profile", "cache": "MISS", "vary": "User-Agent"},
    {"url": "/images/hero.jpg", "cache": "MISS"},
    {"url": "/images/hero.jpg?v=1", "cache": "MISS"},
    {"url": "/images/hero.jpg?v=2", "cache": "MISS"},
]

# Tasks:
# 1. Calculate the current cache hit rate
# 2. Identify the cause of each MISS
# 3. Propose at least 3 measures to improve the cache hit rate
# 4. Estimate the expected cache hit rate after improvements
```

**Expected output:**

```
1. Current cache hit rate: 0% (9 MISS / 9 requests)

2. Root cause analysis:
   - /products: UTM parameters are included in cache key (4 MISS → could be 1)
   - /api/user/profile: Vary: User-Agent is set (cannot be cached)
   - /images/hero.jpg: Query parameter ?v= creates unnecessary variations

3. Improvement measures:
   a. Exclude utm_*, fbclid parameters from CDN cache policy
   b. Remove Vary: User-Agent and use CDN's built-in device detection
   c. Switch image versioning to file name hash approach

4. Expected cache hit rate after improvements:
   - /products: 4 requests → 1 MISS + 3 HIT (75%)
   - /api/user/profile: With Vary fix, 2 requests → 1 MISS + 1 HIT (50%)
   - /images/hero.jpg: 3 requests → 1 MISS + 2 HIT (67%)
   - Overall: 9 requests → 3 MISS + 6 HIT (67%)
```

### Exercise 3 (Advanced): Multi-Origin CDN Architecture Design

Design a CDN configuration that meets the following requirements.

```
Requirements:
- Serve SPA frontend (React) from S3
- Serve REST API from backend via ALB
- Serve images from S3 (with edge resizing and format conversion)
- Support WebSocket connections
- Serve users worldwide (primary regions: Japan, North America, Europe)
- 99.99% availability target

Design items:
1. Origin configuration (multi-origin design)
2. Cache policy (per path pattern)
3. Edge processing (deciding between CloudFront Functions and Lambda@Edge)
4. Security (WAF rules, origin protection)
5. Monitoring (key metrics, alert thresholds)
6. Failover strategy during outages
```

**Expected output:** A design document for each item with specific configuration and reasoning (500 characters or more)

---

## 11. FAQ

### Q1. Is CDN effective for dynamic content?

**A.** Yes, it is. CDN provides four benefits for dynamic content as well. (1) **Faster TCP/TLS handshake** --- Connection reuse (Keep-Alive) between edge and origin is faster than direct communication between user and origin. (2) **Short TTL + `stale-while-revalidate`** --- A setting like `s-maxage=5, stale-while-revalidate=30` serves from cache for 5 seconds while updating from origin in the background, allowing over 90% of requests to be cache hits. (3) **Edge computing** --- Reduce requests to origin itself via CloudFront Functions / Cloudflare Workers. Auth token validation and rate limiting can be handled at the edge. (4) **Connection optimization** --- CDN backbone networks are more optimized than the public internet, making communication to the origin faster overall.

### Q2. How should cache invalidation (purge) be managed?

**A.** Avoid designing around purges and adopt "cache busting" as the baseline. Include a content hash in static asset file names (e.g., `app.abc123.js`) and update the path referenced in HTML. This makes a new file name equal to a new cache entry, eliminating the need for purging. HTML itself is naturally updated with a short TTL (s-maxage=60). For API response caches, tag-based purging such as Fastly's Surrogate-Key is effective. Reserve wildcard purges (`/api/*`) for emergencies, and treat full cache purges (`/*`) as a last resort.

### Q3. How can communication between CDN and origin be optimized?

**A.** (1) Enable **Origin Shield** to aggregate duplicate requests from multiple POPs to the origin. Placing the Origin Shield in the region closest to the origin can reduce the number of requests to origin by 60-90%. (2) Optimize connection count with **Keep-Alive / HTTP/2**. Persistent connections between CDN and origin reduce TLS handshake overhead. (3) Enable **Gzip / Brotli compression** at the origin or edge. Reduces bandwidth by 60-80% for text-based content. (4) Use **ETag / Last-Modified** for conditional requests (304 Not Modified) to reduce data transfer. Even after CDN cache expiry, if origin data has not changed, a 304 is returned, saving bandwidth.

### Q4. When is a multi-CDN setup necessary?

**A.** Consider multi-CDN in the following cases: (1) **Availability requirement of 99.99% or above** --- Mitigate the risk of a single CDN failure. Failover via DNS (Route 53 / NS1). (2) **Per-region optimization** --- Select the best CDN per region, such as Cloudflare for Asia and CloudFront for North America. (3) **Cost optimization** --- When monthly traffic exceeds 100TB, it becomes leverage for negotiating pricing between CDNs. (4) **Avoiding vendor lock-in** --- Design that is not dependent on a specific CDN. However, multi-CDN increases operational complexity and reduces cache efficiency, so a single CDN is often sufficient for under 100TB/month.

### Q5. What is the effect of HTTP/3 (QUIC) in CDN?

**A.** HTTP/3 uses the UDP-based QUIC protocol and delivers the following benefits: (1) **0-RTT connections** --- TLS handshake is skipped on repeat visits. Even on the first connection, it completes in 1-RTT (HTTP/2 requires 2-3 RTT). (2) **Eliminates Head-of-Line Blocking** --- In HTTP/2, a single packet loss blocks all streams, but in HTTP/3 only the affected stream is impacted. Particularly effective on mobile networks. (3) **Connection migration** --- Maintains connections when switching between Wi-Fi and cellular. All major CDNs (CloudFront, Cloudflare, Fastly) support HTTP/3, and client-side browsers (Chrome/Firefox/Safari) are also compatible. Enabling it is as simple as specifying `HttpVersion: http2and3` in CDN settings.

### Q6. How can CDN costs be optimized?

**A.** (1) **Maximize cache hit rate** --- A 1% improvement in hit rate directly reduces origin costs by several percent. The key factors are cache key normalization, proper TTL design, and enabling Origin Shield. (2) **Leverage compression** --- Brotli compression reduces bandwidth by 60-80%. Most CDNs provide automatic compression. (3) **Optimize PriceClass** --- In CloudFront, exclude unnecessary POPs with PriceClass_100 (North America + Europe only) or PriceClass_200 (+ Asia). (4) **Reserved capacity** --- CloudFront Savings Plan (up to 30% discount) or Cloudflare annual contracts. (5) **Image optimization** --- WebP/AVIF conversion reduces image size by 30-50%. (6) **Reduce unnecessary requests** --- Set browser cache max-age appropriately to reduce requests to CDN in the first place.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced material. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| Role of CDN | Latency reduction via edge caching, origin load relief, DDoS protection |
| Cache strategy | Optimize TTL per asset type. Leverage immutable / stale-while-revalidate |
| Cache busting | Include hash in file names to avoid relying on purges |
| Cache key design | Exclude UTM/tracking parameters; keep Vary headers minimal |
| CloudFront | Native integration with AWS ecosystem. Edge processing via Lambda@Edge / Functions |
| Cloudflare | Free bandwidth, instant purge, lightweight edge computing via Workers |
| Fastly | Tag-based purge with Surrogate-Key, Compute@Edge (Wasm) |
| Origin Shield | Aggregate requests to origin via intermediate cache layer (60-90% reduction) |
| Security | Enforce HTTPS, WAF, DDoS protection, origin protection at the CDN layer |
| Monitoring | Continuously monitor cache hit rate, TTFB p95, and origin error rate |

---

## Guides to Read Next

- [Load Balancer](./00-load-balancer.md) --- Traffic distribution behind CDN
- [Caching](./01-caching.md) --- Integration with application-layer caching strategies
- [DB Scaling](./04-database-scaling.md) --- Scaling strategies at the data layer
- [Message Queue](./02-message-queue.md) --- Asynchronous messaging infrastructure
- [Reliability](../00-fundamentals/02-reliability.md) --- Overall design for availability SLA and failure mitigation

---

## References

1. **Web Performance in Action** --- Jeremy Wagner (Manning, 2017) --- Practical guide to CDN and caching strategies
2. **Amazon CloudFront Developer Guide** --- AWS Documentation --- https://docs.aws.amazon.com/cloudfront/
3. **Cloudflare Learning Center** --- https://www.cloudflare.com/learning/ --- From CDN basics to advanced usage
4. **HTTP Caching (MDN Web Docs)** --- https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching
5. **High Performance Browser Networking** --- Ilya Grigorik (O'Reilly, 2013) --- https://hpbn.co/ --- In-depth coverage of HTTP/2, QUIC, and CDN
