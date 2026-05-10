# Monitoring / Logging

> A systematic study of the foundations of security monitoring: SIEM-based log aggregation and correlation analysis, effective log collection architectures, and anomaly detection techniques

## Prerequisites

The following knowledge is required to understand this guide:

- Basic networking knowledge (TCP/IP, DNS, HTTP)
- Basic Linux operations (fundamentals of syslog and systemd)
- Basic concepts of cloud services (AWS)
- Understanding of JSON format

Related guides: [Security Principles](../00-basics/02-security-principles.md) | [Cloud Security Basics](../05-cloud-security/00-cloud-security-basics.md)

## What You Will Learn

1. **How SIEM Works and How to Use It** — Mechanisms for log aggregation, correlation analysis, and alert generation
2. **Log Aggregation Architecture** — Design for log collection, storage, and search at scale
3. **Anomaly Detection** — Rule-based and machine learning-based detection techniques
4. **Dashboard Design** — Principles for effective security visualization
5. **Operational Best Practices** — Log rotation, retention policies, and performance tuning

---

## 1. Overview of Security Monitoring

### Why Security Monitoring Is Necessary

Security monitoring is the foundation for achieving three objectives: attack detection, incident investigation, and compliance evidence collection. NIST SP 800-92 positions log management as an important component of information security.

A system without monitoring is equivalent to "driving with your eyes closed." The average attacker dwell time is approximately 200 days in industry averages, and without early detection, damage continues to escalate.

### Monitoring Architecture

```
+----------------------------------------------------------+
|                    Data Sources                          |
|----------------------------------------------------------|
|  OS Logs    | App Logs    | Network      | Cloud         |
|  (syslog,   | (stdout,   | (VPC Flow,   | (CloudTrail,  |
|   auditd)   |  JSON)     |  pcap)       |  GuardDuty)   |
+----------------------------------------------------------+
          |            |            |            |
          v            v            v            v
+----------------------------------------------------------+
|              Log Collection / Forwarding Layer           |
|  Fluentd / Fluent Bit / Vector / CloudWatch Agent        |
+----------------------------------------------------------+
          |
          v
+----------------------------------------------------------+
|              Log Storage / Indexing Layer                |
|  +-- Hot:  OpenSearch / Elasticsearch (last 30 days)    |
|  +-- Warm: S3 + Athena (30-365 days)                    |
|  +-- Cold: S3 Glacier (365+ days)                       |
+----------------------------------------------------------+
          |
          v
+----------------------------------------------------------+
|              Analysis / Detection Layer (SIEM)           |
|  +-- Rule-Based Detection (Correlation Rules)            |
|  +-- Machine Learning-Based Anomaly Detection            |
|  +-- Dashboards / Visualization                          |
|  +-- Alert Generation → PagerDuty / Slack               |
+----------------------------------------------------------+
```

### The Three Layers of Monitoring

When designing security monitoring, the following three layers must be considered:

```
+----------------------------------------------------------+
|                   Three-Layer Monitoring Model           |
|----------------------------------------------------------|
|                                                          |
|  Layer 1: Collection                                     |
|  +-- Purpose: Collect and forward raw data              |
|  +-- Tools: Fluent Bit, Vector, CloudWatch Agent        |
|  +-- Challenges: Data volume control, network bandwidth |
|  +-- Design Principle: "As fast as possible, as complete as possible" |
|                                                          |
|  Layer 2: Storage                                        |
|  +-- Purpose: Log storage, indexing, and searchability  |
|  +-- Tools: OpenSearch, S3, Glacier                     |
|  +-- Challenges: Cost optimization, retention management|
|  +-- Design Principle: "Cost optimization via tiered storage" |
|                                                          |
|  Layer 3: Analytics                                      |
|  +-- Purpose: Correlation analysis, anomaly detection, visualization |
|  +-- Tools: SIEM, ML engine, dashboards                 |
|  +-- Challenges: Controlling false positives, preventing alert fatigue |
|  +-- Design Principle: "Only alerts that lead to action" |
+----------------------------------------------------------+
```

### Log Classification and Priority Matrix

```
+----------------------------------------------------------+
|             Log Classification Matrix                    |
|----------------------------------------------------------|
|                                                          |
|      High Frequency  +-----------+-----------+          |
|                      | Auth Logs | App       |          |
|                      | (Critical)| Access    |          |
|                      |           | Logs      |          |
|                      +-----------+-----------+          |
|                      | Network   | Debug     |          |
|                      | Flow      | Logs      |          |
|      Low Frequency   | Logs      | (Low Pri) |          |
|                      +-----------+-----------+          |
|                       High Security  Low Security        |
|                       Value          Value               |
|                                                          |
|  Priority: Auth Logs > Net Flow > App Logs > Debug       |
+----------------------------------------------------------+
```

---

## 2. Log Collection Design

### Logs to Collect

| Log Source | Content | Retention | Priority | Format |
|-----------|------|---------|--------|------------|
| CloudTrail | AWS API calls | 1+ year | Required | JSON |
| VPC Flow Logs | Network flow | 90 days | Required | Text/Parquet |
| ALB/NLB Access Logs | HTTP requests | 90 days | Required | Text |
| GuardDuty Findings | Threat detection results | 90 days | Required | JSON |
| OS syslog/auditd | OS-level events | 90 days | High | syslog |
| Application Logs | Application behavior | 30-90 days | High | JSON |
| DNS Query Logs | DNS queries | 30 days | Medium | JSON |
| WAF Logs | WAF judgment results | 30 days | Medium | JSON |
| S3 Access Logs | S3 operation logs | 90 days | Medium | Text |
| RDS Audit Logs | DB operation logs | 90 days | High | Text |
| Lambda Logs | Function execution logs | 30 days | Medium | JSON |
| Config Changes | Configuration change history | 1+ year | Required | JSON |

### Structured Log Format

Structured logging dramatically improves log searchability and analyzability. The following is the recommended format:

```json
{
  "timestamp": "2025-03-15T14:30:00.000Z",
  "level": "WARN",
  "service": "auth-service",
  "version": "2.1.0",
  "environment": "production",
  "traceId": "abc-123-def",
  "spanId": "span-456",
  "requestId": "req-456",
  "event": "login_failed",
  "userId": "user-789",
  "sourceIp": "203.0.113.50",
  "userAgent": "Mozilla/5.0...",
  "geoLocation": {
    "country": "JP",
    "region": "Tokyo"
  },
  "details": {
    "reason": "invalid_password",
    "attemptCount": 5,
    "accountLocked": false,
    "mfaEnabled": true
  },
  "metadata": {
    "hostname": "auth-pod-abc123",
    "containerId": "docker-xyz",
    "kubernetes": {
      "namespace": "production",
      "pod": "auth-service-7b9f4d-abc12"
    }
  }
}
```

### Structured Logging Implementation (Python)

