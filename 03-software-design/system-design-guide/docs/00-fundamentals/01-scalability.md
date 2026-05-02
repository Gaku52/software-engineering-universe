# Scalability

> Understand the ability of a system to grow while maintaining performance under increasing load, and master the strategies and implementation patterns for horizontal and vertical scaling.

## What You Will Learn in This Chapter

1. **The essential difference between vertical and horizontal scaling**: Deeply understand the cost curves, limits, and use cases for scale-up vs scale-out, and develop the judgment to choose appropriately
2. **The principles and implementation of stateless design**: Understand at the WHY level why statelessness is a prerequisite for horizontal scaling, and learn concrete implementation patterns (session externalization, Twelve-Factor App)
3. **Designing Auto Scaling**: Understand the differences between target tracking, step, and predictive scaling policies, and be able to configure them in real cloud environments
4. **Data layer scaling strategies**: Get an overview of database scaling techniques that are more difficult than the application layer (Read Replica, sharding, CQRS)
5. **Quantitative evaluation of scalability**: Learn how to evaluate scalability numerically through load testing and benchmarks

---

## Prerequisites

| Prerequisite | Content | Reference Link |
|---------|------|-----------|
| System design fundamentals | Design process, requirements analysis, estimation techniques | [System Design Overview](./00-system-design-overview.md) |
| Networking fundamentals | TCP/IP, HTTP, basic concepts of load balancers | [04-web-and-network](../../../../04-web-and-network/) |
| Database fundamentals | RDBMS, indexes, query optimization | [06-data-and-security](../../../../06-data-and-security/) |
| Cloud fundamentals | Basic AWS/GCP services (EC2, RDS, etc.) | [05-infrastructure](../../../../05-infrastructure/) |
| Design principles | SOLID principles, coupling and cohesion | clean-code-principles: 00-principles |

---

## 1. What Is Scalability?

### 1.1 Definition

Scalability is the **ability of a system to expand while maintaining an acceptable level of performance** in the face of **increasing load** (number of users, data volume, traffic).

```
When load increases 10x:
  Scalable system:     Latency increases slightly (200ms → 250ms)
  Non-scalable system: Latency explodes (200ms → 5000ms) or crashes
```

### 1.2 Why Scalability Matters

Scalability is not "preparation for future problems" — it is a **technical capability directly tied to business success**.

**Historical Examples:**

1. **Twitter (2007-2010)**: The Ruby on Rails monolith could not withstand rapid growth, frequently showing the "Fail Whale." MySQL write bottlenecks made scale-out a two-year ordeal
2. **Instagram (2012)**: Supported 30 million users with just 13 engineers. Succeeded by maintaining a simple architecture (Django + PostgreSQL + Redis) and scaling only where necessary
3. **Pokemon GO (2016)**: DAU hit 50x the projected figure immediately after launch, causing service outages in multiple countries. Google's SRE team intervened to restore service

Lessons from these examples:

```
┌────────────────────────────────────────────────────────────┐
│              Lessons in Scalability                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. "Success" can kill the system                          │
│     → A sudden surge in users is a business success, but   │
│       it can be the greatest technical crisis               │
│                                                            │
│  2. Not everything needs to scale from the start           │
│     → Instagram supported 30M users on a minimal setup     │
│     → What matters is designing for the ability to scale   │
│                                                            │
│  3. Bottlenecks appear in unexpected places                 │
│     → Optimizing without measuring is a waste of time      │
│     → Profiling and monitoring are indispensable           │
│                                                            │
│  4. Scaling is done incrementally                          │
│     → The required tech stack differs entirely at          │
│       DAU 1K → 10K → 100K → 1M → 10M                      │
└────────────────────────────────────────────────────────────┘
```

### 1.3 Three Dimensions of Scalability

Scalability is not a single concept — it must be considered across multiple dimensions.

```python
# Framework for analyzing scalability across three dimensions
class ScalabilityAnalyzer:
    """Analyzes system scalability across three dimensions"""

    def __init__(self, system_name: str):
        self.system_name = system_name
        self.dimensions = {}

    def assess_dimension(self, dimension: str, current: float,
                         target: float, bottleneck: str,
                         strategy: str):
        """Evaluate scalability for each dimension"""
        self.dimensions[dimension] = {
            "current": current,
            "target": target,
            "ratio": target / current if current > 0 else float('inf'),
            "bottleneck": bottleneck,
            "strategy": strategy,
        }

    def report(self) -> str:
        lines = [f"=== {self.system_name} Scalability Analysis ===\n"]
        for dim, data in self.dimensions.items():
            lines.append(f"[{dim}]")
            lines.append(f"  Current: {data['current']:,.0f}")
            lines.append(f"  Target: {data['target']:,.0f}")
            lines.append(f"  Ratio: {data['ratio']:.1f}x")
            lines.append(f"  Bottleneck: {data['bottleneck']}")
            lines.append(f"  Strategy: {data['strategy']}")
            lines.append("")
        return "\n".join(lines)


# Example: Scalability analysis for an e-commerce site
analyzer = ScalabilityAnalyzer("E-Commerce Site")

# 1. Load Scalability
analyzer.assess_dimension(
    "Load Scalability",
    current=1000,          # Current QPS
    target=50000,          # Target QPS
    bottleneck="DB connection limit (max_connections=500)",
    strategy="Introduce Read Replica + connection pooling (PgBouncer)"
)

# 2. Data Scalability
analyzer.assess_dimension(
    "Data Scalability",
    current=500,           # Current data volume (GB)
    target=50000,          # Target data volume (GB)
    bottleneck="Single DB storage limit (16TB) and query performance degradation",
    strategy="Sharding (by user_id) + archiving cold data to S3"
)

# 3. Geographic Scalability
analyzer.assess_dimension(
    "Geographic Scalability",
    current=1,             # Current number of regions
    target=3,              # Target number of regions
    bottleneck="High latency for overseas users on single region (300ms+)",
    strategy="Introduce CDN + multi-region Read Replica + Edge Computing"
)

print(analyzer.report())

# Output:
# === E-Commerce Site Scalability Analysis ===
#
# [Load Scalability]
#   Current: 1,000
#   Target: 50,000
#   Ratio: 50.0x
```

### 1.4 AKF Scale Cube (Three-Axis Scaling Model)

The AKF Scale Cube is a framework proposed by Martin Abbott and Michael Fisher that views scaling along three independent axes.

```
                        Y-axis: Functional Decomposition
                        (Microservices)
                            ^
                           /|
                          / |
                         /  |
                        /   |
                       /    |
                      /     |
                     /      |
                    /       |
                   /        |
                  /─────────/────────────→ X-axis: Horizontal Clone
                 /         /               (Load Balancer + Multiple Instances)
                /         /
               /         /
              ▼         /
             Z-axis: Data Partitioning
             (Sharding)

  ┌──────────────────────────────────────────────────────────┐
  │ X-axis: Horizontal Clone                                  │
  │   Copy the same application across multiple machines      │
  │   Example: 10 App Servers behind a load balancer          │
  │   Effect: Linear improvement in request processing        │
  │   Constraint: DB/cache can become a bottleneck            │
  │                                                          │
  │ Y-axis: Functional Decomposition                          │
  │   Split into independent services by function            │
  │   Example: User service, product service, payment service │
  │   Effect: Enables independent scaling and deployment      │
  │   Constraint: Overhead of inter-service communication     │
  │                                                          │
  │ Z-axis: Data Partitioning                                 │
  │   Split requests by specific data attributes             │
  │   Example: Determine shard by user_id mod N              │
  │   Effect: Scaling for data volume                        │
  │   Constraint: Complexity of cross-shard queries          │
  └──────────────────────────────────────────────────────────┘
```

---

## 2. Vertical Scaling vs Horizontal Scaling

### 2.1 Conceptual Comparison

```
  ■ Vertical Scaling (Scale Up)         ■ Horizontal Scaling (Scale Out)
  ─────────────────────────             ──────────────────────────
  Before:    After:                     Before:      After:
  ┌─────┐   ┌─────────┐                ┌─────┐      ┌─────┐ ┌─────┐ ┌─────┐
  │ 4CPU│   │ 32 CPU  │                │ Srv │      │ Srv │ │ Srv │ │ Srv │
  │ 8GB │   │ 128 GB  │                │  1  │      │  1  │ │  2  │ │  3  │
  │ 1TB │   │ 10 TB   │                └─────┘      └─────┘ └─────┘ └─────┘
  └─────┘   └─────────┘
  (One more powerful machine)           (Multiple similar machines)

  Advantages:                           Advantages:
  - Simple (no app changes needed)      - Theoretically unlimited
  - Simple operations                   - Improved fault tolerance
  - Data consistency preserved          - Linear cost efficiency
                                        - Scale without downtime
  Disadvantages:                        Disadvantages:
  - Physical limits exist               - Complexity of distributed processing
  - Exponentially increasing cost       - Data consistency challenges
  - SPOF (single point of failure)      - Increased operational complexity
```

