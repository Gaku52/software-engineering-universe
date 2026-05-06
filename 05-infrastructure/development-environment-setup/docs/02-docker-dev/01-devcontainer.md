# Dev Container

> By containerizing the development environment with `.devcontainer` configuration, you can build a system where every team member can instantly start developing in an identical environment through VS Code integration and GitHub Codespaces.

## What You Will Learn

1. **devcontainer.json structure and configuration patterns** -- Understand how to declaratively define container-based development environments and ensure reproducibility
2. **Integration with VS Code Remote - Containers** -- Build a workflow for transparent in-container development from your local VS Code
3. **Using and optimizing GitHub Codespaces** -- Achieve a development environment independent of local machines using cloud-based Dev Containers


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Docker for Development](./00-docker-for-dev.md)

---

## 1. Overview of Dev Containers

### 1.1 What is a Dev Container?

```
+------------------------------------------------------------------+
|           Traditional Development vs Dev Container               |
+------------------------------------------------------------------+
|                                                                  |
|  [Traditional]                                                   |
|  Developer A: macOS + Node 18 + Python 3.9 + MySQL 8.0          |
|  Developer B: Windows + Node 20 + Python 3.11 + MySQL 5.7       |
|  Developer C: Ubuntu + Node 16 + Python 3.10 + MariaDB          |
|  → Bugs caused by environment differences: "It works on my      |
|    machine though..."                                            |
|                                                                  |
|  [Dev Container]                                                 |
|  Developer A: macOS + Docker → Container (Node 20 + Python 3.11 + ...) |
|  Developer B: Windows + Docker → Container (Node 20 + Python 3.11 + ...) |
|  Developer C: Ubuntu + Docker → Container (Node 20 + Python 3.11 + ...) |
|  → Everyone uses the same environment. Config is managed as     |
|    code in .devcontainer/                                        |
|                                                                  |
+------------------------------------------------------------------+
```

A Dev Container is a system that defines the entire development environment as a container. The traditional approach of "write installation steps in the README and have each person run them" inevitably leads to environment differences due to OS variations, tool version discrepancies, and configuration drift. Dev Containers fundamentally solve this problem.

The main benefits of Dev Containers are as follows.

1. **Environment reproducibility**: Since all environment definitions are contained in `devcontainer.json`, the same environment is obtained regardless of who builds it or when
2. **Faster onboarding**: New team members can start developing by simply "cloning the repository and opening the Dev Container"
3. **Version control for environments**: Since the `.devcontainer/` directory is included in the repository, changes to the environment can be tracked with Git
4. **Preventing host machine pollution**: Since all tools and dependencies are confined within the container, the host machine stays clean
5. **Multi-project support**: Different runtime versions can be used per project without conflicts

### 1.2 Dev Container Architecture

```
+------------------------------------------------------------------+
|              Dev Container Architecture                          |
+------------------------------------------------------------------+
|                                                                  |
|  [Host Machine]                                                  |
|    +-- VS Code / Cursor                                          |
|    |     +-- Remote - Containers Extension                       |
|    |     |     (JSON-RPC over stdio)                             |
|    |     v                                                       |
|    +-- Docker Engine                                             |
|          |                                                       |
|          v                                                       |
|    +-- Dev Container ──────────────────────+                     |
|    |   |  Base Image (Ubuntu/Debian)       |                    |
|    |   |  + Node.js / Python / Go etc.     |                    |
|    |   |  + VS Code Server                 |                    |
|    |   |  + Extensions (inside container)  |                    |
|    |   |                                   |                    |
|    |   |  /workspace ← Project Mount       |                    |
|    |   +-----------------------------------+                    |
|    |                                                            |
|    +-- Volume: node_modules, .cache, etc.                       |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.3 Dev Container Lifecycle

Understanding the Dev Container lifecycle allows you to place configurations and commands at the appropriate timing.

```
+------------------------------------------------------------------+
|          Dev Container Lifecycle                                 |
+------------------------------------------------------------------+
|                                                                  |
|  1. "Reopen in Container" (VS Code) or "devcontainer up" (CLI)   |
|     |                                                            |
|     v                                                            |
|  2. Docker image build (Dockerfile / image / compose)            |
|     |  - Pulling the base image                                  |
|     |  - Installing Features (running install.sh)               |
|     |  - Building custom Dockerfile                             |
|     v                                                            |
|  3. Container creation and startup                               |
|     |  - Mounting volumes                                        |
|     |  - Configuring port forwarding                            |
|     |  - Injecting environment variables                        |
|     v                                                            |
|  4. initializeCommand (runs on host side)                        |
|     |                                                            |
|     v                                                            |
|  5. onCreateCommand (first creation only)                        |
|     |                                                            |
|     v                                                            |
|  6. updateContentCommand (on creation + Rebuild)                 |
|     |                                                            |
|     v                                                            |
|  7. postCreateCommand (after creation completes)                 |
|     |                                                            |
|     v                                                            |
|  8. postStartCommand (runs on each startup)                      |
|     |                                                            |
|     v                                                            |
|  9. postAttachCommand (runs on each editor attach)               |
|     |                                                            |
|     v                                                            |
|  10. VS Code Server starts + Extensions installed                |
|     → Ready for development                                      |
|                                                                  |
+------------------------------------------------------------------+
```

The appropriate use cases for each lifecycle command are as follows.

| Command | Execution Timing | Example Use Cases |
|---------|-----------------|-------------------|
| `initializeCommand` | Before container creation (host side) | Initializing Git submodules, generating .env files |
| `onCreateCommand` | First container creation only | Installing large dependencies, DB initialization |
| `updateContentCommand` | On creation + content updates | `npm ci`, runs during Prebuild |
| `postCreateCommand` | After container creation completes | DB migrations, Git hook setup |
| `postStartCommand` | On each container startup | Starting background services, warming caches |
| `postAttachCommand` | On each editor attach | Welcome messages, displaying environment status |

### 1.4 Dev Container Adoption Decision Flowchart

```
+------------------------------------------------------------------+
|        Dev Container Adoption Decision Flow                      |
+------------------------------------------------------------------+
|                                                                  |
|  Is it team development?                                         |
|    |                                                             |
|    +--[Yes]--> Are environment difference issues occurring?      |
|    |             |                                               |
|    |             +--[Yes]--> Introduce Dev Container            |
|    |             |                                               |
|    |             +--[No]---> How often do new members join?     |
|    |                          |                                  |
|    |                          +--[Frequently]--> Dev Container  |
|    |                          |                  recommended    |
|    |                          +--[Rarely]-----> Docker Compose  |
|    |                                             only           |
|    +--[No]----> Developing multiple projects simultaneously?    |
|                   |                                              |
|                   +--[Yes]--> Dev Container recommended         |
|                   |                                              |
|                   +--[No]---> Local development or             |
|                               Docker Compose                    |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 2. devcontainer.json Configuration

