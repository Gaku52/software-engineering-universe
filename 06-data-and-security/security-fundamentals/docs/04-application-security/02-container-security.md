# Container Security

> A comprehensive guide to protecting containerized applications: scanning container images, runtime protection with least privilege, writing secure Dockerfiles, and Kubernetes security policies

## What You Will Learn

1. **Container Threat Model** — Attack surface classification, container escape mechanisms, supply chain attacks
2. **Image Security** — Base image selection criteria, multi-stage builds, vulnerability scanning, SBOM generation
3. **Runtime Protection** — Linux namespaces/cgroups, seccomp, AppArmor, non-root execution, read-only filesystems
4. **Orchestration Security** — Kubernetes SecurityContext, Pod Security Standards, NetworkPolicy, RBAC
5. **Image Signing and Verification** — cosign, Sigstore, admission control with Kyverno/OPA Gatekeeper
6. **Runtime Security Monitoring** — Anomaly detection and incident response with Falco and Tetragon

### Prerequisites

- Basic Linux operations (filesystem, processes, networking)
- Basic Docker operations (build, run, pull, push)
- Basic Kubernetes concepts (Pod, Deployment, Service, Namespace)
- Reading and writing YAML/JSON

---

## 1. Container Threat Model

### Container Architecture and Security Boundaries

```
+----------------------------------------------------------------+
|                    Host OS (Linux Kernel)                       |
|  +----------------------------------------------------------+  |
|  |                  Container Runtime                          |  |
|  |  (containerd / CRI-O)                                     |  |
|  |                                                           |  |
|  |  +----------------+  +----------------+  +-------------+  |  |
|  |  | Container A    |  | Container B    |  | Container C |  |  |
|  |  |                |  |                |  |             |  |  |
|  |  | [App Process]  |  | [App Process]  |  | [App]       |  |  |
|  |  |                |  |                |  |             |  |  |
|  |  | Namespaces:    |  | Namespaces:    |  | Namespaces: |  |  |
|  |  |  - PID         |  |  - PID         |  |  - PID      |  |  |
|  |  |  - NET         |  |  - NET         |  |  - NET      |  |  |
|  |  |  - MNT         |  |  - MNT         |  |  - MNT      |  |  |
|  |  |  - UTS         |  |  - UTS         |  |  - UTS      |  |  |
|  |  |  - IPC         |  |  - IPC         |  |  - IPC      |  |  |
|  |  |  - USER        |  |  - USER        |  |  - USER     |  |  |
|  |  |                |  |                |  |             |  |  |
|  |  | cgroups:       |  | cgroups:       |  | cgroups:    |  |  |
|  |  |  CPU/Mem/IO    |  |  CPU/Mem/IO    |  |  CPU/Mem/IO |  |  |
|  |  +----------------+  +----------------+  +-------------+  |  |
|  +----------------------------------------------------------+  |
|                                                                 |
|  Shared: kernel, /proc, /sys, some devices                     |
+----------------------------------------------------------------+
```

**Key Understanding**: Unlike virtual machines, containers share the kernel. This shared kernel is an attack surface, making container escapes via kernel vulnerabilities possible.

### Isolation Level Comparison: VMs vs Containers

```
Isolation Level Comparison:

Virtual Machine (VM):
+------------------+  +------------------+
|  Guest OS        |  |  Guest OS        |
|  (own kernel)    |  |  (own kernel)    |
+------------------+  +------------------+
+--------------------------------------+
|        Hypervisor (Type 1/2)         |
+--------------------------------------+
|            Host OS / HW              |
+--------------------------------------+
→ Hardware-level isolation (strong)

Container:
+----------+  +----------+  +----------+
| App A    |  | App B    |  | App C    |
| (ns/cg)  |  | (ns/cg)  |  | (ns/cg)  |
+----------+  +----------+  +----------+
+--------------------------------------+
|        Shared Kernel (Linux)         |
+--------------------------------------+
|            Host OS / HW              |
+--------------------------------------+
→ Process-level isolation (weaker)

gVisor / Kata Containers:
+----------+  +----------+
| App A    |  | App B    |
+----------+  +----------+
+----------+  +----------+
| gVisor   |  | microVM  |
| (Sentry) |  | (QEMU)  |
+----------+  +----------+
+--------------------------------------+
|            Host OS / HW              |
+--------------------------------------+
→ Intermediate isolation (hardened)
```

### Attack Surface Classification

```
+----------------------------------------------------------+
|                Container Attack Surface                    |
|----------------------------------------------------------|
|                                                          |
|  [Image Layer]                                           |
|  +-- Base image vulnerabilities (CVE)                    |
|  +-- App dependency library vulnerabilities              |
|  +-- Embedded secrets (ENV, COPY)                        |
|  +-- Unnecessary packages (potential attack tools)       |
|  +-- Presence of SETUID/SETGID binaries                  |
|                                                          |
|  [Build Layer]                                           |
|  +-- Pull from untrusted registries                      |
|  +-- Tag mutability (overwriting latest)                 |
|  +-- CI/CD pipeline compromise                           |
|  +-- Build cache poisoning                               |
|  +-- Multi-architecture image substitution               |
|                                                          |
|  [Runtime Layer]                                         |
|  +-- Privilege escalation via root execution             |
|  +-- Container escape (kernel exploit)                   |
|  +-- Excessive Linux capabilities                        |
|  +-- Host path mounts (/var/run/docker.sock)             |
|  +-- Privileged containers (--privileged)                |
|  +-- PID 1 signal handling issues                        |
|                                                          |
|  [Network Layer]                                         |
|  +-- Unrestricted inter-container communication          |
|  +-- Unauthorized metadata API access (169.254.169.254)  |
|  +-- DNS spoofing (between Pods)                         |
|  +-- Service mesh bypass                                 |
|                                                          |
|  [Orchestration Layer]                                   |
|  +-- Unauthorized etcd access                            |
|  +-- Excessive RBAC permissions                          |
|  +-- ServiceAccount token abuse                          |
|  +-- Direct kubelet API access                           |
+----------------------------------------------------------+
```

### Main Container Escape Techniques

```
Container Escape Attack Paths:

1. Kernel vulnerability exploitation:
   Container (root) → kernel exploit → Host root
   Examples: CVE-2022-0185 (Filesystem Context)
             CVE-2024-1086 (nf_tables)

2. Docker Socket mount:
   Container → /var/run/docker.sock → docker run --privileged → Host
   (The danger of Docker-in-Docker)

3. Escape from privileged container:
   Container (--privileged) → mount host / → chroot → Host root

4. Capability abuse:
   Container (CAP_SYS_ADMIN) → mount cgroupfs → release_agent → Host

5. /proc/sys abuse:
   Container → /proc/self/exe → overwrite host binary
   (CVE-2019-5736: runc vulnerability)
```

