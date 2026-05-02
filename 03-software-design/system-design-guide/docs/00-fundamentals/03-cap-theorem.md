# CAP Theorem

> Understand the tradeoffs between Consistency, Availability, and Partition Tolerance in distributed systems, and build practical design judgment through extended knowledge including the PACELC theorem, and hands-on implementation of quorum, eventual consistency, and conflict resolution.

---

## What You Will Learn

1. The precise definition of the CAP theorem and the correct interpretation of "choose 2 of 3" (correcting common misconceptions)
2. Concrete behavioral differences between CP and AP systems, and implementation of quorum-based consistency control
3. Extended understanding through the PACELC theorem, and design decisions for selecting consistency levels based on data characteristics

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|--------|
| Reliability | Core concepts of availability and fault tolerance | [Reliability](./02-reliability.md) |
| Scalability | Concepts of horizontal scaling and replication | [Scalability](./01-scalability.md) |
| Network Basics | Fundamentals of TCP/IP, DNS, and packet loss | Web/Network Fundamentals |
| Python Basics | dataclass, dictionary operations, basic class design | Programming Fundamentals |

---

## 1. What is the CAP Theorem?

### 1.1 Definition

A theorem proposed by Eric Brewer in 2000 and formally proven by Gilbert & Lynch in 2002. It states that a distributed system **cannot simultaneously satisfy all three** of the following properties:

```
C — Consistency
    All nodes return the same data at the same point in time
    (Consistency here refers to "Linearizability")
    Note: this is a different concept from the C in ACID

A — Availability
    Every request to a non-failing node receives
    a (success or failure) response
    Responses are returned even when node failures occur

P — Partition Tolerance
    The system continues to operate even when
    a network partition (communication breakdown between nodes) occurs
```

### 1.2 WHY: Why Should You Understand the CAP Theorem?

In distributed system design, there is always a tradeoff between consistency and availability. Without a correct understanding of the CAP theorem, the following problems arise:

```
Common failures:
─────────────────────────────────────────────
1. "Apply strong consistency to all data"
   → Latency degrades and availability decreases
   → User settings and logs do not need strong consistency

2. "Apply eventual consistency to all data"
   → Balance inconsistencies occur in payment data
   → Serious problems like double charges

3. Mistakenly believing "CA is achievable"
   → Network partitions are unavoidable in distributed systems
   → System completely halts when a partition occurs
─────────────────────────────────────────────
Correct approach: Select consistency levels based on the nature of the data
```

### ASCII Diagram 1: The CAP Triangle

```
                    C (Consistency)
                    /\
                   /  \
                  /    \
                 / CP   \
                / systems\
               /          \
              /   CA       \
             /  (theoretical\
            /    only)      \
           /                 \
          /        AP         \
         /       systems       \
        /________________________\
      A (Availability)    P (Partition Tolerance)

  ■ Network partitions are unavoidable
    → The real choice is between CP and AP

  CP: Prioritizes consistency during partition → Rejects some requests
  AP: Prioritizes availability during partition → May return stale data
  CA: Assumes no partition → Only for single nodes or within the same LAN
```

### 1.3 Consistency Model Hierarchy

The "C" in the CAP theorem refers to the strongest consistency (linearizability), but in practice multiple consistency levels exist:

```
Strength of consistency models (strongest at the top):
─────────────────────────────────────────────
  Linearizability ← The "C" in CAP
    ↑ All operations are consistent in real-time order
    │ Implementation: Raft, Paxos, 2PC
    │
  Sequential Consistency
    ↑ All nodes observe the same operation order
    │
  Causal Consistency
    ↑ Order is guaranteed only for causally related operations
    │ Implementation: Vector clocks
    │
  Read-your-writes Consistency
    ↑ Your own writes are immediately readable
    │ Implementation: Sticky Session, Primary Read
    │
  Eventual Consistency ← Standard for AP systems
    ↓ Eventually consistent but timing is non-deterministic
    │ Implementation: Gossip protocol, CRDTs
─────────────────────────────────────────────
  Stronger consistency increases latency
```

---

## 2. What are Network Partitions?

### 2.1 Types and Causes of Partitions

```
■ Full Partition
  [Node A] ──×── [Node B]
  Bidirectional communication is completely severed

■ Partial Partition
  [Node A] ──×── [Node B]
       \              /
        \            /
         [Node C]     ← C can communicate with both A and B
  C may act as a bridge and relay A-B communication

■ Asymmetric Partition
  [Node A] ──→── [Node B]  ← A can send to B
  [Node A] ──×── [Node B]  ← B cannot send to A

Causes:
  - Network hardware failures (switches, routers)
  - Cable disconnections
  - Misconfigured firewalls
  - DNS failures
  - Inter-AZ connectivity failures from cloud providers
  - GC Stop-The-World events causing temporary timeouts

Real-world statistics:
  Google data (2011 paper):
  → Average 5.47 network partitions per year
  → Average partition duration: 23 minutes
  → Conclusion: partitions between data centers are unavoidable
```

### Code Example 1: Simulating Network Partitions

