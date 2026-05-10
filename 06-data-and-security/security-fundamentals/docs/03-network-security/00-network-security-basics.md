# Network Security Fundamentals

> A systematic study of network-layer security measures, focusing on firewalls, IDS/IPS, and VPNs

## What You Will Learn

1. **Firewall Types and Configuration** — Defense techniques ranging from packet filtering to application-layer firewalls
2. **Intrusion Detection and Prevention with IDS/IPS** — How to detect and block unauthorized traffic on the network
3. **Secure Communication with VPN** — Safe network connectivity using IPsec and WireGuard
4. **Zero Trust Architecture** — A modern network security model that goes beyond perimeter defense

## Prerequisites

- TCP/IP basics (IP addresses, port numbers, 3-way handshake)
- The role of each layer in the OSI reference model
- Basic Linux operations (command line, file editing)
- Basic concepts of cloud services (AWS/GCP)

---

## 1. Defense in Depth for Network Security

### Layers of Defense

Network security must not rely on a single defense mechanism. As NIST SP 800-207 and the MITRE ATT&CK framework demonstrate, attackers move through multiple phases (reconnaissance → initial access → lateral movement → objective completion), so Defense in Depth addressing each phase is essential.

```
+----------------------------------------------------------+
|                      Internet                            |
+----------------------------------------------------------+
          |
          v
+----------------------------------------------------------+
|  Layer 1: Perimeter Defense                              |
|  +-- Firewall (WAF / NGFW)                              |
|  +-- DDoS Mitigation (CloudFlare, AWS Shield)           |
|  +-- BGP Filtering / RPKI                               |
+----------------------------------------------------------+
          |
          v
+----------------------------------------------------------+
|  Layer 2: Network Segmentation                           |
|  +-- VLAN / VPC Subnets                                 |
|  +-- Micro-segmentation                                  |
|  +-- East-West Traffic Control                           |
+----------------------------------------------------------+
          |
          v
+----------------------------------------------------------+
|  Layer 3: Intrusion Detection/Prevention (IDS/IPS)       |
|  +-- Signature-based Detection                           |
|  +-- Anomaly Detection                                   |
|  +-- TLS Inspection                                      |
+----------------------------------------------------------+
          |
          v
+----------------------------------------------------------+
|  Layer 4: Host-based Defense                             |
|  +-- OS Firewall (iptables / nftables)                  |
|  +-- EDR (Endpoint Detection & Response)                |
|  +-- File Integrity Monitoring (AIDE / OSSEC)           |
+----------------------------------------------------------+
          |
          v
+----------------------------------------------------------+
|  Layer 5: Application Layer                              |
|  +-- TLS / mTLS                                         |
|  +-- Authentication & Authorization (OAuth 2.0 / OIDC) |
|  +-- Input Validation / Sanitization                    |
+----------------------------------------------------------+
```

### Why Defense in Depth Is Necessary

```
Attack scenario: Each layer progressively stops the attack

Attacker → [L1: WAF detects SQLi] → Blocked (80% of attacks stop here)
           ↓ (WAF bypass succeeds)
          [L2: Segmentation] → Direct access to DB subnet denied
           ↓ (Web server compromised)
          [L3: IPS detects C2 traffic] → Outbound suspicious traffic blocked
           ↓ (Encrypted C2 evades detection)
          [L4: EDR detects suspicious process] → Malware execution blocked
           ↓ (Living off the Land)
          [L5: mTLS rejects invalid certificate] → Access to other services denied

→ Even if one layer is breached, the next layer stops the attacker
```

### MITRE ATT&CK Mapping

| ATT&CK Phase | Defense Layer | Defense Mechanism |
|--------------|--------------|-------------------|
| Reconnaissance | L1 Perimeter | Rate limiting, port scan detection |
| Initial Access | L1 Perimeter | WAF, IPS signatures |
| Execution | L4 Host | EDR, application whitelisting |
| Persistence | L4 Host | File integrity monitoring, auditd |
| Lateral Movement | L2 Segmentation | Micro-segmentation, mTLS |
| Exfiltration | L3 IDS/IPS | DLP, DNS tunneling detection |
| C2 | L3 IDS/IPS | Anomaly detection, domain reputation |

---

## 2. Firewalls

### Firewall Types and Comparison

| Type | OSI Layer | Features | Processing Speed | Inspection Depth | Examples |
|------|-----------|----------|-----------------|-----------------|---------|
| Packet Filtering | L3-L4 | Allow/deny by IP/port | Fastest | Shallow | iptables, ACL |
| Stateful | L3-L4 | Tracks connection state | Fast | Moderate | nftables, pf |
| Application GW | L7 | Inspects protocol content | Moderate | Deep | Squid, HAProxy |
| NGFW | L3-L7 | IPS + app identification + SSL decryption | Slow | Deepest | Palo Alto, FortiGate |
| WAF | L7 | HTTP-specific attack defense | Moderate | HTTP only | AWS WAF, ModSecurity |

### Internal Operation of Packet Filtering

```
Incoming packet
    |
    v
+-- Header analysis --+
| Source IP           |
| Destination IP      |
| Protocol            |
| Source port         |
| Destination port    |
+--------------------+
    |
    v
+-- Rule table (evaluated top-down) --+
| Rule 1: ALLOW 10.0.0.0/8 → :22    |  ← Match → ACCEPT
| Rule 2: ALLOW any → :80            |  ← Match → ACCEPT
| Rule 3: ALLOW any → :443           |  ← Match → ACCEPT
| Rule N: DROP any → any (default)   |  ← Final rule
+-------------------------------------+
    |
    v
  ACCEPT / DROP / REJECT / LOG
```

### How Stateful Inspection Works

```
Connection tracking table (conntrack):

+------+----------+-----------+--------+-------+--------+--------+
| ID   | Protocol | Src IP    | Src    | Dst IP| Dst    | State  |
|      |          |           | Port   |       | Port   |        |
+------+----------+-----------+--------+-------+--------+--------+
| 1    | TCP      |192.168.1.5| 52341  | Web   | 443    | ESTAB  |
| 2    | TCP      |10.0.1.100 | 38912  | DB    | 5432   | ESTAB  |
| 3    | UDP      |192.168.1.5| 51234  | DNS   | 53     | NEW    |
+------+----------+-----------+--------+-------+--------+--------+

State transitions:
  NEW → SYN packet received
  ESTABLISHED → After SYN-ACK confirmed (bidirectional communication established)
  RELATED → Related connection (FTP data, ICMP error)
  INVALID → Invalid state transition → DROP

Advantages:
  - Return packets are automatically permitted (no individual rules needed)
  - Abnormalities such as SYN flood are detected via state transitions
  - More secure than packet filtering
```