### 2.1 Basic Structure

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "My Project Dev",

  // Base image (for simple cases)
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20-bookworm",

  // Or when using a Dockerfile
  // "build": {
  //   "dockerfile": "Dockerfile",
  //   "context": "..",
  //   "args": { "NODE_VERSION": "20" }
  // },

  // Or when using Docker Compose
  // "dockerComposeFile": "docker-compose.yml",
  // "service": "app",
  // "workspaceFolder": "/workspace",

  // Features (modular installation of additional tools)
  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/node:1": {
      "version": "20"
    }
  },

  // VS Code settings
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "ms-vscode.vscode-typescript-next"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "typescript.tsdk": "node_modules/typescript/lib"
      }
    }
  },

  // Port forwarding
  "forwardPorts": [3000, 5432, 6379],
  "portsAttributes": {
    "3000": { "label": "App", "onAutoForward": "openBrowser" },
    "5432": { "label": "PostgreSQL", "onAutoForward": "silent" },
    "6379": { "label": "Redis", "onAutoForward": "silent" }
  },

  // Lifecycle commands
  "postCreateCommand": "npm ci",
  "postStartCommand": "npm run db:migrate",
  "postAttachCommand": "echo 'Dev Container ready!'",

  // Container user
  "remoteUser": "node",

  // Mount settings
  "mounts": [
    "source=${localWorkspaceFolder}/.env,target=/workspace/.env,type=bind,consistency=cached",
    "source=node_modules,target=/workspace/node_modules,type=volume"
  ],

  // Environment variables
  "remoteEnv": {
    "NODE_ENV": "development",
    "DATABASE_URL": "postgresql://postgres:postgres@db:5432/myapp_dev"
  }
}
```

### 2.2 Advanced Configuration with Dockerfile

```dockerfile
# .devcontainer/Dockerfile
FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

# System packages
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Global npm packages
RUN su node -c "npm install -g \
    tsx \
    prisma \
    @biomejs/biome \
    turbo"

# AWS CLI (optional)
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
    -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Custom shell configuration
COPY .devcontainer/.zshrc /home/node/.zshrc
RUN chown node:node /home/node/.zshrc
```

### 2.3 Multi-Stage Dockerfile Pattern

For large-scale projects, it is efficient to structure the Dev Container Dockerfile as a multi-stage build.

```dockerfile
# .devcontainer/Dockerfile (multi-stage)

# Stage 1: System dependencies
FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client-16 \
    redis-tools \
    jq \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: CLI tools
FROM base AS tools

# Terraform
RUN curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /usr/share/keyrings/hashicorp.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com bookworm main" \
    > /etc/apt/sources.list.d/hashicorp.list \
    && apt-get update && apt-get install -y terraform \
    && rm -rf /var/lib/apt/lists/*

# AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip && ./aws/install && rm -rf aws awscliv2.zip

# gcloud CLI (optional)
# RUN curl https://dl.google.com/dl/cloudsdk/release/google-cloud-sdk.tar.gz > /tmp/gcloud.tar.gz \
#     && mkdir -p /usr/local/gcloud && tar -C /usr/local/gcloud -xf /tmp/gcloud.tar.gz \
#     && /usr/local/gcloud/google-cloud-sdk/install.sh --quiet

# Stage 3: Final image
FROM tools AS devcontainer

# Node.js global packages (as node user)
RUN su node -c "npm install -g \
    tsx \
    prisma \
    @biomejs/biome \
    turbo \
    wrangler"

# Shell configuration
COPY .devcontainer/.zshrc /home/node/.zshrc
COPY .devcontainer/.p10k.zsh /home/node/.p10k.zsh
RUN chown -R node:node /home/node

# Workspace
WORKDIR /workspace
```

### 2.4 Integration with Docker Compose

```yaml
# .devcontainer/docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: .devcontainer/Dockerfile
    volumes:
      - ..:/workspace:cached
      - node_modules:/workspace/node_modules
    command: sleep infinity
    networks:
      - dev
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ../scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - dev

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - dev

volumes:
  node_modules:
  pgdata:

networks:
  dev:
```

### 2.5 Advanced devcontainer.json Configuration Options

#### Container Execution Options via runArgs

```jsonc
{
  // Additional arguments passed to Docker run
  "runArgs": [
    "--cap-add=SYS_PTRACE",   // Required for debugger attachment
    "--security-opt", "seccomp=unconfined",  // Performance profiling
    "--name", "my-devcontainer",
    "--network", "host",       // Host network mode (Linux only)
    "--gpus", "all"            // GPU access (ML development)
  ]
}
```

#### Difference Between containerEnv and remoteEnv

```jsonc
{
  // containerEnv: effective throughout the container (applies to lifecycle commands as well)
  "containerEnv": {
    "TZ": "Asia/Tokyo",
    "LANG": "ja_JP.UTF-8",
    "DOCKER_BUILDKIT": "1"
  },

  // remoteEnv: effective only in VS Code terminal processes
  "remoteEnv": {
    "NODE_ENV": "development",
    "DATABASE_URL": "postgresql://postgres:postgres@db:5432/myapp_dev",
    // Reference host environment variable
    "LOCAL_USER": "${localEnv:USER}",
    // Reference container environment variable
    "PATH": "${containerEnv:PATH}:/workspace/scripts"
  }
}
```

#### Managing Multiple Configuration Files

```
.devcontainer/
├── devcontainer.json          # Default configuration
├── Dockerfile
├── docker-compose.yml
├── post-create.sh
├── .zshrc
└── variants/
    ├── gpu/
    │   └── devcontainer.json  # For GPU development
    ├── minimal/
    │   └── devcontainer.json  # Lightweight version
    └── full/
        └── devcontainer.json  # Full configuration
