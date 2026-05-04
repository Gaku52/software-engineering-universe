# How the Internet Works

> The Internet is a "network of networks." By systematically understanding how data travels from your PC to a server — packet communication, ISP hierarchy, submarine cables, and routing protocols — your ability to make decisions in any context, from network troubleshooting to architecture design, improves dramatically.

## What You Will Learn in This Chapter

- [ ] Understand the physical structure of the Internet (submarine cables, IXs, data centers)
- [ ] Grasp how packet communication works and how it differs from circuit switching
- [ ] Explain the principles of routing and the role of BGP
- [ ] Understand the ISP hierarchy (Tier 1 / Tier 2 / Tier 3)
- [ ] Analyze communication paths using tools such as traceroute, ping, and tcpdump
- [ ] Trace the entire process from DNS resolution to Web page display
- [ ] Recognize and avoid anti-patterns in network design

## Prerequisites

- Basic command-line (terminal) operation
- Basic concept of IP addresses (IPv4 / IPv6 notation)
- Familiarity with the existence of TCP/UDP at a high level is sufficient

---

## 1. What Is the Internet?

### 1.1 Historical Background

The origins of the Internet trace back to ARPANET in 1969. Funded by the Advanced Research Projects Agency (DARPA) of the U.S. Department of Defense, it began by connecting four nodes: UCLA, Stanford Research Institute (SRI), UC Santa Barbara (UCSB), and the University of Utah.

```
ARPANET Development Timeline:

1969  ARPANET launched (4 nodes)
  │
1973  Prototype of TCP/IP proposed (Vint Cerf & Bob Kahn)
  │
1983  ARPANET migrates from NCP to TCP/IP ("Flag Day")
  │      → This day is considered the Internet's "birthday"
  │
1986  NSFNET launched (backbone of academic networks)
  │
1991  WWW published at CERN (Tim Berners-Lee)
  │
1993  Mosaic browser released → Internet use expands to general public
  │
1995  NSFNET decommissioned → Full transition to commercial Internet
  │
1998  Google founded / ICANN established
  │
2004  Web 2.0 era (explosive growth of SNS, UGC)
  │
2010s Mobile Internet becomes mainstream
  │
2020s Era of 5G / edge computing / IoT
```

A particularly notable design philosophy of ARPANET was its "distributed" concept. During the Cold War, centralized communication systems were vulnerable to nuclear attack. A network that could continue communicating even if one location was destroyed — this led to the adoption of packet switching and forms the backbone of today's Internet.

### 1.2 Definition of the Internet

Technically, the Internet is defined as a combination of the following elements:

1. **Protocol suite**: Uses TCP/IP as a common language
2. **Interconnection**: Independent networks (AS: Autonomous Systems) connect with each other
3. **Distributed management**: There is no single administrator; ICANN, IETF, each country's NIC, and others share responsibilities
4. **End-to-end principle**: Intelligence is placed at the network edges (terminals), keeping the core network simple

```
Conceptual Model of the Internet:

   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  AS 65001   │     │  AS 65002   │     │  AS 65003   │
   │ ┌─────────┐ │     │ ┌─────────┐ │     │ ┌─────────┐ │
   │ │ Network │ │     │ │ Network │ │     │ │ Network │ │
   │ │    A    │ │     │ │    B    │ │     │ │    C    │ │
   │ └────┬────┘ │     │ └────┬────┘ │     │ └────┬────┘ │
   │      │      │     │      │      │     │      │      │
   │ ┌────┴────┐ │     │ ┌────┴────┐ │     │ ┌────┴────┐ │
   │ │ Border  │◄├─────┤►│ Border  │◄├─────┤►│ Border  │ │
   │ │ Router  │ │ BGP │ │ Router  │ │ BGP │ │ Router  │ │
   │ └─────────┘ │     │ └─────────┘ │     │ └─────────┘ │
   └─────────────┘     └─────────────┘     └─────────────┘
          │                    │                    │
          └────────────┬───────┘────────────┬──────┘
                       │                    │
                  ┌────┴─────┐        ┌─────┴────┐
                  │   IX     │        │   IX     │
                  │ (Tokyo)  │        │ (Osaka)  │
                  └──────────┘        └──────────┘

   AS = Autonomous System
   Each AS has its own routing policy
   BGP is used to exchange routing information between ASes
```

### 1.3 The Scale of the Internet in Numbers

| Metric | Value (as of 2024) | Notes |
|--------|-------------------|-------|
| Internet users | Approx. 5.4 billion | ~67% of world population |
| Connected devices | Approx. 17 billion | Including IoT devices |
| Number of ASes (Autonomous Systems) | Approx. 75,000 | Unit for BGP route exchange |
| Submarine cables | Approx. 550 | Total length over 1.4 million km |
| IXs (Internet Exchange Points) | Approx. 900 locations | Distributed worldwide |
| Daily traffic volume | Approx. 5 exabytes | 1 EB = 10^18 bytes |
| Registered domain names | Approx. 360 million | .com has the largest share |

---

## 2. Physical Structure of the Internet

### 2.1 Hierarchical Network Connectivity

The Internet has a hierarchical structure both logically and physically. Understanding this hierarchy is critically important for identifying the causes of latency and for network design.

```
ISP Hierarchy (ASCII diagram):

                    ┌─────────────────────┐
                    │     Tier 1 ISP      │
                    │  (Global scale)     │
                    │  NTT Communications │
                    │  Lumen / GTT / Telia│
                    └──────┬──────┬───────┘
                           │      │
              ┌────────────┘      └────────────┐
              │                                │
    ┌─────────┴──────────┐          ┌──────────┴─────────┐
    │    Tier 2 ISP      │          │    Tier 2 ISP      │
    │   (Regional)       │          │   (Regional)       │
    │  KDDI / SoftBank   │          │  IIJ / BIGLOBE     │
    └────┬─────────┬─────┘          └──────┬──────┬──────┘
         │         │                       │      │
    ┌────┴───┐ ┌───┴────┐           ┌─────┴──┐ ┌─┴──────┐
    │Tier 3  │ │Tier 3  │           │Tier 3  │ │Tier 3  │
    │(Local) │ │(Local) │           │(Local) │ │(Local) │
    │ Local  │ │ Local  │           │ Local  │ │ Local  │
    │  ISP   │ │  ISP   │           │  ISP   │ │  ISP   │
    └────┬───┘ └───┬────┘           └────┬───┘ └───┬────┘
         │         │                     │         │
      [Home]   [Business]           [Home]     [Business]

Tier 1: Pays no transit fees at all
        → Can reach the entire Internet through peering (mutual interconnection) only
        → Approximately 15 companies worldwide

Tier 2: Pays transit fees to Tier 1
        → Peers with some networks
        → Has regional coverage

Tier 3: Pays transit fees to Tier 2
        → Provides services directly to end users
        → Locally-oriented providers
```

### 2.2 Transit and Peering

There are two main types of connections between ISPs.

**Transit**: A relationship in which a lower-tier ISP pays fees to a higher-tier ISP and accesses the entire Internet through that ISP. A customer-provider relationship.

**Peering**: A relationship in which ISPs of similar scale exchange each other's traffic without charge. Typically connected physically at an IX (Internet Exchange Point).

| Item | Transit | Peering |
|------|---------|---------|
| Cost | Paid (usage-based or flat-rate) | Usually free (settlement-free) |
| Route | Reachability to the entire Internet | Only to the peer AS and its customers |
| Relationship | Hierarchical (customer-provider) | Equal |
| Connection location | Dedicated line or IX | Mainly at IX |
| Traffic ratio | Unrestricted | Roughly balanced as a condition |
| Contract | With SLA (Service Level Agreement) | Often best-effort |
| Usage example | Small ISP purchases from large ISP | Large ISPs interconnect with each other |

### 2.3 IX (Internet Exchange Point)

An IX is a facility where multiple ISPs gather in one place to directly exchange traffic. Without IXs, even communications between servers in the same city would need to go through a distant upstream ISP, increasing latency and cost.

Major IXs in Japan:

- **JPIX (Japan Internet Exchange)**: One of Japan's largest IXs, based in Tokyo
- **JPNAP (Japan Network Access Point)**: Operated by Internet Multifeed Co.
- **BBIX**: Operated by the SoftBank Group
- **Equinix IX Tokyo**: Operated by global company Equinix

```
How Connectivity Works at an IX:

   ISP-A ──┐                    ┌── ISP-D
            │    ┌──────────┐   │
   ISP-B ──┼────┤  IX      ├───┼── ISP-E
            │    │ Switch   │   │
   ISP-C ──┘    └──────────┘   └── ISP-F

   An L2 switch inside the IX enables mutual connectivity among all ISPs
   Each ISP connects its own router to the IX port
   BGP sessions are established to exchange routing information

   Without an IX:
   ISP-A user → ISP-A → Tier 1 → ISP-B → ISP-B user
                     (roundabout, high cost, high latency)

   With an IX:
   ISP-A user → ISP-A → IX → ISP-B → ISP-B user
                     (direct connection, low cost, low latency)
```

### 2.4 Submarine Cables

More than 99% of international communications are carried by submarine cables. Although satellite communications may come to mind, submarine cables are overwhelmingly superior in both bandwidth and latency.

#### Structure of Submarine Cables

