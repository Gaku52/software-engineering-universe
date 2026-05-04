# IP Addressing

> IP addresses are the "addresses" of the Internet. Understand IPv4/IPv6, subnets, CIDR, NAT, and DHCP to build a solid foundation for network design.

## What You Will Learn

- [ ] Understand how IPv4 and IPv6 work and their differences
- [ ] Understand subnets and CIDR notation
- [ ] Learn the roles of NAT and DHCP
- [ ] Perform subnet calculations at a practical level
- [ ] Learn best practices for VPC network design
- [ ] Understand IPv6 migration strategies
- [ ] Master troubleshooting related to IP addressing

## Prerequisites

- OSI Reference Model and TCP/IP Model (./01-osi-and-tcpip-model.md)
- How to convert between binary and hexadecimal
- Basic concepts of the network layer (L3)

---

## 1. IPv4

### 1.1 Basic Structure

```
IPv4 address:
  → 32 bits (4 bytes)
  → Dotted-decimal notation: 192.168.1.100
  → Approximately 4.3 billion (2^32 = 4,294,967,296) → exhaustion problem

  192   . 168   . 1     . 100
  11000000.10101000.00000001.01100100

  Each octet: range 0–255
  → 0.0.0.0 to 255.255.255.255
```

### 1.2 IP Address Classes (Historical Classification)

```
Classful addressing (no longer used, but important as background knowledge):

  ┌────────┬──────────────────┬───────────────┬────────────────┐
  │ Class  │ Leading bits     │ Range         │ # of networks  │
  ├────────┼──────────────────┼───────────────┼────────────────┤
  │ A      │ 0xxxxxxx         │ 1.0.0.0 –     │ 128 networks   │
  │        │ /8               │ 126.255.255.255│ 16,777,214 hosts each│
  ├────────┼──────────────────┼───────────────┼────────────────┤
  │ B      │ 10xxxxxx         │ 128.0.0.0 –   │ 16,384 networks│
  │        │ /16              │ 191.255.255.255│ 65,534 hosts each│
  ├────────┼──────────────────┼───────────────┼────────────────┤
  │ C      │ 110xxxxx         │ 192.0.0.0 –   │ 2,097,152 networks│
  │        │ /24              │ 223.255.255.255│ 254 hosts each │
  ├────────┼──────────────────┼───────────────┼────────────────┤
  │ D      │ 1110xxxx         │ 224.0.0.0 –   │ Multicast      │
  │        │                  │ 239.255.255.255│              │
  ├────────┼──────────────────┼───────────────┼────────────────┤
  │ E      │ 1111xxxx         │ 240.0.0.0 –   │ Experimental/reserved│
  │        │                  │ 255.255.255.255│              │
  └────────┴──────────────────┴───────────────┴────────────────┘

  Problems with classful addressing:
    Class A: 16,777,214 host slots → too large, very wasteful
    Class C: 254 host slots → too small, often insufficient
    → Massive waste of IP address space
    → CIDR (described later) solves this problem
```

### 1.3 Special IP Addresses

```
Special addresses:
  ┌──────────────────────┬────────────────────────────────────┐
  │ Address              │ Purpose                            │
  ├──────────────────────┼────────────────────────────────────┤
  │ 0.0.0.0              │ "This host on this network"        │
  │                      │ When binding a server = LISTEN on all IFs│
  ├──────────────────────┼────────────────────────────────────┤
  │ 127.0.0.0/8          │ Loopback (localhost)                │
  │ 127.0.0.1            │ Most common loopback address       │
  ├──────────────────────┼────────────────────────────────────┤
  │ 255.255.255.255      │ Limited broadcast                  │
  │                      │ Sent to all hosts on the same network│
  ├──────────────────────┼────────────────────────────────────┤
  │ 169.254.0.0/16       │ Link-local (APIPA)                 │
  │                      │ Auto-assigned when DHCP fails      │
  ├──────────────────────┼────────────────────────────────────┤
  │ 100.64.0.0/10        │ For CGN (Carrier-Grade NAT)        │
  │                      │ Private space for ISP NAT          │
  ├──────────────────────┼────────────────────────────────────┤
  │ 198.51.100.0/24      │ Documentation (TEST-NET-2)         │
  │ 203.0.113.0/24       │ Documentation (TEST-NET-3)         │
  │ 192.0.2.0/24         │ Documentation (TEST-NET-1)         │
  └──────────────────────┴────────────────────────────────────┘

Private IP addresses (RFC 1918):
  ┌──────────────────────┬───────────────────────┬──────────────┐
  │ Range                │ CIDR                  │ # of addresses│
  ├──────────────────────┼───────────────────────┼──────────────┤
  │ 10.0.0.0 –           │ 10.0.0.0/8            │ 16,777,216   │
  │ 10.255.255.255       │ (equivalent to Class A)│              │
  ├──────────────────────┼───────────────────────┼──────────────┤
  │ 172.16.0.0 –         │ 172.16.0.0/12         │ 1,048,576    │
  │ 172.31.255.255       │ (equivalent to Class B)│              │
  ├──────────────────────┼───────────────────────┼──────────────┤
  │ 192.168.0.0 –        │ 192.168.0.0/16        │ 65,536       │
  │ 192.168.255.255      │ (equivalent to Class C)│              │
  └──────────────────────┴───────────────────────┴──────────────┘

  Why private IPs are necessary:
    → IPv4 has approximately 4.3 billion addresses (not enough for every person)
    → Internal networks can reuse the same private IPs
    → NAT is used to translate them to a global IP when going out to the Internet
    → Cannot be directly accessed from outside, which is also beneficial for security

  Practical usage:
    10.0.0.0/8:
      → Large-scale enterprise networks
      → Recommended default range for AWS VPCs
      → Most common in cloud environments

    172.16.0.0/12:
      → Docker default (172.17.0.0/16)
      → Mid-scale networks

    192.168.0.0/16:
      → Home routers (192.168.0.0/24 or 192.168.1.0/24)
      → Small offices
```

### 1.4 IPv4 Header Details