```python
# Code Example 1: Structured logging library implementation
import json
import logging
import sys
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from contextvars import ContextVar
import uuid

# Hold request context in a thread-safe manner
_request_context: ContextVar[Dict[str, Any]] = ContextVar(
    'request_context', default={}
)

class StructuredLogFormatter(logging.Formatter):
    """Structured log formatter

    Outputs logs in JSON format and automatically attaches
    context information such as trace ID and request ID.

    The following information is particularly important for security logs:
    - timestamp: ISO 8601 timestamp in UTC
    - sourceIp: IP address of the request origin
    - userId: ID of the user who performed the operation
    - event: Type of security event
    """

    # Sensitive fields that must not be included in logs
    SENSITIVE_FIELDS = {
        'password', 'secret', 'token', 'api_key',
        'credit_card', 'ssn', 'cvv', 'pin',
        'authorization', 'cookie', 'session_id',
    }

    def __init__(self, service_name: str, environment: str):
        super().__init__()
        self.service_name = service_name
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "environment": self.environment,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add request context
        ctx = _request_context.get()
        if ctx:
            log_entry.update({
                "traceId": ctx.get("trace_id"),
                "requestId": ctx.get("request_id"),
                "userId": ctx.get("user_id"),
                "sourceIp": ctx.get("source_ip"),
            })

        # Process additional fields (mask sensitive data)
        if hasattr(record, 'extra_fields'):
            sanitized = self._sanitize(record.extra_fields)
            log_entry["details"] = sanitized

        # Add exception information
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "stacktrace": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_entry, ensure_ascii=False, default=str)

    def _sanitize(self, data: Any) -> Any:
        """Mask sensitive data"""
        if isinstance(data, dict):
            return {
                k: "***REDACTED***" if k.lower() in self.SENSITIVE_FIELDS
                else self._sanitize(v)
                for k, v in data.items()
            }
        elif isinstance(data, list):
            return [self._sanitize(item) for item in data]
        return data


class SecurityLogger:
    """Logger dedicated to security events"""

    def __init__(self, service_name: str, environment: str = "production"):
        self.logger = logging.getLogger(f"security.{service_name}")
        self.logger.setLevel(logging.INFO)

        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            StructuredLogFormatter(service_name, environment)
        )
        self.logger.addHandler(handler)

    def log_auth_event(self, event: str, user_id: str,
                       success: bool, **kwargs):
        """Log an authentication event"""
        record = self.logger.makeRecord(
            self.logger.name, logging.INFO, "", 0,
            f"Authentication event: {event}", (), None
        )
        record.extra_fields = {
            "event_type": "authentication",
            "event": event,
            "user_id": user_id,
            "success": success,
            **kwargs,
        }
        self.logger.handle(record)

    def log_access_event(self, resource: str, action: str,
                         allowed: bool, **kwargs):
        """Log an access control event"""
        level = logging.INFO if allowed else logging.WARNING
        record = self.logger.makeRecord(
            self.logger.name, level, "", 0,
            f"Access event: {action} on {resource}", (), None
        )
        record.extra_fields = {
            "event_type": "access_control",
            "resource": resource,
            "action": action,
            "allowed": allowed,
            **kwargs,
        }
        self.logger.handle(record)

    def log_data_event(self, operation: str, data_type: str,
                       record_count: int, **kwargs):
        """Log a data operation event"""
        record = self.logger.makeRecord(
            self.logger.name, logging.INFO, "", 0,
            f"Data event: {operation} on {data_type}", (), None
        )
        record.extra_fields = {
            "event_type": "data_operation",
            "operation": operation,
            "data_type": data_type,
            "record_count": record_count,
            **kwargs,
        }
        self.logger.handle(record)


# Usage example
sec_logger = SecurityLogger("auth-service")
sec_logger.log_auth_event(
    event="login_failed",
    user_id="user-789",
    success=False,
    reason="invalid_password",
    attempt_count=5,
    source_ip="203.0.113.50",
)
```

### Fluent Bit Configuration

```ini
# /etc/fluent-bit/fluent-bit.conf

[SERVICE]
    Flush         5
    Daemon        Off
    Log_Level     info
    Parsers_File  parsers.conf
    # Expose metrics (Prometheus format)
    HTTP_Server   On
    HTTP_Listen   0.0.0.0
    HTTP_Port     2020
    # Buffer management
    storage.path              /var/log/fluent-bit/buffer/
    storage.sync              normal
    storage.checksum          off
    storage.backlog.mem_limit 50M

# Application logs
[INPUT]
    Name              tail
    Path              /var/log/app/*.log
    Parser            json
    Tag               app.*
    Refresh_Interval  5
    Mem_Buf_Limit     50MB
    # Persist buffer to file (prevent data loss)
    storage.type      filesystem
    Skip_Long_Lines   On
    DB                /var/log/fluent-bit/app.db

# OS syslog
[INPUT]
    Name              systemd
    Tag               system.*
    Systemd_Filter    _SYSTEMD_UNIT=sshd.service
    Read_From_Tail    On

# Attach Kubernetes metadata
[FILTER]
    Name              kubernetes
    Match             app.*
    Kube_URL          https://kubernetes.default.svc
    Kube_CA_File      /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    Kube_Token_File   /var/run/secrets/kubernetes.io/serviceaccount/token
    Merge_Log         On

# Add metadata
[FILTER]
    Name              record_modifier
    Match             *
    Record hostname   ${HOSTNAME}
    Record env        production
    Record cluster    prod-ap-northeast-1

# Mask sensitive data
[FILTER]
    Name              lua
    Match             app.*
    script            /etc/fluent-bit/scripts/mask_sensitive.lua
    call              mask_fields

# Send to OpenSearch
[OUTPUT]
    Name              opensearch
    Match             app.*
    Host              opensearch.internal.example.com
    Port              443
    TLS               On
    Index             app-logs
    Type              _doc
    Suppress_Type_Name On
    Logstash_Format   On
    Logstash_Prefix   app-logs
    # Retry settings
    Retry_Limit       5
    # Buffering
    Buffer_Size       512KB
    # Authentication
    HTTP_User         fluent-bit
    HTTP_Passwd       ${OPENSEARCH_PASSWORD}

# Back up to S3
[OUTPUT]
    Name              s3
    Match             *
    bucket            security-logs-archive
    region            ap-northeast-1
    total_file_size   100M
    upload_timeout    10m
    s3_key_format     /logs/%Y/%m/%d/$TAG/%H-%M-%S
    # Compression
    compression       gzip
    # Server-side encryption
    use_put_object    On
```

### Fluent Bit Sensitive Data Masking Script

```lua
-- /etc/fluent-bit/scripts/mask_sensitive.lua
-- Mask sensitive data before log output

local sensitive_patterns = {
    -- Credit card number (16 digits)
    {pattern = "%d%d%d%d[- ]?%d%d%d%d[- ]?%d%d%d%d[- ]?%d%d%d%d",
     replacement = "****-****-****-XXXX"},
    -- Email address
    {pattern = "[%w%.%-]+@[%w%.%-]+%.%w+",
     replacement = "***@***.***"},
    -- AWS access key
    {pattern = "AKIA[0-9A-Z]%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d",
     replacement = "AKIA****************"},
}

function mask_fields(tag, timestamp, record)
    local modified = false
    for key, value in pairs(record) do
        if type(value) == "string" then
            for _, pat in ipairs(sensitive_patterns) do
                local new_value = string.gsub(value, pat.pattern,
                                              pat.replacement)
                if new_value ~= value then
                    record[key] = new_value
                    modified = true
                end
            end
        end
    end
    if modified then
        return 1, timestamp, record
    end
    return 0, timestamp, record
end
```

### High-Performance Log Collection with Vector

As an alternative to Fluent Bit, Vector — written in Rust — is characterized by high performance and flexible configuration.

