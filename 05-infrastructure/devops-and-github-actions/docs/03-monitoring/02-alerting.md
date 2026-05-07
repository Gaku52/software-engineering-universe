# Alerting Strategy

> Master alert design principles, escalation policies, and postmortem operations to build a sustainable on-call system free from alert fatigue

## What You Will Learn

1. **Effective Alert Design** — Design principles to prevent alert fatigue and fire only alerts that truly require action
2. **Escalation and On-Call Structure** — Building tiered escalation policies and on-call rotations
3. **Postmortems and Continuous Improvement** — Organizational processes to learn from incidents and prevent recurrence
4. **Auto-Remediation** — Building systems that automatically recover from failures without human intervention
5. **Incident Management Process** — Defining SEV levels, communication protocols, and status page operations


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Monitoring Tools](./01-monitoring-tools.md)

---

## 1. Overview of Alert Design

```
┌──────────────────────────────────────────────────────────┐
│                  Alert Design Pyramid                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    ┌──────────┐                          │
│                    │ PAGE     │  Requires immediate action│
│                    │(Critical)│  SLO violation, outage   │
│                    └────┬─────┘                          │
│                   ┌─────▼──────┐                         │
│                   │  TICKET    │  Handle during business  │
│                   │(Important) │  hours. Perf degradation │
│                   └─────┬──────┘                         │
│              ┌──────────▼───────────┐                    │
│              │     NOTIFICATION     │  Informational only │
│              │   (Reference)        │  Capacity, cert expiry│
│              └──────────┬───────────┘                    │
│         ┌───────────────▼────────────────┐               │
│         │        DASHBOARD ONLY          │  Dashboard     │
│         │        (Record only)           │  visible only  │
│         └────────────────────────────────┘               │
│                                                          │
│  Principle: Fewer alerts toward the top. Aim for PAGE    │
│  only a few times per month.                             │
└──────────────────────────────────────────────────────────┘
```

### 1.1 Alert Design Principles

```
5 principles that determine alert quality:

1. Actionable
   ─ When an alert fires, "what to do right now" must be clear
   ─ Alerts that require no action should not exist

2. Contextual
   ─ Alert messages must include sufficient information
   ─ Runbook URL, dashboard link, scope of impact

3. SLO-based
   ─ Based on predicted SLO violations, not static thresholds
   ─ Burn-rate alerts that reflect business impact

4. Right Granularity
   ─ Alert on symptoms, debug for causes
   ─ Not "CPU 80%" but "Response time violates SLO"

5. Continuously Improved
   ─ Review alerts monthly
   ─ Track false positives / false negatives
```

### 1.2 Alert Quality Metrics

```
Quantitative indicators to measure alert quality:

┌─────────────────────────────────────────────────┐
│ Metric                   │ Target              │
├──────────────────────────┼─────────────────────┤
│ PAGE count/month         │ < 10                │
│ False positive rate      │ < 10%               │
│ MTTA (mean time to ack)  │ < 5 min             │
│ MTTR (mean time to       │ < 30 min            │
│   resolve)               │                     │
│ Alert → Action rate      │ > 90%               │
│ Runbook coverage         │ 100%                │
│ Auto-remediation rate    │ > 30%               │
│ On-call satisfaction     │ > 4/5               │
└──────────────────────────┴─────────────────────┘

Measurement methods:
- Use reporting features in PagerDuty / Opsgenie
- Visualize alert statistics on custom dashboards
- Review in monthly alert review meetings
```

### 1.3 Symptom-Based vs. Cause-Based Alerts

```
Symptom-based alerts (recommended):
┌────────────────────────────────────────────────────┐
│ Directly tied to problems experienced by users     │
│                                                    │
│ Examples:                                          │
│ · Error rate exceeds SLO                           │
│ · p99 response time exceeds 2 seconds              │
│ · Order processing success rate falls below 99%    │
│                                                    │
│ Advantages:                                        │
│ · Business impact is clear                         │
│ · Can detect multi-cause failures                  │
│ · Fewer false positives                            │
└────────────────────────────────────────────────────┘

Cause-based alerts (use as supplementary):
┌────────────────────────────────────────────────────┐
│ Based on infrastructure state                      │
│                                                    │
│ Examples:                                          │
│ · CPU usage > 90%                                  │
│ · Disk usage > 85%                                 │
│ · Memory usage > 90%                               │
│                                                    │
│ Caution:                                           │
│ · May not affect symptoms (CPU 90% but functioning │
│   normally)                                        │
│ · Use at TICKET/NOTIFICATION level preventively    │
│ · Do not use for PAGE                              │
└────────────────────────────────────────────────────┘
```

---

## 2. Alert Rule Design

### 2.1 SLO Burn-Rate Alerts

```yaml
# prometheus-alerts.yml — Prometheus alert rules
groups:
  - name: slo-alerts
    rules:
      # SLO burn-rate alerts (Multi-window, Multi-burn-rate)
      # 99.9% SLO: allowed errors over 30 days = 0.1% = 43.2 minutes of downtime
      - alert: HighErrorBurnRate_Critical
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          ) > (14.4 * 0.001)
          and
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          ) > (14.4 * 0.001)
        for: 2m
        labels:
          severity: critical
          team: backend
          slo: availability
        annotations:
          summary: "Error burn rate at critical level (Critical)"
          description: >
            Error rate over the last 5 minutes and 1 hour exceeds 14.4x the SLO burn rate.
            At this pace, the monthly error budget will be exhausted within 2 days.
          runbook: "https://wiki.example.com/runbooks/high-error-rate"
          dashboard: "https://grafana.example.com/d/slo-overview"
          impact: "Potential impact on all users"

      - alert: HighErrorBurnRate_Warning
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[30m]))
            / sum(rate(http_requests_total[30m]))
          ) > (6 * 0.001)
          and
          (
            sum(rate(http_requests_total{status=~"5.."}[6h]))
            / sum(rate(http_requests_total[6h]))
          ) > (6 * 0.001)
        for: 5m
        labels:
          severity: warning
          team: backend
          slo: availability
        annotations:
          summary: "Error burn rate at warning level (Warning)"
          description: >
            Error rate over the last 30 minutes and 6 hours exceeds 6x the SLO burn rate.
          runbook: "https://wiki.example.com/runbooks/high-error-rate"

      # Latency SLO (achieve p99 < 500ms for 99.5% of requests)
      - alert: HighLatencyBurnRate_Critical
        expr: |
          (
            1 - (
              sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
              / sum(rate(http_request_duration_seconds_count[5m]))
            )
          ) > (14.4 * 0.005)
          and
          (
            1 - (
              sum(rate(http_request_duration_seconds_bucket{le="0.5"}[1h]))
              / sum(rate(http_request_duration_seconds_count[1h]))
            )
          ) > (14.4 * 0.005)
        for: 2m
        labels:
          severity: critical
          team: backend
          slo: latency
        annotations:
          summary: "Latency burn rate at critical level"
          description: >
            The proportion of requests exceeding 500ms p99 latency is rapidly increasing.
          runbook: "https://wiki.example.com/runbooks/high-latency"
```

