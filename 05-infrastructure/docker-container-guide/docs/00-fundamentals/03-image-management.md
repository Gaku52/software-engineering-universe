# Image Management

> A practical guide to managing the full image lifecycle — from pulling, building, and distributing Docker images to leveraging container registries.

---

## What You Will Learn

1. Understand **Docker image layer structure and tagging systems** to manage images efficiently
2. Understand when to use **Docker Hub vs. GitHub Container Registry** and distribute images accordingly
3. Practice **image inspection, security checks, and cleanup**
4. Understand **multi-platform builds** and build/distribute images for different architectures
5. Design **image management strategies for CI/CD pipelines** and build automated, secure image distribution workflows


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Docker Basics](./02-docker-basics.md)

---

## 1. Image Structure

### 1.1 Layer Model

```
+------------------------------------------------------+
|              Docker Image Layer Structure              |
|                                                      |
|  +------------------------------------------------+ |
|  |  Layer 4: COPY . /app  (app code)               | |  <- Change frequency: High
|  +------------------------------------------------+ |
|  |  Layer 3: RUN npm install (dependencies)        | |  <- Change frequency: Medium
|  +------------------------------------------------+ |
|  |  Layer 2: RUN apt-get install (system packages) | |  <- Change frequency: Low
|  +------------------------------------------------+ |
|  |  Layer 1: FROM node:20-alpine (base image)      | |  <- Change frequency: Lowest
|  +------------------------------------------------+ |
|                                                      |
|  Each layer is identified by a SHA256 hash           |
|  Unchanged layers are reused from cache              |
+------------------------------------------------------+
```

A Docker image uses Union File System (OverlayFS) to stack multiple read-only layers on top of each other. Each layer stores only the diff (changes) from the previous layer, so images sharing a common base image can share those layers — significantly reducing disk usage and download time.

When a container starts, a writable layer (the container layer) is added on top of the image. All changes made inside the container are recorded in this layer, and when the container is deleted, this layer is also deleted. This is why containers are said to be "ephemeral."

### 1.2 Inspecting Layers

```bash
# Display layer information for an image
docker history nginx:alpine

# Example output:
# IMAGE          CREATED       CREATED BY                                      SIZE
# a1b2c3d4       2 days ago    CMD ["nginx" "-g" "daemon off;"]                0B
# <missing>      2 days ago    EXPOSE map[80/tcp:{}]                           0B
# <missing>      2 days ago    COPY docker-entrypoint.sh /                     4.62kB
# <missing>      2 days ago    RUN /bin/sh -c set -x && addgroup...            26.7MB
# <missing>      2 days ago    ENV NGINX_VERSION=1.25.3                        0B
# <missing>      3 weeks ago   /bin/sh -c #(nop) CMD ["/bin/sh"]               0B
# <missing>      3 weeks ago   ADD file:xxx in /                               7.38MB

# Show only commands without sizes
docker history --no-trunc --format "{{.CreatedBy}}" nginx:alpine

# Detailed image information
docker inspect nginx:alpine

# Extract specific fields in JSON format
docker inspect --format '{{json .RootFS.Layers}}' nginx:alpine | python3 -m json.tool

# Count the number of layers
docker inspect --format '{{len .RootFS.Layers}}' nginx:alpine
```

### 1.3 Layer Sharing and Efficiency

```bash
# Check disk usage for two images using the same base image
docker pull node:20-alpine
docker pull node:18-alpine

# Size of each image
docker images node
# REPOSITORY   TAG         IMAGE ID       CREATED       SIZE
# node         20-alpine   abc123         2 days ago    130MB
# node         18-alpine   def456         5 days ago    125MB

# Actual disk usage (accounting for layer sharing)
docker system df -v
# -> Shows Shared Size

# Check layer sharing status
docker inspect --format '{{.RootFS.Layers}}' node:20-alpine
docker inspect --format '{{.RootFS.Layers}}' node:18-alpine
# -> Common layer hashes indicate shared layers
```

### 1.4 How Copy-on-Write (CoW) Works

```
+------------------------------------------------------+
|           Copy-on-Write Behavior                      |
|                                                      |
|  On container start:                                  |
|  +--------------------------------------------+      |
|  | Container layer (R/W) - empty              |      |
|  +--------------------------------------------+      |
|  | Layer 3 (R/O) - /app/server.js             |      |
|  +--------------------------------------------+      |
|  | Layer 2 (R/O) - /usr/lib/...              |      |
|  +--------------------------------------------+      |
|  | Layer 1 (R/O) - Base OS                    |      |
|  +--------------------------------------------+      |
|                                                      |
|  File read: search top to bottom, return the file    |
|  from the first layer where it is found              |
|                                                      |
|  File write: copy the target file to the container   |
|  layer, then modify it (Copy-on-Write)               |
|                                                      |
|  File delete: mask with a whiteout file              |
|  (the file in the lower layer is not actually deleted)|
+------------------------------------------------------+
```

