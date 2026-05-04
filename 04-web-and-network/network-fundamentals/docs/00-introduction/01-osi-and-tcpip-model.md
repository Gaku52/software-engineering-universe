# OSI Reference Model and TCP/IP Model

> A model for understanding network communication in "layers." The OSI 7-layer model is theoretical; the TCP/IP 4-layer model is practical. Learn the roles of each layer and how they map to protocols.

## What You Will Learn

- [ ] Understand the role of each layer in the OSI 7-layer model
- [ ] Understand the mapping between the OSI and TCP/IP 4-layer models
- [ ] Learn the representative protocols at each layer
- [ ] Understand the encapsulation and decapsulation process
- [ ] Understand the header structure of each layer in detail
- [ ] Learn the port number system and how it is used in practice
- [ ] Acquire practical analysis techniques using packet capture
- [ ] Learn the layer-by-layer approach to troubleshooting

## Prerequisites

- How the Internet works (./00-how-internet-works.md)
- Basic network terminology (packet, protocol, server, client)
- Basic command-line (terminal) operations

---

## 1. History and Background of Network Models

### 1.1 Why Layered Models Are Necessary

```
The complexity of network communication:
  Imagine a world where applications directly control hardware:

  1. An email app assembles Ethernet frames itself
  2. A web browser controls the timing of electrical signals
  3. A game is aware of the modulation scheme of optical fiber

  → Development becomes nearly impossible
  → By separating layers and defining only interfaces,
    upper layers need not be aware of lower-layer implementations

Benefits of layering:
  ① Separation of concerns: each layer focuses on a specific function
  ② Replaceability: protocols at the same layer can be swapped
     Example: switching Ethernet → Wi-Fi does not change TCP/IP
  ③ Standardization: devices from different vendors can communicate
  ④ Troubleshooting: identify and address the problematic layer
  ⑤ Independent evolution: each layer can evolve on its own
     Example: switching HTTP/1.1 → HTTP/2 does not change TCP

Understanding layering through a concrete example:
  Analogy with the postal system:
  ┌──────────────────────┬─────────────────────────────┐
  │ Network layer        │ Postal equivalent           │
  ├──────────────────────┼─────────────────────────────┤
  │ Application layer    │ Write the letter content    │
  │ Presentation layer   │ Choose language / encoding  │
  │ Session layer        │ Manage the order of exchange│
  │ Transport layer      │ Decide registered vs. normal│
  │ Network layer        │ Write the destination address│
  │ Data link layer      │ Courier delivers to next hub│
  │ Physical layer       │ Physically transported by truck / plane│
  └──────────────────────┴─────────────────────────────┘
```

### 1.2 Birth of the OSI Model

```
Historical background:
  1970s: Each company developed its own network protocols
    - IBM: SNA (Systems Network Architecture)
    - DEC: DECnet
    - Xerox: XNS
    → Devices from different vendors could not communicate

  1977: ISO (International Organization for Standardization) began drafting the OSI reference model
  1984: Published as OSI reference model (ISO 7498)
    → Defined as a 7-layer reference model
    → "Reference" model = a conceptual framework, not a concrete implementation

  However:
    - The OSI protocol suite itself was too complex to gain widespread adoption
    - Instead, TCP/IP became the de facto standard
    - The OSI model is still used today as an educational and design reference framework

The victory of TCP/IP:
  1969: Experimentation began on ARPANET (predecessor to the Internet)
  1974: Vint Cerf & Bob Kahn published the concept of TCP/IP
  1983: ARPANET switched from NCP → TCP/IP (Flag Day)
  1990s: With the explosive spread of the WWW, TCP/IP became the de facto standard

  Why TCP/IP won:
    ① Simple: 4 layers are practically sufficient
    ② Implementation-first: working implementations came first
    ③ Free: included in BSD, available to anyone
    ④ Scalability: capable of keeping up with Internet growth
```

---

## 2. OSI Reference Model (7 Layers) in Detail

### 2.1 Overall Model

```
┌─────┬──────────────────┬──────────────────────────────────┐
│ Layer│ Name            │ Role                             │
├─────┼──────────────────┼──────────────────────────────────┤
│  7  │ Application      │ Provides services directly to users│
│     │                  │ HTTP, FTP, SMTP, DNS             │
├─────┼──────────────────┼──────────────────────────────────┤
│  6  │ Presentation     │ Data representation (encryption/compression)│
│     │                  │ TLS/SSL, JPEG, UTF-8             │
├─────┼──────────────────┼──────────────────────────────────┤
│  5  │ Session          │ Establish/maintain/terminate sessions│
│     │                  │ NetBIOS, RPC                     │
├─────┼──────────────────┼──────────────────────────────────┤
│  4  │ Transport        │ Reliable end-to-end communication│
│     │                  │ TCP, UDP                         │
├─────┼──────────────────┼──────────────────────────────────┤
│  3  │ Network          │ Routing (path selection)         │
│     │                  │ IP, ICMP, ARP                    │
├─────┼──────────────────┼──────────────────────────────────┤
│  2  │ Data Link        │ Communication between adjacent nodes│
│     │                  │ Ethernet, Wi-Fi, PPP             │
├─────┼──────────────────┼──────────────────────────────────┤
│  1  │ Physical         │ Transmission of electrical/optical signals│
│     │                  │ Cable, optical fiber, wireless   │
└─────┴──────────────────┴──────────────────────────────────┘

Mnemonic (top to bottom):
  English: "All People Seem To Need Data Processing"
  English: "Please Do Not Throw Sausage Pizza Away" (bottom to top)
```

### 2.2 Layer 7: Application Layer

```
Role:
  Provides network capabilities to applications used directly by users
  → Delivers network-transparent services

Representative protocols:

  HTTP/HTTPS (ports 80/443):
    Retrieval of web pages and API communication
    → Browser, REST API, GraphQL

  FTP/SFTP (ports 20-21/22):
    File transfer
    → Upload/download files to/from servers

  SMTP (ports 25/587):
    Email sending
    → Communication between mail servers

  POP3/IMAP (ports 110/143):
    Email receiving
    → Mail client retrieves email from server

  DNS (port 53):
    Name resolution (domain name → IP address)
    → Precedes almost all Internet communication

  SSH (port 22):
    Secure remote access
    → Server management, port forwarding

  SNMP (ports 161/162):
    Monitoring and management of network devices
    → Status monitoring of routers and switches

  NTP (port 123):
    Time synchronization
    → Synchronizes clocks across all devices

  DHCP (ports 67/68):
    Automatic IP address assignment
    → Automatic configuration when connecting to a network

  LDAP (ports 389/636):
    Directory services
    → Active Directory, user authentication

Practical significance:
  The layer most application developers directly work with
  → API design, WebSocket implementation, email sending features, etc.
```

### 2.3 Layer 6: Presentation Layer

```
Role:
  Converts data representation formats, encryption, and compression
  → Formats data into a form the application layer can handle easily

Key functions:

  ① Data format conversion:
     Character encoding: UTF-8, ASCII, Shift-JIS, EUC-JP
     Data formats:   JSON, XML, ASN.1, Protocol Buffers
     Image formats:   JPEG, PNG, GIF, WebP
     Audio formats:   MP3, AAC, Opus
     Video formats:   H.264, H.265, VP9, AV1

  ② Encryption/decryption:
     TLS/SSL: Encryption of HTTPS communication
       → AES-256-GCM (data encryption)
       → RSA/ECDHE (key exchange)
       → SHA-256 (hashing)

  ③ Compression/decompression:
     gzip, brotli, zstd
     → Compression of HTTP responses
     → Bandwidth savings

  Practical example:
    Content-Type: application/json; charset=utf-8
    Content-Encoding: gzip
    → Specifies data format (JSON), character encoding (UTF-8), and compression (gzip)

  In the TCP/IP model:
    The presentation layer is merged into the application layer
    → TLS sits between the transport and application layers
    → Data format is handled by the application itself
```

