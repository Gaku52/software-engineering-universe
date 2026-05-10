# DNS Security

> A systematic study of threats against DNS and defense techniques, including integrity guarantees via DNSSEC, privacy protection through DNS over HTTPS, and poisoning countermeasures

## What You Will Learn in This Chapter

1. **DNS Threat Model** — Key attack methods including cache poisoning, DNS spoofing, and DNS tunneling
2. **How DNSSEC Works** — A mechanism for detecting DNS response tampering through digital signatures
3. **Encrypted DNS** — Concealing queries via DNS over HTTPS (DoH) / DNS over TLS (DoT)

### Prerequisites

- Basics of TCP/IP networking (IP addresses, ports, differences between UDP and TCP)
- Basic DNS operation (recursive queries, authoritative servers, caching resolvers)
- Concepts of public-key cryptography (digital signatures, hash functions)

### Related Guides

- [Network Security Basics](./00-network-security-basics.md) — Fundamentals of firewalls and IDS/IPS
- [TLS/Certificates](../02-cryptography/01-tls-certificates.md) — Details of TLS, the foundation of DoH/DoT
- [API Security](./02-api-security.md) — Protecting communications at the application layer
- [Monitoring/Logging](../06-operations/01-monitoring-logging.md) — Integrated monitoring including DNS logs

---

## 1. DNS Fundamentals and Internal Operation

### Complete Flow of DNS Name Resolution

```
When a user accesses www.example.com:

Browser                    Stub Resolver            Recursive Resolver
  |                            |                         |
  |-- www.example.com? ------> |                         |
  |                            |-- www.example.com? ---> |
  |                            |                         |
  |                            |                    Root NS (.):
  |                            |                    "Ask ns1.com for .com"
  |                            |                         |
  |                            |                    .com NS:
  |                            |                    "Ask ns1.example.com
  |                            |                     for example.com"
  |                            |                         |
  |                            |                    example.com NS:
  |                            |                    "www.example.com = 93.184.216.34"
  |                            |                         |
  |                            | <-- 93.184.216.34 ----- |
  |                            |     (Stored in cache     |
  |                            |      TTL=3600s)          |
  | <-- 93.184.216.34 ---------|                         |
```

### DNS Record Types and Their Security Implications

| Record | Purpose | Security Implication |
|--------|---------|----------------------|
| A / AAAA | Domain → IP resolution | Direct target of poisoning |
| NS | Delegation to authoritative server | NS hijacking allows control of entire zone |
| MX | Mail delivery destination | Spoofing delivery destination for phishing emails |
| TXT | Arbitrary text | SPF/DKIM/DMARC; abused for DNS tunneling |
| CNAME | Alias | Dangling CNAME (subdomain takeover) |
| SRV | Service discovery | Can be abused to enumerate internal services |
| CAA | Certificate issuance control | Prevents unauthorized CAs from issuing certificates |
| DNSKEY | DNSSEC public key | Key compromise allows bypassing DNSSEC |
| DS | Delegation signer | Connection point of the chain of trust |
| RRSIG | Record signature | DNSSEC integrity guarantee |
| NSEC/NSEC3 | Proof of non-existence | Zone walking prevention (NSEC3) |
| TLSA | DANE (TLS authentication) | DNS-based certificate pinning |

---

## 2. DNS Threats

### Classification of Attacks Targeting DNS

```
+-----------------------------------------------------------+
|                    Threats Against DNS                      |
|-----------------------------------------------------------|
|                                                           |
|  [Tampering]                                               |
|  +-- Cache Poisoning: Inject forged responses into cache   |
|  +-- DNS Spoofing: Redirect to a fake DNS server           |
|  +-- Via BGP Hijacking: Hijack routing to spoof DNS        |
|  +-- DNS Rebinding: Manipulate TTL to access internal nets |
|                                                           |
|  [Eavesdropping]                                           |
|  +-- DNS Query Interception: Learn destinations from       |
|  |   plaintext queries                                     |
|  +-- Passive DNS Collection: Analyze org communication     |
|  |   patterns                                              |
|  +-- Wi-Fi Honeypot: Collect DNS queries via rogue AP      |
|                                                           |
|  [Abuse]                                                   |
|  +-- DNS Tunneling: Embed data in DNS queries to exfiltrate|
|  +-- DDoS (DNS Amplification): Use as relay for amplified  |
|  |   attacks                                               |
|  +-- Domain Hijacking: Take over registrar accounts        |
|  +-- Subdomain Takeover: Abuse unused CNAMEs               |
|  +-- Fast Flux: Hide C2 of botnets using DNS               |
+-----------------------------------------------------------+
```

### How Cache Poisoning Works (Kaminsky Attack)

```
Normal DNS resolution:
  Client --> Resolver --> Authoritative NS
  Client <-- Resolver <-- Legitimate response (1.2.3.4)

Cache poisoning:
  Client --> Resolver --> Authoritative NS
                 ^
                 |  Attacker sends a forged response before the legitimate one
                 +-- Attacker: "example.com = 6.6.6.6"

  Client <-- Resolver <-- Forged response (6.6.6.6) is cached
  (All clients are directed to the fake IP for the TTL duration)

Kaminsky Attack (2008) details:
  1. Attacker queries a random subdomain like rand12345.example.com
  2. Resolver queries the authoritative server for example.com
  3. Attacker sends a large number of forged responses (brute-force of Transaction ID)
     The forged response's Additional Section contains:
     "The NS for example.com is attacker-ns.evil.com"
  4. If the Transaction ID matches, the attacker hijacks the entire authoritative server

  Countermeasures:
  +-- Source port randomization (additional entropy of 2^16)
  +-- 0x20 encoding (randomizing upper/lower case)
  +-- DNSSEC (cryptographic verification of responses)
```

### DNS Rebinding Attack

