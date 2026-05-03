# Versioning Strategy

> API versioning is a collection of technical decisions that pursue the balance between backward compatibility and evolution. Deeply understand the definition of breaking changes, URI/header/query parameter-based strategies, semantic versioning, and the deprecation process to design APIs that withstand long-term operation.

## What You Will Learn in This Chapter

- [ ] Clearly distinguish between breaking changes and non-breaking changes
- [ ] Understand the characteristics and selection criteria for the three versioning approaches (URI, header, query parameter)
- [ ] Understand how to apply semantic versioning principles to APIs
- [ ] Be able to design and execute deprecation and migration processes
- [ ] Acquire the philosophy and practical techniques of versionless design
- [ ] Develop a strategic approach to minimizing the impact of breaking changes

## Prerequisites

- The concept of API First design → See: [API First Design](./00-api-first-design.md)
- Basics of API naming conventions → See: [Naming Conventions and Standards](./01-naming-and-conventions.md)
- Basic knowledge of Semantic Versioning (SemVer)

---

## 1. Why API Versioning Is Necessary

Software is constantly evolving. Reasons to change an API never run out — changing business requirements, resolving technical debt, addressing security concerns, and more. However, an API is a "contract" between a provider and a consumer, and unilateral changes can break the entire system.

```
The fundamental problem API versioning solves:

  Problem:
  ┌──────────────┐     Contract (API spec)     ┌──────────────┐
  │  API Provider │◄──────────────────────────►│  API Consumer │
  │  (Server)    │                             │  (Client)    │
  └──────────────┘                             └──────────────┘
       │                                             │
       │ Wants to change the spec                    │ Wants to maintain existing behavior
       │ (add features/fix/improve)                  │ (stable operation is top priority)
       │                                             │
       └─────────── Conflict of interests ───────────┘

  Solution: Versioning
  ┌──────────────┐     v1 (old contract)        ┌──────────────┐
  │  API Provider │◄──────────────────────────►│  Old Client   │
  │              │     v2 (new contract)        ┌──────────────┐
  │              │◄──────────────────────────►│  New Client   │
  └──────────────┘                             └──────────────┘
```

### 1.1 Risks Without Versioning

The following table organizes the problems that can occur when versioning is not in place.

| Risk Category | Concrete Example | Impact Level |
|-----------|--------|--------|
| Feature breakage | Client parsing fails due to field name changes | Critical |
| Data loss | Data mapping becomes inaccurate due to response structure changes | Severe |
| Loss of trust | Partner companies lose confidence due to spec changes without notice | Long-term |
| Operational cost | Frequent emergency rollbacks and hotfixes | Medium–High |
| Legal risk | Contractual issues due to SLA violations | Context-dependent |

### 1.2 Timing for Introducing Versioning

It is preferable to decide on a versioning strategy at the point when the API is published. Adding versioning after the fact is effectively causing "the first breaking change."

```
Recommended timing:

  ✓ API design phase         → Decide the versioning approach
  ✓ Initial release (GA)     → Release as v1
  ✓ When a breaking change is needed → Release v2 and run v1 and v2 in parallel
  ✗ Internal-only API stage  → Strict versioning may be excessive
  ✗ Prototype/alpha stage    → Frequent breaking changes are acceptable
```

---

## 2. Defining and Classifying Breaking Changes

### 2.1 Three Categories of Changes

API changes are classified into three categories based on the degree of impact on clients.

```
Classification matrix:

  Impact
  High │  ┌─────────────────────────────────────┐
       │  │  Breaking Changes                    │
       │  │  Version bump required               │
       │  │  e.g.: field deletion, type changes  │
       │  └─────────────────────────────────────┘
  Med  │  ┌─────────────────────────────────────┐
       │  │  Gray Area                           │
       │  │  Depends on client implementation    │
       │  │  e.g.: default value changes, order  │
       │  └─────────────────────────────────────┘
  Low  │  ┌─────────────────────────────────────┐
       │  │  Non-Breaking Changes                │
       │  │  No version bump required            │
       │  │  e.g.: adding fields, new endpoints  │
       │  └─────────────────────────────────────┘
       └──────────────────────────────────────────
```

### 2.2 Non-Breaking Changes (No Version Bump Required)

The following changes do not break client behavior and can be applied without a version bump.

```
Detailed list of non-breaking changes:

  Response-related:
    ✓ Adding fields to the response
    ✓ Adding response headers
    ✓ Improving error message wording (when the code does not change)
    ✓ Improving response speed

  Request-related:
    ✓ Adding optional request parameters
    ✓ Adding optional request headers

  Endpoint-related:
    ✓ Adding new endpoints
    ✓ Adding support for new HTTP methods
    ✓ Adding new resource types

  Documentation-related:
    ✓ Improving API documentation
    ✓ Adding usage examples

  Preconditions:
    → Clients must follow the "Robustness Principle" and
      implement behavior that ignores unknown fields
    → "Be conservative in what you send, be liberal in what you accept"
      (Postel's Law / RFC 761)
```

### 2.3 Breaking Changes (Version Bump Required)

The following changes are likely to break client behavior and should be released as a new version.

```python
# Code example 1: Concrete examples of breaking changes

# === Field deletion ===
# v1 response
{
    "user": {
        "id": 123,
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "555-1234-5678"    # deleted in v2 → breaking
    }
}

# v2 response (phone field is gone)
{
    "user": {
        "id": 123,
        "name": "John Doe",
        "email": "john@example.com"
        # phone does not exist → user.phone becomes null/undefined on the client
    }
}

# === Type change ===
# v1: id is integer
{"id": 123, "name": "John Doe"}

# v2: id is string (breaking change)
{"id": "usr_123", "name": "John Doe"}
# → failure occurs if client processes id as a number

# === Adding a required parameter ===
# v1: POST /api/v1/users
# Body: {"name": "John Doe"}  ← name alone is OK

# v2: POST /api/v2/users
# Body: {"name": "John Doe", "email": "john@example.com"}
# ← email is now required → old client requests return 400 errors

# === Endpoint changes ===
# v1: GET /api/v1/users/{id}/orders
# v2: GET /api/v2/customers/{id}/purchases  ← both path and resource name changed
```

### 2.4 Gray Area Changes

A group of changes that depends on the quality of client implementations. To be conservative, treating them as breaking changes is the safer approach.

```python
# Code example 2: Concrete examples of gray area changes and judgment criteria

# === Default value changes ===
# v1: GET /api/v1/users → default sort order is created_at ASC
# v2: GET /api/v1/users → default sort order is updated_at DESC
# Judgment: breaking if client depends on the default sort order

# === Pagination default size change ===
# v1: default 100 items per page
# v2: default 20 items per page
# Judgment: breaking for clients that assume all items are returned at once

# === Response field order change ===
# v1: {"id": 1, "name": "foo", "email": "bar"}
# v2: {"name": "foo", "email": "bar", "id": 1}
# Judgment: JSON spec says order is undefined, but affects position-based parsers

# === Adding error codes ===
# v1: authentication errors always return 401
# v2: authentication errors split into 401 (no auth) and 403 (insufficient permission)
# Judgment: impacts clients handling only 401

# === Nullability changes ===
# v1: "address" field is always an object
# v2: "address" field can be null
# Judgment: NullPointerException etc. in clients without null checks

# === Decision flowchart ===
# 1. Does the client require a code change?
#    → Yes: treat as breaking change
#    → No:  proceed to next check
# 2. Does the client behavior change?
#    → Yes: gray area (judge conservatively)
#    → No:  non-breaking change
# 3. What proportion of clients is affected?
#    → Many: treat as breaking change
#    → Few: judge case by case
```

### 2.5 Breaking Change Impact Analysis Template

When considering a breaking change, it is recommended to pre-analyze the impact using the following template.

| Analysis Item | Content |
|---------|------|
| Change content | What specifically is being changed |
| Reason for change | Why this change is necessary |
| Scope of impact | List of affected endpoints |
| Client impact | Which clients are affected |
| Migration cost | Effort required for modifications on the client side |
| Alternatives | Can the same goal be achieved in a non-breaking way |
| Rollback plan | Recovery procedure in case of problems |
| Schedule | Timeline from announcement → parallel operation → old version retirement |

---

## 3. Detailed Comparison of Versioning Approaches

There are three major API versioning approaches and several variants. Each approach is explained in detail with implementation examples.

### 3.1 URI Path Versioning

The most widely adopted versioning approach. The version number is included in the URL path.

```
URI path versioning patterns:

  Standard pattern:
    https://api.example.com/v1/users
    https://api.example.com/v2/users

  Subdomain pattern:
    https://v1.api.example.com/users
    https://v2.api.example.com/users

  Path prefix pattern:
    https://api.example.com/api/v1/users
    https://api.example.com/api/v2/users

  Request flow:
  ┌──────────┐    GET /v1/users    ┌───────────┐    route    ┌───────────┐
  │  Client   │──────────────────►│  API      │──────────►│ v1 handler │
  └──────────┘                    │  Gateway  │           └───────────┘
                                  │           │
  ┌──────────┐    GET /v2/users    │           │    route    ┌───────────┐
  │  Client   │──────────────────►│           │──────────►│ v2 handler │
  └──────────┘                    └───────────┘           └───────────┘
```

