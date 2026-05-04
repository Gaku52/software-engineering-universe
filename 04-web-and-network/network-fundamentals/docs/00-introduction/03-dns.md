# DNS (Domain Name System)

> DNS is the distributed database system that underpins the Internet. It is responsible for "name resolution" — converting human-readable domain names into the IP addresses that computers use for communication. This guide systematically explains recursive/iterative queries, DNS record types, caching mechanisms, security extensions, and operational design decisions.

---

## What You Will Learn

- [ ] Understand the hierarchical, distributed structure of DNS and the namespace
- [ ] Accurately explain the difference between recursive and iterative queries
- [ ] Understand the uses of major DNS records (A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, PTR, CAA)
- [ ] Be able to make design decisions about DNS caching and TTL
- [ ] Perform practical DNS debugging with dig / nslookup / host commands
- [ ] Understand the overview of security extensions such as DNSSEC, DoH, and DoT
- [ ] Learn anti-patterns and best practices in DNS operations

## Prerequisites

- IP address fundamentals (./02-ip-addressing.md)
- Overview of the UDP protocol (connectionless transport protocol)
- Basic command-line (terminal) operations

---

## 1. DNS Basic Concepts

### 1.1 Why DNS Is Necessary

All communication on the Internet ultimately identifies the other party by IP address. However, it is impractical for humans to memorize and use number strings like `93.184.216.34`. DNS (Domain Name System) was designed to link meaningful strings (domain names) with network entities (IP addresses).

```
A world without DNS:
  Type 93.184.216.34 into a browser → Example company's website appears
  Type 142.250.196.110 into a browser → Google search page appears
  Type 31.13.82.36 into a browser → Facebook appears

  → In practice, ordinary users cannot use the Internet

A world with DNS:
  Type example.com into a browser  → DNS converts to 93.184.216.34 → displayed
  Type google.com into a browser   → DNS converts to 142.250.196.110 → displayed
  Type facebook.com into a browser → DNS converts to 31.13.82.36 → displayed

  → Domain names as a "human-oriented interface" make the Internet practical
```

DNS was proposed by Paul Mockapetris in 1983 as RFC 882/883, and later standardized in RFC 1034/1035. Before that, a single text file called `HOSTS.TXT` handled name resolution for the entire Internet, but management broke down as the number of hosts exploded. DNS solved this problem with a "distributed database" design.

### 1.2 Hierarchical Structure of DNS

The DNS namespace has an inverted tree-like hierarchy similar to a file system's directory structure. At the top is the root (`.`), which branches into TLDs (Top-Level Domains), second-level domains, and subdomains.

```
DNS hierarchical structure (namespace tree):

                          . (root)
                          |
          +---------------+---------------+---------------+
          |               |               |               |
         com.            org.            jp.            net.
          |               |               |               |
    +-----+-----+    +---+---+    +------+------+        |
    |     |     |    |       |    |      |      |        |
 example google github  wiki  mozilla  co    ac    go   cloudflare
   .com  .com  .com   .org   .org  .jp   .jp   .jp    .net
                                    |
                              +-----+-----+
                              |           |
                           example     toyota
                            .co.jp      .co.jp

Naming of each layer:
  Root       → . (dot)
  TLD        → com, org, jp, net, edu, gov, ...
  SLD        → example, google, github, ...
  Subdomain  → www, mail, api, blog, ...
```

### 1.3 FQDN (Fully Qualified Domain Name)

An FQDN (Fully Qualified Domain Name) is a domain name that indicates the complete path from the root. The trailing dot (`.`) represents the root.

```
Components of an FQDN:

  www.example.com.
  ^^^  ^^^^^^^  ^^^  ^
   |      |      |   |
   |      |      |   +--- root (usually omitted)
   |      |      +------- TLD (Top-Level Domain)
   |      +-------------- SLD (Second-Level Domain)
   +--------------------- hostname (subdomain)

Examples:
  FQDN                        Hostname   Domain
  ─────────────────────────────────────────────────
  www.example.com.             www       example.com
  mail.example.co.jp.          mail      example.co.jp
  api.v2.internal.example.com. api       v2.internal.example.com
  example.com.                 (none)    example.com

Note: presence or absence of the trailing dot
  "example.com"  → relative name (may have the search domain from /etc/resolv.conf appended)
  "example.com." → absolute name (FQDN, unambiguous)

  In DNS configuration files (zone files, etc.), the presence or absence of the trailing
  dot can cause critical configuration mistakes (see anti-patterns section below)
```

### 1.4 Types of DNS Servers

Multiple types of servers are involved in DNS name resolution. Understanding the role of each precisely is important.

```
DNS server classification:

┌─────────────────────────────────────────────────────────────────────┐
│                     Types of DNS servers                            │
├─────────────────┬───────────────────────────────────────────────────┤
│ Root DNS server  │ · Top of the DNS tree (13 clusters: a–m)          │
│                  │ · Holds information about TLD servers             │
│                  │ · Distributed worldwide via Anycast (1000+ nodes) │
│                  │ · Example: a.root-servers.net (198.41.0.4)        │
├─────────────────┼───────────────────────────────────────────────────┤
│ TLD DNS server   │ · Manages each TLD (.com, .org, .jp, etc.)       │
│                  │ · Returns NS records of authoritative DNS servers │
│                  │ · Example: a.gtld-servers.net (handles .com)      │
├─────────────────┼───────────────────────────────────────────────────┤
│ Authoritative    │ · Holds the official records for a specific zone  │
│ DNS server       │ · Returns the final answer (Authoritative Answer) │
│                  │ · Configured and operated by the zone administrator│
│                  │ · Example: ns1.example.com                        │
├─────────────────┼───────────────────────────────────────────────────┤
│ Full resolver    │ · Accepts recursive queries from clients          │
│ (Recursive       │ · Queries each DNS server iteratively            │
│  resolver)       │ · Caches results for faster responses            │
│                  │ · Provided by ISPs or public DNS (8.8.8.8, etc.) │
├─────────────────┼───────────────────────────────────────────────────┤
│ Stub resolver    │ · Minimal DNS functionality built into client OS  │
│                  │ · Sends recursive queries to the configured full  │
│                  │   resolver                                        │
│                  │ · Does not perform iterative queries itself       │
│                  │ · Configured via /etc/resolv.conf                │
├─────────────────┼───────────────────────────────────────────────────┤
│ Forwarder        │ · Forwards received queries to another resolver   │
│                  │ · Used in corporate networks, etc.               │
│                  │ · Resolves internal zones itself, forwards       │
│                  │   external queries upstream                      │
└─────────────────┴───────────────────────────────────────────────────┘
```

---

## 2. Detailed Name Resolution Flow

### 2.1 Complete Name Resolution Process

From when a user types `www.example.com` into a browser to when the web page is displayed, a complex DNS query process takes place behind the scenes. The complete process is shown below.

```
DNS name resolution flow (complete):

  User          Stub          Full         Root        .com TLD    Authoritative
  (browser)    resolver      resolver      DNS          DNS        (example.com)
     |              |             |              |            |             |
     | ① Enter URL  |             |              |            |             |
     |------------->|             |              |            |             |
     |  Browser     |             |              |            |             |
     |  cache       |             |              |            |             |
     |  check(miss) |             |              |            |             |
     |              |             |              |            |             |
     |  ② OS        |             |              |            |             |
     |  cache       |             |              |            |             |
     |  check(miss) |             |              |            |             |
     |              |             |              |            |             |
     |  ③ /etc/hosts|             |              |            |             |
     |  check(miss) |             |              |            |             |
     |              |             |              |            |             |
     |              | ④ Recursive |              |            |             |
     |              |   query     |              |            |             |
     |              |------------>|              |            |             |
     |              |             |              |            |             |
     |              |             | ⑤ Iterative  |            |             |
     |              |             |   query      |            |             |
     |              |             |------------->|            |             |
     |              |             |  ".com is here"|          |             |
     |              |             |<-------------|            |             |
     |              |             |              |            |             |
     |              |             | ⑥ Iterative query         |             |
     |              |             |-------------------------->|             |
     |              |             | "example.com is here"     |             |
     |              |             |<--------------------------|             |
     |              |             |              |            |             |
     |              |             | ⑦ Iterative query                      |
     |              |             |---------------------------------------->|
     |              |             | "93.184.216.34"                         |
     |              |             |<----------------------------------------|
     |              |             |              |            |             |
     |              | ⑧ Response  |              |            |             |
     |              |<------------|              |            |             |
     |              |  (stored in |              |            |             |
     |              |   cache)    |              |            |             |
     |              |             |              |            |             |
     | ⑨ IP address |             |              |            |             |
     |<-------------|             |              |            |             |
     |              |             |              |            |             |
     | ⑩ Start TCP connection (93.184.216.34:443)                           |
     |------------------------------------------------------------------>  |
```