```python
from dataclasses import dataclass, field
from typing import Optional, Set, Dict
import time

@dataclass
class Node:
    name: str
    data: dict
    reachable: set  # set of reachable node names

class DistributedStore:
    """A distributed store that simulates network partitions"""

    def __init__(self):
        self.nodes = {
            "node1": Node("node1", {"key": "value_v1"}, {"node2", "node3"}),
            "node2": Node("node2", {"key": "value_v1"}, {"node1", "node3"}),
            "node3": Node("node3", {"key": "value_v1"}, {"node1", "node2"}),
        }

    def partition(self, group_a: set, group_b: set):
        """Trigger a network partition"""
        print(f"[PARTITION] {group_a} <-X-> {group_b}")
        for name in group_a:
            self.nodes[name].reachable -= group_b
        for name in group_b:
            self.nodes[name].reachable -= group_a

    def heal(self):
        """Resolve the partition"""
        all_names = set(self.nodes.keys())
        for name, node in self.nodes.items():
            node.reachable = all_names - {name}
        print("[HEAL] Network partition resolved")

    def write_cp(self, node_name: str, key: str, value: str) -> bool:
        """CP mode: reject write if quorum cannot be reached"""
        node = self.nodes[node_name]
        reachable_count = 1 + len(node.reachable)  # self + reachable nodes
        quorum = len(self.nodes) // 2 + 1

        if reachable_count >= quorum:
            # Quorum reachable → write succeeds
            node.data[key] = value
            for peer_name in node.reachable:
                self.nodes[peer_name].data[key] = value
            print(f"[CP] Write succeeded ({reachable_count}/{len(self.nodes)} >= quorum {quorum})")
            return True
        else:
            # Quorum not reachable → reject write (prioritize consistency)
            print(f"[CP] Write rejected ({reachable_count}/{len(self.nodes)} < quorum {quorum})")
            return False

    def write_ap(self, node_name: str, key: str, value: str) -> bool:
        """AP mode: write to reachable nodes only, always succeeds"""
        node = self.nodes[node_name]
        node.data[key] = value
        for peer_name in node.reachable:
            self.nodes[peer_name].data[key] = value
        unreachable = set(self.nodes.keys()) - {node_name} - node.reachable
        if unreachable:
            print(f"[AP] Write succeeded ({unreachable} retains stale data)")
        else:
            print(f"[AP] Write succeeded (all nodes in sync)")
        return True

    def read_all(self, key: str) -> dict:
        """Display data from all nodes"""
        result = {}
        for name, node in self.nodes.items():
            result[name] = node.data.get(key, "NOT_FOUND")
        return result


# === Demo ===
print("=== Network Partition Simulation ===\n")

# Initial state
store = DistributedStore()
print(f"Initial state: {store.read_all('key')}")

# Trigger a partition
store.partition({"node1", "node2"}, {"node3"})

print("\n--- CP mode ---")
store.write_cp("node1", "key", "value_v2")  # succeeds (2/3 >= 2)
store.write_cp("node3", "key", "value_v3")  # rejected (1/3 < 2)
print(f"Data state: {store.read_all('key')}")
# → node1,node2 = "value_v2", node3 = "value_v1" (rejected, remains stale)

print("\n--- AP mode ---")
store2 = DistributedStore()
store2.partition({"node1", "node2"}, {"node3"})
store2.write_ap("node1", "key", "value_v2")  # succeeds (node3 is stale)
store2.write_ap("node3", "key", "value_v3")  # succeeds (different value from node1,2)
print(f"Data state: {store2.read_all('key')}")
# → node1,node2 = "value_v2", node3 = "value_v3" → conflict!
```

---

## 3. CP Systems vs AP Systems

### ASCII Diagram 2: CP and AP Behavior During Partitions

```
■ CP System (Consistency-first)

  Client A ──write "X=2"──→ Node1 ──sync──→ Node2
                                    ×  (partition)
                                   Node3

  Client B ──read "X"──→ Node3
  → Returns error: "Rejected: cannot guarantee consistency"

  Benefit: Read data is always accurate
  Drawback: Some nodes become unresponsive during partitions
  Examples: MongoDB, HBase, etcd, ZooKeeper

■ AP System (Availability-first)

  Client A ──write "X=2"──→ Node1 ──sync──→ Node2
                                    ×  (partition)
                                   Node3 (still X=1)

  Client B ──read "X"──→ Node3
  → Returns "X=1" (stale data, but a response is returned)
  → After partition heals, Node3 is repaired to "X=2" (eventual consistency)

  Benefit: Always returns a response (high availability)
  Drawback: May return stale data
  Examples: Cassandra, DynamoDB, CouchDB, Riak
```

### ASCII Diagram 3: Decision Flow During a Partition

```
Decision flow when a network partition occurs:

  Network partition detected
        │
        ▼
  ┌─────────────────┐
  │ Is consistency  │
  │ required?       │
  └────────┬────────┘
           │
     ┌─────┴─────┐
     │           │
    YES          NO
     │           │
     ▼           ▼
  ┌──────┐   ┌──────┐
  │  CP  │   │  AP  │
  │      │   │      │
  │Minority  │All   │
  │side  │   │nodes │
  │rejects   │respond│
  │reads/    │      │
  │writes│   │      │
  └──────┘   └──────┘
     │           │
     ▼           ▼
  Consistent  Possible
  data        stale data
  guaranteed  (requires conflict resolution)
```

### Code Example 2: Implementing Eventual Consistency

