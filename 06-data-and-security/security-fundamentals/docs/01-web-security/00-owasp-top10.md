# OWASP Top 10

> A comprehensive guide to the ten most critical security risks in web applications, covering attack techniques, impact, and mitigation code examples.

## What You Will Learn

1. Understand the meaning and severity of each vulnerability category in **OWASP Top 10 (2021)**
2. Learn **attack techniques for each vulnerability** and how to implement countermeasures at the code level
3. Acquire **vulnerability testing techniques** and approaches to proactive security design

### Prerequisites

- HTTP protocol basics (request/response, status codes, headers)
- Fundamentals of web application development (distinction between server-side and client-side)
- Basic syntax of Python or JavaScript

### Related Guides

- [XSS Prevention](./01-xss-prevention.md) — Detailed countermeasures for cross-site scripting
- [Injection](./03-injection.md) — Deep dive into injection attacks
- [Authentication Vulnerabilities](./04-auth-vulnerabilities.md) — Details on authentication-related vulnerabilities
- [TLS/Certificates](../02-cryptography/01-tls-certificates.md) — Foundation technology for communication encryption

---

## 1. OWASP Top 10 Overview

OWASP (Open Worldwide Application Security Project) periodically publishes a ranking of web application vulnerabilities. Starting in 2003, the 2021 edition is the most recent. It uses a data-driven approach based on incident data collected from hundreds of thousands of applications.

### History and Evolution of the OWASP Top 10

```
Changes from the 2017 edition:

  2017                          2021
  ----                          ----
  A1 Injection                 → Demoted to A3
  A2 Broken Authentication     → Merged into A7
  A3 Sensitive Data Exposure   → A2 Cryptographic Failures
  A4 XML External Entities     → Merged into A3 Injection
  A5 Broken Access Control     → Promoted to A1
  A6 Security Misconfiguration → A5
  A7 XSS                      → Merged into A3 Injection
  A8 Insecure Deserialization  → A8 Software and Data Integrity Failures
  A9 Using Components with Known Vulnerabilities → A6
  A10 Insufficient Logging & Monitoring → A9

  New additions (2021):
  A04 Insecure Design ← NEW
  A08 Software and Data Integrity Failures ← Reorganized
  A10 SSRF ← NEW
```

### Category List and Severity

```
OWASP Top 10 (2021):

  Rank    Category                                      Severity
  ----    --------                                      --------
  A01     Broken Access Control                          ████████████ Critical
  A02     Cryptographic Failures                         ███████████  Critical
  A03     Injection                                      ██████████   High
  A04     Insecure Design                                ██████████   High
  A05     Security Misconfiguration                      █████████    High
  A06     Vulnerable and Outdated Components             ████████     High
  A07     Identification and Authentication Failures     ████████     High
  A08     Software and Data Integrity Failures           ███████      Medium
  A09     Security Logging and Monitoring Failures       ██████       Medium
  A10     SSRF (Server-Side Request Forgery)             ██████       Medium
```

### CWE Mapping for Each Category

```
+------------------------------------------------------------------+
|  OWASP Category to Key CWE Mapping                               |
|------------------------------------------------------------------|
|  A01 Broken Access Control                                        |
|    +-- CWE-200: Information Exposure                             |
|    +-- CWE-284: Improper Access Control                          |
|    +-- CWE-285: Improper Authorization                           |
|    +-- CWE-639: IDOR (Insecure Direct Object Reference)          |
|                                                                    |
|  A02 Cryptographic Failures                                       |
|    +-- CWE-259: Hard-coded Password                              |
|    +-- CWE-327: Broken or Risky Cryptographic Algorithm          |
|    +-- CWE-328: Weak Hash                                        |
|    +-- CWE-916: Insufficient Computational Effort for Password Hash |
|                                                                    |
|  A03 Injection                                                    |
|    +-- CWE-20: Improper Input Validation                         |
|    +-- CWE-79: XSS                                               |
|    +-- CWE-89: SQL Injection                                     |
|    +-- CWE-78: OS Command Injection                              |
+------------------------------------------------------------------+
```

---

## 2. A01: Broken Access Control

A vulnerability that allows access to unauthorized resources. In the 2021 edition, this was promoted from A5 to A1, making it the most critical category. Access control issues were detected in 94% of surveyed applications.

### Classification of Attack Techniques

```
+------------------------------------------------------------------+
|  Access Control Attack Techniques                                 |
|------------------------------------------------------------------|
|                                                                    |
|  [Horizontal Privilege Escalation]                                |
|  +-- IDOR: /api/users/123 → access another user's data via /api/users/456 |
|  +-- Parameter tampering: user_id=me → user_id=admin            |
|                                                                    |
|  [Vertical Privilege Escalation]                                  |
|  +-- URL manipulation: /user/dashboard → /admin/dashboard        |
|  +-- API method: GET (allowed) → DELETE (originally forbidden)   |
|  +-- Forced browsing: guessing and accessing non-public URLs      |
|                                                                    |
|  [Context-Dependent Failures]                                     |
|  +-- Multi-tenant: user of tenant A accesses data of tenant B    |
|  +-- State manipulation: skipping workflow steps                  |
|  +-- Metadata manipulation: tampering with JWT role claims        |
+------------------------------------------------------------------+
```

### IDOR (Insecure Direct Object Reference) in Detail

IDOR is the most frequently discovered access control vulnerability. An attacker can access another user's data simply by tampering with IDs in URL parameters or the request body.

