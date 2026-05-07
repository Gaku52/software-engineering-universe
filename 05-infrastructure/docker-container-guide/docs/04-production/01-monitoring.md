# Monitoring

> Build a comprehensive monitoring, log aggregation, and alerting foundation for Docker container environments by combining Prometheus, Grafana, cAdvisor, and Loki.

---

## What You Will Learn

1. Understand the architecture and configuration of **metrics collection with Prometheus + cAdvisor**
2. Master **Grafana dashboard** construction and alert rule configuration
3. Learn **log aggregation and correlation analysis** techniques with Loki / ELK
4. Master implementation patterns for **application metrics instrumentation** (Node.js / Python / Go)
5. Understand **alert design based on SLI/SLO** and operational best practices


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Production Best Practices](./00-production-best-practices.md)

---

## 1. Overview of Container Monitoring

### Monitoring Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Host                             │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                     │
│  │  App A  │ │  App B  │ │  App C  │  ← Monitoring targets │
│  └────┬────┘ └────┬────┘ └────┬────┘                     │
│       │           │           │                             │
│  ┌────▼───────────▼───────────▼────┐                      │
│  │          cAdvisor                │  ← Container metrics  │
│  │  CPU, Memory, Network, Disk I/O │     collection        │
│  └──────────────┬──────────────────┘                      │
│                 │ :8080/metrics                             │
│  ┌──────────────▼──────────────────┐                      │
│  │          Prometheus             │  ← Metrics storage    │
│  │  Pull-based metrics collection  │     query engine      │
│  │  PromQL queries                 │                      │
│  └──────┬───────────┬──────────────┘                      │
│         │           │                                      │
│  ┌──────▼──────┐ ┌──▼──────────────┐                     │
│  │  Grafana    │ │  Alertmanager   │                     │
│  │  Dashboard  │ │  Slack/Email    │                     │
│  │  :3000      │ │  PagerDuty      │                     │
│  └─────────────┘ └─────────────────┘                     │
│                                                             │
│  ┌─────────────────────────────────┐                      │
│  │          Loki                   │  ← Log aggregation   │
│  │  Log indexing and search        │                      │
│  └──────────────┬──────────────────┘                      │
│                 │                                          │
│  ┌──────────────▼──────────────────┐                      │
│  │        Promtail / Alloy         │  ← Log collection agent│
│  └─────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### The Three Pillars of Observability

```
┌─────────────────────────────────────────────────────────────┐
│                        Observability                        │
│                                                             │
│  ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐ │
│  │    Metrics      │ │    Logs     │ │    Traces       │ │
│  │                 │ │             │ │                 │ │
│  │ ・CPU/Memory    │ │ ・Structured│ │ ・Request       │ │
│  │ ・Request count │ │   logs      │ │   tracking      │ │
│  │ ・Response time │ │ ・Error logs│ │ ・Latency       │ │
│  │                 │ │ ・Audit logs│ │   analysis      │ │
│  │                 │ │             │ │ ・Dependency    │ │
│  │                 │ │             │ │   maps          │ │
│  │ Prometheus      │ │ Loki/ELK   │ │ Jaeger/Tempo   │ │
│  │ cAdvisor        │ │ Promtail   │ │ OpenTelemetry  │ │
│  └─────────────────┘ └─────────────┘ └─────────────────┘ │
│                                                             │
│  Unified visualization and correlation analysis via Grafana  │
└─────────────────────────────────────────────────────────────┘
```

### Monitoring Tool Comparison

| Tool | Type | Role | Data Type | Features |
|--------|------|------|---------|------|
| Prometheus | Metrics | Time-series data collection and storage | Numeric | Pull-based, PromQL |
| cAdvisor | Exporter | Container resource metrics | Numeric | Developed by Google |
| Grafana | Visualization | Dashboards and alerts | - | Multi-datasource support |
| Alertmanager | Alerting | Notification routing and suppression | - | Grouping, silences |
| Loki | Logs | Log aggregation and search | Text | Prometheus-like labels |
| Promtail | Log collection | Log forwarding agent | Text | Loki-specific |
| Grafana Alloy | Unified agent | Metrics/logs/traces collection | All types | Promtail successor, OpenTelemetry support |
| ELK Stack | Logs | Log aggregation and full-text search | Text | Feature-rich, high resource consumption |
| Jaeger | Traces | Distributed tracing | Traces | CNCF graduated project |
| Grafana Tempo | Traces | Distributed tracing | Traces | Optimized for high-volume traces |

---

## 2. Metrics Collection with Prometheus + cAdvisor

### Code Example 1: Docker Compose Configuration for the Monitoring Stack

