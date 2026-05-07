# Monitoring Tools

> Understand the characteristics of Datadog, Grafana, and CloudWatch, and build an optimal monitoring infrastructure suited to your system scale and requirements

## What You Will Learn

1. **OSS Monitoring Stack with Grafana + Prometheus** — Metrics collection, dashboard building, and PromQL usage
2. **Full-Stack Monitoring with Datadog** — Leveraging a SaaS-based integrated monitoring platform
3. **AWS-Native Monitoring with CloudWatch** — Configuring metrics, logs, alarms, and dashboards
4. **Log Aggregation with Grafana Loki** — Designing a lightweight label-based log infrastructure and writing LogQL queries
5. **Long-Term Storage and Scaling** — Achieving multi-cluster monitoring with Thanos, Cortex, and Mimir


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Observability](./00-observability.md)

---

## 1. Overview of Monitoring Tools

```
┌──────────────────────────────────────────────────────┐
│               Monitoring Tool Options                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  OSS Stack (self-hosted)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │Prometheus│─►│ Grafana  │  │  Loki    │           │
│  │(metrics) │  │(viz)     │  │(logs)    │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐                         │
│  │  Jaeger  │  │ Alertmgr │                         │
│  │(traces)  │  │(alerts)  │                         │
│  └──────────┘  └──────────┘                         │
│                                                      │
│  SaaS (managed)                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Datadog  │  │ New Relic│  │CloudWatch│           │
│  │(full     │  │(APM-     │  │(AWS-     │           │
│  │ stack)   │  │ focused) │  │ native)  │           │
│  └──────────┘  └──────────┘  └──────────┘           │
└──────────────────────────────────────────────────────┘
```

### 1.1 Monitoring Tool Selection Framework

Choosing a monitoring tool depends heavily on your organization's phase, team size, and technology stack. Use the following framework to guide your decision.

```
Selection Decision Flow:

  ┌───────────────────┐
  │ AWS only?          │
  └────────┬──────────┘
           │
     ┌─────┼─────┐
     Yes         No
     │           │
     ▼           ▼
  Is CloudWatch  ┌───────────────────┐
  enough?        │ Dedicated SRE     │
     │           │ team available?    │
   ┌─┼─┐         └────────┬──────────┘
   Yes No              ┌───┼────┐
   │   │               Yes      No
   ▼   ▼               │        │
  CW   CW +            ▼        ▼
  only Grafana        OSS      SaaS
       integration   Stack   (Datadog etc.)
```

| Criterion | OSS (Prometheus+Grafana) | Datadog | CloudWatch |
|-----------|--------------------------|---------|------------|
| Team size | 2+ SRE engineers | Works with small teams | Immediate for AWS teams |
| Monthly cost | Infrastructure only ($100–500) | $500–$10,000+ | $100–$500 |
| Customizability | Very high | High | Moderate |
| Operational burden | High | Low | Low |
| Multi-cloud | Strength | Strength | AWS only |
| Setup speed | Slow (1–2 weeks) | Fast (hours) | Fastest (immediate) |
| Vendor lock-in | None | Yes | Yes (AWS) |

### 1.2 Monitoring Maturity Model

```
Level 0 — None
  No monitoring. Incidents are discovered through user reports.

Level 1 — Basic Infrastructure Monitoring
  Threshold-based alerts for CPU/memory/disk.
  Tools: CloudWatch basic metrics, Zabbix

Level 2 — Application Monitoring
  APM introduced. Measures latency, error rate, and throughput.
  Tools: Prometheus + Grafana, Datadog APM

Level 3 — SLO-Based Monitoring
  SLI/SLO defined; alerts based on error budgets.
  Tools: Prometheus + burn rate alerts, Datadog SLO

Level 4 — Full Observability
  Logs, metrics, and traces integrated.
  Any request can be traced end-to-end.
  Tools: Grafana Stack (Prometheus+Loki+Tempo), Datadog

Level 5 — Predictive Monitoring
  Anomaly detection and predictive alerts.
  Automated capacity planning.
  Tools: Datadog Watchdog, ML-based anomaly detection
```

---

## 2. Prometheus + Grafana Stack

### 2.1 Integrated Monitoring Environment with Docker Compose

```yaml
# docker-compose.monitoring.yml
version: "3.8"

services:
  prometheus:
    image: prom/prometheus:v2.50.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts/:/etc/prometheus/alerts/
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
      - '--storage.tsdb.retention.size=10GB'
      - '--web.enable-lifecycle'            # reload config via /-/reload
      - '--web.enable-admin-api'            # enable admin API
      - '--storage.tsdb.wal-compression'    # compress WAL to save disk
    restart: unless-stopped
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:10.3.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-piechart-panel
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
      - GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/var/lib/grafana/dashboards/home.json
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      - prometheus
      - loki
    restart: unless-stopped
    networks:
      - monitoring

  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - ./promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      - loki
    restart: unless-stopped
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:v1.7.0
    ports:
      - "9100:9100"
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped
    networks:
      - monitoring

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.47.0
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    privileged: true
    restart: unless-stopped
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:v0.27.0
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    restart: unless-stopped
    networks:
      - monitoring

volumes:
  prometheus-data:
  grafana-data:
  loki-data:

networks:
  monitoring:
    driver: bridge
```

### 2.2 Prometheus Configuration Details

```yaml
# prometheus.yml — Prometheus configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  scrape_timeout: 10s
  external_labels:
    cluster: production
    region: ap-northeast-1

rule_files:
  - "alerts/*.yml"

# Integration with Alertmanager
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  # Prometheus self-monitoring
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  # Node Exporter (server metrics)
  - job_name: "node-exporter"
    static_configs:
      - targets: ["node-exporter:9100"]

  # cAdvisor (container metrics)
  - job_name: "cadvisor"
    static_configs:
      - targets: ["cadvisor:8080"]

  # Application (Express/Fastify)
  - job_name: "app"
    metrics_path: /metrics
    scrape_interval: 10s
    static_configs:
      - targets: ["app:3000"]
        labels:
          service: "order-service"
          environment: "production"

  # Multi-target example (multiple services)
  - job_name: "microservices"
    scrape_interval: 10s
    static_configs:
      - targets: ["user-service:3001"]
        labels:
          service: "user-service"
      - targets: ["payment-service:3002"]
        labels:
          service: "payment-service"
      - targets: ["inventory-service:3003"]
        labels:
          service: "inventory-service"

  # Kubernetes Service Discovery
  - job_name: "kubernetes-pods"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      # Only target Pods with annotation prometheus.io/scrape: "true"
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      # Specify custom metrics path
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      # Specify custom port
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        target_label: __address__
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
      # Copy Pod labels to metrics labels
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      # Add namespace and Pod name
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name

  # Kubernetes Service Discovery — Service level
  - job_name: "kubernetes-services"
    kubernetes_sd_configs:
      - role: service
    metrics_path: /probe
    params:
      module: [http_2xx]
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_probe]
        action: keep
        regex: true
      - source_labels: [__address__]
        target_label: __param_target
      - target_label: __address__
        replacement: blackbox-exporter:9115
      - source_labels: [__param_target]
        target_label: instance
      - source_labels: [__meta_kubernetes_namespace]
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_service_name]
        target_label: kubernetes_service_name

  # EC2 Auto Discovery (AWS)
  - job_name: "ec2-instances"
    ec2_sd_configs:
      - region: ap-northeast-1
        port: 9100
        filters:
          - name: "tag:monitoring"
            values: ["enabled"]
    relabel_configs:
      - source_labels: [__meta_ec2_tag_Name]
        target_label: instance_name
      - source_labels: [__meta_ec2_instance_id]
        target_label: instance_id
      - source_labels: [__meta_ec2_availability_zone]
        target_label: availability_zone

  # Blackbox Exporter (synthetic monitoring)
  - job_name: "blackbox-http"
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - https://api.example.com/health
          - https://www.example.com
          - https://admin.example.com
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
```