```
Cross-section of a Submarine Cable:

        ┌─────────────────────────────┐
        │   Polyethylene outer jacket │ ← Outermost layer (protection)
        │  ┌─────────────────────┐    │
        │  │   Steel wire armor  │    │ ← Reinforcement by steel wires
        │  │  ┌───────────────┐  │    │
        │  │  │  Copper tube  │  │    │ ← For power supply (to repeaters)
        │  │  │  ┌─────────┐  │  │    │
        │  │  │  │ Optical │  │  │    │ ← Several to tens of
        │  │  │  │ fiber   │  │  │    │   optical fiber pairs
        │  │  │  │ bundle  │  │  │    │
        │  │  │  └─────────┘  │  │    │
        │  │  └───────────────┘  │    │
        │  └─────────────────────┘    │
        └─────────────────────────────┘

        Diameter: ~17mm in deep sea (thicker in shallow areas)
        Number of fiber pairs: typically 8–24 pairs
        Repeater spacing: ~60–100 km
        Design life: 25 years
        Installation cost: tens of thousands to hundreds of thousands of dollars per km
```

#### Submarine Cable vs. Satellite Communication

| Item | Submarine Cable | Geostationary Satellite | Low Earth Orbit (LEO) Satellite |
|------|----------------|------------------------|--------------------------------|
| Latency (one-way) | Tens of ms | ~270 ms | ~20–40 ms |
| Bandwidth | Hundreds of Tbps/cable | Tens of Gbps | Tens of Gbps (entire constellation) |
| Reliability | High (redundant routes) | High | Still developing |
| Cost/Gbps | Low | High | Medium |
| Deployment period | Several years | Several years (until launch) | Several years (until constellation complete) |
| Geographic constraints | Depends on seafloor terrain | Limited to above the equator | Few constraints |
| Share of international traffic | Over 99% | Less than 1% | Rapidly growing |

#### Major Submarine Cables (Pacific)

- **FASTER**: Funded by Google and others. Japan–US. Capacity: 60 Tbps
- **JUPITER**: Japan–US. Participated by Amazon / Facebook and others
- **SJC2 (Southeast Asia-Japan Cable 2)**: Southeast Asia–Japan
- **APG (Asia Pacific Gateway)**: Connects the Asia-Pacific region
- **Unity**: Japan–US. Google / KDDI and others

### 2.5 Data Centers and the Cloud

In the modern Internet, the majority of traffic occurs between data centers, or between data centers and end users. Major cloud providers (AWS, Google Cloud, Microsoft Azure) have deployed data centers worldwide, each with its own backbone network.

```
Network Configuration of a Cloud Provider (conceptual diagram):

   User
     │
     ▼
   ISP ── IX ──┐
               │
     ┌─────────┴───────────────────────────────────┐
     │           Cloud Provider's                   │
     │           Private Network                    │
     │                                              │
     │  [Tokyo DC] ──── [Osaka DC] ──── [Singapore]│
     │      │              │              │          │
     │      └──────────────┼──────────────┘          │
     │                     │                         │
     │  [US West] ──────── [US East] ── [EU]        │
     │                                               │
     └───────────────────────────────────────────────┘

   Cloud providers:
   - Own/lease their own submarine cables
   - Connect directly to IXs to minimize latency
   - Link each region with dedicated circuits
   - Place CDN edge servers inside ISPs (PNI: Private Network Interconnect)
```

---

## 3. Details of Packet Communication

### 3.1 Circuit Switching vs. Packet Switching

The telephone network before the Internet used "circuit switching." This method reserved a dedicated physical line between the caller and the receiver for the duration of the call. In contrast, the Internet uses "packet switching."

```
Circuit Switching:

   Phone A ═══════════════════════════ Phone B
           (Dedicated line occupied during the call)
           (Line is in use even during silence)

   Advantages: Guaranteed quality, stable latency
   Disadvantages: Wasteful use of lines, hard to scale

Packet Switching:

   PC-A ──┐  [pkt1] [pkt3]          ┌── PC-B
          │    ↓      ↓             │
          ├── Router ── Router ── Router ──┤
          │    ↑                     │
   PC-C ──┘  [pkt2]                 └── PC-D

   Advantages: Efficient sharing of lines, scalable, fault-tolerant
   Disadvantages: Variable latency (jitter), possibility of packet loss
```

### 3.2 Packet Structure

A packet consists of a header and a payload (the actual data). In the TCP/IP model, each layer adds its own header. This is called "encapsulation."

```
Encapsulation Process:

Application layer:
  [HTTP data: "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"]

  ↓ TCP adds a header

Transport layer:
  [TCP Header][HTTP data]
  ├─ Source port: 54321
  ├─ Destination port: 80
  ├─ Sequence number: 1000
  ├─ ACK number: 0
  ├─ Flags: SYN
  └─ Window size: 65535

  ↓ IP adds a header

Network layer:
  [IP Header][TCP Header][HTTP data]
  ├─ Version: 4 (IPv4)
  ├─ Header length: 20 bytes
  ├─ Total length: 60 bytes
  ├─ TTL: 64
  ├─ Protocol: 6 (TCP)
  ├─ Source IP: 192.168.1.100
  └─ Destination IP: 93.184.216.34

  ↓ Ethernet adds a header and trailer

Data link layer:
  [Ethernet Header][IP Header][TCP Header][HTTP data][FCS]
  ├─ Destination MAC: AA:BB:CC:DD:EE:FF
  ├─ Source MAC: 11:22:33:44:55:66
  ├─ Type: 0x0800 (IPv4)
  └─ FCS: Frame Check Sequence (for error detection)

Final frame size:
  Ethernet header: 14 bytes
  IP header:       20 bytes
  TCP header:      20 bytes
  HTTP data:       variable (up to 1460 bytes when MTU is 1500)
  FCS:             4 bytes
```

### 3.3 MTU and Fragmentation

MTU (Maximum Transmission Unit) is the maximum size of data that can be sent in a single frame. The standard MTU for Ethernet is 1500 bytes, but if there is a link along the path with a smaller MTU, packets will be split (fragmented).

```
Example of Fragmentation:

Sender transmits a 3000-byte IP packet
Arrives at a link with MTU = 1500

  Original packet:
  [IP Header(20)][Data(2980)]  = 3000 bytes

  Fragment 1:
  [IP Header(20)][Data(1480)]  = 1500 bytes
  ├─ MF (More Fragments) flag: 1
  └─ Fragment Offset: 0

  Fragment 2:
  [IP Header(20)][Data(1480)]  = 1500 bytes
  ├─ MF flag: 1
  └─ Fragment Offset: 185 (= 1480/8)

  Fragment 3:
  [IP Header(20)][Data(20)]    = 40 bytes
  ├─ MF flag: 0 (last fragment)
  └─ Fragment Offset: 370 (= 2960/8)

  Reassembled at the receiver (identified by the Identification field)
```

> **Note**: In IPv6, fragmentation by intermediate routers is prohibited. The source must perform Path MTU Discovery and send packets of the appropriate size.

### 3.4 Practical Packet Analysis (Code Example 1: tcpdump)

tcpdump is a command-line tool that captures packets flowing through a network interface. By directly observing packet contents, you can deeply understand how communication works.

```bash
# Code Example 1: HTTP packet capture with tcpdump

# Basic usage: capture packets on TCP port 80
$ sudo tcpdump -i eth0 -n port 80

# Example output:
# 14:23:01.123456 IP 192.168.1.100.54321 > 93.184.216.34.80:
#   Flags [S], seq 1000, win 65535, options [mss 1460,sackOK,TS val 123 ecr 0],
#   length 0
# 14:23:01.234567 IP 93.184.216.34.80 > 192.168.1.100.54321:
#   Flags [S.], seq 2000, ack 1001, win 65535, options [mss 1460,sackOK,TS val 456 ecr 123],
#   length 0
# 14:23:01.234789 IP 192.168.1.100.54321 > 93.184.216.34.80:
#   Flags [.], ack 2001, win 65535, length 0

# Flag meanings:
# [S]  = SYN (connection request)
# [S.] = SYN-ACK (connection response)
# [.]  = ACK (acknowledgment)
# [P.] = PSH-ACK (data send + acknowledgment)
# [F.] = FIN-ACK (connection termination)
# [R]  = RST (connection reset)

# More detailed options:
# -X: display packet contents in hex and ASCII
$ sudo tcpdump -i eth0 -n -X port 80

# Example output (HTTP GET request):
# 14:23:01.345678 IP 192.168.1.100.54321 > 93.184.216.34.80:
#   Flags [P.], seq 1001:1078, ack 2001, win 65535, length 77
#   0x0000:  4500 0075 1234 4000 4006 abcd c0a8 0164
#   0x0010:  5db8 d822 d431 0050 0000 03e9 0000 07d1
#   0x0020:  5018 ffff 1234 0000 4745 5420 2f20 4854
#   0x0030:  5450 2f31 2e31 0d0a 486f 7374 3a20 6578
#   0x0040:  616d 706c 652e 636f 6d0d 0a0d 0a
#            G  E  T     /     H  T  T  P  /  1  .  1
#            H  o  s  t  :     e  x  a  m  p  l  e  .  c  o  m

# Save to a pcap file for later analysis with Wireshark
$ sudo tcpdump -i eth0 -n -w capture.pcap port 80
# → Open capture.pcap in Wireshark for detailed GUI analysis
```