```yaml
# docker-compose.monitoring.yml
version: "3.9"

services:
  # === Metrics collection ===
  prometheus:
    image: prom/prometheus:v2.51.0
    container_name: prometheus
    restart: unless-stopped
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=30d"
      - "--storage.tsdb.retention.size=10GB"
      - "--web.enable-lifecycle"    # APIでリロード可能
      - "--web.enable-admin-api"    # 管理API有効化
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/alert-rules.yml:/etc/prometheus/alert-rules.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "1.0"

  # === Container metrics ===
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.49.1
    container_name: cadvisor
    restart: unless-stopped
    privileged: true
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    ports:
      - "8080:8080"
    networks:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"

  # === Node Exporter (host metrics) ===
  node-exporter:
    image: prom/node-exporter:v1.8.0
    container_name: node-exporter
    restart: unless-stopped
    command:
      - "--path.rootfs=/host"
      - "--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)"
    volumes:
      - /:/host:ro,rslave
    pid: host
    networks:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: "0.25"

  # === Dashboard ===
  grafana:
    image: grafana/grafana:10.4.0
    container_name: grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_SERVER_ROOT_URL: "https://grafana.example.com"
      GF_SMTP_ENABLED: "true"
      GF_SMTP_HOST: "smtp.example.com:587"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - "3000:3000"
    networks:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"

  # === Alert Manager ===
  alertmanager:
    image: prom/alertmanager:v0.27.0
    container_name: alertmanager
    restart: unless-stopped
    command:
      - "--config.file=/etc/alertmanager/alertmanager.yml"
      - "--storage.path=/alertmanager"
      - "--web.external-url=https://alertmanager.example.com"
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager-data:/alertmanager
    ports:
      - "9093:9093"
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus-data:
  grafana-data:
  alertmanager-data:
```

### Code Example 2: Prometheus Configuration File

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s        # メトリクス収集間隔
  evaluation_interval: 15s    # ルール評価間隔
  scrape_timeout: 10s
  external_labels:
    cluster: "production"
    region: "ap-northeast-1"

# アラートルール
rule_files:
  - "alert-rules.yml"

# Alertmanager連携
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

# スクレイプ対象の定義
scrape_configs:
  # Prometheus自身のメトリクス
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  # cAdvisor（コンテナメトリクス）
  - job_name: "cadvisor"
    static_configs:
      - targets: ["cadvisor:8080"]
    metric_relabel_configs:
      # 不要なメトリクスを除外（ストレージ節約）
      - source_labels: [__name__]
        regex: "container_tasks_state|container_memory_failures_total"
        action: drop
      # 停止済みコンテナのメトリクスを除外
      - source_labels: [container_label_com_docker_compose_service]
        regex: ""
        action: drop

  # Node Exporter（ホストメトリクス）
  - job_name: "node-exporter"
    static_configs:
      - targets: ["node-exporter:9100"]

  # アプリケーションメトリクス（/metrics エンドポイント）
  - job_name: "app-metrics"
    static_configs:
      - targets: ["api:8080", "worker:8080"]
    metrics_path: /metrics
    scrape_interval: 10s  # アプリメトリクスはより頻繁に収集

  # Docker Engine メトリクス
  - job_name: "docker-engine"
    static_configs:
      - targets: ["host.docker.internal:9323"]

  # Dockerサービスディスカバリ（ラベルベース）
  - job_name: "docker-sd"
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 30s
    relabel_configs:
      - source_labels: [__meta_docker_container_label_prometheus_scrape]
        regex: "true"
        action: keep
      - source_labels: [__meta_docker_container_label_prometheus_port]
        target_label: __address__
        regex: (.+)
        replacement: "${1}"
      - source_labels: [__meta_docker_container_name]
        target_label: container_name
        regex: "/(.+)"
      - source_labels: [__meta_docker_container_label_prometheus_job]
        target_label: job
