# TLS / Certificates

> A systematic study of the foundational technologies for secure communication — from the TLS handshake and certificate chains to automation with Let's Encrypt and mutual TLS (mTLS)

## What You Will Learn in This Chapter

1. **How the TLS Handshake Works** — Every step taken to establish encrypted communication between a client and server
2. **Certificate Chains and PKI** — The chain of trust from the Root CA through intermediate CAs to the server certificate
3. **Certificate Management in Production** — Automation with Let's Encrypt and mutual authentication with mTLS

### Prerequisites

- Basics of public-key cryptography (RSA, elliptic curve cryptography, digital signatures)
- TCP/IP networking (three-way handshake, ports)
- Fundamental behavior of the HTTP protocol

### Related Guides

- [Key Management](./02-key-management.md) — Cryptographic key lifecycle and secure storage
- [Network Security Basics](../03-network-security/00-network-security-basics.md) — Defense in depth with firewalls and IDS/IPS
- [API Security](../03-network-security/02-api-security.md) — API protection built on top of TLS
- [DNS Security](../03-network-security/01-dns-security.md) — DNS-based certificate validation with DANE/TLSA

---

## 1. TLS Overview

### What Is TLS?

TLS (Transport Layer Security) is an encryption protocol that operates on top of the transport layer. It was designed as the successor to SSL, and the currently recommended version is TLS 1.3 (RFC 8446).

TLS provides the following three security properties:
- **Confidentiality**: Encryption of communication content
- **Integrity**: Detection of data tampering
- **Authentication**: Verification of the identity of the communicating party

```
+-------------------+
|   Application     |  HTTP, SMTP, IMAP, etc.
+-------------------+
|       TLS         |  Encryption, Authentication, Integrity
|  +-------------+  |
|  | Record      |  |  Data segmentation, encryption, and MAC
|  +-------------+  |
|  | Handshake   |  |  Key exchange, authentication, parameter negotiation
|  +-------------+  |
|  | Alert       |  |  Error notification and connection termination
|  +-------------+  |
|  | Change Cipher|  |  Cipher spec change (TLS 1.2)
|  +-------------+  |
+-------------------+
|       TCP         |  Reliable delivery
+-------------------+
|       IP          |  Routing
+-------------------+
```

### TLS Version Comparison

| Version | Status | Handshake RTT | Key Features | Deprecation Reason / Vulnerabilities |
|-----------|------|-------------------|---------|---------------|
| SSL 2.0 | Deprecated (2011) | 2-RTT | - | Fundamental design flaws |
| SSL 3.0 | Deprecated (2015) | 2-RTT | - | POODLE vulnerability |
| TLS 1.0 | Deprecated (2020) | 2-RTT | Improvement over SSL 3.0 | BEAST vulnerability |
| TLS 1.1 | Deprecated (2020) | 2-RTT | CBC improvements | Lucky13, no support for modern cipher suites |
| TLS 1.2 | Active | 2-RTT | AEAD cipher suites | GCM recommended, CBC deprecated |
| TLS 1.3 | Recommended | 1-RTT (0-RTT possible) | Simplified handshake | Forward secrecy required |

### Features Removed in TLS 1.3

```
+------------------------------------------------------------------+
|  Features and Algorithms Removed in TLS 1.3                       |
|------------------------------------------------------------------|
|                                                                    |
|  [Key Exchange]                                                    |
|  - RSA key exchange (static RSA) → replaced by ECDHE only        |
|    Reason: no forward secrecy; leaking the server private key     |
|    allows decryption of all past communications                   |
|                                                                    |
|  [Cipher Algorithms]                                              |
|  - RC4 → removed (statistical bias)                               |
|  - 3DES → removed (64-bit block, Sweet32 attack)                 |
|  - CBC mode → removed (padding oracle)                            |
|  - DES → removed (insufficient key length)                        |
|                                                                    |
|  [Hash]                                                           |
|  - MD5 → removed (collision attack)                               |
|  - SHA-1 → removed (collision attack)                             |
|                                                                    |
|  [Protocol Features]                                              |
|  - Compression → removed (CRIME/BREACH attacks)                   |
|  - Renegotiation → removed (triple handshake attack)              |
|  - ChangeCipherSpec message → removed                             |
|  - Custom cipher suite definitions → limited to 5 suites only    |
+------------------------------------------------------------------+
```

---

## 2. TLS 1.3 Handshake

### Handshake Flow

```
Client                                    Server
  |                                          |
  |--- ClientHello ----------------------->  |
  |    + supported_versions: [TLS 1.3]      |
  |    + key_share: (x25519 public key)     |
  |    + signature_algorithms: [Ed25519,     |
  |      ECDSA-P256, RSA-PSS]               |
  |    + psk_key_exchange_modes             |
  |    + supported_groups: [x25519, P-256]  |
  |                                          |
  |  <--- ServerHello ---------------------  |
  |       + key_share: (x25519 public key)  |
  |       [Server→Client encryption starts] |
  |  <--- EncryptedExtensions -------------  |
  |  <--- Certificate ---------------------  |
  |       (Server certificate chain)        |
  |  <--- CertificateVerify --------------  |
  |       (Signature over handshake msgs)   |
  |  <--- Finished -----------------------  |
  |       (Handshake MAC)                   |
  |                                          |
  |--- Finished ------------------------->   |
  |    [Client→Server encryption starts]    |
  |                                          |
  |========= Encrypted Communication ======|
```

