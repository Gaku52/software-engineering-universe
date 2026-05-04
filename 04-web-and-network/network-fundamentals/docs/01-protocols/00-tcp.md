# TCP (Transmission Control Protocol)

> TCP is the protocol that delivers reliable communication. Learn the mechanics of the 3-way handshake, sequence numbers, flow control, and congestion control, and understand why it is the backbone of Web communication. This guide provides a comprehensive explanation of the latest TCP specification based on RFC 9293, and develops practical analysis skills using tcpdump, Wireshark, and socket programming.

## Prerequisites

To get the most out of this guide, the following knowledge is required.

**Required**

**Recommended**
- Basic understanding of network interfaces (Ethernet, Wi-Fi)
- Basic command-line skills (for tools such as tcpdump and Wireshark)

---

## What You Will Learn

- [ ] Understand each step and state transitions of the TCP 3-way handshake
- [ ] Grasp the operating principle of flow control (sliding window)
- [ ] Explain the differences among congestion control algorithms (Reno, CUBIC, BBR)
- [ ] Analyze TCP packets using tcpdump and Wireshark
- [ ] Implement TCP communication via socket programming
- [ ] Understand the role of each field in the TCP header
- [ ] Understand real-world operational issues such as the TIME_WAIT problem and the Nagle algorithm

---

## 1. Basic Characteristics and Role of TCP

### 1.1 TCP's Position in the OSI Reference Model

```
┌─────────────────────────────────────────────────────────┐
│  TCP's Position in the OSI Reference Model              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Layer 7  Application Layer   HTTP, FTP, SMTP, SSH     │
│            ─────────────────────────────────────────    │
│   Layer 6  Presentation Layer  TLS/SSL                  │
│            ─────────────────────────────────────────    │
│   Layer 5  Session Layer                                │
│            ─────────────────────────────────────────    │
│   Layer 4  Transport Layer    ★ TCP / UDP ★             │
│            ─────────────────────────────────────────    │
│   Layer 3  Network Layer      IP (IPv4, IPv6)            │
│            ─────────────────────────────────────────    │
│   Layer 2  Data Link Layer    Ethernet, Wi-Fi            │
│            ─────────────────────────────────────────    │
│   Layer 1  Physical Layer     Copper wire, Optical fiber │
│                                                         │
│   TCP/IP Model (4 layers):                              │
│     Application Layer  → HTTP, FTP, SMTP               │
│     Transport Layer    → TCP, UDP                       │
│     Internet Layer     → IP                             │
│     Network IF Layer   → Ethernet                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

TCP resides at the Transport Layer (Layer 4) and provides reliable byte-stream communication to application-layer protocols (HTTP, FTP, SMTP, etc.). On top of IP's "best-effort" packet delivery, TCP adds guaranteed delivery, ordering guarantees, and error detection.

### 1.2 TCP Characteristics Summary

```
TCP = A connection-oriented, reliable protocol

Advantages:
  [1] Reliability
      Guarantees data delivery. Retransmits if no ACK is returned.
      Applications do not need to worry about data loss.

  [2] Ordering
      Reassembles data at the receiver in the order it was sent.
      Sequence numbers allow correct reordering even if packets arrive out of order.

  [3] Error Detection
      Detects corruption via a 16-bit checksum over the TCP header and payload.
      Note: this is not a cryptographic integrity guarantee; TLS is typically used alongside TCP.

  [4] Flow Control
      Adjusts the sending rate to match the receiver's processing capacity.
      The receive window (rwnd) prevents receive-buffer overflow.

  [5] Congestion Control
      Infers network congestion and dynamically adjusts the sending rate.
      A cooperative mechanism that contributes to overall network stability.

  [6] Full-Duplex Communication
      Data can be sent and received simultaneously in both directions.
      Each direction maintains independent sequence numbers.

Disadvantages:
  [1] Overhead
      Header is at least 20 bytes (up to 60 bytes with options).
      Larger than UDP's fixed 8-byte header.

  [2] Connection Establishment Latency
      The 3-way handshake requires 1.5 RTT (Round Trip Time).
      With TLS, up to 3 RTT (TCP 1.5 + TLS 1.5).
      Can be improved with TLS 1.3 + TCP Fast Open.

  [3] Head-of-Line Blocking (HoL Blocking)
      A lost packet blocks delivery of all subsequent packets.
      Even with HTTP/2 multiplexing, HoL blocking at the TCP layer cannot be avoided.
      → The main reason HTTP/3 adopted QUIC (a custom protocol over UDP).

  [4] State Management Cost in NAT/Firewalls
      Being connection-oriented, intermediate devices must maintain state tables.
      Large numbers of short-lived connections put pressure on NAT tables.

Common use cases:
  HTTP/HTTPS   → Web browsing
  FTP          → File transfer
  SMTP/IMAP    → Email sending and receiving
  SSH          → Remote management
  Databases    → MySQL (3306), PostgreSQL (5432)
  → Used generally for "communication where data loss is unacceptable"
```

### 1.3 TCP vs UDP Comparison Table

| Property | TCP | UDP |
|----------|-----|-----|
| Connection | Connection-oriented (3-way handshake) | Connectionless |
| Reliability | Yes (ACK + retransmission) | No (best-effort) |
| Ordering | Yes (sequence numbers) | No |
| Flow Control | Yes (window control) | No |
| Congestion Control | Yes (Reno, CUBIC, BBR, etc.) | No (can be implemented at the application layer) |
| Header Size | 20–60 bytes | Fixed 8 bytes |
| Communication Mode | Full-duplex | Unidirectional or bidirectional |
| Broadcast | Not supported (1-to-1 only) | Supported |
| Latency | High (connection setup + retransmission wait) | Low (send immediately) |
| Use Cases | HTTP, FTP, SSH, DB connections | DNS, NTP, VoIP, video streaming |
| HoL Blocking | Yes | No |
| State Management | Server maintains connection state | Stateless |

### 1.4 TCP vs QUIC Comparison Table

| Property | TCP | QUIC |
|----------|-----|------|
| Transport Layer | Implemented in the OS kernel | User-space implementation (over UDP) |
| Encryption | Optional (use TLS alongside) | Mandatory (TLS 1.3 integrated) |
| Connection Establishment | 1.5 RTT (+ TLS 1.5 RTT) | 1 RTT (0-RTT reconnection possible) |
| HoL Blocking | Yes (affects at the stream level) | No (streams are independent) |
| Multiplexing | No (added by HTTP/2) | Native support |
| Connection Migration | Disconnects on IP address change | Continues via Connection ID |
| Congestion Control | Depends on kernel implementation | Flexibly chosen at the application layer |
| Packet Loss Recovery | All streams blocked | Only the affected stream is impacted |
| Standardization | RFC 9293 (2022) | RFC 9000 (2021) |
| Adoption | Nearly all Internet communication | Expanding adoption at Google, Cloudflare, Meta, etc. |

---

## 2. TCP Header Structure in Detail

### 2.1 Header Format

```
TCP Header Structure (20–60 bytes):

  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
  ┌───────────────────────────┬───────────────────────────┐
  │   Source Port (16 bit)    │ Destination Port (16 bit) │  0-3 byte
  ├─────────────────────────────────────────────────────────┤
  │                  Sequence Number (32 bit)               │  4-7 byte
  ├─────────────────────────────────────────────────────────┤
  │                Acknowledgment Number (32 bit)           │  8-11 byte
  ├──────┬────────┬─┬─┬─┬─┬─┬─┬───────────────────────────┤
  │Data  │Reserved│U│A│P│R│S│F│                           │
  │Offset│ (4bit) │R│C│S│S│Y│I│  Window Size (16 bit)     │ 12-15 byte
  │(4bit)│        │G│K│H│T│N│N│                           │
  │      │        │ │ │ │ │ │ │                           │
  ├───────────────────────────┬───────────────────────────┤
  │  Checksum (16 bit)        │  Urgent Pointer (16 bit)  │ 16-19 byte
  ├───────────────────────────┴───────────────────────────┤
  │           Options (0–40 bytes)                         │ 20-59 byte
  ├─────────────────────────────────────────────────────────┤
  │                   Payload (Data)                        │
  └─────────────────────────────────────────────────────────┘