```
How DNS Rebinding works:

1. Attacker owns evil.com and configures their own DNS server
2. Victim accesses evil.com
3. Attacker's DNS server initially returns a legitimate IP (TTL=0)
   evil.com → 1.2.3.4 (attacker's server)
4. Browser downloads and executes JavaScript
5. JavaScript makes another request to evil.com
6. This time, attacker's DNS server returns an internal IP
   evil.com → 192.168.1.1 (victim's router)
7. Browser's Same-Origin Policy is satisfied since origin is evil.com
8. JavaScript accesses resources on the internal network

Countermeasures:
+-- Filter RFC1918 address responses at the DNS resolver
+-- Browser DNS pinning
+-- Host header validation on internal services
```

### Subdomain Takeover

```python
# Code example 1: Subdomain takeover detection script
import dns.resolver
import requests

KNOWN_FINGERPRINTS = {
    "github.io": "There isn't a GitHub Pages site here",
    "herokuapp.com": "No such app",
    "s3.amazonaws.com": "NoSuchBucket",
    "azurewebsites.net": "404 Web Site not found",
    "cloudfront.net": "Bad Request: ERROR: The request could not be satisfied",
    "netlify.app": "Not Found - Request ID:",
}

def check_subdomain_takeover(domain: str) -> dict:
    """Check for subdomain takeover vulnerabilities"""
    result = {"domain": domain, "vulnerable": False, "details": ""}

    try:
        # Retrieve CNAME record
        answers = dns.resolver.resolve(domain, "CNAME")
        for rdata in answers:
            cname_target = str(rdata.target).rstrip(".")
            result["cname"] = cname_target

            # Check known service fingerprints
            for service, fingerprint in KNOWN_FINGERPRINTS.items():
                if service in cname_target:
                    try:
                        resp = requests.get(
                            f"http://{domain}",
                            timeout=10,
                            allow_redirects=True
                        )
                        if fingerprint in resp.text:
                            result["vulnerable"] = True
                            result["details"] = (
                                f"CNAME points to {cname_target} "
                                f"but the resource does not exist"
                            )
                    except requests.RequestException:
                        result["details"] = f"CNAME target unreachable: {cname_target}"

    except dns.resolver.NXDOMAIN:
        result["details"] = "Domain does not exist"
    except dns.resolver.NoAnswer:
        result["details"] = "No CNAME record"
    except Exception as e:
        result["details"] = str(e)

    return result

# Usage example
subdomains = ["blog.example.com", "staging.example.com", "old.example.com"]
for sub in subdomains:
    result = check_subdomain_takeover(sub)
    if result["vulnerable"]:
        print(f"[VULNERABLE] {result['domain']}: {result['details']}")
```

### DNS Amplification Attack Mechanism and Mitigation

```
DNS Amplification/Reflection Attack:

  Attacker                    Open Resolver               Victim
     |                            |                         |
     |-- Spoofed packet ------->  |                         |
     |   Src IP: Victim IP        |                         |
     |   Query: ANY example.com   |                         |
     |   (60 bytes)               |                         |
     |                            |                         |
     |                            |-- Response (large) ---> |
     |                            |   All ANY records        |
     |                            |   (~3000 bytes)          |
     |                            |   Amplification: ~50x    |

  Attack characteristics:
  - Source IP spoofing (from networks without BCP38/BCP84)
  - ANY queries extract the largest responses
  - Thousands of open resolvers used to achieve large-scale DDoS

  Mitigations:
  +-- Restrict resolver access (allow-recursion)
  +-- Response Rate Limiting (RRL)
  +-- BCP38 (source address validation)
  +-- Limit ANY query responses (RFC 8482)
```

---

## 3. DNSSEC

### Overview of DNSSEC

DNSSEC (Domain Name System Security Extensions) is an extension specification that cryptographically guarantees the authenticity and integrity of DNS responses. Defined in RFC 4033-4035, it operates by adding digital signatures to the existing DNS protocol.

**Important**: DNSSEC is a mechanism for detecting response tampering — it does not provide encryption (confidentiality). DNS query contents remain in plaintext. DoH/DoT is required for encryption.

### DNSSEC Chain of Trust

```
Root Zone (.)
  +-- KSK (Key Signing Key): Signs the ZSK
  +-- ZSK (Zone Signing Key): Signs records
  +-- DS record: Hash of the child zone's KSK
       |
       v
TLD (.com)
  +-- KSK / ZSK
  +-- DS record (hash of example.com's KSK)
       |
       v
Zone (example.com)
  +-- KSK / ZSK
  +-- RRSIG: Digital signature for each record
  +-- NSEC/NSEC3: Proof of non-existence
```

### Detailed Explanation of DNSSEC Record Types

```
+------------------------------------------------------------------+
|  DNSSEC-Related Records                                            |
|------------------------------------------------------------------|
|                                                                    |
|  DNSKEY (DNS Public Key)                                           |
|    KSK (flags=257): Key-signing key. Target of the DS record hash |
|    ZSK (flags=256): Zone-signing key. Actually signs records      |
|    Algorithm: ECDSAP256SHA256 (recommended), RSA/SHA-256          |
|                                                                    |
|  RRSIG (Resource Record Signature)                                 |
|    Digital signature for each RRset                               |
|    Includes: algorithm, signature validity period, signer name,   |
|    signature value                                                 |
|                                                                    |
|  DS (Delegation Signer)                                            |
|    Hash value of the child zone's KSK                             |
|    Placed in the parent zone to form the chain of trust           |
|    Hash algorithm: SHA-256 (recommended)                          |
|                                                                    |
|  NSEC / NSEC3 (Next Secure)                                        |
|    NSEC: Points to the next domain name → enables zone walking    |
|    NSEC3: Hashed domain names → makes zone walking harder         |
|    NSEC3PARAM: NSEC3 parameters (hash iterations, salt)           |
+------------------------------------------------------------------+
```

### DNSSEC Validation Process

