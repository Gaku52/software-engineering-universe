# Reliability

> Understand the ability of a system to continue functioning correctly even when failures occur, and master fault tolerance, redundancy, and disaster recovery design patterns through hands-on practice with availability calculations, circuit breakers, and chaos engineering.

---

## What You Will Learn

1. The definition of reliability and how to quantitatively measure availability, along with the relationship between SLA, SLO, and SLI
2. Redundancy patterns for fault tolerance (Active-Passive, Active-Active) and failover strategies
3. Implementation and validation of resilience patterns such as circuit breakers, retries, and bulkheads

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|--------|
| Networking Basics | Fundamental concepts of TCP/IP, DNS, and HTTP | Web/Networking Basics |
| Scalability | Concepts of vertical/horizontal scaling | [Scalability](./01-scalability.md) |
| Python Basics | asyncio, dataclass, decorators | Programming Basics |
| Distributed Systems Concepts | Basic understanding of nodes and replication | [CAP Theorem](./03-cap-theorem.md) |

---

## 1. What Is Reliability?

Reliability refers to a system's ability to **continue providing expected functionality correctly even when faults occur**. Since eliminating faults entirely is impossible, the approach required is to **design with faults as a given** and minimize the impact when they occur.

### 1.1 Distinguishing Fault from Failure

```
Fault   ≠  Failure

Fault:   A component deviates from its specification in some way
         Example: Physical failure of one disk, loss of a network packet
Failure: The entire system becomes unable to provide service
         Example: A website becomes inaccessible, complete data loss

Goal of reliability: Prevent a Fault from escalating into a Failure
         → Fault-tolerant design
```

This distinction is critically important. The essence of reliability engineering is designing systems so that even when a Fault occurs in an individual component, the system as a whole does not become a Failure.

### 1.2 Three Categories of Failures

In reliability design, failures are categorized into the following three types to formulate countermeasures.

```
┌─────────────────────────────────────────────────────────────┐
│                    Failure Categories                        │
├─────────────────┬───────────────────┬───────────────────────┤
│ Hardware Failure │ Software Failure   │   Human Error         │
├─────────────────┼───────────────────┼───────────────────────┤
│ · Disk failure  │ · Bugs             │ · Misconfiguration    │
│ · Memory        │ · Memory leaks     │ · Incorrect deploys   │
│   corruption    │ · Deadlocks        │ · Procedural errors   │
│ · Power outage  │ · Cascade failures │ · Capacity            │
│ · Network split │                    │   miscalculation      │
├─────────────────┼───────────────────┼───────────────────────┤
│ Countermeasures:│ Countermeasures:   │ Countermeasures:      │
│ Redundancy,     │ Testing,           │ Automation, reviews   │
│ RAID, hot spare │ monitoring,        │ guardrails            │
│                 │ chaos engineering  │                       │
└─────────────────┴───────────────────┴───────────────────────┘
```

### 1.3 WHY: Why Does Reliability Matter?

The following quantifies the impact of insufficient reliability.

```
Business Impact of Downtime:
─────────────────────────────────────────
Amazon:   ~$220,000 lost per minute of downtime (2024 estimate)
Google:   ~$545,000 lost per 5 minutes of downtime
Facebook: ~$60M estimated loss from the 6-hour outage in 2021

E-commerce example:
  Annual revenue $10M, availability 99.9%
  → Annual downtime: 8.76 hours
  → Estimated loss ≈ $10M × (8.76 / 8760) ≈ $10,000

  Improving availability to 99.99%:
  → Annual downtime: 52.6 minutes
  → Estimated loss ≈ $10M × (52.6 / 525600) ≈ $1,000
  → Annual loss reduction of ~$9,000
─────────────────────────────────────────
```

---

## 2. Availability Calculations

### 2.1 Availability and Downtime

Availability is the proportion of time a system is operating normally, expressed in terms of "nines."

### Code Example 1: Calculating Availability and Downtime

```python
def availability_to_downtime(nines: int):
    """Calculate downtime from the number of nines of availability"""
    availability = 1 - (10 ** -nines)
    yearly_minutes = 365.25 * 24 * 60
    downtime_minutes = yearly_minutes * (1 - availability)

    if downtime_minutes >= 60:
        return f"{availability:.{nines}%} → {downtime_minutes / 60:.1f} hours/year"
    elif downtime_minutes >= 1:
        return f"{availability:.{nines}%} → {downtime_minutes:.1f} minutes/year"
    else:
        return f"{availability:.{nines}%} → {downtime_minutes * 60:.1f} seconds/year"

for nines in range(1, 6):
    print(f"{'9' * nines:>5s}: {availability_to_downtime(nines)}")

# Output:
#     9: 90.0% → 876.6 hours/year
#    99: 99.00% → 87.7 hours/year
#   999: 99.900% → 8.8 hours/year
#  9999: 99.9900% → 52.6 minutes/year
# 99999: 99.99900% → 5.3 minutes/year
```

### ASCII Diagram 1: Availability Level Reference

```
  Availability  Annual Down   Monthly Down  Typical Use Case
  ─────────────────────────────────────────────────────────
  99%           3.65 days     7.3 hours     Batch processing, internal tools
  99.9%         8.76 hours    43.8 minutes  General web services
  99.95%        4.38 hours    21.9 minutes  E-commerce sites
  99.99%        52.6 minutes  4.38 minutes  Payment systems, SaaS
  99.999%       5.26 minutes  26.3 seconds  Air traffic control, medical, telecom
  ─────────────────────────────────────────────────────────

  Note: Composite availability = product of each component's availability
  Example: Web(99.9%) × API(99.9%) × DB(99.9%) = 99.7%
```

### 2.2 Composite System Availability

The overall availability of a system varies significantly based on whether components are arranged in series or in parallel.

### Code Example 2: Composite System Availability Calculation

