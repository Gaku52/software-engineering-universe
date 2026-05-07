# Kubernetes Basics

> Learn declarative container management with Kubernetes through the three core resources — Pod, Service, and Deployment — and basic kubectl operations.

---

## What You Will Learn

1. Understand the **roles and relationships of Pod, Service, and Deployment**
2. Master **basic cluster operations with kubectl**
3. Be able to **write manifest files (YAML)** and practice with minikube
4. Understand related resources such as **ConfigMap, Secret, and PersistentVolume**
5. Grasp the foundational concepts of **Ingress, HPA, and RBAC**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Orchestration Overview](./00-orchestration-overview.md)

---

## 1. Kubernetes Architecture

### Cluster Composition

```
┌─────────────────── Control Plane ───────────────────────┐
│                                                         │
│  ┌────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ API Server │  │   etcd   │  │ Controller Manager│  │
│  │            │  │ (KVS)    │  │                   │  │
│  │ 全操作の   │  │ クラスタ │  │ Desired State を  │  │
│  │ エントリ   │  │ 状態保存 │  │ 維持するループ    │  │
│  └─────┬──────┘  └──────────┘  └───────────────────┘  │
│        │                                                │
│  ┌─────▼──────┐                                        │
│  │ Scheduler  │  Podをどのノードに配置するか決定        │
│  └────────────┘                                        │
└─────────────────────────────────────────────────────────┘
         │
         │ kubelet通信
         ▼
┌─────────────────── Worker Node ─────────────────────────┐
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐ │
│  │  kubelet   │  │ kube-proxy │  │ Container Runtime│ │
│  │            │  │            │  │ (containerd)     │ │
│  │ Pod管理    │  │ ネットワーク │  │ コンテナ実行     │ │
│  └────────────┘  │ ルーティング│  └──────────────────┘ │
│                  └────────────┘                         │
│  ┌──────────────────────────────────────┐              │
│  │  Pod        Pod        Pod           │              │
│  │ ┌──────┐  ┌──────┐  ┌──────┐       │              │
│  │ │ ctr  │  │ ctr  │  │ ctr  │       │              │
│  │ └──────┘  └──────┘  │ ctr  │       │              │
│  │                      └──────┘       │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Control Plane Component Details

| Component | Role | Impact When Failed |
|---|---|---|
| API Server | Authentication, authorization, and acceptance of all requests | kubectl and controllers become inoperable |
| etcd | The sole persistent store for cluster state | All state is lost (most critical) |
| Controller Manager | Control loops that maintain Desired State | Automatic recovery and scaling stop |
| Scheduler | Determines which node to place Pods on | New Pods are not scheduled |

### Worker Node Component Details

| Component | Role | Impact When Failed |
|---|---|---|
| kubelet | Creates, monitors, and reports on Pods | Pods on the node become unmanageable |
| kube-proxy | Manages network rules for Services | Routing via Services becomes impossible |
| Container Runtime | Runs containers (containerd, CRI-O) | Containers cannot be started or stopped |

### Kubernetes Declarative Management Model

The most important design principle of Kubernetes is **Declarative Management**. Instead of the imperative "start 3 containers," you declaratively state "there should be 3 containers."

```
Declarative management flow:

User                       API Server                Controller
  │                           │                         │
  │ apply "replicas: 3"       │                         │
  │──────────────────────────►│                         │
  │                           │ Save to etcd            │
  │                           │────────►                │
  │                           │                         │
  │                           │  Monitor current state  │
  │                           │◄────────────────────────│
  │                           │                         │
  │                           │  Detect "only 2 exist"  │
  │                           │────────────────────────►│
  │                           │                         │
  │                           │  Add 1 Pod              │
  │                           │◄────────────────────────│
  │                           │                         │
  │                           │  Desired = Current      │
  │                           │  → Reconciliation done  │
```

Because this Reconciliation Loop runs continuously, the system automatically returns to the desired state even when failures or node outages occur.

---

## 2. Pod

The smallest deployable unit in Kubernetes. Contains one or more containers, and containers within the same Pod share network and storage.

### Code Example 1: Pod Manifest

```yaml
# pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  labels:
    app: my-app
    version: v1
    environment: development
spec:
  containers:
    - name: app
      image: node:20-alpine
      command: ["node", "server.js"]
      ports:
        - containerPort: 3000
          protocol: TCP
      env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: database-host
      resources:
        requests:
          memory: "128Mi"
          cpu: "100m"      # 0.1 CPU
        limits:
          memory: "256Mi"
          cpu: "500m"      # 0.5 CPU
      livenessProbe:
        httpGet:
          path: /health
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 15
      readinessProbe:
        httpGet:
          path: /ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 10
      volumeMounts:
        - name: data
          mountPath: /app/data

  volumes:
    - name: data
      emptyDir: {}

  restartPolicy: Always
```

```bash
# Create a Pod
kubectl apply -f pod.yaml

# List Pods
kubectl get pods
kubectl get pods -o wide  # Also shows node information

# Pod details
kubectl describe pod my-app

# Pod logs
kubectl logs my-app
kubectl logs my-app -f  # Follow in real time

# Execute a command inside a Pod
kubectl exec -it my-app -- /bin/sh

