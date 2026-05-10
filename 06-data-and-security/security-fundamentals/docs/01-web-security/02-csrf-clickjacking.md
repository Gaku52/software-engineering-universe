# CSRF / Clickjacking

> This chapter explains the attack mechanisms of CSRF (Cross-Site Request Forgery) and clickjacking, and covers how to implement defenses using token-based approaches, SameSite Cookies, and X-Frame-Options.

## Prerequisites

- Basics of HTTP Cookies and session management ([04-auth-vulnerabilities.md](./04-auth-vulnerabilities.md))
- Concept of Same-Origin Policy ([01-xss-prevention.md](./01-xss-prevention.md))
- Fundamentals of HTML forms and HTTP methods (GET/POST/PUT/DELETE)

## What You Will Learn

1. Understand the mechanism of **CSRF attacks** and token-based defense strategies
2. Learn modern CSRF protection using the **SameSite Cookie** attribute
3. Understand **clickjacking** principles and implement defenses using X-Frame-Options / CSP frame-ancestors
4. Implement supplementary defenses through **Origin/Referer header validation**
5. Understand countermeasures against **combined CSRF and XSS attacks**

---

## 1. What Is CSRF (Cross-Site Request Forgery)?

An attack in which an attacker causes an authenticated user to send unintended requests to a web application. It is a representative web vulnerability that continues to appear in the OWASP Top 10.

### 1.1 Basic Attack Mechanism

CSRF requires all three of the following conditions to be met simultaneously:

1. **Cookie-based authentication**: The browser automatically sends cookies with requests
2. **Predictable request format**: The attacker can guess request parameters
3. **Actions with side effects**: State-changing operations (money transfers, settings changes, data deletion, etc.) are possible

```
CSRF Attack Flow:

  Victim             Attacker's Site          Bank Site
    |                    |                     |
    |-- Already logged ->|                     |
    |   (Session         |                     |
    |    Cookie exists)  |                     |
    |                    |                     |
    |-- Visits attack -> |                     |
    |   site             |                     |
    |                    |-- Hidden form  ----> |
    |                    |   transfer request   |
    |                    |   (Cookie auto-sent) |
    |                    |                     |-- Transfer executed!
    |                    |                     |   (Legitimate session)
```

### 1.2 Browser Cookie Sending Mechanism (Internal Behavior)

```
Browser Cookie Sending Decision Flow:

  Request occurs
       |
       v
  +------------------+
  | Search Cookie    |
  | store for        |
  | matching domain  |
  +------------------+
       |
       v
  +------------------+     No
  | Secure attr set? |---------> Do not send if not HTTPS
  +------------------+
       |Yes/None
       v
  +------------------+     No
  | Path matches?    |---------> Do not send
  +------------------+
       |Yes
       v
  +------------------+
  | SameSite attr    |
  | check            |
  +------------------+
       |
  +----+----+----+
  |         |         |
  v         v         v
Strict    Lax      None
  |         |         |
  v         v         v
Same-site  Same-site  Always send
only       + top-level (Secure required)
           navigation
           GET only
```

### 1.3 Concrete CSRF Attack Techniques

```
Variations of Attack Techniques:

1. Hidden form auto-submit:
   <form action="https://bank.com/transfer" method="POST">
     <input type="hidden" name="to" value="attacker">
     <input type="hidden" name="amount" value="1000000">
   </form>
   <script>document.forms[0].submit();</script>

2. Image tag (GET request):
   <img src="https://bank.com/transfer?to=attacker&amount=1000000">

3. XMLHttpRequest / Fetch API:
   fetch('https://bank.com/api/transfer', {
     method: 'POST',
     credentials: 'include',  // Include cookies
     body: JSON.stringify({to: 'attacker', amount: 1000000})
   });
   * Normally blocked if CORS is configured correctly

4. iframe + form:
   <iframe name="csrf-frame" style="display:none"></iframe>
   <form target="csrf-frame" action="https://bank.com/transfer"
         method="POST">
     ...
   </form>
```

```python
# Code Example 1: CSRF attack example and defense
from flask import Flask, request, session, abort
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Vulnerable code: no CSRF token
@app.route("/transfer", methods=["POST"])
def transfer_vulnerable():
    # Authentication by Cookie only -> CSRF attack possible
    to_account = request.form["to"]
    amount = request.form["amount"]
    execute_transfer(session["user_id"], to_account, amount)
    return "Transfer complete"

# Safe code: with CSRF token validation
def generate_csrf_token() -> str:
    """Generate a per-session CSRF token"""
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return session["csrf_token"]

def validate_csrf_token(token: str) -> bool:
    """Validate CSRF token"""
    expected = session.get("csrf_token")
    if not expected or not secrets.compare_digest(token, expected):
        return False
    return True

@app.route("/transfer", methods=["POST"])
def transfer_safe():
    # CSRF token validation
    token = request.form.get("csrf_token", "")
    if not validate_csrf_token(token):
        abort(403, "Invalid CSRF token")
    to_account = request.form["to"]
    amount = request.form["amount"]
    execute_transfer(session["user_id"], to_account, amount)
    return "Transfer complete"
```

---

## 2. CSRF Token Approach

### 2.1 Synchronizer Token Pattern

The most common and reliable CSRF defense. The server generates a random token and embeds it in the form.

```
CSRF Token Flow:

  Browser                               Server
    |                                     |
    |-- GET /transfer (fetch form) --->   |
    |                                     |-- Generate token
    |                                     |   session["csrf"] = "abc123"
    |<-- Form + hidden token ----------   |
    |   <input type="hidden"              |
    |    name="csrf_token"                |
    |    value="abc123">                  |
    |                                     |
    |-- POST /transfer ------------>      |
    |   csrf_token=abc123                 |-- Validate token
    |   to=..., amount=...               |   form value == session value?
    |                                     |-- OK -> Execute transfer
```