```python
from typing import List

def series_availability(*components: float) -> float:
    """Series availability = product of each component's availability

    In series, the system stops if any single component fails.
    Example: LB → App → DB (if any one fails, service stops)
    """
    result = 1.0
    for a in components:
        result *= a
    return result

def parallel_availability(*components: float) -> float:
    """Parallel availability = 1 - (product of each unavailability)

    In parallel, the system only stops if all components fail simultaneously.
    Example: DB Primary || DB Replica (OK as long as both don't fail at once)
    """
    result = 1.0
    for a in components:
        result *= (1 - a)
    return 1 - result

def format_availability(name: str, value: float) -> str:
    """Display availability in a readable format"""
    yearly_downtime_min = 525960 * (1 - value)
    return f"{name}: {value:.8f} ({value*100:.4f}%) → Annual downtime {yearly_downtime_min:.1f} min"

# === Series configuration ===
serial = series_availability(0.999, 0.999, 0.999)
print(format_availability("Series (LB→App→DB)", serial))
# Series (LB→App→DB): 0.99700300 (99.7003%) → Annual downtime 1577.9 min

# === Parallel configuration ===
parallel_db = parallel_availability(0.999, 0.999)
print(format_availability("Parallel DB (Primary||Replica)", parallel_db))
# Parallel DB (Primary||Replica): 0.99999900 (99.9999%) → Annual downtime 0.5 min

# === Combined configuration ===
combined = series_availability(0.999, 0.999, parallel_db)
print(format_availability("LB→App→(DB||DB)", combined))
# LB→App→(DB||DB): 0.99800100 (99.8001%) → Annual downtime 1051.9 min

# === Fully redundant across all layers ===
parallel_lb = parallel_availability(0.999, 0.999)
parallel_app = parallel_availability(0.999, 0.999)
fully_redundant = series_availability(parallel_lb, parallel_app, parallel_db)
print(format_availability("(LB||LB)→(App||App)→(DB||DB)", fully_redundant))
# (LB||LB)→(App||App)→(DB||DB): 0.99999700 (99.9997%) → Annual downtime 1.6 min
```

### ASCII Diagram 2: Series vs Parallel Availability

```
■ Series configuration (all components must be operational)

  Client → [LB] → [App] → [DB]
           99.9%   99.9%   99.9%

  Total = 0.999 × 0.999 × 0.999 = 0.997 = 99.7%
  → Availability decreases as more components are added

■ Parallel configuration (redundancy)

  Client → [LB Active ] → [App 1] → [DB Primary]
           [LB Standby]   [App 2]   [DB Replica]
           99.9999%        99.9999%   99.9999%

  Total = 0.999999 × 0.999999 × 0.999999 ≒ 99.9997%
  → Redundancy dramatically improves availability at each layer

■ Rules for improving availability:
  Adding in series decreases it: 0.999 × 0.999 = 0.998
  Adding in parallel increases it: 1 - (0.001 × 0.001) = 0.999999
```

---

## 3. SLA, SLO, and SLI

SLA, SLO, and SLI form a framework for quantitatively managing reliability targets.

### 3.1 Relationship Between the Three

```
  ┌─────────────────────────────────────────────────┐
  │  SLI (Service Level Indicator) — Measured value  │
  │  "What is actually happening right now?"          │
  │  Example: Latency P99 = 150ms, Error rate = 0.02% │
  │                                                   │
  │  ┌───────────────────────────────────────────┐    │
  │  │  SLO (Service Level Objective) — Internal │    │
  │  │  "What does the team aim to achieve?"     │    │
  │  │  Example: Maintain P99 < 200ms for 99.9%  │    │
  │  │           of the time                     │    │
  │  │                                           │    │
  │  │  ┌───────────────────────────────────┐    │    │
  │  │  │  SLA (Service Level Agreement)   │    │    │
  │  │  │  "What do we promise customers?" │    │    │
  │  │  │  Example: Credit issued if       │    │    │
  │  │  │  availability < 99.95%           │    │    │
  │  │  └───────────────────────────────────┘    │    │
  │  └───────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────┘

  Important: Set SLO stricter than SLA
  SLA: 99.95% (customer contract)
  SLO: 99.99% (internal target, provides buffer before SLA breach)

  Error budget = SLO - actual performance
  Example: SLO is 99.9% and this month's error rate is 0.05%
  → Remaining error budget = 0.1% - 0.05% = 0.05%
  → Remaining budget allows deploying risky changes
```

### Code Example 3: SLI/SLO Monitoring Implementation

```python
import time
from dataclasses import dataclass, field
from collections import deque
from typing import Optional

@dataclass
class SLIMetric:
    """Measurement of a Service Level Indicator"""
    name: str
    window_seconds: int = 3600  # 1-hour sliding window

    _measurements: deque = field(default_factory=deque, init=False)
    _good_count: int = field(default=0, init=False)
    _total_count: int = field(default=0, init=False)

    def record(self, is_good: bool, value: float = 0.0):
        """Record a measurement"""
        now = time.time()
        self._measurements.append((now, is_good, value))
        self._total_count += 1
        if is_good:
            self._good_count += 1
        self._evict_old(now)

    def _evict_old(self, now: float):
        """Remove old measurements outside the window"""
        while self._measurements and self._measurements[0][0] < now - self.window_seconds:
            _, was_good, _ = self._measurements.popleft()
            self._total_count -= 1
            if was_good:
                self._good_count -= 1

    @property
    def availability(self) -> float:
        """Current availability (success rate)"""
        if self._total_count == 0:
            return 1.0
        return self._good_count / self._total_count

    @property
    def percentile_latency(self) -> float:
        """P99 latency"""
        values = sorted(v for _, is_good, v in self._measurements if is_good)
        if not values:
            return 0.0
        idx = int(len(values) * 0.99)
        return values[min(idx, len(values) - 1)]


@dataclass
class SLOChecker:
    """Monitor SLO achievement status and manage the error budget"""
    sli: SLIMetric
    target_availability: float = 0.999   # 99.9%
    target_latency_p99: float = 200.0    # 200ms

    def check(self) -> dict:
        """Check SLO achievement status"""
        avail = self.sli.availability
        latency = self.sli.percentile_latency

        avail_ok = avail >= self.target_availability
        latency_ok = latency <= self.target_latency_p99

        # Error budget calculation
        error_budget_total = 1.0 - self.target_availability
        error_budget_used = 1.0 - avail
        error_budget_remaining = max(0, error_budget_total - error_budget_used)
        budget_percentage = (error_budget_remaining / error_budget_total * 100
                           if error_budget_total > 0 else 100)

        return {
            "availability": f"{avail*100:.4f}%",
            "availability_target": f"{self.target_availability*100:.2f}%",
            "availability_met": avail_ok,
            "latency_p99_ms": f"{latency:.1f}",
            "latency_target_ms": f"{self.target_latency_p99:.1f}",
            "latency_met": latency_ok,
            "error_budget_remaining": f"{budget_percentage:.1f}%",
            "slo_met": avail_ok and latency_ok,
        }


# Usage example
sli = SLIMetric("api-gateway", window_seconds=3600)

# Record requests
for i in range(10000):
    is_success = i % 1000 != 0  # 0.1% error rate
    latency = 50 + (i % 100) * 2  # 50-248ms
    sli.record(is_success, latency)

checker = SLOChecker(sli, target_availability=0.999, target_latency_p99=200.0)
result = checker.check()
for k, v in result.items():
    print(f"  {k}: {v}")
# Example output:
#   availability: 99.9000%
#   availability_target: 99.90%
#   availability_met: True
#   latency_p99_ms: 246.0
#   latency_target_ms: 200.0
#   latency_met: False
#   error_budget_remaining: 0.0%
#   slo_met: False
```