---

## 2. Pulling Images

### 2.1 Basic Operations

```bash
# Pull the latest version
docker pull nginx
# -> nginx:latest is pulled

# Specify a particular version
docker pull nginx:1.25.3-alpine

# Specify a platform
docker pull --platform linux/arm64 nginx:alpine

# Specify by digest (SHA256) for full reproducibility
docker pull nginx@sha256:abc123def456...

# Pull multiple tags at once
docker pull nginx:1.25.3-alpine
docker pull nginx:1.25.3-bookworm

# List all tags (Docker Hub API)
curl -s "https://registry.hub.docker.com/v2/repositories/library/nginx/tags?page_size=100" | \
  python3 -c "import sys,json;[print(t['name']) for t in json.load(sys.stdin)['results']]"
```

### 2.2 Pulling from Registries

```bash
# Docker Hub (default)
docker pull nginx:alpine
# -> same as docker.io/library/nginx:alpine

# GitHub Container Registry
docker pull ghcr.io/owner/image:tag

# Amazon ECR
docker pull 123456789.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:v1

# Google Artifact Registry
docker pull asia-northeast1-docker.pkg.dev/project/repo/image:tag

# Azure Container Registry
docker pull myregistry.azurecr.io/my-app:v1

# Self-hosted registry
docker pull registry.example.com:5000/my-app:v1

# Red Hat Quay
docker pull quay.io/organization/image:tag
```

### 2.3 Speeding Up and Optimizing Pulls

```bash
# Configure parallel downloads (daemon.json)
# /etc/docker/daemon.json
# {
#   "max-concurrent-downloads": 10,
#   "max-concurrent-uploads": 5
# }

# Configure mirror registries (to avoid rate limits)
# /etc/docker/daemon.json
# {
#   "registry-mirrors": [
#     "https://mirror.gcr.io",
#     "https://docker-mirror.example.com"
#   ]
# }

# Pull policy reference (Kubernetes / Docker Compose)
# imagePullPolicy: IfNotPresent  -> pull only if not available locally
# imagePullPolicy: Always        -> always pull
# imagePullPolicy: Never         -> use local only

# Check pull progress
docker pull --quiet nginx:alpine  # suppress progress output
docker pull nginx:alpine 2>&1 | tail -1  # show only final result
```

---

## 3. Tagging System

### 3.1 Tag Naming Conventions

```
+------------------------------------------------------+
|                  Image Tag Structure                   |
|                                                      |
|  registry / namespace / repository : tag             |
|                                                      |
|  Examples:                                           |
|  docker.io / library   / nginx     : 1.25.3-alpine   |
|  ghcr.io   / myorg     / myapp     : v2.1.0          |
|  (optional)  (optional)              (default: latest)|
|                                                      |
|  Tag naming best practices:                           |
|  +------------------------------------------------+ |
|  | Semantic versioning: v1.2.3                    | |
|  | Git SHA: sha-abc123f                           | |
|  | Date: 2024-01-15                               | |
|  | Environment: production, staging               | |
|  | Base specification: 1.25.3-alpine, 1.25.3-bookworm | |
|  +------------------------------------------------+ |
+------------------------------------------------------+
```

```bash
# Apply tags
docker tag my-app:latest my-app:v1.0.0
docker tag my-app:latest my-app:v1.0
docker tag my-app:latest my-app:v1

# Tag for remote registry
docker tag my-app:v1.0.0 ghcr.io/myorg/my-app:v1.0.0
docker tag my-app:v1.0.0 ghcr.io/myorg/my-app:latest

# List tags
docker images my-app
# REPOSITORY   TAG       IMAGE ID       CREATED       SIZE
# my-app       latest    abc123def456   1 hour ago    150MB
# my-app       v1.0.0    abc123def456   1 hour ago    150MB
# my-app       v1.0      abc123def456   1 hour ago    150MB
# my-app       v1        abc123def456   1 hour ago    150MB
# (same IMAGE ID = multiple tags pointing to the same image)
```

### 3.2 Semantic Versioning in Practice

```bash
# Example tag strategy implementation for CI/CD
#!/bin/bash
# build-and-tag.sh

APP_NAME="my-app"
REGISTRY="ghcr.io/myorg"
VERSION=$(cat version.txt)              # e.g. 1.2.3
GIT_SHA=$(git rev-parse --short HEAD)   # e.g. abc123f
BUILD_DATE=$(date -u +%Y%m%d)          # e.g. 20240115
BRANCH=$(git branch --show-current)     # e.g. main

# Build
docker build \
  --label "org.opencontainers.image.version=${VERSION}" \
  --label "org.opencontainers.image.revision=${GIT_SHA}" \
  --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t "${REGISTRY}/${APP_NAME}:${VERSION}" \
  -t "${REGISTRY}/${APP_NAME}:${VERSION}-${GIT_SHA}" \
  -t "${REGISTRY}/${APP_NAME}:sha-${GIT_SHA}" \
  .

# Also tag as latest if on the main branch
if [ "$BRANCH" = "main" ]; then
  docker tag "${REGISTRY}/${APP_NAME}:${VERSION}" "${REGISTRY}/${APP_NAME}:latest"
fi

# Push
docker push "${REGISTRY}/${APP_NAME}" --all-tags
```

