# Secure Coding

> A practical guide to preventing vulnerabilities at the application code level, focusing on input validation, output encoding, and safe error handling. Covers secure coding principles aligned with the OWASP Top 10, specific attack techniques and defenses, and language-specific best practices.

## What You Will Learn in This Chapter

1. **Input Validation Principles and Implementation** — Safe input processing using a whitelist approach, type-safe validation, and multi-layered defense against injection attacks
2. **Output Encoding and XSS Defense** — Context-aware escaping techniques, multi-layered defense with CSP, and prevention of DOM-based XSS
3. **Safe Error Handling** — Error handling design that prevents information leakage while supporting debugging, integrated with structured logging
4. **Secure Session and Authentication Management** — CSRF prevention, password handling, and session fixation attack countermeasures

## Prerequisites

| Topic | Reference |
|---------|--------|
| Basic Web Security Concepts | [Web Security Fundamentals](../01-web-security/) |
| Cryptography Fundamentals | [Cryptography Basics](../02-cryptography/) |
| Understanding the HTTP Protocol | [Network Security](../03-network-security/) |
| Authentication and Authorization Basics | Authentication and Authorization |

---

## 1. Secure Coding Principles

### WHY: Why Secure Coding Is Necessary

The cost of fixing security vulnerabilities grows exponentially as development progresses. Research shows that if the cost to fix during design is 1, it becomes 15x at the testing stage and over 100x after production deployment (NIST/IBM Systems Sciences Institute). Secure coding is not "security bolted on later" — it is the core of "shift-left," where security is built into the development process from the very beginning.

### Core Principles

```
+-------------------------------------------------------------------+
|                7 Principles of Secure Coding                      |
|-------------------------------------------------------------------|
|  1. Validate All Input                                            |
|     → Validate all external input using a whitelist approach      |
|                                                                   |
|  2. Principle of Least Privilege                                  |
|     → Grant only the minimum access rights needed for processing  |
|                                                                   |
|  3. Defense in Depth                                              |
|     → Build multiple layers of defense rather than relying on one |
|                                                                   |
|  4. Secure Defaults                                               |
|     → Default settings should be the most secure state           |
|                                                                   |
|  5. Fail Securely                                                 |
|     → On error, fail to a safe state and stop processing          |
|                                                                   |
|  6. Minimize Attack Surface                                       |
|     → Disable unnecessary features, APIs, and ports              |
|                                                                   |
|  7. Don't Roll Your Own Crypto                                    |
|     → Use proven libraries for encryption and authentication      |
+-------------------------------------------------------------------+
```

### Principle Application Matrix

| Principle | Input Processing | Output Processing | Error Handling | Authentication | Data Storage |
|------|---------|---------|-----------|---------|-----------|
| Input Validation | Whitelist | - | Validate error input | Validate credential format | Validate data format |
| Least Privilege | Accept only required fields | Output only required information | Minimal error info | Grant only required permissions | Access only required columns |
| Defense in Depth | Frontend + backend validation | Escaping + CSP | Log + monitoring + alerts | MFA + rate limiting | Encryption + access control |
| Fail Securely | Reject invalid input | Hide on escaping failure | Return 500 without details | Lock on auth failure | Deny access on decryption failure |

---

## 2. Input Validation

### Input Validation Strategy

```
External Input (Untrusted Data)
    │
    ▼
┌──────────────────────┐
│ 1. Type Check         │  String? Number? Array? null?
│    (Type Validation) │  → Reject immediately if type differs
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 2. Length Limit       │  Maximum and minimum length
│    (Length Check)     │  → Prevents buffer overflow
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 3. Range Check        │  Minimum and maximum value
│    (Range Check)     │  → Prevents integer overflow
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 4. Pattern Validation │  Whitelist regular expressions
│    (Pattern Match)   │  → Safer than blacklisting
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 5. Business Logic     │  Consistency and validity
│    (Business Rules)  │  → Domain-specific constraints
└──────────┬───────────┘
           │
           ▼
Safe Internal Data (Trusted Data)
```

### WHY for Input Validation: Whitelist vs Blacklist

The blacklist approach ("exclude dangerous strings") has countless bypass techniques, so always use the whitelist approach ("accept only permitted characters and patterns").

```python
import re

# NG: Blacklist approach — easy to bypass
def validate_input_blacklist(user_input: str) -> str:
    """Removing dangerous characters is always incomplete"""
    dangerous = ["<script>", "DROP TABLE", "OR 1=1"]
    for d in dangerous:
        user_input = user_input.replace(d, "")
    return user_input
    # Attackers can bypass with nested input like "<scr<script>ipt>"
    # Also bypassable with encoding conversion (%3Cscript%3E)

# OK: Whitelist approach — accept only permitted patterns
def validate_username(username: str) -> str:
    """Allow only alphanumeric characters and underscores for usernames"""
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        raise ValueError(
            "Username must be 3-20 characters using only alphanumeric characters and underscores"
        )
    return username
```

### Type-Safe Input Validation (Python / Pydantic)

```python
from pydantic import BaseModel, Field, field_validator, EmailStr
from datetime import date
from typing import Optional
import re

class UserRegistration(BaseModel):
    """Type-safe input validation (Pydantic v2)"""
    username: str = Field(
        min_length=3,
        max_length=20,
        pattern=r'^[a-zA-Z0-9_]+$',
        description="Alphanumeric characters and underscores only",
    )
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    birth_date: date
    age: int = Field(ge=13, le=150)
    bio: Optional[str] = Field(default=None, max_length=500)

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password strength"""
        if not re.search(r'[A-Z]', v):
            raise ValueError('Must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Must contain at least one special character')
        return v

    @field_validator('birth_date')
    @classmethod
    def validate_birth_date(cls, v: date) -> date:
        """Reject future dates or unrealistic dates"""
        if v > date.today():
            raise ValueError('Date of birth cannot be in the future')
        if v.year < 1900:
            raise ValueError('Invalid date of birth')
        return v

# Usage example
try:
    user = UserRegistration(
        username="john_doe",
        email="john@example.com",
        password="SecureP@ss123!",
        birth_date="1990-01-15",
        age=34,
    )
    print(f"Validation successful: {user.username}")
except Exception as e:
    print(f"Validation error: {e}")
```

### SQL Injection Prevention