### 2.4 Layer 5: Session Layer

```
Role:
  Establish, maintain, and terminate communication sessions (dialogues)
  → Manages when communication begins and ends

Key functions:

  ① Session establishment:
     → Exchange of authentication information
     → Agreement on communication parameters

  ② Session maintenance:
     → Checkpoints: save progress during long transfers
     → Synchronization points: record where to resume after a failure

  ③ Session termination:
     → Graceful close: both parties agree to end
     → Abort: forced termination in case of error

  Representative protocols/technologies:
    NetBIOS: Windows file sharing
    RPC (Remote Procedure Call): remote function invocation
    SIP (Session Initiation Protocol): VoIP call establishment
    PPTP: VPN tunneling

  Practical example:
    Session management in web applications:
      → HTTP is inherently stateless
      → Sessions implemented via cookies or tokens
      → Server-side session store (e.g., Redis)

  In the TCP/IP model:
    The session layer is also merged into the application layer
    → Session management is the application's responsibility
```

### 2.5 Layer 4: Transport Layer

```
Role:
  Manages end-to-end communication between hosts
  → Provides the concept of port numbers for inter-process communication

Key functions:

  ① Reliability (TCP):
     → Guaranteed delivery of data
     → Ordering guarantee
     → Error detection and retransmission
     → Flow control and congestion control

  ② Lightweight communication (UDP):
     → Connectionless
     → Low latency
     → Broadcast/multicast support

  ③ Process identification by port number:
     → Identifies a process by source port + destination port
     → Allows multiple services on a single IP address

  PDU (Protocol Data Unit): segment (TCP) / datagram (UDP)

  Representative protocols:
    TCP: reliability-focused (HTTP, SSH, FTP, etc.)
    UDP: speed-focused (DNS, video streaming, games, etc.)
    SCTP: multi-stream support (phone network signaling, etc.)
    QUIC: modern protocol over UDP (foundation of HTTP/3)

  Practical importance:
    → Foundation of socket programming
    → Firewall rule configuration (port control)
    → L4 load balancing by load balancers
    → Port mapping in containers
```

### 2.6 Layer 3: Network Layer

```
Role:
  Routing (path selection) between different networks
  → Determines the optimal path from source to destination

Key functions:

  ① Logical addressing (IP addresses):
     → Assigns a unique address to every device
     → Divided into network part and host part

  ② Routing:
     → Forwards packets toward the destination
     → Path selection based on routing table
     → Dynamic routing: OSPF, BGP, RIP
     → Static routing: manually configured

  ③ Packet fragmentation:
     → Splits packets exceeding the MTU (Maximum Transmission Unit)
     → Reassembled at the receiver

  PDU: packet

  Representative protocols:
    IPv4: 32-bit addresses (current mainstream)
    IPv6: 128-bit addresses (next generation)
    ICMP: control messages (ping, traceroute)
    ARP:  IP address → MAC address resolution
    OSPF: interior routing protocol
    BGP:  exterior routing protocol (backbone of the Internet)

  Network devices:
    Router: operates at L3, forwards packets
    L3 switch: switch with routing capability

  Practical examples:
    $ ip route show          # Show routing table (Linux)
    $ netstat -rn            # Show routing table (general)
    $ traceroute example.com # Trace route
    $ ping example.com       # ICMP connectivity check
```

### 2.7 Layer 2: Data Link Layer

```
Role:
  Reliable communication between physically adjacent nodes
  → Frame transfer within the same network segment

Key functions:

  ① Framing:
     → Divides bit streams into frame units
     → Identifies the start/end of a frame

  ② Physical addressing (MAC address):
     → 48-bit (6-byte) hardware address
     → Example: 00:1A:2B:3C:4D:5E
     → First 24 bits: OUI (Organizationally Unique Identifier)
     → Last 24 bits: device-specific ID

  ③ Error detection:
     → Error detection via FCS (Frame Check Sequence)
     → CRC-32 algorithm
     → Does not correct errors; discards the frame

  ④ Media access control (MAC sublayer):
     → CSMA/CD (Ethernet): detect collision and retransmit
     → CSMA/CA (Wi-Fi): avoid collisions
     → Token passing: only the station holding the token transmits

  PDU: frame

  Sublayers:
    LLC (Logical Link Control):
      → Identifies the network-layer protocol
      → Flow control

    MAC (Media Access Control):
      → Controls access to the medium
      → Delivers frames using MAC addresses

  Representative protocols/technologies:
    Ethernet (IEEE 802.3): wired LAN
    Wi-Fi (IEEE 802.11): wireless LAN
    PPP: point-to-point connections
    VLAN (IEEE 802.1Q): virtual LAN

  Network devices:
    Switch (L2 switch): frame forwarding based on MAC address table
    Bridge: connects network segments

  Practical examples:
    $ arp -a                # Show ARP table
    $ ip link show          # Interface information
    $ ethtool eth0          # Ethernet interface details
    $ iwconfig wlan0        # Wi-Fi interface details
```

### 2.8 Layer 1: Physical Layer

```
Role:
  Converts bit streams into physical signals (electrical, optical, radio) for transmission
  → Sends and receives 0s and 1s as actual signals

Key functions:

  ① Signal conversion:
     → Digital signal ↔ electrical signal (copper wire)
     → Digital signal ↔ optical signal (optical fiber)
     → Digital signal ↔ radio wave (wireless)

  ② Defining transmission medium characteristics:
     → Cable type, connector shape
     → Transmission speed, bandwidth
     → Maximum transmission distance

  ③ Signal synchronization:
     → Bit synchronization: sharing a clock signal
     → Reference voltage definition

  Comparison of transmission media:
  ┌──────────────┬───────────┬────────────┬──────────────┐
  │ Medium       │ Speed     │ Max distance│ Use case     │
  ├──────────────┼───────────┼────────────┼──────────────┤
  │ Cat5e        │ 1Gbps     │ 100m       │ Office LAN   │
  │ Cat6         │ 10Gbps    │ 55m        │ Data center  │
  │ Cat6a        │ 10Gbps    │ 100m       │ Data center  │
  │ Cat7         │ 10Gbps    │ 100m       │ High-perf LAN│
  │ Cat8         │ 25/40Gbps │ 30m        │ DC connection│
  ├──────────────┼───────────┼────────────┼──────────────┤
  │ Multimode    │ 10Gbps    │ 300m-2km   │ Intra-DC     │
  │ Single-mode  │ 100Gbps+  │ Tens of km │ Long-distance│
  ├──────────────┼───────────┼────────────┼──────────────┤
  │ Wi-Fi 5      │ 3.5Gbps   │ Tens of m  │ Indoor wireless│
  │ Wi-Fi 6      │ 9.6Gbps   │ Tens of m  │ High-density │
  │ Wi-Fi 6E     │ 9.6Gbps   │ Tens of m  │ Added 6GHz band│
  │ Wi-Fi 7      │ 46Gbps    │ Tens of m  │ Next-gen wireless│
  └──────────────┴───────────┴────────────┴──────────────┘

  Network devices:
    Hub: forwards received signals to all ports (rarely used today)
    Repeater: amplifies and regenerates signals
    Media converter: converts between copper wire ↔ optical fiber

  Connectors:
    RJ-45: Ethernet cable (UTP cable)
    LC, SC: optical fiber connectors
    SFP/SFP+/QSFP: modular optical transceivers
```

