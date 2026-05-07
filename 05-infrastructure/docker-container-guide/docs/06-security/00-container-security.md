# Container Security

> Systematically learn how to strengthen container environment security through multiple layers, centered on image scanning (Trivy), the principle of least privilege, and secrets management.

## What You Will Learn

1. **Vulnerability detection via image scanning** -- Automatically detect known vulnerabilities in container images within CI/CD pipelines using scanning tools centered on Trivy
2. **Building least-privilege containers** -- Minimize attack surface through non-root users, read-only filesystems, and capability restrictions
3. **Secrets management and runtime security** -- Understand safe secret injection and runtime anomaly detection/defense strategies
4. **Kubernetes Pod Security Standards** -- Apply pod-level security policies to establish a security baseline across the entire cluster
5. **Runtime security monitoring** -- Real-time anomaly detection with Falco and policy enforcement via OPA/Gatekeeper


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Defense in Depth for Container Security

```
+------------------------------------------------------------------+
|              Container Security Defense-in-Depth Model           |
+------------------------------------------------------------------+
|                                                                  |
|  Layer 1: Image Security                                         |
|    +-- Base image selection (minimal images)                     |
|    +-- Vulnerability scanning (Trivy, Grype)                     |
|    +-- Multi-stage builds                                        |
|    +-- Image signing (cosign)                                    |
|                                                                  |
|  Layer 2: Build Security                                         |
|    +-- Dockerfile best practices                                 |
|    +-- Excluding secrets at build time                           |
|    +-- CI/CD gate (scan failure = deployment rejected)           |
|    +-- Dockerfile Lint (hadolint)                                |
|                                                                  |
|  Layer 3: Runtime Security                                       |
|    +-- Non-root user                                             |
|    +-- Read-only filesystem                                      |
|    +-- Capability restrictions                                   |
|    +-- seccomp / AppArmor profiles                               |
|                                                                  |
|  Layer 4: Orchestration Security                                 |
|    +-- Pod Security Standards                                    |
|    +-- Network Policy                                            |
|    +-- RBAC                                                      |
|    +-- Secret management                                         |
|    +-- Disable automatic ServiceAccount token mounting           |
|                                                                  |
|  Layer 5: Monitoring & Detection                                 |
|    +-- Log auditing                                              |
|    +-- Anomaly detection (Falco)                                 |
|    +-- Image policy (OPA/Gatekeeper)                             |
|    +-- Network traffic analysis                                  |
|                                                                  |
+------------------------------------------------------------------+
```

The fundamental concept is "Defense in Depth," where each layer provides independent protection so that even if one layer is breached, others can still defend. Rather than relying on a single security measure, combining multiple layers increases the number of barriers an attacker must overcome.

---

## 2. Image Scanning (Trivy)

### 2.1 Basic Trivy Usage

```bash
# Image scan
trivy image myapp:latest

# Severity filter (CRITICAL and HIGH only)
trivy image --severity CRITICAL,HIGH myapp:latest

# JSON output (for CI)
trivy image --format json --output results.json myapp:latest

# Output to file in table format
trivy image --format table --output results.txt myapp:latest

# Dockerfile scan (misconfiguration detection)
trivy config Dockerfile

# Kubernetes manifest scan
trivy config --policy-bundle-repository ghcr.io/aquasecurity/trivy-policies k8s/

# Filesystem scan (local project)
trivy fs --scanners vuln,secret .

# License compliance check
trivy image --scanners license myapp:latest

# Generate SBOM
trivy image --format spdx-json --output sbom.json myapp:latest

# Ignore specific CVEs
trivy image --ignorefile .trivyignore myapp:latest

# Exclude vulnerabilities without a fix release
trivy image --ignore-unfixed myapp:latest
```

### 2.2 .trivyignore File

```text
# .trivyignore
# Temporarily ignored because no fix has been released (tracked until 2025-06-01)
CVE-2024-12345

# Vulnerability in a package not used by this app
CVE-2024-67890  # libxml2 - this app does not perform XML parsing

# Package used only in test environment
CVE-2024-11111  # dev dependency only
```

### 2.3 CI/CD Integration

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Scheduled scan every night (to detect new CVEs)
    - cron: '0 0 * * *'