```
Synchronizer Token Internal Implementation Flow:

  +------------------+
  | Session starts   |
  +------------------+
         |
         v
  +------------------+
  | Generate token   |
  | with CSPRNG      |
  | (32 bytes+)      |
  +------------------+
         |
    +----+----+
    |         |
    v         v
  Save to    Embed in
  session    form hidden
  store      input
    |         |
    +----+----+
         |
         v (on POST)
  +------------------+
  | Compare form     |
  | value and        |
  | session value    |
  | in constant time |
  | (timing attack   |
  |  prevention)     |
  +------------------+
         |
    +----+----+
    |         |
    v         v
  Match:    Mismatch:
  Process   403 Forbidden
```

### 2.2 Double Submit Cookie Pattern

A stateless CSRF defense. No need to store a token in the server-side session.

```python
# Code Example 2: Double Submit Cookie Pattern
import secrets
import hmac

class DoubleSubmitCSRF:
    """CSRF protection using Double Submit Cookie method

    Principle:
    - Set a random value in both the Cookie and the form
    - Attacker cannot read the Cookie (Same-Origin Policy)
    - Therefore, attacker cannot set the correct value in the form

    Note: Use HMAC signing together to improve resistance
    against subdomain attacks
    """

    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def generate_token(self) -> tuple:
        """Generate a token pair for Cookie and HTML form"""
        random_value = secrets.token_hex(32)
        # Generate Cookie value signed with HMAC
        signed = hmac.new(
            self.secret_key.encode(),
            random_value.encode(),
            "sha256"
        ).hexdigest()
        return random_value, signed  # (cookie_value, form_value)

    def validate(self, cookie_value: str, form_value: str) -> bool:
        """Compare Cookie value and form value"""
        expected_signed = hmac.new(
            self.secret_key.encode(),
            cookie_value.encode(),
            "sha256"
        ).hexdigest()
        return hmac.compare_digest(expected_signed, form_value)

csrf = DoubleSubmitCSRF("my-secret-key")
cookie_val, form_val = csrf.generate_token()
# cookie_val -> Set-Cookie: csrf=<random_value>
# form_val   -> <input type="hidden" name="csrf_token" value="<signed>">
```

### 2.3 Signed Double Submit Cookie (Improved)

```python
# Code Example 3: Signed Double Submit Cookie (with timestamp)
import time
import hmac
import hashlib
import secrets
import json
import base64

class SignedDoubleSubmitCSRF:
    """Improved Double Submit Cookie

    Supplements weaknesses of traditional Double Submit:
    - Expiry set via timestamp
    - Binding to session ID prevents session fixation attacks
    - Tampering detection with HMAC-SHA256
    """

    def __init__(self, secret_key: str, max_age: int = 3600):
        self.secret_key = secret_key.encode()
        self.max_age = max_age  # Token validity period (seconds)

    def generate_token(self, session_id: str) -> str:
        """Generate a CSRF token with timestamp"""
        payload = {
            "sid": session_id,
            "ts": int(time.time()),
            "nonce": secrets.token_hex(16),
        }
        payload_b64 = base64.urlsafe_b64encode(
            json.dumps(payload).encode()
        ).decode()

        signature = hmac.new(
            self.secret_key,
            payload_b64.encode(),
            hashlib.sha256,
        ).hexdigest()

        return f"{payload_b64}.{signature}"

    def validate_token(self, token: str, session_id: str) -> bool:
        """Validate CSRF token"""
        try:
            parts = token.split(".")
            if len(parts) != 2:
                return False
            payload_b64, signature = parts

            # Signature verification
            expected_sig = hmac.new(
                self.secret_key,
                payload_b64.encode(),
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(signature, expected_sig):
                return False

            # Payload verification
            payload = json.loads(
                base64.urlsafe_b64decode(payload_b64)
            )

            # Session ID match check
            if payload.get("sid") != session_id:
                return False

            # Expiry check
            if int(time.time()) - payload.get("ts", 0) > self.max_age:
                return False

            return True
        except Exception:
            return False

# Usage example
csrf = SignedDoubleSubmitCSRF("super-secret-key", max_age=3600)
token = csrf.generate_token(session_id="sess_abc123")
is_valid = csrf.validate_token(token, session_id="sess_abc123")
```

### 2.4 Comparison of Token Approaches

| Method | Stateful | Subdomain Attack Resistance | Implementation Difficulty | SPA Support |
|--------|:--------:|:---------------------------:|:-------------------------:|:-----------:|
| Synchronizer Token | Yes | High | Low | Medium |
| Double Submit Cookie | No | Low | Medium | High |
| Signed Double Submit | No | High | High | High |
| Encrypted Token | No | High | High | High |
| HMAC-based Token | No | High | Medium | High |

---

## 3. SameSite Cookie

The SameSite attribute controls whether the browser sends cookies with requests from third-party sites.

### 3.1 How SameSite Works

```
Definition of "Same Site":

  Whether eTLD+1 (Effective Top-Level Domain + 1) matches

  Examples:
  - www.example.com and api.example.com → Same site (eTLD+1 = example.com)
  - example.com and example.org → Different sites
  - a.github.io and b.github.io → Different sites (github.io is eTLD)

  Note: Same-Site and Same-Origin are different concepts
  - Same-Origin: scheme + host + port must all match exactly
  - Same-Site: eTLD+1 matches
```