### Container Escape Detection Code (Go)

```go
// escape_detector.go - コンテナエスケープのリスク要因を検出するツール
package main

import (
    "fmt"
    "os"
    "strings"
    "syscall"
)

type RiskLevel int

const (
    Low RiskLevel = iota
    Medium
    High
    Critical
)

type Finding struct {
    Check    string
    Risk     RiskLevel
    Detail   string
    Remediation string
}

func main() {
    findings := []Finding{}

    // 1. root 実行チェック
    if os.Getuid() == 0 {
        findings = append(findings, Finding{
            Check:  "Running as root",
            Risk:   High,
            Detail: fmt.Sprintf("UID=%d, GID=%d", os.Getuid(), os.Getgid()),
            Remediation: "USER ディレクティブで非 root ユーザを指定する",
        })
    }

    // 2. 特権モードチェック
    if isPrivileged() {
        findings = append(findings, Finding{
            Check:  "Privileged container",
            Risk:   Critical,
            Detail: "コンテナが特権モードで実行されている",
            Remediation: "--privileged フラグを削除する",
        })
    }

    // 3. Docker socket マウントチェック
    if _, err := os.Stat("/var/run/docker.sock"); err == nil {
        findings = append(findings, Finding{
            Check:  "Docker socket mounted",
            Risk:   Critical,
            Detail: "/var/run/docker.sock がマウントされている",
            Remediation: "Docker socket のマウントを削除する",
        })
    }

    // 4. 書き込み可能なルートファイルシステム
    if isWritableRootFS() {
        findings = append(findings, Finding{
            Check:  "Writable root filesystem",
            Risk:   Medium,
            Detail: "ルートファイルシステムが書き込み可能",
            Remediation: "readOnlyRootFilesystem: true を設定する",
        })
    }

    // 5. capabilities チェック
    caps := getEffectiveCaps()
    dangerousCaps := []string{
        "CAP_SYS_ADMIN", "CAP_SYS_PTRACE", "CAP_SYS_MODULE",
        "CAP_DAC_OVERRIDE", "CAP_NET_RAW",
    }
    for _, cap := range dangerousCaps {
        if strings.Contains(caps, cap) {
            findings = append(findings, Finding{
                Check:  fmt.Sprintf("Dangerous capability: %s", cap),
                Risk:   High,
                Detail: fmt.Sprintf("capability %s が有効", cap),
                Remediation: "capabilities を drop ALL + 必要なもののみ add する",
            })
        }
    }

    // 6. ホストネットワークチェック
    if isHostNetwork() {
        findings = append(findings, Finding{
            Check:  "Host network mode",
            Risk:   High,
            Detail: "ホストネットワーク名前空間を共有している",
            Remediation: "hostNetwork: false に設定する",
        })
    }

    // 結果出力
    printFindings(findings)
}

func isPrivileged() bool {
    // /proc/self/status の CapEff を確認
    data, err := os.ReadFile("/proc/self/status")
    if err != nil {
        return false
    }
    for _, line := range strings.Split(string(data), "\n") {
        if strings.HasPrefix(line, "CapEff:") {
            capHex := strings.TrimSpace(strings.TrimPrefix(line, "CapEff:"))
            // 全ビットが立っている = 特権
            return capHex == "000001ffffffffff" || capHex == "0000003fffffffff"
        }
    }
    return false
}

func isWritableRootFS() bool {
    testFile := "/.rootfs_write_test"
    f, err := os.Create(testFile)
    if err != nil {
        return false
    }
    f.Close()
    os.Remove(testFile)
    return true
}

func getEffectiveCaps() string {
    data, err := os.ReadFile("/proc/self/status")
    if err != nil {
        return ""
    }
    for _, line := range strings.Split(string(data), "\n") {
        if strings.HasPrefix(line, "CapEff:") {
            return strings.TrimSpace(strings.TrimPrefix(line, "CapEff:"))
        }
    }
    return ""
}

func isHostNetwork() bool {
    var stat syscall.Stat_t
    // ホストとコンテナの network namespace を比較
    err := syscall.Stat("/proc/1/ns/net", &stat)
    if err != nil {
        return false
    }
    hostIno := stat.Ino

    err = syscall.Stat("/proc/self/ns/net", &stat)
    if err != nil {
        return false
    }
    selfIno := stat.Ino

    return hostIno == selfIno
}

func printFindings(findings []Finding) {
    riskLabels := map[RiskLevel]string{
        Low: "LOW", Medium: "MEDIUM", High: "HIGH", Critical: "CRITICAL",
    }

    fmt.Println("=== Container Security Assessment ===")
    fmt.Printf("Total findings: %d\n\n", len(findings))

    for i, f := range findings {
        fmt.Printf("[%d] %s (%s)\n", i+1, f.Check, riskLabels[f.Risk])
        fmt.Printf("    Detail: %s\n", f.Detail)
        fmt.Printf("    Fix: %s\n\n", f.Remediation)
    }
}
```

---

## 2. Secure Dockerfile

### Best Practice Dockerfile (Node.js)

```dockerfile
# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

# Work as non-root user
WORKDIR /app

# Install dependencies first (leverage cache)
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    # Remove npm cache to reduce image size
    npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# ---- Stage 2: Production image ----
FROM node:20-alpine AS production

# Metadata (OCI Image Spec)
LABEL org.opencontainers.image.title="myapp" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Example Corp"

# Apply security updates
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache dumb-init && \
    # Remove SUID/SGID bits
    find / -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup -h /app -s /sbin/nologin

WORKDIR /app

# Copy only build artifacts (source code not needed)
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use dumb-init as PID 1 to forward signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### PID 1 Problem Explained

```
PID 1 Problem:

Standard Linux:
  PID 1 (init/systemd) → signal handling + zombie reaping
    └── PID 100 (app) → graceful shutdown on SIGTERM

Container (problematic):
  PID 1 (node server.js) → ignores signals by default!
    ├── SIGTERM → ignored → docker stop waits 10s then sends SIGKILL
    └── Zombie processes are not reaped

Container (solved with dumb-init):
  PID 1 (dumb-init) → properly forwards signals + reaps zombies
    └── PID 2 (node server.js) → receives SIGTERM and shuts down gracefully

Alternatives:
  - tini (Docker official recommendation): docker run --init
  - Node.js: implement process.on('SIGTERM', ...)
