# Network Debugging

> Systematically learn the tools and techniques needed to isolate and resolve network issues. Master major tools including tcpdump, Wireshark, Chrome DevTools, curl, and ss/netstat, and develop reproducible and efficient troubleshooting methods.

---

## What You Will Learn

- [ ] Understand how to use major network debugging tools (curl, dig, tcpdump, Wireshark, Chrome DevTools)
- [ ] Grasp problem isolation techniques corresponding to each layer of the OSI reference model
- [ ] Master the procedure for capturing, analyzing, and reporting packet captures
- [ ] Use Chrome DevTools Network tab to identify frontend communication issues
- [ ] Rapidly resolve problems by following a systematic troubleshooting decision tree
- [ ] Recognize and avoid anti-patterns in debugging

---

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- [TCP](../01-protocols/00-tcp.md) — 3-way handshake, window size, retransmission control mechanism
- [HTTP Basics](../02-http/00-http-basics.md) — HTTP methods, status codes, header basics
- [DNS](../00-introduction/03-dns.md) — Name resolution flow, record types, caching
- [TLS/SSL](../03-security/00-tls-ssl.md) — TLS handshake, certificate chain, cipher suites
- [IP Addressing](../00-introduction/02-ip-addressing.md) — IPv4/IPv6, subnets, NAT basics

---

## 1. Network Debugging Overview

Network problems are multi-layered, and it is important to select the appropriate tool for each layer. The following ASCII diagram shows the overall debugging flow.

### Figure 1: Overall Network Debugging Flow

```
+================================================================+
|              Network Debugging - Overall Flow                   |
+================================================================+
|                                                                |
|  [Problem Occurs]                                              |
|      |                                                         |
|      v                                                         |
|  +--------------------+                                        |
|  | 1. Clarify Symptoms|  What is happening?                    |
|  |    - Error messages |  Since when? What is the impact?      |
|  |    - Frequency      |  Steps to reproduce?                  |
|  |    - Affected scope |                                        |
|  +--------+-----------+                                        |
|           |                                                    |
|           v                                                    |
|  +--------------------+     +---------------------------+      |
|  | 2. Identify Layer  |---->| L1-L2: Physical/Data Link  |      |
|  |    Follow OSI model|     | Tools: ip link, ethtool   |      |
|  |    Check from top  |     +---------------------------+      |
|  +--------+-----------+     +---------------------------+      |
|           |            |--->| L3: Network Layer          |      |
|           |                 | Tools: ping, traceroute    |      |
|           |                 +---------------------------+      |
|           |                 +---------------------------+      |
|           |            |--->| L4: Transport Layer        |      |
|           |                 | Tools: ss, netstat, nc     |      |
|           |                 +---------------------------+      |
|           |                 +---------------------------+      |
|           |            |--->| L5-L7: Application Layer   |      |
|           |                 | Tools: curl, DevTools      |      |
|           |                 +---------------------------+      |
|           v                                                    |
|  +--------------------+                                        |
|  | 3. Form Hypothesis |  Build hypothesis of cause from info   |
|  +--------+-----------+                                        |
|           |                                                    |
|           v                                                    |
|  +--------------------+                                        |
|  | 4. Verify/Reproduce|  Gather evidence with tcpdump/Wireshark |
|  +--------+-----------+                                        |
|           |                                                    |
|           v                                                    |
|  +--------------------+                                        |
|  | 5. Fix/Confirm     |  Apply fix and confirm problem resolved |
|  +--------+-----------+                                        |
|           |                                                    |
|           v                                                    |
|  +--------------------+                                        |
|  | 6. Document        |  Record cause, fix, and prevention     |
|  +--------------------+                                        |
|                                                                |
+================================================================+
```

### Mapping of Debug Tools to OSI Layers

| OSI Layer | Layer Name | Major Debug Tools | Problems Detectable |
|:-----------:|:----------:|:------------------:|:-------------|
| L1 | Physical | `ethtool`, `ip link` | Cable break, NIC failure, link down |
| L2 | Data Link | `arp`, `ip neigh`, `bridge` | MAC address resolution failure, VLAN misconfiguration |
| L3 | Network | `ping`, `traceroute`, `mtr` | Routing issues, IP unreachable |
| L4 | Transport | `ss`, `netstat`, `nc`, `tcpdump` | Port not open, connection timeout, excessive retransmissions |
| L5-L7 | Session to Application | `curl`, `openssl`, `Chrome DevTools` | TLS errors, HTTP errors, application bugs |

---

## 2. HTTP Debugging with curl

curl is a versatile tool that can directly test HTTP/HTTPS communication from the command line. It can show detailed information about server response content, headers, timing, and TLS information.

### 2.1 Basic Usage

```bash
# Basic GET request
$ curl https://api.example.com/users

# Display response headers only (HEAD request)
$ curl -I https://api.example.com/users

# Detailed display of request/response (-v: verbose)
$ curl -v https://api.example.com/users

# POST request (JSON payload)
$ curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token123" \
  -d '{"name": "Taro", "email": "taro@example.com"}'

# PUT request (update existing resource)
$ curl -X PUT https://api.example.com/users/42 \
  -H "Content-Type: application/json" \
  -d '{"name": "Taro Updated"}'

# DELETE request
$ curl -X DELETE https://api.example.com/users/42 \
  -H "Authorization: Bearer token123"

# Automatically follow redirects (-L: location)
$ curl -L -v https://example.com

# Save response body to file
$ curl -o response.json https://api.example.com/data

# Connect using HTTP/2
$ curl --http2 -v https://api.example.com/users

# Connect using HTTP/3 (QUIC) (curl 7.66+)
$ curl --http3 -v https://api.example.com/users

# Request to a specific IP address (bypass DNS)
$ curl --resolve api.example.com:443:203.0.113.10 \
  https://api.example.com/users

# Specify client certificate
$ curl --cert client.crt --key client.key \
  https://secure.example.com/api
```

### 2.2 Timing Measurement (Code Example 1)

Using curl's `-w` option, you can measure the time taken at each phase of the connection in detail. This is very useful for identifying performance bottlenecks.

```bash
# Detailed timing information display
$ curl -o /dev/null -s -w "\
  DNS Lookup:      %{time_namelookup}s\n\
  TCP Connect:     %{time_connect}s\n\
  TLS Handshake:   %{time_appconnect}s\n\
  Start Transfer:  %{time_starttransfer}s\n\
  Redirect:        %{time_redirect}s\n\
  Total:           %{time_total}s\n\
  \n\
  HTTP Status:     %{http_code}\n\
  Download Size:   %{size_download} bytes\n\
  Upload Size:     %{size_upload} bytes\n\
  Speed Download:  %{speed_download} bytes/s\n\
  Speed Upload:    %{speed_upload} bytes/s\n\
  Num Connects:    %{num_connects}\n\
  Num Redirects:   %{num_redirects}\n\
  SSL Verify:      %{ssl_verify_result}\n\
  Remote IP:       %{remote_ip}\n\
  Remote Port:     %{remote_port}\n" \
  https://api.example.com/users
```

**Sample Output and Explanation of Each Phase:**

