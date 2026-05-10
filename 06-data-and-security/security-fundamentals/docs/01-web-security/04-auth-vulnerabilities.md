# Authentication Vulnerabilities

> A comprehensive guide to designing and implementing secure authentication systems, focusing on password management, session management, brute-force protection, multi-factor authentication, and JWT security. Authentication is the process of confirming "who you are," and its vulnerabilities lead directly to unauthorized access, making it one of the most critical areas in security.

## What You Will Learn

1. How to implement **secure password management** (hashing, policies, breach checking, MFA)
2. Vulnerability patterns in **session management** and robust implementation techniques
3. Proper design of **brute-force protection** and account lockout
4. How to use **JWT securely** and defend against attack patterns
5. The characteristics of each **multi-factor authentication (MFA)** method and implementation considerations

## Prerequisites

- [Security Overview](../00-basics/00-security-overview.md) -- CIA triad and basic security concepts
- [Threat Modeling](../00-basics/01-threat-modeling.md) -- Attacker motivations and risk assessment
- Difference between authentication and authorization -- Basics of AuthN vs. AuthZ
- [Cryptography Basics](../02-cryptography/00-crypto-basics.md) -- Fundamentals of hash functions and encryption
- Understanding of HTTP basics (cookies, headers, status codes)

---

## 1. Password Management

### 1.1 Why Password Hashing Matters

The reason for properly hashing passwords is to **minimize damage in the event of a database breach**. Incidents where corporate databases are leaked occur every year, and passwords stored in plaintext or with inadequate hashing are immediately exploited.

Using a proper hashing algorithm means that even if the entire database is leaked, attackers would need an enormous computational cost to recover passwords, making it practically impossible.

### 1.2 The Evolution of Password Hashing

```
Evolution of password storage methods and their issues:

  NG: Plaintext       "password123"                → Immediately exploitable
  NG: MD5             "482c811da5d5b4bc..."         → Too fast, rainbow table attacks
  NG: SHA-256         "ef92b778bafe..."             → Too fast, billions of computations per second with GPU
  NG: SHA-256+salt    "a1b2c3..." + salt            → Still too fast even with salt
  OK: bcrypt          "$2b$12$LJ3..."               → Intentionally slow, built-in salt, adjustable cost
  OK: scrypt          (memory-hard)                  → GPU/ASIC resistant
  OK: Argon2id        "$argon2id$v=19$..."           → Memory-hard + CPU-hard, currently most recommended

  Key points:
  - For password hashing, being "slow" is a virtue
  - General-purpose hashes (MD5/SHA) are designed for speed
  - Password-specific hashes (bcrypt/Argon2id) are intentionally slow
```

### 1.3 Secure Password Hashing Implementation

```python
# Code Example 1: Password hash management using Argon2id
import hashlib
import requests
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError


class PasswordManager:
    """Secure password management class

    Uses Argon2id to provide password hashing, verification, and policy checking.
    Argon2id is a hybrid mode combining Argon2i (side-channel resistance) and Argon2d (GPU resistance),
    and is the first-choice algorithm recommended by OWASP.
    """

    def __init__(self):
        # OWASP recommended parameters (as of 2024)
        # - time_cost: number of iterations (higher = slower = more secure)
        # - memory_cost: memory usage in KB (higher = more GPU/ASIC resistance)
        # - parallelism: degree of parallelism (match to CPU core count)
        self.ph = PasswordHasher(
            time_cost=3,
            memory_cost=65536,  # 64 MB
            parallelism=4,
        )

    def hash_password(self, password: str) -> str:
        """Hash a password using Argon2id

        Salt is automatically generated and embedded in the hash string.
        """
        return self.ph.hash(password)

    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify a password (timing-attack resistant)"""
        try:
            return self.ph.verify(hashed, password)
        except VerifyMismatchError:
            return False

    def needs_rehash(self, hashed: str) -> bool:
        """Determine if rehashing is needed when parameters are outdated

        Used to automatically rehash upon successful login
        when the algorithm parameters have been strengthened.
        """
        return self.ph.check_needs_rehash(hashed)

    def validate_policy(self, password: str) -> list:
        """Password policy validation compliant with NIST SP 800-63B

        Key points of NIST guidelines:
        - Minimum 8 characters (12+ recommended)
        - Accept at least 64 characters maximum
        - No mandatory character type requirements (reduces usability)
        - Checking against breached password lists is mandatory
        """
        errors = []
        if len(password) < 12:
            errors.append("Password must be at least 12 characters")
        if len(password) > 128:
            errors.append("Password must be 128 characters or fewer")
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")
        # Breached password check (Have I Been Pwned API)
        if self._is_breached(password):
            errors.append("This password has appeared in a past data breach")
        return errors

    def _is_breached(self, password: str) -> bool:
        """Check password breach using HIBP's k-anonymity API

        Only the first 5 characters of the SHA-1 hash of the password are sent,
        so the password itself never travels over the network.
        """
        sha1 = hashlib.sha1(password.encode()).hexdigest().upper()
        prefix, suffix = sha1[:5], sha1[5:]
        try:
            resp = requests.get(
                f"https://api.pwnedpasswords.com/range/{prefix}",
                timeout=5,
            )
            return suffix in resp.text
        except requests.RequestException:
            # On API failure, err on the safe side (do not block)
            return False


# Usage example
pm = PasswordManager()

# Policy check
errors = pm.validate_policy("MyS3cur3P@ssw0rd!")
if errors:
    print(f"Policy violations: {errors}")
else:
    # Hash and store
    hashed = pm.hash_password("MyS3cur3P@ssw0rd!")
    print(f"Hash: {hashed}")
    # e.g. $argon2id$v=19$m=65536,t=3,p=4$salt$hash

    # Verification
    print(pm.verify_password("MyS3cur3P@ssw0rd!", hashed))  # True
    print(pm.verify_password("wrong", hashed))               # False

    # Rehash check on login
    if pm.needs_rehash(hashed):
        new_hash = pm.hash_password("MyS3cur3P@ssw0rd!")
        print("Parameters updated — rehashed password")
```

### 1.4 Comparison Implementation with bcrypt