### TLS 1.3 Cipher Suites

```
5 cipher suites available in TLS 1.3:

  TLS_AES_256_GCM_SHA384        Most recommended
  TLS_AES_128_GCM_SHA256        Recommended
  TLS_CHACHA20_POLY1305_SHA256  Optimal for mobile / ARM
  TLS_AES_128_CCM_SHA256        For IoT
  TLS_AES_128_CCM_8_SHA256      IoT (short authentication tag)

Cipher suite components (TLS 1.3):
  [AEAD cipher] + [Hash]

  Key exchange: ECDHE (x25519 or P-256) — selected outside cipher suite
  Signature: Ed25519, ECDSA, RSA-PSS — selected outside cipher suite

Note: In TLS 1.2 cipher suites included all four elements
(key exchange + auth + cipher + MAC), but in TLS 1.3 these are separated.
```

### TLS 1.2 vs. 1.3 Handshake Comparison

| Item | TLS 1.2 | TLS 1.3 |
|------|---------|---------|
| Round trips | 2-RTT | 1-RTT |
| 0-RTT reconnect | Not possible | Possible (Early Data) |
| Key exchange | RSA / ECDHE | ECDHE only |
| Number of cipher suites | Dozens | 5 |
| Handshake encryption | None (plaintext) | Encrypted from ServerHello onward |
| Forward secrecy | Optional | Required |
| Compression | Supported | Removed |
| Renegotiation | Yes | No (replaced by KeyUpdate) |
| Session resumption | Session ID / ticket | PSK-based |
| ServerHello contents | Plaintext | Encrypted |

### Inspecting the Handshake with OpenSSL

```bash
# Code example 1: Detailed TLS connection inspection

# Display TLS 1.3 handshake details
openssl s_client -connect example.com:443 -tls1_3 -msg

# Inspect the certificate chain
openssl s_client -connect example.com:443 -showcerts

# Check the cipher suite in use
openssl s_client -connect example.com:443 -cipher 'TLS_AES_256_GCM_SHA384'

# List cipher suites supported by the server
nmap --script ssl-enum-ciphers -p 443 example.com

# Comprehensive TLS testing with testssl.sh
testssl.sh https://example.com

# Detailed analysis with sslyze
sslyze --regular example.com

# Display TLS version and protocol info with curl
curl -vI https://example.com 2>&1 | grep -E "SSL|TLS|subject|issuer"
```

### How 0-RTT (Early Data) Works and Its Caveats

```
0-RTT flow (PSK-based reconnection):

  Client                                    Server
    |                                          |
    |--- ClientHello ----------------------->  |
    |    + pre_shared_key (from last session) |
    |    + early_data (application data)      |
    |                                          |
    |  <--- ServerHello ---------------------  |
    |  <--- Finished -----------------------  |
    |                                          |
    |--- Finished ------------------------->   |
    |                                          |
    | Data sent via 0-RTT is already          |
    | processed on the server                 |

  Benefit: Zero latency on reconnect
  Risk: Replay attacks are possible

  Mitigations:
  +-- Do not use for non-idempotent operations (POST, DELETE)
  +-- Implement an anti-replay mechanism on the server side
  +-- Nginx: ssl_early_data on; + check the Early-Data header
  +-- Accept 0-RTT for a given PSK only once on the server
```

### How Forward Secrecy Works

```
Without forward secrecy (static RSA key exchange):

  Client                              Server
    |--- RSA-encrypted(premaster secret) --> |
    |    Encrypted with server public key    |
    |                                        |
  Problem: If the server's private key leaks in the future,
  all previously recorded communications can be decrypted

With forward secrecy (ECDHE key exchange):

  Client                              Server
    |--- ECDHE public key -------------> |
    |<--- ECDHE public key --------------|
    |    Both sides independently compute |
    |    the shared secret               |
    |    Ephemeral key pairs are discarded|
    |                                    |
  Benefit: Because a different key pair is used per session,
  leaking the server's private key cannot decrypt past communications

  In TLS 1.3, PFS is mandatory (ECDHE only)
```

---

## 3. Certificate Chains and PKI

### Certificate Chain Structure

```
+---------------------------+
|    Root CA Certificate    |  Self-signed / Embedded in OS & browsers
|    (e.g. DigiCert Root)   |  Validity: 20–30 years
|    Signed by own key      |
+---------------------------+
          |
          | Signs
          v
+---------------------------+
|  Intermediate CA Cert     |  Signed by Root CA
|  (e.g. DigiCert SHA2)    |  Validity: 5–10 years
|  Signs end-entity certs   |  Root CA kept offline for protection
+---------------------------+
          |
          | Signs
          v
+---------------------------+
|    Server Certificate     |  Signed by intermediate CA
|    (e.g. *.example.com)   |  Validity: max 398 days
|    Presented in TLS       |  (CA/B Forum requirement)
+---------------------------+

Why intermediate CAs are necessary:
1. Protect the Root CA private key offline (stored in an HSM)
2. Limit the blast radius if the Root CA is compromised
3. Only the intermediate CA needs to be revoked if a cert is revoked
4. Separate intermediate CAs for different policies / purposes
```

### Inspecting Certificate Contents

