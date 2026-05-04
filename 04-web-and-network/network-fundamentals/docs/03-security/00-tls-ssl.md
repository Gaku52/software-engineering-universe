# TLS/SSL

> TLS is the protocol responsible for encrypting internet communications. Learn how handshakes, certificates, and cipher suites work to build a foundation for secure communication.

## Prerequisites

The following knowledge is required to understand this guide:
- Basics of public-key cryptography — how asymmetric cryptography such as RSA/ECDSA works

---

## What You Will Learn

- [ ] Understand the TLS handshake flow
- [ ] Grasp how certificates work and the validation process
- [ ] Learn the improvements in TLS 1.3
- [ ] Practice cipher suite selection and configuration
- [ ] Acquire TLS configuration and troubleshooting skills for production use

---

## 1. TLS Basics

```
TLS (Transport Layer Security):
  → Provides encryption, authentication, and integrity for communications
  → HTTPS = HTTP + TLS

History:
  SSL 2.0 (1995) → Vulnerable, prohibited
  SSL 3.0 (1996) → POODLE attack, prohibited
  TLS 1.0 (1999) → Deprecated (formally retired by RFC 8996 in 2021)
  TLS 1.1 (2006) → Deprecated (formally retired by RFC 8996 in 2021)
  TLS 1.2 (2008) → Widely used today
  TLS 1.3 (2018) → Latest, recommended

  * All SSL versions are retired. "SSL certificate" is a legacy name.

Three functions TLS provides:
  ① Confidentiality: Encrypts the content of communications
  ② Authentication: Verifies the identity of communication partners
  ③ Integrity: Detects data tampering

TLS position (OSI Reference Model):
  Application layer: HTTP, SMTP, FTP
  ─────────────────────────────────
  TLS (Session ~ Presentation layer)
  ─────────────────────────────────
  Transport layer: TCP
  ─────────────────────────────────
  Network layer: IP

  → TLS sits above TCP and below the application
  → Independent of the application protocol
  → Used not only for HTTP but also SMTPS, FTPS, LDAPS, etc.
```

### 1.1 Cryptographic Fundamentals

```
Cryptographic techniques used by TLS:

① Symmetric-key cryptography:
  → Same key for encryption and decryption
  → Fast (suitable for encrypting large volumes of data)
  → Key distribution is a challenge
  → AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305

  Plaintext ──[shared key]──→ Ciphertext ──[shared key]──→ Plaintext

② Public-key cryptography (asymmetric):
  → Encrypt with public key, decrypt with private key
  → Slow (used for key exchange and signing)
  → Solves the key distribution problem
  → RSA, ECDSA, Ed25519

  Plaintext ──[public key]──→ Ciphertext ──[private key]──→ Plaintext

③ Hash functions:
  → Produces a fixed-length digest from arbitrary-length data
  → One-way (cannot be reversed)
  → Collision-resistant (hard to find two inputs with the same hash)
  → SHA-256, SHA-384, SHA-512

④ MAC (Message Authentication Code):
  → Ensures message integrity and authentication
  → HMAC: hash-based MAC
  → AEAD: encrypts and authenticates simultaneously (GCM, Poly1305)

⑤ Key exchange algorithms:
  → Establish a shared key over an insecure channel
  → Diffie-Hellman (DH)
  → Elliptic Curve Diffie-Hellman (ECDH)
  → Ephemeral key (ECDHE) → provides forward secrecy

Role of each in TLS:
  Key exchange:      ECDHE (public-key cryptography based)
  Authentication:    RSA or ECDSA (public-key cryptography)
  Data encryption:   AES-GCM or ChaCha20 (symmetric cryptography)
  Integrity:         AEAD (GCM, Poly1305) provides it simultaneously with encryption
```

---

## 2. TLS 1.2 Handshake

```
TLS 1.2 Handshake (2 RTT):

  Client                            Server
       │                              │
  ①    │── ClientHello ──→            │
       │   Supported TLS versions     │
       │   Supported cipher suite list│
       │   Client random              │
       │   Session ID                 │
       │   SNI (Server Name Indication)│
       │                              │
  ②    │←── ServerHello ──           │
       │   Selected TLS version       │
       │   Selected cipher suite      │
       │   Server random              │
       │   Session ID                 │
       │                              │
  ③    │←── Certificate ──           │
       │   Server certificate chain   │
       │                              │
  ④    │←── ServerKeyExchange ──     │
       │   Key exchange params (ECDHE)│
       │   Signature (using private   │
       │   key)                       │
       │                              │
  ⑤    │←── ServerHelloDone ──       │
       │                              │
       │   [Client validates cert]    │
       │                              │
  ⑥    │── ClientKeyExchange ──→     │
       │   Key exchange parameters    │
       │                              │
       │   [Both derive pre-master secret]
       │   [Master secret → derive session keys]
       │                              │
  ⑦    │── ChangeCipherSpec ──→      │
       │── Finished ──→               │
       │   (Hash of entire handshake, encrypted)
       │                              │
  ⑧    │←── ChangeCipherSpec ──      │
       │←── Finished ──               │
       │                              │
       │   Encrypted communication begins

  Time required: 2 RTT (Tokyo-US: ~200ms)
```

### 2.1 Step-by-Step Explanation

```
ClientHello details:
  → TLS version: presents up to TLS 1.2
  → CipherSuites: prioritized list of cipher suites
  → Compression Methods: usually null (compression causes CRIME attacks)
  → Extensions:
     - server_name (SNI): destination domain name
     - supported_groups: supported elliptic curves (P-256, X25519, etc.)
     - signature_algorithms: supported signature algorithms
     - session_ticket: ticket for session resumption

SNI (Server Name Indication):
  → Extension to use different TLS certificates for multiple domains on one IP
  → Includes the destination domain name in ClientHello
  → However, ClientHello is in plaintext → domain name is visible
  → Resolved by ESNI (Encrypted SNI) / ECH (Encrypted Client Hello)

Session Resumption:
  ① Session ID:
     → Server saves session state
     → Client presents the ID to resume
     → Server memory consumption is a concern

  ② Session Ticket:
     → Server encrypts the session state and hands it to the client
     → Server is stateless
     → Managing the ticket encryption key is a concern

  On resumption: 1 RTT (no full handshake needed)
```

### 2.2 Key Derivation Process

```
TLS 1.2 key derivation:

  1. Pre-master secret:
     → ECDHE: compute the shared secret
     → Both parties derive the same value from DH parameters

  2. Master secret:
     master_secret = PRF(
       pre_master_secret,
       "master secret",
       ClientHello.random + ServerHello.random
     )

  3. Session key derivation:
     key_block = PRF(
       master_secret,
       "key expansion",
       ServerHello.random + ClientHello.random
     )

     Extracted from key_block:
     → client_write_MAC_key
     → server_write_MAC_key
     → client_write_key (encryption key)
     → server_write_key (encryption key)
     → client_write_IV
     → server_write_IV

  PRF = Pseudo-Random Function (HMAC-SHA256 based)

  Key points:
  → Client and server use separate keys
  → Separate keys for MAC and encryption
  → Including random values makes keys unique per session
```

---

## 3. TLS 1.3 Handshake