# Delete a Pod
kubectl delete pod my-app
```

### Pod Lifecycle

```
┌──────────────────────────────────────────────┐
│                Pod Lifecycle                  │
│                                              │
│  Pending ──► Running ──► Succeeded           │
│     │           │                            │
│     │           └──► Failed                  │
│     │                                        │
│     └──► (Cannot be scheduled)               │
│                                              │
│  While Running:                              │
│  ┌─────────────────────────────────┐        │
│  │  Liveness Probe  → fail → restart│        │
│  │  Readiness Probe → fail → removed│        │
│  │                     from Service │        │
│  │  Startup Probe   → startup check │        │
│  └─────────────────────────────────┘        │
└──────────────────────────────────────────────┘
```

### Multi-Container Patterns

There are three representative patterns for placing multiple containers in a single Pod.

```yaml
# sidecar-pattern.yaml
# Sidecar pattern: co-locate a log collection agent
apiVersion: v1
kind: Pod
metadata:
  name: app-with-sidecar
spec:
  containers:
    # Main application
    - name: app
      image: my-app:latest
      ports:
        - containerPort: 8080
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app

    # Sidecar: collect logs and forward externally
    - name: log-collector
      image: fluent/fluent-bit:latest
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
          readOnly: true
        - name: fluentbit-config
          mountPath: /fluent-bit/etc

  volumes:
    - name: log-volume
      emptyDir: {}
    - name: fluentbit-config
      configMap:
        name: fluentbit-config
```

```yaml
# init-container.yaml
# Init Container: run pre-processing before the main container starts
apiVersion: v1
kind: Pod
metadata:
  name: app-with-init
spec:
  initContainers:
    # Run DB migration before starting
    - name: db-migration
      image: my-app:latest
      command: ["npm", "run", "migrate"]
      env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url

    # Wait for external service to start
    - name: wait-for-redis
      image: busybox:latest
      command: ['sh', '-c', 'until nc -z redis-service 6379; do echo waiting for redis; sleep 2; done']

  containers:
    - name: app
      image: my-app:latest
      ports:
        - containerPort: 8080
```

| Pattern | Use Case | Example |
|---|---|---|
| Sidecar | Assist the main container | Log collection, proxy, monitoring |
| Ambassador | Proxy for external communication | DB proxy, API gateway |
| Adapter | Transform output | Log format conversion, metrics conversion |

---

## 3. Deployment

A controller that handles Pod replica management, rolling updates, and rollbacks. In production, always use Deployments rather than creating Pods directly.

### Code Example 2: Deployment Manifest

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Number of additional Pods created during update
      maxUnavailable: 0  # Number of Pods allowed to be unavailable during update
  template:
    metadata:
      labels:
        app: web-app
        version: v1.0.0
    spec:
      containers:
        - name: web
          image: my-app:1.0.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
      terminationGracePeriodSeconds: 30
```

```bash
# Create a Deployment
kubectl apply -f deployment.yaml

# List Deployments
kubectl get deployments

# Rolling update (change image)
kubectl set image deployment/web-app web=my-app:2.0.0

# Check update progress
kubectl rollout status deployment/web-app

# Check update history
kubectl rollout history deployment/web-app

# Rollback (revert to previous version)
kubectl rollout undo deployment/web-app

# Rollback to a specific revision
kubectl rollout undo deployment/web-app --to-revision=2

# Scaling
kubectl scale deployment/web-app --replicas=5
```

### Relationship between Deployment, ReplicaSet, and Pod

```
┌─────────────────────────────────────────────────┐
│  Deployment: web-app                            │
│  (Manages rolling updates and rollbacks)        │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  ReplicaSet: web-app-7d9b8c6f5            │ │
│  │  (Manages Pod replicas for current ver.)  │ │
│  │                                           │ │
│  │  ┌────────┐  ┌────────┐  ┌────────┐     │ │
│  │  │ Pod 1  │  │ Pod 2  │  │ Pod 3  │     │ │
│  │  │ v1.0.0 │  │ v1.0.0 │  │ v1.0.0 │     │ │
│  │  └────────┘  └────────┘  └────────┘     │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  ReplicaSet: web-app-5f4d3e2a1 (old)     │ │
│  │  replicas: 0 (retained for rollback)      │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Rolling Update Flow

```
With maxSurge: 1, maxUnavailable: 0:

Step 1: Add 1 new Pod
  old v1: [●] [●] [●]    replicas=3
  new v2: [○]             Adding...

Step 2: New Pod Ready → Remove 1 old Pod
  old v1: [●] [●]         replicas=2
  new v2: [●]             Ready!

Step 3: Add new Pod → Remove old Pod (repeat)
  old v1: [●]             replicas=1
  new v2: [●] [●]

Step 4: Complete
  old v1:                  replicas=0
  new v2: [●] [●] [●]    All Pods updated
```

### Comparison of Deployment Strategies

```yaml
# Recreate strategy: stop all Pods → start all Pods (with downtime)
spec:
  strategy:
    type: Recreate

# RollingUpdate strategy: update incrementally (no downtime)
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%         # Allow up to 25% of replicas as additional Pods
      maxUnavailable: 25%   # Allow up to 25% of replicas to be stopped
```

| Strategy | Downtime | Resource Usage | Use Case |
|---|---|---|---|
| RollingUpdate | None | Temporarily increases | Production (default) |
| Recreate | Yes | Constant | When simultaneous operation is impossible, e.g. DB schema changes |
| Blue/Green (manual) | None | 2x | When a complete version switch is needed |
| Canary (manual) | None | Slight increase | Staged release to minimize impact |

---

## 4. Service

An abstraction layer that provides a stable network endpoint (IP address, DNS name) for a set of Pods. Pods are ephemeral and their IPs change, but Services remain constant.

### Code Example 3: Service Manifest

```yaml
# === ClusterIP (accessible only from within the cluster) ===
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  type: ClusterIP          # Default
  selector:
    app: web-app           # Route to Pods with this label
  ports:
    - port: 80             # Port the Service listens on
      targetPort: 8080     # Pod's port
      protocol: TCP