```

### Enabling Docker Engine Metrics

```json
// /etc/docker/daemon.json
{
  "metrics-addr": "0.0.0.0:9323",
  "experimental": true
}
```

```bash
# Docker Engine メトリクスの確認
curl http://localhost:9323/metrics | head -20
# HELP engine_daemon_container_states_containers The count of containers in various states
# TYPE engine_daemon_container_states_containers gauge
# engine_daemon_container_states_containers{state="paused"} 0
# engine_daemon_container_states_containers{state="running"} 8
# engine_daemon_container_states_containers{state="stopped"} 3
```

---

## 3. Alert Rules

### Code Example 3: Prometheus Alert Rules

```yaml
# prometheus/alert-rules.yml
groups:
  - name: container-alerts
    rules:
      # コンテナダウン
      - alert: ContainerDown
        expr: absent(container_last_seen{name=~".+"})
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "コンテナが停止しています"
          description: "{{ $labels.name }} が1分以上停止しています"
          runbook_url: "https://wiki.example.com/runbooks/container-down"

      # CPU使用率が高い
      - alert: ContainerHighCPU
        expr: >
          (sum(rate(container_cpu_usage_seconds_total{name=~".+"}[5m])) by (name)
          / sum(container_spec_cpu_quota{name=~".+"}/container_spec_cpu_period{name=~".+"}) by (name)
          * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "コンテナCPU使用率が高い ({{ $value | printf \"%.1f\" }}%)"
          description: "{{ $labels.name }} のCPU使用率が5分間80%を超えています"

      # メモリ使用率が高い
      - alert: ContainerHighMemory
        expr: >
          (container_memory_usage_bytes{name=~".+"}
          / container_spec_memory_limit_bytes{name=~".+"} * 100) > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "コンテナメモリ使用率が高い ({{ $value | printf \"%.1f\" }}%)"
          description: "{{ $labels.name }} のメモリ使用率が5分間85%を超えています"

      # OOM Kill 発生
      - alert: ContainerOOMKilled
        expr: >
          increase(container_oom_events_total{name=~".+"}[5m]) > 0
        labels:
          severity: critical
        annotations:
          summary: "OOM Kill が発生"
          description: "{{ $labels.name }} がOOM Killされました"
          runbook_url: "https://wiki.example.com/runbooks/oom-kill"

      # コンテナ再起動が頻発
      - alert: ContainerFrequentRestart
        expr: >
          increase(container_start_time_seconds{name=~".+"}[1h]) > 3
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "コンテナの再起動が頻発しています"
          description: "{{ $labels.name }} が過去1時間で{{ $value }}回再起動しました"

      # ディスク使用率
      - alert: HostHighDiskUsage
        expr: >
          (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "ディスク使用率が高い ({{ $value | printf \"%.1f\" }}%)"

      # Docker ディスク使用量（イメージ・コンテナ・ボリューム）
      - alert: DockerDiskSpaceHigh
        expr: >
          (node_filesystem_size_bytes{mountpoint="/var/lib/docker"} -
           node_filesystem_avail_bytes{mountpoint="/var/lib/docker"}) /
          node_filesystem_size_bytes{mountpoint="/var/lib/docker"} * 100 > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Dockerディスク使用量が80%を超過"

  - name: application-alerts
    rules:
      # ヘルスチェック失敗
      - alert: HealthCheckFailing
        expr: up{job="app-metrics"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "アプリケーションのヘルスチェックが失敗"
          description: "{{ $labels.instance }} が2分間応答していません"

      # レスポンスタイム劣化
      - alert: HighResponseTime
        expr: >
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "95パーセンタイルレスポンスタイムが1秒超"

      # エラーレート上昇
      - alert: HighErrorRate
        expr: >
          sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (service)
          / sum(rate(http_requests_total[5m])) by (service) * 100 > 5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "5xxエラーレートが5%を超過 ({{ $value | printf \"%.1f\" }}%)"
          description: "{{ $labels.service }} のエラーレートが異常に高い状態です"

      # リクエストレート急増
      - alert: RequestRateSpike
        expr: >
          sum(rate(http_requests_total[5m])) by (service)
          / sum(rate(http_requests_total[1h] offset 1d)) by (service) > 3
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "リクエストレートが前日比3倍以上に急増"

  - name: host-alerts
    rules:
      # ホストCPU使用率
      - alert: HostHighCPULoad
        expr: >
          100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "ホストCPU使用率が80%超過"

      # ホストメモリ使用率
      - alert: HostHighMemoryUsage
        expr: >
          (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "ホストメモリ使用率が85%超過"

      # ネットワークエラー
      - alert: HostNetworkErrors
        expr: >
          increase(node_network_receive_errs_total[5m]) > 0
          or increase(node_network_transmit_errs_total[5m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "ネットワークエラーが検出されました"
```

### Alertmanager Configuration

```yaml
# alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: "${SLACK_WEBHOOK_URL}"

# テンプレート
templates:
  - "/etc/alertmanager/templates/*.tmpl"

# ルーティングツリー
route:
  group_by: ["alertname", "cluster", "service"]
  group_wait: 30s        # 同じグループのアラートを待つ時間
  group_interval: 5m     # 同じグループの再通知間隔
  repeat_interval: 4h    # 同一アラートの再通知間隔
  receiver: "slack-notifications"

  routes:
    # 緊急アラート → PagerDuty + Slack
    - match:
        severity: critical
      receiver: "pagerduty-critical"
      repeat_interval: 1h
      continue: true  # 次のルートにも送信

    - match:
        severity: critical
      receiver: "slack-critical"
      repeat_interval: 1h

    # 警告アラート → Slack のみ
    - match:
        severity: warning
      receiver: "slack-notifications"
      repeat_interval: 4h

    # 特定サービスのアラート → チーム専用チャンネル
    - match_re:
        service: "api|worker"
      receiver: "slack-backend-team"

# 抑制ルール
inhibit_rules:
  # critical が発報中なら同じ alertname の warning を抑制
  - source_match:
      severity: "critical"
    target_match:
      severity: "warning"
    equal: ["alertname", "cluster", "service"]

# 受信設定
receivers:
  - name: "slack-notifications"
    slack_configs:
      - channel: "#alerts"
        title: '{{ .GroupLabels.alertname }} [{{ .Status | toUpper }}]'
        text: >-
          {{ range .Alerts }}
          *{{ .Annotations.summary }}*
          {{ .Annotations.description }}
          *Severity:* {{ .Labels.severity }}
          *Source:* {{ .GeneratorURL }}
          {{ end }}
        send_resolved: true

  - name: "slack-critical"
    slack_configs:
      - channel: "#alerts-critical"
        title: ':rotating_light: {{ .GroupLabels.alertname }} [CRITICAL]'
        text: >-
          {{ range .Alerts }}
          *{{ .Annotations.summary }}*
          {{ .Annotations.description }}
          {{ if .Annotations.runbook_url }}*Runbook:* {{ .Annotations.runbook_url }}{{ end }}
          {{ end }}
        send_resolved: true

  - name: "slack-backend-team"
    slack_configs:
      - channel: "#backend-alerts"
        send_resolved: true

  - name: "pagerduty-critical"
    pagerduty_configs:
      - service_key: "${PAGERDUTY_SERVICE_KEY}"
        severity: >-
          {{ if eq .GroupLabels.severity "critical" }}critical{{ else }}warning{{ end }}
        description: '{{ .GroupLabels.alertname }}: {{ (index .Alerts 0).Annotations.summary }}'

  - name: "email-alerts"
    email_configs:
      - to: "oncall@example.com"
        from: "alertmanager@example.com"
        smarthost: "smtp.example.com:587"
        auth_username: "alertmanager@example.com"
        auth_password: "${SMTP_PASSWORD}"
        send_resolved: true
```

### Alert Silencing (Temporary Suppression)

```bash
# メンテナンス中にアラートを一時的に抑制
# Alertmanager API でサイレンスを作成
curl -X POST http://localhost:9093/api/v2/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [
      {"name": "service", "value": "api", "isRegex": false}
    ],
    "startsAt": "2024-01-15T10:00:00Z",
    "endsAt": "2024-01-15T12:00:00Z",
    "createdBy": "operator",
    "comment": "計画メンテナンス: APIサーバーアップグレード"
  }'

# アクティブなサイレンス一覧
curl http://localhost:9093/api/v2/silences?silenced=false
```

---

## 4. Grafana Dashboard

### Code Example 4: Grafana Provisioning Configuration

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

  - name: Alertmanager
    type: alertmanager
    access: proxy
    url: http://alertmanager:9093
    jsonData:
      implementation: prometheus
```

```yaml
# grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1

providers:
  - name: "Docker Monitoring"
    orgId: 1
    folder: "Docker"
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

### Grafana Dashboard JSON (for Provisioning)

```json
{
  "dashboard": {
    "title": "Docker Container Overview",
    "uid": "docker-overview",
    "timezone": "Asia/Tokyo",
    "panels": [
      {
        "title": "Running Containers",
        "type": "stat",
        "gridPos": { "h": 4, "w": 6, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "count(container_last_seen{name=~\".+\"}) - count(container_last_seen{name=~\".+\"} offset 5m)",
            "legendFormat": "Running"
          }
        ]
      },
      {
        "title": "CPU Usage by Container",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 4 },
        "targets": [
          {
            "expr": "sum(rate(container_cpu_usage_seconds_total{name=~\".+\"}[5m])) by (name) * 100",
            "legendFormat": "{{ name }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "max": 100
          }
        }
      },
      {
        "title": "Memory Usage by Container",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 4 },
        "targets": [
          {
            "expr": "container_memory_usage_bytes{name=~\".+\"} / 1024 / 1024",
            "legendFormat": "{{ name }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "decmbytes"
          }
        }
      }
    ]
  }
}
```

### Key PromQL Query Reference

```promql
# === CPU Metrics ===
# CPU usage per container (%)
sum(rate(container_cpu_usage_seconds_total{name=~".+"}[5m])) by (name) * 100

# Container CPU usage (relative to limit)
sum(rate(container_cpu_usage_seconds_total{name=~".+"}[5m])) by (name)
/ (container_spec_cpu_quota{name=~".+"} / container_spec_cpu_period{name=~".+"}) * 100

# Overall host CPU usage
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# === Memory Metrics ===
# Memory usage per container
container_memory_usage_bytes{name=~".+"} / 1024 / 1024  # MB単位

# Memory usage (%)
container_memory_usage_bytes{name=~".+"} / container_spec_memory_limit_bytes{name=~".+"} * 100

# Memory working set (cache excluded)
container_memory_working_set_bytes{name=~".+"} / 1024 / 1024

# Host available memory
node_memory_MemAvailable_bytes / 1024 / 1024 / 1024  # GB単位

# === Network Metrics ===
# Bytes received per second
sum(rate(container_network_receive_bytes_total{name=~".+"}[5m])) by (name)

# Bytes transmitted per second
sum(rate(container_network_transmit_bytes_total{name=~".+"}[5m])) by (name)

# Network error rate
sum(rate(container_network_receive_errors_total{name=~".+"}[5m])) by (name)

# === Disk I/O ===
# Read bytes per second
sum(rate(container_fs_reads_bytes_total{name=~".+"}[5m])) by (name)

# Write bytes per second
sum(rate(container_fs_writes_bytes_total{name=~".+"}[5m])) by (name)

# === Application Metrics ===
# Request rate (RPS)
sum(rate(http_requests_total[5m])) by (service)

# Error rate (5xx %)
sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (service)
/ sum(rate(http_requests_total[5m])) by (service) * 100

# Response time (P50, P95, P99)
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Apdex score (satisfied: <0.5s, tolerating: <2s)
(
  sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m])) +
  sum(rate(http_request_duration_seconds_bucket{le="2.0"}[5m]))
) / 2 / sum(rate(http_request_duration_seconds_count[5m]))
```

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  Docker Monitoring Dashboard                    [24h ▼] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ Containers│ │  CPU   │ │ Memory  │ │ Alerts  │    │
│  │    12    │ │  34%   │ │  62%    │ │    2    │    │
│  │ running  │ │ avg    │ │ avg     │ │ active  │    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ RPS     │ │ Error % │ │ P95     │ │ Disk    │    │
│  │  1.2k   │ │  0.3%  │ │ 245ms  │ │  45%    │    │
│  │ req/s   │ │ 5xx    │ │ latency │ │ used    │    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                         │
│  CPU Usage by Container            Memory Usage         │
│  ┌─────────────────────┐   ┌─────────────────────┐    │
│  │  ████               │   │  ██████             │    │
│  │  ██████████         │   │  ████████████       │    │
│  │  ████████           │   │  ██████████         │    │
│  │  ──────── time ──►  │   │  ──────── time ──►  │    │
│  └─────────────────────┘   └─────────────────────┘    │
│                                                         │
│  Network I/O                    Container Restarts      │
│  ┌─────────────────────┐   ┌─────────────────────┐    │
│  │  rx: ────           │   │  api: 0             │    │
│  │  tx: ----           │   │  web: 2  ← 要注意   │    │
│  │                     │   │  db:  0             │    │
│  └─────────────────────┘   └─────────────────────┘    │
│                                                         │
│  HTTP Request Rate              Error Rate              │
│  ┌─────────────────────┐   ┌─────────────────────┐    │
│  │  ████████████████   │   │  _____     ___      │    │
│  │  ████████████████   │   │       ─────         │    │
│  │  ──────── time ──►  │   │  ──────── time ──►  │    │
│  └─────────────────────┘   └─────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Log Aggregation

### Loki vs ELK Comparison

| Characteristic | Grafana Loki | ELK Stack |
|------|-------------|-----------|
| Architecture | Lightweight (labels-only index) | Full-text index |
| Resource consumption | Low | High (Elasticsearch) |
| Query language | LogQL | KQL / Lucene |
| Scalability | Easy horizontal scaling | Complex management |
| Grafana integration | Native | Plugin |
| Setup | Simple | Complex |
| Search speed | Fast label-based | Fast full-text search |
| Scale | Small to medium | Large |
| Storage cost | Low (good compression) | High (index + data) |
| Multi-tenancy | Supported | Supported (X-Pack) |

### Code Example 5: Loki + Promtail Configuration

```yaml
# docker-compose.logging.yml
version: "3.9"