```

Running "Dev Containers: Open Folder in Container..." from the VS Code command palette will display a selection dialog when multiple `devcontainer.json` files exist.

---

## 3. Dev Container Features

### 3.1 How Features Work

```
+------------------------------------------------------------------+
|              Dev Container Features                               |
+------------------------------------------------------------------+
|                                                                  |
|  devcontainer.json                                               |
|    "features": {                                                 |
|      "ghcr.io/devcontainers/features/node:1": {}                |
|      "ghcr.io/devcontainers/features/python:1": {}              |
|      "ghcr.io/devcontainers/features/go:1": {}                  |
|    }                                                             |
|         |                                                        |
|         v  Each Feature is distributed as an OCI image          |
|    +-----------------------------------+                         |
|    | install.sh (installation script) |                         |
|    | devcontainer-feature.json (def.) |                         |
|    +-----------------------------------+                         |
|         |                                                        |
|         v  Applied to the base image sequentially               |
|    Final Dev Container image                                     |
|                                                                  |
+------------------------------------------------------------------+
```

Features are distributed as packages conforming to the OCI (Open Container Initiative) specification. Each Feature consists of the following files.

```
my-feature/
├── devcontainer-feature.json   # Feature metadata and option definitions
├── install.sh                  # Installation script
└── README.md                   # Documentation
```

### 3.2 Commonly Used Features

| Feature | Purpose | Configuration Example |
|---------|---------|----------------------|
| `node` | Node.js runtime | `"version": "20"` |
| `python` | Python runtime | `"version": "3.11"` |
| `go` | Go runtime | `"version": "1.21"` |
| `rust` | Rust toolchain | `"profile": "default"` |
| `java` | Java JDK | `"version": "21"`, `"installGradle": true` |
| `docker-in-docker` | Docker inside container | Default is fine |
| `docker-outside-of-docker` | Share host Docker | Lightweight but host containers are visible |
| `github-cli` | gh command | Default is fine |
| `aws-cli` | AWS CLI v2 | Default is fine |
| `terraform` | Terraform | `"version": "latest"` |
| `kubectl-helm-minikube` | K8s tools | Default is fine |
| `git` | Latest Git | Default is fine |
| `git-lfs` | Git Large File Storage | Default is fine |
| `common-utils` | zsh, Oh My Zsh, etc. | `"installZsh": true` |
| `sshd` | SSH server | For remote debugging |

### 3.3 Creating Custom Features

Team-specific tools and configurations can be distributed as Features.

```jsonc
// my-org-feature/devcontainer-feature.json
{
  "id": "my-org-tools",
  "version": "1.0.0",
  "name": "My Organization Development Tools",
  "description": "Internal standard development toolset",
  "options": {
    "installLinter": {
      "type": "boolean",
      "default": true,
      "description": "Install the internal custom linter"
    },
    "environment": {
      "type": "string",
      "enum": ["staging", "production"],
      "default": "staging",
      "description": "Target environment to connect to"
    }
  }
}
```

```bash
#!/bin/bash
# my-org-feature/install.sh
set -e

# Retrieve options
INSTALL_LINTER="${INSTALLLINTER:-true}"
ENVIRONMENT="${ENVIRONMENT:-staging}"

echo "Installing My Org Tools..."

# Internal CLI tool
curl -fsSL https://internal.example.com/cli/install.sh | bash

# Custom linter
if [ "$INSTALL_LINTER" = "true" ]; then
    npm install -g @my-org/linter@latest
fi

# Environment configuration file
cat > /etc/my-org/config.json << EOF
{
  "environment": "$ENVIRONMENT",
  "apiEndpoint": "https://${ENVIRONMENT}.api.example.com"
}
EOF

echo "My Org Tools installed successfully!"
```

The GitHub Actions workflow for publishing a Feature to GitHub Container Registry is as follows.

```yaml
# .github/workflows/publish-feature.yml
name: Publish Dev Container Feature

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Publish Feature
        uses: devcontainers/action@v1
        with:
          publish-features: true
          base-path-to-features: ./features
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

After publishing, other projects can reference it as follows.

```jsonc
{
  "features": {
    "ghcr.io/my-org/devcontainer-features/my-org-tools:1": {
      "installLinter": true,
      "environment": "staging"
    }
  }
}
```

### 3.4 Feature Installation Order and Conflicts

Features are installed in the order listed in `devcontainer.json`. There are cases where the order matters.

```jsonc
{
  "features": {
    // 1. First install zsh with common-utils
    "ghcr.io/devcontainers/features/common-utils:2": {
      "installZsh": true,
      "configureZshAsDefaultShell": true
    },
    // 2. Then install Node.js (added to zsh's PATH)
    "ghcr.io/devcontainers/features/node:1": {
      "version": "20"
    },
    // 3. Finally Docker-in-Docker (starts Docker daemon)
    "ghcr.io/devcontainers/features/docker-in-docker:2": {
      "dockerDashComposeVersion": "v2"
    }
  }
}
```

When conflicts occur between Features, you can control the order with `overrideFeatureInstallOrder`.

```jsonc
{
  "overrideFeatureInstallOrder": [
    "ghcr.io/devcontainers/features/common-utils",
    "ghcr.io/devcontainers/features/node",
    "ghcr.io/devcontainers/features/docker-in-docker"
  ]
}
```

---

## 4. GitHub Codespaces

### 4.1 Codespaces Configuration

```jsonc
// .devcontainer/devcontainer.json (additional settings for Codespaces)
{
  "name": "My Project (Codespaces)",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",

  // Codespaces-specific settings
  "hostRequirements": {
    "cpus": 4,
    "memory": "8gb",
    "storage": "32gb"
  },

  // Prebuild settings (speeds up first startup)
  "updateContentCommand": "npm ci",
  "postCreateCommand": "npm run setup",

  // GitHub Codespaces-specific customizations
  "customizations": {
    "codespaces": {
      "openFiles": ["README.md", "src/index.ts"]
    },
    "vscode": {
      "extensions": [
        "GitHub.copilot",
        "dbaeumer.vscode-eslint"
      ]
    }
  },

  // Secrets (configured in Codespaces Settings)
  // GITHUB_TOKEN is automatically injected
  // Others are managed in Settings > Codespaces > Secrets
  "secrets": {
    "DATABASE_URL": {
      "description": "PostgreSQL connection string"
    },
    "API_KEY": {
      "description": "External API key for development"
    }
  }
}
```

### 4.2 Prebuild Configuration

```yaml
# .github/codespaces/prebuild-configuration.yml
# Configure in repository Settings > Codespaces > Prebuild configuration

# Or handle with devcontainer.json lifecycle commands:
# "updateContentCommand" runs during Prebuild
# "postCreateCommand" runs on first creation
# "postStartCommand" runs on each startup
```