---

## 4. Redundancy Patterns

### 4.1 Active-Passive and Active-Active

### ASCII Diagram 3: Active-Passive vs Active-Active

```
■ Active-Passive (Hot Standby)

  Client ──→ ┌──────────┐     ┌──────────┐
             │ Active   │────→│ Passive  │  (data sync)
             │ (running)│     │ (standby)│
             └──────────┘     └──────────┘
                  │                │
                  ▼                │
             ┌──────────┐         │
             │ Service  │         │ On Active failure:
             └──────────┘         │ Automatic failover
                                  ▼
  Client ──→              ┌──────────┐
                          │ Former   │ → Promoted to new Active
                          │ Passive  │
                          └──────────┘

  Pros: Simple, easy to maintain data consistency
  Cons: Passive resources are idle during normal operation
  Use cases: Databases, stateful services

■ Active-Active (Load balancing + redundancy)

  Client ──→ ┌──────┐     ┌──────────┐
             │  LB  │────→│ Active 1 │
             │      │────→│ Active 2 │
             └──────┘     └──────────┘
                           ↕ (bidirectional sync)
                          Either can handle requests if the other fails

  Pros: Better resource efficiency, faster failover
  Cons: Managing data conflicts is complex
  Use cases: Web servers, stateless services

■ N+1 Redundancy

  Normal: Server 1, Server 2, Server 3 share the load
  +1:    Server 4 added (if one fails, the remaining 3 can handle it)

  Pros: Lower cost than Active-Active while achieving fault tolerance
  Use cases: Web server farms, worker pools
```

### 4.2 Failover Strategies

### ASCII Diagram 4: Types of Failover

```
■ Cold Failover
  ┌─────────┐  failure   ┌─────────┐
  │ Primary │ ──×──→     │ Standby │  ← Takes minutes to start
  │(running)│            │(stopped)│     (minimum cost)
  └─────────┘            └─────────┘
  Recovery time: Minutes to tens of minutes
  Data loss: Up to the last backup point

■ Warm Failover
  ┌─────────┐  failure   ┌─────────┐
  │ Primary │ ──×──→     │ Standby │  ← Already running, data sync has lag
  │(running)│            │(slow)   │     (moderate cost)
  └─────────┘            └─────────┘
  Recovery time: Tens of seconds to minutes
  Data loss: Amount of replication lag

■ Hot Failover
  ┌─────────┐  failure   ┌─────────┐
  │ Primary │ ──×──→     │ Standby │  ← Running in sync with same state
  │(running)│←──sync──→  │(running)│     (maximum cost)
  └─────────┘            └─────────┘
  Recovery time: Within seconds
  Data loss: Near zero
```

---

## 5. Resilience Patterns

### 5.1 Circuit Breaker

The circuit breaker is a pattern that prevents failures from cascading (cascade failures). Like an electrical circuit breaker, it trips the circuit during abnormal conditions to protect the overall system.

```
Circuit Breaker State Transitions:

  ┌──────────┐  failures reach threshold  ┌──────────┐
  │ CLOSED   │ ─────────────────────────→ │   OPEN   │
  │(pass-thru│                            │(reject   │
  │ normal)  │                            │immediately)
  └──────────┘                            └──────────┘
       ↑                                       │
       │  successes reach threshold    timeout elapses
       │                                       │
  ┌──────────┐                                 ▼
  │ HALF_OPEN│ ←───────────────────────────────
  │(trial)   │   failure → back to OPEN
  └──────────┘
```

### Code Example 4: Circuit Breaker Pattern

```python
import time
from enum import Enum
from dataclasses import dataclass, field
from typing import Callable, Any

class CircuitState(Enum):
    CLOSED = "closed"        # Normal (requests pass through)
    OPEN = "open"            # Tripped (requests rejected)
    HALF_OPEN = "half_open"  # Trial (some requests pass through)

class CircuitBreakerError(Exception):
    """Exception raised when the circuit breaker is open"""
    pass

@dataclass
class CircuitBreaker:
    """
    Circuit Breaker: Prevents failure cascades

    Implementation notes:
      In CLOSED state, transitions to OPEN when failures reach failure_threshold.
      In OPEN state, transitions to HALF_OPEN after recovery_timeout seconds.
      In HALF_OPEN, transitions back to CLOSED after success_threshold successes.
      In HALF_OPEN, any single failure transitions back to OPEN.
    """
    failure_threshold: int = 5          # Failure count threshold
    recovery_timeout: float = 30.0      # Duration to stay OPEN (seconds)
    success_threshold: int = 3          # Successes needed for HALF_OPEN→CLOSED
    half_open_max_calls: int = 3        # Max concurrent trial calls in HALF_OPEN

    state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    failure_count: int = field(default=0, init=False)
    success_count: int = field(default=0, init=False)
    last_failure_time: float = field(default=0, init=False)
    half_open_calls: int = field(default=0, init=False)

    # Metrics
    total_calls: int = field(default=0, init=False)
    total_failures: int = field(default=0, init=False)
    total_rejections: int = field(default=0, init=False)

    def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute a function through the circuit breaker"""
        self.total_calls += 1

        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                self.half_open_calls = 0
                print(f"[Circuit] OPEN → HALF_OPEN: Starting trial")
            else:
                self.total_rejections += 1
                raise CircuitBreakerError(
                    f"Circuit OPEN: Request rejected "
                    f"({self.recovery_timeout - (time.time() - self.last_failure_time):.0f}s until recovery)"
                )

        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls >= self.half_open_max_calls:
                self.total_rejections += 1
                raise CircuitBreakerError("Circuit HALF_OPEN: Trial call limit reached")
            self.half_open_calls += 1

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except CircuitBreakerError:
            raise
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                print(f"[Circuit] HALF_OPEN → CLOSED: Recovered successfully")
        elif self.state == CircuitState.CLOSED:
            self.failure_count = 0

    def _on_failure(self):
        self.total_failures += 1
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            print(f"[Circuit] HALF_OPEN → OPEN: Trial failed, re-tripping")
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            print(f"[Circuit] CLOSED → OPEN: Tripped after {self.failure_count} consecutive failures")

    def get_metrics(self) -> dict:
        return {
            "state": self.state.value,
            "total_calls": self.total_calls,
            "total_failures": self.total_failures,
            "total_rejections": self.total_rejections,
            "failure_rate": (self.total_failures / max(1, self.total_calls) * 100),
        }


# Usage example
cb = CircuitBreaker(failure_threshold=3, recovery_timeout=10.0)

def unreliable_service():
    import random
    if random.random() < 0.7:
        raise ConnectionError("Service unavailable")
    return {"status": "ok"}

for i in range(10):
    try:
        result = cb.call(unreliable_service)
        print(f"  Call {i}: Success - {result}")
    except CircuitBreakerError as e:
        print(f"  Call {i}: Rejected - {e}")
    except ConnectionError as e:
        print(f"  Call {i}: Failed - {e}")

print(f"\nMetrics: {cb.get_metrics()}")
```