### iptables/nftables Configuration Examples

```bash
# iptables: Practical configuration for production servers
# ============================================

# Flush rules
iptables -F
iptables -X
iptables -Z

# Default policy: deny all
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow established connections (stateful)
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Drop invalid packets (INVALID state)
iptables -A INPUT -m conntrack --ctstate INVALID -j DROP

# Allow SSH (22) only from management network + rate limiting
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 \
  -m conntrack --ctstate NEW \
  -m recent --set --name SSH
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 \
  -m conntrack --ctstate NEW \
  -m recent --update --seconds 60 --hitcount 4 --name SSH \
  -j DROP
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT

# Allow HTTP (80), HTTPS (443)
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow ICMP (ping) with rate limiting
iptables -A INPUT -p icmp --icmp-type echo-request \
  -m limit --limit 1/s --limit-burst 4 -j ACCEPT

# SYN flood protection
iptables -A INPUT -p tcp --syn \
  -m limit --limit 25/s --limit-burst 50 -j ACCEPT
iptables -A INPUT -p tcp --syn -j DROP

# Port scan detection (NULL scan)
iptables -A INPUT -p tcp --tcp-flags ALL NONE -j LOG --log-prefix "NULL_SCAN: "
iptables -A INPUT -p tcp --tcp-flags ALL NONE -j DROP

# Xmas scan detection
iptables -A INPUT -p tcp --tcp-flags ALL FIN,PSH,URG -j LOG --log-prefix "XMAS_SCAN: "
iptables -A INPUT -p tcp --tcp-flags ALL FIN,PSH,URG -j DROP

# Log then drop (final rule)
iptables -A INPUT -j LOG --log-prefix "IPT_DROP: " --log-level 4
iptables -A INPUT -j DROP
```

### Practical nftables (iptables successor) Configuration

```bash
#!/usr/sbin/nft -f
flush ruleset

# Define tables and chains
table inet filter {
    # IP set definition (dynamically manage block targets)
    set blocklist {
        type ipv4_addr
        flags timeout
        timeout 1h
    }

    set ratelimit_ssh {
        type ipv4_addr
        flags dynamic, timeout
        timeout 5m
    }

    # Input chain
    chain input {
        type filter hook input priority 0; policy drop;

        # Blocklist
        ip saddr @blocklist counter drop

        # Established connections
        ct state established,related accept

        # Invalid packets
        ct state invalid counter drop

        # Loopback
        iif lo accept

        # ICMP (rate limited)
        icmp type echo-request limit rate 2/second burst 5 packets accept
        icmpv6 type { echo-request, nd-neighbor-solicit, nd-router-advert } accept

        # SSH (management network + rate limiting)
        tcp dport 22 ip saddr 10.0.0.0/8 ct state new \
            add @ratelimit_ssh { ip saddr limit rate 3/minute } accept

        # Web services
        tcp dport { 80, 443 } accept

        # SYN flood protection
        tcp flags syn limit rate 25/second burst 50 accept
        tcp flags syn counter drop

        # Log & drop (final rule)
        log prefix "nft_drop: " counter drop
    }

    # Forward chain
    chain forward {
        type filter hook forward priority 0; policy drop;

        # Forwarding rules for Docker / containers
        iifname "docker0" oifname "eth0" accept
        iifname "eth0" oifname "docker0" ct state established,related accept
    }

    # Output chain
    chain output {
        type filter hook output priority 0; policy accept;

        # Restrict outbound DNS (DNS tunneling mitigation)
        udp dport 53 ip daddr != { 10.0.0.2, 8.8.8.8 } counter drop
    }
}
```

### iptables vs nftables Comparison

| Item | iptables | nftables |
|------|----------|---------|
| Kernel integration | xtables framework | nf_tables framework |
| Rule syntax | Command argument style | Structured DSL |
| Tables | Separate ip/ip6/arp/bridge | inet (IPv4/IPv6 unified) |
| Sets | ipset (separate tool) | Built-in sets |
| Atomic updates | iptables-restore | nft -f (default) |
| Performance | Linear rule evaluation | Optimized lookups |
| Dynamic rules | Difficult | Easy with set + map |
| Status | Current (legacy) | Recommended (successor) |

### AWS Security Group vs NACL Comparison

| Item | Security Group | Network ACL |
|------|---------------|-------------|
| Applied level | ENI (instance) | Subnet |
| Stateful | Yes (return traffic auto-allowed) | No (must explicitly allow) |
| Rules | Allow only | Allow + Deny |
| Evaluation order | All rules evaluated (OR) | Numbered order (first match) |
| Default | Deny all (inbound) | Allow all |
| Max rules | 60 (inbound + outbound) | 20 (each direction) |
| Applied at | Instance launch | Subnet creation |

```
VPC (10.0.0.0/16)
+---------------------------------------------------+
|  Public Subnet (10.0.1.0/24)                      |
|  [NACL: Allow HTTP/HTTPS, SSH from mgmt IP only]  |
|  [NACL: Allow ephemeral ports 1024-65535 OUT]     |
|                                                   |
|  +-- ALB ----+                                    |
|  |  SG: 80,443 from 0.0.0.0/0                    |
|  |  SG: 443 out to App-SG                        |
|  +------------+                                   |
+---------------------------------------------------+
|  Private Subnet (10.0.2.0/24)                     |
|  [NACL: Allow 8080 from ALB Subnet only]          |
|  [NACL: Allow OUT to NAT GW]                      |
|                                                   |
|  +-- App Server --+                               |
|  |  SG: 8080 from ALB-SG only                    |
|  |  SG: 5432 out to DB-SG                        |
|  +-----------------+                              |
+---------------------------------------------------+
|  Data Subnet (10.0.3.0/24)                        |
|  [NACL: Allow 5432 from App Subnet only]          |
|  [NACL: OUT to App Subnet only]                   |
|                                                   |
|  +-- RDS ----------+                              |
|  |  SG: 5432 from App-SG only                    |
|  |  SG: No outbound rules                        |
|  +------------------+                             |
+---------------------------------------------------+
```

### Traffic Monitoring with VPC Flow Logs