```python
# Code Example 4: SameSite Cookie settings (details of each value)
from flask import Flask, make_response

app = Flask(__name__)

@app.route("/login", methods=["POST"])
def login():
    response = make_response("Login successful")

    # Recommended setting: SameSite=Lax
    response.set_cookie(
        "session_id",
        value=generate_session_id(),
        httponly=True,     # Not accessible from JavaScript
        secure=True,       # Sent only over HTTPS
        samesite="Lax",    # Cross-site GET allowed, POST denied
        max_age=3600,
        path="/",
    )
    return response

@app.route("/set-strict-cookie")
def set_strict():
    """Strictest setting (suitable for banking sites, etc.)"""
    response = make_response("OK")
    response.set_cookie(
        "bank_session",
        value=generate_session_id(),
        httponly=True,
        secure=True,
        samesite="Strict",  # Never sent from cross-site requests
        max_age=1800,
        path="/",
        domain=".bank.example.com",  # Also applies to subdomains
    )
    return response

@app.route("/set-none-cookie")
def set_none():
    """Third-party cookie (required for OAuth, etc.)"""
    response = make_response("OK")
    response.set_cookie(
        "third_party",
        value=generate_token(),
        httponly=True,
        secure=True,       # Secure is required for SameSite=None
        samesite="None",   # Sent even in cross-site requests
        max_age=3600,
        path="/",
    )
    return response
```

### 3.2 SameSite Attribute Comparison

| Value | Cross-site GET | Cross-site POST | CSRF Protection | Usability |
|-------|:--------------:|:---------------:|:---------------:|:---------:|
| Strict | Not sent | Not sent | Strongest | Logged out when following external links |
| Lax | Sent | Not sent | Strong | Well-balanced (recommended) |
| None | Sent | Sent | None | Secure attribute required |

```
Behavior of SameSite=Lax:

  Link click from another site (GET):
    example.com -> bank.com/dashboard
    Cookie: session_id=xxx  ✓ Sent

  Form submission from another site (POST):
    evil.com -> bank.com/transfer
    Cookie: session_id=xxx  ✗ Not sent (CSRF protection)

  iframe loaded from another site:
    evil.com has <iframe src="bank.com/dashboard">
    Cookie: session_id=xxx  ✗ Not sent

  Image loaded from another site:
    evil.com has <img src="bank.com/profile.jpg">
    Cookie: session_id=xxx  ✗ Not sent

  fetch/XHR (POST) from another site:
    fetch("bank.com/api", {method: "POST"}) from evil.com
    Cookie: session_id=xxx  ✗ Not sent
```

### 3.3 Browser Support and Caveats for SameSite

```
History of SameSite Browser Default Values:

  Before 2020:
    SameSite not specified → Treated as None (cookies always sent)

  After 2020 (Chrome 80+):
    SameSite not specified → Treated as Lax
    SameSite=None requires the Secure attribute

  Current (2025+):
    All major browsers default to Lax
    Gradual phaseout of third-party cookies is underway

  Edge cases:
    - 2-minute grace period: Chrome sends SameSite=Lax cookies
      in cross-site POST requests within 2 minutes of being set
      (Lax+POST relaxation)
    - Be aware of iOS Safari implementation differences
```

---

## 4. Origin/Referer Header Validation

### 4.1 Validation Using the Origin Header

```python
# Code Example 5: Implementation of Origin/Referer header validation
from flask import Flask, request, abort
from urllib.parse import urlparse

app = Flask(__name__)

ALLOWED_ORIGINS = {
    "https://myapp.example.com",
    "https://www.myapp.example.com",
}

class OriginVerifier:
    """CSRF protection via Origin/Referer header (supplementary measure)

    Note: Origin/Referer headers may be absent in the following cases:
    - Removed by privacy extensions
    - Referrer-Policy: no-referrer is set
    - Old browsers
    - Stripped by proxies
    Therefore, using this in combination with CSRF tokens is recommended.
    """

    def __init__(self, allowed_origins: set):
        self.allowed_origins = allowed_origins

    def verify(self) -> bool:
        """Validate Origin or Referer header"""
        origin = request.headers.get("Origin")

        if origin:
            return origin in self.allowed_origins

        # Use Referer as fallback if Origin is absent
        referer = request.headers.get("Referer")
        if referer:
            parsed = urlparse(referer)
            referer_origin = f"{parsed.scheme}://{parsed.netloc}"
            return referer_origin in self.allowed_origins

        # Decision when both are absent
        # Strict mode: reject (recommended)
        # Lenient mode: allow (compatibility-focused but risky)
        return False  # Strict mode

verifier = OriginVerifier(ALLOWED_ORIGINS)

@app.before_request
def check_origin():
    """Validate the Origin of state-changing requests"""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return None
    if not verifier.verify():
        abort(403, "Origin verification failed")
```

### 4.2 Controlling the Referer Header

```
Relationship between Referrer-Policy and CSRF:

  Referrer-Policy Value      Referer Header Content          Impact on CSRF Validation
  +-----------------------+---------------------------+-------------------+
  | no-referrer           | Not sent                  | Cannot validate   |
  | no-referrer-when-     | Not sent on HTTPS→HTTP    | Validatable within|
  |   downgrade           |                           | HTTPS             |
  | origin                | Origin only               | Validatable       |
  | origin-when-          | Cross-origin: origin only | Validatable       |
  |   cross-origin        |                           |                   |
  | same-origin           | Full URL same-origin only | Cross-origin      |
  |                       |                           | not validatable   |
  | strict-origin         | Origin only (not sent     | Validatable       |
  |                       | on downgrade)             |                   |
  | strict-origin-when-   | Same-origin: full URL     | Recommended       |
  |   cross-origin(rec.)  | Cross-origin: origin only |                   |
  | unsafe-url            | Always full URL           | Validatable but   |
  |                       |                           | privacy risk      |
  +-----------------------+---------------------------+-------------------+
```

---

## 5. CSRF Protection in SPAs (Single Page Applications)