```
  DNS Lookup:      0.012345s    ← Time taken for name resolution
  TCP Connect:     0.034567s    ← Until TCP 3-way handshake completes
  TLS Handshake:   0.089012s    ← Until TLS handshake completes
  Start Transfer:  0.123456s    ← Until first byte received (TTFB)
  Redirect:        0.000000s    ← Total time for redirect processing
  Total:           0.156789s    ← Overall elapsed time

  HTTP Status:     200
  Download Size:   4523 bytes
  Upload Size:     0 bytes
  Speed Download:  28852 bytes/s
  Speed Upload:    0 bytes/s
  Num Connects:    1
  Num Redirects:   0
  SSL Verify:      0            ← 0 = verification successful
  Remote IP:       203.0.113.10
  Remote Port:     443
```

**How to Read Timing Values:**

```
0                  time_namelookup
|---DNS resolution--|
                   time_connect
|---DNS+TCP---------|
                   time_appconnect
|---DNS+TCP+TLS-----|
                   time_starttransfer
|---DNS+TCP+TLS+server processing---|
                                time_total
|---total processing time------------|

Calculating elapsed time per phase:
  DNS resolution time  = time_namelookup
  TCP connect time     = time_connect - time_namelookup
  TLS time             = time_appconnect - time_connect
  Server processing    = time_starttransfer - time_appconnect
  Content transfer     = time_total - time_starttransfer
```

### 2.3 Continuous Testing Script with curl

```bash
#!/bin/bash
# endpoint_health_check.sh
# Script to continuously measure response times for multiple endpoints

ENDPOINTS=(
  "https://api.example.com/health"
  "https://api.example.com/users"
  "https://api.example.com/products"
  "https://cdn.example.com/assets/main.js"
)

echo "Timestamp,Endpoint,Status,DNS,Connect,TLS,TTFB,Total"

for endpoint in "${ENDPOINTS[@]}"; do
  result=$(curl -o /dev/null -s -w \
    "%{http_code},%{time_namelookup},%{time_connect},%{time_appconnect},%{time_starttransfer},%{time_total}" \
    --max-time 10 \
    "$endpoint")

  timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "${timestamp},${endpoint},${result}"
done
```

---

## 3. DNS Debugging

DNS problems can be broadly classified into three patterns: "name cannot be resolved," "wrong IP is returned," and "resolution takes too long."

### 3.1 Detailed DNS Investigation with dig

```bash
# Query A record (IPv4 address)
$ dig example.com

# Query specific record types
$ dig example.com A          # IPv4 address
$ dig example.com AAAA       # IPv6 address
$ dig example.com MX         # Mail server
$ dig example.com NS         # Name server
$ dig example.com TXT        # Text record (SPF etc.)
$ dig example.com CNAME      # Alias
$ dig example.com SOA        # Authoritative information

# Short output (results only)
$ dig example.com +short

# Query a specific DNS server
$ dig @8.8.8.8 example.com           # Google Public DNS
$ dig @1.1.1.1 example.com           # Cloudflare DNS
$ dig @208.67.222.222 example.com    # OpenDNS

# Trace the entire name resolution process
$ dig +trace example.com

# Reverse lookup (hostname from IP address)
$ dig -x 203.0.113.10

# Display DNSSEC validation information
$ dig +dnssec example.com

# Check response time (focus on Query time)
$ dig example.com | grep "Query time"
;; Query time: 12 msec
```

### 3.2 nslookup and host

```bash
# nslookup — interactive/non-interactive
$ nslookup example.com
$ nslookup -type=CNAME www.example.com
$ nslookup -type=MX example.com 8.8.8.8

# host — most concise output
$ host example.com
$ host -t MX example.com
$ host -t AAAA example.com
```

### 3.3 DNS Cache Management

```bash
# macOS: Clear DNS cache
$ sudo dscacheutil -flushcache
$ sudo killall -HUP mDNSResponder

# Linux (systemd-resolved):
$ sudo systemd-resolve --flush-caches
$ sudo systemd-resolve --statistics   # Cache statistics

# Linux (nscd):
$ sudo systemctl restart nscd

# Check /etc/hosts (local overrides)
$ cat /etc/hosts

# Check /etc/resolv.conf (DNS server in use)
$ cat /etc/resolv.conf
```

### 3.4 DNS Problem Isolation Flow

```
  [DNS problem suspected]
        |
        v
  dig +short example.com
        |
   +---------+----------+
   |                     |
   v                     v
  IP returned         No IP returned
   |                     |
   v                     v
  Is IP correct?      dig @8.8.8.8 example.com
   |                     |
  +---+---+          +---+---+
  |       |          |       |
  v       v          v       v
 Correct Wrong    Returns  No return
  |       |          |       |
  v       v          v       v
 Non-DNS  Cache    Local   Domain
 problem  or CDN   DNS     itself is the
          issue    config  problem (NXDOMAIN)
                   issue
```

---

## 4. Network Connectivity Debugging

### 4.1 Connectivity Check with ping

```bash
# Basic connectivity check
$ ping example.com
$ ping -c 5 example.com        # Send only 5 times
$ ping -c 10 -i 0.5 example.com  # 10 times at 0.5 second intervals

# IPv6 connectivity check
$ ping6 example.com

# Specify packet size (investigate MTU issues)
$ ping -s 1472 -M do example.com  # With Don't Fragment flag
# If response arrives, no problem with MTU 1500 (1472 + 28 = 1500)
# If "Frag needed" is returned, there is a path with a smaller MTU

# With timestamps
$ ping -D example.com            # Linux
```

### 4.2 Route Investigation with traceroute / mtr

```bash
# traceroute — display each hop in the route
$ traceroute example.com
$ traceroute -T example.com      # TCP traceroute (when ICMP is blocked)
$ traceroute -p 443 example.com  # Check route on port 443
$ traceroute -n example.com      # Without reverse lookup (faster)

# mtr — integrated real-time display of ping + traceroute
$ mtr example.com
$ mtr --report -c 100 example.com    # Report mode (100 measurements)
$ mtr --tcp --port 443 example.com   # Measurement on TCP/443
```

### 4.3 Port Connectivity Test with nc (netcat)

```bash
# Check if TCP port is open
$ nc -zv example.com 80       # HTTP
$ nc -zv example.com 443      # HTTPS
$ nc -zv example.com 22       # SSH
$ nc -zv example.com 3306     # MySQL

# Check UDP port
$ nc -zuv example.com 53      # DNS

# Scan port range
$ nc -zv example.com 80-100

# Simple HTTP request
$ echo -e "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n" | nc example.com 80

# TCP proxy/relay (for debugging)
$ nc -l -p 8080 | tee capture.txt | nc target.example.com 80
```

### 4.4 Socket State Check with ss / netstat (Code Example 2)

ss is the successor to netstat and can display kernel socket information faster and in more detail.