```python
# Code Example 1: Implementing secure access control
from functools import wraps
from flask import Flask, request, abort, g
import uuid

app = Flask(__name__)

# ===== Bad example: IDOR vulnerability =====
@app.route("/api/orders/<int:order_id>")
def get_order_bad(order_id):
    # Anyone can access any order_id
    order = db.query("SELECT * FROM orders WHERE id = ?", order_id)
    return jsonify(order)

# ===== Good example: With ownership check =====
@app.route("/api/orders/<int:order_id>")
@login_required
def get_order_good(order_id):
    order = db.query(
        "SELECT * FROM orders WHERE id = ? AND user_id = ?",
        order_id, g.current_user.id  # Filter by user ID
    )
    if not order:
        abort(404)  # Return 404 instead of 403 (prevent information leakage)
    return jsonify(order)


# ===== Role-Based Access Control (RBAC) =====
class Permission:
    """Permission definitions"""
    READ_OWN = "read:own"
    READ_ALL = "read:all"
    WRITE_OWN = "write:own"
    WRITE_ALL = "write:all"
    ADMIN = "admin"

ROLE_PERMISSIONS = {
    "user":    [Permission.READ_OWN, Permission.WRITE_OWN],
    "manager": [Permission.READ_OWN, Permission.WRITE_OWN, Permission.READ_ALL],
    "admin":   [Permission.READ_OWN, Permission.WRITE_OWN,
                Permission.READ_ALL, Permission.WRITE_ALL, Permission.ADMIN],
}

def require_permission(permission):
    """Permission-based authorization decorator"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not g.current_user:
                abort(401)
            user_permissions = ROLE_PERMISSIONS.get(g.current_user.role, [])
            if permission not in user_permissions:
                # Record audit log
                audit_log.warning(
                    f"Access denied: user={g.current_user.id}, "
                    f"permission={permission}, path={request.path}"
                )
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator


def require_role(role):
    """Role-based access control decorator"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not g.current_user or g.current_user.role != role:
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/admin/users")
@login_required
@require_role("admin")
def admin_users():
    """Accessible only to administrators"""
    return jsonify(db.query("SELECT id, name FROM users"))


# ===== ABAC (Attribute-Based Access Control) Implementation =====
class ABACPolicy:
    """Attribute-Based Access Control"""

    def __init__(self):
        self.policies = []

    def add_policy(self, resource_type, action, condition_fn):
        self.policies.append({
            "resource_type": resource_type,
            "action": action,
            "condition": condition_fn,
        })

    def check(self, user, resource_type, action, resource=None):
        for policy in self.policies:
            if (policy["resource_type"] == resource_type and
                policy["action"] == action):
                if policy"condition":
                    return True
        return False

abac = ABACPolicy()

# Policy definition: only the document owner can edit
abac.add_policy(
    "document", "edit",
    lambda user, doc: doc.owner_id == user.id
)

# Policy definition: managers in the same department can view
abac.add_policy(
    "document", "view",
    lambda user, doc: (
        user.department == doc.department and
        user.role in ["manager", "admin"]
    )
)

# Policy definition: anyone can view public documents
abac.add_policy(
    "document", "view",
    lambda user, doc: doc.visibility == "public"
)
```

### IDOR Mitigation with UUIDs

```python
# Code Example 2: Using hard-to-guess IDs
import uuid

class Order:
    def __init__(self, user_id, items):
        # Use UUIDv4 instead of sequential IDs
        self.id = str(uuid.uuid4())  # "a3b8f9c2-1d4e-4a6b-8c3d-9e7f0a1b2c3d"
        self.user_id = user_id
        self.items = items

# Note: Using UUIDs is not a fundamental fix for IDOR
# It makes guessing harder, but authorization checks are still required

@app.route("/api/orders/<order_id>")
@login_required
def get_order(order_id):
    # Ownership check is required even with UUIDs
    order = Order.query.filter_by(
        id=order_id,
        user_id=g.current_user.id
    ).first_or_404()
    return jsonify(order.to_dict())
```

---

## 3. A02: Cryptographic Failures

A vulnerability where sensitive data is inadequately encrypted or where the encryption design is flawed. In the 2017 edition, this was called "Sensitive Data Exposure," but the name was changed to reflect the root cause: cryptographic failures.

### Cryptographic Failure Patterns

```
+------------------------------------------------------------------+
|  Cryptographic Failure Patterns                                   |
|------------------------------------------------------------------|
|                                                                    |
|  [Data in Transit]                                                |
|  +-- Sending sensitive data over HTTP (non-HTTPS)                |
|  +-- Using TLS 1.0/1.1 (known vulnerabilities)                   |
|  +-- Allowing weak cipher suites (RC4, DES, 3DES)               |
|  +-- Disabling certificate validation                             |
|                                                                    |
|  [Data at Rest]                                                   |
|  +-- Storing passwords in plaintext                               |
|  +-- Hashing passwords with MD5/SHA-1                            |
|  +-- Hashing without salt                                         |
|  +-- Not encrypting the database                                  |
|  +-- Unencrypted backups                                          |
|                                                                    |
|  [Misuse of Cryptographic Algorithms]                             |
|  +-- Using ECB mode (pattern leakage)                            |
|  +-- Using a fixed IV/nonce                                       |
|  +-- Using homegrown cryptography                                 |
|  +-- Insufficient key length (RSA 1024-bit, AES below 128-bit)   |
+------------------------------------------------------------------+
```

### Data Classification and Encryption Requirements

| Data Classification | Examples | Encryption in Transit | Encryption at Rest | Access Control | Retention Period |
|---------------------|----------|-----------------------|--------------------|----------------|-----------------|
| Public | Press releases | Recommended | Not required | Not required | Indefinite |
| Internal | Internal documents | Required | Recommended | Role-based | Per policy |
| Confidential | Customer information | Required (TLS 1.2+) | Required (AES-256) | Least privilege | Per regulations |
| Restricted | Credit card data | Required (TLS 1.3) | Required (HSM-managed keys) | Need-to-know | PCI DSS compliant |