services:
  loki:
    image: grafana/loki:2.9.6
    container_name: loki
    restart: unless-stopped
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./loki/loki-config.yaml:/etc/loki/local-config.yaml:ro
      - loki-data:/loki
    ports:
      - "3100:3100"
    networks:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "1.0"

  promtail:
    image: grafana/promtail:2.9.6
    container_name: promtail
    restart: unless-stopped
    command: -config.file=/etc/promtail/config.yml
    volumes:
      - ./promtail/config.yml:/etc/promtail/config.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.25"

volumes:
  loki-data:

networks:
  monitoring:
    external: true
```

```yaml
# loki/loki-config.yaml
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
  retention_period: 30d
  max_query_length: 720h
  max_query_series: 500
  max_entries_limit_per_query: 5000
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20

compactor:
  working_directory: /loki/retention
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h

# クエリパフォーマンスチューニング
query_range:
  align_queries_with_step: true
  cache_results: true
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100
```

```yaml
# promtail/config.yml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push
    tenant_id: default
    batchwait: 1s
    batchsize: 1048576  # 1MB

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      # コンテナ名をラベルとして付与
      - source_labels: ["__meta_docker_container_name"]
        target_label: "container"
        regex: "/(.+)"
      # Composeサービス名
      - source_labels: ["__meta_docker_container_label_com_docker_compose_service"]
        target_label: "service"
      # Composeプロジェクト名
      - source_labels: ["__meta_docker_container_label_com_docker_compose_project"]
        target_label: "project"
      # イメージ名
      - source_labels: ["__meta_docker_container_label_com_docker_compose_image"]
        target_label: "image"
    pipeline_stages:
      # JSON ログのパース
      - json:
          expressions:
            level: level
            message: message
            timestamp: timestamp
            request_id: request_id
            trace_id: trace_id
      - labels:
          level:
          request_id:
      - timestamp:
          source: timestamp
          format: RFC3339
      # 機密情報のマスキング
      - replace:
          expression: '(password|token|secret|api_key)[":\s]*["]*([^",\s}]+)'
          replace: '${1}:"***REDACTED***"'