### 2.2 Cost Curve Simulation

The cost difference between vertical and horizontal scaling widens dramatically as scale increases.

```python
import math

def vertical_scaling_cost(base_cost: float, scale_factor: int) -> float:
    """
    Cost model for vertical scaling

    Why costs increase exponentially:
    1. CPU power consumption increases exponentially with frequency (P ∝ f^3)
    2. High-capacity memory has high manufacturing costs (ECC memory, multi-channel)
    3. High-performance machines have a small market with little competition
    4. Premium pricing due to vendor lock-in

    Example: AWS EC2 instance pricing
    - t3.micro  (2vCPU,  1GB):   $0.0104/h  → baseline
    - t3.xlarge (4vCPU,  16GB):  $0.1664/h  → 16x specs, 16x price
    - r5.4xlarge(16vCPU, 128GB): $1.008/h   → 128x specs, 97x price
    - x1.32xlarge(128vCPU,1952GB):$13.338/h → 1952x specs, 1282x price
    """
    # Exponent based on observed data: approximately 1.6
    return base_cost * (scale_factor ** 1.6)


def horizontal_scaling_cost(base_cost: float, scale_factor: int,
                            overhead_pct: float = 10) -> float:
    """
    Cost model for horizontal scaling

    Why costs are nearly linear:
    1. Adding machines with the same specs keeps unit cost constant
    2. Cloud providers may offer volume discounts
    3. Overhead is fixed (LB, management nodes, etc.)

    Breakdown of overhead_pct:
    - Load balancer: 2-3%
    - Management/monitoring: 2-3%
    - Service discovery: 1-2%
    - Communication overhead: 2-3%
    """
    overhead = 1 + overhead_pct / 100
    return base_cost * scale_factor * overhead


# Cost comparison simulation
base = 1000  # Base cost $1000/month
print("=== Scaling Cost Comparison ===\n")
print(f"{'Factor':>6s}  {'Vertical':>12s}  {'Horizontal':>12s}  "
      f"{'Difference':>12s}  {'Vert/Horiz':>10s}")
print("-" * 65)

for factor in [1, 2, 4, 8, 16, 32, 64, 128]:
    v_cost = vertical_scaling_cost(base, factor)
    h_cost = horizontal_scaling_cost(base, factor)
    ratio = v_cost / h_cost if h_cost > 0 else 0
    print(f"  x{factor:<3d}  ${v_cost:>10,.0f}  ${h_cost:>10,.0f}  "
          f"${v_cost - h_cost:>10,.0f}  {ratio:>8.1f}x")

# Output:
# === Scaling Cost Comparison ===
#
# Factor    Vertical    Horizontal    Difference  Vert/Horiz
# -----------------------------------------------------------------
#   x1       $1,000       $1,100         $-100       0.9x
#   x2       $3,031       $2,200          $831       1.4x
#   x4       $9,190       $4,400        $4,790       2.1x
#   x8      $27,858       $8,800       $19,058       3.2x
#   x16     $84,449      $17,600       $66,849       4.8x
#   x32    $256,000      $35,200      $220,800       7.3x
#   x64    $776,247      $70,400      $705,847      11.0x
#   x128  $2,353,487     $140,800    $2,212,687      16.7x
```

### 2.3 Practical Limits of Vertical Scaling

```python
# Maximum instance sizes by cloud provider (approximate figures as of 2024)
cloud_max_instances = {
    "AWS": {
        "max_vcpu": 448,      # u-24tb1.metal
        "max_memory_gb": 24576,  # 24 TB
        "max_local_storage_tb": 60,
        "cost_per_hour": 218.40,
        "instance_type": "u-24tb1.metal",
        "use_case": "In-memory DB such as SAP HANA",
    },
    "GCP": {
        "max_vcpu": 416,      # m3-megamem-128
        "max_memory_gb": 8192,
        "max_local_storage_tb": 9,
        "cost_per_hour": 125.75,
        "instance_type": "m3-megamem-128",
        "use_case": "Large-scale OLAP",
    },
    "Azure": {
        "max_vcpu": 416,      # M416ms_v2
        "max_memory_gb": 11400,
        "max_local_storage_tb": 14,
        "cost_per_hour": 110.22,
        "instance_type": "M416ms_v2",
        "use_case": "SAP HANA",
    },
}

print("=== Maximum Cloud Instance Sizes ===\n")
for provider, spec in cloud_max_instances.items():
    print(f"  {provider}:")
    print(f"    Instance: {spec['instance_type']}")
    print(f"    vCPU: {spec['max_vcpu']}")
    print(f"    Memory: {spec['max_memory_gb']:,} GB ({spec['max_memory_gb']/1024:.0f} TB)")
    print(f"    Storage: {spec['max_local_storage_tb']} TB")
    print(f"    Cost: ${spec['cost_per_hour']:.2f}/hour "
          f"(${spec['cost_per_hour']*730:,.0f}/month)")
    print(f"    Use case: {spec['use_case']}")
    print()

# Lessons:
# - Even the largest instance tops out at 448 vCPU and 24TB of memory
# - Monthly costs exceed $160,000
# - Horizontal scaling is essential beyond this point
```

### 2.4 Phased Scaling Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│              Phased Scaling Strategy (By DAU)                        │
├────────────┬────────────────────────────────────────────────────────┤
│            │                                                        │
│  DAU < 1K  │  ■ Single server + Managed DB                         │
│            │  ┌─────┐     ┌──────┐                                 │
│            │  │ App │────→│ DB   │                                 │
│            │  └─────┘     └──────┘                                 │
│            │  Cost: ~$50/month                                     │
│            │                                                        │
├────────────┼────────────────────────────────────────────────────────┤
│            │  ■ Multiple App servers + LB + Vertical DB scale      │
│  DAU       │  ┌──┐  ┌─────┐ ┌─────┐     ┌──────┐                 │
│  1K-100K   │  │LB│─→│App 1│ │App 2│────→│ DB↑  │                 │
│            │  └──┘  └─────┘ └─────┘     └──────┘                 │
│            │  + Redis (session + cache)                            │
│            │  Cost: ~$500-2,000/month                              │
│            │                                                        │
├────────────┼────────────────────────────────────────────────────────┤
│            │  ■ App Auto Scaling + DB Read Replica + CDN            │
│  DAU       │  ┌──┐  ┌──────────┐     ┌────────┐ ┌──────────┐     │
│  100K-1M   │  │LB│─→│App x 3-10│────→│Primary │→│Replica x2│     │
│            │  └──┘  └──────────┘     └────────┘ └──────────┘     │
│            │  + CDN + Redis Cluster                                │
│            │  Cost: ~$2,000-10,000/month                           │
│            │                                                        │
├────────────┼────────────────────────────────────────────────────────┤
│            │  ■ Microservices + DB sharding + Multi-layer cache     │
│  DAU       │  ┌──┐  ┌──────────┐  ┌────────────┐                  │
│  1M-10M    │  │LB│─→│Service A │→│DB Shard 1-N│                  │
│            │  │  │─→│Service B │→│Cassandra   │                  │
│            │  │  │─→│Service C │→│Redis Cluster│                  │
│            │  └──┘  └──────────┘  └────────────┘                  │
│            │  + Kafka + Elasticsearch                              │
│            │  Cost: ~$10,000-100,000/month                         │
│            │                                                        │
├────────────┼────────────────────────────────────────────────────────┤
│            │  ■ Multi-region + Custom infrastructure                │
│  DAU > 10M │  ┌──────────────────────────────────┐                 │
│            │  │ Region 1  │  Region 2  │ Region 3│                 │
│            │  │ Full Stack│ Full Stack │Full Stack│                 │
│            │  └──────────────────────────────────┘                 │
│            │  + Global LB + Cross-region replication               │
│            │  Cost: $100,000+/month                                │
└────────────┴────────────────────────────────────────────────────────┘
```

---

## 3. Stateless vs Stateful

### 3.1 Why Statelessness Matters

Stateless design is a **prerequisite** for horizontal scaling. This is because stateful servers restrict which server a request can go to, preventing the load balancer from distributing requests freely.

```
■ Stateful (difficult to scale)

  User A ──────────→ Server 1 (holds session A)
  User B ──────────→ Server 2 (holds session B)
  User C ──────────→ Server 3 (holds session C)

  Problems:
  1. If Server 2 goes down, User B's session is lost
  2. User A must always go to Server 1 (sticky sessions)
  3. Load is not evenly distributed when adding servers
  4. Capacity planning is difficult