```

### .dockerignore Configuration

```
# .dockerignore - Files to exclude from build context
.git
.gitignore
.env
.env.*
node_modules
npm-debug.log
Dockerfile
docker-compose*.yml
.dockerignore
README.md
LICENSE
.vscode
.idea
*.test.js
*.spec.js
__tests__
coverage
.github
.gitlab-ci.yml
Jenkinsfile
*.md
docs/
# Secret-related
*.pem
*.key
*.crt
credentials.json
secrets/
```

### Base Image Selection

| Base Image | Size | Package Count | Shell | Vulnerability Risk | Use Case |
|--------------|--------|------------|-------|------------|------|
| ubuntu:24.04 | ~77MB | Many (~90) | bash | Medium | Development/debugging |
| debian:bookworm-slim | ~80MB | Moderate (~70) | bash | Medium | General use, compatibility |
| alpine:3.19 | ~7MB | Minimal (~15) | sh | Low | Recommended for production |
| distroless/base | ~20MB | None (libc only) | None | Very low | Strongly recommended for production |
| distroless/static | ~2MB | None | None | Very low | Static binaries |
| scratch | 0MB | None | None | None | Go/Rust static binaries |
| chainguard/images | ~10-30MB | Minimal | None | Very low | FIPS-compliant environments |

### Alpine musl libc Issues

```
Alpine uses musl libc, which can cause issues with glibc-dependent binaries:

glibc (debian/ubuntu):
  - DNS resolution: full implementation of /etc/nsswitch.conf, getaddrinfo()
  - locale: full locale support
  - threads: NPTL (mature implementation)

musl libc (Alpine):
  - DNS resolution: /etc/resolv.conf only, issues with some name resolutions
  - locale: UTF-8 only
  - threads: custom implementation (performance issues in some apps)
  - malloc: potential performance degradation with large memory allocations

Mitigations:
  1. Add glibc compatibility layer with alpine + gcompat package
  2. Switch to debian-slim base
  3. Perform load testing in production environment to verify
```

### Using distroless Images (Go)

```dockerfile
# Go アプリケーション用 distroless
FROM golang:1.22 AS builder

WORKDIR /app

# 依存関係を先にダウンロード
COPY go.mod go.sum ./
RUN go mod download

# ソースコードをコピーしてビルド
COPY . .

# 静的リンク + セキュリティフラグ付きビルド
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s -X main.version=$(git describe --tags)" \
    -trimpath -o /server .

# distroless nonroot イメージ
FROM gcr.io/distroless/static-debian12:nonroot

# メタデータ
LABEL org.opencontainers.image.source="https://github.com/example/myapp"

# ビルド成果物のみコピー
COPY --from=builder /server /server

# CA 証明書が必要な場合 (HTTPS 通信用)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# nonroot ユーザで実行 (UID 65534)
USER nonroot:nonroot

ENTRYPOINT ["/server"]
```

### Multi-Stage Build Pattern Comparison

```
Pattern 1: Basic (2 stages)
  builder → production
  Use case: Standard web application

Pattern 2: With tests (3 stages)
  builder → tester → production
  Use case: Include test results in image for CI/CD

Pattern 3: Dev/prod split
  base → dev (with debug tools)
       → prod (minimal image)
  Use case: Switch target in docker compose

Pattern 4: With security scanning (4 stages)
  builder → scanner (Trivy) → signer (cosign) → production
  Use case: Security-critical environments
```

### Dockerfile Security Checklist

```
+-------+------------------------------------------+----------+
| No.   | Check Item                               | Priority |
+-------+------------------------------------------+----------+
| D-01  | Non-root user specified with USER         | Required |
| D-02  | Multi-stage build used                    | Required |
| D-03  | Base image with fixed version + digest    | Required |
| D-04  | Correct owner set with COPY --chown       | Required |
| D-05  | Secrets excluded with .dockerignore       | Required |
| D-06  | HEALTHCHECK configured                    | Recommended |
| D-07  | Metadata added with LABEL                 | Recommended |
| D-08  | apt/apk cache cleared in RUN              | Recommended |
| D-09  | SUID/SGID bits removed                    | Recommended |
| D-10  | Init process used in ENTRYPOINT           | Recommended |
| D-11  | COPY used instead of ADD                  | Recommended |
| D-12  | No secrets set in ENV                     | Required |
+-------+------------------------------------------+----------+
```

---

## 3. Image Scanning

### Scanning with Trivy

```bash
# イメージの脆弱性スキャン
trivy image --severity HIGH,CRITICAL myapp:latest

# 出力例:
# myapp:latest (alpine 3.19.0)
# ============================
# Total: 3 (HIGH: 2, CRITICAL: 1)
#
# +----------+---------------+----------+-------------------+
# | Library  | Vulnerability | Severity | Fixed Version     |
# +----------+---------------+----------+-------------------+
# | libcurl  | CVE-2024-XXX  | CRITICAL | 8.5.0-r1          |
# | openssl  | CVE-2024-YYY  | HIGH     | 3.1.4-r3          |
# +----------+---------------+----------+-------------------+

# OS パッケージ + 言語パッケージの両方をスキャン
trivy image --scanners vuln myapp:latest

# シークレット検知
trivy image --scanners secret myapp:latest

# ライセンスチェック
trivy image --scanners license --severity HIGH myapp:latest

# Dockerfile のベストプラクティスチェック
trivy config Dockerfile

# SBOM 生成 (CycloneDX 形式)
trivy image --format cyclonedx --output sbom.json myapp:latest

# SBOM 生成 (SPDX 形式)
trivy image --format spdx-json --output sbom.spdx.json myapp:latest

# CI/CD での自動ゲート (CRITICAL があれば exit code 1)
trivy image --exit-code 1 --severity CRITICAL myapp:latest

# JSON 出力 (パイプライン統合向け)
trivy image --format json --output results.json myapp:latest

# SARIF 出力 (GitHub Security タブ連携)
trivy image --format sarif --output results.sarif myapp:latest
```

### Image Scanning Tool Comparison

| Tool | Target | DB Updates | SBOM | Secret Detection | License | Speed |
|--------|------|---------|------|----------------|----------|------|
| Trivy | OS+Lang+IaC | Auto (OCI) | CycloneDX/SPDX | Yes | Yes | Fast |
| Grype | OS+Lang | Auto | SPDX (Syft) | No | No | Fast |
| Snyk Container | OS+Lang | SaaS | Yes | Yes | Yes | Medium |
| Clair | OS only | Auto | No | No | No | Medium |
| Docker Scout | OS+Lang | SaaS | Yes | No | Yes | Fast |

### Image Linting with Dockle

```bash
# Dockle: CIS Docker Benchmark に基づくイメージ検査
dockle myapp:latest