---
# === NodePort (accessible via each node's IP) ===
apiVersion: v1
kind: Service
metadata:
  name: web-nodeport
spec:
  type: NodePort
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080      # Range: 30000-32767

---
# === LoadBalancer (automatically provisions a cloud LB) ===
apiVersion: v1
kind: Service
metadata:
  name: web-lb
spec:
  type: LoadBalancer
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 8080
```

### Service Type Comparison

| Type | Access Scope | IP | Use Case |
|--------|------------|-----|------|
| ClusterIP | Cluster-internal only | Virtual IP (10.x.x.x) | Internal communication (default) |
| NodePort | External + Internal | Node IP:30000-32767 | Development, on-premises |
| LoadBalancer | External + Internal | Cloud LB IP | Production (cloud) |
| ExternalName | DNS CNAME | External DNS name | Alias to external service |

### Service Routing

```
External Client
    │
    │  LoadBalancer IP: 203.0.113.50:80
    ▼
┌──────────────────────────────────────────┐
│  Service: web-lb (10.96.0.10:80)        │
│  selector: app=web-app                   │
│                                          │
│  Endpoints:                              │
│    172.17.0.5:8080 (Pod 1)              │
│    172.17.0.6:8080 (Pod 2)              │
│    172.17.0.7:8080 (Pod 3)              │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  Pod 1  │ │  Pod 2  │ │  Pod 3  │  │
│  │  :8080  │ │  :8080  │ │  :8080  │  │
│  │app=     │ │app=     │ │app=     │  │
│  │web-app  │ │web-app  │ │web-app  │  │
│  └─────────┘ └─────────┘ └─────────┘  │
└──────────────────────────────────────────┘
```

### Service DNS

Inside a Kubernetes cluster, CoreDNS automatically assigns DNS names to Services.

```
# Service DNS naming convention
<service-name>.<namespace>.svc.cluster.local

# Examples
api-service.myapp.svc.cluster.local
postgres-service.myapp.svc.cluster.local

# Can be shortened within the same Namespace
api-service        # Same Namespace
api-service.myapp  # From a different Namespace
```

```yaml
# Example application configuration using DNS names
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: myapp
data:
  # Use Service name directly within the same Namespace
  DATABASE_HOST: "postgres-service"
  REDIS_HOST: "redis-service"
  # Use FQDN for Services in a different Namespace
  AUTH_SERVICE: "auth-service.auth-system.svc.cluster.local"
```

---

## 5. Namespace

A logical isolation unit for resources. Splits resources by team or environment.

### Code Example 4: Namespace Management

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    environment: staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: production
```

```bash
# Create a Namespace
kubectl apply -f namespace.yaml

# Deploy resources to a specific Namespace
kubectl apply -f deployment.yaml -n staging

# List resources in a Namespace
kubectl get all -n staging

# Change the default Namespace
kubectl config set-context --current --namespace=staging

# List resources in all Namespaces
kubectl get pods --all-namespaces
kubectl get pods -A  # Short form
```

### Resource Limits per Namespace with ResourceQuota

```yaml
# resource-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: staging-quota
  namespace: staging
spec:
  hard:
    # Compute resources
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    # Object counts
    pods: "20"
    services: "10"
    persistentvolumeclaims: "5"
    configmaps: "20"
    secrets: "20"
```

```yaml
# limit-range.yaml
# Sets default values and upper limits for individual Pods/containers in a Namespace
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: staging
spec:
  limits:
    - type: Container
      default:           # Default values for limits
        cpu: "500m"
        memory: "256Mi"
      defaultRequest:    # Default values for requests
        cpu: "100m"
        memory: "128Mi"
      max:               # Upper bound
        cpu: "2"
        memory: "2Gi"
      min:               # Lower bound
        cpu: "50m"
        memory: "64Mi"
```

---

## 6. ConfigMap and Secret

### ConfigMap: Managing Non-Sensitive Configuration Data

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: myapp
data:
  # Simple key-value pairs
  DATABASE_HOST: "postgres-service"
  DATABASE_PORT: "5432"
  LOG_LEVEL: "info"
  CACHE_TTL: "3600"

  # Configuration that can be mounted as a file
  nginx.conf: |
    server {
      listen 80;
      server_name localhost;
      location / {
        proxy_pass http://api-service:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
      }
    }

  application.yaml: |
    server:
      port: 8080
    spring:
      datasource:
        url: jdbc:postgresql://postgres-service:5432/myapp
```

```bash
# Create ConfigMap from a file
kubectl create configmap nginx-config --from-file=nginx.conf

# Create ConfigMap from literal values
kubectl create configmap app-config \
  --from-literal=DATABASE_HOST=postgres-service \
  --from-literal=LOG_LEVEL=info

# View ConfigMap contents
kubectl get configmap app-config -o yaml
```

### Secret: Managing Sensitive Data

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
  namespace: myapp
type: Opaque
data:
  # base64-encoded (echo -n 'value' | base64)
  DB_PASSWORD: c2VjcmV0MTIz
  API_KEY: bXktYXBpLWtleS0xMjM0NQ==
  JWT_SECRET: c3VwZXItc2VjcmV0LWtleQ==

---
# Using stringData allows plain text (automatically base64-encoded on apply)
apiVersion: v1
kind: Secret
metadata:
  name: app-secret-plain
  namespace: myapp
type: Opaque
stringData:
  DB_PASSWORD: secret123
  API_KEY: my-api-key-12345
```