### 2.2 Details of Each Step

**Steps 1–3: Checking Local Cache**

Name resolution first checks whether it can be completed locally. It searches, in order, the browser's internal cache, the OS DNS cache, and the `/etc/hosts` file.

```
Cache check order and commands:

1. Browser cache:
   Chrome:  chrome://net-internals/#dns
   Firefox: about:networking#dns
   → Each browser maintains its own cache
   → Often cleared when the browser is closed

2. OS cache:
   macOS:   $ sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   Linux:   $ sudo systemd-resolve --flush-caches    # when using systemd-resolved
            $ sudo systemctl restart nscd             # when using nscd
   Windows: > ipconfig /flushdns

3. /etc/hosts file (local name resolution):
   $ cat /etc/hosts
   127.0.0.1    localhost
   ::1          localhost
   192.168.1.10 myserver.local myserver

   → /etc/hosts takes priority over DNS (depends on nsswitch.conf settings)
   → Used to override domains in development environments
```

**Step 4: Recursive Query (stub resolver → full resolver)**

The stub resolver requests a "final answer" from the full resolver. This is the recursive query. The full resolver is responsible for obtaining the answer.

**Steps 5–7: Iterative Queries (full resolver → each authoritative server)**

The full resolver receives referral information (the next server to query) from the root DNS in order, eventually reaching the final authoritative server.

**Steps 8–9: Response and Caching**

The full resolver caches the obtained answer based on TTL and returns it to the client. The next time the same name is queried, the cache can be used to respond directly.

---

## 3. Detailed Comparison of Recursive and Iterative Queries

### 3.1 Recursive Query

In a recursive query, the server that receives the query bears responsibility for returning a complete answer. The client only needs to wait for the final result.

```
Recursive query behavior:

  Client                          Full resolver
     |                               |
     | "What is the IP of           |
     |  www.example.com?"           |
     |------------------------------>|
     |                               |  ← The full resolver
     |    (client waits)             |    handles all queries
     |                               |
     |                               |  Root DNS → .com DNS →
     |                               |  authoritative DNS, queried in order
     |                               |
     | "It is 93.184.216.34"        |
     |<------------------------------|
     |                               |

Characteristics:
  · Simple client implementation
  · Processing load concentrated on the full resolver
  · Generally used between a client and a resolver
  · DNS header RD (Recursion Desired) bit = 1
```

### 3.2 Iterative Query

In an iterative query, the server that receives the query returns only the information it knows. It often returns a referral — "I don't know, but this server might."

```
Iterative query behavior:

  Full resolver          Root DNS          .com DNS         Authoritative DNS
     |                       |                  |                 |
     | "Who handles .com?"   |                  |                 |
     |---------------------->|                  |                 |
     | "a.gtld-servers.net"  |                  |                 |
     |<----------------------|                  |                 |
     |                       |                  |                 |
     | "Who handles example.com?"               |                 |
     |----------------------------------------->|                 |
     | "ns1.example.com"                        |                 |
     |<-----------------------------------------|                 |
     |                       |                  |                 |
     | "What is the A record for www.example.com?"                |
     |---------------------------------------------------------->|
     | "93.184.216.34"                                            |
     |<----------------------------------------------------------|

Characteristics:
  · Low load on the queried server
  · The full resolver performs multiple queries
  · Generally used between a resolver and authoritative servers
  · DNS header RD bit = 0
```

### 3.3 Comparison Table: Recursive vs Iterative Queries

| Item | Recursive query | Iterative query |
|---------|-----------|-----------|
| Answer responsibility | The queried server is obligated to return a complete answer | Only needs to return what it knows |
| Client-side processing | Just wait for the result | Receive a referral and send the next query |
| Main use case | Stub resolver → full resolver | Full resolver → authoritative server |
| RD bit | 1 (requests recursion) | 0 (does not request recursion) |
| Server load | Concentrated on the queried server | Distributed across each server |
| Caching | Full resolver caches | Can be cached at each stage |
| Security risk | Can be used as a stepping stone for DNS amplification attacks | Limited risk |
| Response time | Single RTT from the client's perspective | Multiple RTTs occur |

---

## 4. DNS Record Types and Details

### 4.1 Major Record Overview

DNS records are resource records (RR) that store various information associated with domain names. The major record types and their uses are shown below.

```
General format of DNS resource records (zone file format):

  <name>    <TTL>   <class>  <type>  <data>

  Examples:
  www.example.com.  3600  IN  A      93.184.216.34
  example.com.      3600  IN  MX  10 mail.example.com.
  example.com.      3600  IN  TXT    "v=spf1 include:_spf.google.com ~all"

Field descriptions:
  Name    → Domain name (FQDN) associated with the record
  TTL     → Cache validity period (seconds)
  Class   → Almost always IN (Internet)
  Type    → Record type (A, AAAA, CNAME, MX, ...)
  Data    → Value specific to the record type
```

### 4.2 Details of Each Record Type

**A Record (Address Record)**

The most fundamental record, mapping a domain name to an IPv4 address.

```
A record examples:

  Zone file:
  example.com.      300   IN  A  93.184.216.34
  www.example.com.  300   IN  A  93.184.216.34
  api.example.com.  60    IN  A  10.0.1.100
  api.example.com.  60    IN  A  10.0.1.101    # Multiple A records (round-robin)

  Checking with dig:
  $ dig example.com A +noall +answer
  example.com.    300  IN  A  93.184.216.34

  Multiple IPs (DNS round-robin):
  $ dig api.example.com A +noall +answer
  api.example.com.  60  IN  A  10.0.1.100
  api.example.com.  60  IN  A  10.0.1.101
  → Client selects one of the returned IPs and connects
  → Functions as simple load balancing, but no health check
```

**AAAA Record (IPv6 Address Record)**

A record that maps a domain name to an IPv6 address. Read as "quad-A."

```
AAAA record examples:

  Zone file:
  example.com.  3600  IN  AAAA  2606:2800:0220:0001:0248:1893:25c8:1946

  Checking with dig:
  $ dig example.com AAAA +noall +answer
  example.com.  3600  IN  AAAA  2606:2800:220:1:248:1893:25c8:1946

  Dual-stack environment (both IPv4 and IPv6 configured):
  example.com.  300  IN  A     93.184.216.34
  example.com.  300  IN  AAAA  2606:2800:220:1:248:1893:25c8:1946
  → The Happy Eyeballs algorithm prefers whichever is faster
```

**CNAME Record (Canonical Name Record)**

A record that sets an alias (another name) for a domain name.

```
CNAME record examples:

  Zone file:
  www.example.com.   3600  IN  CNAME  example.com.
  blog.example.com.  3600  IN  CNAME  example.github.io.
  shop.example.com.  3600  IN  CNAME  shops.myshopify.com.

  Checking with dig:
  $ dig www.example.com +noall +answer
  www.example.com.  3600  IN  CNAME  example.com.
  example.com.      300   IN  A      93.184.216.34

Important restrictions:
  · CNAME cannot be set at the zone apex (Zone Apex)
    ×  example.com.  IN  CNAME  other.example.com.  ← RFC violation
    ○  www.example.com.  IN  CNAME  other.example.com.  ← OK

  · CNAME and other records cannot coexist with the same name
    ×  www  IN  CNAME  example.com.
       www  IN  A      1.2.3.4            ← RFC violation
    ○  www  IN  CNAME  example.com.       ← CNAME only

  Reason: CNAME means "delegate all queries for this name to the target,"
          which is logically contradictory to coexisting with other records

  Alternatives at the Zone Apex:
  · ALIAS / ANAME records (proprietary extension of some DNS providers)
  · AWS Route 53 alias records
  · Cloudflare CNAME Flattening
```