### 5.2 Retry with Exponential Backoff

### Code Example 5: Retry with Exponential Backoff + Jitter

```python
import random
import time
from functools import wraps
from typing import Tuple, Type

def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,),
):
    """
    Retry decorator with exponential backoff + jitter

    WHY exponential backoff:
      Fixed-interval retries cause many clients to retry simultaneously,
      putting additional load on an already-failing server (retry storm).
      Exponential backoff widens the interval, and jitter spreads the timing.

    WHY jitter:
      Backoff alone causes clients that failed simultaneously to retry
      at the same times repeatedly (thundering herd). Random jitter spreads them out.

    Jitter strategy comparison:
      No Jitter:    delay = base * 2^attempt        (synchronized)
      Full Jitter:  delay = random(0, base * 2^attempt)  (most spread out)
      Equal Jitter: delay = base * 2^attempt / 2 + random(0, base * 2^attempt / 2)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    if attempt == max_retries:
                        print(f"[Retry] Max retries ({max_retries}) reached: {e}")
                        raise

                    delay = min(base_delay * (2 ** attempt), max_delay)
                    if jitter:
                        delay = random.uniform(0, delay)  # Full Jitter

                    print(f"[Retry] Attempt {attempt+1} failed, "
                          f"retrying in {delay:.2f}s: {e}")
                    time.sleep(delay)
        return wrapper
    return decorator


@retry_with_backoff(
    max_retries=4,
    base_delay=0.5,
    retryable_exceptions=(ConnectionError, TimeoutError),
)
def call_external_api(url: str) -> dict:
    """Call an external API (automatically retried on failure)"""
    import requests
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    return response.json()
```

### 5.3 Bulkhead Pattern

### Code Example 6: Bulkhead Pattern

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Dict

@dataclass
class BulkheadConfig:
    """Bulkhead configuration"""
    max_concurrent: int       # Maximum concurrent executions
    max_queue_size: int = 0   # Maximum queued requests
    timeout: float = 30.0     # Timeout in seconds

class BulkheadPattern:
    """
    Bulkhead: Isolate resources to limit the blast radius of failures

    WHY:
      Named after the watertight compartments on a ship. If a ship takes on
      water, the bulkheads prevent the whole ship from sinking. Similarly in
      software, isolate services so that one service's failure doesn't consume
      all resources of another.

      Example: Even if the payment service is slow, notification threads are unaffected
    """

    def __init__(self, configs: Dict[str, BulkheadConfig]):
        self.configs = configs
        self.pools = {
            name: ThreadPoolExecutor(
                max_workers=config.max_concurrent,
                thread_name_prefix=name
            )
            for name, config in configs.items()
        }
        self.semaphores = {
            name: asyncio.Semaphore(config.max_concurrent)
            for name, config in configs.items()
        }
        self.metrics = {name: {"calls": 0, "rejected": 0, "timeout": 0}
                       for name in configs}

    async def call_service(self, service_name: str, func, *args):
        """Call a service through the bulkhead"""
        if service_name not in self.configs:
            raise ValueError(f"Unknown service: {service_name}")

        config = self.configs[service_name]
        sem = self.semaphores[service_name]
        self.metrics[service_name]["calls"] += 1

        async with sem:
            try:
                pool = self.pools[service_name]
                loop = asyncio.get_event_loop()
                return await asyncio.wait_for(
                    loop.run_in_executor(pool, func, *args),
                    timeout=config.timeout,
                )
            except asyncio.TimeoutError:
                self.metrics[service_name]["timeout"] += 1
                raise TimeoutError(
                    f"Bulkhead: {service_name} timed out ({config.timeout}s)"
                )


# Usage example
bulkhead = BulkheadPattern({
    "payment":       BulkheadConfig(max_concurrent=10, timeout=30.0),
    "notification":  BulkheadConfig(max_concurrent=5, timeout=10.0),
    "analytics":     BulkheadConfig(max_concurrent=3, timeout=5.0),
})
# Even if notification is backed up, payment is unaffected
```

### 5.4 Failure Detection with Health Checks

### Code Example 7: Health Check Implementation

```python
import asyncio
import aiohttp
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Callable, List
from enum import Enum