```python
# Code Example 2: Password hashing with bcrypt (for legacy systems)
import bcrypt


class BcryptPasswordManager:
    """Password management using bcrypt

    For environments where Argon2id is unavailable (old Python/library constraints).
    bcrypt is a battle-tested algorithm in use since 1999.

    WHY the bcrypt cost factor matters:
    - cost=10: ~100ms/hash (2015 standard)
    - cost=12: ~400ms/hash (2024 recommendation)
    - cost=14: ~1.6s/hash (high-security environments)
    Security is maintained by increasing cost as hardware improves.
    """

    DEFAULT_ROUNDS = 12  # 2024 recommended value

    def hash_password(self, password: str) -> str:
        """bcrypt hashing (automatic salt generation)"""
        # Note: bcrypt truncates internally at 72 bytes
        if len(password.encode("utf-8")) > 72:
            # Pre-hash long passwords with SHA-256
            import hashlib
            password = hashlib.sha256(password.encode()).hexdigest()

        salt = bcrypt.gensalt(rounds=self.DEFAULT_ROUNDS)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify a password"""
        if len(password.encode("utf-8")) > 72:
            import hashlib
            password = hashlib.sha256(password.encode()).hexdigest()

        return bcrypt.checkpw(
            password.encode("utf-8"),
            hashed.encode("utf-8"),
        )


# Usage example
bpm = BcryptPasswordManager()
hashed = bpm.hash_password("SecurePass123!")
print(bpm.verify_password("SecurePass123!", hashed))  # True
```

### 1.5 Password Hashing Algorithm Comparison

| Algorithm | Memory-Hard | GPU Resistance | Recommendation | Cost Tuning | Notes |
|-----------|:-----------:|:--------------:|:--------------:|:-----------:|-------|
| MD5 | - | - | Forbidden | No | Too fast, collisions found |
| SHA-256 | - | - | Not suitable | No | Not intended for passwords |
| PBKDF2 | - | Low | Conditional | Iteration count | Required for FIPS 140-2 compliance |
| bcrypt | - | Medium | Recommended | rounds | 72-byte limit |
| scrypt | Yes | High | Recommended | N, r, p | Complex parameter tuning |
| Argon2id | Yes | Best | Most Recommended | time, memory, parallelism | Winner of Password Hashing Competition |

---

## 2. Session Management

### 2.1 Overview of Session Management

Session management is a mechanism for maintaining user state over the stateless HTTP protocol. Session management vulnerabilities allow attackers to impersonate users, making it just as critical as authentication itself.

```
Session management flow:

  Client                                  Server
    |                                       |
    |-- POST /login (credentials) -------> |
    |                                       |-- Authentication success
    |                                       |-- Generate session ID
    |                                       |   (cryptographically random, 256+ bits)
    |<-- Set-Cookie: sid=<random> --------- |
    |    HttpOnly; Secure; SameSite=Lax     |
    |    Path=/; Max-Age=3600               |
    |                                       |
    |-- GET /dashboard ------------------>  |
    |   Cookie: sid=<random>                |-- Session validation
    |                                       |   1. Verify session ID exists
    |                                       |   2. Check absolute timeout
    |                                       |   3. Check idle timeout
    |                                       |   4. Verify UA/IP consistency
    |                                       |-- Retrieve user information
    |<-- 200 OK (dashboard) -------------- |
    |                                       |
    |-- POST /logout -------------------->  |
    |                                       |-- Destroy server-side session
    |                                       |-- Delete associated data
    |<-- Set-Cookie: sid=; Max-Age=0 -----  |
```

### 2.2 Session Management Vulnerability Patterns

```
Major threats to session management:

  +--------------------------------------------------+
  | 1. Session Fixation Attack                        |
  |    Attacker pre-sets a session ID,                |
  |    which continues to be used after login         |
  |    Mitigation: Regenerate session ID on login     |
  +--------------------------------------------------+
  | 2. Session Hijacking                              |
  |    Steal session ID via network sniffing or XSS   |
  |    Mitigation: Secure attribute, HttpOnly, HTTPS  |
  +--------------------------------------------------+
  | 3. Session Prediction                             |
  |    Using predictable session IDs                  |
  |    Mitigation: Cryptographically secure random    |
  |                (secrets.token_hex)                |
  +--------------------------------------------------+
  | 4. Client-Side Session Storage                    |
  |    Storing user ID or roles directly in cookies   |
  |    Mitigation: Server-side session store          |
  +--------------------------------------------------+
```

### 2.3 Implementing Secure Session Management

```python
# Code Example 3: Secure session management
import secrets
import time
import hashlib
from typing import Optional, Dict


class SecureSessionManager:
    """Secure session management

    WHY each design decision is necessary:
    - SESSION_ID_LENGTH=32: 256 bits of entropy prevents guessing attacks
      (2^256 combinations → brute-force impossible)
    - SESSION_TIMEOUT=3600: Limits the time window for session fixation attacks
    - IDLE_TIMEOUT=1800: Prevents session abuse when the user is away
    - UA hash verification: Detects session hijacking
    """

    SESSION_ID_LENGTH = 32   # 32 bytes = 256 bits of entropy
    SESSION_TIMEOUT = 3600   # Absolute timeout: 1 hour
    IDLE_TIMEOUT = 1800      # Idle timeout: 30 minutes
    MAX_SESSIONS_PER_USER = 5  # Limit on concurrent sessions

    def __init__(self):
        # Use an external store such as Redis in production
        self.sessions: Dict[str, dict] = {}

    def create_session(self, user_id: str, ip: str,
                       user_agent: str) -> str:
        """Create a session after successful authentication

        Returns:
            Cryptographically secure session ID string
        """
        # Limit the number of concurrent sessions
        user_sessions = [
            sid for sid, data in self.sessions.items()
            if data["user_id"] == user_id
        ]
        if len(user_sessions) >= self.MAX_SESSIONS_PER_USER:
            # Remove the oldest session
            oldest = min(user_sessions,
                        key=lambda s: self.sessions[s]["created_at"])
            self.destroy_session(oldest)

        session_id = secrets.token_hex(self.SESSION_ID_LENGTH)
        now = time.time()
        self.sessions[session_id] = {
            "user_id": user_id,
            "created_at": now,
            "last_activity": now,
            "ip": ip,
            "user_agent_hash": hashlib.sha256(
                user_agent.encode()
            ).hexdigest(),
        }
        return session_id

    def validate_session(self, session_id: str, ip: str,
                         user_agent: str) -> Optional[str]:
        """Validate a session

        Validation checks:
        1. Session existence
        2. Absolute timeout (time elapsed since creation)
        3. Idle timeout (time elapsed since last activity)
        4. User-Agent consistency (session hijacking detection)
        """
        session = self.sessions.get(session_id)
        if not session:
            return None

        now = time.time()

        # Absolute timeout check
        if now - session["created_at"] > self.SESSION_TIMEOUT:
            self.destroy_session(session_id)
            return None

        # Idle timeout check
        if now - session["last_activity"] > self.IDLE_TIMEOUT:
            self.destroy_session(session_id)
            return None

        # Detect User-Agent change (sign of session hijacking)
        ua_hash = hashlib.sha256(user_agent.encode()).hexdigest()
        if session["user_agent_hash"] != ua_hash:
            self.destroy_session(session_id)
            return None

        # Update last activity
        session["last_activity"] = now
        return session["user_id"]

    def regenerate_session(self, old_session_id: str) -> Optional[str]:
        """Regenerate session ID (required on privilege escalation)

        WHY: If an attacker pre-set a session ID before login and
        it continues to be used after login, a session fixation attack succeeds.
        Always regenerate the session ID on successful login or privilege change.
        """
        session = self.sessions.get(old_session_id)
        if not session:
            return None
        # Delete old session
        del self.sessions[old_session_id]
        # Register the same data under a new session ID
        new_session_id = secrets.token_hex(self.SESSION_ID_LENGTH)
        session["last_activity"] = time.time()
        self.sessions[new_session_id] = session
        return new_session_id

    def destroy_session(self, session_id: str) -> None:
        """Destroy a session"""
        self.sessions.pop(session_id, None)

    def destroy_all_user_sessions(self, user_id: str) -> int:
        """Destroy all sessions for a specific user

        Use cases: password change, account compromise detection
        """
        to_delete = [
            sid for sid, data in self.sessions.items()
            if data["user_id"] == user_id
        ]
        for sid in to_delete:
            del self.sessions[sid]
        return len(to_delete)

    def get_active_sessions(self, user_id: str) -> list:
        """Get a list of active sessions for a user

        Allows users to view and manage all their own sessions.
        """
        now = time.time()
        return [
            {
                "session_id": sid[:8] + "...",  # Show only the prefix
                "created_at": data["created_at"],
                "last_activity": data["last_activity"],
                "ip": data["ip"],
            }
            for sid, data in self.sessions.items()
            if data["user_id"] == user_id
            and now - data["created_at"] <= self.SESSION_TIMEOUT
        ]


# Usage example
sm = SecureSessionManager()

# On successful login
session_id = sm.create_session(
    "user123", "192.168.1.100", "Mozilla/5.0..."
)
print(f"Session created: {session_id[:16]}...")

# Session ID regeneration (on privilege escalation)
new_session_id = sm.regenerate_session(session_id)
print(f"Session regenerated: {new_session_id[:16]}...")

# Session validation
user_id = sm.validate_session(
    new_session_id, "192.168.1.100", "Mozilla/5.0..."
)
print(f"Authenticated user: {user_id}")  # user123

# On logout
sm.destroy_session(new_session_id)
```

