# Kubernetes Advanced

> Systematically learn deployment, management, and scaling strategies for production-ready Kubernetes clusters using Helm, Ingress, ConfigMap/Secret, and HPA (Horizontal Pod Autoscaler).

## What You Will Learn

1. **Package management and templating with Helm** -- Build reusable Kubernetes manifests through Chart creation and management
2. **Configuration management with Ingress and ConfigMap/Secret** -- Understand external traffic routing and secure application configuration management
3. **Autoscaling with HPA** -- Implement horizontal Pod scaling for automatic adjustment under load, balancing availability and cost efficiency
4. **Choosing and implementing deployment strategies** -- How to choose between Rolling Update, Blue-Green, and Canary deployments, and integration with Argo Rollouts
5. **Event-driven scaling with KEDA** -- Implementation patterns for scaling queue-based workloads from 0 to N
6. **Monitoring infrastructure with Prometheus / Grafana** -- Building an observability stack from metrics collection to alert configuration


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Kubernetes Basics](./01-kubernetes-basics.md)

---

## 1. Helm

### 1.1 Overview of Helm

```
+------------------------------------------------------------------+
|              Helm Architecture                                     |
+------------------------------------------------------------------+
|                                                                  |
|  [Developer]                                                     |
|     |  helm install / upgrade / rollback                         |
|     v                                                            |
|  [Helm CLI]                                                      |
|     |  Chart (templates + values)                                |
|     v                                                            |
|  [Kubernetes API Server]                                         |
|     |  Apply manifests                                           |
|     v                                                            |
|  [Kubernetes Cluster]                                            |
|     +-- Deployment                                               |
|     +-- Service                                                  |
|     +-- Ingress                                                  |
|     +-- ConfigMap / Secret                                       |
|     +-- HPA                                                      |
|                                                                  |
|  Chart structure:                                                |
|    mychart/                                                      |
|      Chart.yaml          <- Chart metadata                       |
|      values.yaml         <- Default values                       |
|      values-staging.yaml <- Staging overrides                    |
|      values-prod.yaml    <- Production overrides                 |
|      charts/             <- Dependency Charts (subcharts)        |
|      crds/               <- CustomResourceDefinition             |
|      templates/          <- Go templates                         |
|        deployment.yaml                                           |
|        service.yaml                                              |
|        ingress.yaml                                              |
|        configmap.yaml                                            |
|        secret.yaml                                               |
|        hpa.yaml                                                  |
|        pdb.yaml                                                  |
|        serviceaccount.yaml                                       |
|        NOTES.txt         <- Notes displayed after install        |
|        _helpers.tpl      <- Common helpers                       |
|      tests/              <- Helm tests                           |
|        test-connection.yaml                                      |
|                                                                  |
+------------------------------------------------------------------+
```

Helm is both a package manager for Kubernetes manifests and a template engine. It manages multiple YAML files as a single "Chart" and, by substituting values in `values.yaml`, can generate manifests for different environments (development, staging, production) from the same template.

Since Helm 3, Tiller (the server-side component) has been removed, and Helm now operates client-side only. Release information is stored as Kubernetes Secrets.

### 1.2 Chart.yaml

```yaml
# mychart/Chart.yaml
apiVersion: v2
name: myapp
description: A Helm chart for MyApp
type: application
version: 0.1.0        # Chart version
appVersion: "1.2.0"   # Application version

# Chart maintainer information
maintainers:
  - name: Platform Team
    email: platform@example.com

# Keywords (for searching)
keywords:
  - webapp
  - nodejs

# Source code location
sources:
  - https://github.com/myorg/myapp

dependencies:
  - name: postgresql
    version: "15.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: "19.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
  - name: common
    version: "2.x"
    repository: https://charts.bitnami.com/bitnami
    tags:
      - bitnami-common
```

### 1.3 values.yaml

```yaml
# mychart/values.yaml
replicaCount: 2

image:
  repository: ghcr.io/myorg/myapp
  tag: "1.2.0"
  pullPolicy: IfNotPresent

# Image pull secrets (for private registries)
imagePullSecrets:
  - name: ghcr-credentials

# Service Account
serviceAccount:
  create: true
  annotations: {}
  name: ""

# Pod annotations
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"

# Pod labels
podLabels:
  team: backend
  cost-center: engineering

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: app-tls
      hosts:
        - app.example.com

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Pod Disruption Budget
podDisruptionBudget:
  enabled: true
  minAvailable: 1
  # maxUnavailable: 1

# Node selector
nodeSelector:
  kubernetes.io/arch: amd64

# Tolerations
tolerations: []

# Affinity (Pod placement control)
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - myapp
          topologyKey: kubernetes.io/hostname

# Topology Spread Constraints (AZ distribution)
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: myapp

env:
  NODE_ENV: production
  LOG_LEVEL: info

# Subchart configuration
postgresql:
  enabled: true
  auth:
    postgresPassword: ""  # Managed via Secret
    database: myapp

redis:
  enabled: true
  architecture: standalone
```