```python
import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional, Dict, List

@dataclass
class VersionedEntry:
    """A versioned data entry"""
    value: str
    vector_clock: Dict[str, int]
    timestamp: float
    node_id: str

class EventuallyConsistentStore:
    """An AP store with eventual consistency (gossip protocol based)

    WHY gossip protocol:
      Broadcasting to all nodes at once results in O(N^2) network load.
      With the gossip protocol, each node propagates information to randomly
      chosen neighbors, so all nodes receive it within O(N log N) rounds
      (derived from epidemiological models).
    """

    def __init__(self, node_id: str, peers: list = None):
        self.node_id = node_id
        self.data: Dict[str, VersionedEntry] = {}
        self.vector_clock: Dict[str, int] = defaultdict(int)
        self.peers: List['EventuallyConsistentStore'] = peers or []
        self.gossip_interval = 1.0

    def write(self, key: str, value: str):
        """Write locally and sync in the background"""
        self.vector_clock[self.node_id] += 1
        entry = VersionedEntry(
            value=value,
            vector_clock=dict(self.vector_clock),
            timestamp=time.time(),
            node_id=self.node_id,
        )
        self.data[key] = entry
        print(f"[{self.node_id}] Write: {key}={value} "
              f"clock={dict(self.vector_clock)}")

    def read(self, key: str) -> Optional[str]:
        """Return local data immediately (may be stale)"""
        entry = self.data.get(key)
        if entry:
            return entry.value
        return None

    def merge(self, key: str, remote_entry: VersionedEntry):
        """Merge with remote data (Last-Writer-Wins)

        WHY LWW:
          The simplest conflict resolution strategy. Adopts the entry with the
          newer timestamp. Drawback: may be inaccurate due to clock skew.
          Alternatives: vector clock comparison, CRDTs, application-specific merge logic.
        """
        local_entry = self.data.get(key)
        if local_entry is None:
            self.data[key] = remote_entry
            return

        # Determine causal relationship using vector clocks
        relation = self._compare_clocks(local_entry.vector_clock,
                                        remote_entry.vector_clock)
        if relation == "before":
            # Local is older → overwrite with remote
            self.data[key] = remote_entry
            print(f"[{self.node_id}] Merge: {key} updated to {remote_entry.value}")
        elif relation == "concurrent":
            # Concurrent writes → resolve with LWW
            if remote_entry.timestamp > local_entry.timestamp:
                self.data[key] = remote_entry
                print(f"[{self.node_id}] Merge (LWW): {key} = {remote_entry.value}")

    def _compare_clocks(self, clock_a: dict, clock_b: dict) -> str:
        """Compare vector clocks

        Returns: "before" | "after" | "concurrent"
        """
        all_keys = set(clock_a.keys()) | set(clock_b.keys())
        a_lte_b = all(clock_a.get(k, 0) <= clock_b.get(k, 0) for k in all_keys)
        b_lte_a = all(clock_b.get(k, 0) <= clock_a.get(k, 0) for k in all_keys)

        if a_lte_b and not b_lte_a:
            return "before"   # A is before B
        elif b_lte_a and not a_lte_b:
            return "after"    # A is after B
        else:
            return "concurrent"  # concurrent (no causal relationship)

    def gossip(self):
        """Propagate data to neighboring nodes via gossip protocol"""
        for peer in self.peers:
            for key, entry in self.data.items():
                peer.merge(key, entry)


# === Demo ===
node_a = EventuallyConsistentStore("nodeA")
node_b = EventuallyConsistentStore("nodeB")
node_a.peers = [node_b]
node_b.peers = [node_a]

# Normal operation: write → sync via gossip
node_a.write("user:1", "Alice")
node_a.gossip()
print(f"nodeB read: {node_b.read('user:1')}")  # → "Alice"

# During partition: both nodes write independently
node_a.peers = []  # Simulate partition
node_b.peers = []
node_a.write("user:1", "Alice_updated_by_A")
time.sleep(0.01)  # Small time difference
node_b.write("user:1", "Alice_updated_by_B")

# Partition healed → merge via gossip
node_a.peers = [node_b]
node_b.peers = [node_a]
node_a.gossip()
node_b.gossip()
# LWW: the entry with the newer timestamp wins
```

### Code Example 3: Quorum Reads and Writes

```python
import time
from typing import Optional, List, Dict

class QuorumStore:
    """Quorum-based reads and writes (Dynamo/Cassandra style)

    WHY quorum:
      For N replicas, require W write acknowledgments + R read acknowledgments.
      When W + R > N, the "overlap" between reads and writes is guaranteed,
      ensuring the latest data is always readable (strong consistency).

    Tradeoffs:
      W=1, R=1 → Fastest but no consistency (eventual consistency)
      W=N, R=1 → Slow writes but fast reads
      W=1, R=N → Fast writes but slow reads
      W=⌊N/2⌋+1, R=⌊N/2⌋+1 → Balanced (most common)
    """

    def __init__(self, n: int, w: int, r: int):
        self.n = n
        self.w = w
        self.r = r
        self.replicas: List[Dict] = [{} for _ in range(n)]
        self.is_strong = (w + r) > n
        print(f"Quorum: N={n}, W={w}, R={r}")
        print(f"Strong consistency: W+R > N → {w}+{r} > {n} = {self.is_strong}")

    def write(self, key: str, value: str) -> bool:
        """Complete when W nodes acknowledge the write"""
        version = time.time()
        success = 0
        for i, replica in enumerate(self.replicas):
            replica[key] = {"value": value, "version": version}
            success += 1
            if success >= self.w:
                remaining = self.n - success
                print(f"Write OK: {key}={value} "
                      f"(ack: {success}/{self.n}, async: {remaining})")
                # Remaining replicas are propagated asynchronously
                return True
        return False

    def read(self, key: str) -> Optional[str]:
        """Read from R nodes and return the latest version"""
        responses = []
        for i, replica in enumerate(self.replicas):
            entry = replica.get(key)
            if entry:
                responses.append(entry)
            if len(responses) >= self.r:
                break

        if not responses:
            return None

        # Return the latest version (foundation of Read Repair)
        latest = max(responses, key=lambda x: x["version"])
        return latest["value"]

    def read_repair(self, key: str):
        """Read Repair: update stale replicas at read time

        WHY Read Repair:
          After fetching the latest value via quorum read, update
          replicas that hold stale values with the latest. This causes
          eventual consistency to converge faster. A key feature of Cassandra.
        """
        # Read from all replicas
        entries = [(i, r.get(key)) for i, r in enumerate(self.replicas)]
        valid = [(i, e) for i, e in entries if e is not None]

        if not valid:
            return

        # Identify the latest version
        latest_idx, latest_entry = max(valid, key=lambda x: x[1]["version"])

        # Update stale replicas
        for i, entry in valid:
            if entry["version"] < latest_entry["version"]:
                self.replicas[i][key] = latest_entry
                print(f"[Read Repair] Replica {i}: "
                      f"{entry['value']} → {latest_entry['value']}")


# === Demo ===
print("=== Strong consistency: W + R > N ===")
strong = QuorumStore(n=3, w=2, r=2)  # 2+2 > 3 → True
strong.write("x", "100")
print(f"Read: {strong.read('x')}")

print("\n=== Eventual consistency: W + R <= N ===")
eventual = QuorumStore(n=3, w=1, r=1)  # 1+1 > 3 → False
eventual.write("x", "200")
print(f"Read: {eventual.read('x')}")

print("\n=== Write-heavy: W=1, R=N ===")
write_fast = QuorumStore(n=3, w=1, r=3)  # 1+3 > 3 → True
write_fast.write("x", "300")
print(f"Read: {write_fast.read('x')}")
```