```python
import sqlite3
from typing import Optional

# NG: Building SQL by string concatenation
def get_user_bad(username: str) -> Optional[dict]:
    """Vulnerable code — SQL injection is possible"""
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE name = '{username}'"
    # Input: ' OR '1'='1' --
    # Generated SQL: SELECT * FROM users WHERE name = '' OR '1'='1' --'
    # → All user information is retrieved
    cursor.execute(query)
    return cursor.fetchone()

# OK: Parameterized queries (prepared statements)
def get_user_good(username: str) -> Optional[dict]:
    """Safe code — parameters are separated from query structure"""
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    # Use placeholders (DB driver safely escapes)
    query = "SELECT * FROM users WHERE name = ?"
    cursor.execute(query, (username,))
    row = cursor.fetchone()
    if row:
        columns = [desc[0] for desc in cursor.description]
        return dict(zip(columns, row))
    return None

# OK: Use ORM (SQLAlchemy)
from sqlalchemy import select
from sqlalchemy.orm import Session

def get_user_orm(session: Session, username: str) -> Optional["User"]:
    """ORM internally generates parameterized queries"""
    stmt = select(User).where(User.name == username)
    return session.execute(stmt).scalar_one_or_none()

# Note: Care is needed when using raw SQL even with ORM
from sqlalchemy import text

def search_users_safe(session: Session, search_term: str) -> list:
    """Use bind parameters even with ORM's text()"""
    # NG: f"SELECT * FROM users WHERE name LIKE '%{search_term}%'"
    # OK: Use bind parameters
    stmt = text("SELECT * FROM users WHERE name LIKE :term")
    result = session.execute(stmt, {"term": f"%{search_term}%"})
    return result.fetchall()
```

### Command Injection Prevention

```python
import subprocess
import re
import shlex
from pathlib import Path

# NG: String concatenation for shell commands
def ping_bad(host: str) -> str:
    """Vulnerable code — arbitrary command execution is possible"""
    import os
    os.system(f"ping -c 1 {host}")
    # Input: "8.8.8.8; rm -rf /" → runs ping then deletes all files
    # Input: "8.8.8.8 && cat /etc/passwd" → reads the password file
    return "done"

# OK: subprocess + list arguments (shell=False) + whitelist
def ping_good(host: str) -> str:
    """Safe code — arguments are separated and not interpreted by the shell"""
    # Step 1: Validate input with whitelist
    if not re.match(r'^(\d{1,3}\.){3}\d{1,3}$', host):
        raise ValueError(f"Invalid IP address format: {host}")

    # Step 2: Range check each octet
    octets = host.split('.')
    for octet in octets:
        if not 0 <= int(octet) <= 255:
            raise ValueError(f"Invalid IP address: {host}")

    # Step 3: Execute as list argument with shell=False
    result = subprocess.run(
        ["ping", "-c", "1", "-W", "3", host],  # List format
        capture_output=True,
        text=True,
        timeout=10,
    )
    return result.stdout

# OK: Use Python libraries instead of external commands (most recommended)
import socket

def check_host_reachable(host: str, port: int = 80, timeout: float = 3.0) -> bool:
    """Check network connectivity directly with Python without external commands"""
    try:
        socket.create_connection((host, port), timeout=timeout)
        return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False
```

### Path Traversal Prevention

```python
import os
from pathlib import Path

# NG: Using user input directly in path
def read_file_bad(filename: str) -> str:
    """Vulnerable code — any file can be read"""
    path = f"/app/uploads/{filename}"
    # Input: "../../etc/passwd" → can read /etc/passwd
    # Input: "....//....//etc/passwd" → joined before normalization
    return open(path).read()

# OK: Normalize and validate path
def read_file_good(filename: str) -> str:
    """Safe code — prevents access outside the base directory"""
    base_dir = Path("/app/uploads").resolve()  # Normalize to absolute path
    # Remove directory traversal characters from filename
    safe_filename = Path(filename).name  # Remove directory component
    full_path = (base_dir / safe_filename).resolve()

    # Deny access outside base directory
    if not str(full_path).startswith(str(base_dir)):
        raise PermissionError("Access denied: path traversal detected")

    if not full_path.is_file():
        raise FileNotFoundError(f"File not found: {safe_filename}")

    # Check file size limit
    if full_path.stat().st_size > 10 * 1024 * 1024:  # 10MB
        raise ValueError("File size exceeds the limit")

    return full_path.read_text(encoding='utf-8')
```

### SSRF (Server-Side Request Forgery) Prevention

```python
import ipaddress
import urllib.parse
from typing import Optional

def validate_url_for_ssrf(url: str) -> str:
    """URL validation to prevent SSRF"""
    parsed = urllib.parse.urlparse(url)

    # Restrict schemes
    if parsed.scheme not in ('http', 'https'):
        raise ValueError(f"Disallowed scheme: {parsed.scheme}")

    # Resolve hostname
    import socket
    try:
        resolved_ip = socket.gethostbyname(parsed.hostname)
    except socket.gaierror:
        raise ValueError(f"Cannot resolve hostname: {parsed.hostname}")

    # Reject private IP addresses
    ip = ipaddress.ip_address(resolved_ip)
    if ip.is_private or ip.is_loopback or ip.is_link_local:
        raise ValueError(
            f"Access to internal network is forbidden: {resolved_ip}"
        )

    # Reject AWS metadata endpoint
    if resolved_ip == "169.254.169.254":
        raise ValueError("Access to metadata service is forbidden")

    return url

# Usage example
import requests

def fetch_external_resource(url: str) -> Optional[str]:
    """Safe external resource retrieval"""
    validated_url = validate_url_for_ssrf(url)
    response = requests.get(
        validated_url,
        timeout=10,
        allow_redirects=False,  # Prevent SSRF bypass via redirect
    )
    response.raise_for_status()
    return response.text
```

---

## 3. Output Encoding

### WHY for Context-Aware Escaping

XSS attacks occur when user input is embedded directly into HTML. The foundation of defense is "escape appropriately at output time." However, the escaping method differs depending on where in the HTML the output appears.

