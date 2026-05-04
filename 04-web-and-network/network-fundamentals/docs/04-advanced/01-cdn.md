# CDN (Content Delivery Network)

> A CDN is a distributed infrastructure that caches content on edge servers around the world and delivers it from the location closest to the user. It simultaneously reduces latency, saves bandwidth, reduces origin load, and provides DDoS protection — making it an indispensable component of modern web services. This chapter provides a systematic explanation of CDN fundamentals, detailed CloudFront/Cloudflare configuration, and the frontier of Edge Computing.

## What You Will Learn

- [ ] Understand the basic CDN architecture and request routing mechanisms
- [ ] Master cache control header design and cache strategy design techniques
- [ ] Perform practical configuration and deployment of CloudFront / Cloudflare
- [ ] Determine how to choose between cache purge strategies and versioning
- [ ] Implement Edge Computing usage patterns and Cloudflare Workers
- [ ] Understand CDN-related failure patterns and perform troubleshooting

---

## 1. Basic CDN Architecture

### 1.1 Problems CDN Solves

Content delivery over the Internet faces three fundamental challenges caused by physical distance.

1. **Latency**: The speed of light has limits — a round trip from Tokyo to the US West Coast takes about 100ms. Including a TLS handshake, the initial connection alone takes over 300ms
2. **Bandwidth constraints**: The capacity of undersea cables and relay networks is limited, and bottlenecks occur when large amounts of traffic concentrate
3. **Origin server load**: When all requests reach the origin, scaling costs increase linearly

CDN solves these challenges through content caching and delivery via **geographically distributed edge server groups**.

### 1.2 Overall CDN Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CDN Architecture Overview                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐                      │
│   │ Origin   │   │ Origin   │   │ Origin   │   ← Origin Tier     │
│   │ Server A │   │  S3/GCS  │   │ Server B │                      │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘                      │
│        │              │              │                              │
│   ─────┴──────────────┴──────────────┴─────── Origin Shield ───    │
│        │                                                            │
│   ┌────▼──────────────────────────────────────┐                    │
│   │           Mid-Tier / Shield Layer           │  ← Mid-Tier      │
│   │  ┌────────┐  ┌────────┐  ┌────────┐      │                    │
│   │  │ Tokyo  │  │  N.Am  │  │ Europe │      │                    │
│   │  │Regional│  │Regional│  │Regional│      │                    │
│   │  └───┬────┘  └───┬────┘  └───┬────┘      │                    │
│   └──────┼───────────┼───────────┼────────────┘                    │
│          │           │           │                                  │
│   ┌──────▼───────────▼───────────▼────────────┐                    │
│   │              Edge Layer (PoP)               │  ← Edge Tier     │
│   │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐   │                    │
│   │  │TYO│ │OSA│ │SFO│ │NYC│ │LON│ │FRA│   │                    │
│   │  │PoP│ │PoP│ │PoP│ │PoP│ │PoP│ │PoP│   │                    │
│   │  └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘   │                    │
│   └────┼─────┼─────┼─────┼─────┼─────┼──────┘                    │
│        │     │     │     │     │     │                              │
│   ─────┴─────┴─────┴─────┴─────┴─────┴───── Internet ─────        │
│        │     │     │     │     │     │                              │
│       👤    👤    👤    👤    👤    👤   ← End Users              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

PoP = Point of Presence
Each PoP hosts multiple edge servers
```

### 1.3 How Request Routing Works

CDN uses three main methods to route users to the nearest edge server.

**DNS-Based Routing**

The most common method. Returns the IP address of the geographically closest edge server in response to the user's DNS request.

```
Request Routing (DNS-based):

  1. User (Tokyo) accesses cdn.example.com
     │
     ▼
  2. DNS resolver queries CDN's authoritative DNS
     │
     ▼
  3. CDN DNS estimates geolocation from resolver's IP
     │  ┌─────────────────────────────────────┐
     │  │ Resolver IP: 203.0.113.1             │
     │  │ → GeoIP determination: Japan / Tokyo │
     │  │ → Nearest PoP: Tokyo Edge (198.51.100.5) │
     │  └─────────────────────────────────────┘
     │
     ▼
  4. User connects to Tokyo Edge (198.51.100.5)
     │
     ▼
  5. Edge server checks cache
     ├─ HIT  → Respond immediately from cache
     └─ MISS → Fetch from origin → Store in cache → Respond
```

**Anycast Routing**

The method used by Cloudflare. The same IP address is assigned to multiple PoPs, and BGP routing protocol automatically routes traffic to the nearest PoP. There is no DNS resolution overhead and it also excels in DDoS resistance.

**HTTP Redirect**

A method that returns the nearest edge URL as a 302/307 redirect in response to the initial request. It is flexible but causes redirect latency, so it is often used as a supplement.

### 1.4 Content Categories Delivered by CDN

| Category | Examples | Cache Suitability | TTL Guideline |
|---------|--------|--------------|---------|
| Static assets | CSS, JS, images, fonts, favicon | Very high | 1 year (hash-named files) |
| HTML | Page HTML | Moderate | 0 sec to 5 min (revalidation) |
| Media | Video (HLS/DASH), audio, PDF | High | 1 day to 1 month |
| API responses | Public APIs, GraphQL query results | Low to moderate | Seconds to minutes |
| Dynamic content | Personalized pages, real-time data | Basically none | Generated by Edge Computing |

---

## 2. Deep Dive into Cache Control

### 2.1 HTTP Cache Header System

Systematically understand the major HTTP headers that control CDN caching behavior.

```
HTTP Cache Header Priority:

  ┌──────────────────────────────────────────────────┐
  │               Response Headers                    │
  │                                                    │
  │  1. CDN-specific headers (highest priority)       │
  │     CDN-Cache-Control: max-age=3600               │
  │     Surrogate-Control: max-age=86400              │
  │     CloudFront: Cache-Policy                      │
  │                                                    │
  │  2. Cache-Control (standard, recommended)         │
  │     Cache-Control: public, max-age=31536000       │
  │     Cache-Control: private, no-cache              │
  │     Cache-Control: s-maxage=600, max-age=60       │
  │                                                    │
  │  3. Expires (legacy, Cache-Control takes priority) │
  │     Expires: Thu, 01 Dec 2025 16:00:00 GMT        │
  │                                                    │
  │  4. ETag / Last-Modified (for conditional requests) │
  │     ETag: "abc123"                                │
  │     Last-Modified: Wed, 15 Nov 2024 12:00:00 GMT  │
  │                                                    │
  └──────────────────────────────────────────────────┘

  s-maxage vs max-age:
    s-maxage  → TTL for shared caches (CDN, proxy)
    max-age   → TTL for all caches (including browser)
    → s-maxage takes priority over max-age (on CDN)
```

### 2.2 Cache-Control Directives Explained

| Directive | Target | Description |
|---------------|------|------|
| `public` | CDN + browser | Can be stored in shared cache |
| `private` | Browser only | Do not cache on CDN |
| `no-cache` | Both | Store in cache but revalidate every time |
| `no-store` | Both | Do not cache at all |
| `max-age=N` | Both | Cache is valid for N seconds |
| `s-maxage=N` | CDN only | Valid on CDN for N seconds |
| `stale-while-revalidate=N` | Both | Return stale cache for N seconds after expiry while updating in background |
| `stale-if-error=N` | Both | Return stale cache for N seconds on origin error |
| `must-revalidate` | Both | Must revalidate with origin after expiry |
| `immutable` | Both | Content is immutable and revalidation is unnecessary |

### 2.3 Code Example 1: Cache Control Header Configuration in Nginx

```nginx
# /etc/nginx/conf.d/cache-headers.conf
# Cache control header configuration on the origin server side