```

### LogQL Query Examples

```logql
# === Basic Filtering ===
# Display logs for a specific container
{container="api"} |= "error"

# Regex-based search
{service="api"} |~ "status=(4|5)[0-9]{2}"

# Multiple AND conditions
{service="api"} |= "error" != "health_check"

# === JSON Structured Logs ===
# Filter by JSON field
{service="api"} | json | level="error" | status >= 500

# Extract specific fields
{service="api"} | json | line_format "{{.method}} {{.path}} {{.status}} {{.duration_ms}}ms"

# === Aggregation Queries (Metric Queries) ===
# Error log occurrence rate
rate({service="api"} |= "error" [5m])

# Count by log level
sum by (level) (count_over_time({service="api"} | json [5m]))

# Response time statistics
{service="api"} | json | unwrap duration_ms | quantile_over_time(0.95, [5m])

# Aggregation by HTTP status code
sum by (status) (count_over_time({service="api"} | json | status != "" [1h]))

# Error rate by service
sum(rate({service=~".+"} | json | level="error" [5m])) by (service)
/ sum(rate({service=~".+"} [5m])) by (service) * 100

# === Troubleshooting ===
# Track logs by specific request ID
{project="myapp"} | json | request_id="abc-123"

# Recent OOM errors
{container=~".+"} |= "OOM" or {container=~".+"} |= "out of memory"