```
Resolver validates the A record for example.com:

1. Retrieve example.com's A record + RRSIG
2. Verify RRSIG using example.com's DNSKEY (ZSK)
3. Verify ZSK's RRSIG using example.com's DNSKEY (KSK)
4. Verify example.com's KSK using .com's DS record
5. Verify DS RRSIG using .com's DNSKEY
6. Verify .com's KSK using Root's DS record
7. Root's KSK is held in advance as a trust anchor

→ If the entire chain is verified: "Authenticated Data (AD)"

On validation failure:
  Returns SERVFAIL (for validating resolvers)
  → Spoofed responses never reach the client
```

### DNSSEC Configuration (BIND)

```bash
# Code example 2: DNSSEC configuration in BIND

# ===== Key Generation =====

# Generate Zone Signing Key (ZSK)
# ECDSAP256SHA256 is recommended (smaller key size and faster than RSA)
dnssec-keygen -a ECDSAP256SHA256 -n ZONE example.com
# Output: Kexample.com.+013+12345 (.key and .private)

# Generate Key Signing Key (KSK)
dnssec-keygen -a ECDSAP256SHA256 -n ZONE -f KSK example.com
# Output: Kexample.com.+013+67890 (.key and .private)

# ===== Zone File Signing =====

# Sign zone using NSEC3
dnssec-signzone -A -3 $(head -c 1000 /dev/urandom | sha1sum | cut -b 1-16) \
  -N INCREMENT -o example.com -t db.example.com

# Output: db.example.com.signed

# ===== BIND configuration (named.conf) =====
# Enable DNSSEC validation (resolver side)
options {
    dnssec-validation auto;  # Automatic trust anchor update (RFC 5011)
    # dnssec-validation yes; # If managing trust anchors manually
};

# DNSSEC configuration for authoritative server
zone "example.com" {
    type primary;
    file "/etc/bind/zones/db.example.com.signed";
    key-directory "/etc/bind/keys";

    # Automatic signing (inline-signing)
    inline-signing yes;
    auto-dnssec maintain;

    # NSEC3 parameter configuration
    # rndc signing -nsec3param 1 0 10 auto example.com
};

# ===== Key Rollover =====
# ZSK rollover (recommended: every 90 days)
# 1. Pre-publish the new ZSK
# 2. After TTL expires, sign with the new ZSK
# 3. Remove the old ZSK

# KSK rollover (recommended: every 1-2 years)
# 1. Generate and publish new KSK
# 2. Register new DS record with parent zone
# 3. Sign new KSK with old KSK
# 4. Remove old DS record
# 5. Remove old KSK
```

### DNSSEC Validation with dig

```bash
# Code example 3: DNSSEC validation command collection

# Query with DNSSEC information
dig +dnssec example.com A

# Check validation result (if 'ad' appears in flags, validation succeeded)
# ;; flags: qr rd ra ad; QUERY: 1, ANSWER: 2
# ad = Authenticated Data (DNSSEC validation succeeded)

# Check DNSKEY records
dig example.com DNSKEY +short
# 257 3 13 oJMRESz5E4gYzS/... (KSK, flags=257)
# 256 3 13 2Nwz6FfpJlWey/... (ZSK, flags=256)

# Check DS records
dig example.com DS +short
# 67890 13 2 ABC123DEF456...

# Check RRSIG (including signature validity period)
dig example.com A +dnssec +multi
# example.com. 3600 IN RRSIG A 13 2 3600 (
#     20260301000000 20260201000000 12345 example.com.
#     base64signature... )

# Check NSEC3 proof of non-existence
dig nonexistent.example.com A +dnssec
# NSEC3 record is returned, proving the domain does not exist

# Full chain of trust validation
dig +sigchase +trusted-key=./root.keys example.com A

# Validation with the delv command (BIND 9.10+)
delv @8.8.8.8 example.com A +rtrace
# ;; validating example.com/A: verify rdataset (keyid: 12345)
# ;; fully validated

# Examples of DNSSEC-enabled domains
dig +dnssec cloudflare.com A   # Cloudflare
dig +dnssec nic.cz A           # CZ NIC
dig +dnssec isc.org A          # ISC (BIND developers)
```

### Comparison of DNSSEC Algorithms and Key Lengths

| Algorithm | ID | Key Length | Signature Length | Recommendation | Notes |
|-----------|-----|-----------|-----------------|----------------|-------|
| RSA/SHA-256 | 8 | 2048bit | 256byte | Acceptable | Large response size |
| RSA/SHA-512 | 10 | 2048bit | 256byte | Acceptable | Limited benefit of SHA-512 |
| ECDSAP256SHA256 | 13 | 256bit | 64byte | Recommended | Small key/signature, fast |
| ECDSAP384SHA384 | 14 | 384bit | 96byte | Acceptable | For high-security use |
| Ed25519 | 15 | 256bit | 64byte | Recommended | Fastest, gradually being adopted |
| Ed448 | 16 | 456bit | 114byte | Acceptable | Highest security |

---

## 4. Encrypted DNS

### Comparison of DoH / DoT / DoQ

| Item | Plaintext DNS | DoT | DoH | DoQ |
|------|--------------|-----|-----|-----|
| Protocol | UDP/53 | TLS/853 | HTTPS/443 | QUIC/853 |
| Encryption | None | TLS | TLS | QUIC |
| Authentication | None | Server certificate | Server certificate | Server certificate |
| Block detection | Easy | Identifiable by port 853 | Hard to distinguish from regular HTTPS | Identifiable by port 853 |
| Latency | Low | TLS handshake overhead | HTTP/2 connection overhead | 0-RTT possible |
| Standardization | RFC 1035 | RFC 7858 | RFC 8484 | RFC 9250 |
| Padding | None | RFC 7830 | HTTP/2 frames | QUIC frames |
| Multiplexing | None | None | HTTP/2 streams | QUIC streams |
| Head-of-line blocking | N/A | Yes | Yes | No |

### DoH Internal Protocol