server {
    listen 443 ssl http2;
    server_name api.example.com;

    # --- Static assets (hash-named files) ---
    # Files like app.a1b2c3d4.js, style.e5f6g7h8.css
    location ~* \.[a-f0-9]{8}\.(js|css|woff2?|ttf|eot|svg|png|jpg|webp|avif)$ {
        # Cache for 1 year + declare immutable
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header CDN-Cache-Control "max-age=31536000";

        # CORS headers (required for fonts etc.)
        add_header Access-Control-Allow-Origin "*";

        # ETag is unnecessary (because immutable)
        etag off;
    }

    # --- Regular static files (without hash) ---
    location ~* \.(ico|gif|bmp)$ {
        add_header Cache-Control "public, max-age=86400, stale-while-revalidate=604800";
        etag on;
    }

    # --- HTML files ---
    location ~* \.html$ {
        # Cache for 5 minutes on CDN, revalidate every time in browser
        add_header Cache-Control "public, s-maxage=300, max-age=0, must-revalidate";
        add_header CDN-Cache-Control "max-age=300, stale-while-revalidate=60";
        etag on;
    }

    # --- API responses ---
    location /api/ {
        # Cache for 30 seconds on CDN, no caching in browser
        add_header Cache-Control "public, s-maxage=30, max-age=0, no-cache";
        add_header Vary "Accept, Accept-Encoding, Authorization";

        # Surrogate key for purging
        add_header Surrogate-Key "api-response";

        proxy_pass http://backend;
    }

    # --- User-specific data ---
    location /api/me/ {
        # Prohibit CDN caching
        add_header Cache-Control "private, no-store, max-age=0";
        proxy_pass http://backend;
    }

    # --- Error pages ---
    location = /error.html {
        # CDN returns stale cache when origin is down
        add_header Cache-Control "public, max-age=60, stale-if-error=86400";
    }
}
```

### 2.4 Cache Key Design

A cache key is the identifier that determines "which cache entry to return for this request." If the design is wrong, it causes reduced cache hit rates (when the key is too fine-grained) or incorrect delivery (when the key is too coarse).

```
Cache Key Components:

  Default: Full URL (host + path + query string)

  ┌──────────────────────────────────────────────────────────┐
  │                    Cache Key Examples                      │
  │                                                            │
  │  Minimum key (recommended):                                │
  │    Host + Path only                                        │
  │    cdn.example.com/images/logo.png                         │
  │    → Maximize hit rate by ignoring query strings           │
  │                                                            │
  │  Intermediate key:                                          │
  │    Host + Path + only necessary queries                    │
  │    cdn.example.com/api/products?category=shoes              │
  │    → Exclude tracking parameters like ?utm_source=twitter  │
  │                                                            │
  │  Maximum key (not recommended):                            │
  │    Host + Path + all queries + all headers                 │
  │    → Cache becomes too fragmented, hit rate drops sharply  │
  │                                                            │
  └──────────────────────────────────────────────────────────┘

  Key expansion via Vary header:
    Vary: Accept-Encoding
    → Store gzip and Brotli versions as separate caches

    Vary: Accept
    → Store image/webp and image/jpeg versions as separate caches

    Note: Vary: Cookie is effectively equivalent to disabling cache
    (because each user has a different Cookie)
```

---

## 3. AWS CloudFront Practical Configuration

### 3.1 CloudFront Components

CloudFront is composed of the following components.

| Component | Role |
|---------------|------|
| Distribution | Configuration unit for CDN delivery. One created per domain |
| Origin | Source of content (S3, ALB, custom origins, etc.) |
| Behavior | Cache and forwarding settings per URL path pattern |
| Cache Policy | Cache key and TTL settings |
| Origin Request Policy | Settings for headers, queries, and cookies forwarded to origin |
| Response Headers Policy | Security headers and other settings added to responses |
| Function | CloudFront Functions / Lambda@Edge |

### 3.2 Code Example 2: CloudFront Distribution (Terraform)

```hcl
# cloudfront.tf
# Terraform configuration for AWS CloudFront Distribution

# --- OAC (Origin Access Control) for S3 origin ---
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "s3-oac-${var.environment}"
  description                       = "OAC for S3 static assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# --- Cache policy ---
resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "static-assets-${var.environment}"
  comment     = "Cache policy for immutable static assets"
  default_ttl = 86400      # 1 day
  max_ttl     = 31536000   # 1 year
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"  # Do not include cookies in cache key
    }
    headers_config {
      header_behavior = "none"  # Do not include headers in cache key
    }
    query_strings_config {
      query_string_behavior = "none"  # Do not include query strings in cache key
    }
    enable_accept_encoding_gzip  = true   # Auto-cache gzip compressed versions
    enable_accept_encoding_brotli = true  # Auto-cache Brotli compressed versions
  }
}

resource "aws_cloudfront_cache_policy" "dynamic_content" {
  name        = "dynamic-content-${var.environment}"
  comment     = "Cache policy for API and dynamic content"
  default_ttl = 30    # 30 seconds
  max_ttl     = 300   # 5 minutes
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Accept", "Accept-Language"]
      }
    }
    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["page", "limit", "category", "lang"]
      }
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# --- Origin request policy ---
resource "aws_cloudfront_origin_request_policy" "api_forward" {
  name    = "api-forward-${var.environment}"
  comment = "Forward necessary headers to API origin"

  cookies_config {
    cookie_behavior = "all"  # Forward all cookies to origin
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "Accept",
        "Accept-Language",
        "Authorization",
        "Content-Type",
        "Origin",
        "Referer",
        "X-Request-ID"
      ]
    }
  }
  query_strings_config {
    query_string_behavior = "all"  # Forward all queries to origin
  }
}

# --- Response headers policy ---
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "security-headers-${var.environment}"
  comment = "Security headers for all responses"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true  # X-Content-Type-Options: nosniff
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com"
      override                = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      override = true
      value    = "camera=(), microphone=(), geolocation=()"
    }
    items {
      header   = "X-CDN-Pop"
      override = false
      value    = ""  # CloudFront automatically adds PoP information
    }
  }
}

# --- Main Distribution ---
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"  # Enable HTTP/3 (QUIC)
  price_class         = "PriceClass_200"  # North America + Europe + Asia + Middle East + Africa
  default_root_object = "index.html"
  comment             = "Main distribution - ${var.environment}"
  aliases             = [var.domain_name]

  # --- S3 origin (static assets) ---
  origin {
    domain_name              = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id                = "s3-static"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
    origin_shield {
      enabled              = true
      origin_shield_region = "ap-northeast-1"  # Tokyo region
    }
  }

  # --- ALB origin (API) ---
  origin {
    domain_name = aws_lb.api.dns_name
    origin_id   = "alb-api"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 30
    }
    custom_header {
      name  = "X-Origin-Verify"
      value = var.origin_verify_secret
    }
  }

  # --- Default behavior (S3 static assets) ---
  default_cache_behavior {
    target_origin_id           = "s3-static"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.static_assets.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id

    # URL rewrite via CloudFront Functions
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.url_rewrite.arn
    }
  }

  # --- API behavior ---
  ordered_cache_behavior {
    path_pattern               = "/api/*"
    target_origin_id           = "alb-api"
    viewer_protocol_policy     = "https-only"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.dynamic_content.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.api_forward.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # --- Dedicated behavior for hash-named assets ---
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = aws_cloudfront_cache_policy.static_assets.id
  }

  # --- SSL certificate ---
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # --- WAF ---
  web_acl_id = var.waf_web_acl_arn

  # --- Access logging ---
  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cf_logs.bucket_domain_name
    prefix          = "cloudfront/${var.environment}/"
  }

  # --- Custom error responses (SPA support) ---
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# --- CloudFront Functions (URL rewrite) ---
resource "aws_cloudfront_function" "url_rewrite" {
  name    = "url-rewrite-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite URLs for SPA routing"
  publish = true
  code    = file("${path.module}/functions/url-rewrite.js")
}
```

### 3.3 URL Rewriting with CloudFront Functions

```javascript
// functions/url-rewrite.js
// CloudFront Functions: URL rewriting for SPA and adding security headers