---

## 3. TCP/IP Model (4 Layers) in Detail

### 3.1 Overall Model

```
┌────────────────────┬─────────────────┬──────────────────┐
│ TCP/IP Model       │ OSI equivalent  │ Protocol examples│
├────────────────────┼─────────────────┼──────────────────┤
│ Application layer  │ 7 + 6 + 5       │ HTTP, DNS, SMTP  │
│                    │                 │ FTP, SSH, TLS    │
├────────────────────┼─────────────────┼──────────────────┤
│ Transport layer    │ 4               │ TCP, UDP         │
├────────────────────┼─────────────────┼──────────────────┤
│ Internet layer     │ 3               │ IP, ICMP, ARP    │
├────────────────────┼─────────────────┼──────────────────┤
│ Network            │ 2 + 1           │ Ethernet, Wi-Fi  │
│ Interface layer    │                 │                  │
└────────────────────┴─────────────────┴──────────────────┘

The TCP/IP model is mainstream in practice:
  → OSI is a theoretical reference model
  → TCP/IP reflects the actual structure of the Internet
  → Some textbooks use a 5-layer model (hybrid model)
```

### 3.2 Comparison with the OSI Model

```
Detailed mapping between 7-layer and 4-layer models:

  OSI 7 layers           TCP/IP 4 layers      5-layer model
  ─────────────         ────────────         ────────────
  L7 Application  ───┐
  L6 Presentation ───┼→ Application      → L5 Application
  L5 Session      ───┘
  L4 Transport    ───→ Transport         → L4 Transport
  L3 Network      ───→ Internet          → L3 Network
  L2 Data Link    ───┐
  L1 Physical     ───┼→ Network           → L2 Data Link
                     │  Interface         → L1 Physical
                     └─────────────────

Why the 5-layer model is sometimes used:
  The TCP/IP 4-layer model does not distinguish the physical layer from the data link layer
  → However, in practice these two are entirely different technical domains
  → The 5-layer model is a practical compromise that retains the distinction between
    the lower two OSI layers while consolidating the upper three

When to use each model:
  OSI 7-layer: education, certification exams (CCNA, CompTIA Network+), design documents
  TCP/IP 4-layer: protocol specifications (RFC), implementation
  5-layer model: university textbooks, practical discussions
```

### 3.3 Practical Role of Each TCP/IP Layer

```
① Application layer in practice:
  The layer developers interact with most
  → REST API design (HTTP)
  → Real-time communication via WebSocket
  → Microservice communication via gRPC
  → Implementing email features (SMTP/IMAP)
  → DNS configuration and troubleshooting
  → TLS/SSL certificate management

  Commonly used tools in practice:
    curl: sending HTTP requests
    Postman: API testing
    openssl: debugging TLS/SSL
    dig/nslookup: DNS queries

② Transport layer in practice:
  → Socket programming
  → Port number management (firewall configuration)
  → Load balancer configuration (L4 vs L7)
  → TCP tuning (kernel parameters)

  Commonly used tools in practice:
    netstat/ss: checking socket state
    tcpdump: packet capture
    iptables/nftables: firewall

③ Internet layer in practice:
  → IP address design (VPC, subnets)
  → Routing configuration
  → NAT configuration
  → VPN construction

  Commonly used tools in practice:
    ip: network configuration (Linux)
    traceroute: route tracing
    ping: connectivity check

④ Network interface layer in practice:
  → VLAN configuration
  → Wi-Fi configuration
  → Network interface configuration
  → MTU adjustment

  Commonly used tools in practice:
    ethtool: Ethernet configuration
    iwconfig: Wi-Fi configuration
    ifconfig/ip link: interface management
```

---

## 4. Encapsulation and Decapsulation

### 4.1 Basic Encapsulation Process

```
Changes as data passes through each layer:

  Application layer:
    [HTTP data]

  Transport layer:
    [TCP header][HTTP data]  ← segment

  Internet layer:
    [IP header][TCP header][HTTP data]  ← packet

  Network layer:
    [Eth header][IP][TCP][HTTP data][Eth FCS]  ← frame

  Physical layer:
    01101001 10110010 ...  ← bit stream

  Sender: adds headers to data (encapsulation)
  Receiver: removes headers and passes data to upper layer (decapsulation)
```

### 4.2 PDU (Protocol Data Unit) at Each Layer

```
PDU = the unit name used to refer to data at each layer

  ┌──────────────────┬───────────────┬─────────────────────┐
  │ Layer            │ PDU name      │ Main header info    │
  ├──────────────────┼───────────────┼─────────────────────┤
  │ Application      │ Message /     │ HTTP headers, etc.  │
  │                  │ Data          │                     │
  ├──────────────────┼───────────────┼─────────────────────┤
  │ Transport        │ Segment       │ Port number         │
  │                  │ (TCP)         │ Sequence number     │
  │                  │ Datagram      │ ACK number          │
  │                  │ (UDP)         │ Window size         │
  ├──────────────────┼───────────────┼─────────────────────┤
  │ Network          │ Packet        │ Source IP           │
  │                  │               │ Destination IP      │
  │                  │               │ TTL                 │
  ├──────────────────┼───────────────┼─────────────────────┤
  │ Data Link        │ Frame         │ Source MAC          │
  │                  │               │ Destination MAC     │
  │                  │               │ Type/Length         │
  ├──────────────────┼───────────────┼─────────────────────┤
  │ Physical         │ Bit           │ (no header)         │
  └──────────────────┴───────────────┴─────────────────────┘
```

### 4.3 Concrete Example of Encapsulation

```
Complete flow until an HTTP request is sent:

Step 1: Application layer
  Browser generates an HTTP GET request:
  GET /index.html HTTP/1.1
  Host: www.example.com
  Accept: text/html
  → Data size: approx. 200 bytes

Step 2: Transport layer (TCP)
  TCP header (20 bytes) is added:
  ┌─────────────────────────────────────────────────┐
  │ Source port: 52431                               │
  │ Destination port: 80                             │
  │ Sequence number: 1000                            │
  │ ACK number: 0                                    │
  │ Flags: PSH, ACK                                  │
  │ Window: 65535                                    │
  │ Checksum: 0x1234                                 │
  ├─────────────────────────────────────────────────┤
  │ [HTTP GET request 200 bytes]                      │
  └─────────────────────────────────────────────────┘
  → Segment size: 220 bytes

Step 3: Internet layer (IPv4)
  IP header (20 bytes) is added:
  ┌─────────────────────────────────────────────────┐
  │ Version: 4                                       │
  │ Header length: 20 bytes                          │
  │ Total length: 240 bytes                          │
  │ TTL: 64                                          │
  │ Protocol: 6 (TCP)                                │
  │ Source IP: 192.168.1.100                         │
  │ Destination IP: 93.184.216.34                    │
  ├─────────────────────────────────────────────────┤
  │ [TCP segment 220 bytes]                           │
  └─────────────────────────────────────────────────┘
  → Packet size: 240 bytes

Step 4: Data link layer (Ethernet)
  Ethernet header (14 bytes) + FCS (4 bytes) are added:
  ┌─────────────────────────────────────────────────┐
  │ Destination MAC: 00:1A:2B:3C:4D:5E (gateway)   │
  │ Source MAC: AA:BB:CC:DD:EE:FF (self)            │
  │ Type: 0x0800 (IPv4)                              │
  ├─────────────────────────────────────────────────┤
  │ [IP packet 240 bytes]                             │
  ├─────────────────────────────────────────────────┤
  │ FCS: 0xABCDEF01                                  │
  └─────────────────────────────────────────────────┘
  → Frame size: 258 bytes

Step 5: Physical layer
  Convert frame to bit stream:
  → 258 × 8 = 2064 bits of electrical/optical signals
  → Preamble (8 bytes) + frame + IFG (12 bytes)
  → Total: 278 bytes flow over the wire
```