```
TLS 1.3 Handshake (1 RTT):

  Client                            Server
       │                              │
  ①    │── ClientHello ──→            │
       │   Supported cipher suites    │
       │   Key share parameters       │  ← The secret to 1 RTT
       │   (guessed)                  │
       │   supported_versions ext.    │
       │                              │
  ②    │←── ServerHello ──           │
       │   Selected cipher suite      │
       │   Key share parameters       │
       │                              │
       │←── {EncryptedExtensions} ── │  ← Encrypted from here
       │←── {Certificate} ──         │
       │←── {CertificateVerify} ──   │
       │←── {Finished} ──             │
       │                              │
  ③    │── {Finished} ──→             │
       │                              │
       │   Encrypted communication begins

  Improvements:
  ① 1 RTT: key exchange sent from the start (guess-based)
  ② 0-RTT: on reconnection, data can be sent simultaneously
  ③ Weak cipher suites removed
  ④ Handshake is also encrypted (certificate is not visible)
  ⑤ CertificateVerify added (stronger server authentication)
```

### 3.1 TLS 1.3 Key Schedule

```
TLS 1.3 key derivation (HKDF-based):

  HKDF = HMAC-based Key Derivation Function
  → Clearer and more secure design than TLS 1.2's PRF

  Key derivation flow:

  PSK (Pre-Shared Key, or 0 if none)
      │
      ▼
  Early Secret ── Derive-Secret → client_early_traffic_secret
      │                            (for 0-RTT data)
      │
  ECDHE shared secret
      │
      ▼
  Handshake Secret
      │
      ├── Derive-Secret → client_handshake_traffic_secret
      │                    (for handshake encryption)
      ├── Derive-Secret → server_handshake_traffic_secret
      │
      ▼
  Master Secret
      │
      ├── Derive-Secret → client_application_traffic_secret
      │                    (for application data)
      ├── Derive-Secret → server_application_traffic_secret
      │
      ├── Derive-Secret → exporter_master_secret
      └── Derive-Secret → resumption_master_secret
                           (for session resumption)

  Key points:
  → Staged key derivation generates purpose-specific keys
  → Separate keys for handshake and application data
  → Limits the scope of a key compromise
```

### 3.2 0-RTT (Early Data)

```
0-RTT reconnection:
  Client ── ClientHello + app data ──→ Server
  → Connection establishment and data transmission happen simultaneously

  Prerequisites:
  → A PSK (Pre-Shared Key) was obtained in a previous connection
  → early_traffic_secret is derived from the PSK
  → The first request is encrypted and sent

  Benefits:
  → Data transmission begins at 0 RTT
  → Significant Web performance improvement

  Risks:
  → Replay attack: attacker can replay packets
  → No forward secrecy: if PSK leaks, 0-RTT data can be decrypted

  Mitigations:
  → Use only for idempotent requests (GET, etc.)
  → Implement replay detection on the server
  → Use Single-Use Tickets
  → Configure Anti-Replay Window

  Example config (Nginx):
  ssl_early_data on;
  proxy_set_header Early-Data $ssl_early_data;
  → Backend checks Early-Data: 1 to determine idempotency
```

### 3.3 Features Removed in TLS 1.3

```
Cryptographic algorithms and features removed in TLS 1.3:

  Cipher algorithms:
  ✗ RSA key exchange (no forward secrecy)
  ✗ CBC mode ciphers (padding oracle attacks)
  ✗ RC4 (numerous vulnerabilities)
  ✗ DES, 3DES (short key length)
  ✗ MD5, SHA-1 (collision attacks are practical)
  ✗ Static DH (no forward secrecy)
  ✗ Custom DH groups (possibility of weak parameters)
  ✗ Compression (CRIME attack)
  ✗ Renegotiation (triple handshake attack)

  Protocol features:
  ✗ ChangeCipherSpec message (no longer needed)
  ✗ Session ID-based resumption (replaced by PSK-based)
  ✗ Generation of random session IDs

  Why removal matters:
  → Fewer choices = lower chance of misconfiguration
  → Insecure configurations become impossible
  → Implementation complexity is reduced
  → Auditing becomes easier
```

---

## 4. Certificates

```
X.509 Certificate Structure:
  ┌───────────────────────────────────────┐
  │ Version: v3                           │
  │ Serial Number: 01:AB:CD:EF:...        │
  │ Signature Algorithm: SHA-256 with RSA │
  │ Issuer: Let's Encrypt Authority X3    │
  │ Validity: 2024-01-01 to 2024-03-31   │
  │ Subject: example.com                  │
  │ Public Key: RSA 2048bit / ECDSA P-256 │
  │ Extensions:                           │
  │   SANs: example.com, www.example.com  │
  │   Key Usage: Digital Signature        │
  │   Extended Key Usage: Server Auth     │
  │   Basic Constraints: CA:FALSE         │
  │   CRL Distribution Points: ...        │
  │   Authority Information Access: ...   │
  │     OCSP Responder: http://ocsp...    │
  │     CA Issuers: http://...            │
  │ Signature Value: 3A:4B:5C:...        │
  └───────────────────────────────────────┘
```

### 4.1 Certificate Chain

```
Certificate chain:
  ┌────────────────┐
  │ Root CA cert   │ ← Built into OS/browser (the trust anchor)
  │ (self-signed)  │    ~150–200 trusted CAs
  └───────┬────────┘
          │ signs
  ┌───────▼────────┐
  │ Intermediate   │ ← Signed by the root CA
  │ CA cert        │    Protects the root CA offline
  └───────┬────────┘
          │ signs
  ┌───────▼────────┐
  │ Server cert    │ ← Signed by the intermediate CA
  │ example.com    │
  └────────────────┘

Validation process:
  1. Verify the server certificate's signature using the intermediate CA's public key
  2. Verify the intermediate CA certificate's signature using the root CA's public key
  3. Confirm the root CA certificate exists in the OS/browser trust store
  4. Verify each certificate's validity period
  5. Verify the domain name (SAN) matches
  6. Check revocation (OCSP / CRL)
  7. Verify Certificate Transparency (CT) logs

Importance of the intermediate CA certificate:
  → The server must also send the intermediate CA certificate
  → Missing it → "untrusted certificate" error
  → Particularly problematic on Android (different trust stores)
  → ssl-cert-check and SSL Labs can detect missing chain certificates

Cross-signing:
  → A new CA gets signed by an older root CA too
  → Allows the trust chain to work on older devices
  → Let's Encrypt: ISRG Root X1 + DST Root CA X3 (cross-signed)
```

### 4.2 Certificate Types and Selection

```
Certificate types:

  DV (Domain Validation):
    → Verifies domain ownership only
    → Let's Encrypt, etc. (free)
    → Issued within minutes
    → For personal sites, startups

  OV (Organization Validation):
    → Verifies the organization's existence
    → For corporate websites
    → Issued within days
    → ~$50–$300/year

  EV (Extended Validation):
    → Strict organizational review
    → For financial institutions, etc.
    → Issued within weeks
    → ~$150–$1,000/year
    → Browser display differences are shrinking (organization name in address bar removed)

Wildcard certificates:
  → *.example.com covers all subdomains
  → One level only (*.sub.example.com is not supported)
  → Requires DNS challenge (HTTP-01 does not work)

Multi-domain certificates (SAN certificates):
  → Multiple domains in one certificate
  → example.com + example.org + example.net
  → Simplifies management

Selection guidelines:
  Personal site         → Let's Encrypt (DV, free)
  General business site → DV or OV
  Finance / Healthcare  → OV or EV
  Microservices         → Internal CA (self-signed)
  Multiple subdomains   → Wildcard
```