### 1.4 _helpers.tpl (Common Helper Templates)

```yaml
{{/*
mychart/templates/_helpers.tpl
*/}}

{{/*
Application name (can override Chart name)
*/}}
{{- define "myapp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Full name (release name + Chart name)
*/}}
{{- define "myapp.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "myapp.labels" -}}
helm.sh/chart: {{ include "myapp.chart" . }}
{{ include "myapp.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "myapp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "myapp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Chart name + version
*/}}
{{- define "myapp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
ServiceAccount name
*/}}
{{- define "myapp.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "myapp.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
```

### 1.5 Deployment Template

```yaml
# mychart/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
        {{- with .Values.podLabels }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
    spec:
      serviceAccountName: {{ include "myapp.serviceAccountName" . }}
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          ports:
            - containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
              name: http
          envFrom:
            - configMapRef:
                name: {{ include "myapp.fullname" . }}
            - secretRef:
                name: {{ include "myapp.fullname" . }}
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 30
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 64Mi
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.topologySpreadConstraints }}
      topologySpreadConstraints:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

### 1.6 Service Template

```yaml
# mychart/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
  selector:
    {{- include "myapp.selectorLabels" . | nindent 4 }}
```

### 1.7 PodDisruptionBudget Template

```yaml
# mychart/templates/pdb.yaml
{{- if .Values.podDisruptionBudget.enabled }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  {{- if .Values.podDisruptionBudget.minAvailable }}
  minAvailable: {{ .Values.podDisruptionBudget.minAvailable }}
  {{- end }}
  {{- if .Values.podDisruptionBudget.maxUnavailable }}
  maxUnavailable: {{ .Values.podDisruptionBudget.maxUnavailable }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
{{- end }}
```

### 1.8 Helm Tests

```yaml
# mychart/templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "myapp.fullname" . }}-test-connection"
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  containers:
    - name: wget
      image: busybox:1.36
      command: ['wget']
      args: ['{{ include "myapp.fullname" . }}:{{ .Values.service.port }}/health']
  restartPolicy: Never
```

### 1.9 Helm Commands

```bash
# Resolve Chart dependencies
helm dependency update ./mychart

# Dry-run (preview manifests)
helm install myapp ./mychart --dry-run --debug

# Render templates only (no cluster required)
helm template myapp ./mychart -f values-production.yaml

# Lint (syntax check)
helm lint ./mychart

# Install
helm install myapp ./mychart -n production --create-namespace

# Install with value overrides
helm install myapp ./mychart \
  -f values-production.yaml \
  --set image.tag=1.3.0

# Upgrade
helm upgrade myapp ./mychart \
  --set image.tag=1.3.0 \
  --wait --timeout 5m

# Combine install and upgrade (installs if not present)
helm upgrade --install myapp ./mychart \
  -f values-production.yaml \
  --wait --timeout 5m \
  --atomic  # Auto-rollback on failure

# Rollback
helm rollback myapp 1  # Roll back to revision 1

# List releases
helm list -n production

# Show current values for a specific release
helm get values myapp -n production

# Show all manifests for a specific release
helm get manifest myapp -n production

# History
helm history myapp -n production

# Run tests
helm test myapp -n production

# Uninstall
helm uninstall myapp -n production

# Push Chart to OCI registry
helm package ./mychart
helm push myapp-0.1.0.tgz oci://ghcr.io/myorg/charts

# Install from OCI registry
helm install myapp oci://ghcr.io/myorg/charts/myapp --version 0.1.0
```

### 1.10 Managing Environment-Specific values Files

```yaml
# values-staging.yaml (staging overrides)
replicaCount: 1

image:
  tag: "staging-latest"

resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 128Mi

autoscaling:
  enabled: false

ingress:
  hosts:
    - host: staging.app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: staging-app-tls
      hosts:
        - staging.app.example.com

env:
  NODE_ENV: staging
  LOG_LEVEL: debug
```

```yaml
# values-production.yaml (production overrides)
replicaCount: 3

image:
  tag: "1.2.0"

resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 65

podDisruptionBudget:
  enabled: true
  minAvailable: 2

env:
  NODE_ENV: production
  LOG_LEVEL: warn
```

---

## 2. Ingress

### 2.1 How Ingress Works

```
+------------------------------------------------------------------+
|              Ingress Traffic Flow                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Internet]                                                      |
|       |                                                          |
|       v                                                          |
|  [Load Balancer] (provided by cloud provider)                    |
|       |                                                          |
|       v                                                          |
|  [Ingress Controller] (nginx / traefik / ALB)                    |
|       |                                                          |
|       +----> app.example.com/      -> Service: frontend -> Pods  |
|       |                                                          |
|       +----> app.example.com/api/  -> Service: backend  -> Pods  |
|       |                                                          |
|       +----> admin.example.com/    -> Service: admin    -> Pods  |
|       |                                                          |
|       +----> ws.example.com/       -> Service: websocket -> Pods |
|                                                                  |
+------------------------------------------------------------------+
```

### 2.2 Ingress Manifest

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    # NGINX Ingress Controller
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    # Timeout configuration
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "10"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    # CORS configuration
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://app.example.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Authorization, Content-Type"
    # Automatic TLS via cert-manager
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
        - api.example.com
      secretName: myapp-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8080
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8080
```

### 2.3 WebSocket-Enabled Ingress

```yaml
# ingress-websocket.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: websocket-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
spec:
  ingressClassName: nginx
  rules:
    - host: ws.example.com
      http:
        paths:
          - path: /ws
            pathType: Prefix
            backend:
              service:
                name: websocket-service
                port:
                  number: 8080
```

### 2.4 gRPC-Enabled Ingress

```yaml
# ingress-grpc.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grpc-ingress
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: "GRPC"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - grpc.example.com
      secretName: grpc-tls
  rules:
    - host: grpc.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: grpc-service
                port:
                  number: 50051
```

### 2.5 Automatic TLS Certificate Management with cert-manager

```yaml
# cert-manager ClusterIssuer (Let's Encrypt)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
      # DNS01 challenge (for wildcard certificates)
      - dns01:
          route53:
            region: ap-northeast-1
            hostedZoneID: Z1234567890
        selector:
          dnsZones:
            - "example.com"

---
# Wildcard certificate
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: wildcard-cert
  namespace: default
spec:
  secretName: wildcard-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - "*.example.com"
    - "example.com"
```

### 2.6 Ingress Controller Comparison

| Item | NGINX Ingress | Traefik | AWS ALB | Istio Gateway |
|------|-------------|---------|---------|--------------|
| Protocols | HTTP/HTTPS/gRPC | HTTP/HTTPS/TCP/UDP | HTTP/HTTPS | HTTP/HTTPS/gRPC/TCP |
| Configuration | Annotations | CRD / Labels | Annotations | CRD (VirtualService) |
| Auto TLS | cert-manager | Built-in (ACME) | ACM | cert-manager |
| Rate limiting | Annotation | Middleware | WAF | EnvoyFilter |
| Authentication | Basic / OAuth | ForwardAuth | Cognito | JWT / OAuth |
| Observability | Prometheus | Built-in Dashboard | CloudWatch | Kiali / Jaeger |
| WebSocket | Supported | Supported | Supported | Supported |
| gRPC | Supported | Supported | Supported | Native support |
| Canary | Annotation | Weighted | Weighted Target Group | Traffic Shifting |
| Learning curve | Low | Medium | Low (AWS) | High |

---

## 3. ConfigMap and Secret

### 3.1 ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  # Key=value pairs
  NODE_ENV: production
  LOG_LEVEL: info
  APP_PORT: "3000"

  # Store an entire file as a value
  nginx.conf: |
    server {
      listen 80;
      server_name localhost;

      # Health check endpoint
      location /nginx-health {
        return 200 "ok";
        access_log off;
      }

      location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
      }
    }

  # JSON configuration file
  app-config.json: |
    {
      "database": {
        "pool": {
          "min": 2,
          "max": 10,
          "idleTimeoutMillis": 30000
        }
      },
      "cache": {
        "ttl": 3600,
        "checkPeriod": 600
      },
      "logging": {
        "format": "json",
        "level": "info"
      }
    }