### 2.3 Pre-Aggregation with Recording Rules

```yaml
# recording-rules.yml — pre-compute frequently used queries
groups:
  - name: http_request_rules
    interval: 30s
    rules:
      # Request rate (by service, method, and status class)
      - record: service:http_requests:rate5m
        expr: sum(rate(http_requests_total[5m])) by (service, method, status_class)

      # Error rate (by service)
      - record: service:http_error_rate:ratio_rate5m
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          /
          sum(rate(http_requests_total[5m])) by (service)

      # p50/p95/p99 latency (by service)
      - record: service:http_request_duration_seconds:p50
        expr: |
          histogram_quantile(0.5,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le)
          )

      - record: service:http_request_duration_seconds:p95
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le)
          )

      - record: service:http_request_duration_seconds:p99
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le)
          )

  - name: node_rules
    interval: 60s
    rules:
      # CPU utilization (by instance)
      - record: instance:node_cpu_utilization:ratio
        expr: |
          1 - avg by(instance) (
            irate(node_cpu_seconds_total{mode="idle"}[5m])
          )

      # Memory utilization (by instance)
      - record: instance:node_memory_utilization:ratio
        expr: |
          1 - (
            node_memory_MemAvailable_bytes
            /
            node_memory_MemTotal_bytes
          )

      # Disk utilization (by instance and mount point)
      - record: instance:node_filesystem_utilization:ratio
        expr: |
          1 - (
            node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"}
            /
            node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}
          )

      # Network receive/transmit rate
      - record: instance:node_network_receive_bytes:rate5m
        expr: sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[5m])) by (instance)

      - record: instance:node_network_transmit_bytes:rate5m
        expr: sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[5m])) by (instance)
```

---

## 3. PromQL Basics and Advanced Usage

### 3.1 Basic Queries

```promql
# Basic PromQL query examples

# 1. HTTP request rate (per second)
rate(http_requests_total[5m])

# 2. Error rate (%)
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
* 100

# 3. p95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# 4. CPU utilization (%)
100 - (avg by(instance) (
  irate(node_cpu_seconds_total{mode="idle"}[5m])
) * 100)

# 5. Memory utilization (%)
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# 6. Disk utilization (%)
(1 - (node_filesystem_avail_bytes{mountpoint="/"}
     / node_filesystem_size_bytes{mountpoint="/"})) * 100
```

### 3.2 PromQL Data Model in Detail

```
PromQL Data Model:

  Time Series
  ┌────────────────────────────────────────────┐
  │ metric_name{labels}                         │
  │                                            │
  │ http_requests_total{method="GET",status="200"}  │
  │                                            │
  │  Time        Value                          │
  │  T1    ──── 1000                           │
  │  T2    ──── 1050                           │
  │  T3    ──── 1120                           │
  │  T4    ──── 1200                           │
  │                                            │
  │  rate() → calculates the instantaneous rate of increase  │
  │  (1200 - 1000) / (T4 - T1) = X req/sec    │
  └────────────────────────────────────────────┘

  Metric types:
  ┌─────────┬──────────────────────────────────┐
  │ Counter │ Monotonically increasing (requests, errors)  │
  │ Gauge   │ Value that goes up and down (CPU usage, temp) │
  │Histogram│ Distribution (latency, size)      │
  │ Summary │ Direct quantile calculation       │
  └─────────┴──────────────────────────────────┘

  rate() vs irate():
  ┌─────────┬────────────────────────────────────────────┐
  │ rate()  │ Average increase rate over the full window. Good for stable graphs. │
  │ irate() │ Instantaneous rate from the last 2 points. Good for spike detection. │
  │ Recommended │ Use rate() for alerts, irate() for dashboards │
  └─────────┴────────────────────────────────────────────┘
```

### 3.3 Advanced Query Patterns

```promql
# --- SLO-related queries ---

# SLO burn rate (Multi-window)
# Combination of short window (5m) × long window (1h)
(
  sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))
) > (14.4 * 0.001)
and
(
  sum(rate(http_requests_total{status=~"5.."}[1h]))
  / sum(rate(http_requests_total[1h]))
) > (14.4 * 0.001)

# Availability SLI (30 days)
1 - (
  sum(increase(http_requests_total{status=~"5.."}[30d]))
  /
  sum(increase(http_requests_total[30d]))
)

# Remaining error budget (%)
(1 - (
  sum(increase(http_requests_total{status=~"5.."}[30d]))
  /
  sum(increase(http_requests_total[30d]))
  /
  (1 - 0.999)  # SLO: 99.9%
)) * 100

# --- Capacity planning ---

# Disk exhaustion prediction (predicted value 24 hours from now)
predict_linear(
  node_filesystem_avail_bytes{mountpoint="/"}[6h],
  24 * 3600
)

# Memory exhaustion prediction (4 hours from now)
predict_linear(
  node_memory_MemAvailable_bytes[1h],
  4 * 3600
) < 0

# CPU utilization trend (linear regression over 1 week)
predict_linear(
  instance:node_cpu_utilization:ratio[7d],
  30 * 24 * 3600  # 30 days from now
)

# --- Top-N analysis ---

# Top 5 endpoints with highest latency
topk(5,
  histogram_quantile(0.95,
    sum(rate(http_request_duration_seconds_bucket[5m])) by (le, handler)
  )
)

# Top 10 endpoints with most requests
topk(10,
  sum(rate(http_requests_total[5m])) by (handler)
)

# Top 5 services with highest error rate
topk(5,
  sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
  /
  sum(rate(http_requests_total[5m])) by (service)
)

# --- Day-over-day and week-over-week comparisons ---

# Day-over-day request count comparison
sum(rate(http_requests_total[1h]))
/
sum(rate(http_requests_total[1h] offset 1d))

# Week-over-week error rate comparison
(
  sum(rate(http_requests_total{status=~"5.."}[1h]))
  / sum(rate(http_requests_total[1h]))
)
/
(
  sum(rate(http_requests_total{status=~"5.."}[1h] offset 7d))
  / sum(rate(http_requests_total[1h] offset 7d))
)

# --- Container monitoring ---

# Container CPU utilization (%)
sum(rate(container_cpu_usage_seconds_total{name!=""}[5m])) by (name) * 100

# Container memory usage (MB)
container_memory_working_set_bytes{name!=""} / 1024 / 1024

# Container network I/O (bytes/sec)
sum(rate(container_network_receive_bytes_total{name!=""}[5m])) by (name)

# Pod restart count
sum(kube_pod_container_status_restarts_total) by (namespace, pod)
```