### 3.5 The Life of a Packet: From Sending to Receiving

We trace the journey a packet takes when a user accesses `https://example.com`.

```
Packet Journey (detailed):

Step 1: Application (browser)
  ├─ Parse URL: protocol=HTTPS, host=example.com, path=/
  ├─ Request DNS resolution (detailed in Section 5)
  └─ Initiate TCP connection

Step 2: OS network stack
  ├─ Receive data via socket API
  ├─ Generate TCP segment (assign port number, sequence number)
  ├─ Generate IP packet (assign source/destination IP)
  ├─ Consult routing table → determine next hop
  ├─ Resolve MAC address of next hop via ARP
  └─ Generate Ethernet frame

Step 3: NIC (Network Interface Card)
  ├─ Convert frame to electrical signal (wired) or radio waves (wireless)
  └─ Transmit to physical medium

Step 4: Home router
  ├─ Receive frame → extract IP packet
  ├─ Consult NAT table (translate private IP → global IP)
  ├─ Generate new IP packet
  └─ Send out via ISP-facing interface

Step 5: ISP network
  ├─ Pass through multiple routers
  ├─ Each router consults routing table
  ├─ Select the optimal path determined by BGP
  └─ Forward to next ISP or IX

Step 6: IX (Internet Exchange Point)
  ├─ Forward frame via L2 switch
  └─ Reach router belonging to the destination AS

Step 7: Destination network
  ├─ Inspect at firewall (allow/deny)
  ├─ Distribute to appropriate server via load balancer
  └─ Reach server's NIC

Step 8: Server OS
  ├─ Extract IP packet from frame
  ├─ Extract TCP segment from IP packet
  ├─ Extract application data from TCP segment
  └─ Pass data to application (Web server)

Step 9: Application (Web server)
  ├─ Interpret HTTP request
  ├─ Generate HTML content
  └─ Return response (follows the reverse path)
```

---

## 4. Principles of Routing

### 4.1 What Is Routing?

Routing is the process of selecting a path to deliver a packet from its source to its destination. Each router maintains a database of routing information called a "routing table," and each time a packet arrives, it consults the table to determine the next hop (the next destination to forward to).

### 4.2 Static Routing vs. Dynamic Routing

```
Static Routing:
  → Administrator manually configures routes
  → Suitable for small networks
  → Configuration example:
    ip route 10.0.0.0/8 via 192.168.1.1
    ip route 172.16.0.0/12 via 192.168.1.2
    ip route 0.0.0.0/0 via 192.168.1.254  (default route)

Dynamic Routing:
  → Routing protocol automatically learns and updates routes
  → Suitable for large networks
  → Automatically switches routes on failure (convergence)
```

### 4.3 Classification of Routing Protocols

| Category | Protocol | Use | Algorithm | Characteristics |
|----------|---------|-----|-----------|----------------|
| IGP (Interior) | RIP | Small LAN | Distance vector | Route selection by hop count. Max 15 hops |
| IGP (Interior) | OSPF | Medium to large | Link state | Route selection by cost (bandwidth). Fast convergence |
| IGP (Interior) | IS-IS | Large ISP | Link state | Similar to OSPF. Popular in ISP backbones |
| IGP (Interior) | EIGRP | Cisco environments | Hybrid | Cisco proprietary (now open spec). Route selection by bandwidth + delay |
| EGP (Exterior) | BGP | Between ASes | Path vector | Foundation of the Internet. Policy-based route selection |

### 4.4 BGP (Border Gateway Protocol) in Detail

BGP is the most important protocol supporting Internet routing. Approximately 75,000 ASes use BGP to exchange routing information, maintaining reachability across the entire Internet.

```
How BGP Works:

1. Establishing BGP Peering
   Router in AS 65001 ←── TCP port 179 ──→ Router in AS 65002
   │                                         │
   ├─ Exchange OPEN messages                 │
   ├─ KEEPALIVE for liveness checks (every 60 seconds)
   └─ Exchange routing information via UPDATE messages

2. Route Propagation
   AS 65001 advertises 10.1.0.0/16:

   AS 65001 ──→ AS 65002 ──→ AS 65003
   "10.1.0.0/16   "10.1.0.0/16   "10.1.0.0/16
    AS_PATH:       AS_PATH:        AS_PATH:
    65001"         65002,65001"    65003,65002,65001"

   → The longer the AS_PATH, the "farther" it is considered
   → Loop detection: if own AS number appears in AS_PATH, discard

3. Best Path Selection (BGP Best Path Selection Algorithm):
   ① Highest LOCAL_PREF (local policy priority)
   ② Shortest AS_PATH
   ③ ORIGIN type (IGP > EGP > Incomplete)
   ④ Lowest MED (Multi-Exit Discriminator)
   ⑤ eBGP > iBGP
   ⑥ Lowest IGP metric (distance to next hop)
   ⑦ Lowest router ID
```

### 4.5 Code Example 2: Checking the Routing Table

```bash
# Code Example 2: Checking and analyzing the routing table

# Display routing table on Linux
$ ip route show
# Example output:
# default via 192.168.1.1 dev eth0 proto dhcp metric 100
# 10.0.0.0/8 via 192.168.1.254 dev eth0 proto static metric 50
# 172.16.0.0/12 via 192.168.1.253 dev eth0 proto static metric 50
# 192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100

# Display routing table on macOS
$ netstat -rn
# Example output:
# Routing tables
#
# Internet:
# Destination        Gateway            Flags    Netif
# default            192.168.1.1        UGScg    en0
# 10.0.0.0/8         192.168.1.254      UGSc     en0
# 127.0.0.1          127.0.0.1          UH       lo0
# 192.168.1.0/24     link#4             UCS      en0
# 192.168.1.1        aa:bb:cc:dd:ee:ff  UHLWIir  en0
# 192.168.1.100      127.0.0.1          UHS      lo0

# Field meanings:
# Destination: destination network
# Gateway:     next hop (the router to forward to)
# Flags:
#   U = Up (active)
#   G = Gateway (via router)
#   S = Static (static route)
#   H = Host (host route)
#   C = Clone (cloned for new connections)
# Netif: network interface to use

# Check the route to a specific destination
$ ip route get 8.8.8.8
# Example output:
# 8.8.8.8 via 192.168.1.1 dev eth0 src 192.168.1.100 uid 1000
#     cache
```

---

## 5. How DNS Resolution Works

### 5.1 What Is DNS?

DNS (Domain Name System) is a system that translates human-readable domain names (e.g., example.com) into IP addresses (e.g., 93.184.216.34). It is sometimes called the "phone book of the Internet."

### 5.2 DNS Hierarchy

```
DNS Hierarchy:

                    ┌──────────────┐
                    │  Root DNS    │  ← 13 clusters total (a–m.root-servers.net)
                    │  Servers     │     Hundreds of servers distributed worldwide via Anycast
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────┴───────┐┌──────┴───────┐┌──────┴───────┐
    │ .com TLD     ││ .jp TLD      ││ .org TLD     │
    │ DNS servers  ││ DNS servers  ││ DNS servers  │
    └──────┬───────┘└──────┬───────┘└──────────────┘
           │               │
    ┌──────┴───────┐┌──────┴───────┐
    │ example.com  ││ example.jp   │
    │ Authoritative││ Authoritative│
    │ DNS servers  ││ DNS servers  │
    └──────────────┘└──────────────┘

DNS Resolution Steps (recursive query):

  Browser → OS resolver → ISP's caching DNS
                                    │
                         Cache hit?
                            │          │
                           Yes         No
                            │          │
                         Respond      Query root DNS
                         immediately  │
                                    Responds ".com is here"
                                       │
                                    Query .com TLD DNS
                                       │
                                    Responds "example.com is here"
                                       │
                                    Query authoritative DNS
                                       │
                                    Responds "93.184.216.34"
                                       │
                                    Store in cache (for TTL duration)
                                       │
                                    Respond to client
```

### 5.3 Code Example 3: Verifying DNS Resolution

```bash
# Code Example 3: Detailed DNS resolution verification

# Execute a DNS query with dig
$ dig example.com

# Example output:
# ;; QUESTION SECTION:
# ;example.com.                   IN      A
#
# ;; ANSWER SECTION:
# example.com.            86400   IN      A       93.184.216.34
#
# ;; Query time: 23 msec
# ;; SERVER: 192.168.1.1#53(192.168.1.1) (UDP)

# Check the entire DNS resolution process with trace
$ dig +trace example.com

# Example output:
# .                       518400  IN      NS      a.root-servers.net.
# .                       518400  IN      NS      b.root-servers.net.
# ...
# com.                    172800  IN      NS      a.gtld-servers.net.
# com.                    172800  IN      NS      b.gtld-servers.net.
# ...
# example.com.            172800  IN      NS      a.iana-servers.net.
# example.com.            172800  IN      NS      b.iana-servers.net.
# ...
# example.com.            86400   IN      A       93.184.216.34

# Check each record type
$ dig example.com A        # IPv4 address
$ dig example.com AAAA     # IPv6 address
$ dig example.com MX       # Mail server
$ dig example.com NS       # Name server
$ dig example.com TXT      # Text record (SPF, DKIM, etc.)
$ dig example.com CNAME    # Alias

# nslookup can also retrieve equivalent information
$ nslookup example.com
# Server:   192.168.1.1
# Address:  192.168.1.1#53
#
# Non-authoritative answer:
# Name: example.com
# Address: 93.184.216.34

# Check DNS cache (macOS)
$ sudo dscacheutil -statistics
# → Can check cache hit rate

# Clear DNS cache (macOS)
$ sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

---

## 6. Visualizing and Analyzing Communication Paths

### 6.1 Code Example 4: Path Tracing with traceroute

traceroute is a tool that lists the routers (hops) a packet passes through before reaching its destination. It sends ICMP packets (or UDP packets) with TTL (Time To Live) incrementally starting from 1, and uses ICMP Time Exceeded messages returned by each router to identify the path.

```bash
# Code Example 4: Running and analyzing traceroute