### 2.4 Cookie Attribute Design

| Attribute | Value | Purpose | Risk if Not Set |
|-----------|-------|---------|----------------|
| `HttpOnly` | `true` | Prevent access from JavaScript | Session ID stolen via XSS |
| `Secure` | `true` | Send over HTTPS only | Intercepted over plaintext communication |
| `SameSite` | `Lax` or `Strict` | Restrict sending on cross-site requests | Risk of CSRF attacks |
| `Path` | `/` | Scope of cookie transmission | Sent to unintended paths |
| `Max-Age` | `3600` | Cookie lifetime | Persists until browser closes |
| `Domain` | Omit (recommended) | Target domain for cookie | Leaked to subdomains |

---

## 3. Brute-Force Protection

### 3.1 Defense-in-Depth Design

Brute-force attacks are simple but effective, and a single countermeasure is insufficient. Combining multiple layers of defense makes the attack success rate virtually zero.

```
Layers of brute-force protection:

  +--------------------------------------------------+
  |  Layer 1: Rate Limiting                           |
  |  - Per IP: 10 attempts/minute                     |
  |  - Per account: 5 attempts/5 minutes              |
  |  - Global: Detect abnormal authentication failure |
  +--------------------------------------------------+
  |  Layer 2: Progressive Delay                       |
  |  - 1st failure: Immediate response                |
  |  - 2nd failure: 1-second wait                     |
  |  - 3rd failure: 2-second wait                     |
  |  - 5th failure: 15-second wait                    |
  |  * Response delays make automated attacks          |
  |    inefficient                                    |
  +--------------------------------------------------+
  |  Layer 3: CAPTCHA                                 |
  |  - Show CAPTCHA after 3 failures                  |
  |  - reCAPTCHA v3 (score-based) is recommended      |
  +--------------------------------------------------+
  |  Layer 4: Account Lockout                         |
  |  - 10 failures: 30-minute lock                    |
  |  - Auto-unlock after a set period                 |
  |  * Auto-unlock is mandatory to prevent DoS abuse  |
  +--------------------------------------------------+
  |  Layer 5: Anomaly Detection                       |
  |  - Attempts on multiple accounts from same IP     |
  |  - Geographically unusual logins                  |
  |  - Credential Stuffing pattern detection          |
  +--------------------------------------------------+
```

### 3.2 Implementing Brute-Force Protection

```python
# Code Example 4: Multi-layer brute-force protection implementation
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict


@dataclass
class LoginAttempt:
    """Login attempt tracking data"""
    count: int = 0
    first_attempt: float = 0
    last_attempt: float = 0
    locked_until: float = 0


class BruteForceProtection:
    """Brute-force attack protection

    WHY combine progressive delay with lockout:
    - Delay alone: Slows attacks but cannot stop them
    - Lockout alone: Can DoS legitimate users
    - Combined: Slows attacks and ultimately stops them,
      while auto-unlock minimizes impact on legitimate users
    """

    MAX_ATTEMPTS = 5
    LOCKOUT_DURATION = 1800  # 30 minutes
    WINDOW = 300             # 5-minute window
    PROGRESSIVE_DELAYS = [0, 1, 2, 4, 8, 15]  # seconds

    def __init__(self):
        self.account_attempts: Dict[str, LoginAttempt] = defaultdict(
            LoginAttempt
        )
        self.ip_attempts: Dict[str, LoginAttempt] = defaultdict(LoginAttempt)

    def check_and_record(self, username: str, ip: str) -> dict:
        """Check and record a login attempt

        Checks both per-account and per-IP.
        Per-IP checking is also important to detect
        Credential Stuffing attacks (many accounts targeted from the same IP).
        """
        # Per-account check
        account_result = self._check_identifier(
            self.account_attempts, username
        )
        if not account_result["allowed"]:
            return account_result

        # Per-IP check (more lenient rate)
        ip_result = self._check_identifier(
            self.ip_attempts, ip, max_attempts=20
        )
        if not ip_result["allowed"]:
            ip_result["reason"] = "ip_rate_limited"
            return ip_result

        return account_result

    def _check_identifier(self, attempts_store: dict,
                          identifier: str,
                          max_attempts: int = None) -> dict:
        """Check and record attempts for an identifier"""
        if max_attempts is None:
            max_attempts = self.MAX_ATTEMPTS

        attempt = attempts_store[identifier]
        now = time.time()

        # Check if locked out
        if attempt.locked_until > now:
            remaining = int(attempt.locked_until - now)
            return {
                "allowed": False,
                "reason": "account_locked",
                "retry_after": remaining,
            }

        # Reset window
        if now - attempt.first_attempt > self.WINDOW:
            attempt.count = 0
            attempt.first_attempt = now

        # Record attempt
        if attempt.count == 0:
            attempt.first_attempt = now
        attempt.count += 1
        attempt.last_attempt = now

        # Lockout judgment
        if attempt.count >= max_attempts:
            attempt.locked_until = now + self.LOCKOUT_DURATION
            return {
                "allowed": False,
                "reason": "too_many_attempts",
                "retry_after": self.LOCKOUT_DURATION,
            }

        # Progressive delay
        delay_idx = min(attempt.count, len(self.PROGRESSIVE_DELAYS) - 1)
        delay = self.PROGRESSIVE_DELAYS[delay_idx]

        return {
            "allowed": True,
            "delay": delay,
            "attempts_remaining": max_attempts - attempt.count,
            "require_captcha": attempt.count >= 3,
        }

    def reset(self, username: str) -> None:
        """Reset counter on successful login"""
        self.account_attempts.pop(username, None)

    def is_credential_stuffing(self, ip: str, threshold: int = 10) -> bool:
        """Detect Credential Stuffing attacks

        Detects the pattern of attempting to log in to many different
        accounts from the same IP in a short period.
        """
        ip_attempt = self.ip_attempts.get(ip)
        if ip_attempt and ip_attempt.count >= threshold:
            return True
        return False


# Usage example
protection = BruteForceProtection()

# Login attempt
result = protection.check_and_record("admin", "192.168.1.100")
print(f"Allowed: {result['allowed']}")
print(f"Attempts remaining: {result.get('attempts_remaining')}")

# After 5 failures
for _ in range(5):
    result = protection.check_and_record("admin", "192.168.1.100")

print(f"Locked out: {not result['allowed']}")
print(f"Unlock in: {result.get('retry_after')} seconds")

# Reset on successful login
protection.reset("admin")
```