---

## 4. Grafana Dashboard Design and Management

### 4.1 Dashboard Management with Grafana Provisioning

```yaml
# grafana/provisioning/datasources/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"
      httpMethod: POST

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: false
    jsonData:
      maxLines: 1000
      derivedFields:
        - datasourceUid: tempo
          matcherRegex: "traceID=(\\w+)"
          name: TraceID
          url: "$${__value.raw}"

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    uid: tempo
    editable: false

  - name: Alertmanager
    type: alertmanager
    access: proxy
    url: http://alertmanager:9093
    editable: false
    jsonData:
      implementation: prometheus
```

```yaml
# grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: 'Infrastructure'
    type: file
    disableDeletion: true
    editable: false
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards/infrastructure
      foldersFromFilesStructure: true

  - name: 'applications'
    orgId: 1
    folder: 'Applications'
    type: file
    disableDeletion: true
    editable: false
    options:
      path: /var/lib/grafana/dashboards/applications
      foldersFromFilesStructure: true

  - name: 'slo'
    orgId: 1
    folder: 'SLO'
    type: file
    disableDeletion: true
    editable: false
    options:
      path: /var/lib/grafana/dashboards/slo
```

### 4.2 Grafana Dashboard JSON Structure

```json
{
  "dashboard": {
    "title": "Service Health Dashboard",
    "uid": "service-health-main",
    "tags": ["service", "slo", "production"],
    "timezone": "Asia/Tokyo",
    "refresh": "30s",
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "templating": {
      "list": [
        {
          "name": "service",
          "type": "query",
          "datasource": "Prometheus",
          "query": "label_values(http_requests_total, service)",
          "refresh": 2,
          "multi": true,
          "includeAll": true,
          "current": { "text": "All", "value": "$__all" }
        },
        {
          "name": "environment",
          "type": "custom",
          "options": [
            { "text": "production", "value": "production" },
            { "text": "staging", "value": "staging" }
          ],
          "current": { "text": "production", "value": "production" }
        }
      ]
    },
    "panels": [
      {
        "title": "Request Rate",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{service=~\"$service\"}[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "custom": {
              "drawStyle": "line",
              "lineWidth": 2,
              "fillOpacity": 10
            }
          }
        }
      },
      {
        "title": "Error Rate (%)",
        "type": "stat",
        "gridPos": { "h": 4, "w": 6, "x": 12, "y": 0 },
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{service=~\"$service\",status=~\"5..\"}[5m])) / sum(rate(http_requests_total{service=~\"$service\"}[5m])) * 100"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 0.1 },
                { "color": "red", "value": 1 }
              ]
            }
          }
        }
      },
      {
        "title": "Latency (p50/p95/p99)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.5, sum(rate(http_request_duration_seconds_bucket{service=~\"$service\"}[5m])) by (le))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service=~\"$service\"}[5m])) by (le))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service=~\"$service\"}[5m])) by (le))",
            "legendFormat": "p99"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "custom": { "drawStyle": "line", "lineWidth": 2 }
          }
        }
      }
    ]
  }
}
```

### 4.3 Managing Grafana Dashboards with Terraform

```hcl
# grafana.tf — Grafana dashboard management with Terraform
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 2.0"
    }
  }
}

provider "grafana" {
  url  = "https://grafana.example.com"
  auth = var.grafana_api_key
}

# Create folders
resource "grafana_folder" "infrastructure" {
  title = "Infrastructure"
}

resource "grafana_folder" "applications" {
  title = "Applications"
}

resource "grafana_folder" "slo" {
  title = "SLO Dashboards"
}

# Dashboards (loaded from JSON files)
resource "grafana_dashboard" "service_health" {
  folder    = grafana_folder.applications.id
  overwrite = true

  config_json = file("${path.module}/dashboards/service-health.json")
}

resource "grafana_dashboard" "node_overview" {
  folder    = grafana_folder.infrastructure.id
  overwrite = true

  config_json = file("${path.module}/dashboards/node-overview.json")
}

# Data sources
resource "grafana_data_source" "prometheus" {
  type = "prometheus"
  name = "Prometheus"
  url  = "http://prometheus:9090"

  json_data_encoded = jsonencode({
    timeInterval = "15s"
    httpMethod   = "POST"
  })

  is_default = true
}

resource "grafana_data_source" "loki" {
  type = "loki"
  name = "Loki"
  url  = "http://loki:3100"

  json_data_encoded = jsonencode({
    maxLines = 1000
  })
}

# Alert rules
resource "grafana_rule_group" "slo_alerts" {
  name             = "SLO Alerts"
  folder_uid       = grafana_folder.slo.uid
  interval_seconds = 60

  rule {
    name      = "High Error Rate"
    condition = "C"

    data {
      ref_id = "A"
      relative_time_range {
        from = 300
        to   = 0
      }
      datasource_uid = grafana_data_source.prometheus.uid
      model = jsonencode({
        expr = "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))"
      })
    }

    data {
      ref_id = "C"
      relative_time_range {
        from = 0
        to   = 0
      }
      datasource_uid = "__expr__"
      model = jsonencode({
        type       = "threshold"
        conditions = [{ evaluator = { type = "gt", params = [0.01] } }]
      })
    }
  }
}

# Notification policy
resource "grafana_notification_policy" "default" {
  contact_point = grafana_contact_point.slack.name
  group_by      = ["alertname", "service"]

  policy {
    matcher {
      label = "severity"
      match = "="
      value = "critical"
    }
    contact_point = grafana_contact_point.pagerduty.name
  }
}

resource "grafana_contact_point" "slack" {
  name = "Slack"

  slack {
    url     = var.slack_webhook_url
    channel = "#alerts"
  }
}

resource "grafana_contact_point" "pagerduty" {
  name = "PagerDuty"

  pagerduty {
    integration_key = var.pagerduty_key
    severity        = "critical"
  }
}
```

### 4.4 Dashboard Hierarchy Design

```
Dashboard Hierarchy Design:

  Level 0: Executive Overview
  ┌────────────────────────────────────────┐
  │ - Overall service uptime (SLA status)  │
  │ - Monthly incident count and MTTR      │
  │ - Error budget burn rate               │
  │ - Traffic trends (month-over-month)    │
  └────────────────────────────────────────┘
         │
         ▼
  Level 1: Service Overview (Team Lead)
  ┌────────────────────────────────────────┐
  │ - RED metrics per service              │
  │   (Rate / Error / Duration)            │
  │ - SLO status and burn rate             │
  │ - Recent deploys and their impact      │
  │ - Health of dependent services         │
  └────────────────────────────────────────┘
         │
         ▼
  Level 2: Technical Detail (Engineers)
  ┌────────────────────────────────────────┐
  │ - Latency distribution by endpoint     │
  │ - DB query performance                 │
  │ - Cache hit rate                       │
  │ - Pod/container resource utilization   │
  │ - External API call latency            │
  └────────────────────────────────────────┘
         │
         ▼
  Level 3: Debug (Incident Investigation)
  ┌────────────────────────────────────────┐
  │ - Trace list and span details          │
  │ - Log stream (LogQL)                   │
  │ - Network latency                      │
  │ - Goroutine / Thread dump              │
  └────────────────────────────────────────┘
```

