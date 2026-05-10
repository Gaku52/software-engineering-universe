# Security Principles

> This guide explains the security principles that form the foundation of robust system design, including Least Privilege, Defense in Depth, Zero Trust, and Secure by Default. These principles trace back to Saltzer and Schroeder's 1975 paper "The Protection of Information in Computer Systems," and remain the bedrock of all secure system design even 50 years later.

## Prerequisites

- Basic networking knowledge (TCP/IP, HTTP/HTTPS)
- Basic concepts of authentication and authorization
- A foundational understanding of cryptography will deepen comprehension

## What You Will Learn

1. How to apply the **Principle of Least Privilege** to minimize the attack surface
2. How to translate the **Defense in Depth and Zero Trust** design philosophies into concrete implementations
3. Techniques for safely initializing systems using the **Secure by Default** philosophy
4. An overview of **Saltzer & Schroeder's 8 Principles** and their interrelationships
5. **Implementation patterns and anti-patterns** for each principle, enabling you to apply them in real projects

---

## 1. Saltzer & Schroeder's 8 Principles — The Origins of Security Design

The security design principles published by Jerome Saltzer and Michael Schroeder in 1975 form the foundation of every modern security framework. This section provides an overview of all eight principles.

```
Saltzer & Schroeder's 8 Principles (1975):

+================================================================+
|  Principle                   | Modern Application              |
|================================================================|
|  1. Economy of Mechanism     | KISS principle, simple design   |
|                               |                                 |
|  2. Fail-Safe Defaults       | Default deny, allowlisting      |
|                               |                                 |
|  3. Complete Mediation        | Zero Trust, verify every time   |
|                               |                                 |
|  4. Open Design              | Public cryptographic algorithms |
|                               |                                 |
|  5. Separation of Privilege   | MFA, 4-eyes principle           |
|                               |                                 |
|  6. Least Privilege           | RBAC, minimal IAM permissions  |
|                               |                                 |
|  7. Least Common Mechanism    | Process isolation, sandboxing  |
|                               |                                 |
|  8. Psychological Acceptability| UX design, SSO                 |
+================================================================+

These principles are not independent — they are interrelated:

  Least Privilege ──→ Separation of Privilege ──→ Complete Mediation
      │                                                │
      ▼                                                ▼
  Fail-Safe Defaults ←── Economy of Mechanism
      │
      ▼
  Psychological Acceptability ←── Open Design
```

### Why 50-Year-Old Principles Still Hold Today

Security threats evolve, but the "structure" of defense does not. Because these principles describe a design philosophy rather than specific technologies, they apply directly to modern architectures such as cloud-native, microservices, and Zero Trust. NIST SP 800-160 (Systems Security Engineering) and OWASP's Security Design Principles are both modern reinterpretations of these 8 principles.

---

## 2. Principle of Least Privilege

The principle of granting users, processes, and systems only the minimum permissions necessary to perform their tasks. This minimizes the attack surface and limits the blast radius in the event of a breach.

### Why Least Privilege Matters — The Internal Mechanism

```
Applying Least Privilege:

  Excessive permissions:             Least Privilege applied:
  +-------------------+             +-------------------+
  | Admin role        |             | read:products     |
  | - Full DB read/write|           | write:cart        |
  | - User management |    ==>      | read:own_orders   |
  | - Server config   |             |                   |
  | - Log access      |             | (Only permissions |
  +-------------------+             |  needed for a     |
  (All permissions granted)         |  standard e-comm  |
                                    |  user)            |
                                    +-------------------+

  Attack Surface Comparison:

  Excessive permissions:                Least Privilege:
  +---------------------------------+  +--------+
  |                                 |  |        |
  |   If attacker gains access,     |  | Limited|
  |   entire system is at risk      |  | damage |
  |                                 |  |        |
  +---------------------------------+  +--------+
  Blast Radius = entire system          Blast Radius = minimal
```

There are three reasons why Least Privilege is important:

1. **Blast Radius Reduction**: If a breach occurs, the damage is contained within the scope of that account's permissions
2. **Lateral Movement Prevention**: Even if an attacker compromises one account, access to other resources is restricted
3. **Audit Simplification**: Because each account's permissions are clearly defined, anomalous access patterns are easier to detect

### Code Example 1: Implementing Least Privilege with RBAC

```python
# Code example 1: RBAC (Role-Based Access Control) for Least Privilege
from enum import Enum, auto
from typing import Set, Dict, Optional, List
from functools import wraps
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class Permission(Enum):
    READ_PRODUCTS = auto()
    WRITE_PRODUCTS = auto()
    READ_ORDERS = auto()
    WRITE_ORDERS = auto()
    MANAGE_USERS = auto()
    VIEW_ANALYTICS = auto()
    ADMIN_SETTINGS = auto()
    DELETE_DATA = auto()
    EXPORT_DATA = auto()

class Role(Enum):
    VIEWER = auto()
    EDITOR = auto()
    ORDER_MANAGER = auto()
    ADMIN = auto()

# Assign minimum required permissions to each role
ROLE_PERMISSIONS: Dict[Role, Set[Permission]] = {
    Role.VIEWER: {
        Permission.READ_PRODUCTS,
    },
    Role.EDITOR: {
        Permission.READ_PRODUCTS,
        Permission.WRITE_PRODUCTS,
    },
    Role.ORDER_MANAGER: {
        Permission.READ_PRODUCTS,
        Permission.READ_ORDERS,
        Permission.WRITE_ORDERS,
    },
    Role.ADMIN: {
        Permission.READ_PRODUCTS,
        Permission.WRITE_PRODUCTS,
        Permission.READ_ORDERS,
        Permission.WRITE_ORDERS,
        Permission.MANAGE_USERS,
        Permission.VIEW_ANALYTICS,
        Permission.ADMIN_SETTINGS,
        # Note: DELETE_DATA and EXPORT_DATA are not granted to ADMIN
        # by default — individual approval is required
    },
}

class User:
    def __init__(self, user_id: str, role: Role,
                 temporary_permissions: Optional[Set[Permission]] = None,
                 temporary_expiry: Optional[datetime] = None):
        self.user_id = user_id
        self.role = role
        self.temporary_permissions = temporary_permissions or set()
        self.temporary_expiry = temporary_expiry

    def get_effective_permissions(self) -> Set[Permission]:
        """Calculate effective permissions (role permissions + temporary permissions)"""
        perms = ROLE_PERMISSIONS.get(self.role, set()).copy()
        # Add temporary permissions if within the validity window
        if (self.temporary_permissions and self.temporary_expiry
                and datetime.now() < self.temporary_expiry):
            perms |= self.temporary_permissions
        return perms

def require_permission(permission: Permission):
    """Permission check decorator — also embodies the Complete Mediation principle"""
    def decorator(func):
        @wraps(func)
        def wrapper(user: User, *args, **kwargs):
            effective_perms = user.get_effective_permissions()
            if permission not in effective_perms:
                logger.warning(
                    "Insufficient permission: user=%s role=%s required=%s",
                    user.user_id, user.role.name, permission.name
                )
                raise PermissionError(
                    f"Insufficient permission: {user.role.name} does not have "
                    f"{permission.name}"
                )
            logger.info(
                "Access granted: user=%s action=%s",
                user.user_id, permission.name
            )
            return func(user, *args, **kwargs)
        return wrapper
    return decorator

@require_permission(Permission.WRITE_PRODUCTS)
def update_product(user: User, product_id: int, data: dict):
    """Update product information (requires EDITOR role or above)"""
    # Product update logic
    pass

@require_permission(Permission.DELETE_DATA)
def delete_user_data(user: User, target_user_id: str):
    """Delete user data (requires individually approved temporary permission)"""
    # Data deletion logic — not executable by ADMIN by default
    pass

# Usage example: Temporary privilege escalation (Just-In-Time Access)
admin = User("admin-001", Role.ADMIN)
# Temporarily grant DELETE_DATA permission for a GDPR deletion request
admin.temporary_permissions = {Permission.DELETE_DATA}
admin.temporary_expiry = datetime.now() + timedelta(hours=1)
# Permission is automatically revoked after 1 hour
```

