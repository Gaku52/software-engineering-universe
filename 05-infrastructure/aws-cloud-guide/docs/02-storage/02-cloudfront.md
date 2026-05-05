# CloudFront

> AWS Global CDN — Optimize content delivery with cache policies, origin configuration, Lambda@Edge, and OAC

## What You Will Learn

1. Design CloudFront distributions and origins to build efficient content delivery
2. Configure cache policies and cache invalidation appropriately to balance performance and freshness
3. Use Lambda@Edge / CloudFront Functions and OAC to achieve edge processing and secure origin access
4. Implement Infrastructure as Code for CloudFront distributions using CloudFormation / CDK
5. Leverage security features such as WAF integration, signed URLs, and geo-restrictions


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [S3 Advanced](./01-s3-advanced.md)

---

## 1. What Is CloudFront

### 1.1 CloudFront Architecture

```
CloudFront Global Network

  User (Tokyo)                    User (New York)
       |                              |
       v                              v
  +----------+                   +----------+
  | Edge     |                   | Edge     |
  | Location |                   | Location |
  | (Tokyo)  |                   | (NYC)    |
  +----+-----+                   +----+-----+
       |                              |
       | Only on cache miss           |
       v                              v
  +------------------+          +------------------+
  | Regional Edge    |          | Regional Edge    |
  | Cache (Osaka)    |          | Cache (Virginia) |
  +--------+---------+          +--------+---------+
           |                             |
           +-------------+---------------+
                         |
                         v
                  +-------------+
                  |   Origin    |
                  | (S3/ALB etc)|
                  +-------------+

  Edge Location: 400+ locations (closest to the user)
  Regional Edge Cache: 13 locations (intermediate cache layer)
```

### 1.2 Key Components of CloudFront

```
+------------------------------------------------------+
| Distribution                                          |
|                                                       |
|  +------------------------------------------------+  |
|  | Origins                                         |  |
|  | - S3 Bucket                                     |  |
|  | - ALB / EC2                                     |  |
|  | - Custom Origin (any HTTP server)               |  |
|  | - MediaStore / MediaPackage                     |  |
|  +------------------------------------------------+  |
|                                                       |
|  +------------------------------------------------+  |
|  | Behaviors                                       |  |
|  | - Path pattern: /api/*, /static/*, default(*)   |  |
|  | - Cache policy                                  |  |
|  | - Origin request policy                         |  |
|  | - Response headers policy                       |  |
|  +------------------------------------------------+  |
|                                                       |
|  +------------------------------------------------+  |
|  | Settings                                        |  |
|  | - Alternate domain (CNAME)                      |  |
|  | - SSL certificate (ACM)                         |  |
|  | - Price class                                   |  |
|  | - WAF integration                               |  |
|  +------------------------------------------------+  |
+------------------------------------------------------+
```

### 1.3 CloudFront Pricing

| Billing Item | Description | Tokyo Region Reference Price |
|---------|------|---------------------|
| Data transfer | Edge to Internet | $0.114/GB (first 10TB) |
| HTTP requests | GET/HEAD | $0.0090/10K requests |
| HTTPS requests | GET/HEAD | $0.0120/10K requests |
| Invalidation | Cache invalidation | Free up to 1,000 paths/month |
| Lambda@Edge | Invocation count + execution time | $0.60/1M requests |
| CloudFront Functions | Invocation count | $0.10/1M requests |

### 1.4 Choosing a Price Class

```bash
# Price class comparison
# PriceClass_All:     Use all Edge Locations (best performance)
# PriceClass_200:     North America, Europe, Asia, Middle East, Africa
# PriceClass_100:     North America, Europe only (cheapest)

# For Japan-focused services, PriceClass_200 is recommended
# PriceClass_100 does not use Asian Edge Locations
```

---

## 2. Origin Configuration

### 2.1 Origin Type Comparison

| Origin Type | Use Case | Authentication | Protocol |
|--------------|------|---------|----------|
| S3 Bucket | Static files | OAC (recommended) | HTTPS |
| ALB | Dynamic content | Custom header | HTTP/HTTPS |
| EC2 | Direct connection | Security group | HTTP/HTTPS |
| API Gateway | API | IAM / Cognito | HTTPS |
| MediaStore | Video delivery | OAC | HTTPS |
| Custom Origin | External server | Shared secret | HTTPS |

### 2.2 Code Example: Creating a CloudFront Distribution

```bash
# Multi-origin configuration with S3 + ALB
aws cloudfront create-distribution --distribution-config '{
  "CallerReference": "my-dist-2024",
  "Comment": "Production distribution",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "S3-static",
        "DomainName": "my-bucket.s3.ap-northeast-1.amazonaws.com",
        "OriginAccessControlId": "EXXXXXXXX",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      },
      {
        "Id": "ALB-api",
        "DomainName": "my-alb-123456.ap-northeast-1.elb.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
          "OriginReadTimeout": 30,
          "OriginKeepaliveTimeout": 5
        },
        "CustomHeaders": {
          "Quantity": 1,
          "Items": [{
            "HeaderName": "X-Origin-Verify",
            "HeaderValue": "my-secret-header-value"
          }]
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-static",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true,
    "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [{
      "PathPattern": "/api/*",
      "TargetOriginId": "ALB-api",
      "ViewerProtocolPolicy": "https-only",
      "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
      "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
      "AllowedMethods": {"Quantity": 7, "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"]},
      "Compress": true
    }]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/xxx",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Aliases": {"Quantity": 1, "Items": ["www.example.com"]}
}'
```

### 2.3 Origin Failover

```
Origin Failover Configuration

  CloudFront
      |
  Origin Group
  +-----------------------+
  | Primary:   S3-main    |  <- Normally forwards here
  | Secondary: S3-DR      |  <- Automatically switches when Primary returns 5xx/4xx
  +-----------------------+

  Failover conditions:
  - HTTP 500, 502, 503, 504
  - HTTP 403, 404 (optional)
  - Connection timeout
```