```

### 3.2 Secret

```yaml
# secret.yaml (Base64 encoded)
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secret
type: Opaque
data:
  DATABASE_URL: cG9zdGdyZXNxbDovL3VzZXI6cGFzc0BkYjozMjQzMi9teWFwcA==
  JWT_SECRET: c3VwZXItc2VjcmV0LWtleQ==
  REDIS_PASSWORD: cmVkaXMtcGFzc3dvcmQ=

# Using stringData avoids the need for encoding
# stringData:
#   DATABASE_URL: "postgresql://user:pass@db:5432/myapp"
```

### 3.3 Usage Patterns from Pods

```yaml
# deployment.yaml
spec:
  containers:
    - name: app
      # Pattern 1: Inject entire ConfigMap/Secret as environment variables
      envFrom:
        - configMapRef:
            name: myapp-config
        - secretRef:
            name: myapp-secret

      # Pattern 2: Map individual keys to environment variables
      env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: myapp-config
              key: DB_HOST
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: myapp-secret
              key: DB_PASSWORD

      # Pattern 3: Mount as files
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
        # Mount only specific keys
        - name: nginx-config
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: nginx.conf
          readOnly: true

  volumes:
    - name: config-volume
      configMap:
        name: myapp-config
    - name: secret-volume
      secret:
        secretName: myapp-secret
        defaultMode: 0400  # Read-only permissions
    - name: nginx-config
      configMap:
        name: myapp-config
        items:
          - key: nginx.conf
            path: nginx.conf