### 4.4 Decapsulation and Re-encapsulation at a Router

```
Processing when a packet passes through a router:

  Source PC → Router A → Router B → Destination server

  Processing at Router A:
  1. Physical layer: electrical signals → bit stream
  2. Data link layer: receive frame, verify FCS
     → Check if addressed to self (MAC address)
     → Remove Ethernet header (decapsulation)
  3. Network layer: read IP header
     → Check destination IP
     → Determine next hop from routing table
     → Decrement TTL by 1
     → Fragment if necessary
  4. Data link layer: attach new Ethernet header (re-encapsulation)
     → Destination MAC = MAC address of Router B
     → Source MAC = MAC of Router A's outgoing interface
  5. Physical layer: bit stream → electrical signals

  Key points:
    → L2 header (MAC) is rewritten at each hop
    → L3 header (IP) basically does not change (except with NAT)
    → L4 header (TCP/UDP) also does not change (except with NAPT)

  Diagram:
  PC → Router A → Router B → Server

  PC → Router A:
    SrcMAC=PC   DstMAC=RA   SrcIP=PC   DstIP=Srv

  Router A → Router B:
    SrcMAC=RA   DstMAC=RB   SrcIP=PC   DstIP=Srv  ← only MAC changes

  Router B → Server:
    SrcMAC=RB   DstMAC=Srv  SrcIP=PC   DstIP=Srv  ← only MAC changes
```

---

## 5. Header Details for Each Layer

### 5.1 Ethernet Frame Header (L2)

```
Ethernet II frame (DIX format, most common):

  ┌──────────┬──────────┬──────┬─────────┬──────┐
  │Preamble  │SFD       │Dest  │Source   │Type  │
  │(7B)      │(1B)      │MAC   │MAC      │(2B)  │
  │          │          │(6B)  │(6B)     │      │
  ├──────────┴──────────┴──────┴─────────┴──────┤
  │ Payload (46–1500 bytes)                      │
  ├─────────────────────────────────────────────┤
  │ FCS (4B)                                     │
  └─────────────────────────────────────────────┘

  Field descriptions:
    Preamble (7 bytes): 0xAAAAAA... for clock synchronization at the receiver
    SFD (1 byte): 0xAB Start Frame Delimiter
    Destination MAC (6 bytes): physical address of the destination
      Example: 00:1A:2B:3C:4D:5E
      FF:FF:FF:FF:FF:FF = broadcast
    Source MAC (6 bytes): physical address of the sender
    Type (2 bytes): identifies the upper-layer protocol
      0x0800 = IPv4
      0x0806 = ARP
      0x86DD = IPv6
      0x8100 = 802.1Q VLAN tag
    FCS (4 bytes): error detection using CRC-32

  802.1Q VLAN-tagged frame:
    ┌──────┬──────┬──────┬──────┬──────┬─────────┬─────┐
    │DstMAC│SrcMAC│0x8100│VLAN  │Type  │Payload  │FCS  │
    │(6B)  │(6B)  │(2B)  │Tag   │(2B)  │(46-1500)│(4B) │
    │      │      │      │(2B)  │      │         │     │
    └──────┴──────┴──────┴──────┴──────┴─────────┴─────┘

    VLAN tag:
      PCP (3 bits): priority (QoS)
      DEI (1 bit): Drop Eligible Indicator
      VID (12 bits): VLAN ID (0–4095)
      → Up to 4094 VLANs can be defined (0 and 4095 are reserved)

  MTU (Maximum Transmission Unit):
    Standard: 1500 bytes (maximum payload size)
    Jumbo frame: 9000 bytes (used within data centers)
    → Packets exceeding MTU cause IP fragmentation
    → Path MTU Discovery is important to avoid performance degradation
```

### 5.2 IP Packet Header (L3)

```
IPv4 header (20–60 bytes):

  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
  ┌───┬───┬───────┬────────────────────────────────────────────┐
  │Ver│IHL│ToS/   │         Total Length (16)                   │
  │(4)│(4)│DSCP(8)│                                            │
  ├───┴───┴───────┼───┬────────────────────────────────────────┤
  │ Identification(16) │Flg│  Fragment Offset (13)              │
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

  Key fields:
    Version (4 bits): 4 (IPv4)
    IHL (4 bits): header length (in 32-bit units), usually 5 (= 20 bytes)
    ToS/DSCP (8 bits): Quality of Service (QoS)
      DSCP (6 bits): Differentiated Services
      ECN (2 bits): Explicit Congestion Notification
    Total Length (16 bits): total byte count of the packet (max 65535)
    Identification (16 bits): used for fragment reassembly
    Flags (3 bits):
      DF (Don't Fragment): fragmentation prohibited
      MF (More Fragments): more fragments follow
    TTL (8 bits): Time To Live (hop count limit)
      Initial value: 64 (Linux), 128 (Windows), 255 (network devices)
      Decremented by 1 at each router; packet discarded when 0 + ICMP Time Exceeded
      → traceroute works by exploiting TTL
    Protocol (8 bits):
      1 = ICMP
      6 = TCP
      17 = UDP
      47 = GRE
      50 = ESP (IPsec)
```

### 5.3 TCP Segment Header (L4)

```
TCP header structure (20–60 bytes):

  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
  ┌─────────────────────────┬─────────────────────────┐
  │     Source Port (16)     │     Destination Port (16)│
  ├─────────────────────────────────────────────────────┤
  │                Sequence Number (32)                   │
  ├─────────────────────────────────────────────────────┤
  │                 ACK Number (32)                       │
  ├────┬──────┬─┬─┬─┬─┬─┬─┬─────────────────────────┤
  │Off │Rsvd  │U│A│P│R│S│F│   Window Size (16)        │
  │(4) │(6)   │R│C│S│S│Y│I│                          │
  │    │      │G│K│H│T│N│N│                          │
  ├─────────────────────────┬─────────────────────────┤
  │   Checksum (16)          │   Urgent Pointer (16)    │
  ├─────────────────────────┴─────────────────────────┤
  │              Options (0–40 bytes)                    │
  └─────────────────────────────────────────────────────┘

  Key flags:
  SYN: connection initiation
  ACK: acknowledgment
  FIN: connection termination
  RST: connection reset (abnormal termination)
  PSH: deliver immediately without buffering
  URG: urgent data present
  ECE: ECN-Echo (congestion notification received)
  CWR: Congestion Window Reduced

  Important options:
  MSS: Maximum Segment Size (typically 1460 bytes)
    → MTU(1500) - IP header(20) - TCP header(20) = 1460
  Window Scale: extends window size (up to 1 GB)
    → 16 bits × 2^14 = up to 1 GB window
  SACK: Selective ACK (allows partial retransmission)
  Timestamp: RTT measurement, PAWS (Protection Against Wrapped Sequences)
```

### 5.4 UDP Datagram Header (L4)