```bash
# Code example 2: Commands to inspect certificate details

# Decode certificate contents
openssl x509 -in server.crt -text -noout

# Sample output:
# Certificate:
#     Data:
#         Version: 3 (0x2)
#         Serial Number: 04:00:00:00:00:01:2f:...
#         Signature Algorithm: sha256WithRSAEncryption
#         Issuer: C=US, O=DigiCert Inc, CN=DigiCert SHA2 ...
#         Validity:
#             Not Before: Jan  1 00:00:00 2025 GMT
#             Not After : Dec 31 23:59:59 2025 GMT
#         Subject: CN=*.example.com
#         Subject Public Key Info:
#             Public Key Algorithm: id-ecPublicKey
#             Public-Key: (256 bit)
#         X509v3 extensions:
#             X509v3 Subject Alternative Name:
#                 DNS:*.example.com, DNS:example.com
#             X509v3 Key Usage: critical
#                 Digital Signature
#             X509v3 Extended Key Usage:
#                 TLS Web Server Authentication
#             Authority Information Access:
#                 OCSP - URI:http://ocsp.digicert.com
#                 CA Issuers - URI:http://cacerts.digicert.com/...
#             X509v3 CRL Distribution Points:
#                 URI:http://crl3.digicert.com/...

# Verify the certificate chain
openssl verify -CAfile ca-bundle.crt server.crt

# Display the full certificate chain of a remote server
openssl s_client -connect example.com:443 -showcerts 2>/dev/null | \
  openssl x509 -noout -subject -issuer -dates

# Certificate fingerprint
openssl x509 -in server.crt -fingerprint -sha256 -noout

# Inspect a CSR (Certificate Signing Request)
openssl req -in server.csr -text -noout

# Verify private key matches certificate
openssl x509 -in server.crt -modulus -noout | openssl md5
openssl rsa -in server.key -modulus -noout | openssl md5
# Matching hash values confirm they match
```

### Key Fields of an X.509 Certificate

```
+-----------------------------------------------------+
|  X.509 v3 Certificate                                |
|-----------------------------------------------------|
|  Version:             3 (v3)                         |
|  Serial Number:       Unique identifier (unique to CA)|
|  Signature Algorithm: sha256WithRSAEncryption        |
|                       or ecdsa-with-SHA256           |
|  Issuer:              Distinguished Name of the CA   |
|  Validity:                                           |
|    Not Before:        Issuance date/time             |
|    Not After:         Expiration date/time           |
|  Subject:             Distinguished Name of owner    |
|  Public Key:          Public key (RSA 2048+ / ECDSA P-256)|
|  Extensions:                                         |
|    - Subject Alt Name (SAN): List of domains (required)|
|    - Key Usage: digitalSignature, keyEncipherment    |
|    - Extended Key Usage: serverAuth, clientAuth      |
|    - Basic Constraints: CA:FALSE / CA:TRUE           |
|    - Authority Key Identifier: Issuer key identifier |
|    - Subject Key Identifier: Certificate key identifier|
|    - CRL Distribution Points: Where to fetch CRL    |
|    - Authority Info Access: OCSP responder URL       |
|    - Certificate Policies: Issuance policy OID       |
|    - SCT List: Certificate Transparency log entries  |
|  Signature:           Digital signature of the CA    |
+-----------------------------------------------------+
```

### Certificate Types and Validation Levels

| Type | Abbreviation | Validation | Issuance Time | Use Case | Browser Display |
|------|------|---------|---------|------|------------|
| Domain Validation | DV | Domain control only | Minutes | General websites | Padlock icon |
| Organization Validation | OV | + Organization existence | 1–3 days | Corporate sites | Padlock + org name |
| Extended Validation | EV | + Rigorous org vetting | 1–4 weeks | Finance / e-commerce | Padlock + org name |
| Wildcard | WC | *.example.com | Same as DV/OV | Many subdomains | Same as above |
| Multi-domain | SAN | Multiple domains in one cert | Same as DV/OV | Consolidating multiple sites | Same as above |

---

## 4. Certificate Revocation Checking

### OCSP vs. CRL Comparison

```
+------------------------------------------------------------------+
|  How Certificate Revocation Checking Works                        |
|------------------------------------------------------------------|
|                                                                    |
|  [CRL (Certificate Revocation List)]                               |
|  CA periodically publishes a list of revoked certificates         |
|  Client downloads the list and validates locally                  |
|                                                                    |
|  Drawbacks:                                                       |
|  - List can grow very large (several MB)                          |
|  - Depends on update frequency (not real-time)                    |
|  - Fallback on download failure (fail-open)                       |
|                                                                    |
|  [OCSP (Online Certificate Status Protocol)]                       |
|  Client queries the CA about individual certificates              |
|                                                                    |
|  Drawbacks:                                                       |
|  - Increased latency (round trip to CA)                           |
|  - Privacy (destination leaks to the CA)                          |
|  - Risk of OCSP responder outage                                  |
|                                                                    |
|  [OCSP Stapling (Recommended)]                                     |
|  Server pre-fetches the OCSP response from the CA                 |
|  Delivers it to the client during the TLS handshake               |
|                                                                    |
|  Benefits:                                                        |
|  - Client does not need to query the CA directly                  |
|  - Privacy is preserved                                           |
|  - No added latency                                               |
+------------------------------------------------------------------+
```