---

## 4. PACELC Theorem

### 4.1 Extension of CAP

CAP only addresses tradeoffs during partitions, but PACELC also covers **tradeoffs during normal operation when no partition exists**.

### ASCII Diagram 4: The PACELC Theorem

```
  Partition present?
  ├── YES → Choose between A (Availability) vs C (Consistency)
  │         ├── PA: Availability first    (e.g., Cassandra, DynamoDB)
  │         └── PC: Consistency first     (e.g., MongoDB, HBase)
  │
  └── NO (Else) → Choose between L (Latency) vs C (Consistency)
                   ├── EL: Latency first       (e.g., Cassandra, DynamoDB)
                   └── EC: Consistency first   (e.g., MongoDB, HBase)

  Combinations:
  ┌───────────────┬─────────────────────────────────┐
  │ PA/EL         │ Cassandra, DynamoDB, Riak       │
  │               │ → Always prioritizes latency/availability │
  ├───────────────┼─────────────────────────────────┤
  │ PC/EC         │ MongoDB, HBase, Spanner         │
  │               │ → Always prioritizes consistency │
  ├───────────────┼─────────────────────────────────┤
  │ PA/EC         │ Availability during partition, consistency otherwise │
  │               │ → Yahoo PNUTS                   │
  └───────────────┴─────────────────────────────────┘

  WHY PACELC matters:
    CAP only covers the special situation when a partition occurs.
    But in real systems, the vast majority of time has no partitions.
    The L vs C tradeoff during normal operation directly impacts daily performance.
```

### Code Example 4: Configuring Consistency Levels (Cassandra-style)

```python
from enum import Enum

class ConsistencyLevel(Enum):
    ONE = 1           # Complete with 1 node response (fastest, weakest)
    QUORUM = "quorum" # Complete with majority response (balanced)
    ALL = "all"       # Complete with all node responses (strongest, slowest)
    LOCAL_QUORUM = "local_quorum"  # Majority within the local DC
    EACH_QUORUM = "each_quorum"    # Majority within each DC

class CassandraClient:
    """A tool for analyzing Cassandra consistency levels

    WHY configure consistency levels per query:
      Cassandra is an AP system, but consistency levels can be specified per query.
      This allows the same cluster to use "QUORUM reads/writes for account balance"
      and "ONE write for access logs."
    """

    def __init__(self, replication_factor: int = 3):
        self.rf = replication_factor

    def required_responses(self, level: ConsistencyLevel) -> int:
        if level == ConsistencyLevel.ONE:
            return 1
        elif level == ConsistencyLevel.QUORUM:
            return self.rf // 2 + 1
        elif level == ConsistencyLevel.ALL:
            return self.rf
        elif level == ConsistencyLevel.LOCAL_QUORUM:
            return self.rf // 2 + 1
        elif level == ConsistencyLevel.EACH_QUORUM:
            return self.rf // 2 + 1

    def is_strongly_consistent(self, write_cl: ConsistencyLevel,
                                read_cl: ConsistencyLevel) -> bool:
        """Strong consistency if W + R > N"""
        w = self.required_responses(write_cl)
        r = self.required_responses(read_cl)
        return (w + r) > self.rf

    def analyze(self, write_cl: ConsistencyLevel, read_cl: ConsistencyLevel):
        w = self.required_responses(write_cl)
        r = self.required_responses(read_cl)
        strong = self.is_strongly_consistent(write_cl, read_cl)
        latency = "low" if w == 1 and r == 1 else "medium" if w + r <= self.rf + 1 else "high"
        print(f"W={write_cl.name}({w}) + R={read_cl.name}({r}) "
              f"{'>' if strong else '<='} N={self.rf} "
              f"→ {'strong consistency' if strong else 'eventual consistency'} "
              f"(latency: {latency})")

    def recommend(self, use_case: str):
        """Recommended settings per use case"""
        recommendations = {
            "balance": (ConsistencyLevel.QUORUM, ConsistencyLevel.QUORUM,
                       "Account balance: strong consistency required"),
            "log": (ConsistencyLevel.ONE, ConsistencyLevel.ONE,
                   "Access log: prioritize latency, some loss is acceptable"),
            "session": (ConsistencyLevel.LOCAL_QUORUM, ConsistencyLevel.LOCAL_QUORUM,
                       "Session: DC-local consistency is sufficient"),
            "config": (ConsistencyLevel.ALL, ConsistencyLevel.ONE,
                      "Config data: write to all replicas reliably, read fast"),
        }
        if use_case in recommendations:
            w_cl, r_cl, description = recommendations[use_case]
            print(f"\n{description}")
            self.analyze(w_cl, r_cl)


# === Demo ===
client = CassandraClient(replication_factor=3)

print("=== Consistency Level Analysis ===")
client.analyze(ConsistencyLevel.ONE, ConsistencyLevel.ONE)
# W=ONE(1) + R=ONE(1) <= N=3 → eventual consistency (latency: low)

client.analyze(ConsistencyLevel.QUORUM, ConsistencyLevel.QUORUM)
# W=QUORUM(2) + R=QUORUM(2) > N=3 → strong consistency (latency: medium)

client.analyze(ConsistencyLevel.ALL, ConsistencyLevel.ONE)
# W=ALL(3) + R=ONE(1) > N=3 → strong consistency (latency: high)

print("\n=== Recommendations by Use Case ===")
client.recommend("balance")
client.recommend("log")
client.recommend("session")
```