```
UDP header structure (fixed 8 bytes):

  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
  ┌─────────────────────────┬─────────────────────────┐
  │     Source Port (16)     │     Destination Port (16)│
  ├─────────────────────────┬─────────────────────────┤
  │     Length (16)          │     Checksum (16)        │
  └─────────────────────────┴─────────────────────────┘

  Characteristics:
    → Only 8 bytes compared to TCP's 20–60 bytes
    → No sequence number, no ACK, no window size
    → Minimal information only → enables fast processing
    → Checksum is optional in IPv4, mandatory in IPv6
```

---

## 6. Port Number System

### 6.1 Commonly Used Port Numbers

```
┌────────┬──────────────────┬─────────────────┐
│ Port   │ Protocol         │ Purpose         │
├────────┼──────────────────┼─────────────────┤
│ 20, 21 │ FTP              │ File transfer   │
│ 22     │ SSH              │ Secure shell    │
│ 23     │ Telnet           │ Remote login    │
│ 25     │ SMTP             │ Email sending   │
│ 53     │ DNS              │ Name resolution │
│ 67, 68 │ DHCP             │ IP address assignment│
│ 80     │ HTTP             │ Web (unencrypted)│
│ 110    │ POP3             │ Email receiving │
│ 123    │ NTP              │ Time sync       │
│ 143    │ IMAP             │ Email receiving │
│ 161    │ SNMP             │ Network monitoring│
│ 389    │ LDAP             │ Directory       │
│ 443    │ HTTPS            │ Web (encrypted) │
│ 465    │ SMTPS            │ Email sending (encrypted)│
│ 514    │ Syslog           │ Log forwarding  │
│ 587    │ SMTP Submission  │ Email sending   │
│ 636    │ LDAPS            │ LDAP encrypted  │
│ 993    │ IMAPS            │ IMAP encrypted  │
│ 995    │ POP3S            │ POP3 encrypted  │
│ 1433   │ MS SQL Server    │ Database        │
│ 1521   │ Oracle DB        │ Database        │
│ 2049   │ NFS              │ File sharing    │
│ 3000   │ Dev server       │ Node.js, etc.   │
│ 3306   │ MySQL            │ Database        │
│ 3389   │ RDP              │ Remote desktop  │
│ 5432   │ PostgreSQL       │ Database        │
│ 5672   │ AMQP             │ Message queue   │
│ 6379   │ Redis            │ Cache           │
│ 8080   │ HTTP alternative │ Proxy/dev       │
│ 8443   │ HTTPS alternative│ Admin UI, etc.  │
│ 9090   │ Prometheus       │ Monitoring      │
│ 9200   │ Elasticsearch    │ Search engine   │
│ 27017  │ MongoDB          │ Database        │
└────────┴──────────────────┴─────────────────┘
```

### 6.2 Port Number Ranges and Classification

```
Port number ranges:
  0-1023:     Well-known Ports
    → Requires root/administrator privileges
    → Officially assigned by IANA
    → Examples: 80 (HTTP), 443 (HTTPS), 22 (SSH), 53 (DNS)

  1024-49151: Registered Ports
    → Usable by regular users
    → Registered with IANA for specific applications
    → Examples: 3306 (MySQL), 5432 (PostgreSQL), 8080 (HTTP alternative)

  49152-65535: Dynamic/Ephemeral Ports
    → Temporary ports on the client side
    → Automatically assigned by the OS
    → A different port is used for each connection

  Ephemeral port ranges (by OS):
    Linux:   32768-60999 (/proc/sys/net/ipv4/ip_local_port_range)
    Windows: 49152-65535
    macOS:   49152-65535

  Practical example: firewall configuration
    # Inbound (server side)
    Allow port 80/443 (web server)
    Allow port 22 from specific IPs only (SSH)

    # Outbound (client side)
    Usually allow all ports (restricting ephemeral ports would break communication)
```

### 6.3 Relationship Between Sockets and Ports

```
Socket = combination of IP address + port number

  TCP connection identification (5-tuple):
    ① Protocol: TCP
    ② Source IP:   192.168.1.100
    ③ Source port: 54321
    ④ Destination IP: 93.184.216.34
    ⑤ Destination port: 443

  → Different 5-tuples are treated as separate connections
  → Multiple clients can connect to a single server port

  Example: multiple connections to a web server (port 443)
    Connection 1: (TCP, 192.168.1.10:50001, 93.184.216.34:443)
    Connection 2: (TCP, 192.168.1.10:50002, 93.184.216.34:443)
    Connection 3: (TCP, 192.168.1.11:50001, 93.184.216.34:443)
    → All managed as separate connections

  Theoretical maximum connections:
    For a single server port:
    → 2^32 (IP) × 2^16 (port) = approx. 2.8×10^14 connections
    → In practice, limited by memory and file descriptors
    → Linux: check with ulimit -n (default 1024, configurable)

  Port inspection commands:
    $ ss -tlnp              # List TCP LISTEN ports
    $ ss -tunp              # All active connections
    $ lsof -i :8080         # Process using a specific port
    $ netstat -tlnp         # List TCP LISTEN ports (legacy)
```

---

## 7. Practical Analysis with Packet Capture

### 7.1 Capturing with tcpdump

```bash
# Basic capture
sudo tcpdump -i eth0

# Traffic to a specific host
sudo tcpdump -i eth0 host 192.168.1.100

# Traffic on a specific port
sudo tcpdump -i eth0 port 80

# Filter by TCP flag (SYN packets only)
sudo tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn) != 0'

# Save to file (analyze later with Wireshark)
sudo tcpdump -i eth0 -w capture.pcap

# Display packet contents (hex dump)
sudo tcpdump -i eth0 -X port 80

# Capture only the first 10 packets
sudo tcpdump -i eth0 -c 10
```

### 7.2 Analysis with Wireshark

```
Wireshark = GUI packet analysis tool (essential for network engineers)

Key display filters:
  http                          # HTTP traffic
  tcp.port == 443               # Traffic on port 443
  ip.addr == 192.168.1.100      # Traffic from/to a specific IP
  tcp.flags.syn == 1            # SYN packets
  tcp.analysis.retransmission   # Retransmitted packets
  dns                           # DNS traffic
  tcp.analysis.zero_window      # Zero-window packets

Analysis points:
  ① Verifying TCP 3-way handshake:
     Track the flow: SYN → SYN-ACK → ACK
     → Measure RTT (Round Trip Time)

  ② Checking HTTP request/response:
     → Request headers and body content
     → Response status code
     → Content-Length, Transfer-Encoding

  ③ Detecting TCP retransmissions:
     → Packets marked [TCP Retransmission]
     → Frequent retransmissions = network quality issue

  ④ Checking DNS queries:
     → Query type (A, AAAA, MX, etc.)
     → Response time
     → IP address in the response

  ⑤ Analyzing TLS handshake:
     → Client Hello: list of supported cipher suites
     → Server Hello: selected cipher suite
     → Certificate verification
```

### 7.3 Practical Capture Scenarios

```
Scenario 1: Web application response is slow

  Capture points:
  Client → Load Balancer → Web Server → DB

  Analysis procedure:
  1. Check DNS resolution time (dns.time > 0.1 is a problem)
  2. Check TCP connection establishment time (interval between SYN → SYN-ACK)
  3. Check TLS handshake time
  4. Check time between HTTP request → response
  5. Check for retransmitted packets

  → Identify which layer the delay is occurring at

Scenario 2: Connection suddenly drops

  Points to check:
  1. Is an RST packet being sent?
     → Possible abnormal application termination
  2. Is FIN being sent?
     → Possible normal close
  3. Are packets disappearing (only sent from one side)?
     → Network device issue

Scenario 3: TCP window size issue

  Points to check:
  1. Filter with tcp.analysis.zero_window
  2. Check the trend in window size
  3. Check if the Window Scale option is set
  → Occurs when the receiver cannot keep up with processing
```