class HealthState(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"      # Responding but with high latency
    UNHEALTHY = "unhealthy"

@dataclass
class HealthStatus:
    url: str
    state: HealthState
    latency_ms: float
    checked_at: datetime
    error: Optional[str] = None

class HealthChecker:
    """
    Multi-layer health checks: Active + Passive + Deep

    Active:  Periodically polls the /health endpoint
    Passive: Determines health from the error rate of real traffic
    Deep:    Verifies dependencies such as DB connections and external APIs
    """

    def __init__(
        self,
        targets: List[str],
        interval: float = 10.0,
        timeout: float = 3.0,
        unhealthy_threshold: int = 3,
        healthy_threshold: int = 2,
        degraded_latency_ms: float = 1000.0,
        on_state_change: Optional[Callable] = None,
    ):
        self.targets = targets
        self.interval = interval
        self.timeout = timeout
        self.unhealthy_threshold = unhealthy_threshold
        self.healthy_threshold = healthy_threshold
        self.degraded_latency_ms = degraded_latency_ms
        self.on_state_change = on_state_change

        self.failure_counts: dict[str, int] = {t: 0 for t in targets}
        self.success_counts: dict[str, int] = {t: 0 for t in targets}
        self.statuses: dict[str, HealthStatus] = {}

    async def check_one(self, session: aiohttp.ClientSession, url: str):
        """Active health check for a single target"""
        start = asyncio.get_event_loop().time()
        try:
            async with session.get(
                f"{url}/health",
                timeout=aiohttp.ClientTimeout(total=self.timeout)
            ) as resp:
                latency = (asyncio.get_event_loop().time() - start) * 1000
                if resp.status == 200:
                    if latency > self.degraded_latency_ms:
                        self._update_state(url, HealthState.DEGRADED, latency)
                    else:
                        self._mark_success(url, latency)
                else:
                    self._mark_failure(url, f"HTTP {resp.status}")
        except asyncio.TimeoutError:
            self._mark_failure(url, "Timeout")
        except Exception as e:
            self._mark_failure(url, str(e))

    def _mark_success(self, url: str, latency: float):
        self.failure_counts[url] = 0
        self.success_counts[url] = self.success_counts.get(url, 0) + 1
        old_state = self.statuses.get(url)
        if (old_state and old_state.state != HealthState.HEALTHY
            and self.success_counts[url] >= self.healthy_threshold):
            self._update_state(url, HealthState.HEALTHY, latency)
        elif not old_state or old_state.state == HealthState.HEALTHY:
            self._update_state(url, HealthState.HEALTHY, latency)

    def _mark_failure(self, url: str, error: str):
        self.success_counts[url] = 0
        self.failure_counts[url] += 1
        if self.failure_counts[url] >= self.unhealthy_threshold:
            self._update_state(url, HealthState.UNHEALTHY, 0, error)
            print(f"[ALERT] {url} failed {self.failure_counts[url]} times consecutively → UNHEALTHY")

    def _update_state(self, url: str, state: HealthState,
                      latency: float, error: str = None):
        old = self.statuses.get(url)
        self.statuses[url] = HealthStatus(
            url=url, state=state, latency_ms=latency,
            checked_at=datetime.now(), error=error
        )
        if old and old.state != state and self.on_state_change:
            self.on_state_change(url, old.state, state)

    def get_healthy_targets(self) -> List[str]:
        return [url for url, s in self.statuses.items()
                if s.state == HealthState.HEALTHY]
```

### 5.5 Graceful Degradation

### Code Example 8: Graceful Degradation Implementation

```python
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict

class DegradationLevel(Enum):
    FULL = "full"               # All features operational
    DEGRADED = "degraded"       # Some features restricted
    MINIMAL = "minimal"         # Only core features available
    MAINTENANCE = "maintenance" # Maintenance mode

@dataclass
class FeatureFlag:
    name: str
    enabled: bool
    min_level: DegradationLevel
    fallback_value: Any = None

class GracefulDegradation:
    """
    Graceful Degradation: Progressively reduce service scope during failures

    WHY:
      Even when it's not possible to perfectly provide all features,
      maintain core functionality and provide users with a minimum viable service.
      "Partially usable" is far better than "completely unavailable."

      Example: Recommendation engine fails on an e-commerce site → show popular items list
               Payment fails → still allow adding items to cart
    """

    def __init__(self):
        self.level = DegradationLevel.FULL
        self.features: Dict[str, FeatureFlag] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register("recommendation", DegradationLevel.FULL,
                      fallback={"items": [], "source": "fallback"})
        self.register("real_time_search", DegradationLevel.FULL, fallback=None)
        self.register("order_creation", DegradationLevel.DEGRADED, fallback=None)
        self.register("product_listing", DegradationLevel.MINIMAL, fallback=None)
        self.register("static_pages", DegradationLevel.MAINTENANCE, fallback=None)

    def register(self, name: str, min_level: DegradationLevel, fallback: Any = None):
        self.features[name] = FeatureFlag(
            name=name, enabled=True,
            min_level=min_level, fallback_value=fallback
        )

    def set_level(self, level: DegradationLevel):
        old = self.level
        self.level = level
        levels = list(DegradationLevel)
        current_idx = levels.index(level)

        for feature in self.features.values():
            feature_idx = levels.index(feature.min_level)
            feature.enabled = feature_idx >= current_idx

        print(f"[DEGRADATION] {old.value} → {level.value}")
        enabled = [f.name for f in self.features.values() if f.enabled]
        disabled = [f.name for f in self.features.values() if not f.enabled]
        print(f"  Enabled: {enabled}")
        print(f"  Disabled: {disabled}")

    def is_enabled(self, feature_name: str) -> bool:
        feature = self.features.get(feature_name)
        return feature.enabled if feature else False

    def get_fallback(self, feature_name: str) -> Any:
        feature = self.features.get(feature_name)
        return feature.fallback_value if feature else None


# Usage example
gd = GracefulDegradation()
gd.set_level(DegradationLevel.FULL)       # All features ON
gd.set_level(DegradationLevel.DEGRADED)   # Recommendation/search OFF, orders OK
gd.set_level(DegradationLevel.MINIMAL)    # Only product listing and static pages
```

---

## 6. Chaos Engineering

### 6.1 Principles and Procedure

Chaos engineering is a practice of intentionally injecting failures into production environments to verify system reliability.

```
Four Steps of Chaos Engineering:

  ┌─────────────────────────────────────────────────────┐
  │ Step 1: Define Steady State                         │
  │   Example: P99 latency < 200ms, error rate < 0.1%  │
  └──────────────┬──────────────────────────────────────┘
                 ▼
  ┌─────────────────────────────────────────────────────┐
  │ Step 2: Formulate Hypothesis                        │
  │   Example: "Stopping 1 App Server still keeps      │
  │             P99 < 300ms"                            │
  └──────────────┬──────────────────────────────────────┘
                 ▼
  ┌─────────────────────────────────────────────────────┐
  │ Step 3: Inject Failure (Limit Blast Radius)         │
  │   Example: Stop one instance, inject CPU load       │
  └──────────────┬──────────────────────────────────────┘
                 ▼
  ┌─────────────────────────────────────────────────────┐
  │ Step 4: Observe Results and Implement Improvements  │
  │   Example: Failover took 45s → shorten health check │
  │            interval                                 │
  └─────────────────────────────────────────────────────┘
```

### Code Example 9: Chaos Engineering Framework

```python
import asyncio
from dataclasses import dataclass, field
from typing import List, Callable, Optional
from enum import Enum

class FaultType(Enum):
    LATENCY = "latency"
    ERROR = "error"
    RESOURCE = "resource"
    NETWORK_PARTITION = "partition"

@dataclass
class ChaosExperiment:
    """Definition of a chaos experiment"""
    name: str
    fault_type: FaultType
    target: str
    duration_seconds: float
    blast_radius: float = 0.1    # Impact scope (0.0-1.0)
    latency_ms: float = 0
    error_rate: float = 0
    cpu_load: float = 0

@dataclass
class ExperimentResult:
    experiment: ChaosExperiment
    hypothesis_met: bool
    observations: List[str] = field(default_factory=list)
    metrics_before: dict = field(default_factory=dict)
    metrics_after: dict = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)