### 3.3 OCI Image Label Standards

```dockerfile
# Label configuration in Dockerfile (OCI Image Spec compliant)
LABEL org.opencontainers.image.title="My Application"
LABEL org.opencontainers.image.description="A web application"
LABEL org.opencontainers.image.version="1.2.3"
LABEL org.opencontainers.image.authors="team@example.com"
LABEL org.opencontainers.image.url="https://github.com/myorg/my-app"
LABEL org.opencontainers.image.source="https://github.com/myorg/my-app"
LABEL org.opencontainers.image.documentation="https://docs.example.com"
LABEL org.opencontainers.image.vendor="My Organization"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.created="2024-01-15T10:00:00Z"
LABEL org.opencontainers.image.revision="abc123f"
```

### Comparison Table 1: Tagging Strategies

| Strategy | Example | Use Case | Advantages | Disadvantages |
|---|---|---|---|---|
| Semantic | `v1.2.3` | Release management | Clear versioning | Requires manual management |
| Git SHA | `sha-abc123f` | CI/CD | Full traceability | Not human-readable |
| Date | `2024-01-15` | Scheduled builds | Clear chronological order | Collisions with multiple builds in a day |
| latest | `latest` | Development/testing | Always up to date | No reproducibility |
| Environment | `production` | Deploy management | Intuitive | Mutable |
| Branch name | `feature-auth` | PR/development | Easy to track | Becomes orphaned after branch deletion |
| Composite | `v1.2.3-sha-abc123f` | Production releases | Fully identifiable | Long tag name |

---

## 4. Distributing Images (push)

### 4.1 Docker Hub

```bash
# Log in to Docker Hub
docker login
# Username: myuser
# Password: ****

# Tag the image
docker tag my-app:v1.0.0 myuser/my-app:v1.0.0

# Push
docker push myuser/my-app:v1.0.0

# Push all tags
docker push myuser/my-app --all-tags

# Log out
docker logout
```

### 4.2 GitHub Container Registry (GHCR)

```bash
# Log in with a GitHub Personal Access Token
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag and push
docker tag my-app:v1.0.0 ghcr.io/myorg/my-app:v1.0.0
docker push ghcr.io/myorg/my-app:v1.0.0
```

```yaml
# Push from GitHub Actions
# .github/workflows/publish.yml
name: Build and Push
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### 4.3 Amazon ECR

```bash
# Log in to ECR using the AWS CLI
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.ap-northeast-1.amazonaws.com

# Create a repository (first time only)
aws ecr create-repository --repository-name my-app \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Tag and push
docker tag my-app:v1.0.0 123456789.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:v1.0.0
docker push 123456789.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:v1.0.0

# Set a lifecycle policy (auto-delete old images)
aws ecr put-lifecycle-policy --repository-name my-app --lifecycle-policy-text '{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}'
```

### 4.4 Google Artifact Registry

```bash
# Authenticate with gcloud CLI
gcloud auth configure-docker asia-northeast1-docker.pkg.dev

# Create a repository (first time only)
gcloud artifacts repositories create my-repo \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="My Docker repository"

# Tag and push
docker tag my-app:v1.0.0 asia-northeast1-docker.pkg.dev/my-project/my-repo/my-app:v1.0.0
docker push asia-northeast1-docker.pkg.dev/my-project/my-repo/my-app:v1.0.0

# List images
gcloud artifacts docker images list asia-northeast1-docker.pkg.dev/my-project/my-repo
```

### 4.5 Setting Up a Private Registry

```bash
# Start Docker Registry locally
docker run -d -p 5000:5000 --name registry registry:2

# Push to local registry
docker tag my-app:v1.0.0 localhost:5000/my-app:v1.0.0
docker push localhost:5000/my-app:v1.0.0

# Pull from local registry
docker pull localhost:5000/my-app:v1.0.0

# Check registry catalog
curl http://localhost:5000/v2/_catalog
# {"repositories":["my-app"]}