```toml
# /etc/vector/vector.toml

[api]
enabled = true
address = "127.0.0.1:8686"

# Source: application logs
[sources.app_logs]
type = "file"
include = ["/var/log/app/*.log"]
read_from = "beginning"

# Source: Kubernetes logs
[sources.k8s_logs]
type = "kubernetes_logs"
auto_partial_merge = true

# Transform: JSON parsing
[transforms.parse_json]
type = "remap"
inputs = ["app_logs"]
source = '''
. = parse_json!(string!(.message))
.timestamp = to_timestamp!(.timestamp)
.environment = "production"
.cluster = "prod-ap-northeast-1"
'''

# Transform: Redact sensitive data
[transforms.redact_sensitive]
type = "remap"
inputs = ["parse_json"]
source = '''
if exists(.details.password) {
    .details.password = "***REDACTED***"
}
if exists(.details.token) {
    .details.token = "***REDACTED***"
}
# Mask credit card numbers
if exists(.details.card_number) {
    card = string!(.details.card_number)
    .details.card_number = "****-****-****-" + slice!(card, -4)
}
'''

# Transform: Filter security events
[transforms.security_filter]
type = "filter"
inputs = ["redact_sensitive"]
condition = '''
.level == "ERROR" || .level == "WARN" ||
.event_type == "authentication" ||
.event_type == "access_control"
'''

# Sink: OpenSearch
[sinks.opensearch]
type = "elasticsearch"
inputs = ["redact_sensitive"]
endpoints = ["https://opensearch.internal.example.com:443"]
bulk.index = "app-logs-%Y-%m-%d"
auth.strategy = "basic"
auth.user = "vector"
auth.password = "${OPENSEARCH_PASSWORD}"

# Sink: Security events to dedicated index
[sinks.security_opensearch]
type = "elasticsearch"
inputs = ["security_filter"]
endpoints = ["https://opensearch.internal.example.com:443"]
bulk.index = "security-events-%Y-%m-%d"

# Sink: S3 archive
[sinks.s3_archive]
type = "aws_s3"
inputs = ["redact_sensitive"]
bucket = "security-logs-archive"
region = "ap-northeast-1"
key_prefix = "logs/%Y/%m/%d/"
compression = "gzip"
encoding.codec = "json"
```

### Log Collection Agent Comparison

| Item | Fluent Bit | Fluentd | Vector | CloudWatch Agent |
|------|-----------|---------|--------|-----------------|
| Language | C | Ruby/C | Rust | Go |
| Memory usage | ~1MB | ~40MB | ~10MB | ~30MB |
| Throughput | High | Medium | Very High | Medium |
| Number of plugins | Medium | Many | Medium | Few |
| Kubernetes support | Good | Good | Good | Limited |
| Configuration flexibility | Medium | High | High | Low |
| Use case | Edge/Container | Server aggregation | General purpose | AWS only |

---

## 3. SIEM

### How SIEM Works Internally

SIEM (Security Information and Event Management) is a platform that consistently performs log aggregation, normalization, correlation analysis, and alert generation.

```
+----------------------------------------------------------+
|                SIEM Internal Processing Flow             |
|----------------------------------------------------------|
|                                                          |
|  1. Collection                                           |
|  +-- Syslog, API, Agent, Filebeat                       |
|       |                                                  |
|       v                                                  |
|  2. Parsing & Normalization                              |
|  +-- Convert different formats to a common schema       |
|  +-- ECS (Elastic Common Schema)                        |
|  +-- OCSF (Open Cybersecurity Schema Framework)         |
|       |                                                  |
|       v                                                  |
|  3. Enrichment                                           |
|  +-- Attach GeoIP information                           |
|  +-- Cross-reference with threat intelligence           |
|  +-- Attach user/asset information                      |
|       |                                                  |
|       v                                                  |
|  4. Indexing & Storage                                   |
|  +-- Build full-text search index                       |
|  +-- Optimize time-series data                          |
|       |                                                  |
|       v                                                  |
|  5. Correlation                                          |
|  +-- Rule-based matching                                |
|  +-- Statistical anomaly detection                      |
|  +-- Machine learning models                            |
|       |                                                  |
|       v                                                  |
|  6. Alerting & Response                                  |
|  +-- Automated ticket creation                          |
|  +-- SOAR integration (automated response)              |
|  +-- Dashboard updates                                  |
+----------------------------------------------------------+
```

### SIEM Tool Comparison

| Item | Splunk | Elastic SIEM | Amazon Security Lake | Datadog SIEM | Sumo Logic |
|------|--------|-------------|---------------------|-------------|-----------|
| Deployment | On-prem/SaaS | On-prem/Cloud | SaaS (AWS) | SaaS | SaaS |
| Cost | High (data volume billing) | OSS edition available | S3 storage volume | Moderate | Moderate |
| Correlation analysis | Advanced (SPL) | KQL | Athena (SQL) | Log pipeline | CSE |
| Machine learning | MLTK | ML Jobs | -- | Anomaly Detection | CSE Insight |
| Custom rules | SPL | Detection Rules | Lambda | Detection Rules | CSE Rules |
| Scalability | High | Medium-High | High (S3-based) | High | High |
| Initial learning cost | High | Medium | Low-Medium | Low | Medium |
| SOAR integration | Splunk SOAR | Elastic SOAR | Step Functions | Workflow | SOAR integration |

### Cost Comparison (Assuming 100GB of monthly log ingestion)

| Item | Splunk Cloud | Elastic Cloud | Amazon Security Lake | Datadog SIEM |
|------|-------------|--------------|---------------------|-------------|
| Estimated monthly cost | $4,500-6,000 | $1,500-3,000 | $500-1,000 | $2,000-3,500 |
| Billing model | GB/day | Node count + storage | S3 storage + query | GB/month |
| Free tier | None | 14-day trial | S3 only | 15-day trial |
| Long-term storage cost | High | Moderate | Very low | Moderate |

### Creating Detection Rules (Sigma Rules)

Sigma is a common format for sharing detection rules between SIEMs. Just as YARA is a common format for malware detection, Sigma is positioned as a common format for log detection.

```yaml
# sigma/rules/credential_access/brute_force_ssh.yml
title: SSH Brute Force Attack
id: a1234567-b890-1234-cdef-567890abcdef
status: stable
description: Detect a large number of SSH login failures from the same IP in a short period
author: Security Team
date: 2025/01/15
modified: 2025/03/15
tags:
  - attack.credential_access
  - attack.t1110.001
  - cve.none
references:
  - https://attack.mitre.org/techniques/T1110/001/
logsource:
  category: authentication
  product: linux
detection:
  selection:
    eventid: 'sshd'
    action: 'Failed'
  filter:
    source_ip|cidr:
      - '10.0.0.0/8'
      - '172.16.0.0/12'
  timeframe: 5m
  condition: selection and not filter | count(source_ip) > 10
level: high
falsepositives:
  - Legitimate password reset operations
  - Misconfigured automation scripts
```

```yaml
# sigma/rules/persistence/new_iam_user.yml
title: AWS IAM User Created
id: b2345678-c901-2345-defg-678901bcdefg
status: stable
description: Detect the creation of a new IAM user (a sign of persistence after unauthorized access)
author: Security Team
date: 2025/02/01
tags:
  - attack.persistence
  - attack.t1136.003
logsource:
  product: aws
  service: cloudtrail
detection:
  selection:
    eventName: 'CreateUser'
    eventSource: 'iam.amazonaws.com'
  filter_automation:
    userIdentity.arn|contains:
      - 'terraform'
      - 'cloudformation'
  condition: selection and not filter_automation
level: medium
falsepositives:
  - Legitimate user creation via IaC
  - Onboarding operations
```

```yaml
# sigma/rules/exfiltration/large_s3_download.yml
title: Large S3 Data Download
id: c3456789-d012-3456-efgh-789012cdefgh
status: experimental
description: Detect mass data downloads from S3 buckets
author: Security Team
date: 2025/03/01
tags:
  - attack.exfiltration
  - attack.t1530
logsource:
  product: aws
  service: cloudtrail
detection:
  selection:
    eventName: 'GetObject'
    eventSource: 's3.amazonaws.com'
  timeframe: 1h
  condition: selection | count(requestParameters.bucketName) > 1000
level: high
falsepositives:
  - Backup jobs
  - Data migration operations
  - Legitimate mass download processing
```

### Converting Sigma Rules to Each SIEM