```bash
# ============================================
# ss command (recommended: successor to netstat)
# ============================================

# List of listening TCP ports (with process names)
$ ss -tlnp
# State  Recv-Q Send-Q  Local Address:Port  Peer Address:Port  Process
# LISTEN 0      128     0.0.0.0:80          0.0.0.0:*          users:(("nginx",pid=1234))
# LISTEN 0      128     0.0.0.0:443         0.0.0.0:*          users:(("nginx",pid=1234))
# LISTEN 0      511     127.0.0.1:3000      0.0.0.0:*          users:(("node",pid=5678))

# Option explanation:
#   -t : TCP only
#   -l : LISTENING only
#   -n : Show port numbers as digits (no name resolution)
#   -p : Show process information

# List UDP sockets
$ ss -ulnp

# Statistics summary of all sockets
$ ss -s
# Total: 342
# TCP:   120 (estab 45, closed 20, orphaned 3, timewait 15)
# UDP:   12

# Display connections in a specific state
$ ss -t state established          # Established connections
$ ss -t state time-wait            # TIME_WAIT state
$ ss -t state close-wait           # CLOSE_WAIT state
$ ss -t state syn-sent             # SYN sent (connection attempt in progress)

# Display connections on a specific port
$ ss -t dst :443                   # Connections with destination port 443
$ ss -t src :8080                  # Connections with source port 8080

# Display connections to a specific host
$ ss -t dst 203.0.113.10

# Investigate when there are a large number of CLOSE_WAIT
$ ss -t state close-wait -p | awk '{print $NF}' | sort | uniq -c | sort -rn
#   150 users:(("java",pid=9876))  ← This process is not closing connections
#    23 users:(("python",pid=5432))

# Monitor the number of TIME_WAIT
$ watch -n 1 'ss -s | grep -i time'

# ============================================
# netstat command (legacy, used in some environments)
# ============================================

$ netstat -tlnp                    # Equivalent to ss -tlnp
$ netstat -an | grep ESTABLISHED   # Established connections
$ netstat -s                       # Statistics by protocol

# ============================================
# Port investigation with lsof
# ============================================

# Processes using a specific port
$ lsof -i :8080
$ lsof -i :80 -i :443             # Multiple ports

# List all network connections
$ lsof -i -P -n

# Network connections of a specific process
$ lsof -i -a -p 1234
```

### TCP Connection States and Their Meaning

| State | Meaning | Possible Problem |
|:-----|:-----|:------------|
| ESTABLISHED | Connection established, communicating | Normal (watch for resource exhaustion if there are too many) |
| TIME_WAIT | Waiting after connection close (normally 60 seconds) | Large accumulation indicates many connections being opened and closed in a short time |
| CLOSE_WAIT | Remote sent FIN, but local has not called close() | Likely application bug (socket leak) |
| SYN_SENT | SYN sent, waiting for response | Remote is unreachable or blocked by firewall |
| SYN_RECV | SYN received, SYN+ACK sent, waiting for ACK | Possible SYN Flood attack |
| FIN_WAIT1 | Local FIN sent, waiting for ACK | Remote response is slow |
| FIN_WAIT2 | ACK for FIN received, waiting for remote FIN | Remote application has not called close() |
| LAST_ACK | Local FIN sent, waiting for final ACK | Normally a transient state |

---

## 5. Packet Capture with tcpdump (Code Example 3)

tcpdump is a command-line packet capture tool that can capture and display packets flowing through a network interface in real time. It is suitable for debugging on servers and automation via scripts.

### 5.1 Basic Usage

```bash
# Capture all traffic (stop with Ctrl+C)
$ sudo tcpdump -i eth0

# Traffic for a specific host
$ sudo tcpdump host 203.0.113.10
$ sudo tcpdump host example.com

# Limit to source or destination
$ sudo tcpdump src host 203.0.113.10
$ sudo tcpdump dst host 203.0.113.10

# Traffic on a specific port
$ sudo tcpdump port 443
$ sudo tcpdump port 80 or port 443

# A specific network range
$ sudo tcpdump net 192.168.1.0/24

# Specify protocol
$ sudo tcpdump tcp
$ sudo tcpdump udp
$ sudo tcpdump icmp

# Compound filters
$ sudo tcpdump 'host 203.0.113.10 and port 443 and tcp'
$ sudo tcpdump 'src net 192.168.1.0/24 and dst port 80'
```

### 5.2 Detailed Display and File Saving

```bash
# ASCII display (HTTP content can be read)
$ sudo tcpdump -A port 80

# HEX + ASCII display
$ sudo tcpdump -X port 80

# Specify timestamp format
$ sudo tcpdump -tttt port 443    # Human-readable date/time format

# Limit packet count
$ sudo tcpdump -c 100 port 443   # Stop after 100 packets

# Save to pcap file (can be opened with Wireshark)
$ sudo tcpdump -w capture.pcap -c 1000 port 443

# Read pcap file
$ sudo tcpdump -r capture.pcap

# Save to file while also displaying on screen
$ sudo tcpdump -w capture.pcap -c 500 port 443 &
$ sudo tcpdump -r capture.pcap   # Check periodically in another terminal

# Specify snapshot size (capture full packet)
$ sudo tcpdump -s 0 -w full_capture.pcap

# Rotation capture (split file every 100MB, keep max 10 files)
$ sudo tcpdump -w capture_%Y%m%d_%H%M%S.pcap -G 3600 -W 10 -C 100
```

### 5.3 Filtering Using TCP Flags

```bash
# Only SYN packets (connection start)
$ sudo tcpdump 'tcp[tcpflags] & tcp-syn != 0'

# SYN+ACK packets (connection response)
$ sudo tcpdump 'tcp[tcpflags] & (tcp-syn|tcp-ack) == (tcp-syn|tcp-ack)'

# FIN packets (connection termination)
$ sudo tcpdump 'tcp[tcpflags] & tcp-fin != 0'

# RST packets (connection reset — sign of abnormal termination)
$ sudo tcpdump 'tcp[tcpflags] & tcp-rst != 0'

# PSH packets (data transmission)
$ sudo tcpdump 'tcp[tcpflags] & tcp-push != 0'
```

### 5.4 Practical tcpdump One-Liners

```bash
# Monitor DNS queries
$ sudo tcpdump -i any port 53 -l | grep -i 'A?'

# Monitor HTTP GET requests
$ sudo tcpdump -A -s 0 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<<2)) - ((tcp[12]&0xf0)>>2)) != 0)' | grep -i 'GET\|Host'

# Monitor TLS handshake (Client Hello)
$ sudo tcpdump -i any 'tcp port 443 and (tcp[((tcp[12]&0xf0)>>2)]=22)' -c 20

# Detect retransmission packets
$ sudo tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0' -c 1000 -w syn_analysis.pcap

# Responses containing a specific HTTP status code
$ sudo tcpdump -A -s 0 'tcp port 80' | grep -E 'HTTP/1\.[01] [45][0-9]{2}'
```

---

## 6. Packet Analysis with Wireshark

Wireshark is a GUI-based packet analysis tool, suitable for detailed analysis of pcap files captured with tcpdump.

### 6.1 Wireshark Display Filters (Code Example 4)

Wireshark's Display Filters narrow down captured packets to those matching conditions. It has its own syntax that differs from BPF (tcpdump filter syntax).

