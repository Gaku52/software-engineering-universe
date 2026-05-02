# System Design Overview

> Systematically learn why and how to design large-scale systems, and acquire a thinking framework applicable to both design interviews and real-world engineering.

## What You Will Learn in This Chapter

1. **The Overall System Design Process**: Understand what questions to ask and what deliverables to produce in each phase of the 4-step process (Clarify Requirements → Estimate → High-Level Design → Deep Dive)
2. **Requirements Analysis Techniques**: Learn how to systematically separate Functional Requirements (FR) from Non-Functional Requirements (NFR), prioritize them, and analyze trade-offs
3. **Structured Approach to Design Interviews**: Acquire practical techniques for earning high marks, including time allocation, how to ask questions, how to draw diagrams, and how to discuss trade-offs
4. **Back-of-the-Envelope Estimation**: Develop the ability to instantly approximate QPS, storage, and bandwidth to support design decisions
5. **How to Write Design Documents**: Learn the structure and key points of design documents (Design Doc / RFC) used in real-world engineering

---

## Prerequisites

The following background knowledge is recommended for effectively learning this guide.

| Prerequisite | Content | Reference |
|---------|------|-----------|
| Computer Networking Basics | Fundamentals of TCP/IP, HTTP, DNS | [04-web-and-network](../../../../04-web-and-network/) |
| Database Basics | Basic concepts of RDBMS, SQL, and indexes | [06-data-and-security](../../../../06-data-and-security/) |
| Programming Basics | Ability to read code in Python or any language | [02-programming](../../../../02-programming/) |
| Software Design Principles | Basics of SOLID, coupling, and cohesion | clean-code-principles: 00-principles |
| Architecture Pattern Basics | Basic concepts of MVC/MVVM and similar patterns | design-patterns-guide: 04-architectural |

---

## 1. What Is System Design?

### 1.1 Definition and Purpose

System design is the activity of defining the **architecture, components, data flows, and interfaces** of a software system that satisfies business requirements. Unlike the ability to simply write code, it requires the skill to derive structures that simultaneously meet **scalability, reliability, and maintainability**.

**Why is system design important?**

The most costly mistakes in software development are "wrong architectural choices." Code-level bugs can be fixed relatively easily, but fundamental architectural changes take months or years and often lead to full system rewrites. Twitter's migration from a Ruby on Rails monolith to JVM-based microservices in 2012 — which took more than two years — is a classic example of an initial design that could not keep pace with growth.

```
Impact Scope and Cost of Fixes:

  Fix Cost (relative value)
    ^
100 │                                           ┌─────┐
    │                                           │Arch-│
    │                                           │itec-│
    │                                           │ture │
    │                                           │     │
 50 │                              ┌─────┐      │     │
    │                              │  DB │      │     │
    │                              │Schema│      │     │
    │                 ┌─────┐      │     │      │     │
 10 │    ┌─────┐      │ API │      │     │      │     │
    │    │Code │      │Design│      │     │      │     │
  1 │    │ Bug │      │     │      │     │      │     │
    └────┴─────┴──────┴─────┴──────┴─────┴──────┴─────┴──→
         Requirements  Design   Implementation  Operations
         Phase         Phase    Phase          Phase
```

### 1.2 The Three Pillars of System Design

When designing large-scale systems, the following three properties must be considered simultaneously.

```
┌──────────────────────────────────────────────────────────────┐
│              The Three Pillars of System Design              │
├──────────────────┬──────────────────┬────────────────────────┤
│  Scalability     │  Reliability     │  Maintainability       │
├──────────────────┼──────────────────┼────────────────────────┤
│ ・Handle load    │ ・Operates under │ ・Easy to change       │
│   growth         │   failures       │ ・Team can understand  │
│ ・Horizontal/    │ ・No data loss   │ ・Easy to test/deploy  │
│   vertical scale │ ・Auto-recovery  │ ・Controlled tech debt │
│ ・Maintain       │                  │                        │
│   latency        │                  │                        │
│ Details:         │ Details:         │ Details:               │
│ → 01-scalability │ → 02-reliability │ → clean-code-principles│
└──────────────────┴──────────────────┴────────────────────────┘
```

### 1.3 At What Scale Does System Design Become Necessary?

Not every system requires large-scale design. The following shows typical configurations by scale.

```python
# Guidelines for architecture decisions based on scale
def recommend_architecture(dau: int, data_gb: float) -> dict:
    """Recommend architecture based on DAU and data volume"""
    if dau < 1_000:
        return {
            "architecture": "Simple Monolith",
            "infra": "Single server (VPS/PaaS)",
            "db": "Single RDBMS (PostgreSQL)",
            "cache": "Not needed (or in-process cache)",
            "deployment": "Manual or simple CI/CD",
            "cost": "~$50/month",
            "team_size": "1-2 engineers",
        }
    elif dau < 100_000:
        return {
            "architecture": "Monolith + partial separation",
            "infra": "Web (x2) + DB (Primary/Replica)",
            "db": "RDBMS + Read Replica",
            "cache": "Redis (single node)",
            "deployment": "CI/CD + Blue/Green",
            "cost": "~$500-2,000/month",
            "team_size": "3-10 engineers",
        }
    elif dau < 10_000_000:
        return {
            "architecture": "Service decomposition (Modular Monolith or Microservices)",
            "infra": "Kubernetes or ECS + Auto Scaling",
            "db": "RDBMS (sharding) + NoSQL",
            "cache": "Redis Cluster + CDN",
            "deployment": "Canary/Rolling + Feature Flags",
            "cost": "~$10,000-100,000/month",
            "team_size": "20-100 engineers",
        }
    else:
        return {
            "architecture": "Microservices + Event-Driven",
            "infra": "Multi-region + Multi-cloud",
            "db": "Distributed DB + Data Lake + CQRS",
            "cache": "Multi-layer cache (L1/L2/CDN)",
            "deployment": "Custom deployment pipeline",
            "cost": "$100,000+/month",
            "team_size": "100+ engineers",
        }

# Example output
for dau in [500, 50_000, 5_000_000, 50_000_000]:
    result = recommend_architecture(dau, dau * 0.001)
    print(f"\n=== DAU: {dau:>12,} ===")
    for k, v in result.items():
        print(f"  {k:20s}: {v}")

# Output:
# === DAU:          500 ===
#   architecture        : Simple Monolith
#   infra               : Single server (VPS/PaaS)
#   db                  : Single RDBMS (PostgreSQL)
#   cache               : Not needed (or in-process cache)
#   deployment          : Manual or simple CI/CD
#   cost                : ~$50/month
#   team_size           : 1-2 engineers
# ... (and so on)
```

---

## 2. The 4-Step Design Process

System design proceeds through the following four steps in order. In practice it is iterative, but in design interviews it is generally approached linearly.

### Overview of the Design Process

```
┌────────────────────────────────────────────────────────────────────────┐
│                  System Design Process: 4 Steps                        │
│                                                                        │
│  Step 1              Step 2              Step 3              Step 4    │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐│
│  │ Clarify  │──────→│ Estimate │──────→│High-Level│──────→│Deep Dive ││
│  │Requirem- │       │          │       │ Design   │       │          ││
│  │  ents    │       │          │       │          │       │          ││
│  └──────────┘       └──────────┘       └──────────┘       └──────────┘│
│                                                                        │
│  Deliverables:       Deliverables:       Deliverables:   Deliverables: │
│  ・FR/NFR list       ・QPS calculation   ・Component      ・API design  │
│  ・Constraints       ・Storage estimate  │ diagram        ・DB design   │
│  ・Scope definition  ・Bandwidth calc.   ・Data flow      ・Failure     │
│                                          ・Tech choices    handling    │
│                                                                        │
│  ←──── Feedback Loop (return to prior steps based on findings) ────→  │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Clarify Requirements

Clarifying requirements is the **most important step** in the design process. Leaving this step ambiguous creates the risk that all subsequent steps will miss the mark.

**Why is requirement clarification the top priority?**

In a design interview, candidates who jump directly into the design without clarifying requirements will almost certainly receive a low score. The reason is that the most fatal failures in real-world engineering stem from "misunderstood requirements." Interviewers are looking for the ability to "discern the essence from ambiguous requirements."

```python
# Framework for clarifying requirements
class RequirementAnalyzer:
    """A framework for systematically organizing requirements"""

    def __init__(self, system_name: str):
        self.system_name = system_name
        self.functional_requirements = []
        self.non_functional_requirements = {}
        self.constraints = []
        self.assumptions = []
        self.out_of_scope = []

    def add_functional(self, requirement: str, priority: str = "must"):
        """Add a functional requirement (classified as must/should/could/won't)"""
        self.functional_requirements.append({
            "requirement": requirement,
            "priority": priority,  # MoSCoW method
        })

    def set_nfr(self, category: str, target: str, rationale: str):
        """Set a non-functional requirement"""
        self.non_functional_requirements[category] = {
            "target": target,
            "rationale": rationale,
        }

    def add_constraint(self, constraint: str):
        """Add a constraint"""
        self.constraints.append(constraint)

    def add_assumption(self, assumption: str):
        """Add an assumption"""
        self.assumptions.append(assumption)

    def add_out_of_scope(self, item: str):
        """Explicitly state what is out of scope"""
        self.out_of_scope.append(item)

    def summary(self) -> str:
        """Output a requirements summary"""
        lines = [f"=== {self.system_name} Requirements Summary ===\n"]

        # Functional requirements (categorized by MoSCoW method)
        lines.append("[Functional Requirements]")
        for priority in ["must", "should", "could", "won't"]:
            items = [r for r in self.functional_requirements
                     if r["priority"] == priority]
            if items:
                label = {"must": "Must Have", "should": "Should Have",
                         "could": "Could Have", "won't": "Won't Have"}[priority]
                lines.append(f"  [{label}]")
                for item in items:
                    lines.append(f"    - {item['requirement']}")

        # Non-functional requirements
        lines.append("\n[Non-Functional Requirements]")
        for category, detail in self.non_functional_requirements.items():
            lines.append(f"  {category}: {detail['target']}")
            lines.append(f"    Rationale: {detail['rationale']}")

        # Constraints
        lines.append("\n[Constraints]")
        for c in self.constraints:
            lines.append(f"  - {c}")

        # Assumptions
        lines.append("\n[Assumptions]")
        for a in self.assumptions:
            lines.append(f"  - {a}")

        # Out of scope
        lines.append("\n[Out of Scope]")
        for o in self.out_of_scope:
            lines.append(f"  - {o}")

        return "\n".join(lines)