### 2.2 Burn-Rate Calculation Details

```
Burn-rate alert design theory:

SLO: 99.9% (30 days)
Error budget: 0.1% = 30 days × 24 hours × 60 minutes × 0.001 = 43.2 minutes

Burn rate = Actual error rate / Allowed error rate

  Burn rate × Window → Budget consumption
  ┌─────────┬──────────┬────────────────────────┐
  │ Burn    │ Window   │ Time until full         │
  │ Rate    │          │ budget consumed         │
  ├─────────┼──────────┼────────────────────────┤
  │ 14.4x   │ 5m + 1h  │ 2 days (PAGE)          │
  │ 6x      │ 30m + 6h │ 5 days (TICKET)        │
  │ 3x      │ 2h + 1d  │ 10 days (NOTIFICATION) │
  │ 1x      │ 6h + 3d  │ 30 days (exact SLO)    │
  └─────────┴──────────┴────────────────────────┘

  Meaning of Multi-window:
  ┌───────────────────────────────────────────────┐
  │ Short window (5m)                             │
  │   → Detects instantaneous spikes              │
  │   → High false positives on its own           │
  │                                               │
  │ Long window (1h)                              │
  │   → Confirms persistent issues                │
  │   → Slow to detect on its own                 │
  │                                               │
  │ AND condition on both                         │
  │   → Excludes momentary spikes while           │
  │     quickly detecting persistent issues       │
  └───────────────────────────────────────────────┘
```

### 2.3 Infrastructure Alerts

```yaml
  - name: infrastructure-alerts
    rules:
      - alert: HighMemoryUsage
        expr: |
          (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Memory usage exceeds 90%"
          description: "Memory usage on {{ $labels.instance }} is {{ $value | humanizePercentage }}"
          runbook: "https://wiki.example.com/runbooks/high-memory"

      - alert: DiskSpaceRunningOut
        expr: |
          predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 24*3600) < 0
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Disk space predicted to run out within 24 hours"
          description: "Disk on {{ $labels.instance }} will be full within 24 hours"
          runbook: "https://wiki.example.com/runbooks/disk-space"

      - alert: DiskSpaceCritical
        expr: |
          (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) > 0.95
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk usage exceeds 95%"
          description: "Disk usage on {{ $labels.instance }} is {{ $value | humanizePercentage }}. Immediate action required."
          runbook: "https://wiki.example.com/runbooks/disk-space-critical"

      - alert: HighCPUUsage
        expr: |
          100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "CPU usage exceeds 90% (sustained for 15 minutes)"
          description: "CPU usage on {{ $labels.instance }} is {{ $value }}%"

      # SSL certificate expiry check
      - alert: SSLCertExpiringSoon
        expr: |
          (probe_ssl_earliest_cert_expiry - time()) / 86400 < 30
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "SSL certificate expires within 30 days"
          description: "Certificate on {{ $labels.instance }} expires in {{ $value | humanize }} days"

      - alert: SSLCertExpiringSoon_Critical
        expr: |
          (probe_ssl_earliest_cert_expiry - time()) / 86400 < 7
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "SSL certificate expires within 7 days"
          description: "Certificate on {{ $labels.instance }} expires in {{ $value | humanize }} days. Renew immediately."

  - name: kubernetes-alerts
    rules:
      # Pod in CrashLoopBackOff
      - alert: PodCrashLooping
        expr: |
          rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 3
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod is in CrashLoopBackOff state"
          description: >
            {{ $labels.namespace }}/{{ $labels.pod }} has restarted 3 or more times in 15 minutes.
          runbook: "https://wiki.example.com/runbooks/pod-crashloop"

      # Deployment replica mismatch
      - alert: DeploymentReplicasMismatch
        expr: |
          kube_deployment_spec_replicas != kube_deployment_status_available_replicas
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Deployment replica count mismatch"
          description: >
            {{ $labels.namespace }}/{{ $labels.deployment }}
            Expected replicas: {{ $labels.spec_replicas }},
            Actual replicas: {{ $value }}

      # Node NotReady state
      - alert: KubeNodeNotReady
        expr: |
          kube_node_status_condition{condition="Ready", status="true"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Kubernetes Node is NotReady"
          description: "{{ $labels.node }} has been in NotReady state for more than 5 minutes"

      # PersistentVolume capacity
      - alert: PersistentVolumeRunningOut
        expr: |
          kubelet_volume_stats_available_bytes / kubelet_volume_stats_capacity_bytes < 0.15
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "PersistentVolume free space is below 15%"
          description: "Remaining capacity for {{ $labels.namespace }}/{{ $labels.persistentvolumeclaim }}: {{ $value | humanizePercentage }}"

      # HPA scaling limit reached
      - alert: HPAMaxedOut
        expr: |
          kube_horizontalpodautoscaler_status_current_replicas == kube_horizontalpodautoscaler_spec_max_replicas
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "HPA has reached the maximum replica count"
          description: >
            {{ $labels.namespace }}/{{ $labels.horizontalpodautoscaler }} has been running
            at the maximum replica count ({{ $value }}) for over 15 minutes.
            Consider increasing the scaling limit.
```

### 2.4 Business Alerts

```yaml
  - name: business-alerts
    rules:
      # Sudden drop in order count
      - alert: OrderRateDropped
        expr: |
          sum(rate(orders_created_total[30m]))
          < sum(rate(orders_created_total[30m] offset 1d)) * 0.5
        for: 15m
        labels:
          severity: critical
          team: business
        annotations:
          summary: "Order count dropped to 50% or below compared to previous day"
          description: >
            The order rate over the last 30 minutes has dropped to 50% or below
            compared to the same time yesterday.
            Possible payment system failure or frontend failure.
          runbook: "https://wiki.example.com/runbooks/order-rate-drop"

      # Low payment success rate
      - alert: PaymentSuccessRateLow
        expr: |
          sum(rate(payment_transactions_total{status="success"}[10m]))
          / sum(rate(payment_transactions_total[10m]))
          < 0.95
        for: 5m
        labels:
          severity: critical
          team: payments
        annotations:
          summary: "Payment success rate has fallen below 95%"
          description: >
            Payment success rate over the last 10 minutes: {{ $value | humanizePercentage }}
            Possible payment provider failure or application bug.

      # Anomaly in user registrations
      - alert: UserRegistrationAnomaly
        expr: |
          abs(
            sum(rate(user_registrations_total[1h]))
            - sum(rate(user_registrations_total[1h] offset 7d))
          ) / sum(rate(user_registrations_total[1h] offset 7d))
          > 2
        for: 30m
        labels:
          severity: warning
          team: growth
        annotations:
          summary: "Anomaly detected in user registration count"
          description: "There is a variation of 200% or more compared to the same time last week"

      # Queue backlog
      - alert: QueueBacklogHigh
        expr: |
          sum(queue_messages_pending) by (queue_name) > 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Message queue backlog exceeds 10,000"
          description: >
            Queue {{ $labels.queue_name }} has {{ $value }} messages pending.
            Consumer scale-out or processing delay investigation is required.
```