```
DoH request format (RFC 8484):

GET method:
  GET /dns-query?dns=AAABAAABAAAAAAAAA3d3dwdleGFtcGxlA2NvbQAAAQAB
  Accept: application/dns-message

  dns parameter: Base64url encoding of DNS wire format

POST method:
  POST /dns-query
  Content-Type: application/dns-message
  Body: [DNS wire format binary]

Response:
  HTTP/2 200 OK
  Content-Type: application/dns-message
  Body: [DNS response binary]

JSON API method (Google/Cloudflare proprietary extension):
  GET https://dns.google/resolve?name=example.com&type=A
  Response:
  {
    "Status": 0,
    "TC": false,
    "RD": true,
    "RA": true,
    "AD": true,    // DNSSEC validation succeeded
    "CD": false,
    "Question": [{"name": "example.com", "type": 1}],
    "Answer": [
      {"name": "example.com", "type": 1, "TTL": 300,
       "data": "93.184.216.34"}
    ]
  }
```

### Configuring DNS over HTTPS

```bash
# Code example 4: Various DoH/DoT configurations

# ===== Using DoH via dnscrypt-proxy =====
# /etc/dnscrypt-proxy/dnscrypt-proxy.toml
listen_addresses = ['127.0.0.1:53']
server_names = ['cloudflare', 'google']
ipv6_servers = false

# Security settings
require_dnssec = true          # Require DNSSEC validation
require_nofilter = true        # No filtering
require_nolog = true           # Only servers with no-logging policy

[sources]
  [sources.public-resolvers]
  urls = ['https://raw.githubusercontent.com/DNSCrypt/dnscrypt-resolvers/master/v3/public-resolvers.md']
  cache_file = 'public-resolvers.md'
  minisign_key = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3'

# ===== Enable DoT with systemd-resolved =====
# /etc/systemd/resolved.conf
[Resolve]
DNS=1.1.1.1#cloudflare-dns.com 1.0.0.1#cloudflare-dns.com
FallbackDNS=8.8.8.8#dns.google 8.8.4.4#dns.google
DNSOverTLS=yes
DNSSEC=yes

# Apply settings
# sudo systemctl restart systemd-resolved
# Check with: resolvectl status

# ===== Configure DoT with Unbound =====
# /etc/unbound/unbound.conf
server:
    interface: 127.0.0.1
    interface: ::1
    tls-cert-bundle: /etc/ssl/certs/ca-certificates.crt

    # DNSSEC validation
    auto-trust-anchor-file: "/var/lib/unbound/root.key"
    val-clean-additional: yes

forward-zone:
    name: "."
    forward-tls-upstream: yes
    # Cloudflare DNS over TLS
    forward-addr: 1.1.1.1@853#cloudflare-dns.com
    forward-addr: 1.0.0.1@853#cloudflare-dns.com
    # Google DNS over TLS
    forward-addr: 8.8.8.8@853#dns.google
    forward-addr: 8.8.4.4@853#dns.google
```

### DoH Client in Go

```go
// Code example 5: Complete DoH client implementation (Go)
package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/miekg/dns"
)

// DoHClient is a DNS over HTTPS client
type DoHClient struct {
	httpClient *http.Client
	serverURL  string
}

// NewDoHClient creates a new DoH client
func NewDoHClient(serverURL string) *DoHClient {
	return &DoHClient{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					MinVersion: tls.VersionTLS13,
				},
				MaxIdleConns:        100,
				IdleConnTimeout:     90 * time.Second,
				TLSHandshakeTimeout: 10 * time.Second,
			},
		},
		serverURL: serverURL,
	}
}

// Query executes a DNS query via DoH
func (c *DoHClient) Query(domain string, qtype uint16) (*dns.Msg, error) {
	// Build DNS message
	msg := new(dns.Msg)
	msg.SetQuestion(dns.Fqdn(domain), qtype)
	msg.RecursionDesired = true

	// EDNS0 padding (RFC 7830)
	opt := &dns.OPT{
		Hdr: dns.RR_Header{Name: ".", Rrtype: dns.TypeOPT},
		Option: []dns.EDNS0{
			&dns.EDNS0_PADDING{Padding: make([]byte, 128)},
		},
	}
	opt.SetUDPSize(4096)
	opt.SetDo(true) // DNSSEC OK flag
	msg.Extra = append(msg.Extra, opt)

	// Encode to wire format
	packed, err := msg.Pack()
	if err != nil {
		return nil, fmt.Errorf("failed to pack DNS message: %w", err)
	}

	// DoH POST request
	req, err := http.NewRequest(
		"POST",
		c.serverURL,
		bytes.NewReader(packed),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/dns-message")
	req.Header.Set("Accept", "application/dns-message")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("DoH request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DoH server returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	response := new(dns.Msg)
	if err := response.Unpack(body); err != nil {
		return nil, fmt.Errorf("failed to unpack DNS response: %w", err)
	}

	return response, nil
}

// QueryWithDNSSECValidation performs a query with DNSSEC validation
func (c *DoHClient) QueryWithDNSSECValidation(domain string) ([]net.IP, bool, error) {
	resp, err := c.Query(domain, dns.TypeA)
	if err != nil {
		return nil, false, err
	}

	var ips []net.IP
	authenticated := resp.AuthenticatedData // AD flag

	for _, answer := range resp.Answer {
		if a, ok := answer.(*dns.A); ok {
			ips = append(ips, a.A)
		}
	}

	return ips, authenticated, nil
}

func main() {
	client := NewDoHClient("https://cloudflare-dns.com/dns-query")

	ips, dnssecValid, err := client.QueryWithDNSSECValidation("cloudflare.com")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	fmt.Printf("IPs: %v\n", ips)
	fmt.Printf("DNSSEC validated: %v\n", dnssecValid)
}
```

### DoH Client in Python