---

## 8. Network Devices and the Layer They Operate At

```
Understanding which layer each device operates at:

┌────────────────────┬──────┬──────────────────────────────┐
│ Device             │ Layer│ Function                     │
├────────────────────┼──────┼──────────────────────────────┤
│ Hub                │ L1   │ Forwards signals to all ports│
│ Repeater           │ L1   │ Amplifies and regenerates signals│
├────────────────────┼──────┼──────────────────────────────┤
│ L2 switch          │ L2   │ Forwards frames by MAC address│
│ Bridge             │ L2   │ Connects network segments    │
│ Access point       │ L2   │ Wireless LAN base station    │
├────────────────────┼──────┼──────────────────────────────┤
│ Router             │ L3   │ Forwards packets by IP address│
│ L3 switch          │ L3   │ Switch with routing capability│
│ Firewall           │L3-L4 │ Packet filtering             │
├────────────────────┼──────┼──────────────────────────────┤
│ L4 load balancer   │ L4   │ Port number-based load balancing│
├────────────────────┼──────┼──────────────────────────────┤
│ L7 load balancer   │ L7   │ HTTP content-based load balancing│
│ WAF                │ L7   │ Web application protection   │
│ Proxy server       │ L7   │ Request relay                │
│ Reverse proxy      │ L7   │ Backend response proxy       │
└────────────────────┴──────┴──────────────────────────────┘

L4 load balancer vs L7 load balancer:
  L4:
    → Distributes at the TCP connection level
    → Fast (only looks at headers)
    → DSR (Direct Server Return) is possible
    → Examples: AWS NLB, HAProxy (TCP mode)

  L7:
    → Distributes based on HTTP request content
    → Controllable by URL path, hostname, Cookie
    → SSL/TLS termination possible
    → Examples: AWS ALB, nginx, HAProxy (HTTP mode)

Cloud equivalents (AWS):
  ┌───────────────────┬───────────────────┐
  │ On-premises device │ AWS service       │
  ├───────────────────┼───────────────────┤
  │ Router             │ VPC route table   │
  │ L3 switch          │ VPC subnet        │
  │ Firewall           │ Security Group    │
  │                   │ Network ACL       │
  │ L4 load balancer   │ NLB               │
  │ L7 load balancer   │ ALB               │
  │ WAF                │ AWS WAF           │
  │ VPN device         │ VPN Gateway       │
  │ Dedicated line     │ Direct Connect    │
  └───────────────────┴───────────────────┘
```

---

## 9. Layer-by-Layer Approach to Troubleshooting

### 9.1 Bottom-Up Approach

```
When a problem occurs, check from the lowest layer upward:

Step 1: Physical layer (L1) check
  □ Is the cable properly connected?
  □ Is the link LED lit?
  □ Is the Wi-Fi signal strength sufficient?

  Commands:
    $ ip link show                 # Interface status
    $ ethtool eth0                 # Link status, speed
    $ iwconfig wlan0               # Wi-Fi signal strength

Step 2: Data link layer (L2) check
  □ Is the MAC address correctly obtained?
  □ Is there an entry for the peer in the ARP table?
  □ Is the VLAN configuration correct?

  Commands:
    $ arp -a                       # ARP table
    $ ip neigh show                # Neighbor table
    $ bridge vlan show             # VLAN configuration

Step 3: Network layer (L3) check
  □ Is the IP address correctly configured?
  □ Is the default gateway reachable?
  □ Is the routing correct?
  □ Does ping reach the destination?

  Commands:
    $ ip addr show                 # Check IP address
    $ ip route show                # Routing table
    $ ping -c 3 192.168.1.1       # Connectivity to gateway
    $ ping -c 3 8.8.8.8           # Connectivity to the Internet
    $ traceroute example.com       # Route tracing

Step 4: Transport layer (L4) check
  □ Is the destination port open?
  □ Is it blocked by a firewall?
  □ Does the TCP handshake complete?

  Commands:
    $ telnet example.com 80        # Port reachability check
    $ nc -zv example.com 443       # Port scan
    $ ss -tlnp                     # Ports in LISTEN state
    $ iptables -L -n               # Firewall rules

Step 5: Application layer (L5–L7) check
  □ Is DNS resolving correctly?
  □ Is an HTTP response returned?
  □ Is the TLS/SSL certificate valid?
  □ Are there errors in the application log?

  Commands:
    $ dig example.com              # DNS resolution
    $ curl -v https://example.com  # HTTP communication details
    $ openssl s_client -connect example.com:443  # TLS check
```

### 9.2 Common Problems and Their Corresponding Layers

```
┌──────────────────────────────────┬──────┬─────────────────────────────┐
│ Symptom                          │ Layer│ Cause and remedy            │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ No communication at all          │ L1   │ Cable disconnection, interface│
│                                  │      │ down                        │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ Cannot communicate within same   │ L2   │ Duplicate MAC address, VLAN │
│ segment only                     │      │ misconfiguration, STP block │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ ping works but HTTP does not     │ L4   │ Firewall, port block        │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ Cannot connect to a specific site│ L7   │ DNS problem, expired cert,  │
│                                  │      │ application failure         │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ Communication works but is slow  │ Multi│ Bandwidth shortage (L1),    │
│                                  │      │ packet loss (L2-L3),        │
│                                  │      │ congestion (L4),            │
│                                  │      │ application delay (L7)      │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ Connection intermittently drops  │ Multi│ Radio interference (L1),    │
│                                  │      │ STP recalculation (L2),     │
│                                  │      │ routing instability (L3)    │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ Name resolution failed           │ L7   │ DNS server failure, misconfiguration│
│                                  │      │ Check /etc/resolv.conf      │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ Connection refused               │ L4   │ Service not running, port not in LISTEN│
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ Connection timed out             │ L3-4 │ Firewall, routing issue,    │
│                                  │      │ server down                 │
├──────────────────────────────────┼──────┼─────────────────────────────┤
│ SSL handshake failed             │ L6-7 │ Certificate mismatch, TLS   │
│                                  │      │ version or cipher suite mismatch│
└──────────────────────────────────┴──────┴─────────────────────────────┘
```

---

## 10. Applying the Network Model in Practice

### 10.1 Web Application Communication Flow

```
Complete communication flow when accessing https://api.example.com/users
from a browser:

Phase 1: DNS resolution (Application layer)
  ① Browser DNS cache → miss
  ② OS DNS cache → miss
  ③ Query resolver (UDP:53)
  ④ Obtain api.example.com → 203.0.113.50
  → Time required: 5–50 ms

Phase 2: TCP connection establishment (Transport layer)
  ① SYN (client → server)
  ② SYN-ACK (server → client)
  ③ ACK (client → server)
  → Time required: 1.5 RTT (Tokyo–US: approx. 150 ms)

Phase 3: TLS handshake (Presentation/Application layer)
  ① Client Hello (list of supported cipher suites)
  ② Server Hello (selected cipher suite + certificate)
  ③ Key exchange (ECDHE)
  ④ Finished (encrypted communication begins)
  → TLS 1.3: 1 RTT (TLS 1.2 requires 2 RTTs)
  → Time required: approx. 100 ms

Phase 4: HTTP request sent (Application layer)
  GET /users HTTP/2
  Host: api.example.com
  Authorization: Bearer eyJhbGciOiJSUzI1NiI...
  Accept: application/json

Phase 5: Response received
  HTTP/2 200 OK
  Content-Type: application/json
  Content-Encoding: br
  Content-Length: 2048

  [JSON data]

Phase 6: TCP connection kept alive (Keep-Alive)
  → HTTP/2: multiplexes multiple requests over a single TCP connection
  → Subsequent requests skip Phases 2–3

Total latency (first request):
  DNS:        50 ms
  TCP:       150 ms
  TLS:       100 ms
  HTTP round-trip: 100 ms
  ──────────────
  Total:     approx. 400 ms (Tokyo–US)
```