# Basic usage (Linux/macOS)
$ traceroute example.com

# Example output:
# traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets
#  1  router.local (192.168.1.1)  1.234 ms  0.987 ms  1.123 ms
#  2  gw-001.isp.example.net (203.0.113.1)  5.678 ms  5.432 ms  5.891 ms
#  3  core-r01.tokyo.isp.net (198.51.100.1)  8.123 ms  7.987 ms  8.234 ms
#  4  ix-peer.jpix.ad.jp (192.0.2.1)  10.456 ms  10.234 ms  10.567 ms
#  5  edge-r01.datacenter.net (192.0.2.100)  15.789 ms  15.432 ms  15.678 ms
#  6  cdn-node.example.com (93.184.216.34)  18.012 ms  17.890 ms  18.123 ms

# Meaning of each column:
# Hop number  Hostname (IP address)  RTT1  RTT2  RTT3
# → Three RTT (Round Trip Time) values are shown
# → Large variance may indicate that router is congested

# When * * * is displayed:
# → That router is configured not to respond to ICMP (security policy)
# → Packet is being filtered
# → Does not necessarily indicate a problem

# traceroute using TCP SYN (effective for firewall traversal)
$ sudo traceroute -T -p 443 example.com

# traceroute using ICMP Echo
$ sudo traceroute -I example.com

# On Windows, use the tracert command
# > tracert example.com

# mtr (My Traceroute): real-time combination of traceroute + ping
$ mtr example.com

# Example mtr output:
#                              My traceroute  [v0.95]
# Host:                                Loss%   Snt   Last   Avg  Best  Wrst StDev
#  1. router.local                      0.0%    50    1.2   1.3   0.8   2.1   0.3
#  2. gw-001.isp.example.net            0.0%    50    5.4   5.6   5.1   6.8   0.4
#  3. core-r01.tokyo.isp.net            0.0%    50    8.1   8.3   7.8   9.2   0.3
#  4. ix-peer.jpix.ad.jp                0.0%    50   10.3  10.5  10.0  11.8   0.4
#  5. cdn-node.example.com              0.0%    50   18.0  18.2  17.5  19.1   0.4

# Advantages of mtr:
# - Statistics are updated in real time
# - Packet loss rate is visualized
# - Latency variation (jitter) is visible
# - -r option for report mode (non-interactive)
$ mtr -r -c 100 example.com
```

#### How traceroute Works

```
Internal Operation of traceroute:

Step 1: Send a packet with TTL=1
  PC ──[TTL=1]──→ Router-A ──X (TTL reaches 0, packet discarded)
                   │
                   └── ICMP Time Exceeded is returned
                       → IP address and RTT of Router-A become known

Step 2: Send a packet with TTL=2
  PC ──[TTL=2]──→ Router-A ──[TTL=1]──→ Router-B ──X
                                          │
                                          └── ICMP Time Exceeded is returned
                                              → IP and RTT of Router-B become known

Step 3: Send a packet with TTL=3
  PC ──[TTL=3]──→ Router-A ──[TTL=2]──→ Router-B ──[TTL=1]──→ Server
                                                                │
                                                                └── ICMP Port Unreachable
                                                                    (or TCP RST) is returned
                                                                    → Destination reached

  → By incrementing TTL by 1, each hop's router is identified in order
  → Ends when the maximum number of hops (default 30) is reached without a response
```

### 6.2 Code Example 5: Connectivity Verification and Statistical Analysis with ping

```bash
# Code Example 5: Advanced ping usage

# Basic ping (4 packets)
$ ping -c 4 example.com
# PING example.com (93.184.216.34): 56 data bytes
# 64 bytes from 93.184.216.34: icmp_seq=0 ttl=56 time=95.123 ms
# 64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=94.876 ms
# 64 bytes from 93.184.216.34: icmp_seq=2 ttl=56 time=95.234 ms
# 64 bytes from 93.184.216.34: icmp_seq=3 ttl=56 time=94.987 ms
#
# --- example.com ping statistics ---
# 4 packets transmitted, 4 packets received, 0.0% packet loss
# round-trip min/avg/max/stddev = 94.876/95.055/95.234/0.131 ms

# How to read the statistics:
# min:    minimum RTT (latency when network is idle)
# avg:    average RTT (typical latency benchmark)
# max:    maximum RTT (latency during congestion)
# stddev: standard deviation (jitter: higher values mean unstable latency)

# Specify packet size to diagnose MTU issues
$ ping -c 4 -s 1472 example.com          # 1472 + 28 (IP+ICMP header) = 1500
$ ping -c 4 -s 1473 -D example.com       # Set DF bit (no fragmentation allowed)
# → "Message too long" means path MTU is less than 1500

# Flood ping (high-load test: requires root privileges)
$ sudo ping -f -c 1000 example.com
# → Sends a large number of packets rapidly to measure packet loss rate
# → Never run in production environments

# Specify send interval (10 times at 0.2-second intervals)
$ ping -c 10 -i 0.2 example.com

# With timestamps (useful for identifying failure times)
$ ping -c 100 example.com | while read line; do
>   echo "$(date '+%Y-%m-%d %H:%M:%S') $line"
> done

# Simultaneous ping to multiple hosts (fping)
$ fping -c 5 8.8.8.8 1.1.1.1 208.67.222.222
# 8.8.8.8     : [0], 84 bytes, 5.12 ms
# 1.1.1.1     : [0], 84 bytes, 3.45 ms
# 208.67.222.222 : [0], 84 bytes, 12.34 ms
```

### 6.3 Components of Network Latency

Network latency consists of multiple components. Understanding each contribution makes it easier to isolate problems.

| Type of Latency | Cause | Typical Value | How to Improve |
|----------------|-------|--------------|---------------|
| Propagation delay | Speed of light limit (~200,000 km/s in medium) | Tokyo–LA: ~50 ms (one-way) | Use CDN, place edge servers |
| Processing delay | Header inspection, routing decisions at routers | A few μs to a few ms | Deploy high-performance routers |
| Queuing delay | Wait time in router buffers | 0 to hundreds of ms (traffic-dependent) | QoS configuration, bandwidth expansion |
| Transmission delay | Time to put a packet onto the link | 1500B at 1 Gbps: 12 μs | Increase line bandwidth |
| Serialization delay | Time from first to last bit transmitted | Negligible for small packets | Optimize packet size |

```
Latency Calculation Example:

Tokyo client → Los Angeles server

Propagation delay (one-way):
  Distance: ~8,800 km (via submarine cable)
  Speed of light in optical fiber: ~200,000 km/s
  Propagation delay = 8,800 / 200,000 = 44 ms

RTT (round-trip delay):
  Theoretical minimum = 44 ms × 2 = 88 ms

  Actual value (including router processing, etc.):
  → ~100–120 ms is typical
  → Difference from theoretical (12–32 ms) = router processing + queuing delay
```

---

## 7. Complete Flow of Web Page Display

### 7.1 From URL Entry to Rendering

When you access `https://example.com` in a browser, the following sequence of processes is executed.