| Method | Real-time | Privacy | Performance | Reliability |
|------|------------|------------|-------------|--------|
| CRL | Low (periodic updates) | High | Low (large list) | Medium |
| OCSP | High | Low (leaks to CA) | Medium (round trip) | CA-dependent |
| OCSP Stapling | High | High | High | Server-dependent |
| CRLite (experimental) | High | High | High | Browser-built-in |

```nginx
# Code example 3: OCSP Stapling configuration in Nginx
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate     /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;

    # Enable OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # CA certificate used to connect to the OCSP responder
    ssl_trusted_certificate /etc/nginx/ssl/ca-chain.crt;

    # DNS resolver for OCSP response lookup
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;
}
```

### Certificate Transparency (CT)

```
How Certificate Transparency works:

  When a CA issues a certificate:
  1. CA submits the certificate to a CT log server
  2. CT log server returns an SCT (Signed Certificate Timestamp)
  3. SCT is embedded in the certificate
  4. Browser verifies the SCT and confirms the cert is recorded in the CT log

  Purpose:
  - Detect fraudulently issued certificates (e.g. the 2011 DigiNotar incident)
  - Allow domain owners to monitor certificates issued for their domain
  - Improve CA trustworthiness through transparency

  Chrome requirements:
  - Since April 2018, all new certificates must be logged in a CT log
  - SCTs from at least 2 CT logs are required

  Monitoring tools:
  - crt.sh: https://crt.sh/?q=example.com
  - Google CT Dashboard
  - certspotter (CLI tool)
```

```bash
# Code example 4: Monitoring CT logs
# Check all certificates for a domain via crt.sh
curl -s "https://crt.sh/?q=%25.example.com&output=json" | \
  python3 -m json.tool | head -50

# Real-time monitoring with certspotter
# certspotter watch example.com
```

---

## 5. Automation with Let's Encrypt

### How the ACME Protocol Works

```
ACME (Automatic Certificate Management Environment) - RFC 8555:

Client (certbot)                    Let's Encrypt CA
     |                                      |
     |--- (1) Account registration ----->  |
     |    JWK public key + ToS agreement    |
     |                                      |
     |  <--- Account created -----------  |
     |                                      |
     |--- (2) Certificate request ------> |
     |    (domain: example.com)             |
     |                                      |
     |  <--- (3) Challenge issued -------  |
     |       (HTTP-01 or DNS-01)            |
     |                                      |
     |--- (4) Challenge response ------->  |
     |    HTTP-01: place token at           |
     |    /.well-known/acme-               |
     |    challenge/{token}                 |
     |    DNS-01: set token in _acme-       |
     |    challenge TXT record              |
     |                                      |
     |  <--- (5) Validation performed ---  |
     |    CA verifies token via HTTP/DNS    |
     |                                      |
     |  <--- (6) Validation complete ----  |
     |                                      |
     |--- (7) CSR submission ----------->  |
     |                                      |
     |  <--- (8) Certificate issued -----  |
     |    (certificate with chain)          |
```

### Obtaining Certificates with certbot

```bash
# Code example 5: Various certbot usage patterns

# Obtain and configure a certificate for Nginx (easiest)
sudo certbot --nginx -d example.com -d www.example.com

# For Apache
sudo certbot --apache -d example.com

# Standalone mode (stops any existing web server)
sudo certbot certonly --standalone -d example.com

# Webroot mode (uses existing web server without stopping it)
sudo certbot certonly --webroot -w /var/www/html -d example.com

# Obtain a wildcard certificate via DNS-01 challenge
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.example.com" -d "example.com"

# Automated DNS-01 with Cloudflare plugin
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d "*.example.com" -d "example.com"

# Test automatic renewal
sudo certbot renew --dry-run

# Configure automatic renewal
# systemd timer (recommended)
# /etc/systemd/system/certbot-renewal.timer
# [Timer]
# OnCalendar=*-*-* 03:00:00
# RandomizedDelaySec=3600

# Automatic renewal via crontab (alternative)
# 0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"

# Check certificate info
sudo certbot certificates

# Manually revoke a certificate
sudo certbot revoke --cert-path /etc/letsencrypt/live/example.com/cert.pem
```

### Challenge Method Comparison

| Method | Use Case | Automation | Wildcard | Port Requirement | DNS Change |
|------|------|--------|--------------|-----------|---------|
| HTTP-01 | Web servers | Easy | Not possible | 80 | Not needed |
| DNS-01 | Any | Requires DNS API | Possible | Not needed | Required |
| TLS-ALPN-01 | Port 443 only | Moderate | Not possible | 443 | Not needed |

### ACME Client Comparison

| Client | Language | Characteristics | Use Case |
|------------|------|------|------|
| certbot | Python | Official, most widely used | General purpose |
| acme.sh | Shell | Lightweight, no dependencies | Simple environments |
| lego | Go | Single binary | Docker / CI |
| cert-manager | Go | Kubernetes native | Kubernetes |
| Caddy (built-in) | Go | Automatic TLS | Web server |
| Traefik (built-in) | Go | Automatic TLS | Reverse proxy |

---

## 6. mTLS (Mutual TLS)

### Difference Between Standard TLS and mTLS

```
Standard TLS (one-way authentication):
  Client ---- verifies server certificate ---> Server
  (client is not authenticated)
  Use case: general HTTPS

mTLS (mutual authentication):
  Client ---- verifies server certificate ---> Server
  Client <--- verifies client certificate --- Server
  (both parties are authenticated)
  Use case: microservice communication, zero trust, API authentication
```