```python
# Code example 6: Python DoH client
import dns.message
import dns.query
import dns.rdatatype
import httpx
import base64

class DoHResolver:
    """DNS over HTTPS Resolver"""

    def __init__(self, server_url: str = "https://cloudflare-dns.com/dns-query"):
        self.server_url = server_url
        self.client = httpx.Client(
            http2=True,
            timeout=10.0,
            headers={"Accept": "application/dns-message"}
        )

    def resolve(self, domain: str, rdtype: str = "A") -> list:
        """Resolve a domain via DoH"""
        # Build DNS query message
        query = dns.message.make_query(domain, rdtype, want_dnssec=True)
        wire = query.to_wire()

        # POST request
        response = self.client.post(
            self.server_url,
            content=wire,
            headers={"Content-Type": "application/dns-message"}
        )
        response.raise_for_status()

        # Parse response
        dns_response = dns.message.from_wire(response.content)

        results = []
        for rrset in dns_response.answer:
            for rdata in rrset:
                results.append({
                    "name": str(rrset.name),
                    "type": dns.rdatatype.to_text(rrset.rdtype),
                    "ttl": rrset.ttl,
                    "data": str(rdata),
                })

        return {
            "answers": results,
            "dnssec_validated": bool(dns_response.flags & dns.flags.AD),
            "rcode": dns.rcode.to_text(dns_response.rcode()),
        }

    def close(self):
        self.client.close()


# Usage example
resolver = DoHResolver()
result = resolver.resolve("example.com", "A")
print(f"Answers: {result['answers']}")
print(f"DNSSEC: {result['dnssec_validated']}")
resolver.close()
```

---

## 5. DNS Poisoning Countermeasures

### Multi-Layered Defense

```
+----------------------------------------------+
|        DNS Poisoning Countermeasures           |
|----------------------------------------------|
|                                              |
|  [Protocol Layer]                             |
|  +-- DNSSEC: Detect tampering of responses   |
|  +-- DoH/DoT: Prevent eavesdropping/tampering|
|  +-- DANE/TLSA: Validate TLS certs via DNS   |
|                                              |
|  [Resolver Layer]                             |
|  +-- Source port randomization               |
|  +-- Query ID randomization (16-bit)         |
|  +-- 0x20 encoding (mixed case)              |
|  +-- Fallback to TCP                         |
|  +-- Minimum TTL setting for cache           |
|                                              |
|  [Network Layer]                              |
|  +-- BCP38 (source address validation)       |
|  +-- ACL to restrict resolver access         |
|  +-- Detect anomalous DNS traffic            |
|                                              |
|  [Operations Layer]                           |
|  +-- Set appropriate TTL values              |
|  +-- Monitor DNS logs                        |
|  +-- Block via RPZ (Response Policy Zone)    |
|  +-- Configure CAA records                   |
+----------------------------------------------+
```

### 0x20 Encoding

```
0x20 Encoding (DNS 0x20 bit encoding):

Normal query:
  Query: www.example.com

With 0x20 encoding applied:
  Query: wWw.ExAmPlE.cOm  (randomly mix upper and lower case)

Since DNS is case-insensitive, a legitimate server responds
with the same upper/lower case pattern as the request.

An attacker must correctly guess the case pattern,
dramatically increasing the difficulty of brute-forcing.

Additional entropy: domain name length × 1 bit
Example: www.example.com (15 characters) → 2^15 = 32,768 possibilities

Transaction ID (16-bit) + Source Port (16-bit) + 0x20 (15-bit)
= 2^47 ≈ 140 trillion possibilities → brute-force is practically impossible
```

### Configuring RPZ (Response Policy Zone)

```bash
# Code example 7: RPZ configuration in BIND

# /etc/bind/named.conf
options {
    response-policy {
        zone "rpz.local" policy given;
        zone "rpz.spamhaus" policy given;
    };
};

zone "rpz.local" {
    type primary;
    file "/etc/bind/db.rpz.local";
    allow-query { none; };
};

# RPZ zone file (/etc/bind/db.rpz.local)
$TTL 300
@ IN SOA localhost. admin.localhost. ( 1 3600 900 604800 300 )
@ IN NS localhost.

; ===== Block malware domains =====
; Return NXDOMAIN (most secure)
malware.example.com   CNAME .
*.malware.example.com CNAME .

; ===== Redirect phishing sites to block page =====
phishing.example.com  A     10.0.0.100
*.phishing.example.com A    10.0.0.100

; ===== Block access to specific IP addresses =====
; Block C2 server IPs
32.1.168.192.rpz-ip     CNAME .

; ===== Bulk blocking with wildcards =====
; Countermeasure against DGA (Domain Generation Algorithm)
*.dga-pattern.com  CNAME .

; ===== Passthrough (block exceptions) =====
; Exceptions to RPZ rules
safe.malware.example.com CNAME rpz-passthru.
```

### Controlling Certificate Issuance with CAA Records

```bash
# Code example 8: Configuring CAA records

# CAA (Certificate Authority Authorization) record
# Only the specified CA can issue certificates for the domain

# Allow only Let's Encrypt
example.com.  CAA 0 issue "letsencrypt.org"

# Only DigiCert for wildcard certificates
example.com.  CAA 0 issuewild "digicert.com"

# Email address to report certificate issuance issues
example.com.  CAA 0 iodef "mailto:security@example.com"

# Verify configuration
dig example.com CAA +short
# 0 issue "letsencrypt.org"
# 0 issuewild "digicert.com"
# 0 iodef "mailto:security@example.com"
```

---

## 6. Detecting DNS Tunneling

### How DNS Tunneling Works

```
Principles of DNS Tunneling:

  Internal Network (behind firewall)       Attacker's DNS Server
       Client (malware)                    ns1.evil.com
         |                                       |
         |  Encodes data in Base32/Hex           |
         |  and embeds it in subdomains          |
         |                                       |
  TXT query: dGhpcyBpcyBzZWNyZXQ.evil.com       |
         |  → Base64 of "this is secret"         |
         |                                       |
         |  Firewall normally allows DNS (port 53)|
         |  so the traffic passes through        |
         |                                       |
         |  <--- Receive commands via TXT response|
         |  "exec: whoami"                        |

  Characteristics:
  - Bandwidth: ~500kbps (when using TXT records)
  - Latency: High (depends on DNS TTL)
  - Tools: iodine, dnscat2, dns2tcp
```