jobs:
  hadolint:
    name: Dockerfile Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run hadolint
        uses: hadolint/hadolint-action@v3
        with:
          dockerfile: Dockerfile
          failure-threshold: warning

  trivy-scan:
    name: Image Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'           # Fail if vulnerabilities are found
          ignore-unfixed: true

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

  trivy-config:
    name: Configuration Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Scan Dockerfile for misconfigurations
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'config'
          scan-ref: '.'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'

  trivy-fs:
    name: Filesystem & Secret Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Scan for vulnerabilities and secrets
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          scanners: 'vuln,secret'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 2.4 Dockerfile Linting with hadolint

```bash
# Install hadolint
# macOS
brew install hadolint

# Docker
docker run --rm -i hadolint/hadolint < Dockerfile

# Configuration file (.hadolint.yaml)
```

```yaml
# .hadolint.yaml
ignored:
  - DL3008  # Do not pin apt-get versions (not needed for alpine)
  - DL3018  # Do not pin apk versions

trustedRegistries:
  - docker.io
  - ghcr.io
  - gcr.io

override:
  error:
    - DL3000  # Use absolute paths for WORKDIR
    - DL3001  # Notes about pipes
  warning:
    - DL3042  # Use --no-cache-dir with pip install
  info:
    - DL3059  # Consolidate consecutive RUN instructions
```

### 2.5 Scanning Tool Comparison

| Tool | Developer | Scan Target | Speed | DB Update Frequency | OSS |
|-------|-------|------------|------|-----------|-----|
| Trivy | Aqua Security | Image/FS/IaC/Secret | Fast | Daily | Yes |
| Grype | Anchore | Image/FS | Fast | Daily | Yes |
| Snyk | Snyk | Image/Code/IaC | Medium | Real-time | Freemium |
| Docker Scout | Docker | Image | Medium | Daily | Freemium |
| Clair | CoreOS/RedHat | Image | Slow | Daily | Yes |

### 2.6 Grype Usage Examples

```bash
# Install Grype
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Image scan
grype myapp:latest

# Scan from SBOM
grype sbom:sbom.json

# JSON output
grype myapp:latest -o json > grype-results.json

# Filter by severity
grype myapp:latest --fail-on critical
```

---

## 3. Building a Secure Dockerfile

### 3.1 Secure Dockerfile (Node.js)

```dockerfile
# Dockerfile (security-hardened version)

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies first (cache efficiency)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Remove unnecessary files
RUN pnpm prune --production && \
    rm -rf .git .env* *.md tests/ src/

# ---- Production Stage ----
FROM node:20-alpine AS production

# Security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

WORKDIR /app

# Copy only build artifacts
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Suggest read-only (enforced at runtime with --read-only)
VOLUME ["/tmp"]

EXPOSE 3000

# Avoid PID 1 problem (proper signal handling)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### 3.2 Secure Dockerfile (Python)

```dockerfile
# Dockerfile (Python security-hardened version)

# ---- Build Stage ----
FROM python:3.12-slim AS builder

WORKDIR /app

# Create virtual environment (isolate from system Python)
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# ---- Production Stage ----
FROM python:3.12-slim AS production

# Security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends tini && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/false -M appuser

WORKDIR /app

# Copy virtual environment
COPY --from=builder --chown=appuser:appgroup /opt/venv /opt/venv
COPY --from=builder --chown=appuser:appgroup /app .

ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

EXPOSE 8000

ENTRYPOINT ["tini", "--"]
CMD ["gunicorn", "app.main:app", "--bind", "0.0.0.0:8000", "--workers", "4"]
```

### 3.3 Secure Dockerfile (Go)

```dockerfile
# Dockerfile (Go security-hardened version)

# ---- Build Stage ----
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .

# Generate static binary (CGO disabled)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s -X main.version=1.0.0" \
    -o /server ./cmd/server

# ---- Production Stage (scratch or distroless) ----
FROM gcr.io/distroless/static-debian12:nonroot