```

### 3.4 External Secrets (External Secret Management)

```yaml
# ClusterSecretStore (AWS Secrets Manager)
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secretsmanager
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets

---
# external-secret.yaml (External Secrets Operator)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: myapp-secret
    creationPolicy: Owner
    template:
      type: Opaque
      data:
        DATABASE_URL: "{{ .database_url }}"
        JWT_SECRET: "{{ .jwt_secret }}"
  data:
    - secretKey: database_url
      remoteRef:
        key: myapp/production
        property: database_url
    - secretKey: jwt_secret
      remoteRef:
        key: myapp/production
        property: jwt_secret
```

### 3.5 Sealed Secrets (Encryption for GitOps)

```bash
# Install Sealed Secrets Controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Encrypt with kubeseal CLI
kubectl create secret generic myapp-secret \
  --from-literal=DATABASE_URL='postgresql://user:pass@db:5432/myapp' \
  --dry-run=client -o yaml | kubeseal --format yaml > sealed-secret.yaml
```

```yaml
# sealed-secret.yaml (encrypted, safe to commit to Git)
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: myapp-secret
  namespace: production
spec:
  encryptedData:
    DATABASE_URL: AgBy3i4OJSWK+PiTySYZZA9rO43cGDEq...
    JWT_SECRET: AgCtr3j5PKTWL+QjUZAAB0sP44dGEFr...
```

---

## 4. HPA (Horizontal Pod Autoscaler)

### 4.1 How HPA Works

```
+------------------------------------------------------------------+
|              HPA Autoscaling Flow                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Metrics Server] -> Collects CPU/memory utilization             |
|       |                                                          |
|       v                                                          |
|  [HPA Controller] -> Evaluates metrics every 15 seconds          |
|       |                                                          |
|       v  Target: CPU utilization 70%                             |
|                                                                  |
|  Current: 3 Pods, CPU utilization 90%                            |
|  Calculation: ceil(3 * 90/70) = ceil(3.86) = 4 Pods             |
|       |                                                          |
|       v  Scale out                                               |
|  Result: Increase to 4 Pods                                      |
|                                                                  |
|  --- After load decreases ---                                    |
|  Current: 4 Pods, CPU utilization 30%                            |
|  Calculation: ceil(4 * 30/70) = ceil(1.71) = 2 Pods             |
|       |                                                          |
|       v  Scale in (stabilization window: wait 5 minutes)         |
|  Result: Decrease to 2 Pods                                      |
|                                                                  |
|  Scaling formula:                                                |
|    desiredReplicas = ceil[currentReplicas                        |
|      * (currentMetricValue / desiredMetricValue)]                |
|                                                                  |
|  When using multiple metrics:                                    |
|    Calculate desiredReplicas for each metric, use the maximum    |
|                                                                  |
+------------------------------------------------------------------+
```

### 4.2 HPA Manifest

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 20
  metrics:
    # CPU utilization-based
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    # Memory utilization-based
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    # Custom metrics (Prometheus integration)
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"
    # External metrics (SQS queue length, etc.)
    - type: External
      external:
        metric:
          name: sqs_messages_visible
          selector:
            matchLabels:
              queue: myapp-tasks
        target:
          type: AverageValue
          averageValue: "5"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50          # Increase by up to 50% at a time
          periodSeconds: 60
        - type: Pods
          value: 4           # Increase by up to 4 Pods at a time
          periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300  # 5-minute stabilization window
      policies:
        - type: Percent
          value: 25          # Decrease by up to 25% at a time
          periodSeconds: 60
      selectPolicy: Min  # Select the most conservative policy
```