### Code Example 2: Least Privilege Design with AWS IAM Policies

```python
# Code example 2: Least Privilege design with AWS IAM policies
import json
from typing import List, Optional

def create_minimal_iam_policy(
    bucket_name: str,
    prefix: str,
    allow_delete: bool = False,
    condition_ip_range: Optional[str] = None
) -> str:
    """
    Generate a policy that allows access only to a specific S3 bucket and prefix.

    Design principles:
    1. Specify Resource explicitly (no wildcards)
    2. Keep Actions to the minimum required (Get/Put only; Delete is optional)
    3. Add further constraints via Conditions (IP range, MFA, etc.)
    4. Use explicit Deny as a safety net
    """
    statements = [
        {
            "Sid": "AllowListBucketWithPrefix",
            "Effect": "Allow",
            "Action": ["s3:ListBucket"],
            "Resource": f"arn:aws:s3:::{bucket_name}",
            "Condition": {
                "StringLike": {
                    "s3:prefix": [f"{prefix}/*"]
                }
            }
        },
        {
            "Sid": "AllowReadWriteWithPrefix",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
            ],
            "Resource": f"arn:aws:s3:::{bucket_name}/{prefix}/*"
        },
    ]

    # Grant delete permission only when explicitly requested
    if allow_delete:
        statements.append({
            "Sid": "AllowDeleteWithPrefix",
            "Effect": "Allow",
            "Action": ["s3:DeleteObject"],
            "Resource": f"arn:aws:s3:::{bucket_name}/{prefix}/*",
            "Condition": {
                "Bool": {"aws:MultiFactorAuthPresent": "true"}
            }
        })

    # Add IP range restriction
    if condition_ip_range:
        for stmt in statements:
            if stmt["Effect"] == "Allow":
                stmt.setdefault("Condition", {})
                stmt["Condition"]["IpAddress"] = {
                    "aws:SourceIp": condition_ip_range
                }

    # Explicit deny as a safety net
    statements.append({
        "Sid": "DenyDangerousActions",
        "Effect": "Deny",
        "Action": [
            "s3:DeleteBucket",
            "s3:PutBucketPolicy",
            "s3:PutBucketAcl",
            "s3:PutObjectAcl",
        ],
        "Resource": "*"
    })

    policy = {
        "Version": "2012-10-17",
        "Statement": statements
    }
    return json.dumps(policy, indent=2)

# Usage example
print(create_minimal_iam_policy(
    "my-app-data",
    "uploads/user-123",
    allow_delete=False,
    condition_ip_range="10.0.0.0/8"
))
```

### Implementing Just-In-Time (JIT) Access

A critical practice in applying Least Privilege is the Just-In-Time Access approach: grant permissions only when needed and revoke them immediately once they are no longer required.

```python
# Code example 3: JIT (Just-In-Time) Access Manager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable
import threading
import logging

logger = logging.getLogger(__name__)

@dataclass
class AccessGrant:
    """Temporary access permission"""
    user_id: str
    permission: str
    resource: str
    granted_at: datetime
    expires_at: datetime
    reason: str
    approved_by: str
    revoked: bool = False

class JITAccessManager:
    """Just-In-Time Access Management — Dynamic implementation of Least Privilege"""

    MAX_GRANT_DURATION = timedelta(hours=8)

    def __init__(self):
        self._grants: Dict[str, AccessGrant] = {}
        self._cleanup_timer: Optional[threading.Timer] = None
        self._start_cleanup_loop()

    def request_access(
        self,
        user_id: str,
        permission: str,
        resource: str,
        duration: timedelta,
        reason: str,
        approved_by: str,
    ) -> AccessGrant:
        """Request temporary access"""
        if duration > self.MAX_GRANT_DURATION:
            raise ValueError(
                f"Maximum grant duration is {self.MAX_GRANT_DURATION}. "
                "Please request a role change for longer-term access."
            )

        now = datetime.now()
        grant = AccessGrant(
            user_id=user_id,
            permission=permission,
            resource=resource,
            granted_at=now,
            expires_at=now + duration,
            reason=reason,
            approved_by=approved_by,
        )

        grant_id = f"{user_id}:{permission}:{resource}"
        self._grants[grant_id] = grant

        logger.info(
            "JIT access granted: user=%s perm=%s resource=%s "
            "expires=%s reason=%s approved_by=%s",
            user_id, permission, resource,
            grant.expires_at.isoformat(), reason, approved_by,
        )

        return grant

    def check_access(self, user_id: str, permission: str,
                     resource: str) -> bool:
        """Check access permission"""
        grant_id = f"{user_id}:{permission}:{resource}"
        grant = self._grants.get(grant_id)

        if grant is None:
            return False
        if grant.revoked:
            return False
        if datetime.now() > grant.expires_at:
            grant.revoked = True
            logger.info("JIT access expired: user=%s perm=%s",
                       user_id, permission)
            return False

        return True

    def revoke_access(self, user_id: str, permission: str,
                      resource: str, reason: str = "manual_revoke"):
        """Immediately revoke access"""
        grant_id = f"{user_id}:{permission}:{resource}"
        grant = self._grants.get(grant_id)
        if grant and not grant.revoked:
            grant.revoked = True
            logger.info(
                "JIT access revoked: user=%s perm=%s reason=%s",
                user_id, permission, reason,
            )

    def _cleanup_expired(self):
        """Clean up expired grants"""
        now = datetime.now()
        expired = [
            gid for gid, g in self._grants.items()
            if now > g.expires_at or g.revoked
        ]
        for gid in expired:
            del self._grants[gid]

    def _start_cleanup_loop(self):
        """Periodic cleanup loop"""
        self._cleanup_expired()
        self._cleanup_timer = threading.Timer(60.0, self._start_cleanup_loop)
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()
```

### Least Privilege in Kubernetes

