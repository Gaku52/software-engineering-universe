# Orchestration Overview

> Understand the fundamental concepts of orchestration for automatically managing groups of containers across multiple hosts, and the criteria for choosing between Docker Swarm and Kubernetes.

---

## What You Will Learn

1. Understand the **problems container orchestration solves** and its core concepts
2. **Compare Docker Swarm and Kubernetes** and establish appropriate selection criteria
3. Grasp the **key components of orchestration** (scheduling, self-healing, scaling)
4. Master **practical cluster building with Docker Swarm** and service management
5. Understand **managed Kubernetes services** and their selection guidelines


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Why Orchestration Is Needed

`docker compose` on a single host is sufficient for development and small-scale operations, but in production environments you face the following challenges.

### Problems Orchestration Solves

```
┌─── Single Host (docker compose) ───┐     ┌─── Orchestration ───────────────┐
│                                    │     │                                │
│  ❌ Host failure = all services    │     │  ✅ Auto-recovery on another   │
│     go down                        │     │     host during failures       │
│  ❌ Cannot scale out               │     │  ✅ Automatic distribution      │
│  ❌ Zero-downtime deploy is hard   │     │     across multiple hosts      │
│  ❌ Load balancing requires        │     │  ✅ Rolling updates             │
│     manual configuration          │     │  ✅ Built-in load balancer      │
│  ❌ Limited secrets management     │     │  ✅ Encrypted secrets store     │
│                                    │     │  ✅ Declarative state management│
└────────────────────────────────────┘     └────────────────────────────────┘
```

### Key Functions of Orchestration

```
┌──────────────────────────────────────────────────────────┐
│               Orchestrator                               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Scheduling  │  │ Self-Healing │  │   Scaling    │  │
│  │              │  │              │  │              │  │
│  │  Decides     │  │ Auto-restart │  │ Auto scale   │  │
│  │  which host  │  │ failed       │  │ up/down      │  │
│  │  to place on │  │ containers   │  │ based on load│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Service    │  │   Rolling    │  │   Secrets    │  │
│  │  Discovery   │  │   Updates    │  │  Management  │  │
│  │              │  │              │  │              │  │
│  │  Auto-connect│  │  Update      │  │  Encrypted   │  │
│  │  via DNS/LB  │  │  without     │  │  and safely  │  │
│  │              │  │  downtime    │  │  distributed │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Decision Criteria for Moving from Single Host to Multiple Hosts

| Decision Point | Docker Compose Is Sufficient | Orchestration Required |
|----------------|------------------------------|------------------------|
| Host failure tolerance | A few minutes of downtime acceptable | Zero downtime mandatory |
| Traffic volume | Processable on a single server | Horizontal scaling needed |
| Deploy frequency | About once a week | Multiple times per day |
| Team size | 1–3 people | 5 or more people |
| Number of containers | ~10 | 20 or more |
| Budget | Minimal | Operational cost acceptable |

---

## 2. Docker Swarm

Orchestration functionality built into Docker Engine. No additional installation required; it can be used as an extension of the Docker CLI.

### Code Example 1: Building a Docker Swarm Cluster

```bash
# Initialize Swarm on the manager node
docker swarm init --advertise-addr 192.168.1.10

# Join worker nodes using the token that was output
# Worker Node 1:
docker swarm join --token SWMTKN-1-xxx 192.168.1.10:2377

# Worker Node 2:
docker swarm join --token SWMTKN-1-xxx 192.168.1.10:2377

# Check cluster status
docker node ls
# ID          HOSTNAME   STATUS    AVAILABILITY   MANAGER STATUS
# abc123 *    manager1   Ready     Active         Leader
# def456      worker1    Ready     Active
# ghi789      worker2    Ready     Active
```

### Swarm Cluster Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Docker Swarm Cluster                      │
│                                                            │
│  ┌──────────────────┐                                     │
│  │  Manager Node 1  │  ← Leader                          │
│  │  (192.168.1.10)  │                                     │
│  │  ┌────────────┐  │  · Raft consensus protocol         │
│  │  │ Raft Store │  │  · Cluster state management        │
│  │  │ Scheduler  │  │  · Task scheduling                 │
│  │  │ Dispatcher │  │  · Service API                     │
│  │  │ Allocator  │  │  · Network management              │
│  │  └────────────┘  │                                     │
│  └──────────────────┘                                     │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │  Manager Node 2  │  │  Manager Node 3  │  ← HA setup │
│  │  (Reachable)     │  │  (Reachable)     │              │
│  │  Backup          │  │  Backup          │              │
│  └──────────────────┘  └──────────────────┘              │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │  Worker Node 1   │  │  Worker Node 2   │              │
│  │  (192.168.1.11)  │  │  (192.168.1.12)  │              │
│  │  ┌────────────┐  │  │  ┌────────────┐  │              │
│  │  │ Container  │  │  │  │ Container  │  │              │
│  │  │ Container  │  │  │  │ Container  │  │              │
│  │  │ Container  │  │  │  │ Container  │  │              │
│  │  └────────────┘  │  │  └────────────┘  │              │
│  └──────────────────┘  └──────────────────┘              │
└──────────────────────────────────────────────────────────┘
```