---

## 3. Alertmanager Configuration

### 3.1 Routing and Notification Settings

```yaml
# alertmanager.yml — Escalation configuration
global:
  resolve_timeout: 5m
  slack_api_url: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
  pagerduty_url: "https://events.pagerduty.com/v2/enqueue"

# Routing tree
route:
  receiver: default-notification
  group_by: ['alertname', 'team', 'service']
  group_wait: 30s       # Wait 30 seconds to aggregate alerts in the same group
  group_interval: 5m    # Re-notification interval for the same group
  repeat_interval: 4h   # Repeat notification interval for the same alert

  routes:
    # Critical → PagerDuty + Slack
    - match:
        severity: critical
      receiver: pagerduty-critical
      continue: true  # Also evaluate the next route
    - match:
        severity: critical
      receiver: slack-critical
      group_wait: 0s  # Notify immediately

    # Warning → Slack only
    - match:
        severity: warning
      receiver: slack-warning
      repeat_interval: 12h

    # Team-based routing
    - match:
        team: backend
      receiver: slack-backend
    - match:
        team: frontend
      receiver: slack-frontend
    - match:
        team: payments
      receiver: slack-payments
      routes:
        # Payments team Critical goes to dedicated PagerDuty
        - match:
            severity: critical
          receiver: pagerduty-payments

    # Business alerts → Business channel
    - match:
        team: business
      receiver: slack-business
      group_wait: 5m

# Receiver definitions
receivers:
  - name: default-notification
    slack_configs:
      - channel: '#alerts-general'
        send_resolved: true
        title: '{{ .CommonLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'

  - name: pagerduty-critical
    pagerduty_configs:
      - routing_key: "YOUR_PAGERDUTY_ROUTING_KEY"
        severity: critical
        description: '{{ .CommonAnnotations.summary }}'
        details:
          alert: '{{ .CommonLabels.alertname }}'
          description: '{{ .CommonAnnotations.description }}'
          runbook: '{{ .CommonAnnotations.runbook }}'
          dashboard: '{{ .CommonAnnotations.dashboard }}'
          num_firing: '{{ .Alerts.Firing | len }}'
        links:
          - href: '{{ .CommonAnnotations.runbook }}'
            text: 'Runbook'
          - href: '{{ .CommonAnnotations.dashboard }}'
            text: 'Dashboard'

  - name: pagerduty-payments
    pagerduty_configs:
      - routing_key: "PAYMENTS_TEAM_ROUTING_KEY"
        severity: critical
        description: '{{ .CommonAnnotations.summary }}'

  - name: slack-critical
    slack_configs:
      - channel: '#alerts-critical'
        color: 'danger'
        title: '{{ .Status | toUpper }}: {{ .CommonLabels.alertname }}'
        text: >-
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}
          *Severity:* {{ .CommonLabels.severity }}
          *Service:* {{ .CommonLabels.service }}
        actions:
          - type: button
            text: 'Runbook'
            url: '{{ .CommonAnnotations.runbook }}'
          - type: button
            text: 'Dashboard'
            url: '{{ .CommonAnnotations.dashboard }}'
          - type: button
            text: 'Silence'
            url: '{{ template "__alertmanagerURL" . }}/#/silences/new?filter=%7Balertname%3D%22{{ .CommonLabels.alertname }}%22%7D'
        send_resolved: true

  - name: slack-warning
    slack_configs:
      - channel: '#alerts-warning'
        color: 'warning'
        title: '{{ .CommonLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
        send_resolved: true

  - name: slack-backend
    slack_configs:
      - channel: '#team-backend-alerts'
        send_resolved: true

  - name: slack-frontend
    slack_configs:
      - channel: '#team-frontend-alerts'
        send_resolved: true

  - name: slack-payments
    slack_configs:
      - channel: '#team-payments-alerts'
        send_resolved: true

  - name: slack-business
    slack_configs:
      - channel: '#business-alerts'
        send_resolved: true

# Inhibition rules
inhibit_rules:
  # Suppress Warning while Critical is firing
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ['alertname', 'team']

  # Suppress individual endpoint alerts while the entire service is down
  - source_match:
      alertname: ServiceDown
    target_match_re:
      alertname: 'High.*BurnRate.*'
    equal: ['service']

  # If a Node is NotReady, suppress Pod alerts on that Node
  - source_match:
      alertname: KubeNodeNotReady
    target_match_re:
      alertname: 'Pod.*'
    equal: ['node']

# Templates
templates:
  - '/etc/alertmanager/templates/*.tmpl'
```

### 3.2 Customizing Alertmanager Templates

```go
{{/* /etc/alertmanager/templates/slack.tmpl */}}
{{ define "slack.custom.title" }}
{{ if eq .Status "firing" }}🔥{{ else }}✅{{ end }} [{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}
{{ end }}

{{ define "slack.custom.text" }}
{{ range .Alerts }}
*Alert:* {{ .Labels.alertname }}
*Severity:* {{ .Labels.severity }}
*Service:* {{ .Labels.service | default "unknown" }}

*Summary:* {{ .Annotations.summary }}
*Description:* {{ .Annotations.description }}

{{ if .Annotations.runbook }}📖 <{{ .Annotations.runbook }}|Runbook>{{ end }}
{{ if .Annotations.dashboard }}📊 <{{ .Annotations.dashboard }}|Dashboard>{{ end }}

*Started:* {{ .StartsAt.Format "2006-01-02 15:04:05 JST" }}
{{ if .EndsAt }}*Ended:* {{ .EndsAt.Format "2006-01-02 15:04:05 JST" }}{{ end }}
---
{{ end }}
{{ end }}

{{ define "slack.custom.footer" }}
Alertmanager | {{ .ExternalURL }}
{{ end }}
```

### 3.3 Managing Silences (Temporary Alert Suppression)