# CA certificates (required for HTTPS communication)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy only the binary
COPY --from=builder /server /server

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/server"]
```

### 3.4 Base Image Selection

```
+------------------------------------------------------------------+
|              Base Image Size and Security                         |
+------------------------------------------------------------------+
|                                                                  |
|  Image                 | Size     | CVEs (ref) | Use Case       |
|  ----------------------|---------|------------|----------------|
|  ubuntu:22.04          | ~77MB   | Medium     | General        |
|  debian:bookworm-slim  | ~74MB   | Medium     | General        |
|  node:20-bookworm      | ~350MB  | Many       | Development    |
|  node:20-alpine        | ~130MB  | Few        | Production     |
|  node:20-slim          | ~180MB  | Medium     | Alpine-incompatible |
|  python:3.12-slim      | ~120MB  | Few        | Python prod    |
|  python:3.12-alpine    | ~50MB   | Minimal    | Alpine-compatible |
|  golang:1.22-alpine    | ~250MB  | Few        | Go builds      |
|  gcr.io/distroless/    | ~20MB   | Minimal    | Production-optimal |
|  chainguard/           | ~10MB   | Minimal    | Production-optimal |
|  scratch               | 0MB     | None       | Go/Rust static binary |
|                                                                  |
|  Recommended: alpine (Node.js) / distroless (Go/Java) / scratch (Rust) |
|                                                                  |
+------------------------------------------------------------------+
```

Base image selection affects both security and image size. The more packages an image contains, the more CVEs (known vulnerabilities) it will have. Using minimal images reduces the attack surface and also reduces noise in scan results.

### 3.5 Using Distroless Images

```dockerfile
# Distroless build for a Go app
FROM golang:1.22 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /server /server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]
```

```dockerfile
# Distroless build for a Java app
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app
COPY . .
RUN ./gradlew bootJar

FROM gcr.io/distroless/java21-debian12:nonroot
COPY --from=builder /app/build/libs/app.jar /app.jar
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

### 3.6 Chainguard Images (Next-generation minimal images)

```dockerfile
# Node.js app using Chainguard Images
FROM cgr.dev/chainguard/node:latest-dev AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .
RUN npm run build

FROM cgr.dev/chainguard/node:latest
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["dist/index.js"]
```

Chainguard Images are a family of minimal images based on Wolfi Linux, targeting zero CVEs. They use the `apk` package manager and are compatible with Alpine. They are gaining attention as a successor to Distroless.

---

## 4. Least-Privilege Execution

### 4.1 Security Options for docker run

```bash
# Security-hardened docker run
docker run \
  --read-only \                        # Read-only filesystem
  --tmpfs /tmp:noexec,nosuid,size=64m \ # Writable temporary area
  --cap-drop ALL \                     # Remove all capabilities
  --cap-add NET_BIND_SERVICE \         # Add only required capabilities
  --security-opt no-new-privileges \   # Prevent privilege escalation
  --security-opt seccomp=default \     # seccomp profile
  --user 1001:1001 \                   # Non-root user
  --pids-limit 100 \                   # Process count limit
  --memory 256m \                      # Memory limit
  --cpus 0.5 \                         # CPU limit
  --network myapp-net \                # Custom network (don't use default bridge)
  --dns 8.8.8.8 \                      # Explicit DNS server
  --health-cmd "curl -f http://localhost:3000/health || exit 1" \
  --health-interval 30s \
  --health-timeout 5s \
  --health-retries 3 \
  myapp:latest
```

### 4.2 Configuration in Docker Compose

```yaml
# docker-compose.yml
services:
  app:
    image: myapp:latest
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=64m
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
    user: "1001:1001"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
          pids: 100
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks:
      - app-net
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

networks:
  app-net:
    driver: bridge
    internal: false  # Set to true to block external communication
```

### 4.3 Linux Capabilities in Detail

```
+------------------------------------------------------------------+
|              Key Linux Capabilities                               |
+------------------------------------------------------------------+
|                                                                  |
|  Capability            | Description              | When Needed   |
|  ----------------------|--------------------------|---------------|
|  NET_BIND_SERVICE      | Bind to ports below 1024 | Nginx (80/443) |
|  NET_RAW               | Create RAW sockets       | ping command   |
|  CHOWN                 | Change file ownership    | Init scripts   |
|  DAC_OVERRIDE          | Bypass file permissions  | Privileged ops |
|  SETUID/SETGID         | Change UID/GID           | su / sudo      |
|  SYS_ADMIN             | Broad admin privileges   | Mount ops      |
|  SYS_PTRACE            | Process tracing          | Debugging      |
|  SYS_TIME              | Change system time       | NTP client     |
|  AUDIT_WRITE           | Write to audit log       | sshd           |
|  KILL                  | Send signals             | Process mgmt   |
|                                                                  |
|  Default: Docker grants 14 capabilities                          |
|  Recommended: cap_drop ALL + minimal cap_add as needed           |
|                                                                  |
+------------------------------------------------------------------+
```