### 10.2 Container Networking and the OSI Model

```
Applying the network model in Docker/Kubernetes:

Docker:
  ┌─────────────────────────────────────────┐
  │ Host OS                                 │
  │                                         │
  │  ┌──────────┐  ┌──────────┐            │
  │  │Container1│  │Container2│            │
  │  │172.17.0.2│  │172.17.0.3│            │
  │  └────┬─────┘  └────┬─────┘            │
  │       │              │                  │
  │  ┌────┴──────────────┴─────┐            │
  │  │  docker0 bridge          │ ← L2 bridge│
  │  │  172.17.0.1              │            │
  │  └────────────┬─────────────┘            │
  │               │                          │
  │  ┌────────────┴─────────────┐            │
  │  │  eth0 (host)             │ ← NAT      │
  │  │  192.168.1.100           │ (iptables) │
  │  └──────────────────────────┘            │
  └─────────────────────────────────────────┘

  Layer mapping:
    L2: docker0 bridge (virtual switch)
    L3: IP address assignment, NAT
    L4: port mapping (-p 8080:80)
    L7: application inside the container

Kubernetes:
  Pod-to-pod communication:
    → Controlled by CNI (Container Network Interface) plugins
    → Calico: L3 routing-based (uses BGP)
    → Cilium: eBPF-based (fast processing at kernel level)
    → Flannel: VXLAN overlay

  Service:
    → ClusterIP: L4 load balancing (kube-proxy/iptables)
    → NodePort: exposes a specific port on all nodes
    → LoadBalancer: integrates with cloud L4/L7 LB

  Ingress:
    → L7 load balancing
    → URL path-based routing
    → TLS termination
    → Examples: nginx-ingress, traefik, istio-gateway
```

### 10.3 Networking in Microservices

```
Involvement of each layer in a microservices architecture:

Service mesh (Istio/Linkerd):
  ┌─────────────────────────────────────────┐
  │ Pod                                     │
  │  ┌───────────┐  ┌───────────────────┐  │
  │  │ App        │──│ Sidecar           │  │
  │  │ container  │  │ proxy (Envoy)     │  │
  │  │ (L7)      │  │ (L4-L7)          │  │
  │  └───────────┘  └───────────────────┘  │
  └─────────────────────────────────────────┘

  Functions provided by the sidecar:
    L4: TCP connection management, connection pooling
    L7: retry, timeout, circuit breaker
    L7: mTLS (TLS authentication between services)
    L7: tracing (distributed tracing header propagation)
    L7: metrics collection (request count, latency)

Communication patterns and layers:
  Synchronous communication:
    gRPC (L7/HTTP/2): inter-microservice RPC
    REST (L7/HTTP): external API exposure

  Asynchronous communication:
    Kafka (L7/TCP): event-driven
    RabbitMQ (L7/AMQP): message queue
    NATS (L7/TCP): lightweight messaging
```

---

## 11. Protocol Stack Implementation

### 11.1 Linux Kernel Network Stack

```
Packet processing flow in Linux (on receive):

  NIC (physical layer/L1)
    ↓ Copy packet to memory via DMA
  Device driver (data link layer/L2)
    ↓ Create sk_buff structure
    ↓ NAPI (interrupt optimization)
  netfilter/iptables (L3–L4)
    ↓ PREROUTING chain
  IP layer (network layer/L3)
    ↓ Routing decision (local delivery or forward)
    ↓ INPUT chain (for locally addressed packets)
  TCP layer (transport layer/L4)
    ↓ Store data in socket buffer
  Application (application layer/L7)
    ↓ Retrieve data with read()/recv()

  Kernel parameters (tunable points):
    # TCP buffer sizes
    net.core.rmem_max = 16777216        # Max receive buffer
    net.core.wmem_max = 16777216        # Max send buffer
    net.ipv4.tcp_rmem = 4096 87380 16777216  # TCP receive buffer
    net.ipv4.tcp_wmem = 4096 65536 16777216  # TCP send buffer

    # TCP connection management
    net.ipv4.tcp_max_syn_backlog = 4096  # SYN queue size
    net.core.somaxconn = 4096            # LISTEN backlog
    net.ipv4.tcp_fin_timeout = 30        # FIN_WAIT_2 timeout
    net.ipv4.tcp_tw_reuse = 1            # Reuse TIME_WAIT sockets

    # Congestion control
    net.ipv4.tcp_congestion_control = bbr  # BBR algorithm
    net.core.default_qdisc = fq            # Fair Queueing

How to check:
  $ sysctl -a | grep tcp          # List TCP-related parameters
  $ cat /proc/net/tcp             # List TCP connections
  $ cat /proc/net/sockstat        # Socket statistics
```

### 11.2 Socket Programming and the OSI Model

```python
# Simple TCP server implementation in Python
# Comments show which layer each line corresponds to

import socket

# L4: Create a TCP socket
server = socket.socket(
    socket.AF_INET,      # L3: IPv4
    socket.SOCK_STREAM   # L4: TCP (SOCK_DGRAM for UDP)
)

# L4: Bind to a port number
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(('0.0.0.0', 8080))  # L3: IP address + L4: port

# L4: Set the size of the connection waiting queue
server.listen(128)

while True:
    # L4: Accept a connection after TCP 3-way handshake completes
    client, addr = server.accept()
    print(f"Connection from {addr}")  # (IP address, port)

    # L7: Send and receive application data
    data = client.recv(4096)  # receive

    # L7: Build HTTP response
    response = (
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/plain\r\n"
        "\r\n"
        "Hello, World!"
    )
    client.send(response.encode())  # send

    # L4: Disconnect TCP connection (4-way handshake)
    client.close()
```

```go
// Simple TCP server implementation in Go

package main

import (
    "fmt"
    "net"
    "io"
)

func main() {
    // L3+L4: Listen on TCP/IPv4
    listener, err := net.Listen("tcp", ":8080")
    if err != nil {
        panic(err)
    }
    defer listener.Close()

    for {
        // L4: Accept connection
        conn, err := listener.Accept()
        if err != nil {
            continue
        }

        // Concurrent processing
        go handleConnection(conn)
    }
}

func handleConnection(conn net.Conn) {
    defer conn.Close()

    // L7: Read data
    buf := make([]byte, 4096)
    n, err := conn.Read(buf)
    if err != nil && err != io.EOF {
        return
    }

    fmt.Printf("Received: %s\n", buf[:n])

    // L7: Send response
    response := "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHello from Go!"
    conn.Write([]byte(response))
}
```

---

## 12. Evolution of Modern Protocols and the Model

### 12.1 Protocols That Do Not Fit the Traditional Model