# Detect slow queries
{service="api"} | json | duration_ms > 5000
```

---

## 6. Application Metrics Instrumentation

### Code Example 6: Prometheus Client Library (Node.js)

```javascript
// metrics.js - Prometheus メトリクスの計装
const client = require("prom-client");

// デフォルトメトリクス（CPU, メモリ, GC等）
client.collectDefaultMetrics({ prefix: "app_" });

// カスタムメトリクス
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTPリクエストの処理時間",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

const httpRequestTotal = new client.Counter({
  name: "http_requests_total",
  help: "HTTPリクエストの総数",
  labelNames: ["method", "route", "status_code"],
});

const activeConnections = new client.Gauge({
  name: "http_active_connections",
  help: "現在のアクティブ接続数",
});

const dbQueryDuration = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "データベースクエリの処理時間",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// Express ミドルウェア
function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  activeConnections.inc();

  res.on("finish", () => {
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    };
    end(labels);
    httpRequestTotal.inc(labels);
    activeConnections.dec();
  });

  next();
}

// /metrics エンドポイント
async function metricsHandler(req, res) {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler, dbQueryDuration };
```

### Code Example 7: Python (FastAPI) Instrumentation

```python
# metrics.py - FastAPI + Prometheus
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time

# カスタムレジストリ
registry = CollectorRegistry()

# メトリクス定義
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
    registry=registry,
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registry=registry,
)

ACTIVE_REQUESTS = Gauge(
    "http_active_requests",
    "Number of active HTTP requests",
    registry=registry,
)

DB_QUERY_DURATION = Histogram(
    "db_query_duration_seconds",
    "Database query duration",
    ["operation"],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
    registry=registry,
)


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        ACTIVE_REQUESTS.inc()
        start_time = time.perf_counter()

        response = await call_next(request)

        duration = time.perf_counter() - start_time
        endpoint = request.url.path

        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=endpoint,
            status_code=response.status_code,
        ).inc()

        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=endpoint,
        ).observe(duration)

        ACTIVE_REQUESTS.dec()
        return response


# /metrics エンドポイント
async def metrics_endpoint(request: Request):
    return Response(
        content=generate_latest(registry),
        media_type=CONTENT_TYPE_LATEST,
    )
```

### Code Example 8: Go Instrumentation

```go
// metrics.go - Go + Prometheus
package metrics

import (
    "net/http"
    "strconv"
    "time"

    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    httpRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "path", "status_code"},
    )

    httpRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request duration in seconds",
            Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
        },
        []string{"method", "path"},
    )

    activeConnections = promauto.NewGauge(
        prometheus.GaugeOpts{
            Name: "http_active_connections",
            Help: "Number of active HTTP connections",
        },
    )
)