The configuration to maximize Prebuild usage is as follows.

```jsonc
// .devcontainer/devcontainer.json (Prebuild optimized)
{
  "name": "My Project (Prebuild Optimized)",
  "build": {
    "dockerfile": "Dockerfile",
    "context": "..",
    "cacheFrom": "ghcr.io/my-org/my-project-devcontainer:latest"
  },

  // updateContentCommand: runs during Prebuild
  // → perform dependency installation here
  "updateContentCommand": {
    "install": "npm ci",
    "prisma": "npx prisma generate",
    "build-libs": "npm run build:libs"
  },

  // postCreateCommand: first creation only
  // → environment-specific tasks such as DB migrations
  "postCreateCommand": {
    "migrate": "npm run db:migrate",
    "seed": "npm run db:seed",
    "hooks": "npx husky install"
  },

  // postStartCommand: on each startup
  // → only tasks that complete quickly
  "postStartCommand": "npm run dev:prepare"
}
```

### 4.3 Codespaces Cost Management

Codespaces billing is charged on two axes: "compute cost (active hours)" and "storage cost (retention time)".

```
+------------------------------------------------------------------+
|           Codespaces Cost Management                             |
+------------------------------------------------------------------+
|                                                                  |
|  [Compute Cost]                                                  |
|  Machine Type    | Cores | RAM   | Hourly Rate (approx.)        |
|  ───────────────┼───────┼───────┼──────────────────             |
|  2-core         | 2     | 8 GB  | $0.18/hr                     |
|  4-core         | 4     | 16 GB | $0.36/hr                     |
|  8-core         | 8     | 32 GB | $0.72/hr                     |
|  16-core        | 16    | 64 GB | $1.44/hr                     |
|  32-core        | 32    | 128GB | $2.88/hr                     |
|                                                                  |
|  [Storage Cost]                                                  |
|  $0.07/GB/month (including Prebuild snapshots)                  |
|                                                                  |
|  [Free Tier (Personal)]                                          |
|  - 120 core-hours/month (60 hours on 2-core)                    |
|  - 15 GB storage/month                                          |
|                                                                  |
+------------------------------------------------------------------+
```

Best practices for cost optimization are as follows.

```jsonc
// Repository's .devcontainer/devcontainer.json
{
  // Specify minimum machine specs
  "hostRequirements": {
    "cpus": 2,        // 2 cores is sufficient for frontend development
    "memory": "8gb"
  }
}
```

The following settings are recommended at the Organization level policy (repository Settings > Codespaces).

| Setting | Recommended Value | Description |
|---------|------------------|-------------|
| Default idle timeout | 30 minutes | Auto-stop when idle |
| Maximum idle timeout | 60 minutes | Maximum value users can configure |
| Retention period | 14 days | Auto-delete unused Codespaces |
| Machine type policy | 2-core, 4-core | Restrict available machine types |
| Prebuild regions | 1 region | Reduce Prebuild in unnecessary regions |

### 4.4 Local Dev Container vs Codespaces Comparison

| Item | Local Dev Container | GitHub Codespaces |
|------|---------------------|-------------------|
| Execution location | Local machine | GitHub cloud |
| Docker required | Yes | No |
| Specs | Depends on local machine | 2-32 cores selectable |
| Cost | Docker only | Pay-as-you-go (free tier available) |
| Network | Local network | GitHub network |
| Startup speed | Fast after image pull | Can be accelerated with Prebuild |
| Offline | Possible | Not possible |
| Port forwarding | Direct localhost | Port forwarding (public URL available) |
| Git authentication | Local settings | GitHub auto-authentication |
| Secrets | .env files | Codespaces Secrets |
| GPU usage | Host GPU passthrough | GPU machine selectable |
| Collaboration | Not possible | Live Share integration available |
| Security | Local policy | Organization policy |

---

## 5. Practical Project Templates

### 5.1 Full-Stack Web Application

```jsonc
// .devcontainer/devcontainer.json (full-stack)
{
  "name": "Full Stack App",
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspace",

  "features": {
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "prisma.prisma",
        "bradlc.vscode-tailwindcss",
        "ms-azuretools.vscode-docker",
        "humao.rest-client"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.codeActionsOnSave": {
          "source.fixAll.eslint": "explicit"
        },
        "[prisma]": {
          "editor.defaultFormatter": "Prisma.prisma"
        }
      }
    }
  },

  "forwardPorts": [3000, 5432, 6379, 8025],
  "portsAttributes": {
    "3000": { "label": "Frontend", "onAutoForward": "openBrowser" },
    "5432": { "label": "PostgreSQL", "onAutoForward": "silent" },
    "6379": { "label": "Redis", "onAutoForward": "silent" },
    "8025": { "label": "MailHog UI", "onAutoForward": "notify" }
  },

  "postCreateCommand": "bash .devcontainer/post-create.sh",
  "postStartCommand": "npm run dev &",
  "remoteUser": "node"
}
```

### 5.2 Python + FastAPI Template

```jsonc
// .devcontainer/devcontainer.json (Python FastAPI)
{
  "name": "Python FastAPI Dev",
  "build": {
    "dockerfile": "Dockerfile",
    "context": ".."
  },

  "features": {
    "ghcr.io/devcontainers/features/python:1": {
      "version": "3.12"
    },
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "ms-python.vscode-pylance",
        "charliermarsh.ruff",
        "ms-python.mypy-type-checker",
        "mtxr.sqltools",
        "mtxr.sqltools-driver-pg",
        "humao.rest-client"
      ],
      "settings": {
        "python.defaultInterpreterPath": "/workspace/.venv/bin/python",
        "python.terminal.activateEnvironment": true,
        "[python]": {
          "editor.defaultFormatter": "charliermarsh.ruff",
          "editor.formatOnSave": true,
          "editor.codeActionsOnSave": {
            "source.fixAll.ruff": "explicit",
            "source.organizeImports.ruff": "explicit"
          }
        }
      }
    }
  },

  "forwardPorts": [8000, 5432],
  "portsAttributes": {
    "8000": { "label": "FastAPI", "onAutoForward": "openBrowser" },
    "5432": { "label": "PostgreSQL", "onAutoForward": "silent" }
  },

  "postCreateCommand": "pip install -e '.[dev]' && alembic upgrade head",
  "postStartCommand": "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &",
  "remoteUser": "vscode"
}
```

The corresponding Dockerfile is as follows.