### mTLS Handshake in Detail

```
Client                                    Server
  |                                          |
  |--- ClientHello ----------------------->  |
  |                                          |
  |  <--- ServerHello ---------------------  |
  |  <--- EncryptedExtensions -------------  |
  |  <--- CertificateRequest -------------  |  <- mTLS: requests client certificate
  |       (list of accepted CAs)             |
  |  <--- Certificate ---------------------  |
  |  <--- CertificateVerify --------------  |
  |  <--- Finished -----------------------  |
  |                                          |
  |--- Certificate ----------------------->  |  <- mTLS: presents client certificate
  |--- CertificateVerify ---------------->   |  <- mTLS: client signature
  |--- Finished ------------------------->   |
  |                                          |
  |========= Mutually Authenticated Encrypted Communication ======|
```

### mTLS Configuration Example (Nginx)

```nginx
# Code example 6: mTLS configuration in Nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    # Server certificate
    ssl_certificate     /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;

    # TLS protocol and cipher suite settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;

    # Client certificate verification
    ssl_client_certificate /etc/nginx/ssl/ca.crt;  # Trusted CA certificate
    ssl_verify_client on;       # Required (use "optional" for selective verification)
    ssl_verify_depth 2;         # Maximum chain depth

    # CRL (Certificate Revocation List) configuration
    ssl_crl /etc/nginx/ssl/ca.crl;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    location / {
        # Forward client certificate info to the backend
        proxy_set_header X-Client-DN $ssl_client_s_dn;
        proxy_set_header X-Client-Serial $ssl_client_serial;
        proxy_set_header X-Client-Verify $ssl_client_verify;
        proxy_set_header X-Client-Fingerprint $ssl_client_fingerprint;
        proxy_pass http://backend;
    }
}
```

### Generating Client Certificates and mTLS Client in Go

```go
// Code example 7: mTLS implementation in Go (server + client)
package main

import (
    "crypto/ecdsa"
    "crypto/elliptic"
    "crypto/rand"
    "crypto/tls"
    "crypto/x509"
    "crypto/x509/pkix"
    "encoding/pem"
    "fmt"
    "math/big"
    "net/http"
    "os"
    "time"
)

// ===== CA and Certificate Generation =====

func generateCA() (*x509.Certificate, *ecdsa.PrivateKey, error) {
    caKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)

    template := &x509.Certificate{
        SerialNumber: big.NewInt(1),
        Subject: pkix.Name{
            Organization: []string{"MyOrg Internal CA"},
            CommonName:   "MyOrg Root CA",
        },
        NotBefore:             time.Now(),
        NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour),
        KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
        BasicConstraintsValid: true,
        IsCA:                  true,
        MaxPathLen:            1,
    }

    certDER, _ := x509.CreateCertificate(
        rand.Reader, template, template, &caKey.PublicKey, caKey,
    )
    cert, _ := x509.ParseCertificate(certDER)
    return cert, caKey, nil
}

func generateClientCert(caCert *x509.Certificate, caKey *ecdsa.PrivateKey,
    commonName string) error {
    // Generate client key pair
    clientKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)

    // Certificate template
    template := &x509.Certificate{
        SerialNumber: big.NewInt(2),
        Subject: pkix.Name{
            Organization: []string{"MyOrg"},
            CommonName:   commonName,
        },
        NotBefore:             time.Now(),
        NotAfter:              time.Now().Add(365 * 24 * time.Hour),
        KeyUsage:              x509.KeyUsageDigitalSignature,
        ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
        BasicConstraintsValid: true,
    }

    // Sign with CA
    certDER, _ := x509.CreateCertificate(
        rand.Reader, template, caCert, &clientKey.PublicKey, caKey,
    )

    // Write PEM files
    certFile, _ := os.Create(commonName + ".crt")
    pem.Encode(certFile, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})
    certFile.Close()

    keyDER, _ := x509.MarshalECPrivateKey(clientKey)
    keyFile, _ := os.Create(commonName + ".key")
    pem.Encode(keyFile, &pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
    keyFile.Close()

    return nil
}

// ===== mTLS Server =====

func startMTLSServer(caCertPool *x509.CertPool) {
    tlsConfig := &tls.Config{
        ClientAuth: tls.RequireAndVerifyClientCert,
        ClientCAs:  caCertPool,
        MinVersion: tls.VersionTLS13,
    }

    server := &http.Server{
        Addr:      ":8443",
        TLSConfig: tlsConfig,
    }

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        // Retrieve client certificate information
        if len(r.TLS.PeerCertificates) > 0 {
            clientCert := r.TLS.PeerCertificates[0]
            fmt.Fprintf(w, "Hello, %s (verified by mTLS)\n",
                clientCert.Subject.CommonName)
        }
    })

    server.ListenAndServeTLS("server.crt", "server.key")
}

// ===== mTLS Client =====

func createMTLSClient(clientCert, clientKey, caCert string) (*http.Client, error) {
    cert, err := tls.LoadX509KeyPair(clientCert, clientKey)
    if err != nil {
        return nil, err
    }

    caCertPEM, _ := os.ReadFile(caCert)
    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCertPEM)

    tlsConfig := &tls.Config{
        Certificates: []tls.Certificate{cert},
        RootCAs:      caCertPool,
        MinVersion:   tls.VersionTLS13,
    }

    return &http.Client{
        Transport: &http.Transport{TLSClientConfig: tlsConfig},
        Timeout:   30 * time.Second,
    }, nil
}
```