```yaml
# Code example 4: Kubernetes RBAC — Applying Least Privilege
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: app-deployer
rules:
  # Allow only read and update for Deployments
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "update", "patch"]
    # delete is excluded (to prevent accidental deletion)
  # Allow only viewing Pod logs
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list"]
    # exec is excluded (to prevent operations inside production containers)
  # Read-only access to ConfigMaps
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
    # Access to Secrets requires separate approval
---
# BAD: Excessive permissions (cluster-admin role)
# apiVersion: rbac.authorization.k8s.io/v1
# kind: ClusterRoleBinding
# metadata:
#   name: dev-cluster-admin
# roleRef:
#   apiGroup: rbac.authorization.k8s.io
#   kind: ClusterRole
#   name: cluster-admin  # ← Never grant this to developers
```

---

## 3. Defense in Depth

A strategy of layering multiple independent defensive mechanisms rather than relying on a single one. The term originates from the military concept of "defense in depth," and mirrors the design of medieval castles (moat → outer wall → inner wall → keep).

### Why Defense in Depth Is Necessary

In security, there is no such thing as a "perfect defensive layer." Even the best WAF has bypass techniques, and even the most robust firewall can be misconfigured. The essence of Defense in Depth is redundancy: "if one layer is breached, the next layer still functions."

```
Defense in Depth Model — The Castle Analogy:

  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  [Moat]  [Outer Wall] [Inner Wall] [Keep]  [Vault] │
  │   │         │          │          │          │      │
  │   ▼         ▼          ▼          ▼          ▼      │
  │  WAF/     FW/IDS    Host         App Layer  Data   │
  │  CDN      Network   Hardening    Auth/AuthZ  Layer  │
  │  DDoS     Segment   OS/Patches   Input Val.  Encrypt│
  │  Bot Det. VPN       Antivirus    Session     DLP    │
  │           mTLS      HIDS         CSRF Prot.  Backup │
  │                     CIS                      Audit  │
  │                     Benchmark                Log    │
  │                                                     │
  │  Attacker ──→ Layer 1 breached ──→ Detected Layer 2 │
  │                                ──→ Blocked Layer 3  │
  │                                                     │
  │  Each layer operates independently → Even if one   │
  │  layer is breached, the next layer defends,         │
  │  detects, and sends alerts                          │
  └─────────────────────────────────────────────────────┘

Concrete defense layer configuration:

  Layer 1: Perimeter Defense
    +-- WAF (OWASP Core Rule Set)
    +-- DDoS Mitigation (CloudFlare, AWS Shield)
    +-- Bot Detection
    +-- GeoIP Blocking

  Layer 2: Network Defense
    +-- Firewall (Security Groups, NACLs)
    +-- IDS/IPS (Suricata, AWS GuardDuty)
    +-- Network Segmentation (VPC, Subnet)
    +-- mTLS (service-to-service communication)

  Layer 3: Host Defense
    +-- OS Hardening (CIS Benchmark)
    +-- Patch Management (automated patching)
    +-- Host-based IDS (OSSEC, Falco)
    +-- Immutable Infrastructure (containers)

  Layer 4: Application Defense
    +-- Input Validation (server-side)
    +-- Authentication (MFA, OAuth2)
    +-- Authorization (RBAC, ABAC)
    +-- Session Management

  Layer 5: Data Defense
    +-- Encryption at Rest (AES-256)
    +-- Encryption in Transit (TLS 1.3)
    +-- Data Loss Prevention (DLP)
    +-- Backup & Recovery
```

### Code Example 5: Implementing a Defense in Depth Chain

```python
# Code example 5: Defense in Depth implementation — Chain of Responsibility pattern
from typing import List, Callable, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from abc import ABC, abstractmethod
import re
import hashlib
import logging

logger = logging.getLogger(__name__)

@dataclass
class SecurityCheckResult:
    passed: bool
    layer: str
    message: str
    severity: str = "info"  # info, warning, critical
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SecurityRequest:
    """Request subject to security validation"""
    ip: str
    method: str
    path: str
    headers: Dict[str, str]
    body: Any
    user_agent: str
    timestamp: datetime = field(default_factory=datetime.now)

class SecurityLayer(ABC):
    """Abstract base class for a defensive layer"""

    @abstractmethod
    def check(self, request: SecurityRequest) -> SecurityCheckResult:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass

class RateLimitLayer(SecurityLayer):
    """Layer 1: Rate Limiting"""
    name = "RateLimit"

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._counters: Dict[str, List[datetime]] = {}

    def check(self, request: SecurityRequest) -> SecurityCheckResult:
        ip = request.ip
        now = datetime.now()
        # Remove requests outside the window
        self._counters.setdefault(ip, [])
        self._counters[ip] = [
            t for t in self._counters[ip]
            if (now - t).total_seconds() < self.window_seconds
        ]
        self._counters[ip].append(now)

        count = len(self._counters[ip])
        if count > self.max_requests:
            return SecurityCheckResult(
                False, self.name,
                f"Rate limit exceeded: {count}/{self.max_requests}",
                severity="warning",
                details={"ip": ip, "count": count}
            )
        return SecurityCheckResult(True, self.name, "Rate limit OK")

class WAFLayer(SecurityLayer):
    """Layer 2: WAF (Web Application Firewall)"""
    name = "WAF"

    DANGEROUS_PATTERNS = [
        (r"('|\")\s*(OR|AND)\s+.*=", "SQL Injection"),
        (r";\s*(DROP|DELETE|UPDATE|INSERT)", "SQL Injection"),
        (r"UNION\s+SELECT", "SQL Injection"),
        (r"<script[^>]*>", "XSS"),
        (r"javascript:", "XSS"),
        (r"on\w+\s*=", "XSS Event Handler"),
        (r"\.\./\.\./", "Path Traversal"),
        (r"/etc/passwd", "Path Traversal"),
        (r"\$\{.*\}", "Template Injection"),
        (r"{{.*}}", "Template Injection"),
    ]

    def check(self, request: SecurityRequest) -> SecurityCheckResult:
        body = str(request.body or "")
        path = request.path
        check_target = f"{path} {body}"

        for pattern, attack_type in self.DANGEROUS_PATTERNS:
            if re.search(pattern, check_target, re.IGNORECASE):
                return SecurityCheckResult(
                    False, self.name,
                    f"WAF blocked: {attack_type} detected",
                    severity="critical",
                    details={"attack_type": attack_type, "path": path}
                )
        return SecurityCheckResult(True, self.name, "WAF check passed")

class InputValidationLayer(SecurityLayer):
    """Layer 3: Input Validation"""
    name = "InputValidation"

    MAX_FIELD_LENGTH = 10000
    MAX_BODY_SIZE = 1_000_000  # 1MB

    def check(self, request: SecurityRequest) -> SecurityCheckResult:
        body = request.body
        if isinstance(body, (str, bytes)):
            if len(body) > self.MAX_BODY_SIZE:
                return SecurityCheckResult(
                    False, self.name,
                    f"Body too large: {len(body)} bytes",
                    severity="warning"
                )
        elif isinstance(body, dict):
            for key, value in body.items():
                if isinstance(value, str) and len(value) > self.MAX_FIELD_LENGTH:
                    return SecurityCheckResult(
                        False, self.name,
                        f"Input too long: {key} ({len(value)} chars)",
                        severity="warning"
                    )
        return SecurityCheckResult(True, self.name, "Input validation passed")

class DefenseInDepth:
    """Orchestrator for the Defense in Depth chain"""

    def __init__(self):
        self.layers: List[SecurityLayer] = []

    def add_layer(self, layer: SecurityLayer) -> 'DefenseInDepth':
        self.layers.append(layer)
        return self  # Support method chaining

    def validate(self, request: SecurityRequest) -> List[SecurityCheckResult]:
        """Pass the request through all defensive layers in order"""
        results = []
        for layer in self.layers:
            try:
                result = layer.check(request)
                results.append(result)
                if not result.passed:
                    logger.warning(
                        "Security check failed: layer=%s msg=%s severity=%s",
                        result.layer, result.message, result.severity
                    )
                    # There is also the option to continue checking all layers
                    # even on failure (except for critical), to understand
                    # the full state of the system
                    if result.severity == "critical":
                        break
            except Exception as e:
                result = SecurityCheckResult(
                    False, layer.name, f"Error: {e}", severity="critical"
                )
                results.append(result)
                logger.error("Security layer error: %s %s", layer.name, e)
                break
        return results

    def is_allowed(self, request: SecurityRequest) -> bool:
        """Determine whether the request passed all layers"""
        results = self.validate(request)
        return all(r.passed for r in results)

# Building and using the defense chain
defense = (DefenseInDepth()
    .add_layer(RateLimitLayer(max_requests=100))
    .add_layer(WAFLayer())
    .add_layer(InputValidationLayer()))

# Test
test_request = SecurityRequest(
    ip="192.168.1.100",
    method="POST",
    path="/api/search",
    headers={"Content-Type": "application/json"},
    body={"query": "normal search term"},
    user_agent="Mozilla/5.0"
)
print(defense.is_allowed(test_request))  # True

malicious_request = SecurityRequest(
    ip="192.168.1.100",
    method="POST",
    path="/api/search",
    headers={"Content-Type": "application/json"},
    body={"query": "' OR 1=1 --"},
    user_agent="sqlmap/1.0"
)
print(defense.is_allowed(malicious_request))  # False
```