```
┌───────────────────────────────────────────────────────────────┐
│  Context             │  Escaping Method         │  Reason      │
│─────────────────────┼────────────────────────┼──────────────│
│  HTML body           │  & → &amp;             │  Prevent tag generation  │
│  <p>{{here}}</p>    │  < → &lt; > → &gt;     │              │
│─────────────────────┼────────────────────────┼──────────────│
│  HTML attribute      │  " → &quot;            │  Prevent attribute escape  │
│  <div id="{{here}}"> │  ' → &#x27;           │              │
│─────────────────────┼────────────────────────┼──────────────│
│  JavaScript          │  Unicode escaping       │  Prevent code injection│
│  var x = '{{here}}'; │  \uXXXX format        │              │
│─────────────────────┼────────────────────────┼──────────────│
│  URL parameter       │  Percent encoding      │  Prevent URL structure breakage│
│  href="?q={{here}}"  │  encodeURIComponent    │              │
│─────────────────────┼────────────────────────┼──────────────│
│  CSS                 │  CSS escaping          │  Prevent style injection│
│  style="color:{{}}"; │  \HH format            │              │
│─────────────────────┼────────────────────────┼──────────────│
│  SQL                 │  Parameterized queries  │  Prevent SQL injection   │
│  WHERE x = {{here}}  │  (no escaping needed)  │              │
└───────────────────────────────────────────────────────────────┘
```

### XSS Prevention Implementation Patterns

```javascript
// ========================================
// Pattern 1: React (automatic escaping in JSX)
// ========================================
function UserProfile({ user }) {
  return (
    <div>
      {/* OK: JSX automatically HTML-escapes */}
      <h1>{user.name}</h1>
      <p>{user.bio}</p>

      {/* NG: dangerouslySetInnerHTML is an XSS risk */}
      <div dangerouslySetInnerHTML={{ __html: user.bio }} />

      {/* OK: Pass through a sanitization library (DOMPurify) */}
      <div dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(user.bio, {
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
          ALLOWED_ATTR: ['href', 'target', 'rel'],
          FORBID_ATTR: ['style', 'onerror', 'onclick'],
        })
      }} />

      {/* NG: href may contain javascript: protocol */}
      <a href={user.website}>Website</a>

      {/* OK: Validate URL scheme */}
      <a href={sanitizeUrl(user.website)}>Website</a>
    </div>
  );
}

/**
 * Validate URL scheme to eliminate javascript: protocol etc.
 */
function sanitizeUrl(url) {
  if (!url) return '#';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return '#';
    }
    return url;
  } catch {
    return '#';
  }
}
```

```python
# ========================================
# Pattern 2: Server-side (Python/Flask)
# ========================================
from markupsafe import escape, Markup
from flask import Flask, render_template_string

app = Flask(__name__)

@app.route('/profile/<username>')
def profile(username: str):
    # Jinja2 templates automatically escape content inside {{ }}
    template = """
    <h1>{{ username }}</h1>
    <p>{{ bio }}</p>
    """
    # Safe even if username contains <script>alert(1)</script>
    return render_template_string(template, username=username, bio="Hello")

# When manual escaping is needed
def escape_for_html(text: str) -> str:
    """Manual HTML escaping"""
    return str(escape(text))

# NG: Misuse of the |safe filter
# {{ user_input | safe }}  → Not escaped!
# OK: Use |safe only on already-sanitized data
# {{ sanitized_html | safe }}
```

```javascript
// ========================================
// Pattern 3: Preventing DOM-based XSS
// ========================================

// NG: Assigning innerHTML directly to DOM
function displaySearchResults_bad(query) {
  // URL: ?q=<img src=x onerror=alert(1)>
  document.getElementById('results').innerHTML =
    `Search results: ${query}`;  // XSS!
}

// OK: Use textContent (not interpreted as HTML)
function displaySearchResults_good(query) {
  const resultsEl = document.getElementById('results');
  resultsEl.textContent = `Search results: ${query}`;
}

// OK: Safely build elements using DOM API
function displaySearchResults_best(query) {
  const resultsEl = document.getElementById('results');
  const textNode = document.createTextNode(`Search results: ${query}`);
  resultsEl.replaceChildren(textNode);
}
```

### Content Security Policy (CSP) Detailed Design

```
# ========================================
# Level 1: Basic CSP (starting point)
# ========================================
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;

# ========================================
# Level 2: Strict CSP (recommended)
# ========================================
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'nonce-{RANDOM}';
  style-src 'self';
  img-src 'self' https://cdn.example.com;
  font-src 'self';
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;

# ========================================
# Level 3: Strict CSP (most secure)
# ========================================
Content-Security-Policy:
  script-src 'nonce-{RANDOM}' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
  require-trusted-types-for 'script';
```

```python
# CSP header implementation (Flask)
import secrets

@app.after_request
def add_security_headers(response):
    """Attach security headers to all responses"""
    nonce = secrets.token_urlsafe(32)

    csp_directives = [
        "default-src 'none'",
        f"script-src 'self' 'nonce-{nonce}'",
        "style-src 'self'",
        "img-src 'self' https://cdn.example.com",
        "font-src 'self'",
        "connect-src 'self' https://api.example.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ]
    response.headers['Content-Security-Policy'] = '; '.join(csp_directives)

    # Other security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '0'  # Disable legacy browser workaround
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = (
        'camera=(), microphone=(), geolocation=()'
    )

    # Pass nonce to template
    response.headers['X-Nonce'] = nonce
    return response
```

### Collecting CSP Violation Reports

```python
# Gradual adoption using CSP Report-Only mode
@app.after_request
def add_csp_report_only(response):
    """Trial-run CSP in Report-Only mode"""
    response.headers['Content-Security-Policy-Report-Only'] = (
        "default-src 'self'; "
        "report-uri /api/csp-report; "
        "report-to csp-endpoint"
    )
    return response

@app.route('/api/csp-report', methods=['POST'])
def csp_report():
    """Collect CSP violation reports"""
    import json
    import logging
    logger = logging.getLogger('csp')

    report = json.loads(request.data)
    logger.warning(
        "CSP Violation: blocked_uri=%s, violated_directive=%s, document_uri=%s",
        report.get('csp-report', {}).get('blocked-uri'),
        report.get('csp-report', {}).get('violated-directive'),
        report.get('csp-report', {}).get('document-uri'),
    )
    return '', 204
```

---

## 4. Error Handling

### WHY for Safe Error Response Design

Error messages have two conflicting requirements. Developers need detailed information for debugging, but that same information gives attackers a foothold for attacks. This balance is achieved through "environment-specific error responses" and "correlation IDs."