■ Stateless (easy to scale)

  User A ─┐         ┌─ Server 1
  User B ─┼── LB ───┼─ Server 2    ← Any server works
  User C ─┘         └─ Server 3

              ↕
        ┌─────────────┐
        │ Shared Store │  (Redis / DB / S3)
        │ Session Data │
        │ User State   │
        │ File Upload  │
        └─────────────┘

  Benefits:
  1. Any server can take over if another goes down
  2. LB can freely round-robin distribute requests
  3. Easy to add/remove servers with Auto Scaling
  4. Easy Blue/Green deployments
```

### 3.2 Implementing a Stateless API Server

```python
from fastapi import FastAPI, Depends, Header, HTTPException
from pydantic import BaseModel
import redis
import json
import uuid
import time
from typing import Optional

app = FastAPI()

# Connection to shared store (Redis)
# All app servers reference the same Redis cluster
redis_client = redis.Redis(
    host="redis-cluster.internal",
    port=6379,
    decode_responses=True,
    # Ensure performance with a connection pool
    connection_pool=redis.ConnectionPool(max_connections=50)
)


# ========================================
# Anti-pattern: Stateful API
# ========================================

# Bad: Sessions stored in memory
sessions_local = {}  # This differs per server!
user_cache_local = {}  # Server 1's cache is not on Server 2

@app.get("/bad/profile")
def bad_get_profile(session_id: str):
    """
    Anti-pattern: Sessions saved to local memory

    Problems:
    1. A session created on Server 1 is invalid on Server 2
    2. Sessions are wiped on server restart
    3. Sticky sessions become necessary, making load distribution uneven
    4. Sessions are lost each time Auto Scaling adds/removes servers
    """
    user = sessions_local.get(session_id)
    if not user:
        return {"error": "session not found"}
    return user


# ========================================
# Best Practice: Stateless API
# ========================================

class SessionManager:
    """
    Stateless session management

    Design principles:
    - Servers hold no state (Shared-Nothing Architecture)
    - All state is stored in an external store (Redis)
    - Only the session ID is returned to the client
    - Automatic cleanup via TTL (expiration)
    """

    def __init__(self, redis_client: redis.Redis,
                 session_ttl: int = 3600):
        self.redis = redis_client
        self.session_ttl = session_ttl  # Default 1 hour

    def create_session(self, user_id: str, user_data: dict) -> str:
        """Create a new session"""
        session_id = str(uuid.uuid4())
        session_data = {
            "user_id": user_id,
            "data": json.dumps(user_data),
            "created_at": time.time(),
        }
        # Save to Redis (with TTL)
        self.redis.hset(f"session:{session_id}", mapping=session_data)
        self.redis.expire(f"session:{session_id}", self.session_ttl)
        return session_id

    def get_session(self, session_id: str) -> Optional[dict]:
        """Retrieve a session (same result from any server)"""
        data = self.redis.hgetall(f"session:{session_id}")
        if not data:
            return None
        # Extend TTL on each access (sliding window)
        self.redis.expire(f"session:{session_id}", self.session_ttl)
        return {
            "user_id": data["user_id"],
            "data": json.loads(data["data"]),
            "created_at": float(data["created_at"]),
        }

    def delete_session(self, session_id: str) -> bool:
        """Delete a session (on logout)"""
        return self.redis.delete(f"session:{session_id}") > 0


session_mgr = SessionManager(redis_client)


@app.get("/good/profile")
def good_get_profile(x_session_id: str = Header(...)):
    """
    Best practice: Sessions stored in Redis

    Returns the same result regardless of which server receives the request.
    Works correctly regardless of the LB algorithm.
    """
    session = session_mgr.get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    return {"user_id": session["user_id"], "profile": session["data"]}


class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/auth/login")
def login(req: LoginRequest):
    """Login: Create a session and return the ID"""
    # In practice, authenticate the user against the DB
    user_data = {"name": req.username, "role": "user"}
    session_id = session_mgr.create_session(req.username, user_data)
    return {"session_id": session_id, "expires_in": 3600}


@app.post("/auth/logout")
def logout(x_session_id: str = Header(...)):
    """Logout: Delete the session"""
    session_mgr.delete_session(x_session_id)
    return {"success": True}

# Example output (when run with curl):
# $ curl -X POST http://localhost:8000/auth/login \
#   -H "Content-Type: application/json" \
#   -d '{"username": "gaku", "password": "secret"}'
# {"session_id": "a1b2c3d4-...", "expires_in": 3600}
#
# $ curl http://localhost:8000/good/profile \
#   -H "X-Session-Id: a1b2c3d4-..."
# {"user_id": "gaku", "profile": {"name": "gaku", "role": "user"}}
```

### 3.3 Stateless Principles in the Twelve-Factor App

```python
# The 12 principles of Twelve-Factor App and their relationship to scalability

twelve_factors = [
    ("I.   Codebase", "One codebase, many deploys",
     "All instances run the same code"),
    ("II.  Dependencies", "Explicitly declare and isolate dependencies",
     "Self-contained via requirements.txt / package.json"),
    ("III. Config", "Store config in the environment",
     "Absorb environment differences via env vars. Don't hardcode DB connections in code"),
    ("IV.  Backing services", "Treat backing services as attached resources",
     "DB/Redis/MQ are external services. Connection target can be switched via URL"),
    ("V.   Build/release/run", "Strictly separate build, release, and run stages",
     "Build artifacts are immutable. Deploy the same image to all servers"),
    ("VI.  Processes", "Execute the app as stateless processes ★Most important★",
     "Do not hold state in memory or the filesystem. Use a shared store"),
    ("VII. Port binding", "Export services via port binding",
     "Self-contained. Listens on a port directly without a reverse proxy"),
    ("VIII.Concurrency", "Scale out via the process model",
     "Horizontal scaling. Distribute load by increasing processes"),
    ("IX.  Disposability", "Maximize robustness with fast startup and graceful shutdown",
     "Enables rapid addition/removal with Auto Scaling"),
    ("X.   Dev/prod parity", "Keep development, staging, and production as similar as possible",
     "Minimize environment differences using Docker, etc."),
    ("XI.  Logs", "Treat logs as event streams",
     "Output to stdout. Aggregation handled by external tools (Fluentd/CloudWatch)"),
    ("XII. Admin processes", "Run admin/management tasks as one-off processes",
     "Migrations, etc. run in the same environment as the regular process"),
]

print("=== Twelve-Factor App and Scalability ===\n")
for factor, description, scalability_note in twelve_factors:
    print(f"  {factor}")
    print(f"    Description: {description}")
    print(f"    Scalability: {scalability_note}")
    print()

# Output:
# === Twelve-Factor App and Scalability ===
#
#   I.   Codebase
#     Description: One codebase, many deploys
#     Scalability: All instances run the same code
#
#   II.  Dependencies
#     Description: Explicitly declare and isolate dependencies
#     Scalability: Self-contained via requirements.txt / package.json
#   ...
```

### 3.4 Worker Design for Horizontal Scaling

```python
import hashlib
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class Task:
    id: str
    payload: dict
    priority: int = 0

class ConsistentHashRing:
    """
    Task distribution using consistent hashing

    Why simple modulo (hash % N) doesn't work:
    - When workers go from N=3 to N=4, almost all task assignments change
    - If there was a cache, it all becomes invalid

    With consistent hashing:
    - When workers go from N=3 to N=4, only about 25% of tasks move
    - Only K/N tasks are reassigned (K=number of tasks, N=new worker count)
    """

    def __init__(self, replicas: int = 150):
        self.replicas = replicas  # Number of virtual nodes per real node
        self.ring = {}            # hash -> node_id
        self.sorted_keys = []     # Sorted hash values

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

    def add_node(self, node_id: str):
        """Add a node to the ring"""
        for i in range(self.replicas):
            virtual_key = f"{node_id}:{i}"
            h = self._hash(virtual_key)
            self.ring[h] = node_id
            self.sorted_keys.append(h)
        self.sorted_keys.sort()

    def remove_node(self, node_id: str):
        """Remove a node from the ring"""
        for i in range(self.replicas):
            virtual_key = f"{node_id}:{i}"
            h = self._hash(virtual_key)
            del self.ring[h]
            self.sorted_keys.remove(h)

    def get_node(self, key: str) -> str:
        """Get the node corresponding to a key"""
        if not self.ring:
            raise ValueError("No nodes in the ring")

        h = self._hash(key)
        # Find the smallest key >= hash value (clockwise)
        for ring_key in self.sorted_keys:
            if ring_key >= h:
                return self.ring[ring_key]
        # Wrap around to the beginning when end is reached
        return self.ring[self.sorted_keys[0]]