# Example: Designing a Twitter-like social network
analyzer = RequirementAnalyzer("Twitter-like SNS")

# Functional requirements (MoSCoW method)
analyzer.add_functional("Post a tweet (text, up to 280 characters)", "must")
analyzer.add_functional("View home timeline", "must")
analyzer.add_functional("Follow/unfollow users", "must")
analyzer.add_functional("Like a tweet", "should")
analyzer.add_functional("Retweet functionality", "should")
analyzer.add_functional("Attach images/videos", "could")
analyzer.add_functional("Direct messages", "won't")  # Out of scope for this design
analyzer.add_functional("Display advertisements", "won't")

# Non-functional requirements
analyzer.set_nfr("Latency", "Timeline display < 200ms (P99)",
                 "Threshold for user experience. Google research shows 200ms+ is felt as delay")
analyzer.set_nfr("Availability", "99.99% (annual downtime < 52 minutes)",
                 "SNS is expected to be always available. 99.9% means 8.7 hours of downtime per year")
analyzer.set_nfr("Scalability", "DAU 300M, peak 2M QPS",
                 "Based on Twitter's track record. Allow headroom for growth")
analyzer.set_nfr("Data Durability", "99.9999999% (9 nines)",
                 "User post data must never be lost")
analyzer.set_nfr("Consistency", "Eventual consistency (within 5 seconds)",
                 "Strong consistency not required. Some delay in the timeline is acceptable")

# Constraints
analyzer.add_constraint("Budget: within $5M in the first year")
analyzer.add_constraint("Team: 20 backend engineers")
analyzer.add_constraint("Existing infrastructure: AWS (migration not possible)")

# Assumptions
analyzer.add_assumption("Of 300M DAU, 20% post per day (60M users)")
analyzer.add_assumption("Average of 200 followees per user")
analyzer.add_assumption("Read-to-write ratio = 100:1")

# Out of scope
analyzer.add_out_of_scope("Direct messaging feature")
analyzer.add_out_of_scope("Ad delivery system")
analyzer.add_out_of_scope("Image/video transcoding")

print(analyzer.summary())

# Output:
# === Twitter-like SNS Requirements Summary ===
#
# [Functional Requirements]
#   [Must Have]
#     - Post a tweet (text, up to 280 characters)
#     - View home timeline
#     - Follow/unfollow users
#   [Should Have]
#     - Like a tweet
#     - Retweet functionality
#   [Could Have]
#     - Attach images/videos
#   [Won't Have]
#     - Direct messages
#     - Display advertisements
#
# [Non-Functional Requirements]
#   Latency: Timeline display < 200ms (P99)
#     Rationale: Threshold for user experience. Google research shows 200ms+ is felt as delay
#   Availability: 99.99% (annual downtime < 52 minutes)
#     Rationale: SNS is expected to be always available. 99.9% means 8.7 hours downtime/year
#   ... (and so on)
```

### Step 2: Back-of-the-Envelope Estimation

Both in design interviews and real-world engineering, the ability to produce quick approximations is tested. Perfect accuracy is not required, but it is critical not to be off by an order of magnitude.

**Why is estimation important?**

Estimation provides the "rationale" for design decisions. Decisions such as "do we need a cache?", "do we need DB sharding?", and "should we use a CDN?" are all made based on rough calculations of QPS, data volume, and bandwidth. Design without estimation is like sailing without a map.

```python
class SystemEstimator:
    """Estimation tool for system design"""

    # Commonly used constants
    SECONDS_PER_DAY = 86_400
    SECONDS_PER_MONTH = 2_592_000  # 30 days
    SECONDS_PER_YEAR = 31_536_000  # 365 days

    def __init__(self, service_name: str, dau: int):
        self.service_name = service_name
        self.dau = dau

    def estimate_qps(self, actions_per_user_per_day: float,
                     read_write_ratio: int = 100,
                     peak_multiplier: float = 3.0) -> dict:
        """Estimate QPS (Queries Per Second)"""
        write_qps = self.dau * actions_per_user_per_day / self.SECONDS_PER_DAY
        read_qps = write_qps * read_write_ratio
        return {
            "avg_write_qps": write_qps,
            "avg_read_qps": read_qps,
            "peak_write_qps": write_qps * peak_multiplier,
            "peak_read_qps": read_qps * peak_multiplier,
        }

    def estimate_storage(self, object_size_bytes: int,
                         objects_per_user_per_day: float,
                         retention_years: int = 5) -> dict:
        """Estimate storage"""
        daily_objects = self.dau * objects_per_user_per_day
        daily_storage = daily_objects * object_size_bytes
        yearly_storage = daily_storage * 365
        total_storage = yearly_storage * retention_years
        return {
            "daily_new_objects": daily_objects,
            "daily_storage_tb": daily_storage / 1e12,
            "yearly_storage_tb": yearly_storage / 1e12,
            "total_storage_tb": total_storage / 1e12,
            "total_storage_pb": total_storage / 1e15,
        }

    def estimate_bandwidth(self, avg_response_size_bytes: int,
                           peak_read_qps: float) -> dict:
        """Estimate bandwidth"""
        bandwidth_bytes = peak_read_qps * avg_response_size_bytes
        return {
            "peak_bandwidth_gbps": bandwidth_bytes * 8 / 1e9,
            "peak_bandwidth_mbps": bandwidth_bytes * 8 / 1e6,
            "monthly_transfer_tb": (bandwidth_bytes * self.SECONDS_PER_MONTH) / 1e12,
        }

    def estimate_memory_for_cache(self, hot_data_percentage: float,
                                  daily_storage_bytes: float) -> dict:
        """Estimate memory required for cache (80/20 rule)"""
        # Typically, 20% of data accounts for 80% of access
        cache_size = daily_storage_bytes * hot_data_percentage
        # Overhead for Redis etc. (roughly 2x)
        actual_memory = cache_size * 2
        return {
            "cache_data_gb": cache_size / 1e9,
            "actual_memory_gb": actual_memory / 1e9,
            "redis_nodes_64gb": max(1, int(actual_memory / (64 * 1e9)) + 1),
        }

    def full_report(self) -> str:
        """Generate a full estimation report"""
        lines = [f"=== {self.service_name} Estimation Report ==="]
        lines.append(f"DAU: {self.dau:,}")

        # QPS
        qps = self.estimate_qps(2, 100, 3)
        lines.append(f"\n[QPS Estimate]")
        lines.append(f"  Avg write: {qps['avg_write_qps']:,.0f} QPS")
        lines.append(f"  Avg read:  {qps['avg_read_qps']:,.0f} QPS")
        lines.append(f"  Peak write: {qps['peak_write_qps']:,.0f} QPS")
        lines.append(f"  Peak read:  {qps['peak_read_qps']:,.0f} QPS")

        # Storage
        storage = self.estimate_storage(560, 2, 5)
        lines.append(f"\n[Storage Estimate]")
        lines.append(f"  New data per day:  {storage['daily_storage_tb']:.2f} TB")
        lines.append(f"  New data per year: {storage['yearly_storage_tb']:.1f} TB")
        lines.append(f"  Total over 5 years: {storage['total_storage_tb']:.1f} TB "
                     f"({storage['total_storage_pb']:.2f} PB)")

        # Bandwidth
        bw = self.estimate_bandwidth(10_000, qps['peak_read_qps'])
        lines.append(f"\n[Bandwidth Estimate]")
        lines.append(f"  Peak bandwidth: {bw['peak_bandwidth_gbps']:.1f} Gbps")
        lines.append(f"  Monthly transfer: {bw['monthly_transfer_tb']:.0f} TB")

        # Cache
        cache = self.estimate_memory_for_cache(
            0.2, storage['daily_storage_tb'] * 1e12)
        lines.append(f"\n[Cache Estimate (hot data 20%)]")
        lines.append(f"  Cache data size: {cache['cache_data_gb']:.1f} GB")
        lines.append(f"  Actual memory needed: {cache['actual_memory_gb']:.1f} GB")
        lines.append(f"  Redis nodes (64GB each): {cache['redis_nodes_64gb']}")

        return "\n".join(lines)