### 4.3 Installing and Verifying Metrics Server

```bash
# Install Metrics Server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Check metrics
kubectl top nodes
kubectl top pods -n production

# Check HPA status
kubectl get hpa -n production
kubectl describe hpa myapp-hpa -n production

# Check HPA event log
kubectl get events --field-selector involvedObject.name=myapp-hpa -n production
```

### 4.4 Prometheus Adapter (Custom Metrics HPA)

```yaml
# prometheus-adapter configuration
# Converts Prometheus metrics to Kubernetes custom metrics API
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-adapter-config
  namespace: monitoring
data:
  config.yaml: |
    rules:
      # Expose HTTP RPS as custom metrics
      - seriesQuery: 'http_requests_total{namespace!="",pod!=""}'
        resources:
          overrides:
            namespace: {resource: "namespace"}
            pod: {resource: "pod"}
        name:
          matches: "^(.*)_total$"
          as: "${1}_per_second"
        metricsQuery: 'rate(<<.Series>>{<<.LabelMatchers>>}[2m])'

      # Response time P99
      - seriesQuery: 'http_request_duration_seconds_bucket{namespace!="",pod!=""}'
        resources:
          overrides:
            namespace: {resource: "namespace"}
            pod: {resource: "pod"}
        name:
          as: "http_request_duration_p99"
        metricsQuery: 'histogram_quantile(0.99, rate(<<.Series>>{<<.LabelMatchers>>}[5m]))'
```

### 4.5 Scaling Strategy Comparison

| Strategy | Metrics | Response speed | Accuracy | Use case |
|------|----------|-------------|------|------|
| HPA (CPU) | CPU utilization | Medium (15s interval) | Medium | General web apps |
| HPA (Memory) | Memory usage | Medium | Low | Memory-intensive processing |
| HPA (Custom) | RPS, latency, etc. | Medium | High | API servers |
| KEDA | Event sources | High | High | Queue workers, FaaS |
| VPA | CPU/Memory | Slow | High | Resource optimization |
| Cluster Autoscaler | Node resources | Slow | - | Node add/remove |
| Karpenter | Node resources | Fast | High | AWS node provisioning |

---

## 5. KEDA (Kubernetes Event-Driven Autoscaling)

### 5.1 Overview of KEDA

```
+------------------------------------------------------------------+
|              KEDA Architecture                                     |
+------------------------------------------------------------------+
|                                                                  |
|  [Event Sources]                                                 |
|    +-- AWS SQS                                                   |
|    +-- Apache Kafka                                              |
|    +-- RabbitMQ                                                  |
|    +-- Redis Streams                                             |
|    +-- Prometheus                                                |
|    +-- Cron                                                      |
|       |                                                          |
|       v                                                          |
|  [KEDA Operator]                                                 |
|    +-- ScaledObject  -> Deployment scaling                       |
|    +-- ScaledJob     -> Job scaling                              |
|       |                                                          |
|       v  Metrics evaluation                                      |
|  [HPA] (KEDA internally generates and manages HPA)               |
|       |                                                          |
|       v                                                          |
|  [Deployment / Job]                                              |
|    0 Pods <-----> N Pods (Scale-to-Zero supported)               |
|                                                                  |
+------------------------------------------------------------------+
```

### 5.2 Installing KEDA

```bash
# Install with Helm
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
helm install keda kedacore/keda -n keda --create-namespace
```

### 5.3 Scaling SQS Queue Workers

```yaml
# keda-sqs-scaledobject.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: sqs-worker-scaler
  namespace: production
spec:
  scaleTargetRef:
    name: sqs-worker
  pollingInterval: 15          # Check every 15 seconds
  cooldownPeriod: 60           # Wait time before scale down
  minReplicaCount: 0           # Scale-to-Zero
  maxReplicaCount: 50
  triggers:
    - type: aws-sqs-queue
      metadata:
        queueURL: https://sqs.ap-northeast-1.amazonaws.com/123456789/myapp-tasks
        queueLength: "5"       # 1 Pod per 5 messages
        awsRegion: ap-northeast-1
      authenticationRef:
        name: aws-credentials

---
# Authentication reference
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: aws-credentials
  namespace: production
spec:
  podIdentity:
    provider: aws-eks  # Use EKS Pod Identity / IRSA
```