```python
# Code example 3: URI path versioning implementation (Python / Flask)

from flask import Flask, jsonify, request
from functools import wraps

app = Flask(__name__)

# --- Basic version routing implementation ---

# v1: User resource
@app.route('/api/v1/users', methods=['GET'])
def get_users_v1():
    """v1 returns simple user information"""
    users = fetch_users_from_db()
    return jsonify({
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email
            }
            for u in users
        ]
    })

# v2: User resource (extended)
@app.route('/api/v2/users', methods=['GET'])
def get_users_v2():
    """v2 returns a response with pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    pagination = fetch_users_paginated(page, per_page)

    return jsonify({
        "data": [
            {
                "id": u.id,
                "full_name": u.name,        # name → full_name renamed
                "email": u.email,
                "profile": {                  # nested structure added in v2
                    "avatar_url": u.avatar_url,
                    "bio": u.bio,
                    "created_at": u.created_at.isoformat()
                }
            }
            for u in pagination.items
        ],
        "pagination": {                       # meta information added in v2
            "current_page": pagination.page,
            "total_pages": pagination.pages,
            "total_items": pagination.total,
            "per_page": pagination.per_page
        }
    })

# --- Version separation using Blueprint (recommended pattern) ---

from flask import Blueprint

# Create a Blueprint per version
v1_bp = Blueprint('v1', __name__, url_prefix='/api/v1')
v2_bp = Blueprint('v2', __name__, url_prefix='/api/v2')

@v1_bp.route('/users', methods=['GET'])
def v1_get_users():
    return jsonify({"version": "v1", "users": []})

@v2_bp.route('/users', methods=['GET'])
def v2_get_users():
    return jsonify({"version": "v2", "data": [], "pagination": {}})

# Register with the application
app.register_blueprint(v1_bp)
app.register_blueprint(v2_bp)

# --- Version deprecation middleware ---

DEPRECATED_VERSIONS = {'v1'}
SUNSET_DATES = {'v1': 'Sat, 01 Jan 2026 00:00:00 GMT'}

@app.before_request
def add_deprecation_headers():
    """Add a warning header to requests for deprecated versions"""
    path = request.path
    for version in DEPRECATED_VERSIONS:
        if f'/api/{version}/' in path:
            # RFC 8594 Sunset Header
            from flask import g
            g.deprecated_version = version

@app.after_request
def inject_sunset_header(response):
    """Insert Sunset header into response"""
    from flask import g
    version = getattr(g, 'deprecated_version', None)
    if version:
        response.headers['Deprecation'] = 'true'
        response.headers['Sunset'] = SUNSET_DATES.get(version, '')
        response.headers['Link'] = (
            f'<https://api.example.com/api/v2/docs>; '
            f'rel="successor-version"'
        )
    return response
```

### 3.2 Header Versioning

An approach that specifies the version using HTTP headers. It leverages content negotiation, which is a REST principle.

```
Variations of header versioning:

  ① Accept header (media type):
    Accept: application/vnd.example.v1+json
    Accept: application/vnd.example.v2+json

  ② Custom header:
    X-API-Version: 1
    X-API-Version: 2

  ③ Accept header (with parameter):
    Accept: application/json; version=1
    Accept: application/json; version=2

  Request flow:
  ┌──────────┐   GET /users              ┌───────────┐
  │  Client   │  Accept: ...vnd.v1+json  │           │   ┌───────────┐
  │          │──────────────────────────►│  API      │──►│ v1        │
  └──────────┘                          │  Gateway  │   │ Serializer │
                                        │           │   └───────────┘
  ┌──────────┐   GET /users              │ (branch   │
  │  Client   │  Accept: ...vnd.v2+json  │  by       │   ┌───────────┐
  │          │──────────────────────────►│  header)  │──►│ v2        │
  └──────────┘                          └───────────┘   │ Serializer │
                                                        └───────────┘

  Note: URL is the same for all versions (/users)
```

```python
# Code example 4: Header versioning implementation (Python / Flask)

from flask import Flask, jsonify, request, abort
from functools import wraps

app = Flask(__name__)

# --- Media type parser ---

def parse_api_version(accept_header: str) -> int:
    """
    Extract version from Accept header.

    Supported formats:
      - application/vnd.example.v1+json → 1
      - application/vnd.example.v2+json → 2
      - application/json; version=1     → 1
      - application/json                → default (latest stable)
    """
    if not accept_header:
        return get_default_version()

    # Parse vnd format
    import re
    vnd_match = re.search(
        r'application/vnd\.example\.v(\d+)\+json',
        accept_header
    )
    if vnd_match:
        return int(vnd_match.group(1))

    # Parse parameter format
    param_match = re.search(
        r'application/json;\s*version=(\d+)',
        accept_header
    )
    if param_match:
        return int(param_match.group(1))

    return get_default_version()

def get_default_version() -> int:
    """Returns the default version when no version is specified"""
    return 2  # latest stable version

# --- Version decorator ---

def api_version(version: int):
    """Decorator that makes an endpoint accessible only for the specified version"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            requested_version = parse_api_version(
                request.headers.get('Accept', '')
            )
            if requested_version != version:
                return None  # not this handler

            response = f(*args, **kwargs)

            # Include version information in Content-Type
            if hasattr(response, 'headers'):
                response.headers['Content-Type'] = (
                    f'application/vnd.example.v{version}+json'
                )
            return response
        return wrapper
    return decorator

# --- Multi-version dispatcher ---

class VersionedEndpoint:
    """Dispatcher that manages handlers for multiple versions"""

    def __init__(self):
        self.handlers = {}

    def version(self, v: int):
        """Decorator to register a handler for each version"""
        def decorator(f):
            self.handlers[v] = f
            return f
        return decorator

    def dispatch(self):
        """Call the appropriate handler based on the request version"""
        requested_version = parse_api_version(
            request.headers.get('Accept', '')
        )
        handler = self.handlers.get(requested_version)
        if handler is None:
            abort(406, description=(
                f"API version {requested_version} is not supported. "
                f"Supported versions: {list(self.handlers.keys())}"
            ))
        return handler()

# Usage example
users_endpoint = VersionedEndpoint()

@users_endpoint.version(1)
def get_users_v1():
    return jsonify({"users": [{"id": 1, "name": "John Doe"}]})

@users_endpoint.version(2)
def get_users_v2():
    return jsonify({
        "data": [{"id": 1, "full_name": "John Doe", "profile": {}}],
        "pagination": {"page": 1, "total": 1}
    })

@app.route('/api/users', methods=['GET'])
def users():
    return users_endpoint.dispatch()
```

### 3.3 Query Parameter Versioning

An approach that specifies the version using URL query parameters.

```
Query parameter versioning patterns:

  Basic form:
    GET /api/users?version=1
    GET /api/users?version=2
    GET /api/users?v=2

  Request flow:
  ┌──────────┐  GET /users?version=1   ┌───────────┐   ┌──────────┐
  │  Client   │─────────────────────►│  Router    │──►│ v1 logic  │
  └──────────┘                        │           │   └──────────┘
                                      │ parse     │
  ┌──────────┐  GET /users?version=2   │ ?version  │   ┌──────────┐
  │  Client   │─────────────────────►│           │──►│ v2 logic  │
  └──────────┘                        └───────────┘   └──────────┘

  Behavior when omitted (3 patterns):
    A) Default to latest  → GET /users → returns v2
    B) Default to oldest  → GET /users → returns v1 (safer)
    C) Return error       → GET /users → 400 Bad Request

    Recommendation: Pattern A (default to latest stable version)
```

### 3.4 Comprehensive Comparison of Three Approaches

| Comparison Item | URI Path | Header | Query Parameter |
|---------|---------|---------|---------------|
| Readability | Very high | Low | High |
| Browser testing | Easy | Difficult (requires curl, etc.) | Easy |
| Caching | Naturally separated by version | Vary header required | Key including parameter required |
| CDN routing | Easy | CDN-dependent | Possible but complex setup |
| REST compliance | Slight violation (multiple URIs for same resource) | Compliant (content negotiation) | Slight violation |
| Hypermedia | Version included in links | Links are version-independent | Parameters mixed into links |
| Ease of implementation | Very easy | Somewhat complex | Easy |
| API Gateway support | All gateways | Major gateways | All gateways |
| Major adopters | GitHub, Twitter, Google | Stripe (custom header) | Amazon, Netflix (partial) |
| Recommendation | High (most common) | Medium–High (pure REST) | Medium (easy but trending away) |

### 3.5 Hybrid Approach

In actual production, combinations of multiple approaches are sometimes used.