```python
# Code Example 3: Implementing proper encryption
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import bcrypt
import os
import base64
import hmac
import hashlib

class SecureCrypto:
    """Secure cryptographic utilities"""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password (using bcrypt)

        Why bcrypt is recommended:
        1. Salt is automatically generated and applied
        2. Cost factor (rounds) allows adjustment of computation time
        3. Resistant to parallel attacks by GPU/ASIC
        4. Uses constant-time comparison against timing attacks
        """
        # Bad example: direct use of MD5 or SHA-256
        # hashlib.md5(password.encode()).hexdigest()  # NG!
        # hashlib.sha256(password.encode()).hexdigest()  # NG!

        # Good example: salted hash with bcrypt
        # rounds=12 is the recommended minimum as of 2025
        # Consider increasing to 13-14 depending on server capacity
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode(), salt).decode()

    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify a password (constant-time comparison)"""
        return bcrypt.checkpw(password.encode(), hashed.encode())

    @staticmethod
    def hash_password_argon2(password: str) -> str:
        """Password hashing with Argon2id (OWASP recommended)

        Argon2id is the password hashing algorithm most recommended by OWASP.
        As a memory-hard function, it provides stronger resistance to GPU/ASIC attacks than bcrypt.
        """
        from argon2 import PasswordHasher
        # OWASP recommended parameters (2024):
        # memory_cost=65536 (64MB), time_cost=3, parallelism=4
        ph = PasswordHasher(
            memory_cost=65536,   # 64MB
            time_cost=3,         # 3 iterations
            parallelism=4,       # 4 threads
            hash_len=32,         # 256-bit output
            salt_len=16,         # 128-bit salt
        )
        return ph.hash(password)

    @staticmethod
    def encrypt_sensitive_data(plaintext: str, master_key: bytes) -> str:
        """Encrypt sensitive data (AES-256-GCM)

        Why to use GCM mode (Galois/Counter Mode):
        1. Authenticated encryption (AEAD): achieves both encryption and tamper detection
        2. Parallelizable: faster than CBC mode
        3. IV reuse is fatal: generate a random 12-byte nonce each time
        """
        # Nonce must be uniquely generated each time (12 bytes recommended)
        nonce = os.urandom(12)
        key = AESGCM.generate_key(bit_length=256) if not master_key else master_key[:32]

        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)

        # Combine nonce + ciphertext and return
        return base64.b64encode(nonce + ciphertext).decode()

    @staticmethod
    def encrypt_with_kdf(plaintext: str, master_key: bytes) -> str:
        """Encryption using a KDF (key derivation function)"""
        # Derive encryption key from master key using PBKDF2
        salt = os.urandom(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,  # OWASP recommended: minimum 600,000 (for PBKDF2-SHA256)
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_key))
        f = Fernet(key)
        encrypted = f.encrypt(plaintext.encode())
        # Combine salt + ciphertext and return
        return base64.b64encode(salt + encrypted).decode()

    @staticmethod
    def constant_time_compare(a: str, b: str) -> bool:
        """Constant-time string comparison (defense against timing attacks)

        Regular == comparison returns immediately on the first mismatched character,
        allowing an attacker to infer the correct string from response time differences.
        """
        return hmac.compare_digest(a.encode(), b.encode())


# Password hashing algorithm comparison table
"""
+------------------------------------------------------------------+
|  Password Hashing Algorithm Comparison                            |
|------------------------------------------------------------------|
|  Algorithm  | GPU Resistance | Memory Use | OWASP Rec | Notes   |
|  -----------|----------------|------------|-----------|---------|
|  MD5         | Weakest       | Minimal    | Not rec.  | Collision attacks are easy |
|  SHA-256     | Weak          | Minimal    | Not rec.  | Too fast |
|  bcrypt      | Medium        | Fixed 4KB  | Rec.      | 72-byte limit |
|  scrypt      | Strong        | Variable   | Rec.      | Complex parameter tuning |
|  Argon2id    | Strongest     | Variable   | Most rec. | PHC winner (2015) |
+------------------------------------------------------------------+
"""
```

---

## 4. A03: Injection

A vulnerability where user input is interpreted as part of code or a query. Includes SQL injection, XSS, command injection, LDAP injection, and others.

### Internal Mechanism of Injection Attacks

```
How SQL Injection Works:

Normal query:
  Input: "alice"
  Query: SELECT * FROM users WHERE name = 'alice'
  Result: Only alice's data is returned

Attack query:
  Input: "' OR '1'='1' --"
  Query: SELECT * FROM users WHERE name = '' OR '1'='1' --'
                                        ~~~~~~~~~~~~~~~
                                        Always TRUE → all records returned

UNION attack:
  Input: "' UNION SELECT username, password FROM admin_users --"
  Query: SELECT name, email FROM users WHERE name = ''
          UNION SELECT username, password FROM admin_users --'
  Result: Admin usernames and passwords are leaked

Second-order injection:
  Step 1: Register with the name "admin'--" at sign-up (stored after escaping)
  Step 2: Fetch name from DB during password change and use it in query
          UPDATE users SET password='new' WHERE name='admin'--'
          → admin's password is changed
```

```python
# Code Example 4: Comprehensive injection countermeasures
import sqlite3
import subprocess
import shlex
import re

# ===== SQL Injection Countermeasures =====

# Bad example: building SQL by string concatenation
def search_users_bad(username):
    query = f"SELECT * FROM users WHERE name = '{username}'"
    return db.execute(query)  # ' OR '1'='1 retrieves all records

# Good example 1: parameterized queries
def search_users_good(username):
    query = "SELECT * FROM users WHERE name = ?"
    return db.execute(query, (username,))

# Good example 2: using an ORM (SQLAlchemy)
from sqlalchemy import select
from models import User

def search_users_orm(session, username):
    stmt = select(User).where(User.name == username)
    return session.execute(stmt).scalars().all()

# Good example 3: using stored procedures
def search_users_stored_proc(username):
    return db.execute("CALL search_users(?)", (username,))


# ===== OS Command Injection Countermeasures =====

# Bad example: os.system / shell=True
def ping_host_bad(hostname):
    os.system(f"ping -c 1 {hostname}")  # ; rm -rf / can be injected

# Good example: subprocess without shell
def ping_host_good(hostname):
    # Whitelist validation
    if not re.match(r'^[a-zA-Z0-9\.\-]+$', hostname):
        raise ValueError("Invalid hostname")
    # Execute with shell=False (default)
    result = subprocess.run(
        ["ping", "-c", "1", hostname],
        capture_output=True, text=True, timeout=10
    )
    return result.stdout


# ===== Template Injection (SSTI) Countermeasures =====
from jinja2 import Environment, select_autoescape, sandbox

# Bad example: evaluating user input as a template
def render_bad(user_input):
    from jinja2 import Template
    return Template(user_input).render()  # {{7*7}} → 49, RCE possible

# Good example: using a sandboxed environment
def render_good(template_name, context):
    env = sandbox.SandboxedEnvironment(
        autoescape=select_autoescape(['html', 'xml'])
    )
    template = env.get_template(template_name)
    return template.render(**context)


# ===== LDAP Injection Countermeasures =====
import ldap3

# Bad example: string concatenation
def search_ldap_bad(username):
    filter_str = f"(uid={username})"  # *)(uid=*))(|(uid=* retrieves all records
    conn.search("dc=example,dc=com", filter_str)

# Good example: using an escape function
def search_ldap_good(username):
    from ldap3.utils.conv import escape_filter_chars
    safe_username = escape_filter_chars(username)
    filter_str = f"(uid={safe_username})"
    conn.search("dc=example,dc=com", filter_str)
```