**MX Record (Mail Exchange Record)**

A record specifying the mail delivery server. Has a priority (preference) value.

```
MX record examples:

  Zone file:
  example.com.  3600  IN  MX  10 mail1.example.com.
  example.com.  3600  IN  MX  20 mail2.example.com.
  example.com.  3600  IN  MX  30 mail-backup.example.com.

  → Lower numbers indicate higher priority
  → If mail1 does not respond, falls back in order: mail2 → mail-backup

  Using Google Workspace:
  example.com.  3600  IN  MX  1  ASPMX.L.GOOGLE.COM.
  example.com.  3600  IN  MX  5  ALT1.ASPMX.L.GOOGLE.COM.
  example.com.  3600  IN  MX  5  ALT2.ASPMX.L.GOOGLE.COM.
  example.com.  3600  IN  MX  10 ALT3.ASPMX.L.GOOGLE.COM.
  example.com.  3600  IN  MX  10 ALT4.ASPMX.L.GOOGLE.COM.

  Checking with dig:
  $ dig example.com MX +noall +answer
  example.com.  3600  IN  MX  10 mail1.example.com.
  example.com.  3600  IN  MX  20 mail2.example.com.

  Important: specify an FQDN, not an IP address, as the MX record value
             CNAME should not be used as the value of an MX record (RFC 2181)
```

**TXT Record (Text Record)**

A record that stores arbitrary text data. Widely used for email authentication (SPF, DKIM, DMARC) and domain ownership verification.

```
TXT record uses and examples:

  1. SPF (Sender Policy Framework):
     example.com.  3600  IN  TXT  "v=spf1 ip4:192.0.2.0/24 include:_spf.google.com ~all"
     → Declares the servers authorized to send email from this domain
     → ~all: sending from other sources is a soft fail (suspicious but not rejected)
     → -all: hard fail (completely reject anything not listed)

  2. DKIM (DomainKeys Identified Mail):
     selector._domainkey.example.com.  3600  IN  TXT
       "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GN..."
     → Public key for verifying email digital signatures

  3. DMARC (Domain-based Message Authentication):
     _dmarc.example.com.  3600  IN  TXT
       "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
     → Email handling policy based on SPF and DKIM results

  4. Domain ownership verification:
     example.com.  300  IN  TXT  "google-site-verification=abc123..."
     example.com.  300  IN  TXT  "MS=ms12345678"
     → Used by Google, Microsoft, and others to verify domain ownership

  5. Security policy:
     _mta-sts.example.com.  3600  IN  TXT  "v=STSv1; id=20240101"
     → Version management for MTA-STS (enforcing SMTP TLS)
```

**NS Record (Name Server Record)**

A record specifying the authoritative name servers for a zone.

```
NS record examples:

  Zone file:
  example.com.  86400  IN  NS  ns1.example.com.
  example.com.  86400  IN  NS  ns2.example.com.
  example.com.  86400  IN  NS  ns3.example-dns.net.

  → At minimum, 2 NS records are typically set (for redundancy)
  → Placing NS servers on different networks is recommended
  → TTL is often set long (86400 seconds = 24 hours)

  Glue Records:
  When the NS server itself is within that zone,
  an A record is added to the TLD zone to prevent circular references

  Example: if the NS for example.com is ns1.example.com
  → To know the IP of ns1.example.com, you need to ask the NS of example.com
  → But the NS of example.com is ns1.example.com → circular reference

  Solution: register a glue record in the parent zone (.com)
  Within .com zone:
    example.com.      IN  NS  ns1.example.com.
    ns1.example.com.  IN  A   198.51.100.1      ← glue record
```

**SOA Record (Start of Authority Record)**

A record describing zone management information. There is always exactly one per zone.

```
SOA record examples:

  example.com. 86400 IN SOA ns1.example.com. admin.example.com. (
    2024010101  ; serial number (zone version)
    3600        ; refresh interval (how often secondary checks primary)
    900         ; retry interval (retry interval if refresh fails)
    604800      ; expiry (max period secondary considers zone data valid)
    86400       ; negative cache TTL (period to cache NXDOMAIN)
  )

  Field explanations:
  · MNAME (ns1.example.com.)   : primary name server
  · RNAME (admin.example.com.) : admin email address (@ replaced with .)
                                  → actually admin@example.com
  · Serial number: YYYYMMDDNN format is common
    → Must be incremented every time the zone changes
    → Secondary DNS uses this value to determine if a zone transfer is needed

  Checking with dig:
  $ dig example.com SOA +noall +answer
```

**SRV Record (Service Record)**

A record specifying the host and port number where a specific service is running.

```
SRV record format:
  _service._protocol.domain  TTL  IN  SRV  priority weight port host

  Examples:
  _sip._tcp.example.com.     3600 IN SRV 10 60 5060 sipserver1.example.com.
  _sip._tcp.example.com.     3600 IN SRV 10 40 5060 sipserver2.example.com.
  _sip._tcp.example.com.     3600 IN SRV 20 0  5060 sipbackup.example.com.

  → Load balanced between priority-10 servers at a ratio of 60:40 by weight
  → If all priority-10 servers are down, falls back to priority-20

  Example use in Active Directory:
  _ldap._tcp.dc._msdcs.example.com.  600 IN SRV 0 100 389 dc1.example.com.
  _kerberos._tcp.example.com.        600 IN SRV 0 100 88  kdc.example.com.
```

**PTR Record (Pointer Record)**

A record for reverse DNS lookup (IP address to domain name). Important for mail server trust verification.

```
PTR record examples:

  IPv4 reverse lookup (in-addr.arpa):
  34.216.184.93.in-addr.arpa.  3600  IN  PTR  example.com.
  → Octets of the IP address are reversed and .in-addr.arpa is appended

  IPv6 reverse lookup (ip6.arpa):
  6.4.9.1.8.c.5.2.3.9.8.1.8.4.2.0.1.0.0.0.0.2.2.0.0.0.8.2.6.0.6.2.ip6.arpa.
    3600  IN  PTR  example.com.
  → Each nibble (4 bits) is reversed and .ip6.arpa is appended

  Checking reverse lookup with dig:
  $ dig -x 93.184.216.34 +noall +answer
  34.216.184.93.in-addr.arpa. 3600 IN PTR example.com.

  When reverse lookup matters:
  · When sending email: receiving server checks PTR record
    → Marked as spam if PTR is not set or does not match forward lookup
  · Log analysis: convert IP addresses to hostnames for readability
  · Security audits: identify the owner of a suspicious IP address
```

**CAA Record (Certification Authority Authorization)**

A record that restricts which CAs (Certificate Authorities) are allowed to issue SSL/TLS certificates for a domain.

```
CAA record examples:

  example.com.  3600  IN  CAA  0 issue "letsencrypt.org"
  example.com.  3600  IN  CAA  0 issue "digicert.com"
  example.com.  3600  IN  CAA  0 issuewild "letsencrypt.org"
  example.com.  3600  IN  CAA  0 iodef "mailto:security@example.com"

  Flags and tags:
  · 0 issue        → CA authorized to issue standard certificates
  · 0 issuewild    → CA authorized to issue wildcard certificates
  · 0 iodef        → Notification destination for policy violations
  · 128 issue      → 128 = critical flag (reject issuance if unknown tag exists)

  Checking with dig:
  $ dig example.com CAA +noall +answer

  How CAA works:
  1. CA receives a certificate issuance request
  2. CA checks the CAA record for the target domain
  3. If the CA is not listed under issue, it refuses to issue
  4. If no CAA record exists, there is no restriction (any CA can issue)
```

### 4.3 Record Type Comparison by Use Case