```

### 2.2 Field Details

```
■ Source Port / Destination Port (16 bits each)
  Range: 0–65535
  Well-known ports: 0–1023 (HTTP=80, HTTPS=443, SSH=22)
  Registered ports: 1024–49151
  Ephemeral ports: 49152–65535 (automatically assigned on the client side)

■ Sequence Number (32 bits)
  The byte number of the first byte of data being sent.
  The initial value (ISN: Initial Sequence Number) is chosen randomly.
  → Predictable ISNs would make TCP vulnerable to sequence number attacks.
  32 bits provides a byte number space of approximately 4.3 GB.
  → At high speeds (10 Gbps) the sequence space wraps around in about 3.4 seconds.
  → Addressed by PAWS (Protection Against Wrapped Sequences).

■ Acknowledgment Number (32 bits)
  The byte number of the next byte expected to be received.
  Cumulative acknowledgment: means all bytes below this number have been received.

■ Data Offset (4 bits)
  The length of the TCP header expressed in 4-byte units.
  Minimum: 5 (20 bytes = no options)
  Maximum: 15 (60 bytes = 40 bytes of options)

■ Flag Fields (6 bits)
  SYN (Synchronize): Initiates a connection. Used to synchronize ISNs.
  ACK (Acknowledge): Indicates the Acknowledgment Number field is valid.
  FIN (Finish): Closes a connection. Indicates no more data to send.
  RST (Reset): Immediately terminates a connection. Used for abnormal termination or port scan detection.
  PSH (Push): Deliver to the application immediately without buffering.
  URG (Urgent): Indicates the presence of urgent data (almost never used today).

  Additional flags (RFC 3168, RFC 3540):
  ECE (ECN-Echo): Response to Explicit Congestion Notification (ECN).
  CWR (Congestion Window Reduced): Notifies that the congestion window has been reduced.
  NS (ECN-Nonce Sum): Security enhancement for ECN (experimental).

■ Window Size (16 bits)
  Notifies the number of bytes the receiver can accept.
  Maximum: 65535 bytes (approximately 64 KB).
  → Can be extended up to 1 GB with the Window Scale option.

■ Checksum (16 bits)
  Verifies the integrity of the TCP header + payload + pseudo-header.
  The pseudo-header includes the source IP, destination IP, protocol number, and TCP segment length.
  → Including IP-layer information in the check allows detection of misdelivery.

■ Urgent Pointer (16 bits)
  Valid only when the URG flag is set.
  Indicates the end position of urgent data. Rarely used in practice.
```

### 2.3 Important TCP Options

```
■ MSS (Maximum Segment Size) — Kind=2, Length=4
  The maximum payload size that can be sent in one segment.
  Negotiated only in SYN packets.
  Typical calculation: MSS = MTU - IP header (20) - TCP header (20) = 1500 - 40 = 1460
  VPN/tunnel environments: MTU is smaller, so MSS is also smaller.

■ Window Scale — Kind=3, Length=3
  Specifies the number of bits to left-shift the Window Size field.
  Shift value: 0–14 (maximum scale factor = 2^14 = 16384)
  Maximum window size: 65535 × 16384 ≈ 1 GB
  Negotiated only in SYN packets.

■ SACK Permitted — Kind=4, Length=2
  Negotiates use of Selective ACK (SACK) in the SYN.
  SACK allows the receiver to report the status of non-contiguous data blocks.
  → Reduces unnecessary retransmissions and improves recovery speed.

■ SACK — Kind=5, Length=variable
  Reports ranges (left edge, right edge) of received but non-contiguous blocks.
  Up to 4 blocks can be reported (limited by options field space).

■ Timestamp — Kind=8, Length=10
  TSval: Timestamp of the sender
  TSecr: Echo of the received TSval
  Use 1: Accurate RTT measurement (RTTM: Round-Trip Time Measurement)
  Use 2: PAWS (Protection Against Wrapped Sequences)
         → Allows distinguishing between sequence numbers even after wrap-around.
```

---

## 3. 3-Way Handshake in Detail

### 3.1 Overview of Connection Establishment

```
TCP Connection Establishment (3-Way Handshake):

  Client                                    Server
  [CLOSED]                                 [LISTEN]
       │                                      │
       │── SYN ─────────────────────────────→ │
       │   seq=1000, win=65535                 │
       │   MSS=1460, WScale=7, SACK_OK        │
       │   [SYN_SENT]                          │
       │                                      │
       │ ←──────────────────── SYN-ACK ──────│
       │   seq=5000, ack=1001, win=65535       │
       │   MSS=1460, WScale=7, SACK_OK        │
       │                             [SYN_RCVD]│
       │                                      │
       │── ACK ─────────────────────────────→ │
       │   seq=1001, ack=5001, win=65535       │
       │   [ESTABLISHED]              [ESTABLISHED]
       │                                      │
       │ ←════════ Data Transfer Begins ════→ │

  Details of each step:

  [Step 1] SYN (Client → Server)
    - Client requests a connection
    - Randomly selects ISN (Initial Sequence Number) (e.g., 1000)
    - Negotiates MSS, Window Scale, SACK, and Timestamp in TCP options
    - Client state: CLOSED → SYN_SENT

  [Step 2] SYN-ACK (Server → Client)
    - Server accepts the connection
    - Randomly selects the server-side ISN (e.g., 5000)
    - ack = Client ISN + 1 (1001), notifying "expecting 1001 next"
    - Server state: LISTEN → SYN_RCVD

  [Step 3] ACK (Client → Server)
    - Client confirms the server's SYN
    - ack = Server ISN + 1 (5001)
    - This ACK can carry data (piggybacking)
    - Both sides' state: ESTABLISHED

  Time required: 1.5 RTT (Round Trip Time)
    Tokyo ↔ Osaka:       approx. 5ms   → connection established in approx. 7.5ms
    Tokyo ↔ US West Coast: approx. 100ms → connection established in approx. 150ms
    Tokyo ↔ EU:          approx. 250ms  → connection established in approx. 375ms
```

### 3.2 Why 3-Way (Not 2-Way)?

```
Problem with a 2-way handshake:

  Scenario: an old SYN packet arrives late

  Client                               Server
       │                                 │
       │── SYN(seq=100) ──→ [delayed]    │  Old connection attempt
       │── SYN(seq=200) ─────────────→   │  New connection attempt
       │                                 │
       │←─── ACK(ack=201) ─────────── │  Response to the new SYN
       │   [Connection established]       │  [Connection established]
       │                                 │
       │            [Delayed SYN arrives] │
       │              SYN(seq=100) ──→   │  Old SYN arrives!
       │                                 │
       │←─── ACK(ack=101) ─────────── │  Response to old SYN
       │                                 │  [False connection established!!]

  → With 2-way, a false connection is established for the old SYN
  → With 3-way, the client can verify "is this the right connection?" with the final ACK
  → A client that receives an old SYN-ACK returns RST to reject it

Why not 4-way?
  → 3-way is sufficient to synchronize both sides' ISNs
  → Adding more steps increases connection establishment latency
  → No security advantage either
```

### 3.3 TCP Fast Open (TFO)

```
TCP Fast Open (RFC 7413):

  Regular TCP:  SYN → SYN-ACK → ACK → Data = first data arrives in 2 RTT
  TFO:          SYN+Data → SYN-ACK+Data = first data arrives in 1 RTT

  Mechanism:
  [First connection]
    Client                              Server
         │── SYN + TFO Cookie request ──→  │
         │←── SYN-ACK + TFO Cookie ──────  │
         │── ACK ──→                        │
         │  (normal 3-way handshake)         │

  [Second connection onward]
    Client                              Server
         │── SYN + Cookie + Data ──→        │  ★ SYN includes data
         │                                   │  Server validates the Cookie
         │                                   │  → Processes data immediately if valid
         │←── SYN-ACK + Data ─────────────  │  ★ Response sent right away
         │── ACK ──→                        │
         │                                   │

  Advantages:
  - Connection establishment and data transmission happen simultaneously
  - Reduces initial page load time (especially for DNS or API calls)

  Limitations:
  - Should only be applied to idempotent requests (e.g., GET)
  - The first connection still requires a normal 3-way handshake to obtain the Cookie
  - Some middleboxes (firewalls, etc.) may cause issues