---

## 4. Multi-Factor Authentication (MFA)

### 4.1 MFA Authentication Factors

```
Three factors of multi-factor authentication:

  +------------------+     +------------------+     +------------------+
  |  Knowledge (SYK)  |     |  Possession (SYH) |     |  Inherence (SYA)  |
  |  Something You   |     |  Something You   |     |  Something You   |
  |  Know             |     |  Have             |     |  Are              |
  +------------------+     +------------------+     +------------------+
  |  Password        |     |  Smartphone       |     |  Fingerprint      |
  |  PIN             |     |  Hardware token   |     |  Face recognition |
  |  Security answer |     |  Security key     |     |  Iris             |
  +------------------+     +------------------+     +------------------+

  MFA = Combining 2 or more factors from different categories
  * Two factors from the same category (password + PIN) does not qualify as MFA
```

### 4.2 Implementing TOTP

```python
# Code Example 5: TOTP (Time-based One-Time Password) implementation
import hmac
import hashlib
import struct
import time
import base64
import secrets


class TOTP:
    """TOTP implementation compliant with RFC 6238

    WHY TOTP is widely used:
    - Server and client only need to share the current time
    - No network required (can be generated offline)
    - Compatible with standard apps like Google Authenticator
    - Unlike SMS OTP, resistant to SIM swap attacks
    """

    def __init__(self, secret: bytes, digits: int = 6,
                 period: int = 30, algorithm=hashlib.sha1):
        """
        Args:
            secret: Shared secret (minimum 160 bits recommended)
            digits: Number of OTP digits (6 is standard)
            period: Code refresh interval (30 seconds is standard)
            algorithm: HMAC algorithm (SHA-1 is standard, SHA-256 also supported)
        """
        self.secret = secret
        self.digits = digits
        self.period = period
        self.algorithm = algorithm

    @classmethod
    def generate_secret(cls) -> str:
        """Generate a new TOTP secret

        Returned in Base32 encoding (for QR codes / manual entry).
        20 bytes = 160 bits of entropy.
        """
        return base64.b32encode(secrets.token_bytes(20)).decode()

    def generate_code(self, timestamp: float = None) -> str:
        """Generate the current TOTP code

        Internal process:
        1. Divide current time by period to get counter value
        2. Hash counter value with HMAC
        3. Extract 6-digit number via Dynamic Truncation
        """
        if timestamp is None:
            timestamp = time.time()
        counter = int(timestamp) // self.period
        counter_bytes = struct.pack(">Q", counter)

        mac = hmac.new(self.secret, counter_bytes, self.algorithm).digest()
        offset = mac[-1] & 0x0F
        truncated = struct.unpack(">I", mac[offset:offset + 4])[0]
        truncated &= 0x7FFFFFFF
        code = truncated % (10 ** self.digits)
        return str(code).zfill(self.digits)

    def verify(self, code: str, window: int = 1) -> bool:
        """Verify a TOTP code

        WHY a window is needed:
        Allowing the previous and next window steps ensures authentication
        succeeds even with slight clock skew between server and client.
        With window=1, valid for ±30 seconds (90 seconds total).
        """
        now = time.time()
        for offset in range(-window, window + 1):
            check_time = now + (offset * self.period)
            if hmac.compare_digest(
                self.generate_code(check_time), code
            ):
                return True
        return False

    def get_provisioning_uri(self, account: str,
                             issuer: str) -> str:
        """Generate provisioning URI for QR code

        URI for reading with apps like Google Authenticator.
        """
        secret_b32 = base64.b32encode(self.secret).decode()
        return (
            f"otpauth://totp/{issuer}:{account}"
            f"?secret={secret_b32}"
            f"&issuer={issuer}"
            f"&algorithm=SHA1"
            f"&digits={self.digits}"
            f"&period={self.period}"
        )


# Usage example
secret_b32 = TOTP.generate_secret()
print(f"Secret: {secret_b32}")

secret_bytes = base64.b32decode(secret_b32)
totp = TOTP(secret_bytes)

# QR code URI
uri = totp.get_provisioning_uri("user@example.com", "MyApp")
print(f"Provisioning URI: {uri}")

# Code generation and verification
code = totp.generate_code()
print(f"Current code: {code}")
print(f"Verification result: {totp.verify(code)}")  # True
```

### 4.3 Authentication Method Comparison

| Method | Security | Usability | Cost | Phishing Resistance | SIM Swap Resistance |
|--------|:--------:|:---------:|:----:|:-------------------:|:-------------------:|
| Password only | Low | High | Low | None | - |
| Password + SMS OTP | Medium | Medium | Medium | Low | None |
| Password + TOTP | High | Medium | Low | Low | Yes |
| Password + Push notification | High | High | Medium | Medium | Yes |
| Password + FIDO2/WebAuthn | Highest | High | Medium | High | Yes |
| Passkeys | Highest | Highest | Low | Highest | Yes |