### 5.1 CSRF Defense Patterns in SPAs

```
CSRF Token Flow in SPA:

  Browser (React/Vue/Angular)         API Server
    |                                     |
    |-- GET /api/csrf-token ----------->  |
    |                                     |-- Generate token
    |<-- { "token": "abc123" } --------   |
    |   + Set-Cookie: csrf=abc123         |
    |                                     |
    |-- POST /api/transfer ------------>  |
    |   X-CSRF-Token: abc123             |-- Compare header value
    |   Cookie: csrf=abc123              |   with Cookie value
    |   Cookie: session=xyz              |
    |                                     |-- OK -> Process request
```

```python
# Code Example 6: CSRF protection for SPA (FastAPI + React)
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import secrets

app = FastAPI()

# CORS settings (closely related to CSRF)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://myapp.example.com"],  # Explicitly specified
    allow_credentials=True,   # Allow cookies
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["X-CSRF-Token"],  # Allow custom header
)

@app.get("/api/csrf-token")
async def get_csrf_token(response: Response):
    """Endpoint to issue a CSRF token"""
    token = secrets.token_hex(32)
    # Double Submit Cookie pattern
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=False,  # Allow JS to read (for form submission)
        secure=True,
        samesite="strict",
        max_age=3600,
    )
    return {"csrf_token": token}

@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """CSRF validation middleware"""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)

    # Check for custom header presence
    # Simple Requests cannot send custom headers, so
    # this itself serves as CSRF protection (CORS preflight required)
    csrf_header = request.headers.get("X-CSRF-Token")
    csrf_cookie = request.cookies.get("csrf_token")

    if not csrf_header or not csrf_cookie:
        raise HTTPException(status_code=403, detail="CSRF token missing")

    if not secrets.compare_digest(csrf_header, csrf_cookie):
        raise HTTPException(status_code=403, detail="CSRF token mismatch")

    return await call_next(request)
```

```javascript
// Code Example 7: CSRF token management on the React side
// csrf.js - CSRF token utility

class CSRFTokenManager {
  constructor() {
    this.token = null;
  }

  async fetchToken() {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include',  // Include cookies
    });
    const data = await response.json();
    this.token = data.csrf_token;
    return this.token;
  }

  getToken() {
    if (!this.token) {
      // Read token from cookie (fallback)
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrf_token') {
          this.token = value;
          break;
        }
      }
    }
    return this.token;
  }

  /**
   * CSRF-protected fetch wrapper
   */
  async secureFetch(url, options = {}) {
    if (!this.token) {
      await this.fetchToken();
    }

    const headers = {
      ...options.headers,
      'X-CSRF-Token': this.token,
      'Content-Type': 'application/json',
    };

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  }
}

// Usage example
const csrfManager = new CSRFTokenManager();

async function transferFunds(toAccount, amount) {
  const response = await csrfManager.secureFetch('/api/transfer', {
    method: 'POST',
    body: JSON.stringify({ to: toAccount, amount }),
  });

  if (!response.ok) {
    throw new Error(`Transfer failed: ${response.status}`);
  }
  return response.json();
}
```

### 5.2 CSRF Protection Using Custom Headers

```
Why Custom Headers Serve as CSRF Protection:

  Regular form submission (Simple Request):
  +--------------------------------------------------+
  | <form action="https://api.example.com/transfer"  |
  |       method="POST">                              |
  |   → Content-Type: application/x-www-form-urlencoded |
  |   → Cannot set custom headers                       |
  |   → Sent without CORS preflight                    |
  +--------------------------------------------------+

  Fetch/XHR with custom header:
  +--------------------------------------------------+
  | fetch("https://api.example.com/transfer", {      |
  |   headers: { "X-CSRF-Token": "abc" }             |
  | })                                                |
  |   → CORS preflight (OPTIONS) is required          |
  |   → Cannot be sent from origins not allowed       |
  |     by the server                                 |
  +--------------------------------------------------+

  Therefore:
  - When CORS is correctly configured
  - Checking for the presence of a custom header alone
    can serve as CSRF protection
  - However, since browser CORS implementation bugs may exist,
    token value validation should also be used together
```

---

## 6. Clickjacking

An attack that overlays a transparent iframe on top of a target site, causing users to click on unintended elements.

### 6.1 Attack Mechanism

```
How Clickjacking Works:

  Attacker's page (visible layer):
  +----------------------------------+
  | "You've won a free iPhone!"      |
  |                                  |
  |        [Claim your prize]        |
  |                                  |
  +----------------------------------+

  Bank site overlaid via iframe (transparent):
  +----------------------------------+
  |  Bank: Transfer Confirmation     |
  |                                  |
  |        [Confirm Transfer]  <-- same position|
  |                                  |
  +----------------------------------+

  The user thinks they clicked "Claim your prize",
  but actually clicked "Confirm Transfer".
```

### 6.2 Variants of Clickjacking

```
Variations of Clickjacking:

1. Classic Clickjacking:
   Overlay a transparent iframe on top of a target button

2. Likejacking:
   Hide an SNS "Like" button and make users click it illicitly
   (Exploiting the Facebook Like button)

3. Cursorjacking:
   Shift the displayed cursor position to make users click
   unintended locations
   CSS: cursor: url('custom.cur'), auto;

4. Filejacking:
   Use drag-and-drop operations to upload the user's files
   to the attacker's server

5. Strokejacking:
   Steal keystrokes (redirect keypress events)
   Focus a transparent iframe to steal password input

6. Multi-step Clickjacking:
   Lead users through multiple clicks to complete a multi-step operation
   (Also make users click "Yes" on confirmation dialogs)
```

### 6.3 Implementing Defenses