# Demo: Measure task redistribution rate when adding a worker
def measure_redistribution():
    """Measure the task redistribution rate when adding a worker"""

    # Prepare 1000 tasks
    tasks = [f"task-{i}" for i in range(1000)]

    # Initial placement with 3 workers
    ring_before = ConsistentHashRing(replicas=150)
    for worker in ["worker-1", "worker-2", "worker-3"]:
        ring_before.add_node(worker)

    assignments_before = {task: ring_before.get_node(task) for task in tasks}

    # Scale up to 4 workers
    ring_after = ConsistentHashRing(replicas=150)
    for worker in ["worker-1", "worker-2", "worker-3", "worker-4"]:
        ring_after.add_node(worker)

    assignments_after = {task: ring_after.get_node(task) for task in tasks}

    # Count redistributed tasks
    moved = sum(1 for task in tasks
                if assignments_before[task] != assignments_after[task])

    print(f"=== Consistent Hashing: Impact of Adding a Worker ===")
    print(f"  Tasks: {len(tasks)}")
    print(f"  Workers: 3 → 4")
    print(f"  Redistributed tasks: {moved} ({moved/len(tasks)*100:.1f}%)")
    print(f"  Theoretical value: {1/4*100:.1f}% (1/N)")
    print()

    # Comparison: simple modulo
    moved_modulo = sum(
        1 for task in tasks
        if (int(hashlib.md5(task.encode()).hexdigest(), 16) % 3 !=
            int(hashlib.md5(task.encode()).hexdigest(), 16) % 4)
    )
    print(f"  Reference: redistribution with modulo: {moved_modulo} "
          f"({moved_modulo/len(tasks)*100:.1f}%)")

measure_redistribution()

# Output:
# === Consistent Hashing: Impact of Adding a Worker ===
#   Tasks: 1000
#   Workers: 3 → 4
#   Redistributed tasks: ~250 (~25.0%)
#   Theoretical value: 25.0% (1/N)
#
#   Reference: redistribution with modulo: ~750 (~75.0%)
```

---

## 4. Auto Scaling

### 4.1 How Auto Scaling Works

```
              ┌──────────────────────────────────────┐
              │         Auto Scaling Controller       │
              │                                      │
              │  ┌──────────┐    ┌───────────────┐   │
              │  │ Monitor  │───→│ Scaling Policy │   │
              │  │ (CPU,QPS,│    │ ・min: 2      │   │
              │  │  Memory, │    │ ・max: 20     │   │
              │  │  Custom) │    │ ・target: 70% │   │
              │  └──────────┘    └───────┬───────┘   │
              └──────────────────────────┼───────────┘
                                         │
            CPU < 30%:  Scale In         │        CPU > 70%:  Scale Out
         ┌──────────────────┐            │     ┌──────────────────────┐
         │ Remove instances │←───────────┼────→│   Add instances      │
         │ (cooldown: 5min) │            │     │   (cooldown: 3min)   │
         └──────────────────┘            │     └──────────────────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          │              │              │
                     ┌────▼──┐     ┌────▼──┐     ┌────▼──┐
                     │Healthy│     │Healthy│     │  New  │
                     │  Srv  │     │  Srv  │     │  Srv  │ ← Newly added
                     └───────┘     └───────┘     └───────┘
```

### 4.2 Types of Scaling Policies and Their Implementation

```python
from enum import Enum
from dataclasses import dataclass
from typing import List, Optional
import time

class ScalingPolicyType(Enum):
    TARGET_TRACKING = "target_tracking"     # Target tracking
    STEP_SCALING = "step_scaling"           # Step scaling
    SCHEDULED = "scheduled"                 # Scheduled scaling
    PREDICTIVE = "predictive"              # Predictive scaling


@dataclass
class ScalingConfig:
    """Auto Scaling configuration"""
    min_capacity: int = 2
    max_capacity: int = 20
    scale_out_cooldown: int = 180   # seconds (wait time after scale-out)
    scale_in_cooldown: int = 300    # seconds (wait time after scale-in)


class TargetTrackingPolicy:
    """
    Target tracking policy (most common)

    How it works:
    - Automatically adjusts instance count to maintain a specific metric at a target value
    - Uses a PID-like mechanism to prevent overshoot

    Advantages:
    - Simple configuration (just specify one target value)
    - AWS automatically creates and manages CloudWatch alarms

    Disadvantages:
    - Can only judge based on a single metric
    - Slow to react to sudden load spikes
    """

    def __init__(self, target_value: float, metric_name: str = "CPUUtilization"):
        self.target_value = target_value
        self.metric_name = metric_name

    def calculate_desired(self, current_instances: int,
                          current_metric: float) -> int:
        """
        Calculate the required number of instances

        Formula: desired = ceil(current_instances * (current_metric / target_metric))
        """
        import math
        desired = math.ceil(
            current_instances * (current_metric / self.target_value)
        )
        return desired


class StepScalingPolicy:
    """
    Step scaling policy

    How it works:
    - Adds/removes instances in steps based on metric values
    - Allows for finer-grained control

    Advantages:
    - Graduated response proportional to load magnitude
    - Multiple steps can be defined

    Disadvantages:
    - Complex configuration
    - Requires tuning to set threshold values between steps
    """

    def __init__(self):
        self.scale_out_steps = []  # (threshold, adjustment)
        self.scale_in_steps = []

    def add_scale_out_step(self, threshold: float, adjustment: int):
        """Add a scale-out step"""
        self.scale_out_steps.append((threshold, adjustment))
        self.scale_out_steps.sort(key=lambda x: x[0])

    def add_scale_in_step(self, threshold: float, adjustment: int):
        """Add a scale-in step"""
        self.scale_in_steps.append((threshold, adjustment))
        self.scale_in_steps.sort(key=lambda x: x[0], reverse=True)

    def calculate_adjustment(self, current_metric: float) -> int:
        """Calculate adjustment count based on metric"""
        # Scale out
        for threshold, adjustment in reversed(self.scale_out_steps):
            if current_metric >= threshold:
                return adjustment

        # Scale in
        for threshold, adjustment in self.scale_in_steps:
            if current_metric <= threshold:
                return adjustment  # Negative value

        return 0  # No change


class AutoScaler:
    """Auto Scaler simulator"""

    def __init__(self, config: ScalingConfig,
                 policy: TargetTrackingPolicy):
        self.config = config
        self.policy = policy
        self.current_instances = config.min_capacity
        self.last_scale_time = 0
        self.history = []

    def evaluate(self, current_metric: float, timestamp: float) -> dict:
        """Make a scaling decision based on the current metric"""
        desired = self.policy.calculate_desired(
            self.current_instances, current_metric)

        # Clamp to min/max range
        desired = max(self.config.min_capacity,
                      min(self.config.max_capacity, desired))

        # Check cooldown period
        elapsed = timestamp - self.last_scale_time
        if desired > self.current_instances:
            cooldown = self.config.scale_out_cooldown
            action = "SCALE_OUT"
        elif desired < self.current_instances:
            cooldown = self.config.scale_in_cooldown
            action = "SCALE_IN"
        else:
            action = "NO_CHANGE"
            cooldown = 0

        can_scale = elapsed >= cooldown or self.last_scale_time == 0

        result = {
            "timestamp": timestamp,
            "metric": current_metric,
            "current": self.current_instances,
            "desired": desired,
            "action": action,
            "can_scale": can_scale,
            "cooldown_remaining": max(0, cooldown - elapsed),
        }

        if can_scale and desired != self.current_instances:
            self.current_instances = desired
            self.last_scale_time = timestamp

        self.history.append(result)
        return result


# Simulation
config = ScalingConfig(min_capacity=2, max_capacity=20)
policy = TargetTrackingPolicy(target_value=70, metric_name="CPUUtilization")
scaler = AutoScaler(config, policy)

# Daily load pattern (CPU utilization %)
# Late night low → morning increase → midday peak → evening peak → night drop
load_pattern = [
    (0, 20), (3, 15), (6, 30), (9, 65), (10, 80),
    (11, 90), (12, 95), (13, 85), (14, 75), (15, 70),
    (16, 60), (17, 80), (18, 90), (19, 85), (20, 70),
    (21, 50), (22, 35), (23, 25),
]

print("=== Auto Scaling Simulation (1 Day) ===\n")
print(f"{'Time':>5s}  {'CPU%':>5s}  {'Curr':>4s}  {'Want':>4s}  "
      f"{'Action':>10s}  {'Status'}")
print("-" * 60)

for hour, cpu in load_pattern:
    timestamp = hour * 3600
    result = scaler.evaluate(cpu, timestamp)
    status = ""
    if not result["can_scale"] and result["action"] != "NO_CHANGE":
        status = f"(CD: {result['cooldown_remaining']:.0f}s)"
    print(f"  {hour:02d}:00  {cpu:>4d}%  {result['current']:>4d}  "
          f"{result['desired']:>4d}  {result['action']:>10s}  {status}")