### The Importance of Independence in Defense in Depth

To maximize the effectiveness of Defense in Depth, it is crucial that each layer operates **independently**.

```
Independence Principle:

  BAD: Layers depend on each other
  +--------+     +--------+     +--------+
  | WAF    | --> | AuthN  | --> | AuthZ  |
  | (if WAF|     | (depends     |        |
  |  passes,|    |  on WAF |    |        |
  |  skip   |    |  result)|    |        |
  |  AuthN) |    |        |     |        |
  +--------+     +--------+     +--------+
  → Bypassing WAF disables all subsequent layers

  GOOD: Each layer makes its own independent decision
  +--------+     +--------+     +--------+
  | WAF    | --> | AuthN  | --> | AuthZ  |
  | (indep.|     | (indep.|     | (indep.|
  |  check)|     |  check)|     |  check)|
  +--------+     +--------+     +--------+
  → If one layer is breached, the others still function normally
```

---

## 4. Zero Trust

The principle of "Never Trust, Always Verify." Formally defined in NIST SP 800-207, this architectural model verifies all access regardless of whether it originates inside or outside the network perimeter.

### Comparison with Traditional Perimeter Defense

```
Traditional (Perimeter Defense / Castle-and-Moat):

  +---External---+---Internal---+
  |              | FW |         |
  | Attacker     | -- | Move    |    Problems:
  |              |    | Freely  |    1. Breaching FW leaves internal network unprotected
  +--------------+----+---------+    2. Lateral movement after VPN connection is easy
   Breaching FW leaves internals     3. Vulnerable to insider threats
   unprotected                       4. Not suited for cloud / remote work

Zero Trust:

  +--+  +--+  +--+  +--+
  |V | ->|V | ->|V | ->|V |    Benefits:
  |er|  |er|  |er|  |er|    1. Every access is verified every time
  +--+  +--+  +--+  +--+    2. Effectively prevents lateral movement
  Every Every Every Every   3. Addresses insider threats too
  verify verify verify verify  4. Cloud-native compatible

NIST SP 800-207 — Three Core Zero Trust Principles:
  1. Access to resources is granted on a per-session basis
  2. Access to resources is determined by dynamic policy
  3. All communication is protected regardless of network location
```

### The 7 Pillars of Zero Trust (CISA Zero Trust Maturity Model)

```
+================================================================+
|         CISA Zero Trust Maturity Model — 7 Pillars             |
|================================================================|
|                                                                |
|  1. Identity                                                   |
|     +-- Strong authentication (MFA, FIDO2)                    |
|     +-- Continuous identity verification                       |
|     +-- Risk-based authentication strength adjustment          |
|                                                                |
|  2. Devices                                                    |
|     +-- Device health validation (MDM, EDR)                   |
|     +-- Device authentication via device certificates          |
|     +-- BYOD vs. managed device policy separation             |
|                                                                |
|  3. Networks                                                   |
|     +-- Micro-segmentation                                     |
|     +-- Encrypted communication (mTLS)                        |
|     +-- Access control independent of network location         |
|                                                                |
|  4. Applications & Workloads                                   |
|     +-- Application-level authentication and authorization     |
|     +-- Control via API gateway                               |
|     +-- Service mesh (Istio, Linkerd)                         |
|                                                                |
|  5. Data                                                       |
|     +-- Data classification and labeling                      |
|     +-- Encryption (at rest and in transit)                   |
|     +-- DLP (Data Loss Prevention)                            |
|                                                                |
|  6. Visibility & Analytics                                     |
|     +-- Centralized log collection (SIEM)                     |
|     +-- Behavioral analytics (UEBA)                           |
|     +-- Real-time risk scoring                                |
|                                                                |
|  7. Automation & Orchestration                                 |
|     +-- SOAR (Security Orchestration, Automation, Response)   |
|     +-- Automated containment                                 |
|     +-- Policy as Code                                        |
+================================================================+
```

| Pillar | Description | Implementation Examples | Maturity Metric |
|----|------|--------|-----------|
| Identity | Authenticate all users and services | MFA, FIDO2, certificate authentication | Passwordless authentication rate |
| Devices | Verify device legitimacy and security posture | MDM, EDR, device certificates | Managed device rate |
| Networks | Communication control via micro-segmentation | Service mesh, mTLS | mTLS coverage rate |
| Applications | Access control at the application level | OAuth2, RBAC, API Gateway | API authentication coverage |
| Data | Data classification and encryption | Encryption, DLP, labeling | Encryption rate |
| Visibility | Centralized log collection and analysis | SIEM, UEBA | Log coverage rate |
| Automation | Automated detection and response | SOAR, Policy as Code | Automated response rate |

### Code Example 6: Implementing a Zero Trust Policy Engine