function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var headers = request.headers;

    // --- Normalize trailing slash ---
    // /about/ → /about (excluding root)
    if (uri.length > 1 && uri.endsWith('/')) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': { value: uri.slice(0, -1) },
                'cache-control': { value: 'max-age=3600' }
            }
        };
    }

    // --- Rewrite paths without extension to index.html as SPA route ---
    // /about, /products/123 → /index.html
    // /style.css, /app.js → pass through as-is
    if (!uri.includes('.')) {
        request.uri = '/index.html';
    }

    // --- Security: prevent path traversal ---
    if (uri.includes('..') || uri.includes('//')) {
        return {
            statusCode: 400,
            statusDescription: 'Bad Request',
            headers: {
                'content-type': { value: 'text/plain' }
            },
            body: 'Invalid request path'
        };
    }

    // --- Language redirect based on Accept-Language ---
    if (uri === '/index.html' || uri === '/') {
        var acceptLang = headers['accept-language']
            ? headers['accept-language'].value : '';
        if (acceptLang.startsWith('ja')) {
            request.uri = '/ja/index.html';
        }
    }

    return request;
}
```

### 3.4 Code Example 3: CloudFront Cache Purge (AWS CLI / SDK)

```bash
#!/bin/bash
# scripts/cloudfront-invalidate.sh
# CloudFront cache invalidation script

DISTRIBUTION_ID="${CF_DISTRIBUTION_ID:?'CF_DISTRIBUTION_ID is required'}"

# --- Invalidate individual paths ---
invalidate_paths() {
    local paths=("$@")
    echo "Invalidating ${#paths[@]} paths on distribution ${DISTRIBUTION_ID}..."

    aws cloudfront create-invalidation \
        --distribution-id "${DISTRIBUTION_ID}" \
        --paths "${paths[@]}" \
        --output json | jq '{
            InvalidationId: .Invalidation.Id,
            Status: .Invalidation.Status,
            Paths: .Invalidation.InvalidationBatch.Paths.Items,
            CreateTime: .Invalidation.CreateTime
        }'
}

# --- Standard invalidation pattern after deployment ---
deploy_invalidation() {
    echo "=== Post-Deploy Invalidation ==="

    # Invalidate only HTML files and service worker
    # (hash-named static files do not need invalidation)
    invalidate_paths \
        "/index.html" \
        "/ja/index.html" \
        "/en/index.html" \
        "/sw.js" \
        "/manifest.json" \
        "/robots.txt" \
        "/sitemap.xml"
}

# --- Wait for invalidation to complete ---
wait_for_invalidation() {
    local invalidation_id="$1"
    echo "Waiting for invalidation ${invalidation_id} to complete..."

    aws cloudfront wait invalidation-completed \
        --distribution-id "${DISTRIBUTION_ID}" \
        --id "${invalidation_id}"

    echo "Invalidation ${invalidation_id} completed."
}

# --- Clear all cache (emergency only) ---
purge_all() {
    echo "WARNING: Purging ALL cache for distribution ${DISTRIBUTION_ID}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        invalidate_paths "/*"
    else
        echo "Aborted."
    fi
}

# --- Main ---
case "${1}" in
    deploy)  deploy_invalidation ;;
    purge)   purge_all ;;
    paths)   shift; invalidate_paths "$@" ;;
    *)       echo "Usage: $0 {deploy|purge|paths <path1> <path2> ...}" ;;
esac
```

```python
# scripts/cloudfront_invalidate.py
# Programmatic invalidation using Python SDK (boto3)

import boto3
import time
from datetime import datetime
from typing import List, Optional

class CloudFrontInvalidator:
    """CloudFront cache invalidation utility"""

    def __init__(self, distribution_id: str, region: str = "us-east-1"):
        self.distribution_id = distribution_id
        self.client = boto3.client("cloudfront", region_name=region)

    def invalidate(self, paths: List[str]) -> dict:
        """Invalidate cache for specified paths"""
        caller_reference = f"inv-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        response = self.client.create_invalidation(
            DistributionId=self.distribution_id,
            InvalidationBatch={
                "Paths": {
                    "Quantity": len(paths),
                    "Items": paths,
                },
                "CallerReference": caller_reference,
            },
        )

        invalidation = response["Invalidation"]
        return {
            "id": invalidation["Id"],
            "status": invalidation["Status"],
            "paths": paths,
            "created": invalidation["CreateTime"].isoformat(),
        }

    def wait_for_completion(
        self, invalidation_id: str, timeout: int = 600
    ) -> bool:
        """Wait for invalidation to complete (default 10 minute timeout)"""
        waiter = self.client.get_waiter("invalidation_completed")
        try:
            waiter.wait(
                DistributionId=self.distribution_id,
                Id=invalidation_id,
                WaiterConfig={
                    "Delay": 10,
                    "MaxAttempts": timeout // 10,
                },
            )
            return True
        except Exception as e:
            print(f"Timeout waiting for invalidation: {e}")
            return False

    def deploy_invalidation(self) -> dict:
        """Standard invalidation after deployment"""
        standard_paths = [
            "/index.html",
            "/sw.js",
            "/manifest.json",
            "/robots.txt",
            "/sitemap.xml",
        ]
        return self.invalidate(standard_paths)


# Usage example
if __name__ == "__main__":
    invalidator = CloudFrontInvalidator("E1234567890ABC")
    result = invalidator.deploy_invalidation()
    print(f"Invalidation created: {result['id']}")
    invalidator.wait_for_completion(result["id"])
```

---

## 4. Cloudflare Practical Configuration

### 4.1 Cloudflare Architecture Characteristics

Cloudflare adopts an "everywhere cloud" architecture based on an Anycast network, providing the same feature set at all PoPs.

```
Cloudflare Anycast Architecture:

  Traditional CDN (hierarchical):
  ┌─────────────────────────────────────┐
  │  User → Edge → Region → Origin      │
  │  (3-hop, high latency on miss)      │
  └─────────────────────────────────────┘

  Cloudflare (flat):
  ┌─────────────────────────────────────────────────┐
  │                                                   │
  │   All PoPs share the same IP: 104.16.x.x         │
  │   BGP automatically routes to the nearest PoP    │
  │                                                   │
  │   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐        │
  │   │Tokyo│   │ SFO │   │ LON │   │ SYD │        │
  │   │ PoP │   │ PoP │   │ PoP │   │ PoP │        │
  │   └──┬──┘   └──┬──┘   └──┬──┘   └──┬──┘        │
  │      │         │         │         │              │
  │   Each PoP executes all of the following:         │
  │   - Caching                                       │
  │   - WAF / DDoS protection                         │
  │   - Workers execution                             │
  │   - DNS resolution                                │
  │   - SSL termination                               │
  │   - Image optimization                            │
  │                                                   │
  └─────────────────────────────────────────────────┘
```

### 4.2 Code Example 4: Edge Processing with Cloudflare Workers

```javascript
// workers/edge-api-cache.js
// Cloudflare Workers: Intelligent caching of API responses

/**
 * Worker that caches API responses at the edge
 * and implements the stale-while-revalidate pattern
 */

const CACHE_CONFIG = {
  // Cache configuration per path pattern
  '/api/products': { ttl: 300, swr: 600, tags: ['products'] },
  '/api/categories': { ttl: 3600, swr: 7200, tags: ['categories'] },
  '/api/search': { ttl: 60, swr: 120, tags: ['search'] },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- Do not cache POST/PUT/DELETE ---
    if (request.method !== 'GET') {
      return handleMutation(request, env);
    }

    // --- Get cache configuration ---
    const cacheConfig = getCacheConfig(url.pathname);
    if (!cacheConfig) {
      // Paths not subject to caching pass through to origin
      return fetch(request);
    }

    // --- Check cache via Cache API ---
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), {
      method: 'GET',
      headers: { 'Accept': request.headers.get('Accept') || 'application/json' },
    });

    let response = await cache.match(cacheKey);

    if (response) {
      // --- Cache hit ---
      const age = getAge(response);
      const isStale = age > cacheConfig.ttl;

      if (isStale && age < cacheConfig.ttl + cacheConfig.swr) {
        // stale-while-revalidate: return stale cache while updating in background
        ctx.waitUntil(revalidateCache(cache, cacheKey, request, cacheConfig));
        response = new Response(response.body, response);
        response.headers.set('X-Cache', 'STALE');
        response.headers.set('X-Cache-Age', String(age));
        return response;
      }

      if (!isStale) {
        response = new Response(response.body, response);
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('X-Cache-Age', String(age));
        return response;
      }
      // TTL + SWR exceeded → fall through to re-fetch
    }

    // --- Cache miss: fetch from origin ---
    const originResponse = await fetch(request);

    if (originResponse.ok) {
      const cachedResponse = new Response(originResponse.body, originResponse);
      cachedResponse.headers.set('Cache-Control', `public, max-age=${cacheConfig.ttl + cacheConfig.swr}`);
      cachedResponse.headers.set('X-Cache-Tags', cacheConfig.tags.join(','));
      cachedResponse.headers.set('X-Cache-Timestamp', String(Date.now()));

      // Save to cache in background
      ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));

      const finalResponse = new Response(cachedResponse.body, cachedResponse);
      finalResponse.headers.set('X-Cache', 'MISS');
      return finalResponse;
    }

    // --- Fallback on origin error ---
    if (response) {
      // Return stale cache if available (stale-if-error)
      const fallback = new Response(response.body, response);
      fallback.headers.set('X-Cache', 'STALE-ERROR');
      return fallback;
    }

    return originResponse;
  },
};