```
Hybrid examples:

  ① Combined URI + header:
    → Major version managed by URI: /api/v1/, /api/v2/
    → Minor version managed by header: X-API-Minor-Version: 3
    → Use case: APIs where major changes are rare but minor improvements are frequent

  ② Combined URI + date-based:
    → Major version by URI: /api/v2/
    → Date version by header: API-Version: 2024-01-15
    → Use case: Fine-grained version management in the Stripe style

  ③ Version integration at API Gateway:
    ┌─────────────────────────────────────────┐
    │              API Gateway                 │
    │                                          │
    │  /v1/* ─────────────► Backend v1         │
    │  /v2/* ─────────────► Backend v2         │
    │  Accept:vnd.v3+json ► Backend v3 (beta)  │
    │                                          │
    │  Rule: prioritize URI version,           │
    │        otherwise check header            │
    └─────────────────────────────────────────┘
```

---

## 4. Semantic Versioning and API Versions

### 4.1 Basics of Semantic Versioning (SemVer)

Semantic Versioning (SemVer) is a system of rules that gives meaning to version numbers.

```
SemVer format: MAJOR.MINOR.PATCH

  MAJOR: Backward-incompatible changes
    1.0.0 → 2.0.0
    e.g.: field deletion, type changes, endpoint redesign

  MINOR: Backward-compatible feature additions
    1.0.0 → 1.1.0
    e.g.: adding new endpoints, adding optional parameters

  PATCH: Backward-compatible bug fixes
    1.0.0 → 1.0.1
    e.g.: response bug fixes, documentation fixes

  Pre-release:
    2.0.0-alpha.1  → alpha version
    2.0.0-beta.1   → beta version
    2.0.0-rc.1     → release candidate

  Version number comparison order:
    1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-beta
    < 1.0.0-beta.2 < 1.0.0-rc.1 < 1.0.0
```

### 4.2 Mapping SemVer to API Versions

API URI versioning typically exposes only the major version publicly, but it is preferable to manage internally using SemVer.

```
Mapping strategy:

  Internal version    Public API version    URI path
  ─────────────────  ─────────────────    ──────────
  1.0.0              v1                    /api/v1/
  1.1.0              v1                    /api/v1/  (feature added)
  1.2.0              v1                    /api/v1/  (more features added)
  1.2.1              v1                    /api/v1/  (bug fix)
  2.0.0              v2                    /api/v2/  (breaking change)
  2.1.0              v2                    /api/v2/  (feature added)

  Key points:
  → URI version uses major version only
  → Minor/patch do not affect the URI
  → Internal version managed in CHANGELOG and documentation
  → Detailed version can be communicated via response header:
     X-API-Version: 2.1.0
```

### 4.3 CHANGELOG Management

```markdown
# Code example 5: CHANGELOG.md structure example

# Changelog

All notable changes to the Example API will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2025-06-15

### Added
- Added `GET /api/v2/users/{id}/preferences` endpoint
- Added `timezone` field (optional) to user response
- Added support for batch retrieval `POST /api/v2/users/batch`

### Changed
- Changed default page size for `GET /api/v2/users` from 50 to 20

### Deprecated
- `GET /api/v2/users/{id}/settings` is scheduled for removal in v2.3.0
  Alternative: `GET /api/v2/users/{id}/preferences`

## [2.0.0] - 2025-01-10 [BREAKING]

### Breaking Changes
- Renamed `name` field to `full_name` in user response
- Changed flat response of `GET /api/v1/users` to
  wrapper structure with `data` + `pagination`
- Changed authentication from API Key to OAuth 2.0

### Added
- Added user profile information (avatar_url, bio)
- Included pagination metadata in responses

### Migration Guide
- See the v1→v2 migration guide for details

## [1.2.1] - 2024-11-20

### Fixed
- Fixed 500 error returned when email address is null
  in `GET /api/v1/users`

## [1.2.0] - 2024-10-01

### Added
- Added user search support: `GET /api/v1/users?search=keyword`
- Added `created_at` field to response
```

---

## 5. Designing the Version Migration Process

### 5.1 Complete Deprecation Flow

Retiring an API version must proceed as a gradual and transparent process.

```
Deprecation timeline (standard plan):

  T-12mo    T-6mo     T-3mo     T-1mo     T (retirement date)
  ────────────────────────────────────────────────────────────►
  │         │         │         │          │
  │         │         │         │          └─ Return 410 Gone
  │         │         │         │             Include redirect info to successor
  │         │         │         │
  │         │         │         └─ Send final warning email
  │         │         │            Tighten rate limits
  │         │         │            Show warning in dashboard
  │         │         │
  │         │         └─ Start attaching Deprecation header
  │         │            Individual notification to major clients
  │         │            Publish migration guide
  │         │
  │         └─ New version GA release
  │            Start parallel operation
  │            Document deprecation explicitly
  │
  └─ New version beta release
     Start drafting migration plan
     Advance notice to partners

  Enterprise plan: Double the above period (24 months parallel operation)
```

### 5.2 Deprecation Notification via HTTP Headers

Use RFC 8594 (Sunset Header) and related headers to notify deprecation programmatically.

```http
HTTP/1.1 200 OK
Content-Type: application/json
Deprecation: true
Sunset: Sat, 01 Jul 2026 00:00:00 GMT
Link: <https://api.example.com/v2/docs>; rel="successor-version"
Link: <https://api.example.com/v1-to-v2-migration>; rel="deprecation"
X-API-Version: 1.2.1
X-API-Warn: "This API version is deprecated. Please migrate to v2."

{
  "data": { ... },
  "_deprecation_notice": {
    "message": "API v1 will be retired on July 1, 2026. Please migrate to v2.",
    "migration_guide": "https://api.example.com/v1-to-v2-migration",
    "sunset_date": "2026-07-01T00:00:00Z"
  }
}
```

### 5.3 Usage Monitoring

Continuously monitor usage of old versions and use the data as a basis for retirement decisions.

```
Monitoring dashboard (conceptual diagram):

  API v1 Usage
  ═══════════════════════════════════════════

  Daily request count:
  Jan ████████████████████████████████ 320K
  Feb ██████████████████████████████   300K
  Mar ████████████████████████         240K
  Apr ██████████████████               180K  ← migration guide published
  May ████████████                     120K
  Jun ████████                          80K  ← final warning
  Jul ███                               30K  ← scheduled retirement month

  Unique client count:
  Jan: 45 companies  → Jul: 3 companies (individually supported for migration)

  Metrics to monitor:
  - Request count (daily/weekly/monthly)
  - Unique client count
  - Changes in error rate
  - Changes in response time
  - Adoption rate of new version (v2)
```

### 5.4 Migration Guide Structure

A migration guide is the document that client developers refer to most, and it should include the following elements.

```
Required sections for a migration guide:

  1. Change summary overview
     → Briefly explain what changed and why

  2. Detailed list of changes
     → Document each field/endpoint change in table format

  3. Old-to-new mapping table
     → Clearly show which v1 fields correspond to which v2 fields

  4. Code examples (Before / After)
     → Migration code samples for major languages

  5. FAQ
     → Common questions and answers during migration

  6. Schedule
     → Retirement date, milestones

  7. Support information
     → Contact info, Slack channel, mailing list
```

### 5.5 Designing Old-to-New Field Mapping

The most important aspect of version migration is clearly defining the correspondence between old and new fields.

| v1 Field | v2 Field | Change Type | Notes |
|-------------|-------------|---------|------|
| `name` | `full_name` | Rename | Only field name changed, value is the same |
| `email` | `email` | No change | Can be migrated as-is |
| `id` (integer) | `id` (string) | Type change | Changed to include `"usr_"` prefix |
| `phone` | Removed | Deletion | Moved to `profile.phone_number` |
| (none) | `profile` | New addition | Nested object |
| (none) | `profile.avatar_url` | New addition | - |
| (none) | `profile.bio` | New addition | - |
| (none) | `profile.phone_number` | Moved | v1's `phone` was moved here |
| (none) | `profile.created_at` | New addition | ISO 8601 format |

---

## 6. Versionless Design (Evolvable API)

### 6.1 Philosophy of Versionless APIs

Versionless design is an approach to evolving an API without using explicit version numbers. The underlying idea is to "engineer the API design so that versioning is never needed."

```
Principles of versionless design:

  ┌──────────────────────────────────────────────────┐
  │         Four Pillars of a Versionless API         │
  │                                                  │
  │  ① Additive Changes Only                         │
  │     → Adding fields is allowed; deletion/change  │
  │       is prohibited                              │
  │                                                  │
  │  ② Robustness Principle                          │
  │     → Clients ignore unknown fields              │
  │                                                  │
  │  ③ Optional by Default                           │
  │     → New fields are always optional             │
  │                                                  │
  │  ④ Explicit Contract                             │
  │     → Clearly document what is guaranteed        │
  └──────────────────────────────────────────────────┘
```

### 6.2 Date-Based Versioning (Stripe Approach)

The date-based versioning adopted by Stripe is highly regarded as a hybrid of versionless and explicit versioning.