```dockerfile
# .devcontainer/Dockerfile (Python)
FROM mcr.microsoft.com/devcontainers/python:3.12-bookworm

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*

# uv (fast pip alternative)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Poetry (optional)
# RUN curl -sSL https://install.python-poetry.org | python3 -

WORKDIR /workspace
```

### 5.3 Go + gRPC Template

```jsonc
// .devcontainer/devcontainer.json (Go gRPC)
{
  "name": "Go gRPC Dev",
  "image": "mcr.microsoft.com/devcontainers/go:1.22-bookworm",

  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/devcontainers-contrib/features/protoc:1": {}
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "golang.go",
        "zxh404.vscode-proto3",
        "ms-azuretools.vscode-docker"
      ],
      "settings": {
        "go.toolsManagement.autoUpdate": true,
        "go.lintTool": "golangci-lint",
        "go.lintFlags": ["--fast"],
        "[go]": {
          "editor.formatOnSave": true,
          "editor.codeActionsOnSave": {
            "source.organizeImports": "explicit"
          }
        },
        "gopls": {
          "ui.semanticTokens": true,
          "formatting.gofumpt": true
        }
      }
    }
  },

  "postCreateCommand": "go mod download && go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest",
  "forwardPorts": [8080, 50051],
  "portsAttributes": {
    "8080": { "label": "HTTP API", "onAutoForward": "openBrowser" },
    "50051": { "label": "gRPC", "onAutoForward": "silent" }
  },
  "remoteUser": "vscode"
}
```

### 5.4 Monorepo Template

The Dev Container configuration for monorepo projects using Turborepo or Nx is as follows.

```jsonc
// .devcontainer/devcontainer.json (Monorepo)
{
  "name": "Monorepo Dev",
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspace",

  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "prisma.prisma",
        "bradlc.vscode-tailwindcss",
        "ms-vscode.vscode-typescript-next",
        "biomejs.biome"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "eslint.workingDirectories": [
          { "pattern": "apps/*" },
          { "pattern": "packages/*" }
        ],
        "typescript.tsdk": "node_modules/typescript/lib",
        "search.exclude": {
          "**/node_modules": true,
          "**/.turbo": true,
          "**/dist": true
        }
      }
    }
  },

  "forwardPorts": [3000, 3001, 5432, 6379],
  "portsAttributes": {
    "3000": { "label": "Web App", "onAutoForward": "openBrowser" },
    "3001": { "label": "Admin", "onAutoForward": "notify" },
    "5432": { "label": "PostgreSQL", "onAutoForward": "silent" },
    "6379": { "label": "Redis", "onAutoForward": "silent" }
  },

  // For monorepo: install pnpm + turbo
  "postCreateCommand": "corepack enable && pnpm install && pnpm turbo run build --filter='./packages/*'",
  "postStartCommand": "pnpm turbo run dev --filter='./apps/*' &",
  "remoteUser": "node",

  // Important for monorepo: use Volume for node_modules
  "mounts": [
    "source=monorepo-node_modules,target=/workspace/node_modules,type=volume",
    "source=monorepo-turbo-cache,target=/workspace/.turbo,type=volume"
  ]
}
```

### 5.5 Setup Script

```bash
#!/bin/bash
# .devcontainer/post-create.sh

set -euo pipefail

echo "=== Dev Container Setup ==="

# Install dependencies
echo ">>> Installing dependencies..."
npm ci

# Database migrations
echo ">>> Running database migrations..."
npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate deploy

# Seed data
echo ">>> Seeding database..."
npx prisma db seed 2>/dev/null || echo "No seed script found, skipping"

# Git hooks
echo ">>> Setting up Git hooks..."
npx husky install 2>/dev/null || echo "Husky not configured, skipping"

# Completion message
echo ""
echo "========================================="
echo "  Dev Container is ready!"
echo "  Run 'npm run dev' to start developing"
echo "========================================="
```

### 5.6 Advanced Setup Script (Monorepo Support)

```bash
#!/bin/bash
# .devcontainer/post-create.sh (Monorepo-compatible version)

set -euo pipefail

# Colored output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "============================================"
echo "   Dev Container Post-Create Setup"
echo "============================================"
echo ""

# 1. Configure package manager
log_info "Configuring package manager..."
if command -v corepack &> /dev/null; then
    corepack enable
    log_ok "Corepack enabled"
fi

# 2. Install dependencies
log_info "Installing dependencies..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile
    log_ok "pnpm install completed"
elif [ -f "yarn.lock" ]; then
    yarn install --frozen-lockfile
    log_ok "yarn install completed"
elif [ -f "package-lock.json" ]; then
    npm ci
    log_ok "npm ci completed"
else
    log_warn "No lockfile found, running npm install"
    npm install
fi

# 3. Prepare database
log_info "Setting up database..."
MAX_RETRIES=30
RETRY_COUNT=0
until pg_isready -h db -U postgres -q 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        log_error "Database connection timeout after ${MAX_RETRIES} attempts"
        exit 1
    fi
    log_info "Waiting for database... (${RETRY_COUNT}/${MAX_RETRIES})"
    sleep 1
done
log_ok "Database is ready"

# Migrations
if [ -f "prisma/schema.prisma" ]; then
    npx prisma migrate deploy
    npx prisma generate
    log_ok "Prisma migrations applied"
elif [ -d "alembic" ]; then
    alembic upgrade head
    log_ok "Alembic migrations applied"
fi

# Seed data
if npm run --silent seed 2>/dev/null; then
    log_ok "Database seeded"
else
    log_warn "No seed script found, skipping"
fi

# 4. Git configuration
log_info "Configuring Git..."
git config --global --add safe.directory /workspace
if [ -f ".husky/_/husky.sh" ]; then
    npx husky install
    log_ok "Git hooks configured"
fi

# 5. Environment variable check
log_info "Checking environment..."
REQUIRED_VARS=("DATABASE_URL" "NODE_ENV")
MISSING_VARS=()
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR:-}" ]; then
        MISSING_VARS+=("$VAR")
    fi
done
if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_warn "Missing environment variables: ${MISSING_VARS[*]}"
else
    log_ok "All required environment variables set"
fi

# 6. Done
echo ""
echo "============================================"
echo -e "  ${GREEN}Dev Container is ready!${NC}"
echo ""
echo "  Available commands:"
echo "    npm run dev      - Start development server"
echo "    npm run test     - Run tests"
echo "    npm run lint     - Run linter"
echo "    npm run build    - Build for production"
echo "============================================"
```