```
IPv4 header structure (20–60 bytes):

  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
  ┌───┬───┬───────┬────────────────────────────────────────────┐
  │Ver│IHL│DSCP/  │         Total Length (16)                   │
  │(4)│(4)│ECN(8) │                                            │
  ├───┴───┴───────┼───┬────────────────────────────────────────┤
  │ Identification(16)│Flg│  Fragment Offset (13)               │
  ├───────┬───────┼───┴────────────────────────────────────────┤
  │TTL(8) │Proto  │         Header Checksum (16)                │
  │       │(8)    │                                            │
  ├───────┴───────┴────────────────────────────────────────────┤
  │                 Source IP Address (32)                       │
  ├────────────────────────────────────────────────────────────┤
  │                 Destination IP Address (32)                  │
  ├────────────────────────────────────────────────────────────┤
  │                 Options (0–40 bytes)                         │
  └────────────────────────────────────────────────────────────┘

  Field details:
    Version (4 bits): 4 (indicates IPv4)
    IHL (4 bits): header length (in 32-bit word units)
      Minimum: 5 (= 20 bytes, no options)
      Maximum: 15 (= 60 bytes, 40 bytes of options)

    DSCP (6 bits): Differentiated Services Code Point
      → Used to control QoS (Quality of Service)
      → EF (Expedited Forwarding) = prioritize voice traffic
      → AF (Assured Forwarding) = assured delivery
      → BE (Best Effort) = normal traffic

    ECN (2 bits): Explicit Congestion Notification
      → Router notifies of congestion without dropping packets

    TTL (8 bits): Time To Live
      → Decremented by 1 each time a router is traversed
      → Packet is discarded when it reaches 0 + ICMP Time Exceeded is returned
      → Loop prevention mechanism
      → Initial values: Linux=64, Windows=128, Cisco=255

    Protocol (8 bits):
      1  = ICMP
      6  = TCP
      17 = UDP
      47 = GRE
      50 = ESP (IPsec Encapsulating Security Payload)
      51 = AH (IPsec Authentication Header)
      89 = OSPF
```

---

## 2. Subnets and CIDR

### 2.1 CIDR (Classless Inter-Domain Routing) Basics

```
CIDR (Classless Inter-Domain Routing):
  Introduced in 1993 with RFC 1519
  → Eliminates the waste of classful addressing
  → Splits the network and host portions at any bit boundary

  Notation: IP address/prefix length
  Example: 192.168.1.0/24
    → /24 = the first 24 bits are the network portion
    → The remaining 8 bits are the host portion
    → Usable host count: 2^8 - 2 = 254
    → The -2 is because the network address and broadcast address are excluded
```

### 2.2 Subnet Mask Calculation

```
Subnet mask reference table:

  ┌────────┬─────────────────────┬──────────────┬─────────────┐
  │ CIDR   │ Subnet mask         │ # of hosts   │ Use case    │
  ├────────┼─────────────────────┼──────────────┼─────────────┤
  │ /32    │ 255.255.255.255     │ 1            │ Host route  │
  │ /31    │ 255.255.255.254     │ 2 (P2P)     │ P2P link    │
  │ /30    │ 255.255.255.252     │ 2            │ P2P link    │
  │ /29    │ 255.255.255.248     │ 6            │ Small scale │
  │ /28    │ 255.255.255.240     │ 14           │ Small scale │
  │ /27    │ 255.255.255.224     │ 30           │ Small–medium│
  │ /26    │ 255.255.255.192     │ 62           │ Medium scale│
  │ /25    │ 255.255.255.128     │ 126          │ Medium scale│
  │ /24    │ 255.255.255.0       │ 254          │ Standard LAN│
  │ /23    │ 255.255.254.0       │ 510          │ Larger LAN  │
  │ /22    │ 255.255.252.0       │ 1,022        │ Large scale │
  │ /21    │ 255.255.248.0       │ 2,046        │ Large scale │
  │ /20    │ 255.255.240.0       │ 4,094        │ Large scale │
  │ /16    │ 255.255.0.0         │ 65,534       │ Entire VPC  │
  │ /8     │ 255.0.0.0           │ 16,777,214   │ Class A     │
  └────────┴─────────────────────┴──────────────┴─────────────┘

  Calculation method:
  Usable host count = 2^(32 - prefix length) - 2

  Example: for /24
    Host bits: 32 - 24 = 8 bits
    Host count: 2^8 - 2 = 254

  Example: for /27
    Host bits: 32 - 27 = 5 bits
    Host count: 2^5 - 2 = 30
```

### 2.3 Practical Subnet Division

```
Problem: divide 192.168.10.0/24 into 4 subnets

  Step 1: Calculate the number of bits needed
    4 subnets → 2^n >= 4 → n=2 (borrow 2 bits)
    New prefix: /24 + 2 = /26

  Step 2: Calculate each subnet
    /26 → host bits = 6 → host count = 62

    Subnet 1: 192.168.10.0/26
      Network:      192.168.10.0
      First host:   192.168.10.1
      Last host:    192.168.10.62
      Broadcast:    192.168.10.63

    Subnet 2: 192.168.10.64/26
      Network:      192.168.10.64
      First host:   192.168.10.65
      Last host:    192.168.10.126
      Broadcast:    192.168.10.127

    Subnet 3: 192.168.10.128/26
      Network:      192.168.10.128
      First host:   192.168.10.129
      Last host:    192.168.10.190
      Broadcast:    192.168.10.191

    Subnet 4: 192.168.10.192/26
      Network:      192.168.10.192
      First host:   192.168.10.193
      Last host:    192.168.10.254
      Broadcast:    192.168.10.255

VLSM (Variable Length Subnet Mask):
  A technique that uses different mask lengths for each subnet

  Example: satisfy the following network requirements with 10.1.0.0/16
    Department A: 500 hosts → /23 (510 hosts)
    Department B: 200 hosts → /24 (254 hosts)
    Department C: 50 hosts  → /26 (62 hosts)
    Department D: 10 hosts  → /28 (14 hosts)
    P2P link: 2 hosts       → /30 (2 hosts)

  Best practice: assign larger subnets first
    Department A: 10.1.0.0/23   (10.1.0.1 – 10.1.1.254)
    Department B: 10.1.2.0/24   (10.1.2.1 – 10.1.2.254)
    Department C: 10.1.3.0/26   (10.1.3.1 – 10.1.3.62)
    Department D: 10.1.3.64/28  (10.1.3.65 – 10.1.3.78)
    P2P:          10.1.3.80/30  (10.1.3.81 – 10.1.3.82)
```

### 2.4 Practical Subnet Calculation Tools

```bash
# ipcalc command (Linux)
$ ipcalc 192.168.1.0/24
Address:   192.168.1.0          11000000.10101000.00000001. 00000000
Netmask:   255.255.255.0 = 24   11111111.11111111.11111111. 00000000
Wildcard:  0.0.0.255            00000000.00000000.00000000. 11111111
=>
Network:   192.168.1.0/24       11000000.10101000.00000001. 00000000
HostMin:   192.168.1.1          11000000.10101000.00000001. 00000001
HostMax:   192.168.1.254        11000000.10101000.00000001. 11111110
Broadcast: 192.168.1.255        11000000.10101000.00000001. 11111111
Hosts/Net: 254                   Class C, Private Internet

# sipcalc command (more detailed information)
$ sipcalc 10.0.0.0/16
-[ipv4 : 10.0.0.0/16] - 0

[CIDR]
Host address            - 10.0.0.0
Network address         - 10.0.0.0
Network mask            - 255.255.0.0
Broadcast address       - 10.0.255.255
Addresses in network    - 65536
Network range           - 10.0.0.0 - 10.0.255.255
Usable range            - 10.0.0.1 - 10.0.255.254
```