### 4.3 Certificate Revocation

```
Certificate revocation checking:

① CRL (Certificate Revocation List):
  → CA publishes a list of revoked certificates
  → Client downloads and checks against it
  → Drawbacks: list grows large, low update frequency

② OCSP (Online Certificate Status Protocol):
  → Real-time verification of certificate validity
  → Queries the CA's OCSP responder

  Client ──→ OCSP Responder
               │
               ← "good" / "revoked" / "unknown"

  Drawbacks:
  → Increased latency (additional network request)
  → Cannot check if CA is down
  → Privacy concern (CA can see what you are accessing)

③ OCSP Stapling:
  → Server pre-fetches the OCSP response and includes it in the TLS handshake
  → Client does not need to contact the CA
  → Reduced latency + improved privacy

  Example config (Nginx):
  ssl_stapling on;
  ssl_stapling_verify on;
  resolver 8.8.8.8 8.8.4.4 valid=300s;
  resolver_timeout 5s;

④ OCSP Must-Staple:
  → Certificate includes an extension requiring OCSP Stapling
  → Connection is rejected if no stapled response is present
  → Resolves the soft-fail problem of revocation checking

⑤ CRLite (Firefox implementation):
  → CRL compressed with a Bloom filter and distributed to browsers
  → Revocation status of all certificates checked locally
  → No OCSP needed, protects privacy
```

---

## 5. Cipher Suites

```
Cipher suite structure (TLS 1.2):
  TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
  │     │      │      │    │    │     │
  │     │      │      │    │    │     └── Hash function
  │     │      │      │    │    └─ Mode
  │     │      │      │    └─ Key length
  │     │      │      └── Symmetric cipher
  │     │      └── Authentication algorithm
  │     └── Key exchange algorithm
  └── Protocol

  Options for each component:
  Key exchange: ECDHE (recommended), DHE, RSA (deprecated)
  Authentication: RSA, ECDSA, Ed25519
  Encryption: AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305
  Hash: SHA-256, SHA-384

TLS 1.3 cipher suites (simplified):
  TLS_AES_256_GCM_SHA384
  TLS_AES_128_GCM_SHA256
  TLS_CHACHA20_POLY1305_SHA256
  → Key exchange is always ECDHE (provides forward secrecy)
  → Authentication handled separately via certificate
  → Fewer choices improve security
  → AEAD only (CBC removed)
```

### 5.1 Forward Secrecy

```
Forward Secrecy (Perfect Forward Secrecy):
  → Even if the server's private key is compromised, past communications cannot be decrypted
  → A new ephemeral key is generated for each session
  → ECDHE: Elliptic Curve Diffie-Hellman Ephemeral

RSA key exchange (no forward secrecy):
  1. Client → encrypts pre-master secret with RSA public key
  2. Server → decrypts with RSA private key
  → If private key leaks → all past communications can be decrypted

  Attack scenario:
  ① Attacker records encrypted communications long-term
  ② Attacker obtains the server's private key somehow
  ③ Decrypts all recorded communications
  → "Record now, decrypt later" attack

ECDHE key exchange (with forward secrecy):
  1. Both parties exchange ephemeral DH parameters
  2. Compute the shared secret
  3. Ephemeral key is discarded (erased from memory)
  → Private key leak cannot restore the ephemeral key
  → Past communications remain secure

  Elliptic curve selection:
  → X25519: fastest, recommended, designed by Daniel J. Bernstein
  → P-256: NIST standard, widely supported
  → P-384: for high-security requirements
  → P-521: highest security (impacts performance)

Post-Quantum Cryptography:
  → Quantum computers could break ECDHE
  → NIST PQC standardization (2024):
     ML-KEM (formerly CRYSTALS-Kyber)
     ML-DSA (formerly CRYSTALS-Dilithium)
  → Hybrid approach: X25519 + ML-KEM-768
  → Chrome/Firefox: experimental implementation of X25519Kyber768
  → Can be enabled ahead of time with TLS 1.3
```

### 5.2 AES-GCM vs ChaCha20-Poly1305

```
AES-GCM:
  → AES cipher + Galois/Counter Mode authenticated encryption
  → Hardware acceleration support (AES-NI)
  → Very fast on Intel/AMD processors
  → Server-side de facto standard

ChaCha20-Poly1305:
  → ChaCha20 stream cipher + Poly1305 MAC
  → Fast in software (for environments without AES-NI)
  → Advantageous on mobile devices (ARM)
  → Developed by Google, widely adopted

Selection guidance:
  Desktop/Server: AES-256-GCM (leverages AES-NI)
  Mobile:         ChaCha20-Poly1305 (power-efficient)
  Recommendation: support both and let the client choose

Mode comparison:
  GCM (Galois/Counter Mode):
    → AEAD: encryption + authentication simultaneously
    → Counter-mode based → parallelizable
    → Nonce reuse causes fatal vulnerability
    → 96-bit nonce + 32-bit counter

  CBC (Cipher Block Chaining):
    → Removed in TLS 1.3
    → Vulnerable to padding oracle attacks
    → MAC processing order issues (Encrypt-then-MAC vs MAC-then-Encrypt)
    → Sequential processing only → slow
```

---

## 6. TLS Configuration in Production

### 6.1 Nginx Configuration

```nginx
# /etc/nginx/conf.d/ssl.conf
# Recommended TLS configuration (Mozilla Intermediate Configuration)

server {
    listen 443 ssl http2;
    server_name example.com;

    # Certificates
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # TLS versions
    ssl_protocols TLSv1.2 TLSv1.3;

    # Cipher suites (for TLS 1.2)
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;  # Client preference for TLS 1.3

    # DH parameters (for TLS 1.2 DHE)
    ssl_dhparam /etc/nginx/dhparam.pem;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/example.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # Session settings
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;  # Disable for strict forward secrecy

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # TLS 1.3 0-RTT (optional)
    ssl_early_data on;
    proxy_set_header Early-Data $ssl_early_data;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

### 6.2 Let's Encrypt Automation

```bash
# Install certbot (Ubuntu)
$ sudo apt install certbot python3-certbot-nginx

# Obtain certificate (Nginx auto-configuration)
$ sudo certbot --nginx -d example.com -d www.example.com

# Obtain certificate (DNS challenge, for wildcard)
$ sudo certbot certonly --manual --preferred-challenges dns \
  -d '*.example.com' -d example.com

# Test auto-renewal
$ sudo certbot renew --dry-run

# Auto-renewal (cron / systemd timer)
$ sudo crontab -e
0 0,12 * * * certbot renew --quiet --post-hook "systemctl reload nginx"

# Check systemd timer
$ systemctl list-timers | grep certbot