```python
# Code Example 8: Clickjacking countermeasures
from flask import Flask

app = Flask(__name__)

@app.after_request
def anti_clickjacking(response):
    """Set anti-clickjacking headers"""
    # Method 1: X-Frame-Options (legacy but widely supported)
    response.headers["X-Frame-Options"] = "DENY"
    # DENY: Deny all iframe embedding
    # SAMEORIGIN: Allow only from same origin
    # ALLOW-FROM uri: Allow only from specific origin (deprecated)

    # Method 2: CSP frame-ancestors (recommended, more flexible)
    response.headers["Content-Security-Policy"] = (
        "frame-ancestors 'none'"
        # 'none': Deny all iframe embedding
        # 'self': Allow only from same origin
        # https://trusted.com: Allow only from specific origin
    )
    return response
```

### 6.4 Comparison of X-Frame-Options and CSP frame-ancestors

| Item | X-Frame-Options | CSP frame-ancestors |
|------|----------------|-------------------|
| Specification status | Deprecated (legacy) | W3C Standard |
| Multiple origin specification | Not possible (ALLOW-FROM allows only one) | Possible (space-separated) |
| Wildcard | Not possible | Possible (`*.example.com`) |
| Browser support | All browsers | Modern browsers |
| Priority | CSP frame-ancestors takes precedence | Overrides X-Frame-Options |
| Recommendation | Set both for backward compatibility | Use as the primary measure |

### 6.5 Frame Busting via JavaScript

```javascript
// Code Example 9: Frame escape via JavaScript (supplementary measure)

// Basic frame busting
if (window.top !== window.self) {
  window.top.location = window.self.location;
}

// More robust approach
(function() {
  // Prevent bypass via sandbox attribute
  if (self === top) {
    // Not embedded in iframe -> normal
    document.documentElement.style.display = "block";
  } else {
    // Embedded in iframe -> attempt escape
    try {
      top.location = self.location;
    } catch (e) {
      // Blocked by cross-origin restriction
      document.body.innerHTML =
        "<h1>This page cannot be displayed inside an iframe</h1>";
    }
  }
})();

// Most robust approach: initially hidden in CSS + shown by JS
// HTML: <style>html { display: none; }</style>
(function() {
  if (self === top) {
    document.documentElement.style.display = "block";
  } else {
    // Display nothing if embedded in an iframe
    top.location = self.location;
  }
})();
```

```
Frame Busting Bypass Techniques and Countermeasures:

  Bypass Technique                  Countermeasure
  +-----------------------------+----------------------------------+
  | sandbox="allow-forms"       | Use CSP frame-ancestors          |
  | (Disables JS)               |                                  |
  +-----------------------------+----------------------------------+
  | Block navigation with       | Prioritize HTTP header-based     |
  | onbeforeunload              | countermeasures                  |
  | window.onbeforeunload =     |                                  |
  |   () => false;              |                                  |
  +-----------------------------+----------------------------------+
  | Double framing              | Instead of top !== self, use     |
  | (Attacker inserts another   | top.location !== self.location   |
  |  iframe within their iframe)| for detection                    |
  +-----------------------------+----------------------------------+
  | Overwrite location change   | Object.defineProperty cannot be  |
  | Object.defineProperty(      | used from top, so it is safe     |
  |   window, 'top', ...)       |                                  |
  +-----------------------------+----------------------------------+

  Conclusion: Frame Busting is only a supplementary measure.
              CSP frame-ancestors + X-Frame-Options should be primary.
```

---

## 7. Comprehensive Defense Strategy

### 7.1 Integrated Defense Against CSRF and Clickjacking

```python
# Code Example 10: Integrated CSRF + Clickjacking defense middleware
from flask import Flask, request, session, abort
from functools import wraps
import secrets
import time
import hashlib
import hmac

app = Flask(__name__)

class SecurityMiddleware:
    """Integrated CSRF and clickjacking defense middleware"""

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

    def __init__(self, app, secret_key: str, csrf_header: str = "X-CSRF-Token"):
        self.app = app
        self.secret_key = secret_key
        self.csrf_header = csrf_header
        app.before_request(self._check_csrf)
        app.after_request(self._set_security_headers)

    def _check_csrf(self):
        """Validate CSRF token for state-changing requests"""
        if request.method in self.SAFE_METHODS:
            return None

        # AJAX request detection (supplementary measure)
        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            # AJAX requests require CORS preflight, so
            # they are generally CSRF-safe, but additional validation is also applied
            pass

        # Origin header validation (supplementary measure)
        origin = request.headers.get("Origin")
        if origin and not self._is_same_origin(origin):
            abort(403, "Cross-origin request blocked")

        # CSRF token validation
        token = (request.form.get("csrf_token") or
                 request.headers.get(self.csrf_header))
        if not token or not self._validate_token(token):
            abort(403, "Invalid CSRF token")

    def _set_security_headers(self, response):
        """Set security headers"""
        # Clickjacking protection
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = (
            "frame-ancestors 'none'"
        )

        # Other security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "0"  # Recommended to disable in modern browsers
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # CSRF Cookie setting (for Double Submit)
        if "csrf_token" in session:
            response.set_cookie(
                "csrf_token",
                value=session["csrf_token"],
                httponly=False,  # Readable from JS
                secure=True,
                samesite="Strict",
            )

        return response

    def _is_same_origin(self, origin: str) -> bool:
        return origin in ("https://myapp.example.com",)

    def _validate_token(self, token: str) -> bool:
        expected = session.get("csrf_token", "")
        return secrets.compare_digest(token, expected)

# Apply middleware
SecurityMiddleware(app, "my-secret-key")
```

### 7.2 CSRF Protection in Django