```bash
# Create an origin group (failover configuration)
aws cloudfront create-distribution --distribution-config '{
  "CallerReference": "failover-dist-2024",
  "Comment": "Distribution with origin failover",
  "Enabled": true,
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "S3-primary",
        "DomainName": "primary-bucket.s3.ap-northeast-1.amazonaws.com",
        "OriginAccessControlId": "EXXXXXXXX",
        "S3OriginConfig": {"OriginAccessIdentity": ""}
      },
      {
        "Id": "S3-failover",
        "DomainName": "failover-bucket.s3.us-west-2.amazonaws.com",
        "OriginAccessControlId": "EYYYYYYYY",
        "S3OriginConfig": {"OriginAccessIdentity": ""}
      }
    ]
  },
  "OriginGroups": {
    "Quantity": 1,
    "Items": [{
      "Id": "my-origin-group",
      "FailoverCriteria": {
        "StatusCodes": {
          "Quantity": 4,
          "Items": [500, 502, 503, 504]
        }
      },
      "Members": {
        "Quantity": 2,
        "Items": [
          {"OriginId": "S3-primary"},
          {"OriginId": "S3-failover"}
        ]
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "my-origin-group",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true,
    "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
  }
}'
```

### 2.4 Securing ALB Origin

```bash
# Ensure ALB only accepts requests via CloudFront

# Method 1: Validate with custom header
# Add a custom header on the CloudFront side and validate with ALB rules

# ALB listener rule configuration
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:listener/app/my-alb/xxx/yyy \
  --conditions '[{
    "Field": "http-header",
    "HttpHeaderConfig": {
      "HttpHeaderName": "X-Origin-Verify",
      "Values": ["my-secret-header-value"]
    }
  }]' \
  --actions '[{"Type": "forward", "TargetGroupArn": "arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:targetgroup/my-targets/xxx"}]' \
  --priority 10

# Default rule to reject requests without the custom header
aws elbv2 modify-rule \
  --rule-arn arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:listener-rule/app/my-alb/xxx/yyy/zzz \
  --actions '[{"Type": "fixed-response", "FixedResponseConfig": {"StatusCode": "403", "ContentType": "text/plain", "MessageBody": "Direct access not allowed"}}]'

# Method 2: Allow CloudFront IP ranges using AWS managed prefix list
# Add CloudFront IP ranges to the Security Group
aws ec2 authorize-security-group-ingress \
  --group-id sg-0123456789abcdef0 \
  --ip-permissions '[{
    "IpProtocol": "tcp",
    "FromPort": 443,
    "ToPort": 443,
    "PrefixListIds": [{"PrefixListId": "pl-3b927c52"}]
  }]'
# pl-3b927c52 is the CloudFront managed prefix list
```

---

## 3. Cache Policies

### 3.1 How Caching Works

```
Cache Hit/Miss Flow

  Request -> Edge Location
                  |
          Search by cache key
                  |
         +--------+--------+
         |                 |
       Hit               Miss
         |                 |
    Respond from     Regional Edge Cache
    cache immediately      |
                    +------+------+
                    |             |
                  Hit           Miss
                    |             |
               Respond from   Forward request
               cache          to origin

  Cache key = URL + Headers + Query strings + Cookies
  (Cache policy controls the key components)
```

### 3.2 Managed Cache Policies

| Policy Name | Policy ID | TTL | Query Strings | Headers | Use Case |
|-----------|-----------|-----|------------|---------|------|
| CachingOptimized | 658327ea-... | 86400s | None | None | Static content |
| CachingOptimizedForUncompressedObjects | b2884449-... | 86400s | None | None | Uncompressed |
| CachingDisabled | 4135ea2d-... | 0s | All | All | API / Dynamic pages |
| Amplify | 2e54312d-... | 2s | All | Authorization | Amplify apps |
| Elemental-MediaPackage | 08627262-... | 86400s | Some | None | Video delivery |

### 3.3 Managed Origin Request Policies

| Policy Name | Use Case | Forwarded Content |
|-----------|------|---------|
| AllViewer | Forward all viewer headers | All headers, all query strings, all cookies |
| AllViewerExceptHostHeader | Forward all except Host | For ALB origins |
| CORS-S3Origin | Forward CORS headers | Origin, Access-Control-Request-* |
| UserAgentRefererHeaders | Forward UA + Referer | For analytics |
| AllViewerAndCloudFrontHeaders-2022-06 | Forward all including CF headers | Also forwards CF-specific headers like geo info |

### 3.4 Code Example: Custom Cache Policy

```bash
# Create a custom cache policy
aws cloudfront create-cache-policy --cache-policy-config '{
  "Name": "CustomStaticAssets",
  "Comment": "Static assets with long TTL",
  "DefaultTTL": 86400,
  "MaxTTL": 31536000,
  "MinTTL": 0,
  "ParametersInCacheKeyAndForwardedToOrigin": {
    "EnableAcceptEncodingGzip": true,
    "EnableAcceptEncodingBrotli": true,
    "HeadersConfig": {
      "HeaderBehavior": "none"
    },
    "CookiesConfig": {
      "CookieBehavior": "none"
    },
    "QueryStringsConfig": {
      "QueryStringBehavior": "whitelist",
      "QueryStrings": {
        "Quantity": 1,
        "Items": ["v"]
      }
    }
  }
}'

# Custom cache policy for APIs (short TTL + Authorization header)
aws cloudfront create-cache-policy --cache-policy-config '{
  "Name": "ApiShortTTL",
  "Comment": "API with short TTL and Authorization cache key",
  "DefaultTTL": 5,
  "MaxTTL": 60,
  "MinTTL": 0,
  "ParametersInCacheKeyAndForwardedToOrigin": {
    "EnableAcceptEncodingGzip": true,
    "EnableAcceptEncodingBrotli": true,
    "HeadersConfig": {
      "HeaderBehavior": "whitelist",
      "Headers": {
        "Quantity": 1,
        "Items": ["Authorization"]
      }
    },
    "CookiesConfig": {
      "CookieBehavior": "none"
    },
    "QueryStringsConfig": {
      "QueryStringBehavior": "all"
    }
  }
}'
```