```python
# Code example 6: Zero Trust request validation — compliant with NIST SP 800-207
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class TrustLevel(Enum):
    """Trust level — based on authentication strength and context"""
    UNTRUSTED = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

class DeviceTrustLevel(Enum):
    UNKNOWN = "unknown"
    UNMANAGED = "unmanaged"
    MANAGED = "managed"
    COMPLIANT = "compliant"  # managed and policy-compliant

class NetworkLocation(Enum):
    PUBLIC = "public"
    VPN = "vpn"
    CORPORATE = "corporate"

@dataclass
class ZeroTrustContext:
    """Context required for Zero Trust verification"""
    user_id: str
    device_id: str
    device_trust_level: DeviceTrustLevel
    network_location: NetworkLocation
    mfa_verified: bool
    mfa_method: Optional[str] = None  # totp, fido2, push
    last_auth_time: datetime = field(default_factory=datetime.now)
    client_cert_valid: bool = False
    risk_score: float = 0.0          # 0.0 - 1.0
    geo_location: Optional[str] = None
    previous_geo_location: Optional[str] = None
    login_hour: Optional[int] = None
    failed_attempts: int = 0

@dataclass
class PolicyDecision:
    """Result of the policy engine's evaluation"""
    allowed: bool
    trust_level: TrustLevel
    checks: Dict[str, bool]
    action_required: Optional[str] = None
    reason: Optional[str] = None
    conditions: List[str] = field(default_factory=list)

class ZeroTrustPolicyEngine:
    """Zero Trust Policy Engine — dynamic, continuous verification"""

    # Required trust level per resource
    RESOURCE_TRUST_REQUIREMENTS: Dict[str, TrustLevel] = {
        "public_api": TrustLevel.LOW,
        "user_profile": TrustLevel.MEDIUM,
        "admin_panel": TrustLevel.CRITICAL,
        "financial_data": TrustLevel.CRITICAL,
        "user_data": TrustLevel.HIGH,
        "analytics": TrustLevel.MEDIUM,
    }

    MAX_SESSION_AGE = timedelta(hours=1)
    MAX_RISK_SCORE = 0.7
    IMPOSSIBLE_TRAVEL_THRESHOLD_KM = 500  # within 1 hour

    def evaluate(self, ctx: ZeroTrustContext,
                 resource: str, action: str) -> PolicyDecision:
        """Evaluate an access request comprehensively"""
        checks = {
            "identity_verified": self._check_identity(ctx),
            "device_compliant": self._check_device(ctx),
            "network_allowed": self._check_network(ctx, resource),
            "mfa_satisfied": self._check_mfa(ctx, resource),
            "session_fresh": self._check_session_age(ctx),
            "risk_acceptable": self._check_risk(ctx),
            "no_impossible_travel": self._check_impossible_travel(ctx),
            "within_business_hours": self._check_business_hours(ctx, resource),
        }

        # Calculate trust level
        trust_level = self._calculate_trust_level(ctx, checks)

        # Compare with the resource's required level
        required_level = self.RESOURCE_TRUST_REQUIREMENTS.get(
            resource, TrustLevel.MEDIUM
        )

        all_passed = (
            all(checks.values())
            and trust_level.value >= required_level.value
        )

        decision = PolicyDecision(
            allowed=all_passed,
            trust_level=trust_level,
            checks=checks,
        )

        if not all_passed:
            decision.action_required = self._get_remediation(
                checks, trust_level, required_level
            )
            decision.reason = self._get_denial_reason(checks)

        # Output audit log
        logger.info(
            "ZeroTrust decision: user=%s resource=%s action=%s "
            "allowed=%s trust=%s required=%s",
            ctx.user_id, resource, action,
            all_passed, trust_level.name, required_level.name,
        )

        return decision

    def _check_identity(self, ctx: ZeroTrustContext) -> bool:
        return bool(ctx.user_id)

    def _check_device(self, ctx: ZeroTrustContext) -> bool:
        return ctx.device_trust_level in (
            DeviceTrustLevel.MANAGED,
            DeviceTrustLevel.COMPLIANT,
        )

    def _check_network(self, ctx: ZeroTrustContext, resource: str) -> bool:
        sensitive_resources = {"admin_panel", "financial_data"}
        if resource in sensitive_resources:
            return ctx.network_location in (
                NetworkLocation.CORPORATE,
                NetworkLocation.VPN,
            )
        return True  # In Zero Trust, network location is supplementary

    def _check_mfa(self, ctx: ZeroTrustContext, resource: str) -> bool:
        sensitive_resources = {"admin_panel", "financial_data", "user_data"}
        if resource in sensitive_resources:
            if not ctx.mfa_verified:
                return False
            # Require FIDO2 for sensitive resources
            if resource == "financial_data":
                return ctx.mfa_method == "fido2"
        return True

    def _check_session_age(self, ctx: ZeroTrustContext) -> bool:
        return (datetime.now() - ctx.last_auth_time) < self.MAX_SESSION_AGE

    def _check_risk(self, ctx: ZeroTrustContext) -> bool:
        return ctx.risk_score < self.MAX_RISK_SCORE

    def _check_impossible_travel(self, ctx: ZeroTrustContext) -> bool:
        """Detect Impossible Travel"""
        if ctx.geo_location and ctx.previous_geo_location:
            if ctx.geo_location != ctx.previous_geo_location:
                # In practice, geocoding is used to calculate distance;
                # here we flag only when countries differ
                return False
        return True

    def _check_business_hours(self, ctx: ZeroTrustContext,
                              resource: str) -> bool:
        """Check for access outside business hours"""
        sensitive = {"admin_panel", "financial_data"}
        if resource in sensitive and ctx.login_hour is not None:
            return 6 <= ctx.login_hour <= 22
        return True

    def _calculate_trust_level(self, ctx: ZeroTrustContext,
                               checks: Dict[str, bool]) -> TrustLevel:
        """Dynamically calculate trust level based on context"""
        score = 0
        if checks["identity_verified"]:
            score += 1
        if checks["device_compliant"]:
            score += 1
        if checks["mfa_satisfied"]:
            score += 1
        if ctx.client_cert_valid:
            score += 1
        if ctx.risk_score < 0.3:
            score += 1

        if score >= 5:
            return TrustLevel.CRITICAL
        elif score >= 4:
            return TrustLevel.HIGH
        elif score >= 3:
            return TrustLevel.MEDIUM
        elif score >= 1:
            return TrustLevel.LOW
        return TrustLevel.UNTRUSTED

    def _get_remediation(self, checks: Dict[str, bool],
                         current: TrustLevel,
                         required: TrustLevel) -> str:
        if not checks["mfa_satisfied"]:
            return "MFA authentication is required"
        if not checks["device_compliant"]:
            return "Please access from a managed device"
        if not checks["session_fresh"]:
            return "Session has expired. Please re-authenticate"
        if not checks["no_impossible_travel"]:
            return "Anomalous access pattern detected. Identity verification required"
        if current.value < required.value:
            return f"This resource requires {required.name} level trust"
        return "Access denied. Please contact an administrator"

    def _get_denial_reason(self, checks: Dict[str, bool]) -> str:
        failed = [k for k, v in checks.items() if not v]
        return f"Failed checks: {', '.join(failed)}"
```