```python
import boto3
import gzip
import json
from datetime import datetime, timedelta

# Enable VPC Flow Logs (Terraform)
"""
resource "aws_flow_log" "vpc_flow" {
  vpc_id          = aws_vpc.main.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn

  # Custom format (additional fields)
  log_format = "$${version} $${account-id} $${interface-id} $${srcaddr} $${dstaddr} $${srcport} $${dstport} $${protocol} $${packets} $${bytes} $${start} $${end} $${action} $${log-status} $${tcp-flags} $${flow-direction}"
}
"""

# Analyze flow logs with Athena: suspicious traffic patterns
SUSPICIOUS_TRAFFIC_QUERY = """
-- Large volumes of REJECTED traffic (signs of port scanning)
SELECT
    srcaddr,
    dstport,
    COUNT(*) as reject_count,
    SUM(bytes) as total_bytes
FROM vpc_flow_logs
WHERE action = 'REJECT'
  AND start > to_unixtime(now() - interval '1' hour)
GROUP BY srcaddr, dstport
HAVING COUNT(*) > 100
ORDER BY reject_count DESC
LIMIT 50;
"""

# Detect anomalous outbound traffic (signs of data exfiltration)
DATA_EXFIL_QUERY = """
SELECT
    srcaddr,
    dstaddr,
    dstport,
    SUM(bytes) as total_bytes,
    COUNT(*) as flow_count
FROM vpc_flow_logs
WHERE flow_direction = 'egress'
  AND dstaddr NOT LIKE '10.%'
  AND dstaddr NOT LIKE '172.16.%'
  AND start > to_unixtime(now() - interval '1' hour)
GROUP BY srcaddr, dstaddr, dstport
HAVING SUM(bytes) > 1073741824  -- Over 1GB
ORDER BY total_bytes DESC;
"""
```

---

## 3. IDS/IPS

### Differences Between IDS and IPS

```
IDS (Intrusion Detection System) - Passive mode:
  Network
  traffic ----+----> Destination (traffic passes through unchanged)
              |
              | (mirroring/TAP)
              v
            IDS engine
              |
              v
        Alert generated → SIEM → SOC team

IPS (Intrusion Prevention System) - Inline mode:
  Network
  traffic ----> IPS engine ----> Destination
                  |
                  +-- Normal → Pass
                  +-- Malicious → Block + Alert
                  +-- Suspicious → Log + Pass (tagged)

Hybrid mode (recommended):
  Traffic ----> IPS (inline) ----> Destination
                  |
                  | (copy)
                  v
                IDS (detection only)
                  |
                  v
            Advanced analysis (ML/AI)
```

### Detection Method Comparison

| Method | Mechanism | Advantages | Disadvantages |
|--------|-----------|-----------|--------------|
| Signature-based | Match against known attack patterns | High accuracy, few false positives | Cannot detect unknown attacks |
| Anomaly detection | Deviation from statistical model of normal traffic | Can detect unknown attacks | Many false positives, requires learning period |
| Protocol analysis | Compare against RFC-compliant protocol behavior | Reliably detects protocol anomalies | Coverage limited to protocols |
| Heuristic | Combines multiple weak signals | Difficult to evade | Complex tuning |
| ML/AI-based | Classification using machine learning models | Adaptive, pattern recognition | Black box, high computation cost |

### Practical Suricata (Open Source IDS/IPS) Configuration

```yaml
# /etc/suricata/suricata.yaml (production environment settings)
%YAML 1.1
---

# Network definitions
vars:
  address-groups:
    HOME_NET: "[10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]"
    EXTERNAL_NET: "!$HOME_NET"
    DNS_SERVERS: "[10.0.0.2/32]"
    HTTP_SERVERS: "[10.0.1.0/24]"
    SQL_SERVERS: "[10.0.3.0/24]"

  port-groups:
    HTTP_PORTS: "[80, 8080, 8443]"
    HTTPS_PORTS: "443"
    DNS_PORTS: "53"
    SSH_PORTS: "22"

# Performance tuning
threading:
  set-cpu-affinity: yes
  detect-thread-ratio: 1.5

# Detection engine
detect:
  profile: high      # high / medium / low
  custom-values:
    toclient-groups: 50
    toserver-groups: 50
  sgh-mpm-context: auto
  inspection-recursion-limit: 3000

# EVE JSON logging (SIEM integration)
outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: /var/log/suricata/eve.json
      types:
        - alert:
            tagged-packets: yes
            metadata: yes
        - http:
            extended: yes
        - dns:
            query: yes
            answer: yes
        - tls:
            extended: yes
            session-resumption: yes
        - flow
        - stats:
            totals: yes
            threads: yes

# Rule files
default-rule-path: /etc/suricata/rules
rule-files:
  - suricata.rules          # ET Open rules
  - local.rules             # Custom rules
  - emerging-exploit.rules  # Exploit detection
  - emerging-malware.rules  # Malware detection

# IPS mode settings (AF_PACKET inline mode)
af-packet:
  - interface: eth0
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes
    use-mmap: yes
    ring-size: 200000
    block-size: 262144
    copy-mode: ips           # IPS mode
    copy-iface: eth1         # Output interface
```

### Creating Custom Rules (Practical)