### 3.5 Code Example: Cache Invalidation

```bash
# Invalidate cache for specific paths
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXX \
  --paths '/index.html' '/css/*' '/js/*'

# Invalidate all cache (cost note: free up to 1,000 paths/month)
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXX \
  --paths '/*'

# Check invalidation status
aws cloudfront get-invalidation \
  --distribution-id EXXXXXXXXXX \
  --id IXXXXXXXXX

# Post-deployment cache invalidation script
#!/bin/bash
DIST_ID="EXXXXXXXXXX"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths '/*' \
  --query 'Invalidation.Id' --output text)

echo "Invalidation ID: $INVALIDATION_ID"

# Wait for completion
aws cloudfront wait invalidation-completed \
  --distribution-id $DIST_ID \
  --id $INVALIDATION_ID

echo "Invalidation completed!"
```

### 3.6 Optimizing Cache Hit Rate

```bash
# Check cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=EXXXXXXXXXX Name=Region,Value=Global \
  --start-time "$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 3600 \
  --statistics Average

# Checklist when cache hit rate is low:
# 1. Query strings: Exclude unnecessary query strings from the cache key
# 2. Cookies: Exclude unnecessary cookies from the cache key
# 3. Headers: Exclude unnecessary headers other than Accept-Encoding
# 4. TTL: If MinTTL is 0, check the origin's Cache-Control header
# 5. Versioning: Include hashes in file names and set long TTLs
```

---

## 4. Lambda@Edge and CloudFront Functions

### 4.1 Execution Timing

```
Four Event Points in Request/Response

  Client                                  Origin
     |                                        |
     |  Viewer Request                        |
     |  (CF Functions / Lambda@Edge)          |
     +------->+                               |
              |  Origin Request               |
              |  (Lambda@Edge only)            |
              +------------------------------>+
              |                               |
              |  Origin Response              |
              |  (Lambda@Edge only)            |
              +<------------------------------+
     |  Viewer Response                       |
     |  (CF Functions / Lambda@Edge)          |
     +<-------+                               |
     |                                        |
```

### 4.2 CloudFront Functions vs Lambda@Edge

| Feature | CloudFront Functions | Lambda@Edge |
|------|---------------------|-------------|
| Execution location | All Edge Locations (400+) | Regional Edge Caches (13) |
| Execution time | Max 1ms | Max 5s (Viewer) / 30s (Origin) |
| Memory | 2MB | 128-3008 MB |
| Network access | No | Yes |
| File system | No | /tmp (512MB) |
| Runtime | JavaScript (ES 5.1) | Node.js / Python |
| Pricing | $0.10/1M requests | $0.60/1M requests + execution time |
| Logs | CloudWatch Logs (limited) | CloudWatch Logs (each region) |
| Use cases | URL rewriting, header manipulation, simple auth | A/B testing, authentication, image resizing, response generation |

### 4.3 Code Example: CloudFront Functions

```javascript
// === SPA Fallback: /about -> /index.html ===
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Fall back to index.html for paths without extensions
  if (!uri.includes('.')) {
    request.uri = '/index.html';
  }

  return request;
}
```

```javascript
// === Basic Authentication ===
function handler(event) {
  var request = event.request;
  var headers = request.headers;

  var authString = 'Basic ' + 'dXNlcjpwYXNzd29yZA=='; // user:password

  if (
    typeof headers.authorization === 'undefined' ||
    headers.authorization.value !== authString
  ) {
    return {
      statusCode: 401,
      statusDescription: 'Unauthorized',
      headers: {
        'www-authenticate': { value: 'Basic realm="Restricted"' }
      }
    };
  }

  return request;
}
```

```javascript
// === URL Normalization (trailing slash unification) ===
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Add trailing slash for paths without file extensions
  if (!uri.endsWith('/') && !uri.includes('.')) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: uri + '/' }
      }
    };
  }

  // Redirect /index.html to /
  if (uri.endsWith('/index.html')) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: uri.replace('/index.html', '/') }
      }
    };
  }

  return request;
}
```

```bash
# Create a CloudFront Function
aws cloudfront create-function \
  --name spa-url-rewrite \
  --function-config '{"Comment":"SPA URL rewrite","Runtime":"cloudfront-js-2.0"}' \
  --function-code fileb://function.js

# Test
aws cloudfront test-function \
  --name spa-url-rewrite \
  --if-match EXXXXX \
  --event-object fileb://test-event.json

# Test event example
# test-event.json:
# {
#   "version": "1.0",
#   "context": {"eventType": "viewer-request"},
#   "viewer": {"ip": "1.2.3.4"},
#   "request": {
#     "method": "GET",
#     "uri": "/about",
#     "querystring": {},
#     "headers": {}
#   }
# }

# Publish
aws cloudfront publish-function \
  --name spa-url-rewrite \
  --if-match EXXXXX

# Associate with a distribution behavior
aws cloudfront update-distribution --id EXXXXXXXXXX \
  --distribution-config '{
    ...
    "DefaultCacheBehavior": {
      ...
      "FunctionAssociations": {
        "Quantity": 1,
        "Items": [{
          "EventType": "viewer-request",
          "FunctionARN": "arn:aws:cloudfront::123456789012:function/spa-url-rewrite"
        }]
      }
    }
  }'
```