### Google BeyondCorp Implementation Case Study

Google BeyondCorp is the most well-known implementation of Zero Trust architecture.

```
Google BeyondCorp Architecture:

  +---------------------------------------------------------+
  |  Traditional: VPN → Corporate network → Free access     |
  +---------------------------------------------------------+
                          ↓
  +---------------------------------------------------------+
  |  BeyondCorp:                                             |
  |                                                          |
  |  User                                                   |
  |    │                                                    |
  |    ▼                                                    |
  |  [Access Proxy]                                         |
  |    │  ← User authentication (SSO + MFA)                |
  |    │  ← Device authentication (device certificate)      |
  |    │  ← Device inventory check                         |
  |    │  ← Access policy evaluation                       |
  |    │  ← Risk score check                               |
  |    ▼                                                    |
  |  [Resource]  ← No VPN required; all traffic via internet|
  +---------------------------------------------------------+

  Core idea: Access is controlled based on the trustworthiness
             of the user and device — not the network location
```

---

## 5. Secure by Default

The principle of making the initial state of a system a secure configuration. The most secure settings apply unless the user explicitly relaxes them. Combined with the principle of Psychological Acceptability, this approach achieves both security and usability.

### Why Secure by Default Matters

Statistically, many security incidents are caused by systems running with default settings. Default passwords, debug mode enabled by default, encryption disabled by default — these insecure defaults are "low-hanging fruit" for attackers.

```
The Secure by Default Philosophy:

  Insecure defaults (BAD):              Secure by Default (GOOD):
  +-----------------------------+      +-----------------------------+
  | debug_mode: true            |      | debug_mode: false           |
  | tls_enabled: false          |      | tls_enabled: true           |
  | cors_origin: "*"            |      | cors_origin: [] (empty)     |
  | cookie_secure: false        |      | cookie_secure: true         |
  | log_sensitive: true         |      | log_sensitive: false        |
  | admin_password: "admin"     |      | admin_password: (not set →  |
  |                             |      |   forced change on first    |
  |                             |      |   startup)                  |
  +-----------------------------+      +-----------------------------+

  Principles:
  - Security settings follow an "opt-out" model
    (secure by default; relax only when necessary)
  - Display warnings when relaxing; log the reason
  - Require additional approval to relax settings in production
```

### Code Example 7: Secure by Default Configuration Class

```python
# Code example 7: Secure by Default configuration class — complete version
from dataclasses import dataclass, field
from typing import List, Optional, Set
import warnings
import logging

logger = logging.getLogger(__name__)

@dataclass
class SecureServerConfig:
    """Secure-by-default server configuration

    Design principles:
    1. All default values represent the most secure setting
    2. Relaxing a setting requires an explicit method call
    3. A warning is logged whenever a setting is relaxed
    4. Some settings cannot be relaxed in production
    """

    # --- Secure default settings ---
    # TLS configuration
    tls_min_version: str = "TLSv1.3"
    tls_ciphers: List[str] = field(default_factory=lambda: [
        "TLS_AES_256_GCM_SHA384",
        "TLS_CHACHA20_POLY1305_SHA256",
    ])
    hsts_enabled: bool = True
    hsts_max_age: int = 31536000  # 1 year
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True

    # Security headers (enabled by default)
    content_security_policy: str = "default-src 'self'"
    x_frame_options: str = "DENY"
    x_content_type_options: str = "nosniff"
    referrer_policy: str = "strict-origin-when-cross-origin"
    permissions_policy: str = "camera=(), microphone=(), geolocation=()"

    # Cookie settings (secure by default)
    cookie_secure: bool = True
    cookie_httponly: bool = True
    cookie_samesite: str = "Strict"
    cookie_max_age: int = 3600  # 1 hour (short)

    # CORS (restricted by default)
    cors_allowed_origins: List[str] = field(default_factory=list)
    cors_allow_credentials: bool = False
    cors_max_age: int = 600  # 10 minutes

    # Rate limiting (enabled by default)
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60

    # Logging (enabled by default)
    access_log_enabled: bool = True
    error_log_enabled: bool = True
    log_sensitive_data: bool = False  # Sensitive data logging is disabled

    # Debug (disabled by default)
    debug_mode: bool = False
    expose_stack_traces: bool = False
    expose_server_version: bool = False

    # Environment
    _environment: str = "production"

    def relax_for_development(self):
        """Relaxed settings for development environments (must not be called in production)"""
        if self._environment == "production":
            raise RuntimeError(
                "Security settings cannot be relaxed in a production environment"
            )
        logger.warning(
            "Security settings are being relaxed for development. "
            "Never use these settings in production."
        )
        self.tls_min_version = "TLSv1.2"
        self.cors_allowed_origins = ["http://localhost:3000"]
        self.cookie_secure = False  # For HTTP-based development
        self.debug_mode = True

    def add_cors_origin(self, origin: str):
        """Add a CORS allowed origin (with audit logging)"""
        if origin == "*":
            raise ValueError(
                "'*' is not allowed as a CORS origin. "
                "Please specify a concrete origin."
            )
        logger.info("CORS origin added: %s", origin)
        self.cors_allowed_origins.append(origin)

    def relax_csp(self, directive: str, value: str):
        """Relax the CSP (with warnings)"""
        if "'unsafe-inline'" in value or "'unsafe-eval'" in value:
            warnings.warn(
                f"Adding an unsafe directive to CSP {directive}. "
                "This increases the risk of XSS.",
                SecurityWarning,
            )
        logger.warning("CSP relaxed: %s = %s", directive, value)
        self.content_security_policy = (
            f"{self.content_security_policy}; {directive} {value}"
        )

    def to_headers(self) -> dict:
        """Generate HTTP response headers"""
        headers = {
            "X-Content-Type-Options": self.x_content_type_options,
            "X-Frame-Options": self.x_frame_options,
            "Referrer-Policy": self.referrer_policy,
            "Content-Security-Policy": self.content_security_policy,
            "Permissions-Policy": self.permissions_policy,
        }
        if self.hsts_enabled:
            hsts_value = f"max-age={self.hsts_max_age}"
            if self.hsts_include_subdomains:
                hsts_value += "; includeSubDomains"
            if self.hsts_preload:
                hsts_value += "; preload"
            headers["Strict-Transport-Security"] = hsts_value
        if not self.expose_server_version:
            headers["Server"] = ""  # Hide server version
        return headers

    def validate(self) -> List[str]:
        """Validate configuration safety and return any issues found"""
        issues = []
        if self.debug_mode and self._environment == "production":
            issues.append("CRITICAL: Debug mode is enabled in production")
        if not self.hsts_enabled:
            issues.append("WARNING: HSTS is disabled")
        if not self.cookie_secure:
            issues.append("WARNING: Cookie secure flag is disabled")
        if self.cors_allowed_origins == ["*"]:
            issues.append("CRITICAL: CORS is open to all origins")
        if self.expose_stack_traces:
            issues.append("WARNING: Stack traces are exposed")
        if self.log_sensitive_data:
            issues.append("WARNING: Sensitive data logging is enabled")
        if self.tls_min_version < "TLSv1.2":
            issues.append("CRITICAL: TLS versions below 1.2 are not secure")
        return issues

class SecurityWarning(UserWarning):
    """Security-related warning"""
    pass

# Default configuration is secure
config = SecureServerConfig()
print(config.debug_mode)         # False (secure)
print(config.cookie_secure)      # True (secure)
print(config.tls_min_version)    # TLSv1.3 (secure)
print(config.validate())         # [] (no issues)
```