### High Availability (HA) Configuration Design

```bash
# An odd number of manager nodes is recommended for HA configurations
# Relationship between number of managers and fault tolerance:

# Managers: 1 → Fault tolerance: 0 (not recommended)
# Managers: 3 → Fault tolerance: 1 (minimum HA configuration)
# Managers: 5 → Fault tolerance: 2 (recommended HA configuration)
# Managers: 7 → Fault tolerance: 3 (large scale)

# Adding a manager
docker swarm join-token manager
# Run the displayed command on the new node

# Changing node roles
docker node promote worker1     # Worker → Manager
docker node demote manager3     # Manager → Worker

# Node maintenance mode
docker node update --availability drain worker1
# → Tasks on worker1 are moved to other nodes

# After maintenance is complete
docker node update --availability active worker1
```

### Code Example 2: Deploying a Swarm Service

```bash
# Create a service
docker service create \
  --name web \
  --replicas 3 \
  --publish published=80,target=80 \
  --update-delay 10s \
  --update-parallelism 1 \
  --rollback-parallelism 1 \
  --rollback-monitor 30s \
  --restart-condition on-failure \
  --limit-memory 256M \
  --limit-cpu 0.5 \
  nginx:alpine

# Check service status
docker service ls
docker service ps web

# Scaling
docker service scale web=5

# Rolling update
docker service update --image nginx:1.25-alpine web

# Rollback
docker service rollback web

# Check service logs
docker service logs web
docker service logs -f --tail 100 web

# Detailed service information
docker service inspect --pretty web
```

### Code Example 3: Docker Stack (Deploy to Swarm in Compose Format)

```yaml
# docker-stack.yml
version: "3.9"

services:
  web:
    image: nginx:alpine
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        monitor: 30s
        order: start-first  # Start new task before stopping old task
      rollback_config:
        parallelism: 1
        order: stop-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      placement:
        constraints:
          - node.role == worker
        preferences:
          - spread: node.id  # Distribute evenly across nodes
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
        reservations:
          cpus: "0.1"
          memory: 64M
    ports:
      - "80:80"
    networks:
      - frontend
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:80/"]
      interval: 10s
      timeout: 3s
      retries: 3

  api:
    image: my-api:latest
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.labels.tier == app
      labels:
        com.example.service: "api"
        com.example.environment: "production"
    environment:
      DATABASE_URL: "postgres://postgres-service:5432/myapp"
    networks:
      - frontend
      - backend
    secrets:
      - db_password
      - api_key

  db:
    image: postgres:16-alpine
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.tier == data
        max_replicas_per_node: 1  # Only 1 replica per node
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: myapp
    networks:
      - backend
    secrets:
      - db_password

  redis:
    image: redis:7-alpine
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.tier == data
    networks:
      - backend

  # Visualizer (for management)
  visualizer:
    image: dockersamples/visualizer:latest
    deploy:
      placement:
        constraints:
          - node.role == manager
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay
    internal: true  # No external access

volumes:
  pgdata:
    driver: local

secrets:
  db_password:
    external: true
  api_key:
    external: true
```

```bash
# Create secrets
echo "MySecretPassword123" | docker secret create db_password -
echo "sk-1234567890" | docker secret create api_key -

# Set node labels
docker node update --label-add tier=app worker1
docker node update --label-add tier=app worker2
docker node update --label-add tier=data worker3

# Deploy the Stack
docker stack deploy -c docker-stack.yml myapp

# Check Stack status
docker stack ls
docker stack services myapp
docker stack ps myapp

# Scale a specific service
docker service scale myapp_api=4

# Update the Stack (after changing the YAML file)
docker stack deploy -c docker-stack.yml myapp  # Re-deploy to apply diff

# Remove the Stack
docker stack rm myapp
```