```python
# Subnet calculation in Python
import ipaddress

# Network information
network = ipaddress.IPv4Network('192.168.1.0/24')
print(f"Network: {network}")
print(f"Netmask: {network.netmask}")
print(f"Host count: {network.num_addresses - 2}")
print(f"Broadcast: {network.broadcast_address}")
print(f"First host: {list(network.hosts())[0]}")
print(f"Last host: {list(network.hosts())[-1]}")

# Subnet division
print("\nSplitting /24 into /26:")
for subnet in network.subnets(prefixlen_diff=2):
    print(f"  {subnet} (hosts: {subnet.num_addresses - 2})")

# Check if an IP address is in a subnet
ip = ipaddress.IPv4Address('192.168.1.100')
print(f"\n{ip} is in {network}: {ip in network}")

# CIDR aggregation (supernetting)
networks = [
    ipaddress.IPv4Network('192.168.0.0/24'),
    ipaddress.IPv4Network('192.168.1.0/24'),
    ipaddress.IPv4Network('192.168.2.0/24'),
    ipaddress.IPv4Network('192.168.3.0/24'),
]
collapsed = list(ipaddress.collapse_addresses(networks))
print(f"\nAggregated result: {collapsed}")
# → [IPv4Network('192.168.0.0/22')]
```

---

## 3. IPv6

### 3.1 Basic Structure

```
IPv6 address:
  → 128 bits (16 bytes)
  → Colon-separated hexadecimal notation: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
  → 8 groups × 16 bits = 128 bits
  → Approximately 3.4×10^38 → More than enough to assign an IP address to every grain of sand on Earth

Abbreviation rules:
  Rule 1: Omit leading zeros in each group
    2001:0db8:0000:0000:0000:0000:0000:0001
    → 2001:db8:0:0:0:0:0:1

  Rule 2: Replace consecutive groups of zeros with :: (can only be used once)
    2001:db8:0:0:0:0:0:1
    → 2001:db8::1

  Examples of abbreviation:
    2001:0db8:0000:0000:0000:0000:0000:0001 → 2001:db8::1
    fe80:0000:0000:0000:0000:0000:0000:0001 → fe80::1
    0000:0000:0000:0000:0000:0000:0000:0001 → ::1 (loopback)
    0000:0000:0000:0000:0000:0000:0000:0000 → :: (unspecified address)
```

### 3.2 Types of IPv6 Addresses

```
┌────────────────────┬────────────────┬──────────────────────────┐
│ Type               │ Prefix         │ Description              │
├────────────────────┼────────────────┼──────────────────────────┤
│ Global unicast     │ 2000::/3       │ Unique address on the    │
│                    │                │ Internet (equivalent to  │
│                    │                │ a public IP)             │
├────────────────────┼────────────────┼──────────────────────────┤
│ Link-local         │ fe80::/10      │ Valid only within the    │
│                    │                │ same link; auto-assigned │
│                    │                │ to all interfaces        │
├────────────────────┼────────────────┼──────────────────────────┤
│ Unique local (ULA) │ fc00::/7       │ Equivalent to private IP │
│                    │ (effectively   │ Not routed on the        │
│                    │ fd00::/8)      │ Internet                 │
├────────────────────┼────────────────┼──────────────────────────┤
│ Multicast          │ ff00::/8       │ One-to-many communication│
│                    │                │ IPv6 has no broadcast    │
├────────────────────┼────────────────┼──────────────────────────┤
│ Loopback           │ ::1/128        │ Self (localhost)         │
├────────────────────┼────────────────┼──────────────────────────┤
│ Unspecified        │ ::/128         │ When no address is set   │
├────────────────────┼────────────────┼──────────────────────────┤
│ IPv4-mapped        │ ::ffff:0:0/96  │ Embeds an IPv4 address   │
│                    │                │ ::ffff:192.168.1.1       │
└────────────────────┴────────────────┴──────────────────────────┘

Important multicast addresses:
  ff02::1   → All nodes (link-local)
  ff02::2   → All routers (link-local)
  ff02::fb  → mDNS
  ff02::1:ff00:0/104 → Solicited-Node (for neighbor discovery)
```

### 3.3 IPv6 Header

```
IPv6 header (fixed 40 bytes):

  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
  ┌───┬──────┬────────────────────────────────────────────────┐
  │Ver│Traffic│         Flow Label (20)                        │
  │(4)│Class  │                                                │
  │   │(8)   │                                                │
  ├───┴──────┼───────────────┬──────────────────────────────────┤
  │ Payload Length (16)      │ Next Header (8)│ Hop Limit (8)   │
  ├──────────────────────────┴───────────────┴──────────────────┤
  │                                                             │
  │                 Source Address (128 bits)                    │
  │                                                             │
  │                                                             │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │                 Destination Address (128 bits)               │
  │                                                             │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

IPv4 vs IPv6 header comparison:
  ┌──────────────────┬──────────┬──────────┐
  │ Item             │ IPv4     │ IPv6     │
  ├──────────────────┼──────────┼──────────┤
  │ Header length    │ 20-60B   │ Fixed 40B│
  │ Number of fields │ 12       │ 8        │
  │ Checksum         │ Present  │ Absent   │
  │ Fragmentation    │ Done by routers│ Source only│
  │ Options          │ Within header│ Extension headers│
  │ Broadcast        │ Present  │ Absent   │
  └──────────────────┴──────────┴──────────┘

  IPv6 improvements:
    ① Fixed-length header → faster router processing
    ② Checksum removed → not needed since L2/L4 handle it
    ③ Fragmentation → done only at the source (reduces router load)
    ④ Extension headers → chain only the features needed
```

### 3.4 IPv6 Auto-Configuration (SLAAC)

```
SLAAC (Stateless Address Autoconfiguration):
  → Automatically configures an IPv6 address without a DHCP server
  → Defined in RFC 4862

  Procedure:
  1. When an interface starts up:
     → Generate a link-local address
     → fe80:: + interface ID (EUI-64 or random)

  2. DAD (Duplicate Address Detection):
     → Check if the generated address is already in use
     → Send a Neighbor Solicitation

  3. Send Router Solicitation (RS):
     → "Router, please tell me the prefix"

  4. Receive Router Advertisement (RA) from the router:
     → Prefix: 2001:db8:1::/64
     → Default gateway
     → DNS information (RDNSS)

  5. Generate a global address:
     → Prefix + interface ID
     → 2001:db8:1::a1b2:c3d4:e5f6:7890

  EUI-64 vs Privacy Extension:
    EUI-64: Generates the interface ID from the MAC address
      → 00:1A:2B:3C:4D:5E → 021A:2BFF:FE3C:4D5E
      → Privacy concern (MAC address can be inferred)

    Privacy Extension (RFC 8981):
      → Uses a random interface ID
      → Periodically changes the address
      → Harder to track
      → Now the standard in OSes (Windows, macOS, Linux)
```

### 3.5 IPv4 → IPv6 Migration Technologies