### mTLS Client in Python

```python
# Code example 8: Python mTLS client
import httpx
import ssl

def create_mtls_client(
    client_cert: str,
    client_key: str,
    ca_cert: str,
) -> httpx.Client:
    """Create an HTTP client with mTLS support"""
    ssl_context = ssl.create_default_context(
        purpose=ssl.Purpose.SERVER_AUTH,
        cafile=ca_cert,
    )
    ssl_context.load_cert_chain(
        certfile=client_cert,
        keyfile=client_key,
    )
    ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2

    return httpx.Client(
        verify=ssl_context,
        timeout=30.0,
    )

# Usage example
client = create_mtls_client(
    client_cert="client.crt",
    client_key="client.key",
    ca_cert="ca.crt",
)
response = client.get("https://api.example.com/data")
print(response.json())
```

---

## 7. TLS Configuration Best Practices for Nginx / Apache

### Configuration Compliant with Mozilla SSL Configuration Generator

```nginx
# Code example 9: Nginx TLS configuration (Modern profile)
server {
    listen 443 ssl http2;
    server_name example.com;

    # Certificates
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Protocol (TLS 1.3 only — Modern)
    ssl_protocols TLSv1.3;
    # To also include TLS 1.2 (Intermediate):
    # ssl_protocols TLSv1.2 TLSv1.3;

    # Cipher suites
    # For TLS 1.3 only, ssl_ciphers is not needed (TLS 1.3 suites are fixed)
    # When including TLS 1.2:
    # ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;  # Recommended to let the client choose in TLS 1.3

    # DH parameters (when using TLS 1.2)
    # openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048
    # ssl_dhparam /etc/nginx/ssl/dhparam.pem;

    # Session cache
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;  # To fully guarantee PFS

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/chain.pem;
    resolver 1.1.1.1 8.8.8.8 valid=300s;

    # 0-RTT (TLS 1.3)
    ssl_early_data on;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    # HTTP → HTTPS redirect (in a separate server block)
}

server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

---

## 8. Automated Certificate Management and Monitoring

### Certificate Expiration Monitoring

```python
# Code example 10: Certificate expiration monitoring script
import ssl
import socket
import datetime
import json
from typing import Optional