```
┌───────────────────────────────────────────────────────────────┐
│                  Error Response Design                         │
│───────────────────────────────────────────────────────────────│
│                                                               │
│  Development environment (debug=True):                        │
│  {                                                            │
│    "error": "DatabaseError",                                  │
│    "message": "relation \"users\" does not exist",            │
│    "stack": "at Query.run (/app/db.js:42:15)...",             │
│    "query": "SELECT * FROM users WHERE...",                   │
│    "request": { "method": "POST", "path": "/api/users" }     │
│  }                                                            │
│  → Developers can immediately identify the cause              │
│                                                               │
│  Production environment (debug=False):                        │
│  {                                                            │
│    "error": "Internal Server Error",                          │
│    "requestId": "req-a1b2c3d4"                                │
│  }                                                            │
│  → Does not leak internal information to attackers            │
│  → Debug by correlating requestId with server logs            │
│                                                               │
│  Server logs (internal):                                      │
│  [ERROR] request_id=req-a1b2c3d4 user_id=123                  │
│          error=DatabaseError message="relation does not exist" │
│          stack_trace="..." query="SELECT * FROM..."            │
│  → All detailed information is recorded in logs               │
└───────────────────────────────────────────────────────────────┘
```

### Layered Error Handling Implementation

```python
import logging
import uuid
import traceback
from flask import Flask, jsonify, request, g
from functools import wraps
from datetime import datetime

app = Flask(__name__)
logger = logging.getLogger(__name__)

# ========================================
# Error class hierarchy design
# ========================================
class AppError(Exception):
    """Application error base class"""
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
        internal_message: str = None,
    ):
        self.message = message              # Message returned to user
        self.status_code = status_code
        self.error_code = error_code        # Machine-readable error code
        self.internal_message = internal_message  # Details for logging

class NotFoundError(AppError):
    def __init__(self, resource: str = "Resource", resource_id: str = None):
        internal_msg = f"{resource} not found (id={resource_id})" if resource_id else None
        super().__init__(
            message=f"{resource} not found",
            status_code=404,
            error_code="NOT_FOUND",
            internal_message=internal_msg,
        )

class ValidationError(AppError):
    def __init__(self, details: list):
        super().__init__(
            message="Validation failed",
            status_code=400,
            error_code="VALIDATION_ERROR",
        )
        self.details = details

class AuthenticationError(AppError):
    def __init__(self):
        super().__init__(
            message="Authentication required",
            status_code=401,
            error_code="UNAUTHORIZED",
        )

class RateLimitError(AppError):
    def __init__(self, retry_after: int = 60):
        super().__init__(
            message="Too many requests",
            status_code=429,
            error_code="RATE_LIMITED",
        )
        self.retry_after = retry_after

# ========================================
# Request tracking middleware
# ========================================
@app.before_request
def assign_request_id():
    """Assign a unique tracking ID to each request"""
    g.request_id = request.headers.get(
        'X-Request-ID',
        str(uuid.uuid4())[:8]
    )
    g.request_start = datetime.utcnow()

# ========================================
# Error handlers
# ========================================
@app.errorhandler(AppError)
def handle_app_error(error):
    """Handle application errors"""
    request_id = getattr(g, 'request_id', 'unknown')

    # Log full details internally
    logger.error(
        "AppError: error_code=%s message=%s request_id=%s path=%s "
        "method=%s internal=%s",
        error.error_code, error.message, request_id,
        request.path, request.method,
        error.internal_message or "N/A",
    )

    # Return only minimal information to the user
    response = {
        "error": error.message,
        "errorCode": error.error_code,
        "requestId": request_id,
    }
    if hasattr(error, 'details'):
        response["details"] = error.details

    resp = jsonify(response)
    resp.status_code = error.status_code

    if hasattr(error, 'retry_after'):
        resp.headers['Retry-After'] = str(error.retry_after)

    return resp

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    """Handle unexpected errors"""
    request_id = getattr(g, 'request_id', 'unknown')

    # Log unexpected errors with stack trace
    logger.exception(
        "Unexpected error: request_id=%s path=%s method=%s",
        request_id, request.path, request.method,
    )

    # Return only a generic message to the user
    return jsonify({
        "error": "Internal Server Error",
        "errorCode": "INTERNAL_ERROR",
        "requestId": request_id,
    }), 500
```

### Integration with Structured Logging

```python
import json
import logging
from datetime import datetime

class StructuredFormatter(logging.Formatter):
    """JSON structured log formatter"""

    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add request_id if present
        if hasattr(record, 'request_id'):
            log_entry["request_id"] = record.request_id

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info),
            }

        # Security note:
        # Do not include passwords, tokens, or personal information in logs
        return json.dumps(log_entry, ensure_ascii=False)

# Usage example
handler = logging.StreamHandler()
handler.setFormatter(StructuredFormatter())
logger = logging.getLogger('app')
logger.addHandler(handler)
logger.setLevel(logging.INFO)
```

---

## 5. CSRF Prevention

### How CSRF (Cross-Site Request Forgery) Works

```
Attack flow:

1. User is logged in to bank.example.com (Cookie saved in browser)
2. User visits evil.example.com
3. evil.example.com contains the following HTML:
   <form action="https://bank.example.com/transfer" method="POST">
     <input type="hidden" name="to" value="attacker">
     <input type="hidden" name="amount" value="1000000">
   </form>
   <script>document.forms[0].submit();</script>
4. Browser automatically sends the bank.example.com Cookie
5. bank.example.com treats it as a legitimate request from a logged-in user
6. → Transfer to the attacker is executed!
```

### CSRF Prevention Implementation