```python
# Code example 6: Conceptual implementation of date-based versioning

from datetime import date
from flask import Flask, jsonify, request

app = Flask(__name__)

# Version definitions: mapping of dates → changes
VERSION_CHANGES = {
    '2024-01-15': {
        'description': 'Initial GA release',
        'changes': []
    },
    '2024-06-01': {
        'description': 'Add profile field to user response',
        'changes': [
            {
                'type': 'field_added',
                'endpoint': '/users',
                'field': 'profile',
                'default': None
            }
        ]
    },
    '2025-01-10': {
        'description': 'Rename name to full_name',
        'changes': [
            {
                'type': 'field_renamed',
                'endpoint': '/users',
                'old_field': 'name',
                'new_field': 'full_name'
            }
        ]
    },
    '2025-06-15': {
        'description': 'Change id from integer to string',
        'changes': [
            {
                'type': 'field_type_changed',
                'endpoint': '/users',
                'field': 'id',
                'old_type': 'integer',
                'new_type': 'string',
                'transform': lambda v: f'usr_{v}'
            }
        ]
    }
}

SUPPORTED_VERSIONS = sorted(VERSION_CHANGES.keys())
DEFAULT_VERSION = SUPPORTED_VERSIONS[-1]  # latest

def get_requested_version() -> str:
    """Get the API version from the request"""
    # Check Stripe-Version header
    version = request.headers.get('Stripe-Version',
              request.headers.get('API-Version'))

    if version and version in VERSION_CHANGES:
        return version

    # Use the account's default version
    # (in actual Stripe, the version at account creation time is pinned)
    return DEFAULT_VERSION

def transform_response(data: dict, endpoint: str,
                       requested_version: str) -> dict:
    """
    Transform the response to match the requested version.
    Uses the latest data structure as the base, and applies
    transformations for older versions (rolling back).
    """
    result = data.copy()

    # Apply changes from newer versions in reverse order (rolling back)
    for version_date in reversed(SUPPORTED_VERSIONS):
        if version_date <= requested_version:
            break  # reached the requested version

        changes = VERSION_CHANGES[version_date]['changes']
        for change in changes:
            if change.get('endpoint') != endpoint:
                continue

            if change['type'] == 'field_renamed':
                # Roll back new name → old name
                new_field = change['new_field']
                old_field = change['old_field']
                if new_field in result:
                    result[old_field] = result.pop(new_field)

            elif change['type'] == 'field_added':
                # Remove added field
                field = change['field']
                result.pop(field, None)

            elif change['type'] == 'field_type_changed':
                # Roll back type change (string → integer)
                field = change['field']
                if field in result and isinstance(result[field], str):
                    result[field] = int(
                        result[field].replace('usr_', '')
                    )

    return result

@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """User retrieval using date-based versioning"""
    requested_version = get_requested_version()

    # Always use the latest data structure internally
    user_data = {
        'id': f'usr_{user_id}',
        'full_name': 'John Doe',
        'email': 'john@example.com',
        'profile': {
            'avatar_url': 'https://example.com/avatar.jpg',
            'bio': 'Software Engineer'
        }
    }

    # Transform to match the requested version
    response_data = transform_response(
        user_data, '/users', requested_version
    )

    response = jsonify(response_data)
    response.headers['API-Version'] = requested_version
    return response

# --- Usage examples ---
# Latest version (2025-06-15):
#   curl -H "API-Version: 2025-06-15" https://api.example.com/api/users/123
#   → {"id": "usr_123", "full_name": "John Doe", ...}

# Old version (2024-01-15):
#   curl -H "API-Version: 2024-01-15" https://api.example.com/api/users/123
#   → {"id": 123, "name": "John Doe", ...}  # returned in old structure
```

### 6.3 Versionlessness Through Field Selection

An approach similar to GraphQL where clients select the fields they need. Introducing field selection parameters in REST APIs can also reduce the impact of breaking changes.

```python
# Code example 7: Field selection implementation

from flask import Flask, jsonify, request

app = Flask(__name__)

def filter_fields(data: dict, fields: list) -> dict:
    """Build a response containing only the specified fields"""
    if not fields:
        return data  # return all fields if fields not specified

    result = {}
    for field in fields:
        # Support for nested fields using dot notation
        # e.g.: "profile.avatar_url"
        parts = field.split('.')
        source = data
        target = result
        for i, part in enumerate(parts):
            if i == len(parts) - 1:
                # Last part: copy value
                if part in source:
                    target[part] = source[part]
            else:
                # Intermediate part: build nested structure
                if part in source and isinstance(source[part], dict):
                    if part not in target:
                        target[part] = {}
                    source = source[part]
                    target = target[part]
                else:
                    break
    return result

@app.route('/api/users', methods=['GET'])
def get_users():
    """
    Usage examples for field selection parameter:
      GET /api/users?fields=id,full_name,email
      GET /api/users?fields=id,profile.avatar_url
    """
    fields_param = request.args.get('fields', '')
    fields = [f.strip() for f in fields_param.split(',')
              if f.strip()] if fields_param else []

    users = [
        {
            'id': 'usr_1',
            'full_name': 'John Doe',
            'email': 'john@example.com',
            'profile': {
                'avatar_url': 'https://example.com/avatar1.jpg',
                'bio': 'Engineer',
                'phone_number': '555-1234-5678'
            }
        },
        {
            'id': 'usr_2',
            'full_name': 'Jane Smith',
            'email': 'jane@example.com',
            'profile': {
                'avatar_url': 'https://example.com/avatar2.jpg',
                'bio': 'Designer',
                'phone_number': '555-9876-5432'
            }
        }
    ]

    filtered_users = [filter_fields(u, fields) for u in users]
    return jsonify({'data': filtered_users})

# --- Request examples and results ---

# All fields:
# GET /api/users
# → {"data": [{"id": "usr_1", "full_name": "...", ...}]}

# Selected fields:
# GET /api/users?fields=id,full_name
# → {"data": [{"id": "usr_1", "full_name": "John Doe"},
#              {"id": "usr_2", "full_name": "Jane Smith"}]}

# Nested fields:
# GET /api/users?fields=id,profile.avatar_url
# → {"data": [{"id": "usr_1", "profile": {"avatar_url": "..."}},
#              {"id": "usr_2", "profile": {"avatar_url": "..."}}]}
```

### 6.4 Gradual Rollout Using Feature Flags

A technique to gradually release features within the same version by controlling new functionality with feature flags.

```
Gradual rollout with Feature Flags:

  Phase 1: Internal Testing
  ┌──────────────────────────────────────────┐
  │ Feature: enhanced_user_profile           │
  │ Enabled: internal_testers only (0.1%)    │
  │ Status: Alpha                            │
  └──────────────────────────────────────────┘

  Phase 2: Beta Partners
  ┌──────────────────────────────────────────┐
  │ Feature: enhanced_user_profile           │
  │ Enabled: beta_partners + internal (5%)   │
  │ Status: Beta                             │
  └──────────────────────────────────────────┘

  Phase 3: Gradual Rollout
  ┌──────────────────────────────────────────┐
  │ Feature: enhanced_user_profile           │
  │ Enabled: 25% → 50% → 75% → 100%        │
  │ Status: GA                               │
  └──────────────────────────────────────────┘

  Phase 4: Default On
  ┌──────────────────────────────────────────┐
  │ Feature: enhanced_user_profile           │
  │ Enabled: 100% (default)                  │
  │ Status: Standard                         │
  └──────────────────────────────────────────┘

  Specifying flags in requests:
    GET /api/users?include=enhanced_profile
    GET /api/users?features=new_pagination,enhanced_profile
```

---

## 7. Version Management in API Gateways

### 7.1 Gateway Pattern

In large-scale API operations, the API gateway plays a central role in version routing.

```
Version routing at the API gateway:

  ┌─────────────┐
  │   Client    │
  └──────┬──────┘
         │
         ▼
  ┌──────────────────────────────────────────────────┐
  │              API Gateway (Kong / AWS API GW)      │
  │                                                    │
  │  ┌────────────────────────────────────────────┐   │
  │  │          Version Routing                   │   │
  │  │                                            │   │
  │  │  /v1/*  ──────────►  Backend Service v1    │   │
  │  │                      (legacy, maintenance) │   │
  │  │                                            │   │
  │  │  /v2/*  ──────────►  Backend Service v2    │   │
  │  │                      (current, active)     │   │
  │  │                                            │   │
  │  │  /v3-beta/* ──────►  Backend Service v3    │   │
  │  │                      (preview, unstable)   │   │
  │  └────────────────────────────────────────────┘   │
  │                                                    │
  │  Additional features:                              │
  │  ├─ Rate limiting (configurable per version)       │
  │  ├─ Authentication / Authorization                 │
  │  ├─ Request / Response transformation              │
  │  ├─ Caching (per version)                          │
  │  ├─ Access logging (per version metrics)           │
  │  └─ Automatic attachment of deprecation headers    │
  └──────────────────────────────────────────────────┘
```

### 7.2 Request/Response Transformation Pattern

There is a pattern where the gateway transforms requests and responses so that the backend only implements the latest version, and the gateway layer absorbs compatibility with old versions.