### XSS (Cross-Site Scripting) Classification

```
+------------------------------------------------------------------+
|  Three Types of XSS                                               |
|------------------------------------------------------------------|
|                                                                    |
|  [Reflected XSS]                                                  |
|  Attacker → malicious URL → victim clicks                        |
|  → server includes user input in response                        |
|  → script executes in browser                                    |
|  Example: https://site.com/search?q=<script>alert(1)</script>    |
|                                                                    |
|  [Stored XSS]                                                     |
|  Attacker → posts script to bulletin board → saved to DB         |
|  → script executes when other users view the page                |
|  Example: <img src=x onerror=steal(cookie)> in a comment field   |
|                                                                    |
|  [DOM-based XSS]                                                  |
|  Attacker → script in URL fragment                               |
|  → client-side JS inserts into DOM                               |
|  Example: https://site.com/page#<img src=x onerror=alert(1)>    |
|  document.getElementById('x').innerHTML = location.hash          |
+------------------------------------------------------------------+
```

```python
# Code Example 5: XSS countermeasure implementation
from markupsafe import escape
from flask import Flask, Markup

app = Flask(__name__)

# Bad example: directly embedding user input in HTML
@app.route("/profile")
def profile_bad():
    name = request.args.get("name")
    return f"<h1>Welcome, {name}</h1>"  # XSS vulnerable

# Good example 1: escaping
@app.route("/profile")
def profile_good():
    name = escape(request.args.get("name", ""))
    return f"<h1>Welcome, {name}</h1>"

# Good example 2: automatic escaping via template engine
# templates/profile.html: <h1>Welcome, {{ name }}</h1>
# Jinja2 auto-escapes by default

# CSP (Content Security Policy) configuration
@app.after_request
def set_csp(response):
    """CSP header to minimize the impact of XSS"""
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'nonce-{nonce}'; "  # nonce-based allowlist
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    return response
```

---

## 5. A04: Insecure Design

Vulnerabilities stemming from a lack of security consideration at the design stage. These are architectural issues that cannot be resolved by coding-level countermeasures alone.

### Threat Modeling (STRIDE)

```
+------------------------------------------------------------------+
|  STRIDE Threat Modeling Framework                                 |
|------------------------------------------------------------------|
|                                                                    |
|  S - Spoofing                                                     |
|    → Countermeasures: authentication, certificates, MFA          |
|                                                                    |
|  T - Tampering                                                    |
|    → Countermeasures: integrity checks, MAC, digital signatures  |
|                                                                    |
|  R - Repudiation                                                  |
|    → Countermeasures: audit logs, timestamps, digital signatures  |
|                                                                    |
|  I - Information Disclosure                                       |
|    → Countermeasures: encryption, access control, least privilege |
|                                                                    |
|  D - Denial of Service                                            |
|    → Countermeasures: rate limiting, resource limits, redundancy  |
|                                                                    |
|  E - Elevation of Privilege                                       |
|    → Countermeasures: least privilege, input validation, sandbox  |
+------------------------------------------------------------------+
```

### Secure Design Patterns

```python
# Code Example 6: Security design for business logic
from datetime import datetime, timedelta
from collections import defaultdict

class SecurePasswordReset:
    """Secure password reset design

    Examples of insecure design:
    - Reset links are predictable (sequential IDs)
    - Reset tokens have no expiry
    - No rate limiting (enumeration attacks possible)
    - "User does not exist" error message (information leakage)
    """

    def __init__(self):
        self.reset_tokens = {}
        self.attempt_counts = defaultdict(list)
        self.TOKEN_EXPIRY = timedelta(minutes=15)  # Short expiry
        self.MAX_ATTEMPTS = 3  # Up to 3 times per hour

    def request_reset(self, email: str) -> dict:
        # Rate limit check
        now = datetime.utcnow()
        recent = [t for t in self.attempt_counts[email]
                  if t > now - timedelta(hours=1)]
        self.attempt_counts[email] = recent

        if len(recent) >= self.MAX_ATTEMPTS:
            # Return the same response (prevent information leakage)
            return {"message": "If the email exists, a reset link has been sent."}

        self.attempt_counts[email].append(now)

        # Return the same response regardless of whether the user exists
        user = find_user_by_email(email)
        if user:
            token = secrets.token_urlsafe(32)  # 256-bit random token
            self.reset_tokens[token] = {
                "user_id": user.id,
                "expires_at": now + self.TOKEN_EXPIRY,
                "used": False,
            }
            send_reset_email(email, token)

        # Do not reveal user existence to the attacker
        return {"message": "If the email exists, a reset link has been sent."}

    def verify_reset(self, token: str, new_password: str) -> bool:
        data = self.reset_tokens.get(token)
        if not data:
            return False
        if data["used"]:
            return False  # One-time use
        if datetime.utcnow() > data["expires_at"]:
            del self.reset_tokens[token]
            return False

        # Mark token as used
        data["used"] = True
        update_password(data["user_id"], new_password)

        # Invalidate all other sessions
        invalidate_all_sessions(data["user_id"])

        return True
```

---

## 6. A05: Security Misconfiguration

Security issues caused by configuration errors, such as forgetting to change default settings, enabling unnecessary features, or granting excessive permissions.

### Common Misconfigurations and Countermeasures

```python
# Code Example 7: Comprehensive security header configuration
from flask import Flask, Response

app = Flask(__name__)

# Disable debug mode in production
app.config["DEBUG"] = False
app.config["TESTING"] = False

# Secure session configuration
app.config["SESSION_COOKIE_SECURE"] = True       # HTTPS required
app.config["SESSION_COOKIE_HTTPONLY"] = True      # Not accessible from JavaScript
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"    # CSRF protection
app.config["PERMANENT_SESSION_LIFETIME"] = 1800   # Timeout after 30 minutes

@app.after_request
def set_security_headers(response: Response) -> Response:
    """Attach security headers to all responses"""
    # XSS filter (delegated to CSP)
    response.headers["X-XSS-Protection"] = "0"

    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # Content Security Policy (most important header for XSS mitigation)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self' https://api.example.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "upgrade-insecure-requests"
    )

    # Enforce HTTPS (HSTS)
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # Referrer control
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Browser feature restrictions
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), "
        "payment=(), usb=(), magnetometer=()"
    )

    # Cache control (sensitive data)
    if "api" in request.path:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"

    return response


# Error handlers (prevent information leakage)
@app.errorhandler(500)
def internal_error(error):
    """Do not return stack traces in production"""
    app.logger.error(f"Internal error: {error}", exc_info=True)
    return {"error": "Internal server error"}, 500

@app.errorhandler(404)
def not_found(error):
    return {"error": "Resource not found"}, 404
```