# Output:
# === Auto Scaling Simulation (1 Day) ===
#
#  Time   CPU%  Curr  Want      Action  Status
# ------------------------------------------------------------
#  00:00    20%     2     2    NO_CHANGE
#  03:00    15%     2     2    NO_CHANGE
#  06:00    30%     2     2    NO_CHANGE
#  09:00    65%     2     2    NO_CHANGE
#  10:00    80%     2     3    SCALE_OUT
#  11:00    90%     3     4    SCALE_OUT
#  12:00    95%     4     6    SCALE_OUT
#  13:00    85%     6     8    SCALE_OUT
#  14:00    75%     8     9    SCALE_OUT
#  15:00    70%     9     9    NO_CHANGE
#  16:00    60%     9     8    SCALE_IN
#  17:00    80%     8    10    SCALE_OUT
#  18:00    90%    10    13    SCALE_OUT
#  19:00    85%    13    16    SCALE_OUT
#  20:00    70%    16    16    NO_CHANGE
#  21:00    50%    16    12    SCALE_IN
#  22:00    35%    12     6    SCALE_IN
#  23:00    25%     6     3    SCALE_IN
```

### 4.3 Auto Scaling Configuration with AWS CDK (Infrastructure as Code)

```python
# Auto Scaling configuration example using AWS CDK (Python)
# Code that can actually be deployed to AWS

"""
from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_autoscaling as autoscaling,
    aws_elasticloadbalancingv2 as elbv2,
    Duration,
)
from constructs import Construct

class ScalableWebServiceStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        # VPC
        vpc = ec2.Vpc(self, "VPC", max_azs=3)

        # Auto Scaling Group
        asg = autoscaling.AutoScalingGroup(
            self, "ASG",
            vpc=vpc,
            instance_type=ec2.InstanceType("t3.medium"),
            machine_image=ec2.AmazonLinuxImage(
                generation=ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
            ),
            min_capacity=2,        # Minimum 2 instances
            max_capacity=20,       # Maximum 20 instances
            desired_capacity=4,    # Initial 4 instances
            health_check=autoscaling.HealthCheck.elb(
                grace=Duration.minutes(5)
            ),
        )

        # Target tracking scaling policy (CPU)
        asg.scale_on_cpu_utilization(
            "CpuScaling",
            target_utilization_percent=70,
            cooldown=Duration.minutes(3),
            estimated_instance_warmup=Duration.minutes(5),
        )

        # Target tracking scaling policy (request count)
        asg.scale_on_request_count(
            "RequestScaling",
            target_requests_per_minute=1000,
            # Target 1000 req/min per instance
        )

        # Step scaling policy (memory)
        asg.scale_on_metric(
            "MemoryScaling",
            metric=asg.metric("MemoryUtilization"),
            scaling_steps=[
                autoscaling.ScalingInterval(upper=30, change=-2),   # Below 30%: remove 2
                autoscaling.ScalingInterval(lower=30, upper=70, change=0),  # Hold steady
                autoscaling.ScalingInterval(lower=70, upper=85, change=2),  # +2 instances
                autoscaling.ScalingInterval(lower=85, change=4),    # Above 85%: +4 instances
            ],
        )

        # Scheduled scaling (for sales events)
        asg.scale_on_schedule(
            "SaleStart",
            schedule=autoscaling.Schedule.cron(
                hour="8", minute="50"  # 10 minutes before sale starts
            ),
            min_capacity=10,
            max_capacity=50,
        )
        asg.scale_on_schedule(
            "SaleEnd",
            schedule=autoscaling.Schedule.cron(
                hour="23", minute="0"
            ),
            min_capacity=2,
            max_capacity=20,
        )

        # ALB
        lb = elbv2.ApplicationLoadBalancer(
            self, "ALB",
            vpc=vpc,
            internet_facing=True,
        )

        listener = lb.add_listener("Listener", port=443)
        listener.add_targets("AppTarget",
            port=8080,
            targets=[asg],
            health_check=elbv2.HealthCheck(
                path="/health",
                interval=Duration.seconds(30),
                healthy_threshold_count=2,
                unhealthy_threshold_count=3,
            ),
        )
"""

# The above is actual AWS CDK code; here we show a simulation summary
print("=== Auto Scaling Configuration Summary ===")
print()
print("  Policy 1: CPU target tracking (70%)")
print("  Policy 2: Request target tracking (1000 req/min per instance)")
print("  Policy 3: Memory step scaling")
print("    - < 30%: -2 instances")
print("    - 30-70%: hold steady")
print("    - 70-85%: +2 instances")
print("    - > 85%: +4 instances")
print("  Policy 4: Schedule (during sale: min=10, max=50)")
print()
print("  * When multiple policies fire simultaneously, the highest instance count is adopted")
```

### 4.4 Validating Scalability with Load Testing

```python
import asyncio
import time
from dataclasses import dataclass, field
from typing import List
import statistics