---

## 5. Log Aggregation with Grafana Loki

### 5.1 Loki Configuration

```yaml
# loki-config.yml — Loki server configuration
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096
  log_level: warn

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20
  max_streams_per_user: 10000
  reject_old_samples: true
  reject_old_samples_max_age: 168h  # 7 days
  retention_period: 744h            # 31 days

storage_config:
  tsdb_shipper:
    active_index_directory: /loki/tsdb-index
    cache_location: /loki/tsdb-cache

compactor:
  working_directory: /loki/compactor
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h
  retention_delete_worker_count: 150
```

### 5.2 Promtail Configuration

```yaml
# promtail-config.yml — Log collection agent configuration
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push
    batchwait: 1s
    batchsize: 1048576  # 1MB
    tenant_id: default

scrape_configs:
  # Docker container logs
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'
      - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
        target_label: 'service'
    pipeline_stages:
      # Parse JSON logs
      - json:
          expressions:
            level: level
            msg: msg
            timestamp: timestamp
            traceId: traceId
      - labels:
          level:
          traceId:
      - timestamp:
          source: timestamp
          format: RFC3339Nano
      # Mask sensitive information
      - replace:
          expression: '(password|token|secret|api_key)=\S+'
          replace: '$1=***REDACTED***'

  # System logs (/var/log)
  - job_name: system
    static_configs:
      - targets: [localhost]
        labels:
          job: system
          __path__: /var/log/*.log
    pipeline_stages:
      - regex:
          expression: '^(?P<timestamp>\S+ \S+) (?P<hostname>\S+) (?P<service>\S+)\[(?P<pid>\d+)\]: (?P<message>.*)$'
      - labels:
          hostname:
          service:
      - timestamp:
          source: timestamp
          format: "2006-01-02T15:04:05.000Z"

  # Kubernetes Pod logs
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_pod_container_name]
        target_label: container
    pipeline_stages:
      - cri: {}
      - json:
          expressions:
            level: level
            msg: msg
      - labels:
          level:
```

### 5.3 LogQL in Practice

```logql
# --- Basic LogQL queries ---

# Filter by service name
{service="order-service"}

# Multi-condition filter
{service="order-service", level="error"}

# Filter by log content (pipeline)
{service="order-service"} |= "payment failed"

# Regex filter
{service="order-service"} |~ "timeout|connection refused"

# Exclusion filter
{service="order-service"} != "healthcheck" !~ "GET /health"

# --- JSON parsing ---

# Extract fields from JSON logs
{service="order-service"} | json | level="error"

# Filter by a specific field value
{service="order-service"} | json | status_code >= 500

# Use field values as labels
{service="order-service"} | json | line_format "{{.method}} {{.path}} {{.status_code}} {{.duration}}ms"

# --- Metric queries (Log-based Metrics) ---

# Rate of error log occurrences
rate({service="order-service", level="error"}[5m])

# Log volume by service (bytes/sec)
sum(bytes_rate({job="docker"}[5m])) by (service)

# Top 10 error messages
topk(10,
  sum(count_over_time({service="order-service", level="error"}[1h]))
  by (msg)
)

# p95 latency (parsed from JSON logs)
quantile_over_time(0.95,
  {service="order-service"} | json | unwrap duration [5m]
) by (method, path)

# Occurrence count of a specific error pattern
sum(count_over_time(
  {service="order-service"} |= "database connection" |= "timeout" [1h]
))

# --- Contextual investigation ---

# Logs associated with a specific trace ID
{traceId="abc123def456"}

# Error logs within a specific time range
{service="order-service", level="error"}
  | json
  | timestamp >= "2025-03-15T14:30:00Z"
  | timestamp <= "2025-03-15T15:00:00Z"

# Operation logs for a specific user (parse userId)
{service="order-service"} | json | userId="user-12345"
```

---

## 6. Integrated Monitoring with Datadog

### 6.1 Datadog APM Setup

```typescript
// datadog-apm.ts — Datadog APM setup
import tracer from 'dd-trace';

tracer.init({
  service: 'order-service',
  env: process.env.NODE_ENV ?? 'development',
  version: process.env.APP_VERSION ?? '0.0.0',
  logInjection: true,  // auto-inject trace ID into logs
  runtimeMetrics: true, // Node.js runtime metrics
  profiling: true,      // Continuous Profiling
  appsec: true,         // Application Security Monitoring
});

export default tracer;
```

### 6.2 Kubernetes Deployment of Datadog Agent

```yaml
# datadog-agent.yaml — Datadog Agent Kubernetes DaemonSet
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: datadog-agent
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: datadog-agent
  template:
    metadata:
      labels:
        app: datadog-agent
    spec:
      serviceAccountName: datadog-agent
      containers:
        - name: agent
          image: gcr.io/datadoghq/agent:7
          env:
            - name: DD_API_KEY
              valueFrom:
                secretKeyRef:
                  name: datadog-secrets
                  key: api-key
            - name: DD_SITE
              value: "ap1.datadoghq.com"
            - name: DD_APM_ENABLED
              value: "true"
            - name: DD_APM_NON_LOCAL_TRAFFIC
              value: "true"
            - name: DD_LOGS_ENABLED
              value: "true"
            - name: DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL
              value: "true"
            - name: DD_PROCESS_AGENT_ENABLED
              value: "true"
            - name: DD_DOGSTATSD_NON_LOCAL_TRAFFIC
              value: "true"
            - name: DD_CLUSTER_AGENT_ENABLED
              value: "true"
            - name: DD_CLUSTER_AGENT_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: datadog-secrets
                  key: cluster-agent-token
            # Kubernetes event collection
            - name: DD_KUBERNETES_EVENTS_ENABLED
              value: "true"
            # Network Performance Monitoring
            - name: DD_SYSTEM_PROBE_ENABLED
              value: "true"
            - name: DD_SYSTEM_PROBE_NETWORK_ENABLED
              value: "true"
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          ports:
            - containerPort: 8125
              name: dogstatsd
              protocol: UDP
            - containerPort: 8126
              name: apm
              protocol: TCP
          volumeMounts:
            - name: dockersocket
              mountPath: /var/run/docker.sock
            - name: procdir
              mountPath: /host/proc
              readOnly: true
            - name: cgroups
              mountPath: /host/sys/fs/cgroup
              readOnly: true
      volumes:
        - name: dockersocket
          hostPath:
            path: /var/run/docker.sock
        - name: procdir
          hostPath:
            path: /proc
        - name: cgroups
          hostPath:
            path: /sys/fs/cgroup
```

### 6.3 Sending Datadog Custom Metrics