### Code Example 5: Conflict Resolution Strategies

```python
from dataclasses import dataclass
from typing import Any, Callable
import time

@dataclass
class VersionedValue:
    value: Any
    timestamp: float
    node_id: str
    vector_clock: dict

class ConflictResolver:
    """Conflict resolution strategies after partition healing

    WHY multiple resolution strategies are needed:
      The optimal resolution method differs by the nature of the data.
      - Price data → LWW (latest value is correct)
      - Shopping cart → Merge (retain additions from both sides)
      - Counter → CRDTs (mathematically mergeable structure)
      - Order data → Application-specific logic
    """

    @staticmethod
    def last_writer_wins(v1: VersionedValue, v2: VersionedValue) -> VersionedValue:
        """LWW: adopt the entry with the newer timestamp

        Benefit: Simple and easy to implement
        Drawback: Vulnerable to clock skew, data may be silently lost
        Use cases: Sessions, caches, last-update state
        """
        winner = v1 if v1.timestamp > v2.timestamp else v2
        print(f"LWW: {winner.value} wins (from {winner.node_id})")
        return winner

    @staticmethod
    def merge_values(v1: VersionedValue, v2: VersionedValue) -> VersionedValue:
        """Merge: retain both values (useful for shopping carts, etc.)

        Benefit: No data loss
        Drawback: Handling deletions is difficult (requires Tombstones)
        Use cases: Shopping carts, tags, favorites lists
        """
        if isinstance(v1.value, set) and isinstance(v2.value, set):
            merged = v1.value | v2.value
            print(f"Merge: {v1.value} | {v2.value} = {merged}")
            return VersionedValue(merged, time.time(), "merged", {})
        raise ValueError("Merge not supported for non-set values")

    @staticmethod
    def higher_value_wins(v1: VersionedValue, v2: VersionedValue) -> VersionedValue:
        """Adopt the larger numeric value (useful for counters, etc.)

        Use cases: Monotonically increasing counters (e.g., likes count)
        """
        if isinstance(v1.value, (int, float)) and isinstance(v2.value, (int, float)):
            winner = v1 if v1.value >= v2.value else v2
            print(f"Higher wins: {winner.value}")
            return winner
        raise ValueError("Numeric values required")

    @staticmethod
    def application_level(v1: VersionedValue, v2: VersionedValue,
                          resolver: Callable) -> VersionedValue:
        """Resolve with application-specific logic

        Use cases: Complex business rules (order state transitions, etc.)
        """
        return resolver(v1, v2)


# === Demo ===
v1 = VersionedValue("price=100", 1000.001, "node1", {"node1": 1})
v2 = VersionedValue("price=120", 1000.005, "node2", {"node2": 1})
ConflictResolver.last_writer_wins(v1, v2)
# LWW: price=120 wins (from node2)

cart1 = VersionedValue({"itemA", "itemB"}, 1000.0, "node1", {})
cart2 = VersionedValue({"itemB", "itemC"}, 1000.0, "node2", {})
ConflictResolver.merge_values(cart1, cart2)
# Merge: {'itemA', 'itemB'} | {'itemB', 'itemC'} = {'itemA', 'itemB', 'itemC'}

counter1 = VersionedValue(42, 1000.0, "node1", {})
counter2 = VersionedValue(45, 1000.0, "node2", {})
ConflictResolver.higher_value_wins(counter1, counter2)
# Higher wins: 45
```

### Code Example 6: CRDTs (Conflict-free Replicated Data Types)

```python
from collections import defaultdict

class GCounter:
    """G-Counter (Grow-only Counter) - CRDT

    WHY CRDTs:
      A technique that guarantees conflict resolution at the "data structure level."
      Merging in any order is guaranteed to converge all nodes to the same value
      without any special arbitration logic (mathematically proven).

    How G-Counter works:
      Each node holds its own counter, and increments are only applied
      to the local node's counter. The total is the sum of all nodes' counters.
      Merging takes the max of each node → converges regardless of order.
    """

    def __init__(self, node_id: str):
        self.node_id = node_id
        self.counters: dict[str, int] = defaultdict(int)

    def increment(self, amount: int = 1):
        """Increment only this node's counter"""
        self.counters[self.node_id] += amount

    def value(self) -> int:
        """Sum of all nodes' counters"""
        return sum(self.counters.values())

    def merge(self, other: 'GCounter'):
        """Merge: adopt the max of each node (order-independent)"""
        all_keys = set(self.counters.keys()) | set(other.counters.keys())
        for key in all_keys:
            self.counters[key] = max(
                self.counters.get(key, 0),
                other.counters.get(key, 0)
            )

    def __repr__(self):
        return f"GCounter({dict(self.counters)}, total={self.value()})"


class PNCounter:
    """PN-Counter (Positive-Negative Counter) - CRDT

    Extension of G-Counter. Uses two G-Counters: one for increments, one for decrements.
    value = P.value() - N.value()
    """

    def __init__(self, node_id: str):
        self.p = GCounter(node_id)  # for increments
        self.n = GCounter(node_id)  # for decrements

    def increment(self, amount: int = 1):
        self.p.increment(amount)

    def decrement(self, amount: int = 1):
        self.n.increment(amount)

    def value(self) -> int:
        return self.p.value() - self.n.value()

    def merge(self, other: 'PNCounter'):
        self.p.merge(other.p)
        self.n.merge(other.n)


# === Demo ===
print("=== G-Counter (likes count) ===")
node_a = GCounter("A")
node_b = GCounter("B")

node_a.increment(3)  # 3 likes on A
node_b.increment(5)  # 5 likes on B

# During partition → each node counts independently
print(f"A: {node_a}")  # GCounter({'A': 3}, total=3)
print(f"B: {node_b}")  # GCounter({'B': 5}, total=5)

# Partition healed → merge
node_a.merge(node_b)
node_b.merge(node_a)
print(f"After merge A: {node_a}")  # GCounter({'A': 3, 'B': 5}, total=8)
print(f"After merge B: {node_b}")  # GCounter({'A': 3, 'B': 5}, total=8)
# → Regardless of order, both converge to 8

print("\n=== PN-Counter (inventory count) ===")
stock_a = PNCounter("A")
stock_b = PNCounter("B")

stock_a.increment(100)  # 100 units received
stock_a.decrement(3)    # 3 units sold (on A)
stock_b.decrement(5)    # 5 units sold (on B)

stock_a.merge(stock_b)
stock_b.merge(stock_a)
print(f"Stock: {stock_a.value()}")  # 92 (100 - 3 - 5)
```