```
QUIC (foundation of HTTP/3):
  Traditional: HTTP/2 → TLS → TCP → IP
  QUIC:        HTTP/3 → QUIC (TLS built-in) → UDP → IP

  Its position in the OSI model is ambiguous:
    → Built on top of UDP (L4 on top of L4?)
    → TLS built-in (L6 functionality integrated into L4?)
    → Stream multiplexing (L5 functionality?)
  → Strict layering becomes difficult = limits of the model

WebRTC:
  P2P communication between browsers
  → STUN/TURN (NAT traversal)
  → DTLS (encryption)
  → SRTP (media transfer)
  → SCTP (data channel)
  → A composite protocol spanning multiple layers

eBPF/XDP:
  Ultra-fast packet processing inside the Linux kernel
  → Filters packets at the NIC driver level (L1–L2)
  → Bypasses the kernel network stack
  → A different approach from the traditional layered structure
  → Used in production with Cilium (Kubernetes CNI)

Service Mesh (Istio/Envoy):
  L7 proxies providing L4–L7 functionality
  → Cannot be fully organized within the traditional OSI model
  → Some call it "Layer 7.5"
```

### 12.2 Zero-Trust Networking

```
Traditional network security:
  "Perimeter defense" = trust everything inside the firewall
  → Centered on L3/L4 access control

Zero-trust philosophy:
  "Trust nothing" = verify all communication
  → Authentication and authorization at the L7 level are mandatory

  Key implementation points:
    ① Identity-based access control
       → Authenticate by user/service ID, not IP address
    ② Micro-segmentation
       → Network isolation at the workload level
    ③ Thorough encryption
       → TLS required even on internal networks (mTLS)
    ④ Continuous verification
       → Re-authenticate periodically even after connection

  Technology stack:
    BeyondCorp (Google): L7 access proxy
    Tailscale/WireGuard: L3 encrypted VPN
    Istio/Linkerd: L7 service mesh (mTLS)
    SPIFFE/SPIRE: workload identity
```

---

## 13. Points Tested in Certification Exams

```
CCNA (Cisco Certified Network Associate):
  Role of each OSI layer and representative protocols
  Encapsulation/decapsulation process
  PDU names at each layer
  Network devices and the layer they operate at
  Difference between router and switch (L3 vs L2)

CompTIA Network+:
  Comparison of OSI 7-layer model and TCP/IP 4-layer model
  Protocols and port numbers at each layer
  Layer-by-layer approach to troubleshooting

AWS Solutions Architect:
  VPC design (L3: subnets, routing)
  Security Group and Network ACL (L3–L4)
  ALB vs NLB (L7 vs L4 load balancing)
  CloudFront (L7: CDN)

Common exam question examples:
  Q: What address is used at the data link layer?
  A: MAC address

  Q: What layer does a router operate at?
  A: Network layer (L3)

  Q: What layer does HTTP belong to?
  A: Application layer (L7)

  Q: What is the PDU for TCP?
  A: Segment

  Q: What is the order in which headers are added during encapsulation?
  A: L7 → L4 (TCP header) → L3 (IP header) → L2 (Ethernet header)
```

---

## 14. FAQ

### FAQ 1: How do the OSI 7-layer model and TCP/IP 4-layer model correspond?

```
Q: How do the OSI 7-layer model and TCP/IP 4-layer model correspond?

A: The TCP/IP model is a simplified, practical version of the OSI model.

Correspondence:
  ┌─────────────────────┬────────────────────────┐
  │ OSI 7-layer model   │ TCP/IP 4-layer model   │
  ├─────────────────────┼────────────────────────┤
  │ L7 Application      │                        │
  │ L6 Presentation     │ Application layer      │
  │ L5 Session          │                        │
  ├─────────────────────┼────────────────────────┤
  │ L4 Transport        │ Transport layer        │
  ├─────────────────────┼────────────────────────┤
  │ L3 Network          │ Internet layer         │
  ├─────────────────────┼────────────────────────┤
  │ L2 Data Link        │ Network                │
  │ L1 Physical         │ Interface layer        │
  └─────────────────────┴────────────────────────┘

Key differences:
  · OSI: theoretical model (ISO standard)
  · TCP/IP: implementation model (Internet standard)
  · TCP/IP does not clearly separate L5–L7; leaves it to the application
  · In practice, OSI layer numbers (L3/L4/L7) are often used as shorthand
```

### FAQ 2: Why do we need to learn the OSI model?

```
Q: Since TCP/IP is what is actually used, why learn the OSI model?

A: The OSI model remains important for the following reasons.

1. Value as a common language:
   · Terms like "L3 switch" and "L7 load balancer" are used throughout
     the industry to classify devices and functions by OSI layer number
   · Indispensable for communication among network engineers

2. Framework for troubleshooting:
   · Breaking problems down by layer makes root cause identification easier
   · "L1 problem (cable disconnection)," "L3 problem (routing),"
     "L7 problem (application error)," etc.

3. Understanding technology:
   · Understanding the responsibilities of each layer makes it easier to
     grasp the position of new protocols and technologies
   · Enables discussions such as "QUIC sits between L4 and L7"

4. Required knowledge for certification exams:
   · Essential for certifications like CCNA and CompTIA Network+
   · Tested as vendor-neutral theory

Practical advice:
  · Use the OSI model to understand concepts,
    and the TCP/IP model to understand implementation
  · The ideal is to be able to use both models appropriately
```

### FAQ 3: Can you explain the encapsulation mechanism in detail?

```
Q: What is encapsulation when data travels through a network?

A: Encapsulation is the process of sequentially adding lower-layer headers
   to the data from the upper layer.

Concrete example (sending an HTTP request):

  L7 (Application layer):
    HTTP request:
      GET /index.html HTTP/1.1
      Host: example.com
    → This is the "data"

  L4 (Transport layer):
    TCP header added:
      [TCP header | HTTP request]
      ↑
      Source port: 54321
      Destination port: 80
      Sequence number: 1000
      etc.

  L3 (Network layer):
    IP header added:
      [IP header | TCP header | HTTP request]
      ↑
      Source IP: 192.168.1.100
      Destination IP: 93.184.216.34
      TTL: 64
      etc.

  L2 (Data link layer):
    Ethernet header and trailer added:
      [Eth header | IP header | TCP header | HTTP request | FCS]
      ↑                                                    ↑
      Source MAC: aa:bb:cc:dd:ee:ff                     error detection
      Destination MAC: 11:22:33:44:55:66

  L1 (Physical layer):
    Converted to electrical/optical signals and sent

The reverse process on the receiving side (decapsulation):
  L1 → L2 (FCS verification) → L3 (TTL decrement, destination IP check)
  → L4 (port check, send ACK) → L7 (HTTP request processing)

Each layer interprets only its own layer's header,
and treats the upper-layer data as a "payload whose contents it does not inspect."
This is the advantage of layering.
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

| Layer | Role | Representative protocols | PDU | Device |
|----|------|---------------|-----|------|
| L7 Application | Service delivery | HTTP, DNS, TLS | Message | L7 LB, WAF |
| L6 Presentation | Data representation | TLS, JPEG, gzip | Message | - |
| L5 Session | Session management | NetBIOS, RPC | Message | - |
| L4 Transport | End-to-end communication | TCP, UDP | Segment | L4 LB |
| L3 Network | Routing | IP, ICMP | Packet | Router |
| L2 Data Link | Adjacent node communication | Ethernet, Wi-Fi | Frame | Switch |
| L1 Physical | Signal transmission | Electrical/optical/wireless | Bit | Hub |

Mapping to the TCP/IP model:

| TCP/IP layer | OSI equivalent | Main role |
|----------|---------|---------|
| Application | L7+L6+L5 | Handled directly by the application |
| Transport | L4 | End-to-end communication via TCP/UDP |
| Internet | L3 | Routing by IP address |
| Network Interface | L2+L1 | Physical communication |

---

## Next Guides to Read

---