# Check tag list
curl http://localhost:5000/v2/my-app/tags/list
# {"name":"my-app","tags":["v1.0.0"]}
```

```yaml
# Full-featured private registry with docker-compose.yml
services:
  registry:
    image: registry:2
    ports:
      - "5000:5000"
    volumes:
      - registry_data:/var/lib/registry
      - ./certs:/certs
      - ./auth:/auth
    environment:
      REGISTRY_HTTP_TLS_CERTIFICATE: /certs/domain.crt
      REGISTRY_HTTP_TLS_KEY: /certs/domain.key
      REGISTRY_AUTH: htpasswd
      REGISTRY_AUTH_HTPASSWD_PATH: /auth/htpasswd
      REGISTRY_AUTH_HTPASSWD_REALM: "Registry Realm"
      REGISTRY_STORAGE_DELETE_ENABLED: "true"
    restart: always

  registry-ui:
    image: joxit/docker-registry-ui:latest
    ports:
      - "8080:80"
    environment:
      REGISTRY_URL: https://registry:5000
      DELETE_IMAGES: "true"
      SINGLE_REGISTRY: "true"
    depends_on:
      - registry

volumes:
  registry_data:
```

```bash
# Create an htpasswd file
docker run --rm --entrypoint htpasswd registry:2 -Bbn myuser mypassword > auth/htpasswd

# Create a TLS certificate (self-signed, for development)
openssl req -newkey rsa:4096 -nodes -sha256 -keyout certs/domain.key \
  -x509 -days 365 -out certs/domain.crt \
  -subj "/CN=registry.example.com"
```

---

## 5. Inspecting Images

### 5.1 Checking Image Information

```bash
# Basic information
docker images
# REPOSITORY   TAG            IMAGE ID       CREATED        SIZE
# nginx        alpine         a1b2c3d4       2 days ago     42.6MB
# node         20-alpine      e5f6g7h8       1 week ago     181MB
# postgres     16-alpine      i9j0k1l2       3 days ago     244MB

# Detailed information
docker inspect nginx:alpine

# Extract specific fields
docker inspect --format '{{.Config.Env}}' nginx:alpine
docker inspect --format '{{.Config.ExposedPorts}}' nginx:alpine
docker inspect --format '{{.Config.Cmd}}' nginx:alpine
docker inspect --format '{{.Architecture}}' nginx:alpine
docker inspect --format '{{.Os}}' nginx:alpine

# Get label information
docker inspect --format '{{json .Config.Labels}}' nginx:alpine | python3 -m json.tool

# Check the image entrypoint
docker inspect --format '{{json .Config.Entrypoint}}' nginx:alpine

# Check the manifest (verify multi-platform support)
docker manifest inspect nginx:alpine

# Detailed image size (before and after compression)
docker manifest inspect --verbose nginx:alpine | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print(f'Compressed: {sum(l[\"size\"] for l in d[\"SchemaV2Manifest\"][\"layers\"])/1e6:.1f}MB')"
```

### 5.2 Exploring Image Contents

```bash
# Create a container from the image to inspect its contents
docker run --rm -it nginx:alpine /bin/sh

# Export the image as a tar archive
docker save nginx:alpine -o nginx-alpine.tar
# Inspect the contents of the tar
tar tf nginx-alpine.tar | head -20

# Check a specific file
docker run --rm nginx:alpine cat /etc/nginx/nginx.conf

# Check filesystem diffs (files changed by a container)
docker diff my-running-container
# A /tmp/newfile    (Added)
# C /var/log        (Changed)
# D /tmp/oldfile    (Deleted)

# List files in the image
docker run --rm nginx:alpine find / -type f 2>/dev/null | head -50

# Check if a specific package is installed
docker run --rm nginx:alpine apk list --installed 2>/dev/null
docker run --rm python:3.12-slim dpkg -l 2>/dev/null | head -30
```

### 5.3 Image Analysis with dive

```bash
# Install dive
brew install dive  # macOS
# Or run with Docker
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive nginx:alpine

# Analyze an image with dive
dive nginx:alpine

# Check image efficiency in CI mode
dive --ci nginx:alpine
# -> Shows image efficiency score
# -> Detects wasteful layers and duplicate files
```

### 5.4 Generating a Software Bill of Materials (SBOM)

```bash
# Docker SBOM (Docker Desktop integration)
docker sbom nginx:alpine

# Generate SBOM with Syft
# Install
brew install syft  # macOS

# Generate SBOM (SPDX format)
syft nginx:alpine -o spdx-json > sbom.spdx.json

# Generate SBOM (CycloneDX format)
syft nginx:alpine -o cyclonedx-json > sbom.cdx.json

# Display in text format
syft nginx:alpine