```
Transformation pattern architecture:

  Client (v1)          API Gateway           Backend (v2 only)
  ─────────────        ──────────────         ──────────────────
       │                     │                       │
       │  GET /v1/users      │                       │
       │────────────────────►│                       │
       │                     │  Request transform     │
       │                     │  /v1/users → /v2/users│
       │                     │  Parameter mapping     │
       │                     │──────────────────────►│
       │                     │                       │
       │                     │◄──────────────────────│
       │                     │  v2 response           │
       │                     │                       │
       │                     │  Response transform    │
       │                     │  full_name → name      │
       │                     │  Remove profile        │
       │◄────────────────────│                       │
       │  v1 response        │                       │

  Advantages:
  ✓ Backend only needs to implement the latest version
  ✓ Maintenance cost of old versions is centralized in gateway config
  ✓ Backend code stays simple

  Disadvantages:
  ✗ Gateway transformation rules become complex
  ✗ Performance overhead from transformations
  ✗ Testing/debugging transformation rules is difficult
```

---

## 8. Versioning in Microservices

### 8.1 Versioning for Service-to-Service APIs

In microservice architectures, not only external-facing APIs but also internal APIs between services are subject to versioning.

```
Versioning considerations for microservice communication:

  ┌───────────┐     v2      ┌───────────┐     v1      ┌───────────┐
  │  Order     │────────────►│  User     │────────────►│  Billing  │
  │  Service   │             │  Service  │             │  Service  │
  │ (v2 dep.)  │             │ (v1,v2)   │             │ (v1)      │
  └───────────┘             └───────────┘             └───────────┘
       │                         │
       │ v1                      │ v1
       ▼                         ▼
  ┌───────────┐             ┌───────────┐
  │  Inventory │             │Notification│
  │  Service   │             │  Service   │
  │  (v1)      │             │  (v1)      │
  └───────────┘             └───────────┘

  Strategies:
  ① Consumer-Driven Contracts (CDC)
     → Each consumer defines expected contracts as tests
     → Provider verifies it satisfies all consumer contracts
     → Tools: Pact, Spring Cloud Contract

  ② Tolerant Reader pattern
     → Consumer reads only the fields it needs
     → Unknown fields are ignored
     → Resilient to additive changes in response structure

  ③ Schema Registry
     → Schemas such as Avro/Protobuf managed centrally in a registry
     → Automatic compatibility checking for schemas
     → Tools: Confluent Schema Registry
```

### 8.2 Versioning in Event-Driven Architectures

Versioning for asynchronous communication (events/messages) is also an important challenge.

```python
# Code example 8: Event schema versioning

import json
from datetime import datetime
from typing import Any

class VersionedEvent:
    """Base class for versioned events"""

    def __init__(self, event_type: str, version: int,
                 payload: dict):
        self.metadata = {
            'event_id': generate_uuid(),
            'event_type': event_type,
            'version': version,
            'timestamp': datetime.utcnow().isoformat(),
            'source': 'user-service'
        }
        self.payload = payload

    def to_dict(self) -> dict:
        return {
            'metadata': self.metadata,
            'payload': self.payload
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)


# --- Event definition: user created ---

class UserCreatedEventV1(VersionedEvent):
    """v1: Simple user created event"""

    def __init__(self, user_id: int, name: str, email: str):
        super().__init__(
            event_type='user.created',
            version=1,
            payload={
                'user_id': user_id,
                'name': name,
                'email': email
            }
        )


class UserCreatedEventV2(VersionedEvent):
    """v2: User created event including profile information"""

    def __init__(self, user_id: str, full_name: str,
                 email: str, profile: dict):
        super().__init__(
            event_type='user.created',
            version=2,
            payload={
                'user_id': user_id,      # changed to string type
                'full_name': full_name,   # name → full_name
                'email': email,
                'profile': profile        # newly added
            }
        )


# --- Event consumer: multi-version support ---

class UserEventConsumer:
    """Consumer that handles events of multiple versions"""

    def handle(self, event_json: str) -> None:
        event = json.loads(event_json)
        version = event['metadata']['version']
        payload = event['payload']

        handler = getattr(self, f'_handle_v{version}', None)
        if handler is None:
            # Unknown version: log and skip processing
            log_warning(
                f"Unknown event version: {version}, "
                f"event_type: {event['metadata']['event_type']}"
            )
            return

        handler(payload)

    def _handle_v1(self, payload: dict) -> None:
        """Process v1 event"""
        user_id = payload['user_id']
        name = payload['name']
        email = payload['email']
        # v1 processing logic
        create_user_record(user_id, name, email)

    def _handle_v2(self, payload: dict) -> None:
        """Process v2 event"""
        user_id = payload['user_id']
        full_name = payload['full_name']
        email = payload['email']
        profile = payload.get('profile', {})
        # v2 processing logic
        create_user_record_v2(user_id, full_name, email, profile)


# --- Upcasting pattern ---

class EventUpcaster:
    """Converts old version events to the latest version"""

    @staticmethod
    def upcast(event: dict) -> dict:
        version = event['metadata']['version']
        payload = event['payload']

        # Convert v1 → v2
        if version == 1:
            payload = {
                'user_id': str(payload['user_id']),
                'full_name': payload['name'],
                'email': payload['email'],
                'profile': {}  # fill with default value
            }
            event['metadata']['version'] = 2
            event['payload'] = payload

        return event
```

---

## 9. Test Strategy

### 9.1 Version Compatibility Testing

Design a test strategy to ensure that each version of the API works correctly.

```python
# Code example 9: Version compatibility test implementation (pytest)

import pytest
import json
from app import create_app

@pytest.fixture
def client():
    app = create_app(testing=True)
    with app.test_client() as client:
        yield client

class TestUserEndpointV1:
    """Tests for the v1 user endpoint"""

    def test_get_users_v1_response_structure(self, client):
        """Verify that the v1 response structure is correct"""
        response = client.get('/api/v1/users')
        data = json.loads(response.data)

        assert response.status_code == 200
        assert 'users' in data
        assert isinstance(data['users'], list)

        if data['users']:
            user = data['users'][0]
            # v1 has 'name' field (not 'full_name')
            assert 'name' in user
            assert 'full_name' not in user
            # v1 'id' is integer
            assert isinstance(user['id'], int)
            # v1 does not have 'profile'
            assert 'profile' not in user

    def test_get_users_v1_deprecation_headers(self, client):
        """Verify that appropriate headers are returned when v1 is deprecated"""
        response = client.get('/api/v1/users')

        assert response.headers.get('Deprecation') == 'true'
        assert 'Sunset' in response.headers
        assert 'Link' in response.headers

class TestUserEndpointV2:
    """Tests for the v2 user endpoint"""

    def test_get_users_v2_response_structure(self, client):
        """Verify that the v2 response structure is correct"""
        response = client.get('/api/v2/users')
        data = json.loads(response.data)

        assert response.status_code == 200
        assert 'data' in data
        assert 'pagination' in data
        assert isinstance(data['data'], list)

        if data['data']:
            user = data['data'][0]
            # v2 has 'full_name' field
            assert 'full_name' in user
            assert 'name' not in user
            # v2 'id' is string
            assert isinstance(user['id'], str)
            # v2 has 'profile'
            assert 'profile' in user

    def test_get_users_v2_pagination(self, client):
        """Verify that v2 pagination works correctly"""
        response = client.get('/api/v2/users?page=1&per_page=10')
        data = json.loads(response.data)

        pagination = data['pagination']
        assert 'current_page' in pagination
        assert 'total_pages' in pagination
        assert 'total_items' in pagination
        assert pagination['current_page'] == 1

class TestVersionCompatibility:
    """Cross-version compatibility tests"""

    def test_v1_and_v2_same_data(self, client):
        """Verify that v1 and v2 return from the same data source"""
        v1_response = client.get('/api/v1/users')
        v2_response = client.get('/api/v2/users')

        v1_data = json.loads(v1_response.data)
        v2_data = json.loads(v2_response.data)

        # User count should be the same
        assert len(v1_data['users']) == len(v2_data['data'])

    def test_v1_name_maps_to_v2_full_name(self, client):
        """Verify that v1 name corresponds to v2 full_name"""
        v1_response = client.get('/api/v1/users/1')
        v2_response = client.get('/api/v2/users/1')

        v1_user = json.loads(v1_response.data)
        v2_user = json.loads(v2_response.data)

        assert v1_user['name'] == v2_user['data']['full_name']

class TestDateBasedVersioning:
    """Tests for date-based versioning"""

    def test_old_version_returns_old_structure(self, client):
        """Verify that specifying an old version returns the old structure"""
        response = client.get(
            '/api/users/123',
            headers={'API-Version': '2024-01-15'}
        )
        data = json.loads(response.data)

        # Old structure: id is integer, name field
        assert isinstance(data['id'], int)
        assert 'name' in data
        assert 'full_name' not in data

    def test_new_version_returns_new_structure(self, client):
        """Verify that specifying a new version returns the new structure"""
        response = client.get(
            '/api/users/123',
            headers={'API-Version': '2025-06-15'}
        )
        data = json.loads(response.data)

        # New structure: id is string, full_name field
        assert isinstance(data['id'], str)
        assert 'full_name' in data
        assert 'name' not in data

    def test_version_header_in_response(self, client):
        """Verify that version information is included in the response"""
        response = client.get(
            '/api/users/123',
            headers={'API-Version': '2024-06-01'}
        )

        assert response.headers.get('API-Version') == '2024-06-01'
```