```
Overview of migration technologies:

  ① Dual stack:
     → Run IPv4 and IPv6 simultaneously
     → The simplest and most recommended approach
     → All devices must support both IPv4 and IPv6

     Application connection order (Happy Eyeballs / RFC 8305):
       1. Query DNS for A record (IPv4) and AAAA record (IPv6) simultaneously
       2. Try IPv6 connection first (start 250 ms ahead)
       3. Fall back to IPv4 if IPv6 is slow
       → No noticeable delay for the user

  ② Tunneling:
     → Wrap IPv6 packets inside IPv4 packets for forwarding
     → Used to pass through IPv4-only networks

     6in4: manual tunnel (fixed endpoints)
     6to4: automatic tunnel (uses 2002::/16, deprecated)
     6rd:  automatic tunnel for ISPs
     Teredo: NAT-traversal tunnel (uses UDP)
     DS-Lite: IPv4 over IPv6 (for ISPs)

  ③ NAT64/DNS64:
     → Access IPv4 sites from an IPv6-only environment
     → DNS64: returns a synthesized AAAA for domains without an AAAA record
     → NAT64: address translation from IPv6 → IPv4

     Example:
       IPv6 client → DNS64 → 64:ff9b::93.184.216.34
       → NAT64 gateway → 93.184.216.34 (IPv4 server)

  ④ 464XLAT:
     → Widely used on smartphones
     → CLAT (client-side NAT46) + PLAT (provider-side NAT64)
     → Allows IPv4 apps to operate on an IPv6 network

Migration status (as of 2025):
  Google IPv6 statistics: approximately 45% of users worldwide are on IPv6
  Japan: over approximately 50% are IPv6-capable
  United States: over approximately 50% are IPv6-capable
  → IPv6 is becoming mainstream on mobile networks
  → T-Mobile and Reliance Jio are IPv6-only
```

---

## 4. NAT (Network Address Translation)

### 4.1 NAT Basics

```
NAT = translation between private IP and global IP

  Private network                     Internet
  ┌──────────────┐                    ┌──────────────┐
  │ PC1: 192.168.1.10 │               │              │
  │ PC2: 192.168.1.11 │──→ [NAT] ──→ │ 203.0.113.1  │
  │ PC3: 192.168.1.12 │    Router     │ (global IP)  │
  └──────────────┘                    └──────────────┘
```

### 4.2 Types of NAT

```
① Static NAT (1-to-1 NAT):
  → One private IP ↔ one global IP
  → Fixed mapping
  → Used when publishing servers

  Example:
  192.168.1.10 ←→ 203.0.113.10
  192.168.1.11 ←→ 203.0.113.11

② Dynamic NAT:
  → Private IP → dynamically assigned from a global IP pool
  → Connection is not possible if global IPs are exhausted

③ NAPT / PAT (Network Address Port Translation / Port Address Translation):
  → The most common NAT
  → Multiple private IPs → one global IP
  → Identified by port number

  NAT translation table:
  ┌────────────────────────┬──────────────────────────┐
  │ Internal (private)     │ External (global)        │
  ├────────────────────────┼──────────────────────────┤
  │ 192.168.1.10:54321     │ 203.0.113.1:10001        │
  │ 192.168.1.10:54322     │ 203.0.113.1:10002        │
  │ 192.168.1.11:54321     │ 203.0.113.1:10003        │
  │ 192.168.1.12:80        │ 203.0.113.1:10004        │
  └────────────────────────┴──────────────────────────┘

  → Even the same internal IP creates different entries if ports differ
  → Theoretically up to 65,535 simultaneous connections (in practice, fewer)

④ CGN / CGNAT (Carrier-Grade NAT):
  → Large-scale NAT at the ISP level
  → Uses 100.64.0.0/10
  → Introduced as a countermeasure for IPv4 address exhaustion
  → Problems:
    - Difficult to retain logs (who used which address)
    - P2P communication becomes even harder
    - Degraded quality for gaming and VoIP
```

### 4.3 NAT Advantages and Disadvantages

```
Advantages:
  ✓ Conserves IPv4 addresses (many devices share one global IP for Internet access)
  ✓ Hides the internal network (internal structure is not visible from outside)
  ✓ Improved security (blocks direct access from outside)
  ✓ Flexibility for internal network changes (only the global IP needs to change when switching ISPs)

Disadvantages:
  ✗ P2P communication is difficult (NAT traversal is required)
  ✗ Cannot initiate connections from outside (port forwarding / UPnP required)
  ✗ Compatibility issues with application-layer protocols
    → FTP active mode (data connection goes from external to internal)
    → SIP/RTP (VoIP)
  ✗ Breaks the end-to-end principle
  ✗ Compatibility issues with IPsec (port numbers are hidden by ESP encryption)
  ✗ Difficult to trace logs (shared global IP)
```

### 4.4 NAT Traversal

```
NAT traversal technologies:

  ① STUN (Session Traversal Utilities for NAT):
     → Discovers your own public IP and port
     → Queries a STUN server
     → Used in WebRTC

     Client ─→ STUN server
       "What is my public address?"
     ← 203.0.113.1:10001

  ② TURN (Traversal Using Relays around NAT):
     → Fallback when STUN fails
     → Communicates via a relay server
     → Consumes bandwidth but is reliable

  ③ ICE (Interactive Connectivity Establishment):
     → A connection establishment framework combining STUN + TURN
     → Standard for WebRTC
     → Automatically selects the most efficient path

  ④ UPnP (Universal Plug and Play):
     → Application requests port forwarding from the router
     → Security concerns (malicious software can open holes)

  ⑤ Port forwarding:
     → Forwards a specific router port to an internal host
     → Requires manual configuration
     → Basic technique for publishing servers

  NAT types (RFC 3489 / RFC 5780):
    Full Cone NAT: most permissive (once mapped, anyone can access)
    Restricted Cone NAT: only hosts previously sent to can respond
    Port Restricted Cone NAT: checks both the remote IP and port
    Symmetric NAT: different mapping per destination (most restrictive)
```

### 4.5 NAT in AWS

```
NAT in AWS VPC:

  ① NAT Gateway:
     → Managed service
     → Outbound Internet access from private subnets
     → Auto-scaling, high availability
     → Pricing: hourly charge + data processing charge

     Configuration example:
     ┌─────────────────────────────────────────────┐
     │ VPC: 10.0.0.0/16                            │
     │                                             │
     │  Public Subnet: 10.0.1.0/24                 │
     │  ┌─────────────────────────────────┐        │
     │  │ NAT Gateway (EIP: 52.x.x.x)    │        │
     │  │ Internet Gateway                 │        │
     │  └──────────────┬──────────────────┘        │
     │                  │                           │
     │  Private Subnet: 10.0.2.0/24                │
     │  ┌──────────────┴──────────────────┐        │
     │  │ EC2 Instance: 10.0.2.10         │        │
     │  │ → Communicates externally as 52.x.x.x    │
     │  └─────────────────────────────────┘        │
     └─────────────────────────────────────────────┘

  ② NAT Instance (EC2-based, legacy):
     → NAT implemented on an EC2 instance
     → Low cost but requires management
     → Source/Dest Check must be disabled

  Route tables:
    Public subnet:
      0.0.0.0/0 → Internet Gateway

    Private subnet:
      0.0.0.0/0 → NAT Gateway
```