```python
# ========================================
# Method 1: CSRF token (Flask-WTF)
# ========================================
from flask_wtf.csrf import CSRFProtect

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ['SECRET_KEY']
csrf = CSRFProtect(app)

# Embed token in HTML form
# <form method="POST">
#   <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
#   <button type="submit">Submit</button>
# </form>

# For AJAX requests
# <meta name="csrf-token" content="{{ csrf_token() }}">
# <script>
# fetch('/api/data', {
#   method: 'POST',
#   headers: {
#     'X-CSRFToken': document.querySelector('meta[name=csrf-token]').content,
#     'Content-Type': 'application/json',
#   },
#   body: JSON.stringify(data),
# })
# </script>

# ========================================
# Method 2: SameSite Cookie (simplest)
# ========================================
app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',   # Do not send Cookie on cross-site POST
    SESSION_COOKIE_SECURE=True,       # HTTPS only
    SESSION_COOKIE_HTTPONLY=True,      # Not accessible from JavaScript
)

# ========================================
# Method 3: Double Submit Cookie pattern
# ========================================
import secrets

@app.before_request
def set_csrf_cookie():
    """Set CSRF token in both Cookie and response"""
    if 'csrf_token' not in request.cookies:
        g.csrf_token = secrets.token_urlsafe(32)
    else:
        g.csrf_token = request.cookies['csrf_token']

@app.after_request
def add_csrf_cookie(response):
    """Set CSRF Cookie"""
    response.set_cookie(
        'csrf_token',
        g.csrf_token,
        httponly=False,  # Make readable from JS
        secure=True,
        samesite='Lax',
    )
    return response
```

---

## 6. Safe Password Handling

### WHY for Password Hashing

Passwords must not be stored in plaintext or with MD5/SHA256. Because:
- Plaintext: All passwords are immediately exposed in a database breach
- MD5/SHA256: Can be reversed in a short time with rainbow table attacks (a single GPU can compute billions of hashes per second)
- Without salt: Identical passwords produce identical hashes, enabling bulk decryption

bcrypt/argon2 are "intentionally slow" hash functions that dramatically increase the cost of brute-force attacks.

```python
# ========================================
# Recommended: Password hashing with bcrypt
# ========================================
import bcrypt

def hash_password(password: str) -> bytes:
    """Securely hash a password"""
    # bcrypt automatically generates a salt (16 bytes)
    # rounds=12: ~0.3 seconds/hash (brute-force protection)
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))

def verify_password(password: str, hashed: bytes) -> bool:
    """Verify a password (timing attack resistant)"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed)

# ========================================
# More recommended: argon2 (Password Hashing Competition winner)
# ========================================
from argon2 import PasswordHasher

ph = PasswordHasher(
    time_cost=3,       # Number of iterations
    memory_cost=65536,  # Memory usage (KB) = 64MB
    parallelism=4,      # Degree of parallelism
)

def hash_password_argon2(password: str) -> str:
    """Hash a password with Argon2id"""
    return ph.hash(password)

def verify_password_argon2(password: str, hashed: str) -> bool:
    """Verify a password with Argon2id"""
    try:
        return ph.verify(hashed, password)
    except Exception:
        return False

# ========================================
# NG: Never use the following
# ========================================
# import hashlib
# hashlib.md5(password.encode()).hexdigest()      # NG: Too fast + no salt
# hashlib.sha256(password.encode()).hexdigest()    # NG: Too fast + no salt
# hashlib.sha256((salt + password).encode()).hexdigest()  # NG: Too fast
```

### Password Hashing Algorithm Comparison

| Algorithm | Speed | Memory | Salt | Recommendation | Notes |
|-------------|------|--------|-------|--------|------|
| MD5 | Extremely fast | Small | None | Prohibited | Immediately reversible with rainbow tables |
| SHA-256 | Fast | Small | None | Prohibited | GPU can compute billions per second |
| PBKDF2 | Tunable | Small | Yes | Acceptable | NIST-recommended but low GPU resistance |
| bcrypt | Tunable | 4KB | Yes | Recommended | Proven track record, 72-byte max limit |
| scrypt | Tunable | Tunable | Yes | Recommended | Memory-hard but complex to configure |
| Argon2id | Tunable | Tunable | Yes | Most recommended | PHC winner, highest GPU/ASIC resistance |

---

## 7. Secure Session Management

```python
from flask import Flask, session
import os

app = Flask(__name__)

# ========================================
# Session configuration best practices
# ========================================
app.config.update(
    SECRET_KEY=os.environ['SESSION_SECRET'],   # Sufficient length random value (32 bytes or more)
    SESSION_COOKIE_SECURE=True,                # Send only over HTTPS
    SESSION_COOKIE_HTTPONLY=True,               # Not accessible from JavaScript
    SESSION_COOKIE_SAMESITE='Lax',             # CSRF prevention
    PERMANENT_SESSION_LIFETIME=1800,           # Expire after 30 minutes
    SESSION_COOKIE_NAME='__Host-session',      # Enhanced protection with __Host- prefix
)

# ========================================
# Preventing session fixation attacks
# ========================================
@app.route('/login', methods=['POST'])
def login():
    """Regenerate session ID on successful login"""
    # Authentication processing...
    if authenticate(request.form['email'], request.form['password']):
        # Important: Regenerate session after successful login
        session.clear()  # Discard old session data
        session.regenerate()  # Generate new session ID
        session['user_id'] = user.id
        session['login_time'] = datetime.utcnow().isoformat()
        return redirect('/dashboard')
    return render_template('login.html', error="Invalid credentials")

# ========================================
# Session validity verification
# ========================================
@app.before_request
def validate_session():
    """Verify session validity on each request"""
    if 'user_id' in session:
        login_time = datetime.fromisoformat(session.get('login_time', ''))
        # Invalidate session if idle for too long
        if (datetime.utcnow() - login_time).total_seconds() > 3600:
            session.clear()
            return redirect('/login?reason=timeout')
```

---

## 8. Preventing Deserialization Attacks

```python
# ========================================
# NG: Unsafe deserialization with pickle
# ========================================
import pickle

# Never do this: pickle.loads on untrusted data
def load_user_data_bad(serialized_data: bytes):
    """Vulnerable: pickle restores arbitrary Python objects"""
    return pickle.loads(serialized_data)
    # An attacker can send an object with a __reduce__ method
    # and execute arbitrary commands like os.system('rm -rf /')

# ========================================
# OK: Use JSON (safe serialization)
# ========================================
import json
from typing import Any

def load_user_data_good(serialized_data: str) -> dict:
    """Safe: JSON only restores data (cannot execute code)"""
    data = json.loads(serialized_data)
    # Also validate the type
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")
    return data

# ========================================
# OK: Safe YAML loading
# ========================================
import yaml

def load_config_safe(yaml_content: str) -> dict:
    """Safe: safe_load allows only basic types"""
    # NG: yaml.load(yaml_content, Loader=yaml.FullLoader)  # Risk of code execution
    # OK: yaml.safe_load only allows str, int, list, dict
    return yaml.safe_load(yaml_content)
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Client-Side Validation Only

```javascript
// NG: Validation only on the frontend
async function submitForm() {
  const age = document.getElementById('age').value;
  if (age < 0 || age > 150) {
    alert('Invalid age');
    return;
  }
  // Attackers can hit the API directly with DevTools, curl, or Burp Suite
  await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ age: -999 }),  // Completely bypasses validation
  });
}
```

```python
# OK: Always validate on the server side too
from pydantic import BaseModel, Field