| Record | Use | Value example | Typical TTL | Configuration frequency |
|---------|------|-------|------------|---------|
| A | Domain → IPv4 | 93.184.216.34 | 300-3600 | Very high |
| AAAA | Domain → IPv6 | 2606:2800:220:1:... | 300-3600 | High |
| CNAME | Alias | www→example.com | 3600 | High |
| MX | Mail delivery | 10 mail.example.com | 3600 | Moderate |
| TXT | Text info | "v=spf1 ..." | 3600 | Moderate |
| NS | Authoritative DNS | ns1.example.com | 86400 | Low |
| SOA | Zone management info | (composite data) | 86400 | Low |
| SRV | Service location | 10 60 5060 sip.ex... | 3600 | Low |
| PTR | Reverse lookup | example.com | 3600 | Low |
| CAA | CA restriction | 0 issue "le..." | 3600 | Low |

---

## 5. DNS Cache and TTL

### 5.1 Hierarchical Cache Structure

DNS name resolution is accelerated by multi-level caching. The caches at each level work together to significantly reduce the number of queries to DNS servers.

```
DNS cache hierarchy:

  ┌──────────────────────────────────────────────────────────────┐
  │                    Cache hierarchy diagram                    │
  │                                                              │
  │  ┌─────────────────────────────┐    Response speed: < 1ms   │
  │  │  1. Application cache       │    Chrome internal, curl   │
  │  │     (browser, etc.)         │    cache, etc.             │
  │  │                             │    TTL: app-dependent      │
  │  └─────────────┬───────────────┘                             │
  │        miss    │                                              │
  │                ▼                                              │
  │  ┌─────────────────────────────┐    Response speed: < 1ms   │
  │  │  2. OS cache                │    systemd-resolved,        │
  │  │     (stub resolver)         │    mDNSResponder, etc.     │
  │  └─────────────┬───────────────┘    TTL: follows record TTL  │
  │        miss    │                                              │
  │                ▼                                              │
  │  ┌─────────────────────────────┐    Response speed: 1-5ms   │
  │  │  3. Local DNS cache         │    Router, dnsmasq, etc.   │
  │  │     (home router, etc.)     │    TTL: follows record TTL  │
  │  └─────────────┬───────────────┘                             │
  │        miss    │                                              │
  │                ▼                                              │
  │  ┌─────────────────────────────┐    Response speed: 5-50ms  │
  │  │  4. ISP resolver cache      │    ISP-provided DNS server │
  │  │     (full resolver)         │    Cache shared by many    │
  │  └─────────────┬───────────────┘    TTL: follows record TTL  │
  │        miss    │                                              │
  │                ▼                                              │
  │  ┌─────────────────────────────┐    Response speed: 50-200ms│
  │  │  5. Authoritative DNS server│    Executes iterative       │
  │  │     (iterative query)       │    queries root→TLD→auth   │
  │  └─────────────────────────────┘                             │
  └──────────────────────────────────────────────────────────────┘
```

### 5.2 TTL (Time To Live) Design

TTL configuration is one of the most important design decisions in DNS operations.

```
TTL configuration guidelines:

  Short TTL (60–300 seconds):
  ┌────────────────────────────────────────────────────────┐
  │ Advantages                                              │
  │ · DNS changes propagate quickly                        │
  │ · Fast failover response                               │
  │ · Suitable for Blue-Green deployments and canary releases│
  │                                                        │
  │ Disadvantages                                          │
  │ · Increased query frequency to DNS servers             │
  │ · More susceptible to network latency                  │
  │ · Higher load on authoritative DNS servers             │
  │                                                        │
  │ Recommended situations                                  │
  │ · CDN (CloudFront, Fastly, etc.) configuration         │
  │ · Load balancer DNS configuration                      │
  │ · Infrastructure migration preparation period          │
  │ · Services where rapid failover is critical            │
  └────────────────────────────────────────────────────────┘

  Long TTL (3600–86400 seconds):
  ┌────────────────────────────────────────────────────────┐
  │ Advantages                                              │
  │ · Significantly fewer DNS queries                      │
  │ · Low name resolution latency (high cache hit rate)    │
  │ · Lower load on authoritative DNS servers              │
  │                                                        │
  │ Disadvantages                                          │
  │ · DNS changes take longer to propagate                 │
  │ · Slower failover                                      │
  │                                                        │
  │ Recommended situations                                  │
  │ · NS records (very rarely changed)                     │
  │ · SOA records                                          │
  │ · A records of services in stable operation            │
  │ · MX records                                           │
  └────────────────────────────────────────────────────────┘
```

### 5.3 TTL Best Practices During DNS Migration

```
TTL operation procedure during server migration:

  Timeline:
  ──────┬────────────────────┬──────────────────┬──────────────────┬─────
   T-48h │                    │ T-0 (migration)  │ T+24h            │ T+72h
        │                    │                  │                  │
   ① Reduce TTL             ② Change record     ③ Verify health   ④ Restore TTL
   (3600→300)               (old IP→new IP)     (all resolvers    (300→3600)
                                                 propagated)

  Detailed steps:
  ① 48 hours before migration:
     Old setting: example.com.  3600  IN  A  198.51.100.1
     After change: example.com.   300  IN  A  198.51.100.1   ← TTL only reduced
     → Wait more than twice the original TTL (3600 seconds = 1 hour)
     → All caches are refreshed with the new TTL (300 seconds)

  ② Migration:
     After change: example.com.   300  IN  A  203.0.113.50   ← Change IP address
     → Propagated worldwide in at most 300 seconds (5 minutes)

  ③ 24 hours after migration:
     Monitoring items:
     · Traffic trend to new server
     · Confirm traffic to old server disappears
     · Check error rate and latency

  ④ 72 hours after migration:
     After change: example.com.  3600  IN  A  203.0.113.50   ← Restore TTL
     → Move to stable operation

  ★ Common mistake:
     Changing the IP without first reducing the TTL
     → For the duration of the old TTL (e.g., 86400 seconds = 24 hours),
       users with cached entries continue accessing the old IP
     → All their requests fail during that period
```

### 5.4 Negative Cache

Responses to non-existent domains (NXDOMAIN) are also cached. This is called negative caching.

```
How negative caching works:

  $ dig nonexistent.example.com
  ;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, ...
  ;; AUTHORITY SECTION:
  example.com.  86400  IN  SOA  ns1.example.com. admin.example.com. ...

  → The NXDOMAIN cache duration is determined by the last field of the SOA record
    (negative cache TTL)

  Impact:
  · Even after creating a new subdomain, the "does not exist" response may
    continue to be returned during the negative cache period
  · Problems occur if the SOA's negative cache TTL is too long

  Recommendation: set negative cache TTL to 300–3600 seconds
```

---

## 6. Code Examples: Practical DNS Debugging

### 6.1 Using the dig Command

`dig` (Domain Information Groper) is the most powerful command-line tool for DNS queries.

```bash
# ============================================================
# Code example 1: Basic usage of dig
# ============================================================

# Basic A record query
$ dig example.com

# How to read the output:
# ;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
#   → status: NOERROR = normal response
#   → status: NXDOMAIN = domain does not exist
#   → status: SERVFAIL = server error
#   → status: REFUSED = query refused
#
# ;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1
#   → qr = Query Response
#   → rd = Recursion Desired
#   → ra = Recursion Available
#   → aa = Authoritative Answer ← important
#
# ;; ANSWER SECTION:
# example.com.  300  IN  A  93.184.216.34
#   → domain name  TTL  class  type  data

# Query specific record types
$ dig example.com A          # IPv4 address
$ dig example.com AAAA       # IPv6 address
$ dig example.com MX         # Mail server
$ dig example.com TXT        # Text records
$ dig example.com NS         # Name servers
$ dig example.com SOA        # Zone management info
$ dig example.com ANY        # All records (restricted on many servers)

# Concise output
$ dig +short example.com
93.184.216.34

# Show only the answer section
$ dig +noall +answer example.com
example.com.  300  IN  A  93.184.216.34

# Query a specific DNS server
$ dig @8.8.8.8 example.com        # Google Public DNS
$ dig @1.1.1.1 example.com        # Cloudflare DNS
$ dig @9.9.9.9 example.com        # Quad9 DNS

# Trace the DNS resolution process (+trace)
$ dig +trace example.com
# → Displays the complete process: root DNS → .com TLD DNS → authoritative DNS
# . 518400 IN NS a.root-servers.net.
# ...
# com. 172800 IN NS a.gtld-servers.net.
# ...
# example.com. 300 IN A 93.184.216.34
```