```
# ============================================
# Filters by IP address
# ============================================
ip.addr == 192.168.1.100           # Source or destination is specified IP
ip.src == 192.168.1.100            # Source only
ip.dst == 203.0.113.10             # Destination only
ip.addr == 192.168.1.0/24          # Specified by subnet

# ============================================
# Filters by port
# ============================================
tcp.port == 443                     # TCP port 443 (source or destination)
tcp.dstport == 80                   # Destination port 80
tcp.srcport >= 1024                 # Ephemeral ports
udp.port == 53                      # DNS

# ============================================
# Protocol filters
# ============================================
http                                # All HTTP traffic
http.request                        # HTTP requests only
http.response                       # HTTP responses only
http.request.method == "GET"        # GET requests
http.request.method == "POST"       # POST requests
http.response.code == 200           # Status 200
http.response.code >= 400           # Error responses
http.host == "api.example.com"      # Requests to a specific host
http.request.uri contains "/api/"   # URI containing "/api/"

dns                                 # DNS traffic
dns.qry.name == "example.com"       # DNS query for a specific domain
dns.flags.rcode != 0                # DNS error response

tls                                 # TLS traffic
tls.handshake.type == 1             # Client Hello
tls.handshake.type == 2             # Server Hello
tls.handshake.extensions.supported_versions  # TLS version information

# ============================================
# TCP analysis filters
# ============================================
tcp.analysis.retransmission         # TCP retransmission packets
tcp.analysis.duplicate_ack          # Duplicate ACK
tcp.analysis.zero_window            # Zero window
tcp.analysis.window_full            # Window full
tcp.analysis.fast_retransmission    # Fast retransmission
tcp.analysis.lost_segment           # Lost segment
tcp.analysis.out_of_order           # Out-of-order packets

tcp.flags.syn == 1 && tcp.flags.ack == 0   # SYN (connection start)
tcp.flags.reset == 1                        # RST (reset)
tcp.flags.fin == 1                          # FIN (connection termination)

# ============================================
# Compound filters (AND / OR / NOT)
# ============================================
ip.addr == 192.168.1.100 && tcp.port == 443
http.request || http.response
!(arp || dns || icmp)               # Exclude ARP, DNS, ICMP
tcp.analysis.retransmission && ip.dst == 203.0.113.10

# ============================================
# Time-based filters
# ============================================
frame.time >= "2024-01-15 10:00:00" && frame.time <= "2024-01-15 10:05:00"

# ============================================
# Packet size filters
# ============================================
frame.len > 1400                    # Packets close to MTU size
tcp.len == 0                        # TCP packets without data (ACK only, etc.)
```

### 6.2 Useful Wireshark Features

```
Wireshark Analysis Features:

1. Follow TCP Stream
   → Display the entire conversation of a specific TCP connection together
   → Convenient for checking the content of HTTP requests/responses
   → Right-click → Follow → TCP Stream

2. Follow TLS Stream
   → If TLS decryption key is configured, display encrypted content
   → Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log filename

3. Statistics menu
   → Conversations: Communication volume summary between hosts
   → Endpoints: Communication volume per host
   → Protocol Hierarchy: Traffic percentage by protocol
   → I/O Graphs: Time-series graph of traffic volume
   → Flow Graph: TCP connection flow diagram

4. Expert Information
   → Analyze → Expert Information
   → Automatically detect warnings and errors and display as a list
   → Immediately grasp retransmissions, zero windows, resets, etc.

5. Coloring Rules
   → TCP retransmission: Red
   → HTTP errors: Red
   → TCP reset: Red
   → DNS: Blue
   → Custom rules can also be added
```

---

## 7. Browser-Level Debugging with Chrome DevTools

Chrome DevTools Network tab is a tool that monitors all HTTP requests/responses from the browser in real time. It is the most familiar network debugging method for frontend developers.

### 7.1 Basic Network Tab Operations

```
How to open Chrome DevTools:
  - F12 key
  - Cmd + Opt + I (macOS) / Ctrl + Shift + I (Windows/Linux)
  - Right-click → Inspect → Network tab

Main features of the Network tab:

  [1] Request list
      The following information is displayed for each request:
      - Name:       Resource name (URL path)
      - Status:     HTTP status code
      - Type:       Resource type (document, script, stylesheet, fetch, etc.)
      - Initiator:  Source of the request (script, parser, etc.)
      - Size:       Transfer size / resource size
      - Time:       Total elapsed time
      - Waterfall:  Timeline bar

  [2] Filter bar
      Filter by resource type:
      - All:       All requests
      - Fetch/XHR: API calls (Ajax/Fetch)
      - JS:        JavaScript files
      - CSS:       Stylesheets
      - Img:       Images
      - Media:     Video/audio
      - Font:      Font files
      - Doc:       HTML documents
      - WS:        WebSocket
      - Wasm:      WebAssembly

      Text filters:
      - Type "api" → Display only requests with "api" in URL
      - "-status-code:200" → Display those other than status 200
      - "larger-than:100k" → Resources over 100KB
      - "method:POST" → POST requests only
      - "domain:api.example.com" → Specific domain only
      - "has-response-header:set-cookie" → Responses that set cookies
```

### 7.2 Timing Analysis

```
Click each request → Details visible in Timing tab:

+------------------------------------------------------------------+
| Queueing        |  Waiting in browser request queue              |
|                  |  (low priority, connection limit reached, etc.) |
+------------------------------------------------------------------+
| Stalled          |  Waiting for connection pool slot / proxy negotiation |
|                  |  → If long: same-origin concurrent connection limit  |
|                  |    (HTTP/1.1 typically allows 6 connections/origin)   |
+------------------------------------------------------------------+
| DNS Lookup       |  Time taken for DNS name resolution            |
|                  |  → If long: DNS server is slow                 |
|                  |    Consider using dns-prefetch                  |
+------------------------------------------------------------------+
| Initial Conn.    |  TCP 3-way handshake + TLS handshake           |
|                  |  → If long: High network latency               |
|                  |    Multiplex connections with HTTP/2 or HTTP/3  |
+------------------------------------------------------------------+
| SSL              |  TLS handshake time only                       |
|                  |  → If long: Certificate chain is long, OCSP is slow |
+------------------------------------------------------------------+
| Request Sent     |  Time to send request (normally very short)    |
+------------------------------------------------------------------+
| Waiting (TTFB)   |  Until first response byte received            |
|  Time to First   |  ← Directly reflects server processing time    |
|  Byte            |  → If long: Server-side optimization needed    |
|                  |    DB queries, caching, application logic       |
+------------------------------------------------------------------+
| Content Download |  Time to receive response body                 |
|                  |  → If long: Large response or narrow bandwidth  |
|                  |    Consider compression (gzip/brotli), pagination |
+------------------------------------------------------------------+
```

### 7.3 How to Read the Waterfall

Waterfall is a feature that displays the time series of all requests as horizontal bar charts, allowing you to visually identify bottlenecks in resource loading.