# Vulnerability scan based on SBOM
syft nginx:alpine -o spdx-json | grype
```

---

## 6. Registry Comparison

### Comparison Table 2: Container Registry Comparison

| Registry | Free Tier | Private Repositories | Primary Use | Authentication |
|---|---|---|---|---|
| Docker Hub | 1 private repo | Paid plans | OSS distribution, official images | Docker ID |
| GitHub Container Registry | Unlimited (public) | Depends on GitHub plan | GitHub-integrated projects | GitHub PAT |
| Amazon ECR | 500MB/month (public) | AWS pricing | AWS production environments | IAM |
| Google Artifact Registry | 500MB/month | GCP pricing | GCP production environments | gcloud auth |
| Azure Container Registry | None | Azure pricing | Azure production environments | Azure AD |
| Harbor (OSS) | Self-hosted | Unlimited | On-premises | LDAP/OIDC |
| Quay.io (Red Hat) | Unlimited (public) | Paid plans | Red Hat ecosystem | Red Hat SSO |
| GitLab Container Registry | Depends on GitLab plan | Depends on GitLab plan | GitLab CI/CD integration | GitLab token |

### Comparison Table 3: Cost Comparison (Approximate Monthly)

| Registry | Small (10GB) | Medium (100GB) | Large (1TB) |
|---|---|---|---|
| Docker Hub (Team) | $7/user | $7/user | $7/user (unlimited storage) |
| GHCR (GitHub Team) | $4/user | $4/user + storage | $4/user + storage |
| Amazon ECR | ~$1 | ~$10 | ~$100 |
| Google AR | ~$2.6 | ~$26 | ~$260 |
| Azure ACR (Basic) | $5 (incl. 10GB) | $50 (incl. 100GB) | $200+ |
| Harbor | Server costs only | Server costs only | Server costs only |

---

## 7. Image Security

### 7.1 Vulnerability Scanning

```
+------------------------------------------------------+
|              Image Security Scanning                  |
|                                                      |
|  Image                                               |
|    |                                                 |
|    v                                                 |
|  +------------------+                                |
|  | Vulnerability    |                                |
|  | Scanner          |                                |
|  +-----|------------+                                |
|        |                                             |
|  +-----+------+--------+--------+                    |
|  |     |      |        |        |                    |
|  v     v      v        v        v                    |
| Docker Trivy  Snyk   Grype   Clair                  |
| Scout                                               |
|                                                      |
|  Scan targets:                                       |
|  - OS packages (apt/apk/yum)                        |
|  - Language packages (npm/pip/go mod)               |
|  - Configuration file issues                         |
|  - Secret detection                                  |
|  - License compliance                                |
+------------------------------------------------------+
```

```bash
# Docker Scout (Docker Desktop integration)
docker scout quickview nginx:alpine
docker scout cves nginx:alpine
docker scout recommendations nginx:alpine

# Trivy (open source, recommended)
# Install
brew install aquasecurity/trivy/trivy  # macOS
# Or run with Docker
docker run --rm aquasec/trivy image nginx:alpine

# Scan an image with Trivy
trivy image nginx:alpine

# Filter by severity
trivy image --severity HIGH,CRITICAL nginx:alpine

# Show only fixable vulnerabilities
trivy image --ignore-unfixed nginx:alpine

# Output in JSON format (for CI/CD use)
trivy image --format json --output result.json nginx:alpine

# Output in table format
trivy image --format table nginx:alpine

# Control CI exit code (fail if CRITICAL is found)
trivy image --exit-code 1 --severity CRITICAL nginx:alpine

# Grype
docker run --rm anchore/grype nginx:alpine

# Ignore a specific vulnerability with Grype
echo "CVE-2023-12345" > .grype.yaml
grype nginx:alpine --config .grype.yaml
```

### 7.2 Image Signing

```bash
# Enable Docker Content Trust (DCT)
export DOCKER_CONTENT_TRUST=1

# Push with signature
docker push myuser/my-app:v1.0.0
# On the first push, you will be prompted to set a signing key passphrase

# Only signed images can be pulled
docker pull myuser/my-app:v1.0.0

# Sign with cosign (Sigstore)
# Install
brew install cosign  # macOS

# Generate a key pair
cosign generate-key-pair

# Sign an image
cosign sign --key cosign.key ghcr.io/myorg/my-app:v1.0.0

# Verify a signature
cosign verify --key cosign.pub ghcr.io/myorg/my-app:v1.0.0

# Keyless signing (integrated with GitHub Actions OIDC)
cosign sign ghcr.io/myorg/my-app:v1.0.0
# -> Recorded in Sigstore's transparency log (Rekor)

# Verify the signature
cosign verify \
  --certificate-identity "https://github.com/myorg/my-app/.github/workflows/build.yml@refs/tags/v1.0.0" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/my-app:v1.0.0
```

### 7.3 Security Best Practices

```
+------------------------------------------------------+
|       Image Security Best Practices                   |
|                                                      |
|  1. Use minimal base images                           |
|     Alpine > Debian Slim > Ubuntu                    |
|     Distroless > Alpine (minimize attack surface)    |
|                                                      |
|  2. Run as a non-root user                            |
|     USER appuser (avoid root privileges)             |
|                                                      |
|  3. Use a read-only filesystem                        |
|     docker run --read-only --tmpfs /tmp ...           |
|                                                      |
|  4. Scan for vulnerabilities regularly               |
|     Integrate Trivy into CI/CD pipelines             |
|                                                      |
|  5. Sign and verify images                           |
|     Use cosign + Sigstore to protect the supply chain|
|                                                      |
|  6. Never include secrets in images                  |
|     Use --mount=type=secret instead of ARG/ENV       |
|                                                      |
|  7. Always use .dockerignore                         |
|     Exclude .env, .git, credentials                  |
+------------------------------------------------------+
```

---

## 8. Multi-Platform Builds

### 8.1 Multi-Platform Support with buildx

```bash
# Check available buildx builders
docker buildx ls