# Check certificate status
$ sudo certbot certificates
```

```bash
# How the ACME protocol works
#
# 1. Account registration
#    Client → Let's Encrypt: register public key
#
# 2. Authentication challenge
#    HTTP-01:     http://example.com/.well-known/acme-challenge/<TOKEN>
#    DNS-01:      _acme-challenge.example.com TXT <TOKEN>
#    TLS-ALPN-01: present token in a certificate during TLS handshake
#
# 3. Challenge verification
#    Let's Encrypt → example.com: verify token
#
# 4. Certificate issuance
#    Send CSR (Certificate Signing Request)
#    Receive signed certificate
#
# HTTP-01 vs DNS-01:
#   HTTP-01: Simple, requires port 80, no wildcard support
#   DNS-01:  Requires DNS record manipulation, wildcard supported, usable behind CDN
```

### 6.3 TLS for Internal Communication (mTLS)

```
mTLS (mutual TLS / mutual TLS authentication):
  → Both client and server present certificates
  → Used in service meshes and microservice-to-microservice communication

  Standard TLS:
    Client → verifies server's certificate (one-way)

  mTLS:
    Client → verifies server's certificate
    Server → verifies client's certificate (bidirectional)

  Use cases:
  → Kubernetes inter-service communication (Istio, Linkerd)
  → Zero-trust networks
  → API gateway authentication
  → IoT device authentication

  Nginx configuration:
  ssl_client_certificate /etc/nginx/ca.crt;
  ssl_verify_client on;
  ssl_verify_depth 2;

  → No client certificate: 403 Forbidden
  → Invalid certificate: 400 Bad Request
```

```yaml
# mTLS configuration in Istio (PeerAuthentication)
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT  # mTLS required for all communication

---
# DestinationRule (client-side configuration)
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: default
spec:
  host: "*.local"
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
```

---

## 7. TLS Vulnerabilities and Attacks

### 7.1 Historical Vulnerabilities

```
Major TLS-related vulnerabilities:

① BEAST (2011):
  → Attack on CBC mode in TLS 1.0
  → Decrypts cookies via chosen-plaintext attack
  → Mitigation: upgrade to TLS 1.1 or higher

② CRIME (2012):
  → Attack exploiting TLS compression
  → Infers secrets from compression ratio differences
  → Mitigation: disable TLS compression

③ Lucky Thirteen (2013):
  → Exploits timing differences in CBC mode padding processing
  → Mitigation: constant-time implementation, migrate to AEAD ciphers

④ Heartbleed (2014):
  → Implementation bug in OpenSSL's heartbeat extension
  → Up to 64KB of server memory leaked
  → Private keys, session data, etc. exposed
  → CVE-2014-0160
  → Mitigation: update OpenSSL, reissue certificates

⑤ POODLE (2014):
  → Vulnerability in SSL 3.0's CBC padding processing
  → Combined with a downgrade attack to SSL 3.0
  → Mitigation: disable SSL 3.0

⑥ FREAK (2015):
  → Downgrade to export-grade cryptography (512-bit RSA)
  → Mitigation: disable export-grade ciphers

⑦ Logjam (2015):
  → Weak DHE parameters (512/1024-bit)
  → Mitigation: use DH parameters of 2048 bits or more

⑧ ROBOT (2017):
  → Padding oracle in RSA key exchange
  → Variant of Bleichenbacher attack
  → Mitigation: disable RSA key exchange (use ECDHE)

⑨ RACCOON (2020):
  → Timing side-channel in DH key exchange
  → Mitigation: constant-time implementation

Lessons learned:
  → TLS 1.3 fundamentally eliminates many of the above attacks
  → Importance of disabling older protocol versions
  → Regular software updates
```

### 7.2 Downgrade Attacks and Mitigations

```
Downgrade attacks:
  → Attacker sits between client and server,
    forcing a weaker cipher suite or TLS version

  Attack steps:
  1. Tamper with ClientHello (change the supported version to TLS 1.0)
  2. Server responds with TLS 1.0
  3. Communication is established with weak cipher
  4. Attacker decrypts

  Mitigations:
  ① TLS_FALLBACK_SCSV:
     → Send a special cipher suite value on fallback
     → Server detects downgrade and refuses connection

  ② TLS 1.3 downgrade protection:
     → Last 8 bytes of ServerHello.random are fixed values
     → TLS 1.2: 0x44 0x4F 0x57 0x4E 0x47 0x52 0x44 0x01
     → TLS 1.1 and below: 0x44 0x4F 0x57 0x4E 0x47 0x52 0x44 0x00
     → Client detects this and refuses the connection

  ③ Disable old versions:
     → Disable TLS 1.0/1.1 on the server
     → ssl_protocols TLSv1.2 TLSv1.3;

  ④ HSTS Preload:
     → Browser refuses HTTP connections entirely
     → Register at https://hstspreload.org/
```

---

## 8. Certificate Transparency (CT)

```
Certificate Transparency:
  → A mechanism to record certificate issuance in public logs
  → Detects fraudulent certificate issuance

  Background:
  → Past cases where CAs issued fraudulent certificates
  → DigiNotar (2011): fake *.google.com certificate
  → Symantec (2017): trust revoked

  How it works:
  1. CA registers the certificate with a CT log server
  2. CT log server returns an SCT (Signed Certificate Timestamp)
  3. SCT is embedded in the certificate or sent during TLS handshake
  4. Browser validates the SCT

  ┌────┐     ┌──────────┐     ┌─────────┐
  │ CA │ ──→ │ CT Log   │ ──→ │ Monitor │
  └──┬─┘     └──────┬───┘     └─────────┘
     │              │                 │
     │ SCT          │ Public log      │ Detect fraud
     ▼              ▼                 ▼
  ┌────────┐  ┌──────────┐     ┌─────────┐
  │ Server │  │ Browser  │     │  Admin  │
  └────────┘  └──────────┘     └─────────┘

  Monitoring CT logs:
  → crt.sh: search issued certificates
  → https://crt.sh/?q=example.com
  → Detect fraudulent certificate issuance early

  Chrome requirements:
  → CT compliance mandatory since 2018
  → 2 or more SCTs required
  → Certificates without CT show "Not Transparent" warning
```

---

## 9. Diagnostic Commands for Production

```bash
# Inspect TLS connection details
$ openssl s_client -connect example.com:443

# Force TLS 1.3 connection
$ openssl s_client -connect example.com:443 -tls1_3

# Display certificate chain
$ openssl s_client -connect example.com:443 -showcerts

# Inspect certificate contents
$ echo | openssl s_client -connect example.com:443 2>/dev/null | \
  openssl x509 -text -noout

# Check certificate expiry
$ echo | openssl s_client -connect example.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Check certificate SANs (Subject Alternative Names)
$ echo | openssl s_client -connect example.com:443 2>/dev/null | \
  openssl x509 -noout -ext subjectAltName

# Verify OCSP Stapling
$ echo | openssl s_client -connect example.com:443 -status 2>/dev/null | \
  grep -A 20 "OCSP Response"

# Check TLS version and cipher suite
$ curl -v https://example.com 2>&1 | grep -E '(SSL|TLS)'

# Test connection with a specific cipher suite
$ openssl s_client -connect example.com:443 \
  -cipher ECDHE-RSA-AES256-GCM-SHA384

# List supported cipher suites
$ nmap --script ssl-enum-ciphers -p 443 example.com

# Online check with SSL Labs (aim for grade A+)
# https://www.ssllabs.com/ssltest/

# testssl.sh (comprehensive TLS test tool)
$ git clone https://github.com/drwetter/testssl.sh
$ ./testssl.sh example.com

# certigo (detailed certificate display)
$ certigo connect example.com:443