```
Web Page Display Timeline:

    Time(ms)  Event
    ─────────────────────────────────────────────────
    0         User presses Enter
    │
    ├── 1. Check browser cache (< 1 ms)
    │   └── If cache hit, process ends here
    │
    ├── 2. DNS resolution (20–100 ms)
    │   ├── Browser DNS cache
    │   ├── OS DNS cache
    │   ├── Router DNS cache
    │   └── ISP DNS resolver → authoritative DNS
    │
    ├── 3. TCP 3-way handshake (1 RTT = 30–100 ms)
    │   ├── Client → Server: SYN
    │   ├── Server → Client: SYN-ACK
    │   └── Client → Server: ACK
    │
    ├── 4. TLS handshake (1–2 RTT = 30–200 ms)
    │   ├── ClientHello (present supported cipher suites)
    │   ├── ServerHello (select cipher suite + send certificate)
    │   ├── Certificate verification (verify CA chain)
    │   ├── Key exchange (establish shared secret via ECDHE, etc.)
    │   └── Finished (encrypted communication begins)
    │   * TLS 1.3 completes in 1-RTT (0-RTT also possible for reconnections)
    │
    ├── 5. Send HTTP request
    │   GET / HTTP/2
    │   Host: example.com
    │   Accept: text/html
    │   Accept-Encoding: gzip, br
    │
    ├── 6. Server processing (10–500 ms)
    │   ├── Parse request
    │   ├── Routing
    │   ├── Execute business logic
    │   ├── DB query (if needed)
    │   └── Generate response
    │
    ├── 7. Receive HTTP response
    │   HTTP/2 200 OK
    │   Content-Type: text/html; charset=utf-8
    │   Content-Encoding: br
    │   Cache-Control: max-age=3600
    │
    ├── 8. Parse HTML & build DOM (50–200 ms)
    │   ├── HTML tokenizing
    │   ├── Build DOM tree
    │   ├── Discover sub-resources (CSS, JS, images)
    │   └── Preload scanner starts fetching resources in parallel
    │
    ├── 9. Parse CSS & build CSSOM
    │   ├── Download CSS files
    │   ├── Build CSSOM tree
    │   └── Render Tree = DOM + CSSOM
    │
    ├── 10. Execute JavaScript
    │    ├── Download JS files
    │    ├── Parse & compile
    │    ├── Execute (DOM manipulation, register event listeners, etc.)
    │    └── Control execution timing via defer/async attributes
    │
    ├── 11. Layout calculation (Layout/Reflow)
    │    ├── Calculate position and size of each element
    │    └── Layout based on viewport
    │
    ├── 12. Paint & composite
    │    ├── Draw pixels per layer
    │    ├── Composite via GPU
    │    └── Display on screen
    │
    ─────────────────────────────────────────────────
    Total: 200 ms to several seconds (depending on network environment and page complexity)
```

### 7.2 HTTP/1.1 vs HTTP/2 vs HTTP/3

| Item | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|---------|--------|--------|
| Protocol | TCP | TCP | QUIC (UDP-based) |
| Multiplexing | None (1 request per connection) | Stream multiplexing | Stream multiplexing |
| Header compression | None | HPACK | QPACK |
| Server push | None | Yes | Yes |
| Connection establishment | TCP: 1 RTT + TLS: 1–2 RTT | TCP: 1 RTT + TLS: 1–2 RTT | QUIC: 1 RTT (0-RTT for reconnections) |
| Head-of-Line blocking | Yes (TCP level) | Yes (TCP level) | None (independent streams) |
| Encryption | Optional | Effectively required | Required (built into QUIC) |
| Year standardized | 1997 (RFC 2068) | 2015 (RFC 7540) | 2022 (RFC 9114) |

---

## 8. NAT (Network Address Translation)

### 8.1 How NAT Works

NAT is a technology that translates between private IP addresses and global IP addresses. It is implemented in virtually all home routers as the most widely adopted countermeasure against IPv4 address exhaustion.

```
NAT Operation:

  Private network             Internet
  192.168.1.0/24

  PC-A (192.168.1.100)  ──┐
                          │   ┌──────────────┐      ┌──────────────┐
  PC-B (192.168.1.101)  ──┼───┤  NAT Router  ├──────┤   Server     │
                          │   │  203.0.113.1 │      │ 93.184.216.34│
  PC-C (192.168.1.102)  ──┘   └──────────────┘      └──────────────┘

NAT Table Example:

┌──────────────────────┬──────────────────────┬──────────────────────┐
│ Internal address     │ External address     │ Destination          │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ 192.168.1.100:54321  │ 203.0.113.1:10001    │ 93.184.216.34:443    │
│ 192.168.1.101:54322  │ 203.0.113.1:10002    │ 93.184.216.34:443    │
│ 192.168.1.100:54323  │ 203.0.113.1:10003    │ 8.8.8.8:53           │
│ 192.168.1.102:54324  │ 203.0.113.1:10004    │ 151.101.1.69:443     │
└──────────────────────┴──────────────────────┴──────────────────────┘

How it works:
1. PC-A sends a packet to 93.184.216.34:443
   Source: 192.168.1.100:54321 → Destination: 93.184.216.34:443

2. NAT router creates an entry in the table
   Rewrites source to 203.0.113.1:10001

3. Server sends a response
   Source: 93.184.216.34:443 → Destination: 203.0.113.1:10001

4. NAT router looks up the table and rewrites the destination
   Restores destination to 192.168.1.100:54321

5. Packet arrives at PC-A
```

### 8.2 Types of NAT

| Type | Description | Use |
|------|-------------|-----|
| SNAT (Source NAT) | Translates source address | Internal → External communication |
| DNAT (Destination NAT) | Translates destination address | Port forwarding |
| PAT / NAPT | Also translates port numbers (many-to-one) | Home routers |
| Full Cone NAT | Once mapped, external access is freely possible | Gaming, P2P |
| Symmetric NAT | Different mapping per destination | Corporate firewalls |

### 8.3 NAT and IPv6

IPv6's original design intended to eliminate the need for NAT by assigning a global unicast address to every device. However, due to security policy conventions and privacy reasons, stateful firewalls and privacy addresses (RFC 4941) are also used in IPv6 environments.

```
IPv4 vs IPv6 Address Space:

IPv4: 32 bits = ~4.3 billion addresses
  → Exhaustion predicted in the late 1990s, extended by NAT + CIDR
  → IANA distributed the last /8 block in 2011

IPv6: 128 bits = ~3.4 × 10^38 addresses
  → Even assigning tens of millions of addresses to every grain of sand
     on Earth (~7.5 × 10^18 grains) would leave plenty to spare
  → Can assign global addresses to all devices without NAT

Example IPv6 address:
  2001:0db8:85a3:0000:0000:8a2e:0370:7334
  → Abbreviated: 2001:db8:85a3::8a2e:370:7334
```

---

## 9. CDN (Content Delivery Network)

### 9.1 How CDNs Work

A CDN is a technology that reduces latency and lightens the load on origin servers by delivering content from edge servers physically close to the user.

```
Without CDN:

  Tokyo user ──────────── Origin server in the US
                  RTT: 100ms
                  All requests reach the origin

With CDN:

  Tokyo user ── Tokyo CDN edge ──── US origin
                   RTT: 5ms              (only on cache miss)

CDN placement:

                      ┌─────────────────┐
                      │   Origin        │
                      │   server        │
                      └────────┬────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
        ┌──────┴──────┐ ┌─────┴──────┐ ┌──────┴──────┐
        │ Edge        │ │ Edge       │ │ Edge        │
        │ (Tokyo)     │ │ (US West)  │ │ (EU)        │
        └──────┬──────┘ └─────┬──────┘ └──────┬──────┘
               │              │               │
         [Tokyo         [US West         [European
          users]         users]           users]
```

### 9.2 CDN Request Processing Flow

1. User resolves DNS for `www.example.com`
2. The CDN's DNS returns the IP of the geographically nearest edge server (GeoDNS / Anycast)
3. User's request reaches the edge server
4. Edge server checks its cache:
   - **Cache hit**: Immediately returns a response (a few ms)
   - **Cache miss**: Forwards the request to the origin server, caches the response, then returns it

---

## 10. Anti-Patterns

### 10.1 Anti-Pattern 1: Network Design with a Single Point of Failure (SPOF)

```
Anti-pattern: Single ISP connection

  [Company-wide network]
         │
    ┌────┴────┐
    │ Router  │  ← Single router
    └────┬────┘
         │
    [ISP-A only]  ← Single ISP connection
         │
    [Internet]

Problems:
  - All communications stop if ISP-A fails
  - All communications stop if the router breaks down
  - Requires planned downtime for maintenance windows

Recommended pattern: Multi-homing + redundant configuration

  [Company-wide network]
       │       │
  ┌────┴──┐ ┌──┴────┐
  │Router │ │Router │  ← Redundant routers (VRRP/HSRP)
  │  #1   │ │  #2   │
  └───┬───┘ └───┬───┘
      │         │
  [ISP-A]   [ISP-B]   ← Multi-homing
      │         │
  [Internet]

Advantages:
  - ISP-B automatically takes over if ISP-A fails
  - Other router takes over if one fails
  - Maintenance without downtime
  - Performance improvement through traffic distribution
```

#### Why It Is Dangerous

A notable large-scale example: in the 2021 Fastly CDN outage, a configuration error took down a wide range of websites (Reddit, GitHub, Amazon, etc.) for about an hour. In the 2023 KDDI outage, equipment failure affected mobile communications for approximately 86 hours. Eliminating single points of failure is one of the highest priorities in system design.

### 10.2 Anti-Pattern 2: Extremely Short (or Long) DNS TTL

```
Anti-pattern: TTL = 0 or TTL = 30 seconds

Problems:
  - DNS resolution occurs for every single request
  - Load on DNS servers spikes dramatically
  - If the DNS server goes down, name resolution immediately fails
  - Initial access latency occurs every time

  DNS resolution cost per request:
  → Cache hit:   < 1 ms
  → Full resolve: 50–200 ms
  → With TTL=0, 50–200 ms overhead on every request

Anti-pattern: TTL = 86400 (24 hours) or longer

Problems:
  - Delay in reflecting IP address changes
  - Failover can take up to 24 hours
  - Difficult to switch CDN or migrate servers

Recommended: TTL = 300–3600 seconds (5 minutes–1 hour)

  Recommended values by use case:
  ┌──────────────────┬────────────┬────────────────────────┐
  │ Use case         │ Rec. TTL   │ Reason                 │
  ├──────────────────┼────────────┼────────────────────────┤
  │ General Web      │ 300–3600   │ Balance between change frequency and performance │
  │ Failover         │ 30–60      │ Quick switching during failures │
  │ Static content   │ 3600–86400 │ Almost never changes   │
  │ Load balancing   │ 60–300     │ Adequate distribution  │
  └──────────────────┴────────────┴────────────────────────┘
```