# Example
estimator = SystemEstimator("Twitter-like SNS", 300_000_000)
print(estimator.full_report())

# Output:
# === Twitter-like SNS Estimation Report ===
# DAU: 300,000,000
#
# [QPS Estimate]
#   Avg write: 6,944 QPS
#   Avg read:  694,444 QPS
#   Peak write: 20,833 QPS
#   Peak read:  2,083,333 QPS
#
# [Storage Estimate]
#   New data per day:  0.34 TB
#   New data per year: 122.6 TB
#   Total over 5 years: 613.2 TB (0.61 PB)
#
# [Bandwidth Estimate]
#   Peak bandwidth: 166.7 Gbps
#   Monthly transfer: 54000 TB
#
# [Cache Estimate (hot data 20%)]
#   Cache data size: 67.2 GB
#   Actual memory needed: 134.4 GB
#   Redis nodes (64GB each): 3
```

### Step 3: High-Level Design

In high-level design, you draw the major components of the system and their relationships in a diagram, and clarify data flows.

**Principles for High-Level Design:**

1. **Draw the full path from client to data store**: The entire path from request in to response out
2. **Be able to describe each component's responsibility in one sentence**: If you cannot, the decomposition is inappropriate
3. **Annotate arrows with protocols and data**: HTTP, gRPC, WebSocket, message queue, etc.
4. **Add numbers**: QPS, latency targets, data sizes

### Step 4: Deep Dive

After the high-level design, drill down into the most critical components. In an interview, the interviewer may specify which area to explore, or you can select "the most challenging part" yourself.

**Criteria for selecting Deep Dive targets:**

- Parts likely to become bottlenecks
- Parts most affecting scalability
- Parts requiring data consistency
- Parts with the largest impact when failures occur

---

## 3. Functional Requirements and Non-Functional Requirements

### 3.1 Functional Requirements (FR)

Functional requirements define what a system "does." They can be thought of as a list of "things you can do with this system" from the user's perspective.

```
┌──────────────────────────────────────────────────────────────┐
│              Classification of Functional Requirements       │
├──────────────────┬──────────────────┬────────────────────────┤
│   User Features  │  Admin Features  │  System Features       │
├──────────────────┼──────────────────┼────────────────────────┤
│ ・User signup    │ ・User mgmt      │ ・Send notifications   │
│ ・Login/auth     │ ・Content mgmt   │ ・Batch processing     │
│ ・Post/delete    │ ・Stats dashboard│ ・Data sync            │
│ ・Search         │ ・Permission mgmt│ ・Audit logs           │
│ ・Timeline       │ ・Settings mgmt  │ ・Data export          │
└──────────────────┴──────────────────┴────────────────────────┘
```

### 3.2 Non-Functional Requirements (NFR)

Non-functional requirements define quality characteristics of "how" a system operates. Unlike functional requirements, they are often implicit and tend to be overlooked.

```python
# Systematic organization of non-functional requirements
class NFRFramework:
    """A framework for comprehensively checking non-functional requirements"""

    CATEGORIES = {
        "Performance": {
            "Latency": "Upper bound on response time (P50, P95, P99)",
            "Throughput": "Processing capacity per unit time (QPS/TPS)",
            "Resource Efficiency": "Target CPU/memory/disk utilization",
        },
        "Reliability": {
            "Availability": "Target uptime (99.9%, 99.99%, etc.)",
            "Fault Tolerance": "Behavioral guarantee under failures",
            "Data Durability": "Guarantee against data loss",
            "Disaster Recovery": "RPO (Recovery Point Objective) / RTO (Recovery Time Objective)",
        },
        "Scalability": {
            "Load Handling": "Maximum expected load",
            "Data Growth": "Expected data growth rate",
            "Geographic Expansion": "Need for multi-region support",
        },
        "Security": {
            "Authentication/Authorization": "Auth methods, permission model",
            "Data Protection": "Encryption requirements (at-rest, in-transit)",
            "Compliance": "GDPR, HIPAA, PCI DSS, etc.",
            "Audit": "Operation log retention requirements",
        },
        "Operability": {
            "Monitoring": "Metrics, logs, tracing",
            "Deployment": "Deployment frequency, acceptable downtime",
            "Maintainability": "Code understandability, ease of change",
        },
    }

    @classmethod
    def generate_checklist(cls) -> str:
        """Generate an NFR checklist"""
        lines = ["=== Non-Functional Requirements Checklist ===\n"]
        for category, items in cls.CATEGORIES.items():
            lines.append(f"[ ] {category}")
            for name, description in items.items():
                lines.append(f"    [ ] {name}: {description}")
            lines.append("")
        return "\n".join(lines)

print(NFRFramework.generate_checklist())

# Output:
# === Non-Functional Requirements Checklist ===
#
# [ ] Performance
#     [ ] Latency: Upper bound on response time (P50, P95, P99)
#     [ ] Throughput: Processing capacity per unit time (QPS/TPS)
#     [ ] Resource Efficiency: Target CPU/memory/disk utilization
#
# [ ] Reliability
#     [ ] Availability: Target uptime (99.9%, 99.99%, etc.)
#     [ ] Fault Tolerance: Behavioral guarantee under failures
#     [ ] Data Durability: Guarantee against data loss
#     [ ] Disaster Recovery: RPO / RTO
# ... (and so on)
```

### 3.3 Availability Numbers and Their Meaning

The most frequently encountered non-functional requirement is "availability." The following organizes SLA values and their meaning.

```python
# Relationship between availability and downtime
def availability_table():
    """Calculate downtime for each availability level"""
    print(f"{'Availability':>12s}  {'Annual DT':>12s}  {'Monthly DT':>12s}  {'Weekly DT':>10s}  {'Use Case'}")
    print("-" * 85)

    levels = [
        (99.0,    "Internal tools, dev environments"),
        (99.9,    "General SaaS"),
        (99.95,   "E-commerce sites"),
        (99.99,   "Finance, healthcare"),
        (99.999,  "Telecom infrastructure"),
        (99.9999, "Air traffic control, nuclear"),
    ]

    minutes_per_year = 365.25 * 24 * 60

    for avail, use_case in levels:
        downtime_pct = 100 - avail
        dt_year = minutes_per_year * downtime_pct / 100
        dt_month = dt_year / 12
        dt_week = dt_year / 52

        if dt_year >= 60:
            year_str = f"{dt_year / 60:.1f} hours"
        else:
            year_str = f"{dt_year:.1f} min"

        if dt_month >= 60:
            month_str = f"{dt_month / 60:.1f} hours"
        else:
            month_str = f"{dt_month:.1f} min"

        week_str = f"{dt_week:.1f} min"

        print(f"{avail:>11.4f}%  {year_str:>12s}  {month_str:>12s}  "
              f"{week_str:>10s}  {use_case}")

availability_table()