### Swarm Networking

```
┌──────────────────────────────────────────────────────────┐
│                  Overlay Network                          │
│                                                          │
│  Node 1 (Manager)        Node 2 (Worker)                │
│  ┌──────────────┐       ┌──────────────┐               │
│  │  web.1       │       │  web.2       │               │
│  │  10.0.0.5    │       │  10.0.0.6    │               │
│  │              │       │              │               │
│  │  api.1       │       │  api.2       │               │
│  │  10.0.0.7    │       │  10.0.0.8    │               │
│  └──────┬───────┘       └──────┬───────┘               │
│         │     VXLAN Tunnel     │                        │
│         └──────────────────────┘                        │
│                                                          │
│  Routing Mesh:                                           │
│  ┌─────────────────────────────────────────────┐        │
│  │  Client → any node:80                        │        │
│  │       ↓                                      │        │
│  │  ingress network forwards to the             │        │
│  │  appropriate container                       │        │
│  │  (web.1 or web.2 or web.3)                   │        │
│  └─────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

```bash
# Create an Overlay network
docker network create --driver overlay --attachable my-overlay

# Encrypted Overlay network
docker network create --driver overlay --opt encrypted my-secure-overlay

# List networks
docker network ls --filter driver=overlay
```

---

## 3. Docker Swarm vs Kubernetes

### Architecture Comparison

```
Docker Swarm                          Kubernetes
┌──────────────────┐                  ┌──────────────────────────┐
│  Manager Node    │                  │  Control Plane            │
│  ┌────────────┐  │                  │  ┌──────────────────┐    │
│  │ Raft       │  │                  │  │ API Server        │    │
│  │ Consensus  │  │                  │  │ etcd              │    │
│  │ Scheduler  │  │                  │  │ Scheduler         │    │
│  │ Routing    │  │                  │  │ Controller Manager│    │
│  └────────────┘  │                  │  └──────────────────┘    │
├──────────────────┤                  ├──────────────────────────┤
│  Worker Node 1   │                  │  Worker Node 1           │
│  ┌────────────┐  │                  │  ┌──────────────────┐    │
│  │ Container  │  │                  │  │ kubelet           │    │
│  │ Container  │  │                  │  │ kube-proxy        │    │
│  └────────────┘  │                  │  │ Container Runtime │    │
├──────────────────┤                  │  │ Pod  Pod  Pod     │    │
│  Worker Node 2   │                  │  └──────────────────┘    │
│  ┌────────────┐  │                  ├──────────────────────────┤
│  │ Container  │  │                  │  Worker Node 2           │
│  │ Container  │  │                  │  ┌──────────────────┐    │
│  └────────────┘  │                  │  │ Pod  Pod  Pod     │    │
└──────────────────┘                  │  └──────────────────┘    │
                                      └──────────────────────────┘
 Simple · Lightweight                  Feature-rich · Mature ecosystem
```

### Detailed Comparison Table

| Aspect | Docker Swarm | Kubernetes |
|--------|-------------|------------|
| Setup | Only `docker swarm init` | Multiple components need to be set up |
| Learning cost | Low (extension of Docker CLI) | High (many unique concepts) |
| Scalability | Hundreds of nodes | Thousands of nodes |
| Ecosystem | Limited | Rich: Helm, Istio, Argo, etc. |
| Auto-scaling | Manual (`docker service scale`) | Automated with HPA/VPA |
| Storage | Docker Volume | PV/PVC, StorageClass |
| Networking | Overlay (built-in) | CNI plugins (many options) |
| Ingress | Routing Mesh | Ingress Controller |
| Operational burden | Low | High (managed service recommended) |
| Cloud support | Limited | EKS/GKE/AKS and more |
| Community | Shrinking | Active (industry standard) |
| Resource consumption | Low (integrated with Docker) | High (Control Plane is heavy) |
| Batch jobs | Limited | Rich with Jobs and CronJobs |
| Config management | Docker Configs | ConfigMap, Secret |
| RBAC | None | Detailed RBAC |
| Custom resources | None | Extensible with CRD |
| Service mesh | None | Istio, Linkerd, etc. |

### Terminology Mapping Table

| Concept | Docker Swarm | Kubernetes |
|---------|-------------|------------|
| Cluster management node | Manager | Control Plane (Master) |
| Execution node | Worker | Worker Node |
| Deployment unit | Task | Pod |
| Service definition | Service | Deployment + Service |
| Configuration file | docker-stack.yml | Manifest (YAML) |
| Scaling | docker service scale | kubectl scale / HPA |
| Networking | Overlay | CNI Plugin |
| Storage | Volume | PersistentVolume |
| Sensitive information | Secret | Secret |
| Configuration information | Config | ConfigMap |
| Load balancer | Routing Mesh | Service (LoadBalancer) |
| Namespace | None | Namespace |

### Selection Decision Flow

```
What is the scale of the project?
    │
    ├── Small (up to ~10 containers, ~3 nodes)
    │       │
    │       ├── Is Docker Compose sufficient? ── Yes ──► Docker Compose
    │       │
    │       └── High availability required ──► Docker Swarm
    │
    ├── Medium (10–100 containers, 3–20 nodes)
    │       │
    │       ├── Small ops team (1–3 people) ──► Docker Swarm
    │       │
    │       ├── Cloud-native ──► Managed K8s (EKS/GKE/AKS)
    │       │
    │       └── Planning for future expansion ──► Kubernetes (managed)
    │
    └── Large (100+ containers, 20+ nodes)
            │
            ├── Multi-cloud / hybrid ──► Kubernetes
            │
            └── Single cloud ──► Managed K8s, no question