#### Why It Is Dangerous

When the TTL is too short, not only does DNS server load increase, but an outage of the DNS provider directly causes an outage of the entire service. Conversely, when the TTL is too long, emergency failover does not function. "IP rotation" — changing IP addresses to evade DDoS attacks — is also less effective when the TTL is long.

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: BGP Hijacking

BGP is fundamentally a "trust-based" protocol with weak mechanisms for verifying the legitimacy of received route advertisements. If a malicious (or misconfigured) AS advertises a prefix that does not belong to it, Internet traffic is diverted to an unauthorized path.

```
Example of BGP Hijacking:

Normal state:
  AS 65001 advertises 10.1.0.0/16
  → The entire Internet recognizes 10.1.0.0/16 → AS 65001

Hijacking occurs:
  AS 99999 (attacker) advertises 10.1.0.0/24
  → 10.1.0.0/24 is a more specific prefix (/24 > /16)
  → By the longest-match rule, traffic to 10.1.0.0/24 is absorbed by AS 99999

  Normal: User → ISP → AS 65001 (legitimate server)
  Abnormal: User → ISP → AS 99999 (attacker's network)

Countermeasures:
  - RPKI (Resource Public Key Infrastructure)
    → Cryptographically verifies the correspondence between prefixes and ASes
    → Register ROA (Route Origin Authorization)
  - BGPsec
    → Cryptographically verifies each hop of the path (still being adopted)
  - IRR (Internet Routing Registry) filtering
    → Filtering based on registered routing information

Real-world incidents:
  - 2008: Pakistan Telecom mistakenly advertised YouTube's prefix
    → YouTube was inaccessible worldwide for ~2 hours
  - 2018: BGP hijacking of MyEtherWallet cryptocurrency
    → DNS server traffic was hijacked and redirected to a phishing site
  - 2019: Large-scale route leak by China Telecom
    → European traffic routed through China
```

### 11.2 Edge Case 2: Submarine Cable Cuts

Submarine cables can be physically severed by anchor damage, earthquakes, underwater landslides, shark bites, etc. The impact of a cut to submarine cables — which carry more than 99% of international communications — is enormous.

```
Impact and Response when Submarine Cables Are Cut:

Cut pattern 1: Single cable cut
  ┌─────────┐    x CUT x    ┌─────────┐
  │ Japan   ├──── Cable A ────┤ US      │
  │         ├──── Cable B ────┤         │ ← Cable B automatically takes over
  │         ├──── Cable C ────┤         │ ← Cable C also available
  └─────────┘               └─────────┘
  → Impact: Reduced bandwidth, temporary increase in latency
  → Communication continues via redundant paths

Cut pattern 2: Multiple cable cuts in the same sea area (major earthquake, etc.)
  ┌─────────┐    x CUT x    ┌─────────┐
  │ Japan   ├──── Cable A ────┤ US      │
  │         ├──── Cable B x CUT x ────┤         │
  │         ├──── Cable C ────┤         │ ← Load concentrates on remaining cable
  └─────────┘               └─────────┘
  → Impact: Severe bandwidth shortage, major slowdown in communications
  → May require backup via satellite circuits

Recovery process:
  1. Arrange a cable-laying ship (days to weeks)
  2. Identify the cut location (OTDR: Optical Time Domain Reflectometry)
  3. Raise the cable
  4. Repair connection (fusion splicing)
  5. Test and restore
  → Entire process takes 2 weeks to several months

Real-world incidents:
  - 2006: Earthquake in southern Taiwan cut multiple Pacific cables
    → Internet in Southeast Asian countries destabilized for weeks
  - 2011: Great East Japan Earthquake damaged cables on the Pacific side
    → Large-scale disconnection avoided thanks to redundant paths and Sea of Japan cables
  - 2024: Reports of Houthi damage to submarine cables in the Red Sea
    → Impact on communications between Middle East and Europe
```

---

## 12. Detailed Comparison: IPv4 vs IPv6

IPv4, the most fundamental version of the Internet protocol, was standardized in 1981 as RFC 791. The ~4.3 billion address space was destined to be exhausted by the explosive growth of the Internet, and in 1998, IPv6 was standardized as RFC 2460.

### 12.1 IPv4 vs IPv6 Comparison Table

| Item | IPv4 | IPv6 |
|------|------|------|
| Address length | 32 bits | 128 bits |
| Number of addresses | ~4.3 billion (4.3 × 10^9) | ~3.4 × 10^38 |
| Notation | Dotted decimal (192.168.1.1) | Colon-separated hex (2001:db8::1) |
| Header size | Variable (20–60 bytes) | Fixed 40 bytes |
| Checksum | Yes (header checksum) | None (delegated to upper layers) |
| Fragmentation | Possible by routers too | Source only (Path MTU Discovery required) |
| Broadcast | Yes | None (replaced by multicast) |
| ARP | Yes (MAC address resolution) | Replaced by NDP (Neighbor Discovery Protocol) |
| DHCP | Required (DHCP v4) | Optional (SLAAC automatic configuration available) |
| IPsec | Optional | Required in spec (implementation optional) |
| NAT | Widely used | Basically unnecessary (global address for all devices) |
| Adoption | Still mainstream | ~45% of Google users (as of 2024) |

### 12.2 Types of IPv6 Addresses

```
Types and Uses of IPv6 Addresses:

1. Global Unicast (2000::/3)
   → Routable on the Internet
   → Equivalent to IPv4 global IP
   Example: 2001:db8:85a3::8a2e:370:7334

2. Link-Local (fe80::/10)
   → Valid only within the same link (segment)
   → Automatically configured on all IPv6 interfaces
   Example: fe80::1%eth0

3. Unique Local (fc00::/7, effectively fd00::/8)
   → Used within private networks
   → Equivalent to IPv4 RFC 1918 addresses
   Example: fd12:3456:789a::1

4. Multicast (ff00::/8)
   → Sent simultaneously to multiple hosts
   Example: ff02::1 (all nodes), ff02::2 (all routers)

5. Loopback (::1/128)
   → Points to itself
   → Equivalent to IPv4's 127.0.0.1

6. Unspecified (::/128)
   → Indicates an unassigned address state
   → Equivalent to IPv4's 0.0.0.0
```

---

## 13. Network Security Fundamentals

### 13.1 Encrypting Communications

Communications on the Internet are at risk of interception along the path if not encrypted. TLS (Transport Layer Security) is a protocol that provides encrypted communication over TCP.

```
TLS 1.3 Handshake Flow:

Client                                          Server
  │                                               │
  │  ClientHello                                  │
  │  + supported_versions: TLS 1.3               │
  │  + key_share: ECDHE parameters               │
  │  + signature_algorithms: RSA-PSS, ECDSA      │
  │  ──────────────────────────────────────────►  │
  │                                               │
  │                          ServerHello          │
  │                + key_share: ECDHE parameters  │
  │        {EncryptedExtensions}                  │
  │        {Certificate}                          │
  │        {CertificateVerify}                    │
  │        {Finished}                             │
  │  ◄──────────────────────────────────────────  │
  │                                               │
  │  {Finished}                                   │
  │  ──────────────────────────────────────────►  │
  │                                               │
  │  ◄═══════ Encrypted application data ══════►  │
  │                                               │

  * {} = encrypted message
  * TLS 1.3 completes in 1-RTT (TLS 1.2 requires 2-RTT)
  * 0-RTT reconnection: For previously connected servers,
     data can be sent from the first message (risk of replay attacks)
```

### 13.2 Types of DDoS Attacks

| Attack type | Layer | Method | Typical scale | Countermeasure |
|-------------|-------|--------|--------------|---------------|
| Volumetric | L3/L4 | UDP flood, DNS amplification | Hundreds of Gbps to Tbps | CDN/cloud DDoS protection, blackhole routing |
| Protocol | L3/L4 | SYN flood, Ping of Death | Millions of pps | SYN cookies, rate limiting |
| Application | L7 | HTTP flood, Slowloris | Tens of thousands to hundreds of thousands of rps | WAF, rate limiting, CAPTCHA |

```
Growth in DDoS Attack Scale:

2013: Spamhaus attack → 300 Gbps (largest at the time)
2016: Dyn DNS attack (Mirai botnet) → 1.2 Tbps
2017: Attack on Google → 2.54 Tbps (disclosed in 2020)
2020: Attack on AWS → 2.3 Tbps
2023: HTTP/2 attack on Google / Cloudflare → 398 Mrps (requests/sec)
→ Attack scale continues to grow each year, and defensive measures keep evolving
```

---

## 14. Exercises

### 14.1 Basic Exercises

Execute the following exercises in order to gain hands-on understanding of how the Internet fundamentally works.

**Exercise B-1: Measuring Latency with ping**