```
Recommended authentication flow (2024 onwards):

  New system design
    |
    +-- Can Passkeys be supported?
    |     YES → Implement Passkeys as the first choice
    |     NO  → Consider FIDO2/WebAuthn
    |
    +-- Can hardware keys be distributed?
    |     YES → FIDO2 security keys
    |     NO  → TOTP (Google Authenticator, etc.)
    |
    +-- Last resort (not recommended)
          → SMS OTP (risk of SIM swap and SS7 attacks)
```

---

## 5. Secure Use of JWT

### 5.1 JWT Threat Model

```
Major attacks against JWT:

  +--------------------------------------------------+
  | 1. Algorithm None Attack                          |
  |    Change the header's alg to "none" to bypass    |
  |    signature verification                         |
  |    Mitigation: Explicitly specify allowed          |
  |    algorithms via the algorithms parameter        |
  +--------------------------------------------------+
  | 2. Algorithm Confusion Attack                     |
  |    Change RS256 (asymmetric) to HS256 (symmetric) |
  |    and forge signatures using the public key      |
  |    Mitigation: Fix algorithm on the server side   |
  +--------------------------------------------------+
  | 3. Signature Not Verified                         |
  |    Only decoding the payload without verification |
  |    Mitigation: Always use verify=True in          |
  |    jwt.decode()                                   |
  +--------------------------------------------------+
  | 4. Excessively Long Expiry                        |
  |    Token validity set to days or indefinite       |
  |    Mitigation: Access token 15 min, refresh 7 days|
  +--------------------------------------------------+
  | 5. Inability to Immediately Revoke JWT            |
  |    Stateless nature prevents immediate            |
  |    invalidation of issued tokens                  |
  |    Mitigation: Short expiry + blacklist           |
  +--------------------------------------------------+
```

### 5.2 Implementing JWT Securely

```python
# Code Example 6: Secure JWT implementation
import jwt
import time
import secrets
from typing import Optional


class SecureJWT:
    """Secure JWT token management

    WHY RS256 is preferred over HS256:
    - HS256: Same secret key used for signing and verification
      → Verification side must also have the secret key
      → Key distribution becomes an issue in microservices
    - RS256: Sign with private key, verify with public key
      → Only the public key needs to be distributed to verifiers
      → Public key can be auto-distributed via JWKS endpoint
    """

    # Token blacklist (for immediate revocation)
    _blacklist: set = set()

    def __init__(self, secret_key: str, algorithm: str = "HS256"):
        self.secret_key = secret_key
        # Reject insecure algorithms
        allowed_algorithms = {"HS256", "HS384", "HS512",
                              "RS256", "RS384", "RS512",
                              "ES256", "ES384", "ES512"}
        if algorithm not in allowed_algorithms:
            raise ValueError(
                f"Algorithm '{algorithm}' is not allowed. "
                f"Use one of: {allowed_algorithms}"
            )
        self.algorithm = algorithm

    def create_token(self, user_id: str, roles: list,
                     expires_in: int = 900) -> str:
        """Generate an access token (default 15 minutes)

        Principle of least privilege: include only the minimum necessary
        information in the token. Do not include PII (e.g. email addresses).
        """
        now = int(time.time())
        payload = {
            "sub": user_id,
            "roles": roles,
            "iat": now,
            "exp": now + expires_in,
            "nbf": now,                      # Not Before
            "jti": secrets.token_hex(16),    # JWT ID (replay prevention)
            "iss": "myapp",                  # Issuer
            "aud": "myapp-api",              # Audience
        }
        return jwt.encode(payload, self.secret_key,
                          algorithm=self.algorithm)

    def create_refresh_token(self, user_id: str,
                             expires_in: int = 604800) -> str:
        """Generate a refresh token (default 7 days)

        Refresh tokens are used only for re-issuing access tokens.
        Limit scope and manage by storing in DB.
        """
        now = int(time.time())
        payload = {
            "sub": user_id,
            "type": "refresh",
            "iat": now,
            "exp": now + expires_in,
            "jti": secrets.token_hex(16),
            "iss": "myapp",
        }
        return jwt.encode(payload, self.secret_key,
                          algorithm=self.algorithm)

    def verify_token(self, token: str) -> Optional[dict]:
        """Verify a token

        Verification checks:
        1. Signature validity (tamper detection)
        2. Expiry (exp)
        3. Issued at (iat)
        4. Not Before (nbf)
        5. Issuer (iss)
        6. Audience (aud)
        7. Blacklist check
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],  # Explicitly specified as list
                options={
                    "require": ["exp", "iat", "sub", "iss"],
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_nbf": True,
                },
                issuer="myapp",
                audience="myapp-api",
            )

            # Blacklist check
            if payload.get("jti") in self._blacklist:
                return None

            return payload
        except jwt.ExpiredSignatureError:
            return None  # Token expired
        except jwt.InvalidTokenError:
            return None  # Other validation error

    def revoke_token(self, token: str) -> bool:
        """Immediately revoke a token (blacklist approach)

        Combined with short expiry to limit the blacklist size.
        """
        try:
            # Get payload without signature verification (only jti needed)
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={"verify_exp": False},
            )
            jti = payload.get("jti")
            if jti:
                self._blacklist.add(jti)
                return True
        except jwt.InvalidTokenError:
            pass
        return False


# Usage example
jwt_manager = SecureJWT("my-secret-key-at-least-256-bits-long!!")

# Generate access token
access_token = jwt_manager.create_token("user123", ["viewer"])
print(f"Access token: {access_token[:50]}...")

# Generate refresh token
refresh_token = jwt_manager.create_refresh_token("user123")

# Verify token
payload = jwt_manager.verify_token(access_token)
print(f"Payload: {payload}")

# Revoke token
jwt_manager.revoke_token(access_token)
revoked_result = jwt_manager.verify_token(access_token)
print(f"Verification after revocation: {revoked_result}")  # None
```

### 5.3 Choosing Between JWT and Sessions

| Aspect | Session-Based | JWT |
|--------|--------------|-----|
| State management | Server-side (stateful) | Client-side (stateless) |
| Scalability | Requires session store | No inter-server state sharing needed |
| Immediate revocation | Instant via session deletion | Requires additional implementation (blacklist, etc.) |
| Token size | Session ID only (small) | Includes payload (large) |
| Suitable architecture | Monolith, server-side rendering | Microservices, SPA |
| Implementation complexity | Low (framework support available) | Medium (many security considerations) |

---

## 6. Password Reset Security

### 6.1 Secure Password Reset Flow