class UserUpdate(BaseModel):
    age: int = Field(ge=0, le=150)  # Enforce type + range on server side

@app.route('/api/users', methods=['POST'])
def create_user():
    try:
        data = UserUpdate(**request.json)  # Validation failure automatically returns 422
    except ValueError as e:
        return jsonify({"error": "Validation failed", "details": str(e)}), 400
    # Frontend validation is for UX; security is the server's responsibility
```

### Anti-Pattern 2: Information Leakage in Error Messages

```python
# NG: Error messages that enable user enumeration attacks
@app.route('/login', methods=['POST'])
def login_bad():
    user = User.query.filter_by(email=request.form['email']).first()
    if not user:
        return {"error": "This email address is not registered"}, 401
    if not verify_password(request.form['password'], user.password_hash):
        return {"error": "Incorrect password"}, 401
    # → Attackers can confirm user existence from error messages
    # → Build a list of email addresses for password spray attacks

# OK: Return same message + prevent timing attacks
import time
import secrets

@app.route('/login', methods=['POST'])
def login_good():
    user = User.query.filter_by(email=request.form['email']).first()
    if not user:
        # Take equivalent time to password verification even when user doesn't exist
        bcrypt.hashpw(b"dummy", bcrypt.gensalt(rounds=12))
        return {"error": "Invalid email address or password"}, 401

    if not verify_password(request.form['password'], user.password_hash):
        return {"error": "Invalid email address or password"}, 401

    # Success
    return {"token": generate_jwt(user)}
```

### Anti-Pattern 3: Hardcoded Secrets

```python
# NG: Write secrets directly in source code
SECRET_KEY = "my-super-secret-key-12345"
DATABASE_URL = "postgresql://admin:password123@db.example.com/prod"
API_KEY = "sk-live-abcdef1234567890"

# OK: Retrieve from environment variables or a secrets manager
import os

SECRET_KEY = os.environ['SECRET_KEY']
DATABASE_URL = os.environ['DATABASE_URL']

# Even safer: Retrieve from AWS Secrets Manager
import boto3
import json

def get_secret(secret_name: str) -> dict:
    """Retrieve a secret from AWS Secrets Manager"""
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])
```

### Anti-Pattern 4: ReDoS from Improper Regular Expressions

```python
import re

# NG: Regular expression that causes catastrophic backtracking
# Input like "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" takes exponential time
bad_pattern = re.compile(r'^(a+)+$')

# OK: Non-backtracking regular expression, or limit input length
def validate_safe(text: str) -> bool:
    if len(text) > 100:  # Limit input length
        return False
    # When atomic groups or possessive quantifiers are unavailable,
    # simplify the pattern
    return bool(re.match(r'^a+$', text))
```

---

## 10. Security Checklist

### Development Security Checklist

```
┌──────────────────────────────────────────────────────┐
│  Category        │  Checklist Item                    │
│─────────────────┼───────────────────────────────────│
│  Input Validation │  □ Server-side validation on all input     │
│                 │  □ Use whitelist approach           │
│                 │  □ Set maximum input length         │
│                 │  □ Type and size limits for file uploads│
│─────────────────┼───────────────────────────────────│
│  Output Encoding  │  □ Context-aware escaping          │
│                 │  □ Set CSP headers                  │
│                 │  □ Do not use dangerouslySetInnerHTML│
│─────────────────┼───────────────────────────────────│
│  Authentication  │  □ Store passwords with bcrypt/argon2    │
│                 │  □ Protect against session fixation attacks│
│                 │  □ Implement rate limiting          │
│─────────────────┼───────────────────────────────────│
│  Error Handling  │  □ Hide stack traces in production  │
│                 │  □ Uniform error messages (prevent enumeration)│
│                 │  □ Tracking via requestId           │
│─────────────────┼───────────────────────────────────│
│  Data Protection │  □ Secrets in environment variables/KMS│
│                 │  □ All communication over TLS       │
│                 │  □ Safe deserialization             │
│─────────────────┼───────────────────────────────────│
│  Headers         │  □ X-Content-Type-Options: nosniff │
│                 │  □ X-Frame-Options: DENY            │
│                 │  □ Strict-Transport-Security        │
│                 │  □ Referrer-Policy                  │
└──────────────────────────────────────────────────────┘
```

---

## 11. Practice Exercises

### Exercise 1: Implement an Input Validation Function (Beginner)

**Task**: Implement a user registration validation function in Python that meets the following requirements.
- Username: 3-20 characters, alphanumeric and underscores only
- Email address: Standard email format
- Password: At least 12 characters, containing at least one uppercase letter, lowercase letter, digit, and symbol each
- Age: Integer from 13 to 150
- If any validation fails, return which fields are invalid

<details>
<summary>Sample Answer</summary>

```python
import re
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ValidationResult:
    is_valid: bool
    errors: dict = field(default_factory=dict)