### Detection Methods and Implementation

```python
# Code example 9: DNS tunneling detection script (extended version)
import collections
import math
import re
from datetime import datetime, timedelta
from dataclasses import dataclass

@dataclass
class DNSQuery:
    timestamp: datetime
    src_ip: str
    qname: str
    qtype: str

def shannon_entropy(s: str) -> float:
    """Calculate Shannon entropy of a string"""
    if not s:
        return 0.0
    probabilities = [
        count / len(s)
        for count in collections.Counter(s).values()
    ]
    return -sum(p * math.log2(p) for p in probabilities)

def extract_base_domain(qname: str) -> str:
    """Extract base domain by removing subdomains"""
    parts = qname.rstrip(".").split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return qname

def get_subdomain_labels(qname: str) -> str:
    """Get the subdomain portion excluding the base domain"""
    parts = qname.rstrip(".").split(".")
    if len(parts) > 2:
        return ".".join(parts[:-2])
    return ""

class DNSTunnelDetector:
    """DNS tunneling detection engine"""

    # Thresholds (tunable)
    ENTROPY_THRESHOLD = 3.5      # Entropy of random strings
    LABEL_LENGTH_THRESHOLD = 50  # Length of subdomain labels
    QUERY_RATE_THRESHOLD = 100   # Number of queries per minute
    TXT_RATIO_THRESHOLD = 0.3    # Ratio of TXT queries
    UNIQUE_SUBDOMAIN_THRESHOLD = 50  # Unique subdomains per minute

    def __init__(self):
        self.alerts = []

    def analyze(self, queries: list[DNSQuery], window_minutes: int = 5) -> list:
        """Analyze query logs to detect signs of tunneling"""
        # Group by source IP
        by_source = collections.defaultdict(list)
        for q in queries:
            by_source[q.src_ip].append(q)

        for src_ip, src_queries in by_source.items():
            indicators = self._check_indicators(src_queries, window_minutes)
            if indicators["score"] >= 3:  # Alert on 3 or more indicators
                self.alerts.append({
                    "source_ip": src_ip,
                    "severity": "HIGH" if indicators["score"] >= 4 else "MEDIUM",
                    "indicators": indicators,
                    "sample_queries": [q.qname for q in src_queries[:5]],
                })

        return self.alerts

    def _check_indicators(self, queries: list[DNSQuery], window_min: int) -> dict:
        score = 0
        indicators = {}

        # Indicator 1: Abnormally long subdomain labels
        long_labels = [
            q for q in queries
            if len(get_subdomain_labels(q.qname)) > self.LABEL_LENGTH_THRESHOLD
        ]
        if long_labels:
            score += 1
            indicators["long_labels"] = len(long_labels)

        # Indicator 2: High-entropy subdomains
        high_entropy = []
        for q in queries:
            subdomain = get_subdomain_labels(q.qname)
            if subdomain and shannon_entropy(subdomain) > self.ENTROPY_THRESHOLD:
                high_entropy.append(q)
        if high_entropy:
            score += 1
            indicators["high_entropy"] = len(high_entropy)

        # Indicator 3: Abnormal ratio of TXT records
        txt_queries = [q for q in queries if q.qtype == "TXT"]
        txt_ratio = len(txt_queries) / max(len(queries), 1)
        if txt_ratio > self.TXT_RATIO_THRESHOLD:
            score += 1
            indicators["txt_ratio"] = round(txt_ratio, 3)

        # Indicator 4: High-frequency queries to the same base domain
        domain_counts = collections.Counter(
            extract_base_domain(q.qname) for q in queries
        )
        high_freq = {d: c for d, c in domain_counts.items()
                     if c > self.QUERY_RATE_THRESHOLD}
        if high_freq:
            score += 1
            indicators["high_freq_domains"] = high_freq

        # Indicator 5: Abnormally high number of unique subdomains
        unique_subdomains = collections.defaultdict(set)
        for q in queries:
            base = extract_base_domain(q.qname)
            sub = get_subdomain_labels(q.qname)
            if sub:
                unique_subdomains[base].add(sub)

        for base, subs in unique_subdomains.items():
            if len(subs) > self.UNIQUE_SUBDOMAIN_THRESHOLD:
                score += 1
                indicators["unique_subdomains"] = {base: len(subs)}
                break

        # Indicator 6: Detection of Base32/Base64 patterns
        b64_pattern = re.compile(r'^[A-Za-z0-9+/=]{20,}$')
        b32_pattern = re.compile(r'^[A-Z2-7=]{20,}$')
        encoded_count = sum(
            1 for q in queries
            if b64_pattern.match(get_subdomain_labels(q.qname).replace(".", ""))
            or b32_pattern.match(get_subdomain_labels(q.qname).replace(".", ""))
        )
        if encoded_count > 10:
            score += 1
            indicators["encoded_queries"] = encoded_count

        indicators["score"] = score
        return indicators
```

### DNS Monitoring on Network Devices

```bash
# Code example 10: DNS monitoring configuration

# ===== DNS anomaly detection rules for Suricata =====
# /etc/suricata/rules/dns-tunnel.rules

# Detect abnormally long DNS query names
alert dns any any -> any any (msg:"DNS Tunnel - Long query name";
  dns.query; content:"|00|"; offset:50;
  threshold: type threshold, track by_src, count 10, seconds 60;
  classtype:bad-unknown; sid:1000001; rev:1;)

# Excessive TXT record queries
alert dns any any -> any any (msg:"DNS Tunnel - Excessive TXT queries";
  dns.query; content:"|00 10|";  # TXT record type
  threshold: type threshold, track by_src, count 50, seconds 60;
  classtype:bad-unknown; sid:1000002; rev:1;)

# ===== DNS log analysis with Zeek (Bro) =====
# dns.zeek script
@load base/protocols/dns

event dns_request(c: connection, msg: dns_msg, query: string, qtype: count)
{
    if ( |query| > 60 )
    {
        NOTICE([$note=DNS::Tunneling_Indicator,
                $msg=fmt("Long DNS query from %s: %s", c$id$orig_h, query),
                $conn=c]);
    }
}

# ===== DNS traffic monitoring with tcpdump =====
# Real-time monitoring of DNS queries
tcpdump -i eth0 -n port 53 -l | awk '/A\?/ {print $NF}'

# Display only long query names
tcpdump -i eth0 -n port 53 -l | awk 'length($NF) > 60 {print}'
```