```python
# Code Example 7: Secure password reset implementation
import secrets
import time
import hashlib
from typing import Optional, Tuple


class PasswordResetManager:
    """Secure password reset management

    Common password reset vulnerability patterns:
    1. Predictable reset tokens (sequential, timestamp-based)
    2. No token expiry
    3. Token reuse (replay attacks)
    4. Error messages that reveal whether a user exists
    """

    TOKEN_EXPIRY = 3600  # 1 hour
    TOKEN_LENGTH = 32    # 256 bits

    def __init__(self):
        self.reset_tokens: dict = {}

    def request_reset(self, email: str) -> Tuple[str, str]:
        """Request a password reset

        Security considerations:
        - Return the same response regardless of whether the user exists
        - Apply rate limiting (restrict consecutive requests to the same email)
        """
        # Generate a cryptographically secure token
        token = secrets.token_urlsafe(self.TOKEN_LENGTH)

        # Hash the token before storing (protection against DB leaks)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        self.reset_tokens[token_hash] = {
            "email": email,
            "created_at": time.time(),
            "used": False,
        }

        return token, token_hash

    def verify_and_consume(self, token: str) -> Optional[str]:
        """Verify and consume the reset token (single use only)"""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        data = self.reset_tokens.get(token_hash)

        if not data:
            return None

        # Expiry check
        if time.time() - data["created_at"] > self.TOKEN_EXPIRY:
            del self.reset_tokens[token_hash]
            return None

        # Already-used check
        if data["used"]:
            # Token reuse may indicate a security incident
            del self.reset_tokens[token_hash]
            return None

        # Mark token as used
        data["used"] = True

        return data["email"]


# Usage example
reset_mgr = PasswordResetManager()
token, _ = reset_mgr.request_reset("user@example.com")
email = reset_mgr.verify_and_consume(token)
print(f"Reset target: {email}")

# Second use fails
email2 = reset_mgr.verify_and_consume(token)
print(f"Reuse: {email2}")  # None
```

---

## 7. Credential Stuffing Protection

```
How Credential Stuffing attacks work:

  Attacker
    |
    |-- Leaked email/password list (millions of entries)
    |   (obtained from other site data breaches)
    |
    |-- Automated tool attempts login on target site
    |   ┌──────────────────────────────────────┐
    |   │  user1@mail.com / pass123            │
    |   │  user2@mail.com / qwerty             │
    |   │  user3@mail.com / letmein            │
    |   │  ...(millions of attempts)           │
    |   └──────────────────────────────────────┘
    |
    +-- Unauthorized access to accounts of users who reuse passwords

  Mitigations:
  1. HIBP API to check for breached passwords
  2. IP-based rate limiting
  3. CAPTCHA (against automated tools)
  4. MFA (cannot be bypassed even if password is leaked)
  5. Anomaly login detection (notify on new device/location)
```

---

## Anti-Patterns

### Anti-Pattern 1: Storing Passwords in Plaintext or Reversible Encryption

```python
# NG: Storing password in plaintext
def save_user(username, password):
    db.execute(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        (username, password)  # Plaintext!
    )

# NG: Storing with reversible encryption (e.g. AES)
from cryptography.fernet import Fernet
key = Fernet.generate_key()
def save_user_encrypted(username, password):
    encrypted = Fernet(key).encrypt(password.encode())
    db.execute(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        (username, encrypted)  # Decryptable = total compromise if key leaks
    )

# OK: One-way hashing with Argon2id
from argon2 import PasswordHasher
ph = PasswordHasher()
def save_user_secure(username, password):
    hashed = ph.hash(password)  # Cannot be reversed
    db.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (username, hashed)
    )
```

**Why this is dangerous**: Plaintext storage exposes all user passwords immediately upon database breach. Reversible encryption leads to the same result if the encryption key is leaked. Since passwords never need to be recovered, always use one-way hashing.

### Anti-Pattern 2: JWT `algorithm: "none"` Attack

```python
# NG: Not validating the algorithm
import jwt
payload = jwt.decode(token, secret, algorithms=None)  # All algorithms allowed

# NG: Using default settings (some libraries allow "none" by default)
payload = jwt.decode(token, secret)

# OK: Explicitly specify allowed algorithms
payload = jwt.decode(
    token,
    secret,
    algorithms=["HS256"],  # Allow only HS256
    options={"require": ["exp", "iss"]},
)
```

**Why this is dangerous**: If an attacker changes the `alg` field in the JWT header to `"none"`, signature verification is skipped, allowing authentication to be bypassed with any arbitrary payload. This vulnerability was discovered in many JWT libraries in 2015 (CVE-2015-9235).

### Anti-Pattern 3: Vulnerable to Session Fixation Attacks

```python
# NG: Session ID does not change after login
@app.route("/login", methods=["POST"])
def login():
    if authenticate(request.form["username"], request.form["password"]):
        session["user_id"] = get_user_id(request.form["username"])
        return redirect("/dashboard")
        # Session ID unchanged! The ID pre-set by the attacker is still in use

# OK: Regenerate session ID on successful login
@app.route("/login", methods=["POST"])
def login_secure():
    if authenticate(request.form["username"], request.form["password"]):
        session.regenerate()  # Regenerate session ID
        session["user_id"] = get_user_id(request.form["username"])
        return redirect("/dashboard")
```

**Why this is dangerous**: An attacker pre-sets a session ID in the user's browser. When the user logs in with that ID, the attacker can access the same session using the same session ID.

### Anti-Pattern 4: User Enumeration via Error Messages

```python
# NG: Error messages that reveal whether a user exists
def login(username, password):
    user = find_user(username)
    if not user:
        return {"error": "User not found"}  # Reveals user existence
    if not verify_password(password, user.password_hash):
        return {"error": "Incorrect password"}  # Confirms user exists

# OK: Use the same error message for all cases
def login_secure(username, password):
    user = find_user(username)
    if not user or not verify_password(password, user.password_hash if user else "dummy"):
        return {"error": "Invalid username or password"}
```

---

## FAQ

### Q1: Should I set a maximum password length?

An upper limit of around 128 characters should be set. Argon2id and bcrypt incur computational cost when hashing passwords, and extremely long passwords (e.g. tens of thousands of characters) can become a DoS vector. Note that bcrypt has a specific 72-byte limit — passwords longer than that should be pre-hashed with SHA-256 before passing to bcrypt. NIST SP 800-63B recommends accepting at least 64 characters.

### Q2: Where should session IDs be stored?

Cookies with `HttpOnly` + `Secure` + `SameSite` attributes are recommended. `localStorage` is vulnerable to XSS (accessible from JavaScript), and URL parameters risk leaking through the Referer header or browser history. `sessionStorage` disappears when the tab is closed, so cookies are optimal from a usability perspective as well.

### Q3: Should I use JWT or session-based authentication?