```bash
# Convert to each SIEM's query format using Sigma CLI
pip install sigma-cli

# Check available backends
sigma list backends

# Convert to Splunk SPL
sigma convert -t splunk -p sysmon sigma/rules/

# Convert to Elastic EQL
sigma convert -t elasticsearch sigma/rules/

# Convert to OpenSearch
sigma convert -t opensearch sigma/rules/

# Convert to Microsoft Sentinel KQL
sigma convert -t microsoft365defender sigma/rules/

# Conversion example (Splunk SPL):
# source=sshd action="Failed"
# NOT (source_ip="10.0.0.0/8" OR source_ip="172.16.0.0/12")
# | stats count by source_ip
# | where count > 10

# Batch conversion and testing
sigma convert -t splunk sigma/rules/ -o splunk_rules/
sigma check sigma/rules/  # Syntax check for rules
```

### Correlation Rule Implementation Example

```python
# Code Example 2: SIEM correlation rule implementation (conceptual)
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from collections import defaultdict
import heapq

@dataclass
class LogEvent:
    """Common structure for log events"""
    timestamp: datetime
    source: str
    event_type: str
    severity: str
    source_ip: str
    user_id: Optional[str] = None
    details: Dict = field(default_factory=dict)

@dataclass
class Alert:
    """Alert from correlation analysis results"""
    rule_id: str
    title: str
    severity: str
    description: str
    events: List[LogEvent]
    created_at: datetime = field(
        default_factory=lambda: datetime.utcnow()
    )
    mitre_tactic: Optional[str] = None
    mitre_technique: Optional[str] = None

class CorrelationEngine:
    """SIEM correlation analysis engine

    Analyzes multiple log events in time series,
    detecting attack patterns that cannot be detected
    from individual events alone.

    Internal operation:
    1. Buffer events in chronological order
    2. Run matching against each correlation rule
    3. Generate alert when threshold is exceeded
    4. Perform deduplication and priority calculation
    """

    def __init__(self, window_minutes: int = 60):
        self.window = timedelta(minutes=window_minutes)
        self.event_buffer: List[LogEvent] = []
        self.rules: List[callable] = []
        self.alerts: List[Alert] = []
        # Event counter per rule
        self._counters: Dict[str, Dict] = defaultdict(
            lambda: defaultdict(int)
        )

    def add_event(self, event: LogEvent) -> List[Alert]:
        """Add event and check correlation rules"""
        self.event_buffer.append(event)
        self._cleanup_old_events()

        new_alerts = []
        for rule in self.rules:
            alert = rule(event, self.event_buffer)
            if alert:
                # Deduplicate alerts
                if not self._is_duplicate(alert):
                    new_alerts.append(alert)
                    self.alerts.append(alert)

        return new_alerts

    def _cleanup_old_events(self):
        """Delete old events outside the window"""
        cutoff = datetime.utcnow() - self.window
        self.event_buffer = [
            e for e in self.event_buffer
            if e.timestamp > cutoff
        ]

    def _is_duplicate(self, alert: Alert) -> bool:
        """Treat alerts with the same rule ID within the past hour as duplicates"""
        cutoff = datetime.utcnow() - timedelta(hours=1)
        return any(
            a.rule_id == alert.rule_id and a.created_at > cutoff
            for a in self.alerts
        )

    def register_rule(self, rule_func: callable):
        """Register a correlation rule"""
        self.rules.append(rule_func)


def brute_force_rule(event: LogEvent,
                     buffer: List[LogEvent]) -> Optional[Alert]:
    """Brute force detection rule

    Detect 10 or more login failures from the same IP within 5 minutes
    """
    if event.event_type != "login_failed":
        return None

    window = timedelta(minutes=5)
    cutoff = event.timestamp - window

    failed_from_same_ip = [
        e for e in buffer
        if e.event_type == "login_failed"
        and e.source_ip == event.source_ip
        and e.timestamp > cutoff
    ]

    if len(failed_from_same_ip) >= 10:
        return Alert(
            rule_id="BRUTE_FORCE_001",
            title=f"Brute Force Attack Detected: {event.source_ip}",
            severity="HIGH",
            description=(
                f"{len(failed_from_same_ip)} login failures from"
                f" IP {event.source_ip} within 5 minutes"
            ),
            events=failed_from_same_ip,
            mitre_tactic="Credential Access",
            mitre_technique="T1110.001",
        )
    return None


def impossible_travel_rule(event: LogEvent,
                           buffer: List[LogEvent]) -> Optional[Alert]:
    """Impossible travel detection rule

    Detect logins from geographically distant locations within a short time
    """
    if event.event_type != "login_success":
        return None

    window = timedelta(hours=1)
    cutoff = event.timestamp - window

    recent_logins = [
        e for e in buffer
        if e.event_type == "login_success"
        and e.user_id == event.user_id
        and e.timestamp > cutoff
        and e.source_ip != event.source_ip
    ]

    for prev_login in recent_logins:
        # Calculate geographic distance (implementation omitted)
        distance = calculate_geo_distance(
            prev_login.details.get("geo"),
            event.details.get("geo"),
        )
        time_diff = (event.timestamp - prev_login.timestamp).total_seconds()

        # Movement at over 1000 km/h is deemed impossible
        if distance > 0 and time_diff > 0:
            speed_kmh = (distance / time_diff) * 3600
            if speed_kmh > 1000:
                return Alert(
                    rule_id="IMPOSSIBLE_TRAVEL_001",
                    title=f"Impossible Travel Detected: {event.user_id}",
                    severity="HIGH",
                    description=(
                        f"User {event.user_id} traveled"
                        f" {distance:.0f}km in"
                        f" {time_diff/60:.0f} minutes"
                    ),
                    events=[prev_login, event],
                    mitre_tactic="Initial Access",
                    mitre_technique="T1078",
                )
    return None


# Engine usage example
engine = CorrelationEngine(window_minutes=60)
engine.register_rule(brute_force_rule)
engine.register_rule(impossible_travel_rule)
```

---

## 4. Anomaly Detection

### Rule-Based vs. Machine Learning-Based

```
+----------------------------------------------------------+
|          Detailed Comparison of Anomaly Detection Approaches |
|----------------------------------------------------------|
|                                                          |
|  Rule-Based Detection:                                   |
|  +-- Effective against known attack patterns             |
|  +-- Easy to control false positives                    |
|  +-- Cannot handle new attack patterns                  |
|  +-- Example: "10+ SSH login failures within 5 minutes" |
|  +-- Advantage: Highly transparent, easy to tune        |
|  +-- Disadvantage: Cannot detect unknown threats        |
|                                                          |
|  Statistics-Based Detection:                            |
|  +-- Calculate standard deviations from baseline        |
|  +-- Relatively simple model                            |
|  +-- Example: "API call count 3 sigma above average"   |
|  +-- Advantage: Easy to interpret, low computation cost |
|  +-- Disadvantage: Requires handling seasonal variation |
|                                                          |
|  Machine Learning-Based Detection:                      |
|  +-- Detect deviations from baseline                    |
|  +-- Can handle unknown attack patterns                 |
|  +-- Requires tuning of false positives                 |
|  +-- Example: "Unusual data transfer pattern"           |
|  +-- Advantage: Automatically learns complex patterns   |
|  +-- Disadvantage: Risk of becoming a black box         |
+----------------------------------------------------------+
```

### Detection Method Comparison Table

| Item | Rule-Based | Statistics-Based | Unsupervised ML | Supervised ML |
|------|-----------|----------|----------|----------|
| Detection target | Known attacks | Abnormal statistics | Unknown anomalies | Known attacks + similar |
| Learning period | Not required | 1-2 weeks | 2-4 weeks | Large training dataset |
| False positive rate | Low | Moderate | High | Low-Medium |
| False negative rate | High (unknown attacks) | Moderate | Low | Moderate |
| Operational cost | Low | Low | High | High |
| Explainability | High | High | Low | Moderate |
| Use case | Compliance | Performance monitoring | Insider threat detection | Malware detection |

### Anomaly Patterns to Detect