# SSLyze (Python TLS scanner)
$ pip install sslyze
$ sslyze example.com
```

### 9.1 Certificate Management Automation Script

```bash
#!/bin/bash
# check-cert-expiry.sh - Bulk check of certificate expiry dates

DOMAINS=(
  "example.com"
  "api.example.com"
  "www.example.com"
)

WARN_DAYS=30

for domain in "${DOMAINS[@]}"; do
  expiry=$(echo | openssl s_client -connect "$domain:443" 2>/dev/null | \
    openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

  if [ -z "$expiry" ]; then
    echo "[ERROR] $domain: Failed to retrieve certificate"
    continue
  fi

  expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || \
                 date -j -f "%b %d %T %Y %Z" "$expiry" +%s 2>/dev/null)
  now_epoch=$(date +%s)
  days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

  if [ "$days_left" -lt 0 ]; then
    echo "[EXPIRED] $domain: Expired ${days_left} days ago"
  elif [ "$days_left" -lt "$WARN_DAYS" ]; then
    echo "[WARNING] $domain: ${days_left} days remaining (${expiry})"
  else
    echo "[OK]      $domain: ${days_left} days remaining (${expiry})"
  fi
done
```

```python
# Python certificate expiry check
import ssl
import socket
from datetime import datetime

def check_certificate(hostname: str, port: int = 443) -> dict:
    """Retrieve and return certificate information"""
    context = ssl.create_default_context()
    with socket.create_connection((hostname, port), timeout=10) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert()

    # Expiry date
    not_after = datetime.strptime(
        cert['notAfter'], '%b %d %H:%M:%S %Y %Z'
    )
    days_left = (not_after - datetime.utcnow()).days

    # SAN (Subject Alternative Names)
    sans = []
    for type_name, value in cert.get('subjectAltName', []):
        if type_name == 'DNS':
            sans.append(value)

    # Issuer
    issuer = dict(x[0] for x in cert['issuer'])

    return {
        'hostname': hostname,
        'issuer': issuer.get('organizationName', 'Unknown'),
        'not_before': cert['notBefore'],
        'not_after': cert['notAfter'],
        'days_left': days_left,
        'sans': sans,
        'serial_number': cert.get('serialNumber', ''),
        'version': cert.get('version', ''),
        'tls_version': ssock.version(),
        'cipher': ssock.cipher(),
    }

# Usage example
domains = ['example.com', 'api.example.com', 'www.example.com']
for domain in domains:
    try:
        info = check_certificate(domain)
        status = "OK" if info['days_left'] > 30 else "WARNING"
        print(f"[{status}] {domain}: {info['days_left']} days remaining, "
              f"issuer={info['issuer']}, TLS={info['tls_version']}")
    except Exception as e:
        print(f"[ERROR] {domain}: {e}")
```

---

## 10. HSTS (HTTP Strict Transport Security)

```
HSTS:
  → Mechanism that forces browsers to use HTTPS connections
  → Prevents downgrade to HTTP

Header:
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

  max-age: period to enforce HTTPS (seconds)
    → 63072000 = 2 years
    → Recommend at least 31536000 (1 year)

  includeSubDomains: applies to all subdomains
    → All subdomains must also support HTTPS

  preload: register in HSTS Preload List
    → Pre-bundled into browsers
    → HTTPS enforced from the very first visit

HSTS Preload:
  → Submit registration at https://hstspreload.org/
  → Bundled into Chrome, Firefox, Safari, Edge
  → Once registered, removal is difficult (takes months to 1 year)

  Registration requirements:
  ① Valid SSL certificate
  ② HTTP to HTTPS redirect
  ③ All subdomains support HTTPS
  ④ max-age of 31536000 or more
  ⑤ includeSubDomains directive
  ⑥ preload directive

Notes:
  → Increase max-age gradually:
     300 → 86400 → 604800 → 2592000 → 63072000
  → Add includeSubDomains only after verifying all subdomains
  → Enable preload only after thorough testing
  → Risk of making the site inaccessible if misconfigured
```

---

## 11. TLS Performance Optimization

```
TLS performance optimization:

① Session resumption:
  → Session Ticket: server is stateless
  → Shortens handshake to 1-RTT

② TLS 1.3 0-RTT:
  → First request on reconnection is 0-RTT
  → But carries replay risk

③ OCSP Stapling:
  → Reduces client OCSP queries
  → Reduces handshake time

④ Certificate optimization:
  → ECDSA certificates (smaller than RSA)
     RSA 2048: ~256 bytes
     ECDSA P-256: ~64 bytes
  → Minimize certificate chain
  → Do not include unnecessary intermediate CA certificates

⑤ TLS Record Size:
  → Small record size initially (1369 bytes)
  → Aligned with TCP slow start
  → Larger record size after stabilizing (16KB)
  → Leverage Dynamic Record Sizing

⑥ TCP Fast Open + TLS 1.3:
  → TCP connection establishment and TLS handshake in parallel
  → Encrypted communication starts in 1 RTT total

⑦ Hardware acceleration:
  → AES-NI: hardware-assisted AES encryption
  → QAT (Quick Assist Technology): Intel offload device
  → Dedicated SSL/TLS hardware (HSM)

Performance measurement:
  $ curl -o /dev/null -s -w "\
    TCP:  %{time_connect}s\n\
    TLS:  %{time_appconnect}s\n\
    TTFB: %{time_starttransfer}s\n" \
    https://example.com

  TLS handshake targets:
  TLS 1.2:        < 100ms (same region)
  TLS 1.3:        < 50ms (same region)
  TLS 1.3 0-RTT:  < 10ms (reconnection)
```

---

## 12. HTTP/2, HTTP/3, and TLS

```
HTTP/2 and TLS:
  → HTTP/2 requires TLS 1.2 or higher (de facto)
  → HTTP/2 is negotiated via ALPN (Application-Layer Protocol Negotiation)
  → ALPN occurs during the TLS handshake (no additional RTT needed)

  ClientHello:
    ALPN: h2, http/1.1
  ServerHello:
    ALPN: h2
  → Communication starts over HTTP/2

HTTP/3 and QUIC:
  → HTTP/3 runs on QUIC
  → QUIC = transport protocol over UDP
  → TLS 1.3 is built into QUIC (not a separate protocol)

  TCP + TLS 1.3:
    TCP 3-way handshake: 1 RTT
    TLS handshake:       1 RTT
    Total:               2 RTT

  QUIC:
    QUIC handshake (TLS 1.3 built-in): 1 RTT
    Total: 1 RTT

  QUIC 0-RTT:
    Reconnection: 0 RTT
    → Data sent simultaneously with connection establishment

  QUIC benefits:
  → Eliminates Head-of-Line Blocking
  → Connection migration (handles IP address changes)
  → Built-in encryption (plaintext communication is impossible)
  → User-space implementation (no kernel changes needed)

  Nginx QUIC configuration:
  server {
      listen 443 quic reuseport;
      listen 443 ssl;
      http2 on;
      add_header Alt-Svc 'h3=":443"; ma=86400';
      # ...TLS configuration is the same as usual
  }
```

---

## 13. Troubleshooting in Production

```
Common TLS problems and solutions:

① Certificate error: "NET::ERR_CERT_AUTHORITY_INVALID"
  Cause: Intermediate CA certificate not sent
  Check: openssl s_client -connect host:443 -showcerts
  Fix:   Use fullchain.pem (includes intermediate CA)

② Certificate error: "NET::ERR_CERT_DATE_INVALID"
  Cause: Certificate has expired
  Check: openssl x509 -noout -dates
  Fix:   Renew certificate, set up auto-renewal

③ Mixed Content:
  Cause: HTTP resources on an HTTPS page
  Check: Chrome DevTools Console
  Fix:   Serve all resources over HTTPS, CSP upgrade-insecure-requests

④ HSTS-related errors:
  Cause: Invalid certificate but HSTS forces HTTPS
  Check: chrome://net-internals/#hsts
  Fix:   Fix the certificate, delete HSTS entry

⑤ SNI-related errors:
  Cause: Older clients do not support SNI
  Check: openssl s_client -connect host:443 -servername host
  Fix:   Configure default certificate, drop support for old clients

⑥ Protocol/Cipher Mismatch:
  Cause: No common cipher suite between client and server
  Check: sslyze / testssl.sh to check supported ciphers
  Fix:   Review cipher suite configuration

⑦ TLS connection timeout:
  Cause: Firewall, proxy, or MTU issue
  Check: tcpdump packet capture
  Fix:   Check firewall rules, adjust MTU

⑧ Client certificate error (mTLS):
  Cause: Client certificate is missing or invalid
  Check: curl --cert client.crt --key client.key https://...
  Fix:   Distribute client certificates, configure CA certificate
```

---

## 14. mTLS (Mutual TLS Authentication) in Practice

```
mTLS (mutual TLS):
  → In addition to standard TLS, the client is also authenticated via certificate
  → Server → authenticates client + Client → authenticates server

  Standard TLS:
  Client ───────→ Server
         ← Server certificate
  Only verifies "Is the server genuine?"

  mTLS:
  Client ───────→ Server
         ← Server certificate
         → Client certificate
  Mutually verifies "Is the server genuine?" + "Is the client genuine?"

  Use cases:
  ① Microservice-to-microservice communication: service identity verification
  ② IoT device authentication: connection control via device certificates
  ③ VPN alternative: BeyondCorp / Zero Trust
  ④ Financial APIs: cases requiring strong authentication
```

### 14.1 Creating and Configuring mTLS Certificates

```bash
# Create a private CA (Root CA)
# 1. Generate root CA private key
$ openssl ecparam -genkey -name prime256v1 -out root-ca.key

# 2. Generate root CA certificate (valid 10 years)
$ openssl req -new -x509 -sha256 -key root-ca.key \
  -out root-ca.crt -days 3650 \
  -subj "/C=JP/O=MyOrg/CN=MyOrg Root CA"

# Create server certificate
# 3. Server private key
$ openssl ecparam -genkey -name prime256v1 -out server.key

# 4. Create CSR (Certificate Signing Request)
$ openssl req -new -sha256 -key server.key -out server.csr \
  -subj "/C=JP/O=MyOrg/CN=api.example.com"

# 5. Sign server certificate (with SAN)
$ cat > server-ext.cnf << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment
subjectAltName = @alt_names
[alt_names]
DNS.1 = api.example.com
DNS.2 = *.api.example.com
EOF

$ openssl x509 -req -sha256 -in server.csr -CA root-ca.crt \
  -CAkey root-ca.key -CAcreateserial -out server.crt \
  -days 365 -extfile server-ext.cnf

# Create client certificate
# 6. Client private key
$ openssl ecparam -genkey -name prime256v1 -out client.key

# 7. Client CSR
$ openssl req -new -sha256 -key client.key -out client.csr \
  -subj "/C=JP/O=MyOrg/CN=service-a"

# 8. Sign client certificate
$ cat > client-ext.cnf << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature
extendedKeyUsage = clientAuth
EOF

$ openssl x509 -req -sha256 -in client.csr -CA root-ca.crt \
  -CAkey root-ca.key -CAcreateserial -out client.crt \
  -days 365 -extfile client-ext.cnf
```

### 14.2 Nginx mTLS Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    # Server certificate
    ssl_certificate     /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;

    # mTLS configuration
    ssl_client_certificate /etc/nginx/certs/root-ca.crt;  # CA for client certificates
    ssl_verify_client on;           # Require client certificate
    ssl_verify_depth 2;             # Depth of certificate chain

    # Forward client certificate info to backend
    location / {
        proxy_pass http://backend;
        proxy_set_header X-Client-DN $ssl_client_s_dn;
        proxy_set_header X-Client-Serial $ssl_client_serial;
        proxy_set_header X-Client-Verify $ssl_client_verify;
    }

    # When certificate verification fails:
    # With ssl_verify_client on;, Nginx returns 400 Bad Request
    # With ssl_verify_client optional;, verification is performed but not required
}
```

### 14.3 mTLS Connection in Node.js

```javascript
const https = require('https');
const fs = require('fs');

// mTLS server
const serverOptions = {
  key: fs.readFileSync('/path/to/server.key'),
  cert: fs.readFileSync('/path/to/server.crt'),
  ca: fs.readFileSync('/path/to/root-ca.crt'),  // CA for client certificates
  requestCert: true,       // Request client certificate
  rejectUnauthorized: true // Reject on verification failure
};

const server = https.createServer(serverOptions, (req, res) => {
  const clientCert = req.socket.getPeerCertificate();
  console.log('Client CN:', clientCert.subject.CN);
  console.log('Client Org:', clientCert.subject.O);
  res.writeHead(200);
  res.end(`Hello, ${clientCert.subject.CN}!`);
});

server.listen(443);

// mTLS client
const clientOptions = {
  hostname: 'api.example.com',
  port: 443,
  path: '/api/data',
  method: 'GET',
  key: fs.readFileSync('/path/to/client.key'),
  cert: fs.readFileSync('/path/to/client.crt'),
  ca: fs.readFileSync('/path/to/root-ca.crt')
};

const clientReq = https.request(clientOptions, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

clientReq.end();
```

---

## 15. TLS Security Auditing and Testing

### 15.1 Automated Security Audit Tools

```bash
# testssl.sh — comprehensive TLS configuration testing
$ git clone --depth 1 https://github.com/drwetter/testssl.sh.git
$ cd testssl.sh
$ ./testssl.sh https://example.com

# Sample output:
#  Testing protocols via sockets
#  SSLv2      not offered (OK)
#  SSLv3      not offered (OK)
#  TLS 1      not offered (OK)
#  TLS 1.1    not offered (OK)
#  TLS 1.2    offered (OK)
#  TLS 1.3    offered (OK)
#
#  Testing vulnerabilities
#  Heartbleed     not vulnerable (OK)
#  CCS            not vulnerable (OK)
#  Ticketbleed    not vulnerable (OK)
#  ROBOT          not vulnerable (OK)
#  CRIME          not vulnerable (OK)
#  BREACH         potentially vulnerable (WARN)
#  POODLE         not vulnerable (OK)
#  DROWN          not vulnerable (OK)
#  LOGJAM         not vulnerable (OK)
#  BEAST          not vulnerable (OK)

# sslyze — Python-based TLS scanner
$ pip install sslyze
$ sslyze example.com

# SSL Labs API — web-based detailed scan
$ curl "https://api.ssllabs.com/api/v3/analyze?host=example.com" | jq .

# nmap — enumerate TLS cipher suites
$ nmap --script ssl-enum-ciphers -p 443 example.com
```