### 6.2 The nslookup Command

`nslookup` is older than dig but available by default on Windows as well.

```bash
# ============================================================
# Code example 2: Using nslookup
# ============================================================

# Basic query
$ nslookup example.com
Server:    192.168.1.1
Address:   192.168.1.1#53

Non-authoritative answer:
Name:      example.com
Address:   93.184.216.34

# Specific record types
$ nslookup -type=MX example.com
$ nslookup -type=TXT example.com
$ nslookup -type=NS example.com

# Specify a specific DNS server
$ nslookup example.com 8.8.8.8

# Interactive mode
$ nslookup
> server 8.8.8.8
Default server: 8.8.8.8
Address: 8.8.8.8#53
> set type=MX
> example.com
example.com    mail exchanger = 10 mail.example.com.
> exit

# Reverse lookup
$ nslookup 93.184.216.34
```

### 6.3 The host Command

`host` is a simpler version of dig that produces more human-readable output.

```bash
# ============================================================
# Code example 3: Using the host command
# ============================================================

# Basic query
$ host example.com
example.com has address 93.184.216.34
example.com has IPv6 address 2606:2800:220:1:248:1893:25c8:1946
example.com mail is handled by 0 .

# Specific record types
$ host -t MX example.com
example.com mail is handled by 10 mail.example.com.

$ host -t NS example.com
example.com name server ns1.example.com.
example.com name server ns2.example.com.

# Reverse lookup
$ host 93.184.216.34
34.216.184.93.in-addr.arpa domain name pointer example.com.

# Verbose output (closer to dig format)
$ host -v example.com

# Query a specific DNS server
$ host example.com 8.8.8.8
```

### 6.4 Zone File Configuration Example

A complete example of a zone file used with authoritative DNS servers like BIND.

```bash
# ============================================================
# Code example 4: BIND zone file (/etc/bind/zones/example.com.zone)
# ============================================================

$TTL 3600                              ; Default TTL = 1 hour
$ORIGIN example.com.                   ; Zone origin

; ── SOA record ──
@   IN  SOA  ns1.example.com.  admin.example.com. (
            2024031501    ; serial number (YYYYMMDDNN format)
            3600          ; refresh (1 hour)
            900           ; retry (15 minutes)
            604800        ; expire (7 days)
            86400         ; negative cache TTL (1 day)
          )

; ── NS records ──
@           IN  NS    ns1.example.com.
@           IN  NS    ns2.example.com.

; ── A records (IPv4) ──
@           IN  A     93.184.216.34
www         IN  A     93.184.216.34
api         IN  A     10.0.1.100
api         IN  A     10.0.1.101         ; round-robin
staging     IN  A     10.0.2.50

; ── AAAA records (IPv6) ──
@           IN  AAAA  2606:2800:220:1:248:1893:25c8:1946

; ── CNAME records ──
blog        IN  CNAME example.github.io.
shop        IN  CNAME shops.myshopify.com.
docs        IN  CNAME example-docs.netlify.app.

; ── MX records ──
@           IN  MX  10  mail1.example.com.
@           IN  MX  20  mail2.example.com.

; ── TXT records ──
@           IN  TXT   "v=spf1 ip4:93.184.216.0/24 include:_spf.google.com ~all"
_dmarc      IN  TXT   "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"

; ── SRV record ──
_sip._tcp   IN  SRV   10 60 5060 sipserver.example.com.

; ── CAA records ──
@           IN  CAA   0 issue "letsencrypt.org"
@           IN  CAA   0 issuewild "letsencrypt.org"

; ── NS server A records ──
ns1         IN  A     198.51.100.1
ns2         IN  A     198.51.100.2

; ── Mail server A records ──
mail1       IN  A     198.51.100.10
mail2       IN  A     198.51.100.11
```

### 6.5 resolv.conf and systemd-resolved Configuration

```bash
# ============================================================
# Code example 5: Client-side DNS configuration
# ============================================================

# --- /etc/resolv.conf ---
# Basic configuration
nameserver 8.8.8.8          # Primary DNS (Google)
nameserver 8.8.4.4          # Secondary DNS (Google)
nameserver 1.1.1.1          # Tertiary DNS (Cloudflare)

search example.com internal.example.com
# → Searching "myhost" tries resolution in this order:
#    1. myhost.example.com
#    2. myhost.internal.example.com
#    3. myhost (as FQDN)

options timeout:2 attempts:3 rotate
# timeout:2  → 2-second timeout per query
# attempts:3 → retry up to 3 times
# rotate     → use name servers in round-robin order

# --- systemd-resolved configuration ---
# /etc/systemd/resolved.conf
[Resolve]
DNS=8.8.8.8 1.1.1.1
FallbackDNS=8.8.4.4 9.9.9.9
Domains=~.
DNSSEC=allow-downgrade
DNSOverTLS=opportunistic
Cache=yes
DNSStubListener=yes

# Check systemd-resolved status
$ resolvectl status
Global
       Protocols: +LLMNR +mDNS -DNSOverTLS DNSSEC=allow-downgrade/supported
resolv.conf mode: stub
     DNS Servers: 8.8.8.8 1.1.1.1
Fallback DNS Servers: 8.8.4.4 9.9.9.9

# Check cache statistics
$ resolvectl statistics
DNSSEC supported: yes
Current Transactions: 0
  Total Transactions: 12345
  Current Cache Size: 234
          Cache Hits: 5678
        Cache Misses: 6789

# Flush cache
$ resolvectl flush-caches
```

---

## 7. DNS Security

### 7.1 Major Threats to DNS

```
DNS threat model:

  ┌──────────────────────────────────────────────────────────────┐
  │                    DNS attack classification                  │
  ├──────────────────┬───────────────────────────────────────────┤
  │ DNS spoofing     │ Injects fake DNS responses to redirect     │
  │ (DNS poisoning)  │ users to fake sites. Inserts fake records  │
  │                  │ into the cache.                            │
  │                  │ Countermeasures: DNSSEC, source port       │
  │                  │ randomization                              │
  ├──────────────────┼───────────────────────────────────────────┤
  │ DNS amplification│ Sends a large volume of DNS queries with   │
  │ attack (DDoS)    │ a spoofed source IP. Responses flood the   │
  │                  │ victim, saturating bandwidth.              │
  │                  │ Countermeasures: rate limiting, eliminate  │
  │                  │ open resolvers, BCP38 (source validation)  │
  ├──────────────────┼───────────────────────────────────────────┤
  │ DNS hijacking    │ Takeover of registrar accounts,            │
  │                  │ unauthorized modification of zone files.   │
  │                  │ Countermeasures: registrar lock, two-factor│
  │                  │ authentication                             │
  ├──────────────────┼───────────────────────────────────────────┤
  │ DNS eavesdropping│ Intercepts plaintext DNS queries to track  │
  │                  │ user browsing behavior.                    │
  │                  │ Countermeasures: DoH (DNS over HTTPS),     │
  │                  │ DoT (DNS over TLS)                         │
  ├──────────────────┼───────────────────────────────────────────┤
  │ NXDOMAIN         │ ISP intercepts queries for non-existent    │
  │ hijacking        │ domains and redirects to an ad page.       │
  │                  │ Countermeasures: DNSSEC validation, use    │
  │                  │ public DNS                                 │
  └──────────────────┴───────────────────────────────────────────┘
```

### 7.2 DNSSEC (DNS Security Extensions)

DNSSEC is a mechanism that cryptographically verifies the authenticity and integrity of DNS responses.