```

### Cost Comparison (Reference Values)

```
┌─────────────────────────────────────────────────────────┐
│  Operational Cost Comparison (Medium scale: 10 services, 3 nodes) │
│                                                          │
│  Docker Compose (single host):                           │
│    Server: $50/month × 1 = $50/month                    │
│    Operational effort: Low                               │
│    Total: ~$50/month                                     │
│                                                          │
│  Docker Swarm:                                           │
│    Server: $50/month × 3 = $150/month                   │
│    Operational effort: Low–Medium                        │
│    Total: ~$150/month                                    │
│                                                          │
│  Kubernetes (self-managed):                              │
│    Server: $50/month × 3 + Control Plane = $200/month   │
│    Operational effort: High (dedicated K8s engineer needed) │
│    Total: ~$200/month + personnel costs                  │
│                                                          │
│  Managed K8s (EKS/GKE/AKS):                             │
│    Control Plane: $73/month (EKS) or $0 (GKE Autopilot) │
│    Worker nodes: $150/month                              │
│    Operational effort: Medium                            │
│    Total: ~$150–223/month                                │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Key Concepts of Orchestration

### Code Example 4: Declarative State Management

```yaml
# Declare the "desired state" and the orchestrator automatically brings reality in line

# Docker Swarm: docker-stack.yml
services:
  web:
    image: nginx:alpine
    deploy:
      replicas: 3    # ← Always maintain 3 replicas

# Kubernetes: deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3        # ← Always maintain 3 Pods
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:alpine
```

### Imperative vs Declarative Management

```
Imperative:
  "Start 3 nginx containers"
  "Stop the second container"
  "Add one new container"
  → Must give step-by-step instructions
  → No automatic recovery from failures

Declarative:
  "There should always be 3 nginx containers"
  → Orchestrator compares current state with desired state
  → Automatically resolves the difference
  → Auto-recovery on failure too

┌────────────────────────────────────────────┐
│  Reconciliation Loop                       │
│                                            │
│  ┌─────────┐    compare  ┌─────────┐      │
│  │ Desired │  ◄────────► │ Current │      │
│  │ State   │             │ State   │      │
│  │ (YAML)  │             │ (actual)│      │
│  └─────────┘             └─────────┘      │
│       │                       ▲           │
│       │     Detect diff       │           │
│       │     ┌────────┐        │           │
│       └────►│ Action │────────┘           │
│             │ Execute│                    │
│             └────────┘                   │
│                                          │
│  Example: replicas=3 but only 2 Pods     │
│  → Automatically add 1 to make 3         │
└────────────────────────────────────────────┘
```

### Self-Healing Mechanism