# 検出例:
# WARN  - CIS-DI-0001: Create a user for the container
# WARN  - CIS-DI-0005: Enable Content trust for Docker
# WARN  - CIS-DI-0006: Add HEALTHCHECK instruction to the container image
# PASS  - CIS-DI-0008: Confirm safety of setuid/setgid files
# INFO  - CIS-DI-0009: Use COPY instead of ADD in Dockerfile
```

### Image Scanning Pipeline in CI/CD

```yaml
# GitHub Actions - 包括的なコンテナセキュリティパイプライン
name: Container Security
on:
  push:
    branches: [main]
  pull_request:
    paths: ['Dockerfile', 'src/**', 'package*.json']

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write  # SARIF アップロード用
      contents: read

    steps:
      - uses: actions/checkout@v4

      # Hadolint: Dockerfile リンター
      - name: Hadolint
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          failure-threshold: warning

      # イメージビルド
      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .

      # Trivy: 脆弱性スキャン
      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: 1
          format: sarif
          output: trivy-results.sarif

      # Trivy: シークレットスキャン
      - name: Trivy secret scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          scanners: secret
          exit-code: 1

      # Dockle: イメージベストプラクティス
      - name: Dockle lint
        uses: erzz/dockle-action@v1
        with:
          image: myapp:${{ github.sha }}
          exit-code: 1
          exit-level: WARN

      # SBOM 生成
      - name: Generate SBOM
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          format: cyclonedx
          output: sbom.json

      # SARIF を GitHub Security タブにアップロード
      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-results.sarif

      # SBOM をアーティファクトとして保存
      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.json
```

### Importance of SBOM (Software Bill of Materials)

```
SBOM Structure:

+--------------------------------------------------+
|  Container Image: myapp:v1.0.0                    |
|  ├── OS: Alpine Linux 3.19.0                     |
|  │   ├── musl 1.2.4-r2                          |
|  │   ├── openssl 3.1.4-r1                       |
|  │   ├── zlib 1.3-r2                            |
|  │   └── ... (15 packages)                      |
|  │                                               |
|  ├── Runtime: Node.js 20.11.0                    |
|  │                                               |
|  └── App Dependencies:                           |
|      ├── express 4.18.2                          |
|      ├── helmet 7.1.0                            |
|      ├── jsonwebtoken 9.0.2                      |
|      ├── pg 8.11.3                               |
|      └── ... (142 packages)                      |
+--------------------------------------------------+

Use Cases:
  1. Vulnerability management: Instantly identify impact scope when a new CVE is published
  2. License compliance: Detect license violations such as GPL
  3. Supply chain: Ensure dependency transparency
  4. Incident response: Quickly identify affected containers

Formats:
  - CycloneDX (OWASP recommended): JSON/XML
  - SPDX (Linux Foundation): JSON/RDF/Tag-Value
  - Syft JSON (Anchore proprietary)
```

---

## 4. Runtime Protection

### Linux Security Modules Relationship

```
Application
    |
    v
+--------------------+
| System Call        |
| (open, read, etc.) |
+--------------------+
    |
    v
+--------------------+
| LSM Hook           |  ← AppArmor / SELinux decisions happen here
+--------------------+
    |
    v
+--------------------+
| seccomp-BPF        |  ← Per-system-call filtering
+--------------------+
    |
    v
+--------------------+
| Linux Kernel       |
+--------------------+

Combined:
  seccomp = "Which system calls to allow"
  AppArmor = "Which file/network operations to allow"
  SELinux = "Which access to which objects to allow"
```

### Docker Security Options

```bash
# セキュアなコンテナ実行 (全オプション解説付き)
docker run \
  --user 1001:1001 \                    # 非 root ユーザで実行
  --read-only \                         # ファイルシステム読取専用
  --tmpfs /tmp:noexec,nosuid,size=64m \ # tmp は tmpfs (実行不可, SUID不可)
  --cap-drop ALL \                      # 全 capability を削除
  --cap-add NET_BIND_SERVICE \          # 必要な capability のみ追加
  --security-opt no-new-privileges \    # 権限昇格禁止 (SUID 無効化)
  --security-opt seccomp=default.json \ # seccomp プロファイル適用
  --security-opt apparmor=docker-default \ # AppArmor プロファイル
  --memory 512m \                       # メモリ上限
  --memory-swap 512m \                  # スワップ禁止 (メモリと同値)
  --cpus 1.0 \                          # CPU 上限
  --pids-limit 100 \                    # プロセス数制限 (fork bomb 防止)
  --network app-network \               # 専用ネットワーク
  --dns 8.8.8.8 \                       # DNS サーバ指定
  --restart on-failure:3 \              # 再起動ポリシー
  --health-cmd "curl -f http://localhost:3000/health" \
  --health-interval 30s \
  --health-retries 3 \
  myapp:v1.0.0@sha256:abc123...         # ダイジェスト固定
```

### Linux Capabilities in Detail

```
+---------------------------+----------+------------------------------------------+
| Capability                | Risk     | Description                              |
+---------------------------+----------+------------------------------------------+
| CAP_SYS_ADMIN            | Highest  | mount, namespace, many privileged ops    |
| CAP_SYS_PTRACE           | Highest  | Debug/read memory of other processes     |
| CAP_SYS_MODULE           | Highest  | Load kernel modules                      |
| CAP_NET_ADMIN            | High     | Network config changes, iptables         |
| CAP_NET_RAW              | High     | RAW sockets (ARP spoofing, etc.)         |
| CAP_DAC_OVERRIDE         | High     | Bypass file permission checks            |
| CAP_SETUID               | High     | Change UID (privilege escalation)        |
| CAP_SETGID               | High     | Change GID                               |
| CAP_CHOWN                | Medium   | Change file ownership                    |
| CAP_KILL                 | Medium   | Send signals to arbitrary processes      |
| CAP_NET_BIND_SERVICE     | Low      | Bind to ports below 1024                 |
| CAP_SETFCAP              | Medium   | Set file capabilities                    |
+---------------------------+----------+------------------------------------------+

Docker Default (14 capabilities):
  CAP_CHOWN, CAP_DAC_OVERRIDE, CAP_FSETID, CAP_FOWNER,
  CAP_MKNOD, CAP_NET_RAW, CAP_SETGID, CAP_SETUID,
  CAP_SETFCAP, CAP_SETPCAP, CAP_NET_BIND_SERVICE,
  CAP_SYS_CHROOT, CAP_KILL, CAP_AUDIT_WRITE