def validate_user_registration(
    username: str,
    email: str,
    password: str,
    age: int,
) -> ValidationResult:
    """Validate user registration data"""
    errors = {}

    # Validate username
    if not isinstance(username, str):
        errors['username'] = 'Must be a string'
    elif not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        errors['username'] = 'Must be 3-20 characters using only alphanumeric characters and underscores'

    # Validate email address
    if not isinstance(email, str):
        errors['email'] = 'Must be a string'
    elif not re.match(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email
    ):
        errors['email'] = 'Not a valid email address format'
    elif len(email) > 254:
        errors['email'] = 'Email address is too long'

    # Validate password
    if not isinstance(password, str):
        errors['password'] = 'Must be a string'
    elif len(password) < 12:
        errors['password'] = 'Must be at least 12 characters'
    elif len(password) > 128:
        errors['password'] = 'Must be 128 characters or fewer'
    else:
        pw_errors = []
        if not re.search(r'[A-Z]', password):
            pw_errors.append('uppercase letter')
        if not re.search(r'[a-z]', password):
            pw_errors.append('lowercase letter')
        if not re.search(r'\d', password):
            pw_errors.append('digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            pw_errors.append('symbol')
        if pw_errors:
            errors['password'] = f'Must contain: {", ".join(pw_errors)}'

    # Validate age
    if not isinstance(age, int):
        errors['age'] = 'Must be an integer'
    elif age < 13:
        errors['age'] = 'Must be 13 or older'
    elif age > 150:
        errors['age'] = 'Invalid age'

    return ValidationResult(is_valid=len(errors) == 0, errors=errors)

# Tests
result = validate_user_registration(
    username="john_doe",
    email="john@example.com",
    password="SecureP@ss123!",
    age=25,
)
assert result.is_valid
assert result.errors == {}

result2 = validate_user_registration(
    username="ab",
    email="invalid",
    password="short",
    age=5,
)
assert not result2.is_valid
assert 'username' in result2.errors
assert 'email' in result2.errors
assert 'password' in result2.errors
assert 'age' in result2.errors
print("All tests passed")
```

</details>

### Exercise 2: Secure File Upload API (Intermediate)

**Task**: Implement a safe file upload API in Flask that meets the following requirements.
- Allowed extensions: .jpg, .png, .gif only
- Maximum file size: 5MB
- Replace filename with a random UUID (do not use the original filename)
- Magic byte verification of MIME type
- Path traversal prevention
- Confirm existence of upload destination directory

<details>
<summary>Sample Answer</summary>

```python
import os
import uuid
from pathlib import Path
from flask import Flask, request, jsonify

app = Flask(__name__)
UPLOAD_DIR = Path("/app/uploads")
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}
ALLOWED_MIME_TYPES = {
    'image/jpeg': b'\xff\xd8\xff',
    'image/png': b'\x89PNG',
    'image/gif': b'GIF8',
}