### 15.2 TLS Security Checklist

```
TLS Configuration Checklist (2024):

Protocols:
  [x] Enable TLS 1.3
  [x] Enable TLS 1.2 (for compatibility)
  [x] Disable TLS 1.1 and below
  [x] Disable SSLv2, SSLv3

Cipher suites:
  [x] Allow AEAD only (AES-GCM, ChaCha20-Poly1305)
  [x] Only key exchange with forward secrecy (ECDHE)
  [x] Disable RSA key exchange
  [x] Disable 3DES, RC4, DES
  [x] Disable CBC mode (recommended)

Certificates:
  [x] RSA 2048-bit or higher, or ECDSA P-256 or higher
  [x] SHA-256 or higher signature algorithm
  [x] Full chain including intermediate CA certificate
  [x] List specific domains in SAN rather than wildcards (when possible)
  [x] Set up and monitor auto-renewal
  [x] Enable Certificate Transparency

Security headers:
  [x] HSTS: max-age=31536000; includeSubDomains; preload
  [x] Register in HSTS Preload List
  [x] Expect-CT (report mode)

Performance:
  [x] Enable OCSP Stapling
  [x] TLS session resumption (Session Ticket / Session ID)
  [x] TLS 1.3 0-RTT (safe requests only)
  [x] Appropriate TLS record size

Operations:
  [x] Secure storage of private keys (file permissions 600)
  [x] Certificate expiry monitoring and alerting
  [x] Regular security scans (SSL Labs A+)
  [x] Documented certificate revocation procedure for incidents
```

---

## 16. Post-Quantum Cryptography and the Future of TLS

```
The quantum computing threat:

Current public-key cryptography:
  RSA: based on integer factorization problem → solvable by Shor's algorithm
  ECDHE: elliptic curve discrete logarithm problem → solvable by Shor's algorithm
  → When sufficient qubit counts are achieved, current TLS will break

Timeline (estimates):
  2024-2030: Quantum computing development period
  2030-2040: Cryptographically relevant quantum computers may become practical
  Now:       Urgent need to prepare for "Harvest Now, Decrypt Later" attacks
    → Recording encrypted communications today to decrypt later with quantum computers

NIST Post-Quantum Cryptography Standards (finalized 2024):

① ML-KEM (Module-Lattice-Based Key Encapsulation):
  → Formerly: CRYSTALS-Kyber
  → For key exchange (replacement for ECDHE in TLS)
  → Based on lattice problems → hard to break even with quantum computers
  → Chrome has experimentally implemented ML-KEM-768

② ML-DSA (Module-Lattice-Based Digital Signature):
  → Formerly: CRYSTALS-Dilithium
  → For digital signatures (replacement for certificate signatures)

③ SLH-DSA (Stateless Hash-Based Digital Signature):
  → Formerly: SPHINCS+
  → Hash-based signature (conservative choice)

Hybrid approach (recommended during transition):
  → Combine traditional cryptography + post-quantum cryptography
  → Secure even if either one is broken

  TLS 1.3 implementation:
  Key exchange: X25519 + ML-KEM-768 (X25519MLKEM768)
  → Combine both shared secrets to derive the final key
  → Maintains traditional security while adding quantum resistance

  Chrome/Edge status (from 2024):
  → X25519MLKEM768 enabled by default
  → Handshake size increases by ~1KB
  → Some older middleboxes reported connection issues

Practical recommendations:
  Now:
  ✓ Ensure crypto agility (design so cipher suites can be changed easily)
  ✓ Complete migration to TLS 1.3
  ✓ Review encryption levels for long-term stored data

  2025-2030:
  ✓ Pilot hybrid approach
  ✓ Monitor PQC support in libraries/frameworks
  ✓ Confirm HSM post-quantum compatibility

  2030 and beyond:
  ✓ Complete migration to post-quantum cryptography
  ✓ Retire old cipher suites
```

---

## Summary

| Concept | Key Points |
|---------|-----------|
| TLS | Encryption + Authentication + Integrity |
| TLS 1.2 | 2-RTT handshake |
| TLS 1.3 | 1-RTT (0-RTT reconnection), weak ciphers removed |
| Certificates | X.509, CA-signed chain, DV/OV/EV |
| Forward Secrecy | ECDHE protects past communications |
| Cipher suites | AES-GCM / ChaCha20-Poly1305, AEAD required |
| HSTS | Enforces HTTPS, Preload List protects from first visit |
| mTLS | Mutual authentication, microservice communication |
| CT | Certificate issuance transparency, detects fraudulent issuance |
| HTTP/3 | TLS 1.3 built into QUIC, 1-RTT |
| Post-quantum | ML-KEM/ML-DSA, hybrid approach for early adoption |

---

## FAQ

### Q1: What are the main differences between TLS 1.2 and TLS 1.3?

**A1: Performance, security, and simplicity are significantly improved.**

Key differences:

1. **Faster handshake**:
   - TLS 1.2: 2 RTT (2 round trips required)
   - TLS 1.3: 1 RTT (1 round trip)
   - TLS 1.3 (reconnection): 0-RTT (data can be sent simultaneously)
   - Measured: TLS 1.2 ~200ms → TLS 1.3 ~100ms (Tokyo-US)

2. **Expanded encryption scope**:
   - TLS 1.2: only application data is encrypted
   - TLS 1.3: most of the handshake is also encrypted (certificate is not visible)
   - Improved privacy: the server's certificate is no longer visible to eavesdroppers

3. **Removal of weak cryptography**:
   - RSA key exchange (no forward secrecy) → removed
   - CBC mode (padding oracle attacks) → removed
   - Compression (CRIME attack) → removed
   - Renegotiation → removed
   - → Always ECDHE for forward secrecy, AEAD for authenticated encryption

4. **Improved key derivation**:
   - TLS 1.2: PRF (Pseudo-Random Function)
   - TLS 1.3: HKDF (HMAC-based KDF) — clearer and more secure design
   - Staged key derivation: 0-RTT keys, handshake keys, and application keys are separated

5. **Improved security through reduced options**:
   - TLS 1.2: ~40 cipher suite options
   - TLS 1.3: only 5 (TLS_AES_128_GCM_SHA256, etc.)
   - → Reduced risk of misconfiguration, easier to audit

**Production recommendation**: Use TLS 1.3 as primary, allow TLS 1.2 for compatibility. Disable TLS 1.0/1.1.

---

### Q2: How does a certificate chain work, and why are intermediate CA certificates necessary?

**A2: It is a design that builds a chain of trust while keeping the root CA's private key secure.**

Certificate chain structure:
```
┌────────────────┐
│ Root CA cert   │ ← Built into OS/browser (~150-200 certs)
│ (self-signed)  │    Private key stored offline (in HSM, physically isolated)
└───────┬────────┘    If compromised, the entire Internet is affected
        │ signs
┌───────▼────────┐
│ Intermediate   │ ← Signed by the root CA
│ CA cert        │    Private key is online (used for certificate issuance)
└───────┬────────┘    If compromised, only this intermediate needs to be revoked
        │ signs
┌───────▼────────┐
│ Server cert    │ ← Signed by the intermediate CA (Let's Encrypt, etc.)
│ example.com    │    Validity period: typically 90 days for DV certificates
└────────────────┘
```