```bash
# Create a Secret from the command line
kubectl create secret generic db-secret \
  --from-literal=password=secret123 \
  --from-literal=username=admin

# Create a TLS Secret
kubectl create secret tls tls-secret \
  --cert=tls.crt \
  --key=tls.key

# Create a Docker Registry Secret
kubectl create secret docker-registry regcred \
  --docker-server=ghcr.io \
  --docker-username=myuser \
  --docker-password=mytoken

# View Secret contents (base64-decoded)
kubectl get secret app-secret -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

### ConfigMap / Secret Usage Patterns

```yaml
# Inject as environment variables
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
        - name: api
          image: my-api:latest
          env:
            # Individual key from ConfigMap
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: DATABASE_HOST
            # Individual key from Secret
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: DB_PASSWORD
          # Load all keys from ConfigMap as environment variables at once
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secret

          # Mount as files
          volumeMounts:
            - name: config-volume
              mountPath: /etc/nginx/conf.d
              readOnly: true
            - name: secret-volume
              mountPath: /etc/secrets
              readOnly: true

      volumes:
        - name: config-volume
          configMap:
            name: app-config
            items:
              - key: nginx.conf
                path: default.conf
        - name: secret-volume
          secret:
            secretName: app-secret
            defaultMode: 0400  # Read-only permission
```

---

## 7. PersistentVolume and PersistentVolumeClaim

### Persistent Storage Concepts

```
┌────────────────────────────────────────────────┐
│            Three-Layer Storage Structure        │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  PersistentVolumeClaim (PVC)             │ │
│  │  "I need 10Gi ReadWriteOnce"             │ │
│  │  → Storage specification requested by Pod│ │
│  └─────────────────┬────────────────────────┘ │
│                    │ Bind                      │
│  ┌─────────────────▼────────────────────────┐ │
│  │  PersistentVolume (PV)                   │ │
│  │  "There is an AWS EBS 10Gi"              │ │
│  │  → Actual storage provisioned by admin   │ │
│  └─────────────────┬────────────────────────┘ │
│                    │                           │
│  ┌─────────────────▼────────────────────────┐ │
│  │  StorageClass                            │ │
│  │  "Auto-create gp3 type EBS"              │ │
│  │  → Template for dynamic provisioning     │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Code Example: PersistentVolume / PVC

```yaml
# storage-class.yaml
# StorageClass for dynamic provisioning
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-storage
provisioner: kubernetes.io/aws-ebs   # Change according to cloud provider
parameters:
  type: gp3
  fsType: ext4
reclaimPolicy: Retain   # Delete | Retain | Recycle
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true

---
# pvc.yaml
# Storage requested by the application
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: myapp
spec:
  accessModes:
    - ReadWriteOnce     # Read/Write from a single node
  storageClassName: fast-storage
  resources:
    requests:
      storage: 10Gi

---
# Use PVC in a Pod
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: myapp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
              subPath: pgdata    # Mount to subdirectory
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: POSTGRES_PASSWORD
      volumes:
        - name: postgres-storage
          persistentVolumeClaim:
            claimName: postgres-data
```

### AccessMode Types

| AccessMode | Short | Description |
|---|---|---|
| ReadWriteOnce | RWO | Read/Write from a single node |
| ReadOnlyMany | ROX | ReadOnly from multiple nodes |
| ReadWriteMany | RWX | Read/Write from multiple nodes |
| ReadWriteOncePod | RWOP | Read/Write from a single Pod (K8s 1.27+) |

```bash
# Check PVC status
kubectl get pvc -n myapp
# NAME            STATUS   VOLUME         CAPACITY   ACCESS MODES
# postgres-data   Bound    pvc-abc123     10Gi       RWO

# List PVs
kubectl get pv
# NAME         CAPACITY   RECLAIM POLICY   STATUS
# pvc-abc123   10Gi       Retain           Bound
```

---

## 8. Ingress

### L7 Load Balancing

Ingress provides routing at the HTTP/HTTPS layer, routing to multiple Services from a single IP address.

```
Internet
    │
    ▼
┌─────────────────────────────────────────┐
│  Ingress Controller (nginx, traefik, etc.)│
│                                          │
│  Rules:                                  │
│  api.example.com  → api-service:80      │
│  web.example.com  → web-service:80      │
│  example.com/docs → docs-service:80     │
└─────────────────────────────────────────┘
    │              │              │
    ▼              ▼              ▼
┌────────┐  ┌────────┐   ┌────────┐
│  API   │  │  Web   │   │  Docs  │
│Service │  │Service │   │Service │
└────────┘  └────────┘   └────────┘
```

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: myapp
  annotations:
    # Settings for nginx Ingress Controller
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    # Automatically obtain TLS certificate with cert-manager
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
        - web.example.com
      secretName: app-tls
  rules:
    # Host-based routing
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
    - host: web.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-service
                port:
                  number: 80
    # Path-based routing
    - host: example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-service
                port:
                  number: 80
```

```bash
# Enable Ingress in minikube
minikube addons enable ingress

# Check Ingress status
kubectl get ingress -n myapp
# NAME          CLASS   HOSTS                              ADDRESS        PORTS
# app-ingress   nginx   api.example.com,web.example.com    192.168.49.2   80, 443