@dataclass
class LoadTestResult:
    """Load test results"""
    total_requests: int = 0
    success: int = 0
    errors: int = 0
    latencies: List[float] = field(default_factory=list)
    elapsed: float = 0.0

    @property
    def throughput(self) -> float:
        return self.success / self.elapsed if self.elapsed > 0 else 0

    @property
    def p50(self) -> float:
        if not self.latencies:
            return 0
        sorted_lat = sorted(self.latencies)
        return sorted_lat[len(sorted_lat) // 2]

    @property
    def p95(self) -> float:
        if not self.latencies:
            return 0
        sorted_lat = sorted(self.latencies)
        return sorted_lat[int(len(sorted_lat) * 0.95)]

    @property
    def p99(self) -> float:
        if not self.latencies:
            return 0
        sorted_lat = sorted(self.latencies)
        return sorted_lat[int(len(sorted_lat) * 0.99)]

    @property
    def error_rate(self) -> float:
        return self.errors / self.total_requests * 100 if self.total_requests > 0 else 0


async def load_test(url: str, total_requests: int,
                    concurrency: int) -> LoadTestResult:
    """
    Asynchronous HTTP load test

    Usage:
    asyncio.run(load_test("http://localhost:8080/api/health", 10000, 100))

    Parameters:
    - url: The endpoint to test
    - total_requests: Total number of requests
    - concurrency: Number of concurrent requests
    """
    import aiohttp

    semaphore = asyncio.Semaphore(concurrency)
    result = LoadTestResult(total_requests=total_requests)

    async def make_request(session):
        async with semaphore:
            start = time.monotonic()
            try:
                async with session.get(url) as resp:
                    await resp.text()
                    latency = (time.monotonic() - start) * 1000  # ms
                    result.latencies.append(latency)
                    if resp.status == 200:
                        result.success += 1
                    else:
                        result.errors += 1
            except Exception:
                result.errors += 1

    async with aiohttp.ClientSession() as session:
        tasks = [make_request(session) for _ in range(total_requests)]
        start_time = time.monotonic()
        await asyncio.gather(*tasks)
        result.elapsed = time.monotonic() - start_time

    return result


def print_load_test_report(result: LoadTestResult, concurrency: int):
    """Output a load test result report"""
    print("=== Load Test Results ===\n")
    print(f"  Total requests: {result.total_requests:,}")
    print(f"  Concurrency:    {concurrency}")
    print(f"  Elapsed time:   {result.elapsed:.2f}s")
    print(f"  Success:        {result.success:,}")
    print(f"  Errors:         {result.errors:,} ({result.error_rate:.1f}%)")
    print(f"  Throughput:     {result.throughput:,.0f} req/s")
    print(f"  Latency P50:    {result.p50:.1f}ms")
    print(f"  Latency P95:    {result.p95:.1f}ms")
    print(f"  Latency P99:    {result.p99:.1f}ms")

    # SLO evaluation
    print(f"\n  === SLO Evaluation ===")
    slo_latency = 200  # ms
    slo_error_rate = 1  # %
    slo_throughput = 1000  # req/s

    latency_ok = result.p99 < slo_latency
    error_ok = result.error_rate < slo_error_rate
    throughput_ok = result.throughput > slo_throughput

    print(f"  Latency P99 < {slo_latency}ms: "
          f"{'PASS' if latency_ok else 'FAIL'} ({result.p99:.1f}ms)")
    print(f"  Error rate < {slo_error_rate}%: "
          f"{'PASS' if error_ok else 'FAIL'} ({result.error_rate:.1f}%)")
    print(f"  Throughput > {slo_throughput} req/s: "
          f"{'PASS' if throughput_ok else 'FAIL'} ({result.throughput:,.0f} req/s)")

# Usage:
# result = asyncio.run(load_test("http://localhost:8080/api/health", 10000, 100))
# print_load_test_report(result, 100)

# Sample output:
# === Load Test Results ===
#
#   Total requests: 10,000
#   Concurrency:    100
#   Elapsed time:   8.53s
#   Success:        9,950
#   Errors:         50 (0.5%)
#   Throughput:     1,166 req/s
#   Latency P50:    45.2ms
#   Latency P95:    123.7ms
#   Latency P99:    198.3ms
#
#   === SLO Evaluation ===
#   Latency P99 < 200ms: PASS (198.3ms)
#   Error rate < 1%: PASS (0.5%)
#   Throughput > 1000 req/s: PASS (1,166 req/s)
```

---

## 5. Data Layer Scaling

While scaling the application layer (horizontal expansion of stateless servers) is relatively straightforward, scaling the data layer is inherently difficult. This is because databases **hold state**.

### 5.1 The Staircase of Data Layer Scaling

```
  Stages of data layer scaling (ordered by cost/complexity)

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  Level 1: Vertical Scale (simplest)                         │
  │  ┌──────────┐                                               │
  │  │ DB 8CPU  │  → │ DB 32CPU │  → │ DB 128CPU │             │
  │  │ 32GB RAM │    │ 128GB   │    │ 512GB     │             │
  │  └──────────┘                                               │
  │  Limit: Physical ceiling, cost explosion                    │
  │                                                             │
  │  Level 2: Read Replica (distribute reads)                   │
  │  ┌──────────┐    ┌───────────┐                              │
  │  │ Primary  │───→│ Replica 1 │  Distribute reads            │
  │  │ (Write)  │───→│ Replica 2 │  Writes go to Primary only   │
  │  └──────────┘───→│ Replica 3 │                              │
  │                   └───────────┘                              │
  │  Limit: Writes don't scale, replication lag                 │
  │                                                             │
  │  Level 3: Command Query Separation (CQRS)                   │
  │  ┌──────────┐                  ┌───────────┐                │
  │  │ Write DB │  ──(Event)──→   │ Read DB   │                │
  │  │(Normalized)│               │(Denormalized)│              │
  │  └──────────┘                  └───────────┘                │
  │  Write and Read sides fully separated. Optimization is      │
  │  independent for each side.                                 │
  │                                                             │
  │  Level 4: Sharding (data partitioning)                      │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
  │  │ Shard 0  │ │ Shard 1  │ │ Shard 2  │                    │
  │  │ user 0-N │ │user N-2N │ │user 2N-3N│                    │
  │  └──────────┘ └──────────┘ └──────────┘                    │
  │  Limit: Cross-shard queries, complexity of resharding       │
  │                                                             │
  │  Level 5: Distributed Database (NewSQL/NoSQL)               │
  │  ┌─────────────────────────────────────────┐                │
  │  │ CockroachDB / Spanner / TiDB / Cassandra│                │
  │  │ ・Auto-sharding                         │                │
  │  │ ・Distributed transactions              │                │
  │  │ ・Multi-region support                  │                │
  │  └─────────────────────────────────────────┘                │
  └─────────────────────────────────────────────────────────────┘
```

### 5.2 Comparing Sharding Strategies

```python
# Sharding strategy simulation
import hashlib

class ShardingStrategy:
    """Comparison of sharding strategies"""

    @staticmethod
    def range_based(user_id: int, shard_count: int) -> int:
        """
        Range-based sharding

        How it works: Determine shard based on user_id range
        Example: user 1-1M → Shard 0, user 1M-2M → Shard 1, ...

        Advantages: Range queries are efficient
        Disadvantages: Hot spots (new users concentrate on one shard)
        """
        users_per_shard = 1_000_000  # 1 million users per shard
        return min(user_id // users_per_shard, shard_count - 1)

    @staticmethod
    def hash_based(user_id: int, shard_count: int) -> int:
        """
        Hash-based sharding

        How it works: Determine shard based on hash of user_id
        Formula: shard = hash(user_id) % shard_count

        Advantages: Data is evenly distributed
        Disadvantages: Range queries scatter across all shards, resharding is hard
        """
        h = int(hashlib.md5(str(user_id).encode()).hexdigest(), 16)
        return h % shard_count

    @staticmethod
    def directory_based(user_id: int, directory: dict) -> int:
        """
        Directory-based sharding

        How it works: Determine shard using a lookup table (directory)
        Example: Store a user_id → shard_id mapping in the DB

        Advantages: Flexible rebalancing is possible
        Disadvantages: Directory becomes a SPOF, additional lookup latency
        """
        return directory.get(user_id, 0)


# Shard distribution simulation
def simulate_shard_distribution(strategy_name: str, strategy_func,
                                user_count: int, shard_count: int):
    """Verify data distribution for each sharding strategy"""
    distribution = [0] * shard_count

    for user_id in range(user_count):
        shard = strategy_func(user_id, shard_count)
        distribution[shard] += 1

    avg = user_count / shard_count
    max_dev = max(abs(d - avg) / avg * 100 for d in distribution)
    min_count = min(distribution)
    max_count = max(distribution)

    print(f"\n=== {strategy_name} (Users: {user_count:,}, Shards: {shard_count}) ===")
    for i, count in enumerate(distribution):
        bar = "#" * int(count / user_count * 100)
        deviation = (count - avg) / avg * 100
        print(f"  Shard {i}: {count:>8,} ({deviation:>+6.1f}%)  {bar}")
    print(f"  Max deviation: {max_dev:.1f}% (ideal is 0%)")

# Range-based
simulate_shard_distribution(
    "Range-Based", ShardingStrategy.range_based, 3_500_000, 4)

# Hash-based
simulate_shard_distribution(
    "Hash-Based", ShardingStrategy.hash_based, 3_500_000, 4)

# Output:
# === Range-Based (Users: 3,500,000, Shards: 4) ===
#   Shard 0: 1,000,000 (+14.3%)  #############################
#   Shard 1: 1,000,000 (+14.3%)  #############################
#   Shard 2: 1,000,000 (+14.3%)  #############################
#   Shard 3:   500,000 (-42.9%)  ##############
#   Max deviation: 42.9% (ideal is 0%)
#
# === Hash-Based (Users: 3,500,000, Shards: 4) ===
#   Shard 0:   875,123 (+0.0%)   #########################
#   Shard 1:   874,892 (-0.0%)   #########################
#   Shard 2:   875,034 (+0.0%)   #########################
#   Shard 3:   874,951 (-0.0%)   #########################
#   Max deviation: 0.0% (ideal is 0%)
```

---

## 6. Comparison Tables

### Comparison 1: Vertical vs Horizontal Scaling

| Item | Vertical Scaling (Scale Up) | Horizontal Scaling (Scale Out) |
|------|---------------------------|----------------------------|
| Method | Replace with a more powerful machine | Increase the number of machines |
| Cost curve | Exponential (high performance costs disproportionately more) | Linear (proportional to count) |
| Upper limit | Physical ceiling (max 448 vCPU) | Theoretically unlimited |
| Downtime | May occur during replacement | Can roll out with zero downtime |
| Complexity | Low (no app changes required) | High (distributed processing design required) |
| Data consistency | Easy (single DB) | Difficult (distributed consensus required) |
| Fault tolerance | SPOF (one failure stops everything) | Others continue if one fails |
| Best suited for | DB, early-stage startups | Web servers, API servers |
| Not suited for | 1M+ QPS | DAU below 1,000 |
| Example | AWS RDS instance size change | Increasing Pods in ECS/K8s |

### Comparison 2: Scaling Strategy Comparison

| Strategy | How it works | Response speed | Cost efficiency | Best workload |
|------|--------|--------------|-----------|------------------|
| Predictive scaling | ML-based prediction from historical data | Prepared in advance | High | Periodic load patterns |
| Target tracking | Maintains a target metric value | Lag of a few minutes | High | General web apps |
| Step scaling | Staged adjustments based on metric thresholds | Lag of a few minutes | Moderate | High load variability |
| Scheduled | Fixed based on time | Prepared in advance | High | Events and sales |
| Reactive | Fires on metric threshold | Lag of a few minutes | Moderate | Sudden load spikes |
| Manual | Adjusted by hand | Slow | Low | Small scale, experimental environments |

### Comparison 3: Sharding Strategy Comparison

| Strategy | Data distribution | Range queries | Resharding | Implementation complexity | Examples |
|------|----------|-----------|----------------|------------|--------|
| Range-based | Tends to be uneven | Efficient | Relatively easy | Low | HBase, MongoDB |
| Hash-based | Even | Inefficient | Difficult | Moderate | Cassandra, DynamoDB |
| Directory-based | Controllable | Possible | Flexible | High | Custom implementations |
| Consistent hashing | Even | Inefficient | Easy (only K/N move) | High | Amazon DynamoDB |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Premature Horizontal Scaling

```
--- Bad Example ---

Starting with all of the following for a service with DAU 1,000:
- Kubernetes 10-node cluster ($5,000+/month)
- 4 microservices
- Kafka + Redis Cluster + Elasticsearch
- Istio service mesh

Problems:
- Operational cost is 50x+ more than the traffic warrants
- 2 engineers cannot keep up with Kubernetes operations
- Time spent debugging distributed systems halts feature development
- Difficult to identify the cause during incidents ("which service is broken?")

--- Good Example ---

Phased approach:
1. Start with vertical scaling on a single machine (Heroku/Railway/PaaS)
2. Distribute only after measuring the bottleneck
3. Design for scalability, but implement for scale only when needed

Rough guidelines:
- DAU < 10K:  Single server + managed DB
- DAU < 100K: 2-3 App servers + LB + vertical DB scale
- DAU < 1M:   Auto Scaling + Read Replica + Redis
- DAU > 1M:   Consider starting microservices

Jeff Bezos's words:
"Scalability can be added later, but
  the speed of a startup can't be recovered once lost."
```

### Anti-Pattern 2: Horizontally Scaling a Stateful Server

```python
# --- Bad Example ---

class BadUserService:
    """Anti-pattern: Horizontal scaling of a stateful service"""

    def __init__(self):
        self.cache = {}  # Instance-local cache
        self.session_store = {}  # Local sessions

    def get_user(self, user_id: str) -> dict:
        """
        Problems:
        - Data in Server 1's cache is not available on Server 2
        - Relying on sticky sessions limits LB capabilities
        - Cache hit rate drops when adding servers
        - Cache and sessions are completely lost on server failure
        """
        if user_id in self.cache:
            return self.cache[user_id]  # Only exists on Server 1!
        user = {"id": user_id, "name": f"User {user_id}"}
        self.cache[user_id] = user
        return user


# --- Good Example ---

class GoodUserService:
    """Best practice: Stateless service"""

    def __init__(self, redis_client, db_client):
        self.redis = redis_client   # Shared cache
        self.db = db_client         # Shared DB

    def get_user(self, user_id: str) -> dict:
        """
        Returns the same result regardless of which server receives the request

        Cache strategy: Cache-Aside (Lazy Loading)
        1. Return from Redis if cached
        2. Otherwise fetch from DB and cache in Redis
        3. Automatically expires via TTL
        """
        # 1. Check shared cache
        cached = self.redis.get(f"user:{user_id}")
        if cached:
            return json.loads(cached)

        # 2. Fetch from DB
        user = self.db.query(f"SELECT * FROM users WHERE id = %s", user_id)
        if not user:
            return None

        # 3. Save to cache (TTL 5 minutes)
        self.redis.setex(f"user:{user_id}", 300, json.dumps(user))
        return user
```

### Anti-Pattern 3: Infinite Retry Without Scaling

```
--- Bad Example ---

When a service is overloaded, the client retries indefinitely:

Client → (timeout) → Retry → (timeout) → Retry → (timeout) → ...

Problems:
- Timed-out requests + retries double or triple the load
- A "retry storm" takes the service completely down
- Even after restart, the backlog of waiting requests causes an immediate crash

--- Good Example ---

Exponential Backoff + Jitter + Circuit Breaker:

1. Exponential backoff: Increase wait time 1s → 2s → 4s → 8s ...
2. Jitter: Add random delay to prevent simultaneous retries
3. Maximum retry count: Give up after 3-5 attempts
4. Circuit breaker: Block requests entirely when error rate is high

Related: The circuit breaker pattern is explained in detail in [Reliability](./02-reliability.md)
```

### Anti-Pattern 4: Scaling Without Considering Cache

```
--- Bad Example ---

"The DB is slow, so let's add more servers"

   LB → App x 10 → DB (1 instance)

Result: Even with 10 App servers, DB load is unchanged.
        In fact, more DB connections make it even slower.

--- Good Example ---

"The DB is slow, so let's add a cache first"

   LB → App x 3 → Redis → DB (1 instance)

   With an 80% cache hit rate:
   - DB queries drop to 1/5
   - Latency improves from 100ms → 5ms (Redis response time)
   - 3 App servers are now sufficient

Lesson: Cache before scaling.
        Query optimization before caching.
        Indexes before query optimization.

Related: Detailed explanation in [Caching](../01-components/01-caching.md)
```

---

## 8. Practice Exercises

### Exercise 1 (Beginner): Choosing a Scaling Strategy

**Task:** For each of the following 3 scenarios, choose the optimal scaling strategy and explain your reasoning.

```python
# Exercise 1: Choosing a scaling strategy

scenarios = [
    {
        "name": "Internal chat app",
        "dau": 500,
        "peak_qps": 50,
        "data_growth": "10GB/month",
        "budget": "$200/month",
        "team": "1 engineer (part-time)",
    },
    {
        "name": "E-commerce site (10x traffic during sales)",
        "dau": 100_000,
        "peak_qps": 5_000,
        "data_growth": "100GB/month",
        "budget": "$5,000/month",
        "team": "5 engineers",
        "note": "10x normal traffic during 2 major sales per year",
    },
    {
        "name": "Video streaming service",
        "dau": 10_000_000,
        "peak_qps": 500_000,
        "data_growth": "50TB/month",
        "budget": "$500,000/month",
        "team": "50 engineers",
        "note": "Global rollout, 4K video support",
    },
]

# TODO: For each scenario, answer the following
# 1. Recommended architecture (express as a diagram)
# 2. Scaling approach (vertical/horizontal, auto/manual)
# 3. Data layer configuration
# 4. Rough cost breakdown
```

**Example of expected output:**

```
=== Scenario 1: Internal chat app ===

Recommendation: Single server + Managed DB
- App: Heroku Hobby Dyno ($7/month)
- DB: Heroku Postgres Hobby ($0/month)
- WebSocket: Directly on Heroku

Reasoning:
- DAU 500, QPS 50 is well within a single process
- The complexity of horizontal scaling is unnecessary
- A part-time engineer cannot dedicate time to infrastructure operations
- Minimize operational cost with PaaS

Future migration trigger points:
- When DAU exceeds 5,000, scale DB vertically
- When DAU exceeds 50,000, consider App x 2 + LB setup
```

---

### Exercise 2 (Intermediate): Designing an Auto Scaling Policy

**Task:** Design an Auto Scaling policy for a web application with the following workload characteristics.

```python
# Exercise 2: Auto Scaling policy design

workload = {
    "service": "News app API",
    "normal_qps": 2000,
    "peak_qps": 20000,       # During major breaking news
    "morning_spike": 8000,   # Morning commute hours
    "evening_spike": 6000,   # Evening commute hours
    "latency_slo": "P99 < 200ms",
    "error_rate_slo": "< 0.1%",
    "instance_capacity": 500, # Processing capacity per instance (req/s)
}

# TODO: Design the following
# 1. Normal-time scaling policy (target tracking)
# 2. Schedule-based scaling (morning and evening commute hours)
# 3. Response to sudden load (breaking news)
# 4. Cooldown period settings and rationale
# 5. Basis for minimum/maximum instance count decisions
```

**Example of expected output:**

```
=== News App API Auto Scaling Design ===

[Base Settings]
  Minimum instances: 5  (2000 QPS / 500 cap * headroom 1.25 = 5)
  Maximum instances: 50 (20000 QPS / 500 cap * headroom 1.25 = 50)

[Policy 1: Target Tracking (normal times)]
  Metric: ALB RequestCountPerTarget
  Target: 400 req/s per instance (500 * 80% = 400)

[Policy 2: Schedule (commute hours)]
  07:30 → min=17 (8000/500*1.05)
  09:30 → min=5 (back to normal)
  17:00 → min=13 (6000/500*1.05)
  19:00 → min=5

[Policy 3: Sudden load response]
  Step scaling:
  - QPS > 10000: +10 instances
  - QPS > 15000: +20 instances
  - Cooldown: 60 seconds (need rapid response)

[Policy 4: Cooldown]
  Scale-out: 60 seconds (shortened considering the urgency of news)
  Scale-in: 600 seconds (prevent premature scale-in)
```

---

### Exercise 3 (Advanced): Designing Database Sharding

**Task:** Design the sharding of a message table for an SNS service with 10 million DAU.

```python
# Exercise 3: Sharding design

system_spec = {
    "dau": 10_000_000,
    "messages_per_user_per_day": 50,
    "message_size_bytes": 500,
    "retention_years": 5,
    "read_pattern": "Display a user's latest messages in chronological order",
    "write_pattern": "User sends, delivered to group members",
    "query_pattern": [
        "Get latest 100 messages for a specific user (most frequent)",
        "Get all messages in a specific conversation",
        "Full-text search (low frequency)",
    ],
}

# TODO: Design and answer the following
# 1. Shard key selection (why that key, comparison with alternatives)
# 2. Determining shard count (calculation based on data volume)
# 3. Sharding method selection (hash/range/directory)
# 4. Handling cross-shard queries
# 5. Resharding plan (preparing for future data growth)
```

**Example of expected output:**

```
=== Message Table Sharding Design ===

[Data Volume Estimate]
  Per day: 10M * 50 * 500B = 250 GB/day
  Per year: 250 * 365 = 91 TB/year
  5 years: 455 TB

[Shard Key: user_id]
  Reasoning:
  - The most frequent query (user's latest messages) completes within a single shard
  - Writes are also concentrated in one shard per user
  - Message volume disparity between users is relatively small

  Alternatives and reasons for rejection:
  - conversation_id: Good for group chat but inefficient for 1-on-1 chat
  - message_id: Even distribution but fetching all messages for a user scans all shards
  - created_at: Chronological but causes hot spots on the shard with the latest data

[Shard Count: 64]
  Basis: 5-year total 455TB / 8TB per shard = 57 → 64 (power of 2)
  Capacity per shard: ~7.1 TB (with headroom)
```

---

## 9. FAQ

### Q1: Which should I start with, vertical or horizontal?

It is rational to start with vertical scaling in the early stages. The reasons are: (1) no changes to application code required, (2) low operational complexity, and (3) predictable costs.

Signs that you are approaching the vertical limit:
- Single server CPU utilization constantly exceeds 70%
- Monthly cost has exceeded 2x the cost of a horizontal configuration
- The next spec upgrade is close to the physical ceiling
- SPOF risk has become unacceptable

However, **the design should consider horizontal scaling from the start**. Specifically, if you start with stateless design, externalizing configuration, and abstracting DB access, migration becomes smooth.

### Q2: Why is horizontal scaling of databases difficult?

Because databases **hold state**, both data consistency and distributed placement must be reconciled during horizontal scaling.

Specific challenges:
1. **Shard key design**: An inappropriate key causes hot spots or cross-shard queries
2. **Cross-shard queries**: JOIN and aggregate queries that span multiple shards suffer dramatic performance degradation
3. **Distributed transactions**: Two-Phase Commit is slow; Saga pattern is complex
4. **Resharding**: Data redistribution takes a long time and impacts the service
5. **Replication lag**: Sync delays between Primary and Replica cause data inconsistency

Details are covered in [DB Scaling](../01-components/04-database-scaling.md).

### Q3: Does going to microservices automatically improve scalability?

No, not automatically. Microservices enable **independent scaling**, but they introduce the following new complexities:

- Network communication overhead (10-100x latency)
- Managing inter-service dependencies (need for a service mesh)
- Need for distributed tracing (Jaeger/Zipkin)
- Guaranteeing data consistency (distributed transactions or eventual consistency)
- Deployment complexity (CI/CD per service)

Migration to microservices should be considered when "team size > 50 people" and "need for independent deployment" is high.

Details are covered in [Monolith vs Microservices](../02-architecture/00-monolith-vs-microservices.md).

### Q4: Are scalability and performance the same?

They are different concepts.

- **Performance**: How fast can the system process at its current load?
  - "Response time is 50ms for 100 users"
- **Scalability**: How well can performance be maintained as load increases?
  - "Response time stays under 100ms even as users go from 100 to 100,000"

A system that is high performance but doesn't scale (e.g., a highly optimized single server) and a system that is low performance but scales (e.g., slow servers that can be replicated infinitely) are both inadequate. A design that satisfies both is required.

### Q5: Does adding a cache solve scalability problems?

Cache is an important element of scalability, but it is not a "silver bullet."

Cases where cache is effective:
- Reads far outnumber writes (10:1 or more)
- The same data is accessed repeatedly (temporal locality)
- Some delay in data freshness is acceptable

Cases where cache is ineffective:
- Many writes (cache invalidation is frequent)
- Random access patterns (low cache hit rate)
- Strong consistency is required (cached data may be stale)
- Data volume is too large to fit in cache

Details are covered in [Caching](../01-components/01-caching.md).

### Q6: What is the relationship between Amdahl's Law and scalability?

Amdahl's Law states that "even if part of a system is improved, the overall improvement is limited by the parts that cannot be improved."

```python
def amdahls_law(parallel_fraction: float, num_processors: int) -> float:
    """
    Calculate scaling efficiency using Amdahl's Law

    parallel_fraction: Fraction of the system that can be parallelized (0.0 - 1.0)
    num_processors: Number of processors (scaling multiplier)
    """
    serial_fraction = 1 - parallel_fraction
    speedup = 1 / (serial_fraction + parallel_fraction / num_processors)
    return speedup

# Theoretical speedup limits by parallelization ratio
print("=== Amdahl's Law: Limits by Parallelization Ratio ===\n")
print(f"{'Parallel%':>9s}  {'x2':>6s}  {'x4':>6s}  {'x8':>6s}  "
      f"{'x16':>6s}  {'x64':>6s}  {'Limit':>8s}")
print("-" * 60)

for pct in [0.5, 0.75, 0.9, 0.95, 0.99]:
    speedups = [amdahls_law(pct, n) for n in [2, 4, 8, 16, 64]]
    theoretical_max = 1 / (1 - pct)
    print(f"  {pct*100:>5.0f}%  " +
          "  ".join(f"{s:>5.1f}x" for s in speedups) +
          f"  {theoretical_max:>6.1f}x")

# Output:
# === Amdahl's Law: Limits by Parallelization Ratio ===
#
# Parallel%    x2     x4     x8    x16    x64   Limit
# ------------------------------------------------------------
#    50%   1.3x   1.6x   1.8x   1.9x   2.0x    2.0x
#    75%   1.6x   2.3x   2.9x   3.4x   3.8x    4.0x
#    90%   1.8x   3.1x   4.7x   6.4x   8.8x   10.0x
#    95%   1.9x   3.5x   5.9x   9.1x  14.8x   20.0x
#    99%   2.0x   3.9x   7.5x  13.9x  39.3x  100.0x

# Lessons:
# - Even with a 90% parallelization rate, scaling to 64 machines only gives 8.8x speedup
# - The 10% serial portion becomes the bottleneck for the entire system
# - Before scaling, minimize the serial parts (DB, locks, I/O)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Point |
|------|---------|
| Definition of scalability | The ability to expand while maintaining performance under increasing load |
| Three dimensions | Think across three axes: load, data volume, and geographic distribution |
| AKF Scale Cube | Three scaling axes: X-axis (clone), Y-axis (functional decomposition), Z-axis (data partitioning) |
| Vertical scaling | Increase machine specs. Simple but has a ceiling; costs increase exponentially |
| Horizontal scaling | Increase number of machines. No upper limit but design complexity increases |
| Stateless design | Prerequisite for horizontal scaling. Delegate state to an external store |
| Twelve-Factor App | 12 principles for scalable app design. Factor VI is especially important |
| Auto Scaling | 4 types of policies: target tracking / step / scheduled / predictive |
| Data layer scaling | Stages: vertical → Replica → CQRS → sharding → distributed DB |
| Starting strategy | Start with vertical, migrate to horizontal as limits are approached |
| Amdahl's Law | The non-parallelizable fraction determines the theoretical upper limit of scaling |

---

## Next Guides to Read

- [Reliability](./02-reliability.md) -- Balancing scalability and reliability, automatic recovery from failures
- [CAP Theorem](./03-cap-theorem.md) -- Theoretical constraints of distributed systems and design trade-offs
- [Load Balancer](../01-components/00-load-balancer.md) -- The key to horizontal scaling; L4/L7 differences
- [Caching](../01-components/01-caching.md) -- Consider caching strategies before scaling
- [Message Queue](../01-components/02-message-queue.md) -- Load leveling through asynchronous processing
- [DB Scaling](../01-components/04-database-scaling.md) -- Details of data layer scaling strategies
- [Monolith vs Microservices](../02-architecture/00-monolith-vs-microservices.md) -- Decision criteria for architecture choices

### Related Skills

- clean-code-principles -- Code-level design principles. How to write scalable code
  - Coupling and cohesion -- Criteria for service decomposition
- design-patterns-guide -- Patterns related to scalability
  - Repository Pattern -- Abstraction of data access (makes DB migration easier)
  - Event Sourcing / CQRS -- Scaling through read/write separation
  - Observer Pattern -- Foundation of event-driven design

---

## References

1. Kleppmann, M. (2017). *Designing Data-Intensive Applications*, Chapter 1: Reliable, Scalable, and Maintainable Applications. O'Reilly Media. -- Theoretical foundations of scalability
2. Abbott, M.L. & Fisher, M.T. (2015). *The Art of Scalability: Scalable Web Architecture, Processes, and Organizations for the Modern Enterprise*. 3rd Edition. Addison-Wesley. -- Original source of the AKF Scale Cube
3. Hamilton, J. (2007). "On Designing and Deploying Internet-Scale Services." *LISA '07*. -- Practical knowledge for designing large-scale services
4. Amdahl, G.M. (1967). "Validity of the single processor approach to achieving large scale computing capabilities." *AFIPS Conference Proceedings*. -- Original paper on Amdahl's Law
5. Wiggins, A. (2012). "The Twelve-Factor App." -- https://12factor.net/ -- 12 principles for scalable app design
6. AWS Well-Architected Framework - Performance Efficiency Pillar -- https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/ -- AWS scaling best practices
7. Karger, D. et al. (1997). "Consistent Hashing and Random Trees." *STOC '97*. -- Original paper on consistent hashing
8. Dean, J. (2013). "The Tail at Scale." *Communications of the ACM*. -- Relationship between tail latency and scalability