```bash
# /etc/suricata/rules/local.rules
# ============================================

# --- SQL Injection detection (high precision) ---
alert http $EXTERNAL_NET any -> $HTTP_SERVERS $HTTP_PORTS (
    msg:"SQL Injection - UNION SELECT";
    flow:to_server,established;
    http.uri;
    content:"UNION"; nocase;
    content:"SELECT"; nocase; distance:0;
    pcre:"/UNION\s+(ALL\s+)?SELECT/Ui";
    classtype:web-application-attack;
    sid:1000001; rev:2;
    metadata:attack_target web_server, deployment perimeter;
)

# --- SQL Injection (Time-based Blind) ---
alert http $EXTERNAL_NET any -> $HTTP_SERVERS $HTTP_PORTS (
    msg:"SQL Injection - Time-based Blind (SLEEP/BENCHMARK)";
    flow:to_server,established;
    http.uri;
    pcre:"/(?:SLEEP|BENCHMARK|WAITFOR\s+DELAY|pg_sleep)\s*\(/Ui";
    classtype:web-application-attack;
    sid:1000010; rev:1;
)

# --- SSH brute force detection ---
alert ssh $EXTERNAL_NET any -> $HOME_NET $SSH_PORTS (
    msg:"SSH Brute Force Attempt";
    flow:to_server;
    threshold: type both, track by_src, count 5, seconds 60;
    classtype:attempted-admin;
    sid:1000002; rev:1;
)

# --- C2 communication detection (DNS tunneling) ---
alert dns $HOME_NET any -> any $DNS_PORTS (
    msg:"Possible DNS Tunneling - Long Query";
    dns.query;
    pcre:"/^.{50,}\./";     # Subdomain over 50 characters
    threshold: type both, track by_src, count 10, seconds 60;
    classtype:trojan-activity;
    sid:1000003; rev:2;
)

# --- DNS tunneling (high entropy) ---
alert dns $HOME_NET any -> any $DNS_PORTS (
    msg:"Possible DNS Tunneling - High Entropy Subdomain";
    dns.query;
    # Long subdomain encoded in Base64/Hex
    pcre:"/^[a-zA-Z0-9+\/=]{30,}\./";
    threshold: type both, track by_src, count 5, seconds 120;
    classtype:trojan-activity;
    sid:1000004; rev:1;
)

# --- Cryptocurrency mining communication detection ---
alert tls $HOME_NET any -> $EXTERNAL_NET any (
    msg:"Cryptomining - Stratum Protocol over TLS";
    flow:to_server,established;
    tls.sni; content:"pool"; nocase;
    pcre:"/(?:mining|pool|stratum|xmr|monero|coinhive)/i";
    classtype:trojan-activity;
    sid:1000005; rev:1;
)

# --- Suspicious user agent ---
alert http $HOME_NET any -> $EXTERNAL_NET any (
    msg:"Suspicious User-Agent - Possible Bot/Scanner";
    flow:to_server,established;
    http.user_agent;
    pcre:"/^(?:python-requests|curl|wget|nikto|sqlmap|nmap)/i";
    classtype:web-application-attack;
    sid:1000006; rev:1;
)

# --- ICMP tunneling detection ---
alert icmp $HOME_NET any -> $EXTERNAL_NET any (
    msg:"Possible ICMP Tunneling - Large Payload";
    icode:0;
    itype:8;
    dsize:>800;    # Normal ping is 64 bytes
    threshold: type both, track by_src, count 5, seconds 60;
    classtype:trojan-activity;
    sid:1000007; rev:1;
)

# --- Lateral Movement: SMB/RPC ---
alert tcp $HOME_NET any -> $HOME_NET [139,445] (
    msg:"Possible Lateral Movement - Internal SMB";
    flow:to_server,established;
    content:"|FF|SMB"; offset:4; depth:4;
    classtype:attempted-admin;
    sid:1000008; rev:1;
)
```

### Suricata Alert Analysis and Automated Response

```python
import json
import subprocess
from datetime import datetime
from collections import defaultdict
from pathlib import Path

class SuricataAlertAnalyzer:
    """Analyzes Suricata EVE JSON logs and performs automated responses"""

    def __init__(self, eve_log_path: str = "/var/log/suricata/eve.json"):
        self.eve_log_path = Path(eve_log_path)
        self.alert_counts = defaultdict(int)
        self.blocked_ips = set()

    def parse_alerts(self, minutes: int = 5) -> list[dict]:
        """Parse alerts from the last N minutes"""
        alerts = []
        cutoff = datetime.utcnow().timestamp() - (minutes * 60)

        with open(self.eve_log_path) as f:
            for line in f:
                try:
                    event = json.loads(line)
                    if event.get("event_type") != "alert":
                        continue
                    ts = datetime.fromisoformat(
                        event["timestamp"].replace("Z", "+00:00")
                    ).timestamp()
                    if ts >= cutoff:
                        alerts.append(event)
                except (json.JSONDecodeError, KeyError):
                    continue
        return alerts

    def aggregate_by_source(self, alerts: list[dict]) -> dict:
        """Aggregate alerts by source IP"""
        by_src = defaultdict(lambda: {"count": 0, "signatures": set(), "severity": 0})
        for alert in alerts:
            src = alert.get("src_ip", "unknown")
            sig = alert["alert"]["signature"]
            severity = alert["alert"].get("severity", 3)
            by_src[src]["count"] += 1
            by_src[src]["signatures"].add(sig)
            by_src[src]["severity"] = max(by_src[src]["severity"], severity)
        return dict(by_src)

    def auto_block(self, ip: str, duration_hours: int = 1):
        """Dynamically block an IP with nftables"""
        if ip in self.blocked_ips:
            return
        subprocess.run([
            "nft", "add", "element", "inet", "filter",
            "blocklist", f"{{ {ip} timeout {duration_hours}h }}"
        ], check=True)
        self.blocked_ips.add(ip)
        print(f"[BLOCK] {ip} blocked for {duration_hours} hour(s)")

    def respond_to_alerts(self):
        """Automated response based on alerts"""
        alerts = self.parse_alerts(minutes=5)
        by_src = self.aggregate_by_source(alerts)

        for ip, info in by_src.items():
            # High severity or large volume of alerts → auto-block
            if info["severity"] <= 1 or info["count"] >= 20:
                self.auto_block(ip, duration_hours=4)
            elif info["count"] >= 10:
                self.auto_block(ip, duration_hours=1)


# Usage example
if __name__ == "__main__":
    analyzer = SuricataAlertAnalyzer()
    analyzer.respond_to_alerts()
```

### Snort vs Suricata Comparison

| Item | Snort 3 | Suricata |
|------|---------|----------|
| Multi-threading | Supported (3.x+) | Native support |
| Protocol analysis | AppID | Built-in (HTTP, TLS, DNS, etc.) |
| Rule compatibility | Snort-specific | Snort-compatible + own extensions |
| Output format | Unified2, JSON | EVE JSON (structured) |
| TLS inspection | Supported | Supported (JA3/JA4 fingerprint) |
| File extraction | Supported | Supported |
| Lua scripting | Supported | Supported |
| License | GPL v2 | GPL v2 |
| Community | Cisco-led | OISF-led (open) |

---

## 4. VPN

### VPN Protocol Comparison Overview

| Item | IPsec (IKEv2) | WireGuard | OpenVPN | L2TP/IPsec |
|------|--------------|-----------|---------|-----------|
| Lines of code | ~400,000 | ~4,000 | ~100,000 | ~400,000 |
| Cryptography | Negotiable (many options) | Noise Protocol (fixed) | OpenSSL (many options) | IPsec-dependent |
| Performance | Moderate | Fastest | Moderate | Low |
| Configuration complexity | High | Low | Moderate | High |
| Protocol | ESP (IP 50) | UDP | UDP/TCP | UDP 1701 |
| State management | Complex (SA, SPD) | Stateless | TLS session | Complex |
| Mobile support | IKEv2 MOBIKE | Built-in | App required | OS built-in |
| NAT traversal | NAT-T (UDP 4500) | Native (UDP) | Native | May be difficult |
| Auditability | Difficult (complex) | Easy (small) | Moderate | Difficult |
| PFS | Configuration-dependent | Always enabled | Configuration-dependent | Configuration-dependent |