---

## 5. DHCP

### 5.1 Basic DHCP Operation

```
DHCP (Dynamic Host Configuration Protocol):
  → Automatically assigns IP addresses
  → Defined in RFC 2131
  → Ports: server 67/UDP, client 68/UDP

  DORA process:
  ┌────────────┐                              ┌────────────┐
  │ Client     │                              │ DHCP server│
  └──────┬─────┘                              └──────┬─────┘
         │                                           │
         │── ① Discover (broadcast) ─────────────→  │
         │   src: 0.0.0.0:68                         │
         │   dst: 255.255.255.255:67                 │
         │   "Please give me an IP address"           │
         │                                           │
         │←── ② Offer ──────────────────────────── │
         │   "You may use 192.168.1.100"              │
         │   Subnet: 255.255.255.0                   │
         │   Gateway: 192.168.1.1                    │
         │   DNS: 8.8.8.8                            │
         │   Lease: 86400 seconds (24 hours)         │
         │                                           │
         │── ③ Request (broadcast) ──────────────→   │
         │   "I will use 192.168.1.100"               │
         │   (notification of selection when multiple DHCP servers exist)│
         │                                           │
         │←── ④ Acknowledge ─────────────────────  │
         │   "Confirmed. Lease started"              │
         │                                           │

  Why is Request also a broadcast?
    → When multiple DHCP servers exist
    → Notifies unselected servers "I chose a different server"
    → Unselected servers release the offered address
```

### 5.2 Detailed DHCP Operation

```
Assigned information (DHCP options):
  ┌─────────────────────────┬────────────────────────────┐
  │ Option                  │ Description                │
  ├─────────────────────────┼────────────────────────────┤
  │ Option 1: Subnet mask   │ 255.255.255.0              │
  │ Option 3: Router        │ Default gateway            │
  │ Option 6: DNS server    │ 8.8.8.8, 8.8.4.4          │
  │ Option 12: Hostname     │ client-pc                  │
  │ Option 15: Domain name  │ example.local              │
  │ Option 42: NTP server   │ Time synchronization server│
  │ Option 51: Lease time   │ 86400 seconds (24 hours)   │
  │ Option 119: Domain search│ Search domain list        │
  │ Option 121: Static routes│ Classless static routes   │
  │ Option 150: TFTP server │ For IP phone config files  │
  └─────────────────────────┴────────────────────────────┘

Lease renewal process:
  Lease period: T (e.g., 24 hours)

  T/2 (12 hours): Renewal
    → Client unicasts a renewal request to the DHCP server
    → Lease is extended if the server sends an ACK

  7T/8 (21 hours): Rebinding
    → If Renewal fails
    → Broadcasts a request to any DHCP server

  T (24 hours): Lease expiration
    → IP address is released
    → DORA process restarts

DHCP relay agent:
  Problem: DHCP is broadcast-based → cannot cross routers

  Solution: DHCP relay agent (ip helper-address)
    → Router receives the broadcast
    → Forwards it as unicast to the DHCP server
    → Allows using a DHCP server on a different subnet

  Cisco IOS configuration example:
    interface GigabitEthernet0/1
      ip helper-address 10.0.0.5   ← DHCP server IP
```

### 5.3 Practical DHCP Configuration

```bash
# Linux: dhcpd.conf configuration example
# /etc/dhcp/dhcpd.conf

# Global settings
default-lease-time 86400;     # 24 hours
max-lease-time 172800;        # 48 hours (maximum)
option domain-name "example.local";
option domain-name-servers 8.8.8.8, 8.8.4.4;

# Subnet definition
subnet 192.168.1.0 netmask 255.255.255.0 {
    range 192.168.1.100 192.168.1.200;  # Dynamic assignment range
    option routers 192.168.1.1;          # Default gateway
    option subnet-mask 255.255.255.0;
}

# Fixed assignment (MAC address-based)
host webserver {
    hardware ethernet 00:1A:2B:3C:4D:5E;
    fixed-address 192.168.1.10;
}

host dbserver {
    hardware ethernet 00:6F:7G:8H:9I:0J;
    fixed-address 192.168.1.20;
}
```

```bash
# DHCP-related troubleshooting commands

# Check current DHCP lease information
$ cat /var/lib/dhclient/dhclient.leases

# Release and re-obtain DHCP lease (Linux)
$ sudo dhclient -r eth0           # Release lease
$ sudo dhclient eth0              # Obtain lease

# Windows
> ipconfig /release               # Release lease
> ipconfig /renew                 # Renew lease
> ipconfig /all                   # Show detailed info

# macOS
$ sudo ipconfig set en0 DHCP      # Renew DHCP lease
$ ipconfig getpacket en0           # Show DHCP info
```

---

## 6. Routing Basics

### 6.1 Routing Table

```
Routing table = a list of forwarding destinations based on packet destination

  Example (Linux):
  $ ip route show
  default via 192.168.1.1 dev eth0 proto dhcp metric 100
  10.0.0.0/8 via 10.1.1.1 dev tun0
  172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1
  192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100

  Meaning of each entry:
    default via 192.168.1.1:
      → Default route (destinations not matching any other route go here)
      → Typically the gateway to the Internet

    10.0.0.0/8 via 10.1.1.1:
      → Traffic to 10.x.x.x goes through the VPN tunnel

    172.17.0.0/16 dev docker0:
      → Route to Docker containers

    192.168.1.0/24 dev eth0:
      → Local network (directly connected)

Routing decision method (longest match):
  Destination: 10.0.1.50

  Route table:
    10.0.0.0/8     → Route A
    10.0.1.0/24    → Route B
    10.0.1.48/28   → Route C
    default        → Route D

  → Route C is selected (the longest prefix match)
  → This is called "longest prefix match"
```

### 6.2 Static Routing and Dynamic Routing

```
Static routing:
  → Administrator manually configures routes
  → Used in small-scale networks
  → Simple to configure but no automatic failover

  Configuration example (Linux):
  $ sudo ip route add 10.0.0.0/8 via 192.168.1.254
  $ sudo ip route del 10.0.0.0/8

Dynamic routing:
  → Routing protocols automatically learn and update routes
  → Used in large-scale networks
  → Automatically changes paths on failure

  Major routing protocols:
  ┌───────┬──────────┬───────────────────────────────────┐
  │ Name  │ Type     │ Characteristics                   │
  ├───────┼──────────┼───────────────────────────────────┤
  │ RIP   │ IGP/DV   │ Hop count-based, max 15 hops      │
  │       │          │ For small networks, slow convergence│
  ├───────┼──────────┼───────────────────────────────────┤
  │ OSPF  │ IGP/LS   │ Cost-based, fast convergence      │
  │       │          │ Hierarchical areas                │
  │       │          │ Standard for enterprise networks  │
  ├───────┼──────────┼───────────────────────────────────┤
  │ EIGRP │ IGP/     │ Cisco-proprietary → standardized  │
  │       │ Advanced │ Fast convergence, bandwidth-efficient│
  ├───────┼──────────┼───────────────────────────────────┤
  │ BGP   │ EGP/PV   │ Backbone of the Internet          │
  │       │          │ Routing between ASes (Autonomous Systems)│
  │       │          │ Policy-based                      │
  │       │          │ Manages approximately 1 million routes│
  └───────┴──────────┴───────────────────────────────────┘

  IGP: Interior Gateway Protocol (within an organization)
  EGP: Exterior Gateway Protocol (between organizations)
  DV:  Distance Vector
  LS:  Link State
  PV:  Path Vector
```