```python
# Code Example 11: Using Django's built-in CSRF protection

# settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',  # CSRF middleware
    # ...
]

# CSRF settings
CSRF_COOKIE_SECURE = True        # HTTPS only
CSRF_COOKIE_HTTPONLY = False      # Readable from JS (for AJAX)
CSRF_COOKIE_SAMESITE = "Lax"     # SameSite=Lax
CSRF_USE_SESSIONS = False        # Store CSRF token in Cookie (True for session)
CSRF_TRUSTED_ORIGINS = [         # Trusted origins
    "https://myapp.example.com",
]

# Security header settings
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = False  # Disable X-XSS-Protection

# Usage in templates
# <form method="post">
#   {% csrf_token %}
#   ...
# </form>

# Usage in AJAX (Django official pattern)
# views.py
from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import JsonResponse

@ensure_csrf_cookie
def get_csrf(request):
    """Endpoint to set CSRF cookie"""
    return JsonResponse({"status": "ok"})
```

### 7.3 Comparison of Defense Methods

| Defense Method | CSRF Protection | Clickjacking Protection | Recommendation |
|----------------|:---------------:|:-----------------------:|:--------------:|
| CSRF Token (Synchronizer) | Strong | - | High |
| Double Submit Cookie | Medium | - | Medium |
| Signed Double Submit | Strong | - | High |
| SameSite=Lax | Strong | - | High |
| SameSite=Strict | Strongest | - | Context-dependent |
| Origin/Referer header validation | Supplementary | - | Supplementary |
| Custom header (with CORS) | Strong | - | High (SPA) |
| X-Frame-Options | - | Strong | High |
| CSP frame-ancestors | - | Strong | Highest |
| Frame Busting (JS) | - | Weak | Supplementary only |

---

## 8. Relationship with CORS (Cross-Origin Resource Sharing)

```
Relationship between CORS and CSRF:

  CORS controls cross-origin requests in the browser:
  - Restricts reading of responses (does NOT restrict sending!)
  - Therefore, CORS alone cannot prevent CSRF

  Simple Request (no CORS preflight):
  +--------------------------------------------------+
  | Conditions:                                       |
  | - Method: GET, HEAD, POST                         |
  | - Content-Type: text/plain,                       |
  |   application/x-www-form-urlencoded,              |
  |   multipart/form-data                             |
  | - No custom headers                               |
  |                                                   |
  | → Request is sent (response cannot be read)       |
  | → CSRF attack succeeds!                           |
  +--------------------------------------------------+

  Preflight Request (with custom header):
  +--------------------------------------------------+
  | Conditions:                                       |
  | - Content-Type: application/json                  |
  | - Custom header (X-CSRF-Token, etc.)              |
  | - Method: PUT, DELETE, etc.                       |
  |                                                   |
  | → An OPTIONS request is sent first                |
  | → If server does not allow it, actual request     |
  |   is not sent                                     |
  | → CSRF attack does not succeed                    |
  |   (if CORS is configured correctly)               |
  +--------------------------------------------------+
```

```python
# Code Example 12: Correct CORS configuration
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# NG: Wildcard origin + credentials
# CORS(app, origins="*", supports_credentials=True)  # Dangerous!

# OK: Explicit origin specification
CORS(app,
    origins=["https://myapp.example.com"],
    supports_credentials=True,
    allow_headers=["Content-Type", "X-CSRF-Token"],
    methods=["GET", "POST", "PUT", "DELETE"],
    max_age=3600,
)
```

---

## 9. Edge Cases

### Edge Case 1: Login CSRF

```
Login CSRF:

  An attack that causes the victim's browser to log in to the attacker's account

  Attack flow:
  1. Attacker embeds a Login CSRF with their own credentials
  2. Victim visits the attacker's site
  3. Victim's browser logs in with the attacker's account
  4. Victim unknowingly operates on the attacker's account
  5. Attacker later reviews the account and
     steals data entered by the victim (credit card info, etc.)

  Countermeasures:
  - Set CSRF tokens on login forms as well
  - Regenerate session ID after login (also prevents Session Fixation)
```

### Edge Case 2: CSRF Against JSON APIs

```
CSRF with JSON Content-Type:

  application/json does not meet Simple Request conditions, so
  a CORS preflight occurs and CSRF normally does not succeed.

  However, caution is needed in the following cases:
  1. If the server does not validate Content-Type
     → JSON can be sent as text/plain
  2. 307 redirect via Flash (now fixed)
  3. Server uses wildcard in CORS configuration

  Countermeasures:
  - Strictly validate Content-Type: application/json
  - Make custom headers mandatory
  - Tighten CORS configuration
```

### Edge Case 3: CSRF via Subdomain

```
Subdomain Attack:

  If an attacker can obtain a subdomain of app.example.com
  (e.g., evil.example.com):

  1. Can set Cookies with .example.com scope from evil.example.com
     (Cookie Injection)
  2. SameSite Cookies treat subdomains as "same site"
     since eTLD+1 is the same
  3. Can overwrite the Cookie value in Double Submit Cookie

  Countermeasures:
  - Use Cookies with __Host- prefix
    (Cannot set domain attribute → cannot be overwritten from subdomains)
  - Use Signed Double Submit Cookie
  - Strictly manage subdomain assignments
```

---

## 10. Testing Methods