class ChaosEngine:
    """Execution engine for chaos engineering"""

    def __init__(self):
        self.experiments: List[ChaosExperiment] = []
        self.results: List[ExperimentResult] = []
        self.safety_checks: List[Callable[[], bool]] = []

    def add_safety_check(self, check: Callable[[], bool]):
        """Add a safety check (stops immediately if it returns False)"""
        self.safety_checks.append(check)

    def _check_safety(self) -> bool:
        return all(check() for check in self.safety_checks)

    async def run_experiment(
        self,
        experiment: ChaosExperiment,
        hypothesis: Callable[[], bool],
        collect_metrics: Callable[[], dict],
    ) -> ExperimentResult:
        print(f"\n{'='*60}")
        print(f"[CHAOS] Starting experiment: {experiment.name}")
        print(f"  Target: {experiment.target}")
        print(f"  Fault type: {experiment.fault_type.value}")
        print(f"  Blast radius: {experiment.blast_radius*100:.0f}%")
        print(f"{'='*60}")

        metrics_before = collect_metrics()

        if not self._check_safety():
            print("[CHAOS] Safety check failed: Aborting experiment")
            return ExperimentResult(
                experiment=experiment, hypothesis_met=False,
                observations=["Aborted due to safety check failure"],
                metrics_before=metrics_before,
            )

        print(f"[CHAOS] Injecting fault... ({experiment.duration_seconds}s)")
        await asyncio.sleep(experiment.duration_seconds)

        metrics_after = collect_metrics()
        hypothesis_met = hypothesis()

        result = ExperimentResult(
            experiment=experiment, hypothesis_met=hypothesis_met,
            metrics_before=metrics_before, metrics_after=metrics_after,
        )

        if hypothesis_met:
            print(f"[CHAOS] Hypothesis confirmed: System maintained fault tolerance")
        else:
            print(f"[CHAOS] Hypothesis not met: Improvement needed")
            result.recommendations.append(
                f"{experiment.target} needs improved {experiment.fault_type.value} tolerance"
            )

        self.results.append(result)
        return result


# Usage example
engine = ChaosEngine()
engine.add_safety_check(lambda: True)  # In production, check metrics API

experiment = ChaosExperiment(
    name="App Server Latency Tolerance Test",
    fault_type=FaultType.LATENCY,
    target="app-server-1",
    duration_seconds=300,
    blast_radius=0.1,
    latency_ms=500,
)
```

---

## 7. Comparison Tables

### Comparison Table 1: Failover Strategy Comparison

| Item | Cold | Warm | Hot |
|------|---------|---------|--------|
| Recovery Time (RTO) | Minutes to tens of minutes | Tens of seconds to minutes | Within seconds |
| Cost | Low (Standby stopped) | Moderate (Standby running slowly) | High (Standby running at full capacity) |
| Data Loss (RPO) | High (up to last backup) | Moderate (replication lag) | Near zero (synchronous replication) |
| Operational Complexity | Low | Moderate | High |
| Suitable Systems | Dev environments, batch, internal tools | General web, e-commerce | Payments, medical, finance |
| AWS Service Examples | S3 + EC2 AMI | RDS Multi-AZ (async) | Aurora Global DB (sync) |

### Comparison Table 2: Resilience Pattern Comparison

| Pattern | Purpose | Implementation Complexity | Effectiveness | Application Point |
|---------|------|-----------|------|---------|
| Circuit Breaker | Prevent failure cascades | Medium | High (prevents cascade failures) | Inter-service communication |
| Retry + Backoff | Recover from transient failures | Low | Medium (handles transient faults) | API calls |
| Bulkhead | Isolate failures | Medium | High (limits blast radius) | Thread pools, connection pools |
| Health Check | Detect failures | Low | High (early detection) | LB → Backend |
| Redundancy | Eliminate single points of failure | High | Very high | All layers |
| Graceful Degradation | Continue partial service | Medium | High (maintains UX) | Frontend integration |
| Timeout | Prevent indefinite waits | Low | Medium (releases resources) | All external communication |
| Cache Fallback | Serve data during failures | Medium | Medium (when stale data is acceptable) | Read path |

### Comparison Table 3: Chaos Engineering Tool Comparison

| Tool | Provider | Target | Features |
|--------|--------|------|------|
| Chaos Monkey | Netflix | EC2 instances | Randomly stops instances |
| Litmus | CNCF | Kubernetes | K8s-native, CRD-based |
| Gremlin | Gremlin Inc. | Multi-platform | SaaS, GUI-driven, rich safety features |
| AWS FIS | AWS | AWS resources | Integration with AWS services |
| Chaos Mesh | PingCAP | Kubernetes | K8s-focused, strong at network failures |
| Toxiproxy | Shopify | TCP connections | Network failure simulation |

---

## 8. Anti-Patterns

### Anti-Pattern 1: Retry Storm

```python
# BAD: All clients retry immediately
def bad_retry(func, max_retries=5):
    for i in range(max_retries):
        try:
            return func()
        except Exception:
            time.sleep(1)  # Fixed 1-second interval → all clients retry simultaneously
    raise Exception("Max retries exceeded")

# Diagram of the problem:
# Client 1 ──retry(1s)──retry(1s)──retry(1s)──→
# Client 2 ──retry(1s)──retry(1s)──retry(1s)──→  ← All simultaneously hit the server
# Client 3 ──retry(1s)──retry(1s)──retry(1s)──→
# Server: Load triples during an outage → unable to recover


# GOOD: Exponential backoff + jitter
import random

def good_retry(func, max_retries=5, base_delay=1.0):
    for i in range(max_retries):
        try:
            return func()
        except Exception:
            delay = base_delay * (2 ** i)          # Exponentially increase interval
            delay = random.uniform(0, delay)        # Jitter to spread out timing
            delay = min(delay, 60.0)                # Cap at 60 seconds
            time.sleep(delay)
    raise Exception("Max retries exceeded")