```

### 3.4 Code Example 1: Observing the 3-Way Handshake with tcpdump

```bash
# Terminal 1: Start tcpdump capture
# -i any: monitor all interfaces
# -nn: do not resolve hostnames or port numbers
# -S: display sequence numbers as absolute values (not relative)
# port 80: filter HTTP port only
sudo tcpdump -i any -nn -S port 80

# Terminal 2: Generate an HTTP connection
curl http://example.com

# Example tcpdump output:
# [Step 1] SYN
# 14:23:01.123456 IP 192.168.1.100.54321 > 93.184.216.34.80:
#   Flags [S], seq 2847291038, win 65535,
#   options [mss 1460,nop,wscale 6,nop,nop,TS val 123456 ecr 0,
#   sackOK,eol], length 0

# [Step 2] SYN-ACK
# 14:23:01.223456 IP 93.184.216.34.80 > 192.168.1.100.54321:
#   Flags [S.], seq 1428573920, ack 2847291039, win 65535,
#   options [mss 1460,nop,wscale 7,nop,nop,TS val 789012 ecr 123456,
#   sackOK,eol], length 0

# [Step 3] ACK
# 14:23:01.223567 IP 192.168.1.100.54321 > 93.184.216.34.80:
#   Flags [.], seq 2847291039, ack 1428573921, win 1024,
#   options [nop,nop,TS val 123457 ecr 789012], length 0

# Reading flags:
#   [S]  = SYN
#   [S.] = SYN-ACK (SYN + ACK)
#   [.]  = ACK
#   [P.] = PSH + ACK (data transmission)
#   [F.] = FIN + ACK (connection termination)
#   [R]  = RST (reset)
#   [R.] = RST + ACK

# More detailed display:
# -X: display packet contents in hex + ASCII
# -v: verbose output (includes TTL, ID, fragmentation info, etc.)
sudo tcpdump -i any -nn -S -X -v port 80

# Display only traffic with a specific host:
sudo tcpdump -i any -nn -S host 93.184.216.34 and port 80

# Filter only SYN packets (useful for port scan detection):
sudo tcpdump -i any -nn 'tcp[tcpflags] & (tcp-syn) != 0'

# Save to a pcap file for later analysis in Wireshark:
sudo tcpdump -i any -nn -w /tmp/tcp_capture.pcap port 80
```

### 3.5 TCP State Transition Diagram

```
Overview of TCP state transitions:

                              ┌──────────┐
                              │  CLOSED  │
                              └────┬─────┘
                       ┌──────────┤├──────────────┐
                 Passive Open    ││  Active Open      │
                  (listen())     ││   (connect())      │
                       │         ││         │          │
                       ▼         ││         ▼          │
                  ┌────────┐    ││   ┌──────────┐    │
                  │ LISTEN │    ││   │ SYN_SENT │    │
                  └───┬────┘    ││   └────┬─────┘    │
             Recv SYN │         ││        │ Recv      │
            Send SYN-ACK│       ││        │ SYN-ACK   │
                       │         ││        │ Send ACK  │
                       ▼         ││        ▼          │
                  ┌──────────┐  ││  ┌─────────────┐  │
                  │ SYN_RCVD │──┘│  │ ESTABLISHED │  │
                  └────┬─────┘   │  └──────┬──────┘  │
               Recv ACK│         │         │         │
                       ▼          │   close() │        │
                  ┌─────────────┐│    Send FIN│        │
                  │ ESTABLISHED ││         ▼         │
                  └──────┬──────┘│  ┌──────────┐     │
                   close()│       │  │ FIN_WAIT1│     │
                   Send FIN│      │  └────┬─────┘     │
                          │       │  Recv ACK│  Recv   │
                          │       │        ▼  FIN+ACK  │
                          │       │  ┌──────────┐     │
                          │       │  │ FIN_WAIT2│     │
                          │       │  └────┬─────┘     │
                   Recv FIN│      │  Recv FIN│         │
                   Send ACK│      │  Send ACK│         │
                          ▼       │        ▼          │
                  ┌──────────┐   │  ┌──────────┐     │
                  │CLOSE_WAIT│   │  │TIME_WAIT │     │
                  └────┬─────┘   │  └────┬─────┘     │
               close() │         │  2MSL wait│         │
               Send FIN│         │        ▼          │
                        ▼         │  ┌──────────┐     │
                  ┌──────────┐   │  │  CLOSED  │     │
                  │ LAST_ACK │   │  └──────────┘     │
                  └────┬─────┘   │                    │
               Recv ACK│         │                    │
                        ▼         │                    │
                  ┌──────────┐   │                    │
                  │  CLOSED  │   │                    │
                  └──────────┘   │                    │
                                  └────────────────────┘

  Description of each state:
    CLOSED:      Initial state / final state
    LISTEN:      Waiting for connections (server)
    SYN_SENT:    SYN sent, waiting for SYN-ACK (client)
    SYN_RCVD:    SYN-ACK sent, waiting for ACK (server)
    ESTABLISHED: Connection established, data transfer possible
    FIN_WAIT_1:  FIN sent, waiting for ACK
    FIN_WAIT_2:  ACK for FIN received, waiting for peer's FIN
    TIME_WAIT:   Peer's FIN received, waiting for 2MSL
    CLOSE_WAIT:  Peer's FIN received, waiting for own close()
    LAST_ACK:    FIN sent, waiting for the final ACK
    CLOSING:     Special state for simultaneous close
```

---

## 4. Data Transfer Mechanism

### 4.1 Operation of Sequence Numbers and ACKs

```
Basic data transfer flow:

  Client                                 Server
  [ESTABLISHED]                         [ESTABLISHED]
       │                                    │
       │── DATA (seq=1001, len=500) ──────→│  Send 500 bytes of data
       │                                    │
       │←──── ACK (ack=1501) ─────────── │  "Expecting 1501 next"
       │                                    │
       │── DATA (seq=1501, len=500) ──────→│  Next 500 bytes
       │                                    │
       │←──── ACK (ack=2001) ─────────── │  "Expecting 2001 next"
       │                                    │

  Key points:
  - seq: the byte number of the first byte in this segment
  - len: the number of payload bytes
  - ack: the next byte number expected = seq + len
  - ACK is cumulative: ack=2001 means "all bytes up to 2000 have been received"
```

### 4.2 Retransmission Mechanism in Detail

```
■ Timeout Retransmission (RTO: Retransmission Timeout)

  RTO calculation (RFC 6298):
    SRTT   = Smoothed RTT (exponential moving average of RTT)
    RTTVAR = RTT variance
    RTO    = SRTT + max(G, 4 × RTTVAR)
      ※ G = clock granularity (usually 1ms)

  Initial values:
    RTO     = 1 second (recommended by RFC 6298)
    Minimum RTO = 1 second (RFC recommended), 200ms in Linux implementation
    Maximum RTO = 60 seconds (Linux implementation)

  Backoff:
    RTO doubles on each timeout (exponential backoff): RTO = RTO × 2
    Maximum retransmissions: Linux default is 15 (tcp_retries2)

■ Fast Retransmit

  Client                                 Server
       │── seq=1, len=100 ──→             │  ✓ Received
       │── seq=101, len=100 ──→  ✗ Lost  │
       │── seq=201, len=100 ──→           │  Received but gap exists
       │←─ ack=101 ──────────────────── │  DupACK #1
       │── seq=301, len=100 ──→           │  Received but gap exists
       │←─ ack=101 ──────────────────── │  DupACK #2
       │── seq=401, len=100 ──→           │  Received but gap exists
       │←─ ack=101 ──────────────────── │  DupACK #3 → Fast Retransmit!
       │                                    │
       │── seq=101, len=100 ──→ (retx)    │  ✓ Retransmission successful
       │←─ ack=501 ──────────────────── │  Gap filled, all received

  Condition: immediately retransmit upon receiving 3 duplicate ACKs (Duplicate ACKs)
  Advantage: can recover a lost segment quickly without waiting for RTO
  Prerequisite: must be distinguished from packet reordering