# Create a builder for multi-platform builds
docker buildx create --name multiplatform --driver docker-container --use

# Multi-platform build & push
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  -t ghcr.io/myorg/my-app:v1.0.0 \
  --push \
  .

# Build for a specific platform only
docker buildx build \
  --platform linux/amd64 \
  -t my-app:v1.0.0 \
  --load \
  .

# Check supported platforms for a built image
docker manifest inspect ghcr.io/myorg/my-app:v1.0.0

# Set up QEMU emulation (for building different architectures)
docker run --privileged --rm tonistiigi/binfmt --install all
```

### 8.2 Multi-Platform Dockerfile

```dockerfile
# Example Dockerfile with multi-platform support
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

# Build platform information
ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Cross-compile
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-w -s" -o /server ./cmd/server

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

```bash
# Multi-platform build with GitHub Actions
# .github/workflows/multi-platform.yml
```

```yaml
name: Multi-platform Build
on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-qemu-action@v3

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## 9. Image Cleanup

```bash
# List local images
docker images

# Delete a specific image
docker rmi nginx:alpine

# Force delete (even if used by a running container)
docker rmi -f nginx:alpine

# Delete dangling images (untagged)
docker image prune

# Delete all unused images
docker image prune -a

# Filter and delete by specific conditions
docker image prune -a --filter "until=24h"  # images older than 24 hours
docker image prune -a --filter "label=env=dev"  # by label
docker image prune -a --filter "label!=keep=true"  # images without a keep label

# Bulk delete images matching a pattern
docker images --format '{{.Repository}}:{{.Tag}}' | grep 'my-app' | xargs docker rmi

# List only dangling images
docker images --filter "dangling=true"

# Check disk usage
docker system df
# TYPE            TOTAL   ACTIVE   SIZE      RECLAIMABLE
# Images          25      5        8.5GB     6.2GB (72%)
# Containers      10      3        250MB     180MB (72%)
# Local Volumes   8       4        2.1GB     900MB (42%)
# Build Cache     100     0        3.5GB     3.5GB (100%)

# Detailed disk usage
docker system df -v

# Clean up build cache
docker builder prune
docker builder prune --all  # Delete all build cache
docker builder prune --keep-storage 5GB  # Delete only what exceeds 5GB

# Full cleanup
docker system prune -a --volumes
```

### Automating Cleanup

```bash
#!/bin/bash
# docker-cleanup.sh - Cleanup script for scheduled execution

echo "=== Starting Docker Cleanup ==="

# Remove stopped containers
echo "--- Removing stopped containers ---"
docker container prune -f

# Remove dangling images
echo "--- Removing dangling images ---"
docker image prune -f

# Remove unused images older than 7 days
echo "--- Removing unused images older than 7 days ---"
docker image prune -a -f --filter "until=168h"

# Remove unused volumes
echo "--- Removing unused volumes ---"
docker volume prune -f

# Remove unused networks
echo "--- Removing unused networks ---"
docker network prune -f

# Limit build cache to 10GB
echo "--- Cleaning up build cache ---"
docker builder prune -f --keep-storage 10GB

# Show final disk usage
echo "=== Cleanup Complete ==="
docker system df
```

```bash
# Run daily at midnight with cron
# crontab -e
0 3 * * * /usr/local/bin/docker-cleanup.sh >> /var/log/docker-cleanup.log 2>&1
```

---

## 10. Saving and Transferring Images

```bash
# Save an image to a file
docker save -o my-app-v1.tar my-app:v1.0.0

# Save with compression
docker save my-app:v1.0.0 | gzip > my-app-v1.tar.gz

# Save with zstd compression (faster and higher compression)
docker save my-app:v1.0.0 | zstd > my-app-v1.tar.zst

# Load an image from a file
docker load -i my-app-v1.tar

# Load from a compressed file
gunzip -c my-app-v1.tar.gz | docker load
zstd -d -c my-app-v1.tar.zst | docker load

# Bundle multiple images into one tar
docker save -o all-images.tar my-app:v1.0.0 nginx:alpine postgres:16-alpine

# Save the current state of a container as an image
docker commit my-container my-app:snapshot
# Note: commit is not recommended for development. Use a Dockerfile instead.

# Transfer an image to another host via SSH
docker save my-app:v1.0.0 | gzip | ssh user@remote "gunzip | docker load"