# Client 1 ──retry(0.7s)────────retry(2.3s)──────────→
# Client 2 ──────retry(0.3s)──────────retry(3.1s)───→  ← Retries are spread out
# Client 3 ────────retry(0.9s)────────retry(1.8s)───→
# Server: Load is distributed over time → able to recover
```

### Anti-Pattern 2: Overlooking Single Points of Failure (SPOF)

```python
# BAD: Architecture with hidden SPOFs
class BadArchitecture:
    def __init__(self):
        self.web_servers = ["web-1", "web-2", "web-3"]  # Redundant: OK
        self.load_balancer = "lb-1"    # SPOF! Only one LB
        self.config_server = "config-1" # SPOF! Only one config server
        self.dns_server = "dns-1"       # SPOF! Only one DNS server

# GOOD: Redundancy at every layer
class GoodArchitecture:
    def __init__(self):
        self.load_balancers = ["lb-active", "lb-standby"]  # VRRP/keepalived
        self.web_servers = ["web-1", "web-2", "web-3", "web-4"]  # N+1 configuration
        self.db_primary = "db-primary"
        self.db_replicas = ["db-replica-1", "db-replica-2"]
        self.config_servers = ["etcd-1", "etcd-2", "etcd-3"]  # Distributed
        self.dns_providers = ["route53", "cloudflare"]  # Multiple providers

# SPOF Checklist:
# □ Is the load balancer redundant?
# □ Does DNS use multiple providers?
# □ Is the authentication service redundant?
# □ Is configuration management distributed?
# □ Are there fallbacks for external API dependencies?
```

### Anti-Pattern 3: Not Testing for Failures

```
BAD:
Assuming "we have redundancy so we're fine" and never running a failover test

Common failure patterns:
1. A bug in the failover script causes it not to switch over
2. Standby data is stale, causing data inconsistency after switching
3. DNS TTL is too long, causing a 30-minute cutover delay
4. Alert notifications go to the wrong destination, causing the team to miss the failure

GOOD:
- Regular failover drills (monthly/quarterly)
- Continuous chaos engineering exercises
- Game Days (planned failure simulation in production)
- Automated verification scripts after failover
- Alert delivery testing (periodic tests via PagerDuty, etc.)
```

---

## 9. Hands-On Exercises

### Exercise 1 (Basic): Availability Calculation

Calculate the availability of the following system configuration.

```
Configuration:
  Internet → [DNS: 99.99%] → [CDN: 99.95%] → [LB: 99.99%]
           → [App Server x2 (99.9% each, parallel)] → [DB Primary: 99.99%]

Questions:
1. If App Servers are in a parallel configuration, what is the App tier availability?
2. What is the overall system availability (product of the series components)?
3. What is the annual downtime in minutes?
4. Which component should be improved to achieve availability of 99.99% or higher?
```

**Expected Output:**

```
1. App tier (parallel): 1 - (1-0.999)^2 = 1 - 0.000001 = 0.999999 (99.9999%)
2. Overall: 0.9999 × 0.9995 × 0.9999 × 0.999999 × 0.9999
          = 0.9992 (99.92%)
3. Annual downtime: 525960 × (1 - 0.9992) ≒ 421 minutes ≒ 7 hours
4. Bottleneck is CDN (99.95%)
   → Improve by redundant CDN or multi-CDN configuration
   → Next, redundify LB and DB
```

### Exercise 2 (Applied): Circuit Breaker State Transition Test

Using the `CircuitBreaker` class from Code Example 4 above, implement the following test cases.

```python
"""
Test cases:
1. Normal: 10 consecutive successes → stays CLOSED
2. Failure: 5 consecutive failures → transitions to OPEN
3. Recovery attempt: After 30 seconds, transitions to HALF_OPEN; 3 successes return to CLOSED
4. Recovery failure: 1 failure during HALF_OPEN → transitions back to OPEN
5. Metrics: total_calls, total_failures, total_rejections are correct
"""

def test_circuit_breaker():
    import time

    # Test 1: Normal operation
    cb = CircuitBreaker(failure_threshold=5, recovery_timeout=1.0, success_threshold=3)
    for i in range(10):
        cb.call(lambda: "ok")
    assert cb.state == CircuitState.CLOSED, "Test 1 failed"
    print("Test 1: 10 successful calls → state=CLOSED  OK")

    # Test 2: Failure
    cb2 = CircuitBreaker(failure_threshold=5, recovery_timeout=1.0)
    for i in range(5):
        try:
            cb2.call(lambda: (_ for _ in ()).throw(Exception("fail")))
        except Exception:
            pass
    assert cb2.state == CircuitState.OPEN, "Test 2 failed"
    print("Test 2: 5 failed calls → state=OPEN  OK")

    # Test 3: Recovery attempt (success)
    time.sleep(1.1)  # Wait for recovery_timeout
    for i in range(3):
        cb2.call(lambda: "ok")
    assert cb2.state == CircuitState.CLOSED, "Test 3 failed"
    print("Test 3: After timeout, 3 successes → state=CLOSED  OK")

    print("\nAll tests passed!")

test_circuit_breaker()
```

**Expected Output:**

```
Test 1: 10 successful calls → state=CLOSED  OK
[Circuit] CLOSED → OPEN: Tripped after 5 consecutive failures
Test 2: 5 failed calls → state=OPEN  OK
[Circuit] OPEN → HALF_OPEN: Starting trial
[Circuit] HALF_OPEN → CLOSED: Recovered successfully
Test 3: After timeout, 3 successes → state=CLOSED  OK

All tests passed!
```

### Exercise 3 (Advanced): Reliability Design for a Microservices Architecture

Design a reliability-maximized architecture for the following e-commerce site configuration.

```
Requirements:
- SLA: 99.95% (monthly downtime within 21.9 minutes)
- RPO: Within 1 minute (tolerate up to 1 minute of data loss)
- RTO: Within 5 minutes (restore service within 5 minutes)
- Peak traffic: 10,000 RPS

Service configuration:
1. API Gateway
2. User Service
3. Order Service
4. Payment Service (depends on external payment API)
5. Notification Service (email/SMS delivery)
6. PostgreSQL (user and order data)
7. Redis (sessions and cache)

Design tasks:
1. Summarize in a table which resilience patterns to apply to each service
2. Design a fallback strategy for Payment Service when the external API fails
3. Design a PostgreSQL configuration that satisfies RPO 1 min / RTO 5 min
4. Calculate the required availability for each component to achieve overall SLA of 99.95%
5. Propose three chaos engineering experiment plans
```

**Expected Output (summary):**

```
1. Resilience pattern application table:
   | Service         | CB | Retry | Bulkhead | Health Check | Degradation |
   |----------------|:--:|:-----:|:--------:|:-----------:|:-----------:|
   | API Gateway    |  o |   -   |    o     |      o      |      o      |
   | User Service   |  o |   o   |    -     |      o      |      -      |
   | Order Service  |  o |   o   |    o     |      o      |      -      |
   | Payment        |  o |   o   |    o     |      o      |      o      |
   | Notification   |  - |   o   |    -     |      o      |      o      |