---

## 5. Comparison Tables

### Comparison Table 1: CAP Classification of Major Databases

| Database | CAP | PACELC | Consistency Model | Use Cases |
|-------------|---------|--------|-------------|-------------|
| PostgreSQL | CA (single node) | PC/EC | Strong consistency | General web, finance |
| MongoDB | CP | PC/EC | Strong consistency (Primary) | Document DB |
| Cassandra | AP | PA/EL | Eventual consistency (configurable) | IoT, time-series |
| DynamoDB | AP | PA/EL | Eventual consistency (configurable) | E-commerce, gaming |
| Google Spanner | CP | PC/EC | Strong consistency | Global finance |
| Redis Cluster | AP | PA/EL | Eventual consistency | Cache |
| etcd | CP | PC/EC | Strong consistency (Raft) | Config management |
| CockroachDB | CP | PC/EC | Strong consistency | Distributed SQL |
| CouchDB | AP | PA/EL | Eventual consistency | Offline sync |
| TiDB | CP | PC/EC | Strong consistency | HTAP |

### Comparison Table 2: Consistency Model Comparison

| Consistency Model | Strength | Latency | Implementation | Suitable Data |
|-------------|------|-----------|--------|-------------|
| Linearizability | Strongest | Highest | Raft, Paxos | Account balance, locks |
| Sequential Consistency | Strong | High | Zab (ZooKeeper) | Config data |
| Causal Consistency | Medium | Medium | Vector clocks | Messaging |
| Read-your-writes | Medium | Medium | Sticky Session | User profiles |
| Eventual Consistency | Weak | Low | Gossip protocol | Access logs, metrics |

### Comparison Table 3: Conflict Resolution Strategy Comparison

| Strategy | Benefits | Drawbacks | Use Cases |
|------|---------|-----------|------|
| Last-Writer-Wins | Simple | Vulnerable to clock skew, data loss | Sessions, caches |
| Vector Clock | Tracks causal relationships | Storage overhead | General purpose |
| CRDTs | Mathematically guaranteed convergence | Limited to supported operations | Counters, sets |
| Merge (Union) | No data loss | Deletion is difficult | Carts, tags |
| Application-specific | Most flexible | Complex to implement | Order state, gaming |

---

## 6. Anti-Patterns

### Anti-Pattern 1: Misinterpreting CAP as "Choose 2 of 3"

```python
# Bad: The mistaken decision of "choosing CA"
class BadDistributedSystem:
    """
    Misconception: "We choose CA. We take consistency and availability and drop partition tolerance."

    Problems:
    1. Network partitions are unavoidable in distributed systems
    2. You cannot "drop" partition tolerance (physically unavoidable)
    3. CA only holds for non-distributed systems (single node)
    """
    def __init__(self):
        # CA holds for a single node, but that is not a distributed system
        self.single_db = "postgresql://single-server:5432/db"

# Good: Correct understanding
class GoodDistributedSystem:
    """
    Correct understanding:
    1. P is not a choice but a premise (partitions will always occur)
    2. During a partition: choose CP (consistency-first) or AP (availability-first)
    3. Additionally, even without partitions, the L vs C tradeoff exists (PACELC)
    4. Best practice is to select consistency levels based on data characteristics
    """
    def __init__(self):
        self.balance_db = "mongodb://..."       # CP: account balance
        self.session_cache = "cassandra://..."  # AP: sessions
        self.log_store = "cassandra://..."      # AP: logs
```

### Anti-Pattern 2: Demanding Strong Consistency for Everything

```python
# Bad: Managing all data with strong consistency because it's a financial system
class BadFinancialSystem:
    def __init__(self):
        # QUORUM reads/writes for all data → overall latency degrades
        self.consistency_level = "QUORUM"

    def get_balance(self, user_id):
        # OK: balance requires strong consistency
        return self.read(f"balance:{user_id}", cl="QUORUM")

    def get_user_preferences(self, user_id):
        # Bad: QUORUM is unnecessary for user preferences
        return self.read(f"prefs:{user_id}", cl="QUORUM")

    def write_access_log(self, log_entry):
        # Bad: QUORUM is unnecessary for access logs (degrades latency)
        return self.write("access_log", log_entry, cl="QUORUM")


# Good: Select consistency levels based on data characteristics
class GoodFinancialSystem:
    """
    Data classification:
    ┌──────────────────┬────────────────────────┐
    │ Data             │ Consistency Level       │
    ├──────────────────┼────────────────────────┤
    │ Account balance  │ Strong consistency (required) │
    │ Transaction history │ Strong consistency (required) │
    │ User preferences │ Eventual consistency OK │
    │ Access logs      │ Eventual consistency OK │
    │ Recommendations  │ Eventual consistency OK │
    └──────────────────┴────────────────────────┘
    """
    def get_balance(self, user_id):
        return self.read(f"balance:{user_id}", cl="QUORUM")

    def get_user_preferences(self, user_id):
        return self.read(f"prefs:{user_id}", cl="ONE")

    def write_access_log(self, log_entry):
        return self.write("access_log", log_entry, cl="ONE")
```