```
How to read the Waterfall:

  Time →
  |  0ms        100ms       200ms       300ms       400ms       500ms
  |  |           |           |           |           |           |
  |
  |  index.html
  |  [==DNS==][=Conn=][=TLS=][===TTFB===][==DL==]
  |
  |  style.css                    (loaded when parser discovers it)
  |                          [=Conn=][TLS][=TTFB=][DL]
  |
  |  app.js                      (loaded when parser discovers it)
  |                          [=Conn=][TLS][==TTFB==][===DL===]
  |
  |  api/users                   (fetched after JS execution)
  |                                              [C][T][====TTFB====][DL]
  |
  |  avatar.png                  (rendered after API response)
  |                                                              [C][TTFB][DL]
  |
  Legend:
    DNS   = DNS Lookup (green)
    Conn  = Initial Connection (orange)
    TLS   = SSL/TLS (purple)
    TTFB  = Waiting / Time to First Byte (green)
    DL    = Content Download (blue)

  Reading points:
    - Long vertical gap → Dependencies between resources (waterfall)
    - Long horizontal bar → Individual resource loading is slow
    - Many requests starting simultaneously → HTTP/2 multiplexing working
    - Starting 6 at a time in stages → HTTP/1.1 connection limit
```

### 7.4 Advanced Chrome DevTools Usage (Code Example 5)

```javascript
// ============================================
// Network debugging from the Console tab
// ============================================

// Get resource timing via Performance API
const resources = performance.getEntriesByType('resource');
resources.forEach(r => {
  console.log(`${r.name}: DNS=${r.domainLookupEnd - r.domainLookupStart}ms, ` +
              `Connect=${r.connectEnd - r.connectStart}ms, ` +
              `TTFB=${r.responseStart - r.requestStart}ms, ` +
              `Download=${r.responseEnd - r.responseStart}ms, ` +
              `Total=${r.duration}ms`);
});

// Overall page timing via Navigation Timing API
const nav = performance.getEntriesByType('navigation')[0];
console.table({
  'DNS Lookup':       `${nav.domainLookupEnd - nav.domainLookupStart}ms`,
  'TCP Connection':   `${nav.connectEnd - nav.connectStart}ms`,
  'TLS Handshake':    `${nav.secureConnectionStart > 0 ?
                         nav.connectEnd - nav.secureConnectionStart : 0}ms`,
  'TTFB':             `${nav.responseStart - nav.requestStart}ms`,
  'Content Download': `${nav.responseEnd - nav.responseStart}ms`,
  'DOM Interactive':  `${nav.domInteractive - nav.fetchStart}ms`,
  'DOM Complete':     `${nav.domComplete - nav.fetchStart}ms`,
  'Load Event':       `${nav.loadEventEnd - nav.fetchStart}ms`,
});

// Filter only slow requests (500ms or more)
const slowResources = performance.getEntriesByType('resource')
  .filter(r => r.duration > 500)
  .sort((a, b) => b.duration - a.duration);
console.table(slowResources.map(r => ({
  name: r.name.split('/').pop(),
  type: r.initiatorType,
  duration: `${Math.round(r.duration)}ms`,
  size: `${r.transferSize} bytes`,
})));

// Check Service Worker status
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => {
    console.log('Scope:', reg.scope);
    console.log('State:', reg.active?.state);
  });
});

// Monitor WebSocket connections
const originalWS = window.WebSocket;
window.WebSocket = function(...args) {
  const ws = new originalWS(...args);
  console.log('[WS] Connecting to:', args[0]);
  ws.addEventListener('open', () => console.log('[WS] Connected'));
  ws.addEventListener('close', (e) =>
    console.log('[WS] Closed:', e.code, e.reason));
  ws.addEventListener('error', (e) => console.log('[WS] Error:', e));
  return ws;
};
```

### 7.5 DevTools Network Settings

```
Important settings:

  [Preserve log]
    Checked → Log is not cleared on page navigation or reload
    Essential for debugging redirect issues

  [Disable cache]
    Checked → Disable browser cache
    Enables pure network measurement without cache influence

  [Throttling]
    Network speed simulation:
    - No throttling:  No limit (default)
    - Fast 3G:        1.6 Mbps down, 768 Kbps up, 562ms RTT
    - Slow 3G:        400 Kbps down, 400 Kbps up, 2000ms RTT
    - Offline:        Completely offline
    - Custom:         Set any bandwidth/latency

  [Request Blocking]
    Cmd+Shift+P → "Show Request Blocking" to enable
    Block specific URL patterns to check behavior:
    Example: *.analytics.com  → Block analytics
    Example: */api/v2/*       → Block specific API

  [HAR (HTTP Archive) export]
    → Records all requests/responses in JSON format
    → Used for reproducing and sharing problems
    → Right-click network log → "Save all as HAR with content"
    → Can be analyzed at https://toolbox.googleapps.com/apps/har_analyzer/
```

---

## 8. TLS/SSL Debugging

HTTPS-related problems span many areas including certificate expiry, missing chain links, and protocol version mismatches.

### 8.1 TLS Connection Testing with openssl

```bash
# TLS connection test (display certificate information)
$ openssl s_client -connect example.com:443 -servername example.com

# Check certificate expiry
$ openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -dates
# notBefore=Jan  1 00:00:00 2024 GMT
# notAfter=Dec 31 23:59:59 2024 GMT

# Display the entire certificate chain
$ openssl s_client -connect example.com:443 -servername example.com -showcerts

# Connect with a specific TLS version
$ openssl s_client -connect example.com:443 -tls1_2
$ openssl s_client -connect example.com:443 -tls1_3

# Check supported cipher suites
$ openssl s_client -connect example.com:443 -cipher 'ECDHE-RSA-AES256-GCM-SHA384'

# Detailed certificate information (Subject, Issuer, SAN, etc.)
$ openssl s_client -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -text | head -30

# Check OCSP Stapling
$ openssl s_client -connect example.com:443 -status 2>/dev/null \
  | grep -A 5 "OCSP Response"

# Check ALPN (Application-Layer Protocol Negotiation)
$ openssl s_client -connect example.com:443 -alpn h2,http/1.1 2>/dev/null \
  | grep "ALPN"
```

### 8.2 TLS Problem Criteria

| Symptom | Possible Cause | How to Check |
|:-----|:-------------|:---------|
| `certificate has expired` | Certificate has expired | `openssl x509 -noout -dates` |
| `unable to verify the first certificate` | Missing intermediate certificate | Check certificate chain with `-showcerts` |
| `certificate verify failed` | Root CA not trusted / self-signed | Check CA certificate |
| `wrong version number` | TLS connection to non-TLS port | Check port number |
| `handshake failure` | Cipher suite mismatch | Test individually with `-cipher` |
| `tlsv1 alert protocol version` | TLS version not supported | Test individually with `-tls1_2` `-tls1_3` |
| `sslv3 alert handshake failure` | SNI is required | Specify `-servername` |

---

## 9. Systematic Troubleshooting

### 9.1 Problem Classification

Network problems can be broadly classified into the following 4 categories.

```
+========================+========================+
|    Connection Failed   |    Intermittent         |
|                        |                         |
|  - DNS resolution fail |  - Occasional timeout   |
|  - Port not open       |  - Packet loss           |
|  - Firewall            |  - Load-dependent fault  |
|  - Routing anomaly     |  - DNS TTL issues        |
|                        |                         |
+========================+========================+
|    Slow Performance    |    Application           |
|                        |    Error                 |
|                        |                          |
|  - High latency        |  - HTTP 4xx/5xx          |
|  - Low throughput      |  - TLS/SSL errors        |
|  - Many TCP retrans.   |  - CORS issues           |
|  - MTU issues          |  - WebSocket disconnect  |
|                        |                          |
+========================+========================+
```