### Hardening Checklist

```
+------------------------------------------------------------------+
|  Server Hardening Checklist                                       |
|------------------------------------------------------------------|
|  [ ] Change default accounts/passwords                           |
|  [ ] Disable unnecessary ports and services                      |
|  [ ] Disable directory listing                                    |
|  [ ] Hide server version information                              |
|  [ ] Disable debug mode                                           |
|  [ ] Hide stack traces                                            |
|  [ ] Configure CORS properly                                      |
|  [ ] Restrict HTTP methods (disable OPTIONS, TRACE, etc.)        |
|  [ ] Enforce TLS 1.2+                                            |
|  [ ] Configure security headers                                   |
|  [ ] Set proper Cookie attributes (Secure, HttpOnly, SameSite)   |
|  [ ] Restrict and validate file uploads                           |
|  [ ] Customize error pages                                        |
+------------------------------------------------------------------+
```

---

## 7. A06: Vulnerable and Outdated Components

Using libraries, frameworks, or other software components with known vulnerabilities. This is an entry point for supply chain attacks.

### Dependency Management

```bash
# Code Example 8: Security checks for dependencies

# Python: pip-audit
pip install pip-audit
pip-audit

# Python: Safety
pip install safety
safety check

# Node.js: npm audit
npm audit
npm audit fix

# Go: govulncheck
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...

# Rust: cargo-audit
cargo install cargo-audit
cargo audit

# Multi-language: Trivy
trivy fs --scanners vuln .
```

### SCA (Software Composition Analysis) Tool Comparison

| Tool | Supported Languages | Cost | Features |
|------|---------------------|------|----------|
| Dependabot | Many | Free (GitHub) | Auto PR creation |
| Snyk | Many | Freemium | Detailed fix suggestions |
| OWASP Dependency-Check | Java, .NET | Free | NVD-based |
| pip-audit | Python | Free | OSV/PyPI database |
| npm audit | Node.js | Free | Built into npm |
| Trivy | Many | Free | Also supports containers |

```yaml
# GitHub Actions: Dependabot configuration
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "security"
    reviewers:
      - "security-team"
```

---

## 8. A07: Identification and Authentication Failures

### Implementing Secure Authentication

```python
# Code Example 9: Session management best practices
import secrets
from datetime import datetime, timedelta
from flask import Flask, session, request

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # 256-bit

class SecureSessionManager:
    """Secure session management"""

    def __init__(self):
        self.sessions = {}
        self.MAX_SESSIONS_PER_USER = 5

    def create_session(self, user_id: str, ip: str, user_agent: str) -> str:
        """Create a session"""
        # Check number of existing sessions
        user_sessions = [
            s for s in self.sessions.values()
            if s["user_id"] == user_id and not s["expired"]
        ]
        if len(user_sessions) >= self.MAX_SESSIONS_PER_USER:
            # Invalidate the oldest session
            oldest = min(user_sessions, key=lambda s: s["created_at"])
            oldest["expired"] = True

        session_id = secrets.token_urlsafe(32)  # 256-bit random ID
        self.sessions[session_id] = {
            "user_id": user_id,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "ip": ip,
            "user_agent": user_agent,
            "expired": False,
        }
        return session_id

    def validate_session(self, session_id: str, ip: str) -> bool:
        """Validate a session"""
        data = self.sessions.get(session_id)
        if not data or data["expired"]:
            return False

        # Absolute timeout: 24 hours from creation
        if datetime.utcnow() - data["created_at"] > timedelta(hours=24):
            data["expired"] = True
            return False

        # Idle timeout: 30 minutes from last activity
        if datetime.utcnow() - data["last_activity"] > timedelta(minutes=30):
            data["expired"] = True
            return False

        # Detect IP change (defense against session hijacking)
        if data["ip"] != ip:
            audit_log.warning(
                f"Session IP mismatch: session={session_id}, "
                f"original={data['ip']}, current={ip}"
            )
            # Strict mode: invalidate session
            # data["expired"] = True
            # return False

        data["last_activity"] = datetime.utcnow()
        return True

    def destroy_session(self, session_id: str):
        """Destroy a session (on logout)"""
        if session_id in self.sessions:
            self.sessions[session_id]["expired"] = True

    def destroy_all_user_sessions(self, user_id: str):
        """Destroy all sessions (on password change)"""
        for session_data in self.sessions.values():
            if session_data["user_id"] == user_id:
                session_data["expired"] = True
```

### Authentication Method Comparison

| Method | Security | UX | Implementation Complexity | Use Case |
|--------|----------|----|--------------------------|----------|
| Password only | Low | Easy | Low | Not recommended |
| Password + TOTP | Medium | Somewhat inconvenient | Medium | Common |
| Password + WebAuthn | High | Inconvenient only at first | Medium | Recommended |
| Passkeys | High | Easy | Medium | Most recommended |
| SSO (SAML/OIDC) | High | Easy | High | Enterprise |

---

## 9. A08-A10: Detailed Explanation

### A08: Software and Data Integrity Failures

Compromise of CI/CD pipelines, insecure deserialization, and lack of software update verification.

```python
# Code Example 10: Secure deserialization
import json
import hmac
import hashlib

# Bad example: direct use of pickle (risk of arbitrary code execution)
import pickle
def load_bad(data):
    return pickle.loads(data)  # Absolutely NG! RCE possible

# Good example: JSON serialization + signature verification
class SecureSerializer:
    def __init__(self, secret_key: bytes):
        self.secret_key = secret_key

    def serialize(self, data: dict) -> str:
        """Serialize data and sign it"""
        payload = json.dumps(data, sort_keys=True)
        signature = hmac.new(
            self.secret_key, payload.encode(), hashlib.sha256
        ).hexdigest()
        return json.dumps({"payload": payload, "signature": signature})

    def deserialize(self, raw: str) -> dict:
        """Verify signature and deserialize"""
        container = json.loads(raw)
        expected_sig = hmac.new(
            self.secret_key,
            container["payload"].encode(),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, container["signature"]):
            raise ValueError("Signature verification failed")
        return json.loads(container["payload"])
```