### 5.4 Scaling Kafka Consumers

```yaml
# keda-kafka-scaledobject.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: kafka-consumer-scaler
spec:
  scaleTargetRef:
    name: kafka-consumer
  minReplicaCount: 0
  maxReplicaCount: 30
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka-broker:9092
        consumerGroup: myapp-group
        topic: events
        lagThreshold: "100"      # 1 Pod per 100 lag messages
        activationLagThreshold: "10"  # Scale from 0->1 at lag 10
```

### 5.5 Cron-Based Scaling

```yaml
# keda-cron-scaledobject.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: business-hours-scaler
spec:
  scaleTargetRef:
    name: myapp
  triggers:
    # Keep more Pods during business hours (weekdays 9:00-18:00 JST)
    - type: cron
      metadata:
        timezone: Asia/Tokyo
        start: 0 9 * * 1-5
        end: 0 18 * * 1-5
        desiredReplicas: "10"
    # Minimal configuration at night and on weekends
    - type: cron
      metadata:
        timezone: Asia/Tokyo
        start: 0 18 * * 1-5
        end: 0 9 * * 2-6
        desiredReplicas: "2"
```

---

## 6. Deployment Strategies

### 6.1 Rolling Update

```yaml
# deployment.yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%         # Percentage of Pods to add at once
      maxUnavailable: 25%   # Percentage of Pods to stop at once
```

### 6.2 Blue-Green / Canary (Helm)

```bash
# Canary deploy (10% of traffic)
helm upgrade myapp ./mychart \
  --set canary.enabled=true \
  --set canary.weight=10 \
  --set canary.image.tag=1.3.0

# Promote to production if no issues
helm upgrade myapp ./mychart \
  --set image.tag=1.3.0 \
  --set canary.enabled=false

# Rollback if issues arise
helm rollback myapp
```

### 6.3 Progressive Delivery with Argo Rollouts

```yaml
# argo-rollout.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 5
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    canary:
      canaryService: myapp-canary
      stableService: myapp-stable
      trafficRouting:
        nginx:
          stableIngress: myapp-ingress
      steps:
        # Route 5% of traffic to canary
        - setWeight: 5
        - pause: {duration: 5m}
        # Automatically analyze metrics
        - analysis:
            templates:
              - templateName: success-rate
            args:
              - name: service-name
                value: myapp-canary
        # Increase to 20%
        - setWeight: 20
        - pause: {duration: 5m}
        # Increase to 50%
        - setWeight: 50
        - pause: {duration: 10m}
        # 100% (promote)
        - setWeight: 100

---
# Analysis template
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
    - name: service-name
  metrics:
    - name: success-rate
      interval: 1m
      successCondition: result[0] >= 0.99
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{
              service="{{args.service-name}}",
              status=~"2.."
            }[5m])) /
            sum(rate(http_requests_total{
              service="{{args.service-name}}"
            }[5m]))
```

### 6.4 Deployment Strategy Comparison

| Strategy | Downtime | Rollback speed | Resource usage | Complexity |
|------|-----------|-------------|-------------|-------|
| RollingUpdate | None | Medium (Pod replacement) | Low (25% increase) | Low |
| Blue-Green | None | Immediate (switch) | High (2x) | Medium |
| Canary | None | Immediate | Low (small addition) | High |
| Argo Rollouts | None | Automatic | Low | High |

---

## 7. Network Policy

### 7.1 Default Deny Policy

```yaml
# network-policy-deny-all.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: production
spec:
  podSelector: {}  # Apply to all Pods
  policyTypes:
    - Ingress
    - Egress
```

### 7.2 Application-Specific Policies

```yaml
# network-policy-myapp.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-netpol
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow traffic only from Ingress Controller
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
          podSelector:
            matchLabels:
              app.kubernetes.io/name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
  egress:
    # Allow DNS queries
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
    # Allow connections to PostgreSQL
    - to:
        - podSelector:
            matchLabels:
              app: postgresql
      ports:
        - protocol: TCP
          port: 5432
    # Allow connections to Redis
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
    # Allow HTTPS connections to external APIs
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
```

---

## 8. Prometheus / Grafana Monitoring Infrastructure

### 8.1 Installing kube-prometheus-stack

```bash
# Install Prometheus Operator + Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring-values.yaml
```

```yaml
# monitoring-values.yaml
grafana:
  adminPassword: "change-me-in-production"
  ingress:
    enabled: true
    ingressClassName: nginx
    hosts:
      - grafana.internal.example.com

prometheus:
  prometheusSpec:
    retention: 15d
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi
```