### 9.2 Contract Testing

Consumer-Driven Contract (CDC) testing automatically verifies the contract between provider and consumer.

```
Contract Testing flow:

  ┌──────────────┐                      ┌──────────────┐
  │  Consumer     │                      │  Provider     │
  │  (Order Svc)  │                      │  (User Svc)   │
  └──────┬───────┘                      └──────┬───────┘
         │                                     │
         │  1. Consumer defines the contract    │
         │  ┌─────────────────────────┐        │
         │  │ "Calling GET /users/1   │        │
         │  │  returns a JSON with    │        │
         │  │  id, full_name, email"  │        │
         │  └───────────┬─────────────┘        │
         │              │                       │
         │              │  2. Publish contract to broker
         │              ▼                       │
         │     ┌─────────────────┐              │
         │     │  Pact Broker     │              │
         │     │  (contract repo) │              │
         │     └────────┬────────┘              │
         │              │                       │
         │              │  3. Provider verifies contract
         │              └──────────────────────►│
         │                                      │
         │                  4. Report verification result to broker
         │              ┌───────────────────────│
         │              ▼                       │
         │     ┌─────────────────┐              │
         │     │  Pact Broker     │              │
         │     │  ✓ Verified      │              │
         │     │  or              │              │
         │     │  ✗ Failed        │              │
         │     └─────────────────┘              │
```

---

## 10. Anti-Patterns

### 10.1 Anti-Pattern 1: Version Number Inflation

A pattern where major versions are bumped frequently, making it impossible for clients to keep up.

```
Anti-pattern: Version explosion

  Bad example:
  ┌──────────────────────────────────────────────────────┐
  │  Jan 2024:  /api/v1/users  ← initial release         │
  │  Mar 2024:  /api/v2/users  ← minor change bumped v2  │
  │  May 2024:  /api/v3/users  ← another minor change v3 │
  │  Jul 2024:  /api/v4/users  ← response addition v4    │
  │  Sep 2024:  /api/v5/users  ← performance improvement │
  │  Nov 2024:  /api/v6/users  ← new field added v6      │
  │                                                      │
  │  Result:                                             │
  │  ✗ Clients cannot determine which of the 6 versions  │
  │    to use                                            │
  │  ✗ Maintenance cost for each version is enormous     │
  │  ✗ Documentation is scattered across versions        │
  │  ✗ Dev team cannot keep track of old version behavior│
  └──────────────────────────────────────────────────────┘

  Correct approach:
  ┌──────────────────────────────────────────────────────┐
  │  Jan 2024:  /api/v1/users  ← initial release         │
  │  Mar 2024:  /api/v1/users  ← non-breaking (v1 kept)  │
  │  May 2024:  /api/v1/users  ← non-breaking (v1 kept)  │
  │  Jul 2024:  /api/v1/users  ← non-breaking (v1 kept)  │
  │  Jan 2025:  /api/v2/users  ← accumulated breaking    │
  │                               changes bundled in v2  │
  │                                                      │
  │  Principles:                                         │
  │  ✓ Batch breaking changes together for version bumps │
  │  ✓ Add non-breaking changes to the current version   │
  │  ✓ Major version bumps roughly once every 1–2 years  │
  │  ✓ Limit concurrent versions to 2–3 maximum          │
  └──────────────────────────────────────────────────────┘
```

**Root of the problem**: Mistaking non-breaking changes for breaking changes and bumping the version. If a change is non-breaking, a new version is not needed. "Additions" and "making things optional" are non-breaking changes and are not reasons for a version bump.

**Remedies**:
- Establish a clear definition of breaking changes and share it across the team
- Put a version bump approval process in place (architecture review, etc.)
- Actively use non-breaking change techniques (adding fields, Feature Flags, etc.)

### 10.2 Anti-Pattern 2: Abandoned Version Lock (Zombie Versions)

A pattern where old versions are neither deprecated nor retired and continue to run indefinitely.

```
Anti-pattern: Zombie versions

  Bad example:
  ┌──────────────────────────────────────────────────────┐
  │  /api/v1/users  ← released in 2020. still running   │
  │  /api/v2/users  ← released in 2022. still running   │
  │  /api/v3/users  ← released in 2024. latest          │
  │                                                      │
  │  State of v1:                                        │
  │  ✗ Security patches not applied                      │
  │  ✗ Depends on old libraries (runs on EOL framework)  │
  │  ✗ Original developer has left; no one understands   │
  │    the code                                          │
  │  ✗ Tests are broken and left unfixed                 │
  │  ✗ But cannot be stopped because "someone may use it"│
  └──────────────────────────────────────────────────────┘

  Root causes:
  ① Deprecation process not defined
  ② Usage is not monitored
  ③ Fear of receiving complaints if stopped
  ④ No budget/effort allocated for retirement

  Correct approach:
  ┌──────────────────────────────────────────────────────┐
  │  Draft a retirement plan at release time:            │
  │                                                      │
  │  At v1 release:                                      │
  │   → Document "retire 12 months after v2 release"     │
  │   → Include parallel operation period in SLA         │
  │                                                      │
  │  At v2 release:                                      │
  │   → Begin deprecation of v1                          │
  │   → Attach Deprecation/Sunset headers                │
  │   → Begin usage monitoring                           │
  │                                                      │
  │  On v1 retirement date:                              │
  │   → Return 410 Gone                                  │
  │   → Include redirect information                     │
  │   → Fully delete old code                            │
  └──────────────────────────────────────────────────────┘
```

**Root of the problem**: Retiring an old version is not just a technical decision — it is a business decision and a process design issue. Without a clear retirement policy, old versions persist forever.

**Remedies**:
- Define an API lifecycle policy and publish it as part of the SLA
- Regularly review usage of old versions (monthly, etc.)
- Set thresholds for retirement decisions (e.g., consider retiring when monthly requests fall below 1% of total)
- Include retirement work in sprint planning

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: Transactions Spanning Multiple Versions

When a client combines multiple endpoints to form a single transaction, upgrading only some of the endpoints can cause consistency issues.

```
Edge case: The partial version upgrade trap

  Scenario:
  Client processing flow (order creation):
    1. POST /api/v2/orders        ← migrated to v2
    2. GET  /api/v1/users/{id}    ← still on v1
    3. POST /api/v2/payments      ← migrated to v2

  Problem:
  ┌──────────────────────────────────────────────────┐
  │  v2 orders changed to accept user_id             │
  │  as string ("usr_123").                          │
  │                                                  │
  │  However, v1 users returns id as integer (123),  │
  │  so when the client passes the id retrieved from │
  │  v1 users to v2 orders, a type mismatch error    │
  │  occurs.                                         │
  │                                                  │
  │  1. GET /api/v1/users/123 → {"id": 123, ...}     │
  │  2. POST /api/v2/orders                          │
  │     Body: {"user_id": 123}  ← integer!           │
  │     → 400 Bad Request: user_id must be string    │
  └──────────────────────────────────────────────────┘

  Countermeasures:
  ① Version consistency policy:
     → Same client uses the same version across all endpoints
     → Gateway detects and warns about mixed versions

  ② Type conversion compatibility layer:
     → v2 orders also accept integer user_id
     → Auto-convert internally: 123 → "usr_123"
     → However, this can easily become technical debt

  ③ Cross-version compatibility tests:
     → Automatically test v1 and v2 combinations in CI
     → Maintain a compatibility matrix
```

### 11.2 Edge Case 2: Cache and Version Inconsistency

A case where inconsistent data from different versions remains in CDN or browser cache.

```
Edge case: Cache pollution

  Scenario:
  ┌────────┐  GET /users  ┌─────┐  GET /v1/users  ┌──────┐
  │ Client  │──────────────►│ CDN │────────────────►│Backend│
  └────────┘              └─────┘                └──────┘

  Problem occurrence pattern:

  1. 12:00 - Client A requests /api/v1/users
     → CDN caches v1 response (TTL: 1 hour)

  2. 12:30 - API provider retires v1 and deletes /api/v1/
     → Requests to /api/v1/ now return 410 Gone

  3. 12:45 - Client B requests /api/v1/users
     → CDN returns v1 response from cache (stale data)
     → Client B perceives v1 as still alive

  4. 13:00 - CDN cache expires
     → Backend's 410 Gone is returned going forward
     → Client B suddenly encounters an error

  Countermeasures:
  ① Version-specific cache key settings:
     Cache-Control: public, max-age=3600
     Vary: Accept, API-Version

  ② Purge cache before retirement:
     → Purge old version cache at the same time as retirement
     → CloudFront: Invalidation, Fastly: Purge API

  ③ Gradual TTL reduction:
     → 3 months before retirement: reduce TTL from 1 hour to 10 minutes
     → 1 month before retirement: reduce TTL from 10 minutes to 1 minute
     → On retirement day: disable cache (no-cache)

  ④ Selective purge using Surrogate-Key:
     Surrogate-Key: api-v1 users-list
     → Bulk purge cache tagged "api-v1" at retirement
```