It depends on your architecture and requirements. For monolithic applications, session-based authentication is recommended (simpler, easy immediate revocation). For microservices or SPAs, JWT is more suitable (no inter-server state sharing needed). However, since JWT cannot immediately revoke tokens, a combination of short expiry (15 minutes), refresh tokens (7 days), and blacklist functionality is required.

### Q4: Why is SMS OTP discouraged?

NIST SP 800-63B classifies SMS OTP as a "restricted" authentication method. Reasons include:
- **SIM swap attacks**: Attackers trick mobile carriers into transferring the victim's phone number to a different SIM
- **SS7 protocol vulnerabilities**: SMS can be intercepted on the communication path
- **Malware**: Malware on smartphones can read SMS messages

TOTP or FIDO2/WebAuthn is recommended as an alternative.

### Q5: Is passwordless authentication secure?

Passwordless authentication represented by Passkeys is more secure than traditional password authentication. It is based on public-key cryptography, has phishing resistance, and combining it with biometric authentication also improves usability. The FIDO Alliance and W3C are driving standardization, and Apple, Google, and Microsoft have already adopted it. For new systems from 2024 onwards, it should be considered as the first choice.

---

## Practice Exercises

### Exercise 1 (Basic): Implement a Password Policy Checker

Implement a password policy checker that meets the following requirements.

**Requirements**:
- Minimum 12 characters, maximum 128 characters
- At least one uppercase letter, one lowercase letter, and one digit
- Prohibit reuse of the last 3 passwords
- Reject commonly weak passwords (e.g., "password", "123456")

<details>
<summary>Reference Answer</summary>

```python
import hashlib
from typing import List, Optional


# List of commonly weak passwords (use a larger list in production)
COMMON_PASSWORDS = {
    "password", "123456", "12345678", "qwerty", "abc123",
    "monkey", "1234567", "letmein", "trustno1", "dragon",
    "baseball", "master", "michael", "shadow", "ashley",
    "password1", "password123", "admin", "welcome", "login",
}


class PasswordPolicyChecker:
    """Password policy checker"""

    MIN_LENGTH = 12
    MAX_LENGTH = 128
    HISTORY_SIZE = 3

    def __init__(self):
        # Per-user password history (stored as hashes)
        self.password_history: dict = {}

    def check(self, password: str, user_id: str = None) -> List[str]:
        """Check password policy"""
        errors = []

        # Length check
        if len(password) < self.MIN_LENGTH:
            errors.append(f"Password must be at least {self.MIN_LENGTH} characters")
        if len(password) > self.MAX_LENGTH:
            errors.append(f"Password must be {self.MAX_LENGTH} characters or fewer")

        # Character type check
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")

        # Weak password check
        if password.lower() in COMMON_PASSWORDS:
            errors.append("Password is too common")

        # Password history check
        if user_id and user_id in self.password_history:
            pw_hash = hashlib.sha256(password.encode()).hexdigest()
            if pw_hash in self.password_history[user_id]:
                errors.append(
                    f"Cannot reuse any of your last {self.HISTORY_SIZE} passwords"
                )

        return errors

    def record_password(self, user_id: str, password: str) -> None:
        """Record password in history"""
        pw_hash = hashlib.sha256(password.encode()).hexdigest()
        if user_id not in self.password_history:
            self.password_history[user_id] = []
        history = self.password_history[user_id]
        history.append(pw_hash)
        # Limit history size
        if len(history) > self.HISTORY_SIZE:
            history.pop(0)


# Tests
checker = PasswordPolicyChecker()

# Weak password
print(checker.check("password"))
# ['Password must be at least 12 characters', 'Password must contain at least one digit', 'Password is too common']

# Strong password
print(checker.check("MyStr0ngP@ssword2024"))
# []

# Password history check
checker.record_password("user1", "MyStr0ngP@ssword2024")
print(checker.check("MyStr0ngP@ssword2024", "user1"))
# ['Cannot reuse any of your last 3 passwords']
```

</details>

### Exercise 2 (Intermediate): Implement a Rate-Limited Login API

Using Flask, implement a login API that meets the following requirements.

**Requirements**:
- Verify passwords using Argon2id
- Rate limiting per IP and per account
- Increase delay after 3 failures
- Lock account after 5 failures (30 minutes)
- Issue session ID on successful login

<details>
<summary>Reference Answer</summary>

```python
import time
import secrets
import hashlib
from collections import defaultdict
from dataclasses import dataclass
from flask import Flask, request, jsonify, make_response
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

app = Flask(__name__)
ph = PasswordHasher()

# Mock user database
users_db = {
    "admin": ph.hash("AdminP@ss123!"),
    "user1": ph.hash("User1P@ss456!"),
}

# Session store
sessions = {}


@dataclass
class AttemptTracker:
    count: int = 0
    first_attempt: float = 0.0
    locked_until: float = 0.0


# Rate limit trackers
account_attempts = defaultdict(AttemptTracker)
ip_attempts = defaultdict(AttemptTracker)

DELAYS = [0, 0, 0, 2, 4, 8]
MAX_ATTEMPTS = 5
LOCK_DURATION = 1800
WINDOW = 300


def check_rate_limit(tracker: AttemptTracker) -> dict:
    """Check rate limit"""
    now = time.time()
    if tracker.locked_until > now:
        return {"blocked": True, "retry_after": int(tracker.locked_until - now)}
    if now - tracker.first_attempt > WINDOW:
        tracker.count = 0
        tracker.first_attempt = now
    return {"blocked": False, "count": tracker.count}


def record_failure(tracker: AttemptTracker):
    """Record a failure"""
    now = time.time()
    if tracker.count == 0:
        tracker.first_attempt = now
    tracker.count += 1
    if tracker.count >= MAX_ATTEMPTS:
        tracker.locked_until = now + LOCK_DURATION


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "username and password required"}), 400

    username = data["username"]
    client_ip = request.remote_addr

    # IP rate limit
    ip_check = check_rate_limit(ip_attempts[client_ip])
    if ip_check["blocked"]:
        return jsonify({
            "error": "Too many requests",
            "retry_after": ip_check["retry_after"],
        }), 429

    # Account rate limit
    acct_check = check_rate_limit(account_attempts[username])
    if acct_check["blocked"]:
        return jsonify({
            "error": "Account locked",
            "retry_after": acct_check["retry_after"],
        }), 429

    # Apply delay
    delay_idx = min(acct_check.get("count", 0), len(DELAYS) - 1)
    if DELAYS[delay_idx] > 0:
        time.sleep(DELAYS[delay_idx])

    # Authentication
    password_hash = users_db.get(username)
    if not password_hash:
        record_failure(account_attempts[username])
        record_failure(ip_attempts[client_ip])
        return jsonify({"error": "Invalid credentials"}), 401

    try:
        ph.verify(password_hash, data["password"])
    except VerifyMismatchError:
        record_failure(account_attempts[username])
        record_failure(ip_attempts[client_ip])
        return jsonify({"error": "Invalid credentials"}), 401

    # Success: reset counter
    account_attempts.pop(username, None)

    # Issue session
    session_id = secrets.token_hex(32)
    sessions[session_id] = {
        "user_id": username,
        "created_at": time.time(),
    }

    response = make_response(jsonify({"message": "Login successful"}))
    response.set_cookie(
        "session_id",
        session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=3600,
    )
    return response


if __name__ == "__main__":
    app.run(debug=True)
```