```
How DNSSEC works:

  Signing flow:
  1. Zone administrator signs records with ZSK (Zone Signing Key)
  2. ZSK is signed with KSK (Key Signing Key)
  3. Hash of KSK (DS record) is registered in the parent zone
  4. Parent zone signs the DS record with its own KSK
  5. A Chain of Trust is formed all the way to the root

  Chain of Trust:
  Root KSK (trust anchor: managed by IANA)
    ↓ verified by DS record
  .com KSK
    ↓ verified by DS record
  example.com KSK
    ↓ verified by ZSK
  www.example.com A  93.184.216.34  ← Cryptographically guaranteed not to be tampered with

  Additional record types:
  · RRSIG   : digital signature for each record set
  · DNSKEY  : zone's public keys (ZSK, KSK)
  · DS      : hash of child zone's DNSKEY (registered in parent zone)
  · NSEC/NSEC3 : proof that a record does not exist

  DNSSEC verification with dig:
  $ dig +dnssec example.com A
  → If the flags include "ad," DNSSEC validation succeeded
  → ad = Authentic Data
```

### 7.3 DoH / DoT (Encrypted DNS)

In contrast to traditional DNS (Do53: plaintext UDP/TCP on port 53), encrypted DNS protocols have emerged.

| Item | Do53 (traditional DNS) | DoT (DNS over TLS) | DoH (DNS over HTTPS) |
|---------|----------------|---------------------|----------------------|
| Port | 53 (UDP/TCP) | 853 (TCP) | 443 (TCP) |
| Encryption | None | TLS | HTTPS (TLS) |
| Privacy | None (eavesdropping possible) | High | Very high |
| Firewall traversal | Easy | Can be blocked | Hard to block (mixed with HTTPS) |
| Latency | Minimal | TLS handshake overhead | HTTPS overhead |
| Supported resolvers | All | Cloudflare, Google, etc. | Cloudflare, Google, etc. |
| Standard | RFC 1035 | RFC 7858 | RFC 8484 |

---

## 8. DNS in Cloud Environments

### 8.1 AWS Route 53

Route 53 is a scalable managed DNS service provided by AWS. It has three functions: domain registration, DNS hosting, and health checks.

```
Route 53 key features:

  1. Domain registration
     → Register domains such as .com, .net, .org, .jp directly
     → WHOIS privacy protection included free
     → Domain lock prevents unauthorized transfers

  2. DNS hosting (authoritative DNS server)
     → Create hosted zones to manage records
     → Public hosted zone: for the Internet
     → Private hosted zone: for within a VPC
     → 100% availability SLA guaranteed

  3. Health check + routing
     → Health checks for endpoints (HTTP/HTTPS/TCP)
     → Automatic failover when anomaly detected
     → Monitoring and alerting integrated with CloudWatch

Route 53 routing policies:
  ┌───────────────┬──────────────────────────────────────────────┐
  │ Policy        │ Description and use case                     │
  ├───────────────┼──────────────────────────────────────────────┤
  │ Simple        │ Route to a single resource. Most basic.      │
  │               │ Example: single web server                   │
  ├───────────────┼──────────────────────────────────────────────┤
  │ Weighted      │ Distribute by percentage. For A/B testing,   │
  │               │ gradual migration.                           │
  │               │ Example: 10% to new version, 90% to old     │
  ├───────────────┼──────────────────────────────────────────────┤
  │ Latency       │ Route to the region with lowest latency.     │
  │               │ Example: JP users→Tokyo, US users→Virginia  │
  ├───────────────┼──────────────────────────────────────────────┤
  │ Failover      │ Automatically switch to secondary on primary │
  │               │ failure.                                     │
  │               │ Example: on EC2 failure, fall back to S3    │
  │               │ static site                                  │
  ├───────────────┼──────────────────────────────────────────────┤
  │ Geolocation   │ Route based on user's geographic location.   │
  │               │ Example: access from Japan → Japanese site  │
  ├───────────────┼──────────────────────────────────────────────┤
  │ Geoproximity  │ Based on geographic position of resources    │
  │               │ and bias values.                             │
  │               │ Example: fine control combined with Traffic  │
  │               │ Flow                                         │
  ├───────────────┼──────────────────────────────────────────────┤
  │ Multivalue    │ Returns up to 8 healthy IPs randomly.        │
  │               │ Example: simple load balancing (with health  │
  │               │ check)                                       │
  ├───────────────┼──────────────────────────────────────────────┤
  │ IP-based      │ Route based on client IP range.              │
  │               │ Example: users of specific ISP → optimal    │
  │               │ endpoint                                     │
  └───────────────┴──────────────────────────────────────────────┘

Alias records (AWS-specific extension):
  Standard CNAME:
    · Cannot be set at the zone apex (example.com)
    · 2 DNS queries occur (CNAME resolution + A resolution)
    · Query charges apply

  Route 53 alias record:
    · Can also be set at the zone apex
    · Queries to AWS resources are free
    · Targets: CloudFront, ELB, S3, API Gateway, VPC endpoints, etc.
    · Internally resolved as an A record (no additional query needed)
```

### 8.2 Comparison of Public DNS Services

| Service | Primary IP | Secondary IP | DoH | DoT | DNSSEC validation | Features |
|---------|------------|------------|-----|-----|-----------|------|
| Google Public DNS | 8.8.8.8 | 8.8.4.4 | Supported | Supported | Supported | Most widely used, high stability |
| Cloudflare DNS | 1.1.1.1 | 1.0.0.1 | Supported | Supported | Supported | Low latency, privacy-focused |
| Quad9 | 9.9.9.9 | 149.112.112.112 | Supported | Supported | Supported | Blocks malware domains |
| OpenDNS | 208.67.222.222 | 208.67.220.220 | Supported | Not supported | Supported | Filtering capabilities |

---

## 9. Anti-Patterns

### 9.1 Anti-Pattern 1: Forgetting the Trailing Dot in Zone Files

```
Anti-pattern: forgetting the trailing dot in CNAME or MX values

  Problematic zone file:
  ──────────────────────────────────────────
  $ORIGIN example.com.
  www   IN  CNAME  example.com       ← no trailing dot (dangerous)
  @     IN  MX  10 mail.example.com  ← no trailing dot (dangerous)
  ──────────────────────────────────────────

  BIND interpretation:
  · When $ORIGIN is example.com., names without a trailing dot automatically
    have $ORIGIN appended
  · In the above case:
    www IN CNAME example.com         → expands to example.com.example.com.
    @   IN MX 10 mail.example.com    → expands to mail.example.com.example.com.

  → References an unintended domain, causing name resolution failures
  → Difficult to identify the cause of the problem; debugging takes time

  Correct zone file:
  ──────────────────────────────────────────
  $ORIGIN example.com.
  www   IN  CNAME  example.com.       ← trailing dot present (correct)
  @     IN  MX  10 mail.example.com.  ← trailing dot present (correct)
  ──────────────────────────────────────────

  Prevention:
  · Always use FQDNs (with trailing dot) for values in zone files
  · Use the named-checkzone command to syntax-check zone files
    $ named-checkzone example.com /etc/bind/zones/example.com.zone
  · Incorporate automatic zone file validation into your CI/CD pipeline
```

### 9.2 Anti-Pattern 2: DNS Changes Without Considering TTL

```
Anti-pattern: making a sudden DNS change with a long TTL still in effect

  Situation:
  ──────────────────────────────────────────
  Current setting:
  example.com.  86400  IN  A  198.51.100.1    ← TTL = 24 hours

  An urgent server migration is needed:
  example.com.  86400  IN  A  203.0.113.50    ← only the IP is changed
  ──────────────────────────────────────────

  Problem:
  · The old record (198.51.100.1) is cached in resolvers worldwide for up to 24 hours
  · After the change, users with cached entries still access the old IP for up to 24 hours
  · If the old server is shut down, those users cannot connect

  What happens:
  ────────────────────────────────────────────────
  Time    Cache remaining  Access destination  Result
  ────────────────────────────────────────────────
  T+0     23h 59m          198.51.100.1       Failure
  T+6h    17h 59m          198.51.100.1       Failure
  T+12h   11h 59m          198.51.100.1       Failure
  T+18h   5h 59m           198.51.100.1       Failure
  T+24h   0                203.0.113.50       Success
  ────────────────────────────────────────────────
  → In the worst case, a 24-hour service outage occurs

  Correct procedure (repeated):
  1. Reduce TTL (to 300 seconds, etc.) and wait more than twice the old TTL
  2. Change the IP address
  3. After things stabilize, restore the TTL

  Emergency alternatives:
  · Set up a reverse proxy from the old IP to the new IP
  · Have the old server return a 301 redirect
  · If going through a CDN, change the CDN's origin configuration
```