### 4.4 seccomp Profiles

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "archMap": [
    {
      "architecture": "SCMP_ARCH_X86_64",
      "subArchitectures": ["SCMP_ARCH_X86"]
    }
  ],
  "syscalls": [
    {
      "names": [
        "accept", "accept4", "access", "bind", "brk",
        "chdir", "chmod", "chown", "close", "connect",
        "dup", "dup2", "dup3", "epoll_create", "epoll_create1",
        "epoll_ctl", "epoll_wait", "epoll_pwait",
        "execve", "exit", "exit_group",
        "fchmod", "fchown", "fcntl", "fdatasync",
        "fstat", "fstatfs", "fsync", "ftruncate",
        "getcwd", "getdents", "getdents64", "getegid",
        "geteuid", "getgid", "getpgrp", "getpid", "getppid",
        "getuid", "ioctl", "kill",
        "listen", "lseek", "lstat",
        "madvise", "mkdir", "mmap", "mprotect", "mremap",
        "munmap", "nanosleep", "newfstatat",
        "open", "openat", "pipe", "pipe2", "poll", "ppoll",
        "prctl", "pread64", "prlimit64", "pwrite64",
        "read", "readlink", "readlinkat", "recvfrom", "recvmsg",
        "rename", "rmdir", "rt_sigaction", "rt_sigprocmask",
        "rt_sigreturn", "select", "sendmsg", "sendto",
        "set_robust_list", "set_tid_address",
        "setgid", "setgroups", "setuid",
        "sigaltstack", "socket", "stat", "statfs",
        "symlink", "tgkill", "umask", "uname",
        "unlink", "wait4", "write", "writev"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

```bash
# Apply custom seccomp profile
docker run --security-opt seccomp=seccomp-profile.json myapp:latest
```

### 4.5 Kubernetes Pod Security Standards

```yaml
# pod-security.yaml (Restricted level)
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    runAsGroup: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  automountServiceAccountToken: false  # Disable automatic SA token mounting
  containers:
    - name: app
      image: myapp:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]
      volumeMounts:
        - name: tmp
          mountPath: /tmp
      resources:
        limits:
          cpu: "500m"
          memory: "256Mi"
        requests:
          cpu: "100m"
          memory: "128Mi"
  volumes:
    - name: tmp
      emptyDir:
        sizeLimit: 64Mi
```

### 4.6 Applying Pod Security Standards (PSS)

```yaml
# Apply Pod Security Standards at the Namespace level
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # Enforce Restricted level
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    # Warn at Baseline level
    pod-security.kubernetes.io/warn: baseline
    pod-security.kubernetes.io/warn-version: latest
    # Audit log at Privileged level
    pod-security.kubernetes.io/audit: privileged
    pod-security.kubernetes.io/audit-version: latest
```

```
+------------------------------------------------------------------+
|              Pod Security Standards Levels                        |
+------------------------------------------------------------------+
|                                                                  |
|  Privileged:                                                     |
|    -> No restrictions. All configurations are permitted.         |
|    -> Use case: kube-system, monitoring agents                   |
|                                                                  |
|  Baseline:                                                       |
|    -> Minimal restrictions to prevent known privilege escalation |
|    -> Prohibited: hostNetwork, hostPID, hostIPC, privileged containers |
|    -> Prohibited: hostPath volumes (some)                        |
|    -> Use case: staging, development environments                |
|                                                                  |
|  Restricted:                                                     |
|    -> Strict restrictions following current best practices       |
|    -> Additional requirements: runAsNonRoot, readOnlyRootFilesystem |
|    -> Additional requirements: allowPrivilegeEscalation: false   |
|    -> Additional requirements: capabilities drop ALL, seccomp RuntimeDefault |
|    -> Use case: production environments                          |
|                                                                  |
+------------------------------------------------------------------+
```

### 4.7 RBAC (Role-Based Access Control)

```yaml
# ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp-sa
  namespace: production
automountServiceAccountToken: false

---
# Role (namespace scope)
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: myapp-role
  namespace: production
rules:
  # Allow read-only access to ConfigMaps
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
  # Allow read-only access to Secrets (specific names only)
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["myapp-secret"]
    verbs: ["get"]

---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: myapp-rolebinding
  namespace: production
subjects:
  - kind: ServiceAccount
    name: myapp-sa
    namespace: production
roleRef:
  kind: Role
  name: myapp-role
  apiGroup: rbac.authorization.k8s.io
```

---

## 5. Secrets Management

### 5.1 Secrets Management Comparison

| Method | Security | Complexity | Cost | Use Case |
|------|-----------|-------|-------|---------|
| Environment variables (direct) | Low | Low | Free | Development only |
| Docker Secrets | Medium | Low | Free | Docker Swarm |
| .env file | Low | Low | Free | Local development |
| HashiCorp Vault | High | High | Paid/OSS | Enterprise |
| AWS Secrets Manager | High | Medium | Pay-per-use | AWS environments |
| GCP Secret Manager | High | Medium | Pay-per-use | GCP environments |
| Azure Key Vault | High | Medium | Pay-per-use | Azure environments |
| External Secrets | High | Medium | Depends on backend | Kubernetes |
| Sealed Secrets | Medium | Low | Free | GitOps |
| SOPS | Medium | Low | Free | GitOps |

### 5.2 Build-time Secrets

```dockerfile
# BAD: Passing secrets as build args (persists in layers)
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && \
    npm ci && \
    rm .npmrc   # Deleting it doesn't help — it remains in the previous layer!

# GOOD: BuildKit secret mount
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci

# GOOD: SSH key mount (for cloning private Git repositories)
RUN --mount=type=ssh \
    git clone git@github.com:myorg/private-repo.git
```

```bash
# Pass secrets at build time
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .

# Forward SSH keys
docker build --ssh default -t myapp .

# pip install using BuildKit secret mount
docker build \
  --secret id=pip_conf,src=$HOME/.pip/pip.conf \
  -t myapp .
```

### 5.3 Runtime Secret Injection

```yaml
# Secrets in Docker Compose
services:
  app:
    image: myapp:latest
    secrets:
      - db_password
      - api_key
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    environment: API_KEY
```

```typescript
// App side: reading file-based secrets
import { readFileSync, existsSync } from 'fs';

function getSecret(name: string): string {
  // Prefer Docker Secrets (file-based)
  const filePath = process.env[`${name}_FILE`];
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath, 'utf-8').trim();
  }

  // Fall back to Kubernetes Secret (environment variable)
  const envValue = process.env[name];
  if (envValue) {
    return envValue;
  }

  throw new Error(`Secret '${name}' not found`);
}

const dbPassword = getSecret('DB_PASSWORD');
const apiKey = getSecret('API_KEY');
```

### 5.4 HashiCorp Vault Integration

```yaml
# Kubernetes integration using Vault Agent Injector
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    metadata:
      annotations:
        # Vault Agent Injector annotations
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "myapp"
        vault.hashicorp.com/agent-inject-secret-db-creds: "secret/data/myapp/db"
        vault.hashicorp.com/agent-inject-template-db-creds: |
          {{- with secret "secret/data/myapp/db" -}}
          export DATABASE_URL="postgresql://{{ .Data.data.username }}:{{ .Data.data.password }}@db:5432/myapp"
          {{- end -}}
    spec:
      serviceAccountName: myapp-sa
      containers:
        - name: app
          image: myapp:latest
          command: ["/bin/sh", "-c"]
          args:
            - source /vault/secrets/db-creds && exec node dist/index.js
```

---

## 6. Runtime Security

### 6.1 Anomaly Detection with Falco

```yaml
# Install Falco (Helm)
# helm install falco falcosecurity/falco -n falco --create-namespace

# falco-rules.yaml (custom rules)
- rule: Container Shell Spawned
  desc: A shell was launched inside a container
  condition: >
    spawned_process and
    container and
    proc.name in (bash, sh, zsh, ash) and
    not container.image.repository in (allowed_shell_images)
  output: >
    Shell spawned in container
    (user=%user.name container=%container.name
     image=%container.image.repository cmd=%proc.cmdline)
  priority: WARNING
  tags: [container, shell]

- rule: Sensitive File Access
  desc: Detect access to sensitive files
  condition: >
    open_read and
    container and
    fd.name in (/etc/shadow, /etc/passwd, /etc/sudoers)
  output: >
    Sensitive file accessed in container
    (user=%user.name file=%fd.name container=%container.name)
  priority: CRITICAL
  tags: [container, filesystem]

- rule: Outbound Connection to Suspicious Port
  desc: Outbound connection to a suspicious port
  condition: >
    outbound and
    container and
    not fd.sport in (80, 443, 53, 5432, 6379, 9092) and
    not container.image.repository in (allowed_outbound_images)
  output: >
    Unexpected outbound connection
    (user=%user.name container=%container.name
     connection=%fd.name port=%fd.sport)
  priority: WARNING
  tags: [container, network]

- rule: Package Manager Execution
  desc: A package manager was executed inside a container
  condition: >
    spawned_process and
    container and
    proc.name in (apt, apt-get, yum, dnf, apk, pip, npm) and
    not container.image.repository in (allowed_package_install_images)
  output: >
    Package manager executed in container
    (user=%user.name cmd=%proc.cmdline container=%container.name)
  priority: ERROR
  tags: [container, software_mgmt]
```

### 6.2 Falco and Slack Integration (Alert Notifications)

```yaml
# falco-values.yaml (Helm)
falcosidekick:
  enabled: true
  config:
    slack:
      webhookurl: "https://hooks.slack.com/services/T00000/B00000/XXXXXX"
      channel: "#security-alerts"
      minimumpriority: "warning"
      messageformat: |
        *Priority:* {{ .Priority }}
        *Rule:* {{ .Rule }}
        *Output:* {{ .Output }}
        *Time:* {{ .Time }}
```

### 6.3 Policy Enforcement with OPA/Gatekeeper

```yaml
# Install Gatekeeper
# helm install gatekeeper gatekeeper/gatekeeper -n gatekeeper-system --create-namespace

# ConstraintTemplate: Containers must not run as root
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequirenonrootuser
spec:
  crd:
    spec:
      names:
        kind: K8sRequireNonRootUser
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package requirenonrootuser

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.securityContext.runAsNonRoot
          msg := sprintf("Container '%v' must set securityContext.runAsNonRoot to true", [container.name])
        }

        violation[{"msg": msg}] {
          input.review.object.spec.securityContext.runAsUser == 0
          msg := "Pod must not run as root (UID 0)"
        }

---
# Constraint: Apply
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequireNonRootUser
metadata:
  name: require-non-root
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces: ["production", "staging"]
  parameters: {}
```

```yaml
# ConstraintTemplate: Require resource limits
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequireresourcelimits
spec:
  crd:
    spec:
      names:
        kind: K8sRequireResourceLimits
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package requireresourcelimits

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.cpu
          msg := sprintf("Container '%v' must set resources.limits.cpu", [container.name])
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.memory
          msg := sprintf("Container '%v' must set resources.limits.memory", [container.name])
        }

---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequireResourceLimits
metadata:
  name: require-resource-limits
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces: ["production"]
```

### 6.4 Policy Enforcement with Kyverno

```yaml
# Kyverno policy: enforce non-root execution
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-run-as-non-root
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: check-containers
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - production
                - staging
      validate:
        message: "Containers must run as non-root"
        pattern:
          spec:
            containers:
              - securityContext:
                  runAsNonRoot: true
                  allowPrivilegeEscalation: false

---
# Kyverno policy: disallow latest tag
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-latest-tag
spec:
  validationFailureAction: Enforce
  rules:
    - name: validate-image-tag
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Image tag 'latest' is not allowed. Use a specific version tag."
        pattern:
          spec:
            containers:
              - image: "!*:latest"
```

---

## 7. Security Scan Automation Flow

```
+------------------------------------------------------------------+
|              Security Scan Automation Flow                        |
+------------------------------------------------------------------+
|                                                                  |
|  [Developer]                                                     |
|     | git push                                                   |
|     v                                                            |
|  [CI/CD]                                                         |
|     |                                                            |
|     +-- (1) Dockerfile Lint (hadolint)                           |
|     |     -> Detect Dockerfile best practice violations          |
|     |                                                            |
|     +-- (2) Dependency scan (npm audit / Trivy fs)               |
|     |     -> Detect known vulnerabilities in packages            |
|     |                                                            |
|     +-- (3) Secret scan (Trivy / gitleaks)                       |
|     |     -> Detect hardcoded credentials                        |
|     |                                                            |
|     +-- (4) IaC scan (Trivy config / tfsec)                      |
|     |     -> Detect misconfigurations in Kubernetes YAML / Terraform |
|     |                                                            |
|     +-- (5) Image build                                          |
|     |                                                            |
|     +-- (6) Image scan (Trivy image)                             |
|     |     -> CRITICAL/HIGH -> build fails                        |
|     |                                                            |
|     +-- (7) SBOM generation                                      |
|     |                                                            |
|     +-- (8) Image signing (cosign)                               |
|     |                                                            |
|     +-- (9) Push to registry                                     |
|     |                                                            |
|     +-- (10) At deploy time: Admission Controller verifies signing |
|                                                                  |
+------------------------------------------------------------------+
```

### 7.1 Secret Detection with gitleaks

```bash
# Install gitleaks
brew install gitleaks

# Repository scan
gitleaks detect --source . --verbose

# Scan entire Git history
gitleaks detect --source . --log-opts="--all"

# Configure as pre-commit hook
gitleaks protect --staged
```

```yaml
# .gitleaks.toml (configuration file)
[allowlist]
  description = "Allowlisted files and patterns"
  paths = [
    '''\.gitleaks\.toml''',
    '''tests/fixtures/''',
    '''\.trivyignore''',
  ]

  id = "custom-api-key"
  description = "Custom API Key Pattern"
  regex = '''(?i)api[_-]?key\s*[=:]\s*'"['"']'''
  tags = ["key", "api"]
```

---

## Anti-patterns

### Anti-pattern 1: Running containers as the root user

```dockerfile
# BAD: Running as root (default)
FROM node:20-alpine
WORKDIR /app
COPY . .
CMD ["node", "index.js"]
# -> Root privileges inside the container. If a vulnerability is exploited,
#    the attacker risks accessing the host filesystem.

# GOOD: Run as non-root user
FROM node:20-alpine
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
WORKDIR /app
COPY --chown=appuser:appgroup . .
USER appuser
CMD ["node", "index.js"]
```

**Problem**: Running a container as root means that if a container escape vulnerability (e.g., CVE-2024-21626) is exploited, the attacker can gain root access to the host. Simply running as a non-root user dramatically reduces the impact of an attack.

### Anti-pattern 2: Not using multi-stage builds

```dockerfile
# BAD: Single stage (build tools + source code remain in the production image)
FROM node:20
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["node", "dist/index.js"]
# -> gcc, make, python, .git, src/ all remain (wide attack surface)

# GOOD: Minimize production image with multi-stage build
FROM node:20 AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build && npm prune --production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]
```

**Problem**: Including build tools (gcc, make), source code, and test files in the production image unnecessarily widens the vulnerability attack surface. Use multi-stage builds to copy only the files needed for execution into the final image.

### Anti-pattern 3: Not dropping capabilities

```yaml
# BAD: Running with default capabilities
spec:
  containers:
    - name: app
      image: myapp:latest
      # No securityContext -> 14 capabilities are granted

# GOOD: Drop all and add only the minimum required
spec:
  containers:
    - name: app
      image: myapp:latest
      securityContext:
        capabilities:
          drop: ["ALL"]
          add: ["NET_BIND_SERVICE"]  # Only when using port 80
```

**Problem**: Docker grants 14 Linux capabilities to containers by default. Many of these, such as NET_RAW (packet spoofing) and SYS_CHROOT (chroot escape), are unnecessary for most applications. Use `drop: ALL` to remove all capabilities and explicitly add only what is needed.

### Anti-pattern 4: Not disabling automountServiceAccountToken

```yaml
# BAD: SA token is automatically mounted (default)
spec:
  containers:
    - name: app
      image: myapp:latest
      # A token exists at /var/run/secrets/kubernetes.io/serviceaccount/token
      # -> If the container is compromised, the attacker can access the Kubernetes API

# GOOD: Disable automatic mounting when not needed
spec:
  automountServiceAccountToken: false
  containers:
    - name: app
      image: myapp:latest
```

**Problem**: When the ServiceAccount token is automatically mounted, an attacker can access the Kubernetes API if the container is compromised. For applications that do not need to communicate with the Kubernetes API, always set `automountServiceAccountToken: false`.


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## FAQ

### Q1: A CRITICAL was found in the Trivy scan results but I can't fix it immediately. What should I do?

**A**: (1) Add the CVE ID to the `.trivyignore` file to temporarily skip it, and create a ticket to track it. (2) Update the base image to check if a fixed version is included. (3) Verify whether the affected package is actually used by the app (reachability analysis). Using Trivy's `--ignore-unfixed` option to exclude vulnerabilities without a released fix is also effective. The important thing is not to "ignore" but to "track."

### Q2: The Distroless image has no shell. How should I debug it?

**A**: (1) The `gcr.io/distroless/base-debian12:debug` tag includes a shell (busybox). Use the debug tag in staging environments and the normal tag in production. (2) In Kubernetes, you can attach an ephemeral container with `kubectl debug`. (3) Instead of `docker exec`, use `docker cp` to extract files for inspection. Excluding debugging tools in production is important for security.

### Q3: What should I do about apps that don't work with a read-only filesystem?

**A**: Many applications need to write to `/tmp` or specific directories. Use `tmpfs` to make only the required paths writable. For Node.js, mount `/tmp` and `/app/.cache` as tmpfs; for Python, `/tmp` and `__pycache__`; for Nginx, `/var/cache/nginx` and `/var/run`. To identify which paths need to be writable, search for `EROFS (Read-only file system)` in `strace` output or application error logs.

### Q4: After applying Pod Security Standards at the Restricted level, some existing Pods stopped starting. How do I migrate incrementally?

**A**: A phased approach is recommended. (1) First apply Restricted in `audit` mode to identify non-compliant Pods (`kubectl get events --field-selector reason=FailedCreate`). (2) Fix the security context of each Pod. (3) Switch to `warn` mode and test. (4) Once all Pods comply, switch to `enforce` mode. Rather than applying to all Namespaces at once, proceed one Namespace at a time.

### Q5: There are too many Falco alerts to handle. How do I tune them?

**A**: (1) Identify false positives caused by legitimate operations and add them to the allowlist using `exceptions`. (2) Adjust the priority so that only truly important alerts are notified. (3) For periodic alerts from CronJobs or batch processes, exclude the target containers or images from the `condition`. (4) Use falcosidekick to set `minimumpriority` so that only WARNING and above are notified. It is effective to start with a small number of rules and gradually add more as they fit your environment.

### Q6: Is it necessary to periodically re-run security scans on container images?

**A**: Yes, it is essential. New CVEs are discovered every day. Even images that passed a scan at build time may have vulnerabilities discovered later. The recommendation is: (1) scanning at build time (CI/CD gate), (2) periodic scans (daily) of deployed images, and (3) emergency scans when a new CRITICAL CVE is published. Saving an SBOM allows you to assess the vulnerability impact without re-pulling the image.

---

## Summary

| Item | Key Points |
|------|------|
| Image scanning | Integrate Trivy into CI/CD. Auto-block on CRITICAL/HIGH |
| Dockerfile lint | Detect best practice violations early with hadolint |
| Base image | Choose alpine / distroless / scratch / chainguard depending on the use case |
| Multi-stage | Exclude build tools and source code from the production image |
| Non-root execution | Specify a non-root user with `USER`. Use UID 1001+ |
| Read-only | Minimize writes with `read_only: true` + `tmpfs` |
| Capabilities | `cap_drop: ALL` + minimal `cap_add` |
| Pod Security | Apply Restricted level to production Namespaces |
| RBAC | Configure least-privilege ServiceAccount + Role |
| Secrets | BuildKit secret mount / Docker Secrets / External Secrets |
| Runtime monitoring | Detect runtime anomalies with Falco. Integrate with alerting |
| Policy enforcement | Admission Control with OPA Gatekeeper / Kyverno |
| Secret detection | Detect secrets in Git history with gitleaks |

## What to Read Next

- [Supply Chain Security](./01-supply-chain-security.md) -- Image signing (cosign) and SBOM
- [Kubernetes Advanced](../05-orchestration/02-kubernetes-advanced.md) -- Pod Security Standards and Network Policy
- Docker Compose Advanced -- Compose configurations including security settings

## References

1. **Trivy Official Documentation** -- https://aquasecurity.github.io/trivy/ -- Complete guide to Trivy installation, configuration, and CI integration
2. **Docker Security Best Practices** -- https://docs.docker.com/build/building/best-practices/ -- Secure Dockerfile writing recommended by Docker officially
3. **CIS Docker Benchmark** -- https://www.cisecurity.org/benchmark/docker -- Industry-standard benchmark for Docker security
4. **NIST SP 800-190** -- https://csrc.nist.gov/publications/detail/sp/800-190/final -- NIST guidelines on container security
5. **Falco Official Documentation** -- https://falco.org/docs/ -- Container runtime security monitoring tool
6. **Pod Security Standards** -- https://kubernetes.io/docs/concepts/security/pod-security-standards/ -- Official Kubernetes Pod security standards
7. **OPA Gatekeeper** -- https://open-policy-agent.github.io/gatekeeper/ -- Kubernetes policy engine
8. **Kyverno** -- https://kyverno.io/docs/ -- Kubernetes-native policy management