# Ingress details
kubectl describe ingress app-ingress -n myapp
```

---

## 9. HPA (Horizontal Pod Autoscaler)

### Automatic Scaling Based on Load

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: myapp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    # CPU utilization-based
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # Scale out when CPU usage exceeds 70%
    # Memory utilization-based
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60   # Stabilization window for scale-up
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60            # Add up to 2 Pods every 60 seconds
    scaleDown:
      stabilizationWindowSeconds: 300  # Stabilization window for scale-down (5 minutes)
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60            # Reduce by up to 10% every 60 seconds
```

```bash
# Check HPA status
kubectl get hpa -n myapp
# NAME      REFERENCE        TARGETS         MINPODS   MAXPODS   REPLICAS
# api-hpa   Deployment/api   45%/70%,60%/80%   2         10        3

# HPA details
kubectl describe hpa api-hpa -n myapp

# Install metrics-server (minikube)
minikube addons enable metrics-server

# Check real-time resource usage
kubectl top pods -n myapp
kubectl top nodes
```

### HPA Operation Flow

```
                    metrics-server
                         │
                         │ Collect metrics
                         ▼
┌────────────────────────────────────────┐
│  HPA Controller                        │
│                                        │
│  Current CPU: 85%  Target: 70%         │
│  Current Replicas: 3                   │
│                                        │
│  Required Replicas = ceil(3 × 85/70) = 4│
│  → Scale out: 3 → 4 Pods              │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  Deployment: api (replicas: 3 → 4)    │
│  [Pod1] [Pod2] [Pod3] [Pod4 ← NEW]   │
└────────────────────────────────────────┘
```

---

## 10. RBAC (Role-Based Access Control)

### Access Control Basics

```yaml
# role.yaml
# Permission definition scoped to a Namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer-role
  namespace: staging
rules:
  # View Pods and logs
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
  # Manage Deployments
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
  # Manage Services
  - apiGroups: [""]
    resources: ["services"]
    verbs: ["get", "list", "watch", "create", "update"]
  # View ConfigMaps
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]

---
# rolebinding.yaml
# Assign a Role to a user
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: staging
subjects:
  - kind: User
    name: developer@example.com
    apiGroup: rbac.authorization.k8s.io
  - kind: Group
    name: developers
    apiGroup: rbac.authorization.k8s.io
  - kind: ServiceAccount
    name: ci-deployer
    namespace: staging
roleRef:
  kind: Role
  name: developer-role
  apiGroup: rbac.authorization.k8s.io
```

```yaml
# cluster-role.yaml
# Permission definition scoped to the entire cluster
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: readonly-cluster
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps", "namespaces"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: readonly-binding
subjects:
  - kind: Group
    name: viewers
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: readonly-cluster
  apiGroup: rbac.authorization.k8s.io
```

```bash
# Check permissions
kubectl auth can-i create deployments --namespace staging
# yes

kubectl auth can-i delete pods --namespace production
# no

# Check permissions for a specific user
kubectl auth can-i list pods --namespace staging --as developer@example.com
```

---

## 11. Hands-on with minikube

### Code Example 5: Building and Operating a minikube Cluster

```bash
# Install minikube (macOS)
brew install minikube

# Start the cluster
minikube start --driver=docker --memory=4096 --cpus=2

# Check cluster status
minikube status
kubectl cluster-info
kubectl get nodes

# Launch the dashboard
minikube dashboard

# === Practice: Deploying a Web Application ===

# 1. Create a Deployment
kubectl create deployment hello-web --image=nginx:alpine --replicas=3

# 2. Create a Service (NodePort)
kubectl expose deployment hello-web --type=NodePort --port=80

# 3. Access the Service via minikube
minikube service hello-web --url
# → A URL like http://192.168.49.2:30123 will be displayed

# 4. Scaling
kubectl scale deployment hello-web --replicas=5
kubectl get pods -w  # Monitor in real time

# 5. Rolling update
kubectl set image deployment/hello-web nginx=nginx:1.25-alpine
kubectl rollout status deployment/hello-web

# 6. Rollback
kubectl rollout undo deployment/hello-web

# 7. Cleanup
kubectl delete service hello-web
kubectl delete deployment hello-web

# Stop and delete minikube
minikube stop
minikube delete
```

### minikube Addons

```bash
# List available addons
minikube addons list

# Enable commonly used addons
minikube addons enable ingress          # Ingress Controller
minikube addons enable metrics-server   # Required for HPA
minikube addons enable dashboard        # Web UI
minikube addons enable registry         # Local registry
minikube addons enable storage-provisioner  # Dynamic PV

# Use the Docker daemon inside minikube (to use local images)
eval $(minikube docker-env)
docker build -t my-app:latest .
# → Use local images with imagePullPolicy: Never
```

---

## 12. Complete Application Example

### Code Example 6: Frontend + API + DB Configuration

```yaml
# complete-app.yaml

# === Namespace ===
apiVersion: v1
kind: Namespace
metadata:
  name: myapp
---

# === ConfigMap ===
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: myapp
data:
  DATABASE_HOST: "postgres-service"
  DATABASE_NAME: "myapp"
---

# === Secret ===
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
  namespace: myapp
type: Opaque
data:
  POSTGRES_PASSWORD: c2VjcmV0MTIz  # base64-encoded

---

# === PostgreSQL Deployment ===
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: myapp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: POSTGRES_PASSWORD
            - name: POSTGRES_DB
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: DATABASE_NAME
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---

# === PostgreSQL Service ===
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: myapp
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
  type: ClusterIP

---

# === API Deployment ===
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: myapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: my-api:latest
          ports:
            - containerPort: 8080
          env:
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: DATABASE_HOST
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: POSTGRES_PASSWORD
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"

---

# === API Service ===
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: myapp
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
  type: LoadBalancer
```