2. Payment fallback:
   - Circuit breaker (threshold=3, timeout=30s)
   - On failure: save order with "payment pending" status
   - After recovery: process pending orders in a batch job
   - Use DLQ to manage unprocessed payments

3. PostgreSQL configuration:
   - Primary + Synchronous Replica + Async Replica
   - WAL archiving: upload to S3 every 1 minute (RPO <= 1 min)
   - Automatic failover: Patroni + etcd (RTO <= 30 seconds)

4. Availability calculation:
   For 7 components in series to achieve 99.95%:
   Each component must be >= 99.993%
   → Achieve this by making each service Active-Active redundant

5. Chaos experiments:
   (1) Inject 500ms latency into Payment external API → verify CB behavior
   (2) Force-stop DB Primary → measure failover time (< 5 min)
   (3) Stop all Redis nodes → verify DB load without cache
```

---

## 10. FAQ

### Q1: What is the difference between SLA, SLO, and SLI?

**SLI** (Service Level Indicator) is the measured value (e.g., P99 latency = 150ms, error rate = 0.02%). **SLO** (Service Level Objective) is the team's internal target (e.g., maintain P99 < 200ms for 99.9% of the time). **SLA** (Service Level Agreement) is the customer contract (e.g., a credit is issued if availability falls below 99.95%). Because SLA violations carry financial penalties, SLOs are typically set stricter than SLAs. By continuously measuring SLIs and managing the difference from SLOs as an "error budget," teams can balance reliability and development velocity.

### Q2: What is chaos engineering, and what should I watch out for when practicing it?

Chaos engineering is the practice of intentionally injecting failures into production environments to verify system reliability. Netflix's "Chaos Monkey," which randomly stops instances to test fault tolerance, is a well-known example. The procedure is: (1) define steady state, (2) formulate a hypothesis, (3) inject a failure, and (4) observe results and improve.

Key precautions: limit the blast radius (start with 1% of traffic), define safety stop conditions in advance (auto-stop if error rate exceeds a threshold), run experiments during business hours (so issues can be addressed immediately), and notify the entire team beforehand (to avoid confusing intentional failures with real ones).

### Q3: What is the difference between RPO and RTO?

**RPO** (Recovery Point Objective) indicates "to what point in time data can be restored." For example, an RPO of 1 hour means up to 1 hour of data may be lost in the event of a failure. **RTO** (Recovery Time Objective) indicates "how long it takes from a failure to service restoration." For example, an RTO of 15 minutes means service must be restored within 15 minutes. RPO is controlled by backup frequency and replication method; RTO is controlled by the failover approach.

### Q4: What is an error budget?

An error budget is a quantitative representation of the "slack" in an SLO target. For example, if the SLO is 99.9%, downtime of 0.1% of the time (about 43 minutes per month) is acceptable. Those 43 minutes are the error budget. When budget remains, risky new features can be released; when it is exhausted, releases are frozen and the team focuses on improving reliability. This approach allows the trade-off between reliability and development velocity to be managed quantitatively.

### Q5: Can "exactly-once" processing be achieved in a distributed system?

Strictly speaking, "exactly-once" is extremely difficult to achieve in distributed systems. Due to network failures and process crashes, duplicate message delivery is unavoidable. The practical approach is a combination of "at-least-once" delivery and "idempotent processing." Concretely, assign a unique ID to each request and record processed IDs to detect duplicates.

### Q6: What are the key points of reliability design in a multi-region configuration?

In a multi-region configuration, the main considerations are: (1) data synchronization method (synchronous replication increases latency; asynchronous replication risks data loss), (2) conflict resolution (how to handle simultaneous writes to the same data in Active-Active), (3) failover trigger (detecting a regional-wide failure is difficult), and (4) DNS switchover time (TTL settings). On AWS, Route 53 health checks with failover routing is the common approach; on Azure, Traffic Manager is typically used.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important. Understanding deepens not just through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Jumping to advanced topics before mastering the basics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| Definition of reliability | The ability to continue functioning correctly even when failures occur. Prevent Fault → Failure escalation |
| Availability calculation | Series = product (decreases); Parallel = 1-(product of unavailabilities) (increases) |
| SLA/SLO/SLI | Three-layer management: SLI (measured) → SLO (internal target) → SLA (customer contract) |
| Redundancy | Eliminate SPOFs with Active-Passive / Active-Active / N+1 |
| Circuit Breaker | CLOSED→OPEN→HALF_OPEN prevents cascade failures |
| Retry strategy | Exponential backoff + Full Jitter distributes load |
| Bulkhead | Isolate resources to limit the blast radius of failures |
| Graceful Degradation | Progressively reduce service scope rather than a complete outage |
| Chaos Engineering | Continuously verify reliability through intentional fault injection |
| Error Budget | Quantitatively manage the balance between reliability and development velocity |

---

## What to Read Next

- [CAP Theorem](./03-cap-theorem.md) -- Trade-offs between consistency, availability, and partition tolerance in distributed systems
- [Load Balancer](../01-components/00-load-balancer.md) -- Designing redundant traffic distribution
- [Message Queue](../01-components/02-message-queue.md) -- Improving reliability and handling backpressure with asynchronous processing
- [Monolith vs Microservices](../02-architecture/00-monolith-vs-microservices.md) -- Service decomposition and fault isolation design
- Design Patterns -- Event-driven patterns such as Observer

---

## References

1. Nygard, M.T. (2018). *Release It!: Design and Deploy Production-Ready Software*, 2nd Edition. Pragmatic Bookshelf. -- The canonical reference for resilience patterns such as circuit breakers and bulkheads
2. Rosenthal, C. & Jones, N. (2020). *Chaos Engineering: System Resiliency in Practice*. O'Reilly Media. -- A systematic guide to chaos engineering
3. Beyer, B. et al. (2016). *Site Reliability Engineering*. O'Reilly Media. https://sre.google/sre-book/ -- Google's SRE practices (SLI/SLO/SLA, error budgets)
4. Kleppmann, M. (2017). *Designing Data-Intensive Applications*, Chapter 8: The Trouble with Distributed Systems. O'Reilly Media. -- Failure models and reliability design for distributed systems
5. Burns, B. (2018). *Designing Distributed Systems*. O'Reilly Media. -- A catalog of distributed systems patterns