```typescript
// datadog-metrics.ts — Sending custom metrics
import StatsD from 'hot-shots';

const dogstatsd = new StatsD({
  host: process.env.DD_AGENT_HOST ?? 'localhost',
  port: 8125,
  prefix: 'myapp.',
  globalTags: [
    `env:${process.env.NODE_ENV}`,
    `service:order-service`,
    `version:${process.env.APP_VERSION}`,
  ],
  errorHandler: (error) => {
    console.error('StatsD error:', error);
  },
});

// Business metrics examples
class BusinessMetrics {
  // Order creation
  recordOrderCreated(paymentMethod: string, amount: number): void {
    dogstatsd.increment('orders.created', 1, [
      `payment_method:${paymentMethod}`,
    ]);
    dogstatsd.histogram('orders.amount', amount, [
      `payment_method:${paymentMethod}`,
    ]);
  }

  // Order cancellation
  recordOrderCancelled(reason: string): void {
    dogstatsd.increment('orders.cancelled', 1, [
      `reason:${reason}`,
    ]);
  }

  // Track inventory levels
  recordInventoryLevel(productId: string, quantity: number): void {
    dogstatsd.gauge('inventory.level', quantity, [
      `product_id:${productId}`,
    ]);
  }

  // External API call latency
  recordExternalApiCall(
    provider: string,
    endpoint: string,
    durationMs: number,
    success: boolean
  ): void {
    dogstatsd.histogram('external_api.duration', durationMs, [
      `provider:${provider}`,
      `endpoint:${endpoint}`,
      `success:${success}`,
    ]);
    dogstatsd.increment('external_api.calls', 1, [
      `provider:${provider}`,
      `success:${success}`,
    ]);
  }

  // Cache hit rate
  recordCacheAccess(cacheName: string, hit: boolean): void {
    dogstatsd.increment('cache.access', 1, [
      `cache:${cacheName}`,
      `hit:${hit}`,
    ]);
  }
}

export const businessMetrics = new BusinessMetrics();
```

### 6.4 Datadog Monitors (Terraform)

```hcl
# datadog-monitors.tf — Monitor management with Terraform
terraform {
  required_providers {
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.0"
    }
  }
}

provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
  api_url = "https://api.ap1.datadoghq.com/"
}

# Error rate monitoring
resource "datadog_monitor" "error_rate" {
  name    = "[${var.environment}] ${var.service_name} - High Error Rate"
  type    = "query alert"
  message = <<-EOT
    ## Error rate has exceeded the threshold

    Service: ${var.service_name}
    Environment: ${var.environment}

    **Response steps:**
    1. Refer to [Runbook](https://wiki.example.com/runbooks/high-error-rate)
    2. Check error traces in APM
    3. Review recent deployments

    {{#is_alert}}@pagerduty-critical{{/is_alert}}
    {{#is_warning}}@slack-alerts-warning{{/is_warning}}
  EOT

  query = <<-EOT
    sum(last_5m):sum:trace.express.request.errors{service:${var.service_name},env:${var.environment}}.as_count()
    /
    sum:trace.express.request.hits{service:${var.service_name},env:${var.environment}}.as_count()
    > 0.05
  EOT

  monitor_thresholds {
    critical          = 0.05  # 5%
    warning           = 0.01  # 1%
    critical_recovery = 0.02
    warning_recovery  = 0.005
  }

  notify_no_data    = false
  renotify_interval = 60
  timeout_h         = 0

  tags = [
    "service:${var.service_name}",
    "env:${var.environment}",
    "team:backend",
  ]
}

# Latency monitoring (p95)
resource "datadog_monitor" "latency_p95" {
  name    = "[${var.environment}] ${var.service_name} - High Latency (p95)"
  type    = "query alert"
  message = <<-EOT
    ## p95 latency has exceeded the threshold

    Service: ${var.service_name}
    Current value: {{value}} ms

    **Items to check:**
    1. DB query performance
    2. External API response time
    3. CPU/memory resource status

    {{#is_alert}}@pagerduty-critical{{/is_alert}}
    {{#is_warning}}@slack-alerts-warning{{/is_warning}}
  EOT

  query = "percentile(last_5m):p95:trace.express.request{service:${var.service_name},env:${var.environment}} > 2000"

  monitor_thresholds {
    critical = 2000  # 2 seconds
    warning  = 1000  # 1 second
  }

  tags = [
    "service:${var.service_name}",
    "env:${var.environment}",
  ]
}

# Anomaly Detection
resource "datadog_monitor" "request_anomaly" {
  name    = "[${var.environment}] ${var.service_name} - Request Rate Anomaly"
  type    = "query alert"
  message = <<-EOT
    ## An anomaly has been detected in request volume

    A significant deviation from the normal pattern has been detected.
    This may indicate a traffic spike or service outage.

    @slack-alerts-warning
  EOT

  query = "avg(last_4h):anomalies(sum:trace.express.request.hits{service:${var.service_name},env:${var.environment}}.as_count(), 'agile', 3, direction='both', interval=60, alert_window='last_30m', count_default_zero='true') >= 1"

  monitor_thresholds {
    critical = 1
  }

  monitor_threshold_windows {
    trigger_window  = "last_30m"
    recovery_window = "last_15m"
  }

  tags = [
    "service:${var.service_name}",
    "env:${var.environment}",
    "type:anomaly",
  ]
}

# SLO Monitor
resource "datadog_service_level_objective" "availability" {
  name = "${var.service_name} - Availability SLO"
  type = "monitor"

  monitor_ids = [
    datadog_monitor.error_rate.id,
  ]

  thresholds {
    timeframe = "30d"
    target    = 99.9
    warning   = 99.95
  }

  thresholds {
    timeframe = "7d"
    target    = 99.9
    warning   = 99.95
  }

  tags = [
    "service:${var.service_name}",
    "env:${var.environment}",
  ]
}
```

---

## 7. AWS CloudWatch

### 7.1 Sending Custom Metrics

```typescript
// cloudwatch-custom-metrics.ts — Sending CloudWatch custom metrics
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-1' });

async function publishMetric(
  metricName: string,
  value: number,
  unit: 'Count' | 'Milliseconds' | 'Percent',
  dimensions: { Name: string; Value: string }[]
) {
  await cloudwatch.send(
    new PutMetricDataCommand({
      Namespace: 'MyApp/Production',
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Dimensions: dimensions,
          Timestamp: new Date(),
        },
      ],
    })
  );
}

// Example: recording API latency
await publishMetric('ApiLatency', 125, 'Milliseconds', [
  { Name: 'Service', Value: 'order-service' },
  { Name: 'Endpoint', Value: '/api/orders' },
]);

// Example: recording business metrics
await publishMetric('OrdersCreated', 1, 'Count', [
  { Name: 'PaymentMethod', Value: 'credit_card' },
]);
```

### 7.2 Batch Sending CloudWatch Metrics