```bash
# Deploy all at once
kubectl apply -f complete-app.yaml

# Check status
kubectl get all -n myapp

# Example output:
# NAME                           READY   STATUS    RESTARTS   AGE
# pod/postgres-6d4f5c7b8-x2k9p  1/1     Running   0          2m
# pod/api-7f8d9e6a5-abc12       1/1     Running   0          2m
# pod/api-7f8d9e6a5-def34       1/1     Running   0          2m
#
# NAME                      TYPE           CLUSTER-IP     EXTERNAL-IP
# service/postgres-service  ClusterIP      10.96.0.15     <none>
# service/api-service       LoadBalancer   10.96.0.20     <pending>
```

---

## 13. kubectl Command Cheat Sheet

### Code Example 7: Commonly Used kubectl Commands

```bash
# === Check Resources ===
kubectl get pods                      # List Pods
kubectl get pods -o wide              # Detailed list (including node, IP)
kubectl get pods -o yaml              # Output in YAML format
kubectl get all                       # List all resources
kubectl get events --sort-by='.lastTimestamp'  # Events (for troubleshooting)

# === Debugging ===
kubectl describe pod <pod-name>       # Pod details (including events)
kubectl logs <pod-name>               # Log output
kubectl logs <pod-name> -c <container># Specific container in a multi-container Pod
kubectl logs <pod-name> --previous    # Logs from previous crash
kubectl exec -it <pod-name> -- sh    # Shell inside a Pod

# === Resource Management ===
kubectl apply -f manifest.yaml        # Create/update
kubectl delete -f manifest.yaml       # Delete
kubectl diff -f manifest.yaml         # Check diff

# === Port Forward (direct access from local to Pod) ===
kubectl port-forward pod/my-pod 8080:80
kubectl port-forward svc/my-service 8080:80
```

### Advanced Debugging Commands

```bash
# === Troubleshooting Flow ===

# 1. When a Pod fails to start
kubectl get pods -n myapp                     # Check STATUS
kubectl describe pod <pod-name> -n myapp      # Check Events section
kubectl get events -n myapp --sort-by='.lastTimestamp'

# 2. For CrashLoopBackOff
kubectl logs <pod-name> -n myapp --previous   # Logs from previous crash
kubectl describe pod <pod-name> -n myapp      # Check Exit Code

# 3. For ImagePullBackOff
kubectl describe pod <pod-name> -n myapp      # Check image name and tag
# → Typo in image name, non-existent tag, registry authentication issues

# 4. For Pending
kubectl describe pod <pod-name> -n myapp      # Check Scheduler message
kubectl get nodes                             # Check node status
kubectl describe node <node-name>             # Check node resource usage

# 5. Debugging network issues
kubectl run debug --rm -it --image=busybox -- sh
# Inside the Pod:
nslookup api-service.myapp.svc.cluster.local
wget -qO- http://api-service.myapp:80/health

# 6. Temporary debug container (ephemeral container)
kubectl debug -it <pod-name> --image=busybox --target=app

# === Check Resource Usage ===
kubectl top pods -n myapp
kubectl top pods -n myapp --sort-by=memory
kubectl top nodes

# === Filter with JSONPath ===
# Get IP addresses of all Pods
kubectl get pods -o jsonpath='{.items[*].status.podIP}'

# Get names of Running Pods
kubectl get pods --field-selector=status.phase=Running -o name

# Get only Pods with a specific label
kubectl get pods -l app=api,version=v2

# Custom column output
kubectl get pods -o custom-columns=\
NAME:.metadata.name,\
STATUS:.status.phase,\
NODE:.spec.nodeName,\
IP:.status.podIP
```

### kubectl Context Management

```bash
# List contexts
kubectl config get-contexts

# Check current context
kubectl config current-context

# Switch context
kubectl config use-context minikube
kubectl config use-context production-cluster

# Change default Namespace
kubectl config set-context --current --namespace=myapp

# kubectx / kubens (convenience tools)
brew install kubectx
kubectx minikube           # Switch context
kubens myapp               # Switch Namespace
```

---

## 14. Helm Introduction

### Package Manager Basics

Helm is the package manager for Kubernetes and templatizes the deployment of complex applications.

```bash
# Install Helm
brew install helm

# Add repositories
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Search for a Chart
helm search repo nginx
helm search hub prometheus   # Search Artifact Hub

# Install a Chart
helm install my-nginx bitnami/nginx -n myapp --create-namespace

# Customize with values.yaml
helm install my-nginx bitnami/nginx -n myapp \
  -f custom-values.yaml

# List releases
helm list -n myapp

# Upgrade a release
helm upgrade my-nginx bitnami/nginx -n myapp \
  --set replicaCount=3

# Rollback
helm rollback my-nginx 1 -n myapp

# Uninstall
helm uninstall my-nginx -n myapp
```

```yaml
# Example custom-values.yaml (bitnami/nginx)
replicaCount: 3

resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "500m"

service:
  type: ClusterIP

ingress:
  enabled: true
  hostname: web.example.com
  tls: true
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPU: 70
```

---

## 15. Production Best Practices

### Resource Configuration Guidelines