```
+----------------------------------------------------------+
|            Security Anomaly Detection Patterns           |
|----------------------------------------------------------|
|                                                          |
|  [Authentication / Access]                               |
|  +-- Mass login failures in a short time (Brute Force)  |
|  +-- Access at unusual times                            |
|  +-- Geographically impossible logins (Impossible Travel)|
|  +-- Privilege escalation attempts                      |
|  +-- Unusual user agents                               |
|  +-- Access on holidays or late at night               |
|                                                          |
|  [Data]                                                  |
|  +-- Mass data transfer to external hosts (Exfiltration)|
|  +-- Unusual DB query patterns                          |
|  +-- Abnormal frequency of access to sensitive data     |
|  +-- Unexpected access to backup data                  |
|  +-- Database schema changes                           |
|                                                          |
|  [Network]                                              |
|  +-- C2 communication patterns (beaconing)              |
|  +-- DNS tunneling                                      |
|  +-- Port scanning                                      |
|  +-- Lateral movement within internal network           |
|  +-- Communication using normally unused protocols      |
|  +-- Sudden spike in encrypted traffic                 |
|                                                          |
|  [System]                                               |
|  +-- Abnormal process behavior                          |
|  +-- Mass file encryption (ransomware)                  |
|  +-- Configuration changes (disabling CloudTrail, etc.) |
|  +-- Unexpected service startup                         |
|  +-- Kernel module loading                              |
+----------------------------------------------------------+
```

### CloudWatch Metric Filter + Alarms

```python
# Code Example 3: Automated construction of anomaly detection with CloudWatch
import boto3
import json

logs = boto3.client('logs')
cloudwatch = boto3.client('cloudwatch')
sns = boto3.client('sns')

class SecurityAlarmBuilder:
    """Automated construction of CloudWatch security alarms

    Built following these best practices:
    - Only alert on important security events
    - Adjust thresholds to match the characteristics of the environment
    - Separate notification destinations by severity
    """

    def __init__(self, log_group: str, sns_topic_arn: str):
        self.log_group = log_group
        self.sns_topic_arn = sns_topic_arn

    def create_root_account_alarm(self):
        """Detect root account usage"""
        logs.put_metric_filter(
            logGroupName=self.log_group,
            filterName='RootAccountUsage',
            filterPattern=(
                '{ $.userIdentity.type = "Root" '
                '&& $.userIdentity.invokedBy NOT EXISTS '
                '&& $.eventType != "AwsServiceEvent" }'
            ),
            metricTransformations=[{
                'metricName': 'RootAccountUsageCount',
                'metricNamespace': 'SecurityMetrics',
                'metricValue': '1',
            }],
        )

        cloudwatch.put_metric_alarm(
            AlarmName='RootAccountUsage',
            MetricName='RootAccountUsageCount',
            Namespace='SecurityMetrics',
            Statistic='Sum',
            Period=300,
            EvaluationPeriods=1,
            Threshold=1,
            ComparisonOperator='GreaterThanOrEqualToThreshold',
            AlarmActions=[self.sns_topic_arn],
            TreatMissingData='notBreaching',
        )

    def create_unauthorized_api_alarm(self):
        """Detect unauthorized API calls"""
        logs.put_metric_filter(
            logGroupName=self.log_group,
            filterName='UnauthorizedAPICalls',
            filterPattern=(
                '{ ($.errorCode = "*UnauthorizedAccess*") '
                '|| ($.errorCode = "AccessDenied*") }'
            ),
            metricTransformations=[{
                'metricName': 'UnauthorizedAPICallCount',
                'metricNamespace': 'SecurityMetrics',
                'metricValue': '1',
            }],
        )

        cloudwatch.put_metric_alarm(
            AlarmName='UnauthorizedAPICalls',
            MetricName='UnauthorizedAPICallCount',
            Namespace='SecurityMetrics',
            Statistic='Sum',
            Period=300,
            EvaluationPeriods=1,
            Threshold=5,
            ComparisonOperator='GreaterThanOrEqualToThreshold',
            AlarmActions=[self.sns_topic_arn],
            TreatMissingData='notBreaching',
        )

    def create_console_login_failure_alarm(self):
        """Detect console login failures"""
        logs.put_metric_filter(
            logGroupName=self.log_group,
            filterName='ConsoleLoginFailures',
            filterPattern=(
                '{ ($.eventName = "ConsoleLogin") '
                '&& ($.errorMessage = "Failed authentication") }'
            ),
            metricTransformations=[{
                'metricName': 'ConsoleLoginFailureCount',
                'metricNamespace': 'SecurityMetrics',
                'metricValue': '1',
            }],
        )

        cloudwatch.put_metric_alarm(
            AlarmName='ConsoleLoginFailures',
            MetricName='ConsoleLoginFailureCount',
            Namespace='SecurityMetrics',
            Statistic='Sum',
            Period=300,
            EvaluationPeriods=1,
            Threshold=3,
            ComparisonOperator='GreaterThanOrEqualToThreshold',
            AlarmActions=[self.sns_topic_arn],
            TreatMissingData='notBreaching',
        )

    def create_security_group_change_alarm(self):
        """Detect security group changes"""
        logs.put_metric_filter(
            logGroupName=self.log_group,
            filterName='SecurityGroupChanges',
            filterPattern=(
                '{ ($.eventName = "AuthorizeSecurityGroupIngress") '
                '|| ($.eventName = "AuthorizeSecurityGroupEgress") '
                '|| ($.eventName = "RevokeSecurityGroupIngress") '
                '|| ($.eventName = "RevokeSecurityGroupEgress") '
                '|| ($.eventName = "CreateSecurityGroup") '
                '|| ($.eventName = "DeleteSecurityGroup") }'
            ),
            metricTransformations=[{
                'metricName': 'SecurityGroupChangeCount',
                'metricNamespace': 'SecurityMetrics',
                'metricValue': '1',
            }],
        )

        cloudwatch.put_metric_alarm(
            AlarmName='SecurityGroupChanges',
            MetricName='SecurityGroupChangeCount',
            Namespace='SecurityMetrics',
            Statistic='Sum',
            Period=300,
            EvaluationPeriods=1,
            Threshold=1,
            ComparisonOperator='GreaterThanOrEqualToThreshold',
            AlarmActions=[self.sns_topic_arn],
            TreatMissingData='notBreaching',
        )

    def create_all_alarms(self):
        """Create all security alarms at once"""
        self.create_root_account_alarm()
        self.create_unauthorized_api_alarm()
        self.create_console_login_failure_alarm()
        self.create_security_group_change_alarm()
        print("All security alarms created successfully")


# Usage example
builder = SecurityAlarmBuilder(
    log_group='/aws/cloudtrail',
    sns_topic_arn='arn:aws:sns:ap-northeast-1:123456:security-alerts',
)
builder.create_all_alarms()
```

### Baseline-Based Anomaly Detection Implementation