---

## 7. DANE (DNS-Based Authentication of Named Entities)

### DANE / TLSA Records

```
DANE is a mechanism for authenticating TLS certificates using DNS (RFC 6698).
DNSSEC is a mandatory prerequisite.

Structure of a TLSA record:
  _port._protocol.domain TLSA usage selector matching data

  Usage:
    0 = PKIX-TA: Specify a CA certificate
    1 = PKIX-EE: Specify a server certificate (also validates CA trust store)
    2 = DANE-TA: Specify a custom CA (no CA trust store required)
    3 = DANE-EE: Specify a server certificate (no CA trust store required)

  Selector:
    0 = Entire certificate
    1 = Public key only (SubjectPublicKeyInfo)

  Matching:
    0 = Exact match
    1 = SHA-256 hash
    2 = SHA-512 hash

Example:
  _443._tcp.example.com. IN TLSA 3 1 1 \
    2bb183af2b5a15f1168960b45a258a4e180f5... (SHA-256 of public key)
```

```bash
# Generate a TLSA record
openssl x509 -in server.crt -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  xxd -p -c 256

# Verify TLSA record
dig _443._tcp.example.com TLSA +short
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Leaving DNSSEC Undeployed

```
BAD: Operating with plaintext DNS without configuring DNSSEC
  → Cache poisoning can redirect users to phishing sites

GOOD: Enable DNSSEC and register the DS record with the registrar
  → Tampered responses fail validation and are discarded
```

**Impact**: A man-in-the-middle can tamper with DNS responses, enabling redirection to fake sites under a legitimate domain. In the 2024 Savannah attack, financial institutions without DNSSEC were targeted.

### Anti-Pattern 2: Exposing Internal DNS Resolvers to the Internet

```
BAD: Internal resolver listening on 0.0.0.0:53
  → Becomes a relay for DNS amplification attacks
  → Internal domain information is leaked

GOOD: Bind resolver to internal network only
  listen-on { 10.0.0.0/8; 127.0.0.1; };
  allow-recursion { 10.0.0.0/8; };
  allow-transfer { none; };
```

### Anti-Pattern 3: Carelessly Configuring Wildcard DNS Records

```
BAD: *.example.com → 1.2.3.4
  → Allows building phishing sites on any subdomain
  → Makes SSL certificate issuance easier
  → Makes subdomain takeover harder to detect

GOOD: Create individual records only for required subdomains
  www.example.com → 1.2.3.4
  api.example.com → 1.2.3.5
  Unused subdomains return NXDOMAIN
```

### Anti-Pattern 4: Not Collecting DNS Logs

```
BAD: DNS query logs are not saved
  → Cannot trace C2 communication traces during incident response
  → Cannot detect DNS tunneling

GOOD: Forward DNS query logs to SIEM and configure anomaly detection rules
  - Query names with high entropy
  - Abnormal ratio of TXT record queries
  - High volume of queries to unknown domains
  - DNS traffic outside normal hours
```

---

## 9. Edge Cases

### Edge Case 1: Firewall Bypass via DNS Rebinding

By setting the DNS TTL to 0, returning a legitimate IP on the first query and an internal IP (192.168.x.x) on re-query, an attacker can access the internal network while maintaining the browser's Same-Origin Policy. Countermeasures include DNS pinning and Host header validation on internal services.

### Edge Case 2: NSEC Zone Walking

Because DNSSEC's NSEC records point to the "next domain name," an attacker can enumerate all domains in a zone by traversing NSEC records in sequence. NSEC3 hashes domain names to make this harder, but it cannot fully prevent it (offline hash cracking is possible). NSEC5 (experimental) aims for further improvements.

### Edge Case 3: DNS UDP Fragmentation

DNSSEC responses are larger than standard DNS responses (due to signature data) and may exceed the maximum UDP size (512 bytes). While EDNS0 extends the UDP payload size, intermediate network devices may drop fragmented packets. Since DNS Flag Day 2020, response sizes of 1232 bytes or less are recommended.

### Edge Case 4: Happy Eyeballs and DNS

In dual-stack environments, during simultaneous A/AAAA record resolution and connection races, the order of DNS response arrival determines whether IPv4 or IPv6 is selected. If an attacker poisons only one type of record, the connection destination becomes unpredictable.

---

## 10. Exercises

### Exercise 1 (Basic): DNSSEC Validation

Run the following commands and verify the DNSSEC validation state.

```bash
# 1. Check a DNSSEC-enabled domain
dig +dnssec cloudflare.com A

# 2. Compare with a non-DNSSEC domain
# (Focus on the presence or absence of the AD flag)

# 3. Check DNSKEY and DS records
dig cloudflare.com DNSKEY +short
dig cloudflare.com DS +short