■ Efficient Retransmission with SACK (Selective ACK)

  Without SACK:
    The receiver can only send cumulative ACKs, so the sender cannot
    know exactly which segment was lost → unnecessary retransmissions occur

  With SACK:
    The receiver explicitly reports the ranges of "received blocks"

    Example: seq=101 lost, seq=201–500 received
    ACK: ack=101, SACK=[201-301, 301-401, 401-501]
    → The sender can determine that only seq=101 needs to be retransmitted
```

### 4.3 Code Example 2: TCP Socket Programming in Python

```python
#!/usr/bin/env python3
"""
Example implementation of a TCP echo server and client
Demonstrates the basic patterns of socket programming
"""

import socket
import threading
import time
import struct

# ============================================================
# TCP Echo Server
# ============================================================
class TCPEchoServer:
    """
    A multi-threaded TCP echo server.
    Sends received data back as-is.
    """

    def __init__(self, host='127.0.0.1', port=8080, backlog=5):
        self.host = host
        self.port = port
        self.backlog = backlog
        self.server_socket = None
        self.running = False

    def start(self):
        """Start the server"""
        # AF_INET: IPv4, SOCK_STREAM: TCP
        self.server_socket = socket.socket(
            socket.AF_INET,
            socket.SOCK_STREAM
        )

        # SO_REUSEADDR: allows reuse of a port in TIME_WAIT state
        # Prevents "Address already in use" error when restarting the server
        self.server_socket.setsockopt(
            socket.SOL_SOCKET,
            socket.SO_REUSEADDR,
            1
        )

        # TCP_NODELAY: disables the Nagle algorithm
        # Sends small packets immediately (use when low latency is required)
        self.server_socket.setsockopt(
            socket.IPPROTO_TCP,
            socket.TCP_NODELAY,
            1
        )

        # Bind and listen
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(self.backlog)
        self.running = True
        print(f"[SERVER] Listening on {self.host}:{self.port}")
        print(f"[SERVER] Backlog (SYN Queue + Accept Queue): {self.backlog}")

        # Display options of the connection socket
        self._print_socket_options()

        while self.running:
            try:
                # accept() retrieves a connection that has completed the 3-way handshake
                # Blocking call: waits until a connection arrives
                client_socket, client_addr = self.server_socket.accept()
                print(f"[SERVER] Connection from {client_addr}")

                # Create a thread for each client
                thread = threading.Thread(
                    target=self._handle_client,
                    args=(client_socket, client_addr),
                    daemon=True
                )
                thread.start()

            except OSError:
                break

    def _handle_client(self, client_socket, client_addr):
        """Handle an individual client connection"""
        try:
            # Enable TCP Keep-Alive
            client_socket.setsockopt(
                socket.SOL_SOCKET,
                socket.SO_KEEPALIVE,
                1
            )

            while True:
                # recv() reads data from the TCP receive buffer
                # 4096: maximum bytes to read at once
                # Since TCP is a byte stream, send() calls on the sender side and
                # recv() calls on the receiver side do not correspond 1-to-1
                data = client_socket.recv(4096)

                if not data:
                    # The peer closed the connection (FIN received)
                    print(f"[SERVER] {client_addr} disconnected")
                    break

                print(f"[SERVER] Received {len(data)} bytes from {client_addr}")
                # Echo back: return received data as-is
                client_socket.sendall(data)

        except ConnectionResetError:
            # The peer sent RST
            print(f"[SERVER] Connection reset by {client_addr}")
        except BrokenPipeError:
            # Tried to write to a closed connection
            print(f"[SERVER] Broken pipe for {client_addr}")
        finally:
            client_socket.close()

    def _print_socket_options(self):
        """Display the current values of socket options"""
        sock = self.server_socket
        print(f"[SERVER] SO_REUSEADDR: "
              f"{sock.getsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR)}")
        print(f"[SERVER] SO_RCVBUF (receive buffer): "
              f"{sock.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)} bytes")
        print(f"[SERVER] SO_SNDBUF (send buffer): "
              f"{sock.getsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF)} bytes")

    def stop(self):
        """Stop the server"""
        self.running = False
        if self.server_socket:
            self.server_socket.close()