def validate_file_magic_bytes(file_data: bytes, extension: str) -> bool:
    """Validate magic bytes of the file"""
    mime_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
    }
    expected_mime = mime_map.get(extension)
    if not expected_mime:
        return False
    expected_magic = ALLOWED_MIME_TYPES.get(expected_mime)
    if not expected_magic:
        return False
    return file_data[:len(expected_magic)] == expected_magic

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Safe file upload"""
    # Check for file presence
    if 'file' not in request.files:
        return jsonify({"error": "No file specified"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Filename is empty"}), 400

    # Validate extension
    original_ext = Path(file.filename).suffix.lower()
    if original_ext not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"Extension not allowed. Allowed: {ALLOWED_EXTENSIONS}"
        }), 400

    # Validate file size
    file_data = file.read()
    if len(file_data) > MAX_FILE_SIZE:
        return jsonify({
            "error": f"File size exceeds the limit ({MAX_FILE_SIZE // 1024 // 1024}MB)"
        }), 400

    if len(file_data) == 0:
        return jsonify({"error": "File is empty"}), 400

    # Validate magic bytes
    if not validate_file_magic_bytes(file_data, original_ext):
        return jsonify({
            "error": "File content does not match extension"
        }), 400

    # Generate safe filename (UUID + original extension)
    safe_filename = f"{uuid.uuid4()}{original_ext}"
    upload_path = (UPLOAD_DIR / safe_filename).resolve()

    # Prevent path traversal
    if not str(upload_path).startswith(str(UPLOAD_DIR.resolve())):
        return jsonify({"error": "Invalid path"}), 400

    # Confirm upload directory
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Save file
    upload_path.write_bytes(file_data)

    return jsonify({
        "message": "Upload successful",
        "filename": safe_filename,
        "size": len(file_data),
    }), 201
```

</details>

### Exercise 3: Rate-Limited Login API Implementation (Advanced)

**Task**: Implement a login API that fully satisfies the following security requirements.
- Passwords stored hashed with argon2id
- Login attempts limited to 5 per 15 minutes per IP address
- Uniform error messages to prevent user enumeration attacks
- Constant-time responses to prevent timing attacks
- Regenerate session ID on successful login
- Log all attempts (but do not include passwords in logs)

<details>
<summary>Sample Answer</summary>

```python
import time
import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, session
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ['SECRET_KEY']
logger = logging.getLogger('auth')

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)

# Simple storage for rate limiting (use Redis in production)
login_attempts = defaultdict(list)

RATE_LIMIT_WINDOW = 15 * 60  # 15 minutes
RATE_LIMIT_MAX = 5            # Maximum 5 attempts

# Dummy user DB (use a real database in production)
USERS_DB = {
    "user@example.com": {
        "id": 1,
        "email": "user@example.com",
        "password_hash": ph.hash("SecureP@ss123!"),
    }
}

def check_rate_limit(ip_address: str) -> bool:
    """Rate limit check based on IP address"""
    now = time.time()
    # Remove old records
    login_attempts[ip_address] = [
        t for t in login_attempts[ip_address]
        if now - t < RATE_LIMIT_WINDOW
    ]
    return len(login_attempts[ip_address]) < RATE_LIMIT_MAX

def record_attempt(ip_address: str):
    """Record a login attempt"""
    login_attempts[ip_address].append(time.time())

def constant_time_response(start_time: float, min_duration: float = 0.3):
    """Wait a fixed time to prevent timing attacks"""
    elapsed = time.time() - start_time
    if elapsed < min_duration:
        time.sleep(min_duration - elapsed)

@app.route('/api/login', methods=['POST'])
def login():
    """Secure login API"""
    start_time = time.time()
    client_ip = request.remote_addr
    request_id = str(uuid.uuid4())[:8]

    # Rate limit check
    if not check_rate_limit(client_ip):
        logger.warning(
            "Rate limit exceeded: ip=%s request_id=%s",
            client_ip, request_id,
        )
        remaining_time = int(RATE_LIMIT_WINDOW - (
            time.time() - min(login_attempts[client_ip])
        ))
        constant_time_response(start_time)
        return jsonify({
            "error": "Maximum attempts reached. Please wait before trying again.",
            "requestId": request_id,
        }), 429, {'Retry-After': str(remaining_time)}

    # Retrieve and validate input
    data = request.get_json(silent=True)
    if not data or 'email' not in data or 'password' not in data:
        constant_time_response(start_time)
        return jsonify({
            "error": "Please enter email address and password.",
            "requestId": request_id,
        }), 400

    email = data['email']
    password = data['password']

    # Log attempt (do not include password)
    logger.info(
        "Login attempt: email=%s ip=%s request_id=%s",
        email, client_ip, request_id,
    )

    # Look up user
    user = USERS_DB.get(email)

    if not user:
        # Take equivalent time to password verification even when user doesn't exist
        try:
            ph.verify(ph.hash("dummy"), "dummy")
        except VerifyMismatchError:
            pass
        record_attempt(client_ip)
        logger.warning(
            "Login failed (user not found): email=%s ip=%s request_id=%s",
            email, client_ip, request_id,
        )
        constant_time_response(start_time)
        # Uniform error message
        return jsonify({
            "error": "Invalid email address or password.",
            "requestId": request_id,
        }), 401

    # Verify password
    try:
        ph.verify(user['password_hash'], password)
    except VerifyMismatchError:
        record_attempt(client_ip)
        logger.warning(
            "Login failed (wrong password): email=%s ip=%s request_id=%s",
            email, client_ip, request_id,
        )
        constant_time_response(start_time)
        return jsonify({
            "error": "Invalid email address or password.",
            "requestId": request_id,
        }), 401

    # Login successful
    session.clear()  # Prevent session fixation attacks
    session['user_id'] = user['id']
    session['login_time'] = datetime.utcnow().isoformat()
    session['ip'] = client_ip

    # Success log
    logger.info(
        "Login success: user_id=%s email=%s ip=%s request_id=%s",
        user['id'], email, client_ip, request_id,
    )

    # Rehash password if parameters have been updated
    if ph.check_needs_rehash(user['password_hash']):
        user['password_hash'] = ph.hash(password)
        logger.info("Password rehashed: user_id=%s", user['id'])

    constant_time_response(start_time)
    return jsonify({
        "message": "Login successful",
        "requestId": request_id,
    }), 200
```

</details>

---

## 12. FAQ

### Q1. Is input validation required on both frontend and backend?

Yes, both are required. However, the purposes differ. Frontend validation is for **UX improvement**, providing real-time feedback to the user. Backend validation is for **security** — attackers can send arbitrary requests directly to the backend using curl or Burp Suite, completely bypassing frontend validation. Therefore, backend validation is the only reliable line of defense.

### Q2. Does using an ORM completely prevent SQL injection?

Using the ORM's standard API (`filter_by()`, `where()`, etc.) is mostly safe. However, ORMs also have features for constructing raw SQL (SQLAlchemy's `text()`, Django's `raw()`, `extra()`). When using these, the same care as with parameterized queries is required. Also note that LIKE clause wildcards (`%`, `_`) function as special characters — using user input directly in a LIKE pattern risks data leakage.

### Q3. How strict should Content Security Policy (CSP) be?

Ideally, start with `default-src 'none'` and explicitly allow only required resources. For gradual adoption, first operate in "report-only mode" using the `Content-Security-Policy-Report-Only` header, collect violation reports, and formulate the correct policy. Adopt nonce-based `script-src` and avoid `unsafe-inline` and `unsafe-eval`. When loading scripts from a CDN, combine with SRI (Subresource Integrity) hashes.

### Q4. What is a timing attack? Why is it a problem for password comparison?

A timing attack is an attack that infers secret information from differences in processing time. For example, if a string comparison implementation returns `False` the moment it finds the first differing character (short-circuit evaluation), an attacker can infer the number of matching password characters from the time required. `bcrypt.checkpw()` and `hmac.compare_digest()` perform constant-time comparison internally and are thus resistant to this attack. Always use constant-time comparison when performing string comparisons yourself.

### Q5. How can unsafe deserialization be detected?

Use SAST tools (Semgrep, Bandit) to automatically detect usage of `pickle.loads()`, `yaml.load()`, `eval()`, and `exec()`. In code reviews, focus on "objects restored from untrusted data sources." Use safe serialization formats like JSON or Protocol Buffers as alternatives. See [SAST/DAST](./03-sast-dast.md) for details.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Jumping to advanced topics without mastering the fundamentals. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point | Countermeasure |
|------|------|---------|
| Input Validation | Whitelist approach, always perform on server side | Pydantic, Joi, Bean Validation |
| SQL Injection | Use parameterized queries or ORM | PreparedStatement, ORM |
| XSS Prevention | Context-aware escaping + CSP | DOMPurify, template engines |
| CSRF Prevention | Token-based + SameSite Cookie | Flask-WTF, csurf |
| Error Handling | Hide details in production, track with requestId | Structured logging + correlation ID |
| Passwords | Hash with bcrypt/argon2 | argon2id recommended |
| Sessions | Secure + HttpOnly + SameSite attributes required | Session fixation attack prevention |
| SSRF Prevention | Deny access to private IPs and metadata APIs | URL validation + allowlist |
| Deserialization | Do not use pickle/eval on untrusted data | Use JSON/Protobuf |
| ReDoS | Limit regex complexity + limit input length | Use re2 library |

---

## Next Guides to Read

- [Dependency Security](./01-dependency-security.md) — Vulnerability management and SCA for third-party libraries
- [SAST/DAST](./03-sast-dast.md) — Automated code security inspection with Semgrep/SonarQube
- [Container Security](./02-container-security.md) — Security for containerized applications
- [API Security](../03-network-security/02-api-security.md) — Authentication, authorization, and rate limiting at the API level
- Authentication Fundamentals — Systematic understanding of authentication and authorization
- [Cryptography Basics](../02-cryptography/) — Theoretical background of hash functions and encryption

---

## References

1. **OWASP Secure Coding Practices Quick Reference Guide** — https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/
2. **OWASP Cheat Sheet Series** — https://cheatsheetseries.owasp.org/
3. **CWE/SANS Top 25 Most Dangerous Software Weaknesses** — https://cwe.mitre.org/top25/
4. **Mozilla Web Security Guidelines** — https://infosec.mozilla.org/guidelines/web_security
5. **NIST SP 800-63B — Digital Identity Guidelines: Authentication** — https://pages.nist.gov/800-63-3/sp800-63b.html
6. **Google Application Security** — https://cloud.google.com/security/application-security