```typescript
// cloudwatch-batch-metrics.ts — Efficient batch sending
import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';

class CloudWatchMetricsBatcher {
  private buffer: MetricDatum[] = [];
  private readonly maxBatchSize = 20; // CloudWatch limit
  private readonly flushIntervalMs = 10000; // 10 seconds
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly client: CloudWatchClient,
    private readonly namespace: string,
  ) {
    this.startAutoFlush();
  }

  addMetric(
    metricName: string,
    value: number,
    unit: StandardUnit,
    dimensions: { Name: string; Value: string }[] = [],
  ): void {
    this.buffer.push({
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Dimensions: dimensions,
      Timestamp: new Date(),
    });

    if (this.buffer.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  // Send statistical values (pre-aggregated data)
  addStatisticMetric(
    metricName: string,
    stats: { min: number; max: number; sum: number; count: number },
    unit: StandardUnit,
    dimensions: { Name: string; Value: string }[] = [],
  ): void {
    this.buffer.push({
      MetricName: metricName,
      StatisticValues: {
        Minimum: stats.min,
        Maximum: stats.max,
        Sum: stats.sum,
        SampleCount: stats.count,
      },
      Unit: unit,
      Dimensions: dimensions,
      Timestamp: new Date(),
    });
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batches: MetricDatum[][] = [];
    while (this.buffer.length > 0) {
      batches.push(this.buffer.splice(0, this.maxBatchSize));
    }

    await Promise.all(
      batches.map((batch) =>
        this.client.send(
          new PutMetricDataCommand({
            Namespace: this.namespace,
            MetricData: batch,
          })
        )
      )
    );
  }

  private startAutoFlush(): void {
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}

// Example usage
const batcher = new CloudWatchMetricsBatcher(
  new CloudWatchClient({ region: 'ap-northeast-1' }),
  'MyApp/Production'
);

// Add metrics (they are buffered)
batcher.addMetric('ApiLatency', 125, 'Milliseconds', [
  { Name: 'Service', Value: 'order-service' },
]);

// Flush on application shutdown
process.on('SIGTERM', async () => {
  await batcher.shutdown();
  process.exit(0);
});
```

### 7.3 CloudWatch Logs Insights Queries

```
# --- CloudWatch Logs Insights query examples ---

# Search for error logs
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

# Parse and aggregate JSON logs
fields @timestamp, @message
| parse @message '{"level":"*","msg":"*","service":"*","duration":*}' as level, msg, service, duration
| filter level = "error"
| stats count(*) as error_count by service
| sort error_count desc

# Latency statistics
fields @timestamp, @message
| parse @message '"duration":*,' as duration
| stats avg(duration) as avg_duration,
        pct(duration, 95) as p95_duration,
        pct(duration, 99) as p99_duration,
        max(duration) as max_duration
  by bin(5m)

# Frequency of a specific error pattern
fields @timestamp, @message
| filter @message like /database connection/
| stats count(*) as count by bin(1h)
| sort @timestamp desc

# Lambda function cold start analysis
filter @type = "REPORT"
| parse @log /\/aws\/lambda\/(?<function>.*)/
| stats count(*) as invocations,
        sum(@initDuration > 0) as cold_starts,
        avg(@initDuration) as avg_init_duration,
        max(@duration) as max_duration,
        avg(@duration) as avg_duration,
        avg(@maxMemoryUsed / @memorySize * 100) as avg_memory_pct
  by function

# API Gateway latency analysis
fields @timestamp, @message
| parse @message '"httpMethod":"*","resourcePath":"*","status":"*","responseLatency":*' as method, path, status, latency
| filter status like /5\d\d/
| stats count(*) as error_count,
        avg(latency) as avg_latency
  by method, path
| sort error_count desc

# Count unique users
fields @timestamp, @message
| parse @message '"userId":"*"' as userId
| stats count_distinct(userId) as unique_users by bin(1h)
```

### 7.4 CloudWatch Dashboard (CloudFormation)

```yaml
# cloudwatch-dashboard.yml — CloudFormation template
AWSTemplateFormatVersion: '2010-09-09'
Description: CloudWatch Dashboard for Application Monitoring

Parameters:
  Environment:
    Type: String
    Default: production
  ServiceName:
    Type: String
    Default: order-service

Resources:
  ApplicationDashboard:
    Type: AWS::CloudWatch::Dashboard
    Properties:
      DashboardName: !Sub "${ServiceName}-${Environment}"
      DashboardBody: !Sub |
        {
          "widgets": [
            {
              "type": "metric",
              "x": 0, "y": 0, "width": 12, "height": 6,
              "properties": {
                "title": "API Request Rate",
                "metrics": [
                  ["MyApp/Production", "RequestCount",
                   "Service", "${ServiceName}",
                   {"stat": "Sum", "period": 60}]
                ],
                "view": "timeSeries",
                "region": "ap-northeast-1",
                "period": 60
              }
            },
            {
              "type": "metric",
              "x": 12, "y": 0, "width": 12, "height": 6,
              "properties": {
                "title": "API Latency (p50/p95/p99)",
                "metrics": [
                  ["MyApp/Production", "ApiLatency",
                   "Service", "${ServiceName}",
                   {"stat": "p50", "period": 60, "label": "p50"}],
                  ["...", {"stat": "p95", "period": 60, "label": "p95"}],
                  ["...", {"stat": "p99", "period": 60, "label": "p99"}]
                ],
                "view": "timeSeries",
                "region": "ap-northeast-1"
              }
            },
            {
              "type": "metric",
              "x": 0, "y": 6, "width": 8, "height": 6,
              "properties": {
                "title": "Error Count",
                "metrics": [
                  ["MyApp/Production", "ErrorCount",
                   "Service", "${ServiceName}",
                   {"stat": "Sum", "period": 60, "color": "#d62728"}]
                ],
                "view": "timeSeries",
                "region": "ap-northeast-1"
              }
            },
            {
              "type": "log",
              "x": 0, "y": 12, "width": 24, "height": 6,
              "properties": {
                "title": "Recent Error Logs",
                "query": "fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 20",
                "region": "ap-northeast-1",
                "stacked": false,
                "view": "table"
              }
            }
          ]
        }

  # CloudWatch Alarm
  HighErrorRateAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub "${ServiceName}-${Environment}-HighErrorRate"
      AlarmDescription: "Error rate has exceeded 5%"
      MetricName: ErrorCount
      Namespace: MyApp/Production
      Dimensions:
        - Name: Service
          Value: !Ref ServiceName
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 50
      ComparisonOperator: GreaterThanThreshold
      TreatMissingData: notBreaching
      AlarmActions:
        - !Ref AlertSNSTopic

  AlertSNSTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: !Sub "${ServiceName}-${Environment}-alerts"
      Subscription:
        - Protocol: email
          Endpoint: oncall@example.com
```

---

## 8. Long-Term Storage and Scaling — Thanos and Mimir

### 8.1 Multi-Cluster Monitoring with Thanos