### 4.4 Code Example: Lambda@Edge (Image Resizing)

```javascript
// Resize images in Origin Response
const sharp = require('sharp');
const aws = require('aws-sdk');
const s3 = new aws.S3();

exports.handler = async (event) => {
  const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;

  if (response.status === '200') {
    const params = new URLSearchParams(request.querystring);
    const width = parseInt(params.get('w')) || null;
    const height = parseInt(params.get('h')) || null;
    const format = params.get('f') || 'webp';  // webp, avif, jpeg, png

    if (width || height) {
      const s3Response = await s3.getObject({
        Bucket: 'my-images-bucket',
        Key: request.uri.substring(1),
      }).promise();

      let pipeline = sharp(s3Response.Body)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true });

      // Format conversion
      switch (format) {
        case 'avif':
          pipeline = pipeline.avif({ quality: 80 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: 85 });
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: 85, progressive: true });
          break;
        default:
          pipeline = pipeline.webp({ quality: 85 });
      }

      const resized = await pipeline.toBuffer();

      // Lambda@Edge response body limit is 1MB
      if (resized.length < 1048576) {
        response.body = resized.toString('base64');
        response.bodyEncoding = 'base64';
        response.headers['content-type'] = [{ value: `image/${format}` }];
        response.headers['cache-control'] = [{ value: 'public, max-age=31536000, immutable' }];
      }
    }
  }

  return response;
};
```

### 4.5 Code Example: Lambda@Edge (A/B Testing)

```javascript
// Route A/B tests in Viewer Request
exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  // Determine variant from existing cookie
  const cookies = headers.cookie || [];
  let variant = null;

  for (const cookie of cookies) {
    const match = cookie.value.match(/ab-variant=([AB])/);
    if (match) {
      variant = match[1];
      break;
    }
  }

  // If no cookie, randomly assign
  if (!variant) {
    variant = Math.random() < 0.5 ? 'A' : 'B';
  }

  // Change origin path based on variant
  if (variant === 'B') {
    request.origin.s3.path = '/variant-b';
  }

  // Add variant info to custom header
  request.headers['x-ab-variant'] = [{ key: 'X-AB-Variant', value: variant }];

  return request;
};
```

```javascript
// Set A/B test cookie in Viewer Response
exports.handler = async (event) => {
  const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;

  const variant = request.headers['x-ab-variant']
    ? request.headers['x-ab-variant'][0].value
    : 'A';

  // Set cookie (valid for 30 days)
  response.headers['set-cookie'] = response.headers['set-cookie'] || [];
  response.headers['set-cookie'].push({
    value: `ab-variant=${variant}; Path=/; Max-Age=2592000; SameSite=Lax`
  });

  return response;
};
```

---

## 5. OAC (Origin Access Control)

### 5.1 OAC vs OAI

```
OAI (legacy, deprecated):
  CloudFront --- OAI (special IAM) ---> S3
  Limitations: No SSE-KMS support, Signature V2, S3 only

OAC (new, recommended):
  CloudFront --- OAC (SigV4 signing) ---> S3 / MediaStore / Lambda URL
  Benefits:
  - Supports SSE-KMS encrypted buckets
  - Signature V4 (latest signing method)
  - Supports origin types beyond S3
  - Fine-grained policy control
  - Supports all AWS regions
```

### 5.2 Code Example: OAC Configuration

```bash
# Create OAC
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "my-s3-oac",
    "Description": "OAC for S3 origin",
    "OriginAccessControlOriginType": "s3",
    "SigningBehavior": "always",
    "SigningProtocol": "sigv4"
  }' --query 'OriginAccessControl.Id' --output text)

echo "OAC ID: $OAC_ID"

# S3 bucket policy (allow access only from CloudFront)
aws s3api put-bucket-policy --bucket my-static-bucket --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-static-bucket/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/EXXXXXXXXXX"
        }
      }
    }
  ]
}'

# For SSE-KMS encrypted buckets, a KMS key policy is also required
# Add CloudFront service principal to the KMS key policy
aws kms put-key-policy --key-id alias/my-s3-key --policy-name default --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontDecrypt",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey*"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/EXXXXXXXXXX"
        }
      }
    }
  ]
}'
```

### 5.3 Migrating from OAI to OAC

```bash
# 1. Create OAC
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "migration-oac",
    "OriginAccessControlOriginType": "s3",
    "SigningBehavior": "always",
    "SigningProtocol": "sigv4"
  }' --query 'OriginAccessControl.Id' --output text)

# 2. Update the distribution (OAI -> OAC)
# Get the ETag
ETAG=$(aws cloudfront get-distribution-config --id EXXXXXXXXXX --query 'ETag' --output text)

# Get config and switch to OAC
aws cloudfront get-distribution-config --id EXXXXXXXXXX --query 'DistributionConfig' > dist-config.json

# Edit dist-config.json:
# Change Origins.Items[].S3OriginConfig.OriginAccessIdentity to ""
# Set Origins.Items[].OriginAccessControlId to OAC_ID

aws cloudfront update-distribution \
  --id EXXXXXXXXXX \
  --if-match $ETAG \
  --distribution-config file://dist-config.json

# 3. Update the S3 bucket policy for OAC
# (Add AllowCloudFrontServicePrincipal from section 5.2 above)

# 4. After verifying operation, delete the OAI
aws cloudfront delete-cloud-front-origin-access-identity --id OAIXXXXXXXXX --if-match $OAI_ETAG
```

---

## 6. Security Headers and Response Policies

### 6.1 Code Example: Response Headers Policy