```python
# Code Example 4: Statistical anomaly detection implementation
import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
from dataclasses import dataclass

@dataclass
class AnomalyResult:
    """Anomaly detection result"""
    metric_name: str
    current_value: float
    baseline_mean: float
    baseline_stddev: float
    z_score: float
    is_anomaly: bool
    severity: str  # low, medium, high, critical
    timestamp: datetime

class StatisticalAnomalyDetector:
    """Statistical baseline anomaly detector

    Uses exponential moving average (EMA) and standard deviation
    to dynamically calculate the baseline for metrics
    and detect anomalous values.

    How it works:
    1. Calculate EMA from past data points
    2. Calculate standard deviation
    3. Compute Z-score of new data point
    4. Flag as anomaly when Z-score exceeds threshold

    Z-score = (observed value - mean) / standard deviation
    - |Z| > 2: Low-risk anomaly
    - |Z| > 3: Medium-risk anomaly
    - |Z| > 4: High-risk anomaly
    """

    def __init__(self, window_hours: int = 168,  # 1 week
                 min_data_points: int = 100):
        self.window_hours = window_hours
        self.min_data_points = min_data_points
        # metric name → list of (timestamp, value)
        self.data_points: dict = defaultdict(list)

    def add_data_point(self, metric_name: str, value: float,
                       timestamp: Optional[datetime] = None):
        """Add a data point"""
        ts = timestamp or datetime.utcnow()
        self.data_points[metric_name].append((ts, value))
        self._cleanup(metric_name)

    def check_anomaly(self, metric_name: str,
                      value: float) -> Optional[AnomalyResult]:
        """Check for anomalous values"""
        points = self.data_points.get(metric_name, [])

        if len(points) < self.min_data_points:
            return None  # Insufficient data

        values = [p[1] for p in points]
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        stddev = math.sqrt(variance) if variance > 0 else 0.001

        z_score = (value - mean) / stddev

        severity = self._classify_severity(abs(z_score))
        is_anomaly = abs(z_score) > 2.0

        return AnomalyResult(
            metric_name=metric_name,
            current_value=value,
            baseline_mean=mean,
            baseline_stddev=stddev,
            z_score=z_score,
            is_anomaly=is_anomaly,
            severity=severity,
            timestamp=datetime.utcnow(),
        )

    def _classify_severity(self, abs_z: float) -> str:
        if abs_z > 4.0:
            return "critical"
        elif abs_z > 3.0:
            return "high"
        elif abs_z > 2.0:
            return "medium"
        else:
            return "low"

    def _cleanup(self, metric_name: str):
        """Delete old data outside the window"""
        cutoff = datetime.utcnow() - timedelta(hours=self.window_hours)
        self.data_points[metric_name] = [
            p for p in self.data_points[metric_name]
            if p[0] > cutoff
        ]


# Usage example
detector = StatisticalAnomalyDetector()

# Build baseline (simulating past data)
import random
for i in range(200):
    # Normal API call count: mean 100, standard deviation 20
    normal_value = random.gauss(100, 20)
    detector.add_data_point(
        "api_calls_per_minute",
        max(0, normal_value),
        datetime.utcnow() - timedelta(hours=200-i),
    )

# Check for anomalous values
result = detector.check_anomaly("api_calls_per_minute", 250)
if result and result.is_anomaly:
    print(f"ANOMALY DETECTED: {result.metric_name}")
    print(f"  Current: {result.current_value}")
    print(f"  Baseline: {result.baseline_mean:.1f} +/- "
          f"{result.baseline_stddev:.1f}")
    print(f"  Z-score: {result.z_score:.2f}")
    print(f"  Severity: {result.severity}")
```

---

## 5. Dashboard Design

### Security Dashboard Layout

```
+----------------------------------------------------------+
|  Security Operations Dashboard                           |
|----------------------------------------------------------|
|                                                          |
|  [Summary Panel]                                         |
|  +-- Active alert count (Critical/High/Medium/Low)       |
|  +-- Number of incidents in the past 24 hours            |
|  +-- Mean Time to Detect (MTTD)                          |
|  +-- Mean Time to Respond (MTTR)                         |
|  +-- Security score (0-100)                              |
|                                                          |
|  [Trend Graphs]                                          |
|  +-- Alert trend (daily/weekly)                          |
|  +-- Login error trend                                   |
|  +-- Network traffic volume trend                        |
|  +-- Anomaly detection event trend                       |
|                                                          |
|  [Geographic Map]                                        |
|  +-- Geographic distribution of source IPs              |
|  +-- Anomalous connection origins by country             |
|  +-- Distribution of blocked IPs                        |
|                                                          |
|  [Tables]                                               |
|  +-- Latest alert list                                   |
|  +-- Top attacker IPs                                    |
|  +-- Most accessed endpoints                             |
|  +-- List of unresolved vulnerabilities                  |
+----------------------------------------------------------+
```

### Dashboard Design Best Practices

```
+----------------------------------------------------------+
|          7 Principles of Dashboard Design                |
|----------------------------------------------------------|
|                                                          |
|  1. 5-Second Rule                                        |
|     → Status should be graspable within 5 seconds       |
|     → Display important KPIs prominently at the top     |
|                                                          |
|  2. Action-Driven                                        |
|     → Eliminate data that is only "viewed"              |
|     → Each panel should make clear "what to do"         |
|                                                          |
|  3. Hierarchy                                            |
|     → Drill down from summary → detail → raw data       |
|     → Separate views for executives / analysts          |
|                                                          |
|  4. Real-Time                                            |
|     → Critical alerts reflected within 1 minute         |
|     → Trends updated every 5 minutes                    |
|                                                          |
|  5. Context                                              |
|     → Attach comparisons to numbers (vs. yesterday, last week) |
|     → Highlight in color when threshold is exceeded     |
|                                                          |
|  6. Noise Reduction                                      |
|     → Avoid information overload (7 or fewer panels per screen) |
|     → Provide filtering capabilities                    |
|                                                          |
|  7. Consistency                                          |
|     → Unify color meanings (red=Critical, yellow=Warning, etc.) |
|     → Unify time axes                                   |
+----------------------------------------------------------+
```

### Building a Security Dashboard with OpenSearch Dashboards

```python
# Code Example 5: Script to automatically build an OpenSearch security dashboard
import json
import requests
from typing import Dict, List

class SecurityDashboardBuilder:
    """Automatically build a security dashboard in OpenSearch Dashboards"""

    def __init__(self, opensearch_url: str, auth: tuple):
        self.url = opensearch_url
        self.auth = auth
        self.headers = {"Content-Type": "application/json"}

    def create_index_pattern(self, pattern: str, time_field: str):
        """Create an index pattern"""
        body = {
            "attributes": {
                "title": pattern,
                "timeFieldName": time_field,
            }
        }
        requests.post(
            f"{self.url}/api/saved_objects/index-pattern/{pattern}",
            json=body, auth=self.auth, headers=self.headers,
        )

    def create_failed_login_visualization(self) -> dict:
        """Time series graph of login failures"""
        return {
            "title": "Failed Login Attempts Over Time",
            "visState": json.dumps({
                "title": "Failed Login Attempts",
                "type": "line",
                "aggs": [
                    {
                        "id": "1",
                        "type": "count",
                        "schema": "metric",
                    },
                    {
                        "id": "2",
                        "type": "date_histogram",
                        "schema": "segment",
                        "params": {
                            "field": "@timestamp",
                            "interval": "5m",
                        },
                    },
                ],
                "params": {
                    "seriesParams": [{
                        "show": True,
                        "type": "line",
                        "mode": "normal",
                    }],
                },
            }),
            "kibanaSavedObjectMeta": {
                "searchSourceJSON": json.dumps({
                    "query": {
                        "bool": {
                            "must": [
                                {"match": {"event": "login_failed"}}
                            ]
                        }
                    },
                    "index": "security-events-*",
                }),
            },
        }

    def create_top_attackers_table(self) -> dict:
        """Top 10 attacker IP table"""
        return {
            "title": "Top Attacking IPs",
            "visState": json.dumps({
                "title": "Top Attacking IPs",
                "type": "table",
                "aggs": [
                    {
                        "id": "1",
                        "type": "count",
                        "schema": "metric",
                        "params": {"customLabel": "Attack Count"},
                    },
                    {
                        "id": "2",
                        "type": "terms",
                        "schema": "bucket",
                        "params": {
                            "field": "sourceIp.keyword",
                            "size": 10,
                            "order": "desc",
                            "orderBy": "1",
                            "customLabel": "Source IP",
                        },
                    },
                ],
            }),
        }

    def create_geo_map(self) -> dict:
        """Geographic distribution map of attack origins"""
        return {
            "title": "Attack Source Geographic Distribution",
            "visState": json.dumps({
                "title": "Attack Sources Map",
                "type": "tile_map",
                "aggs": [
                    {
                        "id": "1",
                        "type": "count",
                        "schema": "metric",
                    },
                    {
                        "id": "2",
                        "type": "geohash_grid",
                        "schema": "segment",
                        "params": {
                            "field": "geoLocation",
                            "precision": 3,
                        },
                    },
                ],
            }),
        }

    def build_security_dashboard(self):
        """Build the security dashboard"""
        self.create_index_pattern("security-events-*", "@timestamp")

        visualizations = [
            self.create_failed_login_visualization(),
            self.create_top_attackers_table(),
            self.create_geo_map(),
        ]

        for viz in visualizations:
            requests.post(
                f"{self.url}/api/saved_objects/visualization",
                json={"attributes": viz},
                auth=self.auth,
                headers=self.headers,
            )

        print(f"Dashboard created with {len(visualizations)} visualizations")
```