---

## 6. devcontainer CLI

### 6.1 CLI Installation and Basic Operations

Use the `devcontainer` CLI when you want to operate Dev Containers without VS Code.

```bash
# Install the CLI
npm install -g @devcontainers/cli

# Start Dev Container
devcontainer up --workspace-folder .

# Run a command inside the container
devcontainer exec --workspace-folder . npm run test

# Build the Dev Container only
devcontainer build --workspace-folder .

# Test Features
devcontainer features test --features ./my-feature
```

### 6.2 Using in CI/CD

Using Dev Containers in CI/CD pipelines allows you to perfectly align the development environment with the CI environment.

```yaml
# .github/workflows/ci.yml
name: CI (Dev Container)

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Dev Container CLI
        run: npm install -g @devcontainers/cli

      - name: Build Dev Container
        run: devcontainer build --workspace-folder .

      - name: Run Tests in Dev Container
        run: devcontainer exec --workspace-folder . npm run test

      - name: Run Lint in Dev Container
        run: devcontainer exec --workspace-folder . npm run lint

      - name: Run Type Check
        run: devcontainer exec --workspace-folder . npm run type-check
```

A more efficient method is to build the Dev Container with caching.

```yaml
# .github/workflows/ci-cached.yml
name: CI (Dev Container with Cache)

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-devcontainer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Pre-build Dev Container
        uses: devcontainers/ci@v0.3
        with:
          imageName: ghcr.io/${{ github.repository }}/devcontainer
          cacheFrom: ghcr.io/${{ github.repository }}/devcontainer:latest
          push: always

  test:
    needs: build-devcontainer
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Tests
        uses: devcontainers/ci@v0.3
        with:
          imageName: ghcr.io/${{ github.repository }}/devcontainer
          cacheFrom: ghcr.io/${{ github.repository }}/devcontainer:latest
          push: never
          runCmd: |
            npm run test
            npm run lint
            npm run type-check
```

---

## 7. Multi-Editor Support

### 7.1 JetBrains IDEs (Gateway)

Using JetBrains Gateway, you can connect to Dev Containers from IntelliJ IDEA / WebStorm / PyCharm and more.

```jsonc
// .devcontainer/devcontainer.json (JetBrains support)
{
  "name": "My Project",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",

  "customizations": {
    // VS Code settings
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    },
    // JetBrains settings
    "jetbrains": {
      "backend": "WebStorm",
      "plugins": [
        "com.intellij.plugins.tailwindcss"
      ]
    }
  }
}
```

### 7.2 Neovim / Terminal Editors

```bash
# Start container with devcontainer CLI
devcontainer up --workspace-folder .

# Launch Neovim inside the container
devcontainer exec --workspace-folder . nvim

# Or connect directly with docker exec
docker exec -it $(docker ps -q --filter "label=devcontainer.local_folder=$(pwd)") bash
```

The Features configuration for Neovim users is as follows.

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "installZsh": true
    },
    "ghcr.io/rio/features/neovim:1": {
      "version": "stable"
    }
  },
  "postCreateCommand": "mkdir -p /home/node/.config && ln -sf /workspace/.devcontainer/nvim /home/node/.config/nvim"
}
```

### 7.3 DevPod

DevPod is an open-source Dev Container client that can run Dev Containers on any backend (local Docker, SSH, Kubernetes, cloud).

```bash
# Install DevPod (macOS)
brew install loft-sh/tap/devpod

# Start Dev Container with local Docker
devpod up . --provider docker

# Run on a remote machine via SSH
devpod up . --provider ssh --option HOST=dev.example.com

# Run on a Kubernetes cluster
devpod up . --provider kubernetes
```

---

## 8. Performance Optimization

### 8.1 Reducing Build Time

```jsonc
// .devcontainer/devcontainer.json
{
  "build": {
    "dockerfile": "Dockerfile",
    "context": "..",
    // Leverage build cache
    "cacheFrom": "ghcr.io/my-org/my-project-devcontainer:latest",
    "args": {
      "BUILDKIT_INLINE_CACHE": "1"
    }
  }
}
```

```dockerfile
# .devcontainer/Dockerfile (cache optimized)
FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

# Layers that change infrequently come first
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client-16 \
    redis-tools \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Global npm packages also in a separate layer
RUN su node -c "npm install -g tsx prisma @biomejs/biome turbo"

# Project dependencies are handled in postCreateCommand
# (Including them in Dockerfile causes a rebuild on every source change)
```

### 8.2 Improving I/O Performance

On macOS / Windows, the Docker filesystem bridge becomes a bottleneck. You can improve this with the following approaches.

```jsonc
{
  // 1. Use Volume for node_modules (most effective)
  "mounts": [
    "source=myproject-node_modules,target=/workspace/node_modules,type=volume",
    "source=myproject-turbo-cache,target=/workspace/.turbo,type=volume",
    "source=myproject-next-cache,target=/workspace/.next,type=volume"
  ],

  // 2. Set workspace consistency to cached
  // (configured in docker-compose.yml)
  // volumes:
  //   - ..:/workspace:cached

  // 3. Exclude unnecessary files from sync
  // (VS Code settings)
  "customizations": {
    "vscode": {
      "settings": {
        "files.watcherExclude": {
          "**/node_modules/**": true,
          "**/.git/objects/**": true,
          "**/.turbo/**": true,
          "**/dist/**": true
        }
      }
    }
  }
}
```

### 8.3 Using OrbStack (macOS)

On macOS, using OrbStack instead of Docker Desktop dramatically improves Dev Container performance.

```bash
# Install OrbStack
brew install --cask orbstack