```bash
aws cloudfront create-response-headers-policy \
  --response-headers-policy-config '{
  "Name": "SecurityHeaders",
  "SecurityHeadersConfig": {
    "StrictTransportSecurity": {
      "Override": true,
      "AccessControlMaxAgeSec": 31536000,
      "IncludeSubdomains": true,
      "Preload": true
    },
    "ContentTypeOptions": {
      "Override": true
    },
    "FrameOptions": {
      "Override": true,
      "FrameOption": "DENY"
    },
    "XSSProtection": {
      "Override": true,
      "Protection": true,
      "ModeBlock": true
    },
    "ContentSecurityPolicy": {
      "Override": true,
      "ContentSecurityPolicy": "default-src '\''self'\''; img-src '\''self'\'' data: https:; script-src '\''self'\''"
    },
    "ReferrerPolicy": {
      "Override": true,
      "ReferrerPolicy": "strict-origin-when-cross-origin"
    }
  },
  "CorsConfig": {
    "AccessControlAllowOrigins": {
      "Quantity": 1,
      "Items": ["https://example.com"]
    },
    "AccessControlAllowHeaders": {
      "Quantity": 1,
      "Items": ["*"]
    },
    "AccessControlAllowMethods": {
      "Quantity": 3,
      "Items": ["GET", "HEAD", "OPTIONS"]
    },
    "AccessControlAllowCredentials": false,
    "OriginOverride": true
  },
  "CustomHeadersConfig": {
    "Quantity": 1,
    "Items": [{
      "Header": "X-Robots-Tag",
      "Value": "noindex, nofollow",
      "Override": true
    }]
  },
  "ServerTimingHeadersConfig": {
    "Enabled": true,
    "SamplingRate": 50
  }
}'
```

### 6.2 Server-Timing Header

```
# Server-Timing header output example
Server-Timing: cdn-cache-hit;desc="Hit from cloudfront", cdn-upstream-layer;desc="EDGE"

# Control output ratio with SamplingRate (0-100)
# 50 = Add Server-Timing header to 50% of requests
# Useful for performance measurement, but set to 1-10% in production
```

---

## 7. Signed URLs / Cookies

### 7.1 Overview of Signed Access

```
Signed URLs vs Signed Cookies

Signed URLs:
  - Access control for a single file
  - Temporary links shared via email, etc.
  - Example: https://d111.cloudfront.net/premium/video.mp4?
        Expires=1708099200&Signature=xxxx&Key-Pair-Id=KYYY

Signed Cookies:
  - Access control for multiple files
  - Delivering restricted content to logged-in users
  - Example: Set-Cookie: CloudFront-Policy=xxx;
        Set-Cookie: CloudFront-Signature=yyy;
        Set-Cookie: CloudFront-Key-Pair-Id=zzz;
```

### 7.2 Code Example: Generating Signed URLs

```bash
# Create a CloudFront key pair (upload public key)
# First, generate an RSA key pair
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Register the public key with CloudFront
PUBLIC_KEY_ID=$(aws cloudfront create-public-key \
  --public-key-config '{
    "CallerReference": "my-key-2024",
    "Name": "my-signing-key",
    "EncodedKey": "'"$(cat public_key.pem)"'"
  }' --query 'PublicKey.Id' --output text)

# Create a key group
KEY_GROUP_ID=$(aws cloudfront create-key-group \
  --key-group-config '{
    "Name": "my-key-group",
    "Items": ["'"$PUBLIC_KEY_ID"'"]
  }' --query 'KeyGroup.Id' --output text)

echo "Key Group ID: $KEY_GROUP_ID"
# Set as TrustedKeyGroups in the distribution behavior
```

```python
# Generate a signed URL in Python
import datetime
from botocore.signers import CloudFrontSigner
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

def rsa_signer(message):
    with open('private_key.pem', 'rb') as key_file:
        private_key = serialization.load_pem_private_key(
            key_file.read(), password=None
        )
    return private_key.sign(message, padding.PKCS1v15(), hashes.SHA1())

key_id = 'KXXXXXXXXXX'
cf_signer = CloudFrontSigner(key_id, rsa_signer)

# Generate a signed URL (valid for 1 hour)
url = cf_signer.generate_presigned_url(
    url='https://d111111abcdef8.cloudfront.net/premium/video.mp4',
    date_less_than=datetime.datetime.utcnow() + datetime.timedelta(hours=1)
)
print(url)

# Generate a signed URL with IP restriction using a custom policy
from botocore.signers import CloudFrontSigner
import json

custom_policy = json.dumps({
    "Statement": [{
        "Resource": "https://d111111abcdef8.cloudfront.net/premium/*",
        "Condition": {
            "DateLessThan": {"AWS:EpochTime": int((datetime.datetime.utcnow() + datetime.timedelta(hours=1)).timestamp())},
            "IpAddress": {"AWS:SourceIp": "203.0.113.0/24"}
        }
    }]
})

signed_url = cf_signer.generate_presigned_url(
    url='https://d111111abcdef8.cloudfront.net/premium/video.mp4',
    policy=custom_policy
)
```

---

## 8. Geo-Restrictions and Access Control

### 8.1 Geo-Restriction Configuration

```bash
# Block access from specific countries
aws cloudfront update-distribution --id EXXXXXXXXXX \
  --distribution-config '{
    ...
    "Restrictions": {
      "GeoRestriction": {
        "RestrictionType": "blacklist",
        "Quantity": 2,
        "Items": ["CN", "RU"]
      }
    }
  }'

# Allow only specific countries (whitelist)
aws cloudfront update-distribution --id EXXXXXXXXXX \
  --distribution-config '{
    ...
    "Restrictions": {
      "GeoRestriction": {
        "RestrictionType": "whitelist",
        "Quantity": 1,
        "Items": ["JP"]
      }
    }
  }'
```

### 8.2 WAF Integration