</details>

### Exercise 3 (Advanced): Implement JWT Refresh Token Rotation

Design and implement a JWT token management system that meets the following requirements.

**Requirements**:
- Issue access token (15 min) and refresh token (7 days) as a pair
- Refresh token rotation (exchange for a new one on each use)
- Detect refresh token reuse (theft detection)
- Token family management (track tokens originating from the same login session)

<details>
<summary>Reference Answer</summary>

```python
import jwt
import time
import secrets
from typing import Optional, Tuple


class TokenRotationManager:
    """JWT refresh token rotation

    How refresh token reuse detection works:
    - Refresh tokens are single-use (invalidated after one use)
    - Tokens derived from the same login are tracked as a "family"
    - If a used token is used again,
      the entire family is invalidated (theft detected)
    """

    def __init__(self, secret: str):
        self.secret = secret
        # family ID → {list of used token jtis, latest jti}
        self.token_families: dict = {}
        # jti → family ID mapping
        self.jti_to_family: dict = {}
        # Revoked families
        self.revoked_families: set = set()

    def create_token_pair(self, user_id: str,
                          family_id: str = None) -> Tuple[str, str]:
        """Generate an access token and refresh token pair"""
        now = int(time.time())

        # Generate family ID for new login
        if family_id is None:
            family_id = secrets.token_hex(16)
            self.token_families[family_id] = {
                "used_jtis": set(),
                "latest_jti": None,
                "user_id": user_id,
            }

        # Access token (15 minutes)
        access_jti = secrets.token_hex(16)
        access_token = jwt.encode({
            "sub": user_id,
            "type": "access",
            "jti": access_jti,
            "iat": now,
            "exp": now + 900,  # 15 minutes
        }, self.secret, algorithm="HS256")

        # Refresh token (7 days)
        refresh_jti = secrets.token_hex(16)
        refresh_token = jwt.encode({
            "sub": user_id,
            "type": "refresh",
            "jti": refresh_jti,
            "family": family_id,
            "iat": now,
            "exp": now + 604800,  # 7 days
        }, self.secret, algorithm="HS256")

        # Update latest jti in family
        self.token_families[family_id]["latest_jti"] = refresh_jti
        self.jti_to_family[refresh_jti] = family_id

        return access_token, refresh_token

    def refresh(self, refresh_token: str) -> Optional[Tuple[str, str]]:
        """Get a new token pair using a refresh token

        Rotation: the old refresh token is invalidated and
        a new pair is returned.
        """
        try:
            payload = jwt.decode(
                refresh_token, self.secret,
                algorithms=["HS256"],
                options={"require": ["sub", "jti", "family"]},
            )
        except jwt.InvalidTokenError:
            return None

        jti = payload["jti"]
        family_id = payload["family"]
        user_id = payload["sub"]

        # Check if family has been revoked
        if family_id in self.revoked_families:
            return None

        family = self.token_families.get(family_id)
        if not family:
            return None

        # Reuse detection: if this jti has already been used
        if jti in family["used_jtis"]:
            # Token theft detected! Revoke the entire family
            self.revoked_families.add(family_id)
            print(f"[ALERT] Token reuse detected: family={family_id}")
            return None

        # Mark current jti as used
        family["used_jtis"].add(jti)

        # Generate new token pair
        return self.create_token_pair(user_id, family_id)

    def revoke_family(self, family_id: str) -> None:
        """Revoke the entire family (e.g. on logout)"""
        self.revoked_families.add(family_id)


# Usage example
manager = TokenRotationManager("secret-key-256-bits-long!!!!!!!!")

# Initial login
access, refresh = manager.create_token_pair("user123")
print("=== Initial Login ===")
print(f"Access: {access[:50]}...")
print(f"Refresh: {refresh[:50]}...")

# Refresh (normal)
new_access, new_refresh = manager.refresh(refresh)
print("\n=== Refresh (normal) ===")
print(f"New Access: {new_access[:50]}...")

# Reuse of old refresh token (theft detection)
result = manager.refresh(refresh)  # Used token
print(f"\n=== Reuse Detection ===")
print(f"Result: {result}")  # None (entire family revoked)

# New refresh token is also revoked
result2 = manager.refresh(new_refresh)
print(f"New token also invalid: {result2}")  # None
```

</details>

---

## Summary

| Item | Recommended Measure | Priority |
|------|---------------------|----------|
| Password hashing | Argon2id (first choice) / bcrypt | Required |
| Session ID | Cryptographically secure random, 256+ bits | Required |
| Session management | HttpOnly/Secure Cookie + absolute/idle timeout | Required |
| Session fixation prevention | Regenerate session ID on login | Required |
| Brute-force protection | Rate limiting + progressive delay + lockout | Required |
| MFA | FIDO2/WebAuthn or TOTP (SMS OTP not recommended) | Strongly recommended |
| JWT | Short expiry + explicit algorithm + aud/iss verification | Conditionally recommended |
| Password reset | Cryptographic token + hashed storage + single use | Required |
| Credential Stuffing | HIBP check + anomaly login detection + MFA | Strongly recommended |

---

## What to Read Next

- [Cryptography Basics](../02-cryptography/00-crypto-basics.md) -- Details on hash functions and encryption algorithms
- [API Security](../03-network-security/02-api-security.md) -- API authentication details using OAuth 2.0/JWT
- [Secure Coding](../04-application-security/00-secure-coding.md) -- Secure coding in general
- Password Security -- Deeper dive into password management
- Multi-Factor Authentication -- Detailed MFA implementation guide
- Session vs Token -- Comparison of sessions and tokens
- JWT Deep Dive -- Detailed mechanisms and attack methods for JWT

---

## References

1. **OWASP Authentication Cheat Sheet** -- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
2. **OWASP Session Management Cheat Sheet** -- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
3. **NIST SP 800-63B: Digital Identity Guidelines** -- https://pages.nist.gov/800-63-3/sp800-63b.html
4. **RFC 6238: TOTP (Time-Based One-Time Password Algorithm)** -- https://datatracker.ietf.org/doc/html/rfc6238
5. **OWASP Password Storage Cheat Sheet** -- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
6. **FIDO Alliance: Passkeys** -- https://fidoalliance.org/passkeys/
7. **Auth0 Blog: Refresh Token Rotation** -- https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/