function getCacheConfig(pathname) {
  for (const [pattern, config] of Object.entries(CACHE_CONFIG)) {
    if (pathname.startsWith(pattern)) {
      return config;
    }
  }
  return null;
}

function getAge(response) {
  const timestamp = response.headers.get('X-Cache-Timestamp');
  if (!timestamp) return Infinity;
  return Math.floor((Date.now() - parseInt(timestamp)) / 1000);
}

async function revalidateCache(cache, cacheKey, request, config) {
  try {
    const freshResponse = await fetch(request);
    if (freshResponse.ok) {
      const cached = new Response(freshResponse.body, freshResponse);
      cached.headers.set('Cache-Control', `public, max-age=${config.ttl + config.swr}`);
      cached.headers.set('X-Cache-Tags', config.tags.join(','));
      cached.headers.set('X-Cache-Timestamp', String(Date.now()));
      await cache.put(cacheKey, cached);
    }
  } catch (e) {
    console.error('Revalidation failed:', e);
  }
}

async function handleMutation(request, env) {
  const response = await fetch(request);
  // Purge cache after write operations
  if (response.ok) {
    const cache = caches.default;
    // Delete related cache entries
    // In production, manage cache keys with KV or Durable Objects
  }
  return response;
}
```

### 4.3 Cloudflare Page Rules and Cache Settings

```toml
# wrangler.toml
# Cloudflare Workers configuration file

name = "edge-api-cache"
main = "workers/edge-api-cache.js"
compatibility_date = "2024-09-01"

# --- Environment settings ---
[env.production]
routes = [
  { pattern = "api.example.com/api/*", zone_name = "example.com" }
]

[env.staging]
routes = [
  { pattern = "api-staging.example.com/api/*", zone_name = "example.com" }
]

# --- KV Namespace (for cache metadata) ---
binding = "CACHE_META"
id = "abc123def456"
preview_id = "789ghi012jkl"

# --- Environment variables ---
[vars]
ENVIRONMENT = "production"
ORIGIN_URL = "https://origin.example.com"

# --- Secrets (set with wrangler secret put) ---
# ORIGIN_AUTH_TOKEN
# PURGE_API_KEY
```

---

## 5. Detailed Design of Cache Purge Strategies

### 5.1 Comparison of Purge Methods

| Purge Method | Precision | Speed | Cost | Use Case |
|-----------|------|------|--------|---------|
| Path-specific purge | Highest | Seconds to minutes | Low (CloudFront: $0.005/path) | Individual file updates |
| Wildcard purge | High | Seconds to minutes | Medium | Directory-level updates |
| Tag-based purge | High | Instant (Fastly) | Medium | Bulk update by content type |
| Full purge | Lowest | Minutes | Low | Large-scale changes / emergencies |
| Versioning | N/A | Instant | None | Build assets (recommended) |

### 5.2 Versioning (Design That Eliminates the Need for Purging)

Making purging itself unnecessary is the best practice in CDN operations.

```
Versioning Strategy:

  At build time, append content hash to file names:

  src/                         dist/
  ├── app.js           →      ├── app.a1b2c3d4.js
  ├── style.css        →      ├── style.e5f6g7h8.css
  ├── logo.png         →      ├── logo.i9j0k1l2.png
  └── index.html       →      └── index.html (reference updated)

  Contents of index.html:
  <link rel="stylesheet" href="/style.e5f6g7h8.css">
  <script src="/app.a1b2c3d4.js"></script>

  Deployment flow:
  1. Upload new build assets to S3 (with new hash names)
  2. Update index.html (referencing new hash names)
  3. Invalidate only index.html on CDN
  4. Old assets remain until TTL expires (may be in use by other users)

  Benefits:
  - No purging needed → Zero risk of operational errors
  - Easy rollback → Just revert to old index.html
  - Maximize cache duration → max-age=31536000, immutable
```

---

## 6. Cache Hit/Miss Flow Details

### 6.1 Request Lifecycle

```
CDN Request Processing Flow (Detailed):

  Browser                    CDN Edge                    Origin
    │                           │                           │
    │  GET /api/products        │                           │
    ├──────────────────────────►│                           │
    │                           │                           │
    │                    ┌──────┤ Cache Lookup              │
    │                    │      │                           │
    │                    │  ┌───▼───┐                      │
    │                    │  │ Cache │                      │
    │                    │  │  HIT? │                      │
    │                    │  └───┬───┘                      │
    │                    │      │                           │
    │              ┌─────┴──────┼───────────┐              │
    │              │            │           │              │
    │           [HIT]     [STALE]      [MISS]             │
    │              │            │           │              │
    │              │     Background     ┌───▼───┐          │
    │              │     Revalidate     │ Origin │          │
    │              │       ┌───────────►│ Fetch  │          │
    │              │       │           └───┬───┘          │
    │              │       │               │              │
    │              │       │         ┌─────▼─────┐        │
    │              │       │         │200: Store │        │
    │              │       │         │    cache  │        │
    │              │       │         │304: Update TTL     │
    │              │       │         │5xx: use   │        │
    │              │       │         │    stale  │        │
    │              │       │         └─────┬─────┘        │
    │  ◄───────────┘       │               │              │
    │  X-Cache: HIT        │  ◄────────────┘              │
    │                      │  X-Cache: MISS               │
    │                                                      │
    │  Response header examples:                           │
    │  X-Cache: HIT                                        │
    │  X-Cache-Hits: 42                                    │
    │  Age: 120                                            │
    │  CF-Cache-Status: HIT (Cloudflare)                   │
    │  X-Served-By: cache-tyo1234 (Fastly)                │