```bash
# Associate a WAF Web ACL with CloudFront
aws wafv2 create-web-acl \
  --name cloudfront-waf \
  --scope CLOUDFRONT \
  --region us-east-1 \
  --default-action '{"Allow":{}}' \
  --rules '[
    {
      "Name": "RateLimit",
      "Priority": 1,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {"Block": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "RateLimit"
      }
    },
    {
      "Name": "AWSManagedRulesCommonRuleSet",
      "Priority": 2,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRuleSet"
      }
    },
    {
      "Name": "AWSManagedRulesSQLiRuleSet",
      "Priority": 3,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesSQLiRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "SQLiRuleSet"
      }
    }
  ]' \
  --visibility-config '{
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "cloudfront-waf"
  }'

# Associate the WAF Web ACL with the distribution
# Specify WebACLId when creating/updating the distribution
```

---

## 9. Building with CloudFormation / CDK

### 9.1 CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: CloudFront Distribution with S3 + ALB origins, OAC, WAF

Parameters:
  DomainName:
    Type: String
    Description: Custom domain name
  CertificateArn:
    Type: String
    Description: ACM certificate ARN (us-east-1)
  AlbDomainName:
    Type: String
    Description: ALB domain name
  HostedZoneId:
    Type: String
    Description: Route 53 hosted zone ID