---

## 6. Other Important Security Principles

### 6.1 Fail-Safe Defaults

The principle that when a failure or exception occurs, the system transitions to a safe state.

```
Fail-Safe Flow:

  Request --> [Authorization Check]
                    |
              +-----+-----+
              |           |
           Success    Failure / Error / Timeout
              |           |
         Allow access   Deny access (fail safe)
                         + Log the event
                         + Send alert
                         + Notify administrator

  Implementation essentials:
  - The catch block in try/catch should return "deny," not "allow"
  - On timeout, deny access (no response = not approved)
  - The default case in switch/case should be "deny"
  - Use an allowlist approach (deny anything not on the permitted list)
```

```python
# Fail-Safe implementation example
def check_authorization(user_id: str, resource: str) -> bool:
    """Fail-safe authorization check"""
    try:
        # Query the authorization service
        result = auth_service.check(user_id, resource, timeout=5)
        if result.status == "ALLOW":
            return True
        # DENY or UNKNOWN are both treated as denial
        return False
    except TimeoutError:
        # Timeout = fail safe = deny
        logger.warning("Auth check timeout for user=%s", user_id)
        return False
    except Exception as e:
        # Unexpected error = fail safe = deny
        logger.error("Auth check error: %s", e)
        return False
    # Should never reach here, but deny just in case
    # return False
```

### 6.2 Complete Mediation

The principle of verifying every single access. Rather than relying on cached authorization results, perform a check every time.

### 6.3 Economy of Mechanism

Keep security mechanisms simple in their design. The more complex the code, the more bugs there are; the more bugs, the more vulnerabilities.

### 6.4 Open Design