# ============================================================
# TCP Client
# ============================================================
class TCPEchoClient:
    """TCP echo client"""

    def __init__(self, host='127.0.0.1', port=8080, timeout=10.0):
        self.host = host
        self.port = port
        self.timeout = timeout

    def send_and_receive(self, message: str) -> str:
        """Send a message and receive the echo response"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            # connect() executes the 3-way handshake
            # Set a timeout to prevent indefinite waiting
            sock.settimeout(self.timeout)

            start_time = time.time()
            sock.connect((self.host, self.port))
            connect_time = time.time() - start_time
            print(f"[CLIENT] Connected in {connect_time*1000:.2f}ms "
                  f"(≈ 1.5 RTT)")

            # Send data
            data = message.encode('utf-8')
            sock.sendall(data)
            print(f"[CLIENT] Sent {len(data)} bytes")

            # Receive echo response
            response = sock.recv(4096)
            rtt = time.time() - start_time
            print(f"[CLIENT] Received {len(response)} bytes "
                  f"(total RTT: {rtt*1000:.2f}ms)")

            return response.decode('utf-8')
            # close() is called when the with block exits
            # → TCP connection is terminated via the 4-way handshake


# ============================================================
# Usage Example
# ============================================================
if __name__ == '__main__':
    # Start the server in a background thread
    server = TCPEchoServer()
    server_thread = threading.Thread(target=server.start, daemon=True)
    server_thread.start()
    time.sleep(0.5)  # Wait for server to start

    # Send a message from the client
    client = TCPEchoClient()
    response = client.send_and_receive("Hello, TCP!")
    print(f"[RESULT] Echo response: {response}")

    server.stop()
```

---

## 5. Flow Control in Detail

### 5.1 Operating Principle of the Sliding Window

```
Flow Control = A mechanism to prevent the receiver's buffer from overflowing

■ Concept of the Sliding Window

  Sender buffer state:
  ┌─────────────────────────────────────────────────────────────────┐
  │  ACKed  │ Sent, unACKed │  Sendable  │     Not sendable        │
  │(released)│  (in-flight)  │  (window)  │  (outside window)       │
  └─────────────────────────────────────────────────────────────────┘
             ↑               ↑            ↑
          SND.UNA          SND.NXT     SND.UNA+SND.WND

  SND.UNA:   Oldest unacknowledged sequence number
  SND.NXT:   Next sequence number to send
  SND.WND:   Send window size (= min(rwnd, cwnd))

  Sendable amount = SND.WND - (SND.NXT - SND.UNA)
                  = Window size - in-flight amount

  Receiver buffer state:
  ┌─────────────────────────────────────────────────────────────────┐
  │ Processed │ Received, unprocessed │  Free space (rwnd)          │
  │(released) │   (in buffer)         │  ← window size →           │
  └─────────────────────────────────────────────────────────────────┘
              ↑                  ↑                                 ↑
           RCV.NXT            RCV.NXT              RCV.NXT + RCV.WND
          (next expected      + received
           sequence number)

■ Window Changes (Concrete Example)

  Receive buffer size = 10 KB, application processing speed = 2 KB/s:

  Time 0: rwnd = 10KB  →  "OK to send up to 10KB"
         ┌─────────────────────────────────┐
         │             Free: 10KB          │
         └─────────────────────────────────┘

  Time 1: Sender sends 4KB → rwnd = 6KB
         ┌──────────┬──────────────────────┐
         │Recv 4KB  │     Free: 6KB        │
         └──────────┴──────────────────────┘

  Time 2: Send another 4KB → rwnd = 2KB
         ┌──────────────────────┬──────────┐
         │  Recv 8KB            │Free: 2KB │
         └──────────────────────┴──────────┘

  Time 3: Application processes 6KB → rwnd = 8KB (Window Update sent)
         ┌──────────┬──────────────────────────────┐
         │Remain 2KB│          Free: 8KB            │
         └──────────┴──────────────────────────────┘
```

### 5.2 Zero Window and Silly Window Syndrome

```
■ Zero Window

  When the receive buffer is full, rwnd = 0 is notified → sending stops

  Client                                 Server
       │── DATA ──→                       │
       │←── ACK (rwnd=0) ───────────── │  Buffer full!
       │                                    │
       │  [Sending stopped]                  │
       │                                    │
       │── Zero Window Probe ──→           │  "Is rwnd still 0?"
       │←── ACK (rwnd=0) ───────────── │  "Still full"
       │                                    │
       │   ... waiting ...                   │
       │                                    │
       │── Zero Window Probe ──→           │  Check again
       │←── ACK (rwnd=4096) ──────────  │  "Space available!"
       │                                    │
       │── DATA ──→                       │  Sending resumes
       │                                    │

  Zero Window Probe:
  - The sender periodically sends a 1-byte probe
  - Repeats until the receiver returns rwnd > 0
  - Probe interval uses exponential backoff based on RTO
  - Configurable on Linux with tcp_probe_interval (default: 75 seconds)

■ Silly Window Syndrome (SWS)

  Problem: The receiver advertises a very small window (a few bytes)
           → The sender transmits very small segments
           → Header overhead ratio becomes extremely high

  Example: 1-byte payload + 40-byte header
           → Efficiency = 1/41 = 2.4% (mostly overhead)

  Countermeasure (receiver side — Clark's algorithm):
  - Do not advertise a window update until rwnd >= MSS or >= 50% of buffer is free
  - Suppress small window updates

  Countermeasure (sender side — Nagle algorithm):
  → Detailed in the next section
```

### 5.3 Nagle Algorithm

```
■ Nagle Algorithm (RFC 896)

  Purpose: Prevent mass transmission of small packets (Tinygram Problem)

  Rule:
  if (unacknowledged data exists) {
      Buffer the data to send
      Send when ACK is received or MSS worth of data accumulates
  } else {
      Send immediately
  }

  Effect:
  - When sending one character at a time (e.g., keystrokes),
    multiple characters are bundled into a single segment
  - Reduces small packets on the network

  Problems:
  - Causes latency in applications requiring real-time responsiveness
  - Particularly with Telnet, SSH, game mouse input, API responses, etc.
  - Combined with Delayed ACK, can cause up to 200ms of latency

  Disabling:
  - Set the TCP_NODELAY socket option
  - Use when low latency is the priority
```

### 5.4 Code Example 3: Checking and Configuring Socket Options

```python
#!/usr/bin/env python3
"""
Checking and configuring TCP socket options
Manipulate parameters related to flow control and buffer size
"""

import socket
import sys

def inspect_tcp_socket_options():
    """Check major options of a TCP socket"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    print("=" * 60)
    print("TCP Socket Options List")
    print("=" * 60)

    # ── Generic socket options ──
    print("\n■ Generic socket options (SOL_SOCKET)")
    print(f"  SO_RCVBUF   (receive buffer size): "
          f"{sock.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF):,} bytes")
    print(f"  SO_SNDBUF   (send buffer size):    "
          f"{sock.getsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF):,} bytes")
    print(f"  SO_REUSEADDR(address reuse):       "
          f"{sock.getsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR)}")
    print(f"  SO_KEEPALIVE(keep-alive):          "
          f"{sock.getsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE)}")

    # ── TCP-specific options ──
    print("\n■ TCP-specific options (IPPROTO_TCP)")
    print(f"  TCP_NODELAY (disable Nagle):       "
          f"{sock.getsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY)}")

    # Linux-specific options (some not supported on macOS)
    if sys.platform == 'linux':
        print(f"  TCP_MAXSEG  (MSS):               "
              f"{sock.getsockopt(socket.IPPROTO_TCP, socket.TCP_MAXSEG)}")
        print(f"  TCP_WINDOW_CLAMP(max window):    "
              f"{sock.getsockopt(socket.IPPROTO_TCP, socket.TCP_WINDOW_CLAMP)}")

    # ── Example of changing buffer size ──
    print("\n■ Changing Buffer Size")
    new_rcvbuf = 256 * 1024  # 256KB
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, new_rcvbuf)
    actual = sock.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)
    print(f"  Set value: {new_rcvbuf:,} bytes → Actual value: {actual:,} bytes")
    print(f"  Note: Some kernel implementations double the set value (Linux)")

    # ── Detailed Keep-Alive settings (Linux) ──
    if sys.platform == 'linux':
        print("\n■ TCP Keep-Alive settings (Linux)")
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        # Time before Keep-Alive starts (seconds)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 60)
        # Interval between Keep-Alive probes (seconds)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 10)
        # Maximum number of Keep-Alive probes
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 5)
        print(f"  TCP_KEEPIDLE  : 60s (idle time before first probe)")
        print(f"  TCP_KEEPINTVL : 10s (probe interval)")
        print(f"  TCP_KEEPCNT   :  5  (maximum number of probes)")
        print(f"  → 60 + 10 × 5 = 110 seconds to declare connection dead")

    sock.close()

if __name__ == '__main__':
    inspect_tcp_socket_options()
```

---

## 6. Congestion Control in Detail

### 6.1 Purpose of Congestion Control and Its Difference from Flow Control

```
■ Flow Control vs Congestion Control

  Flow Control:
  - Purpose: Prevent receive-buffer overflow at the receiver
  - Scope: End-to-end (sender ↔ receiver)
  - Control variable: rwnd (receive window)
  - Notification method: Window Size field in TCP header
  - The receiver explicitly notifies the sender

  Congestion Control:
  - Purpose: Avoid congestion across the entire network
  - Scope: The whole network (load on routers and switches)
  - Control variable: cwnd (congestion window)
  - Inference method: Inferred from packet loss and RTT variation
  - The sender infers implicitly

  Effective send window:
  effective_window = min(rwnd, cwnd)
  → Send only within the range that satisfies both flow control and congestion control
```

### 6.2 The Four Phases of Congestion Control

```
■ Congestion Control Algorithm (TCP Reno) in Detail

[Phase 1] Slow Start
  Purpose: Quickly find the available bandwidth of the network
  Operation:
  - Initial value: cwnd = 1 MSS (or IW = 10 MSS: RFC 6928)
  - cwnd += 1 MSS for each ACK received
  - cwnd doubles every RTT (exponential increase)
  - Move to Phase 2 when ssthresh (slow start threshold) is reached
  - Move to Phase 3/4 when packet loss is detected

  cwnd change (per RTT):
    RTT 0:  cwnd = 1 MSS  → 1 segment sent
    RTT 1:  cwnd = 2 MSS  → 2 segments sent
    RTT 2:  cwnd = 4 MSS  → 4 segments sent
    RTT 3:  cwnd = 8 MSS  → 8 segments sent
    RTT 4:  cwnd = 16 MSS → 16 segments sent
    ...
    → Reaches N MSS in approximately log2(N) RTTs

[Phase 2] Congestion Avoidance
  Purpose: Carefully increase the rate without causing congestion
  Operation:
  - Applied when cwnd >= ssthresh
  - cwnd += MSS × (MSS / cwnd) for each ACK received
  - cwnd increases by approximately 1 MSS per RTT (linear increase: the AI part of AIMD)

[Phase 3] Fast Retransmit
  Trigger: Receiving 3 duplicate ACKs
  Operation:
  - Immediately retransmit the lost segment without waiting for timeout
  - Set ssthresh = cwnd / 2

[Phase 4] Fast Recovery
  Purpose: Speed up recovery after congestion
  Operation (TCP Reno):
  - ssthresh = cwnd / 2
  - cwnd = ssthresh + 3 MSS (for the 3 DupACKs)
  - cwnd += 1 MSS for each additional DupACK received
  - When a new ACK (ACK for the original data) is received, cwnd = ssthresh
  - Transition to congestion avoidance phase

  On timeout (most serious congestion signal):
  - ssthresh = cwnd / 2
  - cwnd = 1 MSS (return to slow start)
  - Restart from Phase 1
```

### 6.3 Congestion Control Algorithm Timeline

```
cwnd changes over time:

cwnd (MSS)
  ^
  |
32|                          *
  |                        * | Packet loss (DupACK x3)
  |                      *   |
  |                    *     | ssthresh = 32/2 = 16
  |                  *       |
  |               *          ↓
16|─ ─ ─ ─ ─ ─*─ ─ ─ ─ ─ ─ ─ ─ ─ ─ * ─ ─ ─ ─ ─ ─ ─ ─ *
  |           *  (1) Slow Start       *                   *
  |         *    (exponential)       *  (2) Congestion    *
  |       *                        *    Avoidance        *
  |     *                        *    (linear)           *
  |   *                        *                      *
  |  *                       *                  Timeout!
  | *                      *                     ↓ cwnd=1