```

### 6.2 Cache Status Determination

| Status | Meaning | Action |
|-----------|------|------|
| HIT | Responded from cache | Ideal state |
| MISS | Fetched from origin and cached | Normal for first access |
| EXPIRED | TTL expired, revalidated with origin | Consider reviewing TTL settings |
| STALE | Responded with stale cache (during SWR) | Normal operation |
| BYPASS | Cache skipped | Check configuration rules |
| DYNAMIC | Determined to be non-cacheable | Check Cache-Control headers |
| REVALIDATED | Cache continued via 304 | ETag/Last-Modified working correctly |

---

## 7. Detailed CDN Service Comparison

### 7.1 Feature Comparison Table

```
┌──────────────────┬────────────┬─────────────┬──────────┬──────────┬──────────┐
│ Feature          │ CloudFront │ Cloudflare  │ Fastly   │ Akamai   │ Vercel   │
├──────────────────┼────────────┼─────────────┼──────────┼──────────┼──────────┤
│ PoP count        │ 600+       │ 300+        │ 90+      │ 4,000+   │ Auto     │
│ Free tier        │ 1TB/month  │ Unlimited BW│ None     │ None     │ 100GB/mo │
│ HTTP/3 (QUIC)    │ Supported  │ Supported   │ Supported│ Supported│ Supported│
│ WebSocket        │ Supported  │ Supported   │ Supported│ Supported│ Supported│
│ Edge Computing   │ CF Func +  │ Workers     │ Compute  │ Edge     │ Edge     │
│                  │ Lambda@Edge│ + Pages     │ @Edge    │ Workers  │ Functions│
│ Instant purge    │ Minutes    │ Seconds     │ <150ms   │ Seconds  │ Auto     │
│ Wildcard purge   │ Supported  │ Supported   │ Tag pref.│ Supported│ Auto     │
│ Real-time logs   │ Kinesis    │ Logpush     │ Supported│ DataStr. │ Supported│
│ DDoS protection  │ Shield     │ Built-in    │ Supported│ Kona     │ Basic    │
│ WAF              │ AWS WAF    │ Built-in    │ Next-Gen │ Kona     │ Firewall │
│ Image optim.     │ Lambda     │ Polish/     │ IO       │ Image    │ Supported│
│                  │ @Edge      │ Image Resiz.│          │ Manager  │          │
│ TLS cert         │ ACM free   │ Universal   │ Supported│ Supported│ Auto     │
│                  │            │ SSL free    │          │          │          │
│ gRPC support     │ No         │ Supported   │ Supported│ Supported│ No       │
│ Pricing model    │ Pay-per-use│ Fixed+usage │ Pay/use  │ Quote req│ Fixed+use│
└──────────────────┴────────────┴─────────────┴──────────┴──────────┴──────────┘
```

### 7.2 Cost Comparison Table

| Item | CloudFront | Cloudflare Pro | Fastly |
|------|-----------|---------------|--------|
| Monthly base fee | $0 | $20/domain | $50+ |
| Bandwidth (N.Am/Europe) | $0.085/GB | Included | $0.12/GB |
| Bandwidth (Asia) | $0.114/GB | Included | $0.19/GB |
| HTTPS requests | $0.01/10K | Included | $0.009/10K |
| Invalidation | $0.005/path (over 1,000) | Free | Free (instant) |
| Edge Computing | $0.6/1M req (CF Func) | $0.5/1M req (Workers) | $0.5/1M req |
| SSL certificate | Free (ACM) | Free (Universal) | Paid option |
| DDoS protection | $3,000/mo (Shield Adv.) | Free (built-in) | Paid option |

**Selection Guidelines:**

- **Integrate with AWS ecosystem**: CloudFront (best affinity with S3/ALB/Lambda)
- **Minimize cost + security**: Cloudflare (DDoS protection even on free plan)
- **Instant purge required**: Fastly (real-time purge under 150ms)
- **Next.js applications**: Vercel (most natural integration with ISR/SSR)
- **Enterprise + global**: Akamai (largest PoP count, strict SLA)

---

## 8. Edge Computing Practical Patterns

### 8.1 Edge Computing Use Case Classification

Edge Computing is technology that executes part of the processing traditionally done on origin servers on CDN edges. Not all processing is suitable for the edge, and identifying the right use cases is important.

```
Edge Computing Suitability Matrix:

  ┌─────────────────────────────────────────────────────────┐
  │               Is it suitable for Edge?                   │
  │                                                         │
  │ High  │  A/B testing   │ Personalization │               │
  │       │  Redirects     │ Image optim.    │               │
  │  ↑   │  Header manip. │ Auth/Authz      │               │
  │ Lat.  ├────────────────┼─────────────────┤               │
  │ Impr. │  Bot detection │ API aggregation │               │
  │       │  Geo-restrict. │ SSR/ISR         │               │
  │       │  Rate limiting │ HTML transform  │               │
  │       ├────────────────┼─────────────────┤               │
  │  Low  │  Log collect.  │ DB operations   │               │
  │       │                │ Batch proc.     │               │
  │       │                │ Long computation│               │
  │       └────────────────┴─────────────────┘               │
  │        Low ←── Computation ──→ High                      │
  │                                                         │
  │  Top-left: Edge-optimal  Top-right: Edge-suitable        │
  │  Bottom-left: Edge-ok    Bottom-right: Not suitable      │
  └─────────────────────────────────────────────────────────┘
```

### 8.2 CloudFront Functions vs Lambda@Edge

AWS CloudFront has two types of Edge Computing capabilities, and it is important to know when to use each.

| Characteristic | CloudFront Functions | Lambda@Edge |
|------|---------------------|-------------|
| Execution timing | Viewer Request / Response only | Viewer/Origin Request/Response |
| Runtime | JavaScript (ES 5.1 compatible) | Node.js / Python |
| Max execution time | 1ms | 5 sec (Viewer) / 30 sec (Origin) |
| Memory | 2MB | 128MB to 10GB |
| Network access | Not available | Available |
| File system | Not available | /tmp (512MB) |
| Pricing | $0.10 / 1M requests | $0.60 / 1M requests + execution time |
| Deployment | Instant (all PoPs) | Minutes (replica creation) |
| Use cases | Header manipulation, URL rewriting, simple logic | External API calls, auth, image conversion |

```
CloudFront Functions and Lambda@Edge Execution Points:

  Browser              CloudFront Edge              Origin
    │                      │                            │
    │   Request             │                            │
    ├─────────────────────►│                            │
    │                      │                            │
    │              ┌───────▼────────┐                   │
    │              │ Viewer Request │ ← CF Functions    │
    │              │  (URL rewrite) │   Lambda@Edge     │
    │              └───────┬────────┘                   │
    │                      │                            │
    │              ┌───────▼────────┐                   │
    │              │  Cache Check   │                   │
    │              └───────┬────────┘                   │
    │                      │ (on MISS)                  │
    │              ┌───────▼────────┐                   │
    │              │ Origin Request │ ← Lambda@Edge     │
    │              │ (add headers)  │   only             │
    │              └───────┬────────┘                   │
    │                      ├──────────────────────────►│
    │                      │                            │
    │                      │◄──────────────────────────┤
    │              ┌───────▼────────┐                   │
    │              │Origin Response │ ← Lambda@Edge     │
    │              │ (transform)    │   only             │
    │              └───────┬────────┘                   │
    │              ┌───────▼────────┐                   │
    │              │Viewer Response │ ← CF Functions    │
    │              │(security hdrs) │   Lambda@Edge     │
    │              └───────┬────────┘                   │
    │   Response           │                            │
    │◄─────────────────────┤                            │
```

### 8.3 Code Example 5: Image Optimization with Lambda@Edge

```javascript
// lambda/image-optimizer.js
// Lambda@Edge: Optimize image formats on Origin Response trigger

const AWS = require('aws-sdk');
const sharp = require('sharp');
const S3 = new AWS.S3({ region: 'ap-northeast-1' });

const SUPPORTED_FORMATS = ['webp', 'avif', 'jpeg', 'png'];
const MAX_WIDTH = 2048;
const MAX_HEIGHT = 2048;
const QUALITY_MAP = {
  webp: 80,
  avif: 65,
  jpeg: 85,
  png: 90,
};