### Figure 2: Troubleshooting Decision Tree

```
+================================================================+
|            Troubleshooting Decision Tree                        |
+================================================================+

  [Web page not displayed / API not responding]
      |
      v
  (1) Does ping <host> work?
      |
      +--- NO ---> (A) Is the IP address correct?
      |                 |
      |                 +--- Check with dig +short <host>
      |                 |
      |                 +--- No IP returned
      |                 |     → DNS issue: Check /etc/resolv.conf, DNS server
      |                 |
      |                 +--- IP is returned but ping fails
      |                       → Check which hop traceroute stops at
      |                       → Is ICMP blocked by firewall?
      |                       → Routing issue?
      |
      +--- YES --> (2) Does nc -zv <host> <port> work?
                       |
                       +--- NO ---> Port is closed
                       |            → Check if service is running
                       |            → Check listening state with ss -tlnp
                       |            → Check firewall rules
                       |            → Check Security Group / ACL
                       |
                       +--- YES --> (3) What is the result of curl -v <URL>?
                                       |
                                       +--- TLS error
                                       |    → Check certificate with openssl s_client
                                       |    → Expiry, chain, SNI
                                       |
                                       +--- HTTP 3xx
                                       |    → Check redirect destination
                                       |    → Track with curl -L
                                       |    → Check for infinite redirect
                                       |
                                       +--- HTTP 4xx
                                       |    → 401: Check credentials
                                       |    → 403: Check permissions/IP restriction
                                       |    → 404: Check URL path
                                       |    → 429: Check rate limit
                                       |
                                       +--- HTTP 5xx
                                       |    → Check server logs
                                       |    → 502: Check backend liveness
                                       |    → 503: Overload/maintenance
                                       |    → 504: Backend timeout
                                       |
                                       +--- Timeout
                                       |    → Is TTFB slow?
                                       |    → Is server processing slow?
                                       |    → Check DB and cache
                                       |
                                       +--- Normal (200) but page is broken
                                            → Check JS errors in DevTools
                                            → Check API response content
                                            → Check for CORS errors
```

### 9.2 Debug Commands by Layer

```bash
# ============================================
# L1-L2: Physical / Data Link Layer
# ============================================
$ ip link show                     # Interface status
$ ethtool eth0                     # Detailed NIC information
$ ip neigh show                    # ARP table
$ arp -a                           # ARP table (legacy)

# ============================================
# L3: Network Layer
# ============================================
$ ip addr show                     # Check IP addresses
$ ip route show                    # Routing table
$ ip route get 203.0.113.10        # Route to a specific IP
$ ping -c 5 example.com            # Connectivity check
$ traceroute example.com           # Route check
$ mtr --report example.com         # Route + packet loss

# ============================================
# L4: Transport Layer
# ============================================
$ ss -tlnp                         # TCP LISTEN ports
$ ss -t state established          # Established TCP connections
$ nc -zv example.com 443           # Port connectivity check
$ sudo tcpdump -i eth0 port 443    # Packet capture

# ============================================
# L5-L7: Application Layer
# ============================================
$ dig +short example.com           # DNS resolution
$ curl -v https://example.com      # HTTP communication test
$ openssl s_client -connect example.com:443   # TLS check
# Chrome DevTools → Network tab    # Browser level
```

### 9.3 Common Problems and Solutions

#### Problem 1: Large Accumulation of CLOSE_WAIT

```bash
# Symptom: Hundreds to thousands of CLOSE_WAIT connections accumulated
$ ss -t state close-wait | wc -l
523

# Identify cause: Which process has CLOSE_WAIT
$ ss -t state close-wait -p | awk '{print $NF}' | sort | uniq -c | sort -rn
  489 users:(("java",pid=12345,fd=892))
   34 users:(("python3",pid=6789,fd=45))

# Explanation:
# CLOSE_WAIT is a state where "the remote sent a FIN, but local has not called close()"
# There is a socket leak (bug where connections are not closed) in the application
#
# Solutions:
# 1. Fix the application code (close in try-with-resources or finally)
# 2. Review HTTP client connection pool settings
# 3. Check keepalive timeout settings
```

#### Problem 2: Large Accumulation of TIME_WAIT

```bash
# Symptom: TIME_WAIT reaches tens of thousands, ephemeral ports are exhausted
$ ss -t state time-wait | wc -l
28456

# Check ephemeral port range
$ cat /proc/sys/net/ipv4/ip_local_port_range
32768   60999
# Available ports: 60999 - 32768 = 28231
# → New connections fail when TIME_WAIT exceeds 28231

# Solution (fundamental):
# 1. Enable HTTP keep-alive to promote connection reuse
# 2. Introduce connection pooling
# 3. Multiplex connections with HTTP/2

# Solution (temporary, note side effects):
$ sudo sysctl -w net.ipv4.tcp_tw_reuse=1        # Allow TIME_WAIT reuse
$ sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"  # Expand port range
```

#### Problem 3: CORS Error

```
# Error displayed in Chrome DevTools Console:
# Access to fetch at 'https://api.example.com/data'
# from origin 'https://www.example.com' has been blocked by CORS policy:
# No 'Access-Control-Allow-Origin' header is present on the requested resource.

# How to check:
$ curl -v -X OPTIONS https://api.example.com/data \
  -H "Origin: https://www.example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"

# Expected response headers:
# Access-Control-Allow-Origin: https://www.example.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Authorization, Content-Type
# Access-Control-Max-Age: 86400

# Common causes:
# 1. CORS headers are not configured on the server side
# 2. Wildcard (*) cannot be used with authenticated requests
# 3. Preflight request (OPTIONS) is returning something other than 200
# 4. Response does not include the required headers
```

---

## 10. Debug Tool Comparison Tables

### Comparison Table 1: Packet Capture Tool Comparison

| Characteristic | tcpdump | Wireshark | tshark | ngrep |
|:-----|:--------|:----------|:-------|:------|
| Interface | CLI | GUI | CLI | CLI |
| Real-time display | Yes | Yes | Yes | Yes |
| pcap save | Yes | Yes | Yes | Yes |
| pcap read | Yes | Yes | Yes | Yes |
| Filter syntax | BPF | Display Filter | Display Filter | Regex |
| Protocol analysis depth | Basic | Very detailed | Very detailed | Basic |
| Use via SSH | Easy | Not possible (except X forwarding) | Easy | Easy |
| Use on servers | Optimal | Not suitable | Optimal | Suitable |
| Memory usage | Low | High | Medium | Low |
| Learning cost | Medium | Medium to high | High | Low |
| Recommended use | Capture on server | Detailed GUI analysis | Script integration | Text search |

### Comparison Table 2: HTTP Debug Tool Comparison