# Export container filesystem as a tar (layer info is lost)
docker export my-container > container-fs.tar
docker import container-fs.tar my-app:imported
```

### Comparison Table 4: Image Transfer Methods

| Method | Speed | Use Case | Advantages | Disadvantages |
|---|---|---|---|---|
| Registry (push/pull) | Fast | Normal development/deployment | Layer caching works | Requires a registry |
| docker save/load | Medium | Offline environments | No registry needed | Includes all layers |
| docker export/import | Slow | Filesystem extraction | Flat tar | Layer info is lost |
| SSH direct transfer | Medium | Emergencies | No infrastructure needed | Depends on bandwidth |
| External storage | Medium | CI/CD cache | Integrates with S3 etc. | Requires configuration |

---

## 11. Image Management in CI/CD

### 11.1 Build and Push with GitHub Actions

```yaml
# .github/workflows/docker.yml
name: Docker Build

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        if: github.event_name != 'pull_request'
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Vulnerability scan
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.version }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
```

### 11.2 Build with GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - build
  - scan
  - push

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE

build:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $DOCKER_IMAGE:$CI_COMMIT_SHA .
    - docker push $DOCKER_IMAGE:$CI_COMMIT_SHA

scan:
  stage: scan
  image:
    name: aquasec/trivy
    entrypoint: [""]
  script:
    - trivy image --exit-code 1 --severity CRITICAL $DOCKER_IMAGE:$CI_COMMIT_SHA

push:
  stage: push
  image: docker:24-dind
  services:
    - docker:24-dind
  only:
    - tags
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker pull $DOCKER_IMAGE:$CI_COMMIT_SHA
    - docker tag $DOCKER_IMAGE:$CI_COMMIT_SHA $DOCKER_IMAGE:$CI_COMMIT_TAG
    - docker tag $DOCKER_IMAGE:$CI_COMMIT_SHA $DOCKER_IMAGE:latest
    - docker push $DOCKER_IMAGE:$CI_COMMIT_TAG
    - docker push $DOCKER_IMAGE:latest
```

---

## 12. Anti-Patterns

### Anti-Pattern 1: Managing Everything with Only the latest Tag

```bash
# Bad: Push everything as latest
docker build -t my-app .
docker push my-app:latest
# -> Cannot tell which version is deployed
# -> Cannot roll back
# -> Cache behavior is unpredictable

# Good: Semantic versioning + Git SHA
docker build -t my-app:v1.2.3 -t my-app:sha-abc123f .
docker push my-app:v1.2.3
docker push my-app:sha-abc123f
# -> Version is identifiable, rollback is easy
```

### Anti-Pattern 2: Creating Images with docker commit

```bash
# Bad: Make manual changes inside a container and commit
docker run -it ubuntu bash
# (Run apt install, edit files, etc. inside the container)
docker commit <container-id> my-custom-image
# -> Not reproducible
# -> Changes are opaque
# -> Cannot be reviewed

# Good: Define the image with a Dockerfile
# Dockerfile
# FROM ubuntu:22.04
# RUN apt-get update && apt-get install -y curl
# COPY config.json /etc/app/
docker build -t my-custom-image .
# -> Reproducible, reviewable, version-controlled
```

### Anti-Pattern 3: Passing Secrets via ARG/ENV at Build Time

```dockerfile
# Bad: Secrets remain in layers
FROM node:20-alpine
WORKDIR /app
ARG NPM_TOKEN
COPY .npmrc .
RUN npm ci
RUN rm .npmrc  # Deleting it still leaves it in the previous layer!

# Good: Use BuildKit secret mounts
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
COPY . .
CMD ["node", "server.js"]
```

```bash
# Pass secrets at build time
docker build --secret id=npmrc,src=.npmrc -t my-app .
```

### Anti-Pattern 4: Using a Large Base Image