---

## 10. Edge Case Analysis

### 10.1 Edge Case 1: CNAME Chains and Loops

```
Edge case: CNAME pointing to another CNAME (CNAME chain)

  Normal CNAME chain:
  ──────────────────────────────────────────
  www.example.com.     CNAME  lb.example.com.
  lb.example.com.      CNAME  us-east-1.elb.amazonaws.com.
  us-east-1.elb.amazonaws.com.  A  54.239.28.85
  ──────────────────────────────────────────
  → 3-level CNAME resolution occurs
  → Each level requires a DNS query (on cache miss)
  → Latency increases

  Problematic cases:
  1. CNAME chain too long
     → Many resolvers have a limit on chain depth (typically 8–16 levels)
     → Exceeding the limit returns SERVFAIL (name resolution failure)

  2. CNAME loop (circular reference)
     a.example.com.  CNAME  b.example.com.
     b.example.com.  CNAME  c.example.com.
     c.example.com.  CNAME  a.example.com.    ← loop
     → Resolver detects the loop and returns SERVFAIL
     → DNS queries are wasted until the loop is detected

  3. External service's CNAME target changes or is deleted
     shop.example.com.  CNAME  shops.myshopify.com.
     → If Shopify changes the domain, shop.example.com becomes unresolvable
     → A mechanism to monitor changes to external service CNAME targets is needed

  Recommendations:
  · Keep CNAME chains to a maximum of 2–3 levels
  · Replace CNAMEs within the zone with A records where possible
  · Regularly monitor the CNAME targets of external services
  · Introduce tests to detect CNAME loops
```

### 10.2 Edge Case 2: Negative Cache and Service Start Order

```
Edge case: negative cache poisoning during service deployment

  Scenario:
  ──────────────────────────────────────────
  1. Deploy a new service on Kubernetes
  2. Create a DNS record (api-v2.example.com)
  3. Health check queries DNS before deployment is complete
  4. Record is not yet propagated → NXDOMAIN is returned
  5. NXDOMAIN is cached as a negative cache (follows SOA TTL)
  6. Even after the record propagates, NXDOMAIN is returned during the cache period
  7. The service remains unavailable
  ──────────────────────────────────────────

  Timeline:
  T+0    DNS record created
  T+10s  Health check queries → NXDOMAIN (not yet propagated)
  T+30s  Record propagated to all authoritative servers
  T+30s  Health check queries again → still NXDOMAIN (cached)
  ...
  T+3600s Negative cache expires → finally returns normal response

  Prevention:
  1. Create the DNS record first, confirm propagation, then deploy the service
  2. Set SOA's negative cache TTL short (300 seconds recommended)
  3. Incorporate a DNS propagation check step in the deployment pipeline:
     $ until dig +short api-v2.example.com | grep -q .; do
     >   echo "Waiting for DNS propagation..."
     >   sleep 5
     > done
     $ echo "DNS record is live!"
  4. Verify propagation with multiple public DNS resolvers:
     $ dig @8.8.8.8 api-v2.example.com +short
     $ dig @1.1.1.1 api-v2.example.com +short
```

---

## 11. Exercises

### 11.1 Basic Exercises

```
Exercise 1 (basic): DNS record investigation

Objective: become comfortable obtaining DNS information using the dig command

Tasks:
  Obtain the specified records for the following domains using dig.

  1. Get the A record for google.com
     $ dig google.com A +noall +answer

  2. Get the MX record for google.com
     $ dig google.com MX +noall +answer

  3. Get the NS record for google.com
     $ dig google.com NS +noall +answer

  4. Get the TXT record (SPF) for google.com
     $ dig google.com TXT +noall +answer

  5. Get the reverse lookup (PTR record) for 93.184.216.34
     $ dig -x 93.184.216.34 +noall +answer

Verification points:
  · Record the TTL value of each record and consider what it means
  · Check the priority values of the MX records
  · Can you explain why multiple NS records are returned?

Expected learning outcomes:
  · Master basic usage of the dig command
  · Understand the output format of each record type
  · Understand the meaning of supplementary information such as TTL and priority
```

### 11.2 Applied Exercises

```
Exercise 2 (applied): Tracing and analyzing the DNS resolution flow

Objective: visualize the complete DNS name resolution process and understand each step

Tasks:
  1. Trace the complete name resolution process with dig +trace
     $ dig +trace www.example.com

     Analyze the output and answer the following questions:
     a) Which root DNS server was selected?
     b) Which TLD server for .com responded?
     c) What is the FQDN of the authoritative DNS server?
     d) What is the final IP address and TTL?

  2. Compare responses from different DNS resolvers
     $ dig @8.8.8.8 example.com +noall +answer +stats
     $ dig @1.1.1.1 example.com +noall +answer +stats
     $ dig @9.9.9.9 example.com +noall +answer +stats

     Analysis:
     a) Compare the Query time for each resolver
     b) Check if there are differences in the TTL values
     c) If there are differences, what is the reason?

  3. Examine the CNAME chain resolution process
     Find a domain that uses CNAME (e.g., a custom domain on GitHub Pages)
     and trace each stage of the chain

Verification points:
  · Can you identify which server responded at each step of the trace?
  · Can you distinguish between authoritative answers (aa flag) and non-authoritative ones?
  · Do you understand that the difference in Query time reflects cache hit/miss?

Expected learning outcomes:
  · Actually observe the complete DNS resolution process, connecting theory to practice
  · Understand the response characteristics of different resolvers
  · Understand the actual behavior of CNAME chains
```

### 11.3 Advanced Exercises

```
Exercise 3 (advanced): Zone file design and DNSSEC verification

Objective: develop authoritative DNS design skills and security verification skills

Task A: Zone file design
  Create a zone file that meets the following requirements.

  Domain: mycompany.example.com
  Requirements:
  · Web server (www): 203.0.113.10 and 203.0.113.11 (round-robin)
  · API server (api): 203.0.113.20
  · Staging (staging): CNAME to staging.herokuapp.com
  · Email: using Google Workspace
  · SPF record: allow Google and own IP (203.0.113.0/24)
  · DMARC record: quarantine policy, report to admin@mycompany.example.com
  · CAA record: allow Let's Encrypt only
  · TTL: 300 seconds for web server, 3600 seconds for mail-related, 86400 for NS

  Hints:
  · Refer to Google's documentation for Google Workspace MX record settings
  · Use SPF's include syntax
  · Set DMARC on subdomain _dmarc

Task B: DNSSEC verification
  1. Find a DNSSEC-enabled domain and verify it
     $ dig +dnssec +multi example.com A
     → Check for the presence of the ad flag

  2. Get and examine DNSKEY and RRSIG records
     $ dig example.com DNSKEY +noall +answer
     $ dig example.com RRSIG +noall +answer

  3. Get the DS record from the parent zone and verify the chain of trust
     $ dig example.com DS +noall +answer

  4. Verify with the delv command (BIND's DNSSEC verification tool)
     $ delv @8.8.8.8 example.com A +rtrace
     → If "fully validated" is displayed, verification succeeded

Task C: DNS failure simulation
  Reproduce the following scenarios in a local environment (/etc/hosts or dnsmasq),
  and verify the impact and remedies:
  1. Timeout behavior when the authoritative DNS server does not respond
  2. Fallback behavior to different DNS resolvers
  3. Impact of negative caching

Verification points:
  · Is the zone file syntax correct (verify with named-checkzone)?
  · Do you understand the DNSSEC chain of trust?
  · Can you predict behavior during failures and propose appropriate remedies?

Expected learning outcomes:
  · Skill to design and verify real zone files
  · Mastery of actual DNSSEC verification procedures
  · Foundational skills for DNS failure response
```