```bash
# Send ping to servers at different geographic distances and compare latency

# Step 1: Ping a nearby server
$ ping -c 10 www.google.co.jp
# Record RTT: _____ ms

# Step 2: Ping a server across the Pacific
$ ping -c 10 www.google.com
# Record RTT: _____ ms

# Step 3: Ping a server across the Atlantic
$ ping -c 10 www.bbc.co.uk
# Record RTT: _____ ms

# Discussion:
# 1. Explain the differences in RTT to each server in terms of physical distance
# 2. Calculate the theoretical minimum RTT from the speed of light
#    (~200,000 km/s in optical fiber) and discuss the causes of the difference
#    from the observed values
# 3. Predict whether measurements at different times of day (morning/noon/night)
#    would show differences
```

**Exercise B-2: Tracing DNS Resolution**

```bash
# Step 1: Normal DNS resolution
$ dig example.com

# Step 2: DNS resolution with trace
$ dig +trace example.com

# Step 3: Resolve using different DNS servers
$ dig @8.8.8.8 example.com       # Google Public DNS
$ dig @1.1.1.1 example.com       # Cloudflare DNS
$ dig @208.67.222.222 example.com # OpenDNS

# Discussion:
# 1. Compare the response times of each DNS server
# 2. Record the time for each step shown in dig +trace
#    (root → TLD → authoritative) and analyze where the most time is spent
# 3. Explain the change in response time when the same query is run twice
#    (verify the effect of caching)
```

**Exercise B-3: Understanding Routing Tables**

```bash
# Step 1: Display the routing table of your machine
# Linux:
$ ip route show
# macOS:
$ netstat -rn

# Step 2: Identify the default gateway
# → Look for the entry marked as "default" or "0.0.0.0/0"

# Step 3: Check the route to specific IP addresses
$ ip route get 8.8.8.8
$ ip route get 192.168.1.1

# Discussion:
# 1. What is the IP address of the default gateway?
#    Which device (router) does it point to?
# 2. Identify the entries for directly connected networks ("scope link")
# 3. Explain how the routes to 192.168.1.1 and 8.8.8.8 differ
```

### 14.2 Applied Exercises

More in-depth analysis building on a solid understanding of the fundamentals.

**Exercise A-1: Comparative Analysis of traceroute**

```bash
# Run traceroute to different destinations and analyze the differences in paths

# Step 1: traceroute to a domestic server
$ traceroute www.yahoo.co.jp
# Record hop count: _____ hops
# Record final RTT: _____ ms

# Step 2: traceroute to an overseas server
$ traceroute www.google.com
# Record hop count: _____ hops
# Record final RTT: _____ ms

# Step 3: traceroute to another overseas server
$ traceroute www.bbc.co.uk
# Record hop count: _____ hops
# Record final RTT: _____ ms

# Step 4: Check which organization each router on the path belongs to
# → Look up IP addresses with whois
$ whois 203.0.113.1 | grep -i "org-name\|netname\|descr"

# Analysis items:
# 1. In each traceroute, identify where the ISP boundary (AS boundary) is
# 2. Identify the hop that passes through the IX
#    (hostname hints: ix, peer, exchange, etc.)
# 3. Identify hops that are likely going through submarine cables
#    (points where RTT increases significantly)
# 4. Run again after some time and check whether the path changes
```

**Exercise A-2: Packet Analysis with tcpdump**

```bash
# Capture the TCP 3-way handshake and analyze the packet contents

# Step 1: Start tcpdump capture (run in a separate terminal)
$ sudo tcpdump -i any -n -v port 80 -w /tmp/capture.pcap &

# Step 2: Send an HTTP request
$ curl -v http://example.com

# Step 3: Stop capture
$ sudo kill %1

# Step 4: Analyze the capture file
$ tcpdump -r /tmp/capture.pcap -n -v

# Analysis items:
# 1. Identify the SYN packet and extract the following information:
#    - Source/destination IP addresses
#    - Source/destination port numbers
#    - Sequence number
#    - Window size
#    - TCP options (MSS, SACK, Window Scale, etc.)
# 2. Check the server-side sequence number and window size from the SYN-ACK packet
# 3. Check the sizes of the HTTP GET request and HTTP response
# 4. Trace the connection termination process via FIN packets
```

**Exercise A-3: Diagnosing MTU Issues**

```bash
# Manually perform Path MTU Discovery

# Step 1: Send ping with DF bit set, varying packet size
$ ping -c 1 -s 1472 -D example.com    # 1472 + 28 = 1500 (standard MTU)
$ ping -c 1 -s 1473 -D example.com    # 1501 → fragmentation required
$ ping -c 1 -s 8972 -D example.com    # 9000 (for jumbo frames)

# Step 2: Use binary search to find the exact Path MTU
# → If 1472 succeeds and 1473 fails, Path MTU = 1500

# Step 3: Check MTU in VPN or tunnel environments
# → Run the same test while VPN is connected
# → Verify that MTU is smaller due to IPsec/GRE headers

# Discussion:
# 1. What is your network's Path MTU?
# 2. Does the MTU differ between VPN-connected and non-VPN states?
# 3. Explain the symptoms caused by MTU mismatch (small packets pass
#    but large packets do not: the "black hole" problem)
```

### 14.3 Advanced Exercises

Advanced exercises diving into network design and operations.

**Exercise D-1: Analyzing BGP Routing Information**

```bash
# Analyze the routing structure of the Internet using public BGP data

# Step 1: Check BGP routes via RIPE RIS Looking Glass
# Access https://stat.ripe.net/

# Step 2: Retrieve BGP information from the command line
# Use the bgpview.io API
$ curl -s "https://api.bgpview.io/ip/8.8.8.8" | python3 -m json.tool
# → Check the prefixes advertised by Google (AS 15169)

$ curl -s "https://api.bgpview.io/asn/15169/prefixes" | python3 -m json.tool
# → Check all prefixes advertised by AS 15169

$ curl -s "https://api.bgpview.io/asn/15169/peers" | python3 -m json.tool
# → Check the peering partners of AS 15169

# Step 3: AS path analysis
$ curl -s "https://api.bgpview.io/prefix/8.8.8.0/24" | python3 -m json.tool
# → Compare AS paths from multiple perspectives

# Analysis items:
# 1. Which ASes does Google (AS 15169) peer with?
# 2. How does the AS path to 8.8.8.8 differ by vantage point?
# 3. Identify the AS number of your ISP and investigate its peering relationships
# 4. Confirm the characteristics of a Tier 1 ISP (no transit relationships)
#    from AS paths
```

**Exercise D-2: Considering Redundant Network Design**

```
Design a redundant network for the following scenario.

Scenario:
  - A company with offices in Tokyo and Osaka
  - Main data center in Tokyo, DR site in Osaka
  - 1 Gbps Internet connection required
  - Availability target: 99.99% (annual downtime under 52 minutes)

Considerations:
  1. ISP selection (how many ISPs to contract, which tier)
  2. Circuit type (dedicated line, wide-area Ethernet, Internet VPN)
  3. Routing protocol (static vs BGP)
  4. Failover method (automatic vs manual)
  5. DNS redundancy (primary/secondary DNS, GeoDNS)
  6. CDN usage (which content to offload to CDN)

Deliverables:
  - Network diagram (ASCII or tool-drawn)
  - List of failure scenarios and countermeasures for each component
  - Cost estimate (approximate)
```

**Exercise D-3: Analyzing TLS Handshake via Packet Capture**

```bash
# Capture the TLS 1.3 handshake and trace the process of establishing encryption

# Step 1: Start capture
$ sudo tcpdump -i any -n -v -w /tmp/tls_capture.pcap port 443 &

# Step 2: Send HTTPS request
$ curl -v https://example.com

# Step 3: Stop capture
$ sudo kill %1

# Step 4: Analyze TLS handshake with tshark (Wireshark CLI version)
$ tshark -r /tmp/tls_capture.pcap -Y "tls.handshake" \
    -T fields -e frame.number -e ip.src -e ip.dst \
    -e tls.handshake.type -e tls.handshake.extensions.supported_version

# Example output:
# 1  192.168.1.100  93.184.216.34  1  0x0304   (ClientHello, TLS 1.3)
# 2  93.184.216.34  192.168.1.100  2  0x0304   (ServerHello, TLS 1.3)

# Step 5: Check the certificate chain
$ openssl s_client -connect example.com:443 -showcerts 2>/dev/null | \
    openssl x509 -noout -text | head -30

# Step 6: Check the cipher suite in use
$ openssl s_client -connect example.com:443 2>/dev/null | \
    grep -E "Protocol|Cipher"

# Analysis items:
# 1. Check the list of cipher suites presented in ClientHello
# 2. Which cipher suite did the server select?
# 3. Identify the algorithm used for key exchange (ECDHE, etc.)
# 4. Trace the structure of the certificate chain
#    (end entity → intermediate CA → root CA)
# 5. Confirm the difference in the number of round trips between
#    TLS 1.3 and TLS 1.2 handshakes from the packet capture
```

---

## 15. The Future of the Internet and Emerging Technologies

### 15.1 QUIC Protocol

QUIC (Quick UDP Internet Connections) is a transport protocol developed by Google and standardized by the IETF. It has been adopted as the foundation of HTTP/3.