# Output:
#  Availability      Annual DT      Monthly DT    Weekly DT  Use Case
# -------------------------------------------------------------------------------------
#   99.0000%      87.7 hours      7.3 hours    101.2 min  Internal tools, dev environments
#   99.9000%       8.8 hours      43.8 min      10.1 min  General SaaS
#   99.9500%       4.4 hours      21.9 min       5.1 min  E-commerce sites
#   99.9900%      52.6 min         4.4 min       1.0 min  Finance, healthcare
#   99.9990%       5.3 min         0.4 min       0.1 min  Telecom infrastructure
#   99.9999%       0.5 min         0.0 min       0.0 min  Air traffic control, nuclear
```

### 3.4 Functional Requirements vs. Non-Functional Requirements

| Aspect | Functional Requirements (FR) | Non-Functional Requirements (NFR) |
|------|--------------|-----------------|
| Definition | What the system "does" | How the system "behaves" |
| Examples | User signup, search, posting | Latency, availability, security |
| Description method | Use cases, user stories | SLA/SLO, numeric targets |
| Testing method | Functional testing, E2E testing | Load testing, chaos engineering |
| Change frequency | High (feature additions are common) | Low (foundational requirements) |
| Scope of impact | Limited to specific features | Affects the entire system |
| Risk of being overlooked | Low (explicitly requested) | High (often implicit) |
| Priority decision | Based on business value | Based on technical risk |
| Who defines them | Product managers | Architects / Engineers |

---

## 4. Estimation Techniques in Detail

### 4.1 Memorizing Latency Numbers

In system design, it is extremely important to have an intuitive grasp of the latency of each operation.

```python
# Jeff Dean's latency numbers (modern approximations)
latency_numbers = {
    # Memory operations (nanosecond order)
    "L1 cache reference":                  ("0.5 ns",   0.5),
    "Branch mispredict":                   ("5 ns",     5),
    "L2 cache reference":                  ("7 ns",     7),
    "Mutex lock/unlock":                   ("25 ns",    25),
    "Main memory reference":               ("100 ns",   100),

    # Storage operations (microsecond to millisecond order)
    "SSD random read (4KB)":               ("150 us",   150_000),
    "Read 1 MB sequentially from memory":  ("250 us",   250_000),
    "Read 1 MB sequentially from SSD":     ("1 ms",     1_000_000),
    "Read 1 MB sequentially from HDD":     ("20 ms",    20_000_000),
    "HDD disk seek":                       ("10 ms",    10_000_000),

    # Network operations (millisecond order)
    "Send packet CA → Netherlands → CA":   ("150 ms",   150_000_000),
    "Same datacenter round trip":          ("0.5 ms",   500_000),
    "TCP handshake (same DC)":             ("1.5 ms",   1_500_000),
    "TLS handshake":                       ("10 ms",    10_000_000),
}

# Visual comparison (logarithmic scale)
print("=== Latency Comparison (Logarithmic Scale) ===\n")
for operation, (label, ns) in latency_numbers.items():
    import math
    bar_length = int(math.log10(max(ns, 1)) * 4)
    bar = "#" * bar_length
    print(f"  {operation:45s} {label:>10s}  {bar}")

# Output:
# === Latency Comparison (Logarithmic Scale) ===
#
#   L1 cache reference                          0.5 ns
#   Branch mispredict                             5 ns  ##
#   L2 cache reference                            7 ns  ###
#   Mutex lock/unlock                            25 ns  #####
#   Main memory reference                       100 ns  ########
#   SSD random read (4KB)                       150 us  ####################
#   Read 1 MB sequentially from memory          250 us  #####################
#   Read 1 MB sequentially from SSD               1 ms  ########################
#   Read 1 MB sequentially from HDD              20 ms  #############################
#   HDD disk seek                                10 ms  ############################
#   Send packet CA → Netherlands → CA           150 ms  ################################
#   Same datacenter round trip                  0.5 ms  ######################
#   TCP handshake (same DC)                     1.5 ms  ########################
#   TLS handshake                                10 ms  ############################
```

### 4.2 Powers of 2 Table

```python
# Powers of 2 and data size reference table for design interviews
print("=== Powers of 2 Table ===\n")
print(f"{'Power':>6s}  {'Value':>20s}  {'Byte Unit':>10s}  {'Practical Example'}")
print("-" * 75)

examples = {
    7:  ("128 B",     "One HTTP header"),
    8:  ("256 B",     "Small JSON response"),
    10: ("1 KB",      "Short text"),
    14: ("16 KB",     "Typical HTML page"),
    16: ("64 KB",     "TCP window size"),
    20: ("1 MB",      "One high-quality photo"),
    23: ("8 MB",      "Common cache entry upper limit"),
    25: ("32 MB",     "Short video clip"),
    30: ("1 GB",      "One movie (compressed)"),
    33: ("8 GB",      "Typical server memory"),
    36: ("64 GB",     "Recommended upper limit for one Redis node"),
    40: ("1 TB",      "Large DB data file"),
    50: ("1 PB",      "Enterprise data warehouse"),
}

for power, (size, example) in examples.items():
    print(f"  2^{power:2d}  {2**power:>20,}  {size:>10s}  {example}")

# Output:
#  Power                  Value   Byte Unit  Practical Example
# -----------------------------------------------------------------------
#   2^ 7                   128       128 B  One HTTP header
#   2^ 8                   256       256 B  Small JSON response
#   2^10                 1,024        1 KB  Short text
#   2^14                16,384       16 KB  Typical HTML page
#   2^16                65,536       64 KB  TCP window size
#   2^20             1,048,576        1 MB  One high-quality photo
#   ... (and so on)
```

### 4.3 Practical Estimation: Quick Approximations for Major Services

```python
# Practice producing quick estimates for major web services
services = {
    "URL Shortener": {
        "dau": 100_000_000,
        "writes_per_user_day": 0.1,  # 1 in 10 users shortens a URL
        "reads_per_write": 100,      # each URL gets 100 clicks
        "data_per_record_bytes": 500, # URL + metadata
        "retention_years": 10,
    },
    "Instagram-like Image Sharing": {
        "dau": 500_000_000,
        "writes_per_user_day": 0.5,
        "reads_per_write": 200,
        "data_per_record_bytes": 2_000_000,  # avg 2MB per image
        "retention_years": 99,  # permanent storage
    },
    "Chat App": {
        "dau": 200_000_000,
        "writes_per_user_day": 50,   # 50 messages per day
        "reads_per_write": 5,        # average group chat
        "data_per_record_bytes": 200, # text message
        "retention_years": 5,
    },
}

for name, params in services.items():
    dau = params["dau"]
    write_qps = dau * params["writes_per_user_day"] / 86400
    read_qps = write_qps * params["reads_per_write"]
    daily_storage = dau * params["writes_per_user_day"] * params["data_per_record_bytes"]
    yearly_storage_tb = daily_storage * 365 / 1e12

    print(f"\n=== {name} ===")
    print(f"  DAU: {dau/1e6:.0f}M")
    print(f"  Write QPS: {write_qps:,.0f} (peak: {write_qps*3:,.0f})")
    print(f"  Read QPS:  {read_qps:,.0f} (peak: {read_qps*3:,.0f})")
    print(f"  Annual storage: {yearly_storage_tb:.1f} TB")

# Output:
# === URL Shortener ===
#   DAU: 100M
#   Write QPS: 116 (peak: 347)
#   Read QPS:  11,574 (peak: 34,722)
#   Annual storage: 1.8 TB
#
# === Instagram-like Image Sharing ===
#   DAU: 500M
#   Write QPS: 2,894 (peak: 8,681)
#   Read QPS:  578,704 (peak: 1,736,111)
#   Annual storage: 182,500.0 TB
#
# === Chat App ===
#   DAU: 200M
#   Write QPS: 115,741 (peak: 347,222)
#   Read QPS:  578,704 (peak: 1,736,111)
#   Annual storage: 730.0 TB
```

---

## 5. How to Draw a High-Level Design

### 5.1 Typical Web Application Architecture

```
                           ┌──────────────┐
                           │    Client    │
                           │(Browser/App) │
                           └──────┬───────┘
                                  │ HTTPS
                           ┌──────▼───────┐
                           │     DNS      │
                           │ (Route 53)   │
                           └──────┬───────┘
                                  │ IP resolution
                     ┌────────────▼────────────┐
                     │      CDN (CloudFront)   │
                     │   ・Static file serving │
                     │   ・Edge caching        │
                     └────────────┬────────────┘
                                  │ Dynamic requests (cache miss)
                     ┌────────────▼────────────┐
                     │     Load Balancer (L7)   │
                     │   ・Health checks        │
                     │   ・SSL termination      │
                     │   ・Rate limiting        │
                     └───┬────────┬────────┬───┘
                         │        │        │
                    ┌────▼──┐ ┌──▼────┐ ┌─▼─────┐
                    │App S1 │ │App S2 │ │App S3 │  ← Auto Scaling Group
                    │(API)  │ │(API)  │ │(API)  │
                    └───┬───┘ └───┬───┘ └───┬───┘
                        │        │         │
                   ┌────▼────────▼─────────▼────┐
                   │     Cache Layer (Redis)     │
                   │   ・Sessions               │
                   │   ・Hot data               │
                   │   ・Rate limit counters     │
                   └────────────┬────────────────┘
                                │ (cache miss)
              ┌─────────────────▼──────────────────┐
              │          Data Layer                 │
              │                                    │
              │  ┌──────────┐    ┌──────────────┐  │
              │  │ Primary  │───→│  Replica(s)  │  │
              │  │  (Write) │    │   (Read)     │  │
              │  └──────────┘    └──────────────┘  │
              │                                    │
              │  ┌──────────┐    ┌──────────────┐  │
              │  │  Object  │    │   Search     │  │
              │  │  Storage │    │   (ES/Solr)  │  │
              │  │  (S3)    │    │              │  │
              │  └──────────┘    └──────────────┘  │
              └────────────────────────────────────┘

              ┌────────────────────────────────────┐
              │       Async Processing             │
              │                                    │
              │  ┌──────────┐    ┌──────────────┐  │
              │  │  Message │───→│   Workers    │  │
              │  │  Queue   │    │  (Consumer)  │  │
              │  │ (Kafka)  │    │              │  │
              │  └──────────┘    └──────────────┘  │
              └────────────────────────────────────┘

              ┌────────────────────────────────────┐
              │       Observability                │
              │  ┌──────┐ ┌──────┐ ┌───────────┐  │
              │  │Metrics│ │ Logs │ │  Traces   │  │
              │  │(Prome)│ │(ELK) │ │ (Jaeger)  │  │
              │  └──────┘ └──────┘ └───────────┘  │
              └────────────────────────────────────┘