---

## 12. FAQ

### FAQ 1: How long does it take for DNS changes to propagate?

```
Q: I changed a DNS record but am still getting the old value. When will it propagate?

A: DNS change propagation time is determined by the following factors.

  1. TTL of the old record
     → TTL=3600 (1 hour): disappears from all caches in at most 1 hour
     → TTL=86400 (24 hours): at most 24 hours

  2. Resolver implementation
     → Some resolvers may not strictly follow TTL
     → May have a custom minimum TTL (e.g., at least 60 seconds)
     → RFC 8767 allows temporary use of stale cache when the authoritative server
       does not respond

  3. Application cache
     → Browser, OS, and router each cache independently
     → Some language runtimes (e.g., Java) cache DNS within the app
       (JVM defaults: 30 seconds for positive, 10 seconds for negative)

  How to verify:
  $ dig @8.8.8.8 example.com +short      # Google DNS
  $ dig @1.1.1.1 example.com +short      # Cloudflare DNS
  $ dig @ns1.example.com example.com +short  # Query authoritative DNS directly

  If querying the authoritative DNS directly returns the new value,
  the change itself is complete. You just need to wait for resolver caches to expire.

  Countermeasures:
  · Reduce TTL in advance (refer to best practices mentioned earlier)
  · Use dig +trace to directly check the response from the authoritative server
  · Use tools like whatsmydns.net to check propagation status worldwide
```

### FAQ 2: Should I use CNAME or A record?

```
Q: For DNS configuration of a web server, should I use CNAME or A record?

A: Choose based on the following criteria.

  When to use A records:
  ──────────────────────────────────────
  · Records at the zone apex (example.com)
    → CNAME cannot be set at the zone apex (RFC restriction)
  · When the IP address is fixed and not changing
  · When the minimum number of DNS queries is required
  · When coexisting with other records (MX, TXT, etc.) of the same name

  When to use CNAME:
  ──────────────────────────────────────
  · When pointing to an external service (CDN, PaaS, etc.)
    Example: blog.example.com → example.github.io
    → Automatically follows IP changes by the external service
  · When multiple subdomains point to the same destination
    → Only updating the CNAME target propagates to all subdomains
  · Services with dynamic IPs such as CloudFront and Heroku

  Decision flowchart:
  Is it the zone apex? → Yes → A record (or ALIAS/ANAME)
                       → No  → Is it an external service? → Yes → CNAME
                                                           → No  → A record
```

### FAQ 3: Is the term "DNS propagation" correct?

```
Q: I often hear "DNS propagation takes time." Is this accurate?

A: The term "DNS propagation" is strictly inaccurate and is considered a
   misleading term in the DNS industry.

  Incorrect understanding:
  "DNS changes gradually spread to all DNS servers worldwide"
  → Implies information spreading like water soaking in
  → In reality, no such mechanism exists

  Correct understanding:
  "Each cache's TTL expires and a new record is fetched"
  → DNS is "pull-type," not "push-type"
  → Each resolver updates its cache at its own timing
  → When the TTL expires, a new query is made and
    the latest record is obtained

  Why it looks like "propagation":
  · Resolvers worldwide each fetch the cache at different times
  · During the transition period, some users get the new IP and others the old IP
  · This appears as if it is "gradually spreading"

  Reality:
  When the pre-change TTL = 3600 seconds:
  · Resolvers whose cache expired immediately after the change → instantly get the new value
  · Resolvers that fetched the cache just before the change → get the new value after at most 3600 seconds
  · All resolvers have the new value after at most 3600 seconds

  More accurate phrasing:
  × "DNS propagation takes 24 hours"
  ○ "Since the old record's TTL is at most 24 hours,
    it takes up to 24 hours for all caches to be updated"
```

### FAQ 4: What happens if I set multiple A records for one domain?

```
Q: What is the behavior when multiple A records (with different IPs) are set for the same domain?

A: It operates as DNS round-robin.

  Configuration example:
  api.example.com.  300  IN  A  10.0.1.100
  api.example.com.  300  IN  A  10.0.1.101
  api.example.com.  300  IN  A  10.0.1.102

  Behavior:
  · The resolver returns all A records (order is random or round-robin)
  · The client typically tries to connect to the first IP in the list
  · If the first IP cannot be connected, the next IP is tried (app-dependent)

  Caveats:
  · No health check function → traffic is directed to failed servers too
  · Equal load distribution is not guaranteed → depends on client implementation
  · No session stickiness
  · For serious load balancing, use a load balancer (ALB, NLB, etc.)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

### Key Concepts

| Concept | Key point |
|------|---------|
| DNS | A distributed database system that converts domain names to IP addresses |
| FQDN | Complete domain name from the root (with trailing dot) |
| Recursive query | Client → resolver. The resolver returns a complete answer |
| Iterative query | Resolver → authoritative server. Returns a referral |
| TTL | Cache validity period. Design decisions determine operational quality |
| A record | Domain → IPv4 address mapping |
| CNAME record | Alias. Cannot be used at the zone apex |
| MX record | Mail delivery destination. Has a priority value |
| TXT record | Used for email authentication such as SPF, DKIM, DMARC |
| NS record | Specifies the authoritative name servers for a zone |
| SOA record | Zone management information. Includes negative cache TTL |
| DNSSEC | Extension that cryptographically verifies the authenticity of DNS responses |
| DoH / DoT | Encrypted DNS query protocols |
| Negative cache | Cache for NXDOMAIN. Pay attention when creating new records |

### Key Points

1. **DNS is a distributed hierarchical database**: Name resolution proceeds hierarchically from root servers to TLD and authoritative servers, avoiding single points of failure
2. **Understand the difference between recursive and iterative queries**: Client → resolver is a recursive query; resolver → authoritative server is an iterative query, each with different responsibilities
3. **TTL and caching support performance and resilience**: Appropriate TTL settings reduce DNS query load, improve response speed, and maintain flexibility when making changes

---

## Summary

In this guide, you learned:

- DNS is designed as a distributed hierarchical database, performing name resolution through a three-tier structure: root servers, TLD servers, and authoritative servers
- The difference between recursive queries (client → resolver) and iterative queries (resolver → authoritative server), and their respective responsibilities
- The purposes and configuration methods of major DNS records: A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, PTR, CAA
- TTL design involves a trade-off between cache efficiency and how quickly record changes propagate
- How DNS security extensions work: DNSSEC, DoH (DNS over HTTPS), and DoT (DNS over TLS)

---

## Next Guides to Read

- ../01-protocols/00-tcp.md -- TCP (transport layer protocol)
- ../01-protocols/01-tls.md -- TLS (transport layer security)
- ../01-protocols/02-http.md -- HTTP (application layer protocol)

---

## References

1. Mockapetris, P. "Domain Names - Concepts and Facilities." RFC 1034, IETF, November 1987. https://www.rfc-editor.org/rfc/rfc1034
2. Mockapetris, P. "Domain Names - Implementation and Specification." RFC 1035, IETF, November 1987. https://www.rfc-editor.org/rfc/rfc1035
3. Hoffman, P. and McManus, P. "DNS Queries over HTTPS (DoH)." RFC 8484, IETF, October 2018. https://www.rfc-editor.org/rfc/rfc8484
4. Hu, Z. et al. "Specification for DNS over Transport Layer Security (TLS)." RFC 7858, IETF, May 2016. https://www.rfc-editor.org/rfc/rfc7858
5. Arends, R. et al. "DNS Security Introduction and Requirements." RFC 4033, IETF, March 2005. https://www.rfc-editor.org/rfc/rfc4033
6. Cotton, M. et al. "DNS Terminology." RFC 8499, IETF, January 2019. https://www.rfc-editor.org/rfc/rfc8499
7. Cloudflare Learning Center. "What is DNS?" https://www.cloudflare.com/learning/dns/what-is-dns/
8. Amazon Web Services. "Amazon Route 53 Developer Guide." https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/