### 6.3 BGP Basics

```
BGP (Border Gateway Protocol):
  → The most important protocol supporting Internet routing
  → Exchanges routes between ASes (Autonomous Systems)
  → Port 179/TCP

  AS (Autonomous System):
    → A collection of networks under a single administration
    → Identified by AS number (ASN): AS7500 (University of Tokyo), AS15169 (Google)
    → 2-byte ASN: 1–65534
    → 4-byte ASN: 65536–4294967294

  How BGP works:
    ① eBGP (External BGP): route exchange between different ASes
    ② iBGP (Internal BGP): route sharing within the same AS

  Practical importance:
    → ISP network operations
    → Multihoming (connecting to multiple ISPs)
    → CDN anycast (advertising the same IP from multiple locations)
    → Connecting cloud and on-premises (AWS Direct Connect + BGP)

  Real BGP incidents:
    2017: Google incorrectly advertised routes for Japan's traffic via Indonesia
    2019: Cloudflare became unreachable in some regions due to a BGP leak
    2021: Facebook withdrew its own BGP routes, causing all services to be down for ~6 hours
    → BGP misconfigurations can affect the entire Internet
```

---

## 7. VPC Network Design

### 7.1 AWS VPC Design Best Practices

```
VPC CIDR design principles:

  ① Account for future growth
     → /16 is recommended (65,536 addresses)
     → /24 risks running out with only 254 hosts

  ② Avoid overlap with other VPCs / on-premises
     → Overlapping CIDRs prevent routing during VPC peering or VPN connections
     → Create an IP address plan in advance

  ③ Account for reserved addresses
     → AWS reserves 5 IP addresses in each subnet
       .0: Network address
       .1: VPC router
       .2: Reserved by AWS (DNS)
       .3: Reserved by AWS (future use)
       .255: Broadcast

  Recommended VPC design example:

  VPC: 10.0.0.0/16 (65,536 addresses)
  │
  ├── AZ-a
  │   ├── Public:  10.0.1.0/24   (251 usable)
  │   ├── Private: 10.0.11.0/24  (251 usable)
  │   └── DB:      10.0.21.0/24  (251 usable)
  │
  ├── AZ-c
  │   ├── Public:  10.0.2.0/24   (251 usable)
  │   ├── Private: 10.0.12.0/24  (251 usable)
  │   └── DB:      10.0.22.0/24  (251 usable)
  │
  └── AZ-d (for future expansion)
      ├── Public:  10.0.3.0/24
      ├── Private: 10.0.13.0/24
      └── DB:      10.0.23.0/24

  Subnet roles:
    Public:  ALB, NAT Gateway, Bastion Host
    Private: ECS/EKS, Lambda, application servers
    DB:      RDS, ElastiCache, database-related resources
```

### 7.2 Multi-Account and Multi-VPC Design

```
AWS Organizations + Transit Gateway:

  ┌──────────────────────────────────────────────┐
  │                Transit Gateway                │
  │                                              │
  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
  │  │ Prod VPC │ │ Dev VPC  │ │ Shared Svc   │ │
  │  │10.1.0/16 │ │10.2.0/16 │ │ VPC          │ │
  │  │          │ │          │ │10.0.0.0/16   │ │
  │  │          │ │          │ │(DNS,AD,Monitor)│ │
  │  └──────────┘ └──────────┘ └──────────────┘ │
  │                                              │
  │  ┌──────────┐ ┌──────────────────────────┐  │
  │  │ Staging  │ │ On-premises              │  │
  │  │ VPC      │ │ (VPN / Direct Connect)   │  │
  │  │10.3.0/16 │ │ 172.16.0.0/12           │  │
  │  └──────────┘ └──────────────────────────┘  │
  └──────────────────────────────────────────────┘

  IP address plan (no overlap):
    10.0.0.0/16 → Shared services
    10.1.0.0/16 → Production
    10.2.0.0/16 → Development
    10.3.0.0/16 → Staging
    10.4.0.0/16 → DR (Disaster Recovery)
    172.16.0.0/12 → On-premises

  Transit Gateway vs VPC Peering:
    ┌───────────────────┬───────────────┬──────────────────┐
    │                   │ VPC Peering   │ Transit Gateway  │
    ├───────────────────┼───────────────┼──────────────────┤
    │ Connection type   │ 1-to-1        │ Hub & spoke      │
    │ Transitive routing│ Not possible  │ Possible         │
    │ As VPC count grows│ O(n^2) connections│ O(n) connections│
    │ Cost              │ Data transfer only│ Hourly + data transfer│
    │ On-premises conn. │ Individual VPN│ Centralized VPN  │
    └───────────────────┴───────────────┴──────────────────┘
```

### 7.3 Kubernetes Network Design

```
Kubernetes requires 3 IP address ranges:

  ① Node network: IP addresses of nodes (EC2, etc.)
     → Uses the VPC subnet CIDR
     → Example: 10.0.0.0/16

  ② Pod network CIDR: IP addresses for Pods
     → A different range from the node network
     → Example: 10.244.0.0/16 (Flannel default)
     → Each node is assigned a /24 → up to 254 Pods per node

  ③ Service CIDR: ClusterIP for Kubernetes Services
     → Example: 10.96.0.0/12
     → Virtual IP address (managed by kube-proxy)

  In the case of AWS EKS:
    Uses the VPC CNI plugin
    → Assigns VPC IP addresses directly to Pods
    → No separate Pod CIDR required
    → Consumes VPC IP addresses, so make subnets larger

    Number of Pods per node:
      Number of ENIs (Elastic Network Interfaces) × IPs per ENI
      Example: m5.large → 3 ENIs × 10 IPs = 29 Pods (+1 for the node itself)

    Measures against IP address exhaustion:
      → /19 subnets (8,190 addresses) are recommended
      → Enable prefix delegation (assign prefixes to ENIs)
      → Add a secondary CIDR (e.g., 100.64.0.0/16)
```

---

## 8. IP Address Troubleshooting

### 8.1 Common Problems and Solutions