# OrbStack is compatible with the Docker CLI
# Dev Containers work without any configuration changes
docker version  # Shows the OrbStack Docker engine
```

The advantages of OrbStack are as follows.

| Comparison | Docker Desktop | OrbStack |
|------------|---------------|----------|
| Memory usage | 2-4 GB | 0.5-1 GB |
| CPU usage (idle) | 5-15% | ~0% |
| File I/O (macOS) | Slow (VirtioFS) | Fast (proprietary implementation) |
| Startup time | 30-60 seconds | 2-5 seconds |
| Network | NAT | Near-native |
| `npm install` speed | Baseline | 2-3x faster |

---

## 9. Security

### 9.1 Secret Management

```jsonc
// .devcontainer/devcontainer.json
{
  // NG: Hardcoded secrets
  // "remoteEnv": {
  //   "API_KEY": "sk-1234567890abcdef"
  // }

  // OK: Reference host environment variables
  "remoteEnv": {
    "API_KEY": "${localEnv:API_KEY}",
    "DATABASE_URL": "${localEnv:DATABASE_URL}"
  },

  // OK: Bind mount .env file (add to .gitignore)
  "mounts": [
    "source=${localWorkspaceFolder}/.env.local,target=/workspace/.env.local,type=bind,consistency=cached"
  ]
}
```

### 9.2 Container Permission Settings

```jsonc
{
  // Run as non-root user
  "remoteUser": "node",

  // Minimum required capabilities
  "runArgs": [
    "--cap-drop=ALL",
    "--cap-add=SYS_PTRACE",   // Required for debugger
    "--cap-add=NET_RAW"       // Required for network tools in some cases
  ],

  // Read-only filesystem (high security environments)
  // "runArgs": ["--read-only", "--tmpfs=/tmp"]
}
```

### 9.3 Network Isolation

```yaml
# .devcontainer/docker-compose.yml
services:
  app:
    build:
      context: ..
      dockerfile: .devcontainer/Dockerfile
    networks:
      - dev-internal  # Internal network only

  db:
    image: postgres:16-alpine
    networks:
      - dev-internal
    # ports not exposed (container-to-container communication only)

networks:
  dev-internal:
    internal: true  # Block external access
```

---

## 10. Troubleshooting

### 10.1 Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|---------|
| Container does not start | Dockerfile build error | Check error log with `devcontainer build` |
| Permission error (EACCES) | UID/GID mismatch | Check `remoteUser` setting, fix Volume permissions |
| npm install is slow | Bind mount for node_modules | Switch to Volume mount |
| Port forwarding does not work | Port conflict | Check with `lsof -i :PORT`, change to another port |
| Git authentication failure | SSH key not mounted | Use `ssh-agent` Feature |
| Extension does not work | Not installed inside container | Add to `extensions` and Rebuild |
| Settings not applied after Rebuild | Cache | Use `Dev Containers: Rebuild Without Cache` |
| Volume data persists | Old Volume | Delete with `docker volume prune` |
| Slow on WSL2 | Windows filesystem | Place repository inside WSL2 |
| Does not work on Apple Silicon | amd64 image | Specify `--platform linux/arm64` |

### 10.2 Debug Procedure

```bash
# 1. Check build errors with Dev Container CLI
devcontainer build --workspace-folder . --log-level trace 2>&1 | tee build.log

# 2. Check container status
docker ps -a --filter "label=devcontainer.local_folder"

# 3. Check container logs
docker logs <container-id>

# 4. Connect directly inside the container
docker exec -it <container-id> bash

# 5. Check Volume status
docker volume ls --filter "label=devcontainer"

# 6. Check network status
docker network ls
docker network inspect <network-name>

# 7. Check resource usage
docker stats --no-stream

# 8. Check Dev Container configuration
devcontainer read-configuration --workspace-folder .
```

### 10.3 Apple Silicon (ARM64) Support

On Apple Silicon Macs, some images may only be available for amd64.

```jsonc
{
  "build": {
    "dockerfile": "Dockerfile",
    "args": {
      // Explicitly specify platform
      "TARGETPLATFORM": "linux/arm64"
    }
  },

  // Use amd64 image with Rosetta 2 emulation (slow)
  // "runArgs": ["--platform", "linux/amd64"]
}
```

```dockerfile
# .devcontainer/Dockerfile (multi-architecture)
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

ARG TARGETPLATFORM
ARG BUILDPLATFORM

# Install architecture-specific binaries
RUN case "$TARGETPLATFORM" in \
    "linux/arm64") ARCH="aarch64" ;; \
    "linux/amd64") ARCH="x86_64" ;; \
    *) echo "Unsupported platform: $TARGETPLATFORM" && exit 1 ;; \
    esac \
    && curl -fsSL "https://example.com/tool-${ARCH}.tar.gz" | tar xzf - -C /usr/local/bin/
```

---

## Anti-Patterns

### Anti-Pattern 1: Bloated Base Image

```jsonc
// NG: Installing a large number of unnecessary tools
{
  "image": "ubuntu:22.04",
  "postCreateCommand": "apt-get update && apt-get install -y nodejs npm python3 python3-pip golang-go rustc ruby default-jdk php dotnet-sdk-7.0 && npm install -g yarn pnpm tsx typescript..."
}

// OK: Minimal official Dev Container image + Features
{
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20-bookworm",
  "features": {
    "ghcr.io/devcontainers/features/github-cli:1": {}
  }
}
```

**Problem**: A bloated base image leads to increased build times, wasted disk space, and increased security risks. Using Dev Container Features allows you to add necessary tools in a modular fashion.

### Anti-Pattern 2: Bind Mounting node_modules

```jsonc
// NG: Sharing node_modules with host (worst performance)
{
  "mounts": []
  // By default the entire project is bind-mounted,
  // and node_modules is also synchronized between host and container
}

// OK: Isolate node_modules into a named volume
{
  "mounts": [
    "source=myproject-node_modules,target=/workspace/node_modules,type=volume"
  ]
}
```

**Problem**: On macOS / Windows, bind mount I/O performance is significantly lower than native Linux. Bind mounting a directory with many small files like `node_modules` can make `npm install` and builds more than 10x slower.

### Anti-Pattern 3: Stuffing Everything into postCreateCommand

```jsonc
// NG: Long one-liner command
{
  "postCreateCommand": "npm ci && npx prisma migrate deploy && npx prisma db seed && npx husky install && npm run build:libs && echo 'done'"
}

// OK: Separate into an external script
{
  "postCreateCommand": "bash .devcontainer/post-create.sh"
}

// Even better: Separate lifecycle tasks
{
  "updateContentCommand": "npm ci",
  "postCreateCommand": {
    "migrate": "npx prisma migrate deploy",
    "seed": "npx prisma db seed",
    "hooks": "npx husky install"
  },
  "postStartCommand": "npm run dev:prepare"
}
```

**Problem**: Long one-liner commands are hard to debug, and it is difficult to identify where the process stopped when some commands fail. Separating into an external script or defining each task with a name in object format improves visibility.

### Anti-Pattern 4: Consistently Using Large Machine Types in Codespaces

```jsonc
// NG: Machine type larger than necessary
{
  "hostRequirements": {
    "cpus": 16,
    "memory": "64gb"
  }
}