1 |*─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─*
  |                                              | (1) Restart
  +──────────────────────────────────────────────→ Time (RTT)

  Legend:
  --- Phase 1: Slow Start (exponential increase)
  --- Phase 2: Congestion Avoidance (linear increase: AIMD)
  ↓   Phase 3+4: Fast Retransmit + Fast Recovery (cwnd halved)
  ↓↓  Timeout: cwnd = 1 (return to slow start)

  AIMD = Additive Increase, Multiplicative Decrease
    Additive Increase:     cwnd += 1 MSS per RTT
    Multiplicative Decrease: cwnd = cwnd / 2 on packet loss
    → An important property that ensures network fairness
```

### 6.4 Comparison of Major Congestion Control Algorithms

| Property | TCP Reno | TCP CUBIC | BBR |
|----------|----------|-----------|-----|
| Year | 1990 | 2006 | 2016 |
| RFC | RFC 5681 | RFC 9438 | Experimental |
| Loss detection | Packet-loss-based | Packet-loss-based | Bandwidth × delay model |
| cwnd increase | AIMD (linear) | Cubic function (BIC curve) | Based on BDP estimation |
| High bandwidth × high delay | Poor | Good | Very good |
| Fairness | Baseline | Mostly fair with Reno | Fairness issues with other algorithms |
| OS adoption | BSD, older Linux | Linux default (3.x+) | Google internally, Linux 4.9+ |
| Target environment | Low-latency LAN | General Internet | High-BDP environments, video delivery |
| Buffer overflow tolerance | Weak | Moderate | Adapts to shallow buffers |

### 6.5 CUBIC Algorithm in Detail

```
■ TCP CUBIC (RFC 9438)

  Linux's default congestion control algorithm (since kernel 2.6.19)

  Core idea:
  - Controls cwnd increase with a time-based cubic function
  - Quickly returns to the cwnd before the loss, then carefully probes around it

  Cubic function:
    W(t) = C * (t - K)^3 + W_max

    C:     Constant (0.4)
    t:     Time elapsed since the last packet loss
    K:     Estimated time to reach W_max from W_max / 2
           K = (W_max * beta / C) ^ (1/3)
    W_max: cwnd before the loss occurred
    beta:  Reduction coefficient (0.7: more gradual than Reno's 0.5)

  cwnd change pattern:
  cwnd
   ^
   |        W_max
   |  ------*-----------------*---- <- cwnd before loss
   |       /|*               *|
   |      / |  *           *  |
   |     /  |    *       *    |
   |    /   |      * * *      |    <- Convex: careful probing
   |   /    |    Concave: fast recovery
   |  /     |                 |
   | /      |                 |
   |/       |                 |
   +--------+-----------------+---> Time
         Loss occurs      New loss

  Advantages of CUBIC:
  1. Adapts to high-BDP (Bandwidth-Delay Product) environments
     - Reno takes a long time to utilize high-bandwidth links due to linear increase
     - CUBIC quickly approaches W_max with a cubic function
  2. RTT fairness
     - Reno favors connections with shorter RTT (ACKs return faster)
     - CUBIC is time-based, so it is less affected by RTT
```

### 6.6 BBR (Bottleneck Bandwidth and Round-trip propagation time)

```
■ BBR (Google, 2016+)

  Traditional approach: Uses packet loss as a congestion signal
  BBR's approach:       Directly estimates the network's physical properties (bandwidth and delay)

  Two metrics:
    BtlBw:  Bottleneck bandwidth (maximum throughput)
    RTprop: Minimum RTT (propagation delay only, excluding queuing delay)

    Optimal operating point = BtlBw * RTprop (BDP: Bandwidth-Delay Product)

  State machine:
  +-----------------------------------------------------+
  |                                                     |
  |  [STARTUP]                                          |
  |    Increase cwnd exponentially                      |
  |    Until BtlBw stops increasing for 3 consecutive   |
  |    RTTs                                             |
  |         |                                           |
  |         v                                           |
  |  [DRAIN]                                            |
  |    Drain data excessively buffered in queues        |
  |    Reduce inflight to BDP                           |
  |         |                                           |
  |         v                                           |
  |  [PROBE_BW]   <- Spends most of the time here       |
  |    Periodically probes for BtlBw                    |
  |    8 RTT cycle: 1.25 -> 0.75 -> 1.0 x 6            |
  |    (probe for bandwidth increase -> drain excess     |
  |     -> steady operation)                            |
  |         |                                           |
  |         v (if RTprop not updated for 200ms+)        |
  |  [PROBE_RTT]                                        |
  |    Temporarily reduce cwnd to 4 MSS                 |
  |    Empty queue and re-measure minimum RTT           |
  |    Return to PROBE_BW after 200ms                   |
  |                                                     |
  +-----------------------------------------------------+

  Advantages of BBR:
  1. Avoids Bufferbloat
     - Maximizes bandwidth utilization without filling queues
  2. Does not overreact to packet loss
     - Does not halve cwnd on random loss
  3. Excellent performance in high-BDP environments
     - Effective for intercontinental communication and datacenter interconnects

  BBR challenges:
  1. Fairness issues
     - BBR may overly dominate bandwidth when coexisting with CUBIC
  2. Performance in high packet loss environments
     - Since it does not treat loss as a congestion signal, it may miss actual congestion
  3. Being improved in BBRv2
     - Leveraging ECN (Explicit Congestion Notification)
     - Also reacts to packet loss to some degree
```

### 6.7 Code Example 4: Checking and Changing the Congestion Control Algorithm on Linux

```bash
# ── Check the current congestion control algorithm ──
sysctl net.ipv4.tcp_congestion_control
# Example output: net.ipv4.tcp_congestion_control = cubic

# ── List available algorithms ──
sysctl net.ipv4.tcp_available_congestion_control
# Example output: net.ipv4.tcp_available_congestion_control = reno cubic

# ── Load and enable the BBR module ──
sudo modprobe tcp_bbr
echo "tcp_bbr" | sudo tee -a /etc/modules-load.d/modules.conf

# Enable BBR
sudo sysctl -w net.ipv4.tcp_congestion_control=bbr
# Verify
sysctl net.ipv4.tcp_congestion_control
# Output: net.ipv4.tcp_congestion_control = bbr

# ── Make persistent (append to /etc/sysctl.conf) ──
echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.conf
echo "net.core.default_qdisc=fq" | sudo tee -a /etc/sysctl.conf
# Note: BBR is recommended to be used with fq (Fair Queue) qdisc

# ── List TCP-related kernel parameters ──
sysctl -a | grep "^net.ipv4.tcp"

# Important parameters:
# net.ipv4.tcp_rmem = 4096 131072 6291456
#   → Receive buffer: min / default / max
# net.ipv4.tcp_wmem = 4096 16384 4194304
#   → Send buffer: min / default / max
# net.ipv4.tcp_window_scaling = 1
#   → Window Scale option enabled/disabled
# net.ipv4.tcp_sack = 1
#   → SACK enabled/disabled
# net.ipv4.tcp_timestamps = 1
#   → Timestamp option enabled/disabled
# net.ipv4.tcp_max_syn_backlog = 4096
#   → Maximum SYN queue size
# net.ipv4.tcp_fin_timeout = 60
#   → FIN_WAIT_2 state timeout
# net.ipv4.tcp_tw_reuse = 2
#   → TIME_WAIT socket reuse

# ── Specify congestion control per connection (Python) ──
# import socket
# sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
# sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_CONGESTION,
#                 b'bbr')
```

### 6.8 ECN (Explicit Congestion Notification)

```
■ ECN (RFC 3168)

  Traditional: Detect congestion by packet loss → slow, involves data loss
  ECN:         Router explicitly marks "congestion occurring" → can act before loss

  Mechanism:
  1. Sender and receiver negotiate ECN support in the TCP handshake
     (Set ECE + CWR flags in SYN)
  2. When a router's queue is about to overflow, it marks
     the ECN field (2 bits) in the IP header as CE (Congestion Experienced)
  3. The receiver detects the CE mark and notifies the sender via the TCP ECE flag
  4. The sender reduces cwnd and notifies the receiver with the CWR flag that it has responded

  ECN field in the IP header:
    00: Non ECN-Capable Transport (Not-ECT)
    01: ECN Capable Transport (ECT(1))
    10: ECN Capable Transport (ECT(0))
    11: Congestion Experienced (CE)

  Advantages:
  - Can notify congestion without dropping packets
  - Particularly effective for short flows (Web requests, etc.)
  - BBRv2 actively leverages ECN

  Current status:
  - Supported by most operating systems (often disabled by default)
  - Apple (iOS/macOS) enables it proactively
  - Some middleboxes strip ECN marks, which is a known issue
```

---

## 7. TCP Connection Termination (4-Way Handshake)

### 7.1 Normal Termination Procedure

```
TCP Termination (4-Way Handshake):

  Client                               Server
  [ESTABLISHED]                       [ESTABLISHED]
       |                                  |
       |-- FIN (seq=1000) ------------>   |  (1) close() called
       |   [FIN_WAIT_1]                    |
       |                                  |
       |<----- ACK (ack=1001) ---------- |  (2) ACK for FIN
       |   [FIN_WAIT_2]                    |  [CLOSE_WAIT]
       |                                  |
       |      (Server sends remaining data)|
       |                                  |
       |<----- FIN (seq=5000) ---------- |  (3) Server also calls close()
       |                                  |  [LAST_ACK]
       |                                  |
       |-- ACK (ack=5001) ------------>   |  (4) ACK for FIN
       |   [TIME_WAIT]                     |  [CLOSED]
       |                                  |
       |   2MSL wait                       |
       |   (typically 60–120 seconds)      |
       |                                  |
       |   [CLOSED]                        |
       |                                  |

  Why 4-way (not 3-way)?
  - Even when one side sends FIN, the other side may still have data to send
  - To achieve a half-close, each direction needs an independent FIN-ACK
  - Unlike connection establishment (SYN + SYN-ACK), the FIN and ACK for
    termination may not be sendable simultaneously

  Simultaneous Close:
  - A special case where both sides send FIN at the same time
  - Both sides transition: FIN_WAIT_1 → CLOSING → TIME_WAIT → CLOSED
```

### 7.2 TIME_WAIT in Detail and Its Problems

```
■ TIME_WAIT State

  Purpose 1: Recovery when the final ACK is lost
    - If the ACK for the peer's FIN is lost, the peer retransmits the FIN
    - While in TIME_WAIT, another ACK can be returned

  Purpose 2: Guarantee that old segments have expired
    - Before starting a new connection with the same 4-tuple
      (src IP, src port, dst IP, dst port), wait for old segments
      still in the network to fully expire
    - MSL (Maximum Segment Lifetime) = the maximum time a packet can
      exist on the network

  TIME_WAIT waiting period:
    2 * MSL = 2 * 60 seconds = 120 seconds (Linux)
    Note: The MSL value varies by OS implementation

  Problem: Large accumulation of TIME_WAIT entries
  ─────────────────────────────────────────
  Cause:
  - High-frequency short-lived TCP connections (HTTP requests, etc.)
  - Each connection maintains TIME_WAIT state for 120 seconds
  - Puts pressure on available ephemeral ports (approximately 16,000)

  Verification commands:
  $ ss -tan state time-wait | wc -l
  $ netstat -an | grep TIME_WAIT | wc -l

  Countermeasures:
  1. SO_REUSEADDR: Reuse addresses in TIME_WAIT state
     sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

  2. tcp_tw_reuse (Linux): Reuse TIME_WAIT on the client side
     sysctl -w net.ipv4.tcp_tw_reuse=1

  3. HTTP Keep-Alive: Reuse connections to reduce short-lived connections
     Connection: keep-alive

  4. Connection pooling: Reuse connections for database connections, etc.

  5. Expand the ephemeral port range:
     sysctl -w net.ipv4.ip_local_port_range="1024 65535"
```

---

## 8. Code Example 5: Packet Analysis with Wireshark

```
■ Procedure for analyzing TCP communication with Wireshark

[Step 1] Start capture
  - Launch Wireshark
  - Select the appropriate network interface
  - Set a capture filter: "tcp port 443"

[Step 2] Use display filter expressions

  Display Filters:
  ─────────────────────────────────────────────────────
  Purpose                   Filter Expression
  ─────────────────────────────────────────────────────
  SYN packets only          tcp.flags.syn == 1 && tcp.flags.ack == 0
  SYN-ACK packets only      tcp.flags.syn == 1 && tcp.flags.ack == 1
  RST packets only          tcp.flags.reset == 1
  FIN packets only          tcp.flags.fin == 1
  Retransmitted packets     tcp.analysis.retransmission
  Duplicate ACKs            tcp.analysis.duplicate_ack
  Zero window               tcp.analysis.zero_window
  Window updates            tcp.analysis.window_update
  Specific stream           tcp.stream eq 5
  With payload              tcp.len > 0
  Specific port             tcp.port == 80
  Specific flag combination tcp.flags == 0x12  (SYN-ACK)
  ACK RTT > 100ms           tcp.analysis.ack_rtt > 0.1
  ─────────────────────────────────────────────────────

[Step 3] Follow a TCP Stream
  - Right-click a packet → "Follow → TCP Stream"
  - Data from client→server appears in red, reverse in blue
  - For HTTP traffic, requests and responses are visible

[Step 4] Check TCP statistics
  - Statistics → TCP Stream Graphs → Time-Sequence (tcptrace)
    → Display sequence number progression as a graph
    → Visually check retransmissions and throughput changes
  - Statistics → TCP Stream Graphs → Window Scaling
    → Check window size changes
  - Statistics → TCP Stream Graphs → Round Trip Time
    → Check RTT variation
  - Statistics → Flow Graph
    → Display sequence diagram (ladder diagram)

[Step 5] Filtering with tshark (command-line Wireshark)

  # Extract only the 3-way handshake
  tshark -r capture.pcap -Y "tcp.flags.syn == 1" \
    -T fields -e frame.time -e ip.src -e ip.dst \
    -e tcp.srcport -e tcp.dstport -e tcp.flags

  # Extract retransmitted packets
  tshark -r capture.pcap -Y "tcp.analysis.retransmission" \
    -T fields -e frame.time -e ip.src -e tcp.seq -e tcp.len

  # Obtain RTT statistics
  tshark -r capture.pcap -Y "tcp.analysis.ack_rtt" \
    -T fields -e tcp.analysis.ack_rtt | \
    awk '{ sum+=$1; count++; if($1>max)max=$1 }
    END { print "Avg:", sum/count*1000, "ms",
                "Max:", max*1000, "ms",
                "Count:", count }'

  # Output window size progression as CSV
  tshark -r capture.pcap \
    -Y "tcp.stream eq 0" \
    -T fields -e frame.time_relative -e tcp.window_size_value \
    -E separator=, > window_size.csv
```

---

## 9. FAQ

### Q1: When should I choose TCP vs UDP?

**Decision criteria**

| Requirement | Choice | Reason |
|-------------|--------|--------|
| Data integrity is paramount | **TCP** | Retransmission and ordering guarantees prevent data loss/corruption |
| Real-time responsiveness is paramount | **UDP** | No connection setup or retransmission wait; minimizes latency |
| Small request-response | **UDP** | Suitable for one-round-trip communication like DNS and NTP |
| Long-duration streaming | **TCP** | Stable delivery via HTTP/2 and WebSocket |
| High packet loss environment | **TCP** | Automatic retransmission provides high loss tolerance |
| Broadcast/multicast | **UDP** | TCP supports only 1-to-1 communication |

**Hybrid approach**
- QUIC (the foundation of HTTP/3): Implements custom retransmission and congestion control over UDP
- WebRTC: Uses UDP for video and TCP/WebSocket for control signals

### Q2: How should I handle the TIME_WAIT problem?

**The root of the problem**
```bash
# Check the number of sockets in TIME_WAIT state
$ ss -tan state time-wait | wc -l
12845  # Large number of TIME_WAIT sockets accumulated
```

**Prioritized countermeasures**

**1. Reuse connections (most recommended)**
```python
# HTTP Keep-Alive: send multiple requests over the same TCP connection
import requests

session = requests.Session()
session.get('http://example.com/api/1')  # Connection established
session.get('http://example.com/api/2')  # Reuse the same connection
session.get('http://example.com/api/3')  # Reuse the same connection
```

**2. Use the SO_REUSEADDR option**
```python
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
# Allows immediate rebinding of an address in TIME_WAIT state
```

**3. Enable tcp_tw_reuse (Linux client side only)**
```bash
# Reuse TIME_WAIT sockets for new connections
sudo sysctl -w net.ipv4.tcp_tw_reuse=1
```

**4. Expand the ephemeral port range**
```bash
# Default: 32768–60999 (about 28,000 ports)
# Expanded: 1024–65535 (about 64,000 ports)
sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"
```

**Countermeasures to avoid**
- `tcp_tw_recycle=1`: Violates RFC and causes connection failures (removed in kernel 4.12)
- Excessively shortening `tcp_fin_timeout`: Increases risk of misdelivery of old packets

### Q3: How should I tune TCP window size?

**BDP (Bandwidth-Delay Product) calculation**
```
Optimal buffer size = Bandwidth × RTT

Example 1: Tokyo ↔ Osaka (100 Mbps, 5ms RTT)
  BDP = 100 Mbps × 5ms = 500 Kb ÷ 8 = 62.5 KB

Example 2: Tokyo ↔ US West Coast (1 Gbps, 100ms RTT)
  BDP = 1 Gbps × 100ms = 100 Mb ÷ 8 = 12.5 MB
```

**Linux settings**
```bash
# Receive buffer: min / default / max
sudo sysctl -w net.ipv4.tcp_rmem="4096 131072 16777216"

# Send buffer: min / default / max
sudo sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"

# Enable auto-tuning (recommended)
sudo sysctl -w net.ipv4.tcp_window_scaling=1
sudo sysctl -w net.ipv4.tcp_moderate_rcvbuf=1
```

**Application-side settings**
```python
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
# Set receive buffer to 1MB
sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024 * 1024)
```

**Notes**
- Leaving it to the kernel's auto-tuning is generally optimal
- Manual tuning should be done carefully based on measurement results
- Setting buffers too large can cause Bufferbloat (increased latency)

---

## FAQ

### Q1: How should I choose between TCP and UDP?
Use TCP for communication where reliability is required (Web browsing, file transfer, email, database connections, etc.). Use UDP when real-time responsiveness is the top priority and some packet loss is acceptable (games, audio/video streaming, DNS queries, etc.). HTTP/3 adopts QUIC (built over UDP), which avoids TCP's Head-of-Line Blocking problem while also ensuring reliability.

### Q2: Why do large numbers of TIME_WAIT connections appear?
TIME_WAIT is a normal TCP behavior. The side that actively closes the connection maintains this state for 2MSL (typically 60–120 seconds) to prevent delayed packets from leaking into new connections. In high-traffic environments, accumulated TIME_WAIT connections can exhaust available ports. Effective countermeasures include setting `SO_REUSEADDR`, using connection pooling, and reusing connections with Keep-Alive.

### Q3: What is the difference between BBR and CUBIC? Which should I choose?
CUBIC is a loss-based algorithm that uses packet loss as a congestion signal and is widely used as the Linux standard. BBR (Bottleneck Bandwidth and Round-trip propagation time), developed by Google, is based on a bandwidth × delay model and estimates the optimal sending rate without relying on packet loss. BBR delivers high performance in networks with large buffers (Bufferbloat environments), but fairness issues have also been noted. Choose based on your server's kernel version and use case.

---

## Summary

### Core Understanding of TCP

| Element | Content | Importance |
|---------|---------|------------|
| **Reliability guarantee** | Guarantees data delivery and ordering via sequence numbers, ACKs, and retransmission | ★★★ |
| **3-way handshake** | Establishes a connection with SYN → SYN-ACK → ACK (1.5 RTT) | ★★★ |
| **Flow control** | Prevents receive-buffer overflow with sliding window (rwnd) | ★★★ |
| **Congestion control** | Dynamically adjusts cwnd to contribute to overall network stability (Reno, CUBIC, BBR) | ★★★ |
| **4-way handshake** | Terminates a connection with FIN → ACK → FIN → ACK; TIME_WAIT eliminates old packets | ★★☆ |
| **HoL Blocking** | A single lost packet blocks everything (resolved by QUIC/HTTP/3) | ★★☆ |

### Key Points

1. **TCP = A protocol that accepts latency in exchange for reliability**
   - Connection establishment takes 1.5 RTT; up to 3 RTT with TLS
   - Latency increases while waiting for retransmission after packet loss
   - HTTP/3 (QUIC) resolves these issues with a UDP-based approach

2. **Flow control and congestion control are different things**
   - Flow control (rwnd): Matches the receiver's processing capacity (end-to-end)
   - Congestion control (cwnd): Infers network congestion state (sender acts autonomously)
   - Effective window = min(rwnd, cwnd)

3. **TCP continues to evolve**
   - RFC 9293 (2022): Latest TCP specification
   - CUBIC (2006+): Linux's standard congestion control algorithm
   - BBR (2016+): Google's bandwidth × delay model
   - ECN (Explicit Congestion Notification): Explicit congestion notification from routers

---

## Further Reading

**Deepen your understanding of protocols**

**Practical skills**

---

## References

### RFCs (Standards)

1. **RFC 9293 - Transmission Control Protocol (TCP)**
   https://www.rfc-editor.org/rfc/rfc9293.html
   Published August 2022. The latest TCP standard. Successor to RFC 793 (1981), integrating 40 years of updates.

2. **RFC 5681 - TCP Congestion Control**
   https://www.rfc-editor.org/rfc/rfc5681.html
   Specifies slow start, congestion avoidance, fast retransmit, and fast recovery. The foundation of TCP Reno.

3. **RFC 7413 - TCP Fast Open**
   https://www.rfc-editor.org/rfc/rfc7413.html
   Shortens connection establishment to 1 RTT by including data in SYN packets.

4. **RFC 6298 - Computing TCP's Retransmission Timer**
   https://www.rfc-editor.org/rfc/rfc6298.html
   Specifies the calculation method for RTO (Retransmission Timeout). Includes Karn's Algorithm and Jacobson's Algorithm.

5. **RFC 3168 - The Addition of Explicit Congestion Notification (ECN) to IP**
   https://www.rfc-editor.org/rfc/rfc3168.html
   Mechanism to notify congestion without packet loss. Used by BBRv2.

6. **RFC 9438 - CUBIC for Fast Long-Distance Networks**
   https://www.rfc-editor.org/rfc/rfc9438.html
   Published August 2023. Specification of CUBIC, Linux's standard congestion control algorithm.

### Books

7. **Stevens, W. Richard. "TCP/IP Illustrated, Volume 1: The Protocols, 2nd Edition." Addison-Wesley, 2011.**
   A classic book explaining TCP operations in detail. Understanding deepens through packet captures and diagrams.

8. **Fall, Kevin R. and Stevens, W. Richard. "TCP/IP Illustrated, Volume 2: The Implementation." Addison-Wesley, 1995.**
   Explains the BSD TCP implementation in detail. Ideal for kernel-level understanding.

9. **Grigorik, Ilya. "High Performance Browser Networking." O'Reilly Media, 2013.**
   Chapter 2: Building Blocks of TCP explains TCP performance optimization practically. Free online version: https://hpbn.co/

### Papers and Technical Articles

10. **Cardwell, Neal et al. "BBR: Congestion-Based Congestion Control." ACM Queue, Vol. 14 No. 5, 2016.**
    https://queue.acm.org/detail.cfm?id=3022184
    Design philosophy and evaluation of the BBR algorithm developed by Google.

11. **Ha, Sangtae et al. "CUBIC: A New TCP-Friendly High-Speed TCP Variant." ACM SIGOPS Operating Systems Review, 2008.**
    The original CUBIC paper. Demonstrates performance improvements in high-BDP environments.

12. **Jacobson, Van. "Congestion Avoidance and Control." ACM SIGCOMM, 1988.**
    The historic paper that laid the foundations of TCP congestion control. The original source of slow start and congestion avoidance.