```
Problem 1: Cannot obtain an IP address

  Symptom: A 169.254.x.x address is assigned (APIPA)

  Causes and remedies:
    ① DHCP server is not running
       → Check with: systemctl status dhcpd
    ② Cannot reach the DHCP server
       → Switch/cable issue
       → Check DHCP relay agent configuration
    ③ DHCP pool is exhausted
       → Check lease info: cat /var/lib/dhcpd/dhcpd.leases
       → Shorten lease time or expand the pool

Problem 2: Duplicate IP address

  Symptom: Communication intermittently drops, ARP flapping

  Causes and remedies:
    ① Static IP configuration overlaps with DHCP range
       → Separate the DHCP dynamic range from static assignments
    ② Multiple DHCP servers running with different configurations
       → Stop unnecessary DHCP servers
    ③ IP address duplication from VM cloning
       → Change the IP address after cloning the VM

  Detection:
    $ arping -D -I eth0 192.168.1.100  # Duplicate detection
    $ arp -a | sort                      # Check for duplicate MACs in ARP table

Problem 3: Cannot communicate between subnets

  Causes and remedies:
    ① Routing is not configured
       → Check with: ip route show
       → Add the required route
    ② Blocked by a firewall
       → Check with: iptables -L -n
       → Check Security Group (AWS)
    ③ IP forwarding is disabled
       → cat /proc/sys/net/ipv4/ip_forward
       → echo 1 > /proc/sys/net/ipv4/ip_forward

Problem 4: NAT is not working correctly

  Symptom: Hosts on the private IP cannot access the Internet

  Causes and remedies:
    ① Missing route table entry for NAT Gateway/Instance
       → Add 0.0.0.0/0 → NAT to the private subnet route table
    ② Missing Security Group setting
       → Check outbound rules
    ③ NAT Gateway is in the wrong subnet
       → NAT Gateway must be placed in a public subnet
```

### 8.2 Network Diagnostic Command Reference

```bash
# Check IP addresses
$ ip addr show                    # Check IPs on all interfaces
$ ip addr show eth0               # Specific interface

# Routing table
$ ip route show                   # Display routing table
$ ip route get 8.8.8.8            # Check route to specific destination

# ARP table
$ ip neigh show                   # Neighbor table (ARP)
$ arp -a                          # Display ARP table

# Connectivity check
$ ping -c 3 192.168.1.1          # ICMP connectivity check
$ ping6 -c 3 ::1                 # IPv6 connectivity check

# Route tracing
$ traceroute 8.8.8.8             # Route trace (UDP)
$ traceroute -T 8.8.8.8          # Route trace (TCP)
$ mtr 8.8.8.8                    # Continuous route tracing

# Port check
$ ss -tlnp                        # TCP LISTEN ports
$ ss -tunp                        # All active connections
$ lsof -i :80                     # Process using a specific port

# DNS check
$ dig example.com                 # DNS query
$ nslookup example.com            # DNS query (legacy)
$ host example.com                # DNS query (simple)

# Packet capture
$ sudo tcpdump -i eth0 -n         # Packet capture
$ sudo tcpdump -i eth0 port 80    # Capture specific port

# Network statistics
$ netstat -s                      # Protocol statistics
$ ss -s                           # Socket statistics
$ cat /proc/net/snmp              # SNMP statistics
```

---

## 9. IP Address Security

### 9.1 IP Spoofing and Countermeasures

```
IP spoofing:
  → An attack that forges the source IP address
  → Used for amplification in DDoS attacks

  Countermeasures:
    ① BCP38 / RFC 2827 (Ingress Filtering):
       → ISPs perform source address validation
       → Block source addresses outside their own IP range

    ② uRPF (unicast Reverse Path Forwarding):
       → Router validates the source address of received packets
       → Checks legitimacy by reverse-lookup in the routing table

    ③ ACL (Access Control List):
       → Block private IP addresses from leaking externally
       → Filter bogons (unallocated IPs)
```

### 9.2 IP Address Privacy

```
IP addresses and privacy:
  → The approximate geographic location can be identified from an IP address
  → GeoIP databases (MaxMind, etc.)
  → Identifying the ISP

  Privacy protection:
    ① VPN: encrypts traffic and communicates using the VPN server's IP
    ② Tor: anonymizes via multiple relays
    ③ Proxy: communicates via a proxy server
    ④ IPv6 Privacy Extension: random interface ID

  IP addresses and legal regulations:
    → GDPR: IP addresses are treated as personal data
    → Japan's Act on the Protection of Personal Information: may qualify as "personally-related information"
    → Appropriate management is required when recording IP addresses in logs
```

### 9.3 IP Address-Based Access Control

```
IP-based access control patterns:

① Firewall ACL:
  → Stateful inspection
  → Controlled by combinations of source/destination IP and port

  iptables configuration example (Linux):
  # Allow SSH only from a specific IP
  iptables -A INPUT -p tcp --dport 22 -s 203.0.113.10 -j ACCEPT
  iptables -A INPUT -p tcp --dport 22 -j DROP

  # Allow HTTPS from a specific subnet
  iptables -A INPUT -p tcp --dport 443 -s 10.0.0.0/8 -j ACCEPT

  nftables configuration example (newer Linux):
  nft add rule inet filter input tcp dport 22 ip saddr 203.0.113.10 accept
  nft add rule inet filter input tcp dport 22 drop

② Cloud security groups:
  AWS Security Group:
  → Stateful (return traffic is automatically allowed)
  → Inbound/outbound rules

  Configuration example:
  ┌────────────────────────────────────────────────┐
  │ Security Group: web-server-sg                  │
  ├──────┬──────┬────────────────┬─────────────────┤
  │ Dir  │ Port │ Source         │ Description     │
  ├──────┼──────┼────────────────┼─────────────────┤
  │ IN   │ 443  │ 0.0.0.0/0      │ HTTPS (worldwide)│
  │ IN   │ 22   │ 10.0.0.0/16    │ SSH (VPC only)   │
  │ OUT  │ 443  │ 0.0.0.0/0      │ External API call│
  │ OUT  │ 5432 │ sg-db-xxxx     │ RDS connection   │
  └──────┴──────┴────────────────┴─────────────────┘

③ GeoIP filtering:
  → Determine geographic location from IP address
  → Block/allow access from specific countries

  Nginx + GeoIP2:
  geoip2 /etc/nginx/GeoLite2-Country.mmdb {
    auto_reload 1h;
    $geoip2_data_country_code country iso_code;
  }

  server {
    if ($geoip2_data_country_code !~ ^(JP|US|GB)$) {
      return 403;
    }
  }

  Caveats:
  → No effect on users using VPN/proxy
  → Risk of blocking legitimate users
  → When going through a CDN, refer to the X-Forwarded-For header
```

### 9.4 IPv6 Security Considerations

```
IPv6-specific security challenges:

① Resistance to scanning due to large address space:
  → A /64 subnet has 2^64 addresses
  → Brute-force scanning is practically impossible
  → However, predictable addresses (::1, ::dead:beef, etc.) may be targeted

② NDP (Neighbor Discovery Protocol) vulnerabilities:
  → Equivalent to ARP spoofing in IPv4
  → RA (Router Advertisement) spoofing
  → Advertise a fake router to hijack traffic

  Countermeasures:
  → RA Guard: restrict RA transmission at the switch
  → SEND (SEcure Neighbor Discovery): sign NDP messages

③ Risks in dual-stack environments:
  → IPv4 firewall is configured but IPv6 is not
  → Bypass firewall via IPv6
  → Always unify security settings for both protocols

④ Abuse of IPv6 extension headers:
  → Bypass firewalls with many extension headers
  → Fragmentation attacks
  → Countermeasure: filter unnecessary extension headers

⑤ Tunneling risks:
  → Tunnels like 6to4 and Teredo create unintended paths
  → Countermeasure: disable unnecessary tunneling protocols
```