```yaml
# thanos-sidecar.yml — Add Thanos Sidecar to Prometheus
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: prometheus
          image: prom/prometheus:v2.50.0
          args:
            - '--config.file=/etc/prometheus/prometheus.yml'
            - '--storage.tsdb.retention.time=2h'  # keep local storage short
            - '--storage.tsdb.min-block-duration=2h'
            - '--storage.tsdb.max-block-duration=2h'
            - '--web.enable-lifecycle'
          volumeMounts:
            - name: prometheus-data
              mountPath: /prometheus

        # Thanos Sidecar
        - name: thanos-sidecar
          image: thanosio/thanos:v0.34.0
          args:
            - sidecar
            - '--tsdb.path=/prometheus'
            - '--prometheus.url=http://localhost:9090'
            - '--objstore.config-file=/etc/thanos/objstore.yml'
            - '--grpc-address=0.0.0.0:10901'
          volumeMounts:
            - name: prometheus-data
              mountPath: /prometheus
            - name: thanos-config
              mountPath: /etc/thanos

---
# thanos-query.yml — Thanos Query (cross-cluster queries)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: thanos-query
  namespace: monitoring
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: thanos-query
          image: thanosio/thanos:v0.34.0
          args:
            - query
            - '--grpc-address=0.0.0.0:10901'
            - '--http-address=0.0.0.0:9090'
            - '--store=dnssrv+_grpc._tcp.thanos-store.monitoring.svc'
            - '--store=dnssrv+_grpc._tcp.thanos-sidecar.monitoring.svc'
            - '--query.auto-downsampling'
            - '--query.replica-label=replica'
          ports:
            - containerPort: 9090
              name: http
            - containerPort: 10901
              name: grpc

---
# thanos-store.yml — Thanos Store Gateway (reads from object storage)
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: thanos-store
  namespace: monitoring
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: thanos-store
          image: thanosio/thanos:v0.34.0
          args:
            - store
            - '--objstore.config-file=/etc/thanos/objstore.yml'
            - '--data-dir=/thanos/store'
            - '--index-cache-size=500MB'
            - '--chunk-pool-size=2GB'
          volumeMounts:
            - name: thanos-config
              mountPath: /etc/thanos
            - name: store-data
              mountPath: /thanos/store

---
# thanos-compactor.yml — Thanos Compactor (downsampling)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: thanos-compactor
  namespace: monitoring
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: thanos-compactor
          image: thanosio/thanos:v0.34.0
          args:
            - compact
            - '--objstore.config-file=/etc/thanos/objstore.yml'
            - '--data-dir=/thanos/compact'
            - '--retention.resolution-raw=30d'      # raw data: 30 days
            - '--retention.resolution-5m=180d'       # 5-min resolution: 180 days
            - '--retention.resolution-1h=365d'       # 1-hour resolution: 1 year
            - '--compact.concurrency=2'
            - '--downsample.concurrency=2'
            - '--wait'
```

```yaml
# objstore.yml — Thanos object storage configuration (S3)
type: S3
config:
  bucket: "thanos-metrics-production"
  endpoint: "s3.ap-northeast-1.amazonaws.com"
  region: "ap-northeast-1"
  access_key: "${AWS_ACCESS_KEY_ID}"
  secret_key: "${AWS_SECRET_ACCESS_KEY}"
  # Encryption with SSE-S3
  sse_config:
    type: "SSE-S3"
```

### 8.2 Long-Term Storage Solution Comparison

```
Long-term storage solution comparison:

┌────────────┬──────────────┬──────────────┬──────────────┐
│ Property   │ Thanos       │ Cortex       │ Mimir        │
├────────────┼──────────────┼──────────────┼──────────────┤
│ Architecture│ Sidecar     │ Push-based   │ Push-based   │
│ Existing env│ Easy        │ Config change│ Config change│
│ Complexity │ Medium       │ High         │ Medium       │
│ Scalability│ High         │ Very high    │ Very high    │
│ Multi-tenant│ Limited     │ Native       │ Native       │
│ Developer  │ Improbable   │ Cortex Project│ Grafana Labs │
│ Downsampling│ Supported   │ Not supported│ Supported    │
│ Recommended scale│ Medium–large│ Large   │ Medium–large │
│ Grafana integration│ Good  │ Good        │ Best         │
└────────────┴──────────────┴──────────────┴──────────────┘

Recommendations:
- Adding to existing Prometheus → Thanos
- Grafana Cloud / LGTM stack → Mimir
- Large-scale multi-tenant → Cortex or Mimir
```

---

## 9. Comparison Tables

| Property | Prometheus + Grafana | Datadog | CloudWatch |
|----------|---------------------|---------|------------|
| Operation model | Self-hosted | SaaS | AWS managed |
| Metrics | Prometheus | Proprietary | Proprietary |
| Logs | Loki | Log Management | CloudWatch Logs |
| Traces | Jaeger/Tempo | APM | X-Ray |
| Dashboards | Grafana (powerful) | Built-in (feature-rich) | Basic |
| Alerting | Alertmanager | Monitors | CloudWatch Alarms |
| Anomaly detection | None (external integration) | Watchdog (ML) | Anomaly Detection |
| Monthly cost (medium scale) | Infrastructure only | $500–$5,000+ | $100–$500 |
| Learning curve | High (multiple tools) | Medium | Low (for AWS users) |
| OpenTelemetry support | Native | Supported | Limited |

| Dashboard tool | Grafana | Datadog Dashboard | CloudWatch Dashboard |
|----------------|---------|-------------------|---------------------|
| Data sources | 100+ | Within Datadog | Within AWS |
| Template variables | Powerful | Supported | Limited |
| Sharing/embedding | Supported | Supported | Limited |
| Alert integration | Alertmanager | Built-in | SNS integration |
| Mobile support | App available | App available | None |
| IaC support | Terraform/Jsonnet | Terraform | CloudFormation |
| Dashboard as Code | Provisioning/API | API/Terraform | CloudFormation |

| Log management tool | Loki | Datadog Logs | CloudWatch Logs | Elasticsearch |
|---------------------|------|-------------|-----------------|---------------|
| Index method | Labels only | Full-text | Full-text | Full-text |
| Storage efficiency | Very high | Medium | Medium | Low |
| Query language | LogQL | Proprietary | Insights | KQL/Lucene |
| Grafana integration | Native | Plugin | Plugin | Plugin |
| Monthly cost (100GB/day) | Infrastructure only | $2,000+ | $500+ | Infrastructure ($500+) |
| Operational burden | Medium | Low | Low | High |

---

## 10. Anti-Patterns

### Anti-Pattern 1: Dashboard Sprawl

```
[Bad example]
- Team members create a large number of personal dashboards
- The same metric displayed with different queries → numbers don't match
- Important dashboards are hard to find (50+ dashboards)
- Dashboards are unmaintained and continue to reference stale metrics

[Good example]
- Hierarchical dashboard design:
  Level 0: Overall service health check (for executives)
  Level 1: Key metrics per service (for team leads)
  Level 2: Detailed technical metrics (for engineers)
- Manage dashboards as IaC (Terraform/Jsonnet)
- Quarterly review to retire unused dashboards
- Standardize dashboard naming conventions:
  [environment]-[service]-[purpose]
  Example: prod-order-service-overview
```

### Anti-Pattern 2: High-Cardinality Labels

```promql
# Bad example: using user ID as a label → generates millions of time series
http_requests_total{user_id="user-123", method="GET", path="/api/items"}
# 1M users × 4 methods × 50 paths = 200M time series!

# Good example: only use labels that are meaningful for aggregation
http_requests_total{method="GET", path="/api/items", status="200"}
# 4 methods × 50 paths × 10 statuses = 2,000 time series

# Use logs or traces for per-user analysis
```

### Anti-Pattern 3: Inconsistent Metric Naming