```

### 5.2 Inter-Component Communication Patterns

```
┌───────────────────────────────────────────────────────────────────┐
│            Inter-Component Communication Patterns                 │
├────────────────┬──────────────┬──────────────┬───────────────────┤
│   Pattern      │  Sync/Async  │  Coupling    │  Use Case         │
├────────────────┼──────────────┼──────────────┼───────────────────┤
│ REST API       │  Sync        │  High        │ CRUD, external API │
│ gRPC           │  Sync/Async  │  High        │ Between microsvcs  │
│ GraphQL        │  Sync        │  Medium      │ Frontend-facing    │
│ Message Queue  │  Async       │  Low         │ Background jobs    │
│ Event Bus      │  Async       │  Very low    │ Event-driven       │
│ WebSocket      │  Bidirection │  Medium      │ Real-time updates  │
│ SSE            │  Server→     │  Low         │ Notifications, feed│
│ Webhook        │  Async       │  Low         │ External integr.   │
└────────────────┴──────────────┴──────────────┴───────────────────┘
```

### 5.3 Time Allocation for Design Interviews

```
■ Recommended time allocation for a 45-minute design interview

  0        5       10       15              35     40    45
  ├────────┼────────┼────────┼───────────────┼──────┼─────┤
  │Require-│Estim-  │High-   │  Deep Dive    │Wrap- │ Q&A │
  │ment    │ation   │Level   │               │  up  │     │
  │Clarif. │        │Design  │               │      │     │
  │  5min  │  5min  │  5min  │    20min      │ 5min │5min │
  └────────┴────────┴────────┴───────────────┴──────┴─────┘
    ↑                ↑                        ↑
    Most important   Draw diagrams here       Discuss scaling
    Fix scope here   Component diagram        bottlenecks here
                     Data flow diagram

■ Checklist for each phase

  [Requirement Clarification 5min]
  □ Narrow core features to 3 or fewer
  □ Confirm DAU and scale
  □ Identify 2-3 key NFRs
  □ Explicitly state what is out of scope

  [Estimation 5min]
  □ Calculate QPS (read/write)
  □ Rough storage estimate
  □ Bandwidth if needed

  [High-Level Design 5min]
  □ Draw major components in a diagram
  □ Show data flow with arrows
  □ Annotate protocols

  [Deep Dive 20min]
  □ Drill into 2-3 most critical areas
  □ API design (endpoints, request/response)
  □ DB schema (tables, indexes)
  □ Discuss trade-offs

  [Wrap-up 5min]
  □ List bottlenecks and mitigation strategies
  □ Future scaling strategy
  □ Metrics to monitor