```
Desired State: replicas=3

Current state:
┌────────┐ ┌────────┐ ┌────────┐
│ Pod 1  │ │ Pod 2  │ │ Pod 3  │
│  ✅    │ │  ✅    │ │  ✅    │
└────────┘ └────────┘ └────────┘

Pod 2 stops due to failure:
┌────────┐ ┌────────┐ ┌────────┐
│ Pod 1  │ │ Pod 2  │ │ Pod 3  │
│  ✅    │ │  ❌    │ │  ✅    │
└────────┘ └────────┘ └────────┘

Orchestrator detects it → automatically starts a new Pod:
┌────────┐ ┌────────┐ ┌────────┐
│ Pod 1  │ │ Pod 3  │ │ Pod 4  │
│  ✅    │ │  ✅    │ │  ✅ ★  │  ← Newly created
└────────┘ └────────┘ └────────┘

In case of node failure:
┌────────────┐ ┌────────────┐
│  Node 1    │ │  Node 2    │
│  Pod 1 ✅  │ │  Pod 2 ✅  │
│  Pod 3 ✅  │ │            │
└────────────┘ └────────────┘
    ↓ Node 1 failure
┌────────────┐ ┌────────────┐
│  Node 1    │ │  Node 2    │
│  ❌ All    │ │  Pod 2 ✅  │
│  stopped   │ │  Pod 4 ✅  │ ← Replacement for Pod 1
│            │ │  Pod 5 ✅  │ ← Replacement for Pod 3
└────────────┘ └────────────┘
```

### Code Example 5: Rolling Updates

```bash
# Docker Swarm rolling update
docker service update \
  --image my-app:v2.0.0 \
  --update-parallelism 1 \
  --update-delay 10s \
  --update-failure-action rollback \
  --update-monitor 30s \
  --update-max-failure-ratio 0.25 \
  --update-order start-first \
  my-service
```

```yaml
# Kubernetes rolling update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Number of Pods that can be added at once
      maxUnavailable: 0  # Number of Pods allowed to be unavailable
  template:
    spec:
      containers:
        - name: app
          image: my-app:v2.0.0
```

```
Rolling update flow (parallelism=1):

Step 1: Update Pod 1 to v2
┌─────────┐ ┌─────────┐ ┌─────────┐
│ v1 → v2 │ │   v1    │ │   v1    │
│Updating │ │ Running │ │ Running │
└─────────┘ └─────────┘ └─────────┘

Step 2: Health check OK → Update Pod 2
┌─────────┐ ┌─────────┐ ┌─────────┐
│   v2    │ │ v1 → v2 │ │   v1    │
│ Running │ │Updating │ │ Running │
└─────────┘ └─────────┘ └─────────┘

Step 3: Update Pod 3
┌─────────┐ ┌─────────┐ ┌─────────┐
│   v2    │ │   v2    │ │ v1 → v2 │
│ Running │ │ Running │ │Updating │
└─────────┘ └─────────┘ └─────────┘

Complete: All Pods updated to v2 (no downtime)
```

### Deployment Strategy Comparison

| Strategy | Downtime | Risk | Rollback | Resource Consumption |
|----------|----------|------|----------|----------------------|
| Rolling Update | None | Low | Automatic | Slightly more |
| Blue/Green | None | Low | Immediate | 2x required |
| Canary | None | Lowest | Easy | Slightly more |
| Recreate | Yes | High | Slow | No change |

```
Blue/Green Deploy:
┌──────────┐     ┌──────────┐
│  Blue    │     │  Green   │
│  v1 ✅   │     │  v2 ✅   │
│ (current)│     │  (new)   │
└──────────┘     └──────────┘
      │                │
      └─── LB ─────────┘
           ↓ Switch
      ┌──────────┐     ┌──────────┐
      │  Blue    │     │  Green   │
      │  v1      │     │  v2 ✅   │
      │(standby) │     │ (current)│
      └──────────┘     └──────────┘

Canary Deploy:
┌──────────────────────────┐
│  v1  v1  v1  v1  v2     │
│  90%              10%    │  ← Validate with 10% of traffic
│                          │
│  No issues → expand gradually  │
│  v1  v1  v2  v2  v2     │
│  40%         60%         │
│                          │
│  v2  v2  v2  v2  v2     │
│  100%                    │  ← Full migration
└──────────────────────────┘
```

---

## 5. Managed Kubernetes Services

### Cloud Service Comparison Table

| Service | Provider | Control Plane Cost | Features |
|---------|----------|--------------------|----------|
| EKS | AWS | $73/month | AWS integration, Fargate support |
| GKE | Google Cloud | Free (Autopilot) | Most mature, Autopilot mode |
| AKS | Azure | Free | Azure integration, Windows support |
| DOKS | DigitalOcean | Free | Simple, low cost |
| LKE | Linode/Akamai | Free | Simple, low cost |

### Selection Criteria for Managed K8s