### WireGuard Internal Operation

```
WireGuard Noise Protocol IK Handshake:

Initiator (Client)                       Responder (Server)
    |                                        |
    |  1. Handshake Initiation               |
    |  [sender_index, ephemeral_pub,         |
    |   encrypted_static, encrypted_ts]      |
    |  ----→  (Noise_IKpsk2)  ----→          |
    |                                        |
    |  2. Handshake Response                 |
    |  [sender_index, receiver_index,        |
    |   ephemeral_pub, encrypted_nothing]    |
    |  ←----  (Noise_IKpsk2)  ←----         |
    |                                        |
    |  === Transport Data ===                |
    |  3. Transport Data                     |
    |  [receiver_index, counter,             |
    |   encrypted_payload (ChaCha20Poly1305)]|
    |  ←============================→        |
    |                                        |

Cryptographic primitives (fixed, no negotiation):
  - Curve25519 (ECDH)
  - ChaCha20-Poly1305 (AEAD)
  - BLAKE2s (hash)
  - SipHash (hash table key)
  - HKDF (key derivation)

Advantage: Eliminates cryptographic agility → downgrade attacks are impossible
```

### WireGuard Configuration (Server)

```bash
# Key generation
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
chmod 600 /etc/wireguard/server_private.key

# Server configuration (/etc/wireguard/wg0.conf)
[Interface]
PrivateKey = SERVER_PRIVATE_KEY
Address = 10.200.0.1/24
ListenPort = 51820

# IP forwarding and NAT
PostUp = sysctl -w net.ipv4.ip_forward=1
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostUp = iptables -A INPUT -p udp --dport 51820 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D INPUT -p udp --dport 51820 -j ACCEPT

# DNS (using Unbound as local DNS)
# PostUp = systemctl start unbound

[Peer]
# Client A (developer)
PublicKey = CLIENT_A_PUBLIC_KEY
AllowedIPs = 10.200.0.2/32
# PresharedKey = PSK_A  # Additional layer for quantum resistance

[Peer]
# Client B (operations team)
PublicKey = CLIENT_B_PUBLIC_KEY
AllowedIPs = 10.200.0.3/32
```

### WireGuard Configuration (Client)

```bash
# Client configuration
[Interface]
PrivateKey = CLIENT_PRIVATE_KEY
Address = 10.200.0.2/24
DNS = 10.200.0.1

# Kill Switch (block all traffic when VPN disconnects)
PostUp = iptables -I OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT
PreDown = iptables -D OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT

[Peer]
PublicKey = SERVER_PUBLIC_KEY
Endpoint = vpn.example.com:51820
AllowedIPs = 0.0.0.0/0, ::/0   # Route all traffic through VPN
PersistentKeepalive = 25
```

### Automating WireGuard Peer Management

```python
import subprocess
import ipaddress
from dataclasses import dataclass
from pathlib import Path

@dataclass
class WireGuardPeer:
    name: str
    public_key: str
    allowed_ips: str
    preshared_key: str | None = None

class WireGuardManager:
    """Manages adding, removing, and listing WireGuard peers"""

    def __init__(self, interface: str = "wg0"):
        self.interface = interface
        self.config_path = Path(f"/etc/wireguard/{interface}.conf")
        self.next_ip = ipaddress.IPv4Address("10.200.0.10")

    def generate_peer_config(self, peer_name: str) -> tuple[str, str]:
        """Generate a key pair and client config for a new peer"""
        # Key generation
        private_key = subprocess.run(
            ["wg", "genkey"], capture_output=True, text=True
        ).stdout.strip()
        public_key = subprocess.run(
            ["wg", "pubkey"], input=private_key,
            capture_output=True, text=True
        ).stdout.strip()

        # PSK generation (quantum resistance)
        psk = subprocess.run(
            ["wg", "genpsk"], capture_output=True, text=True
        ).stdout.strip()

        peer_ip = str(self.next_ip)
        self.next_ip += 1

        # Add to server configuration
        server_peer_config = f"""
[Peer]
# {peer_name}
PublicKey = {public_key}
PresharedKey = {psk}
AllowedIPs = {peer_ip}/32
"""

        # Generate client configuration
        server_pub = self._get_server_public_key()
        client_config = f"""[Interface]
PrivateKey = {private_key}
Address = {peer_ip}/24
DNS = 10.200.0.1

[Peer]
PublicKey = {server_pub}
PresharedKey = {psk}
Endpoint = vpn.example.com:51820
AllowedIPs = 10.0.0.0/8
PersistentKeepalive = 25
"""
        # Dynamically add peer to server
        subprocess.run([
            "wg", "set", self.interface,
            "peer", public_key,
            "preshared-key", "/dev/stdin",
            "allowed-ips", f"{peer_ip}/32",
        ], input=psk, text=True, check=True)

        return server_peer_config, client_config

    def revoke_peer(self, public_key: str):
        """Revoke a peer"""
        subprocess.run([
            "wg", "set", self.interface,
            "peer", public_key, "remove",
        ], check=True)

    def list_peers(self) -> list[dict]:
        """List connected peers"""
        result = subprocess.run(
            ["wg", "show", self.interface, "dump"],
            capture_output=True, text=True,
        )
        peers = []
        for line in result.stdout.strip().split("\n")[1:]:  # Skip header
            parts = line.split("\t")
            if len(parts) >= 7:
                peers.append({
                    "public_key": parts[0],
                    "endpoint": parts[2],
                    "allowed_ips": parts[3],
                    "latest_handshake": parts[4],
                    "transfer_rx": parts[5],
                    "transfer_tx": parts[6],
                })
        return peers

    def _get_server_public_key(self) -> str:
        result = subprocess.run(
            ["wg", "show", self.interface, "public-key"],
            capture_output=True, text=True,
        )
        return result.stdout.strip()
```

### IPsec (strongSwan) Configuration Example

```bash
# /etc/swanctl/swanctl.conf (strongSwan 5.x+)
connections {
    site-to-site {
        version = 2           # IKEv2
        local_addrs = 203.0.113.1
        remote_addrs = 198.51.100.1

        local {
            auth = pubkey
            certs = server.cert.pem
            id = vpn.example.com
        }
        remote {
            auth = pubkey
            id = remote.example.com
        }

        children {
            net-net {
                local_ts = 10.0.0.0/16     # Local network
                remote_ts = 172.16.0.0/16   # Remote network
                esp_proposals = aes256gcm128-x25519
                dpd_action = restart
                start_action = trap   # On-demand connection
            }
        }

        proposals = aes256-sha256-x25519
        rekey_time = 4h
        dpd_delay = 30s
    }
}
```