Why intermediate CAs are necessary:

1. **Protecting the root CA**:
   - The root CA's private key is strictly isolated (air-gapped environment)
   - Accessing the root CA for every certificate issuance is impractical
   - The intermediate CA handles issuance online

2. **Risk distribution**:
   - If an intermediate CA is compromised, only that intermediate CA needs to be revoked
   - If the root CA is compromised, all derived certificates become invalid
   - Real example: 2011 DigiNotar breach → root CA revoked → removed from browsers

3. **Flexible operation**:
   - Multiple intermediate CAs for different purposes and regions
   - Separate intermediate CAs for DV and EV
   - Easy to renew intermediate CA validity

Validation process (browser side):
```
1. Verify server certificate's signature with the intermediate CA's public key
2. Verify intermediate CA certificate's signature with the root CA's public key
3. Confirm root CA certificate is in the OS/browser trust store
4. Verify each certificate's validity period
5. Verify the domain name (SAN) matches
6. Revocation check (OCSP Stapling / CRL / CRLite)
7. Verify Certificate Transparency logs
```

Common problems and solutions:

**Problem 1: Missing intermediate CA certificate**
```bash
# Symptom: "untrusted certificate" error
# Cause: server sends only the server certificate, not the intermediate CA
# Check:
$ openssl s_client -connect example.com:443 -showcerts

# Fix: use fullchain.pem (server certificate + intermediate CA certificate)
ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
# Specify fullchain.pem, not cert.pem
```

**Problem 2: Certificate order is reversed**
```
Correct order: server certificate → intermediate CA certificate → root CA certificate (optional)
Wrong order:   intermediate CA → server certificate → error
```

**Cross-signing**:
A technique where a new root CA also gets signed by an older root CA during its rollout period.
- Let's Encrypt: ISRG Root X1 (new) + DST Root CA X3 (old) cross-signed
- Older Android devices trusted the chain via DST
- As of 2024, ISRG Root X1 is trusted by nearly all devices

---

### Q3: How does Let's Encrypt work and how should I use it in production?

**A3: It issues free 90-day DV certificates via the ACME protocol with automated domain validation.**

Let's Encrypt features:
- **Completely free**: DV (Domain Validation) certificates
- **Automated**: obtain and renew automatically with certbot
- **Validity period**: 90 days (intentionally short → promotes auto-renewal)
- **Trusted**: operated by ISRG (Internet Security Research Group), trusted by major browsers
- **Limitations**: wildcard certificates require DNS challenge, rate limits apply

ACME protocol flow:

```
1. Account registration
   Client → Let's Encrypt: send public key
   → Receive account URL

2. Certificate request
   Client → Let's Encrypt: request certificate for example.com

3. Challenge presentation
   Let's Encrypt → Client: authenticate using one of the following

   ① HTTP-01 challenge:
      Place specific content at
      http://example.com/.well-known/acme-challenge/<TOKEN>
      → Let's Encrypt accesses and verifies
      → Requires port 80, no wildcard support

   ② DNS-01 challenge:
      Set DNS record:
      _acme-challenge.example.com TXT "<TOKEN>"
      → Let's Encrypt verifies via DNS query
      → Wildcard certificates supported, port 80 not required
      → Requires DNS provider API (for automation)

   ③ TLS-ALPN-01 challenge:
      Present a certificate containing the token during TLS handshake
      → Alternative to HTTP-01, uses only port 443

4. Challenge response
   Client: place token → notify Let's Encrypt

5. Verification
   Let's Encrypt: verify token → success

6. Certificate issuance
   Client: send CSR (Certificate Signing Request)
   Let's Encrypt: return signed certificate
```

Production configuration example:

```bash
# Install certbot (Ubuntu)
$ sudo apt update
$ sudo apt install certbot python3-certbot-nginx

# Obtain certificate for Nginx (auto-configuration)
$ sudo certbot --nginx -d example.com -d www.example.com
# → Automatically edits Nginx configuration files
# → Places certificates at /etc/letsencrypt/live/example.com/

# Obtain certificate only (manual configuration)
$ sudo certbot certonly --webroot -w /var/www/html \
  -d example.com -d www.example.com

# Wildcard certificate (DNS challenge required)
$ sudo certbot certonly --manual --preferred-challenges dns \
  -d '*.example.com' -d example.com
# → Instructions to set DNS record:
#   _acme-challenge.example.com TXT "abc123..."
# → Press Enter after setting to verify

# Set up auto-renewal (systemd timer, auto-configured on Ubuntu)
$ systemctl list-timers | grep certbot
# or cron
$ sudo crontab -e
0 0,12 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
# → Check twice a day, renew if expiring within 30 days

# Test renewal (does not actually renew)
$ sudo certbot renew --dry-run

# Check certificate status
$ sudo certbot certificates
Found the following certs:
  Certificate Name: example.com
    Domains: example.com www.example.com
    Expiry Date: 2024-03-31 12:00:00+00:00 (VALID: 89 days)
    Certificate Path: /etc/letsencrypt/live/example.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/example.com/privkey.pem
```

Nginx configuration (manual):
```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    # Let's Encrypt certificate
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # ACME challenge path (needed for renewal)
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name example.com;

    # Allow only ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    # Redirect everything else to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
```

Rate limits (as of 2024):
- Certificates per registered domain per week: 50
- Duplicate certificates per week: 5
- Account registrations: 10 accounts per 3 hours per IP
- → Test thoroughly in a staging environment before production

Staging environment:
```bash
$ sudo certbot --nginx --staging \
  -d example.com -d www.example.com
# → Relaxed rate limits, untrusted certificate (for testing only)
```

Troubleshooting:
```bash
# Check logs
$ sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Manually delete certificate
$ sudo certbot delete --cert-name example.com

# Verify Nginx configuration
$ sudo nginx -t

# Check port 80 is open (HTTP-01 challenge)
$ curl http://example.com/.well-known/acme-challenge/test
```

Alternative clients:
- acme.sh: shell script only, no dependencies
- Caddy: web server with built-in certificate provisioning
- Traefik: reverse proxy with built-in certificate provisioning

---

## Further Reading

---

## References
1. RFC 8446. "The Transport Layer Security (TLS) Protocol Version 1.3." IETF, 2018.
2. RFC 5246. "The Transport Layer Security (TLS) Protocol Version 1.2." IETF, 2008.
3. RFC 8996. "Deprecating TLS 1.0 and TLS 1.1." IETF, 2021.
4. RFC 6960. "X.509 Internet Public Key Infrastructure Online Certificate Status Protocol - OCSP." IETF, 2013.
5. RFC 6962. "Certificate Transparency." IETF, 2013.
6. RFC 6797. "HTTP Strict Transport Security (HSTS)." IETF, 2012.
7. Mozilla. "Security/Server Side TLS." Mozilla Wiki, 2024.
8. SSL Labs. "SSL/TLS Deployment Best Practices." Qualys, 2024.
9. NIST. "SP 800-52 Rev. 2: Guidelines for the Selection, Configuration, and Use of TLS Implementations." 2019.
10. Cloudflare. "What is TLS?" Cloudflare Learning Center, 2024.