Resources:
  # S3 Bucket (static content)
  StaticBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '${AWS::StackName}-static'
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true

  # S3 Bucket Policy
  StaticBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref StaticBucket
      PolicyDocument:
        Statement:
          - Sid: AllowCloudFront
            Effect: Allow
            Principal:
              Service: cloudfront.amazonaws.com
            Action: s3:GetObject
            Resource: !Sub '${StaticBucket.Arn}/*'
            Condition:
              StringEquals:
                AWS:SourceArn: !Sub 'arn:aws:cloudfront::${AWS::AccountId}:distribution/${Distribution}'

  # OAC
  OriginAccessControl:
    Type: AWS::CloudFront::OriginAccessControl
    Properties:
      OriginAccessControlConfig:
        Name: !Sub '${AWS::StackName}-oac'
        OriginAccessControlOriginType: s3
        SigningBehavior: always
        SigningProtocol: sigv4

  # Cache Policy (static content)
  StaticCachePolicy:
    Type: AWS::CloudFront::CachePolicy
    Properties:
      CachePolicyConfig:
        Name: !Sub '${AWS::StackName}-static-cache'
        DefaultTTL: 86400
        MaxTTL: 31536000
        MinTTL: 0
        ParametersInCacheKeyAndForwardedToOrigin:
          EnableAcceptEncodingGzip: true
          EnableAcceptEncodingBrotli: true
          CookiesConfig:
            CookieBehavior: none
          HeadersConfig:
            HeaderBehavior: none
          QueryStringsConfig:
            QueryStringBehavior: whitelist
            QueryStrings:
              - v
              - ver

  # Response Headers Policy
  SecurityHeadersPolicy:
    Type: AWS::CloudFront::ResponseHeadersPolicy
    Properties:
      ResponseHeadersPolicyConfig:
        Name: !Sub '${AWS::StackName}-security-headers'
        SecurityHeadersConfig:
          StrictTransportSecurity:
            AccessControlMaxAgeSec: 31536000
            IncludeSubdomains: true
            Override: true
            Preload: true
          ContentTypeOptions:
            Override: true
          FrameOptions:
            FrameOption: DENY
            Override: true
          ReferrerPolicy:
            ReferrerPolicy: strict-origin-when-cross-origin
            Override: true

  # CloudFront Function (SPA URL rewrite)
  SpaRewriteFunction:
    Type: AWS::CloudFront::Function
    Properties:
      Name: !Sub '${AWS::StackName}-spa-rewrite'
      AutoPublish: true
      FunctionConfig:
        Comment: SPA URL rewrite for single page application
        Runtime: cloudfront-js-2.0
      FunctionCode: |
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          if (!uri.includes('.')) {
            request.uri = '/index.html';
          }
          return request;
        }

  # Distribution
  Distribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        DefaultRootObject: index.html
        PriceClass: PriceClass_200
        HttpVersion: http2and3
        Comment: !Sub '${AWS::StackName} production distribution'
        Aliases:
          - !Ref DomainName
        ViewerCertificate:
          AcmCertificateArn: !Ref CertificateArn
          SslSupportMethod: sni-only
          MinimumProtocolVersion: TLSv1.2_2021
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt StaticBucket.RegionalDomainName
            OriginAccessControlId: !Ref OriginAccessControl
            S3OriginConfig:
              OriginAccessIdentity: ''
          - Id: AlbOrigin
            DomainName: !Ref AlbDomainName
            CustomOriginConfig:
              HTTPSPort: 443
              OriginProtocolPolicy: https-only
              OriginSSLProtocols:
                - TLSv1.2
            OriginCustomHeaders:
              - HeaderName: X-Origin-Verify
                HeaderValue: !Sub '{{resolve:secretsmanager:${AWS::StackName}/origin-verify:SecretString:token}}'
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: !Ref StaticCachePolicy
          ResponseHeadersPolicyId: !Ref SecurityHeadersPolicy
          Compress: true
          FunctionAssociations:
            - EventType: viewer-request
              FunctionARN: !GetAtt SpaRewriteFunction.FunctionMetadata.FunctionARN
        CacheBehaviors:
          - PathPattern: /api/*
            TargetOriginId: AlbOrigin
            ViewerProtocolPolicy: https-only
            CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
            OriginRequestPolicyId: 216adef6-5c7f-47e4-b989-5492eafa07d3
            AllowedMethods:
              - GET
              - HEAD
              - OPTIONS
              - PUT
              - POST
              - PATCH
              - DELETE
            Compress: true
          - PathPattern: /static/*
            TargetOriginId: S3Origin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6
            Compress: true
        CustomErrorResponses:
          - ErrorCode: 403
            ResponseCode: 200
            ResponsePagePath: /index.html
            ErrorCachingMinTTL: 10
          - ErrorCode: 404
            ResponseCode: 200
            ResponsePagePath: /index.html
            ErrorCachingMinTTL: 10

  # Route 53 Record
  DnsRecord:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneId: !Ref HostedZoneId
      Name: !Ref DomainName
      Type: A
      AliasTarget:
        DNSName: !GetAtt Distribution.DomainName
        HostedZoneId: Z2FDTNDATAQYW2  # CloudFront global hosted zone ID

Outputs:
  DistributionId:
    Value: !Ref Distribution
  DistributionDomainName:
    Value: !GetAtt Distribution.DomainName
  BucketName:
    Value: !Ref StaticBucket
```

### 9.2 Building with CDK (TypeScript)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface CloudFrontStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneId: string;
  zoneName: string;
  albArn: string;
}

export class CloudFrontStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);

    // S3 Bucket
    const bucket = new s3.Bucket(this, 'StaticBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ACM Certificate (us-east-1 required)
    const certificate = acm.Certificate.fromCertificateArn(
      this, 'Cert',
      `arn:aws:acm:us-east-1:${this.account}:certificate/xxx`
    );

    // ALB Reference
    const alb = elbv2.ApplicationLoadBalancer.fromLookup(this, 'ALB', {
      loadBalancerArn: props.albArn,
    });

    // CloudFront Function (SPA rewrite)
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          if (!request.uri.includes('.')) {
            request.uri = '/index.html';
          }
          return request;
        }
      `),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // Response Headers Policy
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    // Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy,
        functionAssociations: [{
          function: spaRewrite,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.LoadBalancerV2Origin(alb, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: {
              'X-Origin-Verify': 'my-secret-value',
            },
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      domainNames: [props.domainName],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      errorResponses: [
        { httpStatus: 403, responsePagePath: '/index.html', responseHttpStatus: 200, ttl: cdk.Duration.seconds(10) },
        { httpStatus: 404, responsePagePath: '/index.html', responseHttpStatus: 200, ttl: cdk.Duration.seconds(10) },
      ],
    });

    // Route 53 Record
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // Outputs
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
```

---

## 10. Monitoring and Troubleshooting

### 10.1 CloudWatch Metrics

```bash
# Get request count
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=EXXXXXXXXXX Name=Region,Value=Global \
  --start-time "$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 3600 \
  --statistics Sum

# Key metrics list
# Requests:         Total request count
# BytesDownloaded:  Downloaded bytes
# BytesUploaded:    Uploaded bytes
# TotalErrorRate:   Total error rate
# 4xxErrorRate:     4xx error rate
# 5xxErrorRate:     5xx error rate
# CacheHitRate:     Cache hit rate
# OriginLatency:    Origin latency

# Set up a CloudWatch alarm (5xx error rate)
aws cloudwatch put-metric-alarm \
  --alarm-name "CloudFront-5xx-Error-Rate" \
  --metric-name 5xxErrorRate \
  --namespace AWS/CloudFront \
  --dimensions Name=DistributionId,Value=EXXXXXXXXXX Name=Region,Value=Global \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions "arn:aws:sns:us-east-1:123456789012:alerts"
```

### 10.2 CloudFront Log Analysis

```bash
# Enable standard logs (S3 delivery)
aws cloudfront update-distribution --id EXXXXXXXXXX \
  --distribution-config '{
    ...
    "Logging": {
      "Enabled": true,
      "IncludeCookies": false,
      "Bucket": "my-cf-logs.s3.amazonaws.com",
      "Prefix": "production/"
    }
  }'

# Set up real-time logs (Kinesis Data Streams integration)
aws cloudfront create-realtime-log-config \
  --name production-realtime-logs \
  --sampling-rate 100 \
  --fields '["timestamp","c-ip","sc-status","cs-method","cs-uri-stem","cs-bytes","time-taken","x-edge-result-type","x-edge-response-result-type"]' \
  --end-points '[{
    "StreamType": "Kinesis",
    "KinesisStreamConfig": {
      "RoleARN": "arn:aws:iam::123456789012:role/cloudfront-realtime-log-role",
      "StreamARN": "arn:aws:kinesis:us-east-1:123456789012:stream/cf-realtime-logs"
    }
  }]'

# Analyze standard logs with Athena
# Create table
# CREATE EXTERNAL TABLE cloudfront_logs (
#   `date` date, time string, x_edge_location string,
#   sc_bytes bigint, c_ip string, cs_method string,
#   cs_host string, cs_uri_stem string, sc_status int,
#   cs_referer string, cs_user_agent string, cs_uri_query string,
#   cs_cookie string, x_edge_result_type string,
#   x_edge_request_id string, x_host_header string,
#   cs_protocol string, cs_bytes bigint, time_taken float,
#   x_forwarded_for string, ssl_protocol string,
#   ssl_cipher string, x_edge_response_result_type string,
#   cs_protocol_version string, fle_status string,
#   fle_encrypted_fields int, c_port int,
#   time_to_first_byte float, x_edge_detailed_result_type string,
#   sc_content_type string, sc_content_len bigint,
#   sc_range_start bigint, sc_range_end bigint
# )
# ROW FORMAT DELIMITED FIELDS TERMINATED BY '\t'
# LOCATION 's3://my-cf-logs/production/'
# TBLPROPERTIES ('skip.header.line.count'='2');

# Aggregate top 404 paths
# SELECT cs_uri_stem, COUNT(*) as cnt
# FROM cloudfront_logs
# WHERE sc_status = 404
# GROUP BY cs_uri_stem
# ORDER BY cnt DESC LIMIT 20;
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Caching API Responses for Long Periods

Caching dynamic API responses with a long TTL causes stale data to be returned to users. APIs should use cache disabled (`CachingDisabled`) or a short TTL.

```
# Bad example
/api/* -> CachingOptimized (TTL: 24 hours)
-> User information remains stale for 24 hours

# Good example
/api/* -> CachingDisabled (no cache)
/static/* -> CachingOptimized (TTL: 24 hours)
/api/public/* -> Custom policy (TTL: 5 seconds)  <- Short TTL for public APIs
```

### Anti-Pattern 2: Continuing to Use OAI (Legacy) in New Configurations

OAI does not support SSE-KMS encrypted buckets, is based on SigV2, and is expected to be deprecated in the future. Always use OAC for new configurations.

### Anti-Pattern 3: Frequent Use of Invalidation

```
# Bad example
Invalidate /* with every deployment
-> Charges apply beyond 1,000 paths per month
-> Propagation to all Edge Locations takes several minutes

# Good example
Include content hashes in file names
app.abc123.js, styles.def456.css
-> Cache naturally updates as file names change
-> Set only a short TTL for index.html
```

### Anti-Pattern 4: Including Unnecessary Elements in Cache Keys

```
# Bad example
Include all headers and query strings in the cache key
-> Cache misses due to minor header differences (lower hit rate)
-> Same content cached under different keys

# Good example
Set minimal cache keys
- Static content: No headers, no cookies, no query strings
- API: Authorization header + all query strings
```

### Anti-Pattern 5: Not Configuring Custom Error Pages

```
# Bad example
Accessing a non-existent path on an S3 origin
-> XML 403 Forbidden error is displayed
-> Poor user experience

# Good example
Map 403/404 to /index.html (200) with CustomErrorResponses
-> SPA handles routing on the client side
-> Display a custom 404 page
```

---

## 12. FAQ

### Q1. What is CloudFront's pricing structure?

Charges are primarily based on (1) data transfer volume (per GB), (2) number of HTTP/HTTPS requests, and (3) Lambda@Edge / CloudFront Functions invocations. Restricting the price class (e.g., PriceClass_100) excludes Edge Locations in some regions to reduce costs. Shield Standard (DDoS protection) is included at no charge.

### Q2. What is the cost of cache invalidation?

Free up to 1,000 paths per month, then $0.005 per path. `/*` counts as 1 path. If frequent invalidation is needed, including version strings in file names (e.g., `app.abc123.js`) is more efficient.

### Q3. What should I be aware of when serving an SPA (React / Vue) with CloudFront?

Use CloudFront Functions for URL rewriting to fall back paths without extensions (`/about`, `/users/123`) to `/index.html`. You can also redirect 403/404 to `index.html` using custom error pages, but CloudFront Functions offer more flexibility. Enabling HTTP/2 and Brotli compression significantly improves performance.

### Q4. What is the difference between CloudFront and S3 static website hosting?

S3 static website hosting supports only HTTP, not HTTPS. CloudFront is required for HTTPS with custom domains. CloudFront provides many features including HTTPS, HTTP/2, HTTP/3, Brotli compression, geo-restrictions, and WAF integration. In terms of cost, S3 access via CloudFront has free data transfer charges, which can be cheaper than serving directly from S3.

### Q5. How do I enable HTTP/3 (QUIC) on CloudFront?

Simply set `HttpVersion` to `http2and3` in the distribution settings to enable it. HTTP/3 is automatically used when the client supports it, falling back to HTTP/2 for unsupported clients.

```bash
# Enable HTTP/3
# Set HttpVersion when creating/updating the distribution
aws cloudfront update-distribution --id EXXXXXXXXXX \
  --distribution-config '{
    ...
    "HttpVersion": "http2and3"
  }'
```

### Q6. How can I verify that CloudFront caching is working?

```bash
# Check response headers with curl
curl -I https://www.example.com/index.html

# Headers to check:
# X-Cache: Hit from cloudfront  -> Cache hit
# X-Cache: Miss from cloudfront -> Cache miss
# X-Cache: RefreshHit from cloudfront -> Re-fetch after TTL expiry
# Age: 3600 -> Seconds since cached
# X-Amz-Cf-Pop: NRT52-C4 -> Edge Location identifier
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in daily development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Item | Key Point |
|------|---------|
| Edge Location | 400+ locations, delivering content from the closest point to the user |
| Origin | Multi-origin configuration with S3 (static) + ALB (dynamic) is common |
| Failover | Automatic Primary/Secondary switching with Origin Groups |
| Cache | Static=long TTL, dynamic=no cache, versioned file names recommended |
| Lambda@Edge | Edge processing for authentication, A/B testing, image resizing, etc. |
| CloudFront Functions | URL rewriting, header manipulation (lightweight and inexpensive) |
| OAC | Secure access to S3 origins (preferred over OAI) |
| Security | Response headers policy + WAF integration + signed URLs/Cookies |
| Monitoring | CloudWatch metrics + standard logs + real-time logs |
| IaC | Declarative management with CloudFormation / CDK |

---

## Recommended Next Guides

- [../03-database/00-rds-basics.md](../03-database/00-rds-basics.md) — RDS Basics
- [../04-networking/01-route53.md](../04-networking/01-route53.md) — Route 53 DNS Configuration

---

## References

1. Amazon CloudFront Developer Guide — https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/
2. CloudFront Cache Policies — https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html
3. Lambda@Edge Developer Guide — https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html
4. OAC User Guide — https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
5. CloudFront Functions Developer Guide — https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html
6. CloudFront Signed URLs — https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html
7. AWS WAF and CloudFront Integration — https://docs.aws.amazon.com/waf/latest/developerguide/cloudfront-features.html