---

## 5. Network Segmentation

### Zero Trust Network

```
Traditional model (Castle-and-Moat):
+------------------------------------------------------+
|  "Trusted" network (corporate LAN)                   |
|                                                      |
|  +-- Server A --- Server B --- Server C              |
|  |   (Free communication, no authentication)         |
|  |                                                   |
|  +-- Dev PC --- Mgmt PC --- IoT device              |
|  |   (All on the same network)                       |
|  |                                                   |
|  Problem: If one machine is compromised, all are     |
|  reachable (Lateral Movement is easy)                |
+------------------------------------------------------+
   ^ Firewall (perimeter only)

Zero Trust (BeyondCorp / NIST SP 800-207):
+------------------------------------------------------+
|  All communication is verified (no implicit trust)   |
|                                                      |
|  +-- Server A --[mTLS + authz]--> Server B          |
|  |   (Service mesh: Istio / Linkerd)                 |
|  |                                                   |
|  +-- Server B --[mTLS + authz]--> Server C          |
|  |                                                   |
|  Each communication requires:                        |
|  1. Identity verification (mTLS / SPIFFE)            |
|  2. Device verification (patch level, EDR presence)  |
|  3. Context verification (time, location, risk score)|
|  4. Least privilege (per-request policy)             |
+------------------------------------------------------+
   ^ Micro-segmentation + Policy engine (OPA)
```

### Micro-segmentation Implementation Patterns

```
Approach 1: Network-based (VLAN / VPC)
+--------+    +--------+    +--------+
| Web    | -> | App    | -> | DB     |
| VLAN10 |    | VLAN20 |    | VLAN30 |
+--------+    +--------+    +--------+
  Allow: → App:8080   Allow: → DB:5432
  Deny: others        Deny: others

Approach 2: Host-based (iptables / Security Groups)
+--------+      +--------+      +--------+
| Web    | ---> | App    | ---> | DB     |
| SG-Web |      | SG-App |      | SG-DB  |
+--------+      +--------+      +--------+
Each SG strictly controls source/destination

Approach 3: Service mesh (Istio / Linkerd)
+--------+      +--------+      +--------+
| Web    | ---> | App    | ---> | DB     |
|+Envoy |  mTLS |+Envoy |  mTLS |+Envoy |
+--------+      +--------+      +--------+
   Istio AuthorizationPolicy for
   L7-level communication control (by method and path)

Approach 4: eBPF-based (Cilium)
+--------+      +--------+      +--------+
| Web    | ---> | App    | ---> | DB     |
|+Cilium |      |+Cilium |      |+Cilium |
+--------+      +--------+      +--------+
   Fast L3-L7 policy enforcement
   at the kernel level
```

### Kubernetes NetworkPolicy Implementation

```yaml
# Allow only Web → App (NetworkPolicy for App Pod)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-server-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: app-server
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow only port 8080 from web server
    - from:
        - podSelector:
            matchLabels:
              app: web-server
      ports:
        - protocol: TCP
          port: 8080
  egress:
    # Allow only port 5432 to DB
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - protocol: TCP
          port: 5432
    # Allow DNS (required)
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

### Istio AuthorizationPolicy (L7 Control)

```yaml
# Authorization control at API path level
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: app-server-authz
  namespace: production
spec:
  selector:
    matchLabels:
      app: app-server
  rules:
    # Allow only GET/POST from web server
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/web-server"]
      to:
        - operation:
            methods: ["GET", "POST"]
            paths: ["/api/v1/*"]
    # Admin API only for admin service
    - from:
        - source:
            principals: ["cluster.local/ns/admin/sa/admin-service"]
      to:
        - operation:
            methods: ["GET", "POST", "DELETE"]
            paths: ["/admin/*"]
  # Everything else is implicitly denied
```

---

## 6. DDoS Mitigation

### DDoS Attack Classification

```
+-----------------------------------------------------------+
|                DDoS Attack Classification                 |
|-----------------------------------------------------------|
|                                                           |
|  [Volumetric Attacks (L3/L4)]                             |
|  +-- UDP Flood: Large volumes of UDP packets             |
|  +-- ICMP Flood: Large volumes of ping packets           |
|  +-- DNS Amplification: DNS amplification (x50-70)       |
|  +-- NTP Amplification: NTP amplification (x556)         |
|  +-- Memcached Amplification: (x51,000)                  |
|  → Mitigation: Absorption via ISP / CDN (AWS Shield,     |
|    CloudFlare)                                            |
|                                                           |
|  [Protocol Attacks (L3/L4)]                               |
|  +-- SYN Flood: Large volumes of SYN packets             |
|  +-- Ping of Death: Oversized ICMP packets               |
|  +-- Smurf Attack: Broadcast ICMP                        |
|  → Mitigation: SYN Cookie, rate limiting, stateful FW    |
|                                                           |
|  [Application Attacks (L7)]                               |
|  +-- HTTP Flood: Large volumes of HTTP requests           |
|  +-- Slowloris: Holding connections for a long time       |
|  +-- RUDY: Slow POST sending                             |
|  +-- HTTP/2 Rapid Reset (CVE-2023-44487)                 |
|  → Mitigation: WAF, rate limiting, CAPTCHA               |
+-----------------------------------------------------------+
```

### SYN Flood Mitigation (SYN Cookie)

```
Normal TCP 3-way handshake:
Client              Server
  |--- SYN -------->|  (Stored in SYN queue)
  |<-- SYN-ACK -----|  (Memory allocated)
  |--- ACK -------->|  (ESTABLISHED)

SYN Flood attack:
Attacker   Server
  |--- SYN (fake IP1) -->|  SYN queue: [1]
  |--- SYN (fake IP2) -->|  SYN queue: [1,2]
  |--- SYN (fake IP3) -->|  SYN queue: [1,2,3]
  |--- SYN ...       -->|  SYN queue: [FULL] → New connections rejected

SYN Cookie mitigation:
Attacker   Server (SYN Cookie enabled)
  |--- SYN -------->|  Not stored in queue
  |<-- SYN-ACK -----|  ISN = hash(src,dst,port,secret,time)
  |                 |  (Stateless, no memory used)
  |  (No ACK)       |  → No resource consumption

Legitimate client  Server
  |--- SYN -------->|  Not stored in queue
  |<-- SYN-ACK -----|  ISN = hash(...)
  |--- ACK -------->|  ISN+1 validated → ESTABLISHED