### 8.2 ServiceMonitor (Collecting Application Metrics)

```yaml
# servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
  namespace: production
  labels:
    release: monitoring  # Match the Prometheus Operator selector
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: myapp
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
```

### 8.3 PrometheusRule (Alert Rules)

```yaml
# prometheusrule.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: myapp-alerts
  namespace: production
  labels:
    release: monitoring
spec:
  groups:
    - name: myapp.rules
      rules:
        # High error rate
        - alert: HighErrorRate
          expr: |
            sum(rate(http_requests_total{service="myapp",status=~"5.."}[5m]))
            / sum(rate(http_requests_total{service="myapp"}[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "myapp error rate exceeds 5%"
            description: "Error rate over the last 5 minutes: {{ $value | humanizePercentage }}"

        # High latency
        - alert: HighLatency
          expr: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{service="myapp"}[5m])) by (le)
            ) > 2
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "myapp P99 latency exceeds 2 seconds"

        # Pod restarts
        - alert: PodCrashLooping
          expr: |
            rate(kube_pod_container_status_restarts_total{
              namespace="production",
              pod=~"myapp-.*"
            }[15m]) * 60 * 15 > 3
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Pod {{ $labels.pod }} is restarting frequently"
```

---

## Anti-Patterns

### Anti-Pattern 1: Committing Secrets to Git

```yaml
# NG: Committing raw Secret values to Git
apiVersion: v1
kind: Secret
data:
  DATABASE_URL: cG9zdGdyZXNxbDovL2FkbWluOnBAc3N3b3JkQGRiOjU0MzIvcHJvZA==
  # Base64 is encoding, not encryption!

# OK: Use external secret management
# - External Secrets Operator + AWS Secrets Manager
# - Sealed Secrets (commit to Git in encrypted form)
# - SOPS (Mozilla) for encryption
```

**Problem**: Base64 is mere encoding and can be easily decoded with `echo "cG9z..." | base64 -d`. Once committed to Git history, complete removal becomes difficult. Use External Secrets Operator or Sealed Secrets to store only encrypted data in Git.

### Anti-Pattern 2: Specifying replicas in Both HPA and Deployment

```yaml
# NG: Specifying replicas managed by HPA also in Deployment
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3  # <- Conflicts with HPA! Resets on every helm upgrade

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10

# OK: Omit replicas when HPA is enabled
apiVersion: apps/v1
kind: Deployment
spec:
  # replicas omitted as it is managed by HPA
  selector:
    matchLabels:
      app: myapp
```

**Problem**: Even if HPA has scaled Pods to 7, running `helm upgrade` with `replicas: 3` will overwrite it and suddenly delete 4 Pods. When HPA is enabled, omit the `replicas` field from the Deployment.

### Anti-Pattern 3: Not Setting Resource Requests/Limits

```yaml
# NG: resources not configured
spec:
  containers:
    - name: app
      image: myapp:latest
      # resources not set -> can consume resources without limit
      # -> affects other Pods on the same node, risk of OOMKiller

# OK: Appropriate resource configuration
spec:
  containers:
    - name: app
      image: myapp:latest
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 256Mi
```

**Problem**: Pods without resource limits are classified as BestEffort QoS class and are the first to be evicted when node resources run low. A single Pod monopolizing CPU or memory can also cause "noisy neighbor" problems affecting other Pods. Setting requests allows the scheduler to select appropriate nodes, and setting limits prevents runaway resource consumption.

### Anti-Pattern 4: Not Setting PodDisruptionBudget

```yaml
# NG: Without PDB, all Pods may stop simultaneously during node maintenance

# OK: Guarantee minimum availability with PDB
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
spec:
  minAvailable: 2  # Always keep at least 2 Pods running
  selector:
    matchLabels:
      app: myapp
```

**Problem**: `kubectl drain` is executed during Kubernetes node upgrades or scale-downs. Without PDB, all Pods can be evicted simultaneously, causing temporary service downtime. Always configure PDB in production environments.

---

## FAQ

### Q1: Where is the best place to store Helm Charts?

**A**: (1) Co-locate in a `charts/` directory within the application repository (monorepo approach), or (2) Separate into a dedicated Helm Chart repository (OCI registry or ChartMuseum). For small to medium scale, (1) is easier to manage and keeps app and chart versions in sync. For large-scale deployments where multiple teams share the same Chart, manage it as a shared Chart with (2). OCI registries (GHCR, ECR, etc.) are the current recommendation.