| Characteristic | curl | HTTPie | wget | Postman | DevTools |
|:-----|:-----|:-------|:-----|:--------|:---------|
| Interface | CLI | CLI | CLI | GUI | Built into browser |
| JSON formatted output | Use jq | Built-in | Not possible | Built-in | Built-in |
| Save requests | Scriptable | Scriptable | Not possible | Collections | HAR |
| Timing measurement | `-w` option | `--print=h` | Not possible | Built-in | Timing tab |
| TLS details | Shown with `-v` | Limited | Not possible | Limited | Security tab |
| HTTP/2 support | `--http2` | Supported | Not supported | Supported | Supported |
| HTTP/3 support | `--http3` | Not supported | Not supported | Not supported | Supported |
| WebSocket | `--ws` (7.86+) | Not supported | Not supported | Supported | WS frame display |
| Automation suitability | High | High | High | Medium (Newman) | Low |
| Cookie management | `-b/-c` | `--session` | Built-in | Automatic | Automatic |
| Auth support | Many types | Many types | Basic | Many types | Browser-dependent |
| Learning cost | Medium | Low | Low | Low | Low |

---

## 11. Anti-Patterns

### Anti-Pattern 1: "Just Restart It" Syndrome

```
+================================================================+
|  Anti-pattern: Restarting the service without investigating    |
+================================================================+

  Problem occurs
      |
      v
  "Let's just restart it"          ← This is the problem
      |
      v
  Service restart
      |
      +--- Temporarily fixed --------> Feeling reassured
      |                                |
      |                                v
      |                          Recurs (a few hours to days later)
      |                                |
      |                                v
      |                          "I'll just restart again"
      |                                |
      |                                v
      |                          Root cause remains unknown, repeats
      |                          → System with low reliability
      |
      +--- Not fixed ------------> More confusion
                                  → Logs disappear making investigation difficult

  Correct approach:
  +---------------------------------------------------------+
  | 1. Check logs first (before restarting!)               |
  |    $ journalctl -u myservice --since "1 hour ago"      |
  |    $ tail -100 /var/log/myservice/error.log            |
  |                                                         |
  | 2. Record the current state                             |
  |    $ ss -tlnp > /tmp/socket_state.txt                  |
  |    $ ps auxf > /tmp/process_state.txt                  |
  |    $ top -b -n 1 > /tmp/resource_state.txt             |
  |    $ sudo tcpdump -w /tmp/before_restart.pcap -c 1000 &|
  |                                                         |
  | 3. Form a hypothesis about the cause                    |
  |                                                         |
  | 4. Verify the hypothesis                                |
  |                                                         |
  | 5. Fix the root cause                                   |
  |                                                         |
  | 6. Only restart with records if the cause cannot be     |
  |    fixed                                                |
  +---------------------------------------------------------+
```

### Anti-Pattern 2: Indiscriminate Packet Capture in Production

```
+================================================================+
|  Anti-pattern: Running tcpdump without limits in production    |
+================================================================+

  Common mistake:
    $ sudo tcpdump -i eth0 -w capture.pcap
    → No filter, no packet count limit, no file size limit

  What happens:
    1. Disk is rapidly consumed (about 100MB/second at 1Gbps)
    2. CPU load increases (especially with -A ASCII display option)
    3. Confidential data (passwords, tokens) is captured
    4. pcap file becomes too large to analyze

  Correct approach:
  +---------------------------------------------------------+
  | 1. Always specify a filter                              |
  |    $ sudo tcpdump host 203.0.113.10 and port 443        |
  |                                                         |
  | 2. Limit packet count                                   |
  |    $ sudo tcpdump -c 1000 ...                           |
  |                                                         |
  | 3. Limit file size                                      |
  |    $ sudo tcpdump -C 100 -W 5 ...                       |
  |    (Rotate every 100MB, max 5 files)                    |
  |                                                         |
  | 4. Limit capture time                                   |
  |    $ timeout 60 sudo tcpdump ...                        |
  |    (Automatically stop after 60 seconds)                |
  |                                                         |
  | 5. Consideration for confidential data                  |
  |    - Limit snapshot size: -s 96                         |
  |      (Capture headers only, not payload)                |
  |    - Restrict access permissions to capture files       |
  |    - Delete promptly after analysis                     |
  +---------------------------------------------------------+
```

---

## FAQ (Frequently Asked Questions)

### Q1: How should tcpdump and Wireshark be used differently?

**A:** Use them based on the environment and purpose.

**Cases where tcpdump should be used:**
- **Capture on server**: When accessing a remote server via SSH and capturing packets there (GUI not required)
- **Automation / scripting**: When periodically running packet captures from cron or monitoring scripts
- **Real-time monitoring**: When streaming logs in real time (`tcpdump -A port 80 | grep "GET"`)
- **Lightweight environments**: Servers with limited memory or disk, embedded devices
- **Emphasis on filtering**: When quickly narrowing down packets with BPF filters

**Cases where Wireshark should be used:**
- **Detailed protocol analysis**: When checking detailed fields of HTTP/2, TLS, DNS, TCP
- **Visual analysis**: When using visualization features like stream tracking, flow graphs, I/O graphs
- **Using expert information**: When automatically detecting problems like retransmissions, zero windows, duplicate ACKs
- **Analyzing pcap files**: When thoroughly analyzing pcap files captured with tcpdump later
- **For beginners**: When not familiar with CLI, GUI is more intuitive

**Recommended workflow:**
1. **Capture with tcpdump on server**: `sudo tcpdump -w capture.pcap -c 1000 port 443`
2. **Transfer pcap file to local**: `scp server:/tmp/capture.pcap .`
3. **Detailed analysis with Wireshark**: Use Follow TCP Stream, Expert Information in GUI

**tshark (CLI version of Wireshark) as an option:**
- Can use Wireshark display filters from CLI
- Wireshark's advanced analysis features can be used on servers too
- Example: `tshark -r capture.pcap -Y "http.response.code == 500"`

### Q2: What is the DNS troubleshooting procedure?

**A:** DNS problems can be systematically isolated using the following flow.

**Step 1: Check if name resolution is possible**

```bash
# Basic name resolution test
$ dig +short example.com
203.0.113.10
```

**If no result is returned:**

```bash
# Step 1-1: Try a different DNS server
$ dig @8.8.8.8 +short example.com       # Google Public DNS
$ dig @1.1.1.1 +short example.com       # Cloudflare DNS
$ dig @208.67.222.222 +short example.com # OpenDNS

# If returned → Local DNS server issue
#   - Check nameserver settings in /etc/resolv.conf
#   - Check for internal DNS server failure
#   - Clear DNS cache: sudo systemd-resolve --flush-caches

# If not returned → Problem with the domain itself
#   - Check domain registration status: whois example.com
#   - Check authoritative DNS server: dig +trace example.com
```

**Step 2: Check if the returned IP is correct**

```bash
# Compare expected IP with actual IP
$ dig +short example.com
192.0.2.1  # Is this as expected?

# Compare with another DNS server too
$ dig @8.8.8.8 +short example.com
203.0.113.10  # Different from local DNS!

# → Possible DNS cache poisoning or stale cache
```

**Step 3: When DNS resolution time is slow**

```bash
# Measure DNS resolution time
$ dig example.com | grep "Query time"
;; Query time: 523 msec  # Over 500ms is slow

# Isolating the cause:
# 1. DNS server is far away → Switch to a closer public DNS
# 2. DNS server is overloaded → Try a different DNS server
# 3. DNS resolver failure → Restart systemd-resolved / dnsmasq

# Check route to DNS server with traceroute
$ traceroute 8.8.8.8
```