Recommendation: Use --cap-drop ALL and then --cap-add only the required capabilities
```

### Custom seccomp Profile

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "defaultErrnoRet": 1,
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_AARCH64"
  ],
  "syscalls": [
    {
      "names": [
        "accept", "accept4", "access", "bind", "brk",
        "clone", "close", "connect", "dup", "dup2", "dup3",
        "epoll_create", "epoll_create1", "epoll_ctl", "epoll_wait",
        "execve", "exit", "exit_group",
        "fcntl", "fstat", "futex",
        "getdents64", "getpid", "getsockname", "getsockopt",
        "ioctl", "listen", "lseek",
        "mmap", "mprotect", "munmap",
        "nanosleep", "open", "openat",
        "pipe", "pipe2", "poll",
        "read", "readlink", "recvfrom", "recvmsg",
        "rt_sigaction", "rt_sigprocmask", "rt_sigreturn",
        "select", "sendmsg", "sendto", "set_tid_address",
        "setsockopt", "shutdown", "sigaltstack", "socket",
        "stat", "statfs",
        "write", "writev"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "names": [
        "ptrace", "personality", "mount", "umount2",
        "pivot_root", "kexec_load", "init_module",
        "finit_module", "delete_module", "reboot",
        "settimeofday", "stime", "clock_settime"
      ],
      "action": "SCMP_ACT_ERRNO",
      "comment": "危険なシステムコールを明示的にブロック"
    }
  ]
}
```

### Kubernetes SecurityContext

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      # Pod-level security
      securityContext:
        runAsNonRoot: true          # Prohibit root execution
        runAsUser: 1001             # Execution user
        runAsGroup: 1001            # Execution group
        fsGroup: 1001               # Volume ownership group
        fsGroupChangePolicy: OnRootMismatch  # Minimize ownership changes
        seccompProfile:
          type: RuntimeDefault      # Default seccomp profile
        supplementalGroups: [1001]

      containers:
        - name: myapp
          image: myapp:v1.0.0@sha256:abc123def456...  # Pinned digest

          # Container-level security
          securityContext:
            allowPrivilegeEscalation: false  # Prohibit privilege escalation
            readOnlyRootFilesystem: true     # Read-only FS
            privileged: false                # Prohibit privileged mode
            capabilities:
              drop: ["ALL"]                  # Drop all capabilities
              # add: ["NET_BIND_SERVICE"]    # Add only if needed
            seccompProfile:
              type: RuntimeDefault

          # Resource limits (required)
          resources:
            limits:
              memory: "512Mi"
              cpu: "500m"
              ephemeral-storage: "1Gi"
            requests:
              memory: "256Mi"
              cpu: "250m"

          # Health checks
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10

          startupProbe:
            httpGet:
              path: /health
              port: 3000
            failureThreshold: 30
            periodSeconds: 10

          # Port definitions
          ports:
            - containerPort: 3000
              protocol: TCP

          # Environment variables (secrets from Secret resources)
          env:
            - name: NODE_ENV
              value: "production"
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password

          # Volume mounts
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: app-config
              mountPath: /app/config
              readOnly: true

      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 64Mi
        - name: app-config
          configMap:
            name: myapp-config

      # Image pull policy
      imagePullPolicy: Always

      # Disable automatic ServiceAccount token mounting
      automountServiceAccountToken: false

      # Node selection and tolerations
      nodeSelector:
        kubernetes.io/os: linux
```

### Pod Security Standards (PSS)

```
Kubernetes Pod Security - 3 Levels:

+------------------+------------------------------------------+
| Level            | Restrictions                             |
+------------------+------------------------------------------+
| Privileged       | No restrictions (all allowed)            |
|                  | Use case: System components               |
+------------------+------------------------------------------+
| Baseline         | Minimal restrictions                     |
|                  | - hostNetwork/hostPID/hostIPC prohibited  |
|                  | - Privileged containers prohibited        |
|                  | - Dangerous capabilities (SYS_ADMIN, etc.)|
|                  |   prohibited                              |
|                  | - hostPath volumes prohibited             |
|                  | Use case: General workloads               |
+------------------+------------------------------------------+
| Restricted       | Strict restrictions (recommended for     |
|                  | production)                               |
|                  | - All Baseline restrictions +             |
|                  | - runAsNonRoot required                   |
|                  | - allowPrivilegeEscalation: false required|
|                  | - capabilities drop ALL required          |
|                  | - seccomp RuntimeDefault required         |
|                  | Use case: Security-sensitive production   |
+------------------+------------------------------------------+
```

```yaml
# Apply Pod Security Standards to a Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # enforce: Reject Pods that violate the policy
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest

    # audit: Record violations in audit log (creation allowed)
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest

    # warn: Show warning message on violation (creation allowed)
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
```

### Kubernetes NetworkPolicy

```yaml
# Default deny (deny all traffic by default)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}   # Apply to all Pods
  policyTypes:
    - Ingress
    - Egress

---
# Application-specific policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
    - Ingress
    - Egress

  ingress:
    # Accept only HTTPS from the Ingress controller
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
          podSelector:
            matchLabels:
              app.kubernetes.io/name: ingress-nginx
      ports:
        - port: 3000
          protocol: TCP

  egress:
    # Communication to database
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
          protocol: TCP

    # Communication to Redis
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - port: 6379
          protocol: TCP

    # Allow DNS resolution
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP

    # HTTPS communication to external APIs
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 169.254.169.254/32  # Block metadata API
              - 10.0.0.0/8          # Block internal network
      ports:
        - port: 443
          protocol: TCP
```

---

## 5. Image Signing and Verification

### Container Supply Chain Overview

```
Developer     CI/CD            Registry            Deploy Target
  |              |                  |                  |
  | git push     |                  |                  |
  +----------->  |                  |                  |
  |              | docker build     |                  |
  |              +-------+         |                  |
  |              |       |         |                  |
  |              | trivy scan      |                  |
  |              +-------+         |                  |
  |              |       |         |                  |
  |              | cosign sign     |                  |
  |              +-------+         |                  |
  |              |       |         |                  |
  |              | Generate SBOM   |                  |
  |              +-------+         |                  |
  |              |       | push    |                  |
  |              +-------|-------> |                  |
  |              |       |         | pull             |
  |              |       |         +----------------> |
  |              |       |         |                  |
  |              |       |         | cosign verify    |
  |              |       |         | (Admission       |
  |              |       |         |  Controller)     |
  |              |       |         +----------------> |
  |              |       |         |                  | deploy
```

### Image Signing with cosign

```bash
# キーペア生成
cosign generate-key-pair

# イメージに署名
cosign sign --key cosign.key myregistry/myapp:v1.0.0

# 署名の検証
cosign verify --key cosign.pub myregistry/myapp:v1.0.0

# キーレス署名 (Sigstore/Fulcio を使用)
# CI/CD の OIDC トークンを使用して署名
cosign sign --yes myregistry/myapp:v1.0.0
# → Fulcio が一時的な証明書を発行
# → Rekor に署名ログを記録 (透明性ログ)