### Q2: Are Pods automatically restarted when a ConfigMap changes?

**A**: No. Updating a ConfigMap does not automatically restart existing Pods. Options are: (1) Include a ConfigMap checksum in Deployment annotations (`checksum/config: {{ sha256sum }}`), which triggers a rolling update when the ConfigMap changes; (2) Manually restart with `kubectl rollout restart deployment myapp`; (3) Install Reloader (stakater/Reloader) for automatic detection and restart.

### Q3: What is the difference between KEDA and HPA?

**A**: HPA scales based on CPU/memory or custom metrics but requires a minimum of 1 Pod (cannot scale down to 0). KEDA (Kubernetes Event-Driven Autoscaling) scales based on event sources (SQS queue length, Kafka lag, Cron, etc.) and can scale down to 0 Pods (Scale-to-Zero). HPA is suited for API servers, while KEDA is suited for background workers and event-driven processing.

### Q4: Can VPA (Vertical Pod Autoscaler) and HPA be used simultaneously?

**A**: Using CPU-based HPA and CPU-based VPA simultaneously causes conflicts. Recommended patterns are: (1) HPA scales based on custom metrics (RPS, etc.) while VPA optimizes CPU/memory requests in a divided role; (2) Run VPA in "UpdateMode: Off" to use only for reporting recommendations (humans review recommendations and apply them manually). The Multidimensional Pod Autoscaler (MPA) attempts to integrate both but is not yet mature.

### Q5: How do I debug when communication fails after setting Network Policy?

**A**: (1) Run `kubectl describe networkpolicy <name>` to verify rules are correct. (2) Verify that a CNI supporting Network Policy (Calico, Cilium, etc.) is installed (the default Flannel does not support it). (3) Verify that DNS (kube-dns / CoreDNS) access is permitted in Egress rules (forgetting this makes name resolution impossible, causing all communication to fail). (4) Create a debug Pod with `kubectl run debug --rm -it --image=nicolaka/netshoot -- bash` and test connectivity with `nslookup` or `curl`.

### Q6: What is the difference between Argo Rollouts and Flagger?

**A**: Both achieve progressive delivery but with different approaches. Argo Rollouts uses an alternative resource (Rollout CRD) replacing Deployment and has strong integration with Argo CD. Flagger uses existing Deployments as-is and controls traffic at the Ingress/Service Mesh level. If you are using the Argo ecosystem (Argo CD, Argo Workflows), Rollouts is the natural choice; if you are using an Istio/Linkerd-based service mesh, Flagger is the natural choice.

---

## Summary

| Item | Key Points |
|------|------|
| Helm | Templatize manifests with Charts. Absorb environment differences with values.yaml |
| Ingress | Host/path-based routing. Automatic TLS with cert-manager |
| ConfigMap | Externalize configuration values. Detect changes with checksum annotations |
| Secret | Manage sensitive information. External Secrets Operator recommended for external integration |
| HPA | Horizontal scaling with CPU/memory/custom metrics |
| KEDA | Event-driven scaling. Scale-to-Zero supported |
| Deployment strategies | RollingUpdate (standard), Canary (Argo Rollouts), Blue-Green |
| Network Policy | Control communication with default deny + whitelist |
| PDB | Guarantee minimum availability during node maintenance |
| Monitoring | Visualize metrics with Prometheus + Grafana. Alerts with PrometheusRule |

## Guides to Read Next

- [Container Security](../06-security/00-container-security.md) -- Security best practices on K8s
- [Supply Chain Security](../06-security/01-supply-chain-security.md) -- Image signing and SBOM
- Migrating from Docker Compose to Kubernetes -- Migration patterns using Kompose

## References

1. **Helm Official Documentation** -- https://helm.sh/docs/ -- Comprehensive reference for Helm Chart creation and management
2. **Kubernetes Ingress** -- https://kubernetes.io/docs/concepts/services-networking/ingress/ -- Official specification for Ingress resources
3. **HPA Official Documentation** -- https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/ -- Details on HPA configuration and behavior
4. **External Secrets Operator** -- https://external-secrets.io/ -- Integration with external secret management
5. **KEDA Official Documentation** -- https://keda.sh/docs/ -- Configuration guide for event-driven autoscaling
6. **Argo Rollouts** -- https://argo-rollouts.readthedocs.io/ -- Implementation reference for progressive delivery
7. **cert-manager** -- https://cert-manager.io/docs/ -- Automatic TLS certificate management in Kubernetes
8. **Kyverno** -- https://kyverno.io/docs/ -- Kubernetes policy management and security enforcement