### A09: Security Logging and Monitoring Failures

```python
# Code Example 11: Structured security logging
import logging
import json
from datetime import datetime

class SecurityLogger:
    """Logger dedicated to security events"""

    def __init__(self):
        self.logger = logging.getLogger("security")
        handler = logging.FileHandler("/var/log/app/security.json")
        handler.setFormatter(logging.Formatter("%(message)s"))
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)

    def log_event(self, event_type: str, details: dict):
        """Record a structured security event"""
        event = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event_type": event_type,
            "details": details,
            "source_ip": request.remote_addr if request else None,
            "user_agent": request.headers.get("User-Agent") if request else None,
        }
        self.logger.info(json.dumps(event))

    def log_auth_failure(self, username: str, reason: str):
        self.log_event("AUTH_FAILURE", {
            "username": username,
            "reason": reason,
        })

    def log_access_denied(self, user_id: str, resource: str):
        self.log_event("ACCESS_DENIED", {
            "user_id": user_id,
            "resource": resource,
        })

    def log_suspicious_activity(self, user_id: str, activity: str):
        self.log_event("SUSPICIOUS", {
            "user_id": user_id,
            "activity": activity,
            "severity": "HIGH",
        })

# Events that should be logged:
# - Authentication success/failure
# - Access control denials
# - Input validation failures
# - Session creation/destruction
# - Permission changes
# - Administrative operations (user creation, configuration changes)
# - High-value transactions / critical operations
```

### A10: SSRF (Server-Side Request Forgery)

```python
# Code Example 12: Complete SSRF protection implementation
import ipaddress
import socket
from urllib.parse import urlparse
import re

class SSRFProtection:
    """URL validation to prevent SSRF attacks

    SSRF attack scenarios:
    1. Accessing internal metadata APIs
       (AWS: http://169.254.169.254/latest/meta-data/)
    2. Port scanning internal services
    3. Stealing cloud provider credentials
    4. Reading files on internal networks (file://)
    """

    BLOCKED_NETWORKS = [
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
        ipaddress.ip_network("127.0.0.0/8"),
        ipaddress.ip_network("169.254.0.0/16"),  # Link-local / metadata
        ipaddress.ip_network("100.64.0.0/10"),   # CGNAT range
        ipaddress.ip_network("::1/128"),          # IPv6 loopback
        ipaddress.ip_network("fc00::/7"),         # IPv6 ULA
        ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
    ]

    ALLOWED_SCHEMES = {"http", "https"}
    ALLOWED_PORTS = {80, 443, 8080, 8443}

    @classmethod
    def validate_url(cls, url: str) -> bool:
        """Validate a URL to be used for external access"""
        parsed = urlparse(url)

        # Scheme check
        if parsed.scheme not in cls.ALLOWED_SCHEMES:
            return False

        # Port check
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if port not in cls.ALLOWED_PORTS:
            return False

        # Hostname validation
        hostname = parsed.hostname
        if not hostname:
            return False

        # DNS rebinding protection: directly check dotted numeric IPs
        try:
            ip = ipaddress.ip_address(hostname)
            return not cls._is_blocked(ip)
        except ValueError:
            pass  # DNS resolution needed for hostnames

        # Resolve host and detect private IPs
        try:
            # Resolve all addresses (defense against CNAME chains)
            addrinfos = socket.getaddrinfo(hostname, port)
            for family, _, _, _, sockaddr in addrinfos:
                ip = ipaddress.ip_address(sockaddr[0])
                if cls._is_blocked(ip):
                    return False
        except (socket.gaierror, ValueError):
            return False

        return True

    @classmethod
    def _is_blocked(cls, ip: ipaddress.IPv4Address) -> bool:
        for network in cls.BLOCKED_NETWORKS:
            if ip in network:
                return True
        return False

    @classmethod
    def safe_fetch(cls, url: str, timeout: int = 10) -> bytes:
        """Safely fetch an external URL"""
        if not cls.validate_url(url):
            raise ValueError(f"Blocked URL: {url}")

        import requests
        response = requests.get(
            url,
            timeout=timeout,
            allow_redirects=False,  # Handle redirects manually
            headers={"User-Agent": "MyApp/1.0"},
        )

        # Also validate redirect destinations
        if response.is_redirect:
            redirect_url = response.headers.get("Location")
            if redirect_url and cls.validate_url(redirect_url):
                return cls.safe_fetch(redirect_url, timeout)
            raise ValueError(f"Blocked redirect: {redirect_url}")

        return response.content
```

---

## 10. Countermeasure Comparison for Each Vulnerability

| Vulnerability | Key Countermeasures | Tools | Detection Phase | CWE |
|---------------|---------------------|-------|-----------------|-----|
| A01 Access Control | RBAC, ownership checks | Burp Suite | DAST | CWE-284 |
| A02 Cryptographic Failures | TLS 1.3, AES-GCM, bcrypt | testssl.sh | Design review | CWE-327 |
| A03 Injection | Parameterized queries, ORM | SQLMap, SAST | SAST/DAST | CWE-89 |
| A04 Insecure Design | Threat modeling, security requirements | - | Design review | CWE-501 |
| A05 Misconfiguration | Hardening, IaC | ScoutSuite | Configuration audit | CWE-16 |
| A06 Outdated Components | SCA, auto-update | Dependabot | SCA | CWE-1104 |
| A07 Authentication Failures | MFA, rate limiting | Hydra | Penetration testing | CWE-287 |
| A08 Integrity Failures | Signature verification, SRI | Sigstore | CI/CD | CWE-502 |
| A09 Logging Failures | SIEM, audit logs | ELK Stack | Operational monitoring | CWE-778 |
| A10 SSRF | URL validation, network segmentation | Burp Suite | DAST | CWE-918 |

### Countermeasure Implementation Priority Matrix

```
+------------------------------------------------------------------+
|  Impact vs. Remediation Cost Matrix                               |
|------------------------------------------------------------------|
|                                                                    |
|  Impact: High |  A01 Access Control   |  A04 Secure Design    |  |
|               |  A03 Injection        |  (Address at design)  |  |
|               |  (Address immediately)|                        |  |
|  -------------|----------------------|-----------------------|  |
|  Impact: Med  |  A02 Cryptography     |  A06 Components       |  |
|               |  A05 Misconfiguration |  A08 Integrity        |  |
|               |  A07 Authentication   |                        |  |
|  -------------|----------------------|-----------------------|  |
|  Impact: Low  |  A10 SSRF            |  A09 Logging          |  |
|               |  (Network isolation)  |  (Operational impr.)  |  |
|               |                       |                        |  |
|               |  Cost: Low            |  Cost: High            |  |
+------------------------------------------------------------------+
```