# キーレス署名の検証
cosign verify \
  --certificate-identity "https://github.com/myorg/myapp/.github/workflows/build.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  myregistry/myapp:v1.0.0

# SBOM をイメージにアタッチ
cosign attach sbom --sbom sbom.json myregistry/myapp:v1.0.0

# アテステーション (ビルド情報の証明)
cosign attest --predicate provenance.json --key cosign.key myregistry/myapp:v1.0.0

# SLSA Provenance の検証
cosign verify-attestation --key cosign.pub --type slsaprovenance myregistry/myapp:v1.0.0
```

### Enforcing Policies with Kyverno

```yaml
# Kyverno: Allow only signed images
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds: ["Pod"]
      verifyImages:
        - imageReferences: ["myregistry/*"]
          attestors:
            - entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
                      -----END PUBLIC KEY-----

    - name: require-digest
      match:
        any:
          - resources:
              kinds: ["Pod"]
      validate:
        message: "Images must be pinned by digest"
        pattern:
          spec:
            containers:
              - image: "*@sha256:*"

    - name: disallow-latest-tag
      match:
        any:
          - resources:
              kinds: ["Pod"]
      validate:
        message: "The latest tag is prohibited"
        pattern:
          spec:
            containers:
              - image: "!*:latest"

---
# Kyverno: Restrict image registries
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: restrict-image-registries
spec:
  validationFailureAction: Enforce
  rules:
    - name: allowed-registries
      match:
        any:
          - resources:
              kinds: ["Pod"]
      validate:
        message: "Only images from allowed registries may be used"
        pattern:
          spec:
            containers:
              - image: "myregistry.azurecr.io/* | gcr.io/my-project/*"
```

### Policy with OPA Gatekeeper

```yaml
# ConstraintTemplate: Allowed registry check
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sallowedregistries
spec:
  crd:
    spec:
      names:
        kind: K8sAllowedRegistries
      validation:
        openAPIV3Schema:
          type: object
          properties:
            registries:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8sallowedregistries

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not startswith(container.image, input.parameters.registries[_])
          msg := sprintf("Image '%v' is not from an allowed registry", [container.image])
        }

---
# Constraint: Apply the template above
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRegistries
metadata:
  name: allowed-registries
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces: ["production"]
  parameters:
    registries:
      - "myregistry.azurecr.io/"
      - "gcr.io/my-project/"
```

---

## 6. Runtime Security Monitoring

### Runtime Detection with Falco

```
Falco Architecture:

+------------------+
| eBPF / kmod      |  ← Monitor system calls at kernel level
+------------------+
        |
        v
+------------------+
| Falco Engine     |  ← Evaluate events against rules
+------------------+
        |
        v
+------------------+
| Output targets:  |
| - stdout/stderr  |
| - Syslog         |
| - HTTP (webhook) |
| - gRPC           |
| - Kafka          |
| - Slack/PagerDuty|
+------------------+
```

```yaml
# Falco custom rules
- rule: Shell spawned in container
  desc: A shell was spawned inside a container
  condition: >
    container and
    spawned_process and
    proc.name in (bash, sh, zsh, dash, ksh) and
    not container.image.repository in (allowed_shell_images)
  output: >
    Shell spawned in container
    (user=%user.name container=%container.name
    image=%container.image.repository
    shell=%proc.name parent=%proc.pname
    cmdline=%proc.cmdline)
  priority: WARNING
  tags: [container, shell, mitre_execution]

- rule: Unexpected outbound connection
  desc: Unexpected outbound network connection from container
  condition: >
    container and
    outbound and
    not fd.sip in (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) and
    not fd.sport in (443, 80, 53) and
    not container.image.repository in (allowed_external_images)
  output: >
    Unexpected outbound connection
    (container=%container.name image=%container.image.repository
    connection=%fd.name)
  priority: NOTICE

- rule: Read sensitive file in container
  desc: A sensitive file was read inside a container
  condition: >
    container and
    open_read and
    fd.name in (/etc/shadow, /etc/passwd, /proc/self/environ) and
    not proc.name in (login, su, sudo)
  output: >
    Sensitive file read in container
    (user=%user.name container=%container.name
    file=%fd.name image=%container.image.repository)
  priority: WARNING

- rule: Crypto mining detected
  desc: Signs of crypto mining activity detected
  condition: >
    container and
    spawned_process and
    (proc.name in (xmrig, minerd, cpuminer) or
     proc.args contains "stratum+tcp" or
     proc.args contains "pool.minexmr")
  output: >
    Crypto mining process detected
    (container=%container.name image=%container.image.repository
    process=%proc.name cmdline=%proc.cmdline)
  priority: CRITICAL
```

### Deploying Falco (Helm)

```bash
# Helm で Falco をインストール
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

helm install falco falcosecurity/falco \
  --namespace falco-system \
  --create-namespace \
  --set falcosidekick.enabled=true \
  --set falcosidekick.config.slack.webhookurl="https://hooks.slack.com/..." \
  --set falcosidekick.config.slack.minimumpriority=warning \
  --set driver.kind=ebpf \
  --set collectors.kubernetes.enabled=true
```

---

## 7. Secret Management

### Secret Management Patterns in Containers

```
Anti-patterns:
  1. Embed secrets in ENV → exposed via docker inspect
  2. COPY secret files into image → persist in layers
  3. Hardcode in docker-compose.yml → leaked to Git

Recommended patterns:
  1. Kubernetes Secrets (Base64 encoded, not encrypted)
     → Minimum. Must enable encryption-at-rest for etcd

  2. External Secrets Operator + Cloud secret management
     → AWS Secrets Manager / GCP Secret Manager / Azure Key Vault

  3. HashiCorp Vault
     → Dynamic secret generation, automatic rotation, audit logs

  4. Sealed Secrets (Bitnami)
     → Encrypted Secrets that can be committed to Git
```

```yaml
# External Secrets Operator の例
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
    - secretKey: password
      remoteRef:
        key: production/db/credentials
        property: password
    - secretKey: username
      remoteRef:
        key: production/db/credentials
        property: username
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Running Containers as Root

```dockerfile
# NG: Running as root (default)
FROM node:20
WORKDIR /app
COPY . .
CMD ["node", "server.js"]  # PID 1 runs as root (UID 0)

# OK: Running as non-root user
FROM node:20-alpine
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup -s /sbin/nologin
WORKDIR /app
COPY --chown=appuser:appgroup . .
USER appuser
CMD ["dumb-init", "node", "server.js"]
```

**Impact**: If a container escape vulnerability (e.g., CVE-2019-5736) is exploited, the attacker gains root privileges on the host OS. Running as root significantly increases the risk of host compromise through writes to /proc, /sys, and other host resources.