```bash
#!/bin/bash
# silence-management.sh — Alertmanager Silence management script

ALERTMANAGER_URL="http://alertmanager:9093"

# Create a Silence (for maintenance windows)
create_maintenance_silence() {
  local duration="${1:-2h}"
  local comment="${2:-Scheduled maintenance}"
  local creator="${3:-sre-team}"

  curl -X POST "${ALERTMANAGER_URL}/api/v2/silences" \
    -H "Content-Type: application/json" \
    -d "{
      \"matchers\": [
        {
          \"name\": \"severity\",
          \"value\": \"warning\",
          \"isRegex\": false,
          \"isEqual\": true
        }
      ],
      \"startsAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
      \"endsAt\": \"$(date -u -d \"+${duration}\" +%Y-%m-%dT%H:%M:%S.000Z)\",
      \"createdBy\": \"${creator}\",
      \"comment\": \"${comment}\"
    }"
}

# Silence a specific alert
silence_alert() {
  local alertname="$1"
  local duration="${2:-1h}"
  local reason="$3"

  curl -X POST "${ALERTMANAGER_URL}/api/v2/silences" \
    -H "Content-Type: application/json" \
    -d "{
      \"matchers\": [
        {
          \"name\": \"alertname\",
          \"value\": \"${alertname}\",
          \"isRegex\": false,
          \"isEqual\": true
        }
      ],
      \"startsAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
      \"endsAt\": \"$(date -u -d \"+${duration}\" +%Y-%m-%dT%H:%M:%S.000Z)\",
      \"createdBy\": \"$(whoami)\",
      \"comment\": \"${reason}\"
    }"
}

# List active Silences
list_silences() {
  curl -s "${ALERTMANAGER_URL}/api/v2/silences" | \
    jq '.[] | select(.status.state == "active") | {id: .id, createdBy: .createdBy, comment: .comment, endsAt: .endsAt}'
}

# Delete a Silence
expire_silence() {
  local silence_id="$1"
  curl -X DELETE "${ALERTMANAGER_URL}/api/v2/silence/${silence_id}"
}
```

---

## 4. Escalation Flow and On-Call

### 4.1 Escalation Flow Details

```
Escalation flow:

  Alert fires
      │
      ▼
  ┌──────────────┐
  │ Auto-fixable?│──── Yes ──► Auto-remediation
  └──────┬───────┘              e.g., Pod restart, scale-out
         │ No
         ▼
  ┌──────────────┐
  │  Severity?   │
  └──────┬───────┘
         │
    ┌────┼────────────────┐
    ▼    ▼                ▼
  Critical  Warning     Info
    │       │             │
    ▼       ▼             ▼
  PagerDuty  Slack       Slack
  + Slack    channel     channel
    │       (biz hours)  (record only)
    ▼
  No response
  within 5 min?
    │
    ▼
  Escalate to
  secondary on-call
    │
    ▼
  No response
  within 15 min?
    │
    ▼
  Escalate to
  manager
    │
    ▼
  No response
  within 30 min?
    │
    ▼
  Escalate to
  VP/CTO
```

### 4.2 Incident Severity (SEV) Definitions

```
Incident SEV levels:

┌──────┬────────────────┬──────────────┬──────────────┬──────────────┐
│ SEV  │ Definition     │ Example      │ Response     │ Notify       │
├──────┼────────────────┼──────────────┼──────────────┼──────────────┤
│ SEV-1│ Full service   │ All API 500  │ Immediate    │ All engineers│
│      │ outage         │ Data loss    │ (24/7)       │ + leadership │
├──────┼────────────────┼──────────────┼──────────────┼──────────────┤
│ SEV-2│ Major feature  │ Payment down │ Within       │ On-call      │
│      │ down, partial  │ Search down  │ 15 min (24/7)│ + team lead  │
├──────┼────────────────┼──────────────┼──────────────┼──────────────┤
│ SEV-3│ Feature        │ Slow         │ Within 4 hrs │ Team         │
│      │ degraded,      │ responses    │ (biz hours)  │              │
│      │ workaround     │ UI bug       │              │              │
├──────┼────────────────┼──────────────┼──────────────┼──────────────┤
│ SEV-4│ Minor issue    │ Log warning  │ Next sprint  │ Create ticket│
│      │ No user impact │ Non-prod env │ (biz hours)  │              │
└──────┴────────────────┴──────────────┴──────────────┴──────────────┘
```

### 4.3 PagerDuty / Opsgenie Integration

```typescript
// oncall-rotation.ts — On-call rotation design
interface OncallSchedule {
  team: string;
  rotationType: 'weekly' | 'daily';
  members: string[];
  escalationPolicy: EscalationLevel[];
  overrides: Override[];
  handoffTime: string; // "09:00" (handoff Monday morning)
}

interface EscalationLevel {
  level: number;
  targets: string[];
  timeout: number;  // minutes
  notificationChannels: ('phone' | 'sms' | 'push' | 'email')[];
}

interface Override {
  user: string;
  startDate: string;
  endDate: string;
  reason: string;
}

const backendOncall: OncallSchedule = {
  team: 'backend',
  rotationType: 'weekly',
  handoffTime: '09:00',
  members: [
    'engineer-a@example.com',
    'engineer-b@example.com',
    'engineer-c@example.com',
    'engineer-d@example.com',
    'engineer-e@example.com', // Minimum rotation of 5 people
  ],
  escalationPolicy: [
    {
      level: 1,
      targets: ['current-oncall'],
      timeout: 5,
      notificationChannels: ['push', 'phone'],
    },
    {
      level: 2,
      targets: ['secondary-oncall'],
      timeout: 10,
      notificationChannels: ['push', 'phone', 'sms'],
    },
    {
      level: 3,
      targets: ['engineering-manager'],
      timeout: 15,
      notificationChannels: ['phone', 'sms'],
    },
    {
      level: 4,
      targets: ['vp-engineering'],
      timeout: 30,
      notificationChannels: ['phone'],
    },
  ],
  overrides: [],
};
```

### 4.4 PagerDuty Terraform Configuration