```
┌─────────────────────────────────────────────────────────┐
│  Decision Criteria for Managed K8s Selection             │
│                                                          │
│  Existing cloud contract?                                │
│    ├── AWS → EKS                                        │
│    ├── GCP → GKE (Autopilot recommended)                │
│    ├── Azure → AKS                                      │
│    └── None → DOKS for cost, GKE for features           │
│                                                          │
│  Auto-scaling requirements?                              │
│    ├── Both nodes and Pods auto → GKE Autopilot         │
│    ├── Only Pods auto → any service supports HPA        │
│    └── Fixed → lowest cost DOKS or LKE                  │
│                                                          │
│  Serverless containers?                                  │
│    ├── AWS Fargate (with EKS)                           │
│    ├── GKE Autopilot                                    │
│    └── Azure Container Apps                             │
└─────────────────────────────────────────────────────────┘
```

### Setting Up a Local Kubernetes Environment

```bash
# === minikube (recommended: for beginners) ===
# Install
brew install minikube

# Start cluster
minikube start --driver=docker --memory=4096 --cpus=2

# Dashboard
minikube dashboard

# === kind (Kubernetes in Docker) ===
# Install
brew install kind

# Create cluster (multi-node)
cat <<EOF | kind create cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
EOF

# === k3d (k3s on Docker, lightest) ===
# Install
brew install k3d

# Create cluster
k3d cluster create mycluster --agents 2

# === Docker Desktop ===
# Settings > Kubernetes > Enable Kubernetes
```

| Tool | Features | Resource Consumption | Multi-node | Startup Speed |
|------|----------|----------------------|------------|---------------|
| minikube | Official, feature-rich | Medium | Add-on | Medium |
| kind | K8s cluster inside Docker | Low | Supported | Fast |
| k3d | k3s (lightweight K8s) on Docker | Lowest | Supported | Fastest |
| Docker Desktop | Built-in K8s | Medium | Not supported | Slow |

---

## 6. Practice: Migrating from Docker Compose to Swarm

### Migration Steps

```bash
# Step 1: Check the existing docker-compose.yml
docker compose config

# Step 2: Fix configurations not supported by Swarm
# - build: cannot be used → build and push images in advance
# - depends_on: condition cannot be used → use healthcheck instead
# - bind mounts in volumes → change to Named Volumes

# Step 3: Add deploy sections
# - replicas, resources, placement, etc.

# Step 4: Initialize Swarm
docker swarm init

# Step 5: Create secrets
cat .env | while IFS='=' read -r key value; do
  echo "$value" | docker secret create "$key" -
done

# Step 6: Deploy the Stack
docker stack deploy -c docker-compose.yml myapp

# Step 7: Verify operation
docker stack services myapp
docker stack ps myapp
```

### Conversion Example: docker-compose.yml → docker-stack.yml

```yaml
# Before: docker-compose.yml
version: "3.9"
services:
  api:
    build: ./api           # ← Not allowed in Swarm
    ports:
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy  # ← Not allowed in Swarm
    environment:
      DB_PASSWORD: secret123       # ← Migrate to secrets

# After: docker-stack.yml
version: "3.9"
services:
  api:
    image: registry.example.com/api:1.0.0  # ← Pre-built image
    ports:
      - "8080:8080"
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 10s
      timeout: 3s
      retries: 5
    secrets:
      - db_password
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password  # ← Read from file

secrets:
  db_password:
    external: true
```

---

## Anti-patterns

### Anti-pattern 1: Introducing Excessive Orchestration

```
# BAD: Introducing Kubernetes for an app with 3 containers
# → Operational costs exceed application development costs

# GOOD: Choose the right tool for the scale
# 3 containers → Docker Compose
# 10 containers, high availability → Docker Swarm
# 50+ containers, multi-team → Kubernetes
```

**Why it's a problem**: The learning and operational costs of Kubernetes are very high. In small-scale projects, managing the orchestrator itself becomes the bottleneck.

### Anti-pattern 2: Carelessly Containerizing Stateful Workloads

```yaml
# BAD: Managing the database under orchestration without sufficient knowledge
services:
  postgres:
    deploy:
      replicas: 3  # You cannot simply increase database replicas

# GOOD: Use managed DB services first
# AWS RDS, Cloud SQL, Azure Database, etc.
# → Tackle containerized DB operations after gaining sufficient knowledge
```

**Why it's a problem**: Databases are stateful and require careful design of replication, failover, and backups. It is safer to leave this to managed services.

### Anti-pattern 3: Running Production with a Single Manager Node