# Questions:
# - What does the AD flag mean?
# - What is the difference between the flag values of KSK and ZSK?
# - In which zone is the DS record placed?
```

### Exercise 2 (Intermediate): Implementing a DoH Client

Using Python's `httpx` library, implement a DoH client with the following capabilities:

1. POST requests compliant with RFC 8484
2. Display DNSSEC validation result (AD flag)
3. Failover to multiple DoH servers

### Exercise 3 (Advanced): DNS Tunneling Detection System

Build a system that takes DNS query logs (BIND query log format) as input and detects DNS tunneling using the following indicators:

1. Shannon entropy of subdomains
2. Statistical anomalies in query name length distribution
3. Ratio of TXT record queries
4. Number of unique subdomains to the same base domain
5. Detection of Base32/Base64 encoding patterns

Thresholds should be configurable, and alerts should be output in JSON format.

---

## 11. Performance Considerations

### Performance Impact of DNSSEC

| Item | Impact | Mitigation |
|------|--------|------------|
| Increased response size | 200-500 bytes added by RRSIG | ECDSA (small signatures) |
| CPU overhead of validation | RSA validation: ~1ms, ECDSA: ~0.3ms | Further speedup with Ed25519 |
| UDP fragmentation | May be dropped by intermediate devices | EDNS0 buffer size 1232 |
| Key rollover | Temporary increase in cache misses | Allow sufficient pre-publication period |
| Proof of non-existence (NSEC3) | Hash computation overhead | Set NSEC3 iterations to 0 (RFC 9276) |

### Latency Comparison of DoH/DoT

```
Latency comparison (averages, same server):

  Plaintext DNS (UDP):    ~5ms   (cache hit: <1ms)
  DoT (initial):          ~50ms  (includes TLS handshake)
  DoT (reuse):            ~10ms  (TLS session reuse)
  DoH (initial):          ~80ms  (HTTP/2 + TLS)
  DoH (reuse):            ~15ms  (HTTP/2 multiplexing)
  DoQ (initial):          ~30ms  (QUIC 0-RTT)
  DoQ (reuse):            ~5ms   (0-RTT reconnect)

  → DoQ offers the best balance as next-generation encrypted DNS
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also create test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

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

# Test
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

### Exercise 2: Applied Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Applied patterns
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

# Test
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

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 12. FAQ

### Q1. Why is DNSSEC adoption so slow?

DNSSEC faces complexity in key management, operational burden of zone signing, and concerns about zone walking (enumeration attacks) via NSEC. Response sizes also grow larger, which can cause UDP fragmentation issues. Improvements are being made with NSEC3 and auto-signing (BIND's inline-signing), but the adoption barrier remains high. As of 2025, DNSSEC signing rates vary widely by region: approximately 5% for .com and approximately 60% for .nl (Netherlands).

### Q2. Should DoH be used in corporate networks?

DoH improves privacy but risks bypassing corporate security monitoring. In corporate networks, it is common to operate an internal DoH resolver and block traffic to external DoH/DoT. This allows both privacy and visibility to be maintained. Specifically, this requires blocking port 853 (DoT), blocking known DoH endpoints (such as cloudflare-dns.com), and considering HTTPS inspection using an internal CA.

### Q3. Is DNS filtering effective as a security measure?

DNS filtering via RPZ or Pi-hole is an effective low-cost measure for preventing malware C2 communication and access to phishing sites. However, it is powerless against direct IP access and DoH bypasses, so it should be considered one layer in a defense-in-depth strategy.

### Q4. How long should DNS logs be retained?

NIST SP 800-92 recommends a minimum log retention period of 90 days. In GDPR environments, care must be taken in handling DNS queries as personal data. From an incident response perspective, 6 months to 1 year is ideal, though storage costs must be considered. Retention periods can be extended by using compression and summary logs.

### Q5. When will DNS over QUIC (DoQ) become mainstream?

Already standardized in RFC 9250. Some services like AdGuard DNS have begun support, but client-side support remains limited. Since QUIC's 0-RTT achieves lower latency than DoH/DoT and also eliminates head-of-line blocking, it has the potential to replace DoH in the future.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next steps.

### Q3: How is this knowledge used in practice?

Knowledge of this topic is frequently used in day-to-day development work, especially during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|-----------|
| DNS Threats | Poisoning, spoofing, tunneling, and rebinding are the main risks |
| DNSSEC | Verifies response integrity with digital signatures, tracing the chain of trust up to the root |
| DoH/DoT/DoQ | Encrypts DNS queries for privacy and tamper prevention |
| Poisoning Countermeasures | DNSSEC + port randomization + 0x20 encoding |
| DNS Tunneling | Detect anomalies via query length, entropy, and frequency |
| RPZ | Block malicious domains based on policy |
| DANE/TLSA | Validate TLS certificates via DNS (DNSSEC required) |
| CAA | Restrict certificate-issuing CAs via DNS |
| Subdomain Takeover | Regularly audit dangling CNAMEs |

---

## Next Guides to Read

- [Network Security Basics](./00-network-security-basics.md) — Comprehensive defense with firewalls and IDS/IPS
- [API Security](./02-api-security.md) — Protecting communications at the application layer
- [TLS/Certificates](../02-cryptography/01-tls-certificates.md) — Details of TLS, the foundation of DoH/DoT
- [Monitoring/Logging](../06-operations/01-monitoring-logging.md) — Integrated monitoring including DNS logs

---

## References

1. **RFC 4033-4035 — DNS Security Introduction and Requirements (DNSSEC)** — https://datatracker.ietf.org/doc/html/rfc4033
2. **RFC 8484 — DNS Queries over HTTPS (DoH)** — https://datatracker.ietf.org/doc/html/rfc8484
3. **RFC 7858 — Specification for DNS over Transport Layer Security (DoT)** — https://datatracker.ietf.org/doc/html/rfc7858
4. **RFC 9250 — DNS over Dedicated QUIC Connections (DoQ)** — https://datatracker.ietf.org/doc/html/rfc9250
5. **RFC 6698 — DNS-Based Authentication of Named Entities (DANE)** — https://datatracker.ietf.org/doc/html/rfc6698
6. **RFC 9276 — Guidance for NSEC3 Parameter Settings** — https://datatracker.ietf.org/doc/html/rfc9276
7. **NIST SP 800-81-2 — Secure Domain Name System (DNS) Deployment Guide** — https://csrc.nist.gov/publications/detail/sp/800-81/2/final
8. **DNS Flag Day** — https://dnsflagday.net/ — An industry initiative on DNS compliance with the latest standards
9. **Kaminsky DNS Vulnerability (2008)** — https://www.kb.cert.org/vuls/id/800113