### Anti-Pattern 3: Ignoring the "Eventually" in Eventual Consistency

```
Bad:
Saying "it's eventual consistency, so it'll converge eventually" and not monitoring convergence time.

Problems:
1. User updates profile → does not appear after reload
2. Inventory set to 0 → orders still accepted in other regions
3. Permissions revoked → access still granted for a few minutes

Good:
- Set an SLO for convergence time (e.g., 95% of cases converge within 1 second)
- Implement Read-your-writes consistency (your own updates reflect immediately)
- Use Sticky Session for critical operations
- Optimistic UI updates (immediately display write results on the client side)
```

---

## 7. Practice Exercises

### Exercise 1 (Basics): Calculating Quorums

Calculate the quorum for the following configurations.

```
Problem:
Analyze the following settings for a cluster with N=5 replicas.

1. W=3, R=3 → Is this strong consistency? How many node failures can be tolerated?
2. W=1, R=5 → Is this strong consistency? How does write latency change?
3. W=4, R=2 → Is this strong consistency? How does write availability change?
4. W=1, R=1 → Is this strong consistency? What use cases is it suited for?
5. Find W, R combinations that allow reads and writes even if 3 nodes fail simultaneously.
```

**Expected output:**

```
1. W=3, R=3: 3+3=6 > 5 → Strong consistency
   Writes: can tolerate 5-3=2 node failures
   Reads:  can tolerate 5-3=2 node failures

2. W=1, R=5: 1+5=6 > 5 → Strong consistency
   Write completes with 1 node → ultra-fast
   Read requires all 5 nodes → unreadable if even 1 node is down
   Use case: Write-heavy workloads

3. W=4, R=2: 4+2=6 > 5 → Strong consistency
   Write requires 4 nodes → write fails if 2+ nodes are down
   Read needs only 2 nodes → suited for read-heavy

4. W=1, R=1: 1+1=2 ≤ 5 → Eventual consistency
   Fastest but may read stale data
   Use cases: Logs, metrics, caches

5. 3 nodes down → 2 remaining
   W ≤ 2 and R ≤ 2 and W+R > 5
   → Impossible (maximum W+R=4 ≤ 5)
   → Strong consistency cannot be maintained when 3 nodes fail simultaneously
   → W=2, R=2 allows reads/writes but only with eventual consistency
```

### Exercise 2 (Applied): Conflict Detection and Resolution

Implement code to detect and resolve conflicts in the following scenario.

```python
"""
Scenario: Shopping cart on an e-commerce site

During a partition, the same user's cart was updated on two nodes:
- Node A: User added "Item X" and deleted "Item Y"
- Node B: User added "Item Z"

How should the merge happen after the partition heals?

Requirements:
1. Retain all added items (Union)
2. Correctly apply deleted items (Tombstone)
3. Resolve quantity changes with LWW
"""

# Implement here
```

**Expected output:**

```
Cart before partition: {'itemA': 2, 'itemB': 1}
Node A cart: {'itemA': 2, 'itemX': 1}  (itemB deleted, itemX added)
Node B cart: {'itemA': 2, 'itemB': 1, 'itemZ': 3}  (itemZ added)

Merge result: {'itemA': 2, 'itemX': 1, 'itemZ': 3}
  - itemA: exists in both → retain
  - itemB: deleted on Node A → deletion takes priority
  - itemX: added on Node A → retain
  - itemZ: added on Node B → retain
```

### Exercise 3 (Advanced): Designing a Multi-Region Database

Design a database configuration that satisfies the following requirements.

```
Requirements:
- Regions: Tokyo, Singapore, US East — 3 regions
- Users: 1 million per region, 3 million total
- Data types:
  a) User authentication → Strong consistency required
  b) Shopping cart → Eventual consistency acceptable
  c) Product catalog → Read-heavy, low update frequency
  d) Order data → Strong consistency required
  e) Recommendation data → Eventual consistency acceptable

Design challenges:
1. For each data type, indicate whether to choose CP or AP, along with the reasoning
2. Select the database and explain why
3. Replication method between regions
4. Explain behavior when a partition occurs between Tokyo and Singapore
5. Estimate overall availability
```

**Expected output (summary):**