// MetricsMiddleware wraps an HTTP handler to record metrics
func MetricsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        activeConnections.Inc()
        start := time.Now()

        // レスポンスステータスコードをキャプチャ
        rw := &responseWriter{ResponseWriter: w, statusCode: 200}
        next.ServeHTTP(rw, r)

        duration := time.Since(start).Seconds()
        statusCode := strconv.Itoa(rw.statusCode)

        httpRequestsTotal.WithLabelValues(r.Method, r.URL.Path, statusCode).Inc()
        httpRequestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration)
        activeConnections.Dec()
    })
}

// MetricsHandler is the handler for the /metrics endpoint
func MetricsHandler() http.Handler {
    return promhttp.Handler()
}

type responseWriter struct {
    http.ResponseWriter
    statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.statusCode = code
    rw.ResponseWriter.WriteHeader(code)
}
```

---

## 7. Distributed Tracing (OpenTelemetry)

### Tracing Configuration in a Docker Environment

```yaml
# docker-compose.tracing.yml
version: "3.9"

services:
  # OpenTelemetry Collector
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.96.0
    container_name: otel-collector
    restart: unless-stopped
    command: ["--config=/etc/otel/config.yaml"]
    volumes:
      - ./otel/config.yaml:/etc/otel/config.yaml:ro
    ports:
      - "4317:4317"   # gRPC
      - "4318:4318"   # HTTP
    networks:
      - monitoring

  # Grafana Tempo (trace backend)
  tempo:
    image: grafana/tempo:2.4.0
    container_name: tempo
    restart: unless-stopped
    command: ["-config.file=/etc/tempo/config.yaml"]
    volumes:
      - ./tempo/config.yaml:/etc/tempo/config.yaml:ro
      - tempo-data:/var/tempo
    ports:
      - "3200:3200"
    networks:
      - monitoring

volumes:
  tempo-data:
```

```yaml
# otel/config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "0.0.0.0:4317"
      http:
        endpoint: "0.0.0.0:4318"

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

exporters:
  otlp/tempo:
    endpoint: "tempo:4317"
    tls:
      insecure: true
  prometheus:
    endpoint: "0.0.0.0:8889"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
```

---

## 8. Alert Design Based on SLI/SLO

### Defining SLIs (Service Level Indicators)

```yaml
# prometheus/slo-rules.yml
groups:
  - name: slo-rules
    rules:
      # SLI: 可用性（成功リクエスト率）
      - record: sli:availability:ratio
        expr: >
          sum(rate(http_requests_total{status_code!~"5.."}[5m]))
          / sum(rate(http_requests_total[5m]))

      # SLI: レイテンシ（P99 < 1秒の割合）
      - record: sli:latency:ratio
        expr: >
          sum(rate(http_request_duration_seconds_bucket{le="1.0"}[5m]))
          / sum(rate(http_request_duration_seconds_count[5m]))

      # SLO: 可用性 99.9% に対するエラーバジェット消費率
      - alert: ErrorBudgetBurnRateHigh
        expr: >
          1 - sli:availability:ratio > 14.4 * (1 - 0.999)
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "エラーバジェットの消費速度が危険レベル"
          description: "現在のエラーレートでは1時間以内にSLOを違反します"

      # 30日間のSLO達成率
      - record: slo:availability:30d
        expr: >
          avg_over_time(sli:availability:ratio[30d])
```

### SLI/SLO Dashboard Design

```
┌─────────────────────────────────────────────────────────┐
│  SLO Dashboard                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ SLO     │ │ Current  │ │ Error    │ │ Remaining│  │
│  │ Target  │ │ Status   │ │ Budget   │ │ Budget   │  │
│  │ 99.9%   │ │ 99.95%   │ │ 43.2min  │ │ 31.2min  │  │
│  │         │ │(Achieved)│ │ /month   │ │remaining │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  Availability over Time (30d)                           │
│  ┌─────────────────────────────────────────────┐       │
│  │ 100%  ─────────────────────────────         │       │
│  │ 99.9% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (SLO Line)│       │
│  │ 99%                                         │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  Error Budget Consumption                               │
│  ┌─────────────────────────────────────────────┐       │
│  │  ██████████████████░░░░░░░░░░░ 72% consumed │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns

### Anti-Pattern 1: Running Production Without Monitoring

```yaml
# NG: アプリケーションだけデプロイ
services:
  app:
    image: my-app:latest
    ports:
      - "80:80"
# → 障害が発生しても気づけない、原因調査もできない

# OK: 監視スタックを同時にデプロイ
services:
  app:
    image: my-app:latest
  prometheus:
    image: prom/prometheus:latest
  grafana:
    image: grafana/grafana:latest
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
```

**Why it is a problem**: "You cannot manage what you cannot observe." Incident detection is delayed, which increases MTTR (Mean Time to Repair).

### Anti-Pattern 2: Insufficient or Excessive Alert Configuration