### 11.3 Edge Case 3: Mobile Apps and Forced Version Upgrades

With mobile applications, old API versions continue to be called unless users update the app. Unlike web apps, the client version cannot be controlled server-side.

```
Versioning challenges for mobile apps:

  Web app:
    Server deploy → All users immediately use the new version
    → Version migration is easy

  Mobile app:
    Store publish → Old version persists until users update
    → 6 months later, 30%+ installs may still be on old version

  Countermeasures:
  ① In-app forced update:
     → Notify minimum supported version in API response
     → Old app displays update dialog
     → However, use carefully due to large UX impact

  ② Long-term API version support:
     → APIs for mobile apps should support at least 18–24 months
     → Longer parallel operation period than for desktop/web

  ③ Client version-specific metrics:
     → Identify app version via User-Agent or custom headers
     → Consider retiring when usage of old app version falls below 5%
```

---

## 12. Practice Problems

### 12.1 Basic Exercise: Selecting a Versioning Approach

For each of the following scenarios, select the most suitable versioning approach and explain your reasoning.

**Scenario A**: An internal API used between microservices within a company. All services run on Kubernetes and are connected via the Istio service mesh. Change frequency is 1–2 times per month.

**Scenario B**: An open banking API for financial institutions. Must comply with PSD2 regulations, and more than 50 external fintech companies use it. Contractual SLA is strict.

**Scenario C**: An early-stage startup product. The only API consumer is the company's own mobile app. APIs change frequently on 2-week sprints. User count is under 1,000.

```
Hints for answers:

  Aspects to consider:
  ├─ Number and type of consumers (internal/external)
  ├─ Change frequency
  ├─ Presence of regulatory requirements
  ├─ Strictness of SLA
  ├─ Size and skill of the development team
  ├─ Maturity of operational infrastructure
  └─ Future expansion plans

  Expected answer direction for each scenario:
  A: Internal API → versionless or lightweight versioning
     Consumer-Driven Contracts + Tolerant Reader are effective
  B: Strict URI versioning + long-term parallel operation
     Internal management with SemVer + public CHANGELOG
  C: Versionless or query parameter approach
     Flexible since it's mobile app only
     However, also consider URI versioning in anticipation of future external publishing
```

### 12.2 Applied Exercise: Drafting a Migration Plan

Draft a plan to migrate the following v1 API to v2.

```
v1 API spec:
  POST /api/v1/products
  Request:
    {
      "name": "Laptop",
      "price": 98000,         # integer (in JPY)
      "category": "electronics",
      "tags": "laptop,portable" # comma-separated string
    }

  Response:
    {
      "id": 1,
      "name": "Laptop",
      "price": 98000,
      "category": "electronics",
      "tags": "laptop,portable",
      "created": "2024-01-15"  # YYYY-MM-DD format
    }

v2 API spec (planned changes):
  POST /api/v2/products
  Request:
    {
      "name": "Laptop",
      "price": {               # changed to object
        "amount": 98000,
        "currency": "JPY"
      },
      "category_id": "cat_electronics",  # changed to ID-based
      "tags": ["laptop", "portable"]     # changed to array
    }

  Response:
    {
      "id": "prod_1",         # string type with prefix
      "name": "Laptop",
      "price": {
        "amount": 98000,
        "currency": "JPY"
      },
      "category": {
        "id": "cat_electronics",
        "name": "Electronics"
      },
      "tags": ["laptop", "portable"],
      "created_at": "2024-01-15T00:00:00Z"  # ISO 8601 format
    }
```

**Tasks**:
1. List all breaking changes and analyze their impact
2. Create a 12-month migration timeline
3. Create the main sections of a migration guide (old-to-new mapping table, code examples)
4. Design an automatic conversion function from v1 to v2

```
Hints for answers:

  List of breaking changes:
  ├─ price: integer → object (type change)
  ├─ category: string → object (structural change)
  ├─ category → category_id (request side field name change)
  ├─ tags: string → array (type change)
  ├─ id: integer → string (type change + prefix added)
  ├─ created → created_at (field name change)
  └─ created: YYYY-MM-DD → ISO 8601 (format change)

  Timeline example:
  Month 1-2:  v2 design, review, implementation
  Month 3:    v2 beta release, internal testing
  Month 4:    v2 GA release, begin parallel operation, publish migration guide
  Month 5-8:  Attach deprecation headers to v1, individual notification to major clients
  Month 9-10: Gradually tighten v1 rate limits
  Month 11:   Send final warning
  Month 12:   Retire v1 (410 Gone)
```

### 12.3 Advanced Exercise: Designing a Versioning Framework

Design a versioning framework that satisfies the following requirements (describe in code or pseudocode).

**Requirements**:
1. Support both URI path versioning and header versioning
2. Request/response transformation functionality per version
3. Automatically attach Sunset header to access to deprecated versions
4. Collect per-version access metrics
5. Return an appropriate error response for requests to unsupported versions

```python
# Skeleton for answer (to be extended):

from abc import ABC, abstractmethod
from typing import Callable, Optional
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class VersionConfig:
    """Configuration information for a version"""
    version: str                         # "v1", "v2", "2024-01-15", etc.
    status: str                          # "active", "deprecated", "sunset"
    release_date: datetime               # release date
    sunset_date: Optional[datetime]      # planned retirement date (None if TBD)
    successor: Optional[str]             # successor version (None if latest)
    transformers: dict = field(          # transformation functions per endpoint
        default_factory=dict
    )

class VersioningMiddleware:
    """Base class for versioning middleware"""

    def __init__(self):
        self.versions: dict[str, VersionConfig] = {}
        self.metrics: dict[str, int] = {}

    def register_version(self, config: VersionConfig) -> None:
        """Register a version"""
        self.versions[config.version] = config

    def resolve_version(self, request) -> str:
        """Resolve version from request"""
        # 1. Check URI path
        version = self._extract_from_path(request.path)
        if version:
            return version

        # 2. Check headers
        version = self._extract_from_header(request.headers)
        if version:
            return version

        # 3. Return default version
        return self._get_default_version()

    def process_request(self, request):
        """Process request and route to appropriate version"""
        version = self.resolve_version(request)

        # Collect metrics
        self._record_metrics(version)

        # Check version status
        config = self.versions.get(version)
        if config is None:
            return self._unsupported_version_response(version)

        if config.status == 'sunset':
            return self._gone_response(version, config)

        # Transform request (if needed)
        transformed_request = self._transform_request(
            request, version
        )

        return transformed_request, config

    def process_response(self, response, version: str):
        """Add version-related headers to response"""
        config = self.versions[version]

        # Transform response
        transformed = self._transform_response(
            response, version
        )

        # Attach deprecation headers
        if config.status == 'deprecated':
            transformed.headers['Deprecation'] = 'true'
            if config.sunset_date:
                transformed.headers['Sunset'] = (
                    config.sunset_date.strftime(
                        '%a, %d %b %Y %H:%M:%S GMT'
                    )
                )
            if config.successor:
                transformed.headers['Link'] = (
                    f'</{config.successor}/docs>; '
                    f'rel="successor-version"'
                )

        # Version info header
        transformed.headers['X-API-Version'] = version

        return transformed

    # --- Implement the following helper methods below ---
    # _extract_from_path, _extract_from_header,
    # _get_default_version, _record_metrics,
    # _unsupported_version_response, _gone_response,
    # _transform_request, _transform_response
```

**Advanced tasks**:
- Fully implement the skeleton code above
- Write unit tests covering all patterns (active/deprecated/retired versions)
- Add a feature to automatically detect differences between versions from an OpenAPI spec

---

## 13. Practical Versioning Policy Template

The following is a versioning policy template that can be used in an organization or project.