```
1. CP/AP selection by data type:
   a) Auth: CP (consistency required to prevent unauthorized access)
   b) Cart: AP (availability-first, merge with CRDTs)
   c) Catalog: AP (latency-first, short-TTL caching)
   d) Orders: CP (consistency required to prevent double orders)
   e) Recommendations: AP (stale recommendations are acceptable)

2. Database selection:
   a,d) CockroachDB or Google Spanner (multi-region CP)
   b,e) DynamoDB Global Tables (multi-region AP)
   c)   ElastiCache + CDN (read-optimized)

3. Replication:
   CP data: Synchronous replication (Raft/Paxos)
   AP data: Asynchronous replication + CRDTs

4. Behavior during partition:
   CP: Minority-side regions reject writes, majority side continues
   AP: All regions can read/write, merge after partition heals

5. Availability estimate:
   CP components: 99.99% (automatic failover)
   AP components: 99.999% (all nodes can respond)
   Overall: min(99.99%, 99.999%) × other components
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Configuration file issues | Verify configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace and identify where the issue occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use logging and debuggers to validate hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Called: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Inspect disk and network I/O status
4. **Check concurrent connections**: Review connection pool state

| Problem Type | Diagnostic Tools | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following table summarizes the criteria for making technology choices.

| Criteria | When to prioritize | When it can be compromised |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-critical, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②             │
│                                                 │
│  ② How often do you deploy?                     │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily / multiple times → Go to ③         │
│                                                 │
│  ③ How independent are teams from each other?   │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Tradeoff Analysis

Technical decisions always involve tradeoffs. Analyze from the following perspectives:

**1. Short-term vs Long-term cost**
- The fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term cost and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning cost
- Adopting diverse technologies allows best-fit choices but increases operational cost

**3. Level of abstraction**
- High abstraction enables reuse but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and the problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't strive for perfection (YAGNI principle)
- Gather user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually renovating a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Write Characterization Tests first if existing tests are absent
- Coexist old and new systems behind an API gateway
- Perform data migration incrementally

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environments | 4-6 weeks | Low |
| 3. Migration start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Assign ownership to each team
- Manage shared libraries via Inner Source
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** A system where millisecond-level responses are required

**Optimization points:**
1. Cache strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Applicable Scenarios |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy workloads |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## 8. FAQ

### Q1: Are all NoSQL databases AP systems?

Not at all. MongoDB is CP (guarantees writes to the Primary; the side that loses its Primary during a partition cannot write), and HBase is also CP (ensures consistency via ZooKeeper-based leader election). Cassandra and DynamoDB, on the other hand, are AP but allow consistency level adjustments per query. "NoSQL = AP" is a misconception — the data model (KV/Document/Column/Graph) and CAP properties are independent concepts.

### Q2: Did Google Spanner "break" the CAP theorem?

Spanner is sometimes described as "effectively CA," but strictly speaking it is a CP system. Google's dedicated network (redundant submarine cables, etc.) reduces the probability of partitions to an extreme minimum, and TrueTime (atomic clocks + GPS) enables strong consistency with low latency. The correct understanding is not that it broke the CAP theorem, but that it engineered the probability of P to near zero. A general-purpose company taking the same approach is not realistic.

### Q3: What are problematic cases with eventual consistency?

The classic problem is reading stale data immediately after a write. For example, a user updates their profile picture and sees the old image after reloading the page. Solutions include: (1) Read-your-writes consistency (your own writes are reflected immediately), (2) Sticky Session (routing to the same node), (3) client-side Optimistic UI (immediately reflect write results in the UI and sync later).

### Q4: What are CRDTs? When are they used?

CRDTs (Conflict-free Replicated Data Types) are data structures where conflicts mathematically cannot occur. Merging in any order is guaranteed to converge all replicas to the same value. Examples include G-Counter (increment-only counter), PN-Counter (increment/decrement counter), G-Set (add-only set), and OR-Set (add/remove set). They are used in Riak, Redis (with CRDT support), and Figma's real-time collaborative editing.

### Q5: Why use Saga instead of 2PC (Two-Phase Commit)?

2PC is a classic approach to distributed transactions, but it has problems in microservices: (1) the coordinator becomes a single point of failure (SPOF), (2) participants hold locks continuously, degrading throughput, (3) participants are blocked if the coordinator fails. The Saga pattern has each service execute a local transaction and roll back using a compensating transaction on failure, achieving lock-free, high-availability operation. However, eventual consistency must be accepted.

### Q6: What are vector clocks?

A vector clock is a logical clock for tracking causal relationships between events in a distributed system. Each node holds a vector (dictionary) of "node name → counter" and increments its own counter on each event. By comparing two vector clocks, you can determine whether "A happened before B," "B happened before A," or "A and B are concurrent (no causal relationship)." They are used internally by DynamoDB.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend fully understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| CAP Theorem | Cannot simultaneously satisfy C (Consistency), A (Availability), and P (Partition Tolerance) |
| P is a premise | Partitions are unavoidable in distributed systems. The real choice is CP or AP |
| CP systems | Prioritize consistency during partitions. May reject writes. Examples: MongoDB, etcd |
| AP systems | Prioritize availability during partitions. May return stale data. Examples: Cassandra |
| PACELC | Extended theorem that also considers L vs C tradeoff during normal operation |
| Quorum | Achieve strong consistency with W+R > N. Allows balance tuning |
| Eventual consistency | Accelerate convergence with gossip protocol and Read Repair |
| CRDTs | Conflict-free data structures. Counters, sets, etc. |
| Conflict resolution | Choose from LWW, merge, CRDTs, or application-specific logic |
| Design principle | Select consistency levels based on the nature of the data |

---

## Next Guides to Read

- [DB Scaling](../01-components/04-database-scaling.md) -- Practical replication and sharding
- [Message Queue](../01-components/02-message-queue.md) -- Async processing and eventual consistency
- [Monolith vs Microservices](../02-architecture/00-monolith-vs-microservices.md) -- Distributed transactions and the Saga pattern
- [Reliability](./02-reliability.md) -- Circuit breakers and fault tolerance
- Design Patterns -- Architecture patterns

---

## References

1. Brewer, E. (2012). "CAP Twelve Years Later: How the 'Rules' Have Changed." *IEEE Computer*, 45(2), 23-29. -- Reinterpretation by the CAP theorem's originator
2. Gilbert, S. & Lynch, N. (2002). "Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services." *ACM SIGACT News*, 33(2), 51-59. -- Formal proof of the CAP theorem
3. Abadi, D. (2012). "Consistency Tradeoffs in Modern Distributed Database System Design." *IEEE Computer*, 45(2), 37-42. -- Introduction of the PACELC theorem
4. Kleppmann, M. (2017). *Designing Data-Intensive Applications*, Chapter 9: Consistency and Consensus. O'Reilly Media. -- Explanation of consistency models and consensus algorithms
5. Shapiro, M. et al. (2011). "Conflict-free Replicated Data Types." *SSS 2011*, Springer. -- Original CRDTs paper