```

```bash
# Enable SYN Cookie (Linux)
sysctl -w net.ipv4.tcp_syncookies=1
sysctl -w net.ipv4.tcp_max_syn_backlog=65536
sysctl -w net.ipv4.tcp_synack_retries=2

# Persist settings
echo "net.ipv4.tcp_syncookies = 1" >> /etc/sysctl.d/99-security.conf
echo "net.ipv4.tcp_max_syn_backlog = 65536" >> /etc/sysctl.d/99-security.conf
```

---

## 7. DNS Security (Overview)

### DNS Attacks and Countermeasures

```
+--------------------------------------------+
| DNS Attacks and Countermeasures             |
|--------------------------------------------|
| Attack              | Countermeasure        |
|--------------------------------------------|
| DNS Spoofing        | DNSSEC               |
| DNS Cache Poison    | Source port randomization |
| DNS Amplification   | Response rate limiting |
| DNS Tunneling       | DNS query monitoring/IDS |
| DNS Hijacking       | DoH/DoT (encrypted DNS) |
| Domain Shadowing    | Domain monitoring     |
+--------------------------------------------+
```

### How DNSSEC Works

```
Signature verification chain for DNS responses:

Root (.)
  |  KSK/ZSK signs DS record for .com
  v
.com
  |  KSK/ZSK signs DS record for example.com
  v
example.com
  |  ZSK signs A/AAAA/MX records
  v
www.example.com = 93.184.216.34 + RRSIG

Resolver verifies the signature at each level:
1. Holds root KSK (trust anchor)
2. Verifies DS record for .com
3. Verifies DS record for example.com
4. Verifies RRSIG for www.example.com
→ If tampering is detected, returns SERVFAIL
```

---

## 8. Anti-patterns

### Anti-pattern 1: Flat Network

```
Bad: All servers on the same subnet
  +-- Web Server --+
  +-- App Server --+-- Same segment (10.0.1.0/24)
  +-- DB Server  --+
  +-- Mgmt Server--+
  (DB directly reachable from the internet)
  (Compromising one server enables lateral movement to all)

Good: Subnet separation + micro-segmentation
  DMZ:     10.0.0.0/24 -- Reverse proxy/WAF only
  Public:  10.0.1.0/24 -- ALB only
  Private: 10.0.2.0/24 -- App Server (from ALB only)
  Data:    10.0.3.0/24 -- DB (port 5432 from App only)
  Mgmt:    10.0.4.0/24 -- Bastion (from VPN only)
```

**Impact**: Compromising one server allows lateral movement to all others. In the Capital One (2019) and SolarWinds (2020) incidents, a flat network configuration was one of the factors that amplified the damage.

### Anti-pattern 2: ANY-ANY Firewall Rules

```bash
# Bad: Allow all traffic (set during testing and left in production)
iptables -A INPUT -j ACCEPT

# Bad: Overly permissive security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol -1 --port -1 \
  --cidr 0.0.0.0/0

# Bad: SSH open to the entire internet
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp --port 22 \
  --cidr 0.0.0.0/0

# Good: Allow only the minimum necessary ports and sources
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp --port 443 \
  --cidr 0.0.0.0/0

# Good: SSH only via VPN/bastion
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp --port 22 \
  --source-group sg-bastion
```

### Anti-pattern 3: No Log Monitoring

```
Bad:
  → Firewall logs are not collected
  → IDS alerts are not reviewed
  → VPN connection logs are not retained
  → Average 197 days to detect a breach (IBM X-Force 2023)

Good:
  → All firewall logs aggregated in SIEM
  → Automated escalation for IDS alerts
  → Anomaly detection for VPN auth logs (late-night connections, unusual countries)
  → 24/7 monitoring by SOC team or MSSP
  → Incident response plan established and regularly drilled
```

### Anti-pattern 4: Full Access Granted Just by Connecting to VPN

```
Bad (traditional VPN):
  VPN connection → Full access to entire corporate network
  (A compromised PC reaches all systems via VPN)

Good (Zero Trust + VPN):
  VPN connection → Device verification → User authentication → Policy evaluation → Access to required services only
  (VPN only provides the encrypted tunnel; authorization is handled at a separate layer)
```

---

## 9. Exercises

### Exercise 1 (Basic): Build a Firewall with nftables

**Task**: Create an nftables configuration file that satisfies the following requirements.
- Default policy: INPUT DROP, FORWARD DROP, OUTPUT ACCEPT
- Allow loopback
- Allow established connections
- Allow SSH only from 192.168.1.0/24 (rate limit: 3/minute)
- Allow HTTP/HTTPS
- Allow ICMP echo-request at 1/second
- Log and DROP everything else

**Hint**: Combine `set` with `limit rate`.

### Exercise 2 (Advanced): Create Custom Suricata Rules

**Task**: Write Suricata rules to detect the following attacks.
1. HTTP request with an empty User-Agent (sign of a bot/scanner)
2. Large volume of DNS queries from the internal network to external (50+/minute, sign of DNS tunneling)
3. SSH connections from internal servers to external (traffic that should not normally occur)

**Hint**: Use the `threshold` and `flow` options.

### Exercise 3 (Practical): Build a WireGuard VPN

**Task**: Build a WireGuard VPN with the following configuration.
- Server: 10.200.0.1/24, port 51820
- 3 clients: 10.200.0.2-4/32
- Split Tunnel: Only 10.0.0.0/8 goes through VPN (rest communicates directly)
- Use PresharedKey (quantum resistance)
- Configure Kill Switch on clients

**Hint**: Control routing with `AllowedIPs`, implement Kill Switch with `PostUp/PostDown`.

---

## 10. Troubleshooting

### Debugging Firewalls

```bash
# iptables: Check packet counters
iptables -L -v -n --line-numbers

# nftables: Counters per rule
nft list ruleset -a

# conntrack: Connection tracking table
conntrack -L
conntrack -E   # Real-time events

# tcpdump: Packet capture
tcpdump -i eth0 -n 'port 443 and host 10.0.1.100'
tcpdump -i eth0 -n 'tcp[tcpflags] & (tcp-syn) != 0'  # SYN packets only

# ss: Socket statistics
ss -tlnp         # TCP listening ports
ss -s            # Socket statistics summary
```

### Troubleshooting VPN Connections

```bash
# WireGuard: Check status
wg show wg0

# WireGuard: Check handshake
wg show wg0 latest-handshakes
# 0 = Handshake not completed (key mismatch, FW, or routing issue)

# WireGuard: Enable debug logging
echo module wireguard +p > /sys/kernel/debug/dynamic_debug/control
dmesg | grep wireguard