```dockerfile
# Bad: Using full-size ubuntu
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y nodejs npm
COPY . /app
CMD ["node", "/app/server.js"]
# -> 400MB+ image

# Good: Use a language-specific Alpine image
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "server.js"]
# -> ~150MB image
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also create test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

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
        """Get processing results"""
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
        assert False, "Should have raised an exception"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following functionality.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on advanced patterns"""

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
        """Statistical information"""
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
    assert ex.add("d", 4) == False  # size limit
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
    """Efficient search using a hashmap"""
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## 13. FAQ

### Q1: Does `docker pull` download the entire image every time?

**A:** No. Docker downloads in layer units and skips layers that already exist locally. As a result, if the base image is the same, subsequent pulls will be much faster as only the diff is downloaded. Layers shown as `Already exists` in the `docker pull` output are being served from cache.

### Q2: What are Docker Hub's rate limits?

**A:** Anonymous users are limited to 100 pulls per 6 hours, and free accounts to 200 pulls per 6 hours. If you frequently pull in CI/CD, consider a Docker Hub paid plan or an alternative registry like GitHub Container Registry. You can also set up a mirror registry to work around rate limits. Check your current rate limit status with:

```bash
# Check remaining rate limit
TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/nginx:pull" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -sI -H "Authorization: Bearer $TOKEN" https://registry-1.docker.io/v2/library/nginx/manifests/latest 2>&1 | grep -i ratelimit
```

### Q3: What is a multi-platform image?

**A:** A multi-platform image is one tag that supports multiple architectures (amd64, arm64, etc.). It is managed via `docker manifest`, and when you run `docker pull`, the image appropriate for your host architecture is automatically selected. You can create one with `docker buildx build --platform linux/amd64,linux/arm64`. This is especially useful when you want a single tag to work on both Apple Silicon Macs (arm64) and Linux servers (amd64).

### Q4: How can I check image size?

**A:** Use `docker images` for local size and `docker manifest inspect` for size on the registry. Note that the SIZE shown by `docker images` is an apparent size that does not account for layer sharing. For actual disk usage, use `docker system df -v`. Layer-by-layer sizes can be checked with `docker history`. For more detailed analysis, the `dive` tool is effective, as it visualizes the contents of each layer and the image efficiency score.

### Q5: What should I do if a vulnerability is found in an image?

**A:** Response priority is as follows:
1. **CRITICAL**: Respond immediately. Fix by updating the base image or packages.
2. **HIGH**: Respond by the next release.
3. **MEDIUM/LOW**: Address in a planned manner. It may be acceptable to wait until a fix is released.
Regularly rebuilding from the base image often automatically fixes OS package vulnerabilities. It is also effective to use the `--ignore-unfixed` option to exclude vulnerabilities for which no fix is yet available.

### Q6: How should I back up a private registry?

**A:** Options include:
- **Volume backup**: Back up the registry data volume (`/var/lib/registry`)
- **S3 backend**: Configure registry storage to use S3, and use S3 versioning and replication for backup
- **Registry mirroring**: Use the `skopeo` tool to copy images to another registry
- **Periodic save**: Periodically save important images to files using `docker save`

```bash
# Copy an image with skopeo
skopeo copy \
  docker://registry.example.com/my-app:v1.0.0 \
  docker://backup-registry.example.com/my-app:v1.0.0

# Bulk backup script for all images
for repo in $(curl -s http://registry:5000/v2/_catalog | python3 -c "import sys,json;[print(r) for r in json.load(sys.stdin)['repositories']]"); do
  for tag in $(curl -s "http://registry:5000/v2/${repo}/tags/list" | python3 -c "import sys,json;[print(t) for t in json.load(sys.stdin)['tags']]"); do
    skopeo copy "docker://registry:5000/${repo}:${tag}" "dir:/backup/${repo}/${tag}"
  done
done
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 14. Summary

| Item | Key Point |
|---|---|
| Layer structure | Images are a stack of layers. Unchanged layers are reused from cache |
| Tags | Semantic versioning is recommended. Avoid relying on latest |
| Registries | Docker Hub, GHCR, ECR, etc. Choose based on use case and cost |
| Security | Regularly scan for vulnerabilities with Trivy / Docker Scout |
| Multi-platform | Use buildx to build images supporting both amd64 and arm64 |
| Signing | Use cosign + Sigstore to guarantee image authenticity |
| SBOM | Generate SBOM with Syft to visualize dependencies |
| Cleanup | Regularly free up disk with `docker system prune` |
| Save/Transfer | Use `docker save/load` to handle offline environments |
| CI/CD | Automate build, scan, and push with GitHub Actions / GitLab CI |
| Best practices | Manage with Dockerfile; commit is discouraged; use minimal base images |

---

## What to Read Next

- [../01-dockerfile/00-dockerfile-basics.md](../01-dockerfile/00-dockerfile-basics.md) -- Dockerfile Basics
- [../01-dockerfile/01-multi-stage-build.md](../01-dockerfile/01-multi-stage-build.md) -- Multi-Stage Builds
- [../01-dockerfile/02-optimization.md](../01-dockerfile/02-optimization.md) -- Dockerfile Optimization

---

## References

1. **Docker Documentation - Docker Hub** https://docs.docker.com/docker-hub/ -- Official Docker Hub documentation. Details on repository management, organization settings, and rate limits.
2. **GitHub Documentation - Working with the Container registry** https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry -- How to use GitHub Container Registry.
3. **Aqua Security - Trivy** https://aquasecurity.github.io/trivy/ -- Official Trivy documentation. Image scanning, SBOM generation, and CI integration.
4. **OCI Distribution Specification** https://github.com/opencontainers/distribution-spec -- Industry-standard specification for container image distribution.
5. **Sigstore - cosign** https://docs.sigstore.dev/signing/signing_with_containers/ -- Container image signing and verification.
6. **Anchore - Syft** https://github.com/anchore/syft -- Official documentation for the SBOM generation tool.
7. **dive** https://github.com/wagoodman/dive -- Docker image layer analysis tool.
8. **skopeo** https://github.com/containers/skopeo -- Tool for copying and inspecting container images.