---

## 10. FAQ

### FAQ 1: What is the current state of IPv4 address exhaustion and its countermeasures?

```
Q: Is IPv4 address exhaustion really serious? What are the current countermeasures?

A: IPv4 addresses were exhausted at IANA in 2011, and in 2019 RIPE NCC (Europe)
   was completely exhausted. However, operations continue thanks to the following measures.

Current situation:
  · February 2011: IANA stopped allocations to RIRs
  · September 2015: ARIN (North America) exhausted
  · November 2019: RIPE NCC (Europe) exhausted
  · Currently: new allocations are almost impossible

Main countermeasures:

1. NAT/NAPT:
   → Use private IP addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
     to conserve global IPs
   → Widely used in home routers and firewalls
   → "One global IP" allows hundreds of devices to access the Internet

2. CGNAT (Carrier-Grade NAT):
   → NAT at the ISP level
   → Uses the shared address space of RFC 6598 (100.64.0.0/10)
   → Multiple subscribers share one global IP
   → Causes problems with some P2P communications and port forwarding

3. Migration to IPv6:
   → 128-bit addresses = effectively unlimited (3.4×10^38)
   → Dual-stack operation (running IPv4 and IPv6 simultaneously)
   → Google statistics (2024): approximately 45% of traffic is IPv6

4. IPv4 address trading market:
   → Buying and selling unused IPv4 address blocks
   → Price is approximately $30–50 per address
   → Major companies such as AWS and Microsoft are buying in bulk

Practical judgment:
  · Design new systems with IPv6 support from the start
  · Dual-stack operation is essential for the foreseeable future
  · Public clouds (AWS, GCP, Azure) actively support IPv6
```

### FAQ 2: How do I calculate subnet masks?

```
Q: What is a quick way to perform subnet calculations?

A: With an understanding of CIDR notation and bitwise operations, mental calculation is possible.

Basic formula:
  Host count = 2^(32 - prefix length) - 2
               ↑
               Subtract the network address and broadcast address

Quick subnet reference table:

  /24 → 256 addresses (254 hosts) ← most commonly used
  /25 → 128 addresses (126 hosts)
  /26 → 64 addresses (62 hosts)
  /27 → 32 addresses (30 hosts)
  /28 → 16 addresses (14 hosts)
  /29 → 8 addresses (6 hosts)
  /30 → 4 addresses (2 hosts) ← used for router-to-router links
  /31 → 2 addresses (RFC 3021: dedicated P2P links)
  /32 → 1 address (host address)

Calculation example: find the network information for 192.168.1.64/26

  1. /26 = 11111111.11111111.11111111.11000000
         = 255.255.255.192

  2. Host bits = 32 - 26 = 6 bits
     → 2^6 = 64 addresses

  3. Network address:
     192.168.1.64
     (64 is a multiple of 64, so it stays as-is)

  4. Broadcast address:
     192.168.1.64 + 63 = 192.168.1.127

  5. Usable host range:
     192.168.1.65 – 192.168.1.126
     (62 addresses, excluding the first and last)

Mental calculation tips:
  · For prefixes larger than /24 (/25–/32), focus on the 4th octet
  · For prefixes between /16 and /24 (/17–/23), focus on the 3rd octet
  · "256 minus the subnet mask value" = block size
    Example: /26 → 256 - 192 = 64 → blocks of 64
```

### FAQ 3: Can you explain private IPs and NAT in detail?

```
Q: How do private IP addresses and NAT work?

A: Private IP addresses are used only within an organization
   and are not routed on the Internet.
   NAT (Network Address Translation) converts them to global IPs.

Private IP address ranges (RFC 1918):

  10.0.0.0/8        → 10.0.0.0 – 10.255.255.255
                       Approximately 16.77 million addresses (equivalent to Class A)
                       Used by large organizations and VPCs

  172.16.0.0/12     → 172.16.0.0 – 172.31.255.255
                       Approximately 1.04 million addresses (equivalent to Class B × 16)
                       Used by mid-sized organizations

  192.168.0.0/16    → 192.168.0.0 – 192.168.255.255
                       Approximately 65,000 addresses (equivalent to Class C × 256)
                       Used by home routers and small organizations

NAT/NAPT operation (home router example):

  Internal network:
    PC-A: 192.168.1.100
    PC-B: 192.168.1.101
    PC-C: 192.168.1.102
    Router internal IF: 192.168.1.1
    Router external IF: 203.0.113.50 (global IP)

  PC-A accesses google.com (142.250.196.110:80):

    [Internal] PC-A sends:
      Source: 192.168.1.100:54321
      Destination: 142.250.196.110:80

    [Router] NAT translation:
      Record in NAT table:
        Internal 192.168.1.100:54321 ←→ External 203.0.113.50:12345

      Rewrite packet:
        Source: 203.0.113.50:12345 (after translation)
        Destination: 142.250.196.110:80

    [External] Sent to Google

    [Google] Response:
      Source: 142.250.196.110:80
      Destination: 203.0.113.50:12345

    [Router] NAT reverse translation:
      Look up NAT table:
        203.0.113.50:12345 → 192.168.1.100:54321

      Rewrite packet:
        Source: 142.250.196.110:80
        Destination: 192.168.1.100:54321 (after translation)

    [Internal] PC-A receives

Key points:
  · Only the router's global IP (203.0.113.50) is visible from outside
  · Port numbers identify multiple internal devices (NAPT = PAT)
  · Mappings are created dynamically for outbound connections
  · New inbound connections from outside are not possible (port forwarding is required)

NAT advantages:
  ① IPv4 address conservation: many devices share one global IP
  ② Security: internal network is hidden
  ③ Simplified IP address management: no internal changes needed when switching ISPs

NAT disadvantages:
  ① Breaks the end-to-end principle: address rewriting occurs in the middle
  ② P2P communication is difficult: cannot communicate directly if both ends are behind NAT
  ③ Does not work with some protocols: FTP (Active Mode), SIP, etc.
  ④ Performance: overhead from translation processing
  ⑤ Traceability: with CGNAT, multiple users share the same IP
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

## Summary

| Concept | Key points |
|------|---------|
| IPv4 | 32-bit, approximately 4.3 billion addresses, exhaustion problem |
| IPv6 | 128-bit, effectively unlimited, no NAT required |
| CIDR | /24 = 254 hosts, flexible subnet division |
| VLSM | Different mask length per subnet |
| NAT | Private ↔ global translation, NAPT is most common |
| DHCP | Automatically assigns IP addresses via the DORA process |
| Routing | Forwarding destination determined by longest prefix match |
| VPC design | /16 recommended, subnets divided by AZ × role |

---

## Next Guides to Read