# Diagnose MTU issues (packet fragmentation over VPN)
ping -M do -s 1400 10.200.0.1
# → "Frag needed" → Lower MTU (1280-1420)

# IPsec: Connection status
swanctl --list-sas
swanctl --log   # Real-time log
```

### IDS/IPS Performance Issues

```bash
# Suricata: Processing statistics
suricatasc -c "dump-counters" | grep -E "drop|bypass"

# Check packet drops
cat /proc/net/dev | grep eth0
# → RX dropped increasing → Expand AF_PACKET ring buffer

# Check CPU binding
suricatasc -c "iface-stat eth0"

# Rule profiling
suricata --engine-analysis
# → Identify high-load rules and optimize
```

---

## 11. Performance Considerations

### Firewall Performance

| Factor | Impact | Mitigation |
|--------|--------|-----------|
| Number of rules | O(n) linear evaluation | Use sets/maps, optimize rule order |
| conntrack table | Memory consumption | Tune `nf_conntrack_max` |
| Logging output | I/O bottleneck | Async logging, sampling |
| DPI (deep inspection) | CPU load | Hardware offload (FPGA/ASIC) |
| TLS inspection | CPU load (crypto processing) | SSL accelerator |

```bash
# conntrack table tuning
sysctl -w net.nf_conntrack_max=1048576
sysctl -w net.netfilter.nf_conntrack_tcp_timeout_established=3600
sysctl -w net.netfilter.nf_conntrack_tcp_timeout_time_wait=30

# nftables: Fast lookup using sets
# O(n) linear evaluation → O(1) hash lookup
table inet filter {
    set allowed_ips {
        type ipv4_addr
        flags interval
        elements = { 10.0.0.0/8, 172.16.0.0/12 }
    }
    chain input {
        ip saddr @allowed_ips tcp dport 22 accept
    }
}
```

---

## 12. FAQ

### Q1. What is the difference between WAF and NGFW?

A WAF specializes in HTTP/HTTPS traffic and defends against web attacks such as SQL injection and XSS. An NGFW inspects all network traffic at L3-L7, integrating application identification and IPS functionality. The two are complementary: the ideal setup for a web service is to place a WAF in front of the ALB and an NGFW at the VPC perimeter. WAFs excel at OWASP Top 10 web attacks, while NGFWs excel at network-wide visibility and control.

### Q2. Should I deploy IDS or IPS?

For production environments, deploying IPS inline for automatic blocking is recommended. However, due to the risk of blocking legitimate traffic from false positives, the following staged approach is safer:
1. Operate in IDS mode (detection only) for 2-4 weeks
2. Analyze alerts and identify false positive patterns
3. Tune suppression rules and thresholds
4. Gradually migrate to IPS mode (auto-blocking)
5. Initially pass low-severity alerts and block only high-severity
6. After tuning, enable IPS mode for all rules

### Q3. Can VPN and Zero Trust coexist?

Yes. VPN provides an encrypted tunnel at the network layer, and Zero Trust verifies each access request on top of that. However, the traditional operation of granting full access to the corporate network just by connecting to VPN is contrary to the Zero Trust philosophy. A practical configuration:
- VPN provides the encrypted tunnel (WireGuard / IPsec)
- Identity-Aware Proxy (Google BeyondCorp, Cloudflare Access) for per-application authentication
- Micro-segmentation to control East-West traffic
- SASE (Secure Access Service Edge) for integrated security

### Q4. What should network security look like in a Kubernetes environment?

In Kubernetes, the following multilayered approach is recommended:
1. **NetworkPolicy**: L3/L4 communication control between pods (CNI plugin dependent)
2. **Service mesh (Istio/Linkerd)**: mTLS + L7 authorization policies
3. **Cilium (eBPF)**: Kernel-level high-speed network policies
4. **Ingress Gateway**: Centralized management of external entry points
5. **Egress Gateway**: Control outbound traffic (data exfiltration prevention)

### Q5. How do you inspect encrypted traffic (TLS) with IDS/IPS?

TLS inspection has two approaches:
1. **TLS termination**: Terminate TLS at the load balancer/reverse proxy and pass plaintext to IDS/IPS (most common)
2. **TLS inspection**: NGFW/IPS acts as a man-in-the-middle to decrypt and re-encrypt TLS (privacy concerns)

JA3/JA4 fingerprinting can also identify client types without decrypting TLS (e.g., detecting malware C2).

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Defense in Depth | Defend at perimeter, network, host, and application layers; eliminate single points of failure |
| Firewall | Default deny, allow only the minimum necessary rules, nftables recommended |
| IDS/IPS | Signature + anomaly detection, staged migration from IDS to IPS, SIEM integration essential |
| VPN | WireGuard is superior in simplicity and performance, PFS always enabled |
| Segmentation | Prevent lateral movement with subnet isolation and micro-segmentation |
| Zero Trust | Verify all communications, eliminate implicit trust, mTLS + policy engine |
| DDoS mitigation | L3/L4 at infrastructure layer (CDN/Shield), L7 with WAF + rate limiting |
| DNS security | DNSSEC + DoH/DoT + query monitoring |
| Monitoring | Aggregate all logs in SIEM, automated alerts + SOC operations |

---

## Next Guides to Read

- [DNS Security](./01-dns-security.md) — Details on attacks and countermeasures at the DNS layer
- [API Security](./02-api-security.md) — Protecting APIs at the application layer
- [TLS/Certificates](../02-cryptography/01-tls-certificates.md) — Foundation of encrypted communication
- [Cloud Security](../05-cloud-security/00-cloud-security-basics.md) — Network security for AWS/GCP

---

## References

1. **NIST SP 800-41 Rev.1 — Guidelines on Firewalls and Firewall Policy** — https://csrc.nist.gov/publications/detail/sp/800-41/rev-1/final
2. **NIST SP 800-207 — Zero Trust Architecture** — https://csrc.nist.gov/publications/detail/sp/800-207/final
3. **NIST SP 800-94 — Guide to Intrusion Detection and Prevention Systems** — https://csrc.nist.gov/publications/detail/sp/800-94/final
4. **Suricata Documentation** — https://docs.suricata.io/en/latest/
5. **WireGuard — Conceptual Overview** — https://www.wireguard.com/papers/wireguard.pdf
6. **MITRE ATT&CK Framework** — https://attack.mitre.org/
7. **Kubernetes Network Policies** — https://kubernetes.io/docs/concepts/services-networking/network-policies/
8. **nftables Wiki** — https://wiki.nftables.org/