```yaml
# NG: 閾値が低すぎてアラート疲れ
- alert: HighCPU
  expr: container_cpu_usage > 50  # 50%で発報 → 常にアラート
  for: 1m                         # 1分は短すぎる

# OK: 適切な閾値と持続時間
- alert: HighCPU
  expr: container_cpu_usage > 85  # 85%で発報
  for: 5m                         # 5分間継続した場合のみ
  labels:
    severity: warning              # 重要度を適切に設定
```

**Why it is a problem**: Too many alerts cause "alert fatigue," causing truly important alerts to be overlooked. Conversely, insufficient configuration means failures go undetected.

### Anti-Pattern 3: Cardinality Explosion

```yaml
# NG: 高カーディナリティラベル
- name: http_requests_total
  labels: ["method", "path", "user_id", "session_id"]
  # → user_id, session_id は無限に増加しPrometheusのメモリを圧迫

# OK: 低カーディナリティラベルのみ使用
- name: http_requests_total
  labels: ["method", "route", "status_code"]
  # → 有限の組み合わせに制限
```

**Why it is a problem**: Prometheus creates a time series for each label combination. Using high-cardinality labels such as user IDs causes memory and storage to increase explosively.

---

## FAQ

### Q1: What is the difference between Prometheus Pull-based and Push-based approaches?

Prometheus uses a **pull-based** model by default (the server fetches metrics from targets). For short-lived batch jobs and similar use cases, **Pushgateway** enables a push-based approach as well. The advantage of pull-based is that target health checks work automatically. Care must be taken to avoid Pushgateway becoming a single point of failure.

### Q2: How long should metrics be retained?

General guidelines:
- **High resolution (15-second intervals)**: 7-15 days
- **Medium resolution (downsampled to 1-minute intervals)**: 30-90 days
- **Low resolution (5-minute intervals)**: 1 year or more

Determine based on the balance between storage cost and analytical demand. For long-term storage, consider remote storage options such as Thanos or Cortex.

### Q3: What is the difference between cAdvisor and Docker Engine Metrics?

cAdvisor is a container-specific metrics collection tool developed by Google that provides detailed metrics for CPU, memory, network, and filesystem. Docker Engine Metrics is an experimental feature offering only simpler metrics. cAdvisor is recommended for production environments.

### Q4: What is the difference between Grafana Alloy and Promtail?

Grafana Alloy is the successor to Promtail and can collect metrics, logs, and traces in a unified manner. It has native support for the OpenTelemetry Protocol (OTLP), so Alloy is recommended for new setups. Promtail is dedicated to log collection, so if it is running stably in an existing environment, there is no problem continuing to use it.

### Q5: How much resource does the monitoring stack itself consume?

Estimates (medium-sized environment: 20-50 containers):
- Prometheus: 1-2 GB RAM, 1 CPU, 10-50 GB storage/month
- Grafana: 256-512 MB RAM, 0.5 CPU
- cAdvisor: 256-512 MB RAM, 0.5 CPU
- Loki: 512 MB-1 GB RAM, 1 CPU
- Promtail: 128-256 MB RAM, 0.25 CPU

Total: approximately 2.5-4.5 GB RAM. A rough guide is 5-10% of the monitored workload's resources.

---

## Summary

| Item | Key Points |
|------|---------|
| Prometheus | Pull-based metrics collection. Flexible queries with PromQL |
| cAdvisor | Container resource metrics collection. An essential component |
| Grafana | Unified dashboard. Integrates with Prometheus/Loki |
| Alertmanager | Alert routing. Separate notification destinations by severity |
| Loki | Lightweight log aggregation. Label-based indexing |
| Instrumentation | Embed Prometheus client in the application. /metrics endpoint |
| Alert design | Appropriate thresholds and durations. Prevent alert fatigue |
| SLI/SLO | Error budget-based alerting. Tied to business metrics |
| Distributed tracing | Request tracking with OpenTelemetry + Tempo/Jaeger |

---

## What to Read Next

- [Docker CI/CD](./02-ci-cd-docker.md) -- Monitoring integration into deployment pipelines
- [Kubernetes Basics](../05-orchestration/01-kubernetes-basics.md) -- Monitoring in Kubernetes environments
- [Production Best Practices](./00-production-best-practices.md) -- Health checks and logging strategy

---

## References

1. Prometheus Official Documentation -- https://prometheus.io/docs/
2. Grafana Loki Official Documentation -- https://grafana.com/docs/loki/latest/
3. Google cAdvisor GitHub -- https://github.com/google/cadvisor
4. Brian Brazil (2018) *Prometheus: Up & Running*, O'Reilly
5. Grafana Labs "Docker monitoring with Grafana" -- https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-docker/
6. OpenTelemetry Official Documentation -- https://opentelemetry.io/docs/
7. Google SRE Book "Monitoring Distributed Systems" -- https://sre.google/sre-book/monitoring-distributed-systems/
8. Grafana Alloy Official Documentation -- https://grafana.com/docs/alloy/latest/