```
=================================================================
           [Project Name] API Versioning Policy
                     Version 1.0 / 2025-01-01
=================================================================

1. Versioning approach
   This API adopts URI path versioning.
   Format: /api/v{MAJOR}/
   Example: /api/v1/, /api/v2/

2. Version number management
   - Public version: major version only (v1, v2, v3...)
   - Internal version: semantic versioning (MAJOR.MINOR.PATCH)
   - Internal version communicated via X-API-Version header

3. Definition of breaking changes
   The following changes are classified as breaking changes:
   a) Deletion of response fields
   b) Type changes of fields
   c) Addition of required parameters
   d) Changes/deletion of endpoint URLs
   e) Changes to the meaning of status codes
   f) Changes to authentication/authorization methods
   g) Field name changes

4. Definition of non-breaking changes
   The following changes are applied without a version bump:
   a) Addition of optional fields
   b) Addition of new endpoints
   c) Improvement of error message wording
   d) Performance improvements

5. Lifecycle policy
   a) Old versions run in parallel for at least 12 months
      after a new version is released
   b) A minimum of 24 months of parallel operation is
      guaranteed for enterprise customers
   c) Parallel operation period is stated in the SLA

6. Deprecation process
   a) Attach Deprecation header to old version after new version GA
   b) 6 months before retirement: announce via docs, email, dashboard
   c) 3 months before retirement: individual notification to major clients
   d) 1 month before retirement: final warning, gradual rate limit tightening
   e) On retirement date: return 410 Gone

7. Migration support
   a) Publish migration guide (list of changes, old-to-new mapping, code examples)
   b) Provide pre-verification in a sandbox environment
   c) Provide migration support via technical support

8. Maximum concurrent versions
   A maximum of 3 versions run concurrently (current, deprecated, sunset-announced).
   Older versions beyond this are retired.

9. Exceptions in emergencies
   In cases of high urgency such as addressing security vulnerabilities,
   changes may be applied with a shortened process.
   Even in such cases, notify in advance as much as possible.

10. Policy updates
    This policy is reviewed once a year and updated as needed.
    Changes to the policy itself are announced 6 months in advance.
=================================================================
```

---

## 14. FAQ

### FAQ 1: Should I choose URI versioning or header versioning?

**Answer**: URI path versioning (/api/v1/) is recommended in the majority of cases, for the following reasons.

- Most intuitive and easiest to understand. Developers can tell the version just by looking at the URL
- Easy to test manually in a browser or with curl
- Simple routing configuration in CDN and load balancers
- Easy to explain in documentation
- Most widely adopted in the industry, with a low learning curve

However, consider header versioning in the following cases:
- When strict compliance with REST principles is required
- When it is necessary to provide multiple representations for the same resource (content negotiation)
- When fine-grained date-based version management is needed (Stripe approach)

### FAQ 2: Should the first release start at v0 or v1?

**Answer**: It is recommended to start from v1.

In SemVer, v0 means "initial development phase, where breaking changes can occur at any time." Using v0 in a public API can send the message that "this API is unstable and unreliable."

However, using v0 is also reasonable in the following cases:
- When explicitly provided as a preview/beta version
- For internal APIs where flexibility is prioritized over stability
- When the main purpose is gathering feedback and production use is not assumed

### FAQ 3: How far should bug fixes in old versions go when a new version is released?

**Answer**: Security fixes must always be done; functional bug fixes should be determined based on policy.

Recommended response levels:

| Fix type | Old version response | Reason |
|---------|----------------|------|
| Security vulnerabilities | Mandatory | Obligation to protect users' safety |
| Data integrity bugs | Recommended | Data corruption directly impacts business |
| Functional bugs (major) | Case by case | Depends on impact and migration schedule |
| Functional bugs (minor) | Fix in new version only | Becomes a migration incentive |
| UX improvements | New version only | Minimize investment in old version |

### FAQ 4: Is versioning needed for GraphQL?

**Answer**: GraphQL inherently aims for a versionless design, but that does not mean versioning is completely unnecessary.

Versionless mechanisms that GraphQL has:
- Because clients select the fields they need, adding fields is non-breaking
- Per-field deprecation using the `@deprecated` directive
- Gradual schema evolution is easy

However, versioning should be considered in the following cases:
- When a fundamental redesign of the schema is necessary
- When type changes are necessary (String → Int, etc.)
- When changing the syntax or semantics of queries

### FAQ 5: Are API versioning and microservice versioning the same?

**Answer**: They are closely related but are different concerns.

- **API versioning**: Contract management for externally published interfaces. Controls the impact on consumers
- **Service versioning**: Management of internal deployment units. Related to deployment strategies such as Blue-Green deployment and canary releases

A single service may provide multiple API versions, or a service may be deployed many times without changing the API version. It is important not to confuse the two.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 15. Summary

| Concept | Key Point |
|------|---------|
| URL versioning | Include /v1/ in the path; simplest and most widely adopted |
| Header versioning | Specified via Accept header; keeps URLs clean |
| Breaking change management | Lifecycle of deprecation notice → migration period → old version retirement |
| Backward compatibility | Adding fields is OK; deletion and type changes are breaking |

### Key Points of This Chapter

1. **Decide versioning strategy early** — changing later is difficult
2. **Manage breaking changes deliberately** — provide deprecation notice and migration period
3. **Always be aware of backward compatibility** — minimize impact on clients

### 15.1 Summary of Key Points

| Concept | Key Point |
|------|---------|
| Breaking changes | Field deletion, type changes, adding required parameters, endpoint changes |
| URI versioning | /api/v1/ is most common and recommended. Expose major version only |
| Header versioning | Compliant with REST principles. Suited for Stripe-style date-based versioning |
| Query parameter | Easy to implement but trending away from in long-term operation |
| Semantic versioning | Internally managed with MAJOR.MINOR.PATCH. Only MAJOR is published |
| Deprecation | 6-month advance notice → 12-month parallel operation → end with 410 Gone |
| Versionless | Additive only + Feature Flags + Robustness Principle |
| Contract Testing | Consumer-Driven Contracts for automatic compatibility verification |
| API Gateway | Core of version routing and response transformation |
| Policy | Draft retirement plan at release time. Prevent zombie versions |

### 15.2 Versioning Approach Selection Flowchart

```
Versioning approach selection flow:

  START
    │
    ├─ Is it an externally published API?
    │   ├─ Yes → How many consumers?
    │   │        ├─ Many (10+ companies) → URI versioning (recommended)
    │   │        ├─ Few (1–9 companies)  → URI or header
    │   │        └─ Own app only         → choose based on situation
    │   │
    │   └─ No (internal API) → Versionless or lightweight versioning
    │                          Consider Consumer-Driven Contracts
    │
    ├─ What is the change frequency?
    │   ├─ High     → Versionless + Feature Flags
    │   ├─ Medium   → URI versioning
    │   └─ Low      → URI versioning (simplest)
    │
    ├─ Are there regulatory requirements?
    │   ├─ Yes → URI versioning + strict policy
    │   └─ No  → Flexible choice
    │
    └─ Compatibility with existing systems?
        ├─ Via CDN/proxy    → URI versioning (easy routing)
        ├─ API Gateway      → Any approach supported
        └─ Direct connection → No constraints
```

### 15.3 Checklist

Items to confirm when formulating an API versioning strategy.

- [ ] Has the versioning approach been decided (URI/header/query parameter)?
- [ ] Has the definition of breaking changes been documented?
- [ ] Has the deprecation process been defined (timeline, notification method)?
- [ ] Has the parallel operation period been decided (minimum 12 months recommended)?
- [ ] Have CHANGELOG operation rules been established?
- [ ] Have version compatibility tests been incorporated into CI?
- [ ] Has a usage monitoring mechanism been built?
- [ ] Has a migration guide template been prepared?
- [ ] Has the API gateway version routing been configured?
- [ ] Has the versioning policy been published?
- [ ] Has long-term support for enterprise customers been considered?
- [ ] Have mobile app-specific version management considerations been addressed?

---

## Summary

This guide covered the following:

- Why API versioning is necessary and how to define and classify breaking changes
- Comparison of URI versioning, header versioning, and query parameter approaches, and selection criteria
- Practical internal version management using semantic versioning and CHANGELOG operations
- Designing the deprecation process (announcement → parallel operation → retirement) and the concept of versionless design (Evolvable API)
- Version routing in API gateway and microservice environments, and automatic compatibility verification through Contract Testing

---

## What to Read Next
→ [Pagination and Filtering](./03-pagination-and-filtering.md)

---

## References

1. Stripe. "API Versioning." stripe.com/docs/api/versioning, 2024. -- A representative implementation of date-based versioning. Explains in detail the mechanism by which all API consumers are pinned to a specific date version and old behavior is maintained unless explicitly upgraded.

2. RFC 8594. "The Sunset HTTP Header Field." IETF, 2019. -- Standard specification for notifying the planned retirement date of an API endpoint via HTTP header. Enables programmatic deprecation notification when combined with the Deprecation header.

3. Fielding, Roy Thomas. "Architectural Styles and the Design of Network-based Software Architectures." Doctoral dissertation, University of California, Irvine, 2000. -- The origin of the REST architectural style. The concept of content negotiation forms the theoretical foundation of header versioning.

4. Preston-Werner, Tom. "Semantic Versioning 2.0.0." semver.org, 2013. -- The semantic versioning specification. Defines the meaning of each MAJOR.MINOR.PATCH number and the rules for comparing version numbers. Widely applied to internal management of API versions.

5. Pact Foundation. "Consumer-Driven Contract Testing." docs.pact.io, 2024. -- A contract testing framework for automatically verifying API compatibility between microservices. Details how to continuously verify that providers satisfy the contracts defined by consumers.

6. Google Cloud. "API Design Guide - Versioning." cloud.google.com/apis/design, 2024. -- The versioning section in Google Cloud's API design guide. Explains the rules for embedding major versions in URI paths, internal minor version management, and maintaining compatibility from the perspective of Google's large-scale API ecosystem.