```bash
# BAD: Running production with a single manager
# → A manager failure leaves the entire cluster uncontrollable

# GOOD: HA configuration with at least 3 managers
docker swarm init --advertise-addr 192.168.1.10
# + Add 2 more managers

# For Kubernetes:
# → With managed services (EKS/GKE/AKS), Control Plane HA is automatic
```

**Why it's a problem**: If a single manager fails, scheduling new tasks and updating services becomes impossible. Existing containers continue to run, but self-healing functionality stops.


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

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
        """Main data processing logic"""
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
        assert False, "Exception should be raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

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

    print(f"Inefficient: {slow_time:.4f}s")
    print(f"Efficient:   {fast_time:.6f}s")
    print(f"Speedup:     {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Check the config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, transaction management |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use log output and debuggers to verify hypotheses
5. **Fix and regression test**: After fixing, run tests for related areas as well

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O wait**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Countermeasure |
|--------------|-----------------|----------------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't aim for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Incrementally revamping a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If there are no existing tests, create Characterization Tests first
- Coexist old and new systems via an API gateway
- Perform data migration incrementally

| Phase | Work Content | Estimated Duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, understanding dependencies | 2–4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4–6 weeks | Low |
| 3. Begin migration | Migrate peripheral features first | 3–6 months | Medium |
| 4. Core migration | Migrate core functionality | 6–12 months | High |
| 5. Completion | Retire old system | 2–4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50 or more engineers developing the same product

**Approach:**
- Clarify boundaries using domain-driven design
- Assign ownership per team
- Manage common libraries with Inner Source approach
- Design API-first to minimize cross-team dependencies

```python
# API contract definition between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** Systems that require millisecond-level responses

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|------------------------|--------|---------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low–Medium | High | When CPU-bound |

---

## Team Development Practices

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Is the documentation updated?

### Knowledge Sharing Best Practices

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (Architecture Decision Record) | As needed | Future members | Transparent decision-making |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Important designs | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │and  │imme-│
    │addr.│diat.│
    ├─────┼─────┤
    │Log  │Next │
    │only │Sprint│
    │     │     │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|---------------|------------|----------------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication weaknesses | High | Multi-factor auth, session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logging, audit trail | Log analysis |

### Secure Coding Best Practices

```python
# Secure coding example
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """Security utilities"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate a cryptographically secure token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """Hash a password"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """Verify a password"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input value"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage example
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not output in logs
- [ ] HTTPS is enforced
- [ ] CORS policy is properly configured
- [ ] Vulnerability scanning of dependency packages is performed
- [ ] Error messages do not contain internal information

---

## Common Misconceptions and Cautions

### Misconception 1: "You should create the perfect design from the start"

**Reality:** A perfect design does not exist. The design should evolve as requirements change. Aiming for perfection from the start tends to lead to overly complex designs.

> "Make it work, make it right, make it fast" — Kent Beck

### Misconception 2: "Using the latest technology automatically makes things better"

**Reality:** Technology choices should be based on project requirements. The latest technology is not necessarily optimal for every project. Also consider team proficiency, ecosystem maturity, and long-term support.

### Misconception 3: "Tests slow down development speed"

**Reality:** While writing tests takes time in the short term, over the medium to long term they contribute to faster development through early bug detection, safe refactoring, and serving as documentation.

```python
# Example showing ROI of tests
class TestROICalculator:
    """Calculate return on investment for tests"""

    def __init__(self):
        self.test_writing_hours = 0
        self.bugs_prevented = 0
        self.debug_hours_saved = 0

    def add_test_investment(self, hours: float):
        """Time spent writing tests"""
        self.test_writing_hours += hours

    def add_bug_prevention(self, count: int, avg_debug_hours: float = 2.0):
        """Bugs prevented by tests"""
        self.bugs_prevented += count
        self.debug_hours_saved += count * avg_debug_hours

    def calculate_roi(self) -> dict:
        """Calculate ROI"""
        net_benefit = self.debug_hours_saved - self.test_writing_hours
        roi_percent = (net_benefit / self.test_writing_hours * 100
                      if self.test_writing_hours > 0 else 0)
        return {
            'test_hours': self.test_writing_hours,
            'bugs_prevented': self.bugs_prevented,
            'hours_saved': self.debug_hours_saved,
            'net_benefit_hours': net_benefit,
            'roi_percent': f'{roi_percent:.1f}%'
        }
```

### Misconception 4: "Documentation can be written later"

**Reality:** The intent and design decisions of code can be recorded most accurately right after writing it. The longer you put it off, the more accurate information you lose.

### Misconception 5: "Performance should always be the top priority"

**Reality:** Optimization at the expense of readability and maintainability ultimately costs more in the long run. Follow the principle of "don't guess, measure" — identify the bottleneck before optimizing.
---

## FAQ

### Q1: Is it okay to keep using Docker Swarm going forward?

Docker Swarm is integrated into Docker Engine and maintenance continues. However, Kubernetes has become the industry standard, and new features and ecosystem expansion are focused on Kubernetes. Using it for small-scale projects is fine, but realistically you should plan for a migration to Kubernetes in the long run.

### Q2: Where is the boundary between docker compose and orchestration?

Decision criteria:
- **Single host + acceptable downtime on restart** → Docker Compose
- **Multiple hosts or zero downtime required** → Orchestration

Docker Compose v2's `--profile` and `restart: unless-stopped` can cover a lot of single-host operations, but automatic failover in the event of a host failure can only be achieved with orchestration.

### Q3: How can I try Kubernetes in a local environment?

| Tool | Features | Resource Consumption |
|------|----------|---------------------|
| minikube | Official, feature-rich | Medium |
| kind | K8s cluster inside Docker | Low |
| k3d | k3s (lightweight K8s) on Docker | Lowest |
| Docker Desktop | Built-in K8s | Medium |

```bash
# Get started with minikube
minikube start --driver=docker --memory=4096 --cpus=2
kubectl get nodes
```

### Q4: How difficult is it to migrate from Swarm to Kubernetes?

The concepts are similar, but the configuration file formats are completely different. Main migration tasks:

1. Convert docker-stack.yml → Kubernetes manifests (Deployment, Service, ConfigMap, Secret)
2. Migrate Overlay Network → Kubernetes Network Policy
3. Migrate Docker Secrets → Kubernetes Secrets
4. Configure Routing Mesh → Ingress Controller
5. Adapt monitoring and logging infrastructure for K8s

The conversion tool Kompose can automate the basic conversion, but manual adjustments are needed to bring it to production quality.

```bash
# Convert docker-compose.yml to K8s manifests with Kompose
kompose convert -f docker-compose.yml
```

### Q5: Is zero-downtime deployment possible without orchestration?

With Docker Compose, you can achieve a pseudo zero-downtime deployment by combining `docker compose up -d --no-deps --scale api=2` with healthchecks. However:

- A reverse proxy (nginx/Traefik) is required
- Manual scripted control is required
- Automatic recovery from host failure is not possible

If complete zero downtime is mandatory, introducing orchestration is recommended.

---

## Summary

| Item | Key Point |
|------|-----------|
| Orchestration | Automates container management across multiple hosts |
| Docker Swarm | Simple, low learning cost, suited for small to medium scale |
| Kubernetes | Industry standard, feature-rich, suited for large scale. Managed service recommended |
| Declarative management | Declare the "desired state" and the orchestrator maintains it |
| Self-healing | Detects failures and automatically recovers |
| Rolling updates | Update versions without downtime |
| Selection criteria | Decide based on scale, team structure, and future scalability |
| HA configuration | Minimum 3 managers for Swarm; managed service recommended for K8s |
| Networking | Swarm: Overlay, K8s: CNI Plugin |

---

## What to Read Next

- [Kubernetes Basics](./01-kubernetes-basics.md) -- Basic operations for Pod/Service/Deployment
- [Kubernetes Advanced](./02-kubernetes-advanced.md) -- Practical use of Helm, Ingress, HPA, etc.
- [Docker CI/CD](../04-production/02-ci-cd-docker.md) -- Deployment pipelines to orchestration

---

## References

1. Docker Official Documentation "Swarm mode overview" -- https://docs.docker.com/engine/swarm/
2. Kubernetes Official Documentation -- https://kubernetes.io/docs/
3. Nigel Poulton (2023) *The Kubernetes Book*, Chapter 1: Kubernetes Primer
4. CNCF "Cloud Native Landscape" -- https://landscape.cncf.io/
5. Kelsey Hightower, Brendan Burns, Joe Beda (2022) *Kubernetes: Up and Running*, 3rd Edition, O'Reilly
6. Docker Official Documentation "Deploy to Swarm" -- https://docs.docker.com/engine/swarm/stack-deploy/
7. Kompose (Kubernetes + Compose) -- https://kompose.io/