**Detection**: If `docker inspect --format '{{.Config.User}}' <container>` returns empty or "0", the container is running as root.

### Anti-Pattern 2: Using the latest Tag

```dockerfile
# NG: latest tag (content can change)
FROM node:latest
# → A different version may be used each build
# → Risk of tag being overwritten in a supply chain attack

# NG: Version only (no digest)
FROM node:20
# → Patch version may change

# OK: Fixed version + digest
FROM node:20.11.0-alpine@sha256:abc123def456...
# → Fully reproducible builds
# → Digest verification even if the tag is overwritten
```

**Impact**: If a supply chain attack overwrites a tag with a malicious image, it will be deployed without detection. Non-reproducible builds make auditing and incident response difficult.

### Anti-Pattern 3: Mounting the Docker Socket

```yaml
# NG: Mount Docker socket into a container
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
# → A container can use the docker command to launch privileged containers on the host
# → Effectively equivalent to host root access

# OK: When Docker-in-Docker is required
# Option 1: Kaniko (build-only, daemonless)
# Option 2: Buildah (rootless, daemonless)
# Option 3: Docker-in-Docker (requires --privileged, not recommended but
#           acceptable only in isolated CI/CD environments)
```

**Impact**: If a container is compromised, the Docker API can be used to manipulate all containers on the host, launch new privileged containers, and access the host filesystem.

### Anti-Pattern 4: Embedding Secrets in Dockerfile

```dockerfile
# NG: Setting secrets in ENV
ENV DATABASE_URL="postgres://user:password@db:5432/mydb"
ENV API_KEY="sk-1234567890abcdef"
# → Recoverable from layers via docker history
# → Environment variables visible via docker inspect

# NG: Copying secret files with COPY
COPY credentials.json /app/credentials.json
# → Persists in previous layers even if deleted in multi-stage builds

# OK: Use BuildKit's --mount=type=secret
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=db_password \
    DB_PASS=$(cat /run/secrets/db_password) && \
    ./setup-db.sh "$DB_PASS"
# → Secrets are not saved in image layers

# At build time:
# docker build --secret id=db_password,src=./db_password.txt .
```

**Impact**: Secrets pushed to an image registry are exposed to everyone with access to the image. Layers are stored permanently, so secrets can be recovered from past layers even after deletion.

---

## 9. Edge Cases

### Edge Case 1: Alpine DNS Resolution Issues

Alpine's musl libc handles `search` domains and `ndots` in DNS resolution differently from glibc. In Kubernetes, `ndots:5` is set in the Pod's `/etc/resolv.conf`, which can cause a large number of unintended DNS queries when resolving short names.

```yaml
# Mitigation: Adjust ndots with dnsConfig
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"  # Reduce from the default 5
      - name: single-request-reopen  # Workaround for musl DNS issues
```

### Edge Case 2: tmpfs and noexec Issues