```yaml
# production-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
  labels:
    app: api
    version: v2.1.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: api
        version: v2.1.0
      annotations:
        # Prometheus metrics collection
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      # Spread across nodes to avoid concentration on a single node
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: api

      # Pod priority
      priorityClassName: high-priority

      # Service account
      serviceAccountName: api-sa
      automountServiceAccountToken: false

      # Security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000

      containers:
        - name: api
          image: ghcr.io/myorg/api:v2.1.0   # No latest tag; pin to version
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              name: http
          resources:
            requests:
              memory: "256Mi"
              cpu: "200m"
            limits:
              memory: "512Mi"
              cpu: "1000m"

          # Security settings
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]

          # Health checks
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            failureThreshold: 30
            periodSeconds: 2
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 15
            timeoutSeconds: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5
            timeoutSeconds: 3

          # For temporary files
          volumeMounts:
            - name: tmp
              mountPath: /tmp

      volumes:
        - name: tmp
          emptyDir: {}

      # Graceful Shutdown
      terminationGracePeriodSeconds: 60
```

### Production Checklist

| Category | Check Item | Priority |
|---|---|---|
| Image | Pin to a version instead of using `latest` tag | Required |
| Image | Pull from a private registry | Required |
| Resources | Set both requests and limits | Required |
| Probe | Configure all three: liveness, readiness, and startup | Required |
| Security | runAsNonRoot: true | Required |
| Security | readOnlyRootFilesystem: true | Recommended |
| Security | capabilities drop ALL | Recommended |
| Availability | 2 or more replicas | Required |
| Availability | Configure topologySpreadConstraints | Recommended |
| Availability | Configure PodDisruptionBudget | Recommended |
| Network | Restrict communication with NetworkPolicy | Recommended |
| Monitoring | Expose Prometheus metrics | Recommended |

### PodDisruptionBudget

```yaml
# pdb.yaml
# Maintain a minimum number of Pods even during node maintenance
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
  namespace: production
spec:
  minAvailable: 2      # At least 2 Pods always running
  # Or maxUnavailable: 1  # Allow at most 1 Pod to be stopped
  selector:
    matchLabels:
      app: api
```

### NetworkPolicy

```yaml
# network-policy.yaml
# Restrict traffic to API Pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow only HTTP from Ingress Controller
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8080
  egress:
    # Allow only communication to PostgreSQL
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    # Allow DNS resolution
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
```

---

## Anti-patterns

### Anti-pattern 1: Creating Pods Directly

```yaml
# NG: Create Pod directly (not automatically recovered on failure)
apiVersion: v1
kind: Pod
metadata:
  name: web
spec:
  containers:
    - name: web
      image: nginx:alpine

# OK: Managed with Deployment (auto-recovery, rolling updates)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    # ...
```

**Why it's a problem**: Pods created directly are not automatically recreated on node failure or Pod crash. A Deployment maintains the replica count and automatically recovers to the declared state on failure.

### Anti-pattern 2: Not Setting Resource Limits

```yaml
# NG: No resource limits
containers:
  - name: app
    image: my-app:latest
    # resources not set → may consume all node resources

# OK: Always set both requests and limits
containers:
  - name: app
    image: my-app:latest
    resources:
      requests:
        memory: "128Mi"
        cpu: "100m"
      limits:
        memory: "256Mi"
        cpu: "500m"
```

**Why it's a problem**: Pods without resource limits can steal resources from other Pods on the same node, destabilizing the entire cluster. The Scheduler also cannot make appropriate placement decisions.

### Anti-pattern 3: Using the latest Tag

```yaml
# NG: latest tag (it's unclear which version is running)
containers:
  - name: app
    image: my-app:latest

# OK: Pin with semantic versioning
containers:
  - name: app
    image: my-app:2.1.0
    # Or pin completely with image digest
    # image: my-app@sha256:abc123...
```

**Why it's a problem**: The `latest` tag makes it impossible to track which version is running, and rollback is not possible. Reproducibility of deployments is lost, and different images may run with the same manifest.

### Anti-pattern 4: Hardcoding Secrets in Manifests

```yaml
# NG: Plain text password in manifest
containers:
  - name: app
    env:
      - name: DB_PASSWORD
        value: "my-secret-password"   # Stays in Git!

# OK: Use Secret resource
containers:
  - name: app
    env:
      - name: DB_PASSWORD
        valueFrom:
          secretKeyRef:
            name: db-secret
            key: password
```

**Why it's a problem**: Since manifests are managed in Git, passwords remain in the repository history. Best practice is to use External Secrets Operator or Sealed Secrets to manage secrets in an encrypted state in Git.

### Anti-pattern 5: Not Setting Health Checks

```yaml
# NG: No Probes (cannot detect abnormalities)
containers:
  - name: app
    image: my-app:1.0.0
    ports:
      - containerPort: 8080

# OK: Configure all three Probe types appropriately
containers:
  - name: app
    image: my-app:1.0.0
    ports:
      - containerPort: 8080
    startupProbe:           # Startup completion check
      httpGet:
        path: /health
        port: 8080
      failureThreshold: 30
      periodSeconds: 2
    livenessProbe:          # Liveness check
      httpGet:
        path: /health
        port: 8080
      periodSeconds: 15
    readinessProbe:         # Request acceptance check
      httpGet:
        path: /ready
        port: 8080
      periodSeconds: 5
```

**Why it's a problem**: Without Probes, deadlocked or infinite-looping applications cannot be detected, and requests continue to be sent to abnormal Pods. Without startupProbe, slow-starting applications may be erroneously restarted by the livenessProbe.

---

## FAQ

### Q1: What is the difference between requests and limits?

- **requests**: The minimum guaranteed value used by the Scheduler when selecting a node. This amount of resources is always reserved.
- **limits**: The upper bound. Exceeding it causes CPU throttling; for memory, OOM Kill occurs.