---

## 11. Security Testing Techniques

### SAST / DAST / IAST Comparison

| Method | Full Name | Test Target | Timing | Strengths | Weaknesses |
|--------|-----------|-------------|--------|-----------|------------|
| SAST | Static Application Security Testing | Source code | During development | Early detection, high coverage | High false positives |
| DAST | Dynamic Application Security Testing | Running application | During testing | Simulates real attacks | Low coverage |
| IAST | Interactive Application Security Testing | Running app + code | During testing | Low false positives, high accuracy | Requires an agent |
| SCA | Software Composition Analysis | Dependencies | At build time | Detects known vulnerabilities | Cannot detect 0-days |

### Automated Security Testing Pipeline

```yaml
# GitHub Actions: Comprehensive security testing
name: Security Pipeline
on:
  pull_request:
    branches: [main]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep SAST
        uses: returntocorp/semgrep-action@v1
        with:
          config: "p/owasp-top-ten"

  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: pip-audit
        run: |
          pip install pip-audit
          pip-audit -r requirements.txt

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
```

---

## 12. Edge Case Analysis

### Edge Case 1: JWT `alg` Header Manipulation

An attacker changes the `alg` field in a JWT to `none` to bypass signature verification. Alternatively, they change `RS256` (asymmetric) to `HS256` (symmetric) and use the public key as the HMAC key.

```python
# Countermeasure: explicitly specify the algorithm; do not trust the header value
import jwt

# NG: trusting the alg from the header
payload = jwt.decode(token, key, algorithms=jwt.get_unverified_header(token)["alg"])

# OK: fix the allowed algorithm
payload = jwt.decode(token, public_key, algorithms=["RS256"])
```

### Edge Case 2: Access Control Bypass via Unicode Normalization

```
URL: /admin/settings  → 403 Forbidden (blocked)
URL: /ａdmin/settings → 200 OK (bypassed using Unicode full-width 'ａ')
URL: /admin%2fsettings → Path interpretation differs by server
```

Countermeasure: Apply access control checks after performing path normalization.

### Edge Case 3: HTTP Method Inconsistency

```
GET /api/users/123  → Authorization check present → 403
HEAD /api/users/123 → No authorization check → 200 (information leakage)
OPTIONS /api/users/123 → CORS preflight → allowed method list is leaked
```

Countermeasure: Implement consistent authorization checks for all HTTP methods.

### Edge Case 4: Authorization Bypass via Race Condition

```python
# TOCTOU (Time of Check to Time of Use) problem
# Step 1: Balance check (balance: 100 JPY)
# Step 2: Withdrawal process (withdraw 100 JPY)
# Concurrent request: if the same request arrives between Step 1 and Step 2, double withdrawal occurs

# Countermeasure: database-level locking
def withdraw(user_id, amount):
    with db.transaction():
        balance = db.execute(
            "SELECT balance FROM accounts WHERE user_id = ? FOR UPDATE",
            (user_id,)
        ).fetchone()
        if balance[0] >= amount:
            db.execute(
                "UPDATE accounts SET balance = balance - ? WHERE user_id = ?",
                (amount, user_id)
            )
```

---

## 13. Anti-Patterns

### Anti-Pattern 1: Missing Security Headers

Deploying an application without configuring security headers. Headers such as CSP, HSTS, and X-Frame-Options can significantly mitigate client-side attacks at no additional cost.

**Detection method**: Scan with `securityheaders.com`, or check response headers in the browser's developer tools.

### Anti-Pattern 2: Information Leakage via Error Messages

Including stack traces or database connection details in error responses. In production, return only generic error messages and record details in server-side logs.

```python
# NG: returning a stack trace
@app.errorhandler(Exception)
def handle_error(e):
    return {"error": str(e), "traceback": traceback.format_exc()}, 500

# OK: return only a generic message
@app.errorhandler(Exception)
def handle_error(e):
    error_id = str(uuid.uuid4())
    app.logger.error(f"Error {error_id}: {e}", exc_info=True)
    return {"error": "Internal server error", "reference": error_id}, 500
```

### Anti-Pattern 3: Client-Side Validation Only

```javascript
// NG: validation only on the front end
// → Easily bypassed with browser dev tools or curl

// OK: front end is for UX improvement; server side is the essential defense
// Front end: for immediate feedback
// Back end: for security (required)
```

---

## 14. Exercises

### Exercise 1 (Basic): Checking Security Headers

Open the developer tools (Network tab) for any website and verify the presence of the following security headers:

1. `Content-Security-Policy`
2. `Strict-Transport-Security`
3. `X-Content-Type-Options`
4. `X-Frame-Options`
5. `Referrer-Policy`

Explain the purpose of each header and the risks if it is missing.

### Exercise 2 (Intermediate): Detecting and Fixing SQL Injection

The following code contains a SQL injection vulnerability. Identify the attack payload and fix the code to be secure.

```python
def login(username, password):
    query = f"""
        SELECT * FROM users
        WHERE username = '{username}'
        AND password = '{hashlib.md5(password.encode()).hexdigest()}'
    """
    result = db.execute(query)
    if result:
        return create_session(result[0])
    return None
```

Issues to fix:
- SQL injection
- Use of MD5 hash
- Hash without salt

### Exercise 3 (Advanced): Comprehensive Security Review

Identify all security issues in the following Flask application and create a fixed version:

```python
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
app.secret_key = "secret123"

@app.route("/api/user/<user_id>")
def get_user(user_id):
    conn = sqlite3.connect("app.db")
    cursor = conn.execute(f"SELECT * FROM users WHERE id = {user_id}")
    user = cursor.fetchone()
    conn.close()
    return jsonify({"user": user})

@app.route("/api/search")
def search():
    q = request.args.get("q")
    return f"<h1>Results for: {q}</h1>"

@app.route("/api/upload", methods=["POST"])
def upload():
    file = request.files["file"]
    file.save(f"/uploads/{file.filename}")
    return jsonify({"status": "uploaded"})
```

Issues: hardcoded secret key, SQL injection, XSS, path traversal, missing access control, missing security headers.