// OK: Minimum specs appropriate for the task
{
  "hostRequirements": {
    "cpus": 4,
    "memory": "16gb"
  }
}
```

**Problem**: Large machine types have a higher hourly rate. 2-core is sufficient for frontend development, and if builds are slow, it is more cost-effective to address it with Prebuild.

### Anti-Pattern 5: Not Considering Feature Installation Order

```jsonc
// NG: Not installing common-utils before Node.js Feature
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": { "version": "20" },
    "ghcr.io/devcontainers/features/common-utils:2": {
      "installZsh": true
    }
  }
}

// OK: Install common-utils first
{
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "installZsh": true,
      "configureZshAsDefaultShell": true
    },
    "ghcr.io/devcontainers/features/node:1": { "version": "20" }
  }
}
```

**Problem**: Depending on the installation order of Features, issues may arise with PATH settings or shell initialization scripts. Since `common-utils` configures the shell environment, it should be installed before other Features.

---

## FAQ

### Q1: Can Dev Containers only be used when the entire team uses VS Code?

**A**: No. Dev Container is published as an Open Specification (devcontainers.github.io), and besides VS Code, JetBrains IntelliJ / WebStorm (via Gateway), Neovim (via devcontainer CLI), GitHub Codespaces (browser), and DevPod all support it. Using the `devcontainer` CLI directly also allows combining it with any editor.

### Q2: How can I use Docker commands from inside a Dev Container?

**A**: Using the `docker-in-docker` Feature is the simplest approach. This starts an independent Docker daemon inside the container. Another method is the `docker-outside-of-docker` Feature, which mounts the host Docker socket. The former is clean but consumes more resources, while the latter is lightweight but allows seeing the host's containers. `docker-in-docker` is recommended when building containers during CI/CD tests.

### Q3: How much can Prebuild in Codespaces reduce startup time?

**A**: It depends on project size, but for a project where `npm ci` + DB migrations take 3-5 minutes, configuring Prebuild can reduce startup to within 30 seconds. Prebuild automatically runs when pushing to the specified branch and pre-caches the container image and dependencies. The effect is especially large for large monorepos.

### Q4: What is the procedure for introducing Dev Containers into an existing project?

**A**: The following steps are recommended.

1. Run "Dev Containers: Add Dev Container Configuration Files..." from the VS Code command palette
2. Select a template matching your project's stack (e.g., Node.js + TypeScript)
3. Add necessary Features (GitHub CLI, Docker-in-Docker, etc.)
4. Customize the generated `.devcontainer/devcontainer.json`
5. Add project-specific setup to `postCreateCommand`
6. Ask team members to test and incorporate feedback
7. Commit `.devcontainer/` to the repository

### Q5: How can I use SSH keys inside a Dev Container?

**A**: The VS Code Remote - Containers extension automatically forwards the host SSH Agent into the container. On macOS / Linux, if keys are registered with the Agent via `ssh-add`, they can be used transparently inside the container. On Windows, use Pageant or the OpenSSH Agent service. For explicit configuration, use the following.

```jsonc
{
  // Explicitly forward SSH Agent
  "mounts": [
    "source=${localEnv:SSH_AUTH_SOCK},target=/ssh-agent,type=bind"
  ],
  "remoteEnv": {
    "SSH_AUTH_SOCK": "/ssh-agent"
  }
}
```

### Q6: How can I access a local GPU while using a Dev Container?

**A**: For NVIDIA GPUs, install `nvidia-container-toolkit` on the host and apply the following settings.

```jsonc
{
  "runArgs": [
    "--gpus", "all"
  ],
  "features": {
    "ghcr.io/devcontainers/features/nvidia-cuda:1": {
      "installCudnn": true,
      "cudaVersion": "12.3"
    }
  }
}
```

### Q7: What is a Codespaces dotfiles repository?

**A**: By specifying your dotfiles repository (e.g., `username/dotfiles`) in GitHub Settings > Codespaces > Dotfiles repository, that repository is automatically cloned on every Codespace startup, and one of `install.sh` / `setup.sh` / `bootstrap.sh` is executed. This is a mechanism for applying personal settings such as `.zshrc`, `.gitconfig`, and `.vimrc` to all Codespaces.

---

## Summary

| Item | Key Point |
|------|-----------|
| devcontainer.json | Declarative definition file for container-based development environments |
| Base image | Official images from mcr.microsoft.com/devcontainers/ are recommended |
| Features | Modular tool installation mechanism; alternative to Dockerfile |
| Custom Feature | Can be distributed internally as OCI-compliant packages |
| Docker Compose integration | Manage dependent services like DB and Redis together |
| VS Code integration | Centrally manage extensions and settings inside the container |
| JetBrains support | Connect from IntelliJ / WebStorm via Gateway |
| devcontainer CLI | Operate containers from CLI and integrate with CI without VS Code |
| GitHub Codespaces | Cloud-based Dev Container. Fast startup with Prebuild |
| Cost management | Restrict machine types, idle timeout, Prebuild optimization |
| Performance | Use Volume mount for node_modules to ensure I/O performance |
| OrbStack | Faster, lighter alternative to Docker Desktop on macOS |
| Multi-editor | Also usable from non-VS Code editors via devcontainer CLI / DevPod |
| Security | Non-root execution, capability restrictions, network isolation |
| Apple Silicon | Recommended to use ARM64 native images |

## Guides to Read Next

- [Dockerizing Local Services](./02-local-services.md) -- Docker configuration for PostgreSQL / Redis / MailHog
- [Project Standards](../03-team-setup/00-project-standards.md) -- Team standardization of EditorConfig / .npmrc / .nvmrc
- [Onboarding Automation](../03-team-setup/01-onboarding-automation.md) -- Automating new member setup

## References

1. **Dev Container Specification** -- https://containers.dev/ -- Official Dev Container specification and Features registry
2. **VS Code Dev Containers Documentation** -- https://code.visualstudio.com/docs/devcontainers/containers -- How to use Dev Containers in VS Code
3. **GitHub Codespaces Documentation** -- https://docs.github.com/en/codespaces -- Details on Codespaces configuration, Prebuild, and billing
4. **Dev Container Features List** -- https://github.com/devcontainers/features -- Official Features repository and how to create custom Features
5. **devcontainer CLI** -- https://github.com/devcontainers/cli -- CLI tool repository and documentation
6. **DevPod** -- https://devpod.sh/ -- Open-source Dev Container client
7. **OrbStack** -- https://orbstack.dev/ -- High-performance Docker runtime for macOS