```hcl
# pagerduty.tf — PagerDuty resource management
terraform {
  required_providers {
    pagerduty = {
      source  = "PagerDuty/pagerduty"
      version = "~> 3.0"
    }
  }
}

provider "pagerduty" {
  token = var.pagerduty_token
}

# Team
resource "pagerduty_team" "backend" {
  name        = "Backend Team"
  description = "Backend engineering team"
}

# Users
resource "pagerduty_user" "engineers" {
  for_each = toset([
    "engineer-a@example.com",
    "engineer-b@example.com",
    "engineer-c@example.com",
    "engineer-d@example.com",
    "engineer-e@example.com",
  ])

  name  = each.key
  email = each.key
  role  = "user"
}

# On-call schedule
resource "pagerduty_schedule" "backend_primary" {
  name      = "Backend Primary On-Call"
  time_zone = "Asia/Tokyo"

  layer {
    name                         = "Primary"
    start                        = "2025-01-06T09:00:00+09:00"
    rotation_virtual_start       = "2025-01-06T09:00:00+09:00"
    rotation_turn_length_seconds = 604800  # 1 week

    users = [for u in pagerduty_user.engineers : u.id]
  }
}

resource "pagerduty_schedule" "backend_secondary" {
  name      = "Backend Secondary On-Call"
  time_zone = "Asia/Tokyo"

  layer {
    name                         = "Secondary"
    start                        = "2025-01-13T09:00:00+09:00"
    rotation_virtual_start       = "2025-01-13T09:00:00+09:00"
    rotation_turn_length_seconds = 604800

    users = [for u in pagerduty_user.engineers : u.id]
  }
}

# Escalation policy
resource "pagerduty_escalation_policy" "backend" {
  name      = "Backend Escalation Policy"
  num_loops = 2  # Repeat all levels 2 times

  rule {
    escalation_delay_in_minutes = 5
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.backend_primary.id
    }
  }

  rule {
    escalation_delay_in_minutes = 10
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.backend_secondary.id
    }
  }

  rule {
    escalation_delay_in_minutes = 15
    target {
      type = "user_reference"
      id   = pagerduty_user.engineers["engineer-a@example.com"].id  # EM
    }
  }
}

# Service
resource "pagerduty_service" "order_service" {
  name                    = "Order Service"
  description             = "Order processing service"
  escalation_policy       = pagerduty_escalation_policy.backend.id
  auto_resolve_timeout    = 14400  # Auto-resolve after 4 hours
  acknowledgement_timeout = 600    # Escalate after 10 minutes

  alert_creation = "create_alerts_and_incidents"

  incident_urgency_rule {
    type    = "constant"
    urgency = "high"
  }

  auto_pause_notifications_parameters {
    enabled = true
    timeout = 300  # 5-minute flapping prevention
  }
}

# Service integration (Prometheus Alertmanager → PagerDuty)
resource "pagerduty_service_integration" "prometheus" {
  name    = "Prometheus Alertmanager"
  service = pagerduty_service.order_service.id
  vendor  = data.pagerduty_vendor.prometheus.id
}

data "pagerduty_vendor" "prometheus" {
  name = "Prometheus"
}
```

---

## 5. Auto-Remediation

### 5.1 Kubernetes CronJob for Auto-Remediation

```yaml
# auto-remediation.yml — Auto-remediation job
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-stuck-pods
  namespace: monitoring
spec:
  schedule: "*/5 * * * *"  # Every 5 minutes
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: auto-remediation
          containers:
            - name: remediation
              image: bitnami/kubectl:latest
              command:
                - /bin/bash
                - -c
                - |
                  # Detect and delete CrashLoopBackOff pods
                  kubectl get pods --all-namespaces -o json | \
                    jq -r '.items[] |
                      select(.status.containerStatuses[]?.state.waiting.reason == "CrashLoopBackOff") |
                      select(.status.containerStatuses[]?.restartCount > 10) |
                      "\(.metadata.namespace) \(.metadata.name)"' | \
                  while read namespace pod; do
                    echo "Deleting CrashLoopBackOff pod: ${namespace}/${pod}"
                    kubectl delete pod -n "${namespace}" "${pod}" --grace-period=0
                  done

                  # Clean up evicted pods
                  kubectl get pods --all-namespaces --field-selector=status.phase=Failed -o json | \
                    jq -r '.items[] | select(.status.reason == "Evicted") | "\(.metadata.namespace) \(.metadata.name)"' | \
                  while read namespace pod; do
                    echo "Cleaning up evicted pod: ${namespace}/${pod}"
                    kubectl delete pod -n "${namespace}" "${pod}"
                  done
          restartPolicy: OnFailure
```

### 5.2 Alertmanager Webhook for Auto-Remediation

```typescript
// auto-remediation-webhook.ts — Alert-based auto-remediation
import express from 'express';
import { KubernetesObjectApi, KubeConfig } from '@kubernetes/client-node';

const app = express();
app.use(express.json());

interface AlertmanagerWebhook {
  status: 'firing' | 'resolved';
  alerts: {
    status: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }[];
}

// Define auto-remediation actions
const remediationActions: Record<string, (alert: any) => Promise<void>> = {
  // Pod restart
  PodCrashLooping: async (alert) => {
    const namespace = alert.labels.namespace;
    const pod = alert.labels.pod;
    console.log(`Auto-remediation: Restarting pod ${namespace}/${pod}`);

    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(KubernetesObjectApi);

    await k8sApi.delete({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: pod, namespace: namespace },
    });

    // Slack notification
    await notifySlack(`Auto-remediation: Restarted pod ${namespace}/${pod}`);
  },

  // HPA scale-out
  HPAMaxedOut: async (alert) => {
    const namespace = alert.labels.namespace;
    const hpaName = alert.labels.horizontalpodautoscaler;
    console.log(`Auto-remediation: Scaling up HPA ${namespace}/${hpaName}`);

    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(KubernetesObjectApi);

    // Increase max replicas by 50%
    const hpa = await k8sApi.read({
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: { name: hpaName, namespace: namespace },
    });

    const currentMax = (hpa.body as any).spec.maxReplicas;
    const newMax = Math.ceil(currentMax * 1.5);

    await k8sApi.patch({
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: { name: hpaName, namespace: namespace },
    }, [
      { op: 'replace', path: '/spec/maxReplicas', value: newMax },
    ]);

    await notifySlack(
      `Auto-remediation: Changed max replicas for HPA ${namespace}/${hpaName} from ${currentMax} to ${newMax}`
    );
  },

  // Disk space cleanup
  DiskSpaceCritical: async (alert) => {
    const instance = alert.labels.instance;
    console.log(`Auto-remediation: Cleaning disk on ${instance}`);

    // Cleanup via SSH (in practice, use Ansible / SSM)
    // Delete old log files
    // Remove unused Docker images
    await notifySlack(
      `Auto-remediation: Executed disk cleanup on ${instance}`
    );
  },
};

// Webhook endpoint
app.post('/webhook/alertmanager', async (req, res) => {
  const payload: AlertmanagerWebhook = req.body;

  for (const alert of payload.alerts) {
    if (alert.status !== 'firing') continue;

    const alertName = alert.labels.alertname;
    const action = remediationActions[alertName];

    if (action) {
      try {
        await action(alert);
        console.log(`Remediation succeeded for ${alertName}`);
      } catch (error) {
        console.error(`Remediation failed for ${alertName}:`, error);
        await notifySlack(
          `Auto-remediation failed: ${alertName} — ${(error as Error).message}`
        );
      }
    }
  }

  res.status(200).send('ok');
});

async function notifySlack(message: string): Promise<void> {
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: '#auto-remediation',
      text: message,
    }),
  });
}

app.listen(8080, () => {
  console.log('Auto-remediation webhook listening on :8080');
});
```