Security must not depend on secrecy. Cryptographic algorithms should be publicly disclosed and have undergone public review before use (Kerckhoffs' principle). Avoid proprietary encryption and proprietary protocols.

### 6.5 Separation of Privilege

Require multiple independent approvals for critical operations. The 4-eyes principle (approval by two or more people) and MFA are implementations of this principle.

### 6.6 Least Common Mechanism

Minimize shared resources and mechanisms. Process isolation, sandboxing, and containerization are implementations of this principle.

### 6.7 Psychological Acceptability

Design security mechanisms so they do not interfere with users' work. Overly cumbersome security leads to workarounds, which ultimately reduce security.

### Comprehensive Comparison of Principles

| Principle | Description | Implementation Examples | Consequence of Violation |
|------|------|--------|-------------------|
| Least Privilege | Grant only the minimum necessary permissions | RBAC, IAM | Damage amplification when breached |
| Defense in Depth | Multiple independent defensive layers | WAF + FW + input validation | Single point of failure becomes fatal |
| Zero Trust | Verify all access | mTLS, micro-segmentation | Lateral movement from inside |
| Secure by Default | Make the initial state secure | Safe default values | Exploitation of default settings |
| Fail-Safe | Transition to a safe state on failure | Default deny | Unauthorized access on error |
| Complete Mediation | Verify access every time | Authorization middleware | Cache poisoning attacks |
| Economy of Mechanism | Keep design simple | Simple RBAC | Vulnerabilities from complexity |
| Open Design | Do not rely on secrecy | Public cryptographic algorithms | Collapse on secret disclosure |
| Separation of Privilege | Require multiple approvals | MFA, 4-eyes | Single privilege takeover causes breach |
| Least Common Mechanism | Minimize shared resources | Process isolation | Attacks via shared resources |
| Psychological Acceptability | Balance with usability | SSO, passwordless | Security avoidance behavior |

---

## 7. Edge Cases and Considerations

### Edge Case 1: Conflict Between Least Privilege and Incident Response

Strictly applying Least Privilege can lead to delayed incident response when the necessary permissions are unavailable during an emergency. To address this, prepare a "Break Glass" procedure.

```python
# Break Glass (emergency privilege escalation) implementation
class BreakGlassAccess:
    """Emergency privilege escalation mechanism"""

    def activate(self, user_id: str, reason: str,
                 incident_id: str) -> str:
        """Activate emergency permissions"""
        # 1. Send alerts via multiple channels
        self.alert_security_team(user_id, reason, incident_id)
        self.alert_management(user_id, reason, incident_id)

        # 2. Log all operations in detail
        self.enable_detailed_audit_log(user_id)

        # 3. Grant time-limited permissions (maximum 2 hours)
        token = self.grant_emergency_access(
            user_id,
            duration=timedelta(hours=2),
            incident_id=incident_id,
        )

        # 4. Set up an automatic revocation timer
        self.schedule_auto_revoke(user_id, token)

        return token
```

### Edge Case 2: Coexistence of Zero Trust and Legacy Systems

Migrating all systems to Zero Trust at once is not realistic. For legacy systems, add a Zero Trust layer by placing a proxy or gateway in front of them.

### Edge Case 3: Secure by Default and Backward Compatibility

If existing clients depend on insecure settings, changing default values constitutes a breaking change. A phased migration is required (first issue warnings, then change in the next version).

### Edge Case 4: Cost and Performance of Defense in Depth

Adding more defensive layers increases latency. Measure the performance impact of each layer and balance risk against performance.

---

## 8. Anti-Patterns

### Anti-Pattern 1: Excessive Permissions (God Mode)

Granting admin or wildcard permissions "because it's too much trouble" or "because nothing works." Allowing `*` actions on `*` resources in IAM is the most dangerous configuration possible.

```json
// BAD: God Mode policy
{
  "Effect": "Allow",
  "Action": "*",
  "Resource": "*"
}
```

Always avoid this configuration and specify concrete actions and resources. Use AWS IAM Access Analyzer to detect and remediate excessive permissions.

### Anti-Pattern 2: Security by Obscurity

Relying solely on concealment for security. The belief that "the admin URL is hard to guess, so we're fine" or "the source code is private, so it's safe" is dangerous.

```
BAD patterns:
  - Admin panel: /admin-secret-xyz123  ← URL obfuscation only, no authentication
  - API key: hardcoded in source code  ← Safe because repo is private?
  - Encryption: home-grown algorithm   ← Has not undergone public review

GOOD patterns:
  - Admin panel: /admin + strong auth (MFA) + IP restriction + audit log
  - API key: environment variable or Secrets Manager + rotation
  - Encryption: AES-256-GCM + AWS KMS-managed key
```

Obscurity can serve as a **supplementary measure**, but only on top of proper authentication, authorization, and encryption.

### Anti-Pattern 3: Bolt-on Security

The approach of "adding" security at the end of development. Security should be built in from the design phase (Security by Design / Shift Left).

```
BAD: Retrofitting security in a waterfall process
  Requirements → Design → Implementation → Testing → [Security Test] → Release
                                                          ↑
                                              Security is first considered here
                                              → Fundamental design flaws are hard to fix

GOOD: Shift Left approach
  [Threat Modeling] → [Secure Design] → [SAST] → [DAST] → Release
   ↑                  ↑                ↑         ↑
   Security is        Security         Automated  Runtime
   considered from    architecture     scanning   testing
   the design phase   review
```

---

## 9. Exercises

### Exercise 1: Designing a Least Privilege IAM Policy (Difficulty: Basic)

Write an AWS IAM policy in JSON format that satisfies the following requirements.

**Requirements:**
- Allow read access only to the `reports/` prefix in the `data-lake-prod` S3 bucket
- Allow write access only to the `uploads/` prefix in the same bucket
- Prohibit deletion entirely
- Allow access only when MFA authentication is confirmed

**Hint:** Use the Condition element to add the MFA constraint

### Exercise 2: Defense in Depth Design (Difficulty: Applied)

Design a Defense in Depth strategy for the following web application.

**System configuration:**
- Frontend: React SPA
- Backend: Python FastAPI
- Database: PostgreSQL
- Infrastructure: AWS ECS on Fargate

**Tasks:**
1. Define at least 5 defensive layers
2. Select the tools/technologies to use at each layer
3. Describe how to verify that each layer functions independently
4. Describe a scenario where one layer is breached and how to respond

### Exercise 3: Implementing a Zero Trust Policy (Difficulty: Advanced)

Implement a Zero Trust policy for the following scenario.

**Scenario:**
- An employee is attempting to access internal customer data from a café Wi-Fi using a BYOD device
- The employee has authenticated with a password but has not completed MFA
- Risk score is 0.5 (moderate)
- Previous login was from Tokyo; current IP address is from Osaka

**Tasks:**
1. Decide whether this access request should be allowed or denied
2. Explain the rationale for each check item
3. List the additional conditions required to allow access
4. Implement and write test code using the ZeroTrustPolicyEngine class above

---

## 10. Summary

| Principle | Core Concept | Implementation Points | Reference Standard |
|------|------|---------------|---------|
| Least Privilege | Grant only the minimum necessary permissions | RBAC, refined IAM policies, JIT Access | NIST AC-6 |
| Defense in Depth | Layer multiple independent defensive mechanisms | WAF + FW + input validation + encryption; independence of each layer | NIST SC-3 |
| Zero Trust | Verify all access | mTLS, micro-segmentation, continuous verification | NIST SP 800-207 |
| Secure by Default | Make the initial state secure | Safe default values, opt-out model, configuration validation | CWE-1188 |
| Fail-Safe | Transition to a safe state on failure | Default deny, block access on error | NIST AC-7 |
| Separation of Privilege | Require multiple approvals for critical operations | MFA, 4-eyes principle, Break Glass | NIST AC-5 |
| Open Design | Security must not depend on secrecy | Public cryptography, public review | Kerckhoffs' principle |

### Next Learning Steps

1. Apply each principle to your own projects and conduct a gap analysis against the current state
2. Develop a phased Zero Trust adoption plan
3. Implement tests and monitoring for each layer of your Defense in Depth strategy

---

## Further Reading

- [../01-web-security/00-owasp-top10.md](../01-web-security/00-owasp-top10.md) -- Applying security principles to concrete vulnerability mitigation
- [../04-application-security/00-secure-coding.md](../04-application-security/00-secure-coding.md) -- Applying principles at the coding level
- [../05-cloud-security/00-cloud-security-basics.md](../05-cloud-security/00-cloud-security-basics.md) -- Applying principles in cloud environments
- [../06-operations/02-compliance.md](../06-operations/02-compliance.md) -- Mapping security principles to compliance requirements

---

## FAQ

### Q1: Won't strictly applying Least Privilege reduce development efficiency?

The initial configuration cost increases, but when incident response costs are factored in, it is more efficient in the long run. A practical approach is to manage permission templates with IaC, use somewhat relaxed permissions in development environments, and apply strict permissions in production. Using AWS IAM Access Analyzer, you can narrow permissions down to only those actually used.

### Q2: Is Zero Trust necessary even on internal networks?

Yes. Many recent security incidents have involved lateral movement originating from the internal network. A state where any resource can be freely accessed after a VPN connection is dangerous. Introducing micro-segmentation and mTLS is recommended. The SolarWinds incident (2020) and the Colonial Pipeline incident (2021) were both caused by implicit trust in the internal network.

### Q3: How do you balance Secure by Default with usability?

Provide a secure default configuration while designing the system so users can explicitly relax settings when needed. For example, set a strict default CSP and add only specific CDNs to the allowlist when required. Adopt an "opt-out" model and display warnings when settings are relaxed. In line with the principle of Psychological Acceptability, it is important to integrate security in a way that does not disrupt users' natural workflows.

### Q4: Which layer should be prioritized in Defense in Depth?

From a return on investment (ROI) perspective, the following priority order is recommended: (1) Application layer (input validation, authentication and authorization) (2) Data layer (encryption) (3) Network layer (firewall, segmentation) (4) Perimeter layer (WAF) (5) Host layer (OS hardening). Application-layer defenses offer the best cost-effectiveness and can prevent many vulnerabilities at their root.

### Q5: How do you introduce Zero Trust incrementally?

The following phased approach is recommended: Phase 1: Strengthen the identity foundation (SSO + MFA); Phase 2: Introduce device management (MDM + EDR); Phase 3: Implement micro-segmentation; Phase 4: Automate continuous verification (UEBA + risk scoring). Allow 3–6 months per phase.

### Q6: How frequently should the Break Glass procedure be used?

Break Glass is a "last resort" and if it is being used more than once a month, the regular permission settings may be inadequate. Track usage frequency and, for cases that arise frequently, establish a proper standard access path. Conduct a post-use review for every use and apply the lessons learned to improve the process.

---

## References

1. Saltzer, J.H. & Schroeder, M.D., "The Protection of Information in Computer Systems" -- Proceedings of the IEEE, 1975
2. NIST SP 800-207, "Zero Trust Architecture" -- https://csrc.nist.gov/publications/detail/sp/800-207/final
3. Google BeyondCorp -- https://cloud.google.com/beyondcorp
4. OWASP Security Design Principles -- https://owasp.org/www-project-developer-guide/
5. CISA Zero Trust Maturity Model -- https://www.cisa.gov/zero-trust-maturity-model
6. NIST SP 800-160, "Systems Security Engineering" -- https://csrc.nist.gov/publications/detail/sp/800-160/vol-1/final
7. AWS Well-Architected Framework - Security Pillar -- https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/
8. CIS Controls v8 -- https://www.cisecurity.org/controls