class CertificateMonitor:
    """Monitors TLS certificate expiration"""

    def __init__(self, warning_days: int = 30, critical_days: int = 7):
        self.warning_days = warning_days
        self.critical_days = critical_days

    def check_certificate(self, hostname: str, port: int = 443) -> dict:
        """Fetch certificate info and check expiration"""
        context = ssl.create_default_context()
        try:
            with socket.create_connection((hostname, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()

            # Parse expiration date
            not_after = datetime.datetime.strptime(
                cert["notAfter"], "%b %d %H:%M:%S %Y %Z"
            )
            days_remaining = (not_after - datetime.datetime.utcnow()).days

            # Determine status
            if days_remaining < 0:
                status = "EXPIRED"
            elif days_remaining <= self.critical_days:
                status = "CRITICAL"
            elif days_remaining <= self.warning_days:
                status = "WARNING"
            else:
                status = "OK"

            # Retrieve SAN (Subject Alternative Name)
            san = []
            for entry_type, value in cert.get("subjectAltName", []):
                if entry_type == "DNS":
                    san.append(value)

            return {
                "hostname": hostname,
                "status": status,
                "days_remaining": days_remaining,
                "not_after": not_after.isoformat(),
                "issuer": dict(x[0] for x in cert["issuer"]),
                "subject": dict(x[0] for x in cert["subject"]),
                "san": san,
                "serial_number": cert.get("serialNumber"),
                "version": cert.get("version"),
            }

        except ssl.SSLCertVerificationError as e:
            return {"hostname": hostname, "status": "VERIFICATION_ERROR",
                    "error": str(e)}
        except (socket.timeout, ConnectionRefusedError) as e:
            return {"hostname": hostname, "status": "CONNECTION_ERROR",
                    "error": str(e)}

    def check_multiple(self, hostnames: list[str]) -> list[dict]:
        """Check certificates for multiple hosts in bulk"""
        results = []
        for hostname in hostnames:
            result = self.check_certificate(hostname)
            results.append(result)
            if result["status"] in ("CRITICAL", "EXPIRED"):
                print(f"[{result['status']}] {hostname}: "
                      f"{result.get('days_remaining', 'N/A')} days remaining")
        return results


# Usage example
monitor = CertificateMonitor(warning_days=30, critical_days=7)
domains = [
    "example.com",
    "api.example.com",
    "app.example.com",
]
results = monitor.check_multiple(domains)
print(json.dumps(results, indent=2, default=str))
```

### cert-manager in Kubernetes

```yaml
# Code example 11: Automated certificate management with cert-manager
# ClusterIssuer (Let's Encrypt)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-production
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-production-key
    solvers:
      - http01:
          ingress:
            class: nginx
      - dns01:
          cloudflare:
            email: admin@example.com
            apiTokenSecretRef:
              name: cloudflare-api-token
              key: api-token
        selector:
          dnsZones:
            - "example.com"

---
# Certificate resource
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: example-com-tls
  namespace: default
spec:
  secretName: example-com-tls-secret
  issuerRef:
    name: letsencrypt-production
    kind: ClusterIssuer
  dnsNames:
    - example.com
    - "*.example.com"
  duration: 2160h      # 90 days
  renewBefore: 720h    # Renew 30 days before expiry

---
# Usage in Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-production"
spec:
  tls:
    - hosts:
        - example.com
      secretName: example-com-tls-secret
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-service
                port:
                  number: 80
```

---

## 9. Edge Cases

### Edge Case 1: SNI (Server Name Indication) and Virtual Hosting

The SNI extension included in the ClientHello during the TLS handshake allows different certificates to be served for multiple domains on the same IP address. However, SNI is transmitted in plaintext, so the destination domain name is visible on the network. A proposal exists to encrypt this via Encrypted Client Hello (ECH) in TLS 1.3.

### Edge Case 2: Problems with Certificate Pinning

HPKP (HTTP Public Key Pinning) was a mechanism that pinned the public key hash of a certificate in the browser, but it carried a high risk of rendering a site unreachable due to operational mistakes and was deprecated in Chrome 72. Alternatives such as DANE/TLSA records (requires DNSSEC) and Certificate Transparency monitoring are now recommended.

### Edge Case 3: Wildcard Certificate and SAN Limitations

A wildcard certificate (*.example.com) covers only one level of subdomain. `sub.sub.example.com` is not covered. Also, the maximum number of domains that can be included in a SAN varies by CA (Let's Encrypt allows up to 100), so multiple certificates may be needed for a large number of domains.

### Edge Case 4: Impact of Clock Synchronization

Certificate validity period checks depend on the client's clock. On clients where NTP is not properly configured, a valid certificate may fail verification. This is especially likely to be a problem on IoT devices and embedded systems.

---

## 10. Anti-patterns

### Anti-pattern 1: Disabling Certificate Validation

```python
# BAD: Disabling certificate validation in production
import requests
response = requests.get("https://api.example.com", verify=False)
# WARNING: InsecureRequestWarning is raised but ignored

# GOOD: Specify the correct CA bundle
response = requests.get("https://api.example.com", verify="/path/to/ca-bundle.crt")

# GOOD: Specify CA bundle via environment variable
# export REQUESTS_CA_BUNDLE=/path/to/ca-bundle.crt
```

**Why it is dangerous**: It enables man-in-the-middle (MITM) attacks, creating a risk of eavesdropping and tampering with communications. Even in development environments, a self-signed CA should be created and validation done correctly. `verify=False` is a critical issue automatically detected by security scanners.

### Anti-pattern 2: Allowing Old TLS Versions

```nginx
# BAD: Allowing TLS 1.0/1.1
ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;

# GOOD: Allow TLS 1.2 or higher only
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;
```

**Why it is dangerous**: TLS 1.0/1.1 have known vulnerabilities (BEAST, POODLE, Lucky13) and their use is prohibited under PCI DSS. In 2020, major browsers ended support for TLS 1.0/1.1.

### Anti-pattern 3: Hardcoding Private Keys

```python
# BAD: Embedding a private key in source code
PRIVATE_KEY = """-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBkg4LVWM...
-----END EC PRIVATE KEY-----"""

# GOOD: Retrieve from an environment variable or secrets manager
import os
key_path = os.environ["TLS_KEY_PATH"]
with open(key_path) as f:
    private_key = f.read()

# GOOD: Retrieve from AWS Secrets Manager / HashiCorp Vault
import boto3
client = boto3.client("secretsmanager")
secret = client.get_secret_value(SecretId="tls/server-key")
```

### Anti-pattern 4: Manual Certificate Renewal Operations

```
BAD: Renewing certificates manually and tracking on a calendar
  → Service outages caused by missed renewals
  → 2020: Microsoft Teams was down for several hours due to an expired certificate

GOOD: Automated renewal with cert-manager, certbot, Caddy, etc.
  → Monitor certificate expiration with Prometheus/Grafana
  → Alert 30 days before expiry, critical alert 7 days before
```

---

## 11. Exercises

### Exercise 1 (Basic): Inspecting a TLS Connection

Run the following commands and observe the details of the TLS connection:

```bash
# 1. Check the TLS version and cipher suite for any site
openssl s_client -connect google.com:443 -tls1_3

# 2. Check the issuers in the certificate chain
openssl s_client -connect github.com:443 -showcerts 2>/dev/null | \
  grep -E "subject|issuer"

# Questions:
# - What cipher suite is used with TLS 1.3?
# - How many levels does the certificate chain have?
# - What is the Root CA?
```

### Exercise 2 (Intermediate): Creating a Self-signed CA and Certificate

Using OpenSSL, create the following:
1. Root CA key pair and self-signed certificate
2. Intermediate CA key pair and certificate signed by the Root CA
3. Server certificate (with SAN)
4. Verify the certificate chain

### Exercise 3 (Advanced): mTLS for Service-to-Service Communication

Implement the following in Go or Python:
1. Build an internal CA
2. Automatically generate server and client certificates
3. An HTTP server protected with mTLS
4. API calls from an mTLS client
5. Revocation checking of client certificates

---

## 12. Performance Considerations

### TLS Handshake Latency

| Configuration | Latency (approximate) | Optimization Method |
|------|-----------------|-----------|
| TLS 1.2 full handshake | ~100ms | - |
| TLS 1.3 full handshake | ~50ms | 1-RTT |
| TLS 1.3 0-RTT | ~0ms | PSK reuse |
| TLS session resumption (1.2) | ~50ms | Session ticket |
| ECDSA signature verification | ~0.1ms | Faster than RSA |
| RSA 2048 signature verification | ~0.3ms | - |
| OCSP Stapling | Saves ~50ms | No CA query needed |

### Encryption Algorithm Throughput Comparison

```
Encryption throughput (Intel Xeon, single core):

  AES-256-GCM:           ~5 GB/s  (AES-NI hardware)
  AES-128-GCM:           ~6 GB/s
  ChaCha20-Poly1305:     ~2 GB/s  (software)
  ChaCha20-Poly1305:     ~4 GB/s  (AVX2)
  AES-256-CBC:           ~1 GB/s  (deprecated)

  Key exchange:
  ECDHE (x25519):        ~50,000 ops/sec
  ECDHE (P-256):         ~30,000 ops/sec
  RSA-2048 key exchange: ~15,000 ops/sec

  → On x86 servers with AES-NI, AES-GCM is fastest
  → On ARM (mobile / Raspberry Pi), ChaCha20 is faster
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for a basic implementation pattern"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
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
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

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
    print("All advanced tests passed!")

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
    print(f"Speedup:             {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## 13. FAQ

### Q1. Is 0-RTT in TLS 1.3 safe?

0-RTT (Early Data) reduces latency on reconnection but carries a risk of replay attacks. It should not be used for non-idempotent operations (such as POST requests that mutate state). In Nginx, enable it with `ssl_early_data on;` and protect the backend by checking the `Early-Data: 1` header. Google uses 0-RTT for search queries (idempotent GET requests).

### Q2. What is an appropriate certificate validity period?

Per CA/Browser Forum regulations, the maximum validity period for public certificates is 398 days (approximately 13 months). Let's Encrypt issues certificates with a 90-day lifetime, designed with automatic renewal in mind. Shorter validity periods reduce the risk of key compromise. Apple has proposed shortening the period to 45 days starting in 2025.

### Q3. When is it acceptable to use a self-signed certificate?

Use should be limited to development environments, mTLS between internal microservices, and test environments. For public-facing services, always use a certificate from a trusted CA. Even with self-signed certificates, it is good practice to create a CA and properly configure the chain.

### Q4. Should I choose ECC (Elliptic Curve Cryptography) or RSA?

For new deployments, ECC (P-256 or Ed25519) is recommended. ECC 256 achieves the same security level as RSA 2048 with significantly smaller key and signature sizes. RSA has high compatibility but ECC will be the mainstream choice going forward. Let's Encrypt issues ECC certificates by default.

### Q5. Where should TLS be terminated?

The common pattern is to terminate TLS at a load balancer or reverse proxy and communicate with the backend over HTTP. However, in a zero-trust environment, encryption should be maintained all the way to the backend using mTLS. Service meshes (Istio, Linkerd) can transparently introduce mTLS.

---


## FAQ

### Q1: What is the most important point when studying this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## Summary

| Item | Key Point |
|------|------|
| TLS version | TLS 1.3 recommended, TLS 1.2 at minimum |
| Handshake | TLS 1.3 completes in 1-RTT and mandates forward secrecy |
| Cipher suites | AES-GCM / ChaCha20-Poly1305 + ECDHE |
| Certificate chain | Chain of trust: Root CA → Intermediate CA → Server certificate |
| Revocation checking | OCSP Stapling recommended, monitor with CT logs |
| Let's Encrypt | Automate certificate issuance and renewal via the ACME protocol |
| mTLS | Achieve zero trust with mutual authentication via client certificates |
| Certificate management | Automatic renewal required; protect private keys with a secrets manager |
| Monitoring | Continuously monitor certificate expiration to prevent outages |
| 0-RTT | Reduces latency but carries replay risk; use only for idempotent operations |

---

## What to Read Next

- [Key Management](./02-key-management.md) — Cryptographic key lifecycle and secure storage
- [Network Security Basics](../03-network-security/00-network-security-basics.md) — Defense in depth with firewalls and IDS/IPS
- [API Security](../03-network-security/02-api-security.md) — API protection built on top of TLS
- [DNS Security](../03-network-security/01-dns-security.md) — DNS-based certificate validation with DANE/TLSA

---

## References

1. **RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3** (2018) — https://datatracker.ietf.org/doc/html/rfc8446
2. **RFC 8555 — Automatic Certificate Management Environment (ACME)** — https://datatracker.ietf.org/doc/html/rfc8555
3. **Mozilla SSL Configuration Generator** — https://ssl-config.mozilla.org/ — Recommended TLS configuration by server software
4. **Let's Encrypt Documentation** — https://letsencrypt.org/docs/ — Official guide to ACME protocol and certificate automation
5. **Qualys SSL Labs — SSL/TLS Best Practices** — https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices
6. **RFC 6960 — X.509 Internet PKI Online Certificate Status Protocol - OCSP** — https://datatracker.ietf.org/doc/html/rfc6960
7. **Certificate Transparency (RFC 6962)** — https://certificate.transparency.dev/
8. **cert-manager Documentation** — https://cert-manager.io/docs/