---

## 6. Postmortem Template

### 6.1 Postmortem Document

```markdown
<!-- postmortem-template.md -->
# Postmortem: [Incident Title]

## Summary
- **Date/Time**: 2025-03-15 14:30 – 15:45 JST (75 minutes)
- **Impact**: Payment processing unavailable for all users
- **Severity**: SEV-1 (Critical service-wide outage)
- **Detection method**: SLO burn-rate alert (automatic detection)
- **Responders**: @engineer-a (primary), @engineer-b (support)
- **Incident Commander**: @engineer-a

## Timeline
| Time  | Event |
|-------|-------|
| 14:30 | Deployment completed (v2.5.0) |
| 14:32 | Error rate spike, alert fired |
| 14:35 | On-call engineer acknowledged |
| 14:38 | #incident-20250315 Slack channel created |
| 14:40 | Confirmed 500 errors on payment API |
| 14:45 | Status page updated to "Degraded" |
| 14:50 | Root cause identified: DB migration renamed payment table column |
| 15:00 | Rollback started (to v2.4.3) |
| 15:15 | Rollback completed, error rate normalized |
| 15:30 | Status page updated to "Operational" |
| 15:45 | All metrics confirmed normal, incident closed |

## Root Cause
The DB migration renamed the `payment_status` column to `status`, but
the old version of the code still referenced `payment_status`.
During rolling update, old and new versions coexisted, causing the old code
to throw a column-not-found error.

## Impact Quantification
- Users affected: approximately 3,200
- Failed transactions: 847
- Estimated revenue loss: ¥4,235,000
- SLO error budget consumed: 12.3% of monthly budget

## 5 Whys Analysis
1. **Why** did payments fail? → Column name mismatch
2. **Why** was there a column name mismatch? → Breaking migration change
3. **Why** was the breaking change applied to production? → Expand-Contract pattern not used
4. **Why** was the pattern not used? → No DB migration guidelines
5. **Why** are there no guidelines? → Migration strategy not documented

## Prevention Actions
| Action | Owner | Due | Priority | Status |
|--------|-------|-----|----------|--------|
| Make Expand-Contract pattern mandatory for DB migrations | @engineer-a | 2025-03-22 | P0 | Done |
| Add automated smoke tests after deployment | @engineer-b | 2025-03-29 | P1 | In progress |
| Automate rollback procedure | @engineer-c | 2025-04-05 | P1 | Not started |
| Document DB migration guidelines | @engineer-a | 2025-04-12 | P1 | Not started |
| Automated migration compatibility check (CI) | @engineer-d | 2025-04-19 | P2 | Not started |

## Lessons Learned
- Perform breaking DB changes incrementally using the Expand-Contract pattern
- Allow a monitoring period immediately after deployment (at least 10 minutes)
- Pre-define rollback decision criteria
- Update the status page promptly to be transparent with users about impact

## What Went Well
- SLO burn-rate alert detected the issue within 2 minutes
- On-call engineer acknowledged within 3 minutes
- Rollback itself was completed in 15 minutes (procedure was well prepared)
```

### 6.2 Postmortem Process

```
Postmortem operational process:

  Incident occurs
      │
      ▼
  ┌──────────────────┐
  │ Incident response │  ← Focus on response now. Document later.
  │ (Recovery first)  │
  └──────┬───────────┘
         │ Recovery complete
         ▼
  ┌──────────────────┐
  │ Create postmortem │
  │ within 48 hours   │  ← While the memory is fresh
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │ Postmortem        │  ← All stakeholders attend
  │ review meeting    │     Blame-free principle
  └──────┬───────────┘     30–60 minutes
         │
         ▼
  ┌──────────────────┐
  │ Action item       │  ← Convert to Jira / Linear tickets
  │ tracking          │     Set deadlines and owners clearly
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │ Monthly alert     │  ← Confirm action item completion
  │ review            │     Evaluate new alerts
  └──────────────────┘
```

### 6.3 Automated Postmortem GitHub Issue Creation

```yaml
# .github/workflows/create-postmortem.yml
name: Create Postmortem Issue

on:
  workflow_dispatch:
    inputs:
      incident_title:
        description: 'Incident title'
        required: true
      severity:
        description: 'SEV level'
        required: true
        type: choice
        options: ['SEV-1', 'SEV-2', 'SEV-3']
      start_time:
        description: 'Start time (JST)'
        required: true
      end_time:
        description: 'End time (JST)'
        required: true
      incident_commander:
        description: 'Incident commander (GitHub username)'
        required: true

jobs:
  create-issue:
    runs-on: ubuntu-latest
    steps:
      - name: Create Postmortem Issue
        uses: actions/github-script@v7
        with:
          script: |
            const body = `# Postmortem: ${{ inputs.incident_title }}

            ## Summary
            - **Date/Time**: ${{ inputs.start_time }} – ${{ inputs.end_time }} JST
            - **Severity**: ${{ inputs.severity }}
            - **Incident Commander**: @${{ inputs.incident_commander }}

            ## Timeline
            | Time | Event |
            |------|-------|
            | | |

            ## Root Cause
            _(Please fill in)_

            ## Impact Quantification
            - Users affected:
            - Failed requests:
            - SLO error budget consumed:

            ## 5 Whys Analysis
            1. **Why**
            2. **Why**
            3. **Why**
            4. **Why**
            5. **Why**

            ## Prevention Actions
            | Action | Owner | Due | Priority |
            |--------|-------|-----|----------|
            | | | | |

            ## Lessons Learned
            -

            ## What Went Well
            -

            ---
            **Due: ${new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0]} (complete within 48 hours)**
            `;

            const issue = await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[Postmortem] ${{ inputs.incident_title }}`,
              body: body,
              labels: ['postmortem', '${{ inputs.severity }}'],
              assignees: ['${{ inputs.incident_commander }}'],
            });

            console.log(`Created postmortem issue: ${issue.data.html_url}`);
```

---

## 7. Incident Response Process

### 7.1 Incident Commander (IC) Role

```
Incident Commander responsibilities:

┌────────────────────────────────────────────────────┐
│                                                    │
│  1. Assess                                         │
│     · Confirm scope of impact                      │
│     · Determine SEV level                          │
│     · Assemble the response team                   │
│                                                    │
│  2. Communicate                                    │
│     · Create #incident channel                     │
│     · Regular status updates (every 15 minutes)    │
│     · Update status page                           │
│     · Report to stakeholders                       │
│                                                    │
│  3. Delegate                                       │
│     · Assign investigation owners                  │
│     · Assign external communication owner          │
│     · Do not get drawn into investigation          │
│       (focus on command)                           │
│                                                    │
│  4. Decide                                         │
│     · Rollback decision                            │
│     · Escalation decision                          │
│     · Incident close decision                      │
│                                                    │
│  5. Record                                         │
│     · Document the timeline                        │
│     · Arrange postmortem                           │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 7.2 Incident Response Checklist