```python
# Code Example 13: Testing for CSRF vulnerabilities
import requests

class CSRFTester:
    """Automated CSRF vulnerability testing tool"""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()

    def test_missing_token(self, endpoint: str, method: str = "POST",
                            data: dict = None) -> dict:
        """Send request without CSRF token"""
        response = getattr(self.session, method.lower())(
            f"{self.base_url}{endpoint}",
            data=data or {},
        )
        return {
            "test": "missing_token",
            "status_code": response.status_code,
            "vulnerable": response.status_code != 403,
        }

    def test_invalid_token(self, endpoint: str, method: str = "POST",
                            data: dict = None) -> dict:
        """Send request with invalid CSRF token"""
        test_data = data or {}
        test_data["csrf_token"] = "invalid_token_12345"
        response = getattr(self.session, method.lower())(
            f"{self.base_url}{endpoint}",
            data=test_data,
        )
        return {
            "test": "invalid_token",
            "status_code": response.status_code,
            "vulnerable": response.status_code != 403,
        }

    def test_cross_origin(self, endpoint: str, method: str = "POST",
                           data: dict = None) -> dict:
        """Send request with a different Origin header"""
        headers = {"Origin": "https://evil.example.com"}
        response = getattr(self.session, method.lower())(
            f"{self.base_url}{endpoint}",
            data=data or {},
            headers=headers,
        )
        return {
            "test": "cross_origin",
            "status_code": response.status_code,
            "vulnerable": response.status_code != 403,
        }

    def test_clickjacking(self) -> dict:
        """Check X-Frame-Options / CSP frame-ancestors"""
        response = self.session.get(self.base_url)
        xfo = response.headers.get("X-Frame-Options", "")
        csp = response.headers.get("Content-Security-Policy", "")

        vulnerable = True
        if xfo.upper() in ("DENY", "SAMEORIGIN"):
            vulnerable = False
        if "frame-ancestors" in csp:
            vulnerable = False

        return {
            "test": "clickjacking",
            "x_frame_options": xfo,
            "csp_frame_ancestors": csp,
            "vulnerable": vulnerable,
        }

# Usage example
tester = CSRFTester("https://myapp.example.com")
results = [
    tester.test_missing_token("/transfer", data={"to": "test", "amount": "1"}),
    tester.test_invalid_token("/transfer", data={"to": "test", "amount": "1"}),
    tester.test_cross_origin("/transfer", data={"to": "test", "amount": "1"}),
    tester.test_clickjacking(),
]
for r in results:
    status = "VULNERABLE" if r["vulnerable"] else "SAFE"
    print(f"[{status}] {r['test']}: {r.get('status_code', 'N/A')}")
```

---

## 11. Performance Considerations

```
Performance Impact of CSRF Countermeasures:

  +------------------------+------------------+------------------+
  | Measure                | Latency Impact   | Memory Impact    |
  +------------------------+------------------+------------------+
  | Synchronizer Token     | Session r/w      | Session store    |
  |                        | ~1ms             | +64B/session     |
  +------------------------+------------------+------------------+
  | Double Submit Cookie   | HMAC computation | None (stateless) |
  |                        | ~0.1ms           |                  |
  +------------------------+------------------+------------------+
  | SameSite Cookie        | None             | None             |
  |                        | (browser-side)   |                  |
  +------------------------+------------------+------------------+
  | Origin validation      | String compare   | None             |
  |                        | ~0.01ms          |                  |
  +------------------------+------------------+------------------+

  Conclusion:
  - Performance impact is virtually negligible
  - SameSite Cookie is lightest with no server-side processing
  - Synchronizer Token incurs additional writes to the session store
    (Redis, etc.), but is not a practical concern
```

---

## Exercises

### Exercise 1: Basic — Implementing a CSRF Token

**Task**: Implement Synchronizer Token Pattern CSRF protection in a Flask application.

```
Requirements:
1. Display a form with a CSRF token at /form (GET)
2. Validate the CSRF token at /submit (POST)
3. Return 403 if the token is invalid
4. The token must be unique per session

Hints:
- Generate token with secrets.token_hex()
- Use secrets.compare_digest() for timing-safe comparison
- Embed in template with {{ csrf_token }}
```

### Exercise 2: Applied — CSRF Protection for SPA

**Task**: Implement the Double Submit Cookie pattern in a React + FastAPI setup.

```
Requirements:
1. GET /api/csrf returns a CSRF token in both Cookie and JSON response
2. POST/PUT/DELETE requests compare the X-CSRF-Token header
   with the csrf Cookie value
3. Configure CORS properly to limit allowed origins
4. Use Axios interceptors on the React side to automatically attach the CSRF token

Verification:
- Confirm that POST without X-CSRF-Token is rejected via curl
- Confirm that requests from an invalid Origin are rejected via curl
```

### Exercise 3: Advanced — Comprehensive Security Header Configuration

**Task**: Implement a middleware that sets all of the following security headers.

```
Required headers:
- X-Frame-Options: DENY
- Content-Security-Policy: frame-ancestors 'none'; ...
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Permissions-Policy: camera=(), microphone=(), geolocation=()

Additional requirements:
- Allow header configuration to be loaded from a JSON config file
- Switch configurations based on environment (development/staging/production)
- Write unit tests to validate header correctness
```

---

## Anti-Patterns

### Anti-Pattern 1: State Changes via GET Requests

Performing state-changing actions such as money transfers or deletions via GET requests. A simple attack like `<img src="/delete?id=123">` is enough to achieve CSRF. State changes must be restricted to POST/PUT/DELETE methods; GET should only be used for safe (side-effect-free) operations.

```python
# NG: State change via GET
@app.route("/delete-account")  # Account deletion via GET
def delete_account():
    db.delete_user(session["user_id"])
    return "Deleted"
# Attack: Just embed <img src="/delete-account"> in an email, etc.

# OK: State change via POST + CSRF protection
@app.route("/delete-account", methods=["POST"])
def delete_account():
    validate_csrf_token(request.form["csrf_token"])
    db.delete_user(session["user_id"])
    return "Deleted"
```

### Anti-Pattern 2: Reusing CSRF Tokens

Sharing the same CSRF token across all users, or not setting an expiry on tokens. Tokens must be unique per session and should have an appropriate expiry.