---

## 15. Performance Considerations

### Performance Impact of Security Countermeasures

| Countermeasure | Performance Impact | Optimization Method |
|----------------|-------------------|---------------------|
| bcrypt (rounds=12) | ~300ms/hash | Use only during authentication, async processing |
| TLS 1.3 | +1-2ms for first connection | 0-RTT reconnection, TLS session resumption |
| CSP header | Nearly zero | - |
| Input validation | <1ms | Pre-compiled regular expressions |
| Rate limiting (Redis) | ~1ms | Combine with local cache |
| WAF | 5-20ms | Rule optimization, bypass routes |

### Password Hash Cost Factor vs. Response Time

```
bcrypt rounds vs. processing time (approximate):
  rounds=10:  ~100ms  ← For development environments
  rounds=11:  ~200ms
  rounds=12:  ~400ms  ← Minimum for production (OWASP recommended)
  rounds=13:  ~800ms
  rounds=14: ~1600ms  ← High-security requirements

Argon2id parameters vs. processing time:
  memory=32MB, time=3:   ~100ms  ← Minimum baseline
  memory=64MB, time=3:   ~200ms  ← OWASP recommended
  memory=128MB, time=4:  ~500ms  ← High-security requirements
```

---

## 16. Troubleshooting

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Large volume of CSP violation errors | CSP policy is too strict | Introduce gradually using report-only mode |
| HSTS not taking effect | Not registered in preload list | Set max-age long enough and apply for preload |
| CORS errors | Origin not in the allowlist | Specify exact origins (avoid *) |
| Session fixation attack | Session ID does not change after login | Regenerate session after successful authentication |
| bcrypt is too slow | Rounds set too high | Async processing + appropriate rounds setting |

---

## FAQ

### Q1: Is covering OWASP Top 10 sufficient?

No. The OWASP Top 10 represents the most common vulnerabilities and is not a comprehensive security checklist. The OWASP ASVS (Application Security Verification Standard) should be used as a more comprehensive guideline. ASVS provides 286 verification items across three levels: Level 1 (basic), Level 2 (standard), and Level 3 (advanced).

### Q2: Can A04 "Insecure Design" be addressed at the code level?

Code-level fixes alone are insufficient. Threat modeling at the design stage, defining security requirements, and architecture reviews are all necessary. "Secure coding" is only effective when built on a "secure design." Specifically, STRIDE analysis, creating data flow diagrams (DFDs), and defining trust boundaries should be performed during the design phase.

### Q3: Which vulnerability should be prioritized for remediation?

This should be determined based on your organization's risk assessment, but generally A01 (Access Control) and A03 (Injection) cause the greatest damage and should be top priorities. However, A05 (Misconfiguration) has the lowest remediation cost and can be applied immediately, so it is recommended to start there.

### Q4: How often is the OWASP Top 10 updated?

It is updated every 2-4 years. Past releases: 2003, 2004, 2007, 2010, 2013, 2017, 2021. The next update is expected around 2025 or 2026. Changes between versions are based on the emergence of new threats and data analysis.

### Q5: Are there OWASP considerations specific to microservices architectures?

Microservices require the following additional considerations: (1) service-to-service authentication (mTLS, JWT propagation); (2) centralized rate limiting and input validation at the API Gateway; (3) network policies via a service mesh; (4) visibility of security events through distributed tracing.

---

## Summary

| Rank | Category | Core Countermeasure | Detection Tool |
|------|----------|---------------------|----------------|
| A01 | Broken Access Control | Server-side authorization checks, deny by default | Burp Suite |
| A02 | Cryptographic Failures | Enforce TLS, choose appropriate algorithms | testssl.sh |
| A03 | Injection | Parameterized queries, input validation | SQLMap, Semgrep |
| A04 | Insecure Design | Threat modeling, security requirements | Design review |
| A05 | Misconfiguration | Hardening, automated configuration management | ScoutSuite |
| A06 | Outdated Components | SCA, auto-update | Dependabot, Snyk |
| A07 | Authentication Failures | MFA, secure session management | Hydra |
| A08 | Integrity Failures | Signature verification, SRI | Sigstore |
| A09 | Logging Failures | SIEM, structured logging | ELK Stack |
| A10 | SSRF | URL validation, network segmentation | Burp Suite |

### Principles of Defense

```
+------------------------------------------------------------------+
|  5 Principles of Security Defense                                 |
|------------------------------------------------------------------|
|  1. Defense in Depth                                             |
|     Do not rely on a single countermeasure. WAF + input validation + parameterized queries |
|                                                                    |
|  2. Least Privilege                                               |
|     Grant only the minimum necessary permissions. Deny by default |
|                                                                    |
|  3. Fail Securely                                                 |
|     Deny access on error. Do not leak information                |
|                                                                    |
|  4. Don't Trust User Input                                        |
|     Validate all input on the server side                        |
|                                                                    |
|  5. Security by Design                                            |
|     Incorporate security from the design stage, not as an afterthought |
+------------------------------------------------------------------+
```

---

## Next Guides to Read

- [01-xss-prevention.md](./01-xss-prevention.md) -- Detailed countermeasures against XSS attacks
- [03-injection.md](./03-injection.md) -- Deep dive into injection attacks
- [04-auth-vulnerabilities.md](./04-auth-vulnerabilities.md) -- Details on authentication vulnerabilities
- [TLS/Certificates](../02-cryptography/01-tls-certificates.md) -- Foundation of encrypted communication
- [API Security](../03-network-security/02-api-security.md) -- Authentication, authorization, and rate limiting for APIs

---

## References

1. OWASP Top 10:2021 -- https://owasp.org/Top10/
2. OWASP Application Security Verification Standard (ASVS) v4.0 -- https://owasp.org/www-project-application-security-verification-standard/
3. OWASP Testing Guide v4.2 -- https://owasp.org/www-project-web-security-testing-guide/
4. OWASP Cheat Sheet Series -- https://cheatsheetseries.owasp.org/
5. CWE/SANS Top 25 Most Dangerous Software Errors -- https://cwe.mitre.org/top25/
6. NIST SP 800-53 Security and Privacy Controls -- https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
7. RFC 6749 - The OAuth 2.0 Authorization Framework -- https://datatracker.ietf.org/doc/html/rfc6749
8. Mozilla Web Security Guidelines -- https://infosec.mozilla.org/guidelines/web_security