```

---

## 6. Practical Techniques for Deep Dive

### 6.1 API Design Basics

```python
# Systematic approach to REST API design
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class HttpMethod(Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"

@dataclass
class APIEndpoint:
    """Definition of a REST API endpoint"""
    method: HttpMethod
    path: str
    description: str
    request_body: Optional[dict] = None
    query_params: Optional[dict] = None
    response: Optional[dict] = None
    rate_limit: str = "100 req/min"
    auth_required: bool = True

@dataclass
class APIDesign:
    """API design document"""
    service_name: str
    base_url: str
    version: str = "v1"
    endpoints: list = field(default_factory=list)

    def add_endpoint(self, endpoint: APIEndpoint):
        self.endpoints.append(endpoint)

    def generate_doc(self) -> str:
        lines = [f"=== {self.service_name} API Design ==="]
        lines.append(f"Base URL: {self.base_url}/api/{self.version}\n")

        for ep in self.endpoints:
            lines.append(f"  {ep.method.value:6s} {ep.path}")
            lines.append(f"    Description: {ep.description}")
            lines.append(f"    Auth: {'Required' if ep.auth_required else 'Not required'}")
            lines.append(f"    Rate limit: {ep.rate_limit}")
            if ep.request_body:
                lines.append(f"    Request: {ep.request_body}")
            if ep.query_params:
                lines.append(f"    Query params: {ep.query_params}")
            if ep.response:
                lines.append(f"    Response: {ep.response}")
            lines.append("")

        return "\n".join(lines)


# Example: API design for a Twitter-like SNS
api = APIDesign("Twitter-like SNS", "https://api.example.com")

api.add_endpoint(APIEndpoint(
    method=HttpMethod.POST,
    path="/tweets",
    description="Post a new tweet",
    request_body={"text": "str (max 280)", "media_ids": "list[str] (optional)"},
    response={"tweet_id": "str", "created_at": "datetime"},
    rate_limit="300 req/hour",
))

api.add_endpoint(APIEndpoint(
    method=HttpMethod.GET,
    path="/timeline/home",
    description="Retrieve home timeline",
    query_params={"cursor": "str", "limit": "int (default=20, max=100)"},
    response={"tweets": "list[Tweet]", "next_cursor": "str"},
    rate_limit="450 req/15min",
))

api.add_endpoint(APIEndpoint(
    method=HttpMethod.GET,
    path="/users/{user_id}",
    description="Get user profile",
    response={"user_id": "str", "name": "str", "followers_count": "int"},
    rate_limit="900 req/15min",
))

api.add_endpoint(APIEndpoint(
    method=HttpMethod.POST,
    path="/users/{user_id}/follow",
    description="Follow a user",
    response={"success": "bool"},
    rate_limit="400 req/day",
))

api.add_endpoint(APIEndpoint(
    method=HttpMethod.DELETE,
    path="/tweets/{tweet_id}",
    description="Delete a tweet",
    response={"success": "bool"},
    rate_limit="300 req/hour",
))

print(api.generate_doc())

# Output:
# === Twitter-like SNS API Design ===
# Base URL: https://api.example.com/api/v1
#
#   POST   /tweets
#     Description: Post a new tweet
#     Auth: Required
#     Rate limit: 300 req/hour
#     Request: {'text': 'str (max 280)', 'media_ids': 'list[str] (optional)'}
#     Response: {'tweet_id': 'str', 'created_at': 'datetime'}
# ... (and so on)
```

### 6.2 Database Schema Design

```python
# Framework for DB schema design
class SchemaDesigner:
    """A tool for structuring DB schema design"""

    def __init__(self, db_type: str = "PostgreSQL"):
        self.db_type = db_type
        self.tables = []

    def add_table(self, name: str, columns: list, indexes: list = None,
                  notes: str = ""):
        self.tables.append({
            "name": name,
            "columns": columns,
            "indexes": indexes or [],
            "notes": notes,
        })

    def generate_ddl(self) -> str:
        lines = [f"-- {self.db_type} Schema Definition\n"]
        for table in self.tables:
            lines.append(f"-- {table['notes']}" if table['notes'] else "")
            lines.append(f"CREATE TABLE {table['name']} (")
            col_lines = []
            for col in table['columns']:
                col_lines.append(f"    {col}")
            lines.append(",\n".join(col_lines))
            lines.append(");\n")

            for idx in table['indexes']:
                lines.append(f"CREATE INDEX {idx};")
            lines.append("")
        return "\n".join(lines)


# Schema design for a Twitter-like SNS
schema = SchemaDesigner()

schema.add_table("users", [
    "user_id         BIGINT PRIMARY KEY",
    "username        VARCHAR(15) UNIQUE NOT NULL",
    "email           VARCHAR(255) UNIQUE NOT NULL",
    "display_name    VARCHAR(50) NOT NULL",
    "bio             VARCHAR(160)",
    "followers_count INT DEFAULT 0",
    "following_count INT DEFAULT 0",
    "created_at      TIMESTAMP DEFAULT NOW()",
    "updated_at      TIMESTAMP DEFAULT NOW()",
], indexes=[
    "idx_users_username ON users(username)",
    "idx_users_email ON users(email)",
], notes="User info - DAU 300M → expect ~500M rows")

schema.add_table("tweets", [
    "tweet_id    BIGINT PRIMARY KEY",  # Snowflake ID
    "user_id     BIGINT NOT NULL REFERENCES users(user_id)",
    "text        VARCHAR(280) NOT NULL",
    "media_urls  JSONB",
    "like_count  INT DEFAULT 0",
    "rt_count    INT DEFAULT 0",
    "created_at  TIMESTAMP DEFAULT NOW()",
], indexes=[
    "idx_tweets_user_id_created ON tweets(user_id, created_at DESC)",
    "idx_tweets_created ON tweets(created_at DESC)",
], notes="Tweet body - 600M/day → 219B/year. Sharding required")

schema.add_table("follows", [
    "follower_id   BIGINT NOT NULL REFERENCES users(user_id)",
    "followee_id   BIGINT NOT NULL REFERENCES users(user_id)",
    "created_at    TIMESTAMP DEFAULT NOW()",
    "PRIMARY KEY (follower_id, followee_id)",
], indexes=[
    "idx_follows_followee ON follows(followee_id)",
], notes="Follow relationships - bidirectional indexes are critical")

schema.add_table("timeline_cache", [
    "user_id     BIGINT NOT NULL",
    "tweet_id    BIGINT NOT NULL",
    "author_id   BIGINT NOT NULL",
    "score       FLOAT NOT NULL",  # Ranking score
    "created_at  TIMESTAMP DEFAULT NOW()",
    "PRIMARY KEY (user_id, score DESC, tweet_id)",
], notes="Timeline cache (commonly implemented with Redis)")

print(schema.generate_ddl())

# Output:
# -- PostgreSQL Schema Definition
#
# -- User info - DAU 300M → expect ~500M rows
# CREATE TABLE users (
#     user_id         BIGINT PRIMARY KEY,
#     username        VARCHAR(15) UNIQUE NOT NULL,
#     ...
# );
# CREATE INDEX idx_users_username ON users(username);
# ... (and so on)
```

### 6.3 Methodology for Trade-off Analysis

Discussing trade-offs is the most highly evaluated part of system design. Rather than choosing the "correct" answer, what is tested is the **ability to enumerate options and logically compare the pros and cons of each**.

```
The Trade-off Triangle:

              Performance
                /\
               /  \
              /    \
             / Best \
            / solution\
           /  lies in  \
          /  the center \
         /_______________\
   Cost                  Reliability

  It is impossible to maximize all three simultaneously
  → Balance according to business requirements
```

```python
# Structured framework for trade-off analysis
class TradeoffAnalysis:
    """A tool for systematically analyzing design trade-offs"""

    def __init__(self, decision: str):
        self.decision = decision
        self.options = []

    def add_option(self, name: str, pros: list, cons: list,
                   cost: str, complexity: str, when_to_use: str):
        self.options.append({
            "name": name,
            "pros": pros,
            "cons": cons,
            "cost": cost,
            "complexity": complexity,
            "when_to_use": when_to_use,
        })

    def analyze(self) -> str:
        lines = [f"=== Trade-off Analysis: {self.decision} ===\n"]
        for i, opt in enumerate(self.options, 1):
            lines.append(f"[Option {i}] {opt['name']}")
            lines.append(f"  Pros:")
            for p in opt['pros']:
                lines.append(f"    + {p}")
            lines.append(f"  Cons:")
            for c in opt['cons']:
                lines.append(f"    - {c}")
            lines.append(f"  Cost: {opt['cost']}")
            lines.append(f"  Complexity: {opt['complexity']}")
            lines.append(f"  When to use: {opt['when_to_use']}")
            lines.append("")
        return "\n".join(lines)


# Trade-off analysis for timeline delivery approach
analysis = TradeoffAnalysis("Timeline Delivery Strategy")

analysis.add_option(
    "Fan-out on Write (Push Model)",
    pros=[
        "Fast timeline reads (pre-computed)",
        "Can handle high read QPS",
        "Simple implementation on the read side",
    ],
    cons=[
        "Large number of writes when a user with many followers posts",
        "Write QPS explodes when a celebrity (1M followers) posts",
        "High storage cost (stores each user's timeline)",
    ],
    cost="Storage: high, Compute: concentrated at write time",
    complexity="Medium",
    when_to_use="Services with a low follower count ceiling; when reads far outnumber writes",
)

analysis.add_option(
    "Fan-out on Read (Pull Model)",
    pros=[
        "Lightweight writes (only write to own feed)",
        "Load stays balanced even for celebrity tweets",
        "Storage efficient",
    ],
    cons=[
        "Must aggregate posts from all followees at read time",
        "High latency (real-time aggregation)",
        "Slow reads for users who follow many people",
    ],
    cost="Storage: low, Compute: concentrated at read time",
    complexity="Medium",
    when_to_use="When write QPS is very high; when followee count is small",
)

analysis.add_option(
    "Hybrid Approach (Twitter's actual method)",
    pros=[
        "Optimized: push for regular users, pull for celebrities",
        "Enjoys the benefits of both approaches",
        "Proven in practice by Twitter",
    ],
    cons=[
        "Complex implementation (managing two paths)",
        "Requires defining a threshold for 'celebrity'",
        "Difficult to debug",
    ],
    cost="Storage: medium, Compute: distributed",
    complexity="High",
    when_to_use="Large-scale SNS with high variance in follower counts",
)

print(analysis.analyze())

# Output:
# === Trade-off Analysis: Timeline Delivery Strategy ===
#
# [Option 1] Fan-out on Write (Push Model)
#   Pros:
#     + Fast timeline reads (pre-computed)
#     + Can handle high read QPS
#     + Simple implementation on the read side
#   Cons:
#     - Large number of writes when a user with many followers posts
#     ... (and so on)
```

---

## 7. How to Write a Design Document (Design Doc)

In real-world engineering, designs are documented to build consensus. Major tech companies such as Google, Meta, and Amazon have a culture of writing design documents called "Design Docs" or "RFCs."

### 7.1 Design Doc Template

```python
# Generate a template for a design document
class DesignDocTemplate:
    """Template for a Design Doc / RFC"""

    SECTIONS = [
        ("1. Title and Metadata", [
            "Project name",
            "Author(s)",
            "Reviewer(s)",
            "Status (Draft / In Review / Approved / Implemented / Deprecated)",
            "Last updated date",
        ]),
        ("2. Summary", [
            "Describe in one paragraph what, why, and how this solves the problem",
            "Write at a level understandable to non-technical readers",
        ]),
        ("3. Background and Motivation", [
            "Why is this design needed?",
            "What are the current problems?",
            "What is the business impact?",
        ]),
        ("4. Requirements", [
            "Functional requirements (Must/Should/Could/Won't)",
            "Non-functional requirements (performance, availability, security, etc.)",
            "Constraints",
        ]),
        ("5. Proposed Design", [
            "Architecture diagram",
            "Component descriptions",
            "API design",
            "Data model / schema",
            "Key sequence diagrams",
        ]),
        ("6. Alternatives Considered", [
            "Other approaches considered and reasons for rejection",
            "※ Include at least 2 alternatives",
        ]),
        ("7. Trade-offs", [
            "Trade-offs accepted in this design",
            "Areas that may need to change in the future",
        ]),
        ("8. Milestones", [
            "Phase breakdown and deliverables for each phase",
            "Rough schedule",
        ]),
        ("9. Security Considerations", [
            "Authentication / Authorization",
            "Data encryption",
            "Known risks and mitigations",
        ]),
        ("10. Test Plan", [
            "Unit tests",
            "Integration tests",
            "Load tests",
            "Chaos engineering",
        ]),
        ("11. Monitoring and Alerting", [
            "Key metrics (SLI/SLO)",
            "Alert conditions",
            "Dashboard design",
        ]),
        ("12. Open Questions", [
            "Items not yet decided",
            "Items that need discussion in review",
        ]),
    ]

    @classmethod
    def generate(cls) -> str:
        lines = ["# [Project Name] Design Doc\n"]
        for section, items in cls.SECTIONS:
            lines.append(f"## {section}\n")
            for item in items:
                lines.append(f"- {item}")
            lines.append("")
        return "\n".join(lines)

print(DesignDocTemplate.generate())
```

---

## 8. Comparison Tables

### Comparison Table 1: Design Approaches

| Aspect | Top-Down Design | Bottom-Up Design | Hybrid |
|------|-----------------|-----------------|-------------|
| Starting point | From business requirements | From technical components | From both requirements and technical constraints |
| Pros | Directly tied to business value | High technical accuracy | Well-balanced |
| Cons | Risk of overlooking technical feasibility | Risk of over-engineering | Takes more time |
| Best for | Design interviews, greenfield projects | Refactoring existing systems | Large commercial systems |
| Risk | Designs that cannot be implemented | Divergence from business requirements | Analysis paralysis |
| Deliverables | Centered on component diagrams | Centered on class/sequence diagrams | Multi-layer design documents |

### Comparison Table 2: Design Interview vs. Real-World Design

| Aspect | Design Interview | Real-World Design |
|------|---------|-----------|
| Time | 45-60 minutes | Weeks to months |
| Depth | Broad and shallow | Deep in specific areas |
| Completeness | Not required (thought process matters) | Required to be implementable |
| Feedback | Dialogue with interviewer | Team-wide review |
| Deliverables | Whiteboard diagram | Design Doc + prototype |
| What is valued | Communication skills | Technical accuracy |
| Trade-offs | Discussed verbally | Documented in writing |
| Cost estimates | Rough order-of-magnitude | Detailed estimates |
| Test plan | Mentioned briefly | Detailed test strategy |

### Comparison Table 3: Trade-offs in Key Technology Choices

| Technology Choice | Option A | Option B | Decision Criteria |
|---------|---------|---------|---------|
| DB | SQL (PostgreSQL) | NoSQL (MongoDB) | Data structure, need for JOINs, scale requirements |
| Communication | REST | gRPC | Latency requirements, type safety, browser support |
| Cache | Redis | Memcached | Data structure complexity, persistence requirements |
| MQ | Kafka | RabbitMQ | Throughput, ordering guarantees, replay capability |
| Search | Elasticsearch | PostgreSQL FTS | Search complexity, data volume, real-time requirements |
| Container | Kubernetes | ECS/Fargate | Ops team capability, customization requirements |

---

## 9. Anti-Patterns

### Anti-Pattern 1: Designing Without Clarifying Requirements

```
--- BAD EXAMPLE ---

Interviewer: "Design Twitter."
Candidate: "First I'll use a microservices architecture. I'll make it
            event-driven with Kafka, cache with Redis, and shard PostgreSQL..."

What's wrong:
- Jumping to technology selection before understanding requirements
- The interviewer wants to see the thought process, but only conclusions are stated
- Not every Twitter is the same (scale, priorities, and constraints differ)

--- GOOD EXAMPLE ---

Interviewer: "Design Twitter."
Candidate: "Thank you. Let me ask a few clarifying questions.

  About features:
  1. Are tweet posting and timeline display the core features?
  2. Does the scope include search, notifications, and DMs?
  3. Do we need image/video support?

  About scale:
  4. What DAU are we targeting? (10K? 100M? 1B?)
  5. What is the average number of followees per user?

  Non-functional requirements:
  6. What is the latency target for timeline display?
  7. What is the availability target? (99.9%? 99.99%?)
  8. Do we need strong consistency, or is eventual consistency acceptable?"

Why this is good:
- Narrowing the scope enables deeper discussion
- Clarifying NFRs provides the rationale for technology selection
- It creates dialogue with the interviewer, demonstrating communication skills
```

### Anti-Pattern 2: Silver Bullet Syndrome

```
--- BAD EXAMPLE ---

"All problems can be solved with caching"
"Microservices will solve everything"
"NoSQL scales automatically"
"Kubernetes auto-scales everything"

Why this is a problem:
- There is no universal technology. Every technology has trade-offs
- Cache → complexity of invalidation, risk of data inconsistency
- Microservices → network latency, distributed transactions, operational complexity
- NoSQL → difficulty of JOINs, weak ACID guarantees
- Kubernetes → learning curve, operational complexity, overkill for small systems

--- GOOD EXAMPLE ---

"Since reads outnumber writes by 100x, a read-through cache is effective.
  However, the following trade-offs must be considered:

  1. Cache invalidation strategy: TTL vs. event-driven
     → TTL is easy to implement but may leave stale data
     → Event-driven stays current but is complex to implement

  2. Cache consistency:
     → Write-through: cache updated at write time. High consistency but slower writes
     → Write-behind: async cache update. Faster but risk of data loss

  3. Cache stampede mitigation:
     → Add jitter to TTL to prevent simultaneous expiration
     → Use circuit breaker to protect DB from overload

  I propose TTL=5min + write-through for this case.
  The rationale is that data being 5 seconds stale is acceptable, and write QPS is low."
```

### Anti-Pattern 3: Over-Engineering

```
--- BAD EXAMPLE ---

Initial design for a startup with DAU 1,000:
- Kubernetes cluster with 20 nodes
- 6 microservices
- Kafka + Elasticsearch + Redis Cluster
- Multi-region deployment
- Custom service mesh

Monthly cost: $15,000
Team: 2 engineers

What's wrong:
- Infrastructure more than 10x what the traffic requires
- 2 people cannot operate this
- Development speed slows down, missing business opportunities

--- GOOD EXAMPLE ---

Appropriate design for a startup with DAU 1,000:
- Monolith app on Heroku / Railway / PaaS
- PostgreSQL (managed)
- Redis (session management only)
- S3 (file storage)

Monthly cost: $100-300
Team: 2 engineers

Key points:
- "Design to scale" without "implementing at scale"
  Example: Abstract DB access with the repository pattern,
           but keep the implementation as a single DB.
           Implement sharding when it becomes necessary.
- This architecture is sufficient until DAU exceeds 100K
```

### Anti-Pattern 4: Ignoring Non-Functional Requirements

```
--- BAD EXAMPLE ---

Design doc with only functional requirements:
- Users can register
- Products can be searched
- Purchase processing works
(That's all)

What's wrong:
- No latency target, so 3 seconds is a "correct" design
- No availability target, so 1 hour of downtime per day is "fine"
- No security requirements, so plaintext passwords are "as specified"

--- GOOD EXAMPLE ---

Functional + non-functional requirements explicitly stated:
- Users can register
  → Response time: < 500ms (P99)
  → Passwords hashed with bcrypt
  → Email verification required

- Products can be searched
  → Response time: < 200ms (P99)
  → Paginated display for 1M+ products

- Purchase processing works
  → Availability: 99.99%
  → Double-purchase prevention (idempotency key)
  → PCI DSS compliant
```

---

## 10. Practical Exercises

### Exercise 1 (Beginner): Requirements Definition for a URL Shortener

**Task:** Organize requirements and perform estimations for a URL shortening service (bit.ly-style).

**Requirements:**
1. List 3 or more functional requirements
2. List 3 or more non-functional requirements (with numeric targets)
3. Calculate QPS and storage estimates

```python
# Skeleton code for Exercise 1

class URLShortenerRequirements:
    """Requirements definition for a URL shortening service"""

    def define_requirements(self):
        """Define requirements here"""
        # TODO: Functional requirements
        functional = [
            # "Convert a long URL to a short URL",
            # "Redirect to the original URL when the short URL is accessed",
            # ...
        ]

        # TODO: Non-functional requirements
        non_functional = {
            # "Latency": "Redirect < 100ms (P99)",
            # "Availability": "99.99%",
            # ...
        }

        return functional, non_functional

    def estimate(self):
        """Define estimates here"""
        # TODO: Assume DAU
        dau = 0  # ???

        # TODO: QPS calculation
        write_qps = 0  # ???
        read_qps = 0   # ???

        # TODO: Storage calculation
        # What is the size per record?
        # What is the retention period?

        return {
            "dau": dau,
            "write_qps": write_qps,
            "read_qps": read_qps,
        }
```

**Example expected output:**

```
=== URL Shortener Requirements Definition ===

[Functional Requirements]
  Must Have:
    - Convert a long URL to a short URL
    - Redirect to the original URL when the short URL is accessed (301/302)
    - Set an expiration date for the short URL
  Should Have:
    - Custom alias (e.g., short.url/my-brand)
    - Display click statistics
  Could Have:
    - QR code generation
    - Multiple URLs for A/B testing

[Non-Functional Requirements]
  - Redirect latency: < 50ms (P99)
  - Availability: 99.99%
  - 10M URLs generated per day, 1B redirects per day
  - Guarantee URL uniqueness (no collisions)
  - Short URL length: 7 characters (Base62 gives 62^7 = 3.5 trillion patterns)

[Estimates]
  DAU: 100M
  Write QPS: 116 (peak: 347)
  Read QPS: 11,574 (peak: 34,722)
  Storage: 500B/record × 10M records/day = 5GB/day = 1.8TB/year
```

---

### Exercise 2 (Intermediate): High-Level Design of a Chat System

**Task:** Perform a high-level design of a chat system like LINE or Slack.

**Requirements:**
1. Organize requirements (1-on-1 chat + group chat)
2. List the main components and draw the architecture in an ASCII diagram
3. Explain the data flow for message sending
4. Design a DB schema (3 or more tables)

```python
# Skeleton code for Exercise 2

class ChatSystemDesign:
    """Chat system design"""

    def requirements(self):
        """Requirements definition"""
        pass  # TODO

    def high_level_design(self):
        """High-level design (ASCII diagram)"""
        diagram = """
        TODO: Draw the architecture diagram here

        Hint: Include the following components
        - WebSocket Gateway (real-time communication)
        - Chat Service (message processing)
        - Presence Service (online status management)
        - Notification Service (push notifications)
        - Message Store (message persistence)
        - File Storage (file attachments)
        """
        return diagram

    def data_flow(self):
        """Data flow for message sending"""
        pass  # TODO: All steps when A sends a message to B

    def db_schema(self):
        """DB schema design"""
        pass  # TODO: users, conversations, messages tables
```

**Example expected output:**

```
=== Chat System High-Level Design ===

  Client A ─── WebSocket ──→ WS Gateway ──→ Chat Service
                                              │
                                              ├──→ Message Store (Cassandra)
                                              ├──→ Notification Service
                                              │       └──→ Push (APNS/FCM)
                                              └──→ WS Gateway ──→ Client B
                                                     (if B is online)

  [Message Sending Flow]
  1. Client A sends message over WebSocket
  2. WS Gateway forwards to Chat Service
  3. Chat Service persists message to DB
  4. If Client B is online → deliver in real-time via WS Gateway
  5. If Client B is offline → send push notification via Notification Service

  [DB Schema]
  users (user_id PK, name, status, last_seen)
  conversations (conv_id PK, type, participants[], created_at)
  messages (msg_id PK, conv_id FK, sender_id FK, content, type, created_at)
```

---

### Exercise 3 (Advanced): Improvement Proposal for an Existing System

**Task:** Analyze the following "problem-ridden system design" and propose improvements.

```python
# Problematic system design
"""
Current EC site design:
- Single monolith application (Python/Django)
- Single PostgreSQL (16 vCPU, 64GB RAM)
- Sessions use Django's DB-backed sessions
- Images stored on the local filesystem
- Full-text search uses PostgreSQL LIKE queries
- Batch processing uses cron jobs
- Deployment is manual SSH + git pull
- No monitoring
- DAU: 500K, expected to grow to 2M in the next year

Problems:
1. DB CPU usage reaches 95% during peak periods (sales events)
2. Product search is slow (2-3 seconds)
3. Image loading is slow (especially for overseas users)
4. Downtime occurs during deployments
5. Identifying the cause of failures takes too long
"""

# TODO: For each problem above, propose improvements in the following format:
# 1. Root cause analysis
# 2. Short-term improvements (implementable in 1-2 weeks)
# 3. Medium-term improvements (implementable in 1-3 months)
# 4. Trade-offs for each improvement
```

**Example expected output:**

```
=== EC Site Improvement Proposals ===

[Problem 1: DB CPU usage at 95%]
  Root cause: Reads and writes concentrated on the same DB. Possible missing indexes.

  Short-term (1-2 weeks):
    - Analyze slow query logs and add indexes
    - Fix N+1 queries (Django select_related/prefetch_related)
    - Cache expensive queries (Redis + TTL 5 minutes)
    → Trade-off: Cache TTL introduces data staleness

  Medium-term (1-3 months):
    - Introduce Read Replicas (distribute reads)
    - Migrate DB-backed sessions to Redis sessions
    - Optimize connection pooling (PgBouncer)
    → Trade-off: Replication lag reduces consistency

[Problem 2: Slow product search]
  Root cause: LIKE queries result in full table scans with O(n) complexity

  Short-term: PostgreSQL GIN index + pg_trgm extension
  Medium-term: Introduce Elasticsearch
  → Trade-off: ES operational cost vs. improvement in search quality

... (analyze problems 3-5 similarly)
```

---

## 11. FAQ

### Q1: Where should I start studying system design?

Start by solidifying the foundational concepts (scalability, reliability, CAP theorem) in the "00-fundamentals" section of this guide. Then learn individual components (load balancers, caches, message queues) in "01-components." Finally, work through real design problems in "03-case-studies."

**Recommended learning path:**

```
Week 1-2: Foundational Concepts
  → 00-system-design-overview.md (this guide)
  → 01-scalability.md
  → 02-reliability.md
  → 03-cap-theorem.md

Week 3-4: Components
  → 00-load-balancer.md
  → 01-caching.md
  → 02-message-queue.md
  → 03-cdn.md
  → 04-database-scaling.md

Week 5-6: Architecture
  → 00-monolith-vs-microservices.md
  → 01-clean-architecture.md
  → 02-ddd.md
  → 03-event-driven.md

Week 7-8: Case Studies (Exercises)
  → 00-url-shortener.md
  → 01-chat-system.md
  → 02-notification-system.md
  → 03-rate-limiter.md
  → 04-search-engine.md
```

The most recommended book is *Designing Data-Intensive Applications* by Martin Kleppmann.

### Q2: What should I draw on the whiteboard in a design interview?

At minimum, include the following elements:

1. **Client**: Browser or mobile app
2. **Load Balancer**: Specify whether it is L4 or L7
3. **Application servers**: Indicate they form an Auto Scaling Group
4. **Cache layer**: Include the reason for choosing Redis/Memcached
5. **Data store**: Primary/Replica configuration, whether sharding is used

Use arrows to indicate the direction of data flow, and annotate the protocol between each component (HTTP, gRPC, WebSocket, etc.). Adding numbers (QPS, latency targets) near the boxes makes the diagram more convincing.

**Points that differentiate your whiteboard diagram:**

- Add numbers (QPS, latency) to each component
- Show failure points and their mitigations
- Draw async paths with a different color or line style
- Explicitly mark potential bottlenecks

### Q3: What is the difference between real-world and design interview system design?

In an interview, it is important to show your "thought process" within a 45-minute constraint; a perfect design is not required. In real-world engineering, you design incrementally over time and validate with prototypes.

**Specific differences:**

| Aspect | Interview | Real-World |
|------|------|------|
| Purpose | Evaluate thought process | Produce an implementable design |
| Time | 45-60 minutes | Weeks to months |
| Depth | Overall picture + 1-2 deep dives | Detailed treatment of all areas |
| Uncertainty | Make assumptions and proceed | Reach consensus with stakeholders |
| Feedback | Dialogue with interviewer | Reviews, prototype validation |
| Impact of outcome | Hiring decision only | Direct business impact |

### Q4: How do I use the CAP theorem effectively in a design interview?

The CAP theorem states that "in a distributed system, you can guarantee at most two of the following: Consistency, Availability, and Partition Tolerance." In practice, however, Partition Tolerance is unavoidable (networks always partition), so the real choice is between CP and AP.

In a design interview, it is useful to frame the discussion around "which should this system prioritize: CP or AP?" For example:
- **Financial transaction system → CP**: Inconsistency in balances is absolutely unacceptable
- **SNS timeline → AP**: A few seconds of delay is acceptable; it is more important to always be available

For details, see [CAP Theorem](./03-cap-theorem.md).

### Q5: When should microservices be introduced?

Rather than "when to introduce microservices," the first question should be "are they really necessary?" Consider them when several of the following signs appear:

1. **Team size**: 50+ engineers sharing a monolith
2. **Deployment frequency**: Deployments are delayed due to conflicts with other teams' changes
3. **Scaling**: Having to scale the entire system when only one feature has high load
4. **Technology diversity**: Different features require different optimal tech stacks

Conversely, introducing microservices in a startup with 5 or fewer engineers is almost certainly over-engineering.

For details, see [Monolith vs. Microservices](../02-architecture/00-monolith-vs-microservices.md).

### Q6: What are the most common failure patterns in system design?

1. **Not clarifying requirements**: The biggest cause of failure in both interviews and real-world work
2. **Premature optimization**: Sharding from day one because "we might reach 1 billion users someday"
3. **Silver bullet thinking**: "Microservices will solve everything"
4. **Ignoring non-functional requirements**: Features work but are slow, crash, or have security holes
5. **Not discussing trade-offs**: Presenting only one option without showing alternatives
6. **No numerical backing**: Proceeding with design based on "it'll probably be fine"

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and moving to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes particularly important during code reviews and architecture design.