Some applications (such as Java's JIT compiler) need to generate executable files in `/tmp`. A combination of `readOnlyRootFilesystem: true` and `tmpfs noexec` can prevent applications from starting.

```yaml
# Mitigation: Explicitly allow exec on tmpfs when required
volumes:
  - name: tmp-exec
    emptyDir:
      medium: Memory
      sizeLimit: 128Mi
volumeMounts:
  - name: tmp-exec
    mountPath: /tmp
    # Do not set noexec (required by JIT)
```

### Edge Case 3: User Namespace Remapping

Enabling Docker's User Namespace Remapping maps root inside the container (UID 0) to an unprivileged user on the host (e.g., UID 100000). This greatly reduces the impact of a container escape, but can cause volume permission issues.

```bash
# Enable Docker userns-remap
# /etc/docker/daemon.json
{
  "userns-remap": "default"
}
# → Mapping is configured in /etc/subuid and /etc/subgid
# → Permissions on existing volumes must be reconfigured
```

### Edge Case 4: Multi-Architecture Images and Signing

Multi-architecture images (manifest lists) have different digests for each architecture. cosign signatures must be applied to the manifest list digest.

```bash
# Multi-architecture image structure
# docker manifest inspect myapp:v1.0.0
{
  "manifests": [
    {"platform": {"architecture": "amd64"}, "digest": "sha256:aaa..."},
    {"platform": {"architecture": "arm64"}, "digest": "sha256:bbb..."}
  ]
}
# → Run cosign sign against the manifest list digest
# → Signature verification fails if any architecture's image is tampered with
```

---

## 10. Performance and Security Trade-offs

### Security Option Overhead

| Option | CPU Overhead | Memory Impact | Network Impact | Recommendation |
|-----------|------------------|----------|---------------|-------|
| Non-root execution | None | None | None | Required |
| Read-only FS | None (slight improvement) | None | None | Required |
| cap-drop ALL | None | None | None | Required |
| seccomp (default) | ~1-3% | None | None | Required |
| AppArmor | ~1-2% | None | None | Recommended |
| SELinux | ~2-5% | None | None | Recommended |
| User Namespace | ~1% | None | None | Recommended |
| NetworkPolicy | None | None | ~1ms latency | Required |
| Image scanning (CI) | 30-60s at build time | N/A | N/A | Required |
| Falco (eBPF) | ~2-5% | ~100-200MB | None | Recommended |
| gVisor | ~10-30% | ~50-100MB/container | ~5-10% | High-security environments |
| Kata Containers | ~5-15% | ~100-200MB/container | ~3-5% | Multi-tenant environments |

### Image Size and Security Relationship

```
Image Size vs Attack Surface:

ubuntu:24.04   ████████████████████████████████████████  ~77MB  CVE ~40-60
debian-slim    ███████████████████████████████████████   ~80MB  CVE ~30-50
alpine:3.19    ████                                      ~7MB   CVE ~5-15
distroless     ██                                        ~20MB  CVE ~0-5
scratch        |                                         ~0MB   CVE 0

Conclusion: Smaller image ≈ fewer packages ≈ fewer CVEs
            However, be aware of Alpine-specific musl libc issues
```

---

## 11. Exercises

### Exercise 1: Creating a Secure Dockerfile (Beginner)

Fix the following vulnerable Dockerfile to comply with security best practices.

```dockerfile
# 脆弱な Dockerfile
FROM python:latest
WORKDIR /app
ENV DATABASE_URL=postgres://admin:password@db:5432/mydb
COPY . .
RUN pip install -r requirements.txt
EXPOSE 8000
CMD python app.py
```

**Requirements**:
1. Run as a non-root user
2. Use a multi-stage build
3. Do not include secrets in the image
4. Pin the base image version
5. Make it work with a read-only filesystem

**Hint**: Use `python:3.12-slim` as the base, and leverage `--mount=type=secret`.

### Exercise 2: Designing a Kubernetes SecurityContext (Intermediate)

Create a Deployment manifest that satisfies the following requirements.

**Requirements**:
1. Comply with Pod Security Standards `restricted` level
2. Allow only communication to an external API (api.example.com:443) and PostgreSQL (postgres:5432)
3. Use NetworkPolicy to block unnecessary traffic other than DNS
4. Set appropriate resource limits
5. Configure all of liveness/readiness/startup probes

**Additional challenge**: Create a policy using OPA Gatekeeper or Kyverno to enforce these requirements cluster-wide.

### Exercise 3: Building a Container Supply Chain (Advanced)

Build a CI/CD pipeline that satisfies the following requirements.

**Requirements**:
1. Lint the Dockerfile with Hadolint
2. Scan the image with Trivy (fail on CRITICAL)
3. Verify CIS Docker Benchmark with Dockle
4. Generate SBOM in CycloneDX format
5. Sign keylessly with cosign
6. Enforce signature verification with Kyverno at Kubernetes deploy time

**Additional challenge**: Generate SLSA Level 3 Provenance and attach it to the image with `cosign attest`.

---

## 12. Troubleshooting

### Common Issues and Solutions

| Issue | Cause | Solution |
|------|------|--------|
| Startup failure with `readOnlyRootFilesystem` | App writes to `/tmp` or `/var` | Mount tmpfs/emptyDir |
| Image fails to start with `runAsNonRoot` | No USER set in the image | Add USER to Dockerfile |
| Network connection failure with `cap-drop ALL` | `NET_RAW` required (ping, etc.) | `cap-add NET_RAW` (reconsider if truly needed) |
| Slow DNS resolution on Alpine | musl DNS implementation + ndots:5 | Adjust ndots with dnsConfig |
| `cosign verify` fails | Different digest than at signing time | Check manifest list vs manifest difference |
| NetworkPolicy has no effect | CNI does not support NetworkPolicy | Switch to Calico/Cilium |
| False positives in Trivy | Detection of unused libraries | Suppress with `.trivyignore` and document reasoning |
| Deprecated SecurityContext warning | Using PSP (PodSecurityPolicy) | Migrate to PSS (Pod Security Standards) |
| Image pull failure | ImagePullPolicy: Always + registry failure | Use IfNotPresent + pin digest |
| Zombie process accumulation | PID 1 not reaping child processes | Use dumb-init/tini |

---

## 13. FAQ

### Q1. Which should I choose: distroless or Alpine?

For production environments where a shell or debug tools are not needed, distroless is the most secure option. Alpine includes a shell, making debugging easier and offering a balanced choice. An effective strategy is to use Alpine during development and switch to distroless for production. Note that with distroless you cannot shell into a container, so you need to use `kubectl debug` with ephemeral containers or ensure sufficient observability through log output.

### Q2. When should container vulnerability scanning be performed?

Ideally in three stages: scan at build time in the CI/CD pipeline (as a gate), periodic scanning in the registry (daily), and continuous scanning at runtime. Catch CRITICALs at build time and pick up new CVEs with periodic scans. Use tools that automate base image updates (Renovate, Dependabot) to prevent images with known vulnerabilities from being used for extended periods.

### Q3. What should I do when temporary files are needed with a read-only filesystem?

Mount `tmpfs` to provide `/tmp`. Use `emptyDir` (Kubernetes) or `--tmpfs` (Docker) with size limits and the `noexec` option. Output logs to stdout/stderr or delegate to an external log collector. For Java applications, the JIT compiler may need to generate executable files in `/tmp`, so it may be necessary to remove the `noexec` option.

### Q4. Which should I choose: gVisor or Kata Containers?

gVisor intercepts system calls through a user-space kernel (Sentry), greatly reducing the kernel attack surface. The overhead is significant (10-30%), but no additional hardware is required. Kata Containers runs containers inside lightweight VMs, providing hardware-level isolation. Nested virtualization is required, so bare metal or a supported cloud environment is needed. Kata is suited for multi-tenant environments, while gVisor is appropriate for running untrusted code.

### Q5. How can I minimize ServiceAccount permissions in Kubernetes?

Set `automountServiceAccountToken: false` and create ServiceAccounts with least privilege only for the Pods that need them. Use RBAC to bind Role/ClusterRole that limits access to only the API resources the Pod requires. In Kubernetes 1.24 and later, ServiceAccount tokens are bound tokens (with expiration and audience) by default, but confirm that legacy tokens are disabled.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|------|
| Container isolation | Weaker than VMs due to shared kernel. Harden with namespaces + cgroups + LSM |
| Base images | Minimize attack surface with Alpine / distroless. Pin version + digest |
| Multi-stage builds | Do not include build tools in production images. Remove SUID/SGID |
| Image scanning | Gate on HIGH/CRITICAL with Trivy. Generate and manage SBOM |
| Non-root execution | Specify USER + allowPrivilegeEscalation: false + no-new-privileges |
| Read-only FS | readOnlyRootFilesystem: true + tmpfs to limit writable areas |
| Capability reduction | cap-drop ALL + cap-add only what is necessary |
| Network restrictions | NetworkPolicy with default deny + allow only required traffic |
| Image signing | cosign + Kyverno/Gatekeeper to enforce signature verification |
| Runtime monitoring | Falco (eBPF) to detect abnormal system calls and network traffic |
| Secret management | External Secrets Operator + cloud secret management |
| Pod Security | Apply Pod Security Standards (restricted) to production Namespaces |

---

## Next Guides to Read

- [SAST/DAST](./03-sast-dast.md) -- Vulnerability scanning for code and applications
- [IaC Security](../05-cloud-security/02-infrastructure-as-code-security.md) -- Security checks for Kubernetes manifests
- [Dependency Security](./01-dependency-security.md) -- Dependency management inside containers
- [Secure Coding](./00-secure-coding.md) -- Attack defense at the code level

---

## References

1. **CIS Docker Benchmark** -- https://www.cisecurity.org/benchmark/docker
2. **NIST SP 800-190 -- Application Container Security Guide** -- https://csrc.nist.gov/publications/detail/sp/800-190/final
3. **Kubernetes Security Best Practices** -- https://kubernetes.io/docs/concepts/security/
4. **Google Distroless Images** -- https://github.com/GoogleContainerTools/distroless
5. **Sigstore/cosign Documentation** -- https://docs.sigstore.dev/
6. **Falco Documentation** -- https://falco.org/docs/
7. **SLSA (Supply-chain Levels for Software Artifacts)** -- https://slsa.dev/
8. **CIS Kubernetes Benchmark** -- https://www.cisecurity.org/benchmark/kubernetes
9. **OWASP Docker Security Cheat Sheet** -- https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html