General guideline: set `requests` to normal usage and `limits` to 1.5-2x the peak usage.

### Q2: What is the difference between livenessProbe and readinessProbe?

- **livenessProbe**: Checks whether the container is "alive." Failure causes the container to be restarted. Useful for detecting deadlocks.
- **readinessProbe**: Checks whether the container is "ready to accept requests." Failure removes it from the Service endpoints (does not restart). Useful for warmup at startup.

### Q3: What is the difference between `kubectl apply` and `kubectl create`?

`create` only creates new resources (error if the resource already exists). `apply` uses declarative management: it creates the resource if it doesn't exist, or updates it if it does. Always use `apply` in production.

### Q4: How do you choose between ConfigMap and Secret?

- **ConfigMap**: Non-sensitive configuration data (DB_HOST, LOG_LEVEL, config files, etc.)
- **Secret**: Sensitive data (passwords, API keys, TLS certificates, etc.)

Note that Secrets are only Base64-encoded by default and are not encrypted. For production, it is recommended to use etcd encryption (EncryptionConfiguration) or External Secrets Operator.

### Q5: How should Namespaces be designed?

Common patterns:

```
# By environment
default        # Do not use (place no resources here)
development    # Development environment
staging        # Staging environment
production     # Production environment

# By team × environment
team-a-dev     # Team A development
team-a-prod    # Team A production
team-b-dev     # Team B development

# By microservice
auth-system    # Authentication services
payment        # Payment services
notification   # Notification services
```

Combine ResourceQuota and LimitRange to achieve fair resource allocation per Namespace.

### Q6: What is the difference between minikube and kind?

| Item | minikube | kind |
|---|---|---|
| Use case | Local development and learning | CI/CD and testing |
| Multi-node | Possible (v1.10+) | Easily possible |
| Startup speed | Somewhat slow | Fast |
| Addons | Rich | Minimal |
| Drivers | Docker, VirtualBox, etc. | Docker only |

minikube is suitable for learning; kind is suitable for CI/CD.

### Q7: When should I use StatefulSet?

Use StatefulSet when you need ordered, stable Pod management.

```yaml
# Differences from Deployment
# - Pod names are fixed (postgres-0, postgres-1, postgres-2)
# - Start and stop order is guaranteed
# - Each Pod has a fixed PersistentVolume attached
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-headless  # Headless Service required
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    # ...
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-storage
        resources:
          requests:
            storage: 10Gi
```

Primary use cases: databases, message queues (Kafka), distributed storage (Elasticsearch)

### Q8: How do you manage logs on Kubernetes?

```
Application
  │ stdout/stderr
  ▼
kubelet (log files on the node)
  │
  ▼
┌──────────────────────────────────────┐
│  Log Collection Patterns              │
│                                      │
│  1. Sidecar: Fluent Bit/Fluentd      │
│     → Deploy a log-forwarding        │
│       container in each Pod          │
│                                      │
│  2. DaemonSet: Fluent Bit/Fluentd    │
│     → One log collection Pod per node│
│     → Collects log files on the node │
│                                      │
│  3. Direct forwarding: send from app │
│     → Output directly to centralized │
│       log service                    │
└──────────────────────────────────────┘
  │
  ▼
Elasticsearch / Loki / CloudWatch, etc.
  │
  ▼
Visualized with Kibana / Grafana, etc.
```

The recommended approach is the DaemonSet pattern. Applications output logs in JSON format to stdout/stderr, and a per-node DaemonSet collects and forwards them.

---

## Summary

| Item | Key Points |
|------|---------|
| Pod | Smallest deployable unit. Manage with Deployment rather than creating directly |
| Deployment | Replica management, rolling updates, rollback |
| Service | Stable network endpoint. ClusterIP/NodePort/LoadBalancer |
| Namespace | Logical isolation of resources. Use per environment and team |
| ConfigMap/Secret | Separately manage configuration and sensitive data. Inject as env vars or file mounts |
| PersistentVolume | Retain data after Pod restarts. Dynamic provisioning with StorageClass |
| Ingress | L7 routing. Distribute to multiple Services by host/path |
| HPA | Automatic horizontal scaling based on CPU/memory |
| RBAC | Access control with Role/ClusterRole. Principle of least privilege |
| Helm | Package manager. Templatize complex deployments |
| kubectl | Declarative management with `apply`. Debug with `describe` and `logs` |
| Resource limits | requests/limits are mandatory. Enables Scheduler placement and OOM prevention |
| Probe | startup=startup check, liveness=restart, readiness=Service exclusion |

---

## Next Guides to Read

- [Kubernetes Advanced](./02-kubernetes-advanced.md) -- Helm, Ingress, HPA, persistent volumes
- [Orchestration Overview](./00-orchestration-overview.md) -- Comparison with Swarm and selection criteria
- [Container Security](../06-security/00-container-security.md) -- Kubernetes security configuration

---

## References

1. Kubernetes Official Documentation "Concepts" -- https://kubernetes.io/docs/concepts/
2. Kubernetes Official Tutorial -- https://kubernetes.io/docs/tutorials/
3. Nigel Poulton (2023) *The Kubernetes Book*, Independently Published
4. Brendan Burns, Joe Beda, Kelsey Hightower (2022) *Kubernetes: Up and Running*, 3rd Edition, O'Reilly
5. minikube Official Documentation -- https://minikube.sigs.k8s.io/docs/
6. Helm Official Documentation -- https://helm.sh/docs/
7. Kubernetes Best Practices -- https://kubernetes.io/docs/concepts/configuration/overview/