---

## 6. Log Storage and Performance

### Tiered Storage Design

```
+----------------------------------------------------------+
|          Tiered Storage Strategy for Logs                |
|----------------------------------------------------------|
|                                                          |
|  Hot Tier (0-30 days)                                    |
|  +-- Storage: OpenSearch / Elasticsearch                 |
|  +-- Characteristics: Instantly searchable, high cost   |
|  +-- Use: Real-time analysis, alert detection           |
|  +-- Cost: ~$0.10/GB/month (including instance cost)    |
|                                                          |
|  Warm Tier (30-90 days)                                  |
|  +-- Storage: S3 Standard + Athena                      |
|  +-- Characteristics: SQL-queryable, medium cost        |
|  +-- Use: Incident investigation, forensics             |
|  +-- Cost: ~$0.023/GB/month                             |
|                                                          |
|  Cold Tier (90-365 days)                                 |
|  +-- Storage: S3 Infrequent Access                      |
|  +-- Characteristics: Access fees apply, low cost       |
|  +-- Use: Meeting compliance requirements               |
|  +-- Cost: ~$0.0125/GB/month                            |
|                                                          |
|  Archive Tier (365+ days)                                |
|  +-- Storage: S3 Glacier Deep Archive                   |
|  +-- Characteristics: 12-hour restore, lowest cost      |
|  +-- Use: Legal retention requirements, litigation      |
|  +-- Cost: ~$0.00099/GB/month                           |
+----------------------------------------------------------+
```

### Configuring S3 Lifecycle Policies

```python
# Code Example 6: Configuring S3 lifecycle policies
import boto3

s3 = boto3.client('s3')

def configure_log_lifecycle(bucket_name: str):
    """Configure lifecycle policy for security logs"""

    lifecycle_config = {
        'Rules': [
            {
                'ID': 'SecurityLogLifecycle',
                'Status': 'Enabled',
                'Filter': {
                    'Prefix': 'logs/',
                },
                'Transitions': [
                    {
                        'Days': 30,
                        'StorageClass': 'STANDARD_IA',
                    },
                    {
                        'Days': 90,
                        'StorageClass': 'GLACIER',
                    },
                    {
                        'Days': 365,
                        'StorageClass': 'DEEP_ARCHIVE',
                    },
                ],
                # PCI DSS/SOC 2 requirement: retain for at least 1 year
                # May retain for 7 years depending on legal retention requirements
                'Expiration': {
                    'Days': 2555,  # 7 years
                },
                'NoncurrentVersionExpiration': {
                    'NoncurrentDays': 30,
                },
            },
        ],
    }

    s3.put_bucket_lifecycle_configuration(
        Bucket=bucket_name,
        LifecycleConfiguration=lifecycle_config,
    )

    # Configure bucket encryption
    s3.put_bucket_encryption(
        Bucket=bucket_name,
        ServerSideEncryptionConfiguration={
            'Rules': [{
                'ApplyServerSideEncryptionByDefault': {
                    'SSEAlgorithm': 'aws:kms',
                    'KMSMasterKeyID': 'alias/security-logs-key',
                },
                'BucketKeyEnabled': True,
            }]
        },
    )

    # Object lock (tamper prevention)
    s3.put_object_lock_configuration(
        Bucket=bucket_name,
        ObjectLockConfiguration={
            'ObjectLockEnabled': 'Enabled',
            'Rule': {
                'DefaultRetention': {
                    'Mode': 'COMPLIANCE',
                    'Days': 365,
                }
            }
        },
    )

    print(f"Lifecycle policy configured for {bucket_name}")

configure_log_lifecycle("security-logs-archive")
```

### Performance Tuning

| Tuning Target | Problem | Solution | Effect |
|----------------|------|------|------|
| OpenSearch index | Slow search | Optimize shard count (50GB/shard) | 2-5x search speed improvement |
| Fluent Bit buffer | Out of memory | Use filesystem storage | Prevent data loss |
| S3 archive | Slow Athena queries | Parquet format + partitioning | 10x query speed improvement |
| Log forwarding | Network bandwidth | Enable compression (gzip) | 70-80% bandwidth reduction |
| Index rotation | Disk full | Configure ILM policy | Automatic storage management |

---

## 7. Edge Cases

### Edge Case 1: Missing Logs

Logs may be missing due to network failures or agent anomalies. To detect this, implement "heartbeat logging."

```python
# Code Example 7: Implementation of log gap detection
from datetime import datetime, timedelta
from typing import Dict, Set

class LogGapDetector:
    """Monitor to detect missing logs

    Monitors the arrival interval of logs from each log source
    and issues an alert when the expected interval is exceeded.
    """

    def __init__(self):
        # source name → (last received time, expected interval)
        self.sources: Dict[str, tuple] = {}
        # List of expected sources
        self.expected_sources: Set[str] = set()

    def register_source(self, source_name: str,
                        expected_interval: timedelta):
        """Register a log source"""
        self.expected_sources.add(source_name)
        self.sources[source_name] = (None, expected_interval)

    def record_log(self, source_name: str):
        """Record log arrival"""
        if source_name in self.sources:
            _, interval = self.sources[source_name]
            self.sources[source_name] = (datetime.utcnow(), interval)

    def check_gaps(self) -> list:
        """Detect missing logs"""
        alerts = []
        now = datetime.utcnow()

        for source_name in self.expected_sources:
            if source_name not in self.sources:
                alerts.append({
                    'source': source_name,
                    'type': 'source_not_registered',
                    'message': f"Log source {source_name} is not registered",
                })
                continue

            last_seen, expected_interval = self.sources[source_name]

            if last_seen is None:
                alerts.append({
                    'source': source_name,
                    'type': 'no_logs_received',
                    'message': f"No logs have ever arrived from {source_name}",
                })
            elif (now - last_seen) > expected_interval * 2:
                gap_minutes = (now - last_seen).total_seconds() / 60
                alerts.append({
                    'source': source_name,
                    'type': 'log_gap',
                    'message': (
                        f"No logs have arrived from {source_name}"
                        f" for {gap_minutes:.0f} minutes"
                    ),
                    'last_seen': last_seen.isoformat(),
                    'gap_minutes': gap_minutes,
                })

        return alerts
```

### Edge Case 2: Timezone Mismatch

When timezones are mixed across logs from different sources, the accuracy of correlation analysis decreases. It is essential to standardize all logs to UTC.

### Edge Case 3: Log Tampering

Attackers may alter or delete logs. The following measures are needed to prevent this:

- Tamper prevention using S3 Object Lock
- Enable CloudTrail log file integrity validation
- Simultaneous writing of logs to multiple locations (Write-Ahead Log pattern)
- Use of WORM (Write Once Read Many) storage

---

## 8. Anti-Patterns

### Anti-Pattern 1: Collecting Logs Without Analyzing Them