```
□ Confirm and acknowledge the alert
  └─ Acknowledge in PagerDuty/Opsgenie
  └─ Review alert content

□ Initial assessment (first 5 minutes)
  └─ Confirm scope of impact
  └─ Determine SEV level
  └─ Review Runbook

□ Begin communication
  └─ Create #incident-YYYYMMDD channel
  └─ Declare IC (Incident Commander)
  └─ Post initial status

□ Investigate and respond
  └─ Check dashboards / logs / traces
  └─ Review recent changes (deployments, config changes)
  └─ Form hypotheses about the cause and verify

□ Execute mitigation
  └─ Rollback / scale-out / failover
  └─ Execute measures to reduce impact

□ Update status page
  └─ SEV-1/2: Update every 15 minutes
  └─ SEV-3: Update every hour

□ Confirm recovery
  └─ Confirm metrics have returned to normal range
  └─ Confirm no further user impact
  └─ Update status page to "Operational"

□ Close incident
  └─ Announce closure in #incident channel
  └─ Arrange postmortem creation (within 48 hours)
  └─ Final report to stakeholders
```

### 7.3 Status Page Operations

```typescript
// statuspage-updater.ts — Automated status page updates
import fetch from 'node-fetch';

interface StatusPageConfig {
  apiKey: string;
  pageId: string;
  componentMap: Record<string, string>; // service name → component ID
}

class StatusPageUpdater {
  constructor(private config: StatusPageConfig) {}

  // Update component status
  async updateComponentStatus(
    serviceName: string,
    status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage'
  ): Promise<void> {
    const componentId = this.config.componentMap[serviceName];
    if (!componentId) throw new Error(`Unknown service: ${serviceName}`);

    await fetch(
      `https://api.statuspage.io/v1/pages/${this.config.pageId}/components/${componentId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `OAuth ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          component: { status },
        }),
      }
    );
  }

  // Create an incident
  async createIncident(
    name: string,
    body: string,
    impactOverride: 'none' | 'minor' | 'major' | 'critical',
    componentIds: string[],
    componentStatus: string
  ): Promise<string> {
    const response = await fetch(
      `https://api.statuspage.io/v1/pages/${this.config.pageId}/incidents`,
      {
        method: 'POST',
        headers: {
          'Authorization': `OAuth ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incident: {
            name,
            body,
            status: 'investigating',
            impact_override: impactOverride,
            component_ids: componentIds,
            components: Object.fromEntries(
              componentIds.map(id => [id, componentStatus])
            ),
          },
        }),
      }
    );

    const data = await response.json() as any;
    return data.id;
  }

  // Update an incident
  async updateIncident(
    incidentId: string,
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved',
    body: string
  ): Promise<void> {
    await fetch(
      `https://api.statuspage.io/v1/pages/${this.config.pageId}/incidents/${incidentId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `OAuth ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incident: {
            status,
            body,
          },
        }),
      }
    );
  }
}

// Usage example
const statusPage = new StatusPageUpdater({
  apiKey: process.env.STATUSPAGE_API_KEY!,
  pageId: 'your-page-id',
  componentMap: {
    'order-service': 'component-id-1',
    'payment-service': 'component-id-2',
    'user-service': 'component-id-3',
  },
});

// When an incident occurs
const incidentId = await statusPage.createIncident(
  'Payment Processing Delay',
  'Payment processing is taking longer than usual. Under investigation.',
  'major',
  ['component-id-2'],
  'degraded_performance'
);

// After root cause is identified
await statusPage.updateIncident(
  incidentId,
  'identified',
  'We have confirmed a temporary failure on the payment provider side. Awaiting recovery.'
);

// After recovery
await statusPage.updateIncident(
  incidentId,
  'resolved',
  'The payment provider failure has been resolved and all services are operating normally.'
);
```

---

## 8. Comparison Tables

| Alert Tool | Alertmanager | PagerDuty | Opsgenie | Datadog Monitors |
|------------|-------------|-----------|----------|-----------------|
| Deployment | OSS | SaaS | SaaS | SaaS |
| Escalation | Basic | Advanced | Advanced | Basic |
| On-call management | None (external integration) | Full-featured | Full-featured | None (external integration) |
| Mobile app | None | Available | Available | Available |
| Incident management | None | Available | Available | Available |
| Auto-remediation | Webhook | Event Orchestration | Webhook | Workflow Automation |
| Pricing | Free | $21/user/month+ | $9/user/month+ | Included |
| Terraform | Supported | Supported | Supported | Supported |

| Postmortem Tool | Google Docs | Jeli | incident.io | Notion | GitHub Issues |
|----------------|------------|------|-------------|--------|---------------|
| Template management | Manual | Automatic | Automatic | Manual | Automatic (Actions) |
| Auto timeline generation | No | Supported | Supported | No | No |
| Metrics embedding | No | Supported | Supported | No | No |
| Action tracking | No | Supported | Supported | Manual | Issue integration |
| Slack integration | No | Supported | Supported | Supported | Supported |
| Cost | Free | Paid | Paid | Free/Paid | Free |

| Status Page | Statuspage | Instatus | Cachet | Better Uptime |
|-------------|-----------|----------|--------|--------------|
| Deployment | SaaS | SaaS | OSS | SaaS |
| API support | Full-featured | Supported | Supported | Supported |
| Automated status update | Supported | Supported | Limited | Supported |
| Custom domain | Supported | Supported | Supported | Supported |
| Pricing | $29/month+ | $20/month+ | Free | $20/month+ |

---

## 9. Anti-Patterns

### Anti-Pattern 1: Alert Fatigue

```
[Bad example]
- More than 50 alerts firing per day
- Most are ignored as "no action needed"
- Truly important alerts are also missed
- On-call engineers burn out and resign

[Good example]
- Alerts are limited to "things requiring immediate human action"
- Monthly alert review:
  - Alerts ignored as no action needed → delete or adjust threshold
  - Alerts that can be auto-recovered → convert to auto-remediation
  - Frequently firing alerts → fix the root cause
- Goal: PAGE fires only a few times a month; every alert must result in an action
```

### Anti-Pattern 2: Alerts Without Runbooks

```
[Bad example]
- Alert fires but the response method is unclear
- Search Slack for "how did we handle this last time?"
- Call an experienced engineer in the middle of the night to check
- Same incident gets handled differently each time