```
[Bad example]
- Different naming conventions across teams:
  orderCount, order_count, orders.total, num_orders
- Ambiguous units: latency (ms? sec? us?)
- Metrics with the same meaning exist under different names

[Good example]
- Follow OpenMetrics / Prometheus naming conventions:
  - Use snake_case
  - Include units as suffixes: _seconds, _bytes, _total
  - Counters use _total suffix: http_requests_total
  - Histograms use _bucket, _sum, _count suffixes

- Naming template:
  {namespace}_{subsystem}_{name}_{unit}
  Examples:
    http_server_request_duration_seconds (Histogram)
    http_server_requests_total (Counter)
    process_resident_memory_bytes (Gauge)
    db_query_duration_seconds (Histogram)
```

### Anti-Pattern 4: Monitoring Blind Spots

```
[Bad example]
- Only monitoring server metrics (CPU/memory/disk)
- No business metrics (order count, revenue, user registrations)
- No monitoring of dependent services (external APIs, CDN, DNS)
- No synthetic monitoring (periodic external checks)

[Good example]
- Cover all 4 monitoring layers:
  1. Infrastructure: CPU, memory, disk, network
  2. Application: latency, error rate, throughput
  3. Business: orders, revenue, conversion rate
  4. User experience: Core Web Vitals, error rate, funnel

- Monitor dependent services:
  - External API response times
  - CDN cache hit rate
  - DNS resolution time
  - SSL certificate expiration
```

---

## 11. Operational Best Practices

### 11.1 Prometheus Operations Checklist

```
□ Storage capacity estimation
  - Time series count × sample size (1–2 bytes) × retention period
  - Example: 100,000 series × 2 bytes × 15s interval × 30 days ≈ 30GB

□ Monitor WAL disk
  - Check WAL size with prometheus_tsdb_wal_segment_current
  - Ensure sufficient IOPS for the WAL disk

□ Use Recording Rules
  - Pre-compute frequently used dashboard queries
  - Aggregate high-cardinality queries

□ Consider Federation
  - When aggregating metrics across clusters
  - Use match[] to collect only necessary metrics

□ Alertmanager redundancy
  - Minimum 2-node cluster configuration
  - Connect with --cluster.peer

□ Backups
  - TSDB snapshot API: POST /api/v1/admin/tsdb/snapshot
  - Periodic copy to object storage
```

### 11.2 Grafana Operations Checklist

```
□ Authentication and authorization
  - SSO via LDAP/OIDC/SAML
  - Access control with Organization / Team
  - Proper use of Viewer / Editor / Admin roles

□ Backups
  - Regular backup of grafana.db (SQLite)
  - Export dashboard JSON
  - Git management via Provisioning is the best approach

□ Plugin management
  - Manage declaratively via GF_INSTALL_PLUGINS environment variable
  - Regular check for security updates

□ Performance
  - Identify heavy dashboards (load time > 5 seconds)
  - Keep panel count reasonable (recommended: 20 or fewer per dashboard)
  - Set appropriate auto-refresh intervals (30 seconds minimum)
```

---

## 12. FAQ

### Q1: Should I choose an OSS stack or SaaS?

The size and skill of your operations team is the key factor. If you have a dedicated SRE/infrastructure team (2 or more engineers), the OSS approach (Prometheus + Grafana) gives you lower costs and high customizability. If you have a small team with limited time to manage monitoring infrastructure, choose a SaaS solution like Datadog. For systems confined entirely to AWS, CloudWatch is the simplest option.

### Q2: How long should Prometheus data retention be?

15 to 30 days is realistic for local storage. If long-term storage is required, introduce a remote storage solution such as Thanos or Mimir. Using Thanos Compactor with downsampling allows you to retain over a year of data efficiently (raw data for 30 days → 5-minute resolution for 180 days → 1-hour resolution for 1 year).

### Q3: How do I manage Grafana dashboards as code?

There are three approaches. (1) **Grafana Provisioning**: Manage with YAML + JSON files in Git, loaded automatically at startup. (2) **Terraform provider**: Manage as IaC with the `grafana_dashboard` resource. (3) **Grafonnet (Jsonnet)**: Generate dashboards programmatically. Terraform is recommended for larger teams; Provisioning is recommended for smaller ones.

### Q4: Should I choose Loki or Elasticsearch?

Loki uses label-based indexing, which is very storage-efficient, but its full-text search performance is inferior to Elasticsearch. Loki integrates well with the Grafana ecosystem, and if your log search pattern is "filter by label then text search," Loki is the best fit. If full-text search or complex log aggregation is your primary use case, choose Elasticsearch (OpenSearch).

### Q5: How can I reduce Datadog costs?

You can optimize costs with these strategies. (1) **Control custom metric count**: Avoid high-cardinality tags to keep metric counts in check. (2) **Control log ingestion volume**: Filter out unnecessary log levels (DEBUG/INFO) and send only important logs to Datadog. (3) **APM sampling**: Use error traces and a sampling rate rather than collecting all traces. (4) **Index optimization**: Use different log indexes and move long-term storage to Archive.

### Q6: What are the limitations of CloudWatch?

Key limitations include: (1) PutMetricData for custom metrics is limited to 20 metrics per call (batch sending required); (2) dashboard expressiveness is more limited compared to Grafana/Datadog; (3) cross-region and cross-account metric aggregation requires additional configuration; (4) Logs Insights queries have a maximum timeout of 15 minutes. If your requirements exceed these limitations, a setup using CloudWatch as a data source visualized in Grafana is effective.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Prometheus | Pull-based metrics collection. Flexible queries with PromQL. Pre-aggregation with Recording Rules. |
| Grafana | Supports many data sources. Most flexible dashboards. IaC management with Provisioning/Terraform. |
| Loki | Log aggregation with Grafana integration. Highly efficient with label-based indexing. Query with LogQL. |
| Datadog | Full-stack SaaS. Integrated APM/logs/metrics. Anomaly detection (Watchdog) included. |
| CloudWatch | AWS-native. Monitor AWS resources with no additional setup. Log analysis with Logs Insights. |
| Thanos/Mimir | Long-term storage and multi-cluster support for Prometheus. Efficient retention with downsampling. |
| Dashboard design | Hierarchical structure, managed as IaC. Be mindful of cardinality. Standardize naming conventions. |

---

## Further Reading

- [00-observability.md](./00-observability.md) — The three pillars of observability
- [02-alerting.md](./02-alerting.md) — Alerting strategy and escalation
- [03-performance-monitoring.md](./03-performance-monitoring.md) — APM and performance monitoring

---

## References

1. **Prometheus: Up & Running** — Brian Brazil (O'Reilly, 2018) — Practical guide to Prometheus
2. **Grafana Documentation** — https://grafana.com/docs/ — Official Grafana documentation
3. **Datadog Documentation** — https://docs.datadoghq.com/ — Official Datadog reference
4. **AWS CloudWatch Documentation** — https://docs.aws.amazon.com/AmazonCloudWatch/ — Official CloudWatch guide
5. **Thanos Documentation** — https://thanos.io/tip/thanos/getting-started.md/ — Official Thanos guide
6. **Grafana Loki Documentation** — https://grafana.com/docs/loki/latest/ — Official Loki documentation
7. **PromQL Cheat Sheet** — https://promlabs.com/promql-cheat-sheet/ — PromQL quick reference
8. **Grafana Mimir** — https://grafana.com/docs/mimir/latest/ — Mimir long-term storage