```
Key Features of QUIC:

1. Faster Connection Establishment
   TCP + TLS: 2–3 RTT → QUIC: 1 RTT (0-RTT reconnection also possible)

   TCP + TLS 1.3:
   Client ──SYN──────────► Server     ]
   Client ◄──SYN-ACK──── Server      ] 1 RTT (TCP)
   Client ──ACK+ClientHello──► Server ]
   Client ◄──ServerHello── Server     ] 1 RTT (TLS)
   Client ──Finished+Data──► Server   → Total 2 RTT

   QUIC:
   Client ──Initial(ClientHello+Data)──► Server ]
   Client ◄──Initial(ServerHello)────── Server  ] 1 RTT
   Client ──Handshake(Finished)──────► Server   → Total 1 RTT

2. Elimination of Head-of-Line Blocking
   TCP: A single packet loss blocks all streams
   QUIC: Packet loss only affects the relevant stream

3. Connection Migration
   TCP: Connection drops if IP address changes (e.g., switching from WiFi to mobile)
   QUIC: Connection identified by Connection ID, so IP changes do not break the connection
```

### 15.2 Technologies to Watch

- **Segment Routing (SR / SRv6)**: Network programmability technology to replace MPLS
- **SD-WAN**: Software-defined WAN optimization and management
- **Network Slicing (5G)**: Virtualizing the physical network and optimizing it for different purposes
- **RPKI adoption**: PKI infrastructure for strengthening BGP security
- **Post-Quantum Cryptography**: Migration to cryptographic algorithms resistant to quantum computers

---

## 16. FAQ

### FAQ 1: Is there a "central administrator" for the Internet?

**Answer**: Strictly speaking, no. However, several organizations coordinate and manage important aspects of the Internet.

- **ICANN (Internet Corporation for Assigned Names and Numbers)**: A non-profit organization that coordinates the assignment of domain names and IP addresses. Also manages root DNS servers.
- **IETF (Internet Engineering Task Force)**: An open standards body that develops Internet technical standards (RFCs). Anyone can participate.
- **Country NICs / RIRs**: Manage regional allocation of IP addresses. APNIC (Asia-Pacific), ARIN (North America), RIPE NCC (Europe), etc.
- **ISPs / AS operators**: Independently manage routing and policies within their own networks.

The Internet is essentially a "consensus-based distributed system," where interoperability is achieved because all participants use the common protocol TCP/IP.

### FAQ 2: Can I find out which specific submarine cable my packets are traveling through?

**Answer**: Directly, it is difficult, but it is possible to infer indirectly.

1. **Identify routers along the path with traceroute**: From router hostnames or IP addresses, you can infer the geographic location of the ISP or data center.
2. **Look for points where RTT increases sharply**: At a transpacific hop, the RTT typically jumps by about 50–100 ms. This jump corresponds to the submarine cable section.
3. **Use public information**: TeleGeography's Submarine Cable Map (submarinecablemap.com) lets you research which submarine cables your ISP uses.
4. **Consult PeeringDB**: peeringdb.com lets you check interconnection relationships and colocation facilities between ISPs.

However, because ISPs dynamically change paths through traffic engineering, you cannot definitively say "it always goes through this cable."

### FAQ 3: Why is the full migration to IPv6 progressing slowly?

**Answer**: Technically, IPv6 is mature enough, but migration is slow for the following reasons.

1. **NAT's success**: NAT has functioned effectively as a countermeasure against IPv4 address exhaustion, reducing the urgency of migration. Many organizations continue in a state where NAT "works well enough."
2. **Complexity of dual-stack**: During the transition period, both IPv4 and IPv6 must be operated simultaneously, increasing operational cost and complexity.
3. **Existence of legacy systems**: Many older devices and software that do not support IPv6 still exist. This is particularly pronounced in embedded systems and IoT devices.
4. **Unclear ROI**: The business benefits gained immediately from the investment required for IPv6 migration (equipment upgrades, staff training, testing) are difficult to quantify.
5. **Content provider support**: Major players like Google and Facebook have IPv6 support, but small-to-mid-scale content providers are lagging behind.

However, with rising IPv4 address trading prices (tens of dollars per address) and the explosive growth of IoT devices, IPv6 migration is steadily progressing. As of 2024, approximately 45% of access to Google is via IPv6.

### FAQ 4: How does using a VPN change Internet routing?

**Answer**: A VPN (Virtual Private Network) is a technology that encrypts user traffic and routes it through a VPN server.

```
Path without VPN:
  User → ISP → IX → destination server
  (ISP can see the user's communication destinations)

Path with VPN:
  User → ISP ──[encrypted tunnel]──→ VPN server → destination server
  (ISP can only see communication to the VPN server)
  (destination server sees the VPN server's IP)
```

When using a VPN:
- From the ISP's perspective, the only destination is the VPN server, improving privacy
- Latency may increase because the communication path goes through the VPN server
- Depending on the VPN server's location, the route may be geographically longer
- On the other hand, if the VPN server is close to the destination, latency may decrease

### FAQ 5: Where is the speed limit of optical fiber?

**Answer**: Current optical fiber communication technology has several physical and technical limits.

- **Propagation speed limit**: The speed of light in optical fiber is about 2/3 of its speed in a vacuum (~200,000 km/s), which cannot be improved by physical laws. Therefore, the lower bound on latency is determined by distance.
- **Bandwidth limit**: By Shannon's theorem, the theoretical maximum bandwidth per optical fiber is about 100 Tbps. Current systems are approaching tens of Tbps, getting close to the theoretical limit.
- **Nonlinear effects**: Increasing optical power too much causes signal quality degradation due to nonlinear optical effects in the fiber (four-wave mixing, self-phase modulation, etc.).
- **Space Division Multiplexing (SDM)**: As a next-generation technology, SDM using multi-core or multi-mode fibers is being researched, with expectations of more than 10× bandwidth expansion over conventional methods.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Rather than theory alone, actually writing code and verifying its behavior deepens understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## 17. Summary

| Concept | Key Points | Related Technologies/Protocols |
|---------|-----------|-------------------------------|
| Physical structure | Hierarchical network composed of cables + routers + ISPs + IXs | Optical fiber, submarine cables, Anycast |
| ISP hierarchy | Pyramid structure: Tier 1 (global) → Tier 2 (regional) → Tier 3 (local) | Transit, peering, IX |
| Packet communication | Method of splitting data into small units and routing them independently | TCP/IP, UDP, MTU, fragmentation |
| Routing | Optimal path dynamically determined by routing tables and BGP | BGP, OSPF, IS-IS, EIGRP |
| DNS | Distributed database that translates domain names to IP addresses | DNS, DNSSEC, DoH, DoT |
| NAT | Translation between private IP and global IP. Countermeasure for IPv4 exhaustion | NAPT, CGNAT, IPv6 migration |
| Security | TLS encryption, DDoS countermeasures, BGP security | TLS 1.3, RPKI, WAF |
| Web display | Full process: DNS → TCP → TLS → HTTP → rendering | HTTP/2, HTTP/3 (QUIC) |
| CDN | Optimized content delivery via edge servers | GeoDNS, Anycast, caching |
| Future technologies | Further evolution with QUIC, SRv6, Network Slicing | QUIC, SRv6, 5G |

### Key Points

1. **The Internet is hierarchical**: Built from Tier 1/2/3 ISPs and IXs in a pyramid structure, where approximately 75,000 ASes exchange routing information via BGP
2. **Packet switching is the foundation of communication**: By splitting data into small units and routing them independently, efficient sharing of lines and highly fault-tolerant communication are achieved
3. **The roles of ISPs and IXs are critical**: Connections between ASes are determined by transit and peering agreements, and IXs contribute to route aggregation and cost reduction

---

## Summary

In this guide, we learned:

- The Internet originated from ARPANET and is a "network of networks" based on packet switching
- Data is split into packets and delivered to its destination by passing through approximately 75,000 ASes via BGP routing
- ISPs have a hierarchical structure of Tier 1 / Tier 2 / Tier 3, with IXs serving as key nodes for peering
- Submarine cables are the physical foundation of intercontinental communications, and their bandwidth and redundancy support the reliability of the entire Internet
- We can trace the entire process of Web page display from DNS resolution, TCP connection, TLS handshake, and HTTP request to rendering

---

## Next Guides to Read


---

## References

1. Kurose, J. F., Ross, K. W. "Computer Networking: A Top-Down Approach." 8th Edition, Pearson, 2021. -- The standard textbook of network engineering. Systematically explains packet communication, routing, and the transport layer.
2. Peterson, L., Davie, B. "Computer Networks: A Systems Approach." 6th Edition, Morgan Kaufmann, 2021. -- A classic that explains networks from a systems design perspective. Also recommended by MIT OCW.
3. TeleGeography. "Submarine Cable Map." https://submarinecablemap.com/ -- An interactive map where you can visually check the location, capacity, and owners of submarine cables worldwide.
4. RFC 791 - Internet Protocol (IPv4), September 1981. https://www.rfc-editor.org/rfc/rfc791 -- The original RFC defining IPv4 specifications.
5. RFC 8200 - Internet Protocol, Version 6 (IPv6) Specification, July 2017. https://www.rfc-editor.org/rfc/rfc8200 -- The RFC defining IPv6 specifications. Revision of RFC 2460.
6. RFC 4271 - A Border Gateway Protocol 4 (BGP-4), January 2006. https://www.rfc-editor.org/rfc/rfc4271 -- The RFC defining BGP-4 specifications. The foundation of Internet routing.