[Good example]
- All alerts linked to a Runbook URL
- Runbook contents:
  1. Meaning of the alert and scope of impact
  2. Dashboards/logs to check
  3. Step-by-step response procedure
  4. Escalation decision criteria
  5. Links to past incidents
- Make a habit of updating Runbooks after an incident
```

### Anti-Pattern 3: Postmortems Becoming Formalities

```
[Bad example]
- Postmortems are written but action items are left unattended
- Incidents with the same root cause keep recurring
- "Individual carelessness" is listed as the root cause
- Postmortems turn into blame sessions

[Good example]
- Action items are always converted to tickets with deadlines and owners
- Monthly check on action item progress
- Root causes described as "areas for system improvement"
  x "Person A forgot to test"
  o "No automated testing mechanism; dependent on manual testing"
- Repeatedly communicate the purpose of postmortems:
  "What failed?" not "Who failed?"
```

### Anti-Pattern 4: Insufficient Escalation

```
[Bad example]
- On-call engineer struggles alone for over 2 hours
- Thinks "almost solved it" and hesitates to escalate
- Downtime ends up being prolonged
- Afterwards: "Why didn't you escalate sooner?"

[Good example]
- Formalize escalation decision criteria:
  · Root cause not identified within 15 minutes → escalate
  · SEV-1/2 incidents → escalate immediately
  · Outside your area of expertise → escalate immediately
- Escalation is "good judgment," not "weakness"
- IC has a role in encouraging escalation
```

---

## 10. Monthly Alert Review

### 10.1 Review Meeting Agenda

```
Monthly alert review (60 minutes):

  1. Last month's alert statistics (10 min)
     · PAGE / TICKET / NOTIFICATION counts
     · MTTA (mean time to acknowledge) / MTTR (mean time to resolve)
     · False positive rate
     · Top 5 most frequently fired alerts

  2. Alert inventory (20 min)
     · Alerts with many false positives → adjust threshold or delete
     · Alerts that required no action → change level or delete
     · Alerts that should be newly added → create
     · Alerts that can be moved to auto-remediation → automate

  3. Runbook updates (10 min)
     · Create Runbooks for new alerts
     · Update existing Runbooks (latest response procedures)
     · Check Runbook coverage (target: 100%)

  4. Postmortem action item review (10 min)
     · Progress on incomplete action items
     · Confirm effectiveness of completed actions

  5. On-call experience retrospective (10 min)
     · Feedback from on-call engineers
     · Improvement suggestions
     · Confirm next month's schedule
```

### 10.2 PromQL for Alert Review

```promql
# PAGE count last month
count(ALERTS{severity="critical", alertstate="firing"})

# Alert firing count by alert (Top 10)
topk(10,
  count(ALERTS{alertstate="firing"}) by (alertname)
)

# Average firing duration by alert
avg(
  time() - ALERTS_FOR_STATE{alertstate="firing"}
) by (alertname)

# Estimated false positive rate
# (proportion of alerts resolved within 5 minutes)
count(ALERTS{alertstate="firing"} < 300) by (alertname)
/
count(ALERTS{alertstate="firing"}) by (alertname)
```

---

## 11. FAQ

### Q1: How should I determine alert thresholds?

Use SLO-based burn-rate alerts as the foundation, with static thresholds (e.g., CPU > 80%) as supplementary. Burn-rate alerts predict "if errors continue at this rate, the SLO will be violated," and are directly tied to business impact. Start with loose thresholds and adjust the balance between false positives and false negatives (missed detections) as you operate.

### Q2: What is the appropriate number of people for an on-call rotation?

A minimum rotation of 4–5 people is recommended. Weekly rotation with each person on duty roughly once a month is ideal. With 2–3 people, the frequency is too high and there is a risk of burnout. Additionally, set up a primary and secondary on-call, with automatic escalation to the secondary if the primary is unable to respond.

### Q3: What is the most important thing about postmortems?

Thoroughly enforcing a **blame-free culture**. The purpose of a postmortem is not "who was at fault" but "where are the areas for improvement in the system." Blaming individuals causes information to be hidden and reduces the organization's learning capacity. Design prevention actions in the direction of "prevent through the system" rather than "people be more careful."

### Q4: How do I achieve high availability for Alertmanager?

Alertmanager natively supports clustering. Connect multiple instances to each other with the `--cluster.peer` flag to achieve alert deduplication and automatic failover. Use a configuration of at least 2 instances, with 3 recommended, where all Prometheus instances send notifications to all Alertmanager instances.

### Q5: Who should manage business metric alerts?

Business metric alerts should be managed collaboratively between the engineering team and the business team. Engineers handle the technical implementation of alerts (PromQL / Datadog queries), while the business team is responsible for defining thresholds and business impact. Business alerts are typically at the TICKET level and designed to be handled during business hours.

### Q6: What are the precautions when using alert Silences?

Silences are used during planned maintenance or when alerts repeatedly fire due to known issues. Precautions: (1) always set an expiry on Silences (permanent Silences are prohibited), (2) record the reason for the Silence in a comment, (3) notify Slack when a Silence is created/deleted, (4) check weekly for any unnecessary Silences.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|------------|
| Alert design | Tier alerts into PAGE/TICKET/NOTIFICATION. Minimize PAGE |
| Burn-rate alerts | Predictive SLO-based alerts. Multi-window reduces false positives |
| Escalation | Tiered notification targets. Auto-escalate on timeout |
| On-call | 4–5 person rotation. Always prepare Runbooks |
| Auto-remediation | Automatically recover from routine failures via Webhook/CronJob |
| Postmortem | Conduct blame-free. Always convert action items to tickets |
| Alert fatigue | Monthly review to remove unnecessary alerts. Promote auto-remediation |
| Incident management | Define SEV levels, IC role, and status page operations |

---

## Recommended Next Reads

- [00-observability.md](./00-observability.md) — Fundamentals of observability
- [01-monitoring-tools.md](./01-monitoring-tools.md) — Selecting and building monitoring tools
- [03-performance-monitoring.md](./03-performance-monitoring.md) — Performance monitoring

---

## References

1. **Google SRE Book - Alerting on SLOs** — https://sre.google/workbook/alerting-on-slos/ — SLO-based alert design
2. **PagerDuty Incident Response Guide** — https://response.pagerduty.com/ — Best practices for incident response
3. **Alertmanager Documentation** — https://prometheus.io/docs/alerting/latest/alertmanager/ — Official Alertmanager documentation
4. **Etsy Debriefing Facilitation Guide** — https://github.com/etsy/DebriefingFacilitationGuide — Postmortem facilitation techniques
5. **incident.io** — https://incident.io/ — Incident management platform
6. **Jeli** — https://www.jeli.io/ — Postmortem management tool
7. **Learning from Incidents in Software** — https://www.learningfromincidents.io/ — Learning from incidents