**Step 4: Check for /etc/hosts override**

```bash
# Check if locally overridden in /etc/hosts
$ grep example.com /etc/hosts
127.0.0.1  example.com  # ← This caused connection to localhost!

# /etc/hosts takes priority over DNS, so unintended settings may remain
```

**Step 5: Wait for DNS propagation (immediately after DNS change)**

```bash
# Query authoritative DNS server directly
$ dig @ns1.example-dns.com example.com

# If authoritative server returns new IP but cache server returns old IP:
# → Wait until TTL expires (normally 300-3600 seconds)

# Check DNS propagation in multiple regions
# - https://www.whatsmydns.net/ can check worldwide DNS propagation status
```

**Common DNS Problems and Solutions:**

| Symptom | Cause | Solution |
|------|------|------|
| `NXDOMAIN` | Domain does not exist | Check for typos in domain name, check registration with whois |
| `SERVFAIL` | DNS server failure | Try a different DNS server (8.8.8.8, etc.) |
| `connection timed out` | Cannot reach DNS server | Check firewall, routing |
| Old IP returned | DNS cache | Clear cache, wait for TTL expiry |
| Name resolution is slow | Distant DNS server | Introduce local DNS cache server |

### Q3: How do you identify network latency issues?

**A:** Latency problems can be isolated using the following procedure.

**Step 1: Measure overall latency**

```bash
# Measure time per phase with curl
$ curl -o /dev/null -s -w "\
  DNS:      %{time_namelookup}s\n\
  Connect:  %{time_connect}s\n\
  TLS:      %{time_appconnect}s\n\
  TTFB:     %{time_starttransfer}s\n\
  Total:    %{time_total}s\n" \
  https://api.example.com/data

# Sample output:
# DNS:      0.015s  ← DNS resolution is fast
# Connect:  0.045s  ← TCP connection is normal
# TLS:      0.089s  ← TLS handshake is normal
# TTFB:     1.234s  ← Server processing is slow!
# Total:    1.456s
```

**Criteria for Each Phase:**

| Phase | Normal Range | Cause if Slow | Solution |
|---------|---------|--------------|------|
| DNS | < 50ms | DNS server is slow, far away | Nearby public DNS, DNS prefetch |
| Connect | < 100ms | High network latency | Introduce CDN, geographic distribution of servers |
| TLS | < 150ms | Certificate chain is long, OCSP is slow | OCSP Stapling, certificate chain optimization |
| TTFB | < 500ms | Server processing is slow | DB optimization, introduce caching, add indexes |
| Download | Depends on bandwidth | Large response, narrow bandwidth | gzip/Brotli compression, reduce response size |

**Step 2: Identify delay in network route**

```bash
# Monitor route in real time with mtr
$ mtr --report -c 100 api.example.com

# Sample output:
# HOST: myhost                Loss%   Snt   Last   Avg  Best  Wrst StDev
#   1. gateway                 0.0%   100    1.2   1.3   1.0   2.5   0.2
#   2. isp-router              0.0%   100   15.2  16.1  14.5  25.3   2.1
#   3. isp-core                2.0%   100   45.3  46.8  44.2  78.5   5.3  ← Packet loss!
#   4. peering-point           0.0%   100   48.1  49.2  47.5  55.1   1.8
#   5. api.example.com         0.0%   100   50.2  51.3  49.8  58.2   2.0

# 2% packet loss at hop 3 → there is a problem in this segment
# → Contact ISP or consider alternate route (VPN, etc.)
```

**Step 3: Identify breakdown of server processing time**

```bash
# Check in Chrome DevTools Network tab:
# - Long Waiting (TTFB) → Server-side issue
#   - Slow DB query → Check execution plan with EXPLAIN ANALYZE
#   - Slow external API call → Timeout settings, introduce caching
#   - High CPU usage → Profiling (pprof, py-spy, etc.)

# Record processing time in server log
# Nginx example:
log_format timed_combined '$remote_addr - $remote_user [$time_local] '
                          '"$request" $status $body_bytes_sent '
                          '"$http_referer" "$http_user_agent" '
                          'rt=$request_time uct=$upstream_connect_time '
                          'uht=$upstream_header_time urt=$upstream_response_time';

# Large request_time → Application processing is slow
# Large upstream_*_time → Backend server is slow
```

**Step 4: For intermittent latency**

```bash
# Take continuous measurements for statistics
$ for i in {1..100}; do
    curl -o /dev/null -s -w "%{time_total}\n" https://api.example.com/data
  done | awk '{sum+=$1; if($1>max) max=$1; if(NR==1 || $1<min) min=$1} END {print "Avg:", sum/NR, "Min:", min, "Max:", max}'

# Sample output:
# Avg: 0.234s  Min: 0.189s  Max: 2.345s
# → Max is abnormally large = intermittent latency is occurring

# Causes:
# - Pause due to GC (garbage collection)
# - DB connection pool exhaustion
# - Slow query on cache miss
# - Server swap occurring
```

**Conclusion: Isolate latency problems in the order of curl time measurement → route check with mtr → breakdown identification with server logs/APM.**

---

## Summary

| Concept | Key Points |
|------|---------|
| Debug flow | Clarify symptoms → Identify layer (OSI model) → Form hypothesis → Verify → Fix → Document |
| curl | All-purpose HTTP debug tool, timing measurement with `-w`, detailed display with `-v` |
| DNS | dig is most detailed, +trace to track full route, @8.8.8.8 to check alternate DNS |
| Connectivity check | ping → traceroute/mtr → nc to check ports, in that order |
| Sockets | ss (recommended) or netstat, watch for accumulation of CLOSE_WAIT/TIME_WAIT |
| Packet capture | Combination of tcpdump (server) + Wireshark (detailed analysis) |
| TLS | Check certificate with openssl s_client, display chain with -showcerts |
| Browser | Chrome DevTools Network tab, Timing/Waterfall/HAR export |
| Troubleshooting | Check layer by layer from top, always save logs before restarting |

---

## Guides to Read Next

After mastering network debugging techniques, it is recommended to proceed to the following topics.

- **[Performance Optimization](./03-performance.md)**: Learn comprehensive network performance tuning techniques to resolve bottlenecks identified through debugging
- **[HTTP Details](../02-http/)**: Deepen understanding of HTTP protocol specifications, cache control, and security headers to improve debugging precision
- **[TCP/IP Protocols](../01-protocols/)**: Learn TCP retransmission control, flow control, and congestion control for deeper packet-level debugging

---

## References

1. Stevens, W. R. "TCP/IP Illustrated, Volume 1: The Protocols." Addison-Wesley, 2011.
2. tcpdump.org. "tcpdump Manual." tcpdump.org, 2024.
3. Wireshark Foundation. "Wireshark User's Guide." wireshark.org, 2024.
4. Mozilla Developer Network. "Chrome DevTools Network Reference." developer.mozilla.org, 2024.
5. RFC 1035. "Domain Names - Implementation and Specification." IETF, 1987.
6. Grigorik, I. "High Performance Browser Networking." O'Reilly, 2013.