```
Bad:
  → Only saving logs to S3
  → Nobody looks at the logs
  → Only checking logs after an incident occurs

Good:
  → Set up correlation analysis rules in SIEM
  → Automatically generate and notify alerts
  → Conduct regular log reviews (weekly)
  → Measure and improve KPIs (MTTD/MTTR)

Impact:
  → Mean time to detect exceeds 200 days
  → Enormous time spent investigating incidents
  → Flagged during compliance audits
```

### Anti-Pattern 2: Alert Fatigue

```
Bad:
  → Hundreds of alerts generated per day
  → Most are false positives
  → Important alerts get buried and missed

Good:
  → Set alert severity appropriately
  → Continuously tune to reduce false positives
  → Low-severity alerts shown on dashboard only
  → Notifications limited to High and above
  → Document and manage suppression rules

Improvement process:
  1. Aggregate monthly false positive rates for alerts
  2. Review rules with false positive rate > 30%
  3. Adjust thresholds or disable rules
  4. Measure effectiveness after improvement
```

### Anti-Pattern 3: Logging Sensitive Data

```
Bad:
  → Logging passwords
  → Logging credit card numbers
  → Logging API keys
  → Logging session tokens

Good:
  → Automatically mask sensitive data
  → Field-level control with structured logging
  → Confirm absence of sensitive data through log review process
  → Introduce PII detection tools

Technical measures:
  → Mask with Fluent Bit's Lua filter
  → Pre-sanitize at the application layer
  → Post-detection with DLP tools
```

---

## 9. Exercises

### Exercise 1: Basic — Implementing Structured Logging

Build a structured logging system that meets the following requirements:

1. Implement a Python logger that outputs logs in JSON format
2. Automatically attach trace ID and request ID
3. Automatically mask sensitive data (password, token, api_key)
4. Implement log-level filtering functionality

**Verification Points:**
- Logs can be correctly parsed as JSON
- Sensitive fields are masked
- Context information is correctly attached

### Exercise 2: Applied — Designing SIEM Correlation Rules

Create Sigma rules to detect the following attack scenarios:

1. Credential spraying attack (login attempts with the same password against multiple users)
2. Privilege escalation attempts (a regular user executes administrative operations)
3. Signs of data exfiltration (mass data download outside business hours)

**Verification Points:**
- No syntax errors when run with Sigma CLI
- At least 2 false positive scenarios are listed
- MITRE ATT&CK TTPs are tagged

### Exercise 3: Advanced — Building an Anomaly Detection System

Build an anomaly detection prototype that meets the following requirements:

1. Implement statistical baseline detection (Z-score based)
2. Monitor at least 3 types of metrics (API call count, data transfer volume, login attempt count)
3. Implement dynamic baseline updates (sliding window)
4. Implement functionality to notify anomaly detection results to Slack / PagerDuty

**Verification Points:**
- No anomaly alerts triggered by normal values
- Anomaly alerts reliably triggered by abnormal values
- Baseline is updated over time

---

## 10. FAQ

### Q1. How long should SIEM log retention be?

PCI DSS requires 1 year (with the most recent 3 months immediately searchable), and SOC 2 requires coverage for the audit period (typically 12 months). GDPR does not specify a particular retention period, but based on the data minimization principle, the minimum necessary period should be used. For cost optimization, a tiered storage approach of Hot (30 days/OpenSearch) → Warm (90 days/S3+Athena) → Cold (365+ days/Glacier) is effective.

### Q2. Is SIEM necessary for small teams?

Even without a dedicated SIEM product, basic monitoring can be built with the combination of CloudWatch Logs + Athena + EventBridge. It is practical to start by collecting CloudTrail, VPC Flow Logs, and application logs, and then configure a few important alert rules. You can start with a monthly cost of around $100-200.

### Q3. Can machine learning-based anomaly detection be trusted?

It depends on the quality of the baseline data during the learning period (typically 2-4 weeks). If anomalous events are included in the learning period, the baseline will be incorrect. Machine learning complements rule-based detection and does not replace it. The recommended order is to first build out rule-based detection, then add machine learning on top.

### Q4. Should log formats be standardized?

They should be standardized as much as possible. By adopting common schemas such as ECS (Elastic Common Schema) or OCSF (Open Cybersecurity Schema Framework), logs from different sources can be analyzed consistently. If the existing log format cannot be changed, normalize using parsers on the SIEM side.

### Q5. Is log encryption necessary?

Since security logs may contain personal information and authentication credentials, both encryption at rest (SSE-KMS) and encryption in transit (TLS) are required. This is especially mandatory when compliance requirements (PCI DSS, HIPAA) apply. Use AWS KMS for encryption key management and also configure key rotation.

### Q6. How should logs be aggregated in a multi-cloud environment?

Amazon Security Lake integrates multi-cloud logs based on the OCSF schema. Alternatively, logs from each cloud can be aggregated into a common bucket (S3) and searched across using Athena or OpenSearch. Inter-region network transfer costs need to be considered for log forwarding.

---

## 11. Troubleshooting

### Common Issues and Solutions

| Problem | Cause | Solution |
|------|------|--------|
| Logs are missing | Agent buffer overflow | Increase buffer size, use filesystem storage |
| Slow search | Too many or too few shards | Adjust with 50GB/shard as a guide |
| Alerts not arriving | Metric filter pattern mismatch | Test filter patterns in CloudWatch |
| High cost | All logs stored in hot storage | Migrate to tiered storage with ILM policy |
| Too many false positives | Rule threshold too low | Analyze baseline and adjust thresholds |
| Disk full | Log rotation not configured | Configure logrotate + ILM policy |
| Invalid timestamps | NTP sync issues | Check chrony/ntpd configuration |

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|------|
| Log collection | Always collect CloudTrail, VPC Flow Logs, and application logs |
| Structured logging | Use a consistent format in JSON |
| Sensitive data protection | Automatically mask sensitive data in logs |
| SIEM | Automate log aggregation, correlation analysis, and alert generation |
| Detection rules | Use Sigma rules to ensure portability across SIEMs |
| Anomaly detection | Combine rule-based + statistics-based + machine learning |
| Log storage | Optimize costs with tiered Hot/Warm/Cold/Archive storage |
| Alert management | Prevent Alert Fatigue and respond immediately to High and above |
| Performance | Optimize index design, compression, and partitioning |

---

## Recommended Next Guides

- [Incident Response](./00-incident-response.md) — Incident response flow after detection
- [Compliance](./02-compliance.md) — Legal requirements for log retention
- [AWS Security](../05-cloud-security/01-aws-security.md) — Details on CloudTrail and GuardDuty
- [SAST/DAST](../04-application-security/03-sast-dast.md) — Detecting application vulnerabilities

---

## References

1. **NIST SP 800-92 — Guide to Computer Security Log Management** — https://csrc.nist.gov/publications/detail/sp/800-92/final
2. **NIST SP 800-137 — Information Security Continuous Monitoring** — https://csrc.nist.gov/publications/detail/sp/800-137/final
3. **Sigma Rules Repository** — https://github.com/SigmaHQ/sigma
4. **Elastic Common Schema (ECS)** — https://www.elastic.co/guide/en/ecs/current/index.html
5. **OCSF (Open Cybersecurity Schema Framework)** — https://schema.ocsf.io/
6. **Elastic SIEM Documentation** — https://www.elastic.co/guide/en/security/current/index.html
7. **MITRE ATT&CK Framework** — https://attack.mitre.org/ — Classification system for attack techniques
8. **Fluent Bit Documentation** — https://docs.fluentbit.io/
9. **Vector Documentation** — https://vector.dev/docs/
10. **AWS Security Logging Best Practices** — https://docs.aws.amazon.com/prescriptive-guidance/latest/logging-monitoring-for-application-owners/