```python
# NG: Fixed token
CSRF_TOKEN = "fixed-token-for-all-users"  # Shared by all users!

# NG: No expiry
session["csrf_token"] = secrets.token_hex(32)
# → The same token is used for as long as the session lasts

# OK: Unique per session + with expiry
def generate_csrf_token():
    token_data = {
        "value": secrets.token_hex(32),
        "created_at": time.time(),
    }
    session["csrf_token"] = token_data
    return token_data["value"]
```

### Anti-Pattern 3: Overly Permissive CORS

```python
# NG: Wildcard origin + credentials
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    # → Browsers reject this combination, but
    #   servers that echo back Origin allow attacks

# NG: Reflecting Origin header as-is
@app.after_request
def add_cors_echo(response):
    origin = request.headers.get("Origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin  # Dangerous!
    response.headers["Access-Control-Allow-Credentials"] = "true"

# OK: Validate against a whitelist
ALLOWED_ORIGINS = {"https://myapp.example.com", "https://admin.example.com"}

@app.after_request
def add_cors_safe(response):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response
```

---

## FAQ

### Q1: Is a CSRF token unnecessary if SameSite=Lax is set?

Not recommended. SameSite=Lax is a strong measure, but the following risks remain:
- May not be supported in older browsers
- Does not protect against attacks from subdomains (treated as Same-Site)
- Cannot protect against state changes via GET method
- Possibility of browser implementation bugs
Using it in combination with CSRF tokens is recommended (principle of defense in depth).

### Q2: Is CSRF protection needed for API-only applications?

CSRF protection is required for APIs that use Cookie-based authentication. APIs that authenticate with Bearer Tokens (Authorization header) have lower CSRF risk because they do not use Cookies. However, CORS configuration must still be done correctly.

### Q3: What if I want to use iframes for legitimate purposes?

Allow only specific origins using CSP frame-ancestors. For example, `frame-ancestors 'self' https://partner.com` allows iframe embedding only from your own site and a trusted partner site.

### Q4: Is it acceptable to include the CSRF token in a URL parameter?

Not recommended. URL parameters can leak to the following locations:
- Browser history
- Server access logs
- Referer header
- Proxy logs
CSRF tokens should always be sent in the POST body or HTTP headers.

### Q5: Is CSRF protection needed for WebSockets?

Cookies are sent during the WebSocket initial handshake (HTTP Upgrade), so CSRF protection is needed. Countermeasures include:
- Validating the Origin header
- Including the CSRF token in the WebSocket connection URL as a query parameter
- Sending an authentication token as the first message after the WebSocket connection is established

### Q6: What is a Cookie with the __Host- prefix?

```
Cookie with __Host- Prefix:

  Set-Cookie: __Host-session=abc123; Secure; Path=/

  Constraints:
  - Secure attribute is required
  - Domain attribute cannot be set (rejected if set)
  - Path=/ is required

  Effect:
  - Cannot be overwritten from subdomains
  - Prevents Cookie Injection attacks against Double Submit Cookie

  Browser support: Chrome 49+, Firefox 50+, Safari 12+
```

---

## Troubleshooting

### CSRF Token Validation Fails

```
Checklist:
1. Is the session being maintained correctly?
   → Check that the Redis/Memcached session store is running
2. Is the session being distributed across load balancers?
   → Use Sticky Session or a shared session store
3. Does the form include a hidden input for csrf_token?
   → Verify using browser developer tools
4. Is the header set in AJAX requests?
   → Check for the X-CSRF-Token header in the Network tab
5. Is a SameSite Cookie blocking the request?
   → Check the SameSite attribute of the Cookie in the Application tab
```

### iframe Embedding Is Unintentionally Blocked

```
Checklist:
1. Check X-Frame-Options and CSP frame-ancestors settings
2. If iframe embedding is needed, explicitly specify it with frame-ancestors
3. CSP frame-ancestors takes precedence over X-Frame-Options
4. ALLOW-FROM is not supported in Chrome/Firefox → use frame-ancestors
```

---

## Summary

| Threat | Recommended Countermeasure | Priority |
|--------|---------------------------|----------|
| CSRF | SameSite=Lax + CSRF token | Highest |
| Clickjacking | CSP frame-ancestors + X-Frame-Options | Highest |
| Cross-origin requests | CORS configuration + Origin validation | High |
| Session hijacking | HttpOnly + Secure Cookie | High |
| Login CSRF | CSRF token on login forms as well | Medium |
| Subdomain attack | __Host- prefix + Signed Token | Medium |

---

## Further Reading

- [03-injection.md](./03-injection.md) -- Injection attacks in detail and countermeasures
- [04-auth-vulnerabilities.md](./04-auth-vulnerabilities.md) -- Authentication and session management vulnerabilities
- [01-xss-prevention.md](./01-xss-prevention.md) -- Handling combined XSS and CSRF attacks
- [../04-application-security/00-secure-coding.md](../04-application-security/00-secure-coding.md) -- Secure coding in general

---

## References

1. OWASP CSRF Prevention Cheat Sheet -- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
2. OWASP Clickjacking Defense Cheat Sheet -- https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html
3. MDN Web Docs: SameSite Cookies -- https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
4. RFC 6454: The Web Origin Concept -- https://tools.ietf.org/html/rfc6454
5. Fetch Standard (CORS) -- https://fetch.spec.whatwg.org/
6. CSP Level 3: frame-ancestors -- https://www.w3.org/TR/CSP3/#directive-frame-ancestors
7. Cookie Prefixes (__Host-, __Secure-) -- https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#cookie_prefixes
8. Robust Defenses for Cross-Site Request Forgery (Stanford) -- https://seclab.stanford.edu/websec/csrf/csrf.pdf