exports.handler = async (event) => {
  const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;

  // Return non-image requests as-is
  if (!isImageRequest(request.uri)) {
    return response;
  }

  // Return as-is if origin responds with non-200
  if (response.status !== '200') {
    return response;
  }

  try {
    // Get resize parameters from query parameters
    const params = parseQueryString(request.querystring);
    const width = Math.min(parseInt(params.w) || 0, MAX_WIDTH) || undefined;
    const height = Math.min(parseInt(params.h) || 0, MAX_HEIGHT) || undefined;

    // Determine optimal format from Accept header
    const acceptHeader = request.headers['accept']
      ? request.headers['accept'][0].value
      : '';
    const targetFormat = determineFormat(acceptHeader, request.uri);

    // Fetch original image from S3
    const s3Key = decodeURIComponent(request.uri.substring(1));
    const s3Object = await S3.getObject({
      Bucket: process.env.S3_BUCKET || 'my-images-bucket',
      Key: s3Key,
    }).promise();

    // Convert with sharp
    let pipeline = sharp(s3Object.Body);

    // Resize (if specified)
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Format conversion
    const quality = QUALITY_MAP[targetFormat] || 80;
    pipeline = pipeline.toFormat(targetFormat, { quality });

    const optimizedBuffer = await pipeline.toBuffer();

    // Build converted response
    const optimizedResponse = {
      status: '200',
      statusDescription: 'OK',
      headers: {
        'content-type': [
          { key: 'Content-Type', value: `image/${targetFormat}` },
        ],
        'cache-control': [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
        'x-image-optimized': [
          { key: 'X-Image-Optimized', value: `format=${targetFormat}, size=${optimizedBuffer.length}` },
        ],
        'vary': [
          { key: 'Vary', value: 'Accept' },
        ],
      },
      body: optimizedBuffer.toString('base64'),
      bodyEncoding: 'base64',
    };

    return optimizedResponse;
  } catch (error) {
    console.error('Image optimization failed:', error);
    // Return original response on error
    return response;
  }
};

function isImageRequest(uri) {
  return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(uri);
}

function parseQueryString(qs) {
  if (!qs) return {};
  return qs.split('&').reduce((acc, pair) => {
    const [key, value] = pair.split('=');
    acc[decodeURIComponent(key)] = decodeURIComponent(value || '');
    return acc;
  }, {});
}

function determineFormat(acceptHeader, uri) {
  // AVIF-supported browsers
  if (acceptHeader.includes('image/avif')) return 'avif';
  // WebP-supported browsers
  if (acceptHeader.includes('image/webp')) return 'webp';
  // Maintain original format
  const ext = uri.split('.').pop().toLowerCase();
  if (ext === 'jpg') return 'jpeg';
  return ext;
}
```

---

## 9. CDN Security

### 9.1 DDoS Protection

CDN excels at absorbing and mitigating DDoS attacks due to its distributed architecture.

```
Multi-Layer DDoS Protection:

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  Layer 7 (Application):                                  │
  │  ┌──────────────────────────────────────────────┐       │
  │  │  WAF Rules                                    │       │
  │  │  - SQL injection detection                    │       │
  │  │  - XSS pattern blocking                       │       │
  │  │  - Rate limiting                              │       │
  │  │  - Bot detection / CAPTCHA challenge          │       │
  │  └──────────────────────────────────────────────┘       │
  │                                                          │
  │  Layer 4 (Transport):                                    │
  │  ┌──────────────────────────────────────────────┐       │
  │  │  SYN Flood protection                         │       │
  │  │  - SYN Cookie                                 │       │
  │  │  - Connection rate limiting                   │       │
  │  │  - GeoIP blocking                             │       │
  │  └──────────────────────────────────────────────┘       │
  │                                                          │
  │  Layer 3 (Network):                                      │
  │  ┌──────────────────────────────────────────────┐       │
  │  │  Volumetric attack absorption                 │       │
  │  │  - Distribution via Anycast                   │       │
  │  │  - Blackhole routing                          │       │
  │  │  - Bandwidth: Tbps-scale absorption capacity  │       │
  │  └──────────────────────────────────────────────┘       │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

### 9.2 Origin Protection

When deploying a CDN, if direct access to the origin server is not prevented, attacks bypassing the CDN become possible.

**CloudFront + ALB Origin Protection Example:**

```
Origin Protection Patterns:

  Method 1: Verification via custom headers
  ┌────────────────────────────────────────────────────┐
  │  CloudFront → (X-Origin-Verify: secret123) → ALB  │
  │  ALB WAF rule verifies X-Origin-Verify             │
  │  Missing or mismatched → 403 rejected              │
  └────────────────────────────────────────────────────┘

  Method 2: AWS managed prefix list
  ┌────────────────────────────────────────────────────┐
  │  In ALB security group:                            │
  │  Allow only CloudFront IP ranges                   │
  │  com.amazonaws.global.cloudfront.origin-facing     │
  │  Reference managed prefix list                     │
  └────────────────────────────────────────────────────┘

  Method 3: Cloudflare Authenticated Origin Pulls
  ┌────────────────────────────────────────────────────┐
  │  Mutual TLS authentication between Cloudflare ↔ origin │
  │  Verify Cloudflare's TLS client certificate        │
  │  No certificate → origin rejects connection        │
  └────────────────────────────────────────────────────┘

  Method 4: Cloudflare Tunnel (recommended)
  ┌────────────────────────────────────────────────────┐
  │  Origin does not open inbound ports                │
  │  cloudflared daemon creates outbound               │
  │  tunnel to Cloudflare network                      │
  │  → Origin IP address is completely hidden          │
  └────────────────────────────────────────────────────┘
```

### 9.3 HTTPS / TLS Configuration Best Practices

| Setting | Recommended Value | Reason |
|---------|--------|------|
| Minimum TLS version | TLS 1.2 | TLS 1.0/1.1 have known vulnerabilities |
| HSTS | max-age=31536000; includeSubDomains; preload | Prevent downgrade attacks |
| OCSP Stapling | Enabled | Faster certificate validation |
| CT logging | Enabled | Detect fraudulent certificates |
| SSL Mode (Cloudflare) | Full (Strict) | Encrypt + verify certificates with origin too |
| Origin Protocol (CloudFront) | HTTPS Only | Encrypt communication with origin |

---

## 10. Performance Optimization

### 10.1 Compression

CDN can automatically compress responses to save bandwidth.

| Compression | Ratio | CPU Load | Browser Support | CDN Support |
|---------|--------|---------|-------------|---------|
| gzip | 60-70% | Low | Almost all | All CDNs |
| Brotli (br) | 70-80% | Medium to high | Modern browsers | Major CDNs |
| zstd | 70-80% | Low to medium | Some | Cloudflare |

**Content-Types to Compress:**

```
MIME types that should be compressed:
  text/html
  text/css
  text/javascript / application/javascript
  application/json
  application/xml / text/xml
  image/svg+xml
  application/wasm
  font/woff  (woff2 is already compressed)

Things that should NOT be compressed:
  image/jpeg, image/png, image/webp  (already compressed)
  video/*, audio/*  (already compressed)
  font/woff2  (already compressed)
  application/zip, application/gzip  (already compressed)
```

### 10.2 Leveraging HTTP/2 and HTTP/3

```
Protocol Evolution and CDN Support:

  HTTP/1.1:
  ┌──────────────────────────────────────────────┐
  │  1 connection = 1 request (6 concurrent limit) │
  │  Head-of-Line Blocking present                │
  │  No header compression                        │
  │  → Domain sharding was required               │
  └──────────────────────────────────────────────┘

  HTTP/2:
  ┌──────────────────────────────────────────────┐
  │  Multiple requests per connection (streams)  │
  │  HPACK header compression                    │
  │  Server push (being deprecated)              │
  │  TCP-level HoL Blocking remains              │
  │  → CDN supports H2 as standard               │
  └──────────────────────────────────────────────┘

  HTTP/3 (QUIC):
  ┌──────────────────────────────────────────────┐
  │  UDP-based (eliminates TCP HoL Blocking)     │
  │  0-RTT handshake (on reconnect)              │
  │  Connection migration (Wi-Fi↔mobile switch)  │
  │  QPACK header compression                    │
  │  → Especially effective for mobile users     │
  │  → CloudFront/Cloudflare already supported   │
  └──────────────────────────────────────────────┘

  Recommended CDN settings:
  - Edge ↔ Browser: Enable HTTP/3
  - Edge ↔ Origin: HTTP/2 is sufficient (QUIC benefits are minor)
```

### 10.3 Origin Shield (Cache Layering)

Origin Shield is a feature that places an additional cache layer between the edge and origin, aggregating requests to the origin.

```
Effect of Origin Shield:

  Without Shield:
  ┌──────────────────────────────────────┐
  │  Tokyo PoP ──(MISS)──► Origin        │
  │  Osaka PoP ──(MISS)──► Origin        │
  │  Fukuoka PoP ──(MISS)──► Origin      │
  │  Seoul PoP ──(MISS)──► Origin        │
  │  Singapore PoP ──(MISS)──► Origin    │
  │                                      │
  │  → Each of the 5 PoPs queries origin │
  │  → Requests to origin = 5            │
  └──────────────────────────────────────┘

  With Shield (Tokyo region):
  ┌──────────────────────────────────────────────┐
  │  Tokyo PoP ──(MISS)──► Shield(Tokyo) ──► Origin │
  │  Osaka PoP ──(MISS)──► Shield(Tokyo) ──(HIT)    │
  │  Fukuoka PoP ──(MISS)──► Shield(Tokyo) ──(HIT)  │
  │  Seoul PoP ──(MISS)──► Shield(Tokyo) ──(HIT)    │
  │  Singapore PoP ──(MISS)──► Shield(Tokyo) (HIT)  │
  │                                                  │
  │  → All PoPs go through Shield                    │
  │  → Requests to origin = 1                        │
  │  → Origin load reduced by up to 80%              │
  └──────────────────────────────────────────────────┘
```

---

## 11. Anti-Patterns

### 11.1 Anti-Pattern 1: Contradictory Cache-Control Headers

**Problem:**

```
# Bad example: contradictory cache headers
Cache-Control: public, no-cache, max-age=3600
```

`no-cache` and `max-age=3600` are semantically contradictory. `no-cache` means "you may cache but must revalidate with origin every time," while `max-age=3600` means "revalidation is not needed for 3600 seconds." Different CDNs prioritize these differently, causing unexpected cache behavior.

**Correct Configuration Patterns:**

```
# Pattern A: Short-term cache (CDN only)
# Intent: Cache for 5 minutes on CDN, revalidate every time in browser
Cache-Control: public, s-maxage=300, max-age=0, must-revalidate

# Pattern B: Cache but revalidate every time
# Intent: Keep cache but confirm with ETag/Last-Modified via 304 before use
Cache-Control: public, no-cache
ETag: "v1.2.3"

# Pattern C: No caching at all
# Intent: User-specific data that must not be cached
Cache-Control: private, no-store, max-age=0

# Pattern D: Long-term cache (hash-named files)
# Intent: Maximum caching for immutable files
Cache-Control: public, max-age=31536000, immutable
```

**Severity of Impact:** Misconfigured cache headers can cause delivery of outdated content (old JS persisting for users) or personal information leaks (authenticated responses marked `public` being cached by CDN).

### 11.2 Anti-Pattern 2: Excessive Vary Header Settings

**Problem:**

```
# Bad example: including Cookie in Vary
Vary: Accept-Encoding, Cookie, User-Agent

# Result:
# User A's Cookie: session=abc123
# User B's Cookie: session=def456
# → Different cache entries created for identical content
# → Cache hit rate effectively approaches 0%
# → Equivalent to not having CDN at all
```

**Correct Approach:**

```
# Good example 1: Minimal Vary
Vary: Accept-Encoding
# → Only distinguish between gzip and Brotli versions

# Good example 2: When content negotiation is needed
Vary: Accept-Encoding, Accept-Language
# → Separate cache per language (number of languages is finite)

# Alternative when Cookie-based branching is needed:
# → Parse Cookie at Edge Computing,
#    include only country code or membership level in cache key
# → Use Vary: X-User-Segment instead of Vary: Cookie
#    (Edge parses Cookie and converts to X-User-Segment)
```

### 11.3 Anti-Pattern 3: Cache Configuration Without TTL

**Problem:**

Cases where CDN is deployed without setting any Cache-Control headers. CDN default behavior varies, leading to unintended caching (e.g., POST response caching) or no caching at all (origin load doesn't decrease).

```
# Bad example: no headers
HTTP/1.1 200 OK
Content-Type: text/html
# Cache-Control does not exist

# Default behavior by CDN:
# CloudFront: Without Cache-Control, caches for 24 hours by default
#             (based on Cache Policy Default TTL)
# Cloudflare: Without Cache-Control, follows origin instructions
#             (no instruction = often does not cache)
# → Same content behaves differently depending on CDN
```

**Solution:** Set explicit `Cache-Control` headers on all responses. It is recommended to manage them centrally as middleware in the origin application framework.

---

## 12. Edge Case Analysis

### 12.1 Edge Case 1: Cache Stampede (Thunder Herd Problem)

**Phenomenon:** A phenomenon where the cache TTL of popular content expires simultaneously, causing many edge servers to send requests to the origin at once. The origin may go down due to overload.

```
Cache Stampede:

  Normal operation:
  PoP-A ──(HIT)──► Return cached response
  PoP-B ──(HIT)──► Return cached response
  PoP-C ──(HIT)──► Return cached response
  → Requests to origin: 0

  At the moment of TTL expiry:
  PoP-A ──(MISS)──► Origin ←── 100 req/s
  PoP-B ──(MISS)──► Origin ←── 100 req/s  → Total 300 req/s
  PoP-C ──(MISS)──► Origin ←── 100 req/s     Origin overloaded!

  Countermeasures:
  1. stale-while-revalidate
     → Return stale cache immediately after TTL expiry while updating in background
     → Cache-Control: s-maxage=300, stale-while-revalidate=60

  2. Request Coalescing (Fastly: Request Collapsing)
     → Combine concurrent identical requests into one before forwarding to origin
     → Even with 100 requests, only 1 goes to origin

  3. Origin Shield
     → Aggregate all PoP MISSes at Shield layer
     → Shield queries origin only once

  4. TTL Jittering
     → Add random variation to TTL to prevent simultaneous expiry
     → Example: TTL = 300 + random(0, 60) seconds
```

### 12.2 Edge Case 2: Set-Cookie and Cache Interference

**Phenomenon:** When the origin returns a response with a `Set-Cookie` header that gets cached by CDN, the same cookie is delivered to all users, causing a security incident.

```
Set-Cookie Problem:

  1. User A logs in
  2. Origin responds:
     HTTP/1.1 200 OK
     Set-Cookie: session=USER_A_SESSION; Path=/
     Cache-Control: public, max-age=300   ← Root cause of the problem
     Content-Type: text/html

  3. CDN caches this response
     (including the Set-Cookie header)

  4. User B accesses the same page
  5. CDN responds from cache with Set-Cookie
     → User B receives User A's session cookie
     → Session hijacking occurs

  Countermeasures:
  1. Responses containing Set-Cookie should use private, no-store
  2. Configure CDN to prohibit caching of responses with Set-Cookie
     CloudFront: Set Cookie to "none" in Cache Policy
     Cloudflare: "Cache Level: Bypass" in Page Rule
  3. Return Set-Cookie only from API responses,
     separate from HTML/JS (set Cookie from frontend)
```

### 12.3 Edge Case 3: CORS and CDN Caching

**Phenomenon:** CDN returns the same cache for requests with different Origin headers, causing CORS errors.

```
CORS + CDN Problem:

  1. Request for CDN-hosted image from https://app-a.example.com
     Origin: https://app-a.example.com
     → Origin responds:
       Access-Control-Allow-Origin: https://app-a.example.com
     → CDN caches

  2. Request for same image from https://app-b.example.com
     Origin: https://app-b.example.com
     → CDN responds from cache:
       Access-Control-Allow-Origin: https://app-a.example.com  ← Mismatch!
     → Browser throws CORS error

  Countermeasures:
  1. Set Vary: Origin
     → Store separate cache for each Origin header value
     → Note: cache efficiency decreases slightly

  2. Use wildcard (for public resources)
     Access-Control-Allow-Origin: *
     → Works for all Origins
     → Note: cannot be used with credentials: 'include'

  3. Verify Origin with Edge Function and dynamically add header
     → No need to include Origin in cache key
     → Rewrite Allow-Origin at Edge
```

---

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- [Load Balancing](./00-load-balancing.md) — Operating principles of L4/L7 load balancers, distribution algorithms, health check design
- [HTTP Caching](../02-http/03-caching.md) — Role and behavior of cache-related headers such as Cache-Control, ETag, Last-Modified
- [DNS](../00-introduction/03-dns.md) — DNS-based routing, Anycast, CNAME concepts
- [TLS/SSL](../03-security/00-tls-ssl.md) — TLS termination, certificate management, basics of HTTPS communication

---

## FAQ (Frequently Asked Questions)

### Q1: How should a CDN provider be selected?

**A:** Make a comprehensive judgment based on the following perspectives.

**Technical Perspective:**

| Item | CloudFront | Cloudflare | Fastly | Selection Point |
|------|-----------|-----------|--------|--------------|
| **PoP count** | 600+ | 300+ | 90+ | For global deployment, CloudFront/Cloudflare; for specific regions, check PoP locations |
| **Instant purge** | Minutes | Seconds | <150ms | For frequent updates, Fastly/Cloudflare |
| **Edge Computing** | CF Functions + Lambda@Edge | Workers | Compute@Edge | Complex processing: Lambda@Edge; lightweight: CF Functions/Workers |
| **HTTP/3 support** | Supported | Supported | Supported | All major CDNs support modern protocol |
| **Free tier** | 1TB/month | Unlimited bandwidth | None | For startups, Cloudflare is attractive |

**Business Perspective:**
- **AWS ecosystem integration**: CloudFront (best affinity with S3, ALB, Lambda)
- **Cost minimization + security**: Cloudflare (DDoS protection even on free plan)
- **Next.js/React applications**: Vercel (most natural integration with ISR/SSR, though costs are higher)
- **Enterprise + global**: Akamai (largest PoP count, strict SLA, proven in finance/media industries)
- **Instant purge required**: Fastly (real-time purge under 150ms, essential for news sites)

**Example-Based Selection:**
- **SPA (React/Vue/Angular)**: CloudFront + S3 or Vercel (deployment simplicity)
- **API backend**: Cloudflare (DDoS protection is standard, API Shield feature)
- **Video delivery**: CloudFront (HLS/DASH support, integration with AWS MediaConvert)
- **News site**: Fastly (instant purge, A/B testing at edge)

### Q2: How should CDN cache purging be performed?

**A:** Cache purge strategy depends on update frequency and content type.

**Strategy 1: Versioning (design that eliminates purging) — Most recommended**

```
Append content hash to file names at build time:

  src/app.js      → dist/app.a1b2c3d4.js
  src/style.css   → dist/style.e5f6g7h8.css

  Cache-Control: public, max-age=31536000, immutable

  Benefits:
  ✓ No purge operations needed → Zero risk of operational errors
  ✓ Easy rollback → Just revert to old index.html
  ✓ Maximize cache duration → Maximum CDN hit rate
  ✓ Old and new versions can coexist → Staged rollout

  Applicable to: JS, CSS, images, fonts, and other static assets
```

**Strategy 2: Path-specific purge (for individual file updates)**

```bash
# For CloudFront
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/index.html" "/api/data.json" "/sw.js"

# For Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://example.com/index.html"]}'

Applicable to: HTML files, API responses, Service Worker
Cost: CloudFront — first 1,000 paths free per month, then $0.005/path
```

**Strategy 3: Tag-based purge (bulk update by content type)**

```bash
# For Fastly (using Surrogate-Key header)
# Add the following to origin response:
Surrogate-Key: product-123 category-shoes homepage

# At purge time:
curl -X PURGE "https://api.fastly.com/service/SERVICE_ID/purge/product-123" \
  -H "Fastly-Key: TOKEN"

Applicable to: All pages of a specific product, all pages of a specific category
Benefit: Can instantly purge all related pages at once
```

**Strategy 4: Full purge (emergency only)**

```bash
# CloudFront
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"

# Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

Warning: CDN hit rate drops to 0%, large volume of requests concentrate on origin
Use cases: Emergency security patches, critical bug fixes only
```

**Recommended Flow:**
1. Static assets → Versioning (no purge needed)
2. HTML → Purge specific paths after deployment
3. API → Set short TTL (30-300 seconds) + purge as needed
4. Emergency → Full purge (use Origin Shield in combination to reduce load)

### Q3: Can dynamic content be delivered via CDN?

**A:** Traditionally the role of CDN was "static content only," but modern CDNs also support dynamic content.

**Method 1: Cache with Short TTL**

```nginx
# Cache API response for 30 seconds
Cache-Control: public, s-maxage=30, max-age=0

# Use cases:
# - Product listing API (slight delay in inventory count is acceptable)
# - News feed (delay of tens of seconds is acceptable)
# - Dashboard statistics (real-time is not necessary)

Benefit: Dramatically reduces API load (only 1 request per 30 seconds)
Drawback: Stale data up to 30 seconds old may be delivered
```

**Method 2: Dynamic generation with Edge Computing**

```javascript
// Cloudflare Workers example: generate personalized content at edge
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userId = request.headers.get('X-User-ID');

    // Fetch user information from KV (edge storage)
    const userData = await env.KV_STORE.get(`user:${userId}`, 'json');

    // Generate personalized content
    const response = await fetch(url);
    const html = await response.text();
    const personalizedHtml = html.replace(
      '{{USERNAME}}',
      userData.name || 'Guest'
    );

    return new Response(personalizedHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};

Use cases:
- Displaying username
- Serving region-specific content
- A/B test variant assignment
- UI changes based on authentication status
```

**Method 3: Cache segmentation via Vary header**

```nginx
# Separate cache per language
Vary: Accept-Language
Cache-Control: public, max-age=3600

# Client:
Accept-Language: ja → Cache for /api/products?lang=ja
Accept-Language: en → Cache for /api/products?lang=en

Note: Vary: Cookie is effectively equivalent to disabling cache (each user has a different Cookie)
```

**Method 4: Dynamic processing at origin + stale-while-revalidate**

```nginx
# Cache for 5 minutes, return stale cache while updating in background after expiry
Cache-Control: public, max-age=300, stale-while-revalidate=60

Flow:
1. Cache is valid at request time (within 300 seconds) → Respond immediately from cache
2. Cache has expired (300-360 seconds) → Return stale cache while fetching from origin
3. Over 360 seconds → Fetch from origin (normal cache miss)

Use cases: Content that is updated frequently but a delay of a few seconds is acceptable
```

**Conclusion: Dynamic content can also be delivered via CDN. However, strategic cache design is essential.**

---

## Summary

| Concept | Key Points |
|------|---------|
| Architecture | 3-tier structure: Origin → Regional Shield → Edge PoP → User |
| Routing | DNS-based (general), Anycast (Cloudflare), HTTP redirect |
| Cache control | Cache-Control is most important; use s-maxage to separate CDN and Browser |
| Cache key | Host + Path + minimum necessary queries; use Vary carefully |
| Purge strategy | Versioning (most recommended) > path-specific > tag-based > full purge |
| CloudFront | AWS integration, Origin Shield, Lambda@Edge, pay-per-use pricing |
| Cloudflare | Anycast, Workers, generous free tier, built-in DDoS protection |
| Edge Computing | From lightweight processing (redirects, header manipulation) to complex processing (auth, API aggregation) |
| Security | Origin protection (custom headers, IP restriction, Tunnel), TLS termination, WAF |

---

## Guides to Read Next

After understanding CDN, it is recommended to proceed to the following topics.

- **[Network Debugging](./02-network-debugging.md)**: Master debugging tools (curl, tcpdump, Chrome DevTools) and troubleshooting methods to isolate CDN and origin issues
- **[Performance Optimization](./03-performance.md)**: Practice comprehensive network performance tuning based on CDN design (HTTP/2, HTTP/3, compression, Core Web Vitals)
- **Browser and Web Platform**: Deep dive into Service Worker, cache strategies, and offline support implementation that integrates with CDN

---

## References

1. Cloudflare. "How Cloudflare Works." cloudflare.com, 2024.
2. AWS. "Amazon CloudFront Developer Guide." docs.aws.amazon.com, 2024.
3. Fastly. "Fastly Developer Hub." developer.fastly.com, 2024.
4. RFC 7234. "Hypertext Transfer Protocol (HTTP/1.1): Caching." IETF, 2014.
5. Grigorik, I. "High Performance Browser Networking." O'Reilly, 2013.
6. web.dev. "Web Fundamentals: Performance." Google, 2024.


